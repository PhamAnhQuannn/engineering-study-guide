# Concurrency Basics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Threads, locks, race conditions, deadlock, async.

Concurrency is about *structuring* a program as independent activities; parallelism is about *executing* them simultaneously on multiple cores. You can have concurrency without parallelism (async on one core) and parallelism without (much) concurrency (SIMD). At the senior bar, the value is in reasoning about **shared state, correctness under interleaving, and the tradeoffs between threading models** — not memorizing API names.

---

## 1. Concurrency vs parallelism vs async

- **Concurrency:** dealing with many things at once — composition of independently progressing tasks (a design property).
- **Parallelism:** doing many things at once — simultaneous execution on multiple cores (a runtime property).
- **Asynchrony:** not blocking while waiting — issue an operation and continue, get notified later. Often single-threaded (event loop), great for **I/O-bound** work.
- **Rule of thumb:** I/O-bound → async / more concurrency (threads or event loop hide latency); CPU-bound → parallelism (multiple cores doing real work).

---

## 2. Processes vs threads

- **Process:** isolated address space, own heap; communication via IPC (pipes, sockets, shared memory). Crash isolation, heavier context switch, no shared-memory bugs by default.
- **Thread:** lives inside a process, **shares the heap** with sibling threads; has its own stack and registers. Cheap to create/switch, but shared mutable state is the source of nearly all concurrency bugs.
- **Green/virtual threads & coroutines:** user-space scheduled (Go goroutines, Java virtual threads, Python asyncio tasks). Millions can exist; the runtime multiplexes them onto OS threads (M:N scheduling).

---

## 3. The core hazard: shared mutable state

A **race condition** occurs when the result depends on the nondeterministic timing/interleaving of threads accessing shared state, and at least one access is a write.

- Classic example: `count++` is **not atomic** — it's read → increment → write. Two threads can both read the old value and both write `old+1`, losing an update.
- **Data race** (a stricter notion): concurrent unsynchronized access to the same memory location where at least one is a write — undefined behavior in C/C++/Java's memory model. All data races are bugs; not all race conditions are data races (some are higher-level logic races even with atomic ops).
- **Atomicity, visibility, ordering** are the three things synchronization must provide:
  - *Atomicity:* an operation happens all-or-nothing.
  - *Visibility:* a write by one thread becomes visible to others (CPU caches/registers can hide writes — hence `volatile`/memory barriers).
  - *Ordering:* the compiler/CPU may reorder instructions; the **memory model** defines what reorderings are allowed and which barriers prevent them (happens-before relationships).

---

## 4. Synchronization primitives

- **Mutex / lock:** mutual exclusion — only one thread in the critical section. The default tool.
- **Reentrant lock:** the holding thread can re-acquire without deadlocking itself.
- **Read-write lock:** many readers OR one writer — good for read-heavy data; watch writer starvation.
- **Semaphore:** counter permitting up to N concurrent holders — bounds concurrency / models a resource pool.
- **Condition variable:** wait for a predicate, get signaled — always re-check the predicate in a `while` loop (spurious wakeups).
- **Monitor:** lock + condition variables bundled (Java `synchronized`, `wait/notify`).
- **Atomic variables / CAS:** compare-and-swap is the hardware primitive enabling **lock-free** algorithms — read value, compute new, atomically swap only if unchanged, else retry.
- **Barrier / latch:** synchronize a group of threads at a rendezvous point.

**Lock granularity tradeoff:** *coarse-grained* locks are simple but serialize and limit throughput; *fine-grained* locks scale but invite deadlock and are hard to get right. Lock-free is fastest under contention but very hard to write correctly.

---

## 5. Deadlock, livelock, starvation

**Deadlock** needs all four Coffman conditions simultaneously:
1. **Mutual exclusion** — resources held exclusively.
2. **Hold and wait** — hold one, wait for another.
3. **No preemption** — can't forcibly take a resource.
4. **Circular wait** — a cycle of threads each waiting on the next.

