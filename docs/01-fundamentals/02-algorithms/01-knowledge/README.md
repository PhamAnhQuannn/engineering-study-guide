# Algorithms — Knowledge

An algorithm is a recipe for transforming input to output. Senior skill = recognizing which well-known pattern a problem reduces to, and reasoning about its cost.

## Key concepts

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
- Greedy that *feels* right but isn't — prove it or use DP.
- Binary-search off-by-one — prefer `bisect` / a fixed template.
- Forgetting recursion depth = stack space (deep recursion → overflow).
- Quicksort is O(n²) worst case on bad pivots; know average vs worst.
- DP without a clear state definition → wrong or duplicated subproblems.
