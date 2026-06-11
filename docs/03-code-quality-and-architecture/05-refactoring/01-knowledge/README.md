# Refactoring & Tech Debt — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Safe refactor, legacy code, tech debt management.

**Refactoring** is changing the *internal structure* of code **without changing its observable behavior**, to make it easier to understand and cheaper to change. **Tech debt** is the implied future cost of choosing an easy-now solution over a better-but-slower one. A senior engineer refactors *continuously and safely* under a test net, and manages debt as an explicit, prioritized backlog — not as a vague "we'll clean up later."

> **🛒 Where we are in building ShopFast** — Last topic we built the [Testing](../../04-testing/01-knowledge/README.md) portfolio that makes change safe. With that net in place, this topic covers how to reshape ShopFast's `catalog`, `cart`, and `order` code as requirements evolve — and how to handle the debt that accumulates in a real pre-launch sprint. **Next:** [TCP/UDP & DNS](../../../04-networking/01-tcp-udp-dns/01-knowledge/README.md) — how data travels on the wire, the networking foundation for web apps.

---

## Teaching arc: safely reshaping the ShopFast order flow

### What it is

**Refactoring** (Fowler's definition) is a *behavior-preserving* transformation of code structure. The key word is *preserving*: the external behavior does not change. If behavior changes, it's a bug fix or a feature — not a refactoring.

Think of it like renovating a house while people still live in it: you can knock down internal walls and rewire, but the front door stays in the same place and the lights keep working throughout. The test suite is the "lights on" check — if they go out, you've crossed a line.

The discipline has three parts:
1. **Recognize the smell** — symptoms that signal structural problems (long method, God object, duplicated logic).
2. **Apply the move** — a small, safe transformation with a name (Extract Function, Replace Conditional with Polymorphism).
3. **Stay green** — tests pass throughout; never mix refactoring with feature changes ("two hats").

### What it looks like

ShopFast's `OrderService` before a growth sprint — a common "before" state when a team ships fast under pressure:

```
BEFORE — OrderService.placeOrder (650 lines, God method):

  placeOrder(userId, cartId, paymentToken) {
    ├── validateCart(cartId)           ← 80 lines of cart validation
    ├── calculateTotal(cartId)         ← 120 lines with tax, shipping, discounts
    ├── chargePayment(paymentToken)    ← 90 lines of Stripe SDK calls inline
    ├── updateInventory(cartId)        ← 60 lines of direct SQL
    ├── createOrderRecord(...)         ← 100 lines of DB logic
    ├── sendConfirmationEmail(userId)  ← 80 lines of SMTP inline
    └── logAnalyticsEvent(...)         ← 30 lines
  }
  → One reason the compiler accepts: it compiles.
  → Six reasons to change: cart rules, pricing, payment, inventory, email, analytics.
```

```
AFTER — extracted, each collaborator has one reason to change:

  OrderService.placeOrder(userId, cartId, paymentToken)
    │
    ├── cartValidator.validate(cartId)         ← CartValidator, tested independently
    ├── pricingService.calculate(cartId)       ← PricingService, tested independently
    ├── paymentGateway.charge(token, amount)   ← interface → StripeGateway (swappable)
    ├── inventoryService.reserve(cartId)       ← InventoryService
    ├── orderRepository.create(order)          ← OrderRepository
    └── eventBus.publish("order.placed", ...)  ← email + analytics = async observers
```

### The code that builds it

**Extract Function + Replace Conditional with Polymorphism** — the two highest-yield refactoring moves in ShopFast's codebase:

```typescript
// BEFORE: inline tax calculation with a growing conditional in placeOrder
async placeOrder(userId: string, cartId: string) {
  let tax = 0;
  if (user.country === "US") {
    tax = cart.subtotal * 0.1;
  } else if (user.country === "GB") {
    tax = cart.subtotal * 0.2;
  } else if (user.country === "AU") {
    tax = cart.subtotal * 0.1;    // adding new country = edit this method
  }
  const total = cart.subtotal + tax + cart.shipping;
  // ... 500 more lines
}

// STEP 1: Extract Function — give the tax logic a name and a home
// Refactoring move: Extract Function (F11 in IntelliJ/VS Code — automated, safe)
function calculateTax(subtotal: number, country: string): number {
  if (country === "US") return subtotal * 0.1;
  if (country === "GB") return subtotal * 0.2;
  if (country === "AU") return subtotal * 0.1;
  return 0;
}

// STEP 2: Replace Conditional with Polymorphism
// Refactoring move: Replace Conditional with Polymorphism
interface TaxStrategy {
  calculate(subtotal: number): number;
}
class USTax implements TaxStrategy { calculate(s: number) { return s * 0.1; } }
class GBTax implements TaxStrategy { calculate(s: number) { return s * 0.2; } }

class TaxService {
  private strategies: Record<string, TaxStrategy> = {
    US: new USTax(), GB: new GBTax(), AU: new USTax(),
  };

  // Adding AU — no edits to this class if we use the map; add to the registry
  calculate(subtotal: number, country: string): number {
    return (this.strategies[country] ?? new ZeroTax()).calculate(subtotal);
  }
}
```

### The code that calls it / uses it

**Characterization tests** — pinning current behavior before refactoring legacy code (Michael Feathers' technique):

```typescript
// CartService has no tests. Before touching it, pin what it currently does.
// These tests describe behavior, not correctness — even bugs are pinned.
describe("CartService (characterization — DO NOT CHANGE BEHAVIOR)", () => {
  it("currently returns 0 for an empty cart total", async () => {
    expect(await cartService.getTotal("empty-cart")).toBe(0);
  });

  it("currently applies discount before tax (existing behavior)", async () => {
    // note: tax-then-discount might be more correct, but this is what it does NOW
    expect(await cartService.getTotal("discounted-cart")).toBe(990);
  });
});
// Now you can refactor CartService's internals — if these pass, behavior is preserved.
```

**Strangler Fig pattern** — migrating a legacy `OrderProcessor` to the new `OrderService` incrementally:

```typescript
// The facade — routes traffic between old and new implementation
class OrderFacade {
  async placeOrder(userId: string, cartId: string) {
    if (featureFlags.isEnabled("new-order-service", userId)) {
      return this.newOrderService.placeOrder(userId, cartId);  // new path
    }
    return this.legacyOrderProcessor.process(userId, cartId);  // old path
  }
}
// Roll out 1% → 10% → 50% → 100% via feature flag.
// At 100%, delete the old code. No big-bang cutover, no freeze.
```

### Types & differences

**Code smells → refactoring moves:**

| Smell | What it indicates | Fowler move |
|---|---|---|
| **Long method** | Doing too many things; hard to name/test | Extract Function |
| **Large class / God object** | Low cohesion, SRP (Single Responsibility Principle) violation | Extract Class |
| **Long parameter list** | Missing object; control coupling | Introduce Parameter Object |
| **Duplicated code** | Knowledge in many places | Extract (if same *knowledge*) |
| **Feature envy** | Method uses another object's data more than its own | Move Function |
| **Primitive obsession** | Using `string`/`int` for domain concepts | Introduce Value Object |
| **Switch/conditional sprawl** | Type-based branching growing every release | Replace Conditional with Polymorphism |
| **Shotgun surgery** | One change forces edits across many classes | Move Function/Field; Inline Class |
| **Divergent change** | One class changes for many unrelated reasons | Extract Class |
| **Comments explaining bad code** | Comment compensating for unclear code | Rename/Extract to make code self-describing |

**Migration strategies — when the change is large:**

| Strategy | Use when | Risk |
|---|---|---|
| **Strangler Fig** | Replacing a subsystem incrementally; can route traffic | Low — reversible per slice |
| **Branch by Abstraction** | Large change on `main` without a long-lived branch | Medium — needs discipline |
| **Big-bang rewrite** | Almost never | High — loses accumulated fix knowledge, delivers nothing for months |

**Tech debt quadrant (Fowler):**

| | Reckless | Prudent |
|---|---|---|
| **Deliberate** | "No time for design" (dangerous) | "Ship now, refactor next sprint" (a conscious tradeoff) |
| **Inadvertent** | "What's layering?" (ignorance) | "Now we know how it should've been done" (learning) |

Prudent-deliberate debt is legitimate when recorded and planned for payback. Reckless debt is the one that compounds silently until it causes incidents.

### How ShopFast applies it

**Strangler Fig for the cart module:**

ShopFast's first `cart` implementation stored cart state in a single JSON blob in Postgres. As ShopFast scales, the team wants to move to a per-item cart model with proper line items. A big-bang rewrite freezes cart development for six weeks. Instead: introduce `CartPort` interface, build `LineItemCartService` behind it, route 1% of traffic via a feature flag, expand to 100%, then delete the old code. The checkout flow is never aware of the migration.

**Boy Scout Rule — continuous debt payment:**

Every time a developer touches the `order` module, they apply the Boy Scout Rule: leave it slightly better than they found it. Common micro-refactors: rename `ord` → `order`, extract a 5-line tax snippet to `PricingService.calculateTax()`, replace `if (status === 3)` with `if (status === OrderStatus.SHIPPED)`. These compound. After 6 months of sprints, the module is significantly cleaner with zero "stop-all-features refactor sprints."

**Debt by interest, not principal:**

ShopFast tracks tech debt in the issue tracker with a "debt" label and two metrics: *churn* (how often a file changes) and *complexity* (cyclomatic complexity). `OrderService` is high-churn and high-complexity — highest interest, highest priority to pay down. A legacy `ReportingService` is complex but rarely touched — leave it; the interest rate is near zero.

> **If you skip safe refactoring:** the `placeOrder` God method grows from 200 to 2,000 lines over 18 months. Adding a new discount type requires editing the same method that handles payment, email, and analytics. A tax-rule change breaks the payment path. The only safe strategy becomes "touch it as little as possible" — which means bugs accumulate and features slow to a crawl, exactly the debt compounding scenario Ward Cunningham described.

---

## What refactoring is (and isn't)

- **Refactoring (Fowler's definition):** a *behavior-preserving* transformation. If behavior changes, it's not refactoring — it's a rewrite or a feature change. This distinction matters: you must be able to assert "the system does exactly what it did before."
- **Not refactoring:** adding features, fixing bugs (behavior changes), big-bang rewrites. Mixing refactor + feature in one change is a classic mistake — when something breaks you can't tell which caused it.
- **The golden rule:** *separate the two hats.* Either you're adding behavior (tests may go red→green) or refactoring (tests stay green throughout). Never both at once.
- **Prerequisite:** a reliable test net. "Refactoring without tests" is just editing and hoping. For legacy code with no tests, you first add **characterization tests**.

---

## Code smells — symptoms that suggest refactoring

Smells don't *prove* a problem; they're heuristics worth investigating.

| Smell | What it indicates |
|---|---|
| **Long method** | Doing too much; hard to name/test → extract methods |
| **Large class / God object** | Low cohesion, SRP (Single Responsibility Principle) violation → extract class |
| **Long parameter list** | Missing object; control coupling → introduce parameter object |
| **Duplicated code** | Knowledge in many places → extract (if same *knowledge*) |
| **Feature envy** | A method uses another object's data more than its own → move method |
| **Data clumps** | Same group of fields travels together → make it a type |
| **Primitive obsession** | Using `string`/`int` for domain concepts → value objects |
| **Shotgun surgery** | One change forces edits across many classes → poor cohesion/locality |
| **Divergent change** | One class changes for many reasons → SRP (Single Responsibility Principle) violation |
| **Switch/conditional sprawl** | Type-based branching → polymorphism/Strategy |
| **Comments explaining bad code** | Comment compensating for unclear code → rename/extract |

Note the pair: **divergent change** (one module, many reasons) and **shotgun surgery** (one reason, many modules) are opposite cohesion failures.

---

## Core refactoring moves (Fowler catalog)

- **Extract Function/Method** and **Inline** — the most-used moves; trade naming/readability for indirection.
- **Extract Variable** (explaining variable) / **Inline Variable.**
- **Rename** — the highest-value, lowest-risk refactor; good names eliminate comments.
- **Extract Class / Inline Class** — fix low cohesion or excessive indirection.
- **Move Function/Field** — put behavior near the data it uses (fix feature envy).
- **Replace Conditional with Polymorphism** — kill type-switch sprawl.
- **Introduce Parameter Object** / **Preserve Whole Object** — tame long parameter lists.
- **Replace Temp with Query, Decompose Conditional, Replace Magic Number with Constant, Guard Clauses** (replace nested `if` with early returns), **Replace Error Code with Exception/Result.**

Modern IDEs perform many of these *mechanically and safely* (Rename, Extract Method) — prefer automated refactors over hand-editing to avoid introducing bugs.

---

## Working safely with legacy code (Michael Feathers)

Feathers' definition: **legacy code is code without tests** (regardless of age). Tests are what make change safe.

- **The legacy dilemma:** to change safely you need tests; to add tests you often must change the code (break dependencies) — but that change is risky because there are no tests. Break the cycle with minimal, low-risk seams.
- **Seam:** a place where you can alter behavior without editing in that place (inject a dependency, override a method). Finding seams is the key skill.
- **Characterization tests:** capture *current* behavior (even buggy behavior) so a refactor can't change it unintentionally. You're pinning, not validating correctness.
- **Sprout method/class:** add new behavior in a *new* tested unit and call it from the messy old code, rather than editing the untested mess.
- **Wrap method/class:** wrap existing behavior to add the new behavior around it.

---

## Strangler Fig — incremental migration/rewrite

Named after the strangler fig vine. Instead of a risky big-bang rewrite, you grow the new system *around* the old: route a slice of traffic/functionality to the new implementation behind a facade, expand it incrementally, and retire the old piece by piece.

- Pros: continuous delivery of value, reversible per slice, low blast radius, no "stop-the-world" freeze.
- Contrast with **big-bang rewrite** (Joel Spolsky's "single worst strategic mistake"): you lose accumulated bug-fix knowledge, deliver nothing for months, and the new system rarely catches up.
- Companion: the **Branch by Abstraction** technique — introduce an abstraction over the thing you're replacing, build the new implementation behind it, switch, then remove the old. Enables large changes on `main` without long-lived branches.

---

## Tech debt — the metaphor and the management

Ward Cunningham's metaphor: shipping imperfect code is like taking a loan; you move fast now but pay **interest** (slower future changes, more bugs) until you repay the principal (refactor). Martin Fowler's **debt quadrant** classifies it:

|  | **Reckless** | **Prudent** |
|---|---|---|
| **Deliberate** | "No time for design" | "Ship now, refactor next sprint" (a real strategic choice) |
| **Inadvertent** | "What's layering?" (ignorance) | "Now we know how it should've been done" (learning) |

- **Prudent-deliberate** debt is legitimate engineering: a conscious, recorded tradeoff to hit a deadline, with a payback plan.
- **Reckless** debt (deliberate or from ignorance) is the dangerous kind.
- Other taxonomy: **code debt, design/architecture debt, test debt, documentation debt, dependency debt** (outdated/vulnerable libs), **infrastructure debt.**

### Managing debt
- **Make it visible:** a tracked backlog with cost/impact, not tribal knowledge. Annotate hotspots; some teams add a "debt" label and link affected work.
- **Prioritize by interest, not principal:** pay down debt in code you *touch often* (high churn × high complexity = highest interest). Cold, stable code with ugly internals may be fine to leave.
- **The Boy Scout Rule:** leave each module a little better than you found it — continuous small repayments.
- **Opportunistic + budgeted:** combine "fix as you pass through" with a small recurring capacity (e.g. ~10–20% per cycle) for larger paydowns. Avoid both extremes: never paying (debt compounds) and "stop all features to refactor for a quarter" (rarely sells, rarely finishes).
- **Tie to business value:** frame debt paydown in terms of velocity, defect rate, and risk — not aesthetics. "This module causes 40% of our incidents and slows every feature" beats "the code is ugly."

---

## What interviewers probe

- **Behavior preservation:** do you understand refactoring ≠ rewriting, and do you keep the hats separate?
- **Safety net:** how do you refactor code that has no tests? (Characterization tests, seams.)
- **Smell → move:** can you name a smell and the specific refactoring that fixes it?
- **Migration strategy:** big-bang vs Strangler Fig — do you reach for the risky rewrite?
- **Debt as a business conversation:** can you prioritize debt by interest/churn and justify it to non-engineers?
- **Restraint:** do you know when *not* to refactor (cold stable code, looming deadline, no tests + no time to add them)?

---

## Quick-reference summary

- **Refactoring = behavior-preserving** structural improvement; never mix with feature/bug changes ("separate the hats"). Requires a test net.
- **Smells** are heuristics (long method, God object, feature envy, shotgun surgery, primitive obsession…) pointing at specific **Fowler moves** (extract, move, rename, replace-conditional-with-polymorphism).
- **Legacy = code without tests.** Use **characterization tests + seams** (sprout/wrap) to make change safe.
- Prefer **Strangler Fig / Branch by Abstraction** over big-bang rewrites.
- **Tech debt** is a loan paying interest; classify with Fowler's quadrant; prudent-deliberate debt is OK *with a plan*.
- Manage debt: **make it visible, prioritize by interest (churn × complexity), Boy Scout Rule, budget a slice, tie to business value.**
- Senior signal: knowing **when not to refactor.**
