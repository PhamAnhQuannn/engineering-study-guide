# Domain Modeling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Translate business to system, edge cases.

> **🛒 Where we are in building ShopFast** — Last topic we learned to measure outcomes: A/B (A/B test) design, metric hierarchies, and why the mean lies. [Metrics & Experimentation](../../02-metrics/01-knowledge/README.md) confirmed the trending-products carousel is working — now the team wants to extend the order and inventory system to support it. But the moment you touch the order or inventory code, you're working in the core domain. This topic teaches you to model that domain precisely: the entities, relationships, invariants, and edge cases that separate a system that handles the business from one that handles the *happy path only*. **Next:** modeling the domain is only half the job — getting that model agreed on and built with a real team requires navigating PM (Product Manager), design, and engineering alignment, which is what [Cross-Functional Work](../../04-cross-functional/01-knowledge/README.md) covers.

---

## Teaching arc: modeling the ShopFast order, inventory, and payment domain

### What it is & why it matters

Domain modeling is the discipline of turning messy business reality into a precise, evolvable software model: the entities, their relationships, the rules (invariants) they must always obey, and the edge cases the business glosses over.

Senior engineers are judged on whether their model *matches how the business actually works*, holds invariants under concurrency and failure, and bends gracefully when requirements change. Most expensive production bugs are domain-modeling bugs — a wrong state transition, a missing invariant, an ignored edge case — not algorithmic ones.

The key mental model: **the code is a model of the business, not just a data store.** When the model is wrong, every feature built on top of it is wrong. When the model is right, the code becomes readable by domain experts and easy to extend.

### A ShopFast case

The ShopFast team needs to model the order/inventory/payment domain. Here is the modeling process, step by step.

**Step 1 — Capture the ubiquitous language.** Interview the PM and customer support. They say: "A customer adds items to a *cart*, then *places an order*. The order is *pending* until *payment clears*. Once paid, the warehouse *fulfills* it. Fulfillment can be *partial* if an item goes out of stock mid-fulfillment. The customer can *cancel* up to the point of *shipment*. After shipment, they can request a *refund*." Write those exact words in the code: `Cart`, `Order`, `Payment`, `Fulfillment`, `Shipment`, `Refund`. Not `Booking`, not `Transaction`, not `Purchase` — the domain's own words.

**Step 2 — Classify entities vs. value objects.**
- **Entities** (have identity that persists through state changes): `Order` (identified by order ID — two orders with the same items are still different orders), `Customer`, `Product`.
- **Value objects** (defined entirely by their attributes, immutable): `Money{amount, currency}` (never use a float for money — rounding errors compound; use integer minor units, e.g. 1999 for $19.99), `Address`, `OrderLine{productId, quantity, unitPrice}`.

**Step 3 — Draw the Order state machine.** The `Order` entity has a lifecycle. Modeling it as an explicit state machine prevents illegal transitions:

```
Pending → Paid → Fulfilling → Shipped → Delivered
    ↓       ↓        ↓
Cancelled  Cancelled  (cannot cancel after Shipped)
                          ↓
                       Refund Requested → Refunded
```

Legal: cancel a Pending or Paid order. Illegal: cancel a Shipped or Delivered order (use a refund flow instead). "Make illegal states unrepresentable" — encode these rules in the transition logic, not scattered `if (status == ...)` checks throughout the codebase.

**Step 4 — Define aggregates and invariants.** The `Order` aggregate root owns its `OrderLine`s. You never mutate a line directly; you go through the order, which enforces:
- Invariant 1: *Order total equals sum of line totals.* Enforce in the aggregate, and with a DB (database) check constraint.
- Invariant 2: *An order cannot transition to Paid unless payment ID is recorded and payment amount equals order total.* Enforce in the aggregate before persisting.
- Invariant 3: *Inventory count for a product never goes negative.* Enforce with a DB constraint (`CHECK (quantity >= 0)`) and a `SELECT FOR UPDATE` lock on the inventory row during checkout. ShopFast uses Postgres, so this is straightforward.

