# pawgrammer-skill-publisher

Commits newly generated skills to the claude-skills repository and sends confirmation emails to requesters.

## What it does

1. Reads pending skill requests from `skill-requester-emails.json`
2. For each pending skill:
   - Verifies the skill .md file exists in `~/claude-skills/content/skills/`
   - Commits and pushes to the claude-skills repo (origin/main)
   - Sends confirmation email via AgentMail to the requester
3. Logs all published skills and sent emails

## Email Configuration

Uses AgentMail for sending:
- **From:** skills-pawgrammer-request@agentmail.to
- **To:** Requester's email (from the Discord message)
- **Subject:** Your skill request is live on Pawgrammer
- **Body:** Confirmation with link to the skill

## Environment

Requires `AGENTMAIL_API_KEY` env var (configured in `~/.openclaw/openclaw.json` under `skills.entries.agentmail.env`)

## Files

- `scripts/skill-publisher.js` — Main publisher script
- `~/claude-skills/` — Skills repository (external)
- `~/.openclaw/workspace/skill-requester-emails.json` — Input: pending requests
- `~/.openclaw/workspace/skill-publisher-log.json` — Output: publish log

## Running

```bash
AGENTMAIL_API_KEY=am_... node ~/.openclaw/workspace/skills/pawgrammer-skill-publisher/scripts/skill-publisher.js
```

Or via OpenClaw cron in main session (needs agentmail skill enabled).

## Pipeline Flow

1. **pawgrammer-skill-requester** (9am daily) → Parses Discord requests, generates skills via Claude Code
2. **pawgrammer-skill-publisher** (runs after requester) → Commits skills, sends emails

Both should run in main session to access agentmail skill.
