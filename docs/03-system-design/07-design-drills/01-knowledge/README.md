# Design Drills — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: URL shortener, feed, chat, rate limiter, notifications.

This topic is about the *canonical system-design problems* every senior is expected to have rehearsed. The value isn't memorizing one answer — it's internalizing the **reusable building blocks and the interview framework** so you can adapt to any prompt. This page is the playbook; the design/estimation/decision pages drill the specific problems.

---

## The interview framework (apply to every prompt)

1. **Clarify requirements & scope.** Functional (what it does) + non-functional (scale, latency, availability, consistency). Nail the *one* hardest requirement.
2. **Estimate scale.** DAU, QPS (read vs write), storage, bandwidth. Drives every later decision (see Capacity Estimation).
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
