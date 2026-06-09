# Data Structures — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Arrays, hashmaps, lists, trees, heaps, graphs, tries.

Data structures are the contract between your data's access patterns and the machine's memory hierarchy. At a senior bar, the interesting part is not "what is a hashmap" but **why** a given structure wins for a given workload, what it costs under contention or at scale, and the failure modes that bite in production.

---

## 1. Core mental model: access pattern drives the choice

Pick a structure by answering three questions:

1. **What operations dominate?** (lookup by key, lookup by position, range scan, min/max, ordered iteration, membership.)
2. **What is the read/write ratio?** Mutation-heavy structures pay rebalancing/rehashing costs.
3. **What does the memory hierarchy reward?** Contiguous layout (arrays) is ~100x friendlier to CPU caches than pointer-chasing (linked lists, trees) for the same N.

The asymptotic table below is necessary but **not sufficient** — constant factors and cache locality routinely flip the winner for small/medium N.

---

## 2. Arrays & dynamic arrays

- **Contiguous memory**, O(1) indexed access via `base + i*stride`. Excellent cache locality.
- **Dynamic array** (Go slice, Java `ArrayList`, C++ `vector`, Python `list`): amortized O(1) append via **geometric growth** (typically 1.5x–2x). Append is amortized O(1); worst-case single append is O(n) on the resize copy.
- **Amortized analysis**: doubling means total copy work across n appends is `n + n/2 + n/4 + ... < 2n`, so O(1) per op averaged.
- Insert/delete in the **middle** is O(n) (shift). Random delete is the array's weakness.
- **Growth factor tradeoff**: 2x wastes up to 50% memory but fewer resizes; 1.5x is more memory-friendly and can reuse freed blocks. Java uses 1.5x, Python ~1.125x for large lists, Go 2x→1.25x for large slices.

**Pitfall:** holding a sub-slice keeps the whole backing array alive (Go slices, Java `subList`) → memory leak. Copy if you need to release the parent.

---

## 3. Hash tables (hashmaps / dicts / sets)

The workhorse. O(1) **average** insert/lookup/delete; **O(n) worst case** under adversarial or pathological hashing.

**Under the hood:**
- **Hash function** maps key → bucket index. Quality matters: poor distribution → clustering → degraded ops.
- **Collision resolution:**
  - *Separate chaining* — bucket holds a list (or tree). Java 8+ converts a bucket to a red-black tree when it exceeds 8 entries, capping worst case at O(log n) per bucket.
  - *Open addressing* (linear/quadratic probing, Robin Hood, cuckoo) — store entries in the array itself; better cache locality, sensitive to load factor.
- **Load factor** (entries / buckets): rehash when it crosses a threshold (Java 0.75, Python ~0.66). Rehash is O(n) — a **latency spike**, not steady cost.
- **Ordering:** classic hashmaps are unordered. Python 3.7+ `dict` preserves *insertion* order (impl detail turned spec). Need sorted order → use a tree map.

**What interviewers probe:**
- Can hashmap lookup be O(n)? Yes — collisions from bad hash or hash-flooding (CVE-class DoS). Mitigation: randomized seed (SipHash), tree-ified buckets.
- Why is rehash a problem at scale? Stop-the-world O(n) copy → tail latency. Mitigation: incremental rehashing (Redis does this).
- Mutable keys: mutating a key after insertion corrupts the table — the hash no longer matches the bucket.

---

## 4. Linked lists

- **Singly/doubly linked**: O(1) insert/delete *given a node reference*; O(n) to find that node.
- Poor cache locality (pointer chasing) — usually loses to arrays in practice unless you need O(1) splice or a stable node identity.
- **Real uses:** LRU cache (doubly linked list + hashmap), adjacency lists, intrusive lists in kernels, free lists in allocators.
- **Classic interview tricks:** Floyd's cycle detection (tortoise & hare), reverse in place, find middle with two pointers.

---

## 5. Stacks & queues

- **Stack** (LIFO): push/pop O(1). Backs recursion, DFS, expression eval, undo.
- **Queue** (FIFO): enqueue/dequeue O(1). Backs BFS, task scheduling, buffering. Implement with a **ring buffer** (circular array) for cache-friendly bounded queues, or two stacks.
- **Deque**: double-ended; backs sliding-window algorithms (monotonic deque for sliding max).

---

## 6. Trees

### Binary Search Tree (BST)
- Ordered: in-order traversal yields sorted output. Search/insert/delete O(h); **h = log n only if balanced**, else O(n) (a sorted-insert BST degenerates into a linked list).

### Self-balancing trees
- **Red-black tree**: guarantees O(log n) via color invariants; fewer rotations on insert/delete → favored for mutation-heavy maps (Java `TreeMap`, C++ `std::map`, Linux CFS scheduler).
- **AVL**: stricter balance → faster lookups, more rotations on write. Good for read-heavy.
- **B-tree / B+-tree**: high fan-out, shallow; nodes sized to a disk/page block. **The** database & filesystem index structure — minimizes disk seeks. B+-tree keeps all values in leaves linked for range scans.

