#!/usr/bin/env node
/**
 * x-original-posts-planner.js
 * Generates one original tweet session per day for @stacydonna0x.
 * Picks mode from rotating cycle, schedules a random time between 9am–9pm PST.
 * Run at 6:04am PST daily (staggered after engagement planner).
 * 
 * Posts are based on patterns from engagement-log.json (last 7 days),
 * not pre-written drafts.
 * 
 * Updated Mar 14: Single-session flow with humanizer skill invocation
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE   = 'outreach/x/original-posts-state.json';
const LOG_FILE     = 'outreach/x/original-posts-log.json';
const GUIDE_FILE   = 'outreach/x/original-posts-guide.md';
const ENGAGEMENT_LOG = 'outreach/x/engagement-log.json';
const TRACKER_FILE = 'outreach/x/indie-hacker-tracker.json';

// Weighted mode pool — mapped to 4 brand pillars
const MODE_WEIGHTS = [
  { mode: 1, weight: 2 },
  { mode: 2, weight: 3 },
  { mode: 3, weight: 3 },
  { mode: 4, weight: 2 },
];

function pickMode(lastMode) {
  const pool = lastMode ? MODE_WEIGHTS.filter(m => m.mode !== lastMode) : MODE_WEIGHTS;
  const total = pool.reduce((s, m) => s + m.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item.mode;
  }
  return pool[pool.length - 1].mode;
}

const MIN_HOUR = 9;
const MAX_HOUR = 21;

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

// Load state
let state = { lastMode: null, lastPostDate: null };
if (fs.existsSync(STATE_FILE)) {
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) {}
}

// Load log
let log = { posts: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}

// Determine today's mode
const today = targetDate();
const mode  = pickMode(state.lastMode);

const MODE_NAMES = {
  1: 'Leads — Pattern Noticed',
  2: 'Authority — Strong Take',
  3: 'Build in Public — Research Observation',
  4: 'Think Out Loud — Personality'
};

// Analyze last 7 days of engagement for patterns
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
let recentEngagements = [];

if (fs.existsSync(ENGAGEMENT_LOG)) {
  try {
    const engLog = JSON.parse(fs.readFileSync(ENGAGEMENT_LOG, 'utf8'));
    recentEngagements = (engLog.sessions || [])
      .filter(s => new Date(s.timestamp).getTime() > sevenDaysAgo && s.type === 'indie-hacker');
  } catch (_) {}
}

// Extract patterns from engagements
const postTexts = recentEngagements.map(s => s.postText || '').filter(t => t.length > 0);

// Look for common themes in post texts
const themeKeywords = {
  'zero revenue': [/zero revenue/i, /\$0/i, /no revenue/i],
  'no users': [/no users/i, /no traction/i, /nobody is using/i],
  'distribution': [/distribution/i, /can't get users/i, /can't find users/i],
  'burnout': [/burnout/i, /overwhelmed/i, /exhausted/i, /tired/i],
  'stuck': [/stuck/i, /can't ship/i, /can't launch/i],
  'silent launch': [/silence/i, /crickets/i, /nobody knows/i],
  'building alone': [/solo/i, /alone/i, /no cofounder/i],
  'golden handcuffs': [/golden handcuffs/i, /can't quit/i, /trapped/i],
};

const foundThemes = [];
Object.entries(themeKeywords).forEach(([theme, patterns]) => {
  const matches = postTexts.filter(text => patterns.some(p => p.test(text)));
  if (matches.length >= 2) {
    foundThemes.push({ theme, count: matches.length });
  }
});

// Build research context for the session
let researchContext = '';
if (foundThemes.length > 0) {
  researchContext = `Patterns noticed from last 7 days:\n`;
  foundThemes.forEach(t => {
    researchContext += `  - ${t.theme} (${t.count} founders)\n`;
  });
} else {
  researchContext = `No strong patterns from last 7 days. Draw from general observations.`;
}

// Pick random time
const lo   = MIN_HOUR * 60;
const hi   = MAX_HOUR * 60;
const time = minsToHHMM(rand(lo, hi));

// Build session message
const msg = [
  `X ORIGINAL POST SESSION for ${today} — post as @stacydonna0x.`,
  ``,
  `TODAY'S MODE: ${mode} — ${MODE_NAMES[mode]}`,
  `Last mode: ${state.lastMode ? state.lastMode + ' (' + MODE_NAMES[state.lastMode] + ')' : 'none'}`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 0 — READ AGENT CONTEXT (do this first, before all other steps):`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `- Read file: ~/.openclaw/agents/x-agent.md`,
  `- Prepend contents to session context — apply all rules from that file throughout this session`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 1 — RESEARCH (Read Before Writing):`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `1. Read engagement log (last 7 days):`,
  `   ${ENGAGEMENT_LOG}`,
  ``,
  `2. Read indie hacker tracker:`,
  `   ${TRACKER_FILE}`,
  ``,
  `3. Notice patterns across engagements:`,
  ``,
  `${researchContext}`,
  ``,
  `4. DO NOT:`,
  `   - Name specific accounts in your post`,
  `   - Say "talked to" or "had a call with" (we commented, didn't call)`,
  `   - Call anyone out or make them feel exposed`,
  `   - Share identifiable details`,
  ``,
  `5. DO:`,
  `   - Notice patterns across multiple engagements`,
  `   - Write about the pattern, not the people`,
  `   - Keep it relatable and observational`,
  `   - Sound like someone who's been there`,
  ``,
  `═══════════════════════════════════════════════════════════`,
  `STEP 2 — WRITE POST (Following Mode Guidelines):`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `Read full guide: ${GUIDE_FILE}`,
  ``,
];

// Add mode-specific guidance
if (mode === 1) {
  msg.push(`MODE ${mode}: Leads (ICP-aware)`);
  msg.push(`Write about: Struggles you noticed across multiple founders`);
  msg.push(`Example pattern: Multiple founders at $0 MRR with working products`);
  msg.push(``);
} else if (mode === 2) {
  msg.push(`MODE ${mode}: Authority (Strong Takes)`);
  msg.push(`Write about: What's broken, uncomfortable truths, common mistakes`);
  msg.push(`Example pattern: Landing pages full of features, no problem statement`);
  msg.push(``);
} else if (mode === 3) {
  msg.push(`MODE ${mode}: Build in Public (Messy Middle)`);
  msg.push(`Write about: Real observations from actual research`);
  msg.push(`Example pattern: 40+ landing pages reviewed, same mistakes repeated`);
  msg.push(``);
} else {
  msg.push(`MODE ${mode}: Think Out Loud (Personality)`);
  msg.push(`Write about: Observations about founder life, questions, doubts`);
  msg.push(`Example pattern: The isolation of building something nobody knows about`);
  msg.push(``);
}

// Inject learned rules
msg.push(`Recent learnings — apply these:`,
  `const fs = require('fs');`,
  `const learningsPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/content-learnings.json';`,
  `let learnings = [];`,
  `try { learnings = JSON.parse(fs.readFileSync(learningsPath, 'utf8')); } catch (e) {}`,
  `if (learnings.length > 0) {`,
  `  learnings.forEach(l => console.log('  • ' + l.rule));`,
  `  console.log('');`,
  `}`,
  ``,
  `Write your post (1-3 sentences).`,
  ``,
  `Save draft to: outreach/x/drafts/x-post-${today.replace(/-/g,'')}-draft.txt`,
  ``
);

msg.push(`═══════════════════════════════════════════════════════════`,
  `STEP 3 — HUMANIZE (INVOKE SKILL):`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `- Run: /humanizer [paste draft content]`,
  `- Wait for humanizer skill output`,
  `- Save humanized output to: outreach/x/drafts/x-post-${today.replace(/-/g,'')}-humanized.txt`,
  `- ⚠️ DO NOT proceed to Step 4 until humanized file exists`,
  ``,
  `POST STEP (Step 4 — immediately after humanize):`,
  `- Post content from outreach/x/drafts/x-post-${today.replace(/-/g,'')}-humanized.txt ONLY`,
  `- Do NOT post the original draft under any circumstances`,
  ``
);

// Read humanized content for preview
const humanizedFile = `outreach/x/drafts/x-post-${today.replace(/-/g, '')}-humanized.txt`;
let humanized = '';
let first100 = '';
try {
  humanized = fs.readFileSync(humanizedFile, 'utf8').trim();
  first100 = humanized.substring(0, 100).replace(/\n/g, ' ');
} catch (e) {
  first100 = '[file not found]';
}

msg.push(`═══════════════════════════════════════════════════════════`,
  `STEP 4 — SAVE TO APPROVAL QUEUE:`,
  `═══════════════════════════════════════════════════════════`,
  ``,
  `const fs = require('fs');`,
  `const queuePath = path.join('/Users/mantisclaw/.openclaw/workspace', 'outreach/x/approval-queue.json');`,
  ``,
  `// Read humanized content`,
  `const humanized = fs.readFileSync('outreach/x/drafts/x-post-${today.replace(/-/g,'')}-humanized.txt', 'utf8').trim();`,
  ``,
  `// Read queue or create new`,
  `let queue;`,
  `try {`,
  `  queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));`,
  `  if (!queue.entries) queue.entries = [];`,
  `} catch (e) {`,
  `  queue = { entries: [] };`,
  `}`,
  ``,
  `// Create entry (no parent for original posts)`,
  `const entry = {`,
  `  id: 'x-post-${today.replace(/-/g,'')}',`,
  `  platform: 'x',`,
  `  type: 'original_post',`,
  `  status: 'pending',`,
  `  content: humanized,`,
  `  mode: ${mode},`,
  `  modeName: '${MODE_NAMES[mode]}',`,
  `  draft_file: 'outreach/x/drafts/x-post-${today.replace(/-/g,'')}-humanized.txt',`,
  `  created_at: new Date().toISOString(),`,
  `  approved_at: null,`,
  `  posted_at: null`,
  `};`,
  ``,
  `// Append and save`,
  `queue.entries.push(entry);`,
  `fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));`,
  ``,
  `⏳ X original post queued for approval`,
  `Mode: ${mode} (${MODE_NAMES[mode]})`,
  `Content: "${first100}..."`,
  `Approve in dashboard → Content tab`,
  ``,
  `Update state (for tracking):`,
  `  const s = JSON.parse(fs.readFileSync('${STATE_FILE}', 'utf8'));`,
  `  s.lastMode = ${mode};`,
  `  s.lastPostDate = '${today}';`,
  `  fs.writeFileSync('${STATE_FILE}', JSON.stringify(s, null, 2));`,
  ``,
  `Cleanup:`,
  `  - Do NOT delete draft files — keep until after posting`,
  ``
);

const name = `x-post-${today.replace(/-/g, '')}`;
const at   = `${today}T${time}:00${getLAOffset()}`;

console.log(`\n📝 X original post for ${today}`);
console.log(`   Mode: ${mode} — ${MODE_NAMES[mode]}`);
console.log(`   Last mode: ${state.lastMode || 'none'}`);
console.log(`   Time: ${time}`);
console.log(`   Patterns noticed: ${foundThemes.length > 0 ? foundThemes.map(t => t.theme).join(', ') : 'none'}`);

const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', name,
  '--at',   at,
  '--system-event', msg.join('\n'),
  '--delete-after-run',
  '--tz', 'America/Los_Angeles',
  '--session', 'main'
], { encoding: 'utf8' });

if (result.status === 0) {
  console.log(`✓ Cron: ${name} at ${time} (mode ${mode})`);
} else {
  console.error(`✗ Failed: ${name}\n${result.stderr}`);
  process.exit(1);
}

console.log('\n✅ X original posts planner done.\n');
