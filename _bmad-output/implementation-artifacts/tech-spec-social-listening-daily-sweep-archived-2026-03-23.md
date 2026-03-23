---
title: 'social-listening.js — Daily Multi-Source Pain Point Sweep'
slug: 'social-listening-daily-sweep'
created: '2026-03-23'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack: ['Node.js', 'openclaw CLI', 'spawnSync']
files_to_modify: []
code_patterns: ['breaking-news.js patterns', 'saveState helper', 'readJSON/writeJSON', 'openclaw agent one-shot']
test_patterns: []
---

# Tech-Spec: social-listening.js — Daily Multi-Source Pain Point Sweep

**Created:** 2026-03-23

## Overview

### Problem Statement

Agent Card has no systematic way to find builders actively discussing agentic payment pain points across the internet. The account is reactive — it posts original content and breaking news but misses the conversations happening right now on Reddit, HN, GitHub, and Twitter where builders are asking "how does my agent pay for things?" or complaining "my agent spent $400 with no controls." These are the highest-value reply opportunities and they expire within hours.

### Solution

A Node.js cron script (`social-listening.js`) that runs once daily at 8am. It spawns a one-shot openclaw agent session that sweeps multiple internet sources for conversations about agentic payment friction, tiers results HOT/WARM/COLD by recency and specificity, then writes reply drafts to `drafts.json` for human approval. Follows the same architecture as `breaking-news.js`.

### Scope

**In Scope:**
- New script: `openclaw-workspace/scripts/social-listening.js`
- New state file: `openclaw-workspace/social-listening-state.json`
- Sources: Google/Bing browser search (date-filtered), Reddit (5 subs), Hacker News (algolia API), Twitter/X conversations, GitHub Discussions
- 6 pain keyword categories: spend controls, checkout friction, infrastructure, builder questions, trust/safety, protocol/space
- HOT/WARM/COLD tiering with draft output to `drafts.json`
- Daily Telegram summary
- Memory log append under `## Social Listening`
- Cron registration: daily at 8am

**Out of Scope:**
- Auto-posting replies (human approval required)
- LinkedIn monitoring (too hard to scrape reliably)
- Discord monitoring (requires bot membership)
- DM/outreach flow (different system)
- Deduplication across breaking-news.js seenIds (separate state files)

## Context for Development

### Codebase Patterns

All patterns must match `breaking-news.js` exactly, with the following adjustments for this script:

