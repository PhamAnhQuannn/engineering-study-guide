# Multi-Vendor Marketplace Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Multi-tenancy, split payments, trust/reputation, seller isolation.

---

## DC1. Split payment — direct payout vs escrow for a marketplace

**Answer**

**Direct payout (charge buyer → immediately pay sellers):**
- Pro: sellers get paid fast, simpler flow.
- Con: no protection for buyers. If the item never arrives, clawing back from the seller is hard. Chargeback risk shifts to the platform.
- Suitable for: platforms with high-trust sellers (enterprise SaaS marketplaces).

**Escrow (charge buyer → hold → release on delivery/timeout):**
- Pro: buyer is protected — money only moves when goods are confirmed received. Standard consumer protection expectation.
- Con: seller cash flow is delayed. Adds complexity (hold management, timeout logic, dispute windows).
- Suitable for: any consumer marketplace (Etsy, Amazon, eBay all use escrow variants).

**Decision:** default to escrow for consumer marketplaces. The trust benefit far outweighs the implementation complexity. Use Stripe Connect's escrow/transfer model to avoid building payment infrastructure from scratch.

---

## DC2. Marketplace search — single unified index vs per-seller indexes

**Answer**

**Single unified index (all products in one Elasticsearch index):**
- Pro: buyers search across all sellers seamlessly. Unified ranking (relevance + seller quality + freshness). Simple query path.
- Con: hot sellers' updates can affect indexing throughput for all. A corrupt seller's data can degrade the whole index.
- Suitable for: most marketplaces (the norm).

**Per-seller indexes:**
- Pro: complete isolation — one seller's issues don't affect others. Easier to reindex one seller.
- Con: cross-seller search requires scatter-gather across all indexes (slow, complex). Cannot rank cross-seller results uniformly without a coordination layer.
- Suitable for: platforms where sellers operate independently (like separate Shopify stores), not unified marketplaces.

**Decision:** single unified index is the right choice for a marketplace. Buyer UX depends on cross-seller search. Handle the isolation concern via: (1) rate-limit seller catalog updates, (2) async indexing via Kafka, (3) index aliases for zero-downtime rebuilds if one seller's data corrupts.
