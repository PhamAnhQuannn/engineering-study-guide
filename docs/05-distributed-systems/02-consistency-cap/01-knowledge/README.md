# Consistency & CAP — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: ACID/BASE, CAP, consistency models, eventual consistency.

"Consistency" is one of the most overloaded words in our field — it means different things in ACID, in CAP, and in the consistency-model literature. A senior engineer keeps these straight and reasons about *which* guarantee a workload actually needs.

---

## 1. Three different "consistencies" (don't conflate them)

- **ACID "C" (Consistency):** the database moves from one valid state to another, preserving *application-defined invariants* (constraints, foreign keys, triggers). It's really about correctness rules, and is arguably the user's job as much as the DB's.
- **CAP "C" (Consistency = Linearizability):** every read sees the most recent write; the system behaves as if there's a single copy of the data. A *strong, global* guarantee.
- **Consistency models (replication):** a spectrum from strong to eventual describing what reads may observe across replicas.

When someone says "consistency," ask "which one?"

---

## 2. ACID vs BASE

**ACID** (classic transactional databases):
- **Atomicity:** all-or-nothing — partial effects never persist.
- **Consistency:** invariants preserved (see above).
- **Isolation:** concurrent transactions don't interfere (per the chosen isolation level).
- **Durability:** once committed, survives crashes (WAL/fsync).

**BASE** (many distributed/NoSQL stores, a deliberate counterpoint):
- **Basically Available:** the system stays available (returns *something*) under failure.
- **Soft state:** state may change over time without input, due to replication/convergence.
- **Eventual consistency:** if writes stop, all replicas eventually converge to the same value.

ACID prioritizes correctness/consistency; BASE prioritizes availability and scale, accepting weaker, eventual guarantees. They're endpoints of a tradeoff, not a strict binary — many modern systems offer tunable consistency.

---

## 3. CAP theorem

In the presence of a network **Partition (P)**, a distributed system must choose between **Consistency (C)** and **Availability (A)**.

- **CP:** on partition, refuse requests that can't be served consistently (return errors / become unavailable) to avoid returning stale or divergent data. E.g. a system requiring quorum; HBase; ZooKeeper; a strongly-consistent config store.
- **AP:** on partition, keep serving (possibly stale) data on both sides and reconcile later. E.g. Dynamo-style stores, Cassandra (tunable), DNS.

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
- **"Eventual consistency means data is eventually correct/safe."** It means replicas converge to the same value, *not* that the value is the one you'd want — LWW can silently drop writes.
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

- **Three consistencies:** ACID-C (invariants), CAP-C (linearizability), replication models (strong→eventual). Don't conflate.
- **ACID** = correctness-first; **BASE** = availability-first (basically available, soft state, eventual).
- **CAP:** during a partition, choose **C** (CP, refuse) or **A** (AP, serve stale). No partition → you get both. **PACELC** adds the latency-vs-consistency tradeoff in normal operation.
- **Model spectrum:** linearizable > sequential > causal > session guarantees > eventual. Pick the weakest that meets the need.
- **Eventual consistency converges** via version vectors, read-repair/anti-entropy, and conflict resolution (LWW vs merge vs **CRDTs**).
- **Quorum:** R + W > N for overlap; tune R/W for the read/write/latency balance.
- **Linearizability** = single-object recency; **serializability** = transaction isolation; **strict serializability** = both.
