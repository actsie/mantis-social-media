#!/usr/bin/env node
/**
 * x-indie-hacker-afternoon.js
 * Afternoon wave of indie hacker outreach.
 * Run at 2:30 PM PST daily.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE  = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE   = path.join(WORKSPACE, 'outreach/x/indie-hacker-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/x/indie-hacker-afternoon-schedule.json');
const TRACKER_FILE = path.join(WORKSPACE, 'outreach/x/indie-hacker-tracker.json');

const MIN_HOUR      = 14;   // 2:00 PM PST
const MAX_HOUR      = 20;   // 8:00 PM PST
const MIN_GAP       = 45;
const CLUSTER_MAX   = 90;
const LONG_GAP_MIN  = 180;

// Afternoon wave - indie hacker focused queries with backup queries for retry logic
const SEARCH_QUERIES = [
  { query: 'overwhelmed founder', type: 'indie-hacker', label: 'overwhelmed', backup: ['golden handcuffs', 'burnout'] },
  { query: 'can\'t ship', type: 'indie-hacker', label: 'can\'t ship', backup: ['unfinished SaaS', 'stuck building'] },
  { query: 'zero revenue', type: 'indie-hacker', label: 'zero revenue', backup: ['stuck at $0', 'no traction'] },
  { query: 'stuck at $0', type: 'indie-hacker', label: 'stuck at zero', backup: ['zero revenue', 'no users'] },
  { query: 'golden handcuffs', type: 'indie-hacker', label: 'golden handcuffs', backup: ['overwhelmed founder', 'quit my job'] },
  { query: 'nobody is using', type: 'indie-hacker', label: 'nobody using', backup: ['crickets after launch', 'launched to nothing'] },
  { query: 'churn is killing', type: 'indie-hacker', label: 'churn', backup: ['users leaving', 'retention problem'] },
  { query: 'can\'t find PMF', type: 'indie-hacker', label: 'no PMF', backup: ['searching for PMF', 'product market fit'] },
  { query: 'runway running out', type: 'indie-hacker', label: 'runout runway', backup: ['months left', 'need revenue'] },
];

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

// Load tracker to avoid repeat engagements
let tracker = { engaged: [], follows: [] };
if (fs.existsSync(TRACKER_FILE)) {
  try { tracker = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); } catch (_) {}
}

const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentTargets = new Set(
  (tracker.engaged || [])
    .filter(e => new Date(e.date).getTime() > sevenDaysAgo)
    .map(e => e.handle)
);

// 3 sessions for afternoon wave
const SESSION_COUNT = 3;
const today   = targetDate();
const times   = generateTimes(SESSION_COUNT);
const gaps    = times.slice(1).map((t, i) => t - times[i]);

const shuffledQueries = shuffle([...SEARCH_QUERIES]);

const sessions = times.map((t, i) => {
  const query = shuffledQueries[i % shuffledQueries.length];
  return {
    n:      i + 1,
    time:   minsToHHMM(t),
    query:  query.query,
    type:   query.type,
    label:  query.label,
    backup: query.backup,
    done:   false
  };
});

console.log(`\n📅 X indie hacker AFTERNOON wave for ${today} (${SESSION_COUNT} sessions)\n`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  Search: ${s.label} (${s.type})`));
console.log(`\n  Gaps (min): ${gaps.join(', ')}`);

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessionCount: SESSION_COUNT, sessions, track: 'indie-hacker-afternoon' }, null, 2));
console.log(`\n✓ Written: today-schedule.json (afternoon wave)\n`);

sessions.forEach(s => {
  const msg = [
    `X INDIE HACKER AFTERNOON SESSION ${s.n}/${SESSION_COUNT} for ${today} — post as @stacydonna0x.`,
    ``,
    `BROWSER: Use profile="openclaw" for ALL browser tool calls.`,
    ``,
    `Search query: ${s.query}`,
    `Target type: ${s.type}`,
    `Backup queries (retry in order):`,
    `  - Backup #1: ${s.backup[0]}`,
    `  - Backup #2: ${s.backup[1] || s.backup[0]}`,
    `  - Backup #3: Check indie-hacker-query-success.json for historically successful queries`,
    ``,
    `0. READ AGENT CONTEXT (do this first, before all other steps):`,
    `   - Read file: ~/.openclaw/agents/x-agent.md`,
    `   - Prepend contents to session context — apply all rules from that file throughout this session`,
    ``,
    `0b. ⚡ HUMANIZE STEP (applies to Step 4 — draft first, then humanize):`,
    `   - Draft your reply following tone-guide.md rules.`,
    `   - Save draft to: outreach/x/drafts/afternoon-session-${s.n}-draft.txt`,
    `   - Run: /humanizer [paste draft content]`,
    `   - Wait for humanizer skill output.`,
    `   - Save humanized output to: outreach/x/drafts/afternoon-session-${s.n}-humanized.txt`,
    `   - ⚠️ DO NOT proceed to Step 5 (POST) until humanized file exists.`,
    ``,
    `POST STEP (Step 5 — immediately after humanize):`,
    `   - Post content from outreach/x/drafts/afternoon-session-${s.n}-humanized.txt ONLY`,
    `   - Do NOT post the original draft under any circumstances`,
    ``,
    `CRITICAL: Read these files first:`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/x/tone-guide.md`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-tracker.json`,
    ``,
    `GOAL: Find 1 person expressing real struggle. Reply + like 1-3 posts + follow if fits ICP.`,
    ``,
    `STEPS:`,
    ``,
    `1. Navigate to: https://x.com/search?q=${encodeURIComponent(s.query)}&f=live`,
    ``,
    `2. Scan 2-3 pages. Look for:`,
    `   - Real struggle (not humblebragging)`,
    `   - Stuck between two directions`,
    `   - No traction / no users after months`,
    `   - Losing motivation`,
    `   - Overwhelmed founder, burnout, golden handcuffs`,
    `   - Just launched to crickets, churn, can't find PMF`,
    ``,
    `3. SKIP:`,
    `   - Design feedback requests`,
    `   - Success flexes`,
    `   - Generic engagement bait`,
    `   - Crypto/web3/NFT`,
    `   - People engaged with in last 7 days: ${Array.from(recentTargets).slice(0, 5).join(', ')}`,
    ``,
    `3b. RETRY LOGIC — If nothing suitable after 2-3 pages:`,
    `    Try backup #1: https://x.com/search?q=${encodeURIComponent(s.backup[0])}&f=live`,
    `    Still nothing? Try backup #2: https://x.com/search?q=${encodeURIComponent(s.backup[1] || s.backup[0])}&f=live`,
    `    Still nothing? Check indie-hacker-query-success.json for backup #3 (historically successful queries):`,
    `      const fs = require('fs');`,
    `      const successPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-query-success.json';`,
    `      const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));`,
    `      const successfulQueries = Object.entries(successData.querySuccess)`,
    `        .filter(([q, data]) => data.successCount > 0)`,
    `        .sort((a, b) => b[1].successCount - a[1].successCount)`,
    `        .map(([q]) => q);`,
    `      If successfulQueries.length > 0, try: https://x.com/search?q=${encodeURIComponent('${s.backup[1] || s.backup[0]}')}&f=live`,
    `    Only skip if ALL 4 queries (primary + backup #1 + backup #2 + backup #3) return nothing.`,
    ``,
    `4. Draft reply (following humanizer skill rules):`,
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
    `   - Their line (the one with truth inside it)`,
    `   - What that probably means`,
    `   - One cost or consequence`,
    `   - Stop early`,
    `   - MUST follow humanizer skill rules (Step 0) — no AI words, no em dashes, no quotes.`,
    `   - Save draft to: outreach/x/drafts/afternoon-session-${s.n}-draft.txt`,
    ``,
    `5. POST reply:`,
    ``,
    `5. Like 1-3 relevant posts on their profile.`,
    ``,
    `6. Follow if:`,
    `   - Actively building (not just talking)`,
    `   - Post regularly about journey`,
    `   - In ICP (indie hacker, contractor, real estate)`,
    `   - Content is genuine, not promo-heavy`,
    ``,
    `7. Log to indie-hacker-tracker.json with full profile notes.`,
    ``,
    `8. Log successful query to indie-hacker-query-success.json:`,
    `    const fs = require('fs');`,
    `    const successPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-query-success.json';`,
    `    const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));`,
    `    const queryUsed = 'WHICHEVER_QUERY_ACTUALLY_WORKED';`,
    `    if (!successData.querySuccess[queryUsed]) {`,
    `      successData.querySuccess[queryUsed] = { successCount: 0, lastSuccess: null };`,
    `    }`,
    `    successData.querySuccess[queryUsed].successCount++;`,
    `    successData.querySuccess[queryUsed].lastSuccess = new Date().toISOString();`,
    `    successData.lastUpdated = new Date().toISOString();`,
    `    fs.writeFileSync(successPath, JSON.stringify(successData, null, 2));`,
    ``,
    `8. MARK DONE:`,
    `   const sched = JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));`,
    `   sched.sessions[${s.n - 1}].done = true;`,
    `   fs.writeFileSync(SCHED_FILE, JSON.stringify(sched, null, 2));`,
    ``,
    `9. Telegram summary to 6241290513.`,
  ].join('\n');

  const name = `x-ih-afternoon-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at   = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', name,
    '--at',   at,
    '--system-event', msg,
    '--delete-after-run',
    '--tz', 'America/Los_Angeles',
    '--session', 'main'
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time} → ${s.label}`);
  } else {
    console.error(`✗ Failed: ${name}\n${result.stderr}`);
  }
});

console.log('\n✅ X indie hacker afternoon planner done.\n');
