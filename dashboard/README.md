# Mantis Claw Dashboard

Mission control for OpenClaw.

## Status

**Phase 2** - ✅ Complete

## Completed (Phase 1 + Phase 2)

- [x] Project structure
- [x] Data layer (normalized objects)
- [x] Overview tab (daily summary + file diffs)
- [x] Files tab (recent changes)
- [x] Calendar/Cron tab
- [x] X / Content approval queue with feedback
- [x] Memory/docs browser
- [x] Agents list
- [x] Sprint tab with task tracking
- [x] Learnings tab with stats
- [x] Approve/reject flow → feedback store → learnings
- [x] Nightly self-review cron (11:30pm PST)
- [x] File diff preview (git)

## Quick Start

```bash
cd /Users/mantisclaw/.openclaw/workspace/dashboard
node server.js
# Opens at http://localhost:8765
```

Or use the launcher:
```bash
./launch.sh
```

## Data Objects

See `data/schema.md` for normalized object types.

## Features

### Overview Tab
- Daily summary stats (heartbeats, cron runs, files changed, drafts, approvals, agents, failures)
- Recent file changes (last 24h)
- Pending approvals queue with approve/reject buttons

### Files Tab
- Full list of files modified in last 24 hours
- Timestamps and paths

### Cron Tab
- All scheduled jobs from `openclaw cron list`
- Schedule, status, next/last run times

### X / Content Tab
- Draft queue from all platforms (X, Instagram, Reddit)
- Preview, approve, or reject with feedback

### Memory Tab
- MEMORY.md content
- Recent daily logs (last 7 days)
- IDENTITY.md and SOUL.md

### Agents Tab
- Active agents list (TBI - full integration)

### Missions Tab
- Mission tracking (TBI - full integration)

## Data Collection

Data is collected from:
- Workspace files (drafts, logs, memory)
- `openclaw cron list --json` for cron jobs
- File system stats for recent changes

The server regenerates data on each page load for fresh data.
