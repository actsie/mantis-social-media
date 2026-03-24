#!/usr/bin/env node
/**
 * reddit-complaint-monitor-midday.js
 * Searches Reddit for complaint posts, tiers leads (HOT/WARM/COLD),
 * logs to KameleonDB via log-lead.js, populates warm-leads.json.
 * Run at 2:00 PM PST daily via cron.
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const WARM_LEADS = path.join(WORKSPACE, 'outreach/reddit/warm-leads.json');
const INBOUND_LEADS = path.join(WORKSPACE, 'outreach/inbound-leads.json');

// ── Config ────────────────────────────────────────────────────────────────────

const COMPLAINT_REDDITS = ['smallbusiness', 'Entrepreneur', 'salonowners'];

const SEARCH_QUERIES = [
  'exhausted OR "burned out" OR "can\'t keep up" OR "working 80 hours"',
  '"phone won\'t stop" OR "inbox is" OR "DMs are" OR "too busy to respond"',
  '"no show" OR cancellation OR "didn\'t show up"',
  '"how do you handle" OR "recommend software" OR "recommend tool"',
  '"overwhelmed with" OR "can\'t eat" OR "no work-life balance"'
];

const PAIN_TYPE_MAP = {
  'chaos/no-systems': ['leads not followed', 'winging it', 'chaotic', 'slipping through', 'doing everything manually', 'build a system'],
  'communication-overload': ['phone won\'t stop', 'inbox is', 'DMs are', 'too busy to respond', 'overwhelmed with messages', 'constant stream', 'fall through the cracks', 'client requests', 'texts'],
  'burnout/overwhelm': ['exhausted', 'burned out', "can't keep up", 'working 80 hours', "can't eat", 'no work-life balance', 'eating me alive', 'losing motivation', 'spending 4-5 hours'],
  'instability/growth-frustration': ['thinking of closing', 'not worth it anymore', 'stuck at same', 'can\'t grow', 'plateaued', 'clients leaving', 'anxious about', 'revenue basically goes to zero'],
  'no-shows': ['no show', 'cancellation', 'didn\'t show up', 'last-minute cancel'],
  'staffing': ['staff quit', 'hiring is', 'doing everything myself', 'can\'t find help'],
  'customer-pressure': ['customers expect', 'people are so demanding', 'reviews are killing']
};

function detectPainType(title, text = '') {
  const combined = (title + ' ' + text).toLowerCase();
  for (const [painType, keywords] of Object.entries(PAIN_TYPE_MAP)) {
    if (keywords.some(kw => combined.includes(kw.toLowerCase()))) {
      return painType;
    }
  }
  return 'general';
}

function tierFromAge(ageHours) {
  if (ageHours < 2) return 'HOT';
  if (ageHours < 72) return 'WARM';
  return 'COLD';
}

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

// ── Load existing leads ───────────────────────────────────────────────────────

let warmLeads = { leads: [] };
if (fs.existsSync(WARM_LEADS)) {
  try { warmLeads = JSON.parse(fs.readFileSync(WARM_LEADS, 'utf8')); } catch (_) {}
}

// Track results for summary
const results = {
  postsFound: [],
  hotLeads: [],
  warmLeadsLogged: [],
  commentsPosted: []
};

// ── Generate session message ──────────────────────────────────────────────────

const today = todayPST();

const sessionMessage = [
  `REDDIT COMPLAINT MONITOR (MIDDAY) — ${today} — post as u/Alive_Kick7098.`,
  ``,
  `BROWSER: Use profile="openclaw" for ALL browser tool calls. Logged into Reddit as u/Alive_Kick7098.`,
  ``,
  `🎯 GOAL: Search for complaint posts from the last 72 hours. Log HOT/WARM leads to KameleonDB + warm-leads.json.`,
  ``,
  `CRITICAL: Read these files first:`,
  `  /Users/mantisclaw/.openclaw/workspace/outreach/inbound-leads.json`,
  `  /Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 1 — Search Subreddits:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Search these subreddits (one at a time, sort by "new"):`,
  `  - r/smallbusiness (primary)`,
  `  - r/Entrepreneur (secondary)`,
  `  - r/salonowners (tertiary — direct ICP)`,
  ``,
  `Search queries to run in each subreddit:`,
  ...SEARCH_QUERIES.map((q, i) => `  ${i + 1}. ${q}`),
  ``,
  `Filter results to show posts from the last 3 days only. Skip anything older than 72hrs.`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 2 — For Each Complaint Post Found:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `1. Read the post — is it an owner describing a real pain point?`,
  ``,
  `2. Extract:`,
  `   - Post URL (full old.reddit.com URL)`,
  `   - Post title`,
  `   - Post text (from article p element)`,
  `   - Author username`,
  `   - Post age (e.g., "2 hours ago", "1 day ago")`,
  ``,
  `3. Parse post age to hours:`,
  `   - "X minutes ago" → X/60 hours`,
  `   - "X hours ago" → X hours`,
  `   - "X days ago" → X*24 hours`,
  ``,
  `4. Determine tier:`,
  `   - HOT: <2hrs old + specific complaint + owner posting`,
  `   - WARM: <72hrs old + general vent + owner`,
  `   - COLD: >72hrs or vague → skip (log only, no outreach)`,
  ``,
  `5. Detect painType from title + text:`,
  `   const PAIN_TYPE_MAP = ${JSON.stringify(PAIN_TYPE_MAP, null, 2)};`,
  `   `,
  `   function detectPainType(title, text = '') {`,
  `     const combined = (title + ' ' + text).toLowerCase();`,
  `     for (const [painType, keywords] of Object.entries(PAIN_TYPE_MAP)) {`,
  `       if (keywords.some(kw => combined.includes(kw.toLowerCase()))) {`,
  `         return painType;`,
  `       }`,
  `     }`,
  `     return 'general';`,
  `   }`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 3 — Log HOT/WARM Leads (KameleonDB + warm-leads.json):`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `For each HOT or WARM lead (NOT COLD):`,
  ``,
  `1. Log to KameleonDB via log-lead.js:`,
  `   const { execSync } = require('child_process');`,
  `   `,
  `   const cmd = 'cd /Users/mantisclaw/.openclaw/workspace && ' +`,
  `     'node outreach/scripts/log-lead.js ' +`,
  `     '--platform reddit ' +`,
  `     '--account ' + postAuthor + ' ' +`,
  `     '--link https://old.reddit.com/user/' + postAuthor + ' ' +`,
  `     '--segment smallbusiness owner ' +`,
  `     '--fit 4 ' +`,
  `     '--reason "' + postTitle.replace(/"/g, "'") + '" ' +`,
  `     '--status ' + tier.toLowerCase() + ' ' +`,
  `     '--notes "Pain type: ' + painType + '. Found via complaint search."';`,
  `   `,
  `   execSync(cmd);`,
  ``,
  `2. ALSO write to warm-leads.json (DUAL LOGGING):`,
  `   const fs = require('fs');`,
  `   const warmLeadsPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json';`,
  `   let warmLeads = { leads: [] };`,
  `   try { warmLeads = JSON.parse(fs.readFileSync(warmLeadsPath, 'utf8')); } catch (e) {}`,
  `   `,
  `   const now = new Date().toISOString();`,
  `   const leadId = 'lead-' + (warmLeads.leads.length + 1).toString().padStart(3, '0');`,
  `   `,
  `   const newLead = {`,
  `     id: leadId,`,
  `     source: 'reddit',`,
  `     subreddit: 'r/' + subreddit,`,
  `     postTitle: postTitle,`,
  `     postUrl: postUrl,`,
  `     author: postAuthor,`,
  `     foundAt: now,`,
  `     postAge: postAgeHours + ' hours',`,
  `     tier: tier.toLowerCase(),`,
  `     painType: painType,`,
  `     painSignals: [/* extract key phrases from post */],`,
  `     status: tier === 'HOT' ? 'ready-to-comment' : 'found',`,
  `     commentedAt: null,`,
  `     commentUrl: null,`,
  `     dmReadyAt: null,`,
  `     dmSentAt: null,`,
  `     dmStatus: null,`,
  `     repliedAt: null,`,
  `     notes: 'Found via complaint search in r/' + subreddit + '. Query: ' + searchQuery`,
  `   };`,
  `   `,
  `   warmLeads.leads.push(newLead);`,
  `   fs.writeFileSync(warmLeadsPath, JSON.stringify(warmLeads, null, 2));`,
  `   console.log('✓ Lead logged: ' + leadId + ' (' + tier + ')');`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 4 — HOT Leads Only: Post Comment:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `For each HOT tier lead only (not WARM, not COLD):`,
  ``,
  `1. Navigate to the post URL (old.reddit.com)`,
  ``,
  `2. Draft a helpful comment (NOT a pitch):`,
  `   - 2-3 sentences max`,
  `   - Acknowledge their pain specifically`,
  `   - Share one tactic that's worked for others`,
  `   - NO links, NO promotion, NO "we help with"`,
  `   -`,
  `   Example structure:`,
  `   "saw your post about [specific pain they mentioned]. we work with salons on this exact thing — the chaos of [detail] is real. one thing that's worked for others: [specific tactic, no link]. happy to share more if useful"`,
  ``,
  `3. ⚡ HUMANIZE (MANDATORY):`,
  `   - Run: /humanizer [paste draft]`,
  `   - Wait for output`,
  `   - Use ONLY the humanized version`,
  ``,
  `4. POST using old.reddit.com method:`,
  `   - textarea[name="text"] → focus → execCommand insertText → click Save`,
  `   - Upvote: .arrow.up → click`,
  `   - Reload, confirm comment appears`,
  ``,
  `5. Update warm-leads.json with comment info:`,
  `   const fs = require('fs');`,
  `   const warmLeadsPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json';`,
  `   const warmLeads = JSON.parse(fs.readFileSync(warmLeadsPath, 'utf8'));`,
  `   const lead = warmLeads.leads.find(l => l.postUrl === 'THE_POST_URL');`,
  `   if (lead) {`,
  `     lead.status = 'commented';`,
  `     lead.commentedAt = new Date().toISOString();`,
  `     lead.commentUrl = 'THE_COMMENT_URL';`,
  `     // Set dmReadyAt to 2-24 hours from now (randomized)`,
  `     const delayHours = Math.floor(Math.random() * 22) + 2;`,
  `     lead.dmReadyAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();`,
  `   }`,
  `   fs.writeFileSync(warmLeadsPath, JSON.stringify(warmLeads, null, 2));`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 5 — Send Discord Summary:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `After all searches complete, send summary to Discord socmed-leads:`,
  ``,
  `const { spawnSync } = require('child_process');`,
  ``,
  `const summary = [`,
  `  '🔍 **Reddit Complaint Monitor — ${today}**',`,
  `  '',`,
  `  '**Search Results:**',`,
  `  '• Posts scanned: ' + results.postsFound.length,`,
  `  '• HOT leads: ' + results.hotLeads.length,`,
  `  '• WARM leads: ' + results.warmLeadsLogged.length,`,
  `  '• Comments posted: ' + results.commentsPosted.length,`,
  `  '',`,
  `  results.hotLeads.length > 0 ? '**HOT Leads (comment today):**\\n' + results.hotLeads.map(l => '• r/' + l.subreddit + ' — "' + l.title + '" by u/' + l.author + '\\n  Pain: ' + l.painType + '\\n  URL: ' + l.url).join('\\n') : '',`,
  `  '',`,
  `  results.warmLeadsLogged.length > 0 ? '**WARM Leads (log only):**\\n' + results.warmLeadsLogged.map(l => '• r/' + l.subreddit + ' — "' + l.title + '" by u/' + l.author).join('\\n') : ''`,
  `].filter(s => s).join('\\n');`,
  ``,
  `spawnSync('openclaw', [`,
  `  'message', 'send',`,
  `  '--channel', 'discord',`,
  `  '--target', '1485556454030315530',  // socmed-leads`,
  `  '--message', summary`,
  `], { encoding: 'utf8' });`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `RULES:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `- Always use old.reddit.com (new UI blocks JS)`,
  `- Skip posts >72hrs old`,
  `- Skip vague complaints (must be specific pain)`,
  `- HOT leads: comment SAME DAY`,
  `- WARM leads: log only, DM window opens 2-24hrs after comment`,
  `- COLD leads: skip entirely`,
  `- One DM per lead max (handled by reddit-dm-sender.js at 2pm)`,
  `- Track all leads in warm-leads.json to avoid duplicates`,
].join('\n');

console.log(`\n🔍 Reddit Complaint Monitor — ${today}\n`);
console.log(`Creating session cron...\n`);

const name = `reddit-complaint-${today.replace(/-/g, '')}`;
const at = new Date(Date.now() + 30000).toISOString(); // 30 seconds from now

const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', name,
  '--at', at,
  '--message', sessionMessage,
  '--delivery-channel', 'discord',
  '--delivery-target', '1485556454030315530',  // socmed-leads
  '--delete-after-run',
  '--tz', 'America/Los_Angeles'
], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

if (result.status === 0) {
  console.log(`✓ Session created: ${name}`);
  console.log(`\n✅ Reddit complaint monitor done.\n`);
} else {
  console.error(`✗ Failed: ${name}`);
  console.error(result.stderr);
  process.exit(1);
}
