# ShopFast — Canonical System Reference (single source of truth)

**Purpose.** "ShopFast" is the running example system threaded through the knowledge tiers. To keep the narrative coherent across ~60 files, **every knowledge file quotes the facts below — it never re-invents them.** If a system fact must change, change it *here first*, then update the files that cite it. Authoring against this doc is required (see `docs/PLAN.md`).

If you write a sentence like "ShopFast uses X", it must match this file. When a topic introduces a *new* ShopFast fact (e.g. the security tier adds the auth model), add it here in the same change.

---

## What ShopFast is

An online store. Core jobs: **browse a product catalog → view a product → add to cart → check out → pay**. A 4-person team, pre-launch, cost-sensitive. The curriculum builds and grows this one system from first decision to hundreds of millions of users.

## The three spines (one system, deepening levels)

| Spine | Tiers | Thread |
|---|---|---|
| **Build ShopFast** | T1–T5 | building blocks → language/runtime → system design → data layer → correctness & resilience |
| **Operate ShopFast** | T6–T9 | code quality → infra/deploy → networking → security |
| **Decide & Ship ShopFast** | T10–T12 | decisions → real incidents → product/business |

## Canonical architecture facts (quote these)

| Area | Decision | Owning topic |
|---|---|---|
| **Identification (step 0)** | Transactional e-commerce + read-heavy catalog. Read-heavy (~50:1). **Catalog = availability-first** (seconds-stale OK); **checkout/order = strong consistency** (no double-charge, no oversell). Launch NFRs: ~1M users, ~1,800 peak read QPS, catalog reads p99 < 150 ms, 99.9% availability, orders durable. Constraints: 4 engineers, pre-launch, cost-tight, PCI for payments. | T3 idea-to-system |
| **Architecture** | **Modular monolith** — one deployable, one DB, hard internal module seams (interfaces + per-module schemas) so catalog/cart/order can be extracted later. | T3 architecture-styles |
| **Modules** | `catalog`, `cart`, `order` (+ later `inventory`, `payment`). Order depends on the `CatalogApi` *interface*, not catalog's tables. | T3 architecture-styles |
| **API** | **REST at the public edge** (`/v1/...`, versioned from day 1); resources `/products`, `/orders`. **gRPC internally** once services split. | T3 api-design |
| **Checkout safety** | `POST /v1/orders` is **not idempotent** → client sends an **`Idempotency-Key`** header; server dedups retried charges. | T3 api-design |
| **Cache** | **Cache-aside in Redis** for hot products (`product:{id}`, TTL ~60s + jitter); **CDN** for product images. Redis outage degrades to slower-but-correct DB reads. | T3 caching |
| **App tier** | **Stateless** (sessions externalized to Redis), behind an **L7 load balancer**, autoscaled. | T3 scaling |
| **Database** | **Postgres** — one primary for writes + **read replicas** for the read-heavy catalog; **PgBouncer** pooler. Shard only when write/storage outgrows one primary. | T3 scaling / T4 databases |
| **Resilience** | Timeout on every call (payment provider 2s); **circuit breaker + fallback** (accept order `pending`, settle via queue); retries only with idempotency + backoff + jitter. | T3 resilience |
| **Async** | Slow work (emails, analytics, payment settlement) pushed to a **queue + workers**. | T3 scaling / resilience |
| **Launch scale** | ~1M users, 50 views/user/day, 50:1 read:write, 3× peak → **~1,800 peak read QPS, ~60 GB catalog (RF×3)** → fits one Redis + one primary + replicas, **no sharding needed at launch**. | T3 capacity-estimation |

## Facts introduced by later tiers (fill in as tiers are authored)

- **T4 Databases** — ShopFast schema (`products`, `inventory`, `orders`, `carts`), indexes for catalog search/filter, cart transaction atomicity. *(TBD when T4 authored.)*
- **T5 Distributed Systems** — consistency split: **cart = AP/eventual**, **order/payment = CP/strong**; inventory updates via async events; payment idempotency. *(TBD.)*
- **T8 Networking** — HTTP version choices at edge vs internal; TLS on checkout. *(TBD.)*
- **T9 Security** — **JWT + OAuth2** auth, customer vs admin roles (RBAC), token denylist in Redis for revocation. *(TBD.)*

## Authoring rules

1. **Quote, don't re-invent.** Cite the facts above verbatim in spirit.
2. **Cross-link by slug.** Use relative `../../<NN-folder>/01-knowledge/README.md` links (rendered in-app as `/topic/<slug>/study`).
3. **Banner first.** Each file opens with the 🛒 "Where we are in building ShopFast" banner: prev decision → this topic → next.
4. **New fact → update this file** in the same change.
