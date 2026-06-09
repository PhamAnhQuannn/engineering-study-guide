# Schema Design — System Design Questions

[← Topic overview](../README.md)

> Topic: Normalization vs denormalization, modeling.

Each prompt is structured: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.** These are schema-centric design drills — focus on the data model and how it serves the access patterns.

---

## D1. Design the schema for an e-commerce order system

**Requirements/Scale:** Catalog of ~5M products, 10M users, 50M orders/year (~1.6 writes/s avg, 50 peak), order history must be immutable (price-at-purchase preserved), support "my orders," "order detail," and analytics rollups. Strong consistency on inventory and payment.

**High-level design:** Normalized OLTP core (users, products, orders, order_items, payments, inventory) for write correctness; denormalized read models / rollups for dashboards. Inventory decrement is a transactional hot spot — guard with row locks or atomic conditional update.

**Data model:**
```sql
users(id PK, email UNIQUE, created_at)
products(id PK, sku UNIQUE, name, price NUMERIC(12,2), category_id FK)
inventory(product_id PK/FK, qty_on_hand INT CHECK (qty_on_hand >= 0), version INT)
orders(id PK, user_id FK, status, total NUMERIC(12,2), placed_at TIMESTAMPTZ)
order_items(id PK, order_id FK, product_id FK,
            product_name, unit_price NUMERIC(12,2),  -- denormalized snapshot
            qty INT CHECK (qty > 0))
payments(id PK, order_id FK, provider_ref UNIQUE, amount, status)
```
- `order_items` **snapshots** `product_name`/`unit_price` so historical orders stay correct when the catalog changes — deliberate denormalization, also avoids a join.
- `orders.total` precomputed and reconciled against `SUM(order_items)`.
- `inventory.version` (optimistic lock) or `SELECT ... FOR UPDATE` to prevent oversell.

**Scaling & bottlenecks:** Hot inventory rows → atomic `UPDATE inventory SET qty = qty - :q WHERE product_id=:p AND qty >= :q` returning affected rows (no oversell, no read-then-write race). Read scaling via replicas for catalog/history; rollups (`daily_sales`) maintained by a job for analytics. Partition `orders`/`order_items` by time as they grow.

**Tradeoffs & failure modes:** Snapshotting line items costs storage and means a product price-fix won't retro-update history (usually correct). Precomputed `total` can drift — add a reconciliation check. `ON DELETE` for products must be `RESTRICT` or soft-delete (never cascade away order history). Payment idempotency via `provider_ref UNIQUE` prevents double-charge on retry.

---

## D2. Design a multi-tenant SaaS schema

**Requirements/Scale:** B2B app, 5,000 tenants, largest tenant 100× the smallest, strict data isolation, per-tenant queries dominate, occasional cross-tenant admin analytics.

**High-level design:** Choose an isolation model:
- **Shared schema, `tenant_id` column** — cheapest, easiest to operate/migrate, best resource pooling; isolation is enforced by *every* query carrying `tenant_id` (risk of a leaky query). Default for most SaaS.
- **Schema-per-tenant** — stronger isolation, per-tenant migrations, harder at thousands of tenants.
- **Database-per-tenant** — strongest isolation, easy per-tenant backup/restore and noisy-neighbor control; operationally heavy, expensive at scale. Reserve for enterprise/regulated tenants.

**Data model (shared-schema):**
```sql
-- tenant_id leads every PK/index
documents(tenant_id, id, owner_id, title, body, created_at,
          PRIMARY KEY (tenant_id, id))
CREATE INDEX ON documents (tenant_id, created_at);
-- Postgres Row-Level Security as a safety net
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::bigint);
```

**Scaling & bottlenecks:** `tenant_id` must lead composite indexes so every query prunes to one tenant. Large tenants cause skew → consider sharding by `tenant_id` (whole tenant lives on one shard) once a single node is saturated. Noisy neighbor: connection/CPU limits per tenant, or move whales to dedicated DBs (hybrid model).

**Tradeoffs & failure modes:** Shared schema's biggest risk is a forgotten `WHERE tenant_id` → cross-tenant leak; mitigate with RLS, a query-builder that injects it, and tests. Per-tenant migrations (other models) multiply operational load. Hybrid (pooled for small, dedicated for whales) is the common pragmatic answer.

---

## D3. Design a schema for a chat / messaging app

**Requirements/Scale:** 1:1 and group chats, 100M users, billions of messages, must load "recent messages in a conversation" and "my conversation list" fast, support read receipts and unread counts.