**Step 5 — Hunt the edge cases the business glosses over.** The PM describes the happy path. Senior engineers ask:
- *What if two customers place an order for the last unit simultaneously?* → Inventory decrement is a critical section; use a DB-level lock or an optimistic concurrency check, not just an application-level read-then-write.
- *What if payment succeeds but the order-record write fails?* → Idempotency key on the payment API call (ShopFast uses `Idempotency-Key` headers on `POST /v1/orders`, per the [API Design](../../../03-system-design/03-api-design/01-knowledge/README.md) topic) ensures a retry doesn't double-charge.
- *What if a partial fulfillment happens — 3 of 4 items ship?* → The state machine needs a `PartiallyFulfilled` state and the domain needs `Shipment` as a child entity of `Order`.
- *What time zone is "order placed at"?* → Store UTC (Coordinated Universal Time) everywhere; attach time zone only at display. A "next-day delivery" SLA (Service Level Agreement) must be evaluated in the customer's local time zone, not the server's.

**Step 6 — Identify bounded contexts.** The word "Product" means different things across contexts:
- In `Catalog`: a Product has a name, description, images, price, category.
- In `Order`: a Product is a line item with a locked-in unit price (the price at time of purchase, not the current catalog price).
- In `Inventory`: a Product has a stock count and a warehouse location.

These are three different bounded contexts. Forcing one shared `Product` model to serve all three produces a god-object. Instead: each module (per the [Architecture Styles](../../../03-system-design/04-architecture-styles/01-knowledge/README.md) decision, ShopFast uses a modular monolith with per-module schemas) has its own Product representation, linked by product ID, with explicit translation at the boundaries.

### How to handle it

**The modeling workflow:**
1. Listen for the language — nouns (candidate entities/value objects), verbs (state transitions), rules (invariants).
2. Classify each noun as entity (has persistent identity) or value object (defined by its attributes, immutable).
3. Draw the lifecycle as a state machine; mark every legal transition and every terminal state.
4. Define aggregates — the cluster of objects that must stay consistent together. The aggregate root is the only entry point, and it is the transaction boundary.
5. State invariants explicitly and enforce at the most reliable layer: DB constraint > aggregate logic > application check.
6. Hunt edge cases: empty/zero/negative amounts, concurrent writes, partial failure, soft-delete vs. hard-delete, time zones and DST (Daylight Saving Time), retried/duplicate operations.
7. Find bounded contexts — where does the same word mean different things? Split there.

**Key modeling rules:**
- **Money**: never float. Integer minor units (`1999` for $19.99) + explicit currency field. Two `Money` objects with different currencies must not be added without conversion.
- **Time**: store UTC, convert at the edges. Distinguish an *instant* (a timestamp) from a *civil date* (a birthday, which has no time zone).
- **Identity**: natural keys (email, phone) change and collide across systems. Use surrogate keys (UUID/serial) as identity; treat natural keys as searchable attributes.
- **Soft delete**: mark records with `deleted_at` rather than physically removing them. Hard-deleting breaks foreign key history, audit trails, and order summaries.

**Snapshot vs. event-sourced:** For ShopFast's order domain, a snapshot model (store the current state) is appropriate for launch. Event sourcing (store every state-changing event; derive current state by replaying) is valuable for ledgers and audit-heavy domains but adds complexity — a fold over an event stream, plus read-model projections. Choose event sourcing deliberately, not by default.

### A strong answer sounds like

*"Before I start on the schema, let me draw the Order state machine, because the lifecycle rules are where most of the bugs live. An Order is Pending until payment clears, then Paid, then Fulfilling, then Shipped, then Delivered. Cancel is only legal before Shipped; after that it's a Refund flow. The aggregate root is Order; it owns OrderLines and enforces that the total always equals the sum of lines — and that invariant needs to live in both the aggregate logic and a DB constraint, because application-only invariants get broken by concurrent paths or migrations. For money I'd use integer minor units with an explicit currency field, never a float. And I'd want a separate OrderLine unit price field, not a join to the current catalog price — a customer's receipt can't change when the price changes later."*

### Pitfalls

- **Anemic domain model** — data classes with all logic in fat services; invariants get bypassed.
- **CRUD (Create, Read, Update, Delete)-thinking every entity** — ignoring real lifecycle transitions. "Cancel" is not just `UPDATE orders SET status = 'cancelled'`; it has preconditions, side effects, and compensating actions.
- **God objects** — one `Product`/`Customer` serving every context, accreting unrelated fields.
- **Invariants only in application code** — not in the DB, so concurrent paths or bad migrations break them.
- **Floats for money; local time for instants** — perennial, expensive.
- **Modeling the happy path only** — missing concurrent writes, partial failure, DST, zero/negative, backdated corrections.
- **Premature abstraction** — generic "flexible" schemas (EAV — Entity-Attribute-Value, or "metadata JSON blobs") that lose all domain structure and invariants.

