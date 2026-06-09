# Data Structures — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Arrays, hashmaps, lists, trees, heaps, graphs, tries.

## Core concept

A data structure is the **contract between your data's access pattern and the machine's memory hierarchy**. The same data stored two ways can differ by orders of magnitude in speed, memory, and tail latency. At a senior bar the interesting question is never "what is a hashmap" — it's **why** a structure wins for a workload, what it costs under contention/scale, and how it fails in production.

The core menu:

- **Array / dynamic array** — contiguous, O(1) index, amortized O(1) append, cache-friendly.
- **Hash table** — O(1) average lookup by key, unordered.
- **Linked list** — O(1) splice given a node, poor cache locality.
- **Stack / queue / deque** — LIFO / FIFO / double-ended, O(1) ends.
- **Tree (BST / balanced / B+-tree)** — ordered keys, O(log n), range scans.
- **Heap** — O(1) peek-min/max, O(log n) push/pop; priority queues.
- **Trie** — O(L) prefix lookup independent of N.
- **Graph (adjacency list/matrix)** — relationships + traversal.
- **Probabilistic (Bloom, HyperLogLog, skip list, LSM)** — trade exactness/memory for scale.

## How to use

Pick a structure by answering three questions, in order:

1. **What operation dominates?** lookup-by-key · lookup-by-position · range scan · min/max · ordered iteration · membership · prefix.
2. **What is the read/write ratio?** Mutation-heavy structures pay rebalancing/rehashing.
3. **What does the memory hierarchy reward?** Contiguous layout (arrays) is ~100× friendlier to CPU caches than pointer-chasing for the same N.

Default progression — reach for the simplest that fits, justify anything exotic: **array → hashmap → balanced tree / heap → (only then) trie / Bloom / skip-list / LSM.**

## When to use

| Need | Reach for |
|---|---|
| Lookup by key, order irrelevant | Hash table (watch rehash spikes, collisions) |
| Ordered keys / range scans | Balanced BST (in-memory) · B+-tree (on-disk) |
| Repeated min/max | Heap / priority queue |
| Prefix matching / autocomplete | Trie / radix trie |
| Positional access, write-light | Dynamic array |
| O(1) splice with stable node identity | Linked list (e.g. LRU) |
| Connectivity / grouping | Union-Find |
| Membership at scale, tolerate false positives | Bloom filter |
| Write-heavy persistent store | LSM tree (read-heavy → B+-tree) |

## Code example

```python
# 1. Hash table: O(1) average lookup, count word frequencies
from collections import defaultdict
freq = defaultdict(int)
for word in "the cat the dog the".split():
    freq[word] += 1          # {'the': 3, 'cat': 1, 'dog': 1}

# 2. Heap (priority queue): top-K largest from a stream in O(n log k), O(k) memory
import heapq
def top_k(stream, k):
    h = []                   # min-heap of size k
    for x in stream:
        if len(h) < k:
            heapq.heappush(h, x)
        elif x > h[0]:       # beats the current smallest kept
            heapq.heapreplace(h, x)
    return sorted(h, reverse=True)

# 3. Graph as adjacency list + BFS shortest path (unweighted)
from collections import deque
def bfs(graph, start, goal):
    q, seen = deque([(start, 0)]), {start}
    while q:
        node, dist = q.popleft()
        if node == goal:
            return dist
        for nbr in graph[node]:
            if nbr not in seen:
                seen.add(nbr)
                q.append((nbr, dist + 1))
    return -1
```

## Real-world example

**Why an LRU cache combines two structures.** A web service caches DB rows. It needs O(1) lookup *and* O(1) eviction of the least-recently-used entry. A hashmap alone has no recency order; a list alone has no fast lookup. Combine them:

```python
from collections import OrderedDict
class LRU:
    def __init__(self, cap): self.cap, self.d = cap, OrderedDict()
    def get(self, k):
        if k not in self.d: return None
        self.d.move_to_end(k)            # mark most-recently-used: O(1)
        return self.d[k]
    def put(self, k, v):
        self.d[k] = v; self.d.move_to_end(k)
        if len(self.d) > self.cap:
            self.d.popitem(last=False)   # evict least-recently-used: O(1)
```

Other production "why"s: **Bloom filters** let Cassandra skip a disk read when a key definitely isn't in an SSTable; **B+-trees** are the DB index because high fan-out minimizes disk seeks and linked leaves give range scans; **heaps** power Dijkstra and top-K dashboards.

## Effect / impact

Choosing the right structure is usually the single biggest constant-factor lever you control:

- **Latency:** O(1) hashmap vs O(n) list scan is the difference between a 1 ms and a 100 ms endpoint at scale.
- **Tail latency:** a hashmap rehash is a stop-the-world O(n) copy — fine for throughput, deadly for p99. Mitigation: incremental rehashing (Redis).
- **Memory & cost:** an adjacency matrix on a sparse graph wastes O(V²); the right structure can cut memory (and cloud bill) by orders of magnitude.
- **Scale ceiling:** write-heavy systems pick LSM trees over B+-trees specifically to avoid in-place write amplification.

## Complexity

| Structure | Access | Search | Insert | Delete | Ordered? | Notes |
|---|---|---|---|---|---|---|
| Dynamic array | O(1) | O(n) | O(1)* append / O(n) mid | O(n) | by index | *amortized; great locality |
| Hash table | — | O(1) avg | O(1) avg | O(1) avg | no | O(n) worst; rehash spikes |
| Linked list | O(n) | O(n) | O(1)† | O(1)† | insertion | †with node ref |
| BST (balanced) | O(log n) | O(log n) | O(log n) | O(log n) | yes | RB / AVL |
| Binary heap | O(1) peek | O(n) | O(log n) | O(log n) | partial | priority queue |
| Trie | — | O(L) | O(L) | O(L) | prefix | L = key length |
| B+-tree | O(log n) | O(log n) | O(log n) | O(log n) | yes | disk / range scans |
| Union-Find | — | ~O(1) | ~O(1) | — | no | α(n) amortized |

## Pitfalls

- **"Hashmap is always O(1)."** Average, not worst case; rehash is an O(n) latency spike; hash-flooding is a real DoS (mitigate with randomized seed / SipHash, tree-ified buckets).
- **"Big-O is the whole story."** For N ≤ a few thousand, a contiguous array scan often beats a "faster" pointer-chasing structure (cache locality, branch prediction).
- **Unbalanced BST** — inserting sorted data into a naive BST degrades to O(n); use a balanced variant.
- **Matrix for a sparse graph** wastes O(V²) memory.
- **Mutating a hashmap key after insertion** corrupts the table — the hash no longer matches the bucket.
- **Sub-slice keeps the backing array alive** (Go slices, Java `subList`) → memory leak; copy to release the parent.
- **Over-reaching for exotic structures** — justify Bloom/skip-list/LSM only when the workload demands it.
