# Heartbeat Checklist

Run this on each scheduled heartbeat. Keep it fast.

## Part 1 — Core agentic payments monitoring

1. Check Twitter for new mentions: "agentic payments", "agent credit card", "AI checkout", "autonomous agent spending"
2. Check Reddit: r/LLMDevs, r/singularity, r/OpenAI for payment/checkout pain point threads
3. Check HN via Algolia API: `https://hn.algolia.com/api/v1/search?query=agentic+payments&tags=story,comment` — also run for "agent credit card", "agent wallet", "AI agent payments"
4. Scan followed accounts for breaking news (see MEMORY.md for account list)
5. Scan news sources in priority order:

   **Priority 1 — Agentic payments specifically (check every run)**
   Search these for: `agentic payments`, `agent payment`, `AI checkout`, `agent credit card`, `machine payments`
   - https://aibusiness.com/generative-ai/agentic-ai
   - https://www.forbes.com/topics/agentic-ai/
   - https://techcrunch.com/category/artificial-intelligence/
   - https://www.bloomberg.com/ai
   - The Verge, The Information

   **Priority 2 — Broader agentic AI breaking news (check every run, flag only if genuinely breaking)**
   Scan the same pages for anything breaking about autonomous agents, agentic systems, or AI agents taking actions — even if not payment-specific. Only flag if it's a major announcement (new product, major company, significant research). Do not flag general AI news.

## Part 2 — Non-obvious use case monitoring

Hunt for pain points at the intersection of: large payment friction + agents can reliably solve it. These audiences are NOT the crypto/builder crowd. Flag anything surprising.

**Price monitoring / auto-buy**
- Twitter/Reddit: "price drop agent", "auto buy when price drops", "Amazon price alert automation", "agent buy automatically"
- Look for: people who want to automate purchases triggered by conditions (price, stock, timing)

**Bulk / repetitive purchasing**
- Twitter/Reddit/LinkedIn: "automate event booking", "bulk reservation agent", "procurement automation agent", "agent purchase workflow"
- Look for: businesses doing the same transaction hundreds of times a month (event venues, supply chain, recurring orders)

**Accessibility / chronic illness**
- Reddit: r/ChronicIllness, r/ChronicPain, r/LongCovid, r/disability, r/blind — search "AI assistant", "AI helps me", "automate shopping"
- Twitter: "AI helps me shop", "agent handles my", "too tired to checkout"
- Look for: people for whom standard checkout is genuinely painful or impossible. Not a convenience story — a necessity story.

**Caregiving / proxy purchasing**
- Reddit: r/CaregiverSupport, r/AgingParents — search "automate purchases", "buy on behalf"
- Look for: people managing purchases for someone else at scale or under cognitive load

## Part 3 — Log and action

5. If anything notable: log to today's memory file under `## Research`
6. For every reply opportunity found on Twitter: run the context validation checklist in AGENTS.md before flagging it
7. If strong reply opportunity passes validation: draft reply and log under `## Replies`
8. If breaking news worth posting: flag under `## Content Queue`
9. If a non-obvious use case is found: log under `## New Verticals` with: the platform, the post/thread, the pain point in one sentence, and why it fits the intersection criteria

Done. Keep this under 2 minutes of context.
