# Algorithms — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Sorting, searching, recursion, DP, greedy, graph traversal.

Algorithms are recipes for transforming input into output with proven correctness and bounded cost. At the senior bar, what matters is recognizing the **paradigm** a problem fits, choosing the right tradeoff, and reasoning about correctness and complexity — not memorizing code.

---

## 1. Algorithmic paradigms (the master map)

| Paradigm | Core idea | Signal it applies | Examples |
|---|---|---|---|
| Brute force / enumeration | Try all candidates | Tiny N, baseline | subset generation |
| Divide & conquer | Split, solve, combine | Problem splits into independent subproblems | mergesort, quicksort, binary search |
| Greedy | Locally optimal choice = global optimum | Exchange argument / matroid holds | Dijkstra, Huffman, interval scheduling |
| Dynamic programming | Overlapping subproblems + optimal substructure | Recurrence reuses subresults | knapsack, edit distance, LIS |
| Backtracking | DFS with pruning | Constraint satisfaction | N-queens, sudoku, permutations |
| Graph traversal | Explore nodes/edges | Relationships, reachability | BFS/DFS, topo sort, SCC |
| Two pointers / sliding window | Move indices over sorted/sequential data | Subarray/substring with monotone property | longest substring, container with most water |

---

## 2. Sorting

- **Comparison sorts** have a hard lower bound of **Ω(n log n)** (decision-tree argument: n! leaves need log₂(n!) ≈ n log n comparisons).
- **Mergesort:** O(n log n) always, **stable**, O(n) extra space, predictable — good for external/linked-list sort and when stability matters.
- **Quicksort:** O(n log n) average, **O(n²) worst** (bad pivots / already-sorted with naive pivot). In-place, cache-friendly, usually fastest in practice. Mitigate worst case with randomized/median-of-three pivots and introsort (switch to heapsort on deep recursion).
- **Heapsort:** O(n log n) worst, in-place, **not stable**, poor cache locality vs quicksort.
- **Non-comparison sorts** beat the bound by exploiting structure: **counting sort** O(n+k), **radix sort** O(d·(n+k)), **bucket sort** — only when keys are bounded integers/fixed-width.
- **Hybrid real-world sorts:** Timsort (Python, Java objects) — stable, exploits existing runs, O(n) on nearly-sorted; introsort (C++ `std::sort`).
- **Stability** matters when sorting by a secondary key after a primary, or preserving input order of equal elements.

---

## 3. Searching

- **Linear search:** O(n), no precondition.
- **Binary search:** O(log n) on a **sorted** array (or any monotone predicate). The senior framing: "binary search the *answer*" — if `feasible(x)` is monotone, binary-search x over the value range (e.g., minimize max load, Koko eating bananas, ship-within-D-days). Watch the classic bugs: integer overflow on `(lo+hi)/2` → use `lo + (hi-lo)/2`; off-by-one on inclusive vs exclusive bounds; infinite loop when bounds don't shrink.
- **Hash-based lookup:** O(1) average if you can precompute a table.
- **Exponential / interpolation search:** for unbounded or uniformly distributed data.

---

## 4. Recursion & divide and conquer

- A recursion = base case(s) + recursive case that reduces toward the base.
- **Recursion ↔ iteration:** any recursion can be made iterative with an explicit stack; compilers may apply **tail-call optimization** (not in Python/Java by default → deep recursion risks stack overflow).
- **Master Theorem** solves `T(n) = a·T(n/b) + f(n)`:
  - Compare `f(n)` to `n^(log_b a)`. If f is smaller → O(n^log_b a); equal → O(n^log_b a · log n); larger (and regular) → O(f(n)).
  - Mergesort: `2T(n/2) + O(n)` → O(n log n). Binary search: `T(n/2) + O(1)` → O(log n).

---

## 5. Dynamic programming (DP)

Two preconditions: **overlapping subproblems** (same subproblem recomputed) and **optimal substructure** (optimal solution builds from optimal sub-solutions).

