# Heartbeat Checklist

Run this on each scheduled heartbeat. Keep it fast.

1. Check Twitter for new mentions: "agentic payments", "agent credit card", "AI checkout", "autonomous agent spending"
2. Check Reddit: r/LLMDevs, r/singularity, r/OpenAI for payment/checkout pain point threads
3. Check HN via Algolia API: `https://hn.algolia.com/api/v1/search?query=agentic+payments&tags=story,comment` — also run for "agent credit card", "agent wallet", "AI agent payments"
4. Scan followed accounts for breaking news (see MEMORY.md for account list)
5. If anything notable: log to today's memory file under `## Research`
6. For every reply opportunity found on Twitter: run the context validation checklist in AGENTS.md before flagging it
7. If strong reply opportunity passes validation: draft reply and log under `## Replies`
6. If breaking news worth posting: flag under `## Content Queue`

Done. Keep this under 2 minutes of context.
