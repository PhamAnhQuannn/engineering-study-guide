# Consistency & CAP — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: ACID/BASE, CAP, consistency models, eventual consistency.

"Consistency" is one of the most overloaded words in our field — it means different things in ACID (Atomicity, Consistency, Isolation, Durability), in CAP (Consistency, Availability, Partition-tolerance), and in the consistency-model literature. A senior engineer keeps these straight and reasons about *which* guarantee a workload actually needs.

> **🛒 Where we are in building ShopFast** — Last topic we added [Failure Handling](../../01-failure-handling/01-knowledge/README.md): timeouts, circuit breakers, and bulkheads that keep the store alive when dependencies fail. But "staying alive" is only half the story — *what data do we serve* while things are degraded? ShopFast has two radically different answers for its two core workflows, and this topic is where we make that split official. **Next:** once we know what consistency level we need, we must guarantee messages are processed exactly as many times as intended — that's [Delivery Semantics](../../03-delivery-semantics/01-knowledge/README.md).

---

## Teaching arc: where ShopFast draws the consistency line

### What it is

A distributed system stores copies of data on multiple nodes. When a write lands, those copies diverge for a moment before they sync up. **Consistency** is about what rules govern what readers see during that window.

The analogy: imagine a shared Google Doc where two people are editing simultaneously in different cities. Strong consistency means every keystroke from London appears in New York *before* you can type your next character — perfectly synchronized, but you feel every millisecond of the Atlantic cable. Eventual consistency means you keep typing freely and the doc merges everything a second later — fast but with the possibility of seeing each other's edits out of order for a brief window. Neither is wrong; they're different bets on what your users care about more.

**ShopFast's split:** the canonical system fact is: *"cart = AP (Available, Partition-tolerant) / eventual; order/payment = CP (Consistent, Partition-tolerant) / strong."* Browsing and cart-editing must feel instant; payment must never double-charge or oversell.

### What it looks like

```
CAP split in ShopFast:

  CART (AP / eventual)                    ORDER (CP / strong)
  ─────────────────────────────────────   ─────────────────────────────────
  Redis or Dynamo-style store             Postgres with serializable reads
  Reads served from any replica           Reads/writes go to primary (leader)
  A partition? Keep serving stale cart    A partition? Refuse — return 503
  Conflict: merge (union items)           Conflict: impossible — one writer
  Result: always fast, maybe briefly      Result: slower, always correct
          inconsistent

  READ:  product/:id  →  Redis cache   │  READ:  order/:id  →  Postgres primary
  (60 s stale is fine — catalog AP)    │  (must see latest inventory count)
```

### The code that builds it

Showing the two different read paths — one optimistic (cart/catalog, AP), one strict (order, CP):

```typescript
// AP path: catalog read — serve from replica/cache, stale is OK
async function getProduct(id: string) {
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);          // possibly 60 s stale — fine

  // Falls back to a read replica, not the primary
  return db.readReplica.query("SELECT * FROM products WHERE id = $1", [id]);
}

// CP path: inventory check before order — must be accurate
async function reserveInventory(productId: string, qty: number) {
  // Runs on the primary with a serializable transaction to prevent oversell
  return db.primary.transaction("SERIALIZABLE", async (tx) => {
    const row = await tx.query(
      "SELECT stock FROM inventory WHERE product_id = $1 FOR UPDATE", // row lock
      [productId]
    );
    if (row.stock < qty) throw new Error("out_of_stock");
    await tx.query(
      "UPDATE inventory SET stock = stock - $1 WHERE product_id = $2",
      [qty, productId]
    );
  });
}
```

### The code that calls it

```typescript
// Checkout: CP enforcement at the call site
async function placeOrder(userId: string, productId: string, idempotencyKey: string) {
  // Step 1: reserve inventory (strong — rejects on contention)
  await reserveInventory(productId, 1);

  // Step 2: charge (idempotency key prevents double-charge on retry)
  await paymentProvider.charge(userId, idempotencyKey);

  // Step 3: record order (durable write to primary)
  return db.primary.query(
    "INSERT INTO orders (user_id, product_id, status) VALUES ($1, $2, 'confirmed')",
    [userId, productId]
  );
}
```

