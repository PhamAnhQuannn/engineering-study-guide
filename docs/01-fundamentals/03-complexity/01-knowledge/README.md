# Complexity Analysis — Knowledge

Complexity is how an algorithm's cost grows as the input grows — judged *before* you run it and independent of the machine. It's how you compare approaches and spot what won't scale.

## Key concepts

### Big-O (and Ω, Θ)
**What it is** — Big-O is the **upper bound** on growth, ignoring constants and lower terms. Ω is the lower bound, Θ is a tight (both) bound.
**Example** — `2n² + 3n + 7` is `O(n²)` (the n² term dominates as n grows).
**Real situation** — capacity planning: "this report is O(n²) in customers — fine at 1k, melts at 1M."
**Why it matters** — a shared vocabulary for "will this scale". Drop constants because they're machine-specific; keep the shape that survives across hardware.

### The complexity ladder
**What it is** — the common growth classes, fastest to slowest: O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!).
**Example** — hashmap get = O(1); binary search = O(log n); a scan = O(n); a good sort = O(n log n); nested loops = O(n²).
**Real situation** — rough budget at ~10⁸ ops/sec: O(n²) ok to ~10⁴, O(n log n) to ~10⁷–10⁸, O(2ⁿ) only to n≈25.
**Why it matters** — lets you eyeball feasibility from the input size before writing code.

### How to read code's complexity
**What it is** — sequential steps **add** (keep the biggest); loops **multiply** the body by iterations; nested loops multiply together.
**Example**
```python
for i in range(n):        # O(n)
    for j in range(n):    # × O(n)
        work()            # = O(n^2)
```
**Real situation** — spotting the accidental nested loop in a code review that turns a 50 ms endpoint into 50 s at scale.
**Why it matters** — you can derive cost, not just memorize it. Watch loops that halve (O(log n)) and `1+2+…+n = O(n²)`.

### Amortized cost
**What it is** — average cost per operation over a worst-case **sequence** (not a probabilistic average). Rare expensive ops are spread over many cheap ones.
**Example** — list `append` is amortized O(1): doubling means total copy work over n appends is < 2n.
**Real situation** — a dict rehash or vector resize is a sudden O(n) **latency spike** even though throughput is fine — a p99 problem.
**Why it matters** — "amortized O(1)" still means one call can stall; that matters under a tail-latency SLO.

### Space complexity
**What it is** — extra memory beyond the input: auxiliary arrays, hashmaps, and the **recursion stack**.
**Example** — recursion of depth n is O(n) space even if each call does O(1) work.
**Real situation** — a deep recursive parse blowing the stack on a large file; memoization trading memory to save time.
**Why it matters** — "O(1) space" is wrong if you forgot the call stack. Time↔space is the central tradeoff lever.

### When Big-O lies
**What it is** — asymptotics ignore constants, cache locality, and memory bandwidth, which decide real performance at practical n.
**Example** — a contiguous array linear scan often beats a "faster" pointer-chasing tree for n in the thousands (cache).
**Real situation** — choosing an array over a linked list for a hot, small collection because cache misses dominate.
**Why it matters** — the senior move: lead with Big-O, then qualify "for the n we actually run, constants/cache may flip it — I'd measure."

## When to use which (reasoning axes)

| Ask | Why |
|---|---|
| What's the dominant op + how often? | Optimize the hot path |
| Worst vs average case? | Does the bad case occur in your workload / adversarial input? |
| Time vs space? | Can you precompute/cache, or are you memory-bound? |
| Latency vs throughput? | Amortized-but-spiky may break a tail SLO |
| How big is n really? | Small n favors simple/cache-friendly |

## Pitfalls
- Confusing **amortized** (worst-case over a sequence) with **average-case** (over random input).
- Claiming "O(1) space" but forgetting the recursion stack.
- Hidden factors — comparing length-L strings inside n lookups is O(n·L), not O(n).
- Quoting average, ignoring a worst case an adversary can trigger (e.g. hash flooding).
- Over-optimizing Big-O for tiny n where constants and cache dominate.