---

## Core concepts

### Ubiquitous language
Use the *business's* words for *business concepts*, consistently, in code, schema, and conversation. If the domain says "Reservation," don't call it `Booking` in one service and `Order` in another. A shared **ubiquitous language** removes translation errors between engineers, PMs, and domain experts, and makes the code a readable model of the business.

### Entities, value objects, aggregates
- **Entity** — has a distinct identity that persists through state changes (a `User`, an `Order`). Two entities with identical fields are still different if their IDs differ.
- **Value object** — defined entirely by its attributes, no identity, immutable (`Money{amount, currency}`, `Address`, `DateRange`). Two value objects with equal fields are equal. Modeling things as value objects eliminates a class of identity/mutation bugs.
- **Aggregate** — a cluster of entities/value objects treated as one consistency unit, with a single **aggregate root** as the only entry point. Invariants are enforced *within* the aggregate boundary; the boundary is also the **transaction boundary**. Example: an `Order` aggregate root owns its `OrderLine`s — you never mutate a line directly, you go through the order, which keeps the total consistent.

### Invariants
Rules that must *always* hold true regardless of operation order, concurrency, or failure. Examples: "account balance never goes negative," "a seat is booked by at most one reservation," "an order's total equals the sum of its lines." The senior skill is **identifying invariants explicitly** and choosing *where* to enforce them (DB constraint, aggregate logic, application check) so they can't be violated even under races. An invariant that lives only in application code and not the database will eventually be broken by a concurrent path or a bad migration.

### Bounded contexts
The same word means different things in different parts of the business. A "Customer" in Sales (a lead with a pipeline stage) is not the "Customer" in Support (a ticket history) or Billing (an invoice account). A **bounded context** is a boundary within which a model and its language are consistent. Forcing one global "Customer" model to serve all contexts produces a bloated, contradictory god-object. Instead, model each context separately and define explicit **context mappings** (shared IDs, translation/anti-corruption layers, published events) between them. Bounded contexts often map to service boundaries in microservices.

### State machines & lifecycle modeling
Most domain entities have a lifecycle: an `Order` goes `Pending → Paid → Shipped → Delivered`, possibly `Cancelled` or `Refunded`. Modeling this as an explicit **state machine** with allowed transitions prevents illegal states (you can't ship an unpaid order; you can't cancel a delivered one). "Make illegal states unrepresentable" — encode the rules in types/transitions rather than scattering `if (status == ...)` checks. A state diagram is often the single most valuable artifact in a domain-modeling interview.

### Modeling time, money, and identity (the eternal hard cases)
- **Money** — never a float (rounding errors); use integer minor units or a decimal type, always with a **currency**. Beware mixed-currency arithmetic.
- **Time** — store UTC (Coordinated Universal Time), attach time zones at the edges; distinguish *instants* (a timestamp) from *civil dates* (a birthday, which has no time zone). Beware DST (Daylight Saving Time), leap seconds, "midnight," and "a day" being 23 or 25 hours.
- **Identity** — natural keys (email, SSN) change and aren't unique across contexts; prefer surrogate keys (UUID/serial) and treat natural keys as attributes, not identity.

### Temporal modeling: event vs. snapshot
- **Current-state (snapshot)** — store only the latest value. Simple, but loses history.
- **Event-sourced / append-only** — store the sequence of state-changing events; current state is a fold over events. Gives a full audit trail, time-travel, and natural fit for domains where *history is the truth* (ledgers, medical records). Costs complexity and read-model projections.
- **Bi-temporal** — track both *valid time* (when a fact was true in reality) and *transaction time* (when the system learned it). Needed for backdated corrections in finance/insurance.

---

## How it works under the hood (the modeling workflow)

1. **Listen for the language.** Interview domain experts; capture the nouns (candidate entities/value objects), verbs (operations/state transitions), and rules (invariants).
2. **Separate identity from attributes.** Decide entity vs. value object for each noun.
3. **Draw the lifecycle.** State machine per key entity; mark legal transitions and terminal states.
4. **Define aggregates and boundaries.** Group what must stay consistent together; the aggregate is your transaction unit.
5. **State invariants explicitly** and decide enforcement layer (DB constraint > aggregate logic > app check, in order of reliability).
6. **Hunt edge cases.** Empty/zero/negative, partial failure, concurrency, deletion vs. soft-delete, timezone/DST, currency, retries/duplicates, the "what if two happen at once."
7. **Find bounded contexts.** Where does the same word mean different things? Split there.
8. **Plan for change.** Which parts are volatile? Keep the model flexible there; avoid premature generalization elsewhere.

