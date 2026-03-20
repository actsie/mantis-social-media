#!/usr/bin/env node
/**
 * Reddit Daily Planner — SINGLE SESSION WITH HUMANIZER SKILL
 * Run at 6:01am PST daily. Generates 4 sessions.
 * Each session: Find post → Draft → Humanize (skill) → Post → Log
 * Uses --session main to access workspace humanizer skill
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, 'outreach/reddit/engagement-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/reddit/today-schedule.json');

const COMMENT_COUNT = 4;
const MIN_HOUR = 7, MAX_HOUR = 23;

// Muted subs — never select these (manual override)
const MUTED = [
  'Nails',  // Currently muted due to over-posting
];

// Cooldown config: sub → days to wait before hitting again
const COOLDOWNS = {
  'Nails': 3,
  'beauty': 2,
  'smallbusiness': 3,
  'advancedentrepreneur': 2,
  'Bookkeeping': 2,
  'business': 2,
  'Entrepreneur': 2,
  'Entrepreneurship': 2,
  'EntrepreneurRideAlong': 2,
  'growmybusiness': 2,
  'indiebiz': 2,
};

const SUBS = [
  { sub: 'Nails', weight: 2 },
  { sub: 'beauty', weight: 2 },
  { sub: 'femalehairadvice', weight: 2 },
  { sub: 'SkincareAddicts', weight: 2 },
  { sub: '30PlusSkinCare', weight: 1 },
  { sub: 'curlyhair', weight: 1 },
  { sub: 'longhair', weight: 1 },
  { sub: 'smallbusiness', weight: 2 },
  { sub: 'advancedentrepreneur', weight: 2 },
  { sub: 'Bookkeeping', weight: 2 },
  { sub: 'business', weight: 2 },
  { sub: 'Entrepreneur', weight: 2 },
  { sub: 'Entrepreneurship', weight: 2 },
  { sub: 'EntrepreneurRideAlong', weight: 2 },
  { sub: 'growmybusiness', weight: 2 },
  { sub: 'indiebiz', weight: 2 },
];

const COOLDOWN_FILE = path.join(WORKSPACE, 'outreach/reddit/subreddit-cooldowns.json');

function loadCooldowns() {
  try {
    return JSON.parse(fs.readFileSync(COOLDOWN_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveCooldowns(cooldowns) {
  fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(cooldowns, null, 2));
}

function isOnCooldown(sub, cooldowns) {
  if (!cooldowns[sub]) return false;
  const lastHit = new Date(cooldowns[sub]);
  const today = new Date(todayPST());
  const diffDays = Math.floor((today - lastHit) / (1000 * 60 * 60 * 24));
  const cooldownDays = COOLDOWNS[sub] || 0;
  return diffDays < cooldownDays;
}

function getAvailableSubs(cooldowns) {
  return SUBS.filter(s => !MUTED.includes(s.sub) && !isOnCooldown(s.sub, cooldowns));
}

function getSubredditStatus(cooldowns) {
  const lines = [];
  SUBS.forEach(s => {
    if (MUTED.includes(s.sub)) {
      lines.push(`• r/${s.sub} — MUTED ⛔️`);
    } else if (cooldowns[s.sub]) {
      const lastHit = new Date(cooldowns[s.sub]);
      const availableDate = new Date(lastHit.getTime() + (COOLDOWNS[s.sub] * 24 * 60 * 60 * 1000));
      const availStr = availableDate.toISOString().split('T')[0];
      const todayDate = new Date(todayPST());
      if (availableDate <= todayDate) {
        lines.push(`• r/${s.sub} — available ✅`);
      } else {
        lines.push(`• r/${s.sub} — cooling, available ${availStr}`);
      }
    } else {
      lines.push(`• r/${s.sub} — available ✅`);
    }
  });
  return lines.join('\n');
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function weightedPick(availableSubs) {
  if (availableSubs.length === 0) {
    throw new Error('No subreddits available — all are muted or on cooldown');
  }
  const total = availableSubs.reduce((sum, s) => sum + s.weight, 0);
  let r = rand(1, total);
  for (const s of availableSubs) {
    if (r <= s.weight) return s.sub;
    r -= s.weight;
  }
  return availableSubs[0].sub;
}

function generateTimes() {
  const lo = MIN_HOUR * 60, hi = MAX_HOUR * 60;
  for (let i = 0; i < 10000; i++) {
    const times = Array.from({ length: COMMENT_COUNT }, () => rand(lo, hi)).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, j) => t - times[j]);
    if (gaps.every(g => g >= 45) && gaps.some(g => g <= 90) && gaps.some(g => g >= 180)) return times;
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

const today = todayPST();
const cooldowns = loadCooldowns();
const availableSubs = getAvailableSubs(cooldowns);

// Log muted subs
MUTED.forEach(sub => console.log(`r/${sub} — muted, skipping`));

console.log(`\n📅 Reddit schedule for ${today}`);
console.log(`   Available subs: ${availableSubs.map(s => `r/${s.sub}`).join(', ')}`);
const onCooldown = SUBS.filter(s => isOnCooldown(s.sub, cooldowns)).map(s => {
  const lastHit = new Date(cooldowns[s.sub]);
  const availableDate = new Date(lastHit.getTime() + (COOLDOWNS[s.sub] * 24 * 60 * 60 * 1000));
  const availStr = availableDate.toISOString().split('T')[0];
  return `r/${s.sub} (available ${availStr})`;
});
if (onCooldown.length > 0) console.log(`   On cooldown: ${onCooldown.join(', ')}\n`);

const times = generateTimes();
const sessions = times.map((t, i) => ({ n: i + 1, time: minsToHHMM(t), sub: weightedPick(availableSubs), done: false }));

// Update cooldowns for today's selections
sessions.forEach(s => {
  if (COOLDOWNS[s.sub]) {
    cooldowns[s.sub] = today;
  }
});
saveCooldowns(cooldowns);

console.log(`\nGenerated sessions:`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  r/${s.sub}`));

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessions }, null, 2));

sessions.forEach(s => {
  const msg = [
    `Reddit Session ${s.n}/${COMMENT_COUNT} — FIND → DRAFT → HUMANIZE → POST`,
    `Subreddit: r/${s.sub}`,
    ``,
    `BROWSER: Use profile="openclaw". Logged into u/Alive_Kick7098.`,
    ``,
    `0. READ AGENT CONTEXT (do this first, before all other steps):`,
    `   - Read file: ~/.openclaw/agents/reddit-agent.md`,
    `   - Prepend contents to session context — apply all rules from that file throughout this session`,
    ``,
    `1. KARMA CHECK:`,
    `   - Go to old.reddit.com/user/Alive_Kick7098`,
    `   - Note post karma, comment karma, total karma`,
    `   - Log to outreach/reddit/karma-state.json`,
    ``,
    `2. OPEN SUB:`,
    `   - Go to old.reddit.com/r/${s.sub}/new`,
    `   - IMPORTANT: Use old.reddit.com (new UI blocks JS)`,
    ``,
    `3. FIND POST:`,
    `   - Look for posts "X minutes ago" or "just now" (under 1 hour old)`,
    `   - Pick: positive show-and-tell, nail art, makeovers, styling`,
    `   - SKIP: negative content, help posts, blurry photos, already commented`,
    `   - Save: post URL, post title, post text`,
    ``,
    `4. READ TOP COMMENTS:`,
    `   - Sort by "top", read top 3 comments`,
    `   - Note their length, tone, structure`,
    `   - Match that energy`,
    ``,
    `5. DRAFT COMMENT:`,
    `   - Write a 2-3 sentence reply to THIS post.`,
    `   - Anchor the reply on exactly ONE detail from the post.`,
    `   - Do NOT quote, copy, or closely paraphrase that detail.`,
    `   - Do NOT summarize the post.`,
    `   - Do NOT mention multiple points.`,
    `   - Check engagement-log.json and avoid repeating phrases used today.`,
    `   - NO calling people out.`,
    `   `,
    `   TONE RULES (mandatory):`,
    `   - Warm opener — start with empathy, not observation ("That's tough" not "The problem is...")`,
    `   - Not prescriptive — don't tell them what to do ("systems help" not "you need to systemize")`,
    `   - Conversational — write like you're texting a friend`,
    `   - Capitalization optional — match the vibe of the post`,
    `   - No lecture-y endings — don't close with advice ("that weight builds up" not "here's what to do")`,
    `   - 2-3 sentences max — leave room for them to respond`,
    `   `,
    `   EXAMPLE (use as reference):`,
    `   Good: "The leap from building to running is tough. You've launched the product but now you're swamped by everything that comes next."`,
    `   Bad: "the gap between building and running is brutal. you shipped the product but now you're drowning. client chasing and admin will eat every hour you don't systemize."`,
    `   `,
    `   Save draft to: outreach/reddit/drafts/session-${s.n}-draft.txt`,
    ``,
    `6. HUMANIZE (INVOKE SKILL):`,
    `   - Run: /humanizer [paste draft content]`,
    `   - Wait for humanizer skill output`,
    `   - Save humanized output to: outreach/reddit/drafts/session-${s.n}-humanized.txt`,
    `   - ⚠️ DO NOT proceed to Step 7 until humanized file exists`,
    ``,
    `7. POST:`,
    `   - Navigate to the post`,
    `   - Read humanized comment from session-${s.n}-humanized.txt`,
    `   - Use ONLY the humanized version — do NOT post the original draft under any circumstances`,
    `   - old.reddit.com method:`,
    `   - textarea[name="text"] → focus → execCommand insertText with HUMANIZED text → click Save`,
    `   - Upvote: .arrow.up → click`,
    `   - Reload, confirm comment appears`,
    ``,
    `8. ENGAGEMENT CHECK (wait 60-90s):`,
    `   - Go back to post`,
    `   - Check upvotes/replies on our comment`,
    `   - Log to engagement-log.json`,
    ``,
    `9. LOG (BULLETPROOF — with backup + validation):`,
    `   const fs = require('fs');`,
    `   const logPath = 'outreach/reddit/engagement-log.json';`,
    `   const backupPath = 'outreach/reddit/engagement-log.json.bak';`,
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
    `   const humanized = fs.readFileSync('outreach/reddit/drafts/session-${s.n}-humanized.txt', 'utf8').trim();`,
    `   `,
    `   // Append new session`,
    `   log.sessions.push({ timestamp: new Date().toISOString(), subreddit: 'r/${s.sub}', postUrl: 'URL', postTitle: 'TITLE', comment: humanized, upvoted: true, platform: 'reddit', account: 'Alive_Kick7098', engagement: { upvotesOnOurComment: X, repliesToOurComment: Y }, humanized: true });`,
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
    `9b. WARM LEADS WRITE-BACK (if applicable):`,
    `   const warmLeadsPath = 'outreach/reddit/warm-leads.json';`,
    `   if (fs.existsSync(warmLeadsPath)) {`,
    `     const warmLeads = JSON.parse(fs.readFileSync(warmLeadsPath, 'utf8'));`,
    `     const lead = warmLeads.leads.find(l => l.postUrl === 'URL');`,
    `     if (lead) {`,
    `       lead.status = 'commented';`,
    `       lead.commentedAt = new Date().toISOString();`,
    `       fs.writeFileSync(warmLeadsPath, JSON.stringify(warmLeads, null, 2));`,
    `       console.log('✓ Warm lead updated: ' + lead.author);`,
    `     }`,
    `   }`,
    ``,
    `10. MARK DONE:`,
    `   const sched = JSON.parse(fs.readFileSync('outreach/reddit/today-schedule.json', 'utf8'));`,
    `   sched.sessions[${s.n - 1}].done = true;`,
    `   fs.writeFileSync('outreach/reddit/today-schedule.json', JSON.stringify(sched, null, 2));`,
    ``,
    `10b. LOG TO CHANGELOG:`,
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
    `     title: 'Reddit reply posted — r/' + '${s.sub}',`,
    `     description: commentPreview + (humanized.length > 80 ? '...' : ''),`,
    `     date: '${today}',`,
    `     timestamp: new Date().toISOString()`,
    `   });`,
    `   fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));`,
    ``,
    `11. TELEGRAM (target="6241290513"):`,
    `    Reddit Session ${s.n}/${COMMENT_COUNT} ✅`,
    `    Subreddit: r/${s.sub}`,
    `    Post: TITLE`,
    `    Comment: "HUMANIZED TEXT"`,
    `    Engagement: X upvotes, Y replies`,
    `    Karma: COUNT (DELTA today)`,
    ``,
    `12. CLEANUP:`,
    `   - Delete draft files: session-${s.n}-draft.txt, session-${s.n}-humanized.txt`,
  ].join('\n');

  const name = `reddit-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', ['cron', 'add', '--name', name, '--at', at, '--message', msg, '--announce', '--delete-after-run', '--tz', 'America/Los_Angeles'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time}`);
  } else {
    console.error(`✗ Failed: ${name}`, result.stderr);
  }
});

console.log('\n✅ Reddit daily planner done (single-session with humanizer skill).\n');
