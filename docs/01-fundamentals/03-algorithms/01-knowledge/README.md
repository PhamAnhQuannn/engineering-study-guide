# Algorithms — Knowledge / Study Notes

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we laid out our [Data Structures](../../02-data-structures/01-knowledge/README.md) — the containers that hold ShopFast's data. This topic is about the *recipes* for transforming and searching that data: how products are ranked, how orders are sorted, how routes are found. **Next:** [Memory Model](../../04-memory-model/01-knowledge/README.md) — where the data those algorithms manipulate actually lives in memory.

---

## Teaching arc: the recipes inside ShopFast

### What it is

An **algorithm** is a step-by-step recipe that transforms an input into an output in a predictable, finite number of steps. Like a cooking recipe, the same algorithm always produces the same output for the same input — and some recipes are much faster than others.

The senior skill is not memorising dozens of algorithms. It is **pattern recognition**: seeing that "find the max-revenue window across 60-second buckets" reduces to a *sliding window*, that "pick orders for the cheapest delivery route" is a *graph* problem, that "how many ways can we discount this cart?" is *dynamic programming (DP)*. Once you name the pattern, the implementation follows.

For ShopFast specifically, algorithms underpin:
- **Catalog search/filter** — sorting products by price, relevance, rating.
- **Checkout workers** — processing the order queue; Dijkstra's for potential route optimisation.
- **Analytics** — "top-K (K-th largest) trending products this hour" with a sliding window + heap.
- **Recommendation/search relevance** — edit distance between a query and product names.

### What it looks like

```
BINARY SEARCH on a sorted array
  lo=0, hi=n-1
  mid = (lo+hi)//2
  if arr[mid] == target → found
  if arr[mid] < target  → lo = mid+1   (discard left half)
  else                  → hi = mid-1   (discard right half)

TWO-POINTER sliding window
  [  3   1   4   1   5   9   2  ]
   ↑l              ↑r            expand r, shrink l when constraint violated

BFS (Breadth-First Search) on a graph
  queue = [start]
  while queue not empty:
      node = dequeue; visit node
      enqueue all unvisited neighbours   ← level by level (fewest hops first)

DYNAMIC PROGRAMMING (DP) memo table
  fib(0)=0, fib(1)=1 → fill table left→right
  [0][1][1][2][3][5][8]...   ← each cell = sum of previous two (O(1) per cell)
```

### Implement it from scratch

**Binary search — the backbone of every sorted index**

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2          # avoids integer overflow vs (lo+hi)
        if arr[mid] == target:
            return mid                 # found
        elif arr[mid] < target:
            lo = mid + 1              # target is in the right half
        else:
            hi = mid - 1              # target is in the left half
    return -1                          # not present
```

**Sliding window — "top N requests in any 60-second window" (ShopFast rate limiter)**

```python
from collections import deque

def max_requests_in_window(timestamps, window_sec):
    """Find the max number of requests that occur in any window_sec interval."""
    q = deque()         # stores timestamps currently in the window
    best = 0
    for t in timestamps:
        q.append(t)
        while q[0] < t - window_sec:   # evict timestamps outside the window
            q.popleft()
        best = max(best, len(q))
    return best
```

**BFS (Breadth-First Search) — dependency resolution, reachability check**

```python
from collections import deque

def bfs(graph, start):
    """Visit all nodes reachable from start; return visited set."""
    seen = {start}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbour in graph[node]:
            if neighbour not in seen:
                seen.add(neighbour)
                queue.append(neighbour)   # O(V + E) total
    return seen
```

**DP (Dynamic Programming) — edit distance (ShopFast fuzzy search / spell-correct)**

```python
def edit_distance(a, b):
    """Minimum insertions/deletions/substitutions to turn a into b."""
    m, n = len(a), len(b)
    dp = list(range(n + 1))             # base case: dp[j] = j deletions
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i                       # cost to delete i chars from a
        for j in range(1, n + 1):
            tmp = dp[j]
            if a[i-1] == b[j-1]:
                dp[j] = prev            # same char — no extra cost
            else:
                dp[j] = 1 + min(prev, dp[j], dp[j-1])  # sub, delete, insert
            prev = tmp
    return dp[n]
