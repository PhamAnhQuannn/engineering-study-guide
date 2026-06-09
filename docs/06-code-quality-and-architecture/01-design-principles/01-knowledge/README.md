# Design Principles — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: SOLID, DRY, YAGNI, coupling/cohesion.

Design principles are heuristics, not laws. They exist to manage one thing: **the cost of change**. A senior engineer applies them to keep a codebase soft (easy to change) without over-engineering for changes that never come. The recurring theme is **localizing the blast radius of a change** by controlling dependencies.

---

## Why principles exist: the cost of change

Software cost is dominated by maintenance, not initial authoring. Every line you write is read ~10x and modified several times. Principles optimize for the reader and the future modifier, sometimes at the expense of the original author. The two underlying levers behind nearly every principle:

- **Coupling** — how much one module must know about another. High coupling means a change ripples.
- **Cohesion** — how related the responsibilities inside one module are. Low cohesion means a module changes for many unrelated reasons.

Goal: **loose coupling, high cohesion.** Everything below is a tactic toward that goal.

---

## SOLID

Five object-oriented design principles popularized by Robert C. Martin. They apply beyond OOP — the ideas map onto modules, services, and functions.

### S — Single Responsibility Principle (SRP)
A module should have **one reason to change**. "Reason to change" means one *actor* / stakeholder. A class that formats a report *and* persists it has two reasons (the formatting team and the DBA). Split them.

- Misconception: "do one thing." It's not about doing one thing — `calculatePay()` does many things. It's about *answering to one source of change requests*.
- Smell: a class injected into unrelated features; "God objects"; methods grouped by no common axis.
- Tradeoff: over-applied, SRP creates a fog of tiny classes ("class explosion") that hides the actual flow.

### O — Open/Closed Principle (OCP)
Modules should be **open for extension, closed for modification.** You add behavior by adding new code (a new subclass, strategy, plugin), not by editing tested code. Achieved via polymorphism / abstraction seams.

- Example: a `PaymentProcessor` interface; adding PayPal means a new `PayPalProcessor`, not an `if (type == "paypal")` edit in a switch.
- Tradeoff: anticipating *where* extension is needed is guesswork. Premature OCP = needless abstraction. Apply it to axes that have *already* changed once (the "Rule of Three").

### L — Liskov Substitution Principle (LSP)
Subtypes must be substitutable for their base type **without breaking callers' expectations** (preconditions can't strengthen, postconditions can't weaken, invariants preserved).

- Classic violation: `Square extends Rectangle` — setting width on a Square silently changes height, breaking code that assumes independent dimensions.
- Violation: a subclass that throws `UnsupportedOperationException` for an inherited method (e.g. immutable list extending mutable list).
- Probe: LSP is about *behavioral* subtyping, not just compiling. The compiler can't catch most violations.

### I — Interface Segregation Principle (ISP)
Clients shouldn't be forced to depend on methods they don't use. Prefer **many small role interfaces** over one fat interface.

- Smell: implementing an interface where half the methods throw "not supported."
- Example: split `Worker { work(); eat() }` so a `Robot` only depends on `Workable`, not `Eatable`.

### D — Dependency Inversion Principle (DIP)
High-level policy should not depend on low-level details; **both depend on abstractions.** Abstractions shouldn't depend on details; details depend on abstractions.

- The "inversion": normally `OrderService` → `MySqlRepo`. Invert by defining `OrderRepository` interface *owned by the domain*; `MySqlRepo` implements it. The arrow now points *into* the high-level module.
- Enables testing (inject a fake repo), swapping infra, and clean architecture's dependency rule.
- DIP ≠ Dependency Injection. DIP is the principle (depend on abstractions). DI is one mechanism (passing dependencies in) to achieve it.

---

## DRY — Don't Repeat Yourself

"Every piece of **knowledge** must have a single, unambiguous, authoritative representation." (Hunt & Thomas)

- DRY is about **knowledge/intent duplication, not code-text duplication.** Two functions with identical bodies that change for *different reasons* are not a DRY violation — coupling them is the mistake.
- Over-DRYing creates the wrong abstraction. Sandi Metz: "duplication is far cheaper than the wrong abstraction." A premature shared helper forces unrelated callers to evolve together.
- WET (Write Everything Twice) / Rule of Three: tolerate duplication until the third occurrence reveals the real shared concept.
- Forms of duplication: code, knowledge in code + docs + DB schema (use code-gen / single source of truth), config drift.

