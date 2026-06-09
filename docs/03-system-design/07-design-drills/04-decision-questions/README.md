# Design Drills — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: URL shortener, feed, chat, rate limiter, notifications.

Named options, a reasoned recommendation, and "what would change the answer." These are the key forks inside the canonical designs.

---

### DC1. Feed: fan-out-on-write vs fan-out-on-read vs hybrid

**Recommendation:** **Hybrid.** Use **fan-out-on-write (push)** for normal users — precompute feeds so reads are fast (and reads dominate). Use **fan-out-on-read (pull)** for high-fan-out accounts (celebrities) to avoid millions of writes per post. Merge precomputed + pulled at read time. Pure push breaks on celebrities; pure pull makes every read expensive.

**What changes it:** Mostly low-follower users → push is fine alone. Symmetric, small social graph → pull may suffice. Few mega-accounts dominating → hybrid is mandatory.

---

### DC2. URL shortener: 301 (permanent) vs 302 (temporary) redirect

**Recommendation:** **302 (temporary)** if you need per-click analytics or want to change/expire mappings — every click hits your server so you can count and control it. **301 (permanent)** if you want maximum performance/cacheability and don't need per-click data — browsers/CDNs cache it and may skip your server entirely. Most shorteners choose **302** to retain analytics and control.

**What changes it:** Need click analytics / mutable mappings → 302. Pure performance, immutable links, SEO link equity → 301. High redirect volume + analytics done client-side → 301 + separate tracking.

---

### DC3. Short-code generation: counter+base62 vs random+collision-check vs hash

**Recommendation:** **Distributed counter + base62** (e.g., Snowflake-style or sharded sequence) — guarantees uniqueness with no collision checks, compact codes, and scales across nodes. **Random + collision-check** works but adds a read per create and retries under contention. **Hash of URL** gives idempotent dedup but risks collisions and exposes structure. Default: counter/Snowflake + base62.

**What changes it:** Need dedup of identical URLs → hash (with collision handling). Want unguessable codes → add randomness/encryption to the counter. Single-node early stage → DB sequence is simplest.

---

### DC4. Chat real-time transport: WebSocket vs SSE vs long polling

**Recommendation:** **WebSocket** for chat — bidirectional, low-latency, persistent; ideal for send + receive + typing/presence. **SSE** if traffic is mostly server→client (live notifications, feeds) and you want simpler HTTP semantics. **Long polling** only as a fallback for environments that block WebSockets. Default chat = WebSocket with long-polling fallback.

**What changes it:** Bidirectional, interactive (chat, games) → WebSocket. Server-push only → SSE. Restrictive proxies/old clients → long-polling fallback.

---

### DC5. Notification/chat delivery: at-least-once + dedup vs attempt-exactly-once

**Recommendation:** **At-least-once delivery with idempotent consumers / dedup keys.** True exactly-once across a distributed network is impractical; instead accept that messages may be redelivered and make processing idempotent (dedup by message/notification id), which is *effectively* exactly-once to the user. Don't try to engineer exactly-once transport — it's brittle and slow.

**What changes it:** Essentially never choose "best-effort once" for important messages (risks loss). For non-critical, high-volume signals where loss is acceptable, at-most-once may be fine. Otherwise: at-least-once + dedup.

---

### DC6. Rate limiter accuracy: centralized Redis vs local-node limits

**Recommendation:** **Centralized (Redis) token bucket** for accurate global limits across the fleet — one source of truth per client. Add a **local L1** approximate layer in front for hot clients to cut latency/Redis load, accepting slight over-allowance. **Local-only** limits are fast but inaccurate (each node enforces independently → N× the intended limit). Default: Redis-authoritative with optional L1.

**What changes it:** Strict global quotas → centralized. Ultra-low latency + tolerant of approximation → local/L1-heavy. Very high RPS hot keys → L1 + sharded counters to relieve Redis.

---

### DC7. Storing chat/message history: relational vs wide-column (Cassandra)

**Recommendation:** **Wide-column (Cassandra/Bigtable)** for large-scale message history — partition by conversation, cluster by sequence/time, giving cheap appends, fast recent-message reads, and horizontal write scale. **Relational** is fine for smaller scale or when you need rich queries/transactions across messages. At billions of messages, wide-column's write throughput and partition model win.

**What changes it:** Huge write volume + simple per-conversation access → wide-column. Modest scale or complex relational queries → SQL. Need full-text search over messages → add a search index regardless.
