# MEMORY.md — Long-Term Memory

## Rule: Always Test After Changes
Whenever a session message, planner step, or automation behavior is updated or added, test it immediately before considering it done:
- Use `openclaw cron run <id>` to fire a session right away
- Check the session transcript + tracker files to confirm the new behavior actually ran
- Don't assume repositioning/rewording worked — verify it in a live session
This applies to: follow-builder steps, new logging methods, tone rule changes, step reordering, anything behavioral.
Discovered Mar 4: follow-builder was silently skipped for days because it was the last step. Reordering to step 7/8 fixed it — but only confirmed working after running a live test.

## Rule: Humanizer First — All Drafts
**Discovered Mar 13:** Never show draft replies/posts without running through humanizer skill first.

**Trigger:** `/humanize [draft text]`

**Example:**
```
/humanize These nails are something else. The detail work is insane - I keep staring at this. You're killing it.
```

Always:
1. Write initial draft
2. Say: `/humanize [paste draft]`
3. Wait for humanized output
4. Post only after user approval

This applies to: X replies, X original posts, Reddit comments, Reddit posts, Instagram comments, DMs, any outbound text.

Why: Skipping humanizer means showing AI-pattern drafts that need rework. Waste of turns. User sees unfinished work.

## Rule: Humanizer Before Every Post (Live Flow)
**Discovered Mar 13:** When executing live sessions (not just drafts), run humanizer AFTER writing the draft and BEFORE posting.

**Trigger:** `/humanize [draft text]`

**Example:**
```
/humanize Chrome Hearts mold is a bold pick. That chunky texture gives it presence without going overboard.
```

Live session flow:
1. Navigate to target post/thread
2. Read the content
3. Write draft reply based on actual content
4. Say: `/humanize [paste draft]`
5. Post the humanized version
6. Log the engagement

Do NOT post raw drafts. Do NOT skip humanizer to save time. The 10-15 seconds to humanize prevents AI-pattern slop from going live.

This applies to: All automated sessions (X, Reddit, Instagram), manual outreach, DMs, any text that gets posted.

## Session Target — Main vs Isolated for Skills
**Discovered Mar 14:** Isolated sessions cannot access workspace skills. Two solutions:

### Option 1: Install skill globally
```bash
cp -r ~/.openclaw/workspace/skills/<skill-name> ~/.nvm/versions/node/v24.13.1/lib/node_modules/openclaw/skills/
```
Installed globally (Mar 14): `humanizer`

### Option 2: Use `--session main` (PREFERRED)
Cron jobs with `--session main` run in the main session, which has access to workspace skills.

**Cron flag:** `--session main`
**Effect:** Job runs in main session instead of isolated agent
**Benefit:** Can invoke workspace skills directly (e.g., humanizer)

**Outreach session flow (single-session with humanizer):**
```
1. Find post
2. Draft comment → save to drafts/session-N-draft.txt
3. Say: "Humanize this: [paste draft]" → wait for skill output
4. Save humanized output to drafts/session-N-humanized.txt
5. Post from humanized file
6. Log + cleanup
```

**Updated planners (Mar 14):**
- `outreach/instagram/scripts/daily-planner-oc.js` — single-session, humanizer invoke
- `outreach/reddit/scripts/reddit-daily-planner-oc.js` — single-session, humanizer invoke
- `outreach/reddit/scripts/reddit-weekly-poster.js` — single-session, humanizer invoke
- `outreach/x/scripts/x-indie-hacker-planner-oc.js` — single-session, humanizer invoke
- `outreach/x/scripts/x-original-posts-planner.js` — single-session, humanizer invoke

**Why this matters:**
- Single session per comment (not A/B split)
- 50% fewer API calls
- Direct skill invocation (not just reading rules)
- Cleaner flow, easier debugging

## Rule: One Sharp Observation — Not Summary
**Discovered Mar 13:** Comments feel like "observational outsider" when we summarize their struggle back to them. Don't describe their pain from the outside. React from inside the read.

