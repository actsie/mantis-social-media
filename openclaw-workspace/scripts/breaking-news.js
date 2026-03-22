#!/usr/bin/env node
/**
 * agentcard-breaking-news — runs every 30 min, 24/7
 * Fast sweep (~60s) for agentic payment breaking news.
 * 
 * Spawns a ONE-SHOT agent session to do the actual work.
 * Key fix: session runs once and exits, does NOT create new crons.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/agentcard-social/openclaw-workspace';
const STATE     = path.join(WORKSPACE, 'breaking-news-state.json');

function readJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return def; }
}

function writeJSON(p, d) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
}

const state = readJSON(STATE, { lastRun: null, seenIds: [], lastSignal: null });
const now   = new Date().toISOString();

// Build the agent prompt that does the actual work
const prompt = `
AGENT CARD — BREAKING NEWS SWEEP

Run time: ${now}
Last run: ${state.lastRun || 'first run'}
Last signal: ${state.lastSignal || 'none'}

You are the Research Agent for Agent Card (agentic payments product).
This sweep must complete in under 60 seconds.

WORKSPACE: /Users/mantisclaw/agentcard-social/openclaw-workspace
Read SOUL.md for writing rules (Mode 1 PolyMarket style).
Read MEMORY.md for competitor list and Tier 1 accounts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — TWITTER/X SWEEP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use browser (profile="openclaw") to search x.com/search?f=live:

**Primary queries:**
- "agentic payments"
- "agent payment"
- "AI agent checkout"
- "machine payments"

**Check these accounts for new posts:**
@brian_armstrong, @stripe, @OpenAI, @Google, @Visa, @Mastercard, @coinbase, @arcanexis

Filter: Posts from last 30 minutes only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — NEWS SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use web_fetch on these (headlines only, check timestamps):
- https://techcrunch.com/search/agentic+payments
- https://techcrunch.com/search/agent+payment
- https://aibusiness.com/generative-ai/agentic-ai
- https://www.forbes.com/topics/agentic-ai/

Only flag articles published in last 30 minutes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — EVALUATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Breaking = TRUE if any:
a) Fortune 500 / Tier 1 announces agentic payments news
b) 100K+ follower account, 50+ likes in 2hrs, on-topic
c) Competitor (from MEMORY.md) ships/announces
d) Regulatory/legal AI+payments development
e) TechCrunch / Bloomberg / Information article

If NOTHING breaking: Reply "NO_SIGNAL" and stop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — IF BREAKING: DRAFT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Draft PolyMarket style (Mode 1 from SOUL.md):
- 1-3 sentences, fact first
- "BREAKING: [fact]." or "JUST IN: [fact]."
- Under 280 characters
- No hashtags, no opinion padding

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TO drafts.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Append to /Users/mantisclaw/agentcard-social/openclaw-workspace/drafts.json:

{
  "id": "${now.slice(0,10).replace(/-/g,'')}-breaking-${Date.now().toString(36)}",
  "platform": "twitter",
  "type": "original",
  "status": "pending",
  "urgency": "breaking",
  "text": "[your draft]",
  "context": "[why breaking + source URL]",
  "source_url": "[URL]",
  "created_at": "${now}",
  "reviewed_at": null,
  "posted_at": null,
  "account": "brand"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — NOTIFY + LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run: node /Users/mantisclaw/agentcard-social/openclaw-workspace/scripts/notify-draft.js [draft-id]

Append to memory/${now.slice(0,10)}.md under ## Breaking News:
- Timestamp, headline, source URL, why it qualifies

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

End with EXACTLY:
- "SIGNAL: [headline in 10 words]" — if breaking found
- "NO_SIGNAL" — if nothing qualifies

No other text after this line.
`.trim();

// Spawn a ONE-SHOT agent session (not a cron!)
console.log('\n🔍 Spawning breaking news agent session...\n');

const result = spawnSync('openclaw', [
  'agent',
  '--session-id', 'main',
  '--message', prompt,
  '--timeout', '90',  // 90 second timeout
  '--thinking', 'minimal'
], {
  encoding: 'utf8',
  env: { ...process.env },
  cwd: WORKSPACE,
  timeout: 120000  // 2 min hard timeout
});

// Parse the result
const output = result.stdout || '';
const exitCode = result.status;

// Check for signal
const hasSignal = output.includes('SIGNAL:');
const noSignal = output.includes('NO_SIGNAL');

// Update state
state.lastRun = now;
if (hasSignal) {
  state.lastSignal = now;
  console.log(`\n✅ Breaking news found! Draft created.\n`);
} else if (noSignal) {
  console.log(`\n✅ No breaking news in this sweep.\n`);
} else {
  console.log(`\n⚠️ Sweep completed with unknown status (exit: ${exitCode})\n`);
}

writeJSON(STATE, state);

// Exit with appropriate code
process.exit(hasSignal || noSignal ? 0 : 1);
