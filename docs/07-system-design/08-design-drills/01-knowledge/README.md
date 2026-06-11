# Design Drills — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: URL shortener, feed, chat, rate limiter, notifications.

This topic is about the *canonical system-design problems* every senior is expected to have rehearsed. The value isn't memorizing one answer — it's internalizing the **reusable building blocks and the interview framework** so you can adapt to any prompt. This page is the playbook; the design/estimation/decision pages drill the specific problems.

> **🛒 Where we are in building ShopFast** — This is the **capstone**. Every prior topic gave us a brick: [architecture](../../04-architecture-styles/01-knowledge/README.md), [APIs](../../03-api-design/01-knowledge/README.md), [cache](../../02-caching/01-knowledge/README.md), [scaling](../../01-scaling/01-knowledge/README.md), [resilience](../../05-resilience/01-knowledge/README.md), [estimation](../../06-capacity-estimation/01-knowledge/README.md). Now we assemble them on demand to design any feature — e.g. ShopFast's "trending products" feed — and to attack any interview prompt with one repeatable framework.

---

## Teaching arc: assembling the bricks

### What it is
A **design drill** is rehearsing the handful of classic system-design problems (URL shortener, feed, chat, rate limiter, notifications) until the *building blocks* are reflexes. It's like a chef's **mise en place**: you don't invent technique mid-service — you've prepped the same components so many times that any dish is just a new arrangement of known parts. The bricks (LB, cache, queue, shard, WebSocket…) are your prepped ingredients; the framework is the recipe order.

### What it looks like
The framework as a pipeline, and ShopFast's "trending products" feed assembled from bricks:

```text
FRAMEWORK:  clarify → estimate → API → data model → high-level → deep-dive → scale → tradeoffs

ShopFast "trending" feed, wired from the bricks we already built:
  client → CDN → LB → app(stateless) → Redis(feed cache) ──hit──→ response
                                          │ miss
                                          ▼
                              precomputed feed (queue + workers rank hourly)
                                          │
                                  Postgres (events) + read replicas
```

### The code that builds it
A signature technique that ties the whole spine together — **cursor pagination** for the product feed (stable at scale, cache-friendly, leans on the API + DB decisions):

```typescript
// keyset/cursor pagination: page by "last seen" key, not OFFSET (which slows at scale)
async function listProducts(cursor?: string, limit = 20) {
  const rows = await replicaPool.query(
    `SELECT id, name, price FROM products
     WHERE ($1::text IS NULL OR id > $1)      -- resume after the cursor
     ORDER BY id ASC LIMIT $2`,
    [cursor ?? null, limit]
  );
  const next = rows.length === limit ? rows[rows.length - 1].id : null;
  return { items: rows, nextCursor: next };  // opaque cursor; stable as data shifts
}
```

### The code that calls it
The client pages through the feed by passing the cursor back — no fragile offsets:

```typescript
async function loadFeed() {
  let cursor: string | null = null, all = [];
  do {
    const res = await fetch(`/v1/products?cursor=${cursor ?? ""}&limit=20`);
    const page = await res.json();
    all.push(...page.items);
    cursor = page.nextCursor;                 // null → no more pages
  } while (cursor);
  return all;
}
```

### Types & differences
| Canonical problem | Signature technique | The hard part |
|---|---|---|
| **URL shortener** | base62 ID + heavy read cache | code generation, ~100:1 read skew |
| **News feed** | **hybrid fan-out** (push + pull) | the celebrity / high-fan-out account |
| **Chat** | WebSockets + connection registry + pub/sub | which node holds the socket; ordering |
| **Rate limiter** | token bucket in Redis (atomic) | shared state across the fleet |
| **Notifications** | queue + idempotent workers + DLQ | at-least-once delivery, dedup |