```javascript
// Workspace resolution
const WORKSPACE = process.env.AGENTCARD_WORKSPACE || path.join(__dirname, '..');

// State helper — always trims seenIds to 100 before writing
function saveState(state) {
  state.seenIds = state.seenIds.slice(-100);
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

// Agent spawn — outer timeout 270s (4.5 min) to cover 5-source sweep
spawnSync('openclaw', [
  'agent', '--session-id', 'main',
  '--message', prompt,
  '--thinking', 'minimal',
  '--timeout', '180'
], { encoding: 'utf8', env: { ...process.env }, cwd: WORKSPACE, timeout: 270000 });

// Error handling — all 4 paths write state before exit
// SIGTERM / exitCode null → timeout
// stderr lowercase includes 'auth'/'unauthorized'/'token' → auth_failure
// exitCode 127 → binary_not_found
// exitCode !== 0 → agent_error

// Agent output — JSON format
// Found: {"signal": true, "conversations": [...]}
// Nothing: {"signal": false}

// Notification — Telegram via openclaw
spawnSync('openclaw', ['message', 'send', '--channel', 'telegram',
  '--to', '6241290513', '--message', '...'], { timeout: 10000 });
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `openclaw-workspace/scripts/breaking-news.js` | Canonical architecture to follow exactly |
| `openclaw-workspace/drafts.json` | Output target — append reply drafts here |
| `openclaw-workspace/SOUL.md` | Inject into agent prompt (writing rules, account types) |
| `openclaw-workspace/MEMORY.md` | Inject into agent prompt (competitors, Tier 1 accounts) |
| `openclaw-workspace/social-listening-state.json` | New state file to create |

### Technical Decisions

**Output format from agent:**
```json
{
  "signal": true,
  "conversations": [
    {
      "tier": "HOT",
      "platform": "reddit",
      "url": "https://...",
      "title": "...",
      "pain_category": "spend_controls",
      "age_hours": 1.5,
      "reply_draft": "...",
      "account": "brand"
    }
  ]
}
```
Or: `{"signal": false}`

**Draft schema written to drafts.json:**
```json
{
  "id": "YYYYMMDD-listening-[platform]-[slug]",
  "platform": "twitter|reddit",
  "type": "reply",
  "status": "pending",
  "urgency": "breaking|standard",
  "text": "...",
  "context": "Pain category: [X]. Found via social listening.",
  "source_post_url": "https://...",
  "created_at": "ISO timestamp",
  "reviewed_at": null,
  "posted_at": null,
  "account": "brand|personal"
}
```

**Tiering rules:**
- HOT: age < 2 hours AND specific pain point AND active thread → urgency: "breaking", draft written immediately
- WARM: age < 72 hours AND relevant → urgency: "standard", draft written in same run (not deferred)
- COLD: age > 72 hours OR vague → log only, no draft

**Account assignment:**
- `trust/safety` and `infrastructure` pain types → `personal` (founder voice works better)
- all others → `brand`
- **Script validates** `account` field is one of `["brand", "personal"]`. If missing or invalid, defaults to `"brand"`.

**Deduplication:**
- `seenIds` stores **URLs** (not generated draft IDs) — prevents the same conversation being drafted twice even if the agent generates a different ID on separate runs
- Script checks `state.seenIds.includes(conv.url)` before writing each draft
- After writing, push `conv.url` to `state.seenIds`

**Draft ID generation (script-side, not agent-side):**
- Script generates the ID: `${TODAY}-listening-${conv.platform}-${slugify(conv.title)}`
- `slugify` = title lowercased, spaces replaced with hyphens, non-alphanumeric stripped, truncated to 40 chars
- This prevents dedup from depending on agent ID consistency

**Reply draft character limit:**
- Agent prompt instructs: reply drafts must be under 280 chars
- Script validates each `reply_draft` — if over 280 chars, truncate at last word boundary before 280 and append `…`

**Search sources and queries (injected into agent prompt):**

Google browser search (date filter `after:2026-01-01`):
- `"agent spending" OR "agent spent" OR "no spending limits" agentic payments`
- `"agent can't pay" OR "autonomous checkout" OR "machine payment" AI agent`
- `"how does my agent pay" OR "give agent money" OR "agent wallet"`
- `"AI agent billing" OR "agent transaction" OR "agent budget" developer`
- `"trust agent with money" OR "unauthorized purchase" AI agent`
- `"x402" OR "machine payments protocol" OR "agentic payments" developer complaint`

Reddit direct (r/LLMDevs, r/LocalLLaMA, r/SaaS, r/MachineLearning, r/singularity):
- Search each sub for primary pain keywords, last 72hrs

Hacker News:
- `hn.algolia.com/api/v1/search?query=agentic+payments&dateRange=last_7days`
- `hn.algolia.com/api/v1/search?query=agent+spending+controls&dateRange=last_7days`

Twitter/X:
- Live search: `"agent payment" OR "agentic checkout" lang:en -is:retweet`
- Live search: `"AI agent" spending OR payment problem OR issue lang:en -is:retweet`

GitHub Discussions:
- `github.com/search?q=agentic+payments&type=discussions&s=created&o=desc`

**Agent prompt — partial result instruction:**
The agent prompt must include: *"If you are running low on time before the 180s timeout, return whatever you have found so far in the correct JSON format. Do not wait to finish all sources. An incomplete but valid JSON result is better than no output."*

## Implementation Plan

### Tasks

1. **Create `social-listening-state.json`** (initialize with defaults if missing)
   - File: `openclaw-workspace/social-listening-state.json`
   - Schema: `{ lastRun: null, seenIds: [], lastSignal: null, totalFound: 0 }`

2. **Create `scripts/social-listening.js`**
   - File: `openclaw-workspace/scripts/social-listening.js`
   - Follow breaking-news.js architecture exactly
   - CONFIG section: WORKSPACE, DRAFTS, STATE, SOUL, MEMORY_MD, MEMORY path
   - HELPERS: saveState(), readJSON(), readFileSafe(), appendMemory(), slugify()
   - STATE INIT: readJSON(STATE, defaults)
   - PROMPT BUILD: inject SOUL.md, MEMORY.md, seenIds (as URLs), search sources/queries, partial-result instruction
   - AGENT SPAWN: same flags as breaking-news.js, outer timeout 270000ms
   - PARSE: JSON output, handle signal true/false, handle empty conversations array
   - For each conversation:
     - Skip if `state.seenIds.includes(conv.url)`
     - Validate `account` field, default to `"brand"` if invalid
     - Truncate `reply_draft` to 280 chars at word boundary if over limit
     - Generate draft ID script-side: `${TODAY}-listening-${conv.platform}-${slugify(conv.title)}`
     - Skip COLD tier (no draft)
     - Write HOT/WARM drafts to drafts.json
     - Push `conv.url` to `state.seenIds`
   - NOTIFY: Telegram summary counts by tier (HOT/WARM/COLD), excluding seenId-skipped items
   - MEMORY LOG: append under `## Social Listening`
   - STATE SAVE: update lastRun, lastSignal, seenIds, totalFound

