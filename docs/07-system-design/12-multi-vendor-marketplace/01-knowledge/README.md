# Multi-Vendor Marketplace Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Multi-tenancy, split payments, trust/reputation, seller isolation.

A multi-vendor marketplace like Etsy or Amazon Marketplace is the most **commercially relevant** system design question. It tests multi-tenancy, financial correctness, trust systems, and the dual-sided platform challenge (buyers AND sellers). It's also the natural evolution of ShopFast — what happens when a single-vendor store opens up to external sellers?

> **🛒 Where we are in building ShopFast** — The [Distributed Scheduler](../../11-distributed-scheduler/01-knowledge/README.md) gave us backend infrastructure. Now we apply everything to ShopFast's biggest evolution: opening the platform to third-party sellers. This means multi-tenant [architecture](../../03-architecture-styles/01-knowledge/README.md), split payments, independent fulfillment, and trust systems. ShopFast's single-vendor catalog, checkout, and [caching](../../05-caching/01-knowledge/README.md) layers all need rethinking. **Next:** [Video Streaming](../../13-video-streaming/01-knowledge/README.md) explores CDN-dominated media delivery at scale.

---

## Why it matters

This question tests:
1. **Multi-tenancy** — seller data isolation, per-seller inventory, shared vs isolated infrastructure
2. **Financial correctness** — split payments, escrow, commission, payouts (zero tolerance for errors)
3. **Trust and safety** — reviews, ratings, fraud detection, dispute resolution
4. **Composed commerce** — multi-seller cart, independent fulfillment per seller, unified buyer experience

---

## Key architectural differences from single-vendor

| Concern | Single-vendor (ShopFast v1) | Marketplace (ShopFast v2) |
|---------|---------------------------|---------------------------|
| Catalog ownership | Platform owns all products | Each seller owns their products |
| Inventory | Single pool | Per-seller isolated stock |
| Checkout | One payment, one shipment | One payment, N sellers, N shipments |
| Payment flow | Buyer → platform | Buyer → platform escrow → sellers (minus commission) |
| Trust | Platform reputation | Per-seller ratings + platform trust score |
| Search ranking | Relevance only | Relevance × seller quality × freshness × promotion bid |

---

## The subsystems

### 1. Seller management
Onboarding: identity verification, [payment account setup](../../04-api-design/01-knowledge/README.md) (Stripe Connect), category selection. Seller lifecycle: pending → active → suspended. Commission rates (default 15%, negotiable for high-volume sellers).

### 2. Product catalog (multi-tenant)
`products(id, seller_id, category_id, title, description, attrs, price, stock, status)`. Every query must be scoped by seller for management, but cross-seller for buyer search. Elasticsearch index with 50M+ products. Ranking: text relevance × seller quality score × recency × promotion bid.

### 3. Multi-seller cart and checkout
A single cart can contain items from N sellers. On checkout:
1. Validate inventory per seller (atomic per-seller, eventual cross-seller)
2. Charge buyer once (single Stripe charge)
3. Create one order with N sub-orders (one per seller)
4. Each sub-order has independent fulfillment, shipping, tracking

### 4. Split payment
The critical financial flow:
1. **Charge:** buyer pays total to platform (Stripe charge)
2. **Escrow:** funds held by platform
3. **Fulfillment:** each seller ships independently
4. **Settlement:** on delivery confirmation (or after N-day timeout), platform transfers seller's share minus commission
5. **Payouts:** batched nightly to sellers' bank accounts

Stripe Connect handles most of this infrastructure. The platform's responsibility: correctly calculating commission, handling partial refunds (one seller's items returned, others kept), and reconciliation.

### 5. Trust and reputation
- **Buyer reviews:** per product AND per seller. Verified purchase badge (only buyers who actually bought can review).
- **Seller ratings:** aggregate score from reviews, return rate, shipping speed, response time.
- **Fraud detection:** ML pipeline for fake reviews (burst patterns, sentiment anomalies, reviewer purchase history).
- **Dispute resolution:** buyer files claim → seller has 72h to respond → platform arbitrates if unresolved. Evidence: tracking info, delivery photos, communication history.

### 6. Seller analytics
Dashboard: sales, views, conversion rate, payout history, inventory alerts. Uses event-driven architecture — order events flow to an analytics [pipeline](../../../09-distributed-systems/04-messaging-queues/01-knowledge/README.md) (Kafka → ClickHouse/BigQuery).

---

## ShopFast case: marketplace evolution

> **Scenario:** ShopFast's single-vendor store is successful. Management wants to open the platform to third-party sellers to expand the catalog without holding inventory.

**Decision:** add seller accounts with Stripe Connect for payouts. Product table gets `seller_id` column. Cart service handles multi-seller carts. Order service creates sub-orders per seller. Escrow model for buyer protection.

**Architecture:** the existing [modular monolith](../../03-architecture-styles/01-knowledge/README.md) gains a `seller` module and a `payout` module. Existing `catalog`, `cart`, and `order` modules are extended — not replaced. [Transactions](../../../05-databases/04-transactions/01-knowledge/README.md) ensure inventory decrement is atomic per seller.

**Rejected:** per-seller database (too expensive, cross-seller search requires federation). Also rejected: immediate payout (no buyer protection, high chargeback risk).

---

## Lessons and pitfalls

1. **Split payment is the #1 complexity driver.** One checkout → N sellers → N fulfillment timelines → N payout calculations. Partial refunds (one seller's item returned) make it worse. Get this right.

2. **Inventory isolation is non-negotiable.** Seller A's stock is not seller B's stock. A bug that lets one seller oversell another's inventory is a trust-destroying incident.

3. **Search ranking fairness matters.** Pure relevance may surface only top sellers, creating a monopoly. Mix in freshness + new seller boost. Consider sponsored listings (revenue + discoverability).

4. **Dispute resolution is a product, not an edge case.** Budget for it. Automated for clear-cut cases (tracking shows delivered), manual for ambiguous ones. The escalation flow (buyer → seller → platform) must be designed upfront.

5. **Financial reconciliation runs nightly.** 200k orders/day × 1.5 sellers/order = 300k payout calculations. Batch processing, not real-time. Settlement errors → dead letter queue + manual review. Never silently drop a payout.

6. **Seller onboarding friction = quality.** Strict verification (identity, bank account, business docs) slows growth but reduces fraud. Start strict, relax for established sellers with proven track records.
