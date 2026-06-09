# Problem Decomposition — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Break epics into shippable slices, scoping, estimation.

The senior skill here is turning a vague, scary epic into a **sequence of small, independently valuable, independently shippable slices** — each de-risking the next, each providing feedback, none requiring a "big bang" cutover. Interviewers test whether you can find the *thinnest slice that delivers learning or value* and sequence work to attack risk early.

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
| MVP / thin slice | Minimum increment that delivers value or validated learning. |
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
