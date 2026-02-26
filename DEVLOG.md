# DEVLOG.md — Problems, Solutions & Progress

Running log of issues hit during automation builds and how they were resolved.
Newest entries at the top.

---

## 2026-02-26

### ✅ Cron delivery channel + duplicate session crons — FIXED

**Problem:** All 6 daily crons (3 planners + 3 summaries) used `delivery.channel: "last"`. "Last" resolved to WhatsApp, which requires an E.164 phone number target. All were silently failing. Planners marked themselves as `error`, which caused OpenClaw to **retry the planner**, creating duplicate session crons (2x for IG, X, Reddit). One stale X session (x-s1-0710) ran before cleanup and errored on Telegram send with "Action send requires a target."

**Root cause:**
1. `channel: "last"` = wrong channel (WhatsApp not configured with DM target)
2. Delivery failure → cron retry → duplicate session crons
3. Isolated agent sessions had no Telegram chat context, so `message(target="me")` failed

**Solution:**
- Updated all 9 affected crons (3 planners + 3 summaries + 3 reminders) to `channel: telegram, to: 6241290513, bestEffort: true`
- `bestEffort: true` ensures delivery failure doesn't cause a retry loop
- Removed 15 stale duplicate session crons (3 Reddit + 8 IG + 4 X old sets)
- Telegram chat ID confirmed: `6241290513`

**Status:** ✅ Fixed — takes effect on next daily planner run (tomorrow 5:55 AM+)

---

### ✅ Reddit comment method confirmed — use old.reddit.com
**Problem:** Reddit's new UI uses Faceplate custom web components with Shadow DOM. All JS injection approaches fail: `execCommand`, `nativeInputValueSetter`, `ClipboardEvent paste`, `input` events. The component tracks its own internal state and ignores raw DOM changes.
**Solution:** Use `old.reddit.com` instead. Plain textarea, no shadow DOM, `execCommand('insertText')` works perfectly.
**Flow:**
1. Navigate to `old.reddit.com/r/SUBREDDIT/comments/POST_ID/...`
2. JS: `document.querySelector('textarea[name="text"]')` → focus → `execCommand('insertText', false, text)`
3. JS: `document.querySelector('.arrow.up')?.click()` to upvote post
4. JS: `document.querySelector('.usertext-edit .save, input[value="save"]')?.click()` to submit
5. Reload and confirm with: `document.body.innerText.includes('comment text')`
**Status:** ✅ Working — first two Reddit comments posted

---

## 2026-02-25

### ✅ X DM flow confirmed working
**Flow:** Navigate to target profile → click "Message" button (ref) → textbox appears labeled "Unencrypted message" → `type` into ref → click send button (last button ref in snapshot)
**Notes:**
- "Message" button only appears if target has DMs open — if missing, they've disabled DMs
- "Sync is in progress..." overlay after send = encryption sync, message is delivered, ignore it
- Passcode (1024) required on first DM session load via `/messages/compose` — but going profile → Message button bypasses the compose dialog entirely and goes straight to chat
- First DM sent to @stacydj0x ✅
**Status:** ✅ Working

---

### ❌ Browser service crashes on `fill` action with wrong params
**Problem:** Used `{"kind": "fill", "ref": "eXX", "text": "..."}` — `fill` expects a `fields` array, not `ref` + `text`. Invalid params crash the browser control service entirely (not just a graceful error).
**Solution:** Always use `type` for typing into a single element: `{"kind": "type", "ref": "eXX", "text": "..."}`. Reserve `fill` for multi-field form actions with `fields` array only.
**Status:** ✅ Fixed (rule documented)

---

### ❌ Stale refs crash browser service after dialog open/close
**Problem:** When a dialog appears or dismisses, all `eXX` refs change. Acting on an old ref after a dialog transition errors out, and with X's encrypted DM passcode dialogs this kept happening.
**Solution:** Always re-snapshot after any dialog opens or closes before attempting any click/type. Never reuse refs across snapshots.
**Status:** ✅ Fixed (rule documented)

