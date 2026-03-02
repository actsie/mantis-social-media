#!/usr/bin/env node
/**
 * x-original-posts-planner.js
 * Generates one original tweet session per day for @stacydonna0x.
 * Picks mode from rotating cycle, schedules a random time between 9am–9pm PST.
 * Run at 6:04am PST daily (staggered after engagement planner).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE    = '/Users/mantisclaw/.openclaw/workspace';
const STATE_FILE   = path.join(WORKSPACE, 'outreach/x/original-posts-state.json');
const LOG_FILE     = path.join(WORKSPACE, 'outreach/x/original-posts-log.json');
const GUIDE_FILE   = path.join(WORKSPACE, 'outreach/x/original-posts-guide.md');

const MIN_HOUR = 9;   // 9:00 AM PST
const MAX_HOUR = 21;  // 9:00 PM PST

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function getLAOffset() {
  const tzDate  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const utcDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
  const diffH   = Math.round((tzDate - utcDate) / 3600000);
  const sign    = diffH >= 0 ? '+' : '-';
  return `${sign}${Math.abs(diffH).toString().padStart(2, '0')}:00`;
}

function targetDate() {
  return process.env.DATE_OVERRIDE || todayPST();
}

// ── Load state ────────────────────────────────────────────────────────────────
let state = { cycle: [1, 2, 3, 2, 4, 2, 2, 1], cycleIndex: 0, lastPostDate: null };
if (fs.existsSync(STATE_FILE)) {
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) {}
}

// ── Load log ──────────────────────────────────────────────────────────────────
let log = { posts: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}

// ── Determine today's mode ────────────────────────────────────────────────────
const today = targetDate();
const cycle = state.cycle;
const mode  = cycle[state.cycleIndex % cycle.length];

// Mode names for readability
const MODE_NAMES = {
  1: 'Fan / Nail Girl',
  2: 'Building Something / Noticing Things',
  3: 'Hot Take / Opinion',
  4: 'Relatable Beauty Person'
};

// ── Determine recently used drafts (last 14 days) ─────────────────────────────
const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
const recentDrafts = new Set(
  (log.posts || [])
    .filter(p => new Date(p.timestamp).getTime() > fourteenDaysAgo)
    .map(p => p.draftIndex)
);

// ── Pick random time ──────────────────────────────────────────────────────────
const lo   = MIN_HOUR * 60;
const hi   = MAX_HOUR * 60;
const time = minsToHHMM(rand(lo, hi));

// ── Build session message ──────────────────────────────────────────────────────
const msg = [
  `X ORIGINAL POST SESSION for ${today} — post as @stacydonna0x.`,
  ``,
  `TODAY'S MODE: ${mode} — ${MODE_NAMES[mode]}`,
  `Cycle position: ${state.cycleIndex % cycle.length + 1}/${cycle.length}`,
  ``,
  `Steps:`,
  ``,
  `1. Read the full draft bank:`,
  `   ${GUIDE_FILE}`,
  ``,
  `2. Find all drafts listed under "## Mode ${mode}: ${MODE_NAMES[mode]}"`,
  ``,
  `3. Check the original-posts-log.json for recently used drafts (last 14 days):`,
  `   ${LOG_FILE}`,
  `   Recently used draft indices to AVOID if possible: [check log]`,
  ``,
  `4. Pick a draft that hasn't been used in the last 14 days.`,
  `   If all drafts for mode ${mode} were used recently, pick the oldest one and vary the wording slightly.`,
  `   Small natural variations are encouraged — don't post the exact same text twice.`,
  ``,
  `5. Before posting, scan the draft for tone rule violations:`,
  `   - NO hyphens (-) or em dashes (—) — use a period instead`,
  `   - NO quotation marks around words — rephrase`,
  `   - NO banned words: weird, resonate, nightmare, amazing, stunning, quiet, especially,`,
  `     vibe/vibes, genuinely, actually, plot twist, lands, sticks, clicks, reads as`,
  `   - Short: 1-3 sentences max`,
  `   - No hashtags unless completely natural`,
  `   - Rewrite if any rule is violated`,
  ``,
  `6. Post the tweet:`,
  `   a. Navigate to https://x.com (profile should be @stacydonna0x — confirm in top-right avatar)`,
  `   b. Take a snapshot to find the compose area`,
  `   c. Click the tweet compose box (usually "What is happening?!" placeholder)`,
  `   d. Type the tweet text`,
  `   e. Click the "Post" button (NOT Ctrl+Enter)`,
  `   f. Take a snapshot to confirm it posted`,
  ``,
  `7. Advance the cycle index. Update ${STATE_FILE}:`,
  `   const fs = require('fs');`,
  `   const stateFile = '${STATE_FILE}';`,
  `   const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));`,
  `   s.cycleIndex = (s.cycleIndex + 1) % s.cycle.length;`,
  `   s.lastPostDate = '${today}';`,
  `   fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));`,
  ``,
  `8. Log the post to ${LOG_FILE}:`,
  `   const logFile = '${LOG_FILE}';`,
  `   const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));`,
  `   log.posts.push({`,
  `     timestamp: new Date().toISOString(),`,
  `     date: '${today}',`,
  `     mode: ${mode},`,
  `     modeName: '${MODE_NAMES[mode]}',`,
  `     draftIndex: WHICH_DRAFT_NUMBER_YOU_USED,`,
  `     tweetText: 'EXACT TEXT YOU POSTED',`,
  `     tweetUrl: 'URL IF YOU CAN GET IT',`,
  `     platform: 'x',`,
  `     account: 'stacydonna0x'`,
  `   });`,
  `   fs.writeFileSync(logFile, JSON.stringify(log, null, 2));`,
  ``,
  `9. Send a brief Telegram notification (channel="telegram", target="6241290513"):`,
  `   "✍️ X post published (mode ${mode}: ${MODE_NAMES[mode]}): [first few words of tweet]..."`,
  `   ALWAYS include target="6241290513" — do NOT omit it.`,
  ``,
  `If X is down or login is broken: skip session, do NOT advance the cycle index, log as skipped.`,
].join('\n');

const name = `x-post-${today.replace(/-/g, '')}`;
const at   = `${today}T${time}:00${getLAOffset()}`;

console.log(`\n📝 X original post for ${today}`);
console.log(`   Mode: ${mode} — ${MODE_NAMES[mode]}`);
console.log(`   Cycle position: ${state.cycleIndex % cycle.length + 1}/${cycle.length}`);
console.log(`   Time: ${time}`);
console.log(`   Recent drafts to avoid: ${[...recentDrafts].join(', ') || 'none'}`);

const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', name,
  '--at',   at,
  '--message', msg,
  '--delete-after-run',
  '--tz', 'America/Los_Angeles'
], { encoding: 'utf8' });

if (result.status === 0) {
  console.log(`✓ Cron: ${name} at ${time} (mode ${mode})`);
} else {
  console.error(`✗ Failed: ${name}\n${result.stderr}`);
  process.exit(1);
}

console.log('\n✅ X original posts planner done.\n');
