# Learnings System — Design Decision

**Created:** March 17, 2026  
**Author:** Stacy  
**Status:** Active

---

## Overview

The Learnings tab captures institutional knowledge — what works, what doesn't, what to remember. This is separate from the Docs tab (clean output for Mai/Ben) and Changelog tab (what changed and when).

**Key insight:** You already have a Learnings tab but it's probably just pulling from approve/reject feedback on drafts. That's **content learnings** — not **system learnings**.

What you're describing is broader:
- "We tried posting on Reddit at 9am, got flagged — moved to 2pm, works better"
- "IG Phase 2 DMs got account warned — shelved indefinitely"
- "Humanizer pass on X replies increased engagement noticeably"

That's institutional knowledge. Right now it lives nowhere — it's in your head.

---

## Three Learning Types

### 1. Content (Draft Feedback)

**Source:** Auto-created when drafts are rejected in X/Content tab

**What it captures:**
- Why a draft was rejected (tone, timing, accuracy, strategy)
- Which platform (X, Instagram, Reddit)
- Category of issue

**Example:**
> **Type:** Content  
> **Note:** "tone too formal, sounds like a press release"  
> **Category:** Tone  
> **Platform:** X

**Purpose:** Track patterns in what gets rejected. If you see 5 rejections for "tone" in a week, you know the humanizer needs adjustment.

---

### 2. System (Automation Decisions)

**Source:** Manual entry via Learnings tab form

**What it captures:**
- Phase changes (Phase 1 → Phase 2)
- Rule updates (new requirements, constraints)
- Platform behavior changes (API updates, policy changes)
- Infrastructure decisions (why we use X instead of Y)

**Examples:**
> **Type:** System  
> **Title:** Humanizer Gate — Mandatory for All Outbound Content  
> **Description:** All outbound content must run through humanizer before posting. Discovered Mar 13: skipping humanizer means AI-pattern drafts go live, hurting account credibility.

> **Type:** System  
> **Title:** Reddit Posting — Always Use old.reddit.com  
> **Description:** New Reddit UI (faceplate custom elements + Shadow DOM) blocks ALL JS text injection. Nothing works. Use old.reddit.com — plain textarea, execCommand works fine.

> **Type:** System  
> **Title:** Session Target — Use --session main for Skills Access  
> **Description:** Discovered Mar 14: Isolated sessions cannot access workspace skills. Solution: Use --session main flag for all outreach crons.

**Purpose:** Capture why we built things a certain way. Mai and Ben read Docs, not raw Learnings. System learnings get promoted to Docs when they're stable.

---

### 3. Experiment (Things Tried)

**Source:** Manual entry via Learnings tab form

**What it captures:**
- What was tried
- Outcome (success / failure / mixed)
- Verdict (keep / archive / retry / shelved)
- Platform affected

**Verdicts:**
- **Keep:** Works well, continue doing this
- **Archive:** Worked but no longer relevant (old platform, deprecated feature)
- **Retry:** Failed but worth trying again later (timing, conditions)
- **Shelved:** Failed, don't repeat (account warnings, bans, fundamental issues)

**Examples:**
> **Type:** Experiment  
> **Title:** Reddit 9am Posting Got Flagged  
> **Description:** Posted at 9am PST, account got flagged for spam. Moved to 2pm PST, works better.  
> **Outcome:** Success  
> **Verdict:** Keep  
> **Platform:** Reddit

> **Type:** Experiment  
> **Title:** IG Phase 2 DMs Got Account Warned  
> **Description:** Started Phase 2 DM outreach on March 1. Account received warning from Instagram after 50 DMs. Shelved indefinitely — need to warm up account first.  
> **Outcome:** Failure  
> **Verdict:** Shelved  
> **Platform:** Instagram

**Purpose:** "Don't repeat" records. When someone wonders "why don't we DM on Instagram?", you have a record of what happened.

---

## The Flow

