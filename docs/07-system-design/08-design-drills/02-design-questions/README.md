# Design Drills — System Design Questions

[← Topic overview](../README.md)

> Topic: URL shortener, feed, chat, rate limiter, notifications.

The five canonical drills, each structured: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design a URL shortener (TinyURL/bit.ly)

**Requirements / Scale**
- Functional: create short→long mapping, redirect, optional custom alias + expiry + click analytics.
- Non-functional: redirects are read-dominated (~100:1), low latency (<50 ms), highly available. ~100M new URLs/month, ~10B redirects/month.

**High-level design**
- Write path: `POST /urls` → generate a unique **short code** (base62 of a Snowflake/sequence ID, 7 chars ≈ 62⁷ ≈ 3.5T codes) → store mapping.
- Read path: `GET /{code}` → look up → **301/302 redirect**. Front with **CDN + Redis cache** (redirects are hugely cacheable).
- Analytics written **async** (emit click event → queue → aggregator) to keep redirects fast.

**Data model**
- `urls(code PK, long_url, owner_id, created_at, expires_at)` in a KV/wide-column store (or sharded SQL). Code is the partition key.
- Custom alias: check-and-set uniqueness on `code`.

**Scaling & bottlenecks**
- Reads dominate → cache hit rate is everything; a hot link is a hot key (L1 + CDN).
- ID generation must be collision-free and distributed → Snowflake or a sharded counter, not random with retries.
- Storage is modest (~100M/month × ~500 B ≈ 50 GB/month) → shard by code over time.

**Tradeoffs & failure modes**
- 301 (permanent, cacheable, loses per-click analytics) vs 302 (temporary, every click hits you — better analytics). Often 302.
- Cache down → redirects fall through to DB (provision headroom).
- Abuse/malware → scan + blocklist; rate-limit creation.

---

## D2. Design a news feed (Twitter/Instagram timeline)

**Requirements / Scale**
- Functional: post, follow, view a ranked feed of followed accounts, infinite scroll.
- Non-functional: 300M DAU, read-heavy, feed loads fast (<200 ms), some staleness OK. Celebrities have millions of followers.

**High-level design**
- **Hybrid fan-out:** on post, **fan-out-on-write** to followers' feed caches for normal users; for **celebrities, fan-out-on-read** (pull their recent posts at feed-assembly time) to avoid millions of writes per tweet.
- Feed service merges precomputed feed + pulled celebrity posts, ranks, paginates with a **cursor**.
- Media in **object storage + CDN**; posts in a write-optimized store; per-user feed cache in Redis.

**Data model**
- `posts(post_id, author_id, content, created_at)`; `follows(follower_id, followee_id)`.
- `feed:{userId}` → list of post ids (Redis), capped (e.g., latest few hundred).

**Scaling & bottlenecks**
- Fan-out-on-write cost = post × follower count → the celebrity problem (mitigated by hybrid).
- Feed cache memory scales with active users → cap feed length, evict idle.
- Ranking and media delivery are separate scaling concerns.

**Tradeoffs & failure modes**
- Push (fast reads, costly writes, celebrity blowup) vs pull (cheap writes, costly reads) → hybrid balances both.
- Staleness: a brand-new post may take seconds to appear — acceptable.
- Fan-out worker backlog → queue + monitor lag.

---

## D3. Design a chat / messaging system (WhatsApp/Slack)

**Requirements / Scale**
- Functional: 1:1 + group messaging, real-time delivery, presence, history, delivery/read receipts, offline delivery.
- Non-functional: low-latency delivery (<100 ms), ordered per conversation, billions of messages, always-on.

**High-level design**
- Clients hold **WebSocket** connections to a **gateway tier**; a **connection registry** (Redis) maps `user → gateway` so a message can be routed to the recipient's live socket.
- Send: client → gateway → message service (persist + assign **sequence number**) → **pub/sub** fan-out to recipients' gateways → push over their sockets. Offline recipients get a **push notification**; message stored for later sync.
- History in a **wide-column store** (Cassandra) partitioned by conversation.

**Data model**
- `messages(conversation_id PK, seq, sender_id, body, sent_at)` — partition by conversation, clustered by seq for ordered reads.
- `connections(user_id → gateway_id)` in Redis; `presence(user_id → status, last_seen)`.

**Scaling & bottlenecks**
- Millions of persistent connections → many gateway nodes; the registry + pub/sub are the routing backbone.
- Group fan-out = message × members → fan-out service; large groups are the "celebrity" analog.
- Ordering via per-conversation sequence numbers.

**Tradeoffs & failure modes**
- At-least-once delivery → **idempotent** client handling + dedup by (conversation_id, seq).
- Gateway crash → clients reconnect, re-register, sync missed messages by last-seen seq.
- Exactly-once is impractical end-to-end → dedup makes at-least-once safe.

---

## D4. Design a distributed rate limiter

**Requirements / Scale**
- Functional: enforce per-client limits (e.g., 1,000 req/min) across many stateless gateway nodes; return 429 + Retry-After.
- Non-functional: <1 ms overhead, accurate-ish, configurable fail-open/closed.

**High-level design**
- **Token bucket** per client in **Redis** (shared state); atomic Lua script refills by elapsed time and decrements; reject when empty.
- **Local L1** approximate bucket per node for hot clients to cut Redis hops, reconciled periodically.
- Limits configurable per tier/endpoint.

**Data model**
- `rl:{clientKey}` → `{tokens, last_refill_ts}` (~50 B/key) in Redis.

**Scaling & bottlenecks**
- Redis is the shared counter → hot key for a very busy client; mitigate with L1 + sharded sub-buckets.
- ~2 Redis ops/request; cluster Redis for very high aggregate RPS.

**Tradeoffs & failure modes**
- Accuracy vs latency (L1 over-allows slightly).
- **Fail-open** (available but unprotected) vs **fail-closed** (protected but rejects valid traffic) when Redis is down — choose by endpoint risk; degrade to a local limiter.
- Token bucket (bursts) vs sliding window (smoother, more accurate) vs fixed window (boundary spikes).

---

## D5. Design a notification system (push/email/SMS)

**Requirements / Scale**
- Functional: deliver notifications across channels reliably, respect user preferences/opt-outs, dedup, retry, priority lanes.
- Non-functional: at-least-once delivery, high throughput (millions/day), provider rate limits, no duplicates from the user's perspective.

**High-level design**
- Producers emit notification events → **ingestion queue** → notification service applies **preferences/suppression + dedup** → routes to per-channel queues → **channel workers** call provider APIs (APNs/FCM, email, SMS).
- **Retries with backoff** + **dead-letter queue** for persistent failures; **idempotency key** per notification to dedup.
- Templating service for content; priority queues for transactional vs marketing.

**Data model**
- `notifications(id PK, user_id, channel, template, status, dedup_key UNIQUE, attempts, next_retry_at)`.
- `preferences(user_id, channel, enabled, quiet_hours)`.

**Scaling & bottlenecks**
- Queues absorb bursts; workers scale on **queue depth/lag**.
- Provider rate limits → throttle per provider; batch where supported.
- Fan-out (e.g., "notify all followers") handled by a fan-out service feeding the queues.

**Tradeoffs & failure modes**
- At-least-once → **idempotent/dedup** so a retry doesn't double-send.
- Provider outage → buffer + retry + DLQ + alert; degrade by channel (fall back SMS→push).
- Priority inversion (marketing starving transactional) → separate lanes.
