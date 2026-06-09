# Domain Modeling — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Translate business to system, edge cases.

Each prompt presents named options. Give a reasoned recommendation, then "what would change the answer."

---

### D1. Rich domain model vs. anemic model + service-layer logic.

**Options**
- **A — Rich model:** entities own their behavior and enforce invariants internally.
- **B — Anemic model:** plain data objects; all logic in service classes.

**Recommendation:** Use a **rich model (A) where invariants are critical** (money, bookings, state machines) — keeping rules with the data they govern makes them hard to bypass and the model self-documenting. An **anemic model (B) is acceptable for simple CRUD/reporting** areas with no real invariants, where the ceremony of a rich model adds cost without protection. Don't dogmatically apply one everywhere.

**What would change the answer:** Team familiarity with DDD (a rich model misused becomes confusing), and how invariant-heavy the domain is. Thin glue/integration code rarely benefits from a rich model.

---

### D2. Event-sourced / append-only vs. current-state (snapshot) storage.

**Options**
- **A — Event sourcing:** store the log of changes; derive state.
- **B — Snapshot:** store only current state.
- **C — Snapshot + an append-only audit/event table** alongside.

**Recommendation:** **A** for domains where **history is the truth and auditability is a hard requirement** — ledgers, medical records, compliance-heavy flows; the audit trail and time-travel are inherent, not bolted on. **B** for most ordinary CRUD where history doesn't carry business meaning. **C** is a pragmatic middle: simple reads from snapshots, plus an event/audit log for the parts that need traceability, without full event-sourcing complexity (projections, replay, schema evolution of events).

**What would change the answer:** Regulatory audit needs and "who changed what when" requirements push to A/C. Team's ability to handle projection/read-model complexity, and read-latency requirements (folding events is slow without snapshots) push back toward B.

---

### D3. One shared model for a concept vs. separate models per bounded context.

**Options**
- **A — Single shared model** (e.g., one `Customer`) used everywhere.
- **B — Context-specific models** linked by a stable ID.

**Recommendation:** **B** when the concept means materially different things across contexts (Sales vs. Support vs. Billing) — separate models avoid a god-object full of mostly-null fields and contradictory rules, and let each context evolve independently. **A** only when the concept is genuinely uniform and small across the whole system (rare for core business entities).

**What would change the answer:** Org/team boundaries (Conway's law — separate teams favor separate models/services), system size (tiny apps tolerate one model), and integration overhead (B adds translation/ACL cost that's only worth it past a certain complexity).

---

### D4. Normalize the schema vs. denormalize for read performance.

**Options**
- **A — Normalized** (3NF): one source of truth, no duplication.
- **B — Denormalized:** duplicate/precompute for fast reads.

**Recommendation:** **Model normalized first (A)** — it prevents update anomalies and keeps invariants enforceable. **Denormalize deliberately (B)** only for *proven* hot read paths, treating the denormalized copy as a cache/projection kept in sync (transactionally or via events), and documenting it as derived data. Premature denormalization scatters the source of truth and breeds inconsistency bugs.

**What would change the answer:** Read/write ratio (read-heavy aggregation surfaces justify denormalized projections), latency SLOs, and whether the store supports cheap joins (some NoSQL stores force denormalization by design).

---

### D5. Enforce an invariant in the database vs. in application/aggregate code.

**Options**
- **A — Database constraint** (unique/check/exclusion/FK, or locking).
- **B — Application/aggregate logic.**
- **C — Both** (DB as backstop, app for UX/error messages).

**Recommendation:** **C, with the DB as the authoritative backstop.** Anything that must hold under **concurrency** (no double-booking, no negative balance, uniqueness) *must* be guaranteed at the DB level — app-only checks lose to lost-update races. Use aggregate logic on top for clear errors and complex multi-field rules that constraints can't express. App-only (B) is acceptable only for non-critical, single-actor rules.

**What would change the answer:** If the invariant spans multiple aggregates/services (no single transaction), you can't use one DB constraint — fall back to a **saga + compensating actions** with eventual consistency, accepting brief invariant violation windows. Distributed/sharded data may also preclude a global constraint.

---

### D6. Hard delete vs. soft delete (mark deleted) for domain records.

**Options**
- **A — Hard delete:** physically remove rows.
- **B — Soft delete:** set `deleted_at`, filter on read.

**Recommendation:** **B (soft delete) by default** for domain entities with history, references, or audit value — it preserves referential integrity, enables undo, and keeps the audit trail. **A (hard delete)** for genuinely transient data, or where **privacy/compliance (GDPR right-to-erasure)** *requires* physical removal.

**What would change the answer:** Legal erasure requirements force hard delete (or crypto-shredding) for PII; storage cost and table bloat from soft-deletes at scale may push to archiving; query complexity (every read must filter `deleted_at`) is a cost to weigh.

---

### D7. Model a lifecycle as an explicit state machine vs. status flags/columns.

**Options**
- **A — Explicit state machine** with enumerated states + allowed transitions.
- **B — Independent boolean flags / timestamp columns** inferring state.

**Recommendation:** **A**, for any entity with a real lifecycle and illegal combinations. A state machine makes illegal states unrepresentable, centralizes transition rules, and prevents contradictions like "shipped *and* cancelled." **B** invites bugs because independent flags permit nonsensical combinations and scatter the rules.

**What would change the answer:** A truly flat entity with one or two independent, orthogonal booleans (e.g., `is_archived`, `is_pinned` that genuinely don't interact) doesn't need a state machine — over-modeling there is unnecessary ceremony.

---

### D8. Surrogate key (UUID/serial) vs. natural key (email, order number) as identity.

**Options**
- **A — Surrogate key:** system-generated, opaque.
- **B — Natural key:** a real-world attribute used as the primary identity.

**Recommendation:** **A (surrogate)** as the primary identity almost always — natural keys change (people change email/last name), aren't guaranteed unique across contexts, and leak business meaning into references. Keep the natural key as a **unique attribute/constraint**, not the identity. This decouples identity from mutable real-world facts.

**What would change the answer:** UUID vs. sequential surrogate is itself a tradeoff (UUIDs avoid enumeration and ease distributed generation but hurt index locality; sequential keys are compact but leak counts/are guessable). Some integration scenarios need a stable external natural key exposed alongside the surrogate.
