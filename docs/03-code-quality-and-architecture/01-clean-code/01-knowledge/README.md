# Clean Code — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Readability, abstractions, naming, code smells.

Clean code is code that is **easy to read, understand, and change** — optimized for the human who maintains it next, not for the machine and not for the author's cleverness. The single most important property is **readability**, because code is read far more often than it's written. A senior engineer writes code that communicates intent so clearly that comments become largely unnecessary.

> **🛒 Where we are in building ShopFast** — Last topic, [Error Handling](../../../02-languages-and-runtime/03-error-handling/01-knowledge/README.md) taught us how to deal with failures gracefully. This topic operates at a finer grain: the names, functions, and line-level choices that make ShopFast's `catalog`, `cart`, and `order` code read like clear prose rather than a puzzle. **Next:** [Design Principles](../../02-design-principles/01-knowledge/README.md) — SOLID, DRY, YAGNI — the principles that keep modules healthy.

---

## Teaching arc: writing ShopFast code that reads like a specification

### What it is

**Clean code** is code whose *intent is obvious to the next reader without explanation*. Robert Martin's metric: **WTFs per minute** — the lower, the cleaner. A WTF (a moment of confusion while reading) has a real cost: the reader misunderstands, pauses, asks a question, or worse — makes a change based on a wrong mental model.

The key insight: **code is written once but read dozens of times.** The bottleneck of software maintenance is *comprehension*, not typing. Every naming shortcut, every magic number, every deeply nested conditional is a tax paid by every future reader, including yourself six months from now.

Clean code is not:
- Short code (terse one-liners that save characters while spending comprehension)
- Clever code (exhibiting the author's knowledge at the reader's expense)
- Heavily commented code (comments compensate for naming failures)

Clean code IS code where **the names, structure, and shape express the intent** — so the reader can be wrong about nothing.

### What it looks like

A before/after showing the same ShopFast `applyDiscount` logic — one unreadable, one clean:

```typescript
// BEFORE — correct, but unreadable. Forces reader to decode intent.
function f(o: any, c: string): number {
  const p = c === "VIP20" ? 0.8 : c === "SAVE10" ? 0.9 : 1;
  return o.t * p > 0 ? o.t * p : 0;
}

// AFTER — same logic; reads like a specification.
function applyDiscountCode(order: Order, couponCode: string): number {
  const discountMultiplier = getDiscountMultiplier(couponCode);    // intent revealed
  const discountedTotal = order.totalCents * discountMultiplier;
  return Math.max(discountedTotal, 0);                             // can't go negative
}

function getDiscountMultiplier(couponCode: string): number {
  const DISCOUNT_MAP: Record<string, number> = {
    VIP20: 0.8,    // 20% off for VIP customers
    SAVE10: 0.9,   // 10% off sitewide promotion
  };
  return DISCOUNT_MAP[couponCode] ?? 1.0;                         // unknown code = no discount
}
```

The second version can be read aloud and understood. The first requires decoding.

### The code that builds it

**Naming** — the single highest-leverage clean-code skill, applied to ShopFast:

```typescript
// BAD NAMES — every reader must maintain a mental dictionary
const d = new Date();
const u = await db.find(id);
const s = u?.status === 3;
if (s && d > u?.exp) { /* ... */ }

// GOOD NAMES — reads like English; no mental translation
const now = new Date();
const order = await orderRepository.findById(orderId);
const isShipped = order?.status === OrderStatus.SHIPPED;   // named constant, not magic 3
const isExpiredShipment = isShipped && now > order?.estimatedArrivalDate;
if (isExpiredShipment) { /* ... */ }
```

**Function design** — small, one level of abstraction, no flag arguments, Command-Query Separation (CQS):

```typescript
// BAD: flag argument (does two things), mixed abstraction levels, hidden side effect
async function processOrder(orderId: string, notify: boolean) {
  const order = await db.query("SELECT * FROM orders WHERE id = $1", [orderId]); // low-level SQL
  order.status = "shipped";
  await db.query("UPDATE orders SET status = $1 WHERE id = $2", ["shipped", orderId]);
  if (notify) {                      // flag = this function does two things
    await smtp.send(order.userId, "Your order shipped!");  // hidden side effect
  }
}

// GOOD: separated concerns, one abstraction level, no hidden side effects
async function markOrderShipped(orderId: string): Promise<Order> {  // command: changes state
  const order = await orderRepository.findById(orderId);
  order.status = OrderStatus.SHIPPED;
  await orderRepository.save(order);
  return order;                      // CQS (Command-Query Separation): query result returned, not void
}

async function notifyOrderShipped(order: Order): Promise<void> {    // separate command
  await notifier.send(order.userId, `Your order #${order.id} has shipped!`);
}

