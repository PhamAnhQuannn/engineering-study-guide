# Memory Model — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Stack vs heap, GC, references, leaks.

Understanding where data lives, how long it lives, and who reclaims it is foundational to writing correct, performant, leak-free systems. At the senior bar, the value is in reasoning about **allocation cost, lifetime, GC behavior under load, and the patterns that cause leaks even in managed languages.**

---

## 1. The two regions: stack vs heap

| Aspect | Stack | Heap |
|---|---|---|
| Layout | LIFO, per-thread | Shared, unstructured |
| Allocation | Bump a pointer — ~free | Find/manage a free block — costlier |
| Lifetime | Tied to function call frame | Arbitrary; until freed/collected |
| Size | Small, fixed (e.g., 1–8 MB) | Large, grows |
| Access speed | Very fast (cache-hot, sequential) | Slower (scattered, indirection) |
| Managed by | Compiler (automatic on return) | Allocator + (GC or manual `free`) |

- **Stack:** holds call frames — local variables, parameters, return addresses, saved registers. Freed automatically when the function returns by simply moving the stack pointer. **Stack overflow** = too-deep recursion or huge stack locals exceed the fixed stack size.
- **Heap:** holds dynamically allocated objects whose lifetime outlives a single call or whose size isn't known at compile time. Allocation requires bookkeeping (free lists, size classes), causing **fragmentation** and slower access.

**What goes where (language-dependent):**
- In C/C++ you choose: stack value vs `malloc`/`new` on the heap.
- In Java, **objects** are on the heap; **primitives and references** (local) are on the stack (modulo escape analysis, which can stack-allocate non-escaping objects).
- In Go, the **compiler decides** via escape analysis: if a value's address escapes the function, it's heap-allocated; otherwise stack.
- In Python/JS, almost everything is a heap object; "variables" are references.

---

## 2. References, pointers, and value semantics

- **Value semantics:** the variable *is* the data; assignment/passing copies it (C structs by value, Go non-pointer types, Java primitives).
- **Reference/pointer semantics:** the variable holds the *address* of heap data; copying the variable copies the pointer, not the object — aliasing. Mutating through one reference is visible through all aliases.
- **Pass-by-value vs pass-by-reference:** Java and Python are **pass-by-value of the reference** ("pass-by-object-sharing") — you can mutate the pointed-to object but reassigning the parameter doesn't affect the caller. C++ has true references; pointers are passed by value but dereference shared memory.
- **Dangling pointer / use-after-free:** referencing freed memory (manual-memory languages) → undefined behavior, a top security bug class. Managed languages prevent this via GC.
- **Null/nil:** a reference to nothing; dereferencing it faults (NPE). Modern languages mitigate with optionals/nullability types.

---

## 3. Garbage collection (GC)

GC automatically reclaims heap objects that are no longer **reachable** from a set of **roots** (stack variables, globals, registers, active CPU registers). Reachability — not "no longer used" — defines liveness; an object you'll never touch again but is still referenced is *not* collected (logical leak).

**Core algorithms:**
- **Reference counting:** each object tracks how many references point to it; freed at count 0. Immediate reclamation, but **can't collect reference cycles** (A↔B keep each other alive) and has per-mutation overhead. Python uses refcounting + a cycle collector; Swift/ObjC use ARC.
- **Tracing GC (mark-sweep):** periodically traverse from roots marking reachable objects, then sweep the unmarked. Handles cycles. Variants:
  - **Mark-compact:** also moves survivors together to eliminate fragmentation (at the cost of moving objects / updating pointers).
  - **Copying / semi-space:** copy live objects to a fresh region; fast allocation, wastes half the space.
- **Generational GC:** exploits the *weak generational hypothesis* — most objects die young. Split heap into young (nursery) and old generations; collect the young gen frequently and cheaply (minor GC), promote survivors, collect old gen rarely (major/full GC). The dominant design (JVM, .NET, V8).
- **Concurrent / low-pause collectors:** do most work alongside the application to minimize stop-the-world pauses (JVM's G1, ZGC, Shenandoah; Go's concurrent GC). Tradeoff: lower latency for some throughput/CPU overhead.

**Stop-the-world (STW):** phases where the app is paused so the GC can scan consistently. Long STW pauses cause **latency spikes** / tail-latency violations — the classic GC pain in production.

---

## 4. GC tuning & behavior under load (senior signal)

