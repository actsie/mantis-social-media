#!/usr/bin/env node
/**
 * agentcard-breaking-news — runs every 30 min, 24/7
 * Fast sweep (~60s) for agentic payment breaking news.
 * Drafts PolyMarket-style posts on signal, then exits silently.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/agentcard-social/openclaw-workspace';
const DRAFTS    = path.join(WORKSPACE, 'drafts.json');
const STATE     = path.join(WORKSPACE, 'breaking-news-state.json');

function today() {
  return new Date().toISOString().slice(0, 10);
}
const MEMORY = path.join(WORKSPACE, `memory/${today()}.md`);

// ─── helpers ────────────────────────────────────────────────────────────────

function readJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return def; }
}

function writeJSON(p, d) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
}

function appendMemory(text) {
  try {
    fs.mkdirSync(path.dirname(MEMORY), { recursive: true });
    let c = fs.existsSync(MEMORY) ? fs.readFileSync(MEMORY, 'utf8') : '';
    if (!c.includes('## Breaking News')) c += '\n\n## Breaking News\n';
    fs.writeFileSync(MEMORY, c + text);
  } catch { /* non-fatal */ }
}

function gitPush(msg) {
  const base = '/Users/mantisclaw/agentcard-social';
  spawnSync('git', ['-C', base, 'add', '-A'], { encoding: 'utf8' });
  spawnSync('git', ['-C', base, 'commit', '-m', msg], { encoding: 'utf8' });
  spawnSync('git', ['-C', base, 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
  spawnSync('git', ['-C', base, 'push', 'origin', 'main'], { encoding: 'utf8' });
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

function draftId(label) {
  return `${today().replace(/-/g,'')}-breaking-${slugify(label)}-${Date.now().toString(36)}`;
}

// ─── main prompt ─────────────────────────────────────────────────────────────

const state = readJSON(STATE, { lastRun: null, seenIds: [] });
const now   = new Date().toISOString();

const prompt = `
AGENT CARD — BREAKING NEWS SWEEP

Run time: ${now}
Last run: ${state.lastRun || 'first run'}

You are the Research Agent for Agent Card (agentic payments product).
This sweep must complete in under 60 seconds of context.

WORKSPACE: /Users/mantisclaw/agentcard-social/openclaw-workspace
SOUL: read SOUL.md for voice guidance
MEMORY: read MEMORY.md for competitor list and Tier 1 accounts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — TWITTER SWEEP (fast)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use browser (profile="openclaw") to search these on x.com/search?f=live:
- "agentic payments"
- "agent payment"  
- "AI agent checkout"
- "machine payments"

Filter: only posts from the last 30 minutes.
Also check latest post from: @brian_armstrong, @stripe, @OpenAI, @Google, @Visa, @Mastercard, @coinbase, @arcanexis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — NEWS SCAN (fast)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use web_fetch to check each of these for articles published in the last 30 minutes.
Look for: agentic payments, agent payment, AI agent checkout, AI checkout, machine payments, agent credit card.

Direct sources (fetch headlines only — don't read full articles):
- https://aibusiness.com/generative-ai/agentic-ai
- https://www.forbes.com/topics/agentic-ai/
- https://techcrunch.com/search/agentic+payments
- https://techcrunch.com/search/agent+payment
- https://www.theverge.com/search?q=agentic+payments
- https://www.theverge.com/search?q=agent+payment
- https://www.bloomberg.com/technology (scan headlines only)
- https://www.theinformation.com (scan headlines only — may be paywalled, note title only)

For each: note any article headline that matches the topic. Check the timestamp — only flag if published in the last 30 minutes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — EVALUATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Breaking = TRUE if any of:
a) Major company (Fortune 500 or Tier 1 account) announces something new in agentic payments
b) 100K+ account post gaining 50+ likes within 2 hours on agentic payments topic
c) Competitor from MEMORY.md ships or announces something new
d) Regulatory/legal development touching AI + payments
e) New article from TechCrunch / Bloomberg / The Information on this topic

If NOTHING breaking: reply "NO_SIGNAL" and stop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — IF BREAKING: DRAFT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Draft 1 — PolyMarket style (see SOUL.md):
- 1-3 sentences, fact first, no opinion padding, no hashtags
- Format: "BREAKING: [fact]." or "JUST IN: [fact]."
- Under 280 characters

Draft 2 (if story warrants depth) — Ole Lehmann style:
- Translation opener, human analogy, insight, verdict
- Long-form single post, lowercase, conversational

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE DRAFTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write to ${DRAFTS}. Append to existing array. Format:

{
  "id": "[YYYYMMDD]-breaking-[slug]-[timestamp]",
  "platform": "twitter",
  "type": "original",
  "status": "pending",
  "urgency": "breaking",
  "text": "[draft text]",
  "context": "[one sentence: why this is breaking + source URL]",
  "source_url": "[article or tweet URL]",
  "created_at": "[ISO timestamp]",
  "reviewed_at": null,
  "posted_at": null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — NOTIFY + LOG + PUSH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After writing each draft to drafts.json, immediately run:
  DISCORD_WEBHOOK_AGENTCARD="$DISCORD_WEBHOOK_AGENTCARD" SLACK_WEBHOOK_AGENTCARD="" node /Users/mantisclaw/agentcard-social/openclaw-workspace/scripts/notify-draft.js [draft-id]

Append to ${MEMORY} under ## Breaking News:
- Timestamp, headline, source URL, why it qualifies

Then run:
  cd /Users/mantisclaw/agentcard-social
  git add -A
  git commit -m "Breaking: [short description]"
  git pull --rebase origin main
  git push origin main

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

End your response with EXACTLY one of:
- "SIGNAL: [headline in 10 words]" — if breaking news found and drafted
- "NO_SIGNAL" — if nothing qualifies

No other text after this line.
`.trim();

// Write prompt to a temp file so we can fire it as a cron
const runId = `agentcard-breaking-${Date.now()}`;

const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', runId,
  '--system-event', prompt,
  '--delete-after-run',
  '--session', 'main',
  '--at', new Date(Date.now() + 5000).toISOString(),
], { encoding: 'utf8' });

if (result.status !== 0) {
  console.error('Failed to queue sweep:', result.stderr);
  process.exit(1);
}

// Update state
state.lastRun = now;
writeJSON(STATE, state);

console.log(`[agentcard-breaking-news] ${now} — sweep queued (${runId})`);