```

### Where it lives in real systems

| ShopFast feature | Algorithm | Why this pattern |
|---|---|---|
| **Product list sort** (price, rating) | Merge sort / Timsort | Stable O(n log n); "process cheapest first" unlocks cheaper downstream steps |
| **Rate-limit window** (max requests per minute per IP) | Sliding window | O(n) over the event stream; replaces a nested-loop O(n²) approach |
| **Search autocomplete** (sorted product name index) | Binary search | Jump to the right prefix in O(log n) instead of scanning all products |
| **Order dependency resolution** (payment before fulfilment) | Topological sort (DFS) | Linearise a DAG (Directed Acyclic Graph) of order steps |
| **Shortest delivery route** (warehouse to zone) | Dijkstra + binary heap | Weighted shortest path — the heap always pops the nearest unvisited node |
| **Fuzzy product search** (typo tolerance) | Edit distance (DP) | Collapses exponential brute-force comparison to O(m·n) |
| **Top-K trending products** (real-time analytics) | Heap + sliding window | Maintain a size-K min-heap over a fixed time window — O(n log K) |
| **Checkout discount rules** ("pick best coupon combo") | DP / greedy | Overlapping subproblems → DP; simple cases → greedy (justify with exchange argument) |

### Types & differences

| Signal in the problem | Pattern | Key property |
|---|---|---|
| "Find X" in a **sorted** input | Binary search | Halves search space each step → O(log n) |
| Subarray / substring, pairs, running window | Two pointers / sliding window | One pass, two indices → O(n) |
| "Number of ways / min cost / longest…" with overlapping subproblems | DP | Memoize subproblem answers; state + transition are the design challenge |
| "Pick best each step" with a provable exchange argument | Greedy | O(n) or O(n log n); dangerous when the exchange argument doesn't hold |
| Nodes + edges, reachability, fewest hops | BFS | Queue-based, level-order, finds shortest *unweighted* path |
| Nodes + edges, cycle detection, topological sort | DFS (Depth-First Search) | Stack/recursion-based; explores deep before wide |
| Weighted shortest path | Dijkstra (BFS + heap) | O((V + E) log V); requires non-negative weights |
| Need O(n log n) sort to enable other patterns | Sort first | Unlock binary search, two-pointer, greedy interval scheduling |
| Exponential brute-force tree | Divide-and-conquer | Split, solve halves, merge — e.g. merge sort, closest pair |

### Gotchas

- **Greedy that feels right but isn't.** Coin change with denominations {1, 3, 4} — greedy picks 4+1+1=3 coins for 6, but DP finds 3+3=2. Always prove a greedy with an exchange argument or fall back to DP.
- **Binary search off-by-one.** The most common interview mistake. Prefer `bisect.bisect_left` / `bisect.bisect_right` from the standard library rather than hand-rolling boundary conditions.
- **Recursion depth equals stack space.** A DFS on a 10 000-node linked-list graph hits Python's default 1 000-frame limit. Convert deep recursion to an explicit stack (iteration) or raise `sys.setrecursionlimit` deliberately.
- **Quicksort is O(n²) worst case.** On already-sorted input with a naive pivot, every partition produces size-(n-1) and size-0 halves. Know average O(n log n) vs worst O(n²), and why Timsort (used by Python and Java) avoids this.
- **DP without a clear state definition** produces wrong or duplicated subproblems. Nail the state ("what exactly does `dp[i][j]` represent?") before writing transitions.
- **BFS space** is O(V) — the queue holds an entire level. For very wide graphs (social networks), memory blows up. DFS uses O(depth) space — better for deep-narrow graphs.
- **Dijkstra's algorithm requires non-negative edge weights.** For negative weights, use Bellman-Ford (O(VE)) or check for negative cycles explicitly.

---

## Key concepts (reference)

### Binary search
**What it is** — repeatedly halve a **sorted** range to find a target (or a boundary) in O(log n).
**Example**
```python
import bisect
i = bisect.bisect_left(sorted_ids, target)   # first index >= target
```
**Real situation** — find a row by key in a sorted index; "first version that fails" in a deploy bisect; threshold lookup.
**Why it matters** — turns O(n) scans into O(log n). The trap is off-by-one on the boundary; reach for `bisect` instead of hand-rolling.

### Two pointers / sliding window
**What it is** — walk two indices over a sequence instead of nested loops, turning O(n²) into O(n).
**Example**
```python
# longest run whose sum stays <= K
l = total = best = 0
for r, x in enumerate(nums):
    total += x
    while total > K: total -= nums[l]; l += 1
    best = max(best, r - l + 1)
