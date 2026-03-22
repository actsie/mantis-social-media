---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments: ['CLAUDE.md', 'openclaw-workspace/AGENTS.md', 'openclaw-workspace/SOUL.md', 'openclaw-workspace/HEARTBEAT.md']
workflowType: 'prd'
classification:
  projectType: Node.js background cron / automation script
  domain: Fintech / agentic AI / social media automation
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document — breaking-news.js

**Author:** Stacy
**Date:** 2026-03-22

---

## Executive Summary

`breaking-news.js` is a Node.js cron script running on MantisCAW every 30 minutes, 24/7. It sweeps Twitter/X and news sources for breaking agentic payments events, drafts PolyMarket-style posts, and routes them for human review via Discord and Telegram. The script is the top of a training funnel: every draft approved, edited, or rejected feeds a learning loop that progressively calibrates tone and editorial judgment until the agent can post autonomously without human review.

**Target users:** Ben and the user — reviewing drafts, approving or editing, teaching the agent their voice over time.

**Problem being solved:** Breaking agentic payments news requires near-instant response. Manual monitoring is impossible at 24/7 cadence. The script handles detection and first-draft generation; humans handle quality and judgment until the agent earns trust.

**What makes this special:** Most social media automation is static — it posts on a schedule with fixed templates. This system is a training loop. Each human decision (approve as-is, edit, reject) is a labeled data point. The agent learns the difference between on-brand and off-brand, breaking and not-breaking, through accumulated decisions rather than upfront rules. The end state is full autonomy — not automation, but a trained voice.

**Breaking signal criteria:** Company-level events only — shipped, announced, or ruled. No opinion pieces, no planning announcements, no general AI news without a payment-specific event.

**Notification chain:** Discord (live) → Telegram (live) → Slack (infrastructure ready, no channel yet).

## Project Classification

- **Project Type:** Node.js background cron / automation script
- **Domain:** Fintech / agentic AI / social media automation
- **Complexity:** Medium
- **Project Context:** Brownfield — script exists, has known bugs, being rebuilt to spec

---

## Success Criteria

### User Success

- Every draft arrives in Discord and Telegram with full text, source URL, and context visible — no clicking through to approve blind
- Edit and reject decisions are captured in `feedback-patterns.md` and reflected in future drafts
- Approval-without-edit rate increases over time — this is the primary signal that the agent is learning

### Business Success

- Breaking news drafted within 30 minutes of the event going live
- Zero AI-sounding posts reach approval — brand voice is maintained on every draft
- Approval-without-edit rate tracked weekly and trends upward
- Ben determines readiness for full autonomy based on sustained approval-without-edit rate — no fixed threshold, judgment call

### Technical Success

- No cascade loops — one sweep, one session, clean exit
- No false positives — opinion pieces, planning announcements, and general AI news do not trigger drafts
- Deduplication working — same story not drafted twice across consecutive sweeps
- Agent run confirmed — outer script verifies the agent session completed, not just that the spawn returned exit 0
- All `openclaw agent` flags validated against actual CLI help output
- Discord and Telegram notifications fire on every new draft

### Measurable Outcomes

- Approval-without-edit rate: baseline established in week 1, target is upward trend week-over-week
- False positive rate: target zero — every drafted story is a company-level event
- Sweep reliability: target 100% of 30-min sweeps completing without error

---

## User Journeys

### Journey 1 — Reviewer: Breaking News, Approved As-Is

It's 2am. Santander announces live agentic payments across LatAm. The 30-min sweep catches it. A Discord notification fires: `🔔 [BRAND — @agentcardai] New post ready for approval` — full draft text, source URL, context. Ben reads it on his phone, it's tight and on-brand. He approves without editing. The post queues for the next posting window. `feedback-patterns.md` logs: approved as-is. The agent's approval-without-edit count goes up by one.

### Journey 2 — Reviewer: Draft Needs Edit

A new Visa announcement drops. Draft arrives — accurate but the opening line sounds AI-written. The reviewer edits it directly in the approval UI, tightens the hook, approves. The edit delta is captured in `feedback-patterns.md`: what changed, what direction. Next time the agent drafts a Visa story, it has a reference point for what the reviewer expects.

### Journey 3 — Reviewer: False Positive, Rejected

A Forbes opinion piece about "the future of agentic payments" gets drafted as breaking. No event, just commentary. The reviewer rejects with reason: "opinion piece, no event." `feedback-patterns.md` logs: rejected, reason captured. Signal criteria tighten. The agent learns the difference between an event and a take.

### Journey 4 — Operator: Script Stops Sweeping

Three hours pass with no sweep confirmations in Discord. The operator checks the cron logs — the agent run is silently failing. The outer script shows exit 0 but the agent session errored internally. The operator reads the error, identifies the cause (expired auth token, invalid flag), fixes it, and the sweep resumes. The failure was detectable because the outer script logs agent run status explicitly, not just spawn exit codes.