// caller composes them — clear, testable separately
const order = await markOrderShipped(orderId);
await notifyOrderShipped(order);
```

### The code that calls it / uses it

**Comments — the right kind vs the wrong kind:**

```typescript
// BAD COMMENT: restates the code; adds zero information
// increment retry count
retryCount++;

// BAD COMMENT: explains what; good naming would eliminate the need
// check if order is older than 30 days
if (new Date().getTime() - order.createdAt.getTime() > 2592000000) { ... }
// FIX: extract to function with an intent-revealing name:
if (isOrderOlderThan(order, 30)) { ... }

// GOOD COMMENT: explains WHY — a non-obvious business rule
// Stripe requires amount in cents (not dollars); dividing floats causes rounding errors
const amountCents = Math.round(order.totalDollars * 100);

// GOOD COMMENT: warns future readers about a known constraint
// IMPORTANT: must run before inventory.reserve() — if payment fails, we don't want a
// reserved-but-unpaid inventory state that requires manual reconciliation.
await payment.charge(order);
await inventory.reserve(order);

// GOOD COMMENT: TODO with context (not just "fix this")
// TODO(alice): PCI (Payment Card Industry) compliance requires tokenizing this by 2026-Q3.
// Tracking: https://jira.shopfast.com/SF-4821
const rawCardNumber = req.body.cardNumber;
```

### Types & differences

**Clean code smells — granularity table:**

| Smell | Why it hurts | Fix |
|---|---|---|
| **Magic numbers/strings** | `if (status === 4)` — what is 4? | Named constants: `OrderStatus.SHIPPED` |
| **Boolean blindness** | `render(true, false)` — what do those mean? | Named params or enums: `render({ compressed: true, preview: false })` |
| **Flag arguments** | Function does two things | Split into two named functions |
| **Deep nesting / arrow code** | Control flow is hard to follow | Guard clauses (early returns), extract function |
| **Long function** | Does too much; hard to name | Extract Function |
| **Long parameter list** | 5+ args, easy to pass in wrong order | Introduce Parameter Object |
| **Duplicated code** | Same knowledge in two places | Extract (only if same *knowledge*) |
| **Dead code / commented-out code** | Noise; false signal for readers | Delete — git remembers |
| **Inconsistent style/naming** | Cognitive load from variety | Linter + formatter + convention |
| **Primitive obsession** | `string` for `OrderId`, `number` for `PriceCents` | Branded types or value objects |
| **God class / long class** | Low cohesion; too many reasons to change | Extract Class |

**Abstraction level guide:**

| Level | Description | Symptom of violation |
|---|---|---|
| **Under-abstracted** | Detail leaks across the codebase; same SQL query in 5 files | Duplication; hard to change one thing without touching many |
| **Right abstraction** | One name for one concept; hides implementation details behind a stable interface | Code reads at one level; changes are localized |
| **Over-abstracted** | A 3-line function behind 2 interfaces and a factory | Indirection without payoff; can't follow the flow |

SLAP (Single Level of Abstraction Principle): within one function, keep all statements at the same conceptual level. `placeOrder` should call `validateCart()`, `charge()`, `createOrder()` — not also contain raw SQL and SMTP calls.

### How ShopFast applies it

**Naming the order state machine:**

ShopFast's `orders` table has a `status` column. The unclean version stores integers: `1 = created`, `2 = pending_payment`, `3 = paid`, `4 = shipped`, `5 = cancelled`. Any developer reading `if (order.status === 4)` must either know the mapping by heart or look it up. The clean version:

```typescript
enum OrderStatus {
  CREATED = "created",
  PENDING_PAYMENT = "pending_payment",
  PAID = "paid",
  SHIPPED = "shipped",
  CANCELLED = "cancelled",
}

// Now code reads as a specification:
if (order.status === OrderStatus.SHIPPED) {
  await notifyDelivery(order);
}
```

**CQS (Command-Query Separation) in the checkout flow:**

The canonical ShopFast checkout is: validate → price → charge → create order → emit event. Each step is a *command* (changes state) or a *query* (reads state). CQS says don't mix them: `getCartTotal(cartId)` is a query (returns a value, changes nothing); `placeOrder(userId, cartId)` is a command (changes state, returns the created order). A function that both charges payment AND returns the remaining cart balance is a violation — it hides a side effect inside what looks like a read.

**Guard clauses in `validateCart`:**

```typescript
// BEFORE: deep nesting (arrow code)
async function validateCart(cartId: string, userId: string) {
  const cart = await cartRepo.find(cartId);
  if (cart) {
    if (cart.userId === userId) {
      if (cart.items.length > 0) {
        if (!cart.isExpired()) {
          return { valid: true };
        } else { return { valid: false, reason: "expired" }; }
      } else { return { valid: false, reason: "empty" }; }
    } else { return { valid: false, reason: "not_owner" }; }
  } else { return { valid: false, reason: "not_found" }; }
}

