# Memory Model — Knowledge

Where your program puts data — stack vs heap, who frees it, how the cache sees it — drives speed, memory use, and a whole class of bugs (leaks, dangling references).

## Key concepts

### Stack vs heap
**What it is** — the **stack** holds call frames + local variables, freed automatically when a function returns (fast, LIFO). The **heap** holds dynamically-sized/long-lived objects, managed manually or by a GC.
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
**Real situation** — a service's RSS grows over days until OOM-killed; a sub-slice keeping a huge backing array alive.
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
