# Architecture Styles — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Monolith, microservices, event sourcing, CQRS.

Architecture style is a top-level structural choice with long-lived consequences for team velocity, operability, and cost. Seniors are judged on *fit-for-context* reasoning — not cargo-culting microservices — and on understanding the operational tax each style imposes.

> **🛒 Where we are in building ShopFast** — We [identified ShopFast](../../08-idea-to-system/01-knowledge/README.md) (read-heavy transactional store, 4-person team, cost-tight) and [sized it](../../06-capacity-estimation/01-knowledge/README.md) (~1,800 peak read QPS, ~60 GB — fits one primary + cache). Now we make the first *structural* decision — the shape everything else hangs off. Every later topic (APIs, caching, scaling, resilience…) builds on the choice we make here. **Next:** once the shape is set, we design the [APIs](../../03-api-design/01-knowledge/README.md) that ride on it.

---

## Teaching arc: choosing a shape

### What it is
An **architecture style** is the top-level *shape* of your system: how many deployable pieces there are, where the boundaries sit, and how the pieces talk. Think of it like deciding whether to build a **studio apartment** (everything in one room — cheap, fast, but you can't renovate the kitchen without disturbing the bedroom) or a **block of separate flats** (each independent — but now you need hallways, plumbing between units, and a building manager). Same residents, very different cost and flexibility.

### What it looks like
The two ends of the spectrum, drawn:

```text
MONOLITH (one deployable)              MICROSERVICES (many deployables)
┌─────────────────────────┐           ┌────────┐  ┌────────┐  ┌────────┐
│  catalog | cart | order │           │catalog │  │  cart  │  │ order  │
│  ─────────────────────  │           │  svc   │  │  svc   │  │  svc   │
│   (in-process calls)    │           └───┬────┘  └───┬────┘  └───┬────┘
│  ─────────────────────  │               │  network  │  network  │
│      one database       │           ┌───┴───┐   ┌───┴───┐   ┌───┴───┐
└─────────────────────────┘           │  db   │   │  db   │   │  db   │
                                       └───────┘   └───────┘   └───────┘
```

A **modular monolith** is the studio apartment with *good internal walls*: one deployable, one DB, but the modules call each other only through clear interfaces — so a flat can be carved out into its own building later without knocking the whole place down.

### The code that builds it
A modular monolith: modules behind interfaces, wired in one process. The seam is the whole point — `OrderModule` only knows the *interface* of catalog, never reaches into its tables.

```typescript
// catalog/catalog.module.ts — owns its data, exposes a narrow contract
export interface CatalogApi {
  getProduct(id: string): Promise<Product | null>;
}
export class CatalogModule implements CatalogApi {
  constructor(private db: Db) {}                 // only THIS module touches catalog tables
  getProduct(id: string) { return this.db.products.findById(id); }
}

// order/order.module.ts — depends on the INTERFACE, not the implementation
export class OrderModule {
  constructor(private catalog: CatalogApi) {}    // <- the seam we can later replace with a network client
  async placeOrder(userId: string, productId: string) {
    const p = await this.catalog.getProduct(productId);   // in-process call today
    if (!p) throw new Error("no such product");
    return this.db.orders.insert({ userId, productId, price: p.price });
  }
}

// main.ts — one process wires the modules together
const catalog = new CatalogModule(db);
const orders  = new OrderModule(catalog);        // pass the real module in; pass a network stub later
```

### The code that calls it
Today the call is a plain function call — fast, transactional, no network. The day we extract catalog into its own service, **only the wiring changes**, not `OrderModule`:

```typescript
// TODAY (monolith): in-process, microseconds, same DB transaction
await orders.placeOrder("u1", "p42");

// LATER (catalog extracted): same OrderModule, a network-backed CatalogApi
class CatalogClient implements CatalogApi {       // same interface!
  async getProduct(id: string) {
    const r = await fetch(`http://catalog-svc/products/${id}`);
    return r.ok ? r.json() : null;
  }
}
const orders = new OrderModule(new CatalogClient());   // the ONLY line that changed
```

That interface seam is the "placeholder" we leave now so scaling later is cheap — the core idea the whole spine repeats.

### Types & differences
| Style | One-line | Reach for it when |
|---|---|---|
| **Monolith** | one deployable, one DB | small team, early product, unknown domain (**ShopFast today**) |
| **Modular monolith** | one deployable, strong internal seams | want monolith simplicity but plan to split later (**our actual pick**) |
| **Microservices** | many independent deployables + datastores | many teams, divergent scaling, independent release cadence |
| **Event-driven (EDA)** | components talk via a broker, async | bursty load, loose coupling, many consumers of the same fact |
| **CQRS / event sourcing** | split read/write models / store events not state | huge read·write asymmetry, audit/replay needs |

Full detail on each is in the reference sections below.

### Build it for real — ShopFast
We're 4 engineers with no users yet. The hype says "microservices scale." But microservices solve an *organizational/scaling* problem we don't have — and they'd cost us network failures, distributed transactions, service discovery, and tracing before we've sold one item. The domain is also still fuzzy: we don't yet know where the *real* boundaries between catalog, cart, and order are, and wrong service boundaries → a [distributed monolith](#common-pitfalls--misconceptions) (worst of both worlds).

**Decision:** a **modular monolith**. One deployable, one Postgres, but hard internal module seams (interfaces + per-module schemas) so catalog/cart/order can each be extracted later with minimal blast radius. **Rejected:** full microservices (premature ops tax) and a big-ball-of-mud monolith (no seams → can't split later).

> **If we picked microservices now:** 4 engineers would burn their runway on service discovery, distributed tracing, and cross-service transactions instead of shipping the store — and with the domain still fuzzy, wrong service boundaries would harden into a **distributed monolith** (services that must deploy together) that is *harder* to fix than the monolith we started with.

### Scaling story
- **Now (cheap):** one deployable on one box, one DB. *Placeholders we leave:* module interfaces (the `CatalogApi` seam above) + separate DB schemas per module, so a future split doesn't require a rewrite. Cost: ~one server.
- **Growth signal:** deploys slow to >15–20 min and scare everyone; one hot module (catalog reads) forces us to scale the *whole* app to handle it; two teams keep colliding in the same codebase.
- **At scale (millions+):** extract the hottest, most-independent module first (catalog) into its own service behind its interface — see [Scaling](../../01-scaling/01-knowledge/README.md) for the stateless-tier + replica mechanics and [Resilience](../../05-resilience/01-knowledge/README.md) for surviving the new network hops. Use **sagas** (below) for the order flow that now spans services. Only split what the signal demands — not everything.

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
- **Key principle:** decompose by **business capability / bounded context** (DDD — Domain-Driven Design), not by technical layer. Each service owns its data; *no shared database*. Services are loosely coupled, highly cohesive.

> **Senior framing:** Microservices trade *development simplicity* for *deployment/scaling independence* — and you pay an operational tax up front. Don't adopt them to solve a code problem; adopt them to solve an *organizational/scaling* problem (many teams, independent release cadences, divergent scaling needs).

## Service-Oriented & in-between

- **SOA (Service-Oriented Architecture):** older enterprise style, often with an ESB (Enterprise Service Bus). Microservices are SOA done with smaller, autonomous services and smart endpoints/dumb pipes.
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
- **Distributed transactions:** you can't 2PC (two-phase commit) reliably across services — use sagas + idempotency.
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