- **Allocation rate** drives GC frequency. High churn (many short-lived objects) means frequent minor GCs; reduce by reusing buffers, object pools, or avoiding unnecessary boxing/allocation in hot paths.
- **Heap size tradeoff:** a bigger heap means less frequent GC but longer pauses when it happens and more memory cost; smaller heap means frequent GC. Tune to the latency/throughput goal.
- **Promotion / tenuring:** objects that survive long enough move to the old gen. Premature promotion (objects that should die young but get promoted) bloats old-gen collections.
- **Throughput vs latency collectors:** parallel/throughput collectors maximize work-per-CPU (good for batch); low-pause collectors (G1/ZGC) trade throughput for short, predictable pauses (good for services with latency SLOs).
- **GC logs / metrics** (pause times, frequency, heap occupancy, allocation rate) are how you diagnose — never guess.

---

## 5. Memory leaks — yes, even with GC

A leak in a managed language = **unintended reachability**: an object stays referenced (so GC won't collect it) but is never used again, growing the live set until OOM.

Common leak patterns:
- **Unbounded caches / maps** that never evict — the #1 managed-language leak. Use bounded caches with eviction (LRU) or weak references.
- **Listener/observer registration without deregistration** — the subject holds listeners forever.
- **Static/global collections** that only grow.
- **Thread-locals** on pooled threads not cleared.
- **Closures capturing large context** kept alive by long-lived callbacks.
- **Off-heap / native resources** (file handles, sockets, native buffers) not closed — GC doesn't promptly release these; use `try-with-resources`/`defer`/`using`/finalizers-as-backstop.

In manual-memory languages, leaks are forgotten `free`/`delete`; plus **double-free** and **use-after-free** corruption bugs. RAII (C++), ownership/borrowing (Rust) prevent these at compile time.

---

## 6. Weak vs strong references & finalizers

- **Strong reference:** keeps the object alive.
- **Weak reference:** does *not* prevent collection — used for caches and listener maps so entries vanish when no one else holds them (`WeakHashMap`, `WeakReference`, `ephemeron`).
- **Soft reference:** collected only under memory pressure (memory-sensitive caches in the JVM).
- **Finalizers / cleaners:** run before reclamation to release native resources — but are unreliable (no timing guarantee, can resurrect objects, slow GC). Prefer explicit close + RAII; use finalizers only as a safety net.

---

## 7. Common pitfalls & misconceptions

- **"GC means no memory leaks."** False — unintended reachability (unbounded caches, dangling listeners) leaks freely under GC.
- **"Setting a variable to null frees memory immediately."** No — it just removes one reference; collection happens later, only if nothing else references it.
- **Relying on finalizers** for timely resource release — they're non-deterministic; close explicitly.
- **Ignoring GC pauses** in a latency-sensitive service — high allocation rate → STW spikes → p99 violations.
- **Reference cycles under refcounting** (Python) without the cycle collector / with `__del__` complications.
- **Stack overflow from deep recursion** mistaken for a memory leak — it's the fixed stack, not the heap.
- **Holding the whole backing array via a sub-slice/substring** (Go slices, old Java `substring`) — silent retention.

---

## 8. What interviewers probe

- Do you know what lives on the stack vs heap, and who frees each?
- Can you explain reachability-based GC and why cycles defeat refcounting?
- Can you describe generational GC and the weak generational hypothesis?
- Can you explain how a leak happens *with* a GC, and name patterns?
- Do you understand GC pause / latency tradeoffs and how to diagnose with metrics?
- Do you know weak/soft references and why finalizers are unreliable?

---

## Quick-reference summary

- **Stack:** fast, automatic, LIFO, per-thread call frames; overflow on deep recursion.
- **Heap:** flexible lifetime, slower, managed by allocator + GC/manual free; fragments.
- **GC reclaims by reachability from roots,** not by "usefulness." Refcounting is immediate but cycle-blind; tracing handles cycles; **generational** GC collects the short-lived young gen cheaply.
- **STW pauses** cause latency spikes — pick throughput vs low-pause collectors per SLO; reduce allocation rate to reduce GC.
- **Leaks under GC = unintended reachability:** unbounded caches, un-deregistered listeners, growing statics; fix with eviction and weak references.
- **Finalizers are unreliable** — release native resources explicitly (RAII/`try-with-resources`/`defer`).
- **Diagnose with GC logs/metrics** (pause time, frequency, heap occupancy, allocation rate), never by guessing.
