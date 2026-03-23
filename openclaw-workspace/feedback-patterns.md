# Feedback Patterns

> Auto-generated from approval decisions. Read every session before drafting.

Updated: 2026-03-20T09:51  
Total decisions: 4 | Rejections: 0 | Edits on approval: 2

---

## Rejection Patterns

No rejections yet.

---

## Edit Patterns

2 approved with edits:

**Before:** translation: a new contender just entered the agent payment space

WLFI shipped AgentPay SDK this week. open source, self-custodial, built on USD1 stablecoin.

the pitch: agents hold their own keys, execute transactions without asking permission every time, stay within policy limits you set upfront.

it solves the same problem everyone in this space is circling — agents that can reason but can't pay

but it's crypto-native. that's both the feature and the constraint.

enterprises and regulated businesses will need something that runs on fiat rails with audit trails finance can defend. USD1 doesn't get you there.

that's still the open gap.
**After:**  translation: a new contender just entered the agent payment space

WLFI shipped AgentPay SDK this week. open source, self-custodial, built on USD1 stablecoin.

the pitch: agents hold their own keys, execute transactions without asking permission every time, stay within policy limits you set upfront.

it solves the same problem everyone in this space is circling. agents that can reason but can't pay.

but it's crypto-native. that's the feature and the constraint.

enterprises and regulated businesses will need something that runs on fiat rails with audit trails finance can defend. USD1 doesn't get you there.

that's still the open gap.

**Before:** good breakdown of the macro picture. a few things worth adding for builders trying to make sense of it right now:

the four protocols you're tracking (x402, MPP, AP2, ACP) are genuinely different bets:

- x402 (Coinbase) is crypto-native. HTTP 402 payment required, stablecoin settlement, minimal auth overhead. good if your agent stack is already on-chain. M tx volume, 140M transactions already. real adoption.

- MPP / Tempo (Stripe) is the fiat-first play. Stripe's .9T rails, card support, enterprise auth. grok's market share model has this at 60-70% by 2027 if it catches on with mainstream SaaS. makes sense if your buyers are traditional businesses.

- AP2 (Google) uses cryptographically-signed Mandate contracts — Intent Mandate captures what you asked for, Cart Mandate locks the purchase before payment. 60+ launch partners including Mastercard, PayPal, Amex. heavier protocol but more auditability for enterprise compliance.

- ACP (OpenAI/Stripe) powers Instant Checkout on ChatGPT. smallest footprint right now but distribution is enormous if it gets traction with consumer agents.

the honest answer for builders: nobody knows which wins yet. the risk is that if you build tightly against one protocol and it loses, you're rebuilding your payment layer. the practical move right now is to abstract the payment interface early so you can swap the underlying protocol without rewriting your agent logic.

the fragmentation is the problem more than the protocols themselves.
**After:**  good breakdown of the macro picture. a few things worth adding for builders trying to make sense of it right now:

the four protocols you're tracking (x402, MPP, AP2, ACP) are genuinely different bets:

- x402 (Coinbase) is crypto-native. HTTP 402 payment required, stablecoin settlement, minimal auth overhead. good if your agent stack is already on-chain. 140M transactions already. real adoption.
- MPP / Tempo (Stripe) is the fiat-first play. Stripe's .9T rails, card support, enterprise auth. grok's market share model has this at 60-70% by 2027 if it catches on with mainstream SaaS. makes sense if your buyers are traditional businesses.
- AP2 (Google) uses cryptographically-signed Mandate contracts. Intent Mandate captures what you asked for, Cart Mandate locks the purchase before payment. 60+ launch partners including Mastercard, PayPal, Amex. heavier protocol but more auditability for enterprise compliance.
- ACP (OpenAI/Stripe) powers Instant Checkout on ChatGPT. smallest footprint right now but distribution is enormous if it gets traction with consumer agents.

nobody knows which wins yet. build tightly against one protocol and it loses, you're rebuilding your payment layer. abstract the payment interface early so you can swap the underlying protocol without rewriting your agent logic.

the fragmentation is the problem more than the protocols themselves.


---


**Decision:** approved — 20260320-breaking-openai-checkout-pivot
**Date:** 2026-03-23T07:04:12.577Z
**Platform:** twitter
**Original:** JUST IN: OpenAI is ending Instant Checkout in ChatGPT, shifting to product discovery after real-time inventory and pricing proved unreliable.
**Final:** JUST IN: OpenAI is ending Instant Checkout in ChatGPT, shifting to product discovery after real-time inventory and pricing proved unreliable.
**Diff:** no changes


**Decision:** approved — 20260320-breaking-openai-checkout-pivot
**Date:** 2026-03-23T07:16:26.477Z
**Platform:** twitter
**Original:** JUST IN: OpenAI is ending Instant Checkout in ChatGPT, shifting to product discovery after real-time inventory and pricing proved unreliable.
**Final:** JUST IN: OpenAI is ending Instant Checkout in ChatGPT, shifting to product discovery after real-time inventory and pricing proved unreliable.
**Diff:** no changes


**Decision:** approved — 20260320-breaking-openai-checkout-pivot
**Date:** 2026-03-23T07:51:24.593Z
**Platform:** twitter
**Original:** JUST IN: OpenAI is ending Instant Checkout in ChatGPT, shifting to product discovery after real-time inventory and pricing proved unreliable.
**Final:** JUST IN: OpenAI is ending Instant Checkout in ChatGPT, shifting to product discovery after real-time inventory and pricing proved unreliable.
**Diff:** no changes


**Decision:** approved — 20260303-breaking-klarna-stripe-spt
**Date:** 2026-03-23T10:58:23.604Z
**Platform:** twitter
**Original:** BREAKING: Klarna's flexible payment options are now available to AI agents via Stripe Shared Payment Tokens.
**Final:** BREAKING: Klarna's flexible payment options are now available to AI agents via Stripe Shared Payment Tokens.
**Diff:** no changes


**Decision:** approved — 20260303-breaking-klarna-stripe-spt
**Date:** 2026-03-23T11:01:52.522Z
**Platform:** twitter
**Original:** BREAKING: Klarna's flexible payment options are now available to AI agents via Stripe Shared Payment Tokens.
**Final:** BREAKING: Klarna's flexible payment options are now available to AI agents via Stripe Shared Payment Tokens.
**Diff:** no changes

## Rules

1. Any category with 3+ rejections = hard rule.
2. Study edit diffs — they show what needs to change.
3. When in doubt: shorter and more direct.