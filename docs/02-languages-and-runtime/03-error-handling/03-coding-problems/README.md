# Error Handling — Coding Problems

[← Topic overview](../README.md)

> Topic: Exceptions, result types, defensive coding.

These problems exercise robust error handling: retries with backoff, result types, idempotency, resource cleanup, and context preservation. Solutions favor production-grade patterns over toy code.

---

### Problem 1 — Retry with exponential backoff + jitter

**Statement:** Implement `retry(fn, max_attempts, base_delay)` that retries a callable on transient failure, with exponential backoff and full jitter, and gives up after `max_attempts`, re-raising the last error. Only retry exceptions flagged transient.

**Constraints:** Cap delay; don't retry permanent errors; preserve the final exception.

**Approach:** Loop up to `max_attempts`; on a transient error, sleep `random(0, min(cap, base * 2^attempt))`; on a permanent error or final attempt, re-raise.

**Complexity:** O(max_attempts) calls; sleep time bounded by the cap. Space O(1).

```python
import random, time

class TransientError(Exception): ...
class PermanentError(Exception): ...

def retry(fn, max_attempts=5, base_delay=0.1, cap=10.0):
    last = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except PermanentError:
            raise                       # never retry permanent
        except TransientError as e:
            last = e
            if attempt == max_attempts - 1:
                break
            sleep = random.uniform(0, min(cap, base_delay * (2 ** attempt)))
            time.sleep(sleep)           # full jitter
    raise last                          # preserve final cause
```

---

### Problem 2 — Idempotent request handler

**Statement:** Implement a payment endpoint that is safe to retry: the same `Idempotency-Key` must never charge twice, and must return the original result on replay.

**Constraints:** Concurrent retries with the same key must not double-charge.

**Approach:** Atomically reserve the key (e.g., `INSERT ... ON CONFLICT DO NOTHING` / `SETNX`). If the key is new, process and store the result. If it already exists, return the stored result. The atomic reserve is what prevents the race.

**Complexity:** O(1) per request (single keyed lookup/insert).

```python
def charge(idempotency_key, amount, store):
    existing = store.get(idempotency_key)
    if existing is not None:
        return existing                      # replay: return prior result

    # Atomic "reserve" — only one concurrent caller wins.
    if not store.put_if_absent(idempotency_key, status="in_progress"):
        return store.get(idempotency_key)    # another worker is/was handling it

    result = payment_gateway.charge(amount)  # the irreversible side effect
    store.put(idempotency_key, result)       # persist final result
    return result
```

---

### Problem 3 — Result type in Java (no exceptions for control flow)

**Statement:** Implement a generic `Result<T, E>` with `map`, `flatMap`, and `getOrElse`, so callers compose fallible steps without try/catch on the happy path.

**Constraints:** Immutable; exhaustively handles ok/err.

**Approach:** A sealed type with `Ok` and `Err` variants. `map` transforms the success value; `flatMap` chains another fallible step (short-circuits on `Err`).

**Complexity:** O(1) per combinator.

```java
sealed interface Result<T, E> permits Result.Ok, Result.Err {
    record Ok<T, E>(T value) implements Result<T, E> {}
    record Err<T, E>(E error) implements Result<T, E> {}

    default <U> Result<U, E> map(java.util.function.Function<T, U> f) {
        return switch (this) {
            case Ok<T, E> ok  -> new Ok<>(f.apply(ok.value()));
            case Err<T, E> e  -> new Err<>(e.error());
        };
    }
    default <U> Result<U, E> flatMap(java.util.function.Function<T, Result<U, E>> f) {
        return switch (this) {
            case Ok<T, E> ok  -> f.apply(ok.value());
            case Err<T, E> e  -> new Err<>(e.error());
        };
    }
    default T getOrElse(T fallback) {
        return this instanceof Ok<T, E> ok ? ok.value() : fallback;
    }
}
```

---

### Problem 4 — Guaranteed resource cleanup under failure

