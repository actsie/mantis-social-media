#!/usr/bin/env node
/**
 * agentcard-longform — runs daily at 7am PST
 * Runs the content research loop, finds the strongest agentic payments angle,
 * drafts one Ole Lehmann style post, writes to drafts.json, notifies Discord.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE      = '/Users/mantisclaw/agentcard-social';
const WORKSPACE = path.join(BASE, 'openclaw-workspace');
const DRAFTS    = path.join(WORKSPACE, 'drafts.json');

function today() {
  return new Date().toISOString().slice(0, 10);
}
const TODAY    = today();
const MEMORY   = path.join(WORKSPACE, `memory/${TODAY}.md`);
const AGENTS   = path.join(WORKSPACE, 'AGENTS.md');
const SOUL     = path.join(WORKSPACE, 'SOUL.md');

function gitPush(msg) {
  const opts = { encoding: 'utf8', cwd: BASE };
  spawnSync('git', ['add', '-A'], opts);
  spawnSync('git', ['commit', '-m', msg], opts);
  spawnSync('git', ['pull', '--rebase', 'origin', 'main'], opts);
  spawnSync('git', ['push', 'origin', 'main'], opts);
}

// Build the full longform research + drafting prompt
const memoryContent = fs.existsSync(MEMORY) ? fs.readFileSync(MEMORY, 'utf8').slice(0, 3000) : '(no memory file yet today)';

const prompt = `
AGENT CARD — DAILY LONG-FORM DRAFT

Date: ${TODAY}
WORKSPACE: ${WORKSPACE}

You are the Content Agent for Agent Card (agentic payments product).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read SOUL.md in full — all writing rules, banned words, Mode 2 structure, and account restrictions apply.
Read AGENTS.md — content research loop (Steps 1-4) is mandatory before drafting.

Today's memory so far:
${memoryContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — STAT DUMP SEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search (via web_fetch or browser): 
- "agentic payments" statistics ${new Date().getFullYear()} market size data
- AI agent commerce market size ${new Date().getFullYear()}

Look for aggregator pages (Nevermined, Mordor Intelligence, Wipro, CB Insights, Statista) that have compiled multiple stats.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — FETCH AGGREGATOR PAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use web_fetch on the most promising aggregator pages. Extract every specific number with its source. Never use vague figures.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SEARCH FOR SPECIFIC RECENT EVENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search for the most recent "first ever" or milestone moment in agentic payments:
- "first AI agent payment" ${new Date().getFullYear()}
- [Company] agentic payments announcement this week
- major bank OR fintech AI agent checkout

Also check today's memory file for breaking news logged there.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CROSS-CHECK DRAMATIC STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Any stat that looks too large (e.g. 4700% growth): verify in two independent sources before using. If can't verify, don't use it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — FIND THE STRONGEST ANGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From everything found, identify the single most compelling angle:
- A specific number that frames the scale of the opportunity
- A "first ever" moment from a major institution
- A counterintuitive fact that makes people think differently about agentic payments

This angle becomes the hook for the long-form post.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — DRAFT THE POST (Mode 2 — Ole Lehmann style)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write one long-form post following ALL Mode 2 rules from SOUL.md:
- Hook: "i can't believe nobody caught this" / "translation: [what this means]" / "hot take:"
- Specific numbers everywhere — exact figures, exact sources
- Short lines, line breaks between paragraphs
- No em dashes, no banned words, no triads, no contrastive parallelism
- Close on a verdict — never a CTA
- Account: brand (Mode 2 brand restriction: no competitor analysis, no "here's the gap we fill")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — WRITE TO drafts.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Append to ${DRAFTS}:
{
  "id": "${TODAY.replace(/-/g,'')}-longform",
  "account": "brand",
  "platform": "twitter",
  "type": "original",
  "status": "pending",
  "urgency": "standard",
  "text": "[your drafted post]",
  "context": "[one sentence: the stat or event that anchors this post + source URL]",
  "source_url": "[primary source URL]",
  "created_at": "${new Date().toISOString()}",
  "reviewed_at": null,
  "posted_at": null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — NOTIFY + PUSH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After writing the draft, run:
  DISCORD_WEBHOOK_AGENTCARD="${process.env.DISCORD_WEBHOOK_AGENTCARD || ''}" SLACK_WEBHOOK_AGENTCARD="" node ${WORKSPACE}/scripts/notify-draft.js ${TODAY.replace(/-/g,'')+'-longform'}

Then:
  cd ${BASE}
  git add -A
  git commit -m "Daily longform draft: ${TODAY}"
  git pull --rebase origin main
  git push origin main

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

End with exactly:
"DRAFT: [first 15 words of the post]"
`.trim();

// Pull first
const pull = spawnSync('git', ['-C', BASE, 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
if (pull.status !== 0 && !pull.stdout?.includes('Already up to date')) {
  console.warn('Pull failed:', pull.stderr?.trim());
}

// Queue the research + draft session
const runId = `agentcard-longform-${Date.now()}`;
const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', runId,
  '--system-event', prompt,
  '--delete-after-run',
  '--session', 'main',
  '--at', new Date(Date.now() + 5000).toISOString(),
], { encoding: 'utf8' });

if (result.status !== 0) {
  console.error('Failed to queue longform session:', result.stderr);
  process.exit(1);
}

console.log(`[agentcard-longform] ${new Date().toISOString()} — research + draft session queued (${runId})`);
