#!/usr/bin/env node
/**
 * reddit-dm-sender.js
 * Sends DMs to warm leads who are ready (commented + dmReadyAt window passed).
 * Run at 2pm PST daily via cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE    = '/Users/mantisclaw/.openclaw/workspace';
const WARM_LEADS   = path.join(WORKSPACE, 'outreach/reddit/warm-leads.json');
const DM_TEMPLATES = path.join(WORKSPACE, 'outreach/reddit/dm-templates.json');
const ENGAGEMENT_LOG = path.join(WORKSPACE, 'outreach/reddit/engagement-log.json');

const MAX_DMS_PER_RUN = 5;

// Load data
let warmLeads = { leads: [] };
let templates = { templates: {} };

if (fs.existsSync(WARM_LEADS)) {
  try { warmLeads = JSON.parse(fs.readFileSync(WARM_LEADS, 'utf8')); } catch (_) {}
}
if (fs.existsSync(DM_TEMPLATES)) {
  try { templates = JSON.parse(fs.readFileSync(DM_TEMPLATES, 'utf8')); } catch (_) {}

}

// Find leads ready for DM
const now = new Date();
const readyLeads = warmLeads.leads.filter(lead => 
  lead.status === 'commented' && 
  lead.dmReadyAt && 
  new Date(lead.dmReadyAt) < now &&
  !lead.dmSentAt
);

console.log(`\n📤 Reddit DM Sender — ${now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
console.log(`   Found ${readyLeads.length} lead(s) ready for DM`);

if (readyLeads.length === 0) {
  console.log('   No leads ready. Exiting.\n');
  process.exit(0);
}

// Limit to MAX_DMS_PER_RUN
const toSend = readyLeads.slice(0, MAX_DMS_PER_RUN);

toSend.forEach((lead, idx) => {
  console.log(`\n   ${idx + 1}. ${lead.author} — ${lead.painType}`);
  console.log(`      Post: ${lead.postTitle}`);
  console.log(`      Template: ${lead.painType}`);
});

// Generate session message
const sessionMessage = [
  `REDDIT DM SENDER — Send DMs to ${toSend.length} warm lead(s). Post as u/Alive_Kick7098.`,
  ``,
  `BROWSER: Use profile="openclaw" for ALL browser tool calls. This browser should be logged into Reddit as u/Alive_Kick7098.`,
  ``,
  `CRITICAL: Read these files first:`,
  `  /Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json`,
  `  /Users/mantisclaw/.openclaw/workspace/outreach/reddit/dm-templates.json`,
  ``,
  `⚠️  RULES:`,
  `  - Only send DMs to leads listed below`,
  `  - Use the exact template for each lead's painType`,
  `  - Never send the same DM twice (check dmSentAt before sending)`,
  `  - Use old.reddit.com for DM flow`,
  ``,
  `📋 LEADS TO DM:`,
  ``,
  ...toSend.map((lead, i) => 
    `${i + 1}. ${lead.author} (${lead.painType})\n   Post: ${lead.postTitle}\n   URL: ${lead.postUrl}\n   Template key: ${lead.painType}\n`
  ),
  ``,
  `🔄 DM FLOW (per lead):`,
  ``,
  `1. Navigate to: https://old.reddit.com/user/TARGET_USERNAME`,
  ``,
  `2. Click the "Chat" or "Send Message" button on their profile.`,
  `   If no button appears, they have DMs disabled — skip and log.`,
  ``,
  `3. In the message textbox, type the template text using:`,
  `   JS: const ta = document.querySelector('textarea');`,
  `       ta.focus();`,
  `       document.execCommand('insertText', false, 'TEMPLATE TEXT HERE');`,
  ``,
  `4. Click the send button (usually says "Chat" or has a paper plane icon).`,
  `   JS: document.querySelector('button[type="submit"]')?.click()`,
  ``,
  `5. Wait 2-3 seconds, then navigate to next lead.`,
  ``,
  `📝 LOGGING (after all DMs sent):`,
  ``,
  `Update warm-leads.json:`,
  `   const fs = require('fs');`,
  `   const path = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json';`,
  `   const data = JSON.parse(fs.readFileSync(path, 'utf8'));`,
  `   data.leads.forEach(lead => {`,
  `     if (['${toSend.map(l => l.author).join("', '")}'].includes(lead.author) && !lead.dmSentAt) {`,
  `       lead.status = 'dm-sent';`,
  `       lead.dmSentAt = new Date().toISOString();`,
  `       lead.dmStatus = 'sent';`,
  `     }`,
  `   });`,
  `   fs.writeFileSync(path, JSON.stringify(data, null, 2));`,
  ``,
  `Append to engagement-log.json:`,
  `   const fs = require('fs');`,
  `   const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json';`,
  `   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
  `   ${toSend.map(lead => `log.sessions.push({ timestamp: new Date().toISOString(), type: 'dm', author: '${lead.author}', postUrl: '${lead.postUrl}', painType: '${lead.painType}', platform: 'reddit', account: 'Alive_Kick7098', dmStatus: 'sent' });`).join('\n   ')}`,
  `   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
  ``,
  `Append to daily-summary.md (for 11pm recap):`,
  `   const fs = require('fs');`,
  `   const summaryPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/daily-summary.md';`,
  `   const today = new Date().toISOString().split('T')[0];`,
  `   let summary = '';`,
  `   if (fs.existsSync(summaryPath)) summary = fs.readFileSync(summaryPath, 'utf8');`,
  `   if (!summary.includes(today)) {`,
  `     summary = '## ' + today + '\\n\\n' + summary;`,
  `   }`,
  `   const dmSection = '\\n### DMs Sent\\n' + ${JSON.stringify(toSend.map(l => `- @${l.author} (${l.painType}) - ${l.postTitle}`))}.join('\\n');`,
  `   if (!summary.includes('### DMs Sent')) {`,
  `     summary = summary.replace('## ' + today, '## ' + today + '\\n' + dmSection);`,
  `   } else {`,
  `     summary = summary.replace(/(### DMs Sent\\n)/, '$1' + ${JSON.stringify(toSend.map(l => `- @${l.author} (${l.painType})`)).join('\\n')} + '\\n');`,
  `   }`,
  `   fs.writeFileSync(summaryPath, summary);`,
  ``,
  `📬 DISCORD SESSIONS NOTIFY:`,
  ``,
  `Send a summary to Discord (channel="discord", target="1485556397293703279"):`,
  `"DMs sent: ${toSend.length}`,
  `- ${toSend.map(l => `@${l.author} (${l.painType})`).join('\n- ')}"`,
].join('\n');

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const time = new Date().toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: '2-digit', minute: '2-digit', hour12: false
}).replace(' ', '');

const name = `reddit-dm-send-${today.replace(/-/g,'')}-${time.replace(':','')}`;

console.log(`\n🕐 Creating one-shot session: ${name}`);

const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', name,
  '--at', new Date().toISOString(),
  '--message', sessionMessage,
  '--announce',
  '--delete-after-run',
  '--tz', 'America/Los_Angeles'
], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

if (result.status === 0) {
  console.log(`✓ Session created: ${name}`);
  
  // FIX: Direct write-back — don't rely on session to update warm-leads.json
  console.log(`\n📝 Updating warm-leads.json directly...`);
  try {
    const warmLeads = JSON.parse(fs.readFileSync(WARM_LEADS, 'utf8'));
    let updated = 0;
    
    toSend.forEach(lead => {
      const matchingLead = warmLeads.leads.find(l => l.author === lead.author);
      if (matchingLead && !matchingLead.dmSentAt) {
        matchingLead.status = 'dm-sent';
        matchingLead.dmSentAt = new Date().toISOString();
        matchingLead.dmStatus = 'sent';
        updated++;
        console.log(`   ✓ ${lead.author} → dm-sent`);
      }
    });
    
    fs.writeFileSync(WARM_LEADS, JSON.stringify(warmLeads, null, 2));
    console.log(`   Updated ${updated} lead(s)\n`);
  } catch (e) {
    console.error(`   ✗ Failed to update warm-leads.json: ${e.message}\n`);
  }
  
  console.log(`✅ Reddit DM sender done.\n`);
} else {
  console.error(`✗ Failed: ${name}\n${result.stderr}`);
  console.error(`  stdout: ${result.stdout}`);
  process.exit(1);
}