---

## Key terms & definitions

- **Ubiquitous language** — shared business vocabulary used everywhere.
- **Entity** — identity-bearing object. **Value object** — attribute-defined, immutable.
- **Aggregate / aggregate root** — consistency + transaction boundary with a single entry point.
- **Invariant** — a rule that must always hold.
- **Bounded context** — a boundary of consistent meaning for a model.
- **ACL (Anti-Corruption Layer)** — translation layer protecting your model from an external/legacy model.
- **State machine** — explicit set of states and legal transitions.
- **Soft delete** — mark deleted (`deleted_at`) rather than physically removing, preserving history/referential integrity.
- **Event sourcing** — derive state from an append-only event log.
- **Idempotency key** — token making a repeated operation safe (links to delivery semantics).

---

## Tradeoffs

- **Rich domain model vs. anemic model + service logic** — rich models keep behavior with data (harder to misuse, harder to learn); anemic models (data bags + service classes) are simpler but let invariants leak. Senior call: richness where invariants are critical.
- **Normalization vs. denormalization** — normalized models prevent update anomalies and keep one source of truth; denormalized models read faster but risk inconsistency. Model normalized first; denormalize deliberately for proven read paths.
- **Snapshot vs. event-sourced** — audit/history/time-travel vs. simplicity. Don't event-source everything by default.
- **One shared model vs. context-specific models** — DRY (Don't Repeat Yourself) pulls toward one model; bounded contexts push toward several. Premature unification creates god-objects; over-splitting creates integration overhead.
- **Strict invariants (strong consistency) vs. availability** — enforcing a global invariant synchronously can hurt availability/scale; sometimes you relax to eventual consistency with compensating actions (sagas).

---

## Common pitfalls & misconceptions

- **Anemic domain model** masquerading as design — data classes with all logic in fat services; invariants get bypassed.
- **CRUD-thinking** every entity as create/read/update/delete, ignoring real lifecycle transitions and business operations ("cancel," "approve," "refund" are not just `UPDATE status`).
- **God objects** — one `User`/`Customer` serving every context, accreting unrelated fields and rules.
- **Invariants only in app code** — not in the DB, so concurrency/migrations break them.
- **Floats for money; local time for instants** — perennial, expensive.
- **Ignoring soft delete / history** — hard-deleting destroys audit trails and breaks foreign keys.
- **Modeling the happy path only** — missing partial failure, double submission, backdated corrections, zero/negative/empty.
- **Premature abstraction** — generic "flexible" schemas (EAV, "metadata JSON blobs") that lose all the structure and invariants the domain actually has.
- **Leaky bounded contexts** — sharing the database between contexts so one's change breaks another.

---

## What interviewers probe

- *"Model a [booking / ledger / order] system — entities, relationships, invariants."* — They want ubiquitous language, entity vs. value object, aggregates, an explicit state machine, and invariants tied to enforcement layers.
- *"What invariants must hold, and where do you enforce them?"* — DB constraint vs. aggregate vs. app, and how races/failures could break them.
- *"What edge cases am I missing?"* — double booking, cancellation after fulfillment, partial refunds, timezone/DST, currency, retries/duplicates, concurrent edits.
- *"How does this change if the business now also needs X?"* — tests whether the model is evolvable or brittle; bounded contexts and avoiding god-objects.
- *"Why is a float a bad type for money / why store UTC?"* — type-modeling fundamentals.
- Red flags: jumping to tables before understanding the domain, CRUD-only thinking, no invariants, modeling only the happy path, one giant god-entity.

---

## Quick-reference summary

- Speak the **ubiquitous language**; let code mirror the business.
- Classify nouns as **entities (identity)** or **value objects (attributes, immutable)**; group into **aggregates** that are your **consistency + transaction boundary**.
- State **invariants explicitly** and enforce them at the **most reliable layer (DB constraint > aggregate > app)**.
- Model **lifecycle as a state machine**; make **illegal states unrepresentable**.
- Split by **bounded context**; avoid **god objects** and shared databases across contexts.
- Get **money, time, identity** right: integer/decimal + currency, UTC + edge zones, surrogate keys.
- Hunt **edge cases**: concurrency/double-submit, partial failure, soft delete/history, zero/negative/empty, backdating.
- Decide **snapshot vs. event-sourced** and **normalized vs. denormalized** deliberately, not by default.
