# Concurrency Basics — Knowledge / Study Notes

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we explored the [Memory Model](../../04-memory-model/01-knowledge/README.md) — stack vs heap and how values live in memory. This topic covers what happens when multiple requests hit ShopFast *at the same time*: how the server handles thousands of simultaneous connections, and why shared state (inventory counts, session data) breaks under concurrent writes if you're not careful. **Next:** [Language Deep-Dive](../../../02-languages-and-runtime/01-language-deep-dive/01-knowledge/README.md) — how your language of choice manages all of this for you.

---

## Teaching arc: handling thousands of ShopFast users at once

### What it is

**Concurrency** means multiple tasks making progress in overlapping time. It is what lets a single ShopFast server handle thousands of simultaneous users browsing, adding to cart, and checking out — without spinning up one OS (Operating System) thread per user.

The coffee-shop analogy: a single barista taking orders for many customers *concurrently* (writing one ticket while the espresso machine runs for another) is concurrency. Hiring three baristas so three drinks are being made *simultaneously* is parallelism. You can be concurrent on one CPU core; you need multiple cores for true parallelism.

The tricky part is **shared mutable state** — when two customers (threads/requests) both reach for the last cup at the same time. That's where race conditions, locks, and atomicity come in. For ShopFast, the hardest shared state is:
- **Inventory counts** (two checkouts racing to claim the last unit).
- **The session store** (concurrent requests reading/writing the same user session in Redis).
- **Order idempotency keys** (two retried requests trying to insert the same dedup key).

### What it looks like

```
CONCURRENCY vs PARALLELISM

One barista, 3 orders (CONCURRENT):
  time →
  [take order A][    espresso for A    ][take order B][milk for B][hand out A][hand out B]
                 ↑ while machine runs, take next order

Three baristas, 3 orders (PARALLEL):
  time →
  barista 1: [make drink A ─────────────────]
  barista 2: [make drink B ─────────────────]
  barista 3: [make drink C ─────────────────]

RACE CONDITION — two threads, one shared counter:
  Thread 1: read count=1 → compute 1+1=2 → (context switch) …
  Thread 2: read count=1 → compute 1+1=2 → write count=2
  Thread 1:                                 … write count=2   ← lost update!

LOCK — mutual exclusion:
  Thread 1: acquire lock → read 1 → write 2 → release
  Thread 2:   (waits)              → acquire lock → read 2 → write 3 → release

DEADLOCK:
  Thread 1: holds Lock A → waits for Lock B
  Thread 2: holds Lock B → waits for Lock A
  → neither can proceed (circular wait)
```

### Implement it from scratch

**Race condition and the fix — ShopFast inventory decrement**

```python
import threading

# WRONG — race condition: two checkout requests see count=1 and both succeed
inventory = {"widget": 1}

def checkout_unsafe(item):
    if inventory[item] > 0:              # Thread 1 reads 1 ✓
        inventory[item] -= 1             # Thread 2 also reads 1 ✓ → both decrement → -1
        return "sold"
    return "out of stock"

# RIGHT — mutex (mutual exclusion lock) serialises the critical section
lock = threading.Lock()

def checkout_safe(item):
    with lock:                           # only one thread enters at a time
        if inventory[item] > 0:
            inventory[item] -= 1         # read-modify-write is now atomic from other threads' view
            return "sold"
    return "out of stock"
```

**Async / non-blocking I/O — how ShopFast handles 1 800 QPS (queries per second) on few threads**

```python
import asyncio

# One event loop thread handles many concurrent requests.
# While one request awaits a DB/Redis response, the loop serves others.
async def get_product(product_id: str) -> dict:
    # 'await' suspends THIS coroutine and lets the loop run other work
    cached = await redis.get(f"product:{product_id}")   # non-blocking I/O
    if cached:
        return cached
    row = await db.fetchrow(                             # non-blocking DB query
        "SELECT * FROM products WHERE id = $1", product_id
    )
    await redis.setex(f"product:{product_id}", 60, row) # cache-aside write
    return row

# An HTTP framework like FastAPI or aiohttp schedules thousands of
# get_product() calls concurrently on this one loop.
```

**Producer/consumer with a thread-safe queue — order-processing workers**

```python
import queue, threading

order_queue = queue.Queue()   # thread-safe FIFO (First In, First Out) — no lock needed

def producer(orders):
    for order in orders:
        order_queue.put(order)          # blocks if queue is full (backpressure)

def worker():
    while True:
        order = order_queue.get()       # blocks until an item is available
        process_order(order)            # do the work
        order_queue.task_done()         # signal completion

# Spin up N workers for parallelism on CPU-bound order processing
for _ in range(4):
    threading.Thread(target=worker, daemon=True).start()
```

**Deadlock prevention — always acquire locks in a consistent global order**

