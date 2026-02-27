# Session Findings & Retrospective

Last updated: 2026-02-26/27 (first major session)

---

## 🎯 What We Were Trying To Do

Build a fully automated daily social media outreach system across 3 platforms (Instagram, X/Twitter, Reddit) for the fountainofprofit.com / fix-your-page project. Accounts: **stacyd0nna** (IG), **@stacydonna0x** (X), **u/Alive_Kick7098** (Reddit).

Also: began creating a second IG account (donna.fop) for scaling.

---

## ✅ What Worked

### Browser Automation (general)
- OpenClaw browser (`profile="openclaw"`) works reliably for IG, X, Reddit automation
- Snapshot → ref-based click is the only reliable way to interact with IG/X
- JS `execCommand('insertText')` works for injecting long comment text into IG comment boxes
- CDP (Chrome DevTools Protocol) direct WebSocket access works via Node.js using OpenClaw's bundled `ws` module at `/Users/mantisclaw/.nvm/versions/node/v24.13.1/lib/node_modules/openclaw/node_modules/ws`
- Created incognito browser contexts via CDP `Target.createBrowserContext` + `Target.createTarget` — this is a valid workaround for needing a clean session without logging out of existing accounts
- Reddit automation: `old.reddit.com` works perfectly. Plain textarea, `execCommand` injection, `.arrow.up` upvote, `.save` submit

### Cron & Infrastructure
- Fixed all 9 daily crons to deliver via Telegram (`channel: telegram, to: 6241290513, bestEffort: true`)
- `bestEffort: true` is critical — prevents delivery failures from triggering planner retries (which caused 15 duplicate session crons)
- All planner scripts now bake in `target="6241290513"` explicitly — isolated cron sessions have no chat context and can't infer the Telegram target
- `browser.defaultProfile: "openclaw"` set globally in `~/.openclaw/openclaw.json`
- Created `_oc.js` versions of all 3 planners with explicit `profile="openclaw"` instruction
- Session export: can pull full conversation history from `~/.openclaw/agents/main/sessions/*.jsonl`

### Instagram
- `act` with natural language descriptions times out — snapshot + ref-based clicks only
- Liking posts works cleanly via ref clicks
- Commenting works via: click comment box ref → JS `execCommand` inject → click Post button ref
- Same-day posts (tagged "Xh ago") get better engagement than older ones
- Fallback to `accounts.md` when no same-day hashtag post found works well

### X (Twitter)
- Pre-post content verification is mandatory (learned the hard way — see Errors)
- Reply submission: always click Reply button ref, never Ctrl+Enter
- Snapshot → read tweet content → confirm keywords → then reply

### Reddit
- `old.reddit.com` is mandatory — new Reddit UI uses Shadow DOM, nothing works there
- Flow: navigate → focus textarea → execCommand inject → upvote → save → reload to confirm

### Google Sheets
- Can read sheet data via `gviz/tq?tqx=out:csv` endpoint without authentication
- Can open sheet in openclaw browser for visual editing
- Sheet has 53 rows: SF businesses (mostly sent) + Chicago businesses (mix of sent/unsent/missing emails)

---

## ❌ What Didn't Work / Couldn't Do

### Chrome Extension Relay
- Requires manual click on OpenClaw Browser Relay toolbar icon in Chrome every session
- All morning sessions on 2/26 failed because relay wasn't attached
- **Not suitable for scheduled/automated sessions** — only useful for live manual takeovers
- Solution: always use `profile="openclaw"` for automation

### Instagram Signup via Browser Automation
- Form filling works (email, password, name, username all fillable via `type` action)
- Birthday custom div-comboboxes: must click them FIRST before filling text fields, otherwise JS interactions reset the form
- Critical failure: JS-based field filling (`nativeInputValueSetter` approach) breaks React's internal state → Instagram's backend loses the registration session → email verification codes fail with "An error occurred during your registration"
- Root cause: when form state is corrupted, Instagram issues a code tied to a broken session. The code itself is valid but the session it maps to doesn't exist
- Proton Mail: Instagram sent the codes fine, but registration kept failing — likely IP/session conflict from multiple failed attempts + possible soft-block
- **Workaround needed:** User must complete account creation manually in their own browser, OR use Chrome relay on the signup tab

