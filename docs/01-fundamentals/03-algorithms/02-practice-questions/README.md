# Algorithms — Practice Questions

[← Topic overview](../README.md)

> Topic: Sorting, searching, recursion, DP, greedy, graph traversal.

Mix of recall, "explain to a junior," and MCQs. Answer before expanding.

---

### Q1. Why can't a general comparison sort beat O(n log n), and how do counting/radix sort "cheat"?

**Answer:** Any comparison sort distinguishes the n! possible orderings using yes/no comparisons; a binary decision tree with n! leaves has height ≥ log₂(n!) ≈ n log n, so Ω(n log n) comparisons are unavoidable in the worst case. Counting and radix sort don't compare elements at all — they exploit that keys are **bounded integers** and bucket by digit/value, achieving O(n+k) or O(d·(n+k)). They "cheat" by using structure (key range), which the comparison model forbids.

---

### Q2. Explain to a junior when to use BFS vs DFS.

**Answer:** Use **BFS** (queue) when you need the **shortest path in an unweighted graph** or to process nodes level by level — it explores nearest-first. Use **DFS** (recursion/stack) when you need to go deep: cycle detection, topological sort, connected components, or exploring all paths. BFS uses memory proportional to the widest level; DFS uses memory proportional to the deepest path. Both are O(V+E).

---

### Q3. What two properties must a problem have for dynamic programming to apply?

**Answer:** (1) **Overlapping subproblems** — the same subproblem is solved many times in a naive recursion, so caching helps. (2) **Optimal substructure** — an optimal solution is composed of optimal solutions to subproblems. If subproblems don't overlap, plain divide & conquer is enough (no DP table needed); if there's no optimal substructure, DP gives wrong answers.

---

### Q4. How do you "binary search the answer"? Give the shape of such a problem.

**Answer:** When the answer is a number `x` and there's a **monotone predicate** `feasible(x)` — feasible for all x above (or below) some threshold — you can binary-search the threshold instead of the input. Example: "minimum ship capacity to deliver all packages within D days." `feasible(capacity)` is monotone (more capacity is never worse), so binary-search capacity over `[max(weight), sum(weights)]`, evaluating feasibility in O(n) each step → O(n log(sum)) overall.

---

### Q5. Quicksort vs mergesort — when do you pick each?

**Answer:** **Quicksort** is usually faster in practice (in-place, cache-friendly, low constant factors) and is the default for arrays of primitives, but it has an O(n²) worst case and isn't stable. **Mergesort** guarantees O(n log n), is **stable**, and works well on linked lists and external/streamed data, at the cost of O(n) extra memory. Pick mergesort when you need stability or guaranteed worst case (or are sorting objects by a key); pick quicksort/introsort for in-memory primitive arrays.

---

### Q6. Explain to a junior why naive recursive Fibonacci is slow and how to fix it.

**Answer:** `fib(n) = fib(n-1) + fib(n-2)` recomputes the same subproblems exponentially many times — `fib(n)` is called about φⁿ times → O(φⁿ) ≈ O(1.618ⁿ). The fix is **memoization**: cache each `fib(k)` the first time it's computed so later calls are O(1) lookups, reducing the whole thing to O(n) time. Bottom-up tabulation does the same and can run in O(1) space (keep only the last two values).

---

### Q7. When does a greedy algorithm give the wrong answer? Give a concrete example.

**Answer:** Greedy fails when a locally optimal choice forecloses a better global solution — i.e., no exchange argument holds. Classic example: **0/1 knapsack**. Greedily taking the highest value-per-weight item can be suboptimal because you can't take fractions and a different combination may pack the capacity better. Another: **coin change** with denominations like {1, 3, 4} for amount 6 — greedy picks 4+1+1 (3 coins) but optimal is 3+3 (2 coins). These need DP.

---

### Q8 (MCQ). What is the worst-case time complexity of quicksort with a naive (first-element) pivot on already-sorted input?

A. O(n)
B. O(n log n)
C. O(n²)
D. O(log n)

**Answer: C.** Each partition splits off just one element → n levels of O(n) work → O(n²). Randomized or median-of-three pivots avoid this.

---

### Q9 (MCQ). Which algorithm correctly finds shortest paths when some edge weights are negative (no negative cycles)?

A. Dijkstra
B. BFS
C. Bellman-Ford
D. Binary search

**Answer: C.** Bellman-Ford relaxes all edges V−1 times, handling negative weights and detecting negative cycles. Dijkstra's greedy assumption breaks with negative edges.

---

### Q10 (MCQ). You must order build tasks so each runs after its dependencies. Which technique?

A. Dijkstra
B. Topological sort (DFS or Kahn's algorithm)
C. Quicksort
D. Binary search

**Answer: B.** Topological sort linearizes a DAG so every edge points forward. A cycle means no valid order exists.

---

### Q11 (MCQ). Master Theorem: `T(n) = 2T(n/2) + O(n)` solves to?

A. O(n)
B. O(n log n)
C. O(n²)
D. O(log n)

**Answer: B.** `n^(log_2 2) = n` equals `f(n) = n`, the balanced case → O(n log n). (This is mergesort.)

---

### Q12. What's the difference between memoization and tabulation, and when prefer each?

**Answer:** **Memoization** is top-down: write the natural recursion and cache results; it only computes the subproblems actually reached and is easier to derive. **Tabulation** is bottom-up: fill a table in dependency order iteratively; it avoids recursion overhead and stack-overflow risk, and often enables **space optimization** (keep only the last row). Prefer memoization for clarity or sparse state spaces; prefer tabulation for performance, deep state chains, or when you can shrink memory.

---

### Q13. How would you make binary search robust against the two classic bugs?

**Answer:** (1) **Overflow:** compute the midpoint as `lo + (hi - lo) // 2` instead of `(lo + hi) // 2`. (2) **Termination / off-by-one:** fix one invariant — e.g., `[lo, hi)` half-open with `while lo < hi`, and make sure each iteration strictly shrinks the interval (assign `lo = mid + 1` or `hi = mid`, never leave both unchanged). State precisely what `lo`/`hi` mean (first index ≥ target, etc.) before coding.
