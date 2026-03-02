#!/usr/bin/env node
/**
 * daily-planner.js
 * Generates today's Instagram engagement schedule and creates OpenClaw cron jobs.
 * Run at 5:55am PST daily via master cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE   = path.join(WORKSPACE, 'outreach/instagram/engagement-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/instagram/today-schedule.json');

const COMMENT_COUNT  = 8;
const MIN_HOUR       = 6;    // 6:00 AM
const MAX_HOUR       = 23;   // 11:00 PM
const MIN_GAP        = 30;   // min minutes between any two sessions
const CLUSTER_MAX    = 90;   // "close pair" threshold (minutes)
const LONG_GAP_MIN   = 180;  // "long break" threshold (minutes)

const NAIL_TAGS   = ['nailslove', 'nailart', 'nailsofig', 'nailinspiration', 'naildesigner', 'nailsalon'];
const HAIR_TAGS   = ['haircuts', 'haircut', 'balayageombre', 'balayagehair'];
const MAKEUP_TAGS = ['makeupgoals'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function generateTimes() {
  const lo = MIN_HOUR * 60;
  const hi = MAX_HOUR * 60;
  for (let attempt = 0; attempt < 10000; attempt++) {
    const times = Array.from({ length: COMMENT_COUNT }, () => rand(lo, hi)).sort((a, b) => a - b);
    const gaps  = times.slice(1).map((t, i) => t - times[i]);
    if (gaps.some(g => g < MIN_GAP))       continue; // too close
    if (!gaps.some(g => g <= CLUSTER_MAX)) continue; // needs a cluster
    if (!gaps.some(g => g >= LONG_GAP_MIN)) continue; // needs a long break
    return times;
  }
  throw new Error('Could not generate valid schedule');
}

function pickHashtag(index) {
  const r = Math.random();
  if (r < 0.05) return MAKEUP_TAGS[0];                          // 5% makeup
  if (r < 0.20) return HAIR_TAGS[rand(0, HAIR_TAGS.length-1)]; // 15% hair
  return NAIL_TAGS[index % NAIL_TAGS.length];                   // 80% nail
}

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

// Get the UTC offset string for America/Los_Angeles (handles PST/PDT automatically)
function getLAOffset() {
  const tzDate  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const utcDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
  const diffH   = Math.round((tzDate - utcDate) / 3600000);
  const sign    = diffH >= 0 ? '+' : '-';
  return `${sign}${Math.abs(diffH).toString().padStart(2, '0')}:00`;
}

// Allow DATE_OVERRIDE=YYYY-MM-DD env var (e.g. for evening pre-scheduling)
function targetDate() {
  return process.env.DATE_OVERRIDE || todayPST();
}

// ── Load log ──────────────────────────────────────────────────────────────────
let log = { sessions: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}

// Accounts commented on in last 7 days (to avoid repeats)
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentAccounts = new Set(
  (log.sessions || [])
    .filter(s => s.type === 'comment' && new Date(s.timestamp).getTime() > sevenDaysAgo)
    .map(s => s.account)
);

// ── Generate schedule ─────────────────────────────────────────────────────────
const today    = targetDate();
const times    = generateTimes();
const gaps     = times.slice(1).map((t, i) => t - times[i]);
const sessions = times.map((t, i) => ({
  n:       i + 1,
  time:    minsToHHMM(t),
  tag:     pickHashtag(i),
  done:    false
}));

console.log(`\n📅 Instagram schedule for ${today}`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  #${s.tag}`));
console.log(`  Gaps (min): ${gaps.join(', ')}`);
console.log(`  Cluster ≤90min: ${gaps.some(g => g <= 90)}`);
console.log(`  Long gap ≥3hrs: ${gaps.some(g => g >= 180)}`);
console.log(`  Recent accounts (skip): ${[...recentAccounts].join(', ') || 'none'}`);

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessions }, null, 2));
console.log(`\n✓ Written: today-schedule.json`);

// ── Create session crons ──────────────────────────────────────────────────────
sessions.forEach(s => {
  const isHair   = HAIR_TAGS.includes(s.tag);
  const isMakeup = MAKEUP_TAGS.includes(s.tag);

  const engagementRule = isHair
    ? `HAIR hashtag (#${s.tag}): LIKE ONLY by default. Only comment if caption describes the cut/technique in detail — if so, Style 1 or 2 only (hype + brief compliment, NO question).`
    : isMakeup
    ? `MAKEUP hashtag (#${s.tag}): LIKE ONLY by default. Only comment if caption has something specific to react to.`
    : `NAIL hashtag (#${s.tag}): full engagement — comment + like post + 2 older posts.`;

  const skipList = [...recentAccounts].join(', ') || 'none';

  const msg = [
    `INSTAGRAM SESSION ${s.n}/8 for ${today} — run as stacyd0nna.`,
    ``,
    `Hashtag: #${s.tag}`,
    engagementRule,
    ``,
    `SKIP these accounts (commented in last 7 days): ${skipList}`,
    ``,
    `HARD RULES — apply to every comment, no exceptions:`,
    `- NO em dashes (—) or hyphens (-) — use a period instead`,
    `- NO quotation marks around words — rephrase`,
    `- NO banned words: weird, resonate, nightmare, amazing, stunning, quiet, especially, vibe/vibes, genuinely, actually, plot twist, lands, sticks, clicks, reads as, clean`,
    `- NO starting with "the"`,
    `- Max 3 sentences`,
    `- Scan your draft for all of the above before posting. If any are present, rewrite.`,
    ``,
    `Steps:`,
    `1. Read /Users/mantisclaw/.openclaw/workspace/outreach/instagram/tone-guide.md + scheduling-rules.md`,
    `2. Before navigating: close any existing Instagram tabs in the browser (use browser tabs tool to list tabs, then close any whose URL contains instagram.com). Then open https://www.instagram.com/explore/tags/${s.tag}/ in a new tab.`,
    `3. Find a post from TODAY (same day — look for "Xh ago" or today's date). Skip accounts in the skip list.`,
    `4. Draft a fresh, original comment for that SPECIFIC post (image + caption + vibe). Use the tone guide style list as energy reference only — max 1-3 list phrases per day total across all sessions.`,
    `5. Post via browser automation: snapshot → click comment box (ref) → JS execCommand inject → click Post button (ref)`,
    `6. Like the post + 2 older posts from the same account (snapshot → find Like button ref → click)`,
    `7. Append to the engagement log using this EXACT method (no other way):`,
    `   const fs = require('fs');`,
    `   const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/instagram/engagement-log.json';`,
    `   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `   log.sessions.push({ timestamp, account, postUrl, commentUrl, comment, likes, type, hashtag, note });`,
    `   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
    `   Run this as a single exec block. Do NOT write to any other key — only log.sessions.push().`,
    `8. Mark this session done in today-schedule.json using this EXACT method:`,
    `   const schedPath = '/Users/mantisclaw/.openclaw/workspace/outreach/instagram/today-schedule.json';`,
    `   const sched = JSON.parse(fs.readFileSync(schedPath, 'utf8'));`,
    `   sched.sessions[${s.n - 1}].done = true;`,
    `   fs.writeFileSync(schedPath, JSON.stringify(sched, null, 2));`,
    `9. Send a brief Telegram message using the message tool (channel="telegram", target="6241290513"): account name, what was posted or "liked only". ALWAYS include target="6241290513" — do NOT omit it.`,
  ].join('\n');

  const name = `ig-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at   = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', name,
    '--at',   at,
    '--message', msg,
    '--delete-after-run',
    '--tz', 'America/Los_Angeles'
  ], { encoding: 'utf8' });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time}`);
  } else {
    console.error(`✗ Failed: ${name}\n${result.stderr}`);
  }
});

console.log('\n✅ Daily planner done.\n');
