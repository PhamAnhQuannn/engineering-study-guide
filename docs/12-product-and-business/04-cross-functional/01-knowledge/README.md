# Cross-Functional Work — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Work with PM/design, requirement clarification, scope.

> **🛒 Where we are in building ShopFast** — Last topic we modeled the order/inventory/payment domain precisely: entities, invariants, state machines, bounded contexts. [Domain Modeling](../../03-domain-modeling/01-knowledge/README.md) gave us the technical artifact. But a domain model doesn't build itself — it has to be agreed on, scoped, and shipped with a PM (Product Manager), designer, data analyst, QA (Quality Assurance) team, and at least one other engineering team. This topic covers the human and process side: turning vague requests into precise specs, negotiating scope when capacity < ask, and keeping stakeholders aligned. **Next:** now the loop closes — the product insight from this tier feeds directly into the next system to build; [Idea to System](../../../03-system-design/08-idea-to-system/01-knowledge/README.md) shows how product insight becomes the next technical design.

---

## Teaching arc: negotiating the scope of ShopFast's inventory-warning feature

### What it is & why it matters

Senior backend engineers spend a large fraction of their impact *outside* the editor: clarifying ambiguous requirements, negotiating scope, surfacing technical constraints to non-engineers, and aligning PM, design, data, QA, and other engineering teams. The interview bar is "can this person turn a vague business ask into a shippable, correctly-scoped plan, and keep stakeholders aligned without an EM (Engineering Manager) holding their hand?"

Technical brilliance with poor cross-functional skills caps you at mid-level. The skill is not diplomacy for its own sake — it is the ability to translate between what the business needs and what is technically buildable, in both directions.

### A ShopFast case

The PM sends a Slack message: *"We need to warn users when a product is low on stock so they don't add it to cart only to find out at checkout it's gone. Can we ship this in one sprint?"*

This is a real cross-functional challenge. Let's walk through the senior engineer's response.

**Step 1 — Clarify the problem before estimating.** The message is solution-shaped ("warn users") not problem-shaped. Ask: "What's the underlying experience we want to prevent? Is it cart abandonment at checkout, or bad reviews from 'out of stock' surprises, or both? How often does it happen?" The PM says: checkout failure rate due to inventory depletion is about 2%, which accounts for roughly 40 abandoned carts per day. That's the real problem.

**Step 2 — Surface the unstated NFRs (Non-Functional Requirements).** The PM described only the functional requirement (show a warning). A senior engineer asks:
- *Scale:* How many concurrent users see product pages? (~1,800 peak read QPS (Queries Per Second) per the ShopFast architecture.) Any warning must not add latency to the p99 (99th-percentile) read path.
- *Accuracy:* Does the warning need to be real-time, or is a 60-second lag acceptable? (Real-time requires a live inventory read on every product page view — expensive at our QPS. A 60-second lag is fine and lets us use the Redis cache already in place.)
- *Threshold:* What counts as "low stock"? The PM doesn't know — they assumed the engineer would decide. This is a business rule, not a technical one; it needs PM input. Proposed: "fewer than 5 units remaining." PM agrees.
- *Edge cases:* What if stock is 0? Show "Out of stock" or hide the item? What if a product is never tracked for inventory (digital goods)? What if stock dips briefly due to a reservation that expires?

**Step 3 — Write testable acceptance criteria (Given/When/Then).** Without this, "done" is ambiguous:
- Given a product with fewer than 5 units in stock, when a user views the product page, then a "Low stock" badge appears with no additional latency to the p99 page load.
- Given a product with 0 units in stock, when a user views the product page, then an "Out of stock" label appears and the "Add to cart" button is disabled.
- Given a product not tracked for inventory, when a user views the product page, then no stock indicator appears.

**Step 4 — Estimate and surface the scope tradeoff (the iron triangle).** The backend work: add a `stock_level` field to the product cache entry, update the inventory write path to invalidate/update it, add a threshold config value. That's roughly 3 days. But the designer needs to produce the badge states (2 days), the frontend needs to consume the new field (2 days), and QA needs to write and run acceptance tests (1 day). Total: ~8 days. One sprint is 10 days. It fits, but only barely — and only if design is already started.

