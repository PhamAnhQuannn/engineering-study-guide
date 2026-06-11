# Memory Model — Knowledge / Study Notes

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we mastered [Algorithms](../../03-algorithms/01-knowledge/README.md) — the recipes that transform ShopFast's data. This topic goes one level deeper: *where* all that data actually lives, how the CPU sees it, and why "GC (Garbage Collection) handles memory" doesn't mean "no memory problems". **Next:** [Concurrency Basics](../../05-concurrency-basics/01-knowledge/README.md) — what happens when multiple threads access that memory simultaneously.

---

## Teaching arc: where ShopFast data actually lives

### What it is

The **memory model** describes where your program stores data, how long it lives, who is responsible for cleaning it up, and how fast the CPU can read it. It's the layer beneath all the data structures and algorithms we've studied — the physical substrate.

Think of a restaurant kitchen: the **stack** is the chef's immediate workspace — their cutting board, the knife in hand — small, fast, cleared as soon as a dish is done. The **heap** is the walk-in refrigerator — large, long-lived items stored there for anyone to access, but someone has to manage what stays and what gets thrown out. The **CPU cache** is the countertop between the two — a tiny, ultra-fast staging area that pre-loads items the chef is likely to need next.

For ShopFast these translate directly:
- Every HTTP request starts a call stack — local variables for that request live and die with it.
- The product catalog rows fetched from Postgres, the session dict, the order object — all on the heap.
- Whether those heap objects are laid out contiguously or scattered as pointer chains decides how fast the CPU can process them (cache locality).
- A module-level list used as an unbounded cache holds references to every product ever fetched — none become unreachable — memory climbs until the pod is OOM-killed (Out Of Memory killed).

### What it looks like

```
PROCESS MEMORY LAYOUT (simplified)

┌─────────────────────────────────┐  high address
│  STACK (per thread)             │  ← grows downward
│  [frame: handle_request]        │    local vars: request, user_id, …
│  [frame: get_product]           │    local vars: product_id, cache_key, …
│  [frame: db_query]              │    auto-freed when function returns
├─────────────────────────────────┤
│  HEAP                           │  ← grows upward
│  [Product object @ 0x7f2a]      │  referenced by cache dict
│  [Session dict @ 0x7f44]        │  referenced by Redis client
│  [Order list @ 0x7f88]          │  referenced by module-level var ← leak!
├─────────────────────────────────┤
│  BSS / Data / Code              │  static/global vars, program text
└─────────────────────────────────┘  low address

CPU CACHE HIERARCHY (latency)
  Registers    ~ 0.3 ns    tiny, directly in the CPU
  L1 cache     ~ 1 ns      64 KB per core
  L2 cache     ~ 4 ns      256 KB per core
  L3 cache     ~ 10 ns     shared across cores (MBs)
  RAM (DRAM)   ~ 100 ns    GBs — 100× slower than L1
  SSD          ~ 100 µs    1000× slower than RAM
  Network      ~ 1 ms+     10 000× slower than RAM

CACHE LINE: CPU loads 64 bytes at a time.
  Array [A][B][C][D][E][F][G][H]  → one cache-line load, all 8 elements available
  Linked list [A]→[B]→[C]→[D]    → each node is a separate pointer-chase, separate cache miss
```

### Implement it from scratch

**Understand stack vs heap with a Python lens**

```python
def handle_request(user_id: str):
    # 'user_id' is a local variable — lives in this call frame (conceptually "stack")
    # When handle_request returns, 'user_id' is gone automatically.
    
    session = load_session(user_id)   # session dict lives on the HEAP
    # 'session' is just a local reference (pointer) to the heap object
    process(session)
    # when handle_request returns, 'session' reference is gone
    # IF nothing else references the dict, GC can collect it

def load_session(user_id):
    return {"user_id": user_id, "cart": [], "token": "..."}  # heap allocation
```

**Aliasing bug — the "spooky action at a distance" ShopFast sees in config passing**

```python
# WRONG — aliasing: two modules share the same dict object
defaults = {"ttl": 60, "max_size": 1000}
redis_config = defaults        # same object, not a copy!
redis_config["ttl"] = 30       # mutates 'defaults' too!
print(defaults["ttl"])         # 30 — surprise!

# RIGHT — copy when you need isolation
import copy
redis_config = copy.copy(defaults)   # shallow copy: safe for flat dicts
redis_config["ttl"] = 30             # 'defaults' unchanged
```

**LRU (Least Recently Used) cache — bounded heap usage (the pattern ShopFast actually uses)**

```python
from functools import lru_cache

# WRONG — module-level unbounded cache → memory leak
_product_cache = {}
def get_product(product_id):
    if product_id not in _product_cache:
        _product_cache[product_id] = db_fetch(product_id)  # never evicted!
    return _product_cache[product_id]

# RIGHT — bounded LRU cache: at most 1024 entries, oldest evicted automatically
@lru_cache(maxsize=1024)
def get_product_cached(product_id: str):
    return db_fetch(product_id)   # GC can collect evicted entries
```

