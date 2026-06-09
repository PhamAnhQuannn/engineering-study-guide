# Architecture Styles — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Monolith, microservices, event sourcing, CQRS.

Architecture style is a top-level structural choice with long-lived consequences for team velocity, operability, and cost. Seniors are judged on *fit-for-context* reasoning — not cargo-culting microservices — and on understanding the operational tax each style imposes.

---

## Monolith

A single deployable unit containing all modules; one codebase, one process (often horizontally scaled as identical copies), usually one database.

- **Pros:** simplest to build/deploy/test; in-process calls (no network, no serialization); easy transactions (one DB); straightforward debugging and end-to-end tracing; lowest operational overhead. Excellent default for small teams and early products.
- **Cons:** as it grows, build/deploy slows; a bad deploy risks the whole app; team coordination contention on one codebase; you scale the *whole* app even if only one part is hot; tech stack is uniform.
- **Modular monolith:** a disciplined middle ground — strong internal module boundaries (clear interfaces, separate schemas/packages) in one deployable. Captures most microservice *design* benefits without the distributed *operational* cost; easy to later extract services.

## Microservices

The application is decomposed into independently deployable services, each owning a bounded context and (ideally) its own datastore, communicating over the network (REST/gRPC/messaging).

- **Pros:** independent deploy/scale per service; team autonomy and parallel work; fault isolation (one service down ≠ all down); polyglot tech per service; targeted scaling of hot paths.
- **Cons:** **distributed-systems tax** — network latency/failures, partial failure, eventual consistency, no cross-service transactions (need sagas), hard debugging (distributed tracing), data duplication, ops complexity (CI/CD, service discovery, observability, mesh), versioning of inter-service contracts.
- **Key principle:** decompose by **business capability / bounded context** (DDD), not by technical layer. Each service owns its data; *no shared database*. Services are loosely coupled, highly cohesive.

> **Senior framing:** Microservices trade *development simplicity* for *deployment/scaling independence* — and you pay an operational tax up front. Don't adopt them to solve a code problem; adopt them to solve an *organizational/scaling* problem (many teams, independent release cadences, divergent scaling needs).

## Service-Oriented & in-between

- **SOA:** older enterprise style, often with an ESB (enterprise service bus). Microservices are SOA done with smaller, autonomous services and smart endpoints/dumb pipes.
- **Service-based architecture:** coarse-grained services sharing a database — a pragmatic middle path.

---

## Event-Driven Architecture (EDA)

Components communicate by producing/consuming **events** (facts about something that happened) via a broker (Kafka, RabbitMQ, SNS/SQS), rather than direct synchronous calls.

- **Patterns:** publish/subscribe, event notification, event-carried state transfer.
- **Pros:** loose coupling (producers don't know consumers); scalability + buffering (queues absorb bursts); resilience (consumers can be down and catch up); easy to add new consumers.
- **Cons:** eventual consistency; harder to reason about end-to-end flow; debugging across async hops; duplicate/out-of-order delivery (need idempotency + ordering keys); broker becomes critical infra.

## Event Sourcing

Instead of storing current state, store the **immutable sequence of events** that produced it. Current state is derived by replaying events.

- **Pros:** complete audit log / time travel; can rebuild state and create new read models retroactively; natural fit for EDA; strong domain modeling.
- **Cons:** big paradigm shift; replay cost and **snapshots** needed for performance; **schema/event evolution** is hard (events are forever); querying current state requires projections; eventual consistency.
- Often paired with **CQRS**.

## CQRS (Command Query Responsibility Segregation)

Separate the **write model** (commands that mutate state) from the **read model** (queries), often with different datastores optimized for each, kept in sync asynchronously.

- **Pros:** independently optimize/scale reads vs writes; tailor read models (denormalized, search-optimized) to queries; pairs with event sourcing (events update read projections).
- **Cons:** complexity; **eventual consistency** between write and read sides (a write may not be instantly queryable); two models to maintain. Overkill for simple CRUD.
- **When:** large read/write asymmetry, complex domains, collaborative/high-contention domains. **Not** a default — CRUD with one model is usually right.

---

## Other layered/clean styles

- **Layered (n-tier):** presentation → business → data. Familiar, easy, but risks anemic models and rigid layering.
- **Hexagonal / Ports & Adapters / Clean / Onion:** isolate domain logic from infrastructure via interfaces (ports) and adapters; improves testability and swap-ability. Orthogonal to monolith vs microservices — you can do clean architecture inside a monolith.

---

## Key terms & definitions

| Term | Definition |
|---|---|
| Bounded context | A DDD boundary where a model/ubiquitous language is consistent — a natural service boundary. |
| Modular monolith | One deployable with strong internal module boundaries. |
| Saga | A sequence of local transactions with compensating actions, replacing distributed transactions. |
| Choreography vs orchestration | Saga coordination via events (choreography) vs a central coordinator (orchestration). |
| Event sourcing | Persist state as an append-only event log; derive state by replay. |
| Projection / read model | A query-optimized view built from events/writes. |
| CQRS | Separate command (write) and query (read) models. |
| Smart endpoints, dumb pipes | Logic in services, not in the messaging layer. |
| Distributed monolith | Microservices so coupled they must deploy together — worst of both worlds. |

---

## Tradeoffs

- **Simplicity vs autonomy:** monolith is simpler; microservices give independent deploy/scale at an ops cost.
- **Strong consistency vs scalability/decoupling:** EDA/CQRS/event-sourcing buy decoupling and scale at the price of eventual consistency.
- **Audit/flexibility vs complexity:** event sourcing gives a perfect audit trail but heavy operational/modeling cost.
- **Conway's Law:** your architecture will mirror your org's communication structure — service boundaries should align with team boundaries.

---

## Common pitfalls & misconceptions

- **Premature microservices:** splitting a small product into services multiplies ops work and creates a **distributed monolith** if boundaries are wrong.
- **Shared database across services:** couples them, defeats independence — a classic anti-pattern.
- **CQRS/event-sourcing for simple CRUD:** massive over-engineering.
- **Ignoring eventual consistency in EDA:** building UX that assumes instant cross-service reads.
- **Distributed transactions:** you can't 2PC reliably across services — use sagas + idempotency.
- **No observability:** microservices without tracing/centralized logging are undebuggable.

---

## What interviewers probe

- "Monolith or microservices for this product — and *why*?" (they want context-driven reasoning + the ops tax).
- "How do you decide service boundaries?" → bounded contexts / business capabilities, not layers.
- "How do you handle a transaction spanning services?" → sagas + compensation + idempotency.
- "When is CQRS/event sourcing justified — and when is it over-engineering?"
- "What's a distributed monolith and how do you avoid it?"
- "How does Conway's Law affect your design?"

---

## Quick-reference summary

- **Start with a (modular) monolith;** extract microservices when *organizational scale* or *divergent scaling* demands it — not to fix code.
- **Split by bounded context**, give each service its **own data**, avoid shared DBs and distributed transactions (use **sagas**).
- **EDA** buys decoupling + buffering at the cost of **eventual consistency**; design idempotent, order-tolerant consumers.
- **Event sourcing** = audit + replay, heavy cost; **CQRS** = separate read/write models for asymmetric/complex domains — both are specialist tools, not defaults.
- Beware the **distributed monolith**, shared databases, and premature decomposition; remember **Conway's Law**.
