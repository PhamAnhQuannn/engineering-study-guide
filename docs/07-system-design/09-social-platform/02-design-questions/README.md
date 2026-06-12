# Social Platform Design — System Design Questions

[← Topic overview](../README.md)

> Topic: Follow graph, feed, stories, DMs, media pipeline, explore/discovery.

---

## D1. Design a social platform (Instagram/Twitter)

**Requirements / Scale**
- Functional: user profiles, follow graph (unidirectional), post (text + images + video), stories (24h ephemeral), news feed (algorithmic + chronological toggle), explore/discover, DMs, likes/comments, hashtags, search.
- Non-functional: 500M DAU, 200M posts/day, 2B stories/day, 50M active DM conversations, 95% read traffic, feed load <200 ms, DM delivery <100 ms.

**High-level design**
- **API gateway** → routes to domain services: user service, graph service, content service, feed service, DM service, media service, search service, safety service.
- **Content pipeline:** client → API → content service (validate, store metadata in Postgres) → media service (resize/transcode → S3 + CDN) → fan-out service (push to feed caches).
- **Feed service:** hybrid fan-out (write for normal users, read for celebrities with >100k followers). Feed cache per user in Redis (list of post IDs, capped ~500). At read time: merge precomputed feed + pull celebrity posts + pull stories rail → rank → paginate with cursor.
- **DM service:** WebSocket gateway + connection registry (Redis: user→gateway). Message → persist (Cassandra, partitioned by conversation) → route to recipient's gateway. Offline → push notification.
- **Stories:** separate write path; stored with TTL. Ring buffer per user. Background sweeper deletes expired stories (or rely on TTL in Cassandra/DynamoDB).
- **Search:** Elasticsearch for posts, users, hashtags. Near-real-time indexing via Kafka consumer.
- **Explore:** pre-computed trending + personalized recommendations (offline ML pipeline → cached scores).
- **Event backbone:** Kafka for all inter-service events (post created, follow, like, story viewed).

**Data model**
- `users(id PK, username UNIQUE, display_name, bio, avatar_url, is_private, created_at)` — Postgres.
- `follows(follower_id, followee_id, created_at)` PK (follower_id, followee_id) — Postgres. Index on followee_id for "who follows me."
- `posts(id PK, author_id, content_type, text, media_urls[], created_at)` — Postgres (metadata) + S3 (media).
- `stories(id PK, author_id, media_url, created_at, expires_at)` — DynamoDB/Cassandra with TTL.
- `messages(conversation_id, seq, sender_id, body, sent_at)` — Cassandra, partition by conversation_id, cluster by seq.
- `feed:{user_id}` → sorted set of post IDs — Redis.
- Elasticsearch indices: `posts_index`, `users_index`, `hashtags_index`.

**Scaling & bottlenecks**
- **Follow graph fan-out:** celebrity posts generate millions of feed writes. Hybrid fan-out caps write amplification. Threshold tunable (e.g., >100k followers → read path).
- **Stories volume:** 2B created/day + 2B expired/day. Use a store with native TTL (DynamoDB, Cassandra) to avoid manual deletion storms.
- **Media storage:** petabytes total. Tiered: hot (recent, popular) on CDN edge, warm on S3, cold on Glacier for old/low-access.
- **Search indexing lag:** Kafka consumer may lag under load → accept eventual consistency for search (seconds, not minutes).
- **DM fan-out in groups:** group chats = message × members. Cap group size or use a fan-out worker.

**Tradeoffs & failure modes**
- Feed freshness vs cost: aggressive fan-out = fresh feeds but high write amplification. Lazy pull = stale but cheap. Hybrid balances.
- Story deletion guarantee: TTL is "best effort" in most stores. For GDPR/regulatory, add a secondary sweep job + audit log.
- Privacy (private accounts): every read path must check visibility. Cache invalidation on privacy toggle is expensive — accept brief inconsistency.
- DM ordering: per-conversation sequence numbers guarantee order. Cross-conversation ordering not guaranteed (and not needed).
- Feed ranking cold start: new users with no engagement signals → fall back to chronological + trending.

**Checklist**
- [ ] Clarifies scope — which 2-3 subsystems to deep-dive
- [ ] Models follow graph and its fan-out implications
- [ ] Uses hybrid fan-out for feed (write for normal, read for celebrities)
- [ ] Handles stories as ephemeral content with TTL + deletion guarantee
- [ ] Separates media pipeline from content hot path (async processing)
- [ ] Addresses privacy/visibility as a cross-cutting concern
- [ ] Designs DM delivery with WebSocket + offline fallback
- [ ] Mentions content moderation / safety
- [ ] Provides degraded-mode story (feed falls back to chronological, DMs queue if gateway down)