### Google Account Signup via Browser Automation
- Name, birthday, gender, email selection, password steps all completed successfully via automation
- **Blocked at:** QR code phone verification (Google's bot detection)
- The page polls for verification via JavaScript in real-time
- Reloading the page after QR scan reset the entire verification session
- `bestEffort` workaround: user must scan QR code and complete phone verification while the browser tab stays open and untouched — any reload kills it
- Verification timed out twice even with successful QR scans
- **Status:** Gmail account `tonedonna0@gmail.com` NOT yet created — needs manual completion

### `act` with natural language
- Times out on Instagram — not reliable
- Snapshot + explicit ref clicks is the only approach that works

### New Reddit UI
- Shadow DOM blocks all JS text injection
- `execCommand` doesn't work on faceplate custom elements
- Must use old.reddit.com

---

## ⚠️ Friction Points & Corrections from User

### Corrections
- **X engagement log malformed JSON:** nailogical entry was outside the `sessions` array — fixed manually
- **Summary crons reading wrong path:** `ig-daily-summary` was reading `outreach/engagement-log.json` instead of `outreach/instagram/engagement-log.json` — fixed
- **Summary crons missing Telegram target:** All 3 summary crons said "send to Telegram" but didn't include `target=6241290513` → "Action send requires a target" error on every run — fixed
- **Tone violations in drafts:** Comments had hyphens, quotation marks, banned words (weird, resonate, nightmare, especially, vibe) — rules added to all 3 tone guides
- **Stale crons fired before cleanup:** x-s1-0710 already posted to @N_P_Society (2021 tweet) and @hannahroxit (2022 tweet) before I could kill them — flagged in engagement log
- **Wrong tweet, wrong comment:** Posted Clawberry Margarita comment on Bubble Bunny tweet (Feb 25) — root cause: didn't verify tweet content before posting. Pre-post checklist added to X posting rules

### Friction Points
- Element refs go stale after every page interaction in Google Sheets — need fresh snapshot before each click
- Birthday comboboxes on Instagram (div-based, not native select) are fragile — must use JS click → find option → click pattern, not `select` action
- Instagram signup form resets if you interact with the birthday combobox after filling text fields — birthday must be set first
- Google Sheets "anyone with link can edit" doesn't help when the browser isn't logged in — sheet is readable but editing requires sign-in or Chrome relay
- OpenClaw browser profile has no Google account — Google signup QR verification can't complete because the page needs continuous JS polling that automation disrupts

---

## 🔧 Bugs Fixed This Session

| Bug | Fix |
|-----|-----|
| All crons delivering to WhatsApp | Changed to `channel: telegram, to: 6241290513, bestEffort: true` |
| Planner retries creating duplicate session crons | Added `bestEffort: true` |
| Isolated sessions can't find Telegram target | Baked `target="6241290513"` into all planner task messages |
| Browser defaulting to Chrome relay | Set `browser.defaultProfile: "openclaw"` globally |
| IG summary reading wrong log file path | Fixed path to `outreach/instagram/engagement-log.json` |
| X + Reddit summaries missing Telegram target | Added explicit `target=6241290513` to task messages |
| X engagement log malformed JSON | Fixed nailogical entry position |
| Session crons not including post links in notifications | Updated all 3 planners — notifications now include post URL + comment/reply permalink |

---

## 📋 Pending / In Progress

- [ ] **donna.fop Instagram account** — needs Gmail first (`tonedonna0@gmail.com` not yet created, blocked at Google QR verification)
- [ ] **Email research for sheet rows 34–53** — ~15 Chicago businesses missing emails
- [ ] **Email drafts for Chicago rows 24–32** — have emails, not sent yet
- [ ] **Find active X nail creators** to replace 3 removed from rotation (only 4 confirmed: @holotaco, @OPI_PRODUCTS, @essie, @N_P_Society — though N_P_Society is inactive Jan 2021)
- [ ] **Phase 2 decision** — IG DM outreach starts Feb 28 pending user approval (`ig-phase2-reminder` cron fires Feb 28 10am)
- [ ] **Reddit Phase 2** — unlocks at 50 karma (currently 1)

---

## 💡 Lessons Learned

1. **Always use `profile="openclaw"` for automation** — Chrome relay is for live manual sessions only
2. **`bestEffort: true` on all cron delivery** — prevents retry loops that snowball into duplicate jobs
3. **Explicit Telegram targets in every cron task** — isolated sessions have zero context
4. **Snapshot before every ref-based interaction** — refs go stale, always refresh
5. **Birthday fields first on IG signup** — div comboboxes corrupt React state if used after text fields
6. **Never use JS `nativeInputValueSetter` for signup forms** — breaks backend session tracking
7. **old.reddit.com always** — new Reddit UI is automation-proof
8. **Pre-verify tweet content before posting** — "replying to @handle" is not enough confirmation
9. **CDP direct WebSocket works** via OpenClaw's bundled `ws` module — useful for incognito contexts, new browser contexts, etc.
10. **Google signup QR verification needs uninterrupted live browser session** — no reloads, no automation interference during the polling window

---

## 📝 Research Tone Rule (added 2026-02-27)

**Page observation tone:** Keep it positive, specific, and non-judgmental.
- ✅ "The celebrity gallery is lower on the page — there's an opportunity to bring it higher since those are powerful trust signals for first-time visitors"
- ✅ "The booking button sits alongside two gift card CTAs — a visitor booking for the first time has to scan across all three"
- ❌ "The body copy is generic/template"
- ❌ "The section looks unfinished"
- ❌ "The site doesn't communicate X" (implied failure)

Frame as: what I noticed + what it could do, not what's wrong.