**Statement:** Open two resources (DB connection, file), do work, and guarantee **both** are closed even if work throws — and even if the *second open* throws after the first succeeded.

**Constraints:** No leaks on any error path; report the original error, not a cleanup error.

**Approach:** Use `try-with-resources` (Java) / context managers / `defer` (Go), which close in reverse order and surface the primary exception (cleanup failures become *suppressed* exceptions).

**Complexity:** O(1) overhead.

```go
func process(path string) (err error) {
    db, err := openDB()
    if err != nil {
        return fmt.Errorf("open db: %w", err)
    }
    defer db.Close()                 // runs even if file open fails

    f, err := os.Open(path)
    if err != nil {
        return fmt.Errorf("open file %s: %w", path, err)
    }
    defer func() {
        if cerr := f.Close(); cerr != nil && err == nil {
            err = cerr               // surface close error only if no prior error
        }
    }()

    return doWork(db, f)
}
```

---

### Problem 5 — Wrap and preserve error context across layers

**Statement:** A repository call fails deep in the stack. Make the error message, as seen at the API layer, read like a breadcrumb trail (`handle request -> load order 42 -> query db: connection refused`) without losing the root cause.

**Constraints:** Root cause must remain programmatically inspectable.

**Approach:** Wrap at each layer with `%w` (Go) / `from e` (Python) / cause constructor (Java), adding context but keeping the chain. Inspect the root with `errors.Is`.

**Complexity:** O(depth) wrapping.

```go
// repo layer
func (r *Repo) GetOrder(id int) (*Order, error) {
    o, err := r.db.Query(id)
    if err != nil {
        return nil, fmt.Errorf("query db: %w", err)
    }
    return o, nil
}
// service layer
func (s *Service) Load(id int) (*Order, error) {
    o, err := s.repo.GetOrder(id)
    if err != nil {
        return nil, fmt.Errorf("load order %d: %w", id, err)
    }
    return o, nil
}
// handler: errors.Is(err, sql.ErrConnRefused) still works on the wrapped chain
```

---

### Problem 6 — Timeout a slow operation

**Statement:** Call a dependency that may hang; bound it to 2 seconds and return a timeout error instead of blocking forever, releasing resources.

**Constraints:** Don't leak the underlying goroutine/thread's resources beyond cancellation.

**Approach:** Use a cancellable context/deadline. The operation observes cancellation and stops; the caller returns promptly.

**Complexity:** O(1); bounded latency = timeout.

```go
func callWithTimeout(ctx context.Context) (Resp, error) {
    ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
    defer cancel()                       // always release the timer

    ch := make(chan Resp, 1)             // buffered so the worker never blocks
    go func() { ch <- dependency.Do(ctx) }()

    select {
    case r := <-ch:
        return r, nil
    case <-ctx.Done():
        return Resp{}, fmt.Errorf("dependency call: %w", ctx.Err()) // deadline exceeded
    }
}
```

---

### Problem 7 — Validate untrusted input at the boundary

**Statement:** Parse and validate an incoming JSON `CreateUser` request, rejecting bad data with a precise, aggregated error (all field errors at once), and produce a trusted typed value for the rest of the system.

**Constraints:** Don't leak internal errors; collect all violations, not just the first.

**Approach:** Validate at the edge, accumulate field errors, return 400 with a structured list. Downstream code receives an already-valid value and need not re-check.

**Complexity:** O(fields).

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class CreateUser:
    email: str
    age: int

def parse_create_user(payload: dict) -> CreateUser:
    errors = []
    email = payload.get("email", "")
    if "@" not in email:
        errors.append({"field": "email", "msg": "invalid email"})
    age = payload.get("age")
    if not isinstance(age, int) or age < 0:
        errors.append({"field": "age", "msg": "age must be a non-negative int"})
    if errors:
        raise ValidationError(errors)      # mapped to HTTP 400 at the boundary
    return CreateUser(email=email, age=age) # trusted downstream
```