---

## YAGNI — You Aren't Gonna Need It

Don't build functionality on speculation. Implement what the *current* requirement needs.

- Pairs with "do the simplest thing that could possibly work" (XP).
- Cost of speculative generality: carrying, maintaining, and reading code that's never used; it also *constrains* future design because you now must keep it working.
- Tension with OCP: OCP says prepare for extension; YAGNI says don't. Resolve by reacting to the *second* real change, not the imagined first.

---

## KISS, Law of Demeter, Composition over Inheritance

- **KISS** (Keep It Simple): prefer the boring, obvious solution. Complexity must earn its place.
- **Law of Demeter (LoD) / "principle of least knowledge":** a method should only talk to its immediate collaborators — `this`, its params, objects it creates, its direct fields. Avoid `a.getB().getC().doThing()` train wrecks. Violations expose internal structure → coupling. (Caveat: fluent builders and streams are *intentional* train-like APIs and exempt.)
- **Composition over inheritance:** inheritance is the tightest coupling in OOP (subclass depends on superclass internals; fragile base class problem). Prefer composing behaviors (strategy objects, delegation). Inheritance is for true *is-a* + LSP-clean relationships only.

---

## Coupling & cohesion — the core lens

### Coupling (lower is better), worst → best
- **Content coupling** — one module reaches into another's internals.
- **Common/global coupling** — shared mutable global state.
- **Control coupling** — passing a flag that tells the callee *what to do* (`doStuff(true)`).
- **Stamp coupling** — passing a whole struct when only a field is needed.
- **Data coupling** — passing exactly the data needed. (Acceptable.)
- **Message/loose coupling** — interacting via events/messages with no shared types. (Best for distributed systems.)

### Cohesion (higher is better), best → worst
Functional (one well-defined task) > sequential > communicational > procedural > temporal (grouped only by "happens at startup") > logical > coincidental (random grab-bag, worst).

### Connascence (a precise vocabulary for coupling)
Two elements are *connascent* if changing one requires changing the other. Static forms (name, type, position, algorithm) are weaker; dynamic forms (execution order, timing, value, identity) are stronger and harder to detect. Senior move: reduce **strength**, **degree** (how many elements), and **locality** (keep connascence inside a module, never across boundaries).

---

## Tradeoffs & common pitfalls

| Pitfall | What it looks like | Fix |
|---|---|---|
| Over-abstraction | Interfaces with one impl, factories for factories | YAGNI; abstract on second real need |
| Wrong abstraction (over-DRY) | Shared helper with 6 boolean flags | Inline it; re-extract the *correct* seam |
| Anemic SRP | 200 one-method classes, logic scattered | Group by reason-to-change, not by verb |
| Cargo-cult patterns | Patterns applied because "clean" | Principles serve change cost, not aesthetics |
| Speculative generality | Plugin systems with one plugin | Delete unused extension points |
| LSP by compilation | "It compiles, so it substitutes" | Reason about behavior/contracts |

---

## What interviewers probe

- **Can you define a reason to change?** (SRP depth — actors, not verbs.)
- **DRY nuance:** will you couple two accidentally-identical code blocks? Strong candidates say "depends if they share *knowledge*."
- **DIP vs DI:** do you conflate them?
- **When NOT to apply a principle** — the most senior signal. Over-engineering is as much a failure as under-engineering.
- **Concrete refactor:** "Here's a class violating SRP — how do you split it, and what's the risk?"
- **Coupling vocabulary:** can you name *types* of coupling, not just "tightly coupled"?

---

## Quick-reference summary

- Principles minimize **cost of change** via **low coupling + high cohesion**.
- **SOLID:** SRP (one reason to change), OCP (extend, don't modify), LSP (substitutable subtypes), ISP (small interfaces), DIP (depend on abstractions).
- **DRY:** one source of truth for each piece of *knowledge* — not text dedup.
- **YAGNI:** build for today's requirement; resist speculation.
- **Rule of Three:** tolerate duplication twice; abstract on the third.
- **Composition > inheritance;** **Law of Demeter** to avoid train wrecks.
- The wrong abstraction is costlier than duplication.
- Senior signal: knowing **when not** to apply a principle.