---

### ❌ X DM flow — passcode required every session
**Problem:** X's new end-to-end encrypted DMs require entering a 4-digit passcode every session before you can access the compose screen. Adds friction to automation.
**Solution:** After navigating to `/messages/compose`, expect the passcode dialog. Enter digits one at a time into the 4 separate textboxes (refs e4–e7), then wait for the search box to appear. Passcode: stored privately.
**Status:** ⚠️ Workaround working but annoying — may revisit if DMs become a regular workflow

---

### ❌ X DM compose — search doesn't surface all accounts
**Problem:** The DM recipient search in the compose dialog only shows people who follow you back (or suggested accounts). @stacydj0x wasn't surfacing for @stacydonna0x search — likely because they don't mutually follow.
**Solution:** DMs are only viable for mutual-follow accounts. Not worth pursuing for cold outreach until account has more followers/credibility.
**Status:** 🚧 Deferred — revisit when account grows

---

### ❌ Replied to wrong OPI tweet
**Problem:** Extracted tweet URLs via JS from @OPI_PRODUCTS profile page. Tried the first URL without verifying content. First URL was a different OPI post (Bubble Bunny SOLD OUT), not the Clawberry Margarita one. Posted comment on wrong tweet, had to delete and repost.
**Root cause:** JS URL extraction order from profile DOM is not guaranteed to match recency or intent. "Replying to @OPI_PRODUCTS" in the dialog gives false confidence — it's always true for any OPI tweet.
**Solution:** After navigating to any tweet URL, always snapshot and confirm 1-2 keywords from the planned reply appear in the article text. If no match, try next URL. Never type before verifying.
**Status:** ✅ Fixed — rule added to `outreach/x/posting-rules.md` and `MEMORY.md`

---

### ❌ Ctrl+Enter doesn't submit X replies
**Problem:** After typing a reply, used Ctrl+Enter to submit. Reply box appeared to clear (text gone) but reply didn't post. Count unchanged.
**Solution:** Always click the Reply button ref directly. Do NOT use Ctrl+Enter — unreliable on X.
**Status:** ✅ Fixed (rule documented)

---

### ❌ `act` with natural language times out on Instagram
**Problem:** Using `browser act` with natural-language descriptions (e.g., "click the like button") reliably times out on Instagram — never executes.
**Solution:** Use snapshot + ref-based clicks only: `{"kind": "click", "ref": "eXX"}`. Always snapshot first to get current refs, then act on specific ref.
**Status:** ✅ Fixed — this is the only reliable IG automation method

---

### ❌ Gateway browser control service crashes occasionally
**Problem:** Browser control service (separate from gateway) crashes on certain invalid actions (bad params, stale refs). Manifests as "Can't reach the OpenClaw browser control service" error.
**Solution:** Run `openclaw gateway restart` to recover. Don't retry browser tool while down — it will keep failing. After restart, re-navigate and re-snapshot from scratch.
**Status:** ⚠️ Known fragility — avoid invalid actions to prevent it

---

## Progress Summary

### ✅ Built & Working
- Instagram daily planner + 8 session crons/day (anti-pattern timing)
- Instagram daily summary cron (11:15pm PST)
- Instagram engagement log
- X daily planner + 4-5 session crons/day (random count, anti-pattern timing)
- X daily summary cron (11:15pm PST)
- X engagement log (seeded with first reply)
- IG + X accounts lists
- Tone guides for both platforms
- Posting rules + safety checklist for X
- Scheduling rules for IG
- First IG comment: @medinanailsbellevue ✅
- First X reply: @OPI_PRODUCTS Clawberry Margarita ✅

### 🚧 In Progress / Deferred
- X DMs — deferred until account has more followers
- X account verification (visiting unverified accounts in accounts.md)
- Reddit system (not started)

### ❌ Known Blockers
- X hashtag search returns empty results in openclaw browser (account may need warmup or different settings)
- X DMs require mutual follow for cold outreach — not viable yet
