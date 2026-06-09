# Data Structures — Knowledge

How you store data decides how fast you can read and change it. Pick the structure that fits your dominant operation and the memory hierarchy.

## Key concepts

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
**What it is** — Stack = LIFO (push/pop one end). Queue = FIFO (add one end, remove the other). Both O(1).
**Example**
```python
from collections import deque
q = deque(); q.append(x); q.popleft()   # queue
stack = []; stack.append(x); stack.pop() # stack
```
**Real situation** — stack backs DFS, undo, call frames; queue backs BFS, task/job buffers, rate-limit windows.
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
- Inserting sorted data into a naive BST degrades to O(n) — use a balanced tree.
- An adjacency **matrix** on a sparse graph wastes O(V²) memory — use an adjacency list.
- `list.pop(0)` / `list.insert(0, …)` are O(n) — use `deque` for a queue.
