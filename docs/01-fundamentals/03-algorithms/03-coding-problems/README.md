# Algorithms — Coding Problems

[← Topic overview](../README.md)

> Topic: Sorting, searching, recursion, DP, greedy, graph traversal.

Each problem: statement + constraints → approach → time/space complexity → worked solution.

---

## Problem 1 — Binary search (lower bound)

**Statement:** Return the index of the first element `≥ target` in a sorted array (insertion point).
**Constraints:** `0 ≤ n ≤ 10^6`; array sorted ascending.

**Approach:** Half-open `[lo, hi)` invariant: `lo` is the first index whose value is `≥ target`. Shrink strictly each step; overflow-safe midpoint.

**Complexity:** Time O(log n), Space O(1).

```python
def lower_bound(arr, target):
    lo, hi = 0, len(arr)            # hi exclusive
    while lo < hi:
        mid = lo + (hi - lo) // 2   # overflow-safe
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo                       # in [0, n]
```

---

## Problem 2 — Merge sort (stable, divide & conquer)

**Statement:** Sort an array; sort must be stable.
**Constraints:** `n ≤ 10^6`.

**Approach:** Split in half, sort each recursively, merge. Stability preserved by taking the left element on ties.

**Complexity:** Time O(n log n) always, Space O(n).

```python
def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:     # <= keeps it stable
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    out.extend(left[i:]); out.extend(right[j:])
    return out
```

---

## Problem 3 — Coin change (DP, minimum coins)

**Statement:** Fewest coins from `coins` summing to `amount`, or `-1` if impossible.
**Constraints:** `1 ≤ amount ≤ 10^4`, denominations arbitrary (greedy won't work).

**Approach:** Bottom-up DP. `dp[x]` = min coins to make `x`. Transition: `dp[x] = min(dp[x - c] + 1)` over coins `c ≤ x`.

**Complexity:** Time O(amount × #coins), Space O(amount).

```python
def coin_change(coins, amount):
    INF = amount + 1
    dp = [0] + [INF] * amount
    for x in range(1, amount + 1):
        for c in coins:
            if c <= x:
                dp[x] = min(dp[x], dp[x - c] + 1)
    return dp[amount] if dp[amount] <= amount else -1
```

---

## Problem 4 — Longest increasing subsequence (DP + binary search)

**Statement:** Length of the longest strictly increasing subsequence.
**Constraints:** `n ≤ 2.5×10^5` → need better than O(n²).

**Approach:** Maintain `tails[k]` = smallest possible tail of an increasing subsequence of length k+1. For each x, binary-search its insertion point; `tails` length is the answer (patience sorting).

**Complexity:** Time O(n log n), Space O(n).

```python
from bisect import bisect_left

def length_of_lis(nums):
    tails = []
    for x in nums:
        i = bisect_left(tails, x)   # first tail >= x
        if i == len(tails):
            tails.append(x)         # extend
        else:
            tails[i] = x            # replace to keep tails minimal
    return len(tails)
```

---

## Problem 5 — Topological sort (Kahn's algorithm)

**Statement:** Return a valid task order given prerequisite edges, or empty if a cycle exists.
**Constraints:** `V ≤ 10^5`, `E ≤ 10^5`.

**Approach:** Compute in-degrees; repeatedly emit zero-in-degree nodes, decrementing successors. If fewer than V emitted, there's a cycle.

**Complexity:** Time O(V + E), Space O(V + E).

```python
from collections import deque, defaultdict

def topo_order(n, edges):           # edges: list of (u -> v)
    adj = defaultdict(list)
    indeg = [0] * n
    for u, v in edges:
        adj[u].append(v)
        indeg[v] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == n else []   # [] => cycle
```

---

## Problem 6 — Dijkstra's shortest path (greedy + heap)

**Statement:** Shortest distances from `src` to all nodes; non-negative weights.
**Constraints:** `V ≤ 10^5`, `E ≤ 5×10^5`.

**Approach:** Min-heap of `(dist, node)`; pop the closest unsettled node, relax its edges. Lazy deletion: skip stale heap entries.

**Complexity:** Time O((V+E) log V), Space O(V+E).

```python
import heapq

def dijkstra(n, adj, src):          # adj[u] = list of (v, weight)
    dist = [float('inf')] * n
    dist[src] = 0
    pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue                # stale entry
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist
```

---

## Problem 7 — Interval scheduling (greedy)

**Statement:** Maximum number of non-overlapping intervals you can select.
**Constraints:** `n ≤ 10^5`; intervals `[start, end)`.

**Approach:** Sort by **earliest finish time**; greedily take an interval if it starts at/after the last chosen end. Provably optimal by an exchange argument.

**Complexity:** Time O(n log n) (sort dominates), Space O(1).

```python
def max_nonoverlapping(intervals):
    intervals.sort(key=lambda iv: iv[1])   # by end time
    count, last_end = 0, float('-inf')
    for start, end in intervals:
        if start >= last_end:
            count += 1
            last_end = end
    return count
```

---

## Problem 8 — Edit distance (2D DP)

**Statement:** Minimum insert/delete/replace operations to turn `a` into `b` (Levenshtein).
**Constraints:** `|a|, |b| ≤ 2000`.

**Approach:** `dp[i][j]` = edit distance between prefixes `a[:i]`, `b[:j]`. Match → carry diagonal; else 1 + min(insert, delete, replace). Space-optimized to two rows.

**Complexity:** Time O(|a|·|b|), Space O(min(|a|,|b|)).

```python
def edit_distance(a, b):
    if len(b) < len(a):
        a, b = b, a                 # ensure b is the longer
    prev = list(range(len(a) + 1))
    for j in range(1, len(b) + 1):
        curr = [j] + [0] * len(a)
        for i in range(1, len(a) + 1):
            if a[i-1] == b[j-1]:
                curr[i] = prev[i-1]
            else:
                curr[i] = 1 + min(prev[i], curr[i-1], prev[i-1])
        prev = curr
    return prev[len(a)]
```
