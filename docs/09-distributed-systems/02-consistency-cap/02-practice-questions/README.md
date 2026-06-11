# Consistency & CAP — Practice Questions

[← Topic overview](../README.md)

> Topic: ACID/BASE, CAP, consistency models, eventual consistency.

Recall, "explain to a junior," and MCQs with an answer key.

---

### Q1. State the CAP theorem precisely, and name the most common misconception.

**Answer:** CAP says that when a network **partition** occurs, a distributed system must choose between **consistency** (linearizability — every read sees the latest write) and **availability** (every request gets a non-error response). The common misconception is "pick 2 of 3." You don't *choose* partition tolerance — networks partition whether you like it or not — so in practice you choose **C or A only when a partition happens**. When there's no partition, you can have both. PACELC extends this: even without partitions (Else), you trade Latency vs Consistency.

---

### Q2. Explain the three different meanings of "consistency" to a junior.

**Answer:** The word is overloaded:
1. **ACID consistency** — the database keeps your *invariants* valid (constraints, foreign keys). A transaction never leaves the data in a state that violates the rules.
2. **CAP consistency** — *linearizability*: it behaves like there's one single copy of the data, so any read returns the latest write. A strong, system-wide guarantee.
3. **Replication consistency models** — a *spectrum* (strong → causal → eventual) describing what reads across replicas are allowed to see.

So before arguing about "is this consistent," pin down which of the three you mean.

---

### Q3. What is eventual consistency, and what does it *not* promise?

**Answer:** Eventual consistency promises that *if writes stop, all replicas eventually converge to the same value*. It does **not** promise: (a) that reads are fresh — you may read stale data; (b) that you'll see writes in order; or (c) that the converged value is the "right" one — with last-writer-wins, concurrent writes can be silently dropped. It's a liveness guarantee about convergence, not a guarantee about recency or about preserving every update.

---

### Q4. Difference between linearizability and serializability?

**Answer:** They're orthogonal:
- **Linearizability** is a *recency / real-time* guarantee about *single operations* on a *single object*: once a write completes, every later read sees it, as if there were one copy.
- **Serializability** is an *isolation* guarantee about *transactions* (multiple operations): the outcome is equivalent to *some* serial execution of those transactions — but it says nothing about real-time ordering.

A system can be serializable but not linearizable (the serial order may not match real time), or linearizable but only single-object. **Strict serializability** combines both and is what systems like Spanner aim for.

---

### Q5. Give a concrete CP system and a concrete AP system, with justification.

**Answer:**
- **CP (choose consistency, sacrifice availability under partition):** a **bank ledger / account-balance service**. You must never show or act on a stale balance or allow conflicting double-spends, so during a partition the minority side should refuse writes (or reads) rather than risk divergence. ZooKeeper and quorum-based config stores are CP for similar reasons.
- **AP (choose availability, tolerate staleness):** a **shopping cart**, a **social feed**, or **DNS**. Showing a slightly stale cart/feed is fine; being *unavailable* loses users and money. Conflicts (e.g. items added on two devices) are merged later.

---

### Q6. How do you implement read-your-own-writes on an eventually-consistent store?

**Answer:** A few standard techniques:
- **Sticky routing:** pin a user's reads to the same replica/leader that took their write so they always see it.
- **Version tokens:** after a write, return a version/timestamp; the client passes it on reads, and the system waits for (or routes to) a replica at least that fresh.
- **Write-through cache / read-from-leader for recent writes:** serve a user's just-written data from the primary or a local cache for a short window.

These give per-session guarantees (read-your-writes, monotonic reads) without paying for full global linearizability.

---

### Q7. What are CRDTs and why are they useful for AP systems?

**Answer:** CRDTs (Conflict-free Replicated Data Types) are data structures — counters, sets, registers, sequences — designed so that concurrent updates on different replicas **merge deterministically and commutatively**. Because merge is associative/commutative/idempotent, replicas that exchange updates in any order converge to the same value with **no coordination and no manual conflict resolution**. This makes them ideal for AP/offline/collaborative systems (collaborative editors, distributed counters, shopping carts) where you want high availability *and* automatic convergence instead of last-writer-wins data loss.

---

### Q8 (MCQ). In a Dynamo-style quorum system with N=3 replicas, which (R, W) gives you read-your-writes-style overlap (a read intersects the latest write)?

A. R=1, W=1
B. R=2, W=2
C. R=1, W=2
D. R=3, W=0

**Answer: B.** You need **R + W > N**. With N=3, R=2 + W=2 = 4 > 3, guaranteeing the read quorum overlaps the write quorum by at least one node holding the latest value. (A) 1+1=2 ≤ 3 (no guaranteed overlap). (C) 1+2=3, not > 3. (D) W=0 isn't a valid durable write. Note B costs more latency/availability than A.

---

### Q9 (MCQ). Which statement about CAP during *normal operation* (no partition) is correct?

A. You must still choose C or A
B. You can have both C and A; CAP only forces a choice during a partition
C. You automatically get eventual consistency only
D. Availability is impossible with strong consistency, ever

**Answer: B.** CAP's forced tradeoff applies *only while a partition exists*. With no partition you can be both consistent and available. (PACELC notes you still trade latency vs consistency, but that's L vs C, not A vs C.)

---

### Q10 (MCQ). "Last-writer-wins" conflict resolution's biggest hidden danger is:

A. It's too slow
B. It can silently discard concurrent writes, causing data loss, and relies on clock synchronization
C. It requires consensus on every write
D. It only works with CRDTs

**Answer: B.** LWW picks one write by timestamp and throws the other away — concurrent updates are silently lost. Worse, it depends on synchronized wall clocks, which drift; a node with a fast clock can clobber legitimate later writes. Prefer semantic merge or CRDTs when data loss is unacceptable.

---

### Q11. Explain PACELC and why it's more useful than CAP in day-to-day design.

**Answer:** PACELC says: **if** there's a **P**artition, trade **A**vailability vs **C**onsistency (the CAP choice); **E**lse (normal operation), trade **L**atency vs **C**onsistency. It's more useful because partitions are rare, but the latency-vs-consistency tradeoff is *constant*: strong consistency requires cross-node coordination (quorums/consensus) on every operation, which costs latency *even when nothing is broken*. PACELC forces you to acknowledge that "we want strong consistency" has an everyday latency price, not just a partition-time availability price. Example: Spanner is PC/EC (consistent in both cases, paying latency); Dynamo is PA/EL (available and low-latency, eventually consistent).
