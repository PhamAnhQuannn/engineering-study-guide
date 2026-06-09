# Architecture Styles — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Monolith, microservices, event sourcing, CQRS.

Named options, a reasoned recommendation, and "what would change the answer."

---

### DC1. Monolith vs modular monolith vs microservices for a new product

**Recommendation:** **Modular monolith** as the default — one deployable, fast to build and operate, but with strong internal boundaries so you can extract services later. Go **microservices** only when *organizational scale* (many teams, independent release cadences) or *divergent scaling/isolation* needs justify the operational tax. Avoid a plain unstructured monolith (turns to mud) and avoid premature microservices.

**What changes it:** Many autonomous teams + independent deploys → microservices. Small team, early product → modular monolith. Subsystem with extreme/different scaling or compliance isolation → extract just that service.

---

### DC2. Extract a service now vs keep it in the monolith

**Recommendation:** Extract when a module has a **clear bounded context**, its own scaling/availability profile, and is causing team contention or deploy risk — and extract via **strangler-fig** (incremental), not a rewrite. Keep it in the monolith when boundaries are still fuzzy or the module is small/coupled; premature extraction risks a distributed monolith.

**What changes it:** Clean bounded context + independent scaling/compliance need → extract. Unclear domain boundaries or chatty coupling → keep and clarify first. Cross-cutting/shared logic → keep central.

---

### DC3. Synchronous (REST/gRPC) vs asynchronous (event-driven) inter-service communication

**Recommendation:** **Synchronous** for request/response where the caller needs an immediate answer and the operation is fast (queries, simple commands). **Event-driven/async** for cross-context facts, fan-out, burst absorption, and tolerating downstream outages — at the cost of eventual consistency and harder end-to-end tracing. Most systems mix both: sync for reads, events for state propagation.

**What changes it:** Need immediate consistency/answer → sync. Need decoupling, buffering, or resilience to downstream downtime → async. High fan-out (one event, many consumers) → async.

---

### DC4. Orchestration vs choreography for a saga

**Recommendation:** **Orchestration** (central coordinator) when the workflow is complex, needs clear visibility, error handling, and a single place to reason about state (e.g., checkout). **Choreography** (services react to events) when steps are simple, loosely coupled, and you want no central bottleneck. Orchestration is easier to debug; choreography is more decoupled but can become an implicit, hard-to-follow web.

**What changes it:** Complex, evolving, multi-step flow needing observability → orchestration. Few simple steps, max decoupling → choreography. Hard-to-trace "event spaghetti" → move to orchestration.

---

### DC5. CRUD vs CQRS for a feature

**Recommendation:** **CRUD with one model** by default — simplest, strongly consistent, well-understood. Adopt **CQRS** only for strong read/write asymmetry, complex domains, high-contention collaborative editing, or when read models must be radically different from the write model. Eventual consistency and double the moving parts are the price.

**What changes it:** Reads vastly outnumber/differ from writes, or domain is complex/collaborative → CQRS. Simple entity with matching read/write shape → CRUD. Need instant read-after-write everywhere → lean CRUD or add read-your-writes handling.

---

### DC6. State-based persistence vs event sourcing

**Recommendation:** **State-based (store current state)** for the vast majority of systems — simple queries, easy schema evolution. Choose **event sourcing** only when you genuinely need a complete, immutable audit trail / time travel / the ability to derive new read models retroactively (finance, regulated domains, complex behavioral analytics). Don't adopt it for the "cool factor" — replay cost and event-schema evolution are real burdens.

**What changes it:** Regulatory/audit requirement or need to rebuild history into new views → event sourcing. Ordinary domain → state-based. Team unfamiliar with the paradigm + tight timeline → state-based.

---

### DC7. Rewrite vs strangler-fig migration of a legacy monolith

**Recommendation:** **Strangler-fig** almost always — incrementally route functionality to new services/components behind a façade while the legacy shrinks, keeping the system running and de-risking each step. A **big-bang rewrite** is rarely justified (high risk, long no-value period, requirements drift). Reserve rewrites for small components or when the legacy tech is truly unworkable.

**What changes it:** Large, business-critical, continuously-changing system → strangler-fig. Small, isolated, well-understood component → a contained rewrite can be fine. Legacy platform is end-of-life/unhostable → forced rewrite, but slice it.
