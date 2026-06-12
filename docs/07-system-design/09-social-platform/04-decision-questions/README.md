# Social Platform Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Follow graph, feed, stories, DMs, media pipeline, explore/discovery.

---

## DC1. Chronological vs algorithmic feed ranking — which do you choose and why?

**Answer**

**Chronological:**
- Pro: predictable, transparent, no filter bubble concerns. Users see everything from people they follow.
- Con: doesn't scale with high follow counts — user follows 1,000 accounts, sees content from the most recent, misses the best content from less frequent posters.
- Suitable for: small-scale / niche platforms (Mastodon), or as a toggle option.

**Algorithmic:**
- Pro: surfaces the most relevant content regardless of timing. Higher engagement, longer session time. Can deprioritize spam/low-quality.
- Con: filter bubble, opacity ("why am I seeing this?"), kills reach for small creators unless they game the algorithm.
- Suitable for: large platforms where the content volume per user exceeds what they can consume chronologically.

**Decision framework:** offer both — algorithmic by default (higher engagement metrics), chronological as a toggle (user trust). This is what Instagram and X/Twitter do. The algorithmic ranking model is a core competitive differentiator; invest heavily in it.

---

## DC2. Same store for posts and stories vs separate ephemeral store — which approach?

**Answer**

**Same store (Postgres/Cassandra for both):**
- Pro: simpler operations — one storage system to manage. Unified backup/recovery.
- Con: stories are write-heavy (2B/day created) AND delete-heavy (2B/day expired). Mixing with permanent posts means the store handles very different access patterns. TTL-based deletion in SQL is expensive (DELETE statements generate write amplification).

**Separate ephemeral store (DynamoDB/Cassandra with native TTL):**
- Pro: TTL is built-in — expired stories evaporate without explicit DELETE. Write-optimized for the high throughput. No impact on the posts store.
- Con: two storage systems to operate. Cross-entity queries (show user's posts + active stories) require joining across stores.

**Decision:** separate stores. The access patterns are too different — stories are a high-churn ephemeral workload that would degrade the posts store. DynamoDB with TTL or Cassandra with column-level TTL handles the 2B create/2B delete daily cycle naturally. The cross-store join is a minor inconvenience compared to the operational headache of mixing workloads.
