# SQL vs NoSQL — System Design Questions

[← Topic overview](../README.md)

> Topic: Data model fit, consistency, scaling tradeoffs.

Each prompt: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.** Focus is store selection driven by access patterns and consistency needs.

---

## D1. Design the storage layer for a social media feed (timeline)

**Requirements/Scale:** 200M users, average 200 follows, billions of posts, read-heavy (feed views ≫ posts), feed must load in <200ms, can tolerate slight staleness (a new post appearing a few seconds late is fine).

**High-level design:** This is a fan-out problem, not a single-store problem. Use **polyglot persistence**:
- **Relational/Postgres** as system of record for users, follows, posts (integrity, ad-hoc queries).
- **Wide-column (Cassandra) or Redis** for the precomputed per-user timeline (fan-out-on-write): when a user posts, push the post id into each follower's timeline list.
- **Object store/CDN** for media.

**Data model:**
```
posts (Postgres):      post_id PK, author_id, body, created_at
follows (Postgres):    follower_id, followee_id  (PK both ways indexed)
timeline (Cassandra):  partition key = user_id, clustering key = created_at DESC
                       columns: post_id  -> one table modeled per "read my feed" query
```

**Scaling & bottlenecks:** Fan-out-on-write makes reads O(1) (read your precomputed timeline) but writes O(followers). **Celebrity problem**: a user with 50M followers makes one post a 50M-write storm. Hybrid: fan-out-on-write for normal users, **fan-out-on-read** (query followees' recent posts at read time and merge) for celebrities; mark hot accounts. Wide-column shards timelines by `user_id` for linear write scale; eventual consistency is acceptable here.

**Tradeoffs & failure modes:** Eventual consistency means a post may briefly not appear — acceptable. Timeline store can be rebuilt from the source-of-truth Postgres if corrupted (it's a derived view). Keeping timeline in sync with posts/follows is the hard part (deletes/unfollows must propagate). Wide-column requires knowing the query (read feed) up front — fine here.

---

## D2. Design storage for an e-commerce product catalog + cart + orders

**Requirements/Scale:** 10M products with varied attributes per category, fast product reads, full-text + faceted search, carts (ephemeral, high churn), orders (must be transactional, never lost).

**High-level design:** Different sub-systems → different stores:
- **Orders & inventory → relational (Postgres):** ACID, transactions, no oversell, audit history. The system of record.
- **Product catalog → document or Postgres JSONB:** products have heterogeneous attributes per category; documents (or a JSONB column) model that flexibility without sparse columns.
- **Search/faceting → Elasticsearch:** inverted index for full-text + facet aggregations; fed from the catalog via CDC.
- **Cart → key-value (Redis):** ephemeral, high-churn, TTL'd, keyed by session/user; durability needs are low.

**Data model:** Orders fully normalized in Postgres (with line-item price snapshots — see Schema Design). Catalog as JSONB documents keyed by product id. Search index denormalized per the query shapes. Cart as a Redis hash keyed by user id.

**Scaling & bottlenecks:** Reads dominate the catalog → cache + replicas; search scales independently in ES. Orders are the consistency-critical, lower-volume path → keep on Postgres, scale vertically + replicas. The hard part is **keeping ES and the catalog in sync** (CDC/outbox, not dual writes).

**Tradeoffs & failure modes:** Cart in Redis can be lost on eviction/restart — acceptable (regenerate or warn). ES is eventually consistent with the catalog (search may lag a catalog edit by seconds). Orders never tolerate loss → no eventual-consistency shortcuts there. Polyglot adds operational surface; justified by genuinely different access patterns.

---

## D3. Design a URL shortener's storage

**Requirements/Scale:** 100M new short URLs/month, reads ≫ writes (10,000:1), <50ms redirect latency globally, links rarely change.

**High-level design:** Almost pure key-value: short code → long URL. Reads must be globally fast and cacheable.
- **Key-value store (DynamoDB / Redis-backed)** or even a single relational table keyed by short code — the access pattern is `get(code)`.
- **Heavy caching/CDN** in front; entries are immutable so cache TTLs can be long.

**Data model:**
```
links: short_code (PK) -> long_url, created_at, owner_id
```
Generate `short_code` from a counter/Snowflake → base62 encode (avoids collisions and the need to retry random codes), or hash + collision-check.

**Scaling & bottlenecks:** Reads scale via cache + read replicas / DAX; the redirect path should mostly never touch the primary DB. Writes are modest (≈40/s avg). Key-value sharding by `short_code` is trivial (hash partition). Hot links (viral) are served entirely from cache/CDN.

**Tradeoffs & failure modes:** Strong consistency isn't required for redirects (a brand-new link being unavailable for a second is fine; an existing link must always resolve). Relational vs key-value here is a near-tie at moderate scale — a single Postgres table with caching is simplest; key-value/Dynamo earns its place at extreme global scale. Analytics (click counts) go to a separate high-write store/stream, not the redirect path.

---

## D4. Design storage for a real-time chat application

**Requirements/Scale:** 100M users, billions of messages, must fetch recent messages per conversation fast, unread counts, presence, can tolerate eventual consistency on read receipts but not on message delivery/order.

**High-level design:** Polyglot again:
- **Messages → wide-column (Cassandra):** partition by `conversation_id`, cluster by time-ordered message id → linear write scale and cheap "recent messages in a conversation" reads. This is the firehose.
- **Conversation metadata, membership → relational or document:** smaller, more relational, needs integrity.
- **Presence + unread counters → Redis:** ephemeral, high-churn, in-memory.
- **Search → Elasticsearch** (optional) for message search.

**Data model:**
```
messages (Cassandra): PK (conversation_id, message_id DESC)  -- message_id = snowflake
members  (relational): conversation_id, user_id, last_read_msg_id
presence (Redis):      user_id -> online/last_seen, TTL
```

**Scaling & bottlenecks:** Message volume is the bottleneck → wide-column shards by conversation. Ordering must be consistent within a conversation → time-ordered ids and per-conversation partition guarantee it. Fan-out unread counts for big groups → maintained counters (Redis), eventually consistent.

**Tradeoffs & failure modes:** Wide-column needs query patterns known up front (fetch recent by conversation) — they are. Read receipts/presence are eventually consistent (acceptable). Message delivery/ordering is not negotiable → handled by the partition+clustering design. Redis presence loss on restart just shows stale "offline."

---

## D5. Design the data layer for a fraud-detection / recommendation engine

**Requirements/Scale:** Detect fraud rings and power "users who bought X also bought Y"; relationships and multi-hop traversals are the core query; transactions write at high volume.

**High-level design:**
- **Transactional system of record → relational (Postgres):** ACID writes for transactions/accounts.
- **Graph database (Neo4j/Neptune)** for the relationship layer: nodes = users/accounts/devices/merchants, edges = transactions/shared-device/shared-address. Fraud "rings" and recommendation paths are graph traversals (cycle detection, shortest path, common-neighbor) that would be unbounded self-joins in SQL.
- Stream transactions into the graph via CDC.

**Data model:** Graph: `(User)-[:TRANSACTED]->(Merchant)`, `(User)-[:SHARES_DEVICE]->(User)`, etc. Relational: normalized transactions/accounts.

**Scaling & bottlenecks:** Graph traversals are cheap relative to SQL joins but graph DBs scale horizontally less easily — keep the graph to the relationship subset that matters, not all data. High write volume goes to the relational/stream layer; the graph is updated asynchronously.

**Tradeoffs & failure modes:** The graph is a derived view, eventually consistent with the transactional source — acceptable for detection (slight lag) but means real-time blocking decisions may need a faster path (rules engine + cache). Graph scaling limits mean you prune/age out edges. Don't put the system of record in the graph — keep it relational.
