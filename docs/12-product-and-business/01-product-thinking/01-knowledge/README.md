# Product Thinking — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: User value, prioritization by impact, MVP.

> **🛒 Where we are in building ShopFast** — Last topic we survived a real conflict: [Conflict & Ownership](../../../11-real-situations/05-conflict-ownership/01-knowledge/README.md) showed us how to navigate disagreement inside a team. Now we zoom out to the question that precedes every feature and every conflict: *should we build this at all, and why?* This topic arms you with the product-thinking lens — user needs, prioritization, and validated bets — that every senior engineer must carry. **Next:** once we decide what to build, we need to know whether it worked — [Metrics & Experimentation](../../02-metrics/01-knowledge/README.md) teaches us to measure outcomes, not just ship outputs.

---

## Teaching arc: deciding what ShopFast should build next

### What it is & why it matters

Product thinking is the senior engineer's ability to reason about *why* a piece of software is being built, *who* it serves, and *whether it is worth building at all* — before reasoning about *how* to build it. Interviewers probe this because senior engineers who lack it ship technically excellent solutions to the wrong problem, gold-plate low-value features, and cannot push back on a flawed spec.

The bar is not "be a PM (Product Manager)"; it is "be a force multiplier who connects engineering effort to user and business outcomes."

The single most important mental shift: **reason backward from impact, not forward from a ticket.**

- **Output** — what you ship (a feature, an endpoint, a screen). Easy to measure; often vanity.
- **Outcome** — the change in user behavior the output causes (more users complete checkout; support tickets drop).
- **Impact** — the business or mission result the outcome produces (revenue, retention, cost saved).

Juniors reason: "The ticket says build X." Seniors reason: "What impact are we targeting? What outcome achieves it? What output will produce that outcome — and is there a cheaper output that gets us there?"

### A ShopFast case

The ShopFast team is three months post-launch, running on the modular monolith described in the [Architecture Styles](../../../03-system-design/04-architecture-styles/01-knowledge/README.md) topic. Traffic is steady but repeat-purchase rate is low. A PM (Product Manager) proposes a "Trending Products" feature: "Show the top-10 trending items on the homepage."

**Step 1 — Find the JTBD (Jobs To Be Done).** Why do users visit the homepage? They want to discover something worth buying without knowing what to search for. The JTBD: *"When I open ShopFast and have no specific product in mind, I want to quickly spot something that others are excited about, so I can decide to buy or keep browsing."* The request ("trending products") is a solution. The job is *guided discovery*.

**Step 2 — Identify the riskiest assumption (RAT — Riskiest Assumption Test).** The whole feature rests on: "users who see trending items will click and buy at a higher rate than users who see the current static homepage." That assumption can be wrong — maybe users already know what they want (search-first) and trending is noise. Test it before building the ML (Machine Learning) ranker.

**Step 3 — Define the MVP (Minimum Viable Product) as a vertical slice.** The risky part is not the ranking algorithm; it is whether any trending signal on the homepage changes purchase behavior. The cheapest vertical slice: **top-10 products by order count in the last 7 days, computed nightly by a SQL (Structured Query Language) query, rendered as a simple carousel.** No ML, no real-time stream. This takes 1 engineer-week instead of 6.

**Step 4 — Choose a leading success metric up front.** Not "impressions of the carousel" (vanity) but **"add-to-cart rate from the homepage carousel within 24 hours of first visit"**. Guardrail: overall checkout conversion must not drop (the feature should not distract buyers who already knew what they wanted).

**Step 5 — Decide to build, iterate, or kill.** After 2 weeks: if the add-to-cart rate from the carousel is measurably higher than the homepage baseline, the assumption holds — invest in real-time ranking. If flat or negative, kill it: the job may be better served by smarter search or personalized recommendations instead.

**Outcome of this example:** The SQL-based top-10 ran for 4 weeks, showed a 9% lift in homepage-initiated add-to-carts, and the team funded a proper ranking service. The alternative — building the ML ranker first — would have taken 2 months and learned the same lesson much later.

