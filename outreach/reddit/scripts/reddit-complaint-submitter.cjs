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

// ── Output file ───────────────────────────────────────────────────────────────

const today = todayPST().replace(/-/g, '');
const OUTPUT_FILE = `/tmp/reddit-complaint-leads-${today}.json`;

// ── Session message for cron subagent ───────────────────────────────────────
// IMPORTANT: This session message is baked into the cron at creation time.
// It MUST fetch settings at runtime (STEP 0) so changes to dashboard settings
// take effect on the next run without recreating the cron.

const sessionMessage = [
  `REDDIT COMPLAINT SEARCH — ${today} — post as u/Alive_Kick7098.`,
  ``,
  `BROWSER: Use profile="openclaw" for ALL browser tool calls. Logged into Reddit as u/Alive_Kick7098.`,
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
  `If the API fails, fall back to:`,
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
  `5. Detect pain_type from title+text using pain_points`,
  `6. Fetch outreach_angle from settings — this is the SERVICE angle, not the message`,
  `7. Generate TWO DIFFERENT drafts for every lead (HOT and WARM):`,
  ``,
  `reply_draft — PUBLIC comment on their Reddit post:`,
  `  - Genuine, helpful, adds value to their post`,
  `  - 2-3 sentences, no pitch, no selling`,
  `  - Could share a relevant tip, validate their struggle, or ask a genuine question`,
  `  - Example: "This is such a common wall a lot of founders hit. One thing that helped me..."`,
  ``,
  `dm_draft — PRIVATE message to the person:`,
  `  - Casual opener referencing something specific from their post`,
  `  - Based on the outreach_angle from settings`,
  `  - Ends with a question (engagement hook)`,
  `  - 2-3 sentences max`,
  `  - Example: "Hey! Saw your post about [specific thing] — [relate to outreach_angle]. Have you tried [specific]? Would love to hear how it goes."`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 3 — Write leads to ${OUTPUT_FILE}:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Save this as /tmp/write-lead.js and run with node for each lead:`,
  ``,
  `const fs=require("fs");const o="${OUTPUT_FILE}";let d={leads:[]};`,
  `try{const e=JSON.parse(fs.readFileSync(o,"utf8"));d={leads:Array.isArray(e)?e:(e.leads||[])};}catch(x){}`,
  `const l={handle:"@"+author,platform:"reddit",`,
  `post_url:permalink.startsWith("http")?permalink:"https://old.reddit.com"+permalink,`,
  `post_text:text||"",post_date:new Date().toLocaleString("en-US",{timeZone:"America/Los_Angeles"}),`,
  `match_reason:query_match||"",reply_draft:reply_draft||"",dm_draft:dm_draft||"",`,
  `tier,foundAt:new Date().toISOString(),commentedAt:null};`,
  `if(!d.leads.some(x=>x.post_url===l.post_url)){d.leads.push(l);fs.writeFileSync(o,JSON.stringify(d,null,2));`,
  `console.log("WRITTEN:"+author+"|"+tier);}else{console.log("SKIP:"+author);}`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 4 — HOT leads only: Post Comment + Update File:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `For HOT leads only:`,
  `1. Navigate to post URL (old.reddit.com)`,
  `2. HUMANIZE the reply_draft first`,
  `3. Post via textarea[name="text"] → focus → execCommand insertText → Save`,
  `4. Upvote: .arrow.up → click`,
  `5. Reload to confirm`,
  `6. Update OUTPUT_FILE — set commentedAt for this author:`,
  ``,
  `node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('${OUTPUT_FILE}','utf8'));`,
  `const a=d.leads.find(x=>x.handle==='@'+author);if(a){a.commentedAt=new Date().toISOString();`,
  `fs.writeFileSync('${OUTPUT_FILE}',JSON.stringify(d,null,2));console.log('UPDATED:'+author);}"`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 5 — Done:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Reply with:`,
  `  DONE — N HOT leads, M WARM leads, K comments posted`,
  `  Leads written to: ${OUTPUT_FILE}`,
].join('\n');

// ── Mode 1: Create hourly cron ───────────────────────────────────────────────

if (process.argv.includes('--setup')) {
  const cronName = 'reddit-complaint-hourly';
  const cronExpr = '0 * * * *';

  console.log(`\n📅 Reddit Complaint Submitter — Setting up hourly cron\n`);
  console.log(`Schedule: ${cronExpr} America/Los_Angeles (top of every hour)\n`);

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', cronName,
    '--cron', cronExpr,
    '--message', sessionMessage,
    '--tz', 'America/Los_Angeles',
    '--channel', 'discord',
    '--to', '1485556397293703279'
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

if (!fs.existsSync(OUTPUT_FILE)) {
  console.log(`No leads file found at ${OUTPUT_FILE}`);
  console.log(`Run after the cron fires.`);
  process.exit(0);
}

let outputData;
try {
  const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  outputData = { leads: Array.isArray(parsed) ? parsed : (parsed.leads || []) };
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
  console.log(`\n📤 Submitting ${leads.length} leads to dashboard API...\n`);

  let submitted = 0;
  let failed = 0;

  for (const lead of leads) {
    if (lead.commentedAt) {
      console.log(`  ⏭ Skipping (already commented): ${lead.handle || lead.author}`);
      continue;
    }
    // Normalize fields from subagent's direct-write format
    const normalized = {
      handle: lead.handle || ('@' + lead.author),
      platform: 'reddit',
      post_url: lead.post_url || (lead.permalink && (lead.permalink.startsWith('http') ? lead.permalink : 'https://old.reddit.com' + lead.permalink)),
      post_text: lead.post_text || lead.text || '',
      post_date: lead.post_date || '',
      match_reason: lead.match_reason || lead.query_match || '',
      reply_draft: lead.reply_draft || '',
      dm_draft: lead.dm_draft || ''
    };
    if (!normalized.handle || !normalized.post_url) {
      console.log(`  ⏭ Skipping malformed lead: ${JSON.stringify(lead).slice(0, 80)}`);
      continue;
    }
    const result = await postLead(normalized);
    if (result.success) {
      submitted++;
      console.log(`  ✓ Submitted: ${normalized.handle}`);
    } else {
      failed++;
      console.log(`  ✗ Failed: ${normalized.handle} — ${result.error}`);
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
      '--target', '1485556397293703279',
      '--message', summaryMsg
    ], { encoding: 'utf8' });
    console.log(`\n📬 Discord summary sent`);
  } catch (e) {
    console.error(`Discord send failed: ${e.message}`);
  }

  console.log(`\n✅ Done. ${submitted} submitted, ${failed} failed.\n`);
  process.exit(0);
})();