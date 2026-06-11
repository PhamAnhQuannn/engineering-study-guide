# Data Structures — Knowledge / Study Notes

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we got our [Complexity Analysis](../../01-complexity/01-knowledge/README.md) measuring tape — Big-O tells us how cost grows. Now we meet the containers that hold ShopFast's data: arrays for the product catalog, hashmaps for the cart, trees for sorted indexes. **Next:** [Algorithms](../../03-algorithms/01-knowledge/README.md) — the recipes that act on these data structures.

---

## Teaching arc: the building blocks of ShopFast

### What it is

A **data structure** is a container that organises data so a specific set of operations is fast. Think of it like kitchen storage: a spice rack (array — everything in fixed slots, grab by position instantly) versus a filing cabinet (tree — sorted drawers, fast to range-search) versus a dictionary index in the back of a book (hash table — go straight to the page for a word). You pick the container based on which operations you need to be fast.

The two core axes are:
- **How you access data:** by position/index, by key, by priority, by prefix.
- **How you mutate data:** append, insert-in-middle, splice-at-known-node, min/max-extract.

Every ShopFast feature maps to at least one of these: sessions need O(1) key lookup (hash table), product search needs prefix matching (trie), the order queue needs FIFO (First In, First Out) processing, and the catalog database uses sorted trees for range queries.

### What it looks like

```
ARRAY        [A][B][C][D][E]        index by position — O(1) access
              0  1  2  3  4

HASH TABLE   key ──hash──> bucket   key→value — O(1) avg lookup
             "u123" ──────> {name:"Quan"}

LINKED LIST  [A]→[B]→[C]→[D]       pointer chain — O(1) splice at node
              ↑ head          ↑ tail

STACK        [  ] [  ] [D]   ← push/pop (LIFO — Last In, First Out)
QUEUE        →[A][B][C]→     ← enqueue right, dequeue left (FIFO)

BINARY HEAP      [1]          min always at root — O(log n) push/pop
                / \
              [3] [5]
             / \
           [8] [7]

BALANCED BST     [E]          sorted — O(log n) search/insert/range
                /   \
             [C]     [G]
            /   \   /   \
          [B] [D][F]   [H]
```

### Implement it from scratch

Below are minimal, commented implementations of the three structures that appear most often in both interviews and ShopFast internals.

**Hash table (open-addressing sketch)**

```python
class SimpleHashMap:
    def __init__(self, size=16):
        self._buckets = [None] * size       # fixed-size bucket array

    def _slot(self, key):
        return hash(key) % len(self._buckets)  # map key → bucket index

    def put(self, key, value):
        i = self._slot(key)
        self._buckets[i] = (key, value)     # simplified: no collision chaining

    def get(self, key):
        i = self._slot(key)
        pair = self._buckets[i]
        return pair[1] if pair and pair[0] == key else None  # O(1) avg
```

**LRU (Least Recently Used) cache — the pattern ShopFast uses for hot products**

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.cache = OrderedDict()          # dict + insertion order (doubly linked list inside)

    def get(self, key):
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)         # mark as recently used
        return self.cache[key]

    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.cap:
            self.cache.popitem(last=False)  # evict least recently used (head)
```

**Min-heap (priority queue)**

```python
import heapq

class TaskQueue:
    def __init__(self):
        self._heap = []

    def push(self, priority, task):
        heapq.heappush(self._heap, (priority, task))  # O(log n)

    def pop(self):
        return heapq.heappop(self._heap)[1]            # O(log n) — always lowest priority first

    def peek(self):
        return self._heap[0][1] if self._heap else None  # O(1)
