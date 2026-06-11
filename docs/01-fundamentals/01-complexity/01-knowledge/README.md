# Complexity Analysis — Knowledge / Study Notes

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — This is where it all begins. Before we write a single line of ShopFast code, we need a *measuring tape* — a way to predict how an algorithm's cost grows as data grows. This topic gives us Big-O notation, the shared language for "will this still work at 10× the load?" **Next:** [Data Structures](../../02-data-structures/01-knowledge/README.md) — the containers (arrays, hashmaps, trees) we'll measure with that tape.

---

## Teaching arc: measuring ShopFast before building it

### What it is

**Complexity analysis** is the art of predicting how an algorithm's cost (time or memory) grows as its input grows — without running it and without caring about the specific machine. It's the shared engineering language for "will this still work at 10× the load?"

A good analogy: if you're catering a dinner party and you need to seat *n* guests, you might take O(n) time to assign one seat per guest — that's linear. But if you're also matching every guest to every other guest for a seating compatibility check, that's O(n²) — fine for 10 guests, painful for 1 000, and catastrophic for a million.

For ShopFast, complexity is the earliest checkpoint before code ships:
- A product search that's O(n²) in catalog size is fine at 1 000 SKUs, silently breaks at 1 million.
- A Redis LRU (Least Recently Used) eviction policy that's O(log n) per request stays fast at 10 million keys.
- A report that joins two tables in a nested loop is O(n·m) — two 100 K-row tables → 10 billion comparisons.

### What it looks like

```
THE COMPLEXITY LADDER (fastest → slowest growth)

O(1)        ──────────────────────────────────  flat
O(log n)    ─────────────────────────────/      logarithmic (doubles n → +1 step)
O(n)        ──────────────────────────/         linear
O(n log n)  ─────────────────────────/          "good sort"
O(n²)       ─────────────────────/              quadratic — watch out!
O(2ⁿ)       ─────────────────/                  exponential — only tiny n
O(n!)       ─────────────/                      factorial — brute-force only

READING CODE:
for i in range(n):      ← O(n)
    work()              → total O(n)

for i in range(n):      ← O(n)
    for j in range(n):  ← O(n) per outer iteration
        work()          → total O(n²)  (loops MULTIPLY)

while n > 1:            ← halves each step
    n //= 2             → O(log n)   (halvings SHRINK)
```

### Implement it from scratch

Complexity analysis is a reasoning skill, not code. The best way to internalise it is to *derive* the cost of code you write. Walk through each pattern:

**Derive O(n log n) for merge sort**

```python
def merge_sort(arr):
    # T(n) = 2·T(n/2) + O(n)
    # → Master theorem → O(n log n)
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left  = merge_sort(arr[:mid])   # T(n/2): recurse on half
    right = merge_sort(arr[mid:])   # T(n/2): recurse on other half
    return merge(left, right)       # O(n):   one linear merge pass

def merge(a, b):
    result, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            result.append(a[i]); i += 1
        else:
            result.append(b[j]); j += 1
    return result + a[i:] + b[j:]   # total: touches every element once → O(n)
```

**Spot the hidden O(n²) — a real ShopFast code-review trap**

```python
# WRONG — appears to be O(n) but is O(n²):
def find_duplicates(items):
    result = []
    for item in items:                  # O(n)
        if item not in result:          # O(n) — list scan!
            result.append(item)
    return result

# RIGHT — O(n) with a hash set:
def find_duplicates_fast(items):
    seen = set()
    result = []
    for item in items:                  # O(n)
        if item not in seen:            # O(1) average
            seen.add(item)
            result.append(item)
    return result
```

**Amortized analysis — why `list.append` is "O(1)" despite occasional O(n) copies**

```python
# Visualise the amortized cost over n appends:
# Append 1:    [A]                    copy cost: 0
# Append 2:    [A B]                  copy cost: 1 (double from 1→2)
# Append 3:    [A B C _]              copy cost: 2 (double from 2→4)
# Append 5:    [A B C D E _ _ _]      copy cost: 4 (double from 4→8)
# Total copies over n appends ≈ 1+2+4+8+…+n = 2n → O(n) total → O(1) amortized.
# BUT: that one O(n) copy is a real latency spike if it happens mid-request.
```

### Where it lives in real systems

