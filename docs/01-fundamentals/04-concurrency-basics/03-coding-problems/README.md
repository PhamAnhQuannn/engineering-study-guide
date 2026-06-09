# Concurrency Basics — Coding Problems

[← Topic overview](../README.md)

> Topic: Threads, locks, race conditions, deadlock, async.

Each problem: statement + constraints → approach → complexity/notes → worked solution. Concurrency problems are judged on correctness under interleaving, not just asymptotics.

---

## Problem 1 — Fix a data race on a shared counter

**Statement:** Multiple threads each increment a shared counter N times. The naive version loses updates. Make it correct.
**Constraints:** Many threads; must end at exactly `threads × N`.

**Approach:** `count += 1` is a non-atomic read-modify-write. Guard it with a lock, or use an atomic.

**Notes:** Lock version is O(1) per op but contended; atomic CAS scales better under low contention.

```python
import threading

class Counter:
    def __init__(self):
        self._value = 0
        self._lock = threading.Lock()

    def increment(self):
        with self._lock:            # critical section: atomic RMW
            self._value += 1

    @property
    def value(self):
        with self._lock:
            return self._value
```

In Java prefer a lock-free atomic:

```java
import java.util.concurrent.atomic.AtomicLong;

AtomicLong count = new AtomicLong();
count.incrementAndGet();   // single atomic op, no explicit lock
```

---

## Problem 2 — Bounded blocking queue (producer/consumer)

**Statement:** Implement a thread-safe queue with capacity `C`: `put` blocks when full, `get` blocks when empty.
**Constraints:** Many producers/consumers; no busy-waiting.

**Approach:** A lock + two condition variables (`not_full`, `not_empty`). Always re-check predicates in `while` loops (spurious/stolen wakeups).

```python
import threading
from collections import deque

class BoundedQueue:
    def __init__(self, capacity):
        self.cap = capacity
        self.q = deque()
        self.lock = threading.Lock()
        self.not_full = threading.Condition(self.lock)
        self.not_empty = threading.Condition(self.lock)

    def put(self, item):
        with self.lock:
            while len(self.q) == self.cap:   # while, not if
                self.not_full.wait()
            self.q.append(item)
            self.not_empty.notify()

    def get(self):
        with self.lock:
            while not self.q:
                self.not_empty.wait()
            item = self.q.popleft()
            self.not_full.notify()
            return item
```

---

## Problem 3 — Deadlock-free transfer between two accounts

**Statement:** `transfer(a, b, amount)` must lock both accounts. Concurrent `transfer(x, y)` and `transfer(y, x)` deadlock if each grabs one lock first.
**Constraints:** Must be deadlock-free.

**Approach:** Break **circular wait** by imposing a global lock order — always lock the account with the smaller id first.

```python
import threading

class Account:
    def __init__(self, id, balance):
        self.id = id
        self.balance = balance
        self.lock = threading.Lock()

def transfer(src, dst, amount):
    first, second = (src, dst) if src.id < dst.id else (dst, src)
    with first.lock:                 # consistent global ordering
        with second.lock:
            if src.balance >= amount:
                src.balance -= amount
                dst.balance += amount
                return True
            return False
```

---

## Problem 4 — Thread-safe singleton (correct double-checked locking)

**Statement:** Lazily create exactly one instance under concurrency, without locking on every access.
**Constraints:** No torn/partial object visible to other threads.

**Approach:** Double-checked locking — but the field **must be `volatile`** so a partially-constructed object isn't published due to reordering.

```java
class Config {
    private static volatile Config instance;   // volatile is mandatory

    static Config getInstance() {
        Config local = instance;               // read once
        if (local == null) {
            synchronized (Config.class) {
                local = instance;
                if (local == null) {
                    instance = local = new Config();
                }
            }
        }
        return local;
    }
}
```

(In practice, prefer an initialization-on-demand holder class or an `enum` singleton, which are simpler and correct.)

---

## Problem 5 — Rate limiter with a semaphore (bound concurrency)

**Statement:** Allow at most `K` concurrent calls into a downstream dependency; others wait.
**Constraints:** Must release permits even on exceptions.

**Approach:** A counting semaphore with K permits; acquire before the call, release in `finally`.

```python
import threading

class ConcurrencyLimiter:
    def __init__(self, k):
        self.sem = threading.Semaphore(k)

    def call(self, fn, *args):
        self.sem.acquire()
        try:
            return fn(*args)         # at most k threads run here at once
        finally:
            self.sem.release()       # always release
```

---

## Problem 6 — Async fan-out with bounded concurrency

**Statement:** Fetch N URLs concurrently but with at most `limit` in flight; return all results.
**Constraints:** I/O-bound; don't open N sockets at once.

**Approach:** asyncio with a semaphore gating each task. Single-threaded event loop → no locks needed for in-loop state.

**Complexity:** Wall-clock ≈ ceil(N/limit) × per-request latency.

```python
import asyncio

async def fetch_all(urls, limit, fetch):
    sem = asyncio.Semaphore(limit)

    async def bounded(url):
        async with sem:             # cap in-flight requests
            return await fetch(url)

    return await asyncio.gather(*(bounded(u) for u in urls))
```

---

## Problem 7 — Once-only initialization (memoize under concurrency)

**Statement:** Run an expensive init exactly once even if many threads request it simultaneously; all should get the same result.
**Constraints:** No double initialization.

**Approach:** Guard with a lock and a "done" flag, or use a built-in `Once`/`call_once`.

```go
package config

import "sync"

var (
    once     sync.Once
    instance *Config
)

func Get() *Config {
    once.Do(func() {              // runs the func exactly once, ever
        instance = expensiveInit()
    })
    return instance
}
```

---

## Problem 8 — Detect a lost-update bug in given code (debug)

**Statement:** The snippet below intends to count completed jobs but reports too few. Identify and fix the bug.

```python
total = 0
def worker(jobs):
    global total
    for _ in jobs:
        total += 1          # BUG: non-atomic RMW across threads
```

**Diagnosis:** `total += 1` is read-modify-write; concurrent threads interleave and lose increments — a classic race. **Fix:** serialize the update with a lock (or use an atomic / per-thread local counts summed at the end to avoid contention):

```python
import threading
total = 0
lock = threading.Lock()

def worker(jobs):
    global total
    local = 0
    for _ in jobs:
        local += 1          # no contention in the hot loop
    with lock:
        total += local      # one synchronized merge per thread
```
