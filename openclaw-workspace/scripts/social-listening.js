#!/usr/bin/env node
/**
 * agentcard-social-listening — runs once daily at 8am
 * Multi-source pain point sweep for agentic payment conversations.
 * Finds HOT/WARM conversations, writes reply drafts to drafts.json for human approval.
 * 
 * Companion to breaking-news.js — not a replacement.
 * breaking-news.js = fast breaking news (every 30 min)
 * social-listening.js = deep pain point research (daily, 5 sources)
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const WORKSPACE = process.env.AGENTCARD_WORKSPACE || path.join(__dirname, '..');
const DRAFTS    = path.join(WORKSPACE, 'drafts.json');
const STATE     = path.join(WORKSPACE, 'social-listening-state.json');
const SOUL      = path.join(WORKSPACE, 'SOUL.md');
const MEMORY_MD = path.join(WORKSPACE, 'MEMORY.md');

function today() {
  return new Date().toISOString().slice(0, 10);
}
const TODAY  = today();
const MEMORY = path.join(WORKSPACE, `memory/${TODAY}.md`);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function saveState(state) {
  state.seenIds = state.seenIds.slice(-100);
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

function readJSON(p, def) {
  try {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(def, null, 2));
      return def;
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`⚠️ Could not read ${p}: ${e.message}`);
    return def;
  }
}

function readFileSafe(p, fallback = '') {
  try {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').slice(0, 5000) : fallback;
  } catch {
    return fallback;
  }
}

function appendMemory(text) {
  try {
    fs.mkdirSync(path.dirname(MEMORY), { recursive: true });
    let c = fs.existsSync(MEMORY) ? fs.readFileSync(MEMORY, 'utf8') : '';
    if (!c.includes('## Social Listening')) c += '\n\n## Social Listening\n';
    fs.writeFileSync(MEMORY, c + text);
  } catch (e) {
    console.warn(`⚠️ Could not append to memory: ${e.message}`);
  }
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

// ─── STATE INITIALIZATION ──────────────────────────────────────────────────

const state = readJSON(STATE, { lastRun: null, seenIds: [], lastSignal: null, totalFound: 0 });
const now   = new Date().toISOString();

// ─── BUILD AGENT PROMPT ────────────────────────────────────────────────────

const soulContent = readFileSafe(SOUL);
const memoryContent = readFileSafe(MEMORY_MD);
const seenUrlsList = state.seenIds.slice(-100).join('\n');

const prompt = `
AGENT CARD — SOCIAL LISTENING SWEEP

Run time: ${now}
Last run: ${state.lastRun || 'first run'}

You are the Research Agent for Agent Card (agentic payments product).
This sweep must complete within 180 seconds.

WORKSPACE: ${WORKSPACE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT FILES (INJECTED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SOUL.md (writing rules):**
${soulContent || '(no SOUL.md found)'}

**MEMORY.md (competitors + Tier 1 accounts):**
${memoryContent || '(no MEMORY.md found)'}

**Previously seen conversation URLs (do not duplicate):**
${seenUrlsList || '(none)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: TIME MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you are running low on time before the 180s timeout, return whatever you have
found so far in the correct JSON format. Do not wait to finish all sources.
An incomplete but valid JSON result is better than no output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GOOGLE BROWSER SEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use browser (profile="openclaw") to run these Google searches.
Add date filter: after:2026-01-01

Search queries:
- "agent spending" OR "agent spent" OR "no spending limits" agentic payments
- "agent can't pay" OR "autonomous checkout" OR "machine payment" AI agent
- "how does my agent pay" OR "give agent money" OR "agent wallet"
- "AI agent billing" OR "agent transaction" OR "agent budget" developer
- "trust agent with money" OR "unauthorized purchase" AI agent
- "x402" OR "machine payments protocol" OR "agentic payments" developer complaint

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — REDDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search these subreddits for pain point keywords, posts from last 72 hours:
r/LLMDevs, r/LocalLLaMA, r/SaaS, r/MachineLearning, r/singularity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — HACKER NEWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fetch these URLs:
- https://hn.algolia.com/api/v1/search?query=agentic+payments&dateRange=last_7days
- https://hn.algolia.com/api/v1/search?query=agent+spending+controls&dateRange=last_7days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — TWITTER/X
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use browser (profile="openclaw") to search x.com/search?f=live:
- "agent payment" OR "agentic checkout" lang:en -is:retweet
- "AI agent" spending OR payment problem OR issue lang:en -is:retweet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — GITHUB DISCUSSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fetch: https://github.com/search?q=agentic+payments&type=discussions&s=created&o=desc

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — EVALUATE AND TIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each conversation found, assign a tier:
- HOT: posted < 2 hours ago AND mentions a specific pain point AND has replies/engagement
- WARM: posted < 72 hours ago AND relevant to agentic payment friction
- COLD: older than 72 hours OR vague/tangential — DO NOT include in output

Skip any URL already in the seenIds list above.

Pain categories (use exact strings):
- spend_controls — agent spending, no limits, unexpected charges
- checkout_friction — agent can't pay, payment failed, autonomous checkout blocked
- infrastructure — how does my agent pay, agent wallet, agent needs a card
- builder_questions — agent expense, AI agent billing, agent budget
- trust_safety — trust agent with money, unauthorized purchase, AI spending controls
- protocol_space — x402, machine payments protocol, agentic payments

Account assignment:
- trust_safety OR infrastructure → account: "personal"
- all others → account: "brand"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — DRAFT REPLIES (HOT + WARM only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each HOT and WARM conversation, write a reply draft:
- Under 280 characters (hard limit — count carefully)
- No promotional language, no "check out Agent Card"
- Add genuine value: answer the question, validate the pain, share a relevant insight
- Brand account: use SOUL.md Mode 3 tone
- Personal account: founder voice, no brand references

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — OUTPUT FORMAT (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If conversations found, output EXACTLY this JSON (no other text):
{"signal": true, "conversations": [{"tier": "HOT", "platform": "reddit", "url": "https://...", "title": "...", "pain_category": "spend_controls", "age_hours": 1.5, "reply_draft": "...", "account": "brand"}]}

If nothing relevant found, output EXACTLY this JSON (no other text):
{"signal": false}

No other text after this line.
`.trim();

// ─── SPAWN AGENT SESSION ───────────────────────────────────────────────────

console.log('\n🔍 Spawning social listening agent session...\n');

// Outer timeout: 270000 (4.5 min — 5-source sweep takes longer)
// Agent --timeout: 240 (4 min for deep research)
const result = spawnSync('openclaw', [
  'agent',
  '--session-id', 'main',
  '--message', prompt,
  '--thinking', 'minimal',
  '--timeout', '240'
], {
  encoding: 'utf8',
  env: { ...process.env },
  cwd: WORKSPACE,
  timeout: 300000
});

// ─── PARSE AND VALIDATE OUTPUT ─────────────────────────────────────────────

const output = result.stdout || '';
const stderr = result.stderr || '';
const exitCode = result.status;
const signal = result.signal;

function handleErrorAndExit(reason) {
  console.log(`\n❌ ${reason}\n`);
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `❌ Social Listening Error\n\n${reason}`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  saveState(state);
  process.exit(1);
}

// 1. Timeout (SIGTERM or exitCode null)
if (signal === 'SIGTERM' || exitCode === null) {
  handleErrorAndExit('Agent session timed out after 270 seconds');
}

// 2. Auth failure (stderr lowercase check)
const stderrLower = stderr.toLowerCase();
if (stderrLower.includes('authentication') || stderrLower.includes('auth') || stderrLower.includes('token') || stderrLower.includes('unauthorized')) {
  handleErrorAndExit(`Authentication failure: ${stderr.slice(0, 200)}`);
}

// 3. Exit 127
if (exitCode === 127) {
  handleErrorAndExit(`Binary not found (exit 127): ${stderr.slice(0, 200)}`);
}

// 4. exitCode !== 0
if (exitCode !== 0) {
  console.log(`\n⚠️ Agent exited with code ${exitCode}\n`);
  console.log('Output:', output.slice(0, 500));
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `❌ Social Listening Error\n\nAgent exited with code ${exitCode}`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  saveState(state);
  process.exit(1);
}

// 5. No JSON in output
let parsed;
try {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in output');
  }
  parsed = JSON.parse(jsonMatch[0]);
} catch (e) {
  console.log('\n❌ Malformed agent output — invalid JSON\n');
  console.log('Output:', output.slice(0, 500));
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `❌ Social Listening Error\n\nMalformed agent output — invalid JSON`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  saveState(state);
  process.exit(1);
}

// 6. signal === false
if (parsed.signal === false) {
  console.log('\n✅ No signals found in this sweep.\n');
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `🔍 Social Listening Sweep\n\nNo signals found.`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  state.lastRun = now;
  saveState(state);
  process.exit(0);
}

// 7. signal !== true
if (parsed.signal !== true) {
  console.log('\n❌ Malformed output — missing signal field\n');
  console.log('Output:', output.slice(0, 500));
  saveState(state);
  process.exit(1);
}

// 8. conversations missing or not an array → treat as signal: false
if (!parsed.conversations || !Array.isArray(parsed.conversations)) {
  console.log('\n⚠️ Malformed output — conversations missing or not an array\n');
  state.lastRun = now;
  saveState(state);
  process.exit(0);
}

// 9. conversations.length === 0
if (parsed.conversations.length === 0) {
  console.log('\n✅ No results in conversations array\n');
  state.lastRun = now;
  saveState(state);
  process.exit(0);
}

// ─── PROCESS CONVERSATIONS ─────────────────────────────────────────────────

const conversations = parsed.conversations;
console.log(`\n🚨 SIGNAL DETECTED: ${conversations.length} conversations found\n`);

// Initialize drafts.json if missing
if (!fs.existsSync(DRAFTS)) {
  fs.mkdirSync(path.dirname(DRAFTS), { recursive: true });
  fs.writeFileSync(DRAFTS, '[]');
}

const drafts = readJSON(DRAFTS, []);

let hotCount = 0;
let warmCount = 0;
let coldCount = 0;
const newDrafts = [];

for (const conv of conversations) {
  // Skip seenIds (URL-based)
  if (state.seenIds.includes(conv.url)) {
    console.log(`  ⚠️ Already seen: ${conv.url} — skipping`);
    continue;
  }

  // Skip COLD
  if (conv.tier === 'COLD') {
    coldCount++;
    continue;
  }

  // Track tier counts
  if (conv.tier === 'HOT') hotCount++;
  else if (conv.tier === 'WARM') warmCount++;

  // Validate account field
  const account = ['brand', 'personal'].includes(conv.account) ? conv.account : 'brand';

  // Truncate reply_draft to 280 chars at word boundary
  let draftText = (conv.reply_draft || '').trim();
  if (draftText.length > 280) {
    draftText = draftText.slice(0, 279).replace(/\s+\S*$/, '') + '…';
  }

  // Generate draft ID script-side
  const slug = slugify(conv.title || 'untitled');
  const draftId = `${TODAY}-listening-${conv.platform}-${slug}`;

  const draft = {
    id: draftId,
    platform: conv.platform,
    type: 'reply',
    status: 'pending',
    urgency: conv.tier === 'HOT' ? 'breaking' : 'standard',
    text: draftText,
    context: `Pain category: ${conv.pain_category || 'general'}. Found via social listening.`,
    source_post_url: conv.url,
    created_at: now,
    reviewed_at: null,
    posted_at: null,
    account: account
  };

  drafts.push(draft);
  newDrafts.push({ tier: conv.tier, platform: conv.platform, pain_category: conv.pain_category });
  state.seenIds.push(conv.url); // store URL for dedup

  console.log(`  ✓ Draft written: ${draftId} (${conv.tier}, ${conv.platform}, ${conv.pain_category})`);
}

fs.writeFileSync(DRAFTS, JSON.stringify(drafts, null, 2));

console.log(`\n  Total: ${hotCount} HOT, ${warmCount} WARM, ${coldCount} COLD`);
console.log(`  New drafts: ${newDrafts.length}\n`);

// ─── NOTIFY (DISCORD - socmed-alerts) ────────────────────────────────────

console.log('  🔔 Sending Discord notification...');

const discordLines = [
  '🔍 Social Listening Sweep',
  '',
  `HOT: ${hotCount}  WARM: ${warmCount}  COLD: ${coldCount}`,
  newDrafts.length > 0 ? `${newDrafts.length} reply drafts written` : 'No signals found',
];

if (newDrafts.length > 0) {
  discordLines.push('');
  newDrafts.forEach(d => {
    discordLines.push(`${d.tier} — ${d.platform} — ${d.pain_category}`);
  });
}

const discordResult = spawnSync('openclaw', [
  'message', 'send',
  '--channel', 'discord',
  '--target', 'channel:1485501016332828682',
  '--message', discordLines.join('\n')
], {
  encoding: 'utf8',
  env: { ...process.env },
  timeout: 10000
});

if (discordResult.status === 0 && !discordResult.error) {
  console.log('  ✓ Discord notification sent');
} else {
  const errorMsg = discordResult.error?.message || discordResult.stderr?.slice(0, 100) || 'unknown error';
  console.warn(`  ⚠ Discord notification failed: ${errorMsg}`);
}

// ─── LOG TO MEMORY ────────────────────────────────────────────────────────

if (hotCount + warmCount > 0) {
  const memoryLines = [
    `- **${now}** — ${hotCount} HOT, ${warmCount} WARM found`,
  ];
  newDrafts.forEach(d => {
    memoryLines.push(`  - ${d.platform}: ${d.pain_category} (${d.tier})`);
  });
  memoryLines.push('');

  appendMemory(memoryLines.join('\n'));
  console.log('  ✓ Logged to memory file');
}

// ─── UPDATE STATE ──────────────────────────────────────────────────────────

state.lastRun = now;
if (hotCount + warmCount > 0) state.lastSignal = now;
state.totalFound = (state.totalFound || 0) + hotCount + warmCount;

saveState(state);

console.log('\n✅ Sweep complete\n');
console.log(`Total signals found (all time): ${state.totalFound}\n`);

process.exit(0);