Break any one to prevent deadlock. Most practical: **impose a global lock ordering** (always acquire locks in the same order) to kill circular wait; or use **lock timeouts / `tryLock`** to break hold-and-wait.

- **Livelock:** threads keep responding to each other and make no progress (two people stepping aside in a hallway). Fix with randomized backoff.
- **Starvation:** a thread never gets the resource (unfair scheduling, writer starved by readers). Fix with fairness policies.

---

## 6. Async models

- **Event loop (reactor):** single thread, non-blocking I/O, callbacks/promises/`async-await`. No data races within the loop (cooperative), but a CPU-bound or blocking call **stalls the entire loop** — never block the event loop. Node.js, Python asyncio, Netty.
- **Thread-per-request:** simple mental model, but OS threads are heavy (~MB stacks); thousands of connections exhaust memory → the C10k problem.
- **Async/await:** syntactic sugar over state machines/futures; `await` yields control at suspension points. Cooperative scheduling → fewer races but you must avoid blocking calls and CPU hogs.
- **Structured concurrency:** scope task lifetimes to a block so children can't outlive the parent and errors/cancellation propagate cleanly (Kotlin coroutines, Java structured concurrency, Trio).

---

## 7. Language-specific gotchas

- **Python GIL:** the Global Interpreter Lock means only one thread executes Python bytecode at a time → threads don't parallelize CPU-bound work (use `multiprocessing` or native extensions). Threads still help I/O-bound work. (Free-threaded/no-GIL builds are emerging.)
- **Java:** rich `java.util.concurrent` — `ConcurrentHashMap`, `ExecutorService`, `CompletableFuture`, `volatile`, `AtomicInteger`; the Java Memory Model defines happens-before.
- **Go:** "share memory by communicating" — goroutines + channels; still has mutexes (`sync`) and a race detector (`-race`).
- **JavaScript:** single-threaded event loop; concurrency via async, true parallelism only via Web Workers/worker threads (message passing, no shared memory except `SharedArrayBuffer`).

---

## 8. Common pitfalls & misconceptions

- **"`count++` is atomic."** It isn't — read-modify-write. Use atomics or a lock.
- **Forgetting visibility** — a write under no synchronization may never be seen by another thread (cached in a register). `volatile`/atomics/locks establish happens-before.
- **Inconsistent lock ordering** → deadlock. Always acquire in a fixed global order.
- **Holding a lock during I/O or a callback** → contention, deadlock, or stalls.
- **Blocking the event loop** with sync I/O or heavy CPU.
- **Double-checked locking without `volatile`** — a classic broken idiom due to reordering/visibility.
- **Assuming threads parallelize CPU work in Python** — the GIL says otherwise.
- **Checking a condition variable with `if` instead of `while`** — spurious wakeups break it.

---

## 9. What interviewers probe

- Can you spot a race in `count++` and explain atomicity/visibility/ordering?
- Do you know the four deadlock conditions and how to break them (lock ordering)?
- Can you choose threads vs async vs multiprocessing for I/O- vs CPU-bound work?
- Do you understand the GIL / event-loop blocking traps?
- Can you reason about lock granularity and when lock-free/CAS is worth it?

---

## Quick-reference summary

- **Concurrency = structure; parallelism = simultaneous execution; async = don't block on I/O.**
- **I/O-bound → async/threads; CPU-bound → multiple processes/cores.**
- **Races** come from unsynchronized shared mutable state; fix with locks/atomics, which provide **atomicity, visibility, ordering**.
- **Deadlock** = the four Coffman conditions; break **circular wait** with a global lock order (most practical).
- **Async** scales I/O cheaply but must never block the event loop.
- **Python GIL** prevents thread CPU-parallelism; **Go** favors channels; **JS** is single-threaded.
- Prefer the simplest model that meets the requirement; reach for fine-grained/lock-free only under proven contention.
