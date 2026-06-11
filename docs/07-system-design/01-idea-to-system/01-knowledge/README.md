# From Idea to System — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Ideation → product type → system type → requirements → tradeoffs.

Before you draw a single box or pick a database, you have to turn a fuzzy *idea* into a *defined system*: what it is, what kind of system it is, what it must do, and where it sits on every tradeoff axis. Seniors are judged here on **driving from ambiguity to a crisp, justified problem statement** — not on jumping straight to "I'll use microservices and Kafka."

> **🛒 Where we are in building ShopFast** — This is **step 0**, before any architecture. Someone says "let's build an online store." That sentence is *not yet a system*. This topic turns it into one we can actually design: classified, scoped, with named requirements and chosen tradeoffs. **Next:** before choosing any shape, *size* the system we identified — turn the requirements into numbers → [Capacity Estimation](../../06-capacity-estimation/01-knowledge/README.md).

---

## Teaching arc: turning an idea into a system

### What it is
**System identification** is the work of converting an idea ("an online store") into a **specification you can build against**: the product type, the system's defining characteristics, its functional + non-functional requirements (NFRs — the qualities, not the features), and a deliberate choice on each tradeoff. It's the architect's version of a doctor's *diagnosis before treatment* — prescribe surgery (microservices, sharding, streaming) before diagnosing, and you operate on the wrong organ. The diagnosis here is: *what kind of system is this, and what must it guarantee?*

### The journey (idea → buildable system)
Five steps, each narrowing ambiguity:

1. **Ideate** — name the **problem**, the **users**, and the **core value**. "People want to buy products online without visiting a store." One sentence; everything else serves it.
2. **Idea → product type** — classify the idea, because the *type* implies the *shape*. Is it a CRUD (Create, Read, Update, Delete) app, a social network, a marketplace, a real-time system, a streaming/analytics system, an ML (Machine Learning) product, a fintech ledger? (Table below.) ShopFast = **transactional e-commerce + content catalog**.
3. **System type / characteristics** — pin the defining axes: **read-heavy or write-heavy?** latency-sensitive? **consistency-critical or availability-critical?** data volume? access pattern (point lookups vs scans vs aggregations)? These dictate every later choice more than the feature list does.
4. **Identify the system** — write it down: **functional requirements** (what it does) + **non-functional requirements** (NFRs: scale, latency target / SLO (Service Level Objective), availability, consistency, durability, cost) + **constraints** (team size, budget, deadline, compliance) + **explicit assumptions**. This is the artifact you design against and defend in an interview.
5. **Tradeoffs at each step** — every choice spends something. Name the axis and pick a side *on purpose*: consistency vs availability (CAP (Consistency, Availability, Partition-tolerance) / PACELC), latency vs durability, cost vs scale, build vs buy, simple vs flexible, strong vs eventual consistency.

### What it looks like
The output of steps 1–4 is a one-page **identification sheet**. ShopFast's:

```text
ShopFast — System Identification Sheet
──────────────────────────────────────────────────────────
Idea         Buy products online; browse catalog, cart, checkout, pay.
Product type Transactional e-commerce + read-heavy content catalog.
Users        Shoppers (web + mobile); later: sellers, admins.
System type  Read-heavy (≈50:1 read:write). Catalog = availability-first
             (stale-by-seconds OK). Checkout/payment = consistency-first
             (never double-charge, never oversell).

FUNCTIONAL (what it does)          NON-FUNCTIONAL (how well — NFRs)
- browse / search products         - scale: ~1M users, ~1.8k peak read QPS
- view product + price + stock     - latency: catalog reads p99 < 150 ms
- add to cart                      - availability: 99.9% catalog; checkout
- checkout + pay                     can degrade (queue) before it fails
- order history                    - consistency: cart EVENTUAL; order STRONG
                                   - durability: orders/payments never lost
CONSTRAINTS  4 engineers · pre-launch · cost-sensitive · PCI for payments.
ASSUMPTIONS  catalog ~10M items · prices change rarely · traffic spiky (sales).
```

That sheet — not a diagram — is what every later topic consumes.

### Types & differences — product type → system shape
The product type is a strong prior on the architecture. Recognize it and you've narrowed the design 80% before drawing anything.

| Product type | Defining trait | Typical shape — reach for it when… |
|---|---|---|
| **CRUD / transactional app** | reads+writes of structured records, strong consistency | relational DB + cache + stateless app (**ShopFast core**) |
| **Social network / feed** | huge read fan-out, follower graphs | feed precompute (fan-out), heavy caching, NoSQL |
| **Marketplace (two-sided)** | supply+demand matching, search | search index + matching service + trust/payments |
| **Real-time (chat/collab/games)** | low-latency push, presence | WebSockets + pub/sub + connection registry |
| **Streaming / analytics** | high-volume ingest, aggregation | event log (Kafka) + OLAP (Online Analytical Processing) columnar store |
| **ML / recommendation** | training + low-latency inference | feature store + model serving + batch/stream pipeline |
| **Fintech / ledger** | correctness + audit above all | append-only ledger, strong consistency, idempotency |

