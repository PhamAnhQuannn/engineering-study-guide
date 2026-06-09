# Domain Modeling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Translate business to system, edge cases.

Domain modeling is the discipline of turning messy business reality into a precise, evolvable software model: the entities, their relationships, the rules (invariants) they must always obey, and the edge cases the business glosses over. Senior engineers are judged on whether their model *matches how the business actually works*, holds invariants under concurrency and failure, and bends gracefully when requirements change. Most expensive production bugs are domain-modeling bugs (a wrong state transition, a missing invariant, an ignored edge case), not algorithmic ones.

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
- **Time** — store UTC, attach time zones at the edges; distinguish *instants* (a timestamp) from *civil dates* (a birthday, which has no time zone). Beware DST, leap seconds, "midnight," and "a day" being 23 or 25 hours.
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
- **Anti-corruption layer (ACL)** — translation layer protecting your model from an external/legacy model.
- **State machine** — explicit set of states and legal transitions.
- **Soft delete** — mark deleted (`deleted_at`) rather than physically removing, preserving history/referential integrity.
- **Event sourcing** — derive state from an append-only event log.
- **Idempotency key** — token making a repeated operation safe (links to delivery semantics).

---

## Tradeoffs

- **Rich domain model vs. anemic model + service logic** — rich models keep behavior with data (harder to misuse, harder to learn); anemic models (data bags + service classes) are simpler but let invariants leak. Senior call: richness where invariants are critical.
- **Normalization vs. denormalization** — normalized models prevent update anomalies and keep one source of truth; denormalized models read faster but risk inconsistency. Model normalized first; denormalize deliberately for proven read paths.
- **Snapshot vs. event-sourced** — audit/history/time-travel vs. simplicity. Don't event-source everything by default.
- **One shared model vs. context-specific models** — DRY pulls toward one model; bounded contexts push toward several. Premature unification creates god-objects; over-splitting creates integration overhead.
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