- **Top-down (memoization):** recursion + cache. Natural, only computes reachable states.
- **Bottom-up (tabulation):** fill a table in dependency order. Often allows **space optimization** (keep only the last row/few states).
- **Method:** define the state, the recurrence/transition, the base case, the answer location, and the evaluation order.
- **Canonical families:**
  - 1D: Fibonacci, climbing stairs, house robber, LIS (O(n log n) with patience sorting).
  - 2D / sequence: edit distance, LCS, knapsack (0/1 and unbounded), coin change.
  - Interval: matrix-chain, burst balloons.
  - DP on trees / DAG: longest path in DAG, tree DP.
- **Pitfall:** DP is not always optimal — if the state space is exponential, it's still exponential; and greedy or a direct formula may beat it.

---

## 6. Greedy

- Make the locally optimal choice and never reconsider. Fast and simple **when it's correct** — and proving correctness is the hard part.
- **Proof techniques:** *exchange argument* (show any optimal solution can be transformed into the greedy one without getting worse); *matroid theory* (greedy is optimal iff the problem forms a matroid).
- **Correct greedy:** interval scheduling (earliest finish time), Huffman coding, Dijkstra (non-negative weights), Kruskal/Prim MST, fractional knapsack.
- **Greedy fails:** 0/1 knapsack, coin change with arbitrary denominations (needs DP).
- Senior tell: always ask "does the greedy choice provably lead to a global optimum, or just a *feasible* solution?"

---

## 7. Graph algorithms

- **BFS** (queue): shortest path in **unweighted** graphs, level-order, bipartite check. O(V+E).
- **DFS** (stack/recursion): cycle detection, **topological sort** (DAG ordering), connected components, strongly connected components (Tarjan/Kosaraju). O(V+E).
- **Topological sort:** order a DAG so every edge points forward — used for build systems, task scheduling, dependency resolution. Cycle ⇒ no valid order.
- **Shortest paths:**
  - Dijkstra: non-negative weights, O((V+E) log V) with a heap.
  - Bellman-Ford: handles negative edges, detects negative cycles, O(V·E).
  - Floyd-Warshall: all-pairs, O(V³).
  - A*: Dijkstra + admissible heuristic for goal-directed search.
- **MST:** Kruskal (sort edges + union-find) or Prim (heap). Minimum total edge weight connecting all nodes.
- **Union-Find:** near-O(1) amortized connectivity with path compression + union by rank.

---

## 8. Common pitfalls & misconceptions

- **"Quicksort is always O(n log n)."** No — O(n²) worst case; randomize the pivot or use introsort.
- **Reaching for DP when greedy suffices** (or vice versa) — wasted complexity or wrong answers.
- **Binary search off-by-one / overflow** — the most common interview bug. Pin down the invariant before coding.
- **Recomputing in recursion** without memoization → exponential blowup (naive Fibonacci is O(φⁿ)).
- **Deep recursion** in Python/Java → stack overflow; convert to iterative or raise the limit deliberately.
- **Assuming Dijkstra works with negative edges** — it doesn't; use Bellman-Ford.
- **Ignoring stability** when sorting on multiple keys.

---

## 9. What interviewers probe

- Can you **name the paradigm** before coding, and justify it?
- Do you state the **recurrence/invariant** and complexity *before* implementation?
- Can you reason about **worst case vs average** and how to harden the worst case?
- Do you handle edge cases (empty input, single element, duplicates, overflow)?
- Can you **prove** a greedy is correct (exchange argument), not just assert it?

---

## Quick-reference summary

- **Sorted data + monotone predicate →** binary search / two pointers.
- **Independent splits →** divide & conquer.
- **Overlapping subproblems + optimal substructure →** DP (memoize first, then tabulate, then optimize space).
- **Provable local-optimal choice →** greedy (prove with exchange argument).
- **Reachability / ordering / shortest path →** graph traversal (BFS unweighted, Dijkstra weighted-nonneg, Bellman-Ford if negatives).
- **Default sort:** an introsort/Timsort hybrid; choose mergesort for stability, counting/radix for bounded integer keys.
- Always state **time and space complexity** and the **worst case**, and harden it.