### Journey Requirements Summary

| Journey | Capabilities Required |
|---|---|
| Approved as-is | Sweep → draft → notify → approval flow → feedback log |
| Edit then approve | Approval UI with edit field → diff capture → feedback log |
| Reject | Reject with reason → feedback log → signal criteria learning |
| Script failure | Agent run confirmation → explicit error logging → operator-readable output |

---

## Domain-Specific Requirements

### Technical Constraints

- Twitter/X sweep uses browser automation (not API) — no rate limit risk, but requires valid browser session with authenticated profile
- Auth token validity must be handled explicitly — if OpenClaw auth expires, the script must fail loudly with a clear error, not silently return NO_SIGNAL
- Source URL must be included with every draft — no draft without a verifiable source link

### Risk Mitigations

- Silent failure risk: outer script must confirm agent session completed and log explicit error if not — exit 0 on spawn failure is not acceptable
- Brand accuracy risk: script only drafts company-level events with a source URL — no sourced claim means no draft

---

## Technical Architecture

### Overview

`breaking-news.js` is a scheduled Node.js script invoked by OpenClaw's cron system every 30 minutes. No user interface — its interface is the files it reads and writes, the agent session it spawns, and the notifications it sends. All configuration is file-based.

**Trigger:** OpenClaw cron → `node scripts/breaking-news.js`

### Inputs (read on each run)

- `breaking-news-state.json` — last run timestamp, seenIds array (trimmed to last 100), last signal
- `openclaw-workspace/SOUL.md` — injected into agent prompt at build time
- `openclaw-workspace/MEMORY.md` — injected into agent prompt at build time (Tier 1 accounts, competitor list)

### Outputs (written on each run)

- `breaking-news-state.json` — updated after every run; initialized as `{ lastRun: null, seenIds: [], lastSignal: null }` if missing
- `drafts.json` — appended only if signal found; initialized as `[]` if missing
- `memory/YYYY-MM-DD.md` — appended under `## Breaking News` if signal found
- Discord webhook — POST on signal found
- Telegram — message on signal found

### Agent Session Interface

- Spawns via `openclaw agent` (all flags validated against `openclaw agent --help` before use)
- SOUL.md and MEMORY.md contents injected into prompt at build time
- Agent outputs exactly: `{"signal": true, "headline": "...", "draft_id": "...", "source_url": "...", "text": "..."}` or `{"signal": false}`
- Outer script parses stdout for JSON — extracts draft-id for notify call
- Outer script confirms session completed — exit 0 on spawn failure is not acceptable
- Agent session timeout: 180s; outer `spawnSync` timeout: 210000ms (3.5 min)

### Configuration Schema

| Config item | Location | Notes |
|---|---|---|
| Workspace root | `process.env.AGENTCARD_WORKSPACE` with fallback to `path.join(__dirname, '..')` | Never hardcoded |
| Search terms | Hardcoded in prompt | Primary + secondary terms |
| Tier 1 accounts | Injected from MEMORY.md | Read dynamically at build time |
| Signal criteria | Hardcoded in prompt | Company-level events only |
| Notification targets | Discord webhook in MEMORY.md, Telegram via OpenClaw | |

### Implementation Constraints

- Script is stateless except for `breaking-news-state.json` — no in-memory state between runs
- `seenIds` trimmed to last 100 entries on every write to prevent state file bloat
- `seenIds` passed into agent prompt to prevent duplicate drafts
- `notify-draft.js [draft-id]` called from outer script after agent completes — not from inside agent prompt

---

## Functional Requirements

### Signal Detection

- FR1: The system can sweep Twitter/X using browser automation for primary and secondary search terms
- FR2: The system can fetch headlines from news sources (TechCrunch, Forbes, aibusiness.com, Bloomberg, The Verge, The Information, PYMNTS, Fintech Magazine)
- FR3: The system can check Tier 1 account profiles for new posts from the last 30 minutes
- FR4: The system can evaluate detected content against signal criteria (company-level events only — shipped, announced, or ruled)
- FR5: The system can deduplicate signals against previously drafted stories via seenIds

### Draft Creation

- FR6: The system can draft a PolyMarket-style (Mode 1) post when a breaking signal is detected
- FR7: The system can write a draft to `drafts.json` with required fields: id, platform, type, status, urgency, text, context, source_url, created_at, account
- FR8: The system can include a source URL with every draft — no draft without a verifiable source
- FR9: The system can reject agent output containing no source URL and log it as a malformed response — draft is not written
- FR10: The system can initialize `drafts.json` as an empty array if the file does not exist

### State Management

- FR11: The system can read state from `breaking-news-state.json` at the start of every run
- FR12: The system can write updated state to `breaking-news-state.json` after every run regardless of signal outcome
- FR13: The system can initialize `breaking-news-state.json` with default values if the file does not exist
- FR14: The system can trim the seenIds array to the last 100 entries on every write