3. **Register daily cron on MantisCAW**
   - Run at 8am daily (after breaking-news has already fired)
   - Command: `node /path/to/social-listening.js`

### Acceptance Criteria

**Given** the cron fires at 8am:
- **When** agent finds HOT conversations → **Then** reply drafts appear in `drafts.json` with `urgency: "breaking"`, `type: "reply"`, `status: "pending"` within one run cycle
- **When** agent finds WARM conversations → **Then** drafts appear in same run with `urgency: "standard"`
- **When** nothing relevant found → **Then** script exits 0 with Telegram message "No signals found"
- **When** agent times out (SIGTERM or null exit) → **Then** script exits 1, state written with lastRun, Telegram error sent
- **When** auth fails → **Then** explicit auth error logged within run, not at timeout
- **When** run completes → **Then** `social-listening-state.json` updated regardless of outcome
- **When** duplicate URL found in seenIds → **Then** conversation skipped, not written to drafts
- **When** seenIds grows beyond 100 → **Then** trimmed on every saveState() call
- **When** `conversations` array is empty (signal: true but no results) → **Then** script logs "no results" and exits 0 cleanly
- **When** reply_draft exceeds 280 chars → **Then** truncated at last word boundary before 280, `…` appended
- **When** `account` field is missing or invalid → **Then** defaults to `"brand"` silently

## Additional Context

### Dependencies

- `openclaw` CLI available on MantisCAW (same as breaking-news.js)
- Browser profile `openclaw` logged in (for Google search + Reddit + Twitter)
- Telegram channel configured (same as breaking-news.js)
- `drafts.json` and `SOUL.md` and `MEMORY.md` present in WORKSPACE

### Testing Strategy

1. Run manually first: `node social-listening.js` — confirm no crash, state file written
2. Confirm drafts.json gets at least 1 reply draft (check Discord/Telegram)
3. Run again immediately — confirm seenIds (URL-based) prevents duplicates
4. Force timeout by setting `--timeout 1` — confirm state written, exit 1
5. Inject a mock conversation with `reply_draft` > 280 chars — confirm truncation
6. Inject a mock conversation with missing `account` field — confirm defaults to `"brand"`

### Notes

- This is a companion to breaking-news.js, not a replacement. Different cadence, different output type.
- Conversations found by this script are reply drafts — they require a source_post_url to be valid.
- SOUL.md Mode 3 (brand replies) governs the tone for brand account drafts.
- Personal account drafts (trust/safety, infrastructure) should use founder voice — no brand references.
- Agent prompt must instruct: reply drafts under 280 chars, no promotional language, add genuine value only.
- Cron runs at 8am — HOT window is < 2hrs old, so posts from ~6am onward qualify. Consider adding a 2pm run in a future iteration if early-morning coverage proves insufficient.
- Outer timeout is 270s (not 210s like breaking-news.js) because 5-source sweep takes longer than a single-source news check.
- Telegram tier counts must be calculated after dedup filtering — seenId-skipped conversations do not count as "found."

### Party Mode Review Notes (2026-03-23)

Gaps and decisions resolved during multi-agent review:

| Finding | Agent | Decision |
| ------- | ----- | -------- |
| Dedup key should be URL not generated ID | Winston, Quinn | Use `conv.url` in seenIds |
| Outer timeout too short for 5-source sweep | Winston | 270s outer / 180s agent |
| Agent needs partial-result instruction | Winston | Added to prompt spec |
| Empty `conversations[]` not handled | Quinn | AC + implementation task added |
| 280-char limit needs script-side enforcement | Quinn | Script truncates at word boundary |
| `account` field not validated | John | Script validates, defaults to `"brand"` |
| WARM behavior was contradictory in spec | John | Clarified: writes draft NOW, urgency: standard |
| Telegram counts must exclude seenId-skipped items | Amelia | Noted in implementation task and Notes |
| Draft ID should be generated script-side | Amelia | slugify() helper added to tasks |
| 8am cron may miss HOT posts for some timezones | John | Noted; 2pm run as future iteration |
