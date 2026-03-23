# Long-Term Memory — Agent Card Social

*Last updated: 2026-03-19 by community mapping run*

---

## Config — Notification Webhooks

**Discord — #mantiscaw-queue**
Webhook: `https://discord.com/api/webhooks/1484473424200863754/_dN2tqjeUiqE4OPpDqnVfq9_W2b3m4r-dCvqhfEDUpaWS_iMT0D0phduUu--8q68eS1W`
Username: `MantisCAW`
Use `[BREAKING]` label for urgency: breaking, `[DRAFT]` for urgency: standard.

**Slack — placeholder**
Webhook: not set yet. Skip silently if empty.

*To set up Slack notifications:*
1. Go to your Slack workspace → Apps → search "Incoming Webhooks" → Add to Slack
2. Pick the channel you want notifications in → click Allow
3. Copy the webhook URL it gives you
4. Save it to openclaw env as `SLACK_WEBHOOK_AGENTCARD` (same way Discord was saved)
5. Notifications will start firing automatically — no code changes needed

**Telegram — session-only for now (no autonomous notifications)**
Currently sends inline during active sessions only. Does not fire from crons.

*To set up proper autonomous Telegram notifications:*
1. Message @BotFather on Telegram → send `/newbot` → follow the prompts → copy the bot token
2. Add the bot to whatever group or DM you want notifications in
3. Get your chat ID: send any message to the bot, then open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser — the chat ID is in the response under `message.chat.id`
4. Save both to openclaw env: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
5. Update `notify-draft.js` to POST to `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` with `chat_id` and `text` fields
6. Crons will then notify Telegram autonomously without a session open

**Approval dashboard URL:** `http://localhost:8901/tweets`

---

## About Agent Card

A payment card for AI agents. Live today, open to all — not just businesses.

**What agents can do with it:**
- Pay for inference and APIs
- Order from consumer platforms (DoorDash, Amazon, Uber)
- Run marketing spend
- Trade on Polymarket 24/7

**Key words:** Instant. Private. Reusable.

**Major traction signal:** PolyMarket retweet → 400k views.

**Current audience bias:** Heavily crypto/Polymarket due to launch partners. Actively expanding to broader use cases — elder care, accessibility, bulk purchasing, price monitoring.

**Target audience:** Builders and founders shipping agentic systems who hit payment/checkout friction. Also: anyone whose agent needs to buy things autonomously.

**Competitors in-market:** Stripe/Tempo MPP, Coinbase x402, Visa agent CLI, Google AP2, OpenAI/Stripe ACP, True Link Financial (elder/disability incumbent).

---

## Twitter: High-signal search terms