### Build it for real — ShopFast
Prompt: "design ShopFast's trending-products feed." Apply the framework. **Clarify:** read-heavy, freshness of ~1 hour is fine, must survive a viral spike. **Estimate** ([per that topic](../../06-capacity-estimation/01-knowledge/README.md)): ~1,800 peak read QPS → cache-first. **API:** `GET /v1/products?cursor=` (cursor pagination, above). **Data model:** product views in Postgres, ranked feed cached in Redis. **High-level:** reuse our exact bricks — CDN + LB + stateless app + Redis + replicas. **Deep-dive (the hard part):** ranking is expensive, so **precompute** the feed hourly via a [queue + workers](#canonical-problems--their-signature-techniques) (fan-out-on-write) rather than ranking per request. 

**Decision:** **fan-out-on-write** the trending feed into a Redis cache, served by cursor pagination — because reads vastly outnumber feed changes, so we pay the cost once per hour, not per request. **Rejected:** ranking on every read (would melt the DB at peak) and fan-out to every user (trending is global, not per-follower — no celebrity problem here).

### Scaling story
- **Now (cheap):** compute trending in a simple hourly job, cache one global feed in Redis, serve via cursor pagination. *Placeholder we leave:* the feed behind a cache key + cursor API, so the *computation* can be swapped (job → stream) without touching clients.
- **Growth signal:** feed staleness complaints (need fresher than hourly); per-segment/personalized feeds wanted (one global feed no longer fits); a flash sale spikes one product (hot key).
- **At scale (millions → hundreds of millions):** move from an hourly job to a **streaming** pipeline (Kafka) for near-real-time ranking; go **hybrid fan-out** if feeds become per-user; protect the hot path with the [rate limiter](#canonical-problems--their-signature-techniques) + [resilience](../../05-resilience/01-knowledge/README.md) patterns; re-[estimate](../../06-capacity-estimation/01-knowledge/README.md) to decide when the feed store itself must shard. Same bricks, rearranged as the numbers demand.

---

## The interview framework (apply to every prompt)

1. **Clarify requirements & scope.** Functional (what it does) + non-functional (scale, latency, availability, consistency). Nail the *one* hardest requirement.
2. **Estimate scale.** DAU (Daily Active Users), QPS (Queries Per Second, read vs write), storage, bandwidth. Drives every later decision (see Capacity Estimation).
3. **Define the API.** A few endpoints/operations — the contract.
4. **Data model.** Entities, access patterns, choose SQL vs NoSQL by fit.
5. **High-level design.** Boxes-and-arrows: clients → LB → services → caches → datastores → async/queues.
6. **Deep-dive the hard part.** The interviewer steers here — the feed fan-out, the ID generation, the dedup, the connection model.
7. **Scale & bottlenecks.** Sharding, caching, replicas, queues; identify what breaks first.
8. **Tradeoffs & failure modes.** Consistency choices, degraded modes, what happens when X is down.

> **Senior tells:** drive the conversation, state assumptions, justify every choice with the requirement it serves, and surface tradeoffs unprompted.

---

## Reusable building blocks (the "Lego bricks")

- **Load balancer** (L4/L7) — fan out to a stateless fleet.
- **Stateless app tier** + externalized state — enables horizontal scale.
- **Cache** (CDN / Redis) — absorb reads, cut latency.
- **Relational DB** (primary + read replicas) — strong consistency, transactions.
- **NoSQL / wide-column / KV** — scale, flexible schema, high write throughput.
- **Sharding** — partition data by a good key for write/storage scale.
- **Message queue / log** (Kafka, SQS) — decouple, buffer, async work, fan-out.
- **Object storage + CDN** — large blobs (images, video).
- **Search index** (Elasticsearch) — full-text/faceted queries off the OLTP DB.
- **ID generation** — UUID, Snowflake (time-ordered distributed IDs), or DB sequence.
- **Pub/sub & WebSockets** — real-time delivery.

---

## Canonical problems & their signature techniques

### URL shortener
- Core: map short code ↔ long URL; redirect (301/302); analytics.
- Techniques: **base62 encoding** of an ID (or hash + collision handling); KV store; heavy **read caching** (redirects are read-dominated, ~100:1); CDN.
- Gotchas: custom aliases, collisions, expiry, abuse/malware, analytics at write-time vs async.

### News feed / timeline
- Core: assemble a user's feed from people/topics they follow.
- **Fan-out-on-write (push):** precompute each follower's feed on post. Fast reads, expensive writes; bad for celebrities (millions of fan-outs).
- **Fan-out-on-read (pull):** assemble at read time. Cheap writes, expensive reads.
- **Hybrid:** push for normal users, pull for celebrities — the standard answer.
- Techniques: feed cache per user, ranking, pagination (cursor), media via CDN.

### Chat / messaging
- Core: real-time delivery, presence, history, ordering, delivery receipts.
- Techniques: **WebSockets** (persistent connections) with a connection/gateway layer; a message store (wide-column for history); **fan-out** to recipients' connections via pub/sub; sequence numbers for ordering; offline delivery via push notifications.
- Gotchas: which server holds a user's socket (registry), group chat fan-out, exactly-once-ish delivery (idempotent + dedup), ordering.

### Rate limiter
- Core: cap requests per client/window across a distributed fleet.
- Techniques: **token bucket** (burst-tolerant) in **Redis** for shared state (atomic Lua); local L1 for hot keys; **429 + Retry-After**. (See Resilience.)
- Gotchas: accuracy vs latency, fail-open vs fail-closed, fixed-window boundary spikes.

### Notification system
- Core: deliver across channels (push, email, SMS) reliably at scale.
- Techniques: ingest → **queue** → per-channel workers → provider APIs; **idempotency/dedup**; retries with backoff + dead-letter; user preferences/throttling; templating; fan-out.
- Gotchas: at-least-once delivery (idempotent), provider rate limits, priority lanes, suppression/opt-out.

---

## Key terms & definitions

| Term | Definition |
|---|---|
| Fan-out-on-write / -read | Precompute feeds on post vs assemble on read. |
| Snowflake ID | 64-bit time-ordered distributed unique ID. |
| Base62 | Encoding (a–zA–Z0–9) for short, URL-safe codes. |
| Connection registry | Map of user → which gateway holds their socket. |
| Dead-letter queue | Holding place for messages that repeatedly fail. |
| Presence | Online/offline/typing status tracking. |
| Cursor pagination | Pointer-based paging, stable at scale. |
| Hybrid fan-out | Push for most users, pull for high-fan-out accounts. |

---

## Common pitfalls & misconceptions

- **Jumping to the diagram** before clarifying requirements/scale.
- **One-size feed fan-out** — ignoring the celebrity problem (need hybrid).
- **Ignoring read:write ratio** — over-/under-investing in the wrong path.
- **Forgetting idempotency/dedup** in chat/notifications (at-least-once delivery).
- **Statefully pinning sockets** without a connection registry / re-routing on reconnect.
- **No degraded mode** — what happens when the cache/queue/provider is down.
- **Not deep-diving** the hard part the interviewer cares about.

---

## What interviewers probe

- "What are the requirements and scale?" — do you clarify before designing?
- "Push or pull feed — and how do you handle celebrities?"
- "How do you generate unique short codes / IDs at scale?"
- "How does a message get from sender to recipient in real time?"
- "How do you make delivery reliable and not duplicate?"
- "Where's the bottleneck and how do you shard/cache it?"
- "What's your degraded mode / failure handling?"

---

## Quick-reference summary

- **Framework:** clarify → estimate → API → data model → high-level → deep-dive → scale → tradeoffs.
- **Compose from reusable bricks:** LB, stateless tier, cache/CDN, SQL+replicas / NoSQL, sharding, queue/log, object storage, search, WebSockets.
- **Signature techniques:** base62 IDs + heavy caching (shortener); **hybrid fan-out** (feed); WebSockets + connection registry + pub/sub (chat); token bucket in Redis (rate limiter); queue + idempotent workers + DLQ (notifications).
- Always tie choices to the **hardest requirement**, surface **tradeoffs and degraded modes**, and **drive** the conversation.
