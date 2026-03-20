#!/usr/bin/env node
/**
 * Instagram Daily Planner — SINGLE SESSION WITH HUMANIZER SKILL
 * Run at 5:55am PST daily. Generates 10 sessions.
 * Each session: Find post → Draft → Humanize (skill) → Post → Log
 * Uses --session main to access workspace humanizer skill
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, 'outreach/instagram/engagement-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/instagram/today-schedule.json');

const COMMENT_COUNT = 10;
const MIN_HOUR = 6;
const MAX_HOUR = 23;

const NAIL_TAGS = ['nailslove', 'nailart', 'nailsofig', 'nailinspiration', 'naildesigner', 'nailsalon'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function generateTimes() {
  const lo = MIN_HOUR * 60, hi = MAX_HOUR * 60;
  for (let i = 0; i < 10000; i++) {
    const times = Array.from({ length: COMMENT_COUNT }, () => rand(lo, hi)).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, j) => t - times[j]);
    if (gaps.every(g => g >= 30) && gaps.some(g => g <= 90) && gaps.some(g => g >= 180)) return times;
  }
  throw new Error('Could not generate schedule');
}

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getLAOffset() {
  const tz = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const utc = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
  const diff = Math.round((tz - utc) / 3600000);
  return `${diff >= 0 ? '+' : '-'}${Math.abs(diff).toString().padStart(2, '0')}:00`;
}

// Load log for skip list
let log = { sessions: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentAccounts = new Set(
  (log.sessions || [])
    .filter(s => s.type === 'comment' && new Date(s.timestamp).getTime() > sevenDaysAgo)
    .map(s => s.account)
);

const today = todayPST();
const times = generateTimes();
const sessions = times.map((t, i) => ({ n: i + 1, time: minsToHHMM(t), tag: NAIL_TAGS[i % NAIL_TAGS.length], done: false }));

console.log(`\n📅 Instagram schedule for ${today}\n`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  #${s.tag}`));

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessions }, null, 2));

sessions.forEach(s => {
  const msg = [
    `IG Session ${s.n}/${COMMENT_COUNT} — FIND → DRAFT → HUMANIZE → POST`,
    `Hashtag: #${s.tag}`,
    ``,
    `BROWSER: Use profile="openclaw". Logged into @stacyd0nna.`,
    ``,
    `SKIP: ${[...recentAccounts].join(', ') || 'none'}`,
    ``,
    `0. READ AGENT CONTEXT (do this first, before all other steps):`,
    `   - Read file: ~/.openclaw/agents/ig-agent.md`,
    `   - Prepend contents to session context — apply all rules from that file throughout this session`,
    ``,
    `1. FOLLOWER CHECK:`,
    `   - Go to instagram.com/stacyd0nna`,
    `   - Note follower count`,
    `   - Log to outreach/instagram/follower-state.json`,
    ``,
    `2. FIND POST:`,
    `   - Open instagram.com/explore/tags/${s.tag}/`,
    `   - Pick post from TODAY (look for "Xh ago")`,
    `   - If none: use accounts.md fallback (post ≤7 days old)`,
    `   - Skip accounts in SKIP list`,
    `   - Save: post URL, account name, caption text`,
    ``,
    `3. DRAFT COMMENT:`,
    `   - Write a 1-3 sentence reply to THIS post.`,
    `   - Anchor the reply on exactly ONE detail from the post.`,
    `   - Do NOT quote, copy, or closely paraphrase that detail.`,
    `   - Do NOT summarize the post.`,
    `   - Do NOT mention multiple points.`,
    `   - Check engagement-log.json and avoid repeating phrases used today.`,
    `   - NO calling people out.`,
    `   `,
    `   Save draft to: outreach/instagram/drafts/session-${s.n}-draft.txt`,
    ``,
    `4. HUMANIZE (INVOKE SKILL):`,
    `   - Run: /humanizer [paste draft content]`,
    `   - Wait for humanizer skill output`,
    `   - Save humanized output to: outreach/instagram/drafts/session-${s.n}-humanized.txt`,
    `   - ⚠️ DO NOT proceed to Step 5 until humanized file exists`,
    ``,
    `5. POST:`,
    `   - Navigate to the post`,
    `   - Read humanized comment from session-${s.n}-humanized.txt`,
    `   - Use ONLY the humanized version — do NOT post the original draft under any circumstances`,
    `   - Click comment box → execCommand insertText with HUMANIZED text → click Post`,
    `   - Like post + 2 older posts from same account`,
    ``,
    `6. FOLLOW BUILDER:`,
    `   - Scan comments for real people (not brands, <500 followers, last post ≤2 days)`,
    `   - Like 2 of their posts, comment if genuine hook, tap Follow`,
    `   - Log to outreach/instagram/follow-tracker.json`,
    ``,
    `7. ENGAGEMENT CHECK (wait 60-90s):`,
    `   - Go back to post`,
    `   - Check likes/replies on our comment`,
    `   - Log to engagement-log.json`,
    ``,
    `8. LOG (BULLETPROOF — with backup + validation):`,
    `   const fs = require('fs');`,
    `   const logPath = 'outreach/instagram/engagement-log.json';`,
    `   const backupPath = 'outreach/instagram/engagement-log.json.bak';`,
    `   `,
    `   // Read existing log (or create if missing)`,
    `   let log;`,
    `   try {`,
    `     log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `     if (!log.sessions) log.sessions = [];`,
    `     const oldCount = log.sessions.length;`,
    `   } catch (e) {`,
    `     log = { sessions: [] };`,
    `   }`,
    `   `,
    `   // Backup before write`,
    `   try { fs.copyFileSync(logPath, backupPath); } catch (e) {}`,
    `   `,
    `   // Read humanized comment`,
    `   const humanized = fs.readFileSync('outreach/instagram/drafts/session-${s.n}-humanized.txt', 'utf8').trim();`,
    `   `,
    `   // Append new session`,
    `   log.sessions.push({ timestamp: new Date().toISOString(), account: 'NAME', postUrl: 'URL', comment: humanized, likes: ['post1','post2','post3'], type: 'comment', hashtag: '${s.tag}', engagement: { likesOnOurComment: X, repliesToOurComment: Y }, humanized: true });`,
    `   `,
    `   // Validate count increased`,
    `   if (log.sessions.length <= oldCount) {`,
    `     console.error('ERROR: Session count did not increase! Restoring backup...');`,
    `     fs.copyFileSync(backupPath, logPath);`,
    `     throw new Error('Logging failed - session count unchanged');`,
    `   }`,
    `   `,
    `   // Atomic write (temp file then rename)`,
    `   const tempPath = logPath + '.tmp';`,
    `   fs.writeFileSync(tempPath, JSON.stringify(log, null, 2));`,
    `   fs.renameSync(tempPath, logPath);`,
    ``,
    `9. MARK DONE:`,
    `   const sched = JSON.parse(fs.readFileSync('outreach/instagram/today-schedule.json', 'utf8'));`,
    `   sched.sessions[${s.n - 1}].done = true;`,
    `   fs.writeFileSync('outreach/instagram/today-schedule.json', JSON.stringify(sched, null, 2));`,
    ``,
    `9b. LOG TO CHANGELOG:`,
    `   const changelogPath = 'dashboard/changelog.json';`,
    `   let changelog;`,
    `   try {`,
    `     changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));`,
    `     if (!changelog.entries) changelog.entries = [];`,
    `   } catch (e) {`,
    `     changelog = { entries: [] };`,
    `   }`,
    `   const commentPreview = humanized.substring(0, 80).replace(/"/g, "'");`,
    `   changelog.entries.unshift({`,
    `     type: 'new',`,
    `     title: 'Instagram reply posted — @' + 'ACCOUNT',`,
    `     description: commentPreview + (humanized.length > 80 ? '...' : ''),`,
    `     date: '${today}',`,
    `     timestamp: new Date().toISOString()`,
    `   });`,
    `   fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));`,
    ``,
    `10. TELEGRAM (target="6241290513"):`,
    `    IG Session ${s.n}/${COMMENT_COUNT} ✅`,
    `    Account: @NAME`,
    `    Action: commented (humanized)`,
    `    Engagement: X likes, Y replies`,
    `    Followed: N (@handles)`,
    `    Followers: COUNT (DELTA)`,
    ``,
    `11. CLEANUP:`,
    `   - Delete draft files: session-${s.n}-draft.txt, session-${s.n}-humanized.txt`,
  ].join('\n');

  const name = `ig-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', ['cron', 'add', '--name', name, '--at', at, '--message', msg, '--announce', '--delete-after-run', '--tz', 'America/Los_Angeles'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time}`);
  } else {
    console.error(`✗ Failed: ${name}`, result.stderr);
  }
});

console.log('\n✅ Instagram daily planner done (single-session with humanizer skill).\n');