| ShopFast concern | Complexity reality | Why it matters |
|---|---|---|
| **Catalog search (full scan)** | O(n) per query — fine at 10K products | At 1M products + 1 800 peak QPS (queries per second) → 1.8 billion comparisons/second. This is why ShopFast uses a B+-tree index: O(log n) per query. |
| **Session lookup (Redis hash)** | O(1) average | Every HTTP request touches this. Even O(log n) would add up across 1 800 QPS. Hash table amortized O(1) is the right answer. |
| **Order dedup (idempotency-key table)** | O(1) hash lookup vs O(n) scan | A retry of `POST /v1/orders` must check "have I seen this key?" If that's a table scan, it scales with order history. ShopFast stores keys in a hash-indexed dedup table. |
| **Report: "top products per category"** | Naive: O(n²) nested join → disaster | With an index + sort it's O(n log n). At 60 GB of catalog data, the difference is seconds vs hours. |
| **Redis LRU eviction** | O(1) with doubly-linked-list + hash map | ShopFast's Redis holds ~60 GB of hot product data. Eviction on every write must be O(1) or the cache becomes the bottleneck. |
| **Rehash latency (p99 spike)** | O(n) one-time | A Redis or Python dict that doubles at 67% load causes an O(n) pause. At 100 K entries that's a visible p99 (99th-percentile) latency spike — a real ops concern. |

### Types & differences

| Notation | Meaning | Analogy |
|---|---|---|
| **O(f(n))** | Upper bound — grows *no faster than* f(n) | "At most this slow" |
| **Ω(f(n))** | Lower bound — grows *at least as fast as* f(n) | "At least this fast" |
| **Θ(f(n))** | Tight bound — grows *exactly like* f(n) | "Exactly this fast" |
| **Amortized O(f)** | Average cost per op over a *worst-case sequence* | Spread a big rare cost over many cheap ones |
| **Average-case O(f)** | Expected cost over random input | Depends on input distribution — can mislead if input isn't random |
| **Worst-case O(f)** | Cost on the hardest possible input | The guarantee that matters for SLOs (Service Level Objectives) |

**The complexity ladder with practical break-even points at ~10⁸ simple ops/sec:**

| Class | Feasible n (rough) | ShopFast example |
|---|---|---|
| O(1) | any | Hash table lookup |
| O(log n) | any | B+-tree index seek |
| O(n) | ~10⁸ | Full catalog scan (acceptable only if indexed) |
| O(n log n) | ~10⁷ | Sort product results |
| O(n²) | ~10⁴ | Nested loop dedup — never in a hot path |
| O(2ⁿ) | n ≤ 25 | Brute-force coupon combinations |
| O(n!) | n ≤ 12 | Brute-force route permutations |

### Gotchas

- **Confusing amortized and average-case.** Amortized is a guarantee over a *worst-case sequence* of operations — it's stronger than average-case (which assumes random input). A hash table with amortized O(1) still has a real O(n) rehash moment; under a p99 (99th-percentile) SLO that matters.
- **"O(1) space" but forgetting the call stack.** A recursive function of depth n uses O(n) stack space even if each frame does O(1) work. Deep recursion on a large input (file parser, graph DFS) will overflow the stack.
- **Hidden constants in string operations.** Comparing n product names of average length L is O(n·L), not O(n). Hashing a 256-byte session token on every request costs more than hashing a 4-byte int.
- **Average case disguising a dangerous worst case.** Quicksort is O(n log n) *average* but O(n²) on sorted input with a naive pivot — an adversary or a sorted dataset triggers the worst case. Hash tables are O(1) average but O(n) with hash flooding.
- **Over-optimising Big-O for small n.** For a list of 20 items, a linear scan with cache-friendly contiguous memory beats a balanced tree with pointer-chasing and O(log n). The senior move: state the asymptotic complexity, then qualify "for the actual n we run, I'd measure cache effects."
- **Amortized cost is still not latency-safe.** A list append with amortized O(1) is fine for batch work but the one-in-n O(n) copy happens at an unpredictable moment — during a live request. Pre-allocate or use a structure without reallocation for latency-sensitive hot paths.

---

## Key concepts (reference)

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
**Why it matters** — "amortized O(1)" still means one call can stall; that matters under a tail-latency SLO (Service Level Objective).

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
