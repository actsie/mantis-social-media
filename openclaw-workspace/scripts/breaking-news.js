#!/usr/bin/env node
/**
 * agentcard-breaking-news — runs every 30 min, 24/7
 * Fast sweep (~60s) for agentic payment breaking news.
 * 
 * Phase 1 MVP — Spawns agent session for research + drafting.
 * Does NOT implement: FR27, FR28, FR29 (Growth feedback loop features)
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ─────────────────────────────────────────────────────────────────

// P-1: Workspace root from env with fallback
const WORKSPACE = process.env.AGENTCARD_WORKSPACE || path.join(__dirname, '..');
const DRAFTS    = path.join(WORKSPACE, 'drafts.json');
const STATE     = path.join(WORKSPACE, 'breaking-news-state.json');
const SOUL      = path.join(WORKSPACE, 'SOUL.md');
const MEMORY_MD = path.join(WORKSPACE, 'MEMORY.md');

function today() {
  return new Date().toISOString().slice(0, 10);
}
const TODAY  = today();
const MEMORY = path.join(WORKSPACE, `memory/${TODAY}.md`);

// ─── HELPERS ────────────────────────────────────────────────────────────────

// P-6: Helper that always trims seenIds before writing
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
    if (!c.includes('## Breaking News')) c += '\n\n## Breaking News\n';
    fs.writeFileSync(MEMORY, c + text);
  } catch (e) {
    console.warn(`⚠️ Could not append to memory: ${e.message}`);
  }
}

// ─── STATE INITIALIZATION ──────────────────────────────────────────────────

const state = readJSON(STATE, { lastRun: null, seenIds: [], lastSignal: null });
const now   = new Date().toISOString();

// P-9: Removed orphaned readJSON(DRAFTS, []) call - file initialized in happy path

// ─── BUILD AGENT PROMPT ────────────────────────────────────────────────────

// P-2: Inject SOUL.md and MEMORY.md contents
const soulContent = readFileSafe(SOUL);
const memoryContent = readFileSafe(MEMORY_MD);

// P-3: Pass seenIds (last 100) to prevent duplicate drafts
const seenIdsList = state.seenIds.slice(-100).join(', ');

// P-4: Secondary search terms included + JSON output format
const prompt = `
AGENT CARD — BREAKING NEWS SWEEP

Run time: ${now}
Last run: ${state.lastRun || 'first run'}
Last signal: ${state.lastSignal || 'none'}

You are the Research Agent for Agent Card (agentic payments product).
This sweep must complete in under 60 seconds.

WORKSPACE: ${WORKSPACE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT FILES (INJECTED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SOUL.md (writing rules):**
${soulContent || '(no SOUL.md found)'}

**MEMORY.md (competitors + Tier 1 accounts):**
${memoryContent || '(no MEMORY.md found)'}

**Previously seen draft IDs (do not duplicate):**
${seenIdsList || '(none)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — TWITTER/X SWEEP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use web_search (not browser) for speed. Search these queries:
- "agentic payments"
- "agent payment" site:twitter.com OR site:x.com
- "AI agent checkout"

**Check these 5 accounts for new posts (last 30 min) using web_search:**
@stripe, @OpenAI, @Visa, @Mastercard, @brian_armstrong

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — NEWS SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use web_fetch on these only (headlines only, last 30 min):
- https://techcrunch.com/search/agentic+payments
- https://www.pymnts.com/category/artificial-intelligence/
- https://aibusiness.com/generative-ai/agentic-ai
- https://www.forbes.com/topics/agentic-ai/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — EVALUATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Breaking = TRUE if any:
a) Fortune 500 / Tier 1 announces agentic payments news
b) 100K+ follower account, 50+ likes in 2hrs, on-topic
c) Competitor (from MEMORY.md) ships/announces
d) Regulatory/legal AI+payments development
e) TechCrunch / Bloomberg / Information / PYMNTS / Fintech Magazine article

If NOTHING breaking: Reply with JSON: {"signal": false}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — IF BREAKING: DRAFT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Draft PolyMarket style (Mode 1 from SOUL.md):
- 1-3 sentences, fact first
- "BREAKING: [fact]." or "JUST IN: [fact]."
- Under 280 characters
- No hashtags, no opinion padding

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — OUTPUT FORMAT (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If breaking news found, output EXACTLY this JSON (no other text):
{"signal": true, "headline": "...", "draft_id": "...", "source_url": "...", "text": "..."}

If nothing breaking, output EXACTLY this JSON (no other text):
{"signal": false}

No other text after this line.
`.trim();

// ─── SPAWN AGENT SESSION ───────────────────────────────────────────────────

console.log('\n🔍 Spawning breaking news agent session...\n');

// P-5: Agent session params with 240s timeout
// Outer timeout 270000ms (4.5 min)
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
  timeout: 270000
});

// ─── PARSE AND VALIDATE OUTPUT ─────────────────────────────────────────────

const output = result.stdout || '';
const stderr = result.stderr || '';
const exitCode = result.status;
const signal = result.signal;

// P-6: Helper for consistent state saving
function handleErrorAndExit(reason) {
  console.log(`\n❌ ${reason}\n`);
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `❌ Breaking News Error\n\n${reason}`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  saveState(state);
  process.exit(1);
}

// P-5: Distinguish timeout / auth failure / binary not found / NO_SIGNAL
if (signal === 'SIGTERM' || exitCode === null) {
  handleErrorAndExit('Agent session timed out after 210 seconds');
}

// P-5: Lowercase stderr for case-insensitive auth check
const stderrLower = stderr.toLowerCase();
if (stderrLower.includes('authentication') || stderrLower.includes('auth') || stderrLower.includes('token') || stderrLower.includes('unauthorized')) {
  handleErrorAndExit(`Authentication failure: ${stderr.slice(0, 200)}`);
}

// P-5: Exit 127 = binary not found (separate from auth)
if (exitCode === 127) {
  handleErrorAndExit(`Binary not found (exit 127): ${stderr.slice(0, 200)}`);
}

if (exitCode !== 0) {
  console.log(`\n⚠️ Agent exited with code ${exitCode}\n`);
  console.log('Output:', output.slice(0, 500));
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `❌ Breaking News Error\n\nAgent exited with code ${exitCode}`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  saveState(state);
  process.exit(1);
}

// P-3: Parse JSON output (not pipe-delimited)
let parsed;
try {
  // P-3: Try to find JSON in output
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in output');
  }
  parsed = JSON.parse(jsonMatch[0]);
} catch (e) {
  console.log('\n❌ Malformed agent output — invalid JSON\n');
  console.log('Output:', output.slice(0, 500));
  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', 'channel:1485501016332828682', '--message', `❌ Breaking News Error\n\nMalformed agent output — invalid JSON`], { encoding: 'utf8', env: { ...process.env }, timeout: 10000 });
  saveState(state);
  process.exit(1);
}

// P-3: Check signal: true first, then signal: false
if (parsed.signal === false) {
  console.log('\n✅ No breaking news in this sweep.\n');
  state.lastRun = now;
  saveState(state);
  process.exit(0);
}

if (parsed.signal !== true) {
  console.log('\n❌ Malformed output — missing signal field\n');
  console.log('Output:', output.slice(0, 500));
  saveState(state);
  process.exit(1);
}

// ─── EXTRACT DRAFT DATA ────────────────────────────────────────────────────

const { headline, draft_id: draftId, source_url: sourceUrl, text: draftText } = parsed;

// P-8: Reject if no source URL
if (!sourceUrl || sourceUrl.trim() === '' || sourceUrl.trim() === 'N/A') {
  console.log('\n❌ Malformed output: missing source URL — draft rejected\n');
  saveState(state);
  process.exit(1);
}

console.log(`\n🚨 SIGNAL DETECTED: ${headline}\n`);

// ─── DEDUP CHECK (BEFORE WRITE) ────────────────────────────────────────────

// P-2: Check seenIds BEFORE writing draft
if (state.seenIds.includes(draftId)) {
  console.log(`\n⚠️ Draft ${draftId} already seen — skipping duplicate\n`);
  state.lastRun = now;
  saveState(state);
  process.exit(0);
}

// ─── WRITE DRAFT ───────────────────────────────────────────────────────────

// Fetch latest drafts.json from GitHub before writing to preserve approvals
const REPO_ROOT = path.join(WORKSPACE, '..');
spawnSync('git', ['-C', REPO_ROOT, 'fetch', 'origin', 'main'], { encoding: 'utf8' });
spawnSync('git', ['-C', REPO_ROOT, 'checkout', 'FETCH_HEAD', '--', 'openclaw-workspace/drafts.json'], { encoding: 'utf8' });

// Initialize drafts.json if missing (moved to here, after validation)
if (!fs.existsSync(DRAFTS)) {
  fs.mkdirSync(path.dirname(DRAFTS), { recursive: true });
  fs.writeFileSync(DRAFTS, '[]');
}

const drafts = readJSON(DRAFTS, []);

const draft = {
  id: draftId.trim(),
  platform: 'twitter',
  type: 'original',
  status: 'pending',
  urgency: 'breaking',
  text: draftText.trim(),
  context: `Breaking: ${headline} — ${sourceUrl.trim()}`,
  source_url: sourceUrl.trim(),
  created_at: now,
  reviewed_at: null,
  posted_at: null,
  account: 'brand'
};

drafts.push(draft);
fs.writeFileSync(DRAFTS, JSON.stringify(drafts, null, 2));

console.log(`  ✓ Draft written: ${draft.id}`);
console.log(`  ✓ Source URL: ${sourceUrl.trim()}`);

// ─── NOTIFY (DISCORD - socmed-alerts) ───────────────────────────────────────

console.log('  🔔 Sending Discord notification...');
const discordResult = spawnSync('openclaw', [
  'message', 'send',
  '--channel', 'discord',
  '--target', 'channel:1485501016332828682',
  '--message', `🚨 Breaking News Draft\n\n${draftText.trim()}\n\nSource: ${sourceUrl.trim()}\n\nID: ${draft.id}`
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

// P-14: Append to memory/YYYY-MM-DD.md
appendMemory(`- **${now}** — ${headline}
  - Draft ID: ${draftId}
  - Text: ${draftText.trim()}
  - Source: ${sourceUrl.trim()}
  - Status: pending review

`);

console.log('  ✓ Logged to memory file');

// ─── UPDATE STATE ──────────────────────────────────────────────────────────

state.lastRun = now;
state.lastSignal = now;

// P-2: Add to seenIds (dedup already checked above)
if (!state.seenIds.includes(draftId)) {
  state.seenIds.push(draftId);
}

// P-6: saveState() always trims to last 100
saveState(state);

console.log('\n✅ Sweep complete — 1 draft created\n');
console.log(`Draft ID: ${draftId}`);
console.log(`Headline: ${headline}`);
console.log(`Status: pending review\n`);

process.exit(0);
