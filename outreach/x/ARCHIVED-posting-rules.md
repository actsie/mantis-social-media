# X Posting Rules — Automation & Safety

## Pre-Post Checklist (mandatory every session)

Before typing ANY reply, confirm:

1. **Navigate to the tweet URL**
2. **Snapshot the page** — read the article text in the Conversation region
3. **Match keywords** — confirm 1-2 words from your planned reply appear in the tweet text
   - e.g., replying about "clawberry margarita" → tweet must contain "clawberry" or "margarita"
4. **If no match** — do not post. Check the next URL or re-extract tweet list.
5. Only then: click textbox → type → click Reply button

**Never rely on "Replying to @OPI_PRODUCTS" as confirmation** — that text appears for any tweet on that account's page.

---

## What Went Wrong (Feb 25, 2026)

- Used JS to extract tweet URLs from OPI's profile: `document.querySelectorAll('a[href*="/status/"]')`
- Got 3 URLs back — tried first one without verifying content
- First URL (`/status/2026794336495481012`) = Bubble Bunny SOLD OUT post (wrong)
- Typed and submitted "clawberry margarita has no right being this good of a name" on the wrong tweet
- Had to delete it and re-post on the correct tweet (`/status/2026431208503038355`)

**Root cause:** Tweet URL order from JS extraction is not guaranteed to match tweet order or intent. Always verify content, not just URL.

---

## How to Extract + Verify the Right Tweet

```js
// Step 1: Extract URLs from profile
document.querySelectorAll('a[href*="/status/"]').map(a => a.href)

// Step 2: Navigate to candidate URL
// Step 3: After page loads, snapshot → read article text in Conversation region
// Step 4: Confirm tweet content matches your intent before typing
```

---

## Delete Flow (if you post on wrong tweet)

1. Find your article in the snapshot
2. JS: `document.querySelectorAll('article')` → find one with your text → click `[data-testid="caret"]`
3. Snapshot → click menuitem "Delete" (ref)
4. Confirm dialog → click "Delete" button

---

## Reply Submission Rules

- Always click the **Reply button** (ref from snapshot) — do NOT use Ctrl+Enter (unreliable)
- After clicking Reply, wait 3-4s then snapshot to confirm your article appears in the thread
- Confirm reply count increased on the parent tweet

---

## Known Good Tweet URLs (verified)

| Account | Tweet ID | Content | Date |
|---------|----------|---------|------|
| @OPI_PRODUCTS | 2026431208503038355 | "Clawberry Margarita" spring gel polish | Feb 24, 2026 |
