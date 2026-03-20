# X DM Template — @stacydonna0x Outreach

## Purpose
Cold DM outreach to salon/beauty business owners with weak or broken websites.
Goal: get them to reply "yes" so we can send a proposal for a 1-day landing page remake.

---

## Template

> hey this is a random dm but I looked at your site and I think the [SPECIFIC ISSUE] may be making new clients work a little harder than they should before [OUTCOME]. We'd love to do a 1 day landing page remake for [BUSINESS NAME]! If helpful, here's a quick sample of what we mean: https://www.fountainofprofit.com/sample/beauty-salon. If you're curious, reply yes and I'll send details. If not, no worries at all.

---

## Fill-in Guide

| Placeholder | Examples |
|------------|---------|
| `[SPECIFIC ISSUE]` | the booking path / the homepage / the navigation / the contact section |
| `[OUTCOME]` | booking / finding you / reaching out / getting in touch |
| `[BUSINESS NAME]` | their salon/business name (from their bio or website) |

**Keep it specific** — the more the issue sounds like it's about THEM, the better the reply rate.

---

## Tone Rules
- Lead with "hey this is a random dm" — disarms defensiveness
- One specific problem only — don't list multiple issues
- No hype, no "I love your work", no "amazing"
- The ask is just a "yes" — low commitment, easy to respond
- "If not, no worries at all" — removes pressure, increases reply rate
- No quotation marks, no hyphens in the message body

---

## DM Automation Flow

1. Navigate to target's X profile
2. Snapshot → confirm "Message" button is visible (if missing, DMs are disabled — skip)
3. Click Message button (ref)
4. Wait for chat to load → snapshot to get textbox ref ("Unencrypted message")
5. `type` the message into the textbox ref
6. Snapshot → click send button (last button ref in chat)
7. Wait 2-3s → screenshot to confirm message appears in chat
8. Log to `outreach/x/engagement-log.json`: `{ timestamp, account, type: "dm", message, platform: "x" }`

---

## Sent Log

| Date | Account | Sent |
|------|---------|------|
| 2026-02-25 | @stacydj0x | hey this is a random dm but I looked at your site... (test) ✅ |
