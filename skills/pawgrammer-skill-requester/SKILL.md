# pawgrammer-skill-requester

Discord bot that monitors the skill requests channel, parses incoming requests, and generates skill .md files via Claude Code.

## What it does

1. Connects to Discord using `DISCORD_BOT_TOKEN` env var
2. Polls channel `1429050423976919082` for new skill request messages (embeds from Pawgrammer-Skills-Reporter bot)
3. For each new request with `🎯 New Skill Request` marker:
   - Parses embed fields: skill name, description, use case, email
   - Checks if skill already exists in `~/claude-skills/content/skills/`
   - Spawns Claude Code to research and generate the skill .md file
   - Runs security check on generated file
   - **Immediately commits and pushes to claude-skills repo** (origin/main)
   - **Immediately sends confirmation email via AgentMail** to requester
   - Marks message as processed in tracker

## Files

- `scripts/skill-requester.js` — main Discord bot script
- `skills/pawgrammer-skill-requester/` — this skill directory

## Setup

1. Ensure `DISCORD_BOT_TOKEN` is set in `~/.openclaw/openclaw.json` env section
2. Bot must have `Read Messages`, `Send Messages`, `Read Message History` permissions in channel 1429050423976919082
3. Tracker file auto-created at `~/.openclaw/workspace/skill-requests-processed.json`

## Running

```bash
node ~/.openclaw/workspace/skills/pawgrammer-skill-requester/scripts/skill-requester.js
```

Or via cron in OpenClaw for scheduled runs.

## Message format expected

**Pawgrammer form submissions** (from Pawgrammer-Skills-Reporter bot):

```
🎯 New Skill Request
Skill Name: [skill name]
Description: [what it does]
Use Case: [who needs it and why]
Email: [requester email for followup]
```

The bot filters for `🎯 New Skill Request` marker to identify real form submissions.
Flexible parsing — extracts what it can even if format varies.

## Security

- All generated skills run through security check before being passed to publisher
- No external API calls except Discord and Claude Code
- Processed message IDs tracked to prevent duplicates
