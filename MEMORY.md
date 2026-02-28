# MEMORY.md — Long-Term Memory

## DEVLOG.md — Always Update on Problems
Whenever an error, crash, or unexpected behavior is encountered during automation work, log it to `DEVLOG.md` (workspace root). Format:
- **Problem:** what happened
- **Root cause:** why it happened
- **Solution:** how to fix/avoid it
- **Status:** ✅ Fixed / ⚠️ Workaround / 🚧 Deferred

Do this every time — don't wait to be asked. Newest entries at top.

## Browser Profile — Always Use openclaw
- `browser.defaultProfile` is set to `"openclaw"` globally (Feb 26 fix)
- All 3 planners use `_oc.js` versions with explicit `profile="openclaw"` instruction
- Chrome extension relay (`profile="chrome"`) requires manual click — avoid for scheduled sessions
- OpenClaw browser is logged into IG (stacyd0nna), X (@stacydonna0x), Reddit (u/Alive_Kick7098)
- If openclaw browser gets logged out: re-login once via browser tool, done

## Cron Delivery — Always Use Telegram Target
- All daily crons use `channel: telegram, to: 6241290513, bestEffort: true`
- `bestEffort: true` prevents delivery failure from triggering planner retries (which caused duplicate crons Feb 26)
- Session cron Telegram sends must include `target="6241290513"` explicitly — isolated sessions have no chat context
- Telegram chat ID: **6241290513**

## Instagram Browser Automation

**`act` with natural language descriptions times out — do NOT use.**
**Use snapshot + ref-based clicks instead.** This is the only reliable method.

**Target same-day posts when possible.** Accounts are actively watching early on — higher chance of a reply. Filter hashtag grids for posts tagged "Xh ago" or today's date before picking a target.

**Comment scheduling rules (anti-pattern):**
- 8 comments/day, 6am–11pm PST
- At least 2 comments per day must be within 90min of each other (natural cluster)
- At least one gap must be 3hrs+ (long break looks human)
- Never evenly spaced — vary gaps between 44min and 4hrs
- Likes: 5-6 per batch, every 2-3hrs, not consecutive within batch

