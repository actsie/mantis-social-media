# MEMORY.md — Long-Term Memory

## DEVLOG.md — Always Update on Problems
Whenever an error, crash, or unexpected behavior is encountered during automation work, log it to `DEVLOG.md` (workspace root). Format:
- **Problem:** what happened
- **Root cause:** why it happened
- **Solution:** how to fix/avoid it
- **Status:** ✅ Fixed / ⚠️ Workaround / 🚧 Deferred

Do this every time — don't wait to be asked. Newest entries at top.

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
  reddit/      ← tone-guide.md ✅, subreddits.md (TBD), scripts/ (TBD), engagement-log.json ✅
  reddit account: u/Alive_Kick7098 | email: stacy@curiousaddys.com | karma: 1 | age: 9mo | phase: warmup

## Reddit Automation — ALWAYS use old.reddit.com
New Reddit UI (faceplate custom elements + Shadow DOM) blocks ALL JS text injection. Nothing works.
**Use old.reddit.com** — plain textarea, execCommand works fine.
Flow: navigate to old.reddit.com post → `textarea[name="text"]` → focus + execCommand → `.arrow.up` to upvote → `.save` button to submit → reload + confirm text in page.
  tracker.csv  ← shared outreach tracker
```

## Project: fountainofprofit.com / fix-your-page

Outreach service targeting salon + beauty business owners with broken/weak websites.

- Accounts: **stacyd0nna** (IG), **@stacydonna0x** (X)
- Tracker: `/Users/mantisclaw/.openclaw/workspace/outreach/tracker.csv`
- Tone guide: `/Users/mantisclaw/.openclaw/workspace/outreach/tone-guide.md`
- Comment drafts: `/Users/mantisclaw/.openclaw/workspace/outreach/comment-drafts.md`
- JS inject method for IG comments (long text): click comment box → `document.execCommand('insertText', false, 'text')`
- No markdown, no hyphens, no quotation marks in drafts
- Banned words: weird, resonate, nightmare, quiet (and variants)
