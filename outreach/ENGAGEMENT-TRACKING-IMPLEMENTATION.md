# Engagement & Follower Tracking Implementation

**Date:** March 13, 2026  
**Implemented by:** OpenClaw agent

---

## What Was Added

### 1. Follower Tracking (Instagram + X)

**Files Created:**
- `/Users/mantisclaw/.openclaw/workspace/outreach/instagram/follower-state.json`
- `/Users/mantisclaw/.openclaw/workspace/outreach/x/follower-state.json`

**Schema:**
```json
{
  "lastCheck": "ISO timestamp",
  "lastCount": 1234,
  "history": [
    {
      "date": "2026-03-13",
      "count": 1234,
      "delta": +5,
      "session": 1
    }
  ]
}
```

**How It Works:**
- Each session (IG + X) starts by navigating to the profile
- Agent captures follower count from the profile page
- Logs count + delta to follower-state.json
- Includes follower count in Telegram session reports

**Scripts Updated:**
- `outreach/instagram/scripts/daily-planner-oc.js` — Added Step 0 (follower check)
- `outreach/x/scripts/x-indie-hacker-planner-oc.js` — Added Step 0 (follower check)

---

### 2. Karma Tracking (Reddit)

**File Created:**
- `/Users/mantisclaw/.openclaw/workspace/outreach/reddit/karma-state.json`

**Schema:**
```json
{
  "lastCheck": "ISO timestamp",
  "lastPostKarma": 50,
  "lastCommentKarma": 100,
  "lastTotalKarma": 150,
  "history": [
    {
      "date": "2026-03-13",
      "postKarma": 50,
      "commentKarma": 100,
      "totalKarma": 150,
      "delta": +10,
      "session": 1
    }
  ]
}
```

**How It Works:**
- Each Reddit session starts by navigating to user profile
- Agent captures post karma, comment karma, and total karma
- Logs karma + delta to karma-state.json
- Includes karma count in Telegram session reports

**Scripts Updated:**
- `outreach/reddit/scripts/reddit-daily-planner-oc.js` — Added Step 0 (karma check)

---

### 2. Engagement Tracking (Likes + Replies on Our Comments)

**Log Schema Updates:**

**Instagram** (`outreach/instagram/engagement-log.json`):
```json
{
  "sessions": [
    {
      "timestamp": "2026-03-13T...",
      "account": "account_name",
      "comment": "our comment text",
      "engagement": {
        "checkedAt": "2026-03-13T...",
        "likesOnOurComment": 3,
        "repliesToOurComment": 1,
        "replyTexts": ["thanks!", "love this"]
      }
    }
  ]
}
```

**X** (`outreach/x/engagement-log.json`):
```json
{
  "sessions": [
    {
      "timestamp": "2026-03-13T...",
      "targetHandle": "@handle",
      "replyText": "our reply text",
      "engagement": {
        "checkedAt": "2026-03-13T...",
        "likesOnOurReply": 2,
        "repliesToOurReply": 0,
        "originalPosterEngaged": false,
        "replyTexts": []
      }
    }
  ]
}
```

**How It Works:**
- After posting comment/reply, wait 60-90 seconds
- Navigate back to the post
- Check likes and replies on our comment
- Log engagement metrics to the session
- Include in Telegram session report

**Scripts Updated:**
- `outreach/instagram/scripts/daily-planner-oc.js` — Added Step 9.5 (engagement check)
- `outreach/x/scripts/x-indie-hacker-planner-oc.js` — Added Step 9.5 (engagement check)

---

### 3. Daily Engagement Summary Cron

**File Created:**
- `/Users/mantisclaw/.openclaw/workspace/outreach/scripts/daily-engagement-summary.js`

**Cron Job:**
- **Name:** `engagement-summary-daily`
- **Schedule:** `30 23 * * *` (11:30 PM PST daily)
- **Timezone:** `America/Los_Angeles`

**What It Reports:**

