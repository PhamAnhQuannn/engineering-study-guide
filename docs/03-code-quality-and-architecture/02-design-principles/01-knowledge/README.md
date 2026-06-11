# Design Principles — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: SOLID, DRY, YAGNI, coupling/cohesion.

Design principles are heuristics, not laws. They exist to manage one thing: **the cost of change**. A senior engineer applies them to keep a codebase soft (easy to change) without over-engineering for changes that never come. The recurring theme is **localizing the blast radius of a change** by controlling dependencies.

> **🛒 Where we are in building ShopFast** — Last topic, [Clean Code](../../01-clean-code/01-knowledge/README.md) taught us readable, intention-revealing code at the expression level. Now we zoom out: this topic covers the principles that keep the `catalog`, `cart`, and `order` modules healthy and easy to change. **Next:** [Design Patterns](../../03-design-patterns/01-knowledge/README.md) — the named solutions we reach for when those principles meet real recurring problems.

---

## Teaching arc: keeping ShopFast changeable

### What it is

Design principles are **rules of thumb for writing code that remains cheap to change.** Think of a city's zoning laws — they don't tell you how to build every house, but they prevent the water plant from being built in the middle of a school district. Principles keep software concerns in the right "zones" so a change to payments doesn't ripple into the catalog.

The two levers everything reduces to:

- **Coupling** — how much one module must know about another. High coupling means a change ripples.
- **Cohesion** — how related the responsibilities inside one module are. Low cohesion means a module changes for many unrelated reasons.

Goal: **loose coupling, high cohesion.** Every principle below is a tactic toward that goal.

### What it looks like

A before/after sketch showing coupling in action — ShopFast's `OrderService` reaching directly into the catalog's database:

```
BEFORE (tight coupling — OrderService knows catalog's DB schema):

  OrderService
      │
      ▼
  catalog.products   ← OrderService queries this table directly
  (DB table)             Any catalog schema change breaks orders

AFTER (decoupled — OrderService depends on an abstraction):

  OrderService
      │
      ▼
  CatalogApi          ← interface *owned by the order module*
  (interface)
      ▲
      │
  CatalogApiImpl      ← catalog module implements it
```

This is the Dependency Inversion Principle (DIP) made visual: the arrow from `CatalogApiImpl` points *inward* toward the higher-level `OrderService`, not outward.

### The code that builds it

**SRP (Single Responsibility Principle) + DIP (Dependency Inversion Principle) applied to ShopFast's order module:**

```typescript
// BAD: OrderService does too much AND depends on a concrete catalog repo.
// Reason 1 to change: pricing rules change.
// Reason 2 to change: notification channel changes.
// Reason 3 to change: DB schema changes.
class OrderServiceBad {
  async placeOrder(userId: string, productId: string) {
    const product = await this.db.query(
      "SELECT * FROM catalog.products WHERE id = $1", [productId]  // reaching into catalog's DB
    );
    const total = product.price * 1.1;                             // tax logic lives here
    await this.db.query("INSERT INTO orders ...");
    await this.emailClient.send(userId, "Order confirmed");        // notification logic here too
  }
}

// GOOD: Each class has one reason to change; OrderService depends on interfaces.
interface CatalogApi {
  getProduct(id: string): Promise<Product>;     // abstraction owned by order domain
}

interface Notifier {
  send(userId: string, message: string): Promise<void>;
}

class PricingService {
  applyTax(price: number): number {
    return price * 1.1;                         // one reason to change: tax rules
  }
}

class OrderService {
  constructor(
    private catalog: CatalogApi,               // injected — DI (Dependency Injection)
    private pricing: PricingService,
    private notifier: Notifier,
  ) {}

  async placeOrder(userId: string, productId: string) {
    const product = await this.catalog.getProduct(productId);      // only talks to the interface
    const total = this.pricing.applyTax(product.price);
    await this.db.insertOrder({ userId, productId, total });
    await this.notifier.send(userId, "Order confirmed");
  }
}
```

### The code that calls it / uses it