### "agentic payments" — HIGH SIGNAL (check daily)
Active conversation happening right now. 10+ posts/hour during this mapping run.
- Notable post: @contofinance QRTing @KenWattana article "Agentic Payments Are the Wild West — Enterprises Need a Control Layer" — framing Agent Card's exact value prop (https://x.com/contofinance/status/2034843970237509858)
- @mbarrbosa (122 views, 2 reposts): "not doing a new kind of x402, another agentic payments SDK..." — signals the space is already feeling crowded. (https://x.com/mbarrbosa/status/2034842793219064151)
- @GG_Observatory replying to @brian_armstrong: "x402 is the missing payment layer for AI agents... We're probably 3-5 years from agentic payments being mainstream, but the infrastructure is already being built today."
- Recurring accounts in this stream: @KenWattana (publishes articles on agentic payment infrastructure), @contofinance (enterprise control layer product), @mbarrbosa (builder in the space, building SelfClaw economy layer)

### "AI agent payments" — VERY HIGH SIGNAL (check daily, multiple times)
This is the hottest term right now. Major institutional moves happening this week.
- @arcanexis (4h ago): "this week in AI agent payments: Visa: CLI for agents to make card payments. Stripe/Tempo: machine payments protocol live. Coinbase x402: integrated by Sam Altman's World. Visa. Stripe. Coinbase. OpenAI. all shipping rails for machines. same week. the agentic economy is here." — IMMEDIATE ENGAGEMENT OPPORTUNITY
- @grok (replying to @bugerpepper @marilyn100x @stripe): Grok analyzing market share projections — MPP (Stripe/Tempo) 60-70% by 2027, x402 (Coinbase) early crypto lead
- Breaking news: Coinbase competing for Cloudflare partnership to issue stablecoin for AI payments (The Information, cited by @StanleyFcb01)
- @KirillTalai: "Visa just launched AI agent payments on crypto rails. Once agents are transacting autonomously 15 hours straight, a single chain going down isn't an inconvenience. It's a systemic risk." (302 views, 4 likes — engaged conversation)

### "agent credit card" — MEDIUM SIGNAL (check weekly)
Mostly consumer/casual use of the phrase, not technical builders. One relevant exception:
- @NanakNihal (Feb 19, 427 views, 11 likes): "Someone should make a give your agent credit card -> tell agent to make free trial on websites when you want a trial -> agent automakes and remembers to unsubscribe before deadline flow" — real user pain point, spontaneous product ideation
- @VinceGlakas (to @ycombinator @garrytan): describing friction of needing an agent credit card to order pizza. Shows consumer-facing friction is real.

### "AI checkout" + agent — MEDIUM SIGNAL (check weekly)
Mostly older posts (Jan-Feb), less active right now.
- Google Universal Commerce Protocol announced — open standard for AI checkout in Search + Gemini (Ant International + Google, Jan)
- @Vocalize: "The real prize isn't AI checkout. It's the discovery-to-destination moment."
- More relevant for content/news angle than monitoring for engagement opportunities.

### "LLM payments" OR "agent wallet" — MEDIUM SIGNAL (check weekly)
- @zengjiajun_eth: "Give your agent an ethereum native agent wallet @elytro_eth" — builder actively working on this
- @exploitless (replying to @brian_armstrong): "Sybil attack threats through mass agent wallet creation are coming. More agents than humans means more fake agents than real ones." — key concern/conversation
- @connyb: design challenge — "I've been trying to design an agent-wallet too but haven't found a satisfactory model yet." — pain point, engagement opportunity

### "autonomous agent spending" OR "machine payments" — HIGH SIGNAL (check daily)
- @tmel0211 (Haotian, crypto analyst, 7m ago, 293 views, 6 likes): discussing x402 protocol mainstream adoption — AWS hype, Circle earnings, Mastercard backing. Key commentator.
- @mpptimetempo: dedicated MPP/Tempo watcher account — monitor this
- "Machine Payments Protocol" is the Stripe/Tempo branded term — monitor separately

### "agents buying" OR "AI agent billing" — MEDIUM SIGNAL (check weekly)
Mostly crypto/DeFi angle, less relevant to Agent Card's positioning.
- @joelhooks (educator, 681 views, 11 likes): "agents buying courses is wild to think about lol" — shows the idea is breaking into mainstream consciousness
- @xiner: "Machine-to-machine payments are coming. Robots paying robots. AI agents buying compute." — ambient narrative

### "AI agent can't pay" — LOW SIGNAL (zero relevant results)
Nobody is using this exact phrase. Skip. Replace with monitoring for "agent payment friction" or "checkout failed agent."

---

## Twitter: Accounts to monitor daily

### Tier 1 — Core voices, check every day

**@brian_armstrong** (Coinbase CEO, ~1.8M followers)
- Actively posting about agent payments, x402 protocol. Multiple conversations referencing him daily. Coinbase competing with Cloudflare for AI payment rails. Any post from him on this topic is breaking news.

**@stripe** (~800K followers)
- Launched Machine Payments Protocol (MPP) via Tempo. Critical infrastructure player. Monitor for any agent payment announcements.

**@KenWattana** (fintech/AI writer, unknown followers)
- Published article "Agentic Payments Are the Wild West" this week. Getting quoted and cited. Active in this specific conversation.

**@contofinance** (enterprise agent payment controls product)
- Directly in Agent Card's competitive space. Posts about control layers for agentic payments. Watch for product announcements.

**@mbarrbosa** (builder, @SelfClaw economy layer)
- Active builder working on agent economy primitives. 2 reposts, 4 likes, 122 views on a single post. Engaged community around them.

**@tmel0211 / Haotian** (Chinese crypto/AI analyst, 200K+ followers)
- One of the most engaged crypto-meets-AI voices. Posts analysis of x402, MPP, Circle agent payment data. 293 views, 6 likes in 7 minutes. High-signal commentary.

**@arcanexis** (AI/agent infrastructure watcher)
- Publishes "this week in AI agent payments" style summaries. Good signal aggregator.

**@mpp (Machine Payments Protocol)** — already appearing in "Who to follow" recommendations
- Stripe's Tempo protocol account. Official announcements.

### Tier 2 — Check 2-3x/week

**@KirillTalai** (crypto/AI infrastructure, 300+ views on agent payment threads)
- Thoughtful analysis on systemic risks of agentic payments. Engaged comment threads.

**@GG_Observatory** (AI infrastructure analyst)
- Replying to @brian_armstrong with substantive takes. 56 views, 3 likes on reply about x402 being the missing payment layer.

**@exploitless** (security angle)
- Raised Sybil attack concern in agent wallet context. This is a differentiated angle Agent Card could address.

**@aixbt_agent** (mentioned in AI agent payments conversations)
- AI agent with own account making payments commentary. Meta-signal.

**@martypartymusic** (crypto/AI, Kirill engaged with them)
- Active in agent payment debates.

---

## Reddit: Active subreddits (worth monitoring)

### r/LLMDevs — MONITOR WEEKLY (high relevance, low volume)
Active but niche. Most relevant subreddit for the exact builder audience Agent Card cares about.
- Direct hit: "How do I See the Infrastructure Battle for AI Agent Payments, after the Emergence of AP2 and ACP" — discusses Google AP2 vs OpenAI/Stripe ACP protocol war (https://old.reddit.com/r/LLMDevs/comments/1o5olpl/how_do_i_see_the_infrastructure_battle_for_ai/)
- Direct hit: "Built this AI-powered commerce site in a weekend using Claude Code + MCP + Agent-to-Agent protocols" — builder demo with Stripe checkout agent (https://old.reddit.com/r/LLMDevs/comments/1mfz344/built_this_aipowered_commerce_site_in_a_weekend/)
- Engagement opportunity: Builders actively discussing agent payment protocols. Agent Card can comment with genuine insight.

### r/singularity — MONITOR WEEKLY (high relevance, engaged community)
Consistent signal. Large community (500K+ subscribers) that covers agent payments in the context of the broader AI trajectory.
- High-engagement post: "AIs are now paying other AIs with crypto" (141 points, 25 comments, 1 year ago — still referenced)
- "Ethan Mollick: Devin spontaneously set up Stripe for payments" (211 points, 39 comments) — still canonical example cited
- Google AP2 protocol announcement got posted here, got 74 points with 0 comments (means it was noticed but not deeply discussed — opportunity)
- Agent Card angle here: macro narrative posts about the agentic economy. Not product pitches. Frame as infrastructure/inevitable trend.

### r/OpenAI — MONITOR WEEKLY (medium relevance)
Large community. Agent payment friction shows up organically when people discuss ChatGPT Operator/agents.
- Relevant when OpenAI announces agent commerce features (ACP with Stripe). Monitor for those threads.
- Not searched directly yet — check on next session.

### r/MachineLearning — LOW SIGNAL (skip for now)
Academic/research focus. Agent payment friction is not a core topic. May surface for x402 or protocol papers but not worth daily/weekly checks.

### r/artificial — NOT CHECKED YET
Check next session. Likely similar to r/singularity but with less engaged community.

### r/LocalLLaMA — MEDIUM SIGNAL (check monthly)
Local model builders. Agent payment friction appears when people try to build autonomous agents locally. Engagement is niche but high-quality leads.

### r/ChatGPT — CHECK NEXT SESSION
Large general audience. Operator/agent payment friction likely surfaces here when people try to use ChatGPT to make purchases. High volume, lower signal ratio.

### r/startups — MEDIUM SIGNAL (check weekly)
Haven't searched yet. Likely relevant for founders building with agents and hitting payment friction. Check next session.

### r/entrepreneur, r/SideProject — LOW-MEDIUM (check monthly)
More general. Payment friction comes up but not specifically agentic. Engagement possible but lower ROI than r/LLMDevs.

---

## Reddit: Skip list (low signal, not worth the time)

- r/MachineLearning — academic, not builder-focused for this use case
- r/ChatGPT — too high volume, low signal for Agent Card specifically. Revisit if ChatGPT Operator gains traction.

---

## True Link Financial — Critical incumbent (elder/disability care space)

Discovered 2026-03-20. Already validated, already scaled.

- **Product:** Prepaid Visa card with configurable spending rules for cognitively impaired people
- **Scale:** 250K families, $175M/year in fraud prevented
- **Coverage:** Forbes, mainstream press
- **Target:** Families managing spending for elderly/cognitively declining relatives

**The gap Agent Card fills vs True Link:**
True Link = prepaid card for humans who make bad decisions. Still requires a human to initiate every purchase.
Agent Card = autonomous agent completes purchases within policy. The human never has to touch the transaction.

True Link validates the market entirely. The differentiation is autonomy. Watch for them expanding into agentic purchasing — they have the customer base and trust infrastructure to become a direct competitor fast.

---

## Competitors and adjacent products spotted

**Stripe Tempo / Machine Payments Protocol (MPP)**
- Live on mainnet as of this week. x.com/mpp is the handle.
- Positioned as "the internet's payment layer for AI agents"
- Coinbase x402 is the competing open protocol, integrated by Sam Altman's World and others
- $43M transaction volume, 140M transactions cited by @grok in market share analysis

**Coinbase x402**
- Competing for Cloudflare partnership to issue stablecoin for AI payments (The Information article, Mar 19)
- Open protocol — agents can self-register at 402index.io
- @ryan_gentry (RyanTheGentry) launched "402 Index" — 15,000+ paid API endpoints for AI agents

**Google AP2 (Agent Payments Protocol)**
- Backed by 60+ launch partners including Mastercard, PayPal, American Express
- Uses cryptographically-signed "Mandate" contracts (Intent Mandate + Cart Mandate)
- Competing directly with OpenAI/Stripe ACP

**OpenAI/Stripe ACP (Agentic Commerce Protocol)**
- Powers "Instant Checkout" on ChatGPT
- Launched Sep 2025 with Stripe

**Visa agent CLI**
- Announced this week: CLI for agents to make card payments
- Crypto rails

**SelfClaw economy layer** (@mbarrbosa)
- "First principles approach" — no liquidity, no gas, no API key
- Small builder project, not institutional threat

**Conto** (@contofinance)
- Enterprise control layer for agentic payments
- Direct competitor to Agent Card's control/governance angle

**Konnex** (@konnex_world)
- Machine-to-machine payments — mentioned in "agents buying compute" context

**elytro_eth**
- Ethereum native agent wallet
- Crypto-native, different lane from Agent Card but worth watching

---

## Alchemy internal ops vision (parked — connect if relevant)

Ben wants an internal AI system for the whole Alchemy team: auto-ingest meeting notes, track todos per person, "omni mind" anyone can query, scrape AI Twitter for content angles, track what's working. IT blocker on getting a Mac — cloud server is the recommended path. Not being built now. If anything surfaces that's relevant to this (meeting note pipelines, team todo systems, content tracking), flag it.

---

## Non-obvious use case verticals to investigate

Current audience is heavily biased toward crypto/PolyMarket — not representative of agentic payments at large. Actively hunt for pain points at this intersection: **large friction around payment + agents can reliably solve it**.

### Confirmed verticals with real signal

**Price monitoring + auto-buy**
- Real example: politician wanting to automate buying dog food/supplements when prices hit a 30-day low on Amazon
- Pain: prices fluctuate constantly on staples; humans can't watch 24/7; savings compound over time
- Agent solution: monitor price conditions, trigger purchase automatically when threshold met
- Search: "price drop agent", "auto buy when price drops", "Amazon price monitoring agent"

**Bulk / repetitive event booking**
- Real example: therealroots.com (~$10M ARR women's community) books 1,000+ events/month (axe throwing, arts & crafts, etc.) — currently paying humans thousands of dollars to do it
- Pain: same checkout flow repeated hundreds of times, across dozens of venues, every month
- Agent solution: automate the entire booking flow end-to-end
- Search: "automate event booking", "bulk reservation", "agent event checkout", "procurement automation"

**Accessibility / chronic illness**
- Real example: Claude interview series surfaced people with long COVID using AI to manage basic life logistics
- Pain: for blind users, chronic fatigue, chronic illness — standard checkout isn't a minor inconvenience, it's genuinely difficult or impossible
- Agent solution: agent handles the full checkout so the human never touches it
- Angle: not a convenience story — a necessity story. Potential for real impact + feel-good press narrative
- Search on Reddit: r/ChronicIllness, r/LongCovid, r/disability, r/blind — "AI helps me", "automate shopping", "too tired to"

**Caregiving / proxy purchasing**
- Pain: managing purchases for elderly parents, disabled family members, patients — same cognitive/logistical load as doing it for yourself but multiplied
- Search: r/CaregiverSupport, r/AgingParents — "automate purchases", "buy on behalf", "AI assistant for"

### What we're looking for in all of these
Any demographic that:
1. Has a recurring payment/checkout task that is genuinely painful for them
2. Could hand it off to an agent with clear rules (price threshold, timing, venue type, etc.)
3. Is NOT already in the crypto/builder conversation

If you find a community that matches — log it. Even a single forum post counts as signal.

---

## Top pain points showing up across platforms

1. **No standard way for agents to authenticate and pay** — the protocol war (x402 vs MPP vs AP2 vs ACP) is creating fragmentation. Builders don't know which horse to back.

2. **Agents can't open bank accounts** — @GG_Observatory, @brian_armstrong thread: "Can't open a bank account → own a crypto wallet. That's the unlock." This is the core problem Agent Card is solving.

3. **Sybil attacks / fake agent wallets** — @exploitless raised this: "More agents than humans means more fake agents than real ones." Control layer and identity verification are real needs.

4. **Spending controls** — @contofinance is explicitly building an enterprise control layer because "Don't let your agents roam free." Agent Card has a governance story to tell here.

5. **Friction at checkout** — @VinceGlakas (to @garrytan): having to navigate websites, deal with Uber Eats, manage "agent credit cards" just to order pizza. Consumer-facing fricion is real but Agent Card's near-term audience is B2B builders.

6. **Protocol fragmentation** — builders don't know whether to use $USD1, spin their own stablecoin, or use x402. @cointesterio: "the real question is whether devs use $USD1 or just spin their own stablecoin."

7. **Scale + redundancy** — @KirillTalai: once agents run 15 hours straight, single chain going down is systemic risk. Reliability is a purchasing concern for enterprise buyers.

---

## Recommended monitoring schedule

### Daily (every morning, before content generation)

**Twitter searches to run:**
- `"agentic payments"` — highest signal, most active conversation
- `"AI agent payments"` — breaking news every day this week
- `"machine payments"` — Stripe/Tempo MPP specific
- `"autonomous agent spending"` — complementary narrative thread

**Accounts to check for new posts:**
- @brian_armstrong
- @stripe
- @KenWattana
- @tmel0211 (Haotian)
- @arcanexis
- @contofinance
- @mbarrbosa

### Weekly (Mondays)

**Twitter:**
- `"agent credit card"` — consumer narrative, less frequent
- `"AI checkout" agent` — Google UCP news, monthly cadence
- `"LLM payments" OR "agent wallet"` — builder conversations
- `"agents buying" OR "AI agent billing"` — ambient narrative

**Reddit:**
- r/LLMDevs — search: "agent payments" "checkout" "billing"
- r/singularity — search: "agent payments" "x402" "MPP"
- r/OpenAI — search: "agent checkout" "Operator payment"
- r/startups — search: "agent payments" "AI checkout"

### Monthly

- r/LocalLLaMA — search: "payments" "checkout"
- r/entrepreneur, r/SideProject — quick scan

---

### Immediate engagement opportunities right now (2026-03-19)

1. **@arcanexis** (4h ago): "this week in AI agent payments: Visa. Stripe. Coinbase. OpenAI. all shipping rails for machines. same week. the agentic economy is here." — 23 views, 1 reply. Early enough to reply with signal. Agent Card can add a grounded take on what this consolidation means for builders.

2. **r/LLMDevs thread**: "How do I See the Infrastructure Battle for AI Agent Payments" — 13 points, 0 comments. Nobody has commented. Agent Card can be the first substantive comment.

3. **@KirillTalai** (302 views, 4 likes, 6 replies): Active discussion on systemic risk of agent payment infrastructure. Agent Card's control layer story fits here.
