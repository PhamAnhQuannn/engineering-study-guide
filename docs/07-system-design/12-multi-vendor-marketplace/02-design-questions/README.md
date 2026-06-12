# Multi-Vendor Marketplace Design — System Design Questions

[← Topic overview](../README.md)

> Topic: Multi-tenancy, split payments, trust/reputation, seller isolation.

---

## D1. Design a multi-vendor marketplace (Etsy/Amazon Marketplace)

**Requirements / Scale**
- Functional: seller onboarding + storefronts, product listing/management, category taxonomy, search with facets, multi-seller cart, consolidated checkout with split payment, order tracking per seller, buyer reviews + seller ratings, dispute resolution, seller analytics/payouts.
- Non-functional: 500k active sellers, 50M products, 10M DAU buyers, 200k orders/day, search latency <200 ms, payment settlement within 7 days, 99.9% checkout availability.

**High-level design**
- **Buyer-facing:** API gateway → catalog service, search service (Elasticsearch), cart service, order service, review service.
- **Seller-facing:** seller portal → listing service (CRUD products), inventory service, order management, analytics, payout dashboard.
- **Payment service:** integrates with Stripe Connect (or equivalent). On checkout: charge buyer once → hold in platform escrow → on delivery confirmation, split to each seller (minus commission) → schedule payout.
- **Search service:** Elasticsearch index with 50M products. Ranking signals: text relevance, seller rating, price, recency, promotion bid (sponsored listings). Faceted filters: category, price range, seller rating, shipping speed.
- **Order service:** a single buyer order may contain items from N sellers. Each seller's items form a **sub-order** with independent fulfillment, shipping, and tracking.
- **Trust service:** buyer reviews (per product + per seller), seller ratings (aggregate), fraud detection (fake reviews, shill bidding), dispute resolution workflow (buyer files → seller responds → platform arbitrates if unresolved within 72h).
- **Event backbone:** Kafka for order events (placed, paid, shipped, delivered, refunded), inventory updates, review events.

**Data model**
- `sellers(id PK, name, status ENUM(pending,active,suspended), commission_rate DECIMAL, payout_account_id, joined_at)` — Postgres.
- `products(id PK, seller_id FK, category_id FK, title, description, attrs JSONB, price DECIMAL, stock INT, status ENUM(active,draft,removed), created_at)` — Postgres. Index on `(seller_id)`, `(category_id)`.
- `orders(id PK, buyer_id, total DECIMAL, status ENUM(pending,paid,partially_shipped,completed,refunded), created_at)` — Postgres.
- `order_items(id PK, order_id FK, seller_id FK, product_id FK, qty INT, unit_price DECIMAL, fulfillment_status ENUM(pending,shipped,delivered,returned), tracking_number, shipped_at)` — Postgres. This is the per-seller sub-order.
- `payments(id PK, order_id FK, buyer_charge_id, total DECIMAL, status ENUM(charged,escrowed,settled,refunded))` — Postgres.
- `payouts(id PK, seller_id FK, order_id FK, amount DECIMAL, commission DECIMAL, status ENUM(pending,settled,failed), settled_at)` — Postgres.
- `reviews(id PK, product_id FK, buyer_id FK, seller_id FK, rating INT 1-5, text, verified_purchase BOOLEAN, created_at)` — Postgres.
- Elasticsearch index: `products_index` (title, description, category, seller_rating, price).

**Scaling & bottlenecks**
- **Search index (50M products):** Elasticsearch cluster with multiple shards. Hot categories (electronics, fashion) get more replicas. Reindexing on schema change is expensive — use aliases for zero-downtime reindex.
- **Hot seller (viral product):** single product gets millions of views + rapid stock depletion. Cache product detail aggressively (Redis + CDN). Inventory decrement must be atomic (Redis `DECR` or Postgres `SELECT FOR UPDATE`).
- **Checkout availability:** payment is the most critical path. Stripe outage → queue orders for retry, show "processing" to buyer. Never lose an order.
- **Payout reconciliation:** 200k orders/day × N sellers = millions of payout calculations. Batch nightly, reconcile daily. Settlement errors → DLQ + manual review.
- **Fraud/review manipulation:** ML pipeline for fake review detection (burst patterns, sentiment anomalies, reviewer history). Rate-limit reviews per buyer per seller.

**Tradeoffs & failure modes**
- **Immediate charge vs escrow:** immediate (seller gets paid fast, buyer trusts less) vs escrow (buyer protected, seller cash flow delayed). Escrow is industry standard for marketplaces — hold until delivery confirmation or auto-release after N days.
- **Per-seller cart vs unified cart:** per-seller (simpler checkout, multiple payments) vs unified (one checkout, complex splitting). Unified is better UX — charge once, split behind the scenes.
- **Inventory consistency:** strong consistency (never oversell, slower checkout) vs eventual (fast checkout, rare oversells requiring refund). For high-value items, strong. For commodity items, eventual + compensating refund.
- **Dispute resolution:** automated (fast, error-prone) vs manual (slow, accurate). Hybrid: auto-resolve clear-cut cases (tracking shows delivered + buyer claims not received → check delivery photo), escalate ambiguous cases.
- **Seller onboarding:** strict verification (slow, fewer bad actors) vs self-serve (fast growth, more fraud). Start strict, relax for established sellers.
- **Search ranking fairness:** pure relevance may surface only top sellers. Mix in freshness + new seller boost to prevent monopolization.

**Checklist**
- [ ] Clearly separates buyer and seller domains
- [ ] Explains split payment model (charge once, escrow, settle per seller minus commission)
- [ ] Handles multi-seller cart with independent fulfillment per seller
- [ ] Designs trust/review system with fraud prevention
- [ ] Addresses search ranking with multiple signals (relevance, seller quality, freshness, promotion)
- [ ] Plans inventory isolation per seller with oversell protection
- [ ] Discusses dispute resolution flow (buyer → seller → platform arbitration)
- [ ] Mentions seller onboarding and payout settlement lifecycle
- [ ] Provides degraded-mode story (payment service down → queue + retry, search degraded → cached results)
