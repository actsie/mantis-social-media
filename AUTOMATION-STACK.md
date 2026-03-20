# 🦀 Mantis Claw Automation Stack

**Last updated:** March 17, 2026  
**Purpose:** Outreach for fountainofprofit.com / fix-your-page — website/page rebuilder service for salon + beauty business owners

---

## Overview

| Platform | Account | Handle | Status | Daily Quota |
|----------|---------|--------|--------|-------------|
| Instagram | stacyd0nna | @stacyd0nna | ✅ Active | 10 comments + 35 likes |
| X/Twitter | @stacydonna0x | @stacydonna0x | ✅ Active | 4-5 replies + 1 original post |
| Reddit | u/Alive_Kick7098 | stacy@curiousaddys.com | ✅ Phase 2 | 3-4 comments + 1-2 posts/week |

**Browser:** OpenClaw-managed Chrome (`profile="openclaw"`) — logged into all 3 accounts  
**Delivery:** All summaries → Telegram (chat ID: 6241290513)  
**Humanizer:** MANDATORY — all outbound content runs through humanizer skill before posting

---

## 📸 Instagram Automation

### Account
- **Handle:** @stacyd0nna
- **Logged in:** ✅ (OpenClaw browser profile)
- **Phase:** Phase 1 (hashtag engagement) → Phase 2 (DMs) pending approval

### Daily Quota
- **Comments:** 10/day (6am–11pm PST)
- **Likes:** ~35/day total
  - 20 from comment sessions (like target post + 1-2 older posts per account)
  - 15 from standalone like batches (2-3x/day, no comments)

### Scheduling Rules (Anti-Pattern)
- At least 2 comments within 90min of each other (natural cluster)
- At least one gap 3hrs+ (long break looks human)
- Never evenly spaced — vary gaps between 44min and 4hrs
- Likes: 5-6 per batch, every 2-3hrs, not consecutive within batch

### Target Hashtags
**Full engagement (comment + like):**
- #nailslove (primary)
- #nailart
- #nailsofig
- #nailinspiration
- #naildesigner
- #nailsalon

**Like-only:**
- #haircuts, #haircut, #balayageombre, #balayagehair — like only unless caption describes the cut in detail
- #makeupgoals — like only by default

### Target Accounts (Fallback)
- File: `outreach/instagram/accounts.md` (~45 salons, spas, brands — mostly Chicago)
- Used when no same-day hashtag posts available
- These are Phase 2 DM targets

### Active Crons
| Cron ID | Name | Schedule | Purpose |
|---------|------|----------|---------|
| `0b7b57ed` | ig-daily-planner | 5:55am PST daily | Generates 10 session crons |
| (dynamic) | ig-s1 through ig-s10 | Created by planner | Individual comment sessions |
| `0275551a` | ig-daily-summary | 11:15pm PST daily | Telegram recap of day's activity |

### Scripts
- `outreach/instagram/scripts/daily-planner-oc.js` — Main planner (single-session with humanizer)

### Logs & Tracking
- `outreach/instagram/engagement-log.json` — All sessions, comments, likes
- `outreach/instagram/today-schedule.json` — Today's scheduled sessions
- `outreach/instagram/follower-state.json` — Follow tracking

### Browser Automation Flow
```
1. browser open → navigate to post URL directly
2. browser snapshot → get element refs (aria-ref or role-based)
3. browser act with {"kind": "click", "ref": "eXX"} → fast, clean execution
```

**⚠️ Critical:** `act` with natural language descriptions times out — use snapshot + ref-based clicks only.

### Phase 2 (DMs) — NOT YET ACTIVE
- DMs to US beauty/nail salons with fix-your-page offer
- Requires user approval to start
- Reminder cron `ig-phase2-reminder` was set for Feb 28 10am PST (passed — needs review)

---

## 🐦 X/Twitter Automation

### Account
- **Handle:** @stacydonna0x
- **Logged in:** ✅ (OpenClaw browser profile)

### Daily Quota
- **Replies:** 4-5/day to ICP (indie hackers, founders, beauty brands)
- **Original posts:** 1/day (9am–9pm PST, random time)

### Target Accounts
**Full engagement (reply + like):**
- @holotaco
- @OPI_PRODUCTS
- @essie

