#!/usr/bin/env node
/**
 * reddit-dm-sender.js
 * Engages warm leads from complaint monitoring.
 * For WARM leads with status="found": posts comment first, waits 5 min, sends DM
 * For leads with status="commented" + dmReadyAt passed: sends DM only
 * Run at 2pm PST daily via cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const WARM_LEADS = path.join(WORKSPACE, 'outreach/reddit/warm-leads.json');
const ENGAGEMENT_LOG = path.join(WORKSPACE, 'outreach/reddit/engagement-log.json');

const MAX_LEADS_PER_RUN = 5;

console.log(`\n📤 Reddit DM Sender — ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\n`);

// Load warm leads
let warmLeads = { leads: [] };
if (fs.existsSync(WARM_LEADS)) {
  try { warmLeads = JSON.parse(fs.readFileSync(WARM_LEADS, 'utf8')); } catch (_) {}
}

// Find leads ready for engagement
// Priority 1: status="found" (need comment + DM)
// Priority 2: status="commented" + dmReadyAt passed (DM only)
const now = new Date();

const needsComment = warmLeads.leads.filter(lead => 
  lead.status === 'found' && 
  lead.tier === 'warm'
);

const needsDM = warmLeads.leads.filter(lead => 
  lead.status === 'commented' && 
  lead.dmReadyAt && 
  new Date(lead.dmReadyAt) < now &&
  !lead.dmSentAt
);

console.log(`Leads needing comment: ${needsComment.length}`);
console.log(`Leads needing DM: ${needsDM.length}\n`);

// Limit total leads per run
const toEngage = [
  ...needsComment.slice(0, MAX_LEADS_PER_RUN),
  ...needsDM.slice(0, Math.max(0, MAX_LEADS_PER_RUN - needsComment.length))
];

if (toEngage.length === 0) {
  console.log('No leads ready. Exiting.\n');
  process.exit(0);
}

console.log(`Engaging ${toEngage.length} lead(s):\n`);
toEngage.forEach((lead, i) => {
  const action = lead.status === 'found' ? 'comment + DM' : 'DM only';
  console.log(`  ${i + 1}. u/${lead.author} — ${lead.painType} (${action})`);
});

// Process each lead
toEngage.forEach((lead, idx) => {
  const leadNum = idx + 1;
  
  console.log(`\n─── Lead ${leadNum}/${toEngage.length}: u/${lead.author} ───\n`);
  
  if (lead.status === 'found') {
    // STEP 1: Post comment first
    console.log(`Step 1: Posting comment...\n`);
    
    const commentSessionMsg = [
      `REDDIT COMMENT — post as u/Alive_Kick7098`,
      ``,
      `BROWSER: Use profile="openclaw". Logged into Reddit as u/Alive_Kick7098.`,
      ``,
      `Navigate to: ${lead.postUrl}`,
      ``,
      `Read the post carefully. Look for ONE specific detail you can react to.`,
      ``,
      `Draft a 2-4 sentence comment:`,
      `- Opens with empathy or acknowledgment (not advice)`,
      `- References ONE specific thing from their post`,
      `- Shares one actionable tip they can use today (free, no pitch)`,
      `- No links, no self-promotion, no "we help with"`,
      `- Lowercase, casual, contractions`,
      `- No colons, no double quotes, no em dashes`,
      `- 2-4 sentences max`,
      ``,
      `Example structure (do NOT copy this exactly):`,
      `the leap from building to running is tough. you've got the product down but now you're swamped by everything that comes next.`,
      ``,
      `one thing that worked: separate client intake from delivery completely. put a proper form in front of every new lead before you hop on a call. cuts the back-and-forth by like 80 percent.`,
      ``,
      `the admin load after launch is the part nobody talks about. it'll eat every hour you don't systemize.`,
      ``,
      `⚡ HUMANIZE (MANDATORY):`,
      `- Run: /humanizer [paste your draft]`,
      `- Wait for output`,
      `- Use ONLY the humanized version`,
      ``,
      `POST using old.reddit.com:`,
      `- textarea[name="text"] → focus → execCommand insertText → click Save`,
      `- Upvote: .arrow.up → click`,
      `- Reload, confirm comment appears`,
      `- Copy the comment URL (right-click on comment timestamp → copy link)`,
      ``,
      `UPDATE warm-leads.json:`,
      `const fs = require('fs');`,
      `const path = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json';`,
      `const leads = JSON.parse(fs.readFileSync(path, 'utf8'));`,
      `const lead = leads.leads.find(l => l.author === '${lead.author}');`,
      `if (lead) {`,
      `  lead.status = 'commented';`,
      `  lead.commentedAt = new Date().toISOString();`,
      `  lead.commentUrl = 'PASTE_COMMENT_URL_HERE';`,
      `  // Set dmReadyAt to 5 minutes from now`,
      `  lead.dmReadyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();`,
      `}`,
      `fs.writeFileSync(path, JSON.stringify(leads, null, 2));`,
      ``,
      `DISCORD NOTIFY (socmed-sessions):`,
      `✅ Comment posted on r/${lead.subreddit}`,
      `Post: ${lead.postTitle}`,
      `Lead: u/${lead.author}`,
      `Pain: ${lead.painType}`,
      `DM window opens in 5 min`,
    ].join('\n');
    
    const commentSessionName = `reddit-comment-${lead.author}-${Date.now()}`;
    const commentResult = spawnSync('openclaw', [
      'cron', 'add',
      '--name', commentSessionName,
      '--at', new Date(Date.now() + 30000).toISOString(),
      '--message', commentSessionMsg,
      '--channel', 'discord',
      '--to', '1485556397293703279',
      '--delete-after-run',
      '--tz', 'America/Los_Angeles'
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    
    if (commentResult.status === 0) {
      console.log(`✓ Comment session created: ${commentSessionName}`);
    } else {
      console.error(`✗ Comment session failed: ${commentResult.stderr}`);
    }
    
    // STEP 2: Wait 5 minutes, then send DM
    console.log(`\nStep 2: Scheduling DM for 5 minutes after comment...\n`);
    
    const dmSessionMsg = [
      `REDDIT DM — send as u/Alive_Kick7098`,
      ``,
      `BROWSER: Use profile="openclaw". Logged into Reddit as u/Alive_Kick7098.`,
      ``,
      `Lead context:`,
      `- Author: u/${lead.author}`,
      `- Post: ${lead.postTitle}`,
      `- URL: ${lead.postUrl}`,
      `- Pain type: ${lead.painType}`,
      `- Our comment URL: CHECK warm-leads.json for lead.commentUrl`,
      ``,
      `Navigate to: https://old.reddit.com/user/${lead.author}`,
      ``,
      `Click "Chat" or "Send Message" on their profile.`,
      `If no button appears, they have DMs disabled — log and skip.`,
      ``,
      `Draft a DM (read our comment first for context):`,
      `- Opens referencing something SPECIFIC from their post (not generic)`,
      `- Gives one actionable tip they can use today (free, no pitch)`,
      `- Soft pitch: "im on a small team building fountain of scale that helps [their pain] for [their business type]"`,
      `- Close: "no pressure either way"`,
      `- Lowercase, casual, contractions`,
      `- No colons, no double quotes, no em dashes`,
      `- 4-6 sentences total`,
      ``,
      `Example structure (do NOT copy this exactly):`,
      `hey, saw your post about the agency scaling struggle. the constant client chasing plus admin exhaustion combo is brutal when you're trying to grow.`,
      ``,
      `here's something that might help right now. try requiring a completed intake form before any discovery call. just 5-6 questions about budget, timeline, and what they've tried before. you'll immediately spot the tire-kickers and the serious ones self-qualify. saves hours of back-and-forth every week.`,
      ``,
      `i'm on a small team building fountain of scale that helps web dev agencies automate the intake plus follow-up side so you're not manually tracking every lead in spreadsheets or losing people in the gap between interested and booked.`,
      ``,
      `happy to share more if that's useful, no pressure either way.`,
      ``,
      `⚡ HUMANIZE (MANDATORY):`,
      `- Run: /humanizer [paste your draft]`,
      `- Wait for output`,
      `- Use ONLY the humanized version`,
      ``,
      `SEND using old.reddit.com:`,
      `- In message textbox: const ta = document.querySelector('textarea'); ta.focus(); document.execCommand('insertText', false, 'HUMANIZED_TEXT');`,
      `- Click send button`,
      `- Wait 2-3 seconds, confirm sent`,
      ``,
      `UPDATE warm-leads.json:`,
      `const fs = require('fs');`,
      `const path = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json';`,
      `const leads = JSON.parse(fs.readFileSync(path, 'utf8'));`,
      `const lead = leads.leads.find(l => l.author === '${lead.author}');`,
      `if (lead) {`,
      `  lead.status = 'dm-sent';`,
      `  lead.dmSentAt = new Date().toISOString();`,
      `  lead.dmStatus = 'sent';`,
      `}`,
      `fs.writeFileSync(path, JSON.stringify(leads, null, 2));`,
      ``,
      `LOG to engagement-log.json:`,
      `const fs = require('fs');`,
      `const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json';`,
      `const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
      `log.sessions.push({`,
      `  timestamp: new Date().toISOString(),`,
      `  type: 'dm',`,
      `  author: '${lead.author}',`,
      `  postUrl: '${lead.postUrl}',`,
      `  painType: '${lead.painType}',`,
      `  platform: 'reddit',`,
      `  account: 'Alive_Kick7098',`,
      `  dmStatus: 'sent'`,
      `});`,
      `fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
      ``,
      `DISCORD NOTIFY (socmed-sessions):`,
      `✅ DM sent to u/${lead.author}`,
      `Pain: ${lead.painType}`,
      `Post: ${lead.postTitle}`,
    ].join('\n');
    
    // Schedule DM for 5 minutes + 30 seconds from now (gives comment session time to run)
    const dmSessionName = `reddit-dm-${lead.author}-${Date.now()}`;
    const dmResult = spawnSync('openclaw', [
      'cron', 'add',
      '--name', dmSessionName,
      '--at', new Date(Date.now() + 5 * 60 * 1000 + 30000).toISOString(),
      '--message', dmSessionMsg,
      '--channel', 'discord',
      '--to', '1485556397293703279',
      '--delete-after-run',
      '--tz', 'America/Los_Angeles'
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    
    if (dmResult.status === 0) {
      console.log(`✓ DM session created: ${dmSessionName}`);
    } else {
      console.error(`✗ DM session failed: ${dmResult.stderr}`);
    }
    
  } else if (lead.status === 'commented') {
    // DM only (comment already posted)
    console.log(`Step 1: Sending DM (comment already posted)...\n`);
    
    const dmSessionMsg = [
      `REDDIT DM — send as u/Alive_Kick7098`,
      ``,
      `BROWSER: Use profile="openclaw". Logged into Reddit as u/Alive_Kick7098.`,
      ``,
      `Lead context:`,
      `- Author: u/${lead.author}`,
      `- Post: ${lead.postTitle}`,
      `- URL: ${lead.postUrl}`,
      `- Pain type: ${lead.painType}`,
      `- Our comment URL: ${lead.commentUrl || 'check warm-leads.json'}`,
      ``,
      `Navigate to: https://old.reddit.com/user/${lead.author}`,
      ``,
      `Click "Chat" or "Send Message" on their profile.`,
      `If no button appears, they have DMs disabled — log and skip.`,
      ``,
      `Draft a DM (read our comment first for context):`,
      `- Opens referencing something SPECIFIC from their post (not generic)`,
      `- Gives one actionable tip they can use today (free, no pitch)`,
      `- Soft pitch: "i'm on a small team building fountain of scale that helps [their pain] for [their business type]"`,
      `- Close: "no pressure either way"`,
      `- Lowercase, casual, contractions`,
      `- No colons, no double quotes, no em dashes`,
      `- 4-6 sentences total`,
      ``,
      `⚡ HUMANIZE (MANDATORY):`,
      `- Run: /humanizer [paste your draft]`,
      `- Wait for output`,
      `- Use ONLY the humanized version`,
      ``,
      `SEND using old.reddit.com:`,
      `- In message textbox: const ta = document.querySelector('textarea'); ta.focus(); document.execCommand('insertText', false, 'HUMANIZED_TEXT');`,
      `- Click send button`,
      `- Wait 2-3 seconds, confirm sent`,
      ``,
      `UPDATE warm-leads.json:`,
      `const fs = require('fs');`,
      `const path = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json';`,
      `const leads = JSON.parse(fs.readFileSync(path, 'utf8'));`,
      `const lead = leads.leads.find(l => l.author === '${lead.author}');`,
      `if (lead) {`,
      `  lead.status = 'dm-sent';`,
      `  lead.dmSentAt = new Date().toISOString();`,
      `  lead.dmStatus = 'sent';`,
      `}`,
      `fs.writeFileSync(path, JSON.stringify(leads, null, 2));`,
      ``,
      `LOG to engagement-log.json:`,
      `const fs = require('fs');`,
      `const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json';`,
      `const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
      `log.sessions.push({`,
      `  timestamp: new Date().toISOString(),`,
      `  type: 'dm',`,
      `  author: '${lead.author}',`,
      `  postUrl: '${lead.postUrl}',`,
      `  painType: '${lead.painType}',`,
      `  platform: 'reddit',`,
      `  account: 'Alive_Kick7098',`,
      `  dmStatus: 'sent'`,
      `});`,
      `fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
      ``,
      `DISCORD NOTIFY (socmed-sessions):`,
      `✅ DM sent to u/${lead.author}`,
      `Pain: ${lead.painType}`,
      `Post: ${lead.postTitle}`,
    ].join('\n');
    
    const dmSessionName = `reddit-dm-${lead.author}-${Date.now()}`;
    const dmResult = spawnSync('openclaw', [
      'cron', 'add',
      '--name', dmSessionName,
      '--at', new Date(Date.now() + 30000).toISOString(),
      '--message', dmSessionMsg,
      '--channel', 'discord',
      '--to', '1485556397293703279',
      '--delete-after-run',
      '--tz', 'America/Los_Angeles'
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    
    if (dmResult.status === 0) {
      console.log(`✓ DM session created: ${dmSessionName}`);
    } else {
      console.error(`✗ DM session failed: ${dmResult.stderr}`);
    }
  }
});

console.log(`\n✅ Reddit DM sender done. ${toEngage.length} lead(s) engaged.\n`);