### Agent Session Management

- FR15: The system can spawn a one-shot agent session to perform the research sweep
- FR16: The system can confirm the agent session completed successfully — not just that the spawn returned exit 0
- FR17: The system can parse agent stdout for a JSON object `{"signal": true, "headline": "...", "draft_id": "...", "source_url": "...", "text": "..."}` or `{"signal": false}`
- FR18: The system can distinguish between timeout, auth failure, and NO_SIGNAL — each logged with a distinct error message

### Notifications

- FR19: The system can send a Discord notification when a draft is created, including full draft text, source URL, and account type label
- FR20: The system can send a Telegram notification when a draft is created
- FR21: The system can call `notify-draft.js` from the outer script using the draft-id extracted from agent stdout
- FR22: The system infrastructure supports Slack notifications (wired, no channel required at MVP)

### Configuration & Portability

- FR23: The system can resolve the workspace root from `process.env.AGENTCARD_WORKSPACE` with a fallback to a relative path
- FR24: The system can inject current MEMORY.md contents into the agent prompt at build time
- FR25: The system can inject current SOUL.md contents into the agent prompt at build time

### Memory & Feedback Loop

- FR26: The system can append draft id, text, and source URL to the daily memory file under `## Breaking News` when a draft is created
- FR27: The system can log approval-without-edit rate to the weekly memory file *(Growth)*
- FR28: The system can update `feedback-patterns.md` on every approve, edit, or reject decision *(Growth)*
- FR29: The system can push a weekly approval-without-edit rate summary to Discord and Telegram *(Growth)*

---

## Non-Functional Requirements

### Performance

- NFR1: Each sweep must complete within 180 seconds end-to-end (agent session + outer script overhead)
- NFR2: Outer script overhead (state read, prompt build, notify call) must complete in under 5 seconds excluding agent session time
- NFR3: State file I/O errors must fail fast with a logged error — not hang

### Reliability

- NFR4: A sweep failure must not prevent subsequent sweeps — outer script exits with appropriate code, cron continues on schedule
- NFR5: Every run must produce a log entry (signal found, no signal, or error type) — silent completion is not acceptable
- NFR6: Auth token expiry must produce an explicit logged error within the first 10 seconds of the run — not at timeout

### Integration

- NFR7: Discord notification must be sent within 10 seconds of a draft being written to `drafts.json`
- NFR8: Telegram notification must be sent within 10 seconds of a draft being written to `drafts.json`
- NFR9: Notification failure is non-blocking — sweep completes and draft is written regardless

---

## Project Scope & Phased Development

### Phase 1 — MVP

Fix what's broken, confirm the sweep works reliably, establish the training loop baseline.

**Must-have capabilities:**
- All `openclaw agent` flags validated via `--help` before use
- Agent run confirmed by outer script — not just spawn exit 0
- Primary and secondary search terms scanning
- Content-based signal evaluation (company-level events only)
- Deduplication via seenIds (trimmed to 100)
- Drafts in Mode 1 (PolyMarket style) per SOUL.md
- Discord and Telegram notifications with full draft text, source URL, account label
- State and drafts files initialized on first run
- Workspace root via `process.env.AGENTCARD_WORKSPACE`, no hardcoded paths
- Daily memory log updated on every draft created

### Phase 2 — Growth

- Approval-without-edit rate logged weekly to memory file
- `feedback-patterns.md` updated automatically on every approve/edit/reject
- Weekly summary pushed to Discord/Telegram for Ben's visibility
- Slack notification wired when channel is ready

### Phase 3 — Autonomy

- Ben approves full autonomous posting based on sustained approval-without-edit rate
- Human review becomes exception handling only

### Risk Mitigation

- **Highest technical risk:** `openclaw agent` flag validity — MantisCAW runs `openclaw agent --help` and confirms all flags before implementation
- **Operational risk:** Silent failure — agent run confirmation in outer script, explicit error logging on auth failure
- **Resource risk:** Single operator — plain-text config files, no database, anyone can read and fix the state

---

## Innovation

### Progressive Trust Model

Most social media automation is binary: fully manual or fully automated. This system introduces supervised autonomy — the agent earns posting rights incrementally through demonstrated judgment. Every human decision is a training signal. Starts at 100% human review, moves toward 0% as accuracy improves. Ben decides when trust is earned.

### Feedback-as-Training Without Retraining

The learning loop doesn't retrain a model. It accumulates structured human decisions in `feedback-patterns.md` — a plain-text file the agent reads as context on every run. Edits, rejections, and approvals become working memory. Simple, auditable, reversible. To start fresh: reset `feedback-patterns.md`. No database, no model, no config change required.

### Validation

- Baseline approval-without-edit rate established in week 1
- Weekly summary pushed to Discord/Telegram so Ben has visibility without digging through files
- Upward trend in rate confirms the loop is working
- Full autonomy gate: Ben's judgment, informed by the weekly summary