**Like-only (comment on nail/cute posts):**
- elfcosmetics, ColourPopCo, MACcosmetics, NYXCosmetics
- MannyMua733, patrickstarrr, amrezy, Rocioceja_
- Trendmood, GlamLifeGuru, kandeejohnson, carlibybel
- ChloeMorello, RawBeautyKristi, katseyeworld, XtineQuinn
- aesttics, Araduaduadua

**Removed (inactive):**
- @jackiemonttnail (Dec 2021), @hannahroxit (Sep 2022), @nailogical (Jul 2024), @N_P_Society (Jan 2021)

### Original Posts System (4 Pillars)
**1 original tweet/day — no same mode two days in a row**

| Pillar | Mode | Focus | Frequency |
|--------|------|-------|-----------|
| Pillar 1 | Mode 1 | Leads — ICP-aware, salon/beauty biz owners | ~2x/week |
| Pillar 2 | Mode 2 | Authority — strong stances, what's broken | ~2x/week |
| Pillar 3 | Mode 3 | Build in Public — messy middle, real observations | ~2x/week |
| Pillar 4 | Mode 4 | Think Out Loud — fan energy, personality | ~1x/week |

**ICP:** salon/spa/beauty business owners with weak online presence, broken booking pages, good work not showing up online

**Draft bank:** `outreach/x/original-posts-guide.md` (10 drafts per mode, 40 total)

### Safety Rules (CRITICAL)
**⚠️ ALWAYS verify tweet content before posting**

Pre-post checklist:
1. Navigate to tweet URL
2. Snapshot → read article text in Conversation region
3. Confirm 1-2 keywords from planned reply appear in the tweet
4. Only then: click textbox → type → click Reply button

**What went wrong (Feb 25):** Posted Clawberry Margarita comment on wrong OPI tweet (Bubble Bunny instead of intended post). Had to delete + repost.

**Delete flow:** JS `[data-testid="caret"]` → menuitem "Delete" → confirm dialog Delete button

**Reply submission:** Always click Reply button ref — do NOT use Ctrl+Enter (unreliable)

### Active Crons
| Cron ID | Name | Schedule | Purpose |
|---------|------|----------|---------|
| `0ccc5cd2` | x-daily-planner | 5:58am PST daily | Generates 4-5 session crons |
| (dynamic) | x-s1 through x-s5 | Created by planner | Individual reply sessions |
| `ca8e5996` | x-daily-summary | 11:18pm PST daily | Telegram recap |
| `x-original-posts-planner` | x-original-posts-planner | 6:04am PST daily | Original post session |

### Scripts
- `outreach/x/scripts/x-daily-planner.js` — Reply planner (single-session with humanizer)
- `outreach/x/scripts/x-original-posts-planner.js` — Original post planner
- `outreach/x/scripts/x-indie-hacker-planner-oc.js` — Indie hacker engagement

### Logs & Tracking
- `outreach/x/engagement-log.json` — All replies, likes
- `outreach/x/today-schedule.json` — Today's scheduled sessions
- `outreach/x/original-posts-log.json` — Original posts history
- `outreach/x/original-posts-state.json` — Last mode used (prevents repeats)
- `outreach/x/accounts.md` — Target accounts list

---

## 📖 Reddit Automation

### Account
- **Username:** u/Alive_Kick7098
- **Email:** stacy@curiousaddys.com
- **Account age:** 9 months (as of Mar 2026)
- **Karma:** 60+ (Phase 2 unlocked Mar 5, 2026)

### Phase System
| Phase | Karma | Status | Activity |
|-------|-------|--------|----------|
| Phase 1 | 0–50 | ✅ Complete | Consumer subs (r/Nails, r/beauty, r/femalehairadvice) |
| Phase 2 | 50–100 | ✅ ACTIVE (Mar 5) | Pro subs (r/Nailtechs, r/hairstylist, r/EstheticianLife, r/smallbusiness) |
| Phase 3 | 100+ | 🔒 Not yet | Mention fountainofprofit.com when directly relevant |

### Daily Quota
- **Comments:** 3-4/day (fresh posts under 1hr old)
- **Original posts:** 1-2/week (Tue + Fri, randomized fire time)

### Target Subreddits
**Priority (Phase 2):**
- r/Nailtechs (primary — pro audience)
- r/hairstylist
- r/EstheticianLife
- r/smallbusiness (lead gen opportunities)

**Secondary (Phase 1 warmup):**
- r/Nails
- r/beauty
- r/femalehairadvice
- r/SkincareAddicts
- r/30PlusSkinCare
- r/curlyhair
- r/longhair

