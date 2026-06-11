# Decision Making — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Tradeoff reasoning, build vs buy, tech selection.

> **🛒 Where we are in building ShopFast** — In the previous topic we locked down [Secrets & Auth security](../../../09-security/04-secrets/01-knowledge/README.md) for ShopFast. Now we step back from implementation and ask: **how did we make every ShopFast architecture choice in the first place?** This topic teaches the judgment behind those calls — reversibility, tradeoff reasoning, and when to stop deliberating and commit. **Next:** once we can make a good decision, we need to [decompose the resulting work](../../02-decomposition/01-knowledge/README.md) into shippable slices.

---

## Teaching arc: the judgment behind ShopFast's decisions

### What it is & why it matters

A **decision** is an irreversible-or-costly-to-reverse commitment of resources under uncertainty. If it costs nothing to undo, it is not really a decision — just do it and learn. Senior engineers are paid more for making **good decisions under uncertainty** than for writing code. The interview signal is not "did you pick the thing I would have picked" — it is "do you have a repeatable, evidence-driven process, and do you know when to stop deliberating and commit."

Why do seniors get paid extra for this? Because a bad Type-1 (one-way door) decision — wrong database engine, wrong public API contract, wrong data model — can cost a team months of rework and erode user trust in ways that no amount of fast coding recovers. The leverage is asymmetric: good decision process is cheap relative to the cost of reversing a bad call.

### A ShopFast case

**Framing.** It is week 1 of ShopFast. The four-person team needs to pick an architecture. Two loud options on the table: (A) a **microservices** setup with separate `catalog`, `cart`, and `order` services from day one, or (B) a **modular monolith** — one deployable with hard internal module seams.

**Options and criteria.** The team explicitly writes success criteria: deploy speed, team cognitive load, cost, ability to extract services later. They generate three real options — microservices, modular monolith, and a "pure monolith / spaghetti" baseline (the no-architecture option). They weight criteria: cost and speed-to-first-deploy are high-priority at pre-launch; team overhead is high-priority for a 4-person shop.