```
**Real situation** — "max requests in any 60-second window", dedup a sorted stream, merge two sorted lists.
**Why it matters** — removes a whole loop. Works when data is sorted or the window grows/shrinks monotonically.

### Recursion & divide-and-conquer
**What it is** — solve a problem by solving smaller copies and combining. Cost via the recurrence `T(n)=a·T(n/b)+f(n)`.
**Example**
```python
def merge_sort(a):
    if len(a) <= 1: return a
    m = len(a) // 2
    return merge(merge_sort(a[:m]), merge_sort(a[m:]))   # O(n log n)
```
**Real situation** — merge sort, quicksort, balanced-tree ops, map-reduce style aggregation.
**Why it matters** — clean O(n log n) for sort/search. Watch recursion **depth** = stack space; deep recursion can overflow.

### Sorting
**What it is** — order elements; comparison sorts are Ω(n log n). Most languages ship an optimized stable hybrid (Timsort).
**Example**
```python
rows.sort(key=lambda r: (r.tier, -r.score))   # multi-key, stable
```
**Real situation** — leaderboards, "process oldest first", preparing data so two-pointer / binary-search become possible.
**Why it matters** — sorting once often unlocks cheaper later steps. Stable sort means secondary keys hold.

### Greedy
**What it is** — take the locally-best choice each step; correct only when the problem has the right structure (an exchange argument holds).
**Example** — interval scheduling: always take the meeting that **ends earliest**.
**Real situation** — task scheduling, Huffman coding, simple cache-eviction rules.
**Why it matters** — simple and fast when valid. Danger: greedy is **wrong** for many problems (e.g. coin change with odd denominations) — you must justify it.

### Dynamic programming (DP)
**What it is** — break into overlapping subproblems and **remember** their answers (memoize) instead of recomputing.
**Example**
```python
from functools import cache
@cache
def fib(n): return n if n < 2 else fib(n - 1) + fib(n - 2)   # O(n), not O(2^n)
```
**Real situation** — edit distance (spell-check / diff), knapsack-style allocation, "min cost path".
**Why it matters** — collapses exponential brute force to polynomial by trading memory for time. The hard part is defining the state + transition.

### Graph traversal (BFS / DFS)
**What it is** — visit nodes via a queue (BFS = fewest hops) or stack/recursion (DFS = cycle detection, topological sort).
**Example**
```python
from collections import deque
def bfs(g, s):
    seen, q = {s}, deque([s])
    while q:
        n = q.popleft()
        for m in g[n]:
            if m not in seen: seen.add(m); q.append(m)
```
**Real situation** — dependency resolution (topo sort), shortest path in an unweighted network, "is A reachable from B".
**Why it matters** — most relationship problems are graph problems in disguise. BFS = fewest edges; Dijkstra = weighted shortest path.

## When to use which

| Signal in the problem | Pattern |
|---|---|
| Sorted input, "find X" / boundary | Binary search |
| Subarray / substring window, pairs | Two pointers / sliding window |
| "Number of ways / min cost / longest…" with overlap | Dynamic programming |
| "Pick best each step" + provable | Greedy |
| Nodes & edges, reachability, shortest hops | BFS / DFS |
| Need order, or to enable the above | Sort first |

## Pitfalls
- Greedy that *feels* right but isn't — prove it or use DP (Dynamic Programming).
- Binary-search off-by-one — prefer `bisect` / a fixed template.
- Forgetting recursion depth = stack space (deep recursion → overflow).
- Quicksort is O(n²) worst case on bad pivots; know average vs worst.
- DP without a clear state definition → wrong or duplicated subproblems.
