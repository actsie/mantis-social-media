# Bug Fix: Engagement Summary + Nightly Review

**Date:** March 17, 2026  
**Status:** ✅ Complete

---

## Problems Fixed

### Bug 1 — Sessions showing 0
**Symptom:** Daily engagement summary reported 0 sessions for all platforms, but individual platform summaries showed sessions occurred.

**Root Cause:** Timezone mismatch — script used UTC date, session timestamps were in PST/PDT.

**Fix:** Created `getTodayPST()` and `toPSTDate()` helpers for consistent PST date handling.

**Result:** 
- Instagram: 0 → **2 sessions** ✅
- Reddit: 0 → **1 session** ✅

---

### Bug 2 — +0 today on karma/followers
**Symptom:** Summary showed "+0 today" for Reddit karma, IG followers, and X followers even when counts changed.

**Root Cause:** No baseline snapshots to compare against.

**Fix:** 
1. Created `dashboard/data/snapshots.json` with historical data
2. Added `calculateDeltaFromSnapshots()` function
3. Updated delta calculation to compare yesterday vs today from snapshots
4. Shows `+--` when no baseline exists (instead of misleading `+0`)

**Result:**
- X followers: +0 → **+4 today** ✅ (19 - 15 = 4)
- Reddit karma: +0 → **+18 today** ✅ (201 - 183 = 18)
- IG followers: +0 → **+0 today** ✅ (4 - 4 = 0, no change)

---

### Bug 3 — Nightly review "undefined: 3 times"
**Symptom:** Recurring issues tracker showed "undefined: 3 times"

**Root Cause:** System/experiment learnings don't have `category` field (only content-type learnings do).

**Fix:** Filter for `type === 'content'` learnings before counting categories.

**Result:** No more "undefined" entries — only content-type learnings are counted.

---

## Files Changed

| File | Change |
|------|--------|
| `outreach/scripts/daily-engagement-summary.js` | Added PST timezone handling, snapshot-based delta calculation |
| `dashboard/data/snapshots.json` | NEW — daily baseline snapshots |
| `dashboard/nightly-review.js` | Filter content-type learnings only |
| `outreach/reddit/karma-state.json` | Added history array for fallback |

---

## New File: snapshots.json

```json
{
  "snapshots": [
    {
      "date": "2026-03-15",
      "reddit_karma": 183,
      "x_followers": 15,
      "ig_followers": 4
    },
    {
      "date": "2026-03-16",
      "reddit_karma": 201,
      "x_followers": 19,
      "ig_followers": 4
    }
  ]
}
```

**Auto-populated daily at 11:59pm PHT** by `daily-snapshots.js` cron.

---

## Delta Calculation Logic

```javascript
// 1. Try snapshots first (preferred)
delta = calculateDeltaFromSnapshots(snapshots, today, key)

// 2. Fallback to history arrays
if (delta === 0) delta = calculateDelta(history, todayPST)

// 3. Format for display
deltaStr = delta === '--' ? '+--' : (delta >= 0 ? '+' + delta : delta)

// Display: "Reddit karma: 201 (+18 today)"
```

---

## Testing Results

**Before fixes:**
```
INSTAGRAM: Sessions: 0, Followers: 4 (+0 today)
X: Sessions: 0, Followers: 19 (+0 today)
REDDIT: Sessions: 0, Karma: 201 (+0 today)

Nightly review: ⚠️ Recurring issues: undefined: 3 times
```

**After fixes:**
```
INSTAGRAM: Sessions: 2, Followers: 4 (+0 today)
X: Sessions: 0, Followers: 19 (+4 today) ← Correct!
REDDIT: Sessions: 1, Karma: 201 (+18 today) ← Correct!

Nightly review: (no undefined entries)
```

---

## New Cron Job (Already Created)

**daily-snapshots** — 11:59pm PHT daily
- Captures IG/X followers, Reddit karma
- Stores in `dashboard/data/snapshots.json`
- Enables accurate delta calculations

---

## Dashboard Learning Logged

System learning saved: `learn-1773730099183`
- Title: "Fixed Engagement Summary Bugs — Sessions + Delta Calculation"
- Type: system
- Verdict: keep

---

## Related Files

- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-engagement-summary.js`
- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-snapshots.js`
- `/Users/mantisclaw/.openclaw/workspace/dashboard/data/snapshots.json`
- `/Users/mantisclaw/.openclaw/workspace/dashboard/nightly-review.js`
- `/Users/mantisclaw/.openclaw/workspace/outreach/instagram/engagement-log.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/instagram/follower-state.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/x/follower-state.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/reddit/karma-state.json`
