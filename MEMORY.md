# MEMORY.md — Long-Term Memory

## Instagram Browser Automation

**`act` with natural language descriptions times out — do NOT use.**
**Use snapshot + ref-based clicks instead.** This is the only reliable method.

**Target same-day posts when possible.** Accounts are actively watching early on — higher chance of a reply. Filter hashtag grids for posts tagged "Xh ago" or today's date before picking a target.

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
