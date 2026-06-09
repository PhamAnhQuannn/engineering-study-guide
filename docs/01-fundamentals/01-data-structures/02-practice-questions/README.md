# Data Structures — Practice Questions

[← Topic overview](../README.md)

> Topic: Arrays, hashmaps, lists, trees, heaps, graphs, tries.

A mix of factual recall, "explain to a junior," and multiple-choice. Try to answer before expanding the model answer.

---

### Q1. Why is a dynamic array append "amortized O(1)" and not "O(1) worst case"?

**Answer:** Most appends just write into pre-allocated slack and cost O(1). Occasionally the backing array is full and must be reallocated and **all n elements copied** — that single append is O(n). Because growth is **geometric** (e.g., doubling), the total copy work across n appends is `n + n/2 + n/4 + ... < 2n`, so the cost *averaged* over all operations is O(1). The qualifier "amortized" signals that an individual op can spike to O(n), which matters for tail latency even though throughput is O(1) per op.

---

### Q2. Explain to a junior: when would you reach for a hashmap vs a balanced tree (TreeMap)?

**Answer:** Use a **hashmap** when you only need to look things up by an exact key and you don't care about order — it gives you average O(1) get/put. Use a **balanced tree map** (red-black/AVL) when you need keys kept **in sorted order**: range queries ("all keys between A and B"), "next key ≥ X" (floor/ceiling), or ordered iteration. The tree costs O(log n) per op — slower — but it gives ordering and a predictable worst case, whereas a hashmap can spike on rehash and gives no order.

---

### Q3. A colleague says "linked lists are faster than arrays for inserts." When is that misleading?

**Answer:** It's only true for insert/delete **given a reference to the node** (O(1) splice). To *find* the insertion point you pay O(n) traversal, and pointer-chasing thrashes the CPU cache. For inserting at a known index in a contiguous array you pay O(n) to shift — but in practice, for small/medium N, the array's cache locality often makes it faster overall. Linked lists win when you already hold the node (e.g., LRU eviction) or need O(1) splice without invalidating other references.

---

### Q4. What makes a binary heap a good fit for a priority queue, and what can't it do well?

**Answer:** A binary heap gives O(1) peek-min/max and O(log n) push/pop with a simple array layout (great locality) and O(n) build. Perfect for "repeatedly get the smallest/largest." It **cannot** efficiently search for an arbitrary element (O(n)), give sorted iteration without destroying the heap, or do efficient ordered range queries. For arbitrary-key priority updates (decrease-key) you need an index map or a different structure.

---

### Q5. Why do databases use B+-trees for indexes instead of red-black trees?

**Answer:** Red-black trees are binary (fan-out 2) → tree height ~log₂(n), meaning many pointer hops. On disk each hop can be a random seek (~milliseconds). B+-trees have **high fan-out** (hundreds of keys per node, each node = one disk page), so height is ~log₁₀₀(n) — far shallower → far fewer disk I/Os. B+-trees also link leaf nodes, giving efficient **range scans**, which SQL queries (`BETWEEN`, `ORDER BY`, range filters) rely on heavily.

---

### Q6. What is a Bloom filter and what's the one guarantee it makes?

**Answer:** A space-efficient probabilistic set. It guarantees **no false negatives**: if it says "not present," the element is definitely absent. It may produce **false positives**: "maybe present" can be wrong. Used as a cheap pre-check to avoid expensive lookups (e.g., skip a disk read if the Bloom filter says the key isn't in this SSTable). You tune false-positive rate via the number of hash functions and bit-array size; you cannot delete from a standard Bloom filter (use a counting Bloom filter).

---

### Q7. Explain to a junior why a hashmap lookup can degrade to O(n).

**Answer:** A hashmap puts keys into buckets by their hash. If many keys hash to the **same bucket** (collisions) — because of a weak hash function, a bad key distribution, or a deliberate **hash-flooding attack** — that bucket becomes a long list you must scan linearly. Then a lookup is O(n) in the worst case. Defenses: a good/randomized hash (SipHash), keeping the load factor low, and tree-ifying overloaded buckets (Java turns a long chain into a red-black tree, capping it at O(log n)).

---

### Q8 (MCQ). Which operation is **NOT** O(1) amortized on a typical dynamic array?

A. Append to end
B. Read element by index
C. Insert at the beginning
D. Overwrite element at index

**Answer: C.** Inserting at the front requires shifting all n elements right → O(n). A, B, D are O(1) (append amortized).

---

### Q9 (MCQ). You need "the 1,000 highest-scoring items out of a 50M-item stream" using bounded memory. Best structure?

A. Sort the whole stream
B. A min-heap of size 1,000
C. A hashmap keyed by score
D. A balanced BST of all items

**Answer: B.** Maintain a **min-heap of size k=1000**; for each item, if it beats the heap's min, pop and push. O(n log k) time, O(k) space — no need to store all 50M. Sorting (A) is O(n log n) and O(n) memory; C/D don't bound memory.

---

### Q10 (MCQ). Which structure best supports autocomplete (all words with a given prefix)?

A. Hashmap of word → frequency
B. Trie (prefix tree)
C. Binary heap
D. Array of sorted words

**Answer: B.** A trie walks the prefix in O(L) and enumerates the subtree of completions. A sorted array (D) also works via binary search to the prefix range and is sometimes used, but the trie is the canonical prefix structure; a hashmap (A) can't do prefix queries.

---

### Q11 (MCQ). Adjacency matrix vs adjacency list — when is the matrix the better choice?

A. Sparse graph, memory-constrained
B. Dense graph or when you need O(1) "is there an edge u–v?" checks
C. When you only do BFS
D. Never

**Answer: B.** A matrix costs O(V²) memory regardless of edge count, so it only pays off when the graph is **dense** (E ≈ V²) or you need constant-time edge-existence lookups. For sparse graphs (most real ones), an adjacency list at O(V+E) is far better.

---

### Q12. How does an LRU cache combine two data structures, and why both?

**Answer:** A **hashmap** (key → node) gives O(1) lookup of a cache entry; a **doubly linked list** maintains recency order, with most-recently-used at the head. On access you splice the node to the head in O(1) (possible because the hashmap gave you the node reference). On eviction you remove the tail in O(1). Neither alone suffices: the hashmap has no order; the list has no fast lookup. Together: O(1) get, put, and evict.

---

### Q13. What's the difference between `O(n)` build-heap and `O(n log n)` "insert n items one at a time"?

**Answer:** Inserting n items individually is n × O(log n) = O(n log n). **Floyd's build-heap** (heapify the array bottom-up via sift-down) is **O(n)** — the tighter bound comes from most nodes being near the bottom with short sift distances; summing the work over all levels converges to a linear total. So if you have all items up front, build-heap; if items arrive incrementally, you pay per-insert.