ShopFast is mostly **CRUD/transactional** with a **read-heavy catalog** and a **fintech-grade checkout** — already telling us cache the catalog, protect the checkout.

### Build it for real — ShopFast
Walk the journey. **Idea:** sell products online. **Product type:** transactional e-commerce + catalog — *not* a social feed, so no fan-out machinery; *not* analytics, so no columnar store at launch. **System type:** the catalog is read-heavy and tolerates seconds-stale data (favor **availability** + caching); checkout must never double-charge or oversell (favor **strong consistency** there). **Identify:** the sheet above — ~1M users, ~1.8k peak read QPS (Queries Per Second), p99 (99th-percentile latency) < 150 ms, 99.9% availability, orders durable. **Tradeoffs chosen:** split consistency by surface (cart **eventual/AP**, order **strong/CP**); optimize cost over scale at launch (one region, managed services); buy payments (PCI), build catalog.

**Decision:** treat ShopFast as **two systems wearing one coat** — a read-heavy catalog (availability + cache) and a consistency-critical checkout (strong, idempotent) — and design each to its own requirements. **Rejected:** one-size "strong consistency everywhere" (kills catalog scale/cost) and "eventual everywhere" (risks double charges).

> **If you skip identification:** you build for the wrong shape — e.g. pour weeks into a fan-out feed engine an online store never needed, or make checkout eventually-consistent and ship double-charges to real customers. The most expensive bugs are decided *here*, in the requirements you never wrote down. Wrong diagnosis → confident, fast, wrong system.

### How the identification evolves (re-diagnose as it grows)
The sheet is not write-once. **Re-identify at each ~10× of scale or each new product bet**, because the *type* can shift:
- **Now:** one transactional system; the NFRs above fit one region, one primary database, a cache.
- **Signal it changed:** sellers join (now a **marketplace** → search + trust); a recommendations feature appears (now partly an **ML** product → feature store); analytics dashboards arrive (now also **streaming/OLAP**).
- **Then:** re-run steps 2–4 for the new surface and let *its* requirements pick *its* shape — same discipline, applied again. Every later topic ([Architecture](../../04-architecture-styles/01-knowledge/README.md), [Capacity Estimation](../../06-capacity-estimation/01-knowledge/README.md), [Scaling](../../01-scaling/01-knowledge/README.md)) is downstream of this sheet.

---

## Functional vs non-functional requirements (get this right)

- **Functional requirement (FR):** *what* the system does — a behavior. "User can check out." Testable as pass/fail.
- **Non-functional requirement (NFR):** *how well* it does it — a quality. "Checkout p99 < 300 ms at 2k requests per second, 99.95% available." These drive the architecture far more than features do.
- Interviewers probe NFRs because juniors list features and stop. **Always quantify:** scale (users, QPS), latency (p50/p99), availability (the "9s"), consistency model, durability, cost ceiling.

---

## Key terms & definitions

| Term | Definition |
|---|---|
| System identification | Turning an idea into a classified, scoped, requirement-bearing system. |
| Functional requirement (FR) | A behavior the system must provide. |
| Non-functional requirement (NFR) | A quality/constraint: scale, latency, availability, consistency, cost. |
| Product type | The category (CRUD, social, marketplace, real-time, analytics, ML, fintech) that implies a shape. |
| Read-heavy / write-heavy | Whether reads or writes dominate — sizes caching/replication vs sharding/queues. |
| SLO (Service Level Objective) | A target for a metric (e.g. p99 < 150 ms) — the NFR made measurable. |
| CAP (Consistency, Availability, Partition-tolerance) | Under a network partition you trade C against A — choose per surface. |
| MVP (Minimum Viable Product) | Smallest system that delivers the core value; scopes the first requirements. |
| OLTP / OLAP | Transactional (point reads/writes) vs analytical (scans/aggregations) workloads. |

---

## What interviewers probe

- "How would you start designing X?" → they want *clarify + identify* (FRs, NFRs, scale, constraints) before any architecture.
- "What kind of system is this?" → product type + read/write + consistency vs availability.
- "What are the non-functional requirements?" → quantified scale/latency/availability/consistency/cost, not features.
- "What's the one hardest requirement?" → name the binding constraint the design must serve.
- "Which tradeoffs did you make and why?" → explicit axis + chosen side + the rejected option.

---

## Quick-reference summary

- **Diagnose before you design:** idea → product type → system type → requirements → tradeoffs.
- **Product type implies shape** — recognize CRUD/social/marketplace/real-time/analytics/ML/fintech and you've narrowed it fast.
- **NFRs (quantified scale, latency, availability, consistency, cost) drive architecture** more than the feature list.
- **Pick a side on each tradeoff on purpose** (CAP, cost vs scale, build vs buy) — and split by surface when needed (ShopFast: AP cart, CP checkout).
- **Write the identification sheet; re-diagnose at each 10×** — every later System Design topic is downstream of it.
