# Domain Modeling — Practice Questions

[← Topic overview](../README.md)

> Topic: Translate business to system, edge cases.

A mix of recall, "explain to a junior," and multiple-choice. Answer before reading the model answer.

---

### Q1. What's the difference between an entity and a value object? Give an example of each.

**Answer:**
An **entity** has a distinct **identity** that persists across changes — two entities are different even if all their attributes are equal, as long as their IDs differ. A `User` is an entity: changing their email doesn't make them a different user. A **value object** is defined entirely by its **attributes**, has no identity, and is **immutable** — two value objects with equal attributes are equal and interchangeable. `Money{amount: 500, currency: "USD"}` or an `Address` is a value object: there's no meaningful "this $5 vs. that $5." Modeling things as value objects eliminates identity-confusion and accidental-mutation bugs.

---

### Q2. What is an aggregate, and why does the aggregate boundary matter?

**Answer:**
An **aggregate** is a cluster of related objects treated as a single unit for data changes, with one **aggregate root** as the only allowed entry point. It matters because the aggregate boundary is simultaneously the **invariant-enforcement boundary** and the **transaction boundary**: all the rules that must stay consistent together (e.g., an order's total equals the sum of its lines) live inside one aggregate and are committed atomically. You never reach in and mutate a child (an order line) directly — you go through the root, which guarantees invariants hold. This keeps transactions small and consistency rules in one place rather than scattered.

---

### Q3. Explain "make illegal states unrepresentable" to a junior.

**Answer:**
Instead of allowing any combination of field values and then writing checks to reject the bad ones, design your types so the bad combinations *can't be constructed in the first place*. Example: rather than an order with a nullable `status` string and separate `shippedAt`, `cancelledAt`, `refundedAt` fields (which permits nonsense like "shipped *and* cancelled with no payment"), model status as an explicit state machine where only legal transitions exist, and attach data to the state that owns it (a `Shipped` state carries `shippedAt`). The compiler/model then prevents whole classes of bugs you'd otherwise have to catch with runtime `if` checks scattered everywhere.

---

### Q4. Why should money never be stored as a floating-point number?

**Answer:**
Because floats are binary approximations and can't represent many decimal fractions exactly (0.1 + 0.2 ≠ 0.3 in IEEE-754). For money this causes rounding drift that compounds across transactions and fails reconciliation — a ledger that's off by a cent is a serious bug. Store money as **integer minor units** (cents/satoshi) or an exact **decimal** type, and **always pair the amount with a currency** so you never silently add USD to EUR. Rounding rules (half-even/banker's rounding) should be explicit, not whatever the language's float does.

---

### Q5. What is a bounded context and when do you need more than one model for the "same" concept?

**Answer:**
A **bounded context** is a boundary within which a model and its vocabulary are internally consistent. You need separate models when the same word means materially different things in different parts of the business. "Customer" in Sales is a lead with a pipeline stage and probability-to-close; in Support it's a ticket history and entitlement; in Billing it's an invoice account with payment methods. Forcing one global `Customer` to satisfy all three creates a god-object full of fields that are null in most contexts and rules that contradict. Instead, model each context separately, share only a stable identifier, and translate between them at the edges (anti-corruption layer / published events).

---

### Q6. CRUD-thinking models everything as create/read/update/delete. Why is that often wrong for a domain?

**Answer:**
Because real business operations aren't generic field edits — "cancel an order," "approve a loan," "refund a payment," "deactivate an account" are domain operations with their own rules, side effects, and legal preconditions. Treating them all as `UPDATE status = X` discards the lifecycle: you lose the guarantee that you can't ship an unpaid order or refund an already-refunded one, and you scatter the rules across callers. Modeling the **lifecycle as a state machine** with named transitions captures the actual business logic, enforces legal sequencing, and makes the model self-documenting.

---

### Q7. Where should an invariant like "account balance must never go negative" be enforced, and why?

**Answer:**
At the **most reliable layer that can guarantee it under concurrency** — ideally a combination: a database **CHECK/constraint** or a conditional `UPDATE ... WHERE balance >= amount` (or row locking / serializable transaction) so two concurrent withdrawals can't both succeed, *plus* the aggregate logic for clear error messages. Enforcing it only in application code is unsafe: two requests can both read a positive balance, both pass the check, and both write, overdrawing the account (a lost-update race). The closer the invariant is to the storage engine's atomicity guarantees, the harder it is to violate.

---

### Q8. Why store timestamps in UTC, and what's the difference between an instant and a civil date?

**Answer:**
Store **instants** (a precise moment, like "order placed at") in **UTC** so they're unambiguous and comparable regardless of server/user time zone; convert to local time only at display edges. This avoids DST and offset bugs. A **civil date** (a birthday, a contract date, a "store opens at 9am") has *no* inherent time zone — it's a calendar concept. Storing a birthday as a UTC instant causes it to shift by a day for some users. Model civil dates as plain dates/times and instants as UTC timestamps; conflating them is a classic source of off-by-one-day bugs.

---

### Q9 (MCQ). Which is the correct way to model `Money`?

A. A `double amount` field.
B. An integer count of minor units plus a currency code, as an immutable value object.
C. A string like "$5.00".
D. A float amount with currency inferred from the user's locale.

**Answer: B.** Integer minor units (or exact decimal) avoid float rounding, the explicit currency prevents mixed-currency arithmetic, and immutability/value-object semantics prevent accidental mutation. A and D use floats (rounding bugs) and D's inferred currency is dangerous; C makes arithmetic and comparison error-prone.

---

### Q10 (MCQ). An order can be Pending, Paid, Shipped, Delivered, or Cancelled. Which design best prevents illegal states?

A. A nullable `status` string plus separate boolean flags `isShipped`, `isCancelled`.
B. An explicit state machine that only allows defined transitions (e.g., can't go Shipped → Pending, can't Cancel after Delivered).
C. Store every timestamp column and infer status by which are non-null.
D. A free-text `notes` field describing the state.

**Answer: B.** A state machine encodes legal transitions and makes illegal combinations unrepresentable. A and C permit contradictory combinations (shipped *and* cancelled), and D abandons machine-enforceable rules entirely.

---

### Q11 (MCQ). The same word "Customer" means different things in Sales, Support, and Billing. The DDD-recommended approach is:

A. One global `Customer` entity shared by all three via a common database.
B. Three context-specific models in separate bounded contexts, sharing only a stable customer ID and translating at the edges.
C. A single `Customer` table with one nullable column per context-specific field.
D. Duplicate the full customer record into each service with no shared identifier.

**Answer: B.** Separate bounded contexts keep each model coherent and avoid a god-object; a shared stable ID plus translation (anti-corruption layer / events) links them. A and C create a bloated, contradictory shared model; D loses the ability to correlate the same real customer across contexts.

---

### Q12. What edge cases would you probe when modeling a seat-reservation system?

**Answer:**
At minimum: **double-booking under concurrency** (two users grab the last seat simultaneously — needs a uniqueness invariant enforced atomically, e.g., a unique constraint or row lock, not just an app check); **holds/expiry** (a seat held during checkout that must release if payment doesn't complete); **cancellation and re-availability** (freeing a seat back to the pool, and what happens to a cancelled-then-rebooked seat); **partial group bookings** (5 seats requested, only 3 available — all-or-nothing or partial?); **overbooking policy** (deliberate, like airlines, vs. forbidden); **idempotent retries** (a network retry must not create two reservations — idempotency key); **time zones** for event start; **refund rules** by cancellation timing. The senior signal is naming the concurrency/idempotency invariants explicitly and where they're enforced.
