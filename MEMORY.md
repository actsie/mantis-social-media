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

## Project: fountainofprofit.com / fix-your-page

Outreach service targeting salon + beauty business owners with broken/weak websites.

- Accounts: **stacyd0nna** (IG), **@stacydonna0x** (X)
- Tracker: `/Users/mantisclaw/.openclaw/workspace/outreach/tracker.csv`
- Tone guide: `/Users/mantisclaw/.openclaw/workspace/outreach/tone-guide.md`
- Comment drafts: `/Users/mantisclaw/.openclaw/workspace/outreach/comment-drafts.md`
- JS inject method for IG comments (long text): click comment box → `document.execCommand('insertText', false, 'text')`
- No markdown, no hyphens, no quotation marks in drafts
- Banned words: weird, resonate, nightmare, quiet (and variants)
