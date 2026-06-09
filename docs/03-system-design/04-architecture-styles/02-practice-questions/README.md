# Architecture Styles — Practice Questions

[← Topic overview](../README.md)

> Topic: Monolith, microservices, event sourcing, CQRS.

Mix of recall, "explain to a junior," and MCQs.

---

### Q1. When should a team choose microservices over a monolith?

**Answer:** When the *organization or scaling* demands it — not to fix code quality. Good triggers: many teams that need to deploy independently at different cadences; subsystems with very different scaling profiles (one part is 100× hotter); a need for fault isolation or polyglot stacks; a codebase/team too large to coordinate on one deploy. If you're a small team on an early product, a **modular monolith** gives most design benefits without the distributed-systems tax. Microservices solve an *organizational* problem and impose an *operational* cost.

---

### Q2. Explain "bounded context" and why it matters for service boundaries.

**Answer:** A bounded context (from Domain-Driven Design) is a boundary within which a particular model and vocabulary are consistent — e.g., "Order" means something specific in the Sales context vs the Shipping context. It matters because **service boundaries should follow bounded contexts**, not technical layers. Splitting by business capability gives services that are cohesive internally and loosely coupled externally, each owning its own data. Splitting by layer (a "database service," a "logic service") creates chatty, tightly-coupled services — a distributed monolith.

---

### Q3. What is a distributed monolith and why is it the worst of both worlds?

**Answer:** A distributed monolith is a set of "microservices" so tightly coupled that they must be deployed together, share a database, or break when any one changes. You pay the *operational* cost of microservices (network calls, partial failure, ops complexity) while keeping the *coupling* of a monolith (can't deploy independently). It usually results from wrong boundaries or a shared DB. The fix is proper bounded contexts, data ownership per service, and versioned, backward-compatible contracts.

---

### Q4. How do you handle a transaction that spans multiple microservices?

**Answer:** You can't reliably use a distributed (2PC) transaction across services. Instead use a **saga**: a sequence of local transactions, each publishing an event that triggers the next, with **compensating transactions** to undo prior steps on failure (e.g., refund if shipping fails). Coordination is either **choreography** (services react to each other's events) or **orchestration** (a central coordinator drives the steps). Make each step **idempotent** because events may be retried/duplicated.

---

### Q5. Explain CQRS to a junior. When is it overkill?

**Answer:** CQRS = Command Query Responsibility Segregation: split the **write** model (commands that change state) from the **read** model (queries), often with separate, query-optimized datastores kept in sync asynchronously. Think of it as a cash register (writes) feeding nightly into a reporting warehouse (reads) tuned for fast lookups. It lets you scale and optimize reads and writes independently. It's **overkill** for plain CRUD where one model serves both — the extra moving parts and **eventual consistency** between write and read sides aren't worth it unless you have strong read/write asymmetry or a complex domain.

---

### Q6. What does event sourcing store, and what are its two biggest costs?

**Answer:** It stores an **append-only log of events** (facts that happened) rather than current state; current state is derived by replaying events. Biggest costs: (1) **performance/replay** — rebuilding state by replaying millions of events is slow, so you need **snapshots** and projections; (2) **event schema evolution** — events are immutable and live forever, so changing their shape (versioning old events, upcasting) is genuinely hard. You also inherit eventual consistency and a steep conceptual shift.

---

### Q7. What is Conway's Law and how should it influence architecture?

**Answer:** Conway's Law: organizations design systems that mirror their own communication structure. Practically, your architecture *will* reflect your team boundaries whether you plan for it or not. So align **service boundaries with team boundaries** (and bounded contexts): a service owned by one team can evolve independently, while a service split across teams generates coordination overhead and coupling. Some orgs deliberately reshape teams ("inverse Conway maneuver") to get the architecture they want.

---

### Q8. Why shouldn't microservices share a database?

**Answer:** A shared database couples services through the schema: a change one team makes can break another, you can't deploy or scale data independently, and you lose clear ownership. It silently turns microservices into a distributed monolith. Each service should own its data and expose it only through its API/events; if another service needs the data, it calls the API or subscribes to events (event-carried state transfer), accepting eventual consistency.

---

### Q9 (MCQ). The recommended default starting architecture for a small team's new product is:

A. Microservices from day one
B. A (modular) monolith
C. Event sourcing + CQRS
D. A distributed monolith

**Answer: B.** A modular monolith is fastest to build/operate and keeps clean boundaries so services can be extracted later. The others add cost/complexity a small team rarely needs up front.

---

### Q10 (MCQ). Which best describes a saga?

A. A distributed two-phase commit across services
B. A sequence of local transactions with compensating actions for rollback
C. A shared database transaction
D. A synchronous chain of HTTP calls with a global lock

**Answer: B.** Sagas replace unworkable distributed transactions with local transactions plus compensations, coordinated by choreography or orchestration.

---

### Q11 (MCQ). CQRS most directly introduces which tradeoff?

A. Stronger ACID guarantees on reads
B. Eventual consistency between the write and read models
C. Reduced operational complexity
D. Elimination of the need for caching

**Answer: B.** The read model is updated asynchronously from writes, so reads can briefly lag — eventual consistency is the central tradeoff.

---

### Q12 (MCQ). Event sourcing's append-only log most directly provides:

A. Lower storage usage than state-based storage
B. A complete audit trail and the ability to rebuild/rederive state
C. Stronger immediate read consistency
D. Simpler schema evolution

**Answer: B.** Replayable, immutable events give full auditability and the ability to build new projections retroactively. It uses *more* storage, complicates schema evolution, and is eventually consistent.

---

### Q13. Your monolith deploys are slow and risky, and three teams keep blocking each other. Does that justify microservices?

**Answer:** Possibly — these are *organizational/operational* pains, which is exactly what microservices address (independent deploys, team autonomy). But first confirm a cheaper fix won't do: a **modular monolith** with strong boundaries, better CI/CD (faster pipelines, feature flags, trunk-based dev), and clearer code ownership can resolve deploy risk and team contention without the distributed tax. If teams genuinely need independent release cadences and the domains are cleanly separable into bounded contexts, extract those contexts into services incrementally (strangler-fig) rather than a big-bang rewrite.