// AFTER: guard clauses — the happy path is obvious; errors exit early
async function validateCart(cartId: string, userId: string): Promise<CartValidation> {
  const cart = await cartRepo.find(cartId);
  if (!cart) return { valid: false, reason: "not_found" };            // guard
  if (cart.userId !== userId) return { valid: false, reason: "not_owner" }; // guard
  if (cart.items.length === 0) return { valid: false, reason: "empty" };    // guard
  if (cart.isExpired()) return { valid: false, reason: "expired" };         // guard
  return { valid: true };                                              // happy path — obvious
}
```

**Automated enforcement:**

ShopFast runs Prettier (formatter) and ESLint (linter) in CI (Continuous Integration). No style debates in code review — those are resolved by tools. Code review is reserved for naming, abstraction level, and design judgment — the things tools can't catch.

> **If you skip clean code:** a developer unfamiliar with the `order` module reads `if (s === 4 && d > u.exp)` in the payment flow during an incident at 2 AM. They misread the condition, apply the wrong fix, and cause a second incident. Clean code isn't about aesthetics — it's about **defect rate during high-pressure moments**. Every WTF is a potential mis-fix.

---

## Why readability dominates

- Code is read ~10x more than written; the bottleneck of software is *comprehension*, not typing.
- Every minute the next engineer spends decoding unclear code is cost — and they then introduce bugs from misunderstanding.
- "Clever" code (terse one-liners, micro-optimizations, exotic tricks) usually trades the author's brief satisfaction for everyone else's ongoing confusion. Boring, obvious code wins (KISS — Keep It Simple).
- A useful metric: **WTFs/minute** (Robert Martin's joke that's also true) — clean code is measured by how rarely a reader is confused.

---

## Naming — the highest-leverage skill

Good names are the cheapest documentation. Principles:

- **Intention-revealing:** `elapsedTimeInDays`, not `d`. The name should answer *why it exists, what it does, how it's used* without a comment.
- **Avoid disinformation:** don't call something a `list` if it's a `set`; don't abbreviate ambiguously.
- **Searchable / pronounceable:** `MAX_RETRIES` beats the magic number `3`; `generationTimestamp` beats `genYmdHms`.
- **Length scales with scope:** a loop index `i` is fine in a 3-line loop; a field used across a class needs a full name.
- **One word per concept:** don't mix `fetch`, `get`, `retrieve` for the same idea across the codebase.
- **Avoid encodings/Hungarian notation** (`strName`, `m_count`); modern tooling makes them noise.
- **Verb phrases for functions** (`isValid`, `calculateTotal`), **noun phrases for classes/values** (`Invoice`, `CustomerRepository`).
- **Magic numbers/strings → named constants.** `if (status == 4)` should be `if (status == Order.SHIPPED)`.

Naming is the most-probed "clean code" skill because a bad name fails silently every time it's read.

---

## Functions

- **Small and focused:** a function should do **one thing** at one level of abstraction. If you can extract a meaningfully-named sub-function, it was doing more than one thing.
- **One level of abstraction per function:** don't mix high-level policy (`processOrder`) with low-level detail (string byte manipulation) in the same body.
- **Few arguments:** 0–2 ideal, 3 is a smell, 4+ usually means a missing parameter object. **Avoid flag arguments** (`render(true)`) — they mean the function does two things; split it.
- **No hidden side effects:** a function named `checkPassword` that *also* initializes a session is a lie. CQS (Command-Query Separation): a function either *does* something (command) or *answers* something (query), not both.
- **Prefer exceptions/Result over error codes;** use **guard clauses / early returns** to flatten nesting instead of deep `if/else` pyramids.
- **DRY (Don't Repeat Yourself) at the knowledge level,** not blind text dedup (see Design Principles).

---

## Comments — a double-edged tool

- The best comment is the one you **didn't need** because the code is self-explanatory. Prefer renaming/extracting over commenting.
- **Bad comments:** restating the code (`i++; // increment i`), commented-out dead code (delete it — that's what version control is for), misleading/outdated comments (worse than none).
- **Good comments:** the *why*, not the *what* — explaining a non-obvious business reason, a workaround for a known bug, a legal/regulatory constraint, a performance tradeoff, or a warning ("this must run before X"). Also: public API docs, TODOs with context, and explanations of *intent* the code can't express.
- A comment is a small failure to express yourself in code — sometimes necessary, never the first resort.

