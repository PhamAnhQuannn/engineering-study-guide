# Complexity Analysis — Practice Questions

[← Topic overview](../README.md)

> Topic: Big-O time/space, amortized, tradeoff reasoning.

Mix of recall, "explain to a junior," and MCQs. Answer before expanding.

---

### Q1. What's the difference between O, Ω, and Θ?

**Answer:** **O(f)** is an upper bound (grows no faster than f), **Ω(f)** is a lower bound (grows at least as fast as f), and **Θ(f)** is a tight bound — both O(f) and Ω(f) hold. Casually people write "O(n log n)" when they mean Θ; precision matters when worst and average differ (quicksort is Θ(n log n) average but O(n²) worst — those are different statements).

---

### Q2. Explain to a junior the difference between amortized and average-case complexity.

**Answer:** **Amortized** is about a *sequence of operations*: spread the total worst-case cost over all operations. Dynamic-array append is amortized O(1) because the rare O(n) resize is paid for by many cheap appends — this is a guarantee even with no randomness. **Average-case** is about a *distribution of inputs* (or random choices): the expected cost over random inputs, e.g., randomized quicksort is O(n log n) on average but could in principle hit O(n²). One averages over time, the other over inputs.

---

### Q3. A function does `for i in range(n): for j in range(i, n): work()`. What's the complexity?

**Answer:** The inner loop runs `n + (n-1) + ... + 1 = n(n+1)/2` times total = Θ(n²). A common mistake is to call it O(n) because the inner range shrinks — but the *sum* of iterations is quadratic.

---

### Q4. Why might an O(n log n) algorithm beat an O(n) one in practice?

**Answer:** Big-O hides constant factors and ignores the memory hierarchy. An O(n) algorithm with a large constant, poor cache locality (pointer chasing), or unpredictable branches can be slower than a tight, cache-friendly, vectorizable O(n log n) one for the actual input sizes you run. Asymptotics describe scaling as n→∞; for fixed practical n, constants and cache behavior can dominate — so you measure.

---

### Q5. What's the time and space complexity of recursively computing Fibonacci naively, and why?

**Answer:** **Time O(φⁿ) ≈ O(1.618ⁿ)** — the recursion tree branches into two each level and recomputes the same subproblems exponentially. **Space O(n)** — the recursion stack depth is at most n (the longest path down the tree), even though total calls are exponential. Memoization cuts time to O(n).

---

### Q6. Explain to a junior why we "drop constants and lower-order terms."

**Answer:** Constants and lower-order terms depend on the machine and implementation details, and they become negligible as n grows. `3n² + 100n + 500` is dominated by `n²` for large n, so we call it O(n²): for n = 1,000,000 the `n²` term is a trillion and the rest is a rounding error. We keep only the part that determines how cost *scales*. (Caveat: for small n the dropped terms can dominate — then you measure.)

---

### Q7. Does an "in-place" algorithm always use O(1) space? What's the catch?

**Answer:** Not necessarily — "in-place" means it doesn't allocate an auxiliary array proportional to input, but a **recursive** in-place algorithm still uses stack space. Quicksort sorts in place yet uses O(log n) stack on average (O(n) worst, mitigated by recursing into the smaller partition). Heapsort is genuinely O(1) auxiliary. Always account for recursion depth when claiming O(1) space.

---

### Q8 (MCQ). What is the amortized time complexity of appending to a dynamic array that doubles on resize?

A. O(n)
B. O(log n)
C. O(1)
D. O(n log n)

**Answer: C.** Amortized O(1): total copy work across n appends is < 2n thanks to geometric growth, even though one append can spike to O(n).

---

### Q9 (MCQ). Which recurrence solves to O(log n)?

A. T(n) = 2T(n/2) + O(n)
B. T(n) = T(n/2) + O(1)
C. T(n) = T(n-1) + O(1)
D. T(n) = 2T(n-1) + O(1)

**Answer: B.** Halving with constant work per level → O(log n) (binary search). A is O(n log n), C is O(n), D is O(2ⁿ).

---

### Q10 (MCQ). You repeatedly look up length-L string keys in a hashmap n times. The total cost is best described as:

A. O(n)
B. O(n · L)
C. O(L)
D. O(n log L)

**Answer: B.** Each lookup must hash and compare a length-L key, costing O(L), so n lookups are O(n·L). "Hashmap is O(1)" hides the per-key work, which matters for long keys.

---

### Q11 (MCQ). Sorting 50 elements that are nearly already sorted — which consideration dominates?

A. Asymptotic worst case
B. Constant factors and adaptivity to existing order
C. Space complexity
D. The base of the logarithm

**Answer: B.** At n=50, asymptotics are irrelevant; constant factors and whether the sort is **adaptive** (Timsort runs near O(n) on nearly-sorted data) dominate.

---

### Q12. Give a concrete time/space tradeoff and explain both directions.

**Answer:** **Memoization / lookup tables:** spend O(n) (or more) memory to cache results and turn an exponential recomputation into O(n) time — trading space *for* time. The reverse: a **streaming / online** algorithm like reservoir sampling or HyperLogLog uses O(1)/O(log n) memory by recomputing or approximating instead of storing all data — trading time/accuracy *for* space. Which way you go depends on whether you're memory-bound or latency-bound.

---

### Q13. How would you reason about choosing between two algorithms in an interview?

**Answer:** State the **dominant operation and its frequency**, then compare candidates on: (1) worst vs average complexity and whether the worst case can actually occur for this workload/adversary; (2) time vs space; (3) latency vs throughput (amortized-spiky may violate a tail-latency SLO); (4) the input-size regime (small n favors simple/cache-friendly); (5) implementation simplicity. Conclude with the asymptotic answer, qualify it with constants/cache for the real n, and note you'd measure if it's hot.