### Heaps
- **Binary heap**: complete binary tree in an array. `parent(i) = (i-1)/2`. O(1) peek-min/max, O(log n) push/pop, O(n) build-heap (Floyd's bottom-up). Backs **priority queues**, Dijkstra, top-K, event simulation, timer wheels.
- **d-ary heap / Fibonacci heap**: tradeoffs on decrease-key (Fibonacci gives amortized O(1) decrease-key, relevant for theoretical Dijkstra bounds; rarely used in practice due to constants).

### Tries (prefix trees)
- Key = path of characters. Lookup/insert O(L) in key length L, *independent of N*. Backs autocomplete, IP routing (radix/Patricia trie), spell-check.
- Space-heavy; **radix/compressed tries** collapse single-child chains.

---

## 7. Graphs

- **Representations:** adjacency list (O(V+E) space, good for sparse), adjacency matrix (O(V²), good for dense / O(1) edge check). Most real graphs are sparse → adjacency list.
- **Traversal:** BFS (queue, shortest path in unweighted, level order), DFS (stack/recursion, cycle detection, topo sort, SCC).
- **Weighted shortest path:** Dijkstra (non-negative weights, heap), Bellman-Ford (handles negative edges, detects negative cycles), A* (heuristic-guided).
- **Union-Find (disjoint set):** near-O(1) amortized (inverse Ackermann) with path compression + union by rank. Backs Kruskal's MST, connectivity, dynamic clustering.

---

## 8. Probabilistic / specialized structures (senior signal)

- **Bloom filter:** space-efficient set membership; no false negatives, tunable false positives. "Definitely not present / maybe present." Used to avoid disk lookups (Cassandra, BigTable).
- **Skip list:** probabilistic balanced "tree"; O(log n) expected; simpler to make lock-free than trees. Used in Redis sorted sets, LevelDB memtable.
- **LSM tree:** write-optimized; buffers writes in memory, flushes sorted runs, compacts. Backs Cassandra, RocksDB, modern write-heavy stores. Contrast with B-tree (read-optimized, in-place update).
- **HyperLogLog:** cardinality estimation in fixed tiny memory.
- **Fenwick tree / segment tree:** range queries/updates in O(log n).

---

## 9. Complexity cheat-sheet

| Structure | Access | Search | Insert | Delete | Ordered? | Notes |
|---|---|---|---|---|---|---|
| Dynamic array | O(1) | O(n) | O(1)* append / O(n) mid | O(n) | by index | *amortized; great locality |
| Hash table | — | O(1) avg | O(1) avg | O(1) avg | no | O(n) worst; rehash spikes |
| Linked list | O(n) | O(n) | O(1)† | O(1)† | insertion | †with node ref |
| BST (balanced) | O(log n) | O(log n) | O(log n) | O(log n) | yes | RB/AVL |
| Binary heap | O(1) peek | O(n) | O(log n) | O(log n) | partial | priority queue |
| Trie | — | O(L) | O(L) | O(L) | prefix | L = key length |
| B+-tree | O(log n) | O(log n) | O(log n) | O(log n) | yes | disk/range scans |
| Union-Find | — | ~O(1) | ~O(1) | — | no | α(n) amortized |

---

## 10. Common pitfalls & misconceptions

- **"Hashmap is always O(1)."** Average, not worst case; rehash is an O(n) latency spike; hash-flooding is a real DoS.
- **"Big-O is the whole story."** For N ≤ a few thousand, a contiguous array linear scan often beats a "faster" pointer-chasing structure due to cache locality and branch prediction.
- **Unbalanced BST.** Inserting sorted data into a naive BST gives O(n). Use a balanced variant or sort + binary search.
- **Choosing a matrix for a sparse graph** wastes O(V²) memory.
- **Mutating hashmap keys** or storing mutable keys breaks the table.
- **Over-reaching for exotic structures.** Reach for array → hashmap → balanced tree/heap first; justify Bloom/skip-list/LSM only when the workload demands it.

---

## Quick-reference summary

- **Need lookup by key, order irrelevant:** hashmap. Watch rehash latency & collisions.
- **Need ordered keys / range scans:** balanced BST (in-memory) or B+-tree (on-disk).
- **Need min/max repeatedly:** heap / priority queue.
- **Need prefix matching:** trie / radix trie.
- **Need positional access & iteration, write-light:** dynamic array.
- **Need O(1) splice with stable node identity:** linked list (e.g., LRU).
- **Need connectivity / grouping:** union-find.
- **Need membership at scale, can tolerate false positives:** Bloom filter.
- **Write-heavy persistent store:** LSM tree; **read-heavy persistent store:** B+-tree.
- Always sanity-check asymptotics against **constant factors and cache behavior** for your real N.