**Cache locality — why ShopFast prefers column arrays for analytics scans**

```python
import time

N = 1_000_000

# Row-oriented (dict list): each field access jumps across heap objects
products_rows = [{"id": i, "price": i * 0.99, "stock": i % 10} for i in range(N)]

# Column-oriented (separate arrays): price values are contiguous in memory
prices = [i * 0.99 for i in range(N)]

# Summing prices:
# rows version: Python must dereference each dict → N cache misses for "price"
# columns version: prices is a contiguous list → CPU prefetcher loads ahead → fast
start = time.perf_counter()
total = sum(p["price"] for p in products_rows)   # ~2× slower
row_time = time.perf_counter() - start

start = time.perf_counter()
total = sum(prices)                               # ~2× faster (contiguous)
col_time = time.perf_counter() - start
# The difference is entirely cache locality, not algorithmic complexity.
```

### Where it lives in real systems

| ShopFast component | Memory concern | Consequence |
|---|---|---|
| **Stateless app tier** | Each request's locals live and die with the call stack | No per-request memory accumulation; but shared heap (module-level state) is where bugs hide |
| **Redis session store** | Sessions externalised to Redis, not held in app heap | App pods can restart without losing sessions; Redis's own memory is bounded by `maxmemory` + LRU eviction policy |
| **Product cache (in-process)** | An unbounded module-level dict grows without bound | OOM kills the pod. Fix: `@lru_cache(maxsize=...)` or a time-to-live (TTL) eviction wrapper |
| **Postgres B+-tree traversal** | Node pointers scattered in memory on first access | Postgres buffer pool warms up over time; cold start after a pod restart = cache misses → slower p99 (99th-percentile) until warm |
| **Order JSON serialisation** | Large orders serialised to bytes on the heap | Short-lived; GC collects after the response is sent. Watch for unbounded order history being loaded all at once |
| **Analytics "top products" scan** | Scanning 60 GB of catalog data → memory bandwidth bound | Use columnar layout (Postgres indexes scan index leaves — contiguous pages) vs row heap — orders of magnitude faster for range aggregations |
| **GC pauses in high-traffic handlers** | Python's cyclic GC runs periodically, pausing all threads | Disable cyclic GC on worker processes with short-lived objects; or switch to PyPy/Go for latency-sensitive handlers |

### Types & differences

| Concept | One-line | What goes wrong if you ignore it |
|---|---|---|
| **Stack** | Auto-managed LIFO (Last In, First Out) call frames; fast, limited size | Deep recursion → stack overflow |
| **Heap** | Dynamic allocation; size only limited by RAM | Unbounded growth → OOM (Out Of Memory) kill |
| **GC (Garbage Collection) — tracing** | Reachability walk frees unreachable objects | Pauses; objects reachable via stale references = leak |
| **GC — reference counting** | Free when refcount hits 0 | Reference cycles never freed without a cyclic collector |
| **Cache locality** | Contiguous memory = CPU prefetcher wins | Pointer-heavy structures → cache miss every access → 100× slower |
| **Value semantics** | Assignment copies data | Unexpected isolation when you wanted sharing |
| **Reference semantics** | Assignment copies pointer | Unexpected sharing when you wanted isolation |
| **Aliasing** | Two names, one object | Mutation via one name surprises the other |

**Memory management strategies across languages ShopFast might use:**

| Language | Strategy | Tradeoff |
|---|---|---|
| Python | Reference counting + cyclic GC | Simple; GC pauses; no manual free |
| JavaScript/Node | Generational tracing GC | Fast for short-lived objects; occasional stop-the-world |
| Go | Tracing GC with very short pauses | Excellent for servers; GC tunable via `GOGC` |
| Java/JVM | Generational GC (G1, ZGC) | Mature, tunable; heap sizing is an ops discipline |
| Rust | Ownership + borrow checker | Zero GC pauses; compile-time safety; steep learning curve |
| C/C++ | Manual `malloc`/`free` | Maximum control; use-after-free, double-free bugs |

### Gotchas