**High-level design:** Conversation-centric model. Messages are append-only and the dominant volume → partition by conversation and time. Unread counts and "last message" are read-hot → denormalize.

**Data model:**
```sql
conversations(id PK, type ENUM('dm','group'), created_at)
conversation_members(conversation_id, user_id, joined_at, last_read_msg_id,
                     PRIMARY KEY (conversation_id, user_id))
messages(conversation_id, id /* time-ordered, e.g. snowflake */, sender_id,
         body, created_at,
         PRIMARY KEY (conversation_id, id))     -- clustered by conversation+time
-- denormalized for the conversation-list screen:
conversations.last_message_id, last_message_preview, last_message_at
```
- Time-ordered message IDs give natural chronological ordering and keyset pagination within a conversation (`WHERE conversation_id=? AND id < ? ORDER BY id DESC LIMIT 50`).
- Unread count = messages with `id > last_read_msg_id` (or a maintained counter to avoid counting).

**Scaling & bottlenecks:** Messages table is the firehose → shard/partition by `conversation_id`; co-locate a conversation's messages. Conversation-list query must not scan all messages → it reads `conversation_members` joined to denormalized `last_message_*`. Read receipts at scale → per-member `last_read` pointer, not a row per (message, reader).

**Tradeoffs & failure modes:** Denormalized `last_message_*` must be updated on every send (write amplification, possible drift → reconcile). Group fan-out for unread counts can be expensive → maintained counters with eventual consistency. Hard deletes complicate threading → tombstones.

---

## D4. Design a schema for a booking / reservations system (no double-booking)

**Requirements/Scale:** Resources (rooms/tables/seats) booked for time ranges; must **never double-book**; high contention on popular slots; show availability calendar.

**High-level design:** The core invariant is "no two confirmed bookings overlap for the same resource." Enforce it in the database, not application logic, because many clients book concurrently.

**Data model (Postgres):**
```sql
resources(id PK, name, capacity)
bookings(
  id PK,
  resource_id BIGINT REFERENCES resources(id),
  during TSTZRANGE NOT NULL,            -- [start, end)
  status TEXT,
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
     WHERE (status = 'confirmed')        -- no overlapping confirmed ranges
);
```
- The **GiST exclusion constraint** makes overlapping confirmed bookings physically impossible — the DB rejects the second writer.
- Without range types: model slots discretely and put a `UNIQUE (resource_id, slot)` on a `booked_slots` table.

**Scaling & bottlenecks:** Popular resources are contention hot spots → the exclusion constraint serializes conflicting writers (correct but can throttle). For very high contention, shard by resource and/or use a queue to serialize per-resource booking attempts. Availability reads served from a materialized calendar refreshed on write.

**Tradeoffs & failure modes:** Exclusion constraints are Postgres-specific; in MySQL you fall back to discrete-slot unique keys or `SELECT ... FOR UPDATE` over the resource. Holding a slot during a multi-step checkout needs a `pending` reservation with TTL/expiry sweep to avoid permanent locks from abandoned carts.

---

## D5. Design an audit log / event history schema

**Requirements/Scale:** Record every state change to key entities for compliance; append-only; billions of rows; query "history of entity X" and "all changes by user Y in date range"; retain 7 years, cheap storage for old data.

**High-level design:** Append-only, immutable, time-partitioned table. Never update or delete (compliance). Hot recent partitions on fast storage, old partitions archived/compressed.

**Data model:**
```sql
audit_log(
  id BIGINT,                       -- snowflake / time-ordered
  entity_type TEXT, entity_id BIGINT,
  action TEXT,                     -- create/update/delete
  actor_id BIGINT,
  changed_at TIMESTAMPTZ,
  diff JSONB,                      -- before/after or delta
  PRIMARY KEY (changed_at, id)
) PARTITION BY RANGE (changed_at);
CREATE INDEX ON audit_log (entity_type, entity_id, changed_at);
CREATE INDEX ON audit_log (actor_id, changed_at);
```

**Scaling & bottlenecks:** Range-partition by month → "drop old partition" is an O(1) retention operation (vs deleting billions of rows). Indexes on the two query shapes. Writes are sequential → cheap. For analytics, stream to a columnar warehouse (BigQuery/ClickHouse) via CDC.

**Tradeoffs & failure modes:** JSONB `diff` is flexible but unindexed paths are slow — index the specific paths you query, or store key fields as columns. Append-only means storage grows forever → partitioning + cold-tier archival is mandatory. Writing the audit row in the same transaction as the change guarantees consistency but couples latency; an outbox + async writer decouples at the cost of a small consistency window.