```
You try something
    ↓
Log it as a Learning (experiment type, 2-3 lines)
    ↓
┌──────────────────────────────────────────────┐
│ It works → Promote to Doc                    │
│ It fails → Stays in Learnings as warning     │
│ It's mixed → Keep as experiment, add notes   │
└──────────────────────────────────────────────┘
```

### Promote to Doc

When a learning proves stable and important:
1. Click "Promote to Doc" button in Learnings tab
2. System creates a new Doc from the learning
3. Learning is marked as `promotedToDoc`
4. Doc appears in Docs tab for Mai/Ben to read

**What gets promoted:**
- System learnings that are now standard practice
- Experiment learnings with "keep" verdict that should be documented
- Any learning that answers "why do we do it this way?"

**What stays in Learnings:**
- Failed experiments (warning records)
- Content feedback (too granular for docs)
- Temporary/conditional learnings

---

## Rule of Thumb: What Goes Where

| Question | Tab |
|----------|-----|
| What changed today? | Changelog |
| Why did we build it this way? | Docs |
| What did we learn from trying it? | Learnings |
| How does X work step by step? | Docs |

---

## Tab Purposes

### Changelog
**Answers:** What changed and when

**Auto-logged from:**
- Approve/reject actions
- Cron controls (run/enable/disable)
- Manual entries via `/api/changelog`

**Format:** Timestamped entries with type (new/changed/fixed/archived), title, description, file path

**Audience:** You (tracking what happened today)

---

### Docs
**Answers:** Why we built it this way, how it works

**Source:** Promoted learnings + manual documentation

**Format:** Clean markdown, step-by-step guides, decision records

**Audience:** Mai and Ben (they read Docs, not raw Learnings)

**Examples:**
- Humanizer Gate — Mandatory for All Outbound Content
- Reddit Posting — Always Use old.reddit.com
- Session Target — Use --session main for Skills Access

---

### Learnings
**Answers:** What did we learn from trying it

**Source:** Auto (content feedback) + Manual (system/experiment)

**Format:** Quick entries, 2-3 lines, verdict tags

**Audience:** You (institutional memory, don't-repeat records)

---

## Implementation

### Data Structure

```typescript
interface Learning {
  id: string
  type: 'content' | 'system' | 'experiment'
  
  // Content type
  source?: 'rejection' | 'correction' | 'miss' | 'review'
  note?: string
  category?: 'tone' | 'timing' | 'accuracy' | 'strategy' | 'other'
  linkedId?: string // draft id
  
  // System/Experiment types
  title?: string
  description?: string
  outcome?: 'success' | 'failure' | 'mixed'
  verdict?: 'keep' | 'archive' | 'retry' | 'shelved'
  platform?: 'instagram' | 'x' | 'reddit' | 'dashboard' | 'general'
  
  // Common
  createdAt: string
  applied?: boolean
  promotedToDoc?: string // doc id if promoted
}
```

### API Endpoints

```
POST /api/learning
  → Add system/experiment learning

POST /api/learning/:id/promote
  → Promote learning to doc
  → Creates doc, marks learning as promoted
```

### UI Components

**Learnings Tab:**
- Add New Learning form (type, platform, verdict, title, description)
- Stats grid (content/system/experiment counts)
- Filter buttons (all/system/experiment/content)
- Learnings list with promote buttons

**Docs Tab:**
- List of promoted docs
- Clean, readable format
- Source learning reference

---

## Why This Structure?

**Problem:** Institutional knowledge lives in your head. When you're not around, Mai and Ben don't know why things are built a certain way. You repeat mistakes because there's no record of what failed.

**Solution:** Three-tier system:
1. **Changelog** — Passive, auto-logged, what changed
2. **Learnings** — Active, manual + auto, what we learned
3. **Docs** — Curated, promoted from learnings, why it works

**Benefit:** Nothing falls through. Every change is logged, every lesson is captured, every decision is documented.

---

## Related Docs

- [[humanizer-gate.md]] — Promoted from system learning
- [[reddit-old-ui.md]] — Promoted from system learning
- [[session-main-flag.md]] — Promoted from system learning

---

**Last updated:** March 17, 2026