### How to handle it

The senior workflow uses these frameworks:

**JTBD (Jobs To Be Done)** — Frame every feature as: *"When [situation], I want to [motivation], so I can [expected outcome]."* This pushes past surface requests to the underlying need. People don't buy a drill; they want a hole in the wall.

**RAT (Riskiest Assumption Test)** — Before writing code, identify the single assumption that, if wrong, kills the whole idea. Test *only* that, as cheaply as possible: a landing page, a concierge manual process, a Wizard-of-Oz prototype, or a simple SQL query standing in for ML.

**MVP (Minimum Viable Product) as a vertical slice** — The smallest thing that delivers end-to-end value and tests the core hypothesis. A vertical slice cuts through all layers (UI, API, DB) and produces a working user journey, thin but complete. Anti-pattern: a "horizontal slice" — a database schema and half a UI with no usable flow.

**RICE (Reach, Impact, Confidence, Effort)** — Score = (Reach × Impact × Confidence) / Effort. Forces explicit, comparable estimates across candidate features and surfaces where confidence is low. Use it to compare the trending-products carousel against other candidates in the same sprint.

**Opportunity cost and cost of delay** — Every "yes" is a "no" to everything else. Ask not "is this worth building?" but "is this the *most* worth-it thing we could do now, given what we're *not* building instead?"