### Types & differences

| Model | Guarantee | Cost / note | ShopFast use |
|---|---|---|---|
| **Linearizable (strong)** | Reads see the latest committed write; single-copy illusion | Quorum/consensus every op; highest latency | `orders`, `inventory` |
| **Sequential consistency** | All nodes see ops in one total order, but not real-time | Slightly cheaper than linearizable | Rarely used directly |
| **Causal consistency** | Causally-related ops appear in order everywhere | Achievable with vector clocks, no global coord | Cart merges |
| **Read-your-writes** | You see your own writes | Sticky routing or version tokens; cheap | Post-checkout redirect |
| **Eventual consistency** | Replicas converge if writes stop | Cheapest; app must handle stale + conflicts | Catalog cache, cart |

**Linearizability vs Serializability** (always confused in interviews):
- **Serializability** — isolation property of *transactions*: result is equivalent to *some* serial execution.
- **Linearizability** — recency property of *single operations*: real-time, single-object guarantee.
- **Strict serializability** = both (Postgres `SERIALIZABLE` + single primary gives this; Spanner does it globally).

### Build it for real — ShopFast

ShopFast's canonical architecture states: *"catalog = availability-first (seconds-stale OK); checkout/order = strong consistency (no double-charge, no oversell)."*

**Decision — Cart (AP / eventual):** the cart lives in Redis (or equivalent). A user adding an item to the cart in a flaky-network scenario gets a fast, optimistic response; if two devices add items during a brief partition, we merge by union (no item lost). Stale by a few seconds is fine — the user is still browsing. We never refuse a cart operation because of replication lag.

**Decision — Order & Inventory (CP / strong):** `POST /v1/orders` reserves inventory and charges payment in a serializable Postgres transaction on the primary. During a partition that isolates the primary, we return 503 rather than serve a stale node that might oversell. The cost is a small availability dip, but the business cannot accept double-charges or negative inventory.

**REJECTED — eventual consistency for orders:** allowing a replica to accept order writes during a partition risks two users both buying the last item in stock (oversell) or the same payment being processed twice (double-charge). The T3 canonical NFR says *"no double-charge, no oversell"* — this is non-negotiable.

> **If you get this wrong:** applying eventual consistency to the `inventory` table means two simultaneous purchases of the last item both succeed. Both orders get confirmed. You ship one item and send the other customer an apology. At scale (Black Friday, flash sales) this is not a rare edge case — it is the *expected* scenario, and it destroys trust.

### Scaling story

- **Now (modular monolith, one Postgres primary + replicas):** cart in Redis (AP), orders/inventory exclusively on the Postgres primary (CP). No distributed coordination needed — a single primary is trivially linearizable. Cost: the read replicas absorb catalog load; the primary handles writes only.
- **Growth signal:** primary write QPS grows; p99 on order placement climbs above 300 ms; replication lag on replicas exceeds 1 s (stale catalog reads becoming noticeable).
- **At scale (services split):** cart extracted to its own service backed by a Dynamo-style store (AP, CRDT (Conflict-free Replicated Data Type) merge for concurrent additions); order service keeps a strongly-consistent store. Cross-service inventory reservation moves to a saga pattern (see [Messaging & Queues](../../04-messaging-queues/01-knowledge/README.md)) or a distributed lock via etcd/Consul (see [Consensus & Replication](../../05-consensus-replication/01-knowledge/README.md)). PACELC (Partition → A or C; Else → Latency or Consistency) now governs every cross-region decision.

---

## 1. Three different "consistencies" (don't conflate them)

- **ACID (Atomicity, Consistency, Isolation, Durability) "C" (Consistency):** the database moves from one valid state to another, preserving *application-defined invariants* (constraints, foreign keys, triggers). It's really about correctness rules, and is arguably the user's job as much as the DB's.
- **CAP (Consistency, Availability, Partition-tolerance) "C" (Consistency = Linearizability):** every read sees the most recent write; the system behaves as if there's a single copy of the data. A *strong, global* guarantee.
- **Consistency models (replication):** a spectrum from strong to eventual describing what reads may observe across replicas.