- **"GC means no leaks"** — false. A reference held in a module-level list, an event listener never removed, or a growing global cache keeps objects reachable but unused. GC only collects *unreachable* objects. These leaks cause slow OOM kills in production, typically showing as steadily climbing RSS (Resident Set Size) over hours or days.
- **Sub-slice / sub-string keeping a large backing buffer alive.** In Go, slicing a 10 MB byte array and keeping a 10-byte sub-slice alive keeps the full 10 MB allocated. Copy the small slice to release the parent.
- **Deep recursion overflows the stack.** Python's default limit is 1 000 frames (`sys.getrecursionlimit()`). A recursive DFS (Depth-First Search) on a 10 000-node linked-list graph will hit this. Convert to an explicit stack (iteration) or raise the limit deliberately and comment why.
- **Ignoring cache locality flips Big-O comparisons.** A linked list and an array are both O(n) for a linear scan, but the array is ~10–100× faster in practice because the CPU prefetcher can load ahead on contiguous addresses. For hot loops in ShopFast analytics, layout matters more than algorithmic elegance.
- **Aliasing surprises at API boundaries.** Passing a config dict into a function and mutating it inside changes the caller's dict. Defensive copy at API boundaries (`copy.copy` or `dict(original)`) is the right habit.
- **GC pauses under load.** A Python cyclic GC collection triggered mid-request adds latency. Under heavy load on a large heap, pause times grow. Mitigate: keep objects short-lived (don't accumulate on the heap), disable cyclic GC on worker processes that only create short-lived objects, or use PyPy's incremental GC.
- **Value vs reference semantics varies by type.** In Python, integers and strings are value-like (immutable); lists and dicts are reference-like. In Go, arrays are values (copied on assignment), slices are references to an underlying array. Misunderstand this and you'll either over-copy (wasting memory) or under-copy (sharing when you shouldn't).

---

## Key concepts (reference)

### Stack vs heap
**What it is** — the **stack** holds call frames + local variables, freed automatically when a function returns (fast, LIFO). The **heap** holds dynamically-sized/long-lived objects, managed manually or by a GC (Garbage Collector).
**Example**
```python
def f():
    x = 5          # local — conceptually "stack"
    data = [0]*1000 # the list object lives on the heap; `data` references it
```
**Real situation** — deep recursion overflows the (small, fixed) stack; large buffers live on the heap.
**Why it matters** — stack is cheap but limited; heap is flexible but costs allocation + bookkeeping. Recursion depth = stack space.

### References / pointers & aliasing
**What it is** — a variable often holds a **reference** to a heap object, not the object itself; two names can alias the same object.
**Example**
```python
a = [1, 2]; b = a   # b aliases the same list
b.append(3)         # a is now [1,2,3] too
```
**Real situation** — passing a config dict around and one module mutates it, surprising everyone (shared mutable state).
**Why it matters** — explains "why did my object change?" bugs. Copy when you need isolation; know value vs reference semantics.

### Garbage collection (GC)
**What it is** — the runtime reclaims objects no longer reachable from your program (tracing / reference counting).
**Example** — Python frees an object when its refcount hits 0; a cyclic GC catches reference cycles.
**Real situation** — a request handler holds references in a module-level list "for caching" → objects never become unreachable → memory climbs.
**Why it matters** — frees you from manual `free`, but GC pauses add latency and **leaks still happen** via lingering references.

### Memory leak (managed style)
**What it is** — memory you no longer use but is still **reachable**, so GC can't reclaim it.
**Example** — an unbounded dict cache, an event listener never removed, a growing global list.
**Real situation** — a service's RSS (Resident Set Size) grows over days until OOM (Out Of Memory) killed; a sub-slice keeping a huge backing array alive.
**Why it matters** — the #1 long-running-service failure. Bound your caches (LRU/TTL), drop references you're done with.

### Cache locality
**What it is** — the CPU reads memory in cache lines; sequential, contiguous access is far faster than random pointer-chasing.
**Example** — summing an array (contiguous) vs walking a linked list (scattered nodes) — same Big-O, ~10–100× speed gap.
**Real situation** — choosing arrays/structs-of-arrays for hot loops; columnar storage for analytics scans.
**Why it matters** — explains why "asymptotically equal" structures differ wildly in practice; layout is a performance lever Big-O hides.

### Value vs reference semantics
**What it is** — value types are copied on assignment/pass; reference types share. Languages differ (Python = references for objects; Go/C++ let you choose).
**Example** — mutating a list passed into a function changes the caller's list (reference); an int does not (value).
**Real situation** — accidental mutation of a caller's argument; defensive copies at API boundaries.
**Why it matters** — controls who can see your mutations; the root of many "spooky action at a distance" bugs.

## When to use which

| Need | Lean toward |
|---|---|
| Small, short-lived locals | stack (automatic) |
| Large / long-lived / shared data | heap |
| Hot loop over many items | contiguous arrays (cache locality) |
| Isolation from a caller's data | copy (don't alias) |
| Bounded memory for a cache | LRU / TTL eviction |

## Pitfalls
- Deep recursion overflows the stack — convert to iteration or raise the limit deliberately.
- Aliasing surprises — sharing a mutable object then mutating it elsewhere.
- "GC means no leaks" — false; reachable-but-unused memory still leaks (unbounded caches, lingering refs).
- Sub-slice / substring keeping a large backing buffer alive — copy to release the parent.
- Ignoring cache locality — pointer-heavy structures can lose badly despite equal Big-O.
