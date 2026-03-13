# X Indie Hacker Outreach Workflow

## Daily System

**When:** 6:02 AM PST daily (auto via cron)
**Sessions:** 3-4 per day
**Time per session:** 5-10 min

---

## Workflow

### 1. Search
- Planner picks 1 search query from 25 options
- Navigate to X search with `filter:latest`
- Scan first 2-3 pages of results

### 2. Find Target
**Look for:**
- Real struggle (not humblebragging)
- Stuck between two directions
- No traction / no users after months
- Losing motivation
- Overwhelmed with work/clients
- Losing deals to slow response

**Skip:**
- Design feedback requests ("rate my landing page")
- Success flexes ("just hit $10k MRR!")
- Generic engagement bait ("what are you building?")
- Crypto/web3/NFT projects
- Posts with no substance
- People we engaged with in last 7 days

### 3. Reply
**Formula:**
1. Pull their line that contains the truth
2. What that probably means
3. One cost or consequence
4. Stop early

**Tone:**
- Dry and sharp
- Observational, not preachy
- No "you should" statements
- No em dashes
- No starting with "the"
- 2-4 sentences max

### 4. Like
- Visit their profile
- Like 1-3 posts about:
  - Building in public
  - Startup struggles
  - Their industry (contractor/realtor specific)
- Skip: promo posts, generic motivation

### 5. Follow Decision
**Follow if:**
- Actively building (not just talking)
- Post regularly about journey
- In our ICP (indie hacker, contractor, real estate)
- Content is genuine, not promo-heavy

**Skip if:**
- Mostly promo/spam
- Crypto/web3/NFT focused
- 100K+ followers (can't build real relationship)
- Already followed in last 30 days

### 6. Log
**engagement-log.json:**
```json
{
  "timestamp": "ISO date",
  "type": "indie-hacker",
  "searchQuery": "query used",
  "targetHandle": "@handle",
  "postUrl": "full url",
  "postText": "their post text",
  "replyText": "your reply",
  "liked": true,
  "followed": true/false,
  "platform": "x",
  "account": "stacydonna0x"
}
```

**indie-hacker-tracker.json:**
- Track engaged handles (avoid 7-day repeats)
- Track follows (check for follow-backs weekly)

### 7. Telegram Summary
Send to 6241290513:
- Target handle
- What they're building/struggling with
- Your reply text
- Followed: yes/no

---

## Search Queries (25 total)

**Indie hackers (12):**
- "no traction", "can't get users", "stuck on my"
- "should I keep going", "spent months building"
- "starting to not care", "unfinished SaaS"
- "no one cares" building, "zero revenue"
- "can't ship", "paralyzed" building
- "overwhelmed" founder

**Contractors (7):**
- "can't keep up" contractor
- "too busy to respond", "phone won't stop"
- "missing jobs", "HVAC" overwhelmed
- "landscaping" too busy
- "plumbing" can't keep up

**Real estate (6):**
- "clients not responding" realtor
- "follow up is exhausting"
- "losing deals" slow response
- "too many leads" realtor
- "can't respond fast enough" realtor

---

## Follow-Up System

**Weekly check (Sunday 10 AM):**
- Scan follows from 7+ days ago
- Check if they followed back
- If yes: engage with their recent post
- If no: no action needed (not a numbers game)

**Monthly review:**
- Which replies got responses?
- Which led to conversations?
- Which search queries find best targets?
- Adjust queries and tone based on learnings

---

## Rules

1. **Quality over quantity** — 3-4 good replies beats 10 generic ones
2. **No pitching** — we're building relationships, not closing deals
3. **Real people only** — if it feels off, skip it
4. **Don't force it** — if no good targets, log as skipped
5. **Track everything** — data tells us what works