**Wrong (outsider summarizing):**
- "stuck on setup before writing the first query" ← restating what they said
- "burned out with no money left is the hardest checkpoint" ← labeling their experience
- "got traction but nothing converted" ← paraphrasing their post
- "that gap between attention and action" ← analytical observation

**Right (one sharp reaction from inside):**
- Pick ONE thing that hits
- React to it like someone who's felt it
- Don't restate the whole situation
- Don't label their experience
- Don't analyze from above

**Example:**
Post: "Day 32 stuck on MySQL setup. Haven't written a single query."

Wrong: "32 days stuck on setup before writing a single query. that setup tax is brutal." ← summarizing + labeling

Right: "adventureworks should be practice data not the boss fight" ← one sharp observation, assumes shared context

**Test:** If your reply could work as a summary of their post, it's wrong. If it reads like a reaction from someone who's been there, it's right.

This applies to: X replies, Reddit comments, all engagement where we're responding to someone's struggle.

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
- 10 comments/day, 6am–11pm PST
- At least 2 comments per day must be within 90min of each other (natural cluster)
- At least one gap must be 3hrs+ (long break looks human)
- Never evenly spaced — vary gaps between 44min and 4hrs
- Likes: 5-6 per batch, every 2-3hrs, not consecutive within batch

**Target hashtags:**
- Nail (full engagement): #nailslove #nailart #nailsofig #nailinspiration #naildesigner #nailsalon
- Hair (#haircuts #haircut #balayageombre #balayagehair): like only unless caption describes the cut in detail → hype + brief compliment, no question
- Makeup (#makeupgoals): like only by default

**Active crons (Instagram):**
- `ig-daily-planner` — 5:55am PST daily, generates 10 session crons for the day
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
- Total: ~35 likes/day + 10 comments/day
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

## X Original Posts System (added 2026-03-02, updated 2026-03-02)
- 1 original tweet/day, random time 9am–9pm PST
- 4 pillars framework — every post must serve at least one:
  - **Pillar 1 / Mode 1 — Leads (w2):** ICP-aware, talking to salon/beauty biz owners about their problems
  - **Pillar 2 / Mode 2 — Authority (w3):** Strong stances, sharp POV, vocal about what's broken in beauty biz online presence
  - **Pillar 3 / Mode 3 — Build in Public (w3):** Messy middle, real observations, what you actually found
  - **Pillar 4 / Mode 4 — Think Out Loud (w2):** Fan energy, personality, exploration — the glue
- ICP: salon/spa/beauty business owners with weak online presence, broken booking pages, good work not showing up online
- No same mode two days in a row
- Draft bank: `outreach/x/original-posts-guide.md` (10 drafts per mode, 40 total)
- Log: `outreach/x/original-posts-log.json`
- State tracker: `outreach/x/original-posts-state.json`
- Planner: `outreach/x/scripts/x-original-posts-planner.js`
- Cron: `x-original-posts-planner` — 6:04am PST daily
- @ultabeauty added to accounts.md (Beauty Retailers section, full engagement on nail/beauty posts)

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
- **Phase 1** (Feb 26-28): 10 comments/day, hashtag engagement, build comment history
- **Phase 2** (from ~March 1): DMs to US beauty/nail salons with fix-your-page offer — DO NOT start without user approval
- Reminder cron `ig-phase2-reminder` fires Feb 28 10am PST — asks user for go-ahead
- Strategy: `outreach/instagram/strategy.md`

### Reddit Phases
- **Phase 1** (warmup → 50 karma): Consumer subs (r/Nails, r/beauty, r/femalehairadvice etc.) ✅ complete
- **Phase 2** (50+ karma): **ACTIVE as of Mar 5, 2026** (60 karma) — r/Nailtechs, r/hairstylist, r/EstheticianLife + smallbusiness now in rotation
- **Phase 3** (100+ karma): mention fountainofprofit.com when directly relevant — NOT yet
- Weekly karma check cron `reddit-karma-check` fires every Sunday 10am
- Strategy: `outreach/reddit/strategy.md`

## Active crons (Reddit)
- `reddit-daily-planner` (ID: 143b337d) — 6:01am PST daily (staggered after IG + X), generates 3-4 session crons
- `reddit-s1` through `reddit-s3/s4` — created fresh each morning, delete after run
- `reddit-daily-summary` (ID: 93403c50) — 11:21pm PST daily, sends Telegram recap (comments + any post of day + missed sessions)
- `reddit-weekly-poster-tue` (ID: e2b5a3e4) — every Tuesday 10am PST, fires post session 30min-5hrs later
- `reddit-weekly-poster-fri` (ID: a43d5c73) — every Friday 2pm PST, fires post session 30min-5hrs later
- Script: `outreach/reddit/scripts/reddit-daily-planner.js`
- Post script: `outreach/reddit/scripts/reddit-weekly-poster.js`
- Log: `outreach/reddit/engagement-log.json`
- Schedule: `outreach/reddit/today-schedule.json`
- Post tracker: `outreach/reddit/posted-topics.json`
- Post guide: `outreach/reddit/post-guide.md`
- Target subs: r/Nails (priority), r/beauty, r/femalehairadvice, r/SkincareAddicts, r/30PlusSkinCare, r/curlyhair, r/longhair

## Reddit Original Posts System (added 2026-03-01)
- 1-2 original posts/week on Tue + Fri (randomized fire time, not always same hour)
- Format: specific question title + 2-5 sentence personal body (see post-guide.md for full rules)
- Body tone: lowercase, not every sentence punctuated, rambly, first-person but don't START with "I"
- When acknowledging conventional wisdom in body: explain in personal/vague terms why it doesn't feel satisfying (not rhetorical — Reddit will answer literally)
- No em dashes, no banned words, not too polished
- Track all posted topics in posted-topics.json — never recycle within 30 days
- Never post twice in same sub within 7 days
- Never post and comment in same sub same day
- Morning notify sent when post session is scheduled; evening summary includes post URL

## Reddit Automation — ALWAYS use old.reddit.com
New Reddit UI (faceplate custom elements + Shadow DOM) blocks ALL JS text injection. Nothing works.
**Use old.reddit.com** — plain textarea, execCommand works fine.
Flow: navigate to old.reddit.com post → `textarea[name="text"]` → focus + execCommand → `.arrow.up` to upvote → `.save` button to submit → reload + confirm text in page.
  tracker.csv  ← shared outreach tracker
```

## Tone Rules (all 3 platforms — IG, X, Reddit)
- No hyphens `-` or em dashes `—` → use period instead
- No quotation marks → rephrase
- No: weird, resonate, nightmare, amazing, stunning, quiet, especially, vibe/vibes, "is still the move", "not X but Y", genuinely, plot twist, lands, stick, click, "read/reads"
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

---

## Rule: No Fake Identity Anchors (Reddit)
**Discovered Mar 17:** Got muted in r/Nails. In r/smallbusiness, claimed to be a coffee shop owner to match the post — this is the wrong approach.

**New rule:** NEVER claim to own or work in a specific business type to match the post you're replying to.

**Instead:**
- Speak from general operational experience
- OR remove the identity anchor entirely
- Lead with the insight, not the credentials

**Wrong:**
- "As a coffee shop owner, I get it..."
- "Running a salon, I've found..."
- "When I managed my team..."

**Right:**
- "The closing checklist piece is huge..."
- "That inventory timing problem is common..."
- "One approach that works: [insight]"

**Why:** It's more honest, safer (no risk of getting caught), and actually better engagement — the insight matters more than who's saying it.

This applies to: Reddit comments, X replies, any outreach where you're tempted to match the poster's identity.
