# Deep Researcher Subagent v2.0

Structured deep research with two-phase workflow, inspired by [RhinoInsight](https://arxiv.org/abs/2511.18743) paper on control mechanisms for model behavior.

## What It Does

Deep research on any topic using a structured approach:
- **Phase 1:** Generate research outline (items + fields to collect)
- **Phase 2:** Deep investigation with parallel subagents for each item
- **Output:** Structured report with sources, quotes, and confidence levels

## How to Invoke

### Via Chat (Easiest)

**Start research:**
```
/research [topic]
```

**Examples:**
```
/research Software tools for nail salons — pricing, complaints, alternatives
/research Competitors for fountainofprofit.com
/research Mobile dog groomer software market
```

**Add to existing research:**
```
/research-add-items
/research-add-fields
```

**Deep dive:**
```
/research-deep
```

**Generate report:**
```
/research-report
```

### Manual Spawn

```bash
cd /Users/mantisclaw/.openclaw/workspace
openclaw sessions spawn --runtime subagent \
  --task "/research [your topic]" \
  --label deep-research-[topic]
```

## Two-Phase Workflow

### Phase 1: Outline Generation

When you say `/research [topic]`, the agent creates:

```markdown
## Research Topic: [Your Topic]

### Research Items (what to investigate)
1. [Item 1]
2. [Item 2]
3. [Item 3]
...

### Fields to Collect (for each item)
- Field 1
- Field 2
- Field 3
...
```

**You review and approve** before Phase 2 starts.

### Phase 2: Deep Investigation

For each research item:
1. Search web for primary sources
2. Fetch content from URLs
3. Collect data for each field
4. Note sources and quotes
5. Mark confidence (confirmed/uncertain/conflicting)

## Output Format

```markdown
### What I Found
[Findings with sources, URLs, quotes, numbers]

### What's Confirmed
[Directly verified information]

### What's Uncertain
[Unverified claims, conflicts, estimates]

### Key Insight
[The actionable takeaway]

### Sources
[All URLs consulted]
```

## Example Sessions

### Example 1: Market Research

**Input:**
```
/research Software tools for nail salons
```

**Phase 1 Output:**
```markdown
## Research Topic: Software tools for nail salons

### Research Items
1. Top 5 booking/scheduling platforms
2. POS systems for nail salons
3. Inventory management tools
4. Marketing automation tools
5. Pricing comparison
6. User complaints (Reddit, forums)

### Fields to Collect
- Tool name
- Category
- Price/month (exact tiers)
- Key features
- User complaints (direct quotes)
- Replaceability score (1-10)
- Source URLs
```

**Phase 2 Output:**
```markdown
### What I Found

**Booking Software:**

1. **Vagaro** — $25-35/month per location
   - "Best all-in-one solution" — SalonOwnerForum, Jan 2026
   - 4.2/5 stars on G2 (847 reviews)
   - URL: vagaro.com/pricing

2. **Booksy** — $29.99/month + $9.99 setup
   - Strong mobile app, weak desktop
   - Complaints about customer support response time
   - URL: booksy.com/pricing

### What's Confirmed
- Vagaro and Booksy are top 2 by market share
- Both charge per-location, not per-user

### What's Uncertain
- Exact market share (sources conflict: 35-45% range)

### Key Insight
Start with Vagaro for established salons (3+ techs), Booksy for solo operators.
Main complaint: customer support speed, not features.

### Sources
- vagaro.com/pricing
- booksy.com/pricing
- G2.com/vagaro/reviews
- SalonOwnerForum thread #284751
```

### Example 2: Niche Discovery

**Input:**
```
/research Find first niche for software business — narrow vertical, overpriced tools
```

**Output follows niche research template:**
```markdown
## Niche Chosen
[Name + why]

## Software Landscape
| Tool | Category | Price/mo | Replaceability | Complaints |
|------|----------|----------|----------------|------------|
| ...  | ...      | ...      | ...            | ...        |

## Top Replacement Target
[Tool details]

## Real User Pain Points
[Direct quotes with sources]

## Creative Outreach Idea
[Specific concept]

## Savings Pitch
[Exact positioning]

## Where to Find Them Online
[Communities, hashtags]
```

## When to Use

✅ Researching competitors
✅ Market analysis
✅ Tool/software evaluation
✅ Finding complaint patterns
✅ Pricing research
✅ Niche discovery
✅ Due diligence

❌ Building anything
❌ Writing code
❌ Making system changes
❌ Posting/publishing content

## Tips

- **Be specific** — "nail salon booking software" beats "salon software"
- **Include scope** — "US only", "last 12 months", "under $100/month"
- **Ask follow-ups** — Go deeper on specific findings
- **Save findings** — Important research goes to `dashboard/docs/`

## Subagent Spawning

For large research topics, the agent can spawn parallel subagents:

```javascript
// Research 5 competitors in parallel
sessions_spawn({
  task: "Research [competitor 1] — pricing, features, reviews",
  runtime: "subagent",
  mode: "run"
})
```

Each subagent researches one item, results are merged into final report.

## Files

```
skills/deep-researcher/
  SKILL.md     ← This skill definition
  README.md    ← Documentation (this file)
```

## Related

- [AUTOMATION-STACK.md](/Users/mantisclaw/.openclaw/workspace/AUTOMATION-STACK.md) — Current automation context
- [dashboard/docs/](/Users/mantisclaw/.openclaw/workspace/dashboard/docs/) — Research output storage
