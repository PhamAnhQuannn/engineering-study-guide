# Multi-Vendor Marketplace Design — Estimation Questions

[← Topic overview](../README.md)

> Topic: Multi-tenancy, split payments, trust/reputation, seller isolation.

---

## E1. Multi-vendor marketplace: orders and payment volume

**Assumptions**
- 500k active sellers, 50M products, 10M DAU buyers.
- 200k orders/day, avg 2.5 items per order from avg 1.5 sellers.
- Avg order value: $45. Platform commission: 15%.
- Search: 10M DAU × 5 searches/day = 50M searches/day.

**Payment volume**
- Daily GMV: 200k × $45 = $9M/day, ~$3.3B/year.
- Platform revenue: $9M × 15% = $1.35M/day.
- Payout transactions: 200k orders × 1.5 sellers/order = 300k payouts/day (batched nightly: fewer API calls).

**Search load**
- 50M queries/day ÷ 86,400 = ~580 QPS avg, ~1,750 QPS peak.
- Index size: 50M products × 2 KB avg = 100 GB. Fits in Elasticsearch with a few shards + replicas.

**Catalog writes**
- New listings: 500k sellers × avg 2 new products/month = 1M new products/month ≈ 33k/day.
- Price/stock updates: 50M products × 5% updated daily = 2.5M updates/day ≈ 29 updates/sec avg.

**Order processing**
- 200k orders/day ÷ 86,400 = ~2.3 orders/sec avg, ~10 orders/sec peak.
- Each order: validate inventory, create order + order_items, charge payment, enqueue fulfillment events. ~5 DB writes per order.

**Storage**
- Orders: 200k/day × 1 KB = 200 MB/day. With 3-year retention: ~220 GB (trivial).
- Product images: 50M products × avg 5 images × 500 KB = 125 TB total. CDN serves 90%+.

**Key takeaway:** search QPS and catalog size dominate compute. Payment volume is modest but must be 100% reliable — financial correctness is non-negotiable.