```

### Where it lives in real systems

| ShopFast component | Data structure used | Why |
|---|---|---|
| **Session store (Redis)** | Hash table | `GET session:{token}` in O(1) on every request — any slower and latency multiplies across all endpoints |
| **Hot product cache (Redis)** | Hash table + LRU eviction | `product:{id}` → TTL ~60 s with jitter; LRU ensures the fixed Redis memory holds the hottest items, not old ones |
| **Product database indexes (Postgres)** | B+-tree | `WHERE price BETWEEN 10 AND 50 ORDER BY price` — B+-tree's sorted leaves make range scans a straight pointer walk, not a full scan |
| **Order-processing workers** | Queue (FIFO) | Orders placed during a traffic spike are buffered; workers drain them in arrival order — no order skipped, no double-processing |
| **Autocomplete / product search** | Trie (prefix tree) | "Wire" → "Wireless…" suggestions in O(L) (key length) regardless of catalog size |
| **Cache miss guard (Cassandra pattern)** | Bloom filter | Before a disk read, check a Bloom filter — if "definitely not present" skip the I/O entirely; saves the majority of disk seeks |

### Types & differences

| Structure | Search | Insert | Delete | Ordered? | Reach for it when… |
|---|---|---|---|---|---|
| **Dynamic array** | O(n) | O(1)* / O(n) mid | O(n) | by index | positional access, write-light tail, scan everything |
| **Hash table** | O(1) avg | O(1) avg | O(1) avg | no | lookup by key, dedup, frequency count |
| **Linked list** | O(n) | O(1)† | O(1)† | insertion | O(1) splice with a held node reference (e.g. LRU eviction list) |
| **Stack** | O(n) | O(1) | O(1) | LIFO | DFS, undo/redo, call-frame tracking |
| **Queue** | O(n) | O(1) | O(1) | FIFO | BFS, job buffers, order-of-arrival processing |
| **Binary heap** | O(n) | O(log n) | O(log n) | partial (min/max) | repeated min/max extraction (priority queue, top-K) |
| **Balanced BST** | O(log n) | O(log n) | O(log n) | yes | sorted keys + range queries in memory |
| **B+-tree** | O(log n) | O(log n) | O(log n) | yes | sorted keys on disk — all values in leaves, cheap range scan |
| **Trie** | O(L) | O(L) | O(L) | prefix | prefix/autocomplete queries |
| **Bloom filter** | probabilistic | O(k) | no delete | no | membership at huge scale with tiny memory, tolerate false positives |

\*amortized; †with a node reference already held

### Gotchas

- **"HashMap is always O(1)"** — that's the *average* case. Worst case is O(n) under heavy hash collisions, and a **rehash** is a sudden O(n) spike — a real p99 (99th-percentile latency) problem for a hot cache.
- **Big-O is not the only story** — for small n (hundreds to low thousands), a cache-friendly contiguous array routinely beats a "faster" pointer-chasing tree. The CPU L1/L2 cache line is 64 bytes; scattered pointers cause cache misses that cost ~100 ns each.
- **Inserting already-sorted data into a naive BST (Binary Search Tree)** degrades to O(n) depth — it becomes a linked list. Always use a self-balancing variant (red-black, AVL) or a library `SortedDict`.
- **`list.pop(0)` and `list.insert(0, …)` are O(n)** — they shift every element. Use `collections.deque` for a queue.
- **Adjacency matrix on a sparse graph** wastes O(V²) memory — use an adjacency list instead.
- **LRU cache thread-safety** — Python's `OrderedDict` is not thread-safe for concurrent `get`/`put`; add a lock or use a thread-safe variant in a multi-threaded server.

---

## Key concepts (reference)

### Dynamic array (list / vector)
**What it is** — values in one contiguous block; index in O(1). Grows by doubling, so append is "amortized O(1)" (occasionally it copies everything, but rarely).
**Example**
```python
a = []
a.append(3)     # amortized O(1)
x = a[0]        # O(1) random access
a.insert(0, 9)  # O(n) — shifts everything right
```
**Real situation** — the default list behind almost everything: a request batch, a row buffer, an event log you scan.
**Why it matters** — contiguous memory is ~100× friendlier to the CPU cache than pointer-chasing, so for small/medium n an array beats "fancier" structures. Weakness: insert/delete in the middle is O(n).

### Hash table (dict / map / set)
**What it is** — a hash function maps a key to a bucket, giving **O(1) average** lookup/insert/delete. Unordered.
**Example**
```python
users = {}
users["u123"] = {"name": "Quan"}
users["u123"]            # O(1) average lookup
```
**Real situation** — a session store: look up the user by id on every request; a de-dup set; counting frequencies.
**Why it matters** — turns an O(n) scan into O(1). Catch: worst case is O(n) under many collisions, and a **rehash** is an O(n) latency spike (bad for p99). Mutating a key after insertion corrupts the table.

### Linked list
**What it is** — nodes each pointing to the next; O(1) to splice in/out **if you already hold the node**, but O(n) to find it.
**Example**
```python
# Python's list is an array; a real linked list is nodes:
class Node: __slots__ = ("val", "next")
```
**Real situation** — the recency order inside an LRU cache (doubly linked list + a dict); free lists in allocators.
**Why it matters** — wins only when you need O(1) splice with a stable node reference. Otherwise arrays win on cache locality.

### Stack & queue
**What it is** — Stack = LIFO (Last In, First Out) (push/pop one end). Queue = FIFO (First In, First Out) (add one end, remove the other). Both O(1).
**Example**
```python
from collections import deque
q = deque(); q.append(x); q.popleft()   # queue
stack = []; stack.append(x); stack.pop() # stack
```
**Real situation** — stack backs DFS (Depth-First Search), undo, call frames; queue backs BFS (Breadth-First Search), task/job buffers, rate-limit windows.
**Why it matters** — the right access discipline makes the algorithm trivial (BFS *is* a queue). Use `deque`, not `list.pop(0)` (which is O(n)).

### Binary heap (priority queue)
**What it is** — a tree-in-an-array that keeps the min (or max) on top: O(1) peek, O(log n) push/pop.
**Example**
```python
import heapq
h = []
heapq.heappush(h, 5); heapq.heappush(h, 1)
heapq.heappop(h)        # 1 — always the smallest
```
**Real situation** — "top-K trending items" from a huge stream with bounded memory; Dijkstra's next-nearest node; timer/event scheduling.
**Why it matters** — repeated min/max without re-sorting. Can't search arbitrary elements or iterate in order cheaply.

### Balanced tree & B+-tree
**What it is** — keeps keys **sorted** with O(log n) ops. B+-trees use high fan-out so they're shallow on disk.
**Example** — `SELECT * FROM users WHERE age BETWEEN 20 AND 30` rides a B+-tree index.
**Real situation** — **every database index**: ordered lookup + range scans (`BETWEEN`, `ORDER BY`). Red-black trees back `TreeMap`/`std::map`.
**Why it matters** — when you need order or range queries a hashmap can't help. High fan-out minimizes disk seeks.

### Trie (prefix tree)
**What it is** — keys stored as character paths; lookup is O(L) in the key length, independent of how many keys exist.
**Real situation** — autocomplete / typeahead; IP routing tables.
**Why it matters** — prefix queries a hashmap can't do. Cost: memory-heavy unless compressed (radix trie).

### Bloom filter
**What it is** — a tiny probabilistic set: "definitely not present" or "maybe present" — no false negatives, some false positives.
**Real situation** — Cassandra checks a Bloom filter to **skip a disk read** when a key definitely isn't in an SSTable.
**Why it matters** — saves expensive lookups at huge scale in tiny memory. Can't delete from a standard one.

## When to use which

| Need | Reach for |
|---|---|
| Lookup by key, no order | Hash table |
| Sorted keys / range scans | Balanced tree (memory) · B+-tree (disk) |
| Repeated min/max | Binary heap |
| Prefix / autocomplete | Trie |
| Positional access, write-light | Dynamic array |
| O(1) splice w/ node ref | Linked list |
| Membership at scale, tolerate false positives | Bloom filter |

## Complexity

| Structure | Search | Insert | Delete | Ordered? |
|---|---|---|---|---|
| Dynamic array | O(n) | O(1)* / O(n) mid | O(n) | by index |
| Hash table | O(1) avg | O(1) avg | O(1) avg | no |
| Linked list | O(n) | O(1)† | O(1)† | insertion |
| Balanced tree | O(log n) | O(log n) | O(log n) | yes |
| Binary heap | O(n) | O(log n) | O(log n) | partial |
| Trie | O(L) | O(L) | O(L) | prefix |

\*amortized · †with a node reference

## Pitfalls
- "Hashmap is always O(1)" — average, not worst case; rehash is a latency spike.
- Big-O isn't everything — for small n a cache-friendly array beats a "faster" pointer structure.
- Inserting sorted data into a naive BST (Binary Search Tree) degrades to O(n) — use a balanced tree.
- An adjacency **matrix** on a sparse graph wastes O(V²) memory — use an adjacency list.
- `list.pop(0)` / `list.insert(0, …)` are O(n) — use `deque` for a queue.