When someone says "consistency," ask "which one?"

---

## 2. ACID vs BASE

**ACID** (classic transactional databases):
- **Atomicity:** all-or-nothing — partial effects never persist.
- **Consistency:** invariants preserved (see above).
- **Isolation:** concurrent transactions don't interfere (per the chosen isolation level).
- **Durability:** once committed, survives crashes (WAL (Write-Ahead Log)/fsync).

**BASE** (many distributed/NoSQL stores, a deliberate counterpoint):
- **Basically Available:** the system stays available (returns *something*) under failure.
- **Soft state:** state may change over time without input, due to replication/convergence.
- **Eventual consistency:** if writes stop, all replicas eventually converge to the same value.

ACID prioritizes correctness/consistency; BASE prioritizes availability and scale, accepting weaker, eventual guarantees. They're endpoints of a tradeoff, not a strict binary — many modern systems offer tunable consistency.

---

## 3. CAP theorem

In the presence of a network **Partition (P)**, a distributed system must choose between **Consistency (C)** and **Availability (A)**.

- **CP:** on partition, refuse requests that can't be served consistently (return errors / become unavailable) to avoid returning stale or divergent data. E.g. a system requiring quorum; HBase; ZooKeeper; a strongly-consistent config store.
- **AP:** on partition, keep serving (possibly stale) data on both sides and reconcile later. E.g. Dynamo-style stores, Cassandra (tunable), DNS (Domain Name System).

**Crucial nuances seniors must state:**
- Partitions are **not optional** — networks drop packets. So you don't "pick 2 of 3"; you pick C or A *when a partition happens*. The "CA" corner is largely a non-option for systems spanning a network.
- **When there's no partition, you get both C and A** — CAP only forces the choice *during* a partition.
- CAP is coarse. **PACELC** refines it: *if* Partition, choose A or C; *Else* (normal operation) choose **L**atency or **C**onsistency. This captures the everyday truth that strong consistency costs latency even without partitions (cross-node coordination).

---

## 4. Consistency models (strong → weak)

From strongest to weakest, roughly:

| Model | Guarantee | Cost / note |
|---|---|---|
| **Linearizability (strong)** | Reads see the latest committed write; single-copy illusion; real-time order respected. | Needs coordination (quorum/consensus); highest latency; not partition-tolerant for availability. |
| **Sequential consistency** | All nodes see operations in *some* single total order consistent with each process's program order — but not necessarily real-time order. | Slightly weaker/cheaper than linearizable. |
| **Causal consistency** | Operations that are causally related are seen in order by everyone; concurrent ops may be seen in different orders. | Sweet spot for many apps; achievable without global coordination (e.g. with vector clocks). Preserves "reply appears after the message it answers." |
| **Read-your-writes / Monotonic reads / Monotonic writes (session guarantees)** | Per-client guarantees: you see your own writes; you never see time go backward; your writes apply in order. | Cheap, huge UX wins; often layered on eventual stores via sticky routing or version tokens. |
| **Eventual consistency** | If writes stop, replicas converge. No ordering or recency guarantees in the meantime. | Cheapest, most available; allows stale and out-of-order reads. |

**Linearizability vs Serializability** (commonly confused):
- **Serializability** is an *isolation* property about *transactions*: the result is equivalent to *some* serial order of transactions.
- **Linearizability** is a *recency* property about *single operations*: it's about a real-time, single-object guarantee.
- **Strict serializability** = serializability + linearizability (the gold standard, e.g. Spanner).

---

## 5. How eventual consistency converges (under the hood)

