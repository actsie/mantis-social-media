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

const COMMENT_COUNT  = 10;
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
    `INSTAGRAM SESSION ${s.n}/${COMMENT_COUNT} for ${today} — run as stacyd0nna.`,
    ``,
    `BROWSER: Use profile="openclaw" for ALL browser tool calls. This browser is already logged into Instagram as stacyd0nna. Do NOT use profile="chrome" or the Chrome extension relay.`,
    ``,
    `Hashtag: #${s.tag}`,
    engagementRule,
    ``,
    `SKIP these accounts (commented in last 7 days): ${skipList}`,
    ``,
    `HARD RULES — apply to every comment, no exceptions:`,
    `- NO em dashes (—) or hyphens (-) — use a period instead`,
    `- NO quotation marks around words — rephrase`,
    `- NO banned words: weird, resonate, nightmare, amazing, stunning, quiet, especially, vibe/vibes, genuinely, actually, plot twist, lands, sticks, clicks, reads as, clean, bingo card`,
    `- NO starting with "the"`,
    `- Max 3 sentences`,
    `- DO NOT explain why something works — react to it. If you're surprised a combo works, say you're surprised. Don't follow with design logic. Do NOT copy or template any example from the tone guide — every comment must be written fresh for that specific post.`,
    `- Scan your draft for all of the above before posting. If any are present, rewrite.`,
    ``,
    `Steps:`,
    `1. Read /Users/mantisclaw/.openclaw/workspace/outreach/instagram/tone-guide.md + scheduling-rules.md`,
    `2. Before navigating: close any existing Instagram tabs in the browser (use browser tabs tool to list tabs, then close any whose URL contains instagram.com). Then open https://www.instagram.com/explore/tags/${s.tag}/ in a new tab.`,
    `3. Find a post from TODAY (same day — look for "Xh ago" or today's date). Skip accounts in the skip list.`,
    `   FALLBACK: If no same-day posts in the hashtag feed, go to /Users/mantisclaw/.openclaw/workspace/outreach/instagram/accounts.md and pick the next unengaged account.`,
    `   ⚠️ RECENCY RULE for accounts.md fallback: Only engage on posts that are 7 days old or less. Check the account's most recent post timestamp. If the newest post is older than 7 days, skip that account and pick the next one on the list. Do not comment on posts older than 1 week.`,
    `4. Draft a fresh, original comment for that SPECIFIC post (image + caption + vibe). Use the tone guide style list as energy reference only — max 1-3 list phrases per day total across all sessions.`,
    `5. Post via browser automation: snapshot → click comment box (ref) → JS execCommand inject → click Post button (ref)`,
    `6. Like the post + 2 older posts from the same account (snapshot → find Like button ref → click)`,
    ``,
    `7. ⚡ FOLLOW BUILDER — THIS STEP IS MANDATORY. Do it now, before logging. Target: 1-2 follows per session.`,
    `   a. Scroll down to the comments section of the post you just commented on.`,
    `   b. Scan for 1-2 real people who also commented (skip business accounts, brands, accounts with 1000+ followers).`,
    `      BEFORE tapping their profile: read their comment first. Skip immediately if it's only emojis,`,
    `      only "love this" / "so pretty" / single-word filler, or looks like a bot comment.`,
    `      Only proceed with people who left a real, specific comment — even just one genuine sentence.`,
    `   c. For each candidate, tap into their profile and check ALL of the following:`,
    `      - Last post is 2 days old or less (check the timestamp on their most recent post)`,
    `      - Follower count is under 500`,
    `      - Recent posts are positive, safe content — nail/beauty/lifestyle/food/travel/fashion is fine`,
    `        SKIP immediately if recent posts contain: political opinions, religious content, negativity,`,
    `        arguments, anything controversial or charged. When in doubt, skip.`,
    `      - Not already following @stacyd0nna`,
    `   d. If candidate passes ALL checks:`,
    `      - Like 2 of their recent posts`,
    `      - Comment on 1 post only if there is a genuine hook (same tone rules apply — no filler, no hype). Skip the comment if nothing genuine to say — like-only is fine.`,
    `      - Tap Follow`,
    `   e. Log each follow immediately using this EXACT method — run as a single exec block:`,
    `      const fs = require('fs');`,
    `      const ftPath = '/Users/mantisclaw/.openclaw/workspace/outreach/instagram/follow-tracker.json';`,
    `      const ft = JSON.parse(fs.readFileSync(ftPath, 'utf8'));`,
    `      ft.follows.push({`,
    `        handle: 'THEIR_HANDLE',`,
    `        followedDate: '${today}',`,
    `        followerCount: THEIR_FOLLOWER_COUNT,`,
    `        followedBack: null,`,
    `        source: 'comment-section #${s.tag}',`,
    `        sourcePost: 'POST_URL_YOU_COMMENTED_ON',`,
    `        commented: true_or_false,`,
    `        notes: ''`,
    `      });`,
    `      fs.writeFileSync(ftPath, JSON.stringify(ft, null, 2));`,
    `   f. If no qualifying candidates found after scanning 5+ comments, note why and move on. Zero is acceptable — but you must have looked.`,
    ``,
    `8. ⚡ LEAD LOGGING — If you discover a salon with a broken/weak website during this session, log it to KameleonDB:`,
    `   Examples of lead-worthy finds:`,
    `   - Bio says "visit website" but site is 404/blank`,
    `   - Bio says "call/DM to book" but site has a booking button (disconnect)`,
    `   - Site exists but booking CTA is buried or broken`,
    `   `,
    `   If found, log it:`,
    `   const { execSync } = require('child_process');`,
    `   execSync('cd /Users/mantisclaw/.openclaw/workspace && node outreach/scripts/log-lead.js --platform IG --account ACCOUNT_NAME --link PROFILE_URL --segment "nail salon" --fit FIT_SCORE --reason "BRIEF_REASON" --notes "Found during #TAG engagement session"');`,
    `   `,
    `   If no lead found (just normal engagement), skip this step.`,
    ``,
    `9. Append to the engagement log using this EXACT method (no other way):`,
    `   const fs = require('fs');`,
    `   const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/instagram/engagement-log.json';`,
    `   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `   log.sessions.push({ timestamp, account, postUrl, commentUrl, comment, likes, type, hashtag, note });`,
    `   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
    `   Run this as a single exec block. Do NOT write to any other key — only log.sessions.push().`,
    `10. Mark this session done in today-schedule.json using this EXACT method:`,
    `   const schedPath = '/Users/mantisclaw/.openclaw/workspace/outreach/instagram/today-schedule.json';`,
    `   const sched = JSON.parse(fs.readFileSync(schedPath, 'utf8'));`,
    `   sched.sessions[${s.n - 1}].done = true;`,
    `   fs.writeFileSync(schedPath, JSON.stringify(sched, null, 2));`,
    ``,
    `10. Send a brief Telegram message using the message tool (channel="telegram", target="6241290513"): account name, what was posted or "liked only", + follow count REQUIRED (e.g. "followed 2: @handle1, @handle2" or "followed 0 — no qualifying commenters found"). ALWAYS include target="6241290513" — do NOT omit it.`,
  ].join('\n');

  const name = `ig-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at   = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', name,
    '--at',   at,
    '--message', msg,
    '--announce',
    '--delete-after-run',
    '--tz', 'America/Los_Angeles'
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time}`);
  } else {
    console.error(`✗ Failed: ${name}\n${result.stderr}`);
    console.error(`  stdout: ${result.stdout}`);
  }
});

console.log('\n✅ Daily planner done.\n');
