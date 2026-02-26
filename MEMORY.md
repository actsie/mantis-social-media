# MEMORY.md — Long-Term Memory

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

---

## Outreach folder structure
```
outreach/
  instagram/   ← tone-guide.md, scheduling-rules.md, engagement-log.json, today-schedule.json, scripts/daily-planner.js
  x/           ← tone-guide.md, posting-rules.md, accounts.md, scripts/ (planner TBD)
  reddit/      ← tone-guide.md (TBD), subreddits.md (TBD), scripts/ (TBD)
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