```
📊 Daily Engagement Summary — Friday, Mar 13

INSTAGRAM (@stacyd0nna)
├ Sessions: 10
├ Comments with engagement: 7/10
├ Total likes on our comments: 23
├ Total replies to our comments: 5
├ Avg likes/comment: 2.3
├ Avg replies/comment: 0.5
└ Followers: 1,234 (+5 today)

🏆 Best IG post: @account_name
   "our comment text..."
   8 likes, 2 replies

X (@stacydonna0x)
├ Sessions: 4
├ Replies with engagement: 3/4
├ Total likes on our replies: 12
├ Total replies to our replies: 2
├ Avg likes/reply: 3.0
├ Avg replies/reply: 0.5
└ Followers: 567 (+3 today)

🏆 Best X reply: @handle
   "our reply text..."
   5 likes, 1 replies

REDDIT (u/Alive_Kick7098)
├ Sessions: 5
├ Comments posted: 5
├ Post karma: 50
├ Comment karma: 100
└ Total karma: 150 (+10 today)

DAY TOTALS
├ Total sessions: 19
├ Total engagement received: 42
├ IG followers: 1,234
├ X followers: 567
└ Reddit karma: 150
```

**Delivery:** Telegram to 6241290513

---

## How To Use

### Check Current Follower Counts
```bash
cat /Users/mantisclaw/.openclaw/workspace/outreach/instagram/follower-state.json
cat /Users/mantisclaw/.openclaw/workspace/outreach/x/follower-state.json
```

### Check Today's Engagement
```bash
# Instagram
cat /Users/mantisclaw/.openclaw/workspace/outreach/instagram/engagement-log.json | jq '.sessions | map(select(.timestamp | startswith("2026-03-13")))'

# X
cat /Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json | jq '.sessions | map(select(.timestamp | startswith("2026-03-13")))'
```

### Run Summary Manually (for testing)
```bash
cd /Users/mantisclaw/.openclaw/workspace
node outreach/scripts/daily-engagement-summary.js
```

### Check Cron Status
```bash
openclaw cron list | grep engagement
```

---

## What This Tells Us

### Follower Tracking
- **Daily delta:** Are we gaining or losing followers?
- **Growth rate:** How many followers per day/week?
- **Correlation:** Do certain types of posts correlate with follower spikes?

### Engagement Tracking
- **Resonance rate:** What % of our comments get engagement?
- **Average engagement:** How many likes/replies do we typically get?
- **Best performers:** Which comments/replies performed best?
- **OP engagement:** Does the original poster engage back?

### Optimization Opportunities
- Identify which hashtags/accounts generate most engagement
- Identify which reply styles get most responses
- Track follower growth against engagement quality
- Find best posting times (via session timestamps)

---

## Next Steps (Optional Enhancements)

1. **Weekly/Monthly Reports** — Aggregate daily summaries into weekly trends
2. **Engagement Rate by Hashtag** — Which hashtags generate most engagement on our comments?
3. **Follow-back Tracking** — Track who follows back after we engage
4. **Reply Thread Depth** — Track how deep conversations go from our comments
5. **Sentiment Analysis** — Are replies positive, neutral, or negative?
6. **Conversion Tracking** — Do engaged users visit our profile? Click links?

---

## Files Modified

| File | Change |
|------|--------|
| `outreach/instagram/scripts/daily-planner-oc.js` | Added follower check (Step 0), engagement check (Step 9.5), updated log schema |
| `outreach/x/scripts/x-indie-hacker-planner-oc.js` | Added follower check (Step 0), engagement check (Step 9.5), updated log schema |
| `outreach/reddit/scripts/reddit-daily-planner-oc.js` | Added karma check (Step 0), updated Telegram report format |
| `outreach/instagram/follower-state.json` | Created (new file) |
| `outreach/x/follower-state.json` | Created (new file) |
| `outreach/reddit/karma-state.json` | Created (new file) |
| `outreach/scripts/daily-engagement-summary.js` | Created (new file) + updated with Reddit karma |
| Cron job `engagement-summary-daily` | Created (11:30 PM PST daily) |

---

## Testing

**Tested:** March 13, 2026 at 4:45 AM PST
- ✅ Follower state files created
- ✅ Daily summary script runs without errors
- ✅ Telegram message sent successfully
- ✅ Cron job created and scheduled

**Next Live Run:** March 14, 2026 at 11:30 PM PST

---

## Notes

- Engagement check waits 60-90 seconds after posting (to allow time for likes/replies)
- Follower count is checked at the START of each session (before any engagement)
- Daily summary runs at 11:30 PM PST (after all sessions for the day are complete)
- Zero engagement is still logged (important for calculating true engagement rate)
