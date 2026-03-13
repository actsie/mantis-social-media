# Warm Lead DM System — Reddit

## Overview

Automated system for sending DMs to warm leads identified through complaint monitoring in r/smallbusiness and related subs.

## Files

```
outreach/reddit/
  warm-leads.json          ← Active leads with status tracking
  dm-templates.json        ← Pain-type specific DM templates
  scripts/
    reddit-daily-planner.js    ← Logs warm leads during complaint search
    reddit-dm-sender.js        ← Sends DMs to ready leads
```

## Flow

### 1. Lead Discovery (6:01 AM PST daily)
- `reddit-daily-planner.js` runs
- Searches r/smallbusiness for complaint keywords
- Logs warm/hot leads to both `inbound-leads.json` AND `warm-leads.json`
- Detects pain type from post title/text

### 2. Comment Phase (during engagement sessions)
- When commenting on a warm/hot lead post
- Update lead status: `found` → `commented`
- Set `commentedAt` timestamp
- Set `dmReadyAt` = commentedAt + 2-24hrs (randomized)

### 3. DM Phase (2:00 PM PST daily)
- `reddit-dm-sender.js` runs via cron
- Finds leads where `status === "commented"` AND `dmReadyAt < now`
- Sends DM via browser automation (old.reddit.com)
- Updates status: `commented` → `dm-sent`
- Logs to `engagement-log.json`

## Status Flow

```
found → commented → dm-ready → dm-sent → replied | no-reply
```

| Status | Meaning |
|--------|---------|
| `found` | Lead identified, not yet engaged |
| `commented` | Public comment posted, waiting for dmReadyAt window |
| `dm-ready` | Ready to send DM (2-24hr delay passed) |
| `dm-sent` | DM sent, waiting for reply |
| `replied` | Lead responded - move to sales convo |
| `no-reply` | No reply after 5-7 days, archive |

## DM Templates

Templates are keyed by pain type in `dm-templates.json`:

- `chaos/no-systems` — Business owners doing everything manually
- `communication-overload` — Drowning in DMs/texts across apps
- `burnout/overwhelm` — Content creation or operational overwhelm
- `instability/growth-frustration` — Anxiety about client retention

## Rules

1. **Never DM before commenting** — Warmup first with public value
2. **2-24hr delay after comment** — Doesn't look like immediate pitch
3. **1 DM per lead max** — No follow-up DMs unless they reply
4. **Skip if post <2hrs old** — Let comment breathe first
5. **Max 5 DMs per run** — Avoid spam behavior
6. **Track all sends** — Avoid duplicates if script re-runs

## Active Crons

| Cron | Time | Purpose |
|------|------|---------|
| `reddit-daily-planner` | 6:01 AM PST | Generate schedule + complaint search |
| `reddit-dm-sender` | 2:00 PM PST | Send DMs to ready leads |
| `reddit-daily-summary` | 11:21 PM PST | Daily recap (includes DM activity) |

## Manual Commands

```bash
# Run DM sender manually (test)
node /Users/mantisclaw/.openclaw/workspace/outreach/reddit/scripts/reddit-dm-sender.js

# View warm leads
cat /Users/mantisclaw/.openclaw/workspace/outreach/reddit/warm-leads.json | jq '.leads[] | {author, status, painType}'
```

## DM Template Structure

```
hey, saw your post about [specific thing].
that [gets messy fast / is such an easy time sink / is brutal].
we've been helping [type of business] with that kind of problem, mainly around [one narrow outcome].
just thought I'd reach out. no pressure either way. happy to share more if useful.
```

Key principles:
- Human opener (not "figured I'd reach out")
- Specific observation (shows you read the post)
- Small relevant offer (not full solution dump)
- Easy out (no pressure)