### Posting Rules
**Original posts (Tue + Fri):**
- Format: specific question title + 2-5 sentence personal body
- Body tone: lowercase, not every sentence punctuated, rambly, first-person but DON'T start with "I"
- When acknowledging conventional wisdom: explain in personal/vague terms why it doesn't feel satisfying (Reddit will answer literally)
- No em dashes, no banned words, not too polished

**Constraints:**
- Track all posted topics in `posted-topics.json` — never recycle within 30 days
- Never post twice in same sub within 7 days
- Never post and comment in same sub same day
- Morning notify sent when post session scheduled; evening summary includes post URL

### Browser Automation
**⚠️ ALWAYS use old.reddit.com**

New Reddit UI (faceplate custom elements + Shadow DOM) blocks ALL JS text injection.

Flow:
```
navigate to old.reddit.com post
→ textarea[name="text"]
→ focus + execCommand('insertText')
→ .arrow.up to upvote
→ .save button to submit
→ reload + confirm text in page
```

### Active Crons
| Cron ID | Name | Schedule | Purpose |
|---------|------|----------|---------|
| `143b337d` | reddit-daily-planner | 6:01am PST daily | Generates 3-4 session crons |
| (dynamic) | reddit-s1 through reddit-s4 | Created by planner | Individual comment sessions |
| `93403c50` | reddit-daily-summary | 11:21pm PST daily | Telegram recap (comments + posts) |
| `e2b5a3e4` | reddit-weekly-poster-tue | Every Tuesday 10am PST | Fires post session 30min-5hrs later |
| `a43d5c73` | reddit-weekly-poster-fri | Every Friday 2pm PST | Fires post session 30min-5hrs later |
| `d26f8803` | reddit-karma-check | Every Sunday 10am PST | Weekly karma check |

### Scripts
- `outreach/reddit/scripts/reddit-daily-planner-oc.js` — Comment planner (single-session with humanizer)
- `outreach/reddit/scripts/reddit-weekly-poster.js` — Original post planner (single-session with humanizer)

### Logs & Tracking
- `outreach/reddit/engagement-log.json` — All comments, upvotes
- `outreach/reddit/today-schedule.json` — Today's scheduled sessions
- `outreach/reddit/posted-topics.json` — All posted topics (30-day memory)
- `outreach/reddit/post-guide.md` — Post format rules
- `outreach/reddit/karma-state.json` — Current karma count

---

## 🔧 Shared Infrastructure

### Humanizer Skill (MANDATORY)
**Discovered Mar 13:** Never post without humanizing first.

**Trigger:** `/humanize [draft text]`

**Example:**
```
/humanize Chrome Hearts mold is a bold pick. That chunky texture gives it presence without going overboard.
```

**Live session flow:**
```
1. Find post
2. Draft comment → save to drafts/session-N-draft.txt
3. Say: "/humanize [paste draft]" → wait for skill output
4. Save humanized output to drafts/session-N-humanized.txt
5. Post from humanized file
6. Log engagement
```

**Installed globally:** `~/.nvm/versions/node/v24.13.1/lib/node_modules/openclaw/skills/humanizer/`

**Why:** Skipping humanizer means showing AI-pattern drafts that need rework. Waste of turns. User sees unfinished work.

### Session Target — Main vs Isolated
**Discovered Mar 14:** Isolated sessions cannot access workspace skills.

**Solution:** Use `--session main` flag for all outreach crons
- Runs in main session (has access to humanizer skill)
- 50% fewer API calls (single session per comment, not A/B split)
- Direct skill invocation via `/humanize [draft]` (not just reading rules)
- Cleaner flow, easier debugging

### Tone Rules (All Platforms)
**Banned:**
- No hyphens `-` or em dashes `—` → use period instead
- No quotation marks → rephrase
- No: weird, resonate, nightmare, amazing, stunning, quiet, especially, vibe/vibes, "is still the move", "not X but Y", genuinely, plot twist, lands, stick, click, "read/reads"

**Style:**
- Don't mirror caption back — pick ONE thing, react to it
- Lowercase fine. Rambly/diary-ish encouraged
- English posts only
- Core energy: warm, positive, uplifting, kind, human. Dry humor ok, never snarky/judgmental

**Humanize before posting:**
```
/humanize [draft text]
```

