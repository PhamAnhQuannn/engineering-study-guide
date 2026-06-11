# Concurrency Basics — Practice Questions

[← Topic overview](../README.md)

> Topic: Threads, locks, race conditions, deadlock, async.

Mix of recall, "explain to a junior," and MCQs. Answer before expanding.

---

### Q1. What's the difference between concurrency and parallelism?

**Answer:** **Concurrency** is a structuring property — composing a program out of independently progressing tasks (they may interleave on one core). **Parallelism** is a runtime property — actually executing tasks simultaneously on multiple cores. You can have concurrency without parallelism (async on a single thread) and parallelism without much concurrency (data-parallel SIMD). Concurrency is about *dealing with* many things at once; parallelism is about *doing* many at once.

---

### Q2. Explain to a junior why `count++` is dangerous across threads.

**Answer:** `count++` looks like one step but is actually three: read `count` into a register, add one, write back. If two threads both read the value `5` before either writes, both compute `6` and write `6` — one increment is lost (a **lost update**). The result depends on timing, which is a race condition. Fix it with an atomic increment (`AtomicInteger`, `atomic.AddInt`) or a lock around the read-modify-write.

---

### Q3. What are the four conditions for deadlock, and which is easiest to eliminate?

**Answer:** Mutual exclusion, hold-and-wait, no preemption, and circular wait — all four must hold simultaneously. The most practical to eliminate is **circular wait**: impose a **global lock ordering** so every thread acquires locks in the same canonical order, making a cycle impossible. Alternatives: lock timeouts/`tryLock` (attacks hold-and-wait), or acquiring all locks at once.

---

### Q4. When should you choose async/event-loop over a thread pool?

**Answer:** For **I/O-bound** workloads with many concurrent connections (web servers, proxies, chat). An event loop handles tens of thousands of connections on a few threads because most are just waiting on I/O — far cheaper than thread-per-connection (each OS thread costs ~MB of stack). For **CPU-bound** work, async doesn't help — you need real parallelism (process/thread pool across cores), and you must keep heavy CPU work *off* the event loop or it stalls everything.

---

### Q5. Explain to a junior what the Python GIL does to threading.

**Answer:** The Global Interpreter Lock lets only one thread execute Python bytecode at a time. So Python threads **do not** speed up CPU-bound work — they run one at a time for the actual computation. They *do* help **I/O-bound** work, because a thread releases the GIL while waiting on I/O, letting others run. For CPU parallelism in Python you use `multiprocessing` (separate processes, separate GILs) or native extensions that release the GIL.

---

### Q6. What does "visibility" mean in a memory model, and why isn't a lock just about mutual exclusion?

**Answer:** A thread's write may sit in a CPU register or core-local cache and never become visible to other threads without a memory barrier. **Visibility** guarantees that once a write happens, other threads see it. Locks (and `volatile`/atomics) do double duty: they provide **mutual exclusion** *and* establish **happens-before** relationships that flush/refresh memory so writes are visible and not reordered. That's why removing a lock can cause a thread to spin forever on a stale cached value even if there's no obvious "race."

---

### Q7. Why must you wait on a condition variable in a `while` loop, not an `if`?

**Answer:** Two reasons: **spurious wakeups** (a thread can wake without being signaled) and **stolen wakeups** (another thread may consume the condition between the signal and your wakeup). Re-checking the predicate in a `while` loop ensures you only proceed when the condition is actually true, re-waiting otherwise. An `if` would proceed on a false assumption.

---

### Q8 (MCQ). Which technique most directly prevents the "circular wait" deadlock condition?

A. Using more threads
B. Acquiring locks in a consistent global order
C. Increasing lock timeout
D. Using a read-write lock

**Answer: B.** A consistent global lock ordering makes a wait cycle impossible. Timeouts (C) attack hold-and-wait instead; the others don't address circular wait.

---

### Q9 (MCQ). A web service handles 20,000 mostly-idle WebSocket connections. Best model?

A. One OS thread per connection
B. Async event loop / coroutines
C. One process per connection
D. A single synchronous thread

**Answer: B.** Connections are I/O-bound and mostly idle; an event loop or lightweight coroutines handle them on a few threads. Thread/process-per-connection (A/C) exhausts memory; a single sync thread (D) can't multiplex.

---

### Q10 (MCQ). Which is a data race?

A. Two threads reading the same immutable value
B. Two threads incrementing a shared counter without synchronization
C. Two threads each writing to their own local variable
D. One thread reading after another finished writing, with a happens-before edge between them

**Answer: B.** Concurrent unsynchronized access where at least one is a write = data race. A is read-only, C is unshared, D is properly ordered.

---

### Q11 (MCQ). What does compare-and-swap (CAS) enable?

A. Coarse-grained locking
B. Lock-free algorithms via atomic conditional update
C. Guaranteed fairness
D. Elimination of all races automatically

**Answer: B.** CAS atomically updates a value only if it still equals an expected value, enabling retry-based lock-free structures. It doesn't guarantee fairness or auto-fix logic races.

---

### Q12. What is a livelock, and how does it differ from deadlock?

**Answer:** In a **deadlock**, threads are blocked and do nothing, waiting forever. In a **livelock**, threads are *active* — they keep changing state in response to each other but make no forward progress (two people repeatedly stepping aside to let each other pass). CPU is busy but useful work is zero. Fix livelock with **randomized backoff** so the symmetry breaks, or with a coordinating arbiter.

---

### Q13. Why is holding a lock while doing I/O or calling external code a bad idea?

**Answer:** I/O and external callbacks can be slow or block indefinitely, so holding the lock serializes all other threads behind that latency, crushing throughput. Worse, if the called code tries to acquire another lock, you risk **deadlock** (and you've lost control of lock ordering). Best practice: do the minimum under the lock (read/update shared state), copy what you need, release, then do the slow I/O outside the critical section.