The PM asks: "Can we cut anything to be safer?" Senior move: apply MoSCoW (Must/Should/Could/Won't) scoping with the PM.
- **Must**: "Out of stock" disabling add-to-cart (prevents the checkout failure entirely).
- **Should**: "Low stock" warning badge.
- **Could**: Real-time accuracy (vs. 60-second cache lag).
- **Won't** (this sprint): "Notify me when back in stock" email subscription.

With only the "Must," this is a 4-day backend + 2-day frontend change that ships the highest-value piece first. The PM agrees, and the team commits to the Must + Should scope with an explicit note that real-time accuracy and back-in-stock notifications are deferred.

**Step 5 — Coordinate the dependency.** The frontend team needs the new `stockLevel` field in the `/v1/products/:id` API response before they can build the badge. Agree the field shape and semantics in writing (a short RFC — Request for Comments) before either team starts, so they can work in parallel. Classic mistake: the backend team adds the field, the frontend team builds against a different schema, and they discover the mismatch in the final demo.

**Step 6 — Disagree and commit.** The data analyst proposes a different threshold: "3 units, not 5, because our data shows 80% of low-stock situations resolve within 2 hours." The PM decides: "Start with 5, we can tune it with data." You think 3 is better. State your reasoning once, clearly. Once the PM decides, commit fully and implement 5 — don't passive-aggressively implement 3 or keep re-litigating.

**Step 7 — Write it down.** A one-paragraph RFC captures: the problem (2% checkout failure rate), the solution (stock level in product cache), the schema change (`stockLevel: "in_stock" | "low_stock" | "out_of_stock"`), the threshold (5 units), the NFRs (no p99 regression, 60s max lag), and the deferred scope (real-time, back-in-stock email). This persists the decision so future engineers know *why* the threshold is 5 and *why* real-time wasn't chosen.

### How to handle it

**The cross-functional cast and what each cares about:**
- **PM** — owns the *what* and *why* (problem, priority, success metric). Does **not** own the *how*.
- **Designer** — owns the user experience and edge-case UI (empty/loading/error/out-of-stock states).
- **Data/Analytics** — owns measurement; cares that you log the right events to evaluate success.
- **QA** — owns quality verification; cares about testability and acceptance criteria.
- **Other engineering teams / platform** — own shared contracts; care about API stability.
- **EM (Engineering Manager)** — owns people/process, not the technical design.

**Requirements clarification framework:**
1. Functional requirement: what must the system *do*?
2. NFRs (Non-Functional Requirements): latency, scale, security, availability, compliance — *frequently unstated*, where seniors add the most value by asking.
3. Acceptance criteria (Given/When/Then): concrete, testable conditions for "done." If you can't write them, the requirement isn't clear enough to build.
4. Trace solution-shaped requests back to the underlying problem.

**Scope negotiation:**
- Use MoSCoW (Must/Should/Could/Won't) with stakeholders when capacity < ask.
- Use vertical slicing — ship the Must slice, iterate.
- "Yes, and here's the cost" beats both flat "no" and over-promised "yes."
- When something must give, make the tradeoff explicit and let the accountable owner decide.

**Translating technical constraints to non-engineers:**
- Lead with impact, not mechanism: "this adds one week and a scaling risk" before "because the join fans out across three tables."
- Give options with tradeoffs, not a lecture. "We can do real-time accuracy, but it adds 20ms p99 latency to product pages at our traffic level, or we can use a 60-second cache lag at no latency cost."
- Quantify: effort in days, risk as probability × cost, so the PM can weigh it against value.

**Written artifacts:**
- **RFC (Request for Comments) / design doc** — proposes an approach, surfaces alternatives and tradeoffs, invites review *before* building. The primary alignment tool.
- **ADR (Architecture Decision Record)** — captures a decision, its context, and consequences so future engineers know *why*.
- **RACI (Responsible, Accountable, Consulted, Informed)** — clarifies who does the work, who owns the decision, who gives input, who just needs visibility. Ambiguous ownership is the top cause of dropped balls.

### A strong answer sounds like

*"My first move is to understand the problem before I estimate. Is the goal to reduce checkout failures, or to improve perceived trust on the product page, or both? That shapes what 'done' looks like. Then I'd surface the NFRs the PM probably hasn't thought of — specifically, what accuracy level we need and whether it can come from the existing cache or needs a live read, because those are very different implementation costs. Once I have that, I'd write acceptance criteria in Given/When/Then, apply MoSCoW to cut to the highest-value slice if the full scope doesn't fit the sprint, agree the API contract change in writing with the frontend team before either of us starts, and capture the 'why' in a short RFC so the threshold decision doesn't get re-litigated six months from now."*

### Pitfalls

- **Building from an ambiguous spec** without clarifying, then shipping the wrong thing ("but the ticket said...").
- **Silent scope creep** — absorbing every "small" addition without renegotiating time/scope.
- **Saying "no" flatly** instead of "yes, and here's the tradeoff" — or saying "yes" and missing the date.
- **Drowning non-engineers in jargon** instead of leading with impact and options.
- **Re-litigating decided questions** instead of disagree-and-commit.
- **No written record** — decisions made verbally, then disputed or forgotten.
- **Treating the PM as the boss of the *how*** — or, conversely, ignoring the PM's ownership of priority.
- **Hero-coding around process** — skipping the API-contract conversation and causing integration surprises.
- **Ignoring instrumentation/QA** until launch, then unable to measure or verify success.

---

## Core concepts

### The cross-functional cast and what each cares about
- **Product Manager (PM)** — owns the *what* and *why* (problem, priority, success metric). Cares about user value, timelines, scope. Does **not** own the *how*.
- **Designer (UX/UI)** — owns the user experience and flows. Cares about usability, consistency, edge-case states (empty/loading/error).
- **Data/Analytics** — owns measurement and instrumentation. Cares that you log the right events to evaluate success.
- **QA** — owns quality verification. Cares about testability, acceptance criteria, edge cases.
- **Other engineering teams / platform** — own shared services/contracts. Care about API stability, dependencies, coordination.
- **Support / Sales / CS (Customer Success)** — the voice of the customer and the field; a source of real requirements and a downstream consumer of your changes.
- **EM (Engineering Manager)** — owns people/process, not the technical design.

A senior engineer's job is to make these perspectives *meet the constraints of what's buildable* — translating both directions.

### Requirements clarification
Requirements arrive vague, ambiguous, or solution-shaped. Your job is to make them **precise and testable** before building.
- **Functional requirements** — what the system must *do*.
- **NFRs (Non-Functional Requirements)** — how well: latency, scale, security, availability, compliance. These are *frequently unstated* and are where seniors add the most value by asking.
- **Acceptance criteria** — concrete, testable conditions for "done," ideally **Given/When/Then**. If you can't write acceptance criteria, the requirement isn't clear enough to build.
- **Solution vs. problem** — when a request is phrased as a solution ("add a dropdown"), trace back to the underlying **problem/job** (covered in Product Thinking). Often a better, cheaper solution emerges.

### Scope negotiation & the iron triangle
Scope, time, and quality/resources trade off ("pick two" / the project-management triangle). When something has to give, the senior move is to **make the tradeoff explicit and let the owner decide**, rather than silently cutting quality or slipping the date.
- **MoSCoW** (Must/Should/Could/Won't) is the common scope-cut tool with stakeholders.
- **Vertical slicing** lets you ship value early and renegotiate the rest.
- **"Yes, and here's the cost"** beats both a flat "no" and an over-promised "yes."

### Translating technical constraints to non-engineers
Stakeholders make better decisions when they understand the *cost and risk* in their terms, not yours. Skills:
- **Lead with impact, not mechanism** — "this adds two weeks and a scaling risk" before "because the join fans out."
- **Use analogies and ranges**, avoid jargon; give **options with tradeoffs**, not a lecture.
- **Quantify** — effort in time, risk as probability × cost, so PMs can weigh it against value.

### Disagree and commit
You can argue your position with evidence, but once the accountable owner decides (even against you), you commit fully and execute as if it were your idea. Endless re-litigation erodes trust; silent sabotage is worse. This is a core senior behavior interviewers specifically look for.

### Written communication artifacts
- **RFC (Request for Comments) / design doc** — proposes an approach, surfaces alternatives and tradeoffs, invites review *before* building. The senior engineer's primary alignment tool.
- **ADR (Architecture Decision Record)** — captures a decision, its context, and consequences so future engineers know *why*.
- **One-pager / brief** — aligns stakeholders on problem and approach without a heavy doc.
- Async, written, durable communication scales across time zones and teams far better than meetings.

### RACI and ownership clarity
**R**esponsible, **A**ccountable, **C**onsulted, **I**nformed — a lightweight way to clarify who *does* the work, who *owns the decision*, who *gives input*, and who just needs *visibility*. Ambiguous ownership is a top cause of cross-functional friction and dropped balls.

---

## How it works under the hood (the senior workflow)

1. **Clarify the problem and success metric** with the PM before estimating. ("What does success look like? How will we measure it?")
2. **Surface the unstated NFRs** — scale, latency, security, compliance, edge-case states.
3. **Write testable acceptance criteria** (Given/When/Then); confirm with PM/QA/design.
4. **Estimate and surface tradeoffs** — effort, risk, dependencies — in stakeholder terms.
5. **Negotiate scope** explicitly (MoSCoW, vertical slice) when capacity < ask.
6. **Write it down** — a short RFC/design doc for anything non-trivial; align async.
7. **Coordinate dependencies** — agree on API contracts early so teams unblock in parallel; clarify RACI.
8. **Disagree-and-commit** on the final call; execute; close the loop on results.

---

## Key terms & definitions

- **Functional vs. non-functional requirement** — what it does vs. how well.
- **Acceptance criteria** — testable "done" conditions, often Given/When/Then.
- **NFR (Non-Functional Requirement)** — performance, security, scalability, availability, compliance requirements.
- **Iron triangle** — scope/time/cost(quality) tradeoff.
- **MoSCoW** — Must/Should/Could/Won't scoping.
- **RFC (Request for Comments) / design doc** — written proposal inviting review before building.
- **ADR (Architecture Decision Record)** — recorded architectural decision + rationale.
- **RACI (Responsible/Accountable/Consulted/Informed)** — ownership matrix.
- **Disagree and commit** — argue, then fully support the decision once made.
- **Anti-corruption layer (org sense)** — a stable contract that shields your team from another team's churn.
- **Conway's Law** — system structure mirrors org communication structure.

---

## Tradeoffs

- **Speed of alignment vs. thoroughness** — a heavyweight design-review process aligns deeply but slows small work; match ceremony to stakes.
- **Saying yes (relationship) vs. protecting scope/quality** — over-accommodating breeds scope creep and burnout; resolve with "yes, and here's the cost."
- **Sync meetings vs. async docs** — meetings build rapport and resolve ambiguity fast; docs scale and create a record. Use meetings to *decide*, docs to *align and persist*.
- **Engineering ideal vs. business reality** — the "right" architecture may not fit the deadline; seniors find the defensible middle and name the debt.
- **Following the spec vs. pushing back** — blind execution ships the wrong thing; constant pushback stalls delivery. Calibrate with data.

---

## Common pitfalls & misconceptions

- **Building from an ambiguous spec** without clarifying, then shipping the wrong thing ("but the ticket said...").
- **Silent scope creep** — absorbing every "small" addition without renegotiating time/scope.
- **Saying "no" flatly** instead of "yes, and here's the tradeoff" — or saying "yes" and missing the date.
- **Drowning non-engineers in jargon** instead of leading with impact and options.
- **Re-litigating decided questions** instead of disagree-and-commit.
- **No written record** — decisions made verbally, then disputed or forgotten.
- **Treating the PM as the boss of the *how*** — or, conversely, ignoring the PM's ownership of priority.
- **Hero-coding around process** instead of coordinating dependencies, causing integration surprises.
- **Ignoring instrumentation/QA** until launch, then unable to measure or verify success.

---

## What interviewers probe

- *"A PM gives you a vague one-line feature request. What do you do first?"* — Clarify problem/success metric, surface NFRs, write acceptance criteria — *before* estimating.
- *"You disagree with the PM/design on the approach. How do you handle it?"* — Evidence-based pushback, propose alternative, disagree-and-commit.
- *"The deadline can't fit the scope. What do you do?"* — Make the tradeoff explicit (MoSCoW / triangle), recommend, let the owner decide.
- *"Explain a technical constraint to a non-technical stakeholder."* — Lead with impact, options, ranges; no jargon.
- *"Two teams' work depends on each other and you're blocked. How do you unblock?"* — Agree contracts early, clarify RACI, communicate proactively.
- Red flags: builds without clarifying, can't say no, can't disagree-and-commit, can't translate tech to business, blames PM/design, no written alignment.

---

## Quick-reference summary

- **Clarify before you build:** problem, success metric, unstated **NFRs (Non-Functional Requirements)**, and **testable acceptance criteria** (Given/When/Then).
- Trace **solution-shaped requests back to the problem**.
- When capacity < ask, **make the scope/time/quality tradeoff explicit** (MoSCoW, vertical slice) and let the owner decide — **"yes, and here's the cost."**
- **Translate tech to business:** lead with impact, give options with quantified cost/risk, drop the jargon.
- **Disagree and commit:** argue with evidence, then fully support the decision.
- **Write it down:** RFC/design doc to align, ADR to record *why*.
- **Clarify ownership (RACI)** and **agree API contracts early** to unblock teams in parallel.