### Cron Delivery
- All daily crons use `channel: telegram, to: 6241290513, bestEffort: true`
- `bestEffort: true` prevents delivery failure from triggering planner retries (which caused duplicate crons Feb 26)
- Session cron Telegram sends must include `target="6241290513"` explicitly — isolated sessions have no chat context

### Browser Profile
- `browser.defaultProfile` set to `"openclaw"` globally (Feb 26 fix)
- All planners use `_oc.js` versions with explicit `profile="openclaw"` instruction
- Chrome extension relay (`profile="chrome"`) requires manual click — avoid for scheduled sessions
- If openclaw browser gets logged out: re-login once via browser tool, done

---

## 📊 Dashboard Integration

**Dashboard:** http://localhost:8765

### V1 Features (Complete)
- ✅ Overview tab — 7 summary cards, 6 widgets (alerts, diffs, files, approvals, agents, heartbeats)
- ✅ Files tab — 24h file changes
- ✅ Cron tab — List + Run/Enable/Disable controls
- ✅ X/Content tab — Draft queue + approve/reject with feedback
- ✅ Missions tab — Active missions list
- ✅ Sprint tab — Sprint goals + tasks
- ✅ Memory tab — MEMORY.md + daily logs
- ✅ Agents tab — Agent list + status
- ✅ Learnings tab — Feedback stats + recent learnings

### Feedback Loop
- All draft approvals/rejections saved to `dashboard/feedback-store.json`
- Rejection reasons categorized (tone, timing, accuracy, strategy, other)
- Learnings tab shows patterns over time
- Nightly review cron (`dashboard-nightly-review` at 11:30pm PST) analyzes rejections and writes to memory

---

## 📁 File Structure

```
outreach/
  instagram/
    scripts/daily-planner-oc.js
    tone-guide.md
    scheduling-rules.md
    engagement-log.json
    today-schedule.json
    accounts.md
    follower-state.json
    drafts/
  
  x/
    scripts/x-daily-planner.js
    scripts/x-original-posts-planner.js
    scripts/x-indie-hacker-planner-oc.js
    tone-guide.md
    posting-rules.md
    accounts.md
    engagement-log.json
    today-schedule.json
    original-posts-guide.md
    original-posts-log.json
    original-posts-state.json
    drafts/
  
  reddit/
    scripts/reddit-daily-planner-oc.js
    scripts/reddit-weekly-poster.js
    tone-guide.md
    strategy.md
    post-guide.md
    engagement-log.json
    today-schedule.json
    posted-topics.json
    karma-state.json
    drafts/
  
  tracker.csv              ← Shared outreach tracker
  tone-guide.md            ← Global tone rules
  comment-drafts.md        ← Draft bank

dashboard/
  index.html               ← Main UI
  server.js                ← HTTP server + API
  missions.json            ← Mission definitions
  sprints.json             ← Sprint definitions
  feedback-store.json      ← Approval/rejection feedback
  summaries/               ← Nightly review summaries
  data/
    collector.js           ← Data collection
    feedback-store.js      ← Feedback persistence
    schema.md              ← Type definitions
```

---

## 🚨 Known Issues / Watch List

| Issue | Status | Notes |
|-------|--------|-------|
| Instagram Post button inaccessible | ⚠️ Workaround | UI issue — comment typed but Post button doesn't enable. Session logs as attempted. |
| `openclaw sessions list` fails | ⚠️ Intermittent | Dashboard agents tab shows 0 active. Non-blocking. |
| Phase 2 Instagram DMs | 🔒 Pending | Needs user approval to start |
| Reddit Phase 3 | 🔒 Locked | Need 100+ karma (currently ~60) |

---

## 📈 Daily Schedule (PST)

| Time | Event | Platform |
|------|-------|----------|
| 5:55am | ig-daily-planner runs | Instagram |
| 5:58am | x-daily-planner runs | X |
| 6:01am | reddit-daily-planner runs | Reddit |
| 6:04am | x-original-posts-planner runs | X |
| 6am–11pm | Session crons execute (staggered) | All |
| 10am Tue | reddit-weekly-poster-tue fires | Reddit |
| 2pm Fri | reddit-weekly-poster-fri fires | Reddit |
| 11:15pm | ig-daily-summary | Instagram |
| 11:18pm | x-daily-summary | X |
| 11:21pm | reddit-daily-summary | Reddit |
| 11:30pm | dashboard-nightly-review | Dashboard |

---

**This is a living document. Update when automation behavior changes.**
