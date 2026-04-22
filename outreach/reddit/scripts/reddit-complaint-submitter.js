#!/usr/bin/env node
/**
 * reddit-complaint-submitter.js
 * Submits leads to https://mantisclaw-dashboard.royaldependent9022.workers.dev/api/leads
 * Keeps the same Reddit search logic as reddit-complaint-monitor-midday.js.
 *
 * Run instead of the monitor if you want leads sent to the dashboard.
 * Usage: node reddit-complaint-submitter.js
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const DASHBOARD_API = 'https://mantisclaw-dashboard.royaldependent9022.workers.dev';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── POST lead to dashboard API ────────────────────────────────────────────────

function postLead(lead) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      handle: lead.handle,
      platform: 'reddit',
      post_url: lead.post_url,
      post_text: lead.post_text || '',
      post_date: lead.post_date || '',
      match_reason: lead.match_reason || '',
      reply_draft: lead.reply_draft || '',
      dm_draft: lead.dm_draft || ''
    });

    const url = new URL(`${DASHBOARD_API}/api/leads`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, lead });
        } else {
          resolve({ success: false, lead, error: `HTTP ${res.statusCode}`, raw: data });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, lead, error: e.message });
    });

    req.write(postData);
    req.end();
  });
}

// ── Output file ───────────────────────────────────────────────────────────────

const today = todayPST().replace(/-/g, '');
const OUTPUT_FILE = `/tmp/reddit-complaint-leads-${today}.json`;

// ── Session message for subagent ─────────────────────────────────────────────

const sessionMessage = [
  `REDDIT COMPLAINT MONITOR — ${today} — post as u/Alive_Kick7098.`,
  ``,
  `BROWSER: Use profile="openclaw" for ALL browser tool calls. Logged into Reddit as u/Alive_Kick7098.`,
  ``,
  `GOAL: Search for complaint posts from the last 72 hours.`,
  `For each HOT/WARM lead found, generate reply_draft + dm_draft and write to OUTPUT_FILE.`,
  `HOT leads: also post the comment and update the file.`,
  ``,
  `OUTPUT FILE: ${OUTPUT_FILE}`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 1 — Search Subreddits:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Search each subreddit, sort by "new":`,
  `  - r/smallbusiness (primary)`,
  `  - r/Entrepreneur (secondary)`,
  `  - r/salonowners (tertiary)`,
  ``,
  `Search queries (one at a time in each subreddit):`,
  ...SEARCH_QUERIES.map((q, i) => `  ${i + 1}. ${q}`),
  ``,
  `Skip posts >72hrs old.`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 2 — For Each Post:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `1. Real owner with specific pain? Skip bots/promo/vague.`,
  `2. Extract: post_url (old.reddit.com), title, text, author, age`,
  `3. Age → hours: "minutes"÷60, "hours"=X, "days"=X*24`,
  `4. Tier: HOT=<2hrs, WARM=<72hrs, COLD=>72hrs → skip`,
  `5. Detect pain_type from title+text using PAIN_TYPE_MAP`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 3 — Write leads to ${OUTPUT_FILE}:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Use this Node.js script to write leads (save as /tmp/write-lead.js and run with node):`,
  ``,
  `const fs = require('fs');`,
  `const output = '${OUTPUT_FILE}';`,
  `let data = { leads: [] };`,
  `if (fs.existsSync(output)) {`,
  `  try { data = JSON.parse(fs.readFileSync(output, 'utf8')); } catch(e) {}`,
  `}`,
  `const lead = {`,
  `  handle: "@" + author,`,
  `  platform: "reddit",`,
  `  post_url: "https://old.reddit.com" + permalink,`,
  `  post_text: "...",`,
  `  post_date: "Mar 25, 2026",`,
  `  match_reason: "why good lead in one sentence",`,
  `  reply_draft: "helpful 2-3 sentence comment, not a pitch",`,
  `  dm_draft: "casual 2-3 sentence DM, specific to post, ends with question",`,
  `  pain_type: painType,`,
  `  tier: tier,`,
  `  subreddit: "r/" + subreddit,`,
  `  post_title: "title",`,
  `  foundAt: new Date().toISOString(),`,
  `};`,
  `if (!data.leads.some(l => l.post_url === lead.post_url)) {`,
  `  data.leads.push(lead);`,
  `  fs.writeFileSync(output, JSON.stringify(data, null, 2));`,
  `  console.log("WRITTEN: " + author);`,
  `} else {`,
  `  console.log("SKIP: " + author + " (duplicate)");`,
  `}`,
  ``,
  `Run this for each HOT/WARM lead found.`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 4 — HOT leads only: Post Comment:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `For HOT leads only:`,
  `1. Navigate to post URL (old.reddit.com)`,
  `2. HUMANIZE the reply_draft: say "/humanizer [draft text]" to the humanizer skill`,
  `3. Post using textarea[name="text"] → focus → execCommand insertText → Save`,
  `4. Upvote: .arrow.up → click`,
  `5. Reload to confirm`,
  `6. Update OUTPUT_FILE entry: commentedAt: new Date().toISOString()`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 5 — Done:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Reply with:`,
  `  DONE — N HOT leads, M WARM leads, K comments posted`,
  `  Leads written to: ${OUTPUT_FILE}`,
].join('\n');

// ── Spawn subagent ────────────────────────────────────────────────────────────

console.log(`\n🔍 Reddit Complaint Submitter — ${today}\n`);
console.log(`Spawning subagent to search Reddit...\n`);
console.log(`Leads will be submitted to: ${DASHBOARD_API}/api/leads\n`);

const spawn = spawnSync('openclaw', [
  'sessions', 'spawn',
  '--runtime', 'subagent',
  '--mode', 'run',
  '--label', 'reddit-complaint-search',
  '--task', sessionMessage
], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 60000 });

if (spawn.status !== 0) {
  console.error(`✗ Failed to spawn subagent: ${spawn.status}`);
  console.error(spawn.stderr);
  process.exit(1);
}

console.log(`✓ Subagent spawned. Waiting for search to complete...`);

// ── Poll for output file ──────────────────────────────────────────────────────

async function waitForOutput(maxAttempts = 120, intervalMs = 5000) {
  for (let i = 0; i < maxAttempts; i++) {
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        if (data.leads && data.leads.length > 0) {
          console.log(`Found ${data.leads.length} leads after ${(i + 1) * intervalMs / 1000}s`);
          return data;
        }
      } catch (e) {
        // Not ready yet
      }
    }
    if (i % 10 === 0) console.log(`  Waiting for leads... (${i + 1}/${maxAttempts})`);
    await sleep(intervalMs);
  }
  return null;
}

// Wait up to 10 minutes for subagent to finish
await sleep(10000); // Give subagent head start
const outputData = await waitForOutput(120, 5000);

if (!outputData || !outputData.leads || outputData.leads.length === 0) {
  console.log(`\nNo leads found. Exiting.`);
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      console.log(`Output file has ${data.leads ? data.leads.length : 0} leads`);
    } catch (e) {}
  }
  process.exit(0);
}

// ── Submit leads to dashboard API ─────────────────────────────────────────────


(async () => {
  const { leads } = outputData;
  console.log(`\n📤 Submitting ${leads.length} leads to dashboard API...\n`);

  let submitted = 0;
  let failed = 0;

  for (const lead of leads) {
    if (lead.commentedAt) {
      console.log(`  ⏭ Skipping (already commented): ${lead.handle}`);
      continue;
    }

    const result = await postLead(lead);
    if (result.success) {
      submitted++;
      console.log(`  ✓ Submitted: ${lead.handle}`);
    } else {
      failed++;
      console.log(`  ✗ Failed: ${lead.handle} — ${result.error}`);
    }

    await sleep(200);
  }

  const hotCount = leads.filter(l => l.tier === 'HOT').length;
  const warmCount = leads.filter(l => l.tier === 'WARM').length;
  const summaryMsg = [
    `🔍 **Reddit Complaint Submitter — ${today}**`,
    ``,
    `**Results:**`,
    `• Leads found: ${leads.length} (${hotCount} HOT / ${warmCount} WARM)`,
    `• Submitted to dashboard: ${submitted}`,
    `• Failed: ${failed}`,
    ``,
    submitted > 0
      ? `✅ ${submitted} leads queued at dashboard`
      : failed > 0
      ? `⚠️ ${failed} leads failed`
      : `ℹ️ No new leads to submit`
  ].filter(s => s).join('\n');

  try {
    execSync('openclaw', [
      'message', 'send',
      '--channel', 'discord',
      '--target', '1485556454030315530',
      '--message', summaryMsg
    ], { encoding: 'utf8' });
    console.log(`\n📬 Discord summary sent`);
  } catch (e) {
    console.error(`Discord send failed: ${e.message}`);
  }

  console.log(`\n✅ Done. ${submitted} submitted, ${failed} failed.\n`);
})();

