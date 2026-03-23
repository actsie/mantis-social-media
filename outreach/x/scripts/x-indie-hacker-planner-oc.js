#!/usr/bin/env node
/**
 * X Indie Hacker Planner — SINGLE SESSION WITH HUMANIZER SKILL
 * Run at 6:02am PST daily. Generates 3 sessions (morning wave).
 * Each session: Find post → Draft → Humanize (skill) → Post → Log
 * Uses --session main to access workspace humanizer skill
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, 'outreach/x/engagement-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/x/indie-hacker-morning-schedule.json');

const SESSION_COUNT = 3;
const MIN_HOUR = 7, MAX_HOUR = 22;

const QUERIES = [
  { q: 'quit my job to build', label: 'quit job', backup: ['first time founder', 'solo founder'] },
  { q: 'no traction', label: 'no traction', backup: ['zero revenue', 'stuck at $0'] },
  { q: 'overwhelmed founder', label: 'overwhelmed', backup: ['golden handcuffs', 'burnout'] },
  { q: 'just launched', label: 'just launched', backup: ['about to launch', 'shipping soon'] },
  { q: 'nobody is using', label: 'nobody using', backup: ['crickets after launch', 'launched to nothing'] },
  { q: 'building in public', label: 'building in public', backup: ['shipping in public', 'working in public'] },
  { q: 'indie hacker revenue', label: 'revenue', backup: ['first paying customer', 'first dollar online'] },
  { q: 'side project to business', label: 'side project', backup: ['quit day job', 'going full time'] },
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function generateTimes(count) {
  const lo = MIN_HOUR * 60, hi = MAX_HOUR * 60;
  for (let i = 0; i < 10000; i++) {
    const times = Array.from({ length: count }, () => rand(lo, hi)).sort((a, b) => a - b);
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

// Load existing schedule to track used queries today
let usedQueries = new Set();
try {
  const existingSched = JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));
  if (existingSched.date === today && existingSched.sessions) {
    existingSched.sessions.forEach(s => { if (s.query) usedQueries.add(s.query); });
  }
} catch (e) { /* file doesn't exist yet */ }

// Filter out used queries, fall back to all if we've used them all
const availableQueries = QUERIES.filter(q => !usedQueries.has(q.q));
const queryPool = availableQueries.length > 0 ? availableQueries : QUERIES;

const times = generateTimes(SESSION_COUNT);
const shuffled = shuffle([...queryPool]);
const sessions = times.map((t, i) => ({ n: i + 1, time: minsToHHMM(t), query: shuffled[i % shuffled.length].q, label: shuffled[i % shuffled.length].label, backup: shuffled[i % shuffled.length].backup, done: false }));

