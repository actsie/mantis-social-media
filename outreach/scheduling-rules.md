# Scheduling Rules — Instagram Engagement

## Comment Schedule
- **Frequency:** 8/day (review week of March 2 — scale to 10-12 if no issues)
- **Window:** 6:00am – 11:00pm PST
- **Anti-pattern rules (must all be satisfied each day):**
  - At least 2 comments must be within 90min of each other (natural cluster)
  - At least one gap between comments must be 3hrs or more (long human break)
  - No evenly-spaced intervals — gaps should range from ~45min to ~4hrs
  - Aim for 1-2 natural "pairs" (comments close together) and 1-2 long breaks per day

## Like Schedule
- **Frequency:** 5-6 likes per batch, 7 batches/day (~37 likes total)
- **Window:** 6:00am – 11:00pm PST
- **Batch spacing:** Every 2-3 hours (randomized)
- **Within batch:** Likes spaced 8-18 minutes apart — never back to back

## Pattern Check (before scheduling each day)
- Read `engagement-log.json` for last 48hrs
- If gaps from prior 2 days look uniform, shift today's times by ±3-8min
- Flag if same hour is used 3+ days in a row for first comment of day

## Review
- Monday March 2, 2026 at 10am PST — review frequency, replies received, any action blocks