**Decision.** Microservices is a **Type-1 (one-way door)** — once teams and codebases split, the operational and organizational overhead is extremely hard to undo. Spaghetti is a Type-2 at first but becomes Type-1 fast (you can't easily add seams retroactively). A modular monolith is **Type-1 in organizational structure but Type-2 in deployment** — the module seams are in code, so `catalog` can be extracted into its own service later without touching the other modules. The team records this in an **Architecture Decision Record (ADR)**: context, the three options, the weighted criteria, the decision, and — critically — *what would change their mind* ("when write throughput outgrows one Postgres primary, or when two teams need independent deploy cadences").

**Outcome.** ShopFast ships with a modular monolith (one deployable, one Postgres primary with read replicas, hard module interfaces). The decision deferred the cost of distributed systems — network latency, distributed transactions, service mesh — to when there is actual evidence it is needed. Cost: ~free at launch. Blast radius of being wrong: one refactor sprint to extract a module, not a full rewrite.

### How to handle it

Use the **decision-making loop**:

1. **Classify reversibility first.** Is this a one-way door (Type 1) or a two-way door (Type 2)? Match the amount of process to the reversibility, not your anxiety.
2. **Frame the real constraint.** What are we actually deciding? What is the binding constraint — time, cost, headcount, risk?
3. **Define measurable success criteria.** "Lower latency" is not a criterion; "p99 (99th-percentile latency) < 150 ms at 1,800 read QPS (queries per second)" is.
4. **Generate at least 3 genuine options** including "do nothing" and "the boring option." Fake alternatives are the most common interview red flag.
5. **Evaluate against criteria.** Weight explicitly; surface assumptions.
6. **Decide and record.** Write an ADR: context, alternatives, decision, *what would change my mind*, review trigger.
7. **Set a review trigger.** A metric or date that forces revisiting — without it, stale decisions quietly accumulate.

For **build vs buy vs open-source (OSS)**, weigh: core-vs-context differentiation, total cost of ownership (TCO) over 3 years (not sticker price), exit cost, team expertise, and compliance. Juniors compare sticker price; seniors compare 3-year TCO and exit cost.

### A strong answer sounds like

> "When we were picking ShopFast's architecture in week 1, the first question I asked was: is this reversible? Microservices looked attractive but splitting teams and codebases is essentially a one-way door — so I applied Type-1 rigor: wrote out three explicit options, scored them against weighted criteria (cost, team size, deploy speed, ability to extract later). The modular monolith won on every weighted criterion at our stage. I documented it in an ADR with the decision, the alternatives I rejected and why, and the *explicit trigger* to revisit — when write throughput outgrows one primary or when we need independent deploy cadences. Six months later that trigger hadn't fired, which validated the call. The one thing I would do differently is involve the product manager earlier — the business constraint of a 4-month runway was the biggest forcing function and I only surfaced it late in the document."

This is a **STAR (Situation, Task, Action, Result)** sketch: the Situation is the architecture choice, the Task is making a defensible call under time pressure, the Action is the reversibility classification + ADR, the Result is the on-time launch and a clear trigger for the next decision.

### Pitfalls

- **Analysis paralysis on Type-2 decisions.** If you can undo it in a sprint, stop the meeting and ship.
- **HiPPO (Highest Paid Person's Opinion)** — deciding by seniority of the arguer, not strength of the argument.
- **Sunk cost.** "We already built half of it." Past spend is irrelevant to the forward decision.
- **One option dressed as three.** Generating fake alternatives to justify the predetermined answer. Interviewers notice immediately.
- **No reversal trigger.** Making a call and never revisiting even when the assumptions clearly broke.
- **Confusing decision quality from outcome.** A good process can produce a bad outcome (and vice versa). Judge the process and the information available at the time, not hindsight.
- **Deciding alone when you should syndicate, or syndicating when you should just decide.**

---

## Core concepts

### What a "decision" actually is
A decision is an **irreversible-or-costly-to-reverse commitment of resources under uncertainty**. If it's free to undo, it's not really a decision — just do it and learn. The senior skill is calibrating effort to consequence.

- **Type 1 (one-way door):** hard/expensive to reverse — database choice, public API contract, auth model, data residency. Deliberate, write it down, get review.
- **Type 2 (two-way door):** cheap to reverse — a library, an internal endpoint shape, a feature flag default. Decide fast, delegate, don't over-process.
- The classic failure: applying Type-1 rigor to Type-2 decisions (analysis paralysis) or Type-2 casualness to Type-1 decisions (regret).

### The decision-making loop
1. **Frame the problem** — what are we actually deciding? What's the real constraint (time, money, headcount, risk, reversibility)?
2. **Define success criteria** — measurable. "Lower latency" → "p99 < 200ms at 5k RPS."
3. **Generate options** — at least 3, including "do nothing" and "the boring option."
4. **Evaluate against criteria** — weighted, explicit. Surface assumptions.
5. **Decide and record** — pick one, write down *why* and *what would change your mind*.
6. **Set a review trigger** — a date or metric that forces revisiting.

### Disagree and commit
Once a decision is made (even one you argued against), you support it fully. Re-litigating decided issues is a senior anti-pattern. You voice dissent *before* the decision, record it, then row in the same direction.

---

## How decisions get made under the hood

### Reversibility-first thinking
Bezos's "one-way vs two-way door" reframes speed. Most decisions are reversible; treat them as such and move fast. Reserve heavy process for the genuinely irreversible. This is the single most useful mental model for the seniority signal.

### Cost of delay vs cost of being wrong
- **Cost of delay (CoD):** what does each week of *not deciding* cost? (lost revenue, blocked team, compounding tech debt).
- **Cost of being wrong:** what's the blast radius and recovery cost if we pick wrong?
- Decide when `CoD > expected cost of a wrong-but-recoverable choice`. For two-way doors, that threshold is reached almost immediately.

### Build vs Buy vs Adopt(OSS)
Evaluate on: **core-vs-context**, **TCO (Total Cost of Ownership)**, **time-to-value**, **lock-in/exit cost**, **team expertise**, **compliance/security**, **maintenance burden**.
- **Build** when it's *core differentiation*, no vendor fits, or lock-in is unacceptable. You own the maintenance forever.
- **Buy** when it's *undifferentiated heavy lifting* (auth, payments, email, observability) and a vendor does it better than you ever will. Watch for lock-in and per-seat/usage cost curves at scale.
- **Adopt OSS (Open-Source Software)** for a middle path: control without full build cost, but you inherit operational burden and security patching.
- **TCO = build/license cost + integration + operations + opportunity cost of engineers not doing core work.** Juniors compare sticker price; seniors compare 3-year TCO and exit cost.

### Tech selection
Rank against weighted criteria, not vibes. Common axes: fit-for-problem, team familiarity, ecosystem/community health, operational maturity, hiring pool, performance, licensing, and **boringness**. "Choose boring technology" — spend your limited innovation tokens on the few things that are genuinely core; use proven, well-understood tools everywhere else.

---

## Key terms & definitions

| Term | Definition |
|------|-----------|
| One-way / two-way door | Irreversible vs reversible decision; calibrate process to reversibility. |
| Disagree and commit | Voice dissent before; fully support after. |
| Cost of delay (CoD) | Economic cost per unit time of not deciding/shipping. |
| TCO (Total Cost of Ownership) | Total cost over the asset's life, not sticker price. |
| Innovation tokens | Finite budget for novel/risky tech; spend on core only. |
| ADR (Architecture Decision Record) | Lightweight doc capturing decision + context + alternatives + consequences. |
| RAID/DACI/RACI | Frameworks for who decides/contributes/is consulted/informed. |
| Reversible default | Designing so the default choice is the easy-to-undo one. |
| Sunk cost fallacy | Continuing because of past investment, not future value. |
| HiPPO (Highest Paid Person's Opinion) | Bias to avoid; decide on data. |

---

## Tradeoffs

- **Speed vs rigor:** more analysis reduces variance but increases CoD. The right amount of analysis is a function of reversibility and blast radius, not your comfort.
- **Consensus vs decisiveness:** consensus builds buy-in but is slow and can converge on mediocrity. Use a clear **decider** (DACI's "D") for Type-1 calls; reserve consensus for genuinely cross-cutting concerns.
- **Optionality vs commitment:** keeping options open has value (real options theory) but costs focus. Commit once the marginal info from waiting is small.
- **Local optimum vs global:** the right call for your team may be wrong for the org. Seniors widen the frame.

---

## Common pitfalls & misconceptions

- **Analysis paralysis** on reversible decisions. If you can undo it in a sprint, stop the meeting and ship.
- **HiPPO / authority bias** — deciding by seniority of the arguer, not strength of the argument.
- **Sunk cost** — "we already built half of it." Past spend is irrelevant to the forward decision.
- **One option dressed as three** — generating fake alternatives to justify the predetermined answer. Interviewers smell this.
- **Ignoring the "do nothing" option** — sometimes the best decision is not to act yet.
- **No reversal trigger** — making a call and never revisiting even when the assumptions clearly broke.
- **Confusing decisions with their outcomes** — a good decision can have a bad outcome (and vice versa). Judge the *process and information available at the time*, not hindsight.
- **Deciding alone when you should syndicate, or syndicating when you should just decide.**

---

## What interviewers probe

- "Tell me about a hard technical decision you made." → They want the *process*: options considered, criteria, who you consulted, what you'd change your mind on, and the follow-up review.
- "How do you decide build vs buy?" → Looking for TCO, core-vs-context, exit cost, not feature checklists.
- "A decision you got wrong?" → Looking for ownership, a clean separation of decision-quality from outcome, and concrete lessons that changed your later process.
- "How do you make a decision when the data is incomplete?" → Reversibility framing, smallest reversible experiment, explicit assumptions with review triggers.
- "How do you handle disagreement on a decision?" → Disagree-and-commit, clear decider, recording dissent.

Red flags they listen for: deciding by ego/seniority, no written rationale, no success metric, never revisiting, or being unable to name a single tradeoff.

---

## Quick-reference summary

- Classify first: **one-way vs two-way door**. Match process to reversibility.
- Always generate ≥3 options including **do nothing** and **the boring one**.
- Define **measurable success criteria** before evaluating.
- Decide on **3-year TCO and exit cost**, not sticker price.
- Spend **innovation tokens** only on core differentiation; default to boring tech.
- Record the decision (ADR): context, alternatives, decision, **what would change my mind**, review trigger.
- Separate **decision quality from outcome**; own both.
- **Disagree and commit.** Dissent before, support after.
- Beat the biases: sunk cost, HiPPO, analysis paralysis, fake alternatives.