console.log(`\n📅 X indie hacker schedule for ${today}\n`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  Search: ${s.label}`));

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessionCount: SESSION_COUNT, sessions, track: 'indie-hacker' }, null, 2));

sessions.forEach(s => {
  const msg = [
    `X IH Session ${s.n}/${SESSION_COUNT} — FIND → DRAFT → HUMANIZE → POST`,
    `Search: ${s.query}`,
    ``,
    `BROWSER: Use profile="openclaw". Logged into @stacydonna0x.`,
    ``,
    `0. READ AGENT CONTEXT (do this first, before all other steps):`,
    `   - Read file: ~/.openclaw/agents/x-agent.md`,
    `   - Prepend contents to session context — apply all rules from that file throughout this session`,
    ``,
    `1. FOLLOWER CHECK:`,
    `   - Go to x.com/stacydonna0x`,
    `   - Find the "Followers" link (URL contains /verified_followers)`,
    `   - Read the number BEFORE "Followers" text (e.g., "21 Followers" → extract "21")`,
    `   - Do NOT read the "Following" count — make sure you have the Followers link`,
    `   - Log to outreach/x/follower-state.json`,
    ``,
    `2. SEARCH:`,
    `   - Open x.com/search?q=${encodeURIComponent(s.query)}`,
    `   - Click "Latest" tab`,
    `   - Scroll 2-3 pages`,
    `   - If nothing: try backup #1 (${s.backup[0]}), then backup #2 (${s.backup[1]})`,
    ``,
    `3. FIND POST:`,
    `   - Look for: real struggle, doubt, stuck, no traction, overwhelmed`,
    `   - SKIP: success flexes, design feedback requests, crypto/web3, generic engagement bait`,
    `   - Check engagement-log.json — don't reply to same person twice in 7 days`,
    `   - Save: post URL, handle, post text`,
    ``,
    `4. DRAFT REPLY:`,
    `   Recent learnings — apply these:`,
    `   const fs = require('fs');`,
    `   const learningsPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/content-learnings.json';`,
    `   let learnings = [];`,
    `   try { learnings = JSON.parse(fs.readFileSync(learningsPath, 'utf8')); } catch (e) {}`,
    `   if (learnings.length > 0) {`,
    `     learnings.forEach(l => console.log('  • ' + l.rule));`,
    `     console.log('');`,
    `   }`,
    `   `,
    `   - Write a 2-3 sentence reply to THIS post.`,
    `   - Anchor the reply on exactly ONE detail from the post.`,
    `   - Do NOT quote, copy, or closely paraphrase that detail.`,
    `   - Do NOT summarize the post.`,
    `   - Do NOT mention multiple points.`,
    `   - Check engagement-log.json and avoid repeating phrases used today.`,
    `   - NO calling people out.`,
    `   `,
    `   TONE RULES:`,
    `   - Vary your opening — do NOT always start with an observation about their situation. Mix it up:`,
    `     sometimes ask a question, sometimes share a related experience, sometimes just name what you see`,
    `   - Not prescriptive — don't tell them what to do`,
    `   - Conversational — write like texting someone you respect`,
    `   - No lecture-y endings — don't close with advice or a lesson`,
    `   - 2-3 sentences max`,
    `   `,
    `   AVOID THESE PATTERNS (overused):`,
    `   - "[thing they said]. that [noun] [verb]s more than [other thing]"`,
    `   - "the [noun] you [verb]ed is [somewhere else]"`,
    `   - Starting every reply with restating their situation back to them`,
    `   `,
    `   GOOD VARIETY EXAMPLES:`,
    `   - Question opener: "six months solo — what does your week actually look like right now?"`,
    `   - Experience: "the ops load after launch is the part nobody writes about"`,
    `   - Simple acknowledgment: "that pivot feeling is real. not always wrong either"`,
    `   `,
    `   Save draft to: outreach/x/drafts/session-${s.n}-draft.txt`,
    ``,
    `5. HUMANIZE (INVOKE SKILL):`,
    `   - Run: /humanizer [paste draft content]`,
    `   - Wait for humanizer skill output`,
    `   - Save humanized output to: outreach/x/drafts/session-${s.n}-humanized.txt`,
    `   - ⚠️ DO NOT proceed to Step 6 until humanized file exists`,
    ``,
    `6. POST REPLY:`,
    `   - Navigate to the post URL saved in Step 3`,
    `   - Click the reply button (ref from snapshot)`,
    `   - Type the humanized reply from: outreach/x/drafts/session-${s.n}-humanized.txt`,
    `   - Use ONLY the humanized version — do NOT post the original draft under any circumstances`,
    `   - Click Reply/Post button (ref from snapshot)`,
    `   - Wait for confirmation that reply is visible`,
    `   - Console: "✅ Reply posted"`,
    ``,
`7. LOG ENGAGEMENT:`,
    `   const fs = require('fs');`,
    `   const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-log.json';`,
    `   let log;`,
    `   try {`,
    `     log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `   } catch (e) {`,
    `     log = { sessions: [] };`,
    `   }`,
    `   log.sessions.push({`,
    `     date: '${today}',`,
    `     session: ${s.n},`,
    `     query: '${s.query}',`,
    `     handle: 'HANDLE_FROM_STEP3',`,
    `     postUrl: 'POST_URL_FROM_STEP3',`,
    `     reply: 'FIRST_50_CHARS_OF_HUMANIZED',`,
    `     posted: true,`,
    `     timestamp: new Date().toISOString()`,
    `   });`,
    `   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
    `   console.log('✅ Engagement logged');`,
    ``,
    `8. MARK DONE:`,
    `   const sched = JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));`,
    `   sched.sessions[${s.n - 1}].done = true;`,
    `   fs.writeFileSync(SCHED_FILE, JSON.stringify(sched, null, 2));`,
    ``,
    `9. CLEANUP:`,
    `   - Do NOT delete draft files — keep until after posting`,
  ].join('\n');

  const name = `x-ih-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', ['cron', 'add', '--name', name, '--at', at, '--message', msg, '--delivery-channel', 'discord', '--delivery-target', '1485556397293703279', '--delete-after-run', '--tz', 'America/Los_Angeles', '--session', 'main'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time}`);
  } else {
    console.error(`✗ Failed: ${name}`, result.stderr);
  }
});

console.log('\n✅ X indie hacker daily planner done (single-session with humanizer skill).\n');
