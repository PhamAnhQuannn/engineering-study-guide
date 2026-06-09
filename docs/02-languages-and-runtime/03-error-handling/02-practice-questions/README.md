# Error Handling — Practice Questions

[← Topic overview](../README.md)

> Topic: Exceptions, result types, defensive coding.

Factual recall, "explain to a junior," and MCQs. Answer before checking.

---

### Q1. Checked vs unchecked exceptions in Java — what's the difference and why has the industry cooled on checked?

**Answer:** **Checked** exceptions (subclasses of `Exception` but not `RuntimeException`, e.g., `IOException`) must be declared in the method signature and caught or propagated — the compiler enforces it. **Unchecked** (`RuntimeException`, `Error`) need not be declared. Checked exceptions were meant to force handling, but in practice they: leak implementation details up the call stack (every caller must know about `SQLException`), break abstraction, don't compose with lambdas/streams, and tempt developers to write empty `catch` blocks or wrap-and-rethrow boilerplate. Kotlin dropped them entirely; modern Java often wraps checked into unchecked at boundaries. Use checked only for genuinely recoverable, caller-actionable conditions.

---

### Q2. Which errors should you retry, and how should you retry them?

**Answer:** Retry **transient** failures (network timeouts, connection resets, HTTP 503/429, deadlocks) — **only** if the operation is **idempotent** (or made idempotent with a dedup key). Do **not** retry **permanent** errors (HTTP 400/401/403/404, validation failures) — they'll never succeed and just add load. How: **exponential backoff** (delays grow: 1s, 2s, 4s...) plus **jitter** (randomization to avoid synchronized thundering herds), a **cap** on attempts and total time, and ideally a **circuit breaker** so you stop retrying a dependency that's clearly down. Always pair with timeouts.

---

### Q3. "Explain to a junior": what's wrong with `catch (Exception e) {}`?

**Answer:** It **swallows the error silently** — the program keeps running as if nothing happened, but the operation actually failed. Now you have corrupted/missing data with no log, no alert, and no stack trace, so when symptoms appear hours later you have no idea where it started. It also catches *too broadly* — including bugs like `NullPointerException` that you didn't intend to handle. Fix: catch the **specific** exception you can actually handle, do something meaningful (recover, or log with context and rethrow), and never leave the block empty. "Failing loudly" is a feature.

---

### Q4. How do you preserve error context as an error propagates across layers?

**Answer:** **Chain the cause** instead of discarding it. Java: `throw new ServiceException("loading user " + id, e)` (the original `e` becomes the cause, preserving its stack trace). Python: `raise ServiceError(...) from e`. Go: `fmt.Errorf("loading user %d: %w", id, err)` then inspect with `errors.Is`/`errors.As`. Also **translate** low-level errors into domain errors at layer boundaries (don't leak `SQLException` into your HTTP layer), and **add context at each wrap** (which entity, which input). Log once at the boundary, not at every layer, to avoid log spam.

---

### Q5. What is idempotency and why is it central to error handling?

**Answer:** An operation is **idempotent** if performing it multiple times has the same effect as performing it once (`PUT /user/5 {name}` always sets the same state; `set x = 5`). It matters because **retries are how you survive transient failures**, but a retry might happen after the first attempt *actually succeeded* (the success response was lost). If the operation isn't idempotent, the retry double-applies it (double charge, duplicate order). You make non-idempotent operations safe with an **idempotency key**: the client sends a unique key, the server records it, and dedupes repeated requests with the same key.

---

### Q6. When is returning `null` to signal "not found" a bad idea, and what's better?

**Answer:** `null` carries no information ("not found"? "error"? "empty"?), isn't enforced by the type system, and pushes the burden onto every caller to remember a null-check — forget one and you get a `NullPointerException` far from the cause. Better: return an `Optional<T>`/`Option<T>` (forces the caller to handle absence), a `Result<T, E>` (distinguishes not-found from error), or a domain "empty" object where appropriate. These make absence explicit and type-checked.

---

### Q7. Explain the circuit breaker pattern and its three states.

**Answer:** A circuit breaker stops calls to a failing dependency to avoid wasting resources and to let it recover. **Closed**: calls flow normally; failures are counted. After a failure threshold it trips to **Open**: all calls fail fast immediately (no network call) for a cooldown period — this sheds load from the struggling dependency and keeps your threads/connections free. After the cooldown it goes **Half-Open**: a limited number of probe calls are allowed; if they succeed it closes again, if they fail it re-opens. It prevents cascading failures and the resource exhaustion that comes from piling retries onto a dead service.

---

### Q8 (MCQ). Which HTTP status code is generally safe to retry?

- A. 400 Bad Request
- B. 403 Forbidden
- C. 503 Service Unavailable
- D. 404 Not Found

**Answer: C.** 503 is transient (server temporarily overloaded/down) and typically retriable with backoff (often with a `Retry-After` header). 400/403/404 are permanent client-side conditions — retrying changes nothing and adds load.

---

### Q9 (MCQ). The "fail fast" principle means:

- A. Catch and ignore errors to keep running.
- B. Detect and surface invalid state at the earliest possible point.
- C. Use the fastest possible exception class.
- D. Retry immediately without backoff.

**Answer: B.** Failing fast surfaces bad state close to its source, making root-cause diagnosis far easier than letting a bad value propagate deep before exploding.

---

### Q10 (MCQ). Which guarantees resource cleanup even when an exception is thrown?

- A. A regular `catch` block
- B. `try-with-resources` / `finally` / `defer` / context manager
- C. The garbage collector
- D. A `return` statement

**Answer: B.** These run on both the success and error paths. The GC reclaims memory but not deterministically and doesn't release non-memory resources (file handles, sockets, locks) in time.

---

### Q11. What's the difference between defensive coding and over-defensive coding?

**Answer:** **Defensive coding** validates **untrusted input at trust boundaries** — API request bodies, file contents, user input, responses from external services — rejecting bad data early with clear errors. **Over-defensive coding** null-checks and re-validates everything everywhere, including your own already-validated internal data. That bloats logic, hides real bugs (a null that "can't happen" gets silently defaulted instead of crashing), and degrades readability. The discipline: validate **once** at the edge, encode the validated shape in types, then trust those types internally.

---

### Q12. How would you handle partial failure in a multi-step operation (e.g., create order → charge card → reserve inventory)?

**Answer:** There's no distributed ACID rollback, so use the **saga / compensation** pattern: each step has a compensating action that undoes it. If "reserve inventory" fails after the card was charged, run the compensation "refund card." Make each step **idempotent** (so retries are safe) and persist progress (an outbox/state machine) so a crash mid-saga can resume or compensate. Alternatively, restructure so the risky/irreversible step is last, or use a two-phase reservation (tentative hold → confirm). The interview signal is recognizing that you can't just `try/catch` across service boundaries.
