# Feedback Patterns

> Auto-generated from approval decisions. Read this every session before drafting.

Updated: 2026-03-19 23:18  
Total decisions: 3 | Rejections: 0 | Edits on approval: 1

---

## Rejection Patterns

No rejections yet.

---

## Edit Patterns

1 tweets edited before approval. Study the diffs:

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

## Rules for MantisCAW

1. Read rejection patterns above before every draft.
2. Any category with 3+ rejections is a hard rule — do not violate it.
3. Study edit diffs — they show exactly what needs to change.
4. When in doubt, write shorter and more direct.
5. After 10+ decisions, summarise the main pattern in one sentence at the top of this file.