**Leading vs. lagging indicators** — Pick a *leading* metric before you ship (add-to-cart rate predicts revenue; it's observable days after launch). Lagging metrics like revenue confirm impact but arrive too late to steer by.

### A strong answer sounds like

*"Before I scope this out technically, I want to understand the job the user is trying to do and what assumption we're testing. My read: the riskiest assumption is that users who see trending items will engage more than users who see the current layout. I'd propose a vertical-slice MVP — top-10 by order count from a nightly query — to test that assumption in one engineer-week. Success metric: add-to-cart rate from that section, with a guardrail that overall checkout conversion doesn't drop. If it doesn't move the needle in two weeks, we've learned something important at low cost and we redirect capacity to the next idea."*

Notice: user framing first, explicit assumption, cheap test, pre-declared metric with guardrail, and a clear kill criterion. No implementation details until the hypothesis is worth pursuing.

### Pitfalls

- **"MVP means low quality."** No — it means minimal *scope* to learn, at appropriate quality for that scope.
- **Building for yourself.** Engineers over-index on power-user, technical needs and under-index on the median user.
- **The feature factory.** Measuring success by features shipped (output) instead of behavior changed (outcome).
- **Confusing correlation with causation** when reading product data. A spike in signups the week you launched could be a marketing campaign. This is covered deeply in the Metrics topic.
- **Ignoring opportunity cost** — evaluating a feature on "is it worth it?" instead of "is it the *most* worth-it thing we could do now?"
- **Prioritizing by the HiPPO (Highest-Paid Person's Opinion)** rather than data + reach.
- **Treating the spec as gospel.** A senior engineer who spots that a requirement won't achieve its goal *raises it*, with data, before building.
- **Never killing anything.** Sunk-cost fallacy keeps zombie features alive; product thinking includes deprecation and saying no.

---

## Core concepts

### Value chain: outputs vs. outcomes vs. impact
- **Output** — what you ship (a feature, an endpoint, a screen). Easy to measure, often vanity.
- **Outcome** — the change in user behavior the output causes (more users complete checkout, support tickets drop).
- **Impact** — the business/mission result the outcome produces (revenue, retention, cost saved).
- Senior engineers reason backward: *impact → outcome → output*. Juniors reason forward from "the ticket says build X."

### The job-to-be-done (JTBD)
Users don't want your feature; they "hire" your product to make progress in a situation. The canonical framing: *"When [situation], I want to [motivation], so I can [expected outcome]."* JTBD pushes you past surface requests ("add a dropdown") to the underlying need ("let me find the right option in under 5 seconds"). The classic example: people don't buy a quarter-inch drill, they want a quarter-inch hole.

### MVP, MLP, and the riskiest-assumption test
- **MVP (Minimum Viable Product)** — the smallest thing that lets you *learn* whether the core hypothesis is true. Its purpose is **validated learning**, not a stripped-down v1 you're ashamed of.
- **MLP (Minimum Lovable Product)** — the smallest thing users will actually *enjoy* enough to adopt and tell others. Useful corrective to MVPs so thin they fail to test the hypothesis.
- **RAT (Riskiest Assumption Test)** — before building an MVP, isolate the single assumption that, if wrong, kills the whole idea, and test *only* that, often with no code (a landing page, a concierge manual process, a Wizard-of-Oz prototype).
- Anti-pattern: shipping a "horizontal slice" (database + half a UI + no usable flow) and calling it an MVP. A true MVP is a *vertical slice* — a thin but complete path through the whole value loop.

### Prioritization frameworks
Senior engineers should be able to *run* these, not just name them.

| Framework | Formula / axes | Best for |
|-----------|----------------|----------|
| **RICE** | (Reach × Impact × Confidence) / Effort | Comparing many candidate features objectively |
| **ICE** | Impact × Confidence × Ease | Faster, looser RICE for early-stage |
| **MoSCoW** | Must / Should / Could / Won't | Scoping a single release with stakeholders |
| **Value vs. Effort (2×2)** | quadrant plot | Quick visual triage; find "quick wins" |
| **Kano model** | Basic / Performance / Delight needs | Deciding which features differentiate vs. table-stakes |
| **WSJF** (SAFe) | Cost of Delay / Job Size | Scaling backlogs where delay cost varies |
| **Opportunity scoring** | importance − satisfaction | Finding underserved needs |

**RICE (Reach, Impact, Confidence, Effort) in detail** (the most asked):
- **Reach** — how many users/events per time period are affected (e.g., 2,000 users/quarter). Use real numbers.
- **Impact** — how much it moves the metric per user, on a scale (3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal).
- **Confidence** — how sure you are about the estimates (100% / 80% / 50%). Penalizes hand-wavy bets.
- **Effort** — person-months. The only denominator.
- Score = (R × I × C) / E. Higher wins. The discipline is forcing explicit, comparable estimates and surfacing where confidence is low.

### Opportunity cost & the cost of delay
Every "yes" is a "no" to everything else that slice of capacity could have built. Senior engineers frame work in terms of **opportunity cost** and **cost of delay** (what you lose per week the feature doesn't exist), not just build cost.

### The build / buy / partner / don't decision
Before "how do we build it," ask: should we build it at all?
- **Build** — it's core differentiation, or no adequate vendor exists.
- **Buy** — it's table stakes (auth, payments, email) where a vendor is cheaper than your engineering time and maintenance.
- **Partner/integrate** — speed-to-market matters more than control.
- **Don't** — the feature serves few users at high cost; the right answer is often "no."

### Leading vs. lagging indicators
- **Lagging** — revenue, churn: confirm impact but too slow to steer by.
- **Leading** — activation rate, time-to-value, weekly active usage of a new feature: predict the lagging metric and let you course-correct early. Pick a leading metric *before* you build.

---

## How it works under the hood (the senior workflow)

1. **Restate the problem in user terms.** "We need a CSV export" → "Finance users need to reconcile our data against their ledger monthly." This reframing often changes the solution entirely (maybe an API or a scheduled email beats a button).
2. **Quantify reach and impact** with whatever data exists (analytics, support volume, sales asks). If no data, say so and propose the cheapest experiment to get it.
3. **Find the riskiest assumption** and the cheapest way to test it.
4. **Cut scope to a vertical slice** that delivers and tests the core value.
5. **Define the success metric and guardrail metrics up front** ("activation +5%, and p95 latency must not regress").
6. **Sequence for fast feedback** — ship the thing that maximizes learning per unit of effort first.
7. **Plan the kill criteria** — what result would make you stop?

---

## Key terms & definitions

- **North-star metric** — the single metric that best captures the core value delivered to users (e.g., "nights booked" for Airbnb). Aligns teams; should correlate with long-term revenue.
- **Activation** — the moment a new user first experiences core value ("aha moment"). Often the highest-leverage funnel stage.
- **Time-to-value (TTV)** — elapsed time from signup to first value. Lower TTV → higher retention.
- **Table stakes** — features required just to be considered, that don't differentiate.
- **Differentiator** — a feature that's a reason to choose you over a competitor.
- **Scope creep** — uncontrolled growth of requirements after work begins.
- **Gold-plating** — adding polish/features nobody asked for, beyond requirements.
- **Vertical slice** — a thin, end-to-end working path through all layers.
- **Concierge / Wizard-of-Oz MVP** — manually faking the backend to validate demand before building it.
- **Sunk cost fallacy** — continuing a doomed effort because of prior investment.

---

## Tradeoffs

- **Speed vs. quality** — shipping to learn fast vs. building to last. Resolve by asking: is this a *learning* bet (favor speed, accept debt deliberately) or a *scaling* investment (favor quality)?
- **Breadth vs. depth** — many shallow features vs. one that's genuinely great. Kano: depth on differentiators, breadth only on table stakes.
- **Local optimization vs. system value** — a feature that helps one segment may hurt overall metrics (e.g., a power-user feature that complicates onboarding).
- **Customer requests vs. product vision** — the loudest customer isn't the median user; sales-driven roadmaps fragment the product. Weigh by reach, not volume.
- **Quantitative vs. qualitative** — A/B (A/B test) numbers tell you *what*, user interviews tell you *why*. Seniors use both.

---

## Common pitfalls & misconceptions

- **"MVP means low quality."** No — it means minimal *scope* to learn, at appropriate quality for that scope.
- **Building for yourself.** Engineers over-index on power-user, technical needs and under-index on the median user.
- **The feature factory.** Measuring success by features shipped (output) instead of behavior changed (outcome).
- **Confusing correlation with causation** when reading product data (covered deeply in the Metrics topic).
- **Ignoring opportunity cost** — evaluating a feature on "is it worth it?" instead of "is it the *most* worth-it thing we could do now?"
- **Prioritizing by the HiPPO** (Highest-Paid Person's Opinion) rather than data + reach.
- **Treating the spec as gospel.** A senior engineer who spots that a requirement won't achieve its goal *raises it*, with data, before building.
- **Never killing anything.** Sunk cost keeps zombie features alive; product thinking includes deprecation and saying no.

---

## What interviewers probe

- *"You're given feature X. How do you decide if it's worth building?"* — They want: restate in user terms, estimate reach/impact, identify the riskiest assumption, propose a cheap test, define a success metric, and be willing to say "maybe we shouldn't."
- *"Two features, finite time — which first and why?"* — Run RICE/value-vs-effort out loud with explicit numbers.
- *"The PM gave a spec you think is wrong. What do you do?"* — Clarify the underlying goal, bring data, propose an alternative, disagree-and-commit if overruled.
- *"How would you cut this 6-month project to ship something in 2 weeks?"* — Vertical slice, riskiest-assumption-first thinking.
- *"What's the smallest thing that would tell us if this is a good idea?"* — RAT/concierge MVP.
- Red flags they watch for: jumping straight to implementation, no mention of users or metrics, inability to say no, gold-plating.

---

## Quick-reference summary

- Reason **impact → outcome → output**, not the reverse.
- A feature request is a *symptom*; find the **JTBD (job-to-be-done)** behind it.
- **MVP = minimal scope to learn**, delivered as a **vertical slice**, not a half-built horizontal one.
- Test the **riskiest assumption** first, as cheaply as possible (landing page, concierge, Wizard-of-Oz).
- Prioritize with **RICE** = (Reach × Impact × Confidence) / Effort; know ICE, MoSCoW, Kano, value-vs-effort, WSJF too.
- Pick a **leading success metric and guardrails before building**; define **kill criteria**.
- Every yes is a no — weigh **opportunity cost** and **cost of delay**.
- Senior signal: connect code to user value, push back on bad specs with data, and be willing to **not build**.
