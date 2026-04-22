#!/usr/bin/env node
/**
 * reddit-complaint-submitter.js
 * Hourly cron: searches Reddit for complaints, submits leads to dashboard API.
 * Pattern: openclaw cron add with --cron (hourly at :00 every hour).
 * Cron subagent writes leads to file, this script reads and submits.
 *
 * To set up: node reddit-complaint-submitter.cjs --setup
 * To submit: node reddit-complaint-submitter.cjs
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const DASHBOARD_API = 'https://mantisclaw-dashboard.royaldependent9022.workers.dev';

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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, lead, error: res.statusCode >= 300 ? `HTTP ${res.statusCode}` : null });
      });
    });

    req.on('error', (e) => resolve({ success: false, lead, error: e.message }));
    req.write(postData);
    req.end();
  });
}

// ── Read leads from output file ───────────────────────────────────────────────

const today = todayPST().replace(/-/g, '');
const OUTPUT_FILE = `/tmp/reddit-complaint-leads-${today}.json`;

// ── Session message for cron subagent ───────────────────────────────────────

const SEARCH_QUERIES = [
  'exhausted OR "burned out" OR "can\'t keep up" OR "working 80 hours"',
  '"phone won\'t stop" OR "inbox is" OR "DMs are" OR "too busy to respond"',
  '"no show" OR cancellation OR "didn\'t show up"',
  '"how do you handle" OR "recommend software" OR "recommend tool"',
  '"overwhelmed with" OR "can\'t eat" OR "no work-life balance"'
];

const sessionMessage = [
  `REDDIT COMPLAINT SEARCH — ${today} — post as u/Alive_Kick7098.`,
  ``,
  `BROWSER: Use profile="openclaw" for ALL browser tool calls. Logged into Reddit as u/Alive_Kick7098.`,
  ``,
  `GOAL: Search for complaint posts from the last 72 hours.`,
  `For each HOT/WARM lead found, generate reply_draft + dm_draft and write to OUTPUT_FILE.`,
  `HOT leads: also post the comment.`,
  ``,
  `OUTPUT FILE: ${OUTPUT_FILE}`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 0 — Fetch latest settings from dashboard API:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Make a GET request to:`,
  `  https://mantisclaw-dashboard.royaldependent9022.workers.dev/api/settings`,
  ``,
  `Extract from the response:`,
  `  - platforms.reddit.subreddits (array of subreddit names)`,
  `  - platforms.reddit.search_terms (array of search query strings)`,
  `  - pain_points (array of pain descriptions — for matching)`,
  `  - focus_topic (string — for matching)`,
  ``,
  `If the API fails, fall back to these defaults:`,
  `  Subreddits: smallbusiness, Entrepreneur, salonowners, indiehackers`,
  `  Search terms: landing page, waiting for dev, website change, pre-launch, launch stuck, dated website`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 1 — Search Subreddits (sort by "new"):`,
  `═══════════════════════════════════════════════════════════`,
  `  Use the subreddits from STEP 0 (in order of priority).`,
  `  Use the search_terms from STEP 0 — run each as a separate search.`,
  ``,
  `Skip posts >72hrs old.`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 2 — For Each Post:`,
  `═══════════════════════════════════════════════════════════`,
  `1. Real owner with specific pain? Skip bots/promo/vague.`,
  `2. Extract: post_url (old.reddit.com), title, text, author, age`,
  `3. Age → hours: "minutes"÷60, "hours"=X, "days"=X*24`,
  `4. Tier: HOT=<2hrs, WARM=<72hrs, COLD=>72hrs → skip`,
  `5. Detect pain_type from title+text`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 3 — Write leads to ${OUTPUT_FILE}:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Save as /tmp/write-lead.js and run with node for each lead:`,
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
  `═══════════════════════════════════════════════════════════`,
  `STEP 4 — HOT leads only: Post Comment:`,
  `═══════════════════════════════════════════════════════════`,
  `1. Navigate to post URL (old.reddit.com)`,
  `2. HUMANIZE the reply_draft first`,
  `3. Post via textarea[name="text"] → focus → execCommand insertText → Save`,
  `4. Upvote: .arrow.up → click`,
  `5. Reload to confirm`,
  `6. Update OUTPUT_FILE entry: commentedAt: new Date().toISOString()`,
  ``,
  `Reply with DONE — N HOT leads, M WARM leads, K comments posted`,
].join('\n');

// ── Mode 1: Create daily cron ─────────────────────────────────────────────────

if (process.argv.includes('--setup')) {
  // Hourly cron: top of every hour (0 * * * *)
  const cronName = 'reddit-complaint-hourly';
  const cronExpr = '0 * * * *';

  console.log(`\n📅 Reddit Complaint Submitter — Setting up hourly cron\n`);
  console.log(`Schedule: ${cronExpr} America/Los_Angeles (top of every hour)\n`);

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', cronName,
    '--cron', cronExpr,
    '--message', sessionMessage,
    '--tz', 'America/Los_Angeles'
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Hourly cron created: ${cronName}`);
    console.log(`  Fires at :00 every hour (PST)`);
  } else {
    console.error(`✗ Failed: ${result.stderr}`);
    process.exit(1);
  }
  process.exit(0);
}

// ── Mode 2: Read leads from file and submit to dashboard ──────────────────────
// Cron fires hourly (:00), subagent writes leads to OUTPUT_FILE.
// This script polls for the file, submits leads to dashboard API, sends Discord summary.
//
// Polling: up to 30 min (360 attempts × 5s = 30min)
// Uses https.request (not http) for Cloudflare Workers SSL

if (!fs.existsSync(OUTPUT_FILE)) {
  console.log(`No leads file found at ${OUTPUT_FILE}`);
  console.log(`Run after the cron fires (leads written at ${OUTPUT_FILE})`);
  process.exit(0);
}

let outputData;
try {
  outputData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
} catch (e) {
  console.error(`Failed to read leads file: ${e.message}`);
  process.exit(1);
}

const { leads } = outputData;
if (!leads || leads.length === 0) {
  console.log(`No leads in file. Exiting.`);
  process.exit(0);
}

// Wrap in async IIFE to support top-level await
(async () => {
  // ── Submit leads to dashboard API ─────────────────────────────────────────────

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

  // ── Discord summary ───────────────────────────────────────────────────────────

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
  process.exit(0);
})();