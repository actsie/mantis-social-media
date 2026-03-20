# drafts.json Schema

MantisCAW writes all tweet/reply drafts here. The approval dashboard reads this file.

## Format

```json
[
  {
    "id": "unique-string-id",
    "status": "pending",
    "type": "reply | original | thread",
    "text": "The tweet text (for single tweets)",
    "thread": ["tweet 1/", "tweet 2/", "tweet 3/"],
    "source_post_url": "https://twitter.com/...",
    "source_post_text": "The post we are replying to (first 280 chars)",
    "context": "One sentence on why this is worth engaging with",
    "created_at": "2026-03-20T10:00:00",
    "reviewed_at": null
  }
]
```

## Rules for MantisCAW
- Always write a new draft with `"status": "pending"`
- Always include `context` — it helps Stacy decide quickly
- For replies: always include `source_post_url` and `source_post_text`
- For threads: put each tweet in the `thread` array, leave `text` empty
- Generate a unique `id` using timestamp + short slug, e.g. `"20260320-polymarket-reply"`
- Never modify a draft that already has `"status": "approved"` or `"status": "rejected"`
