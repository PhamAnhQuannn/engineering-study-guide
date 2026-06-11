# Problem Decomposition — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Break epics into shippable slices, scoping, estimation.

> **🛒 Where we are in building ShopFast** — In the previous topic we learned [how to make the architecture decision](../../01-decision-making/01-knowledge/README.md) — picking a modular monolith for ShopFast. That decision produced a large, intimidating epic: "build the checkout flow." This topic teaches how to slice that epic into small, independently shippable pieces so the team can learn and deliver without a big-bang launch. **Next:** once the work is sliced, you need to [grow the junior engineers](../../03-mentorship/01-knowledge/README.md) picking up those slices.

---

## Teaching arc: slicing ShopFast's checkout into shippable pieces

### What it is & why it matters

**Decomposition** is the art of turning a vague, scary epic into a **sequence of small, independently valuable, independently shippable slices** — each de-risking the next, each providing feedback, none requiring a "big bang" cutover. The senior skill is not just breaking work into tasks; it is finding the *thinnest slice that delivers learning or value* and sequencing work to attack risk early.

Why do seniors get paid extra for this? Because the most expensive mistakes in software happen late — when a team discovers at week 10 that the payment provider integration is fundamentally broken, or that the cart-to-order handoff needs a distributed transaction they cannot cheaply build. Good decomposition surfaces those risks at week 1, when changing course costs a sprint instead of a quarter.

### A ShopFast case

**Framing.** The team has decided to build the checkout flow end-to-end: browse catalog → add to cart → checkout → pay → receive confirmation email. The product manager wants it live in 6 weeks. Left decomposed horizontally, the natural temptation is: build all the DB tables first, then all the APIs, then the UI, then wire payments, then emails. Nothing ships until week 6.

**Options and criteria.** The team considers two approaches: (A) **horizontal slicing** — layer by layer, (B) **vertical slicing** — thin end-to-end paths for one scenario at a time. Criteria: when can we get real user feedback? When do we discover the payment integration risk? Can we ship behind a feature flag and iterate?

**Decision and sequencing.** The lead engineer draws a **walking skeleton**: the thinnest end-to-end path that proves the pipes connect — one product, one hard-coded price, one successful Stripe call, one order row saved, no email, no error handling. Slice 1 is this skeleton, shipped behind a feature flag. It surfaces the scariest unknown early: does the Stripe API integration work in production? It does. Slice 2 adds real product selection from the catalog. Slice 3 adds inventory checks and the idempotency key on `POST /v1/orders` (so retried mobile checkouts do not double-charge). Slice 4 adds confirmation emails via the queue. Each slice passes the **INVEST** criteria — Independent, Negotiable, Valuable, Estimable, Small, Testable.

**Scope document.** The team writes explicit **in / out / later**: *in scope for launch* — happy-path checkout, basic card payment, order confirmation row; *out of scope* — refunds, address validation, gift cards; *later* — loyalty points, saved payment methods. Naming "later" explicitly prevents silent scope creep.

**Outcome.** The walking skeleton is deployed at end of week 1. By week 3 the team has real checkout working in staging behind a flag. The email service turns out to be the only major slip (the worker queue config takes longer than estimated); because emails were slice 4 rather than a day-1 dependency, the launch proceeds without them and they ship in the following sprint.

### How to handle it

1. **Classify the slicing axis.** Vertical slice = thin end-to-end path for one scenario, all layers. Horizontal slice = one full layer for all scenarios. Default to vertical.
2. **Build the walking skeleton first.** The smallest end-to-end implementation that exercises the full architecture — deploy, auth, DB, API, UI, external call. Proves the pipes connect.
3. **Sequence risk-first.** Order slices by "what kills the project if it is wrong." Attack the highest-uncertainty unknowns first.
4. **Apply INVEST to each slice.** If a slice cannot be estimated, it is not understood — decompose further or run a **spike** (a timeboxed throwaway investigation that produces knowledge, not product code).
5. **Write scope as in / out / later.** Name what is deferred so it does not silently creep back in.
6. **Ship behind feature flags.** Deploy dark; iterate in production without exposing users to partial states.

