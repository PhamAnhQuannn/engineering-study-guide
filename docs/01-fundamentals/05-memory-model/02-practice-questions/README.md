# Memory Model — Practice Questions

[← Topic overview](../README.md)

> Topic: Stack vs heap, GC, references, leaks.

Mix of recall, "explain to a junior," and MCQs. Answer before expanding.

---

### Q1. What's the difference between stack and heap allocation, and why is the stack faster?

**Answer:** The **stack** holds per-call frames (locals, params, return address) in LIFO order; allocation is just bumping the stack pointer and deallocation is automatic on return — and the memory is cache-hot and contiguous, so access is fast. The **heap** holds dynamically allocated objects with arbitrary lifetimes; the allocator must find/manage free blocks (free lists, size classes), causing fragmentation and slower, scattered access. The stack is faster because alloc/free are O(1) pointer moves with no bookkeeping and excellent locality.

---

### Q2. Explain to a junior how garbage collection decides what to free.

**Answer:** GC frees objects that are **unreachable** — not reachable by following references starting from "roots" (local variables on the stack, globals, registers). It doesn't know or care whether you'll "use" an object again; it only checks whether any chain of references still points to it. So an object you'll never touch again but is still referenced (e.g., stuck in a cache) is considered *live* and won't be collected. That's why you can leak memory even with a GC.

---

### Q3. Why can't pure reference counting collect everything, and how is it fixed?

**Answer:** Reference counting frees an object when its count hits zero, but **reference cycles** keep counts above zero even when the cycle is unreachable from roots (A points to B, B points to A, nobody else points to either). Their counts never reach zero, so they leak. Fixes: add a **tracing cycle collector** (CPython does refcounting + a periodic cycle detector), or use **weak references** to break cycles so they don't contribute to the count.

---

### Q4. What is generational GC and what assumption makes it efficient?

**Answer:** Generational GC splits the heap into a **young generation** (nursery) and **old generation**, based on the **weak generational hypothesis**: most objects die young. It collects the young gen frequently and cheaply (a minor GC scans only a small region), promoting the few survivors to the old gen, which is collected rarely (major/full GC). Because most garbage is short-lived and concentrated in the young gen, the common case is a fast, small collection rather than scanning the whole heap.

---

### Q5. Explain to a junior how you can leak memory in Java (or any GC language).

**Answer:** A leak happens when you keep an object **reachable** that you no longer need, so the GC can't reclaim it and the live set grows until OOM. The classic example is an **unbounded cache or static `Map`** that you only ever add to — every entry stays referenced forever. Other common ones: registering an event listener and never removing it, or thread-locals on a reused thread pool. The fix is to **bound** such structures (LRU eviction), deregister listeners, or use **weak references** so unused entries get collected.

---

### Q6. What does "pass-by-value of the reference" mean in Java/Python?

**Answer:** When you pass an object to a method, you pass a **copy of the reference** (the pointer), not the object and not the variable itself. So inside the method you *can* mutate the object's fields and the caller sees it (same object), but if you **reassign** the parameter to a new object, the caller's variable is unchanged (you only changed your local copy of the pointer). It's neither pure pass-by-value (the object isn't copied) nor pass-by-reference (you can't rebind the caller's variable).

---

### Q7. Why are GC pauses a problem for latency-sensitive services, and what can you do?

**Answer:** Many collectors have **stop-the-world (STW)** phases where the application threads are paused so the heap can be scanned consistently. A long pause directly adds to request latency, causing **p99/p999 spikes** that violate SLOs even when average throughput is fine. Mitigations: use a **low-pause collector** (G1, ZGC, Shenandoah, Go's concurrent GC), **reduce allocation rate** (reuse buffers, avoid boxing in hot paths) so GC runs less often, right-size the heap, and tune generation sizes — guided by **GC metrics/logs**, not guesswork.

---

### Q8 (MCQ). Where are Java objects (as opposed to local primitives/references) allocated?

A. Stack
B. Heap
C. Registers only
D. The code segment

**Answer: B.** Objects live on the heap; local primitives and the references to objects live on the stack. (Escape analysis may stack-allocate provably non-escaping objects as an optimization.)

---

### Q9 (MCQ). Which is the most common cause of a memory leak in a garbage-collected language?

A. Forgetting to call `free`
B. An unbounded cache / collection that is never evicted
C. Stack overflow
D. Using too many local variables

**Answer: B.** Unintended reachability via an ever-growing cache/collection. (A) is a manual-memory bug; (C) is a stack issue, not a heap leak; (D) is harmless.

---

### Q10 (MCQ). What does setting a reference to `null` do?

A. Immediately frees the object's memory
B. Removes one reference; the object is collected later only if otherwise unreachable
C. Triggers a full GC
D. Causes a memory leak

**Answer: B.** Nulling removes one reference path; actual reclamation happens at the next GC and only if nothing else references the object.

---

### Q11 (MCQ). Which reference type does NOT prevent an object from being garbage collected?

A. Strong reference
B. Weak reference
C. A local variable on the stack
D. A static field holding it

**Answer: B.** Weak references don't keep objects alive — ideal for caches and listener maps. Strong refs, live locals, and static fields all keep objects reachable.

---

### Q12. Why are finalizers an unreliable way to release resources, and what should you use instead?

**Answer:** Finalizers/cleaners run at the GC's discretion with **no timing guarantee** — they may run late, never run before exit, can slow GC, and can even resurrect objects. So relying on them to close files, sockets, or native buffers risks running out of handles long before they fire. Use **deterministic release** instead: `try-with-resources`/`using`/`defer`/RAII to close resources at a well-defined point, with a finalizer only as a last-resort safety net.

---

### Q13. A deeply recursive function crashes with "stack overflow." Is this a heap memory leak? How would you fix it?

**Answer:** No — it's not a heap leak. The **stack** is a small fixed-size region per thread; each call pushes a frame, and recursion that's too deep (or has large stack locals) exhausts it, causing a stack overflow. Fixes: convert the recursion to **iteration with an explicit heap-allocated stack**, ensure proper base cases / bounded depth, apply tail-call elimination where the language supports it, or increase the stack size deliberately if depth is legitimately large. The heap is untouched by this failure.
