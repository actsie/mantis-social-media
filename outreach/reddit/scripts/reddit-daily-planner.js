#!/usr/bin/env node
/**
 * reddit-daily-planner.js
 * Generates today's Reddit engagement schedule and creates OpenClaw cron jobs.
 * Run at 6:01am PST daily via master cron (staggered after IG + X).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE  = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE   = path.join(WORKSPACE, 'outreach/reddit/engagement-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/reddit/today-schedule.json');

const MIN_HOUR     = 7;    // 7:00 AM PST
const MAX_HOUR     = 23;   // 11:00 PM PST
const MIN_GAP      = 45;   // min minutes between sessions (Reddit is stricter)
const CLUSTER_MAX  = 90;   // "close pair" threshold
const LONG_GAP_MIN = 180;  // "long break" threshold

// ── Target subreddits ─────────────────────────────────────────────────────────
// phase 1 = warmup (karma building) | phase 2 = business subs (50+ karma) | phase 3 = later
// Karma thresholds: phase2 unlocks at 50+, phase3 at 100+
// Update CURRENT_KARMA below as account grows
const CURRENT_KARMA = 60; // updated 2026-03-05 — Phase 2 unlocked

const SUBREDDITS = [
  // Phase 1 — warmup consumer subs
  { sub: 'Nails',               type: 'nail',       phase: 1, weight: 5 },
  { sub: 'beauty',              type: 'beauty',     phase: 1, weight: 3 },
  { sub: 'femalehairadvice',    type: 'hair',       phase: 1, weight: 2 },
  { sub: 'SkincareAddicts',     type: 'skincare',   phase: 1, weight: 2 },
  { sub: '30PlusSkinCare',      type: 'skincare',   phase: 1, weight: 1 },
  { sub: 'curlyhair',           type: 'hair',       phase: 1, weight: 1 },
  { sub: 'longhair',            type: 'hair',       phase: 1, weight: 1 },
  // Phase 2 — business/professional subs (OUR TARGET CUSTOMERS)
  // Unlock at 50+ karma. These are nail techs / stylists / salon owners.
  // Comment only on booking, client flow, website, getting new clients topics.
  { sub: 'Nailtechs',           type: 'pro-nail',   phase: 2, weight: 5 },
  { sub: 'hairstylist',         type: 'pro-hair',   phase: 2, weight: 4 },
  { sub: 'EstheticianLife',     type: 'pro-beauty', phase: 2, weight: 3 },
  { sub: 'smallbusiness',       type: 'biz',        phase: 99, weight: 2 }, // paused — manual approval required before posting
  // Phase 3 — expand later
  { sub: 'SkincareAddiction',   type: 'skincare',   phase: 3, weight: 2 },
  { sub: 'RedditLaqueristas',   type: 'nail',       phase: 3, weight: 2 },
  { sub: 'MassageTherapists',   type: 'pro-beauty', phase: 3, weight: 1 },
];

// Determine active phase based on karma
const activePhase = CURRENT_KARMA >= 100 ? 3 : CURRENT_KARMA >= 50 ? 2 : 1;
const activeSubs = SUBREDDITS.filter(s => s.phase <= activePhase);

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function generateTimes(count) {
  const lo = MIN_HOUR * 60;
  const hi = MAX_HOUR * 60;
  for (let attempt = 0; attempt < 10000; attempt++) {
    const times = Array.from({ length: count }, () => rand(lo, hi)).sort((a, b) => a - b);
    const gaps  = times.slice(1).map((t, i) => t - times[i]);
    if (gaps.some(g => g < MIN_GAP))        continue;
    if (!gaps.some(g => g <= CLUSTER_MAX))  continue;
    if (!gaps.some(g => g >= LONG_GAP_MIN)) continue;
    return times;
  }
  throw new Error('Could not generate valid schedule after 10000 attempts');
}

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

// ── Load log ──────────────────────────────────────────────────────────────────
let log = { sessions: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}

// Posts commented on in last 7 days (avoid double-commenting same post)
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentPostUrls = new Set(
  (log.sessions || [])
    .filter(s => new Date(s.timestamp).getTime() > sevenDaysAgo)
    .map(s => s.postUrl)
);

// Count comments today to avoid overdoing it
const todayStr = targetDate();
const todayCount = (log.sessions || []).filter(s => s.timestamp?.startsWith(todayStr)).length;

// ── Generate schedule ─────────────────────────────────────────────────────────
// Session count: 3-4 during warmup, scale up in phase 2+
const SESSION_COUNT = activePhase >= 2 ? rand(4, 5) : rand(3, 4);
const today   = targetDate();
const times   = generateTimes(SESSION_COUNT);
const gaps    = times.slice(1).map((t, i) => t - times[i]);

// Mix: in phase 2+, ~40% business subs, 60% consumer subs
const phase1Subs = activeSubs.filter(s => s.phase === 1);
const phase2Subs = activeSubs.filter(s => s.phase === 2);

const sessions = times.map((t, i) => {
  // In phase 2+, every 3rd session targets a business sub
  const pool = (activePhase >= 2 && i % 3 === 1 && phase2Subs.length > 0)
    ? phase2Subs
    : phase1Subs.length > 0 ? phase1Subs : activeSubs;
  const sub = weightedPick(pool);
  return {
    n:    i + 1,
    time: minsToHHMM(t),
    sub:  sub.sub,
    type: sub.type,
    done: false
  };
});

console.log(`\n📅 Reddit schedule for ${today} (${SESSION_COUNT} sessions)`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  r/${s.sub}  (${s.type})`));
console.log(`  Gaps (min): ${gaps.join(', ')}`);
console.log(`  Cluster ≤90min: ${gaps.some(g => g <= 90)}`);
console.log(`  Long gap ≥3hrs: ${gaps.some(g => g >= 180)}`);
console.log(`  Today already posted: ${todayCount}`);
console.log(`  Recent post URLs (skip): ${recentPostUrls.size}`);

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessionCount: SESSION_COUNT, sessions }, null, 2));
console.log(`\n✓ Written: today-schedule.json`);

// ── Create session crons ───────────────────────────────────────────────────────
sessions.forEach(s => {
  const isProSub = ['pro-nail','pro-hair','pro-beauty','biz'].includes(s.type);
  const isBizSub = s.type === 'biz'; // r/smallbusiness — draft only, no posting
  const proNote = isProSub ? [
    ``,
    `⚠️ BUSINESS SUB — This is r/${s.sub}, a professional community. These are our TARGET CUSTOMERS (nail techs, stylists, salon owners).`,
    isBizSub ? `\n🚫 DRAFT ONLY — r/smallbusiness comments require approval before posting. DO NOT post. See Step 6 below.\n` : ``,
    `ONLY comment on posts about:`,
    `  - Getting new clients / online visibility`,
    `  - Booking issues (clients DM instead of booking, booking confusion)`,
    `  - Website / social media presence questions`,
    `  - Starting a private studio or going solo`,
    `  - No-shows, last-minute cancellations (booking page transparency can help)`,
    ``,
    `SKIP posts about: technique questions, product questions, personal struggles, drama with clients (unless there's a booking angle).`,
    ``,
    `TONE: Peer-to-peer, direct, knowledgeable. Show you understand their world (Vagaro, Booksy, Acuity, StyleSeat, Square Appointments). No links, no promotion. Just drop value.`,
    ``,
    `EXAMPLE good comment on "clients always DM me pricing instead of booking online":`,
    `  "usually means there's friction in the booking path — most common: booking button is below the fold on mobile, no prices visible on the service menu, or no calendar preview so they can't tell if you're even taking new clients. linking directly to your booking page instead of your homepage fixes most of it"`,
    ``,
    `Read strategy.md for more: /Users/mantisclaw/.openclaw/workspace/outreach/reddit/strategy.md`,
  ].join('\n') : '';

  const msg = [
    `REDDIT SESSION ${s.n}/${SESSION_COUNT} for ${today} — post as u/Alive_Kick7098.`,
    ``,
    `Target subreddit: r/${s.sub} (${s.type})`,
    proNote,
    ``,
    `CRITICAL: Read these files first:`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/reddit/tone-guide.md`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json`,
    ``,
    `GOAL: Find a recent post (under 1 hour old, ideally under 30 min) and leave a genuine, specific comment.`,
    ``,
    `Steps:`,
    ``,
    `1. Navigate to: https://old.reddit.com/r/${s.sub}/new/`,
    `   IMPORTANT: Always use old.reddit.com — NOT www.reddit.com (new UI blocks JS text injection).`,
    ``,
    `2. Scan the post list. Look for posts submitted "X minutes ago" or "just now".`,
    `   Skip anything with:`,
    `   - Negative content (complaints, bad experiences, "help" posts about damage/problems)`,
    `   - Already commented on (check engagement-log.json)`,
    `   - Questions that require medical advice`,
    `   - Low effort or blurry photos`,
    ``,
    `3. Click into the best candidate post (positive show-and-tell, nail art, makeover, styling).`,
    ``,
    `4. Read the post title and caption carefully. Look at the photo description if visible.`,
    ``,
    `5. Draft a comment that is:`,
    `   - Specific to what's actually in the post (NOT generic)`,
    `   - 1-4 sentences max`,
    `   - Natural, casual tone (see tone-guide.md)`,
    `   - Don't start with "I"`,
    `   - For hair/skincare posts: only comment if there's real content worth engaging with`,
    `   HARD RULES — scan draft before posting:`,
    `   - NO em dashes (—) or hyphens (-) — use a period instead`,
    `   - NO quotation marks around words — rephrase`,
    `   - NO banned words: weird, resonate, nightmare, amazing, stunning, quiet, especially, vibe/vibes, genuinely, actually, bingo card, frame/framing`,
    `   - Rewrite if any rule is violated. No exceptions.`,
    ``,
    `6. Post the comment using the old.reddit.com method:`,
    `   JS: const ta = document.querySelector('textarea[name="text"]');`,
    `       ta.focus(); document.execCommand('insertText', false, 'YOUR COMMENT HERE');`,
    `   Then click the Save button: document.querySelector('.usertext-edit .save')?.click()`,
    ``,
    `7. Upvote the post:`,
    `   JS: document.querySelector('.arrow.up')?.click()`,
    `   (Do this BEFORE or AFTER commenting — just not both at the exact same time)`,
    ``,
    `8. Reload the page and confirm your comment appears (search for your username or comment text).`,
    ``,
    `9. Append to the engagement log using this EXACT method (no other way):`,
    `   const fs = require('fs');`,
    `   const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json';`,
    `   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `   log.sessions.push({ timestamp, subreddit, postUrl, postTitle, commentUrl, comment, upvoted: true, platform: "reddit", account: "Alive_Kick7098" });`,
    `   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
    `   Run this as a single exec block. Do NOT write to any other key — only log.sessions.push().`,
    ``,
    `10. CHECK INBOX FOR REPLIES — do this once per day (session 1 only):`,
    `    a. Navigate to https://old.reddit.com/message/unread/`,
    `       Read all unread messages. These are replies to our posts and comments.`,
    `    b. For each unread message that is a reply to one of our posts or comments:`,
    `       - Note the parent post URL and the commenter's text`,
    `       - Skip: low effort replies ("nice", "same", emojis only), replies that don't need a response`,
    `       - Always include the TOP VOTED comment on any post that has replies, even if not in inbox`,
    `         (navigate to the post, sort by top, check if top commenter got a reply from us already)`,
    `    c. Pick 2-3 worth replying to. Not everyone. Prioritize top-voted comment first.`,
    `    d. For each reply you write:`,
    `       - FIRST navigate to the original post and re-read our OP text carefully`,
    `         Your reply must stay 100% consistent with what we said. If OP says "i tried X and it seemed to help",`,
    `         don't reply as if you've never tried it. Never contradict the original post.`,
    `       - Read ONLY the commenter's actual words. Identify the ONE specific thing you're reacting to.`,
    `       - Write from scratch based on that one thing. No structure, no formula.`,
    `         Not "great point + my experience" — just react directly to what they said.`,
    `       - Short: 1-2 sentences max. Lowercase. No banned words. No hyphens or em dashes.`,
    `       - Every reply must feel structurally different from every other reply — different length,`,
    `         different opening, different type (question / observation / agreement with a twist / etc).`,
    `         If two replies start the same way or follow the same pattern, rewrite one before posting.`,
    `    e. Post each reply using the old.reddit.com method:`,
    `       Navigate to the comment's parent post URL. Find the comment by author name.`,
    `       Click reply → focus textarea → execCommand insertText → click Save button.`,
    `       Add uneven gaps of 1-3 minutes between replies (not equally spaced).`,
    `    f. Log each reply in engagement-log.json with type: "reply" and include replyTo: "their_username"`,
    `       so we never accidentally reply twice to the same person on the same post.`,
    `       Before posting any reply, check engagement-log.json for existing entries where`,
    `       type === "reply" and replyTo === their username and postUrl matches. If found, skip.`,
    `    g. After all replies posted: navigate to https://old.reddit.com/message/unread/`,
    `       and mark inbox as read by clicking "mark all as read".`,
    ``,
    `11. Mark this session done in today-schedule.json using this EXACT method:`,
    `    const schedPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/today-schedule.json';`,
    `    const sched = JSON.parse(fs.readFileSync(schedPath, 'utf8'));`,
    `    sched.sessions[${s.n - 1}].done = true;`,
    `    fs.writeFileSync(schedPath, JSON.stringify(sched, null, 2));`,
    ``,
    `12. Send a brief Telegram message using the message tool (channel="telegram", target="6241290513"): subreddit + post title + comment text + any replies posted to our own posts. ALWAYS include target="6241290513" — do NOT omit it.`,
    ``,
    `If no suitable post is found under 1hr old, try posts under 3hrs. If still nothing good, skip this session and log it as skipped with this EXACT method:`,
    `   const fs = require('fs');`,
    `   const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json';`,
    `   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `   log.sessions.push({ timestamp: new Date().toISOString(), subreddit: "r/${s.sub}", postUrl: null, postTitle: null, commentUrl: null, comment: null, upvoted: false, platform: "reddit", account: "Alive_Kick7098", status: "skipped", skipReason: "YOUR REASON HERE" });`,
    `   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
  ].join('\n');

  const name = `reddit-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
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
    console.log(`✓ Cron: ${name} at ${s.time} → r/${s.sub}`);
  } else {
    console.error(`✗ Failed: ${name}\n${result.stderr}`);
  }
});

console.log('\n✅ Reddit daily planner done.\n');