How the composition root (the app's startup code) wires everything together — this is the only place that knows about concrete classes:

```typescript
// composition root — one place knows about concrete implementations
const orderService = new OrderService(
  new CatalogApiImpl(db),     // the real catalog implementation
  new PricingService(),
  new EmailNotifier(smtpClient),
);

// in tests — swap in a fake without changing OrderService at all
const orderService = new OrderService(
  new FakeCatalogApi(),       // returns canned products, no DB
  new PricingService(),
  new NullNotifier(),         // does nothing — we test order logic, not email
);
```

DIP (Depend on abstractions) + DI (Dependency Injection, the mechanism) = `OrderService` is testable in 3 lines.

### Types & differences

| Principle | One-line | The trap |
|---|---|---|
| **SRP (Single Responsibility Principle)** | One *reason to change* per module | "One thing" ≠ SRP — reason-to-change is about *actors*, not operations |
| **OCP (Open/Closed Principle)** | Extend by adding code; don't modify working code | Premature OCP = needless interfaces for one impl; apply on the *second* real change |
| **LSP (Liskov Substitution Principle)** | Subtypes must not break callers' expectations | Compiling ≠ substituting — behavioral contracts are invisible to the compiler |
| **ISP (Interface Segregation Principle)** | Many small role interfaces > one fat interface | Fat `CatalogApi` forces `OrderService` to depend on methods it never calls |
| **DIP (Dependency Inversion Principle)** | Both high/low-level modules depend on *abstractions* | DIP ≠ DI — DIP is the principle; DI is one mechanism to achieve it |
| **DRY (Don't Repeat Yourself)** | One source of truth for each piece of *knowledge* | Text-dedup ≠ DRY — two identical functions for different reasons are NOT a violation |
| **YAGNI (You Aren't Gonna Need It)** | Build for today's requirement only | Tension with OCP: resolve by waiting for the *second* real change before abstracting |

**When to reach for which:**

- Bugs keep crossing module boundaries → check coupling (DIP, ISP)
- One class breaks for three different reasons → SRP
- A method grows a new `if (type == …)` every release → OCP + Strategy pattern
- A helper function gains boolean flags for special callers → YAGNI + ISP
- Identical code but it changes for different reasons → do NOT DRY it

### How ShopFast applies it

**DIP in action — the `CatalogApi` interface:**

ShopFast is a modular monolith: one deployable, but the `catalog`, `cart`, and `order` modules talk through interfaces, not directly into each other's tables. The canonical fact from SHOPFAST.md: *"Order depends on the `CatalogApi` interface, not catalog's tables."* This is DIP. The interface is *owned by the order domain*; the catalog module implements it. When catalog's storage changes (say, we add Elasticsearch for full-text search), `OrderService` is unaffected.

**SRP in action — splitting `OrderService`:**

Before a team member can extract the payment flow into a separate `PaymentService`, the `OrderService` must have a single responsibility. An `OrderService` that manages order *state* (created → pending → confirmed → shipped) is cohesive. One that also formats invoices, applies tax, and sends emails is not — each of those is a separate reason to change.

**YAGNI + OCP in tension — payment providers:**

At launch ShopFast uses one payment provider. YAGNI says don't abstract yet. But when the second provider arrives, OCP says: add a `PaymentGateway` interface and a second implementation — don't edit the checkout flow. The rule: abstract on the **second real variation**, not the imagined first.

> **If you skip these principles:** a schema rename in `catalog.products` breaks `OrderService` directly (no interface seam). A tax-rule change forces you to retest and redeploy the entire order flow. A third payment provider requires editing tested code and risks regressions. The blast radius of every change grows with the team.

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

- DRY (Don't Repeat Yourself) is about **knowledge/intent duplication, not code-text duplication.** Two functions with identical bodies that change for *different reasons* are not a DRY violation — coupling them is the mistake.
- Over-DRYing creates the wrong abstraction. Sandi Metz: "duplication is far cheaper than the wrong abstraction." A premature shared helper forces unrelated callers to evolve together.
- WET (Write Everything Twice) / Rule of Three: tolerate duplication until the third occurrence reveals the real shared concept.
- Forms of duplication: code, knowledge in code + docs + DB schema (use code-gen / single source of truth), config drift.

---

## YAGNI — You Aren't Gonna Need It

Don't build functionality on speculation. Implement what the *current* requirement needs.

- YAGNI (You Aren't Gonna Need It) pairs with "do the simplest thing that could possibly work" (XP).
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
- **SOLID:** SRP (Single Responsibility Principle — one reason to change), OCP (Open/Closed Principle — extend, don't modify), LSP (Liskov Substitution Principle — substitutable subtypes), ISP (Interface Segregation Principle — small interfaces), DIP (Dependency Inversion Principle — depend on abstractions).
- **DRY (Don't Repeat Yourself):** one source of truth for each piece of *knowledge* — not text dedup.
- **YAGNI (You Aren't Gonna Need It):** build for today's requirement; resist speculation.
- **Rule of Three:** tolerate duplication twice; abstract on the third.
- **Composition > inheritance;** **Law of Demeter** to avoid train wrecks.
- The wrong abstraction is costlier than duplication.
- Senior signal: knowing **when not** to apply a principle.