```python
# Transferring between two accounts — lock both, but ALWAYS in id order
def transfer(from_acct, to_acct, amount):
    # Sort by id to ensure consistent acquisition order across all threads
    first, second = sorted([from_acct, to_acct], key=lambda a: a.id)
    with first.lock:
        with second.lock:               # T1 and T2 will both try first=lower_id → no circular wait
            from_acct.balance -= amount
            to_acct.balance   += amount
```

### Where it lives in real systems

| ShopFast component | Concurrency concern | Resolution |
|---|---|---|
| **Catalog reads (1 800 peak QPS)** | 1 800 concurrent requests → needs non-blocking I/O | Async HTTP server (FastAPI/Node) + async Redis/DB drivers; event loop handles thousands of waiting connections on a handful of threads |
| **Inventory decrement at checkout** | Race condition: two buyers claim the last unit simultaneously | Push the atomic decrement to Postgres: `UPDATE inventory SET count = count - 1 WHERE id = $1 AND count > 0` — the DB enforces atomicity, not the app |
| **Idempotency key dedup** | Two identical retried `POST /v1/orders` requests arrive simultaneously | Insert into dedup table with a UNIQUE constraint inside a transaction — only one insert wins; the other gets a duplicate-key error and returns the stored result |
| **Session read/write (Redis)** | Concurrent requests reading then updating the same session token | Redis is single-threaded internally — commands are atomic by design; MULTI/EXEC for multi-step session updates |
| **Payment settlement (async queue)** | Slow work pushed off the request path | Orders enqueued to a worker queue; workers process exactly-once with idempotency keys; circuit breaker (see Resilience) wraps the payment provider call |
| **Cart updates** | Multiple tab-opens can race to update the same cart | ShopFast cart = AP (Available and Partition-tolerant) / eventual; last-write-wins at the Redis level is acceptable for a cart (worst case: one item added twice → user removes it) |

### Types & differences

| Model | One-line | Reach for it when |
|---|---|---|
| **Async / event loop** | One thread, many interleaved I/O waits | I/O-bound: web servers, DB clients, network calls — ShopFast's primary model |
| **Thread pool** | Fixed threads share memory | CPU-bound segments within a mostly-async server; parallel DB fan-out |
| **Process per request (fork)** | Fully isolated memory | Maximum isolation; Python GIL (Global Interpreter Lock) workaround; slow startup |
| **Actor model** | Message-passing between isolated actors | Complex stateful concurrency without shared memory (Erlang, Akka) |
| **Lock / mutex** | Single-thread critical section | Short, CPU-only shared-state updates; never hold during I/O |
| **Atomic operation** | Hardware-level indivisibility | Counters, claim-one patterns; cheaper than a lock |
| **Lock-free / CAS** | Compare-and-swap in a loop | High-contention counters; avoid in app code — prefer DB atomics |

**Python-specific note:** Python's GIL (Global Interpreter Lock) prevents two threads from executing Python bytecode simultaneously. For CPU-bound work, use `multiprocessing` (separate processes, no GIL) or a compiled extension. For I/O-bound work (ShopFast's dominant case), `asyncio` or threads both work fine — threads release the GIL during I/O waits.

### Gotchas

- **"Works on my machine" — races are timing-dependent.** A race condition that involves a 50 ms window is invisible in a single-threaded test and explodes under 1 000 concurrent users. Reproduce under load; use thread sanitisers (`ThreadSanitizer`, Python's `threading` debug flags).
- **Async does not mean parallel.** One event loop thread handles one piece of code at a time. A CPU-heavy function (image resize, JSON parsing of a 10 MB payload) or a *blocking* call (`time.sleep`, synchronous DB driver) stalls the entire loop — all other requests freeze until it returns. Move CPU work to a thread pool (`asyncio.run_in_executor`) or a separate process.
- **Python GIL (Global Interpreter Lock) limits thread parallelism.** Python threads share one GIL — only one executes Python bytecode at a time. They're fine for I/O-bound work (the GIL is released during I/O) but give no CPU speedup for pure-Python computation. Use `multiprocessing` for CPU parallelism.
- **Deadlock requires four conditions — break any one.** Mutual exclusion + hold-and-wait + no preemption + circular wait. The easiest fix is a global lock-acquisition order. Timeouts (`lock.acquire(timeout=1.0)`) are a safety net, not a solution.
- **Doing I/O while holding a lock** stalls every other thread waiting for that lock for the full I/O duration. Rule: hold locks for pure CPU work only; release before any I/O.
- **Lost updates without atomicity at the DB level.** `inventory -= 1` in app code is read-modify-write — three separate steps. Under concurrent requests, two threads read the same count and both "succeed". The fix is a single atomic SQL `UPDATE … WHERE count > 0`, not app-level locking around a Python variable.

---

## Key concepts (reference)

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
- Python's GIL (Global Interpreter Lock): threads don't give CPU parallelism for pure-Python work — use processes.
- "Works on my machine" — races are timing-dependent; reproduce under load/stress, not single-threaded tests.