- **Replication:** writes propagate asynchronously to replicas (leader→follower, or peer gossip).
- **Conflict detection:** with concurrent writes, you need to detect divergence — **version vectors / vector clocks** track causality; identical-but-concurrent writes are flagged as conflicts.
- **Conflict resolution:**
  - **LWW (last-writer-wins):** pick by timestamp — simple but *loses data* and depends on clock sync.
  - **Application merge:** semantic merge (e.g. union shopping carts).
  - **CRDTs (Conflict-free Replicated Data Types):** data structures (counters, sets, sequences) that merge deterministically and commutatively, so replicas converge with no coordination — the backbone of many collaborative/offline systems.
- **Anti-entropy / read-repair:** background processes (Merkle-tree comparison, read-repair on access) heal divergence.
- **Quorum reads/writes (Dynamo-style):** with N replicas, choose read quorum R and write quorum W. If **R + W > N**, a read overlaps with the latest write → strong-ish consistency; tune R/W to trade latency vs consistency.

---

## 6. Tradeoffs

- **Strong consistency** → simpler app logic (no stale reads, no conflict handling) but higher latency, lower availability under partition, harder to scale geographically.
- **Eventual consistency** → high availability and scale, low latency, but the app must tolerate stale reads and *handle conflicts* — pushing complexity into application code.
- **Session guarantees** are a cheap middle ground that fixes most user-visible weirdness (seeing your own post, no time-travel) without global coordination.
- **Quorum tuning:** higher W → durable, consistent writes but slower/less-available writes; higher R → fresher reads but slower reads. R=W=1 is fast and eventually consistent; R+W>N gives overlap.

---

## 7. Common pitfalls & misconceptions

- **"CAP says pick 2 of 3."** Misleading — you only choose between C and A *during a partition*; P is not something you opt into.
- **"Eventual consistency means data is eventually correct/safe."** It means replicas converge to the same value, *not* that the value is the one you'd want — LWW (last-writer-wins) can silently drop writes.
- **Confusing linearizability (recency, single object) with serializability (transaction isolation).**
- **"NoSQL = eventually consistent, SQL = strong."** Many NoSQL stores offer tunable/strong consistency; distributed SQL exists; the model is a *config and design choice*, not a category.
- **Assuming clocks are synchronized.** LWW and many "happened-before" hacks rely on clock sync that doesn't hold; prefer logical clocks/version vectors.
- **Ignoring PACELC.** Teams pick "strong consistency" then are surprised by latency in the *normal* (no-partition) case.

---

## 8. What interviewers probe

- *"What does the C in CAP mean, and how is it different from the C in ACID?"*
- *"Your shopping cart is on an AP store. Two devices add items during a partition. What happens, and how do you resolve it?"* (Conflict resolution, CRDTs, merge semantics.)
- *"Difference between linearizability and serializability?"*
- *"Give me a system where you'd choose CP, and one where you'd choose AP, and why."* (Bank ledger = CP; shopping cart / social feed / DNS = AP.)
- *"What consistency does 'read-your-own-writes' need, and how would you implement it on an eventually-consistent store?"* (Sticky routing, version tokens, write-through cache.)
- *"R + W > N — what does it buy you and what does it cost?"*

---

## 9. Quick-reference summary

- **Three consistencies:** ACID (Atomicity, Consistency, Isolation, Durability) — C (invariants), CAP (Consistency, Availability, Partition-tolerance) — C (linearizability), replication models (strong→eventual). Don't conflate.
- **ACID** = correctness-first; **BASE** (Basically Available, Soft state, Eventual consistency) = availability-first.
- **CAP:** during a partition, choose **C** (CP, refuse) or **A** (AP, serve stale). No partition → you get both. **PACELC** adds the latency-vs-consistency tradeoff in normal operation.
- **Model spectrum:** linearizable > sequential > causal > session guarantees > eventual. Pick the weakest that meets the need.
- **Eventual consistency converges** via version vectors, read-repair/anti-entropy, and conflict resolution (LWW vs merge vs **CRDTs (Conflict-free Replicated Data Types)**).
- **Quorum:** R + W > N for overlap; tune R/W for the read/write/latency balance.
- **Linearizability** = single-object recency; **serializability** = transaction isolation; **strict serializability** = both.
