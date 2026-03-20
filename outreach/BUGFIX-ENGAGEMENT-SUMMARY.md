# Bug Fix: Daily Engagement Summary

**Date:** March 17, 2026  
**Fixed by:** Deep-research subagent + manual fixes

---

## Problems

### Bug 1 — Sessions showing 0

**Symptom:** The daily engagement summary reported 0 sessions for all platforms, but individual platform summaries (IG, Reddit) showed sessions did occur.

**Root Cause:** Timezone mismatch in date comparison.
- Script used `new Date().toISOString().split('T')[0]` which returns UTC date
- Session timestamps were in PST/PDT (e.g., `2026-03-16T20:32:00-08:00`)
- A session at 8pm PST on March 16 = March 17 04:00 UTC
- So the session date (March 16 PST) didn't match "today" (March 17 UTC)

**Fix:** 
- Created `getTodayPST()` helper that returns date in PST timezone
- Created `toPSTDate(timestamp)` helper that converts any timestamp to PST date
- All date comparisons now use PST consistently

```javascript
// Before (broken):
const today = new Date().toISOString().split('T')[0]; // UTC date
const sessionDate = s.timestamp.split('T')[0]; // May be PST

// After (fixed):
function getTodayPST() { /* returns YYYY-MM-DD in PST */ }
function toPSTDate(timestamp) { /* converts any timestamp to PST date */ }
const today = getTodayPST();
const sessionDate = toPSTDate(s.timestamp);
```

### Bug 2 — +0 today on karma/followers

**Symptom:** Summary showed "+0 today" for Reddit karma, IG followers, and X followers even when counts had changed.

**Root Cause:** 
1. Reddit karma-state.json had no `history` array — only current state
2. Delta calculation assumed history existed
3. No daily snapshot baseline to compare against

**Fix:**
1. Added `history` array to reddit/karma-state.json with historical snapshots
2. Created `daily-snapshots.js` script that runs at 11:59pm PHT daily
3. Updated delta calculation to properly compare yesterday's baseline vs today

```javascript
// Before (broken):
const redditDelta = redditTodayHistory.length > 0 
  ? redditTodayHistory[redditTodayHistory.length - 1].totalKarma - (redditTodayHistory[0].totalKarma || 0) 
  : 0;
// Always 0 because history was empty

// After (fixed):
function calculateDelta(history, todayPST) {
  const yesterday = getYesterdayPST();
  const yesterdaySnapshots = history.filter(h => toPSTDate(h.timestamp) === yesterday);
  const todaySnapshots = history.filter(h => toPSTDate(h.timestamp) === todayPST);
  
  if (yesterdaySnapshots.length > 0 && todaySnapshots.length > 0) {
    const yesterdayLast = yesterdaySnapshots[yesterdaySnapshots.length - 1];
    const todayLast = todaySnapshots[todaySnapshots.length - 1];
    return todayLast.totalKarma - yesterdayLast.totalKarma;
  }
  // ... fallback logic
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `outreach/scripts/daily-engagement-summary.js` | Complete rewrite with PST timezone handling, proper delta calculation |
| `outreach/scripts/daily-snapshots.js` | NEW — captures daily baselines at 11:59pm PHT |
| `outreach/reddit/karma-state.json` | Added `history` array with historical snapshots |

---

## New Cron Job

**daily-snapshots** — Runs at 11:59pm PHT daily
- Captures Instagram follower count
- Captures X follower count  
- Captures Reddit karma counts
- Stores in respective `history` arrays
- Sends Telegram notification with snapshot summary

```bash
openclaw cron add --name "daily-snapshots" \
  --cron "59 23 * * *" \
  --session main \
  --system-event "node /Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-snapshots.js" \
  --tz "Asia/Manila"
```

---

## Testing Results

**Before fix:**
```
INSTAGRAM: Sessions: 0, Followers: 4 (+0 today)
X: Sessions: 0, Followers: 19 (+0 today)
REDDIT: Sessions: 0, Karma: 201 (+0 today)
```

**After fix:**
```
INSTAGRAM: Sessions: 2, Followers: 4 (+0 today)
X: Sessions: 0, Followers: 19 (+0 today)
REDDIT: Sessions: 1, Karma: 201 (+18 today) ← Correct! (201 - 183 = 18)
```

---

## How It Works Now

### Daily Flow

1. **Throughout the day:** Engagement sessions are logged with PST timestamps
2. **11:59pm PHT:** `daily-snapshots.js` captures baseline counts
3. **11:30pm PHT (next day):** `daily-engagement-summary.js` runs:
   - Filters sessions by PST date (not UTC)
   - Compares today's snapshot vs yesterday's snapshot
   - Calculates accurate deltas
   - Sends Telegram summary

### Timezone Handling

All date operations now use PST/PDT consistently:
```javascript
// Get today's date in PST
function getTodayPST() {
  const now = new Date();
  const pstOptions = { timeZone: 'America/Los_Angeles', ... };
  // Returns "2026-03-16"
}

// Convert any timestamp to PST date
function toPSTDate(timestamp) {
  const date = new Date(timestamp);
  const pstOptions = { timeZone: 'America/Los_Angeles', ... };
  // Returns "2026-03-16"
}
```

---

## Future Improvements

1. **X follower tracking:** Currently X follower-state.json has sparse history. Consider more frequent snapshots (every 6hrs instead of daily).

2. **Engagement delta:** Currently only tracks session counts, not engagement delta (likes/replies received on comments from previous days).

3. **Dashboard integration:** Show snapshot history in the dashboard Changelog or a new "Metrics" tab.

---

## Related Files

- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-engagement-summary.js`
- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-snapshots.js`
- `/Users/mantisclaw/.openclaw/workspace/outreach/instagram/follower-state.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/x/follower-state.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/reddit/karma-state.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/instagram/engagement-log.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/reddit/engagement-log.json`