---

## Code smells (clean-code lens)

Smells are surface symptoms of deeper design problems. Common ones at the "clean code" granularity:

| Smell | Why it hurts | Typical fix |
|---|---|---|
| **Magic numbers/strings** | Unexplained, unsearchable | Named constants |
| **Deep nesting / arrow code** | Hard to follow control flow | Guard clauses, extract |
| **Long function** | Does too much, untestable | Extract function |
| **Long parameter list** | Hard to call, control coupling | Parameter object |
| **Flag arguments** | Function does two things | Split into two functions |
| **Duplicated code** | Change in many places | Extract (if same knowledge) |
| **Dead code / commented code** | Noise, false signal | Delete (git remembers) |
| **Inconsistent naming/style** | Cognitive load | Conventions + linter/formatter |
| **God class / long class** | Low cohesion | Extract class |
| **Primitive obsession** | Domain meaning lost | Value objects |
| **Boolean blindness** | `True`/`False` carries no meaning | Enums / named types |

A smell is a *prompt to look closer*, not automatic proof of a defect.

---

## Abstractions & structure

- **Right level of abstraction:** under-abstraction = duplication and detail leakage; over-abstraction = needless indirection that hides the real flow. Aim for the *minimum* abstraction that captures the genuine concept.
- **SLAP (Single Level of Abstraction Principle):** within a function, keep statements at one conceptual level so it reads like a short paragraph.
- **Encapsulation:** hide internal representation; expose behavior, not data (tell, don't ask). Avoid exposing mutable internals.
- **Newspaper structure:** a file reads top-down — high-level first, details below; related things close together.
- **Boy Scout Rule:** leave code a little cleaner than you found it on every change.
- **Consistency:** a consistent *adequate* style beats a mix of individually-"better" styles; cognitive load comes from variety.

---

## Tooling that enforces cleanliness cheaply

- **Formatters** (Prettier, gofmt, Black) — end style debates; make diffs about logic, not whitespace.
- **Linters/static analysis** (ESLint, RuboCop, SonarQube) — catch smells, complexity, dead code automatically.
- **Cyclomatic complexity / cognitive complexity** metrics — flag functions that need decomposition.
- **Code review** — the human layer for naming, intent, and design that tools can't judge.

The senior move: automate the objective stuff (format, lint, complexity gates) so reviews focus on the *judgment* parts — names, abstractions, design.

---

## Common misconceptions / pitfalls

- "Clean code = short code." No — clarity, not brevity. A few extra well-named lines often beat a dense one-liner.
- "More comments = better." No — strive to need fewer; outdated comments mislead.
- "Always DRY (Don't Repeat Yourself)." No — wrong abstraction is worse than duplication.
- "Clean code is about aesthetics." No — it's about **cost of change** and **defect rate**; readability is an engineering property.
- "Performance vs clean code is a tradeoff." Rarely at the readability level; optimize hotspots with measurement, keep the rest clear.

---

## What interviewers probe

- **Live naming/refactor:** "Here's messy code — clean it." They watch names, decomposition, guard clauses, magic-number removal.
- **Comment judgment:** can you tell a *why* comment from a redundant *what* comment? Will you delete dead code?
- **Function design:** do you spot flag arguments, side effects, mixed abstraction levels?
- **Pragmatism:** do you over-engineer in the name of "clean," or know when consistency/simplicity wins?
- **Self-review:** can you critique your *own* code and articulate why a change improves readability?

---

## Quick-reference summary

- Clean code optimizes for the **next human reader**; readability is the top property because code is read ≫ written.
- **Naming** is the highest-leverage skill: intention-revealing, searchable, one word per concept, length scales with scope, no magic numbers.
- **Functions:** small, one thing, one abstraction level, ≤2–3 args, no flag args, no hidden side effects (CQS — Command-Query Separation), guard clauses over deep nesting.
- **Comments:** explain **why**, not what; delete dead/commented code; the best comment is an unneeded one.
- **Smells** (magic numbers, deep nesting, flag args, long functions, primitive obsession) are prompts to look closer.
- Hit the **right** abstraction level (SLAP — Single Level of Abstraction Principle) — neither under- nor over-abstracted.
- Automate format/lint/complexity; reserve review for **judgment** (names, design). Apply the **Boy Scout Rule**.
