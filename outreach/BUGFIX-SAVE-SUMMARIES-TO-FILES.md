# Bug Fix: Save Daily Summaries to Files

**Date:** March 17, 2026  
**Status:** ✅ Complete

---

## Problem

The dashboard had no visibility into daily platform summaries because all three summary scripts sent output to Telegram only — nothing was saved locally.

**Affected scripts:**
1. `outreach/scripts/daily-engagement-summary.js` — Combined summary
2. IG daily summary — Agent prompt (now script)
3. Reddit daily summary — Agent prompt (now script)

---

## Solution

### Step 1 — Created summary directories

```
dashboard/data/summaries/
  engagement/     ← Combined daily summaries
  instagram/      ← IG daily summaries
  reddit/         ← Reddit daily summaries
```

### Step 2 — Updated/Created scripts to save structured data

**1. daily-engagement-summary.js** (updated)
- Saves to: `dashboard/data/summaries/engagement/YYYY-MM-DD.json`
- Structure includes all three platforms + totals

**2. ig-daily-summary.js** (new script)
- Saves to: `dashboard/data/summaries/instagram/YYYY-MM-DD.json`
- Replaces agent prompt with dedicated script

**3. reddit-daily-summary.js** (new script)
- Saves to: `dashboard/data/summaries/reddit/YYYY-MM-DD.json`
- Replaces agent prompt with dedicated script

### Step 3 — Updated cron jobs

```bash
# IG summary
openclaw cron edit 0275551a-a147-48b2-8642-6e01a0da1e37 \
  --message "node /Users/mantisclaw/.openclaw/workspace/outreach/scripts/ig-daily-summary.js"

# Reddit summary
openclaw cron edit ba77475e-9a28-497e-9450-9e2010b95743 \
  --message "node /Users/mantisclaw/.openclaw/workspace/outreach/scripts/reddit-daily-summary.js"
```

---

## Data Structure

All summaries save structured JSON (not formatted text):

```json
{
  "date": "2026-03-17",
  "generated_at": "2026-03-17T07:07:23.315Z",
  "generated_at_pht": "3/17/2026, 3:07:23 PM",
  "platform": "instagram",
  "account": "@stacyd0nna",
  "sessions_completed": 4,
  "sessions_scheduled": 10,
  "sessions_incomplete": 6,
  "comments_posted": 2,
  "likes_only": 8,
  "likes_sent": 35,
  "follows_added": 0,
  "followers": {
    "current": 4,
    "delta": 0
  },
  "follow_backs_needed": 0,
  "raw_summary": "[full formatted text string]"
}
```

### Fields by Platform

**Instagram:**
- `sessions_completed`, `sessions_scheduled`, `sessions_incomplete`
- `comments_posted`, `likes_only`, `likes_sent`
- `follows_added`, `follows_added_details`
- `followers.current`, `followers.delta`
- `follow_backs_needed`, `follow_backs_details`

**Reddit:**
- `sessions_completed`, `sessions_scheduled`, `sessions_incomplete`
- `comments_posted`, `dms_sent`, `posts_posted`
- `karma.post`, `karma.comment`, `karma.total`, `karma.delta`
- `warm_leads.found`, `warm_leads.commented`, `warm_leads.dm_sent`, `warm_leads.replied`
- `dm_details`, `post_details`

**Engagement (Combined):**
- `instagram.*` — All IG fields
- `x.*` — All X fields
- `reddit.*` — All Reddit fields
- `totals.total_sessions`, `totals.total_engagement_received`

**Common fields:**
- `date` — PST date (YYYY-MM-DD)
- `generated_at` — ISO timestamp
- `generated_at_pht` — PHT formatted timestamp
- `platform` — "instagram", "reddit", or "combined"
- `account` — Platform handle
- `raw_summary` — Full formatted text sent to Telegram

---

## Testing Results

**All three scripts tested successfully:**

```bash
# Instagram
$ node scripts/ig-daily-summary.js
✓ Summary saved to: dashboard/data/summaries/instagram/2026-03-17.json
✓ Telegram sent

# Reddit
$ node scripts/reddit-daily-summary.js
✓ Summary saved to: dashboard/data/summaries/reddit/2026-03-17.json
✓ Telegram sent

# Engagement (Combined)
$ node scripts/daily-engagement-summary.js
✓ Summary saved to: dashboard/data/summaries/engagement/2026-03-17.json
✓ Telegram sent
```

---

## Files Changed

| File | Change |
|------|--------|
| `outreach/scripts/daily-engagement-summary.js` | Added file saving logic |
| `outreach/scripts/ig-daily-summary.js` | NEW — replaces agent prompt |
| `outreach/scripts/reddit-daily-summary.js` | NEW — replaces agent prompt |
| `dashboard/data/summaries/engagement/` | NEW directory |
| `dashboard/data/summaries/instagram/` | NEW directory |
| `dashboard/data/summaries/reddit/` | NEW directory |

---

## Cron Jobs Updated

| Cron | ID | New Command |
|------|-----|-------------|
| ig-daily-summary | `0275551a-a147-48b2-8642-6e01a0da1e37` | `node outreach/scripts/ig-daily-summary.js` |
| reddit-daily-summary | `ba77475e-9a28-497e-9450-9e2010b95743` | `node outreach/scripts/reddit-daily-summary.js` |
| engagement-summary-daily | `568c476a-039e-4306-adf1-858ee9a8352b` | (unchanged — already uses script) |

---

## Dashboard Integration (Next Steps)

The dashboard can now read these files to display:
- Historical summary data
- Platform-specific trends
- Session completion rates
- Follower/karma growth over time

**Example dashboard query:**
```javascript
// Read last 7 days of IG summaries
const igSummaries = [];
for (let i = 0; i < 7; i++) {
  const date = getPSTDate(-i);
  const file = `dashboard/data/summaries/instagram/${date}.json`;
  if (fs.existsSync(file)) {
    igSummaries.push(JSON.parse(fs.readFileSync(file)));
  }
}
```

---

## Benefits

1. **Historical archive** — Summaries are now persisted locally
2. **Dashboard visibility** — Structured data can be displayed in dashboard
3. **Trend analysis** — Can compare day-over-day, week-over-week
4. **Backup** — If Telegram history is lost, summaries are still available
5. **Debugging** — Easier to debug issues with saved data

---

## Related Files

- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-engagement-summary.js`
- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/ig-daily-summary.js`
- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/reddit-daily-summary.js`
- `/Users/mantisclaw/.openclaw/workspace/dashboard/data/summaries/`
- `/Users/mantisclaw/.openclaw/workspace/dashboard/data/snapshots.json`