For **estimation**, use relative sizing (story points or t-shirt sizes) — humans estimate *relative* complexity better than absolute hours. Communicate as ranges, not points. Use **reference-class forecasting** (comparing to similar past work) rather than decomposing from zero, which systematically underestimates due to the planning fallacy.

### A strong answer sounds like

> "When we picked up the checkout epic at ShopFast, the first thing I did was draw the walking skeleton — the thinnest path that would prove the payment integration worked end-to-end: one product, hard-coded price, one Stripe call, one order row. That is slice 1, behind a flag. I sequenced the scary unknown — the Stripe integration — to day 1 rather than week 4. Each subsequent slice passed INVEST: independent, small enough to ship in a few days, demonstrable on its own. I also wrote an explicit in/out/later document — refunds and gift cards went to 'later,' which kept the scope conversation honest. The email slice slipped, but because it was last in the sequence rather than a prerequisite, we launched on time and shipped emails the next sprint. The lesson was: always put the external dependency you cannot control — the payment provider — into slice 1."

STAR (Situation, Task, Action, Result) sketch: Situation is the checkout epic with a 6-week deadline, Task is decomposing it safely, Action is the walking skeleton + risk-first sequencing + INVEST + in/out/later, Result is an on-time launch with only a non-blocking slip.

### Pitfalls

- **Horizontal slicing by default** — building all of one layer before any value exists.
- **Boil-the-ocean first slice** — the first slice tries to handle every edge case instead of one happy path.
- **No walking skeleton** — integrating all components at the end ("integration hell").
- **Estimating big unknowns precisely** — false confidence; spike first.
- **Confusing "smaller tasks" with "decomposed slices"** — ten tasks that only deliver value together is still one big-bang.
- **Ignoring the planning fallacy** — estimating from an idealized clean run, no buffer for the unknown unknowns.
- **Scope creep via silence** — not writing down out-of-scope/later, so it creeps back in.
- **Sequencing easy-first instead of risky-first** — feels productive but leaves the project-killing unknown for the end.

---

## Core concepts

### Vertical vs horizontal slicing
- **Horizontal slice:** a full layer (all DB tables, then all APIs, then all UI). Nothing is usable until the last layer lands — high integration risk, no early feedback. Anti-pattern for most product work.
- **Vertical slice:** a thin end-to-end path through every layer for *one narrow scenario* (one endpoint, one user, one record type). Shippable and demonstrable on its own. This is the default for senior decomposition.
- A vertical slice forces all the layers to integrate early, surfacing the scary unknowns first.

### The thinnest viable slice ("walking skeleton")
A **walking skeleton** is the smallest end-to-end implementation that exercises the full architecture — even if it only handles one trivial case. It proves the pipes connect (deploy, auth, DB, API, UI) so every later slice is an increment, not an integration gamble.

### Risk-first sequencing
Order slices by **what kills the project if it's wrong**. Attack the highest-uncertainty, highest-blast-radius unknowns first while the cost of changing course is lowest. "Do the scary part first" — a feasibility spike before committing the roadmap.

### INVEST for slices
Good slices are **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, **T**estable. If a slice can't be estimated, it's not understood yet — decompose further or spike it.

### Scoping: in / out / later
Explicitly write what's **in scope**, **out of scope**, and **deferred (later)**. Most scope creep comes from unstated assumptions. Naming "later" lets you ship the core without the perception of cutting corners.

---

## How decomposition works under the hood

### From epic → milestones → slices → tasks
1. **Epic:** the business outcome ("users can schedule recurring payments").
2. **Milestones:** demonstrable checkpoints ("one-time payment works end to end" → "recurring works" → "edit/cancel works").
3. **Slices:** thin vertical paths within a milestone, each shippable behind a flag.
4. **Tasks:** the engineering steps inside a slice.

### De-risking techniques
- **Spike:** a timeboxed throwaway investigation to answer a feasibility question. Output is *knowledge*, not production code.
- **Walking skeleton + flag:** ship the skeleton dark behind a feature flag; iterate slices in production safely.
- **Strangler fig (for migrations):** route a thin slice of traffic to the new path, grow incrementally, retire the old.
- **Tracer bullet:** a working (if incomplete) end-to-end path that you progressively flesh out.

