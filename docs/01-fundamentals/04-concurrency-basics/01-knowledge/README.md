# Concurrency Basics — Knowledge

Concurrency = multiple tasks making progress in overlapping time. It unlocks throughput and responsiveness, but shared mutable state creates bugs that are timing-dependent and hard to reproduce.

## Key concepts

### Concurrency vs parallelism
**What it is** — concurrency is *dealing with* many things at once (interleaving); parallelism is *doing* many at once (multiple cores).
**Example** — one cook juggling 3 dishes (concurrency) vs three cooks each on a dish (parallelism).
**Real situation** — an async web server handles thousands of connections concurrently on a few threads (mostly waiting on I/O).
**Why it matters** — you can be concurrent on one core; you need multiple cores for true parallel speedup. They solve different problems.

### Race condition
**What it is** — the result depends on the unpredictable timing of threads touching shared state.
**Example**
```python
# two threads run balance += 1 (read, add, write) — updates get lost
balance = balance + 1   # NOT atomic
```
**Real situation** — two requests decrement the same inventory count and both see "1 left" → you oversell.
**Why it matters** — the classic correctness bug; it passes in tests and fails under load. Fix by making the update atomic or guarded.

### Lock / mutex
**What it is** — a gate so only one thread enters a **critical section** at a time.
**Example**
```python
import threading
lock = threading.Lock()
with lock:
    balance += 1          # now safe
```
**Real situation** — guarding a shared cache, counter, or connection pool.
**Why it matters** — restores correctness but **serializes** that section (less parallelism) and can deadlock. Hold locks briefly; never do I/O under a lock.

### Deadlock
**What it is** — threads each hold a lock the other needs, so nobody proceeds (needs: mutual exclusion + hold-and-wait + no preemption + circular wait).
**Example** — T1 locks A then wants B; T2 locks B then wants A.
**Real situation** — two services updating two rows in opposite order inside transactions → both hang until a timeout.
**Why it matters** — a full stall. Prevent by always acquiring locks in a **global order**, or using timeouts / lock-free structures.

### Atomicity
**What it is** — an operation that is indivisible — it fully happens or not at all, with no visible in-between.
**Example** — `Atomic.increment()` / a DB `UPDATE ... SET n = n + 1` is atomic where `read-modify-write` in app code is not.
**Real situation** — counters, "claim a job" (compare-and-set so only one worker grabs it).
**Why it matters** — pushing the atomic step down to the DB or a CPU primitive removes the race without app-level locking.

### Async / non-blocking I/O
**What it is** — instead of a thread blocking on I/O, register a callback / `await` and let the thread serve others until the result is ready.
**Example**
```python
async def handler():
    data = await db.fetch(id)   # frees the loop while waiting
    return data
```
**Real situation** — high-connection servers (Node, Python asyncio, Go) handle 10k+ idle/slow connections cheaply.
**Why it matters** — huge throughput for I/O-bound work with few threads. But one blocking call (or CPU-heavy work) stalls the whole loop.

## When to use which

| Workload | Approach |
|---|---|
| I/O-bound, many connections | async / event loop |
| CPU-bound, multiple cores | real threads / processes (parallelism) |
| Shared counter / claim-one | atomic op or DB-level update |
| Protect a short shared section | mutex (acquire in fixed order) |
| Producer/consumer handoff | thread-safe queue |

## Pitfalls
- Read-modify-write on shared state without atomicity → lost updates.
- Locks acquired in inconsistent order → deadlock; doing I/O while holding a lock → stalls.
- Assuming async = parallel: a CPU-heavy or blocking call freezes the event loop.
- Python's GIL: threads don't give CPU parallelism for pure-Python work — use processes.
- "Works on my machine" — races are timing-dependent; reproduce under load/stress, not single-threaded tests.
