# drafts.json Schema

MantisCAW writes all tweet/reply drafts here. The approval dashboard reads this file.

## Format

```json
[
  {
    "id": "unique-string-id",
    "status": "pending",
    "urgency": "breaking | standard",
    "type": "reply | original | thread",
    "text": "The tweet text (for single tweets)",
    "thread": ["tweet 1/", "tweet 2/", "tweet 3/"],
    "source_post_url": "https://twitter.com/...",
    "source_post_text": "The post we are replying to (first 280 chars)",
    "context": "One sentence on why this is worth engaging with",
    "created_at": "2026-03-20T10:00:00",
    "reviewed_at": null,
    "scheduled_for": null,
    "posted_at": null
  }
]
```

## Status flow

`pending` → (human reviews) → `approved` or `rejected` → (cron posts) → `posted` or `post_failed`

## Urgency rules — MantisCAW sets this on every draft

- `"breaking"` — time-sensitive news, reply to a trending thread, or anything where relevance decays within hours. Post within 1-2 hours of approval regardless of time of day.
- `"standard"` — replies, original posts, threads where timing is flexible. Queue for next posting window.

## Posting windows for standard urgency

Weekdays only. Two windows per day (EST):
- **9am EST** — morning window, highest engagement for tech/builder audience
- **1pm EST** — afternoon window

Never post more than 2 items within a 2-hour window. If both windows are full, roll to next day.

## Rules for MantisCAW

- Always write a new draft with `"status": "pending"`
- Always set `"urgency"` — breaking or standard, no omissions
- Always include `context` — it helps Stacy decide quickly
- For replies: always include `source_post_url` and `source_post_text`
- For threads: put each tweet in the `thread` array, leave `text` empty
- Generate a unique `id` using timestamp + short slug, e.g. `"20260320-polymarket-reply"`
- Never modify a draft that already has `"status": "approved"` or `"status": "rejected"`
- Set `scheduled_for` only after approval — the posting cron fills this in, not MantisCAW