### Estimation
- **Relative sizing (story points / t-shirt sizes)** beats absolute hours for planning — humans estimate *relative* complexity better than absolute time.
- **Cone of uncertainty:** estimates early in a project are wildly imprecise (often 4x range) and tighten as you learn. Communicate estimates as ranges, not points.
- **Reference-class forecasting:** estimate by comparing to *similar past work*, not by decomposing from zero (which systematically underestimates — the planning fallacy).
- **Decompose to estimate:** if you can't size something, it's too big or too unknown; split or spike it.

---

## Key terms & definitions

| Term | Definition |
|------|-----------|
| Vertical slice | Thin end-to-end path through all layers for one narrow scenario; independently shippable. |
| Walking skeleton | Smallest end-to-end build exercising the full architecture. |
| Spike | Timeboxed throwaway investigation producing knowledge, not product code. |
| INVEST | Criteria for good slices: Independent, Negotiable, Valuable, Estimable, Small, Testable. |
| Strangler fig | Incremental migration that grows a new system around the old until the old is retired. |
| Cone of uncertainty | Estimate precision improves as a project progresses. |
| Planning fallacy | Systematic tendency to underestimate task time. |
| Reference-class forecasting | Estimating by analogy to similar completed work. |
| MVP (Minimum Viable Product) / thin slice | Minimum increment that delivers value or validated learning. |
| Definition of Done | Agreed checklist that makes "done" unambiguous. |

---

## Tradeoffs

- **Thin slices vs overhead:** very thin slices maximize feedback but add per-slice ceremony (PRs, deploys, flags). Calibrate slice size to risk and team cadence.
- **Up-front design vs emergent:** too much design ignores what you'll learn; too little risks rework when slices don't compose. Design the skeleton and interfaces up front; let details emerge.
- **Independent slices vs shared foundations:** truly independent slices sometimes duplicate work; a shared foundation creates coupling and sequencing dependencies. Prefer independence early, refactor to shared abstractions once the pattern is clear.
- **Precise estimates vs cost of estimating:** detailed estimation is itself expensive and decays fast. Estimate to the precision the decision requires, no more.

---

## Common pitfalls & misconceptions

- **Horizontal slicing by default** — building all of one layer before any value exists.
- **Boil-the-ocean first slice** — the first slice tries to handle every edge case instead of one happy path.
- **No walking skeleton** — integrating all components at the end ("integration hell").
- **Estimating big unknowns precisely** — false confidence; spike first.
- **Confusing "smaller tasks" with "decomposed slices"** — ten tasks that only deliver value together is still one big-bang.
- **Ignoring the planning fallacy** — estimating from an idealized clean run, no buffer for the unknown unknowns.
- **Scope creep via silence** — not writing down out-of-scope/later, so it creeps back in.
- **Sequencing easy-first instead of risky-first** — feels productive but leaves the project-killing unknown for the end.

---

## What interviewers probe

- "How would you break this epic into a 2-week deliverable?" → They want a *vertical* first slice that's demonstrable, with explicit scope cuts.
- "What's the riskiest part and how do you de-risk it?" → Risk-first sequencing, spikes, walking skeleton.
- "How do you estimate something you've never built?" → Reference-class, ranges, cone of uncertainty, spike-then-estimate.
- "How do you ship incrementally without a half-broken product in front of users?" → Feature flags, dark launches, strangler fig.
- "Walk me through scoping a project with a fixed deadline." → In/out/later, cutting scope not quality, negotiating the *what* when the *when* is fixed.

---

## Quick-reference summary

- Slice **vertically**, not horizontally — thin end-to-end paths.
- Build a **walking skeleton** first; every later slice is an increment.
- Sequence **risk-first**: do the scary, high-uncertainty part early.
- Make slices pass **INVEST**; if you can't estimate it, decompose or spike it.
- Estimate as **ranges**, use **reference-class** forecasting, respect the **planning fallacy**.
- Write scope as **in / out / later** to kill silent creep.
- Ship behind **feature flags**; migrate with the **strangler fig**.
- When the deadline is fixed, cut **scope**, never quality or correctness.
