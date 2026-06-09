# Complexity Analysis — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Big-O time/space, amortized, tradeoff reasoning.

Complexity analysis is how you reason about how an algorithm's cost grows with input size — *before* you run it, and independent of the machine. At the senior bar, the value is in **tradeoff reasoning**: knowing when asymptotics dominate, when constants and cache behavior flip the answer, and how to talk about amortized and probabilistic costs precisely.

---

## 1. Asymptotic notation

We describe growth as input size `n → ∞`, ignoring constants and lower-order terms.

- **Big-O — O(f)**: *upper* bound. "Grows no faster than f." The common interview currency. `2n² + 3n + 7 = O(n²)`.
- **Big-Omega — Ω(f)**: *lower* bound. "Grows at least as fast as f." Comparison sorts are Ω(n log n).
- **Big-Theta — Θ(f)**: *tight* bound — both O and Ω. The honest answer when upper and lower bounds match.
- Loose usage: people say "O(n log n)" when they mean Θ; be precise when it matters (e.g., "worst case is O(n²) but average is Θ(n log n)").

**Why drop constants?** They're machine/implementation dependent; asymptotics capture how the algorithm *scales*, which is what survives across hardware. But for fixed, modest n they can dominate — see §6.

---

## 2. The complexity ladder (fastest → slowest)

| Class | Name | Example |
|---|---|---|
| O(1) | constant | hashmap get, array index |
| O(log n) | logarithmic | binary search, balanced-tree op |
| O(n) | linear | single scan |
| O(n log n) | linearithmic | efficient sort, divide & conquer |
| O(n²) | quadratic | nested loops, naive pairwise |
| O(n³) | cubic | Floyd-Warshall, naive matmul |
| O(2ⁿ) | exponential | subset enumeration, naive Fibonacci |
| O(n!) | factorial | permutations, brute-force TSP |

Rule of thumb at ~10⁸ ops/sec: O(n²) is fine to ~10⁴, O(n log n) to ~10⁷–10⁸, O(n) to ~10⁸; O(2ⁿ) is only tractable to ~n≈25–30.

---

## 3. How to analyze

- **Sequential statements:** add (then keep the dominant term).
- **Loops:** multiply the body cost by iteration count. Nested loops multiply.
- **Watch the loop bounds:** a loop that halves each step is O(log n); `i*i ≤ n` is O(√n); a loop whose inner range shrinks may still be O(n²) (sum 1..n) — compute the sum, don't eyeball.
- **Recursion:** write the recurrence `T(n) = a·T(n/b) + f(n)` and solve with the **Master Theorem** or a recursion tree.
- **Drop lower-order terms and constants** at the end.
- **Specify the case:** best / average / worst. Quicksort is Θ(n log n) average, O(n²) worst.

---

## 4. Amortized analysis

Amortized cost = total cost of a sequence of operations / number of operations. It bounds the *average* cost per op over a worst-case sequence — **not** a probabilistic average.

- **Dynamic array append:** O(1) amortized despite occasional O(n) resize, because geometric growth makes total copy work < 2n over n appends.
- **Methods:** *aggregate* (total / count), *accounting* (charge each cheap op extra "credit" to pay for rare expensive ops), *potential* (define a potential function Φ that prepays expensive ops).
- **Why it matters:** amortized O(1) still means an *individual* op can spike to O(n) — that's a **tail-latency** concern even when throughput is fine. Hashmap rehash, vector resize, and union-find path compression are amortized-cheap but spiky.

Contrast **amortized** (worst-case over a sequence) vs **average-case** (expected over random input or random choices, e.g., randomized quicksort) vs **expected** (probabilistic, e.g., skip list).

---

## 5. Space complexity

- Count **extra** memory beyond input: auxiliary arrays, recursion stack, hashmaps.
- **Recursion costs stack space**: depth × frame size. A recursion of depth n is O(n) space even if it does O(1) work per frame.
- **In-place** algorithms use O(1) extra (heapsort) — distinguish from O(n) (mergesort).
- **Time/space tradeoff** is the central lever: memoization trades space for time; streaming/online algorithms trade some accuracy or recomputation for O(1)/O(log n) space (HyperLogLog, reservoir sampling).

---

## 6. When Big-O lies (senior nuance)

Asymptotics ignore real factors that often decide performance for practical n:

- **Constant factors:** an O(n) algorithm with a huge constant can lose to an O(n log n) one for the n you actually run.
- **Cache locality:** contiguous arrays (sequential access) can be ~100× faster than pointer-chasing structures with the same Big-O. A linear array scan often beats a "faster" tree for n in the thousands.
- **Branch prediction & SIMD:** predictable, vectorizable loops run far faster per element.
- **Memory bandwidth, not CPU,** is the bottleneck for many data-heavy ops.
- **Big-O hides the base of logs and the work per op** — "O(n log n)" sort implementations differ 2–5× in practice.

The senior move: lead with asymptotics, then *qualify* with "for the expected n, constants/cache mean X may actually win — I'd measure."

---

## 7. Tradeoff reasoning framework

When choosing between options, reason across these axes:

1. **Dominant operation & its frequency** — optimize the hot path.
2. **Worst case vs average** — does the worst case ever occur in your workload? Adversarial input?
3. **Time vs space** — can you precompute/cache, or are you memory-bound?
4. **Latency vs throughput** — amortized-cheap-but-spiky may be unacceptable under a tail-latency SLO.
5. **Input size regime** — small n favors simple/cache-friendly; large n favors better asymptotics.
6. **Simplicity & maintainability** — the "best" complexity isn't worth a subtle, unmaintainable implementation if a simpler one meets the SLO.

---

## 8. Common pitfalls & misconceptions

- **Confusing amortized with average-case** — different guarantees (sequence vs distribution).
- **Forgetting recursion stack space** when claiming "O(1) space."
- **Dropping a hidden factor** — e.g., string comparison inside a loop is O(L), so "O(n) lookups" of length-L keys is O(n·L).
- **Quoting average and ignoring worst case** that an adversary or pathological input can trigger.
- **Treating O(1) hashmap ops as truly constant** — rehash and collisions exist.
- **Over-indexing on Big-O for tiny n** where constants and cache dominate.
- **Summing loop iterations wrong** — `1+2+...+n = Θ(n²)`, not O(n).

---

## 9. What interviewers probe

- Can you derive complexity from a loop/recurrence, not just recite it?
- Do you specify **best/average/worst** and the relevant case for the workload?
- Can you explain **amortized** correctly and distinguish it from average-case?
- Do you account for **space**, including recursion stack?
- Can you articulate when **constants/cache** beat asymptotics, and that you'd measure?

---

## Quick-reference summary

- **Big-O = upper bound, Ω = lower, Θ = tight.** Use Θ when you can.
- **Ladder:** 1 < log n < n < n log n < n² < n³ < 2ⁿ < n!.
- **Analyze:** loops multiply, sequentials add, recursion → recurrence → Master Theorem; drop constants/lower terms last.
- **Amortized** = worst-case over a sequence (vector append, rehash); spiky individual ops matter for tail latency.
- **Space** includes auxiliary memory *and* recursion depth.
- **Big-O can lie** for practical n — constants, cache locality, and memory bandwidth often decide; measure.
- **Tradeoffs:** optimize the hot path; weigh worst-vs-average, time-vs-space, latency-vs-throughput, and input-size regime.
