# Architecture Styles — System Design Questions

[← Topic overview](../README.md)

> Topic: Monolith, microservices, event sourcing, CQRS.

Structured prompts: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Decompose a growing e-commerce monolith into services

**Requirements / Scale**
- Existing monolith (catalog, cart, orders, payments, shipping, notifications). 5 teams blocking each other on deploys; checkout traffic spikes 20× on sales; payments need strict isolation/compliance.

**High-level design**
- Identify **bounded contexts**: Catalog, Cart, Orders, Payments, Shipping, Notifications.
- **Strangler-fig** extraction: route new/changed functionality to new services behind an API gateway while the monolith shrinks — no big-bang rewrite.
- Extract **Payments first** (isolation/compliance + independent scaling) and **Catalog** (read-heavy, scales differently).
- Inter-service comms: synchronous gRPC/REST for queries; **events** (Kafka) for cross-context facts (`OrderPlaced` → Shipping, Notifications).
- Checkout spanning Cart→Orders→Payments→Shipping → **saga** with compensations.

**Data model**
- Each service owns its DB (Catalog: product store; Orders: orders DB; Payments: ledger). No shared schema.
- Event contracts versioned; consumers idempotent (dedup by event id).

**Scaling & bottlenecks**
- Catalog scales out with caching/CDN; Payments scales independently with strict consistency.
- The gateway and the broker become critical infra → HA both.
- Saga complexity in checkout → orchestration for clarity.

**Tradeoffs & failure modes**
- Eventual consistency between contexts (order placed but shipping event lags) → design UX for it.
- Partial failure in checkout → compensating transactions (release inventory, void auth).
- Risk of distributed monolith if boundaries are wrong → align to teams (Conway), enforce data ownership.

---

## D2. Design an audit-critical financial ledger (event sourcing + CQRS)

**Requirements / Scale**
- Every balance change must be auditable and reconstructable; regulators require full history; reads (balances, statements) are far more frequent than writes; correctness is paramount.

**High-level design**
- **Event sourcing:** append-only event store of immutable transactions (`MoneyDeposited`, `MoneyWithdrawn`, `TransferInitiated`). Current balance = fold over events.
- **CQRS:** the write side validates + appends events; **projections** build read models (current balance table, statement views) consumed asynchronously.
- **Snapshots** every N events per account so balance reconstruction is fast.

**Data model**
- `events(stream_id=account_id, seq, type, payload, occurred_at)` — append-only, unique `(stream_id, seq)` for optimistic concurrency.
- Read models: `balances(account_id, balance, as_of_seq)`, `statements(...)` rebuilt from events.

**Scaling & bottlenecks**
- Write side bounded by event-store append throughput + per-stream serialization (optimistic concurrency on seq).
- Read side scales independently (replicas/cache) since it's derived.
- Replay/rebuild cost → snapshots + parallel projection rebuilds.

**Tradeoffs & failure modes**
- Eventual consistency: a deposit is appended instantly but the balance projection lags briefly → read-your-writes from the event store for critical reads, or version-check.
- Event schema evolution is hard → versioned events + upcasters.
- This is heavy — justified *only* by the audit/compliance requirement; plain CRUD would be wrong here but right elsewhere.

---

## D3. Design an event-driven order-fulfillment flow across services

**Requirements / Scale**
- Order placement triggers inventory reservation, payment capture, shipping, and notifications across independent teams/services. Bursty (sales). Must tolerate any single downstream being temporarily down.

**High-level design**
- **Event-driven** backbone (Kafka). `OrderPlaced` event fans out; each service consumes what it needs.
- Coordination via **saga** (orchestration for a clear checkout flow): Reserve Inventory → Capture Payment → Create Shipment → Notify; each step emits success/failure events; failures trigger compensations (release inventory, refund).
- Queues **buffer bursts**; consumers scale on lag.

**Data model**
- Topics: `orders`, `payments`, `inventory`, `shipping`, keyed by `order_id` for ordering.
- Each consumer keeps a **processed-event** dedup table for idempotency.

**Scaling & bottlenecks**
- Partition by `order_id`/customer for parallelism + per-order ordering.
- Hot partition if one customer/SKU dominates → composite keys.
- Consumer lag is the scaling signal.

**Tradeoffs & failure modes**
- At-least-once delivery → idempotent consumers (dedup) are mandatory.
- A downstream down → events buffer and replay on recovery (resilience win); but the order is "pending" longer (eventual consistency).
- Saga compensation must itself be reliable/idempotent; poison messages → dead-letter queue + alerting.