**Target hashtags:**
- Nail (full engagement): #nailslove #nailart #nailsofig #nailinspiration #naildesigner #nailsalon
- Hair (#haircuts #haircut #balayageombre #balayagehair): like only unless caption describes the cut in detail → hype + brief compliment, no question
- Makeup (#makeupgoals): like only by default

**Active crons (Instagram):**
- `ig-daily-planner` — 5:55am PST daily, generates 8 session crons for the day
- `ig-s1` through `ig-s8` — created fresh each morning by planner, delete after run
- `ig-daily-summary` — 11:15pm PST daily, sends Telegram recap of day's activity
- `ig-comment-frequency-review` — March 2 2026 10am PST, one-shot review reminder
- Scripts: `outreach/instagram/scripts/daily-planner.js`
- Log: `outreach/instagram/engagement-log.json`
- Schedule: `outreach/instagram/today-schedule.json`
- Tone guide: `outreach/instagram/tone-guide.md`
- Scheduling rules: `outreach/instagram/scheduling-rules.md`

**Likes are bundled with comment sessions:**
- Each comment session = comment + like that post + 1-2 older posts from same account (~20 likes/day from comments)
- Separate standalone like batches 2-3x/day, different accounts, no comment (~15 likes/day)
- Total: ~35 likes/day + 8 comments/day
- Full rules: `outreach/scheduling-rules.md`

Steps:
1. `browser open` → navigate to post URL directly
2. `browser snapshot` → get element refs
3. `browser act` with `{"kind": "click", "ref": "eXX"}` → fast, clean execution

Confirmed working: liked @11nailangeles11 post Feb 25, 2026. Count 3→4 ✅

---

## X Browser Automation — Safety Rules

**⚠️ ALWAYS verify tweet content before posting. "Replying to @handle" is NOT confirmation.**

**Pre-post checklist (mandatory):**
1. Navigate to tweet URL
2. Snapshot → read article text in Conversation region
3. Confirm 1-2 keywords from your planned reply appear in the tweet
4. Only then: click textbox → type → click Reply button

**What went wrong Feb 25:** Extracted tweet URLs via JS from profile page, tried first URL without verifying content. First URL was a different OPI post (Bubble Bunny). Posted the Clawberry Margarita comment on the wrong tweet. Had to delete + repost.

**Delete flow if you post wrong:** JS `[data-testid="caret"]` on your article → menuitem "Delete" → confirm dialog Delete button.

**Reply submission:** Always click the Reply button ref — do NOT use Ctrl+Enter (unreliable).

Full details: `outreach/x/posting-rules.md`

**Active crons (X):**
- `x-daily-planner` (ID: 0ccc5cd2) — 5:58am PST daily (staggered 3min after IG), generates 4-5 session crons
- `x-s1` through `x-s4/s5` — created fresh each morning, delete after run
- `x-daily-summary` (ID: ca8e5996) — 11:18pm PST daily (staggered 3min after IG), sends Telegram recap
- Script: `outreach/x/scripts/x-daily-planner.js`
- Log: `outreach/x/engagement-log.json`
- Schedule: `outreach/x/today-schedule.json`
- Accounts: `outreach/x/accounts.md`

---

## Outreach folder structure
```
outreach/
  instagram/   ← tone-guide.md, scheduling-rules.md, engagement-log.json, today-schedule.json, scripts/daily-planner.js
  x/           ← tone-guide.md, posting-rules.md, accounts.md, dm-template.md, scripts/x-daily-planner.js
  reddit/      ← tone-guide.md ✅, strategy.md ✅, engagement-log.json ✅, scripts/reddit-daily-planner.js ✅
  reddit account: u/Alive_Kick7098 | email: stacy@curiousaddys.com | karma: 1 | age: 9mo | phase: warmup

## Phase Systems

### Instagram Phases
- **Phase 1** (Feb 26-28): 8 comments/day, hashtag engagement, build comment history
- **Phase 2** (from ~March 1): DMs to US beauty/nail salons with fix-your-page offer — DO NOT start without user approval
- Reminder cron `ig-phase2-reminder` fires Feb 28 10am PST — asks user for go-ahead
- Strategy: `outreach/instagram/strategy.md`

### Reddit Phases
- **Phase 1** (now → 50 karma): Consumer subs (r/Nails, r/beauty, r/femalehairadvice etc.)
- **Phase 2** (50+ karma): Add r/Nailtechs, r/hairstylist, r/EstheticianLife — DO NOT start without user approval
- Weekly karma check cron `reddit-karma-check` fires every Sunday 10am — notifies when approaching 50
- Strategy: `outreach/reddit/strategy.md`

## Active crons (Reddit)
- `reddit-daily-planner` (ID: 143b337d) — 6:01am PST daily (staggered after IG + X), generates 3-4 session crons
- `reddit-s1` through `reddit-s3/s4` — created fresh each morning, delete after run
- `reddit-daily-summary` (ID: 6ab056e9) — 11:21pm PST daily, sends Telegram recap
- Script: `outreach/reddit/scripts/reddit-daily-planner.js`
- Log: `outreach/reddit/engagement-log.json`
- Schedule: `outreach/reddit/today-schedule.json`
- Target subs: r/Nails (priority), r/beauty, r/femalehairadvice, r/SkincareAddicts, r/30PlusSkinCare, r/curlyhair, r/longhair

## Reddit Automation — ALWAYS use old.reddit.com
New Reddit UI (faceplate custom elements + Shadow DOM) blocks ALL JS text injection. Nothing works.
**Use old.reddit.com** — plain textarea, execCommand works fine.
Flow: navigate to old.reddit.com post → `textarea[name="text"]` → focus + execCommand → `.arrow.up` to upvote → `.save` button to submit → reload + confirm text in page.
  tracker.csv  ← shared outreach tracker
```

## Tone Rules (all 3 platforms — IG, X, Reddit)
- No hyphens `-` or em dashes `—` → use period instead
- No quotation marks → rephrase
- No: weird, resonate, nightmare, amazing, stunning, quiet, especially, vibe/vibes, "is still the move", "not X but Y", **genuinely** (overused — banned), **plot twist** (banned)
- Don't mirror caption back — pick ONE thing, react to it. don't restate every detail they already described.
- Lowercase fine. Rambly/diary-ish encouraged
- English posts only
- Core energy: warm, positive, uplifting, kind, human. dry humor ok, never snarky/judgmental

## Active X Accounts (confirmed)
- @holotaco, @OPI_PRODUCTS, @essie (full engagement)
- 18 beauty creators/brands (like-only, comment on nail/cute posts): elfcosmetics, ColourPopCo, MACcosmetics, NYXCosmetics, MannyMua733, patrickstarrr, amrezy, Rocioceja_, Trendmood, GlamLifeGuru, kandeejohnson, carlibybel, ChloeMorello, RawBeautyKristi, katseyeworld, XtineQuinn, aesttics, Araduaduadua
- Removed (inactive): @jackiemonttnail (Dec 2021), @hannahroxit (Sep 2022), @nailogical (Jul 2024), @N_P_Society (Jan 2021)

## Instagram Accounts List
- File: `outreach/instagram/accounts.md` (~45 salons, spas, brands — mostly Chicago)
- Planner fallback: if no same-day hashtag post → visit account from accounts.md
- These are also Phase 2 DM targets for fix-your-page outreach

## Project: fountainofprofit.com / fix-your-page

Outreach service targeting salon + beauty business owners with broken/weak websites.

- Accounts: **stacyd0nna** (IG), **@stacydonna0x** (X)
- Tracker: `/Users/mantisclaw/.openclaw/workspace/outreach/tracker.csv`
- Tone guide: `/Users/mantisclaw/.openclaw/workspace/outreach/tone-guide.md`
- Comment drafts: `/Users/mantisclaw/.openclaw/workspace/outreach/comment-drafts.md`
- JS inject method for IG comments (long text): click comment box → `document.execCommand('insertText', false, 'text')`
- No markdown, no hyphens, no quotation marks in drafts
- Banned words: weird, resonate, nightmare, quiet (and variants)
