# Data Structures — Coding Problems

[← Topic overview](../README.md)

> Topic: Arrays, hashmaps, lists, trees, heaps, graphs, tries.

Each problem: statement + constraints → approach → time/space complexity → worked solution. Solutions are in Python unless a language fits better.

---

## Problem 1 — Two Sum (hashmap)

**Statement:** Given an array `nums` and a `target`, return indices of two numbers that sum to `target`. Exactly one solution; can't reuse an element.
**Constraints:** `2 ≤ n ≤ 10^5`, values fit in 64-bit.

**Approach:** One pass; store `value → index` in a hashmap. For each element, check if `target - x` was already seen. Trades O(n) space for O(n) time vs the O(n²) brute force.

**Complexity:** Time O(n), Space O(n).

```python
def two_sum(nums, target):
    seen = {}                      # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    raise ValueError("no solution")
```

---

## Problem 2 — Detect a cycle in a linked list (Floyd's)

**Statement:** Return `True` if a singly linked list contains a cycle.
**Constraints:** O(1) extra space required.

**Approach:** Two pointers — slow moves 1, fast moves 2. If they meet, there's a cycle; if fast hits `None`, there isn't. The hashmap-of-seen-nodes approach is O(n) space; Floyd's is O(1).

**Complexity:** Time O(n), Space O(1).

```python
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

---

## Problem 3 — Top-K frequent elements (heap)

**Statement:** Return the `k` most frequent elements of `nums`.
**Constraints:** `1 ≤ k ≤ #distinct ≤ n ≤ 10^5`.

**Approach:** Count frequencies in a hashmap, then keep a **min-heap of size k** over (freq, value). Each push/pop is O(log k); n pushes → O(n log k), better than the O(n log n) of a full sort when k ≪ n. (Bucket sort by frequency gives O(n) but uses more memory.)

**Complexity:** Time O(n log k), Space O(n).

```python
import heapq
from collections import Counter

def top_k_frequent(nums, k):
    freq = Counter(nums)
    heap = []                      # min-heap of (count, value)
    for val, cnt in freq.items():
        heapq.heappush(heap, (cnt, val))
        if len(heap) > k:
            heapq.heappop(heap)    # drop the least frequent
    return [val for _, val in heap]
```

---

## Problem 4 — Validate a Binary Search Tree

**Statement:** Determine whether a binary tree is a valid BST (every left descendant `< node < ` every right descendant).
**Constraints:** Node values may be near int limits → use open bounds, not `-inf` comparisons that break on duplicates.

**Approach:** DFS passing down a valid `(low, high)` open interval. A common bug is checking only direct children — you must propagate ancestor bounds.

**Complexity:** Time O(n), Space O(h) recursion (h = height).

```python
def is_valid_bst(root):
    def dfs(node, low, high):
        if node is None:
            return True
        if not (low < node.val < high):
            return False
        return dfs(node.left, low, node.val) and dfs(node.right, node.val, high)
    return dfs(root, float('-inf'), float('inf'))
```

---

## Problem 5 — Implement an LRU cache (hashmap + doubly linked list)

**Statement:** `get(key)` and `put(key, value)` in O(1); evict least-recently-used when capacity is exceeded.
**Constraints:** `capacity ≥ 1`.

**Approach:** Hashmap key → node for O(1) lookup; doubly linked list for O(1) recency reordering and tail eviction. Python's `OrderedDict` encapsulates exactly this.

**Complexity:** Time O(1) per op, Space O(capacity).

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.store = OrderedDict()

    def get(self, key):
        if key not in self.store:
            return -1
        self.store.move_to_end(key)        # mark most-recently-used
        return self.store[key]

    def put(self, key, value):
        if key in self.store:
            self.store.move_to_end(key)
        self.store[key] = value
        if len(self.store) > self.cap:
            self.store.popitem(last=False)  # evict LRU (front)
```

---

## Problem 6 — Number of islands (graph / BFS or DFS on a grid)

**Statement:** Count connected groups of `1`s (4-directional) in a 2D grid of `0`/`1`.
**Constraints:** Grid up to `300×300`.

**Approach:** Scan cells; on an unvisited land cell, flood-fill (BFS/DFS) the whole island, marking visited. Each cell visited once.

**Complexity:** Time O(R·C), Space O(R·C) worst case (queue/recursion).

```python
from collections import deque

def num_islands(grid):
    if not grid:
        return 0
    R, C, count = len(grid), len(grid[0]), 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] == '1':
                count += 1
                grid[r][c] = '0'             # mark visited
                q = deque([(r, c)])
                while q:
                    x, y = q.popleft()
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = x+dx, y+dy
                        if 0 <= nx < R and 0 <= ny < C and grid[nx][ny] == '1':
                            grid[nx][ny] = '0'
                            q.append((nx, ny))
    return count
```

---

## Problem 7 — Implement a Trie (prefix tree)

**Statement:** Support `insert(word)`, `search(word)` (exact), and `starts_with(prefix)`.
**Constraints:** Lowercase a–z; up to `10^4` words.

**Approach:** Each node holds a dict of children + an `is_end` flag. All ops walk the key once.

**Complexity:** Time O(L) per op (L = key length), Space O(total chars).

```python
class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node['$'] = True            # end-of-word marker

    def _walk(self, s):
        node = self.root
        for ch in s:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def search(self, word):
        node = self._walk(word)
        return node is not None and '$' in node

    def starts_with(self, prefix):
        return self._walk(prefix) is not None
```

---

## Problem 8 — Merge k sorted lists (heap)

**Statement:** Merge `k` sorted linked lists into one sorted list.
**Constraints:** Total `n` nodes across all lists.

**Approach:** Push the head of each list into a min-heap keyed by value; repeatedly pop the smallest and push its successor. Beats merging pairwise naively.

**Complexity:** Time O(n log k), Space O(k).

```python
import heapq

def merge_k_lists(lists):
    heap = []
    for i, node in enumerate(lists):
        if node:
            heapq.heappush(heap, (node.val, i, node))  # i breaks val ties
    dummy = tail = ListNode(0)
    while heap:
        _, i, node = heapq.heappop(heap)
        tail.next = node
        tail = node
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
```
