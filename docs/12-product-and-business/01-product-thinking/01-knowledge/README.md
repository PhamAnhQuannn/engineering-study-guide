# Product Thinking — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: User value, prioritization by impact, MVP.

Product thinking is the senior engineer's ability to reason about *why* a piece of software is being built, *who* it serves, and *whether it is worth building at all* — before reasoning about *how* to build it. Interviewers probe this because senior engineers who lack it ship technically excellent solutions to the wrong problem, gold-plate low-value features, and cannot push back on a flawed spec. The bar is not "be a PM"; it is "be a force multiplier who connects engineering effort to user and business outcomes."

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

**RICE in detail** (the most asked):
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
- **Quantitative vs. qualitative** — A/B numbers tell you *what*, user interviews tell you *why*. Seniors use both.

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
- A feature request is a *symptom*; find the **job-to-be-done** behind it.
- **MVP = minimal scope to learn**, delivered as a **vertical slice**, not a half-built horizontal one.
- Test the **riskiest assumption** first, as cheaply as possible (landing page, concierge, Wizard-of-Oz).
- Prioritize with **RICE** = (Reach × Impact × Confidence) / Effort; know ICE, MoSCoW, Kano, value-vs-effort, WSJF too.
- Pick a **leading success metric and guardrails before building**; define **kill criteria**.
- Every yes is a no — weigh **opportunity cost** and **cost of delay**.
- Senior signal: connect code to user value, push back on bad specs with data, and be willing to **not build**.
