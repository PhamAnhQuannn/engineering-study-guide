# Error Handling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Exceptions, result types, defensive coding.

Error handling separates seniors from juniors faster than almost any other topic, because it forces judgment: which errors are recoverable, where to handle vs propagate, how to fail without losing context, and how to keep systems resilient under partial failure. This note covers the models (exceptions vs result types vs error values), the discipline (fail-fast, defensive coding, error boundaries), and the distributed-systems angle (retries, idempotency, timeouts).

---

## 1. Error models across languages

### Exceptions (Java, Python, C#, JS, Ruby)
Control flow jumps from the throw site up the call stack to the nearest matching handler, unwinding frames.
- **Checked vs unchecked (Java)**: *checked* exceptions (`IOException`) must be declared/handled — compiler-enforced, but cause boilerplate and leaky abstractions; *unchecked* (`RuntimeException`) need not be. The industry has largely soured on checked exceptions (Kotlin dropped them).
- **Pros**: clean happy path, can't silently ignore (in checked form), carries stack traces and context.
- **Cons**: invisible control flow ("comefrom"), easy to catch-too-broad or swallow, exceptions-as-control-flow is slow and obscures logic.

### Error values (Go, C, older idioms)
Functions return `(value, error)`; you check explicitly: `if err != nil`.
- **Pros**: errors are explicit, in the type signature, impossible to ignore by accident (linters enforce). Local reasoning.
- **Cons**: verbose; easy to forget to wrap context; the typed-nil interface trap.
- Go adds `errors.Is`/`errors.As`/`%w` wrapping, `panic`/`recover` for truly exceptional cases.

### Result / Either types (Rust, Scala, Kotlin, FP)
`Result<T, E>` / `Either<E, T>` / `Option<T>` make errors part of the value, composed monadically.
- **Pros**: type-checked exhaustiveness (must handle `Err`), composable (`?` operator, `map`/`and_then`), no hidden control flow.
- **Cons**: ceremony for deep call chains; needs language support (pattern matching, `?`).

### Choosing a model
You usually inherit it from the language. The senior skill is using whatever the language gives you **idiomatically and consistently** — not bolting Go-style returns onto Java, not swallowing Rust `Result`s with `.unwrap()` everywhere.

---

## 2. Taxonomy of errors

- **Programmer errors / bugs** (null deref, index out of bounds, contract violations): should **fail fast and loud**, ideally crash in dev/test. Don't "handle" a bug — fix it. (Go: `panic`; assertions.)
- **Operational / expected errors** (network timeout, file not found, validation failure, 4xx from a dependency): part of normal operation; handle gracefully, retry or surface a clean message.
- **Recoverable vs unrecoverable**: can the caller do something meaningful? If yes, return/propagate a typed error. If no, fail fast.
- **Transient vs permanent**: transient (timeout, 503, rate limit) → retry with backoff; permanent (400, 404, auth failure) → do **not** retry.

Mapping these correctly is the heart of resilient design.

---

## 3. Principles & discipline

- **Fail fast**: detect invalid state at the earliest point (validate at boundaries, assert invariants). The longer a bad value travels, the harder the root cause.
- **Don't swallow errors**: empty `catch {}` blocks and bare `except: pass` hide failures and create silent data corruption. At minimum log with context; ideally handle or rethrow.
- **Preserve context / chain causes**: wrap with cause (`throw new X(msg, cause)`, Go `fmt.Errorf("...: %w", err)`, Python `raise X from e`). Never discard the stack trace.
- **Fail at the right level (error boundaries)**: handle where you have enough context to make a decision. Low-level code propagates; a boundary (request handler, job runner, UI) decides retry/log/respond. Translate low-level errors into domain errors at layer boundaries.
- **Don't use exceptions for control flow**: expected outcomes (item not found) are values, not exceptions, on hot paths.
- **Idempotency**: design operations so retries are safe (see distributed delivery semantics). Critical because retries are how you survive transient errors.
- **Defensive coding, in moderation**: validate untrusted input rigorously at the boundary; trust your own validated internals. Over-defensive code (null-checking everything everywhere) hides bugs and bloats logic — validate once at the edge, then rely on types.
- **Cleanup guarantees**: `finally` / `try-with-resources` / `defer` / context managers / RAII to release resources even on the error path.

---

## 4. Resilience patterns (the distributed angle)

- **Retries with exponential backoff + jitter**: retry transient failures, but back off to avoid hammering a struggling dependency; add jitter to prevent thundering-herd synchronization. Cap total attempts/time.
- **Timeouts everywhere**: a call with no timeout is a latent hang and a resource leak; set them on every network/IO call and propagate deadlines.
- **Circuit breaker**: after N consecutive failures, "open" and fail fast for a cooldown so you stop wasting resources and give the dependency time to recover; "half-open" probes recovery.
- **Bulkheads**: isolate resource pools so one failing dependency can't exhaust threads/connections for everything.
- **Graceful degradation / fallbacks**: serve stale cache, a default, or a reduced feature instead of a hard failure.
- **Dead-letter queues**: park messages that fail repeatedly for later inspection instead of blocking the stream or infinite-retrying.
- **Saga / compensation**: in distributed transactions, undo prior steps when a later step fails (no global rollback available).

---

## 5. Observability of errors

- **Structured logging** with correlation/trace IDs so an error can be traced across services.
- **Error categorization & rates** feeding alerts/SLOs (distinguish 4xx user errors from 5xx server errors).
- **Don't log secrets / PII** in error messages or stack traces.
- **Actionable messages**: an error should tell you *what failed, with what input/context, and ideally what to do*.

---

## 6. Common pitfalls & misconceptions

- Catching `Exception`/`Throwable` broadly and swallowing it.
- Logging **and** rethrowing the same error at every layer → log spam, lost signal. Log once, at the boundary.
- Retrying non-idempotent operations → duplicates (double charges).
- Retrying permanent errors (4xx) → wasted load, no recovery.
- Returning `null` to signal "not found" → `NullPointerException` downstream; prefer `Optional`/`Result`.
- Using exceptions for normal control flow on hot paths (slow + obscure).
- No timeouts → cascading hangs and connection-pool exhaustion.
- Exposing internal errors/stack traces to end users (info leak + bad UX).
- "It compiles, so errors are handled" — checked exceptions caught with empty blocks are *worse* than unchecked.

---

## 7. What interviewers probe

- "When do you use exceptions vs return values vs `Result`?"
- "How do you preserve error context across layers?"
- "Which errors do you retry, and how?" (transient vs permanent, backoff+jitter, idempotency).
- "Walk me through your timeout/retry/circuit-breaker strategy for calling a flaky dependency."
- "What's wrong with `catch (Exception e) {}`?"
- "How do you handle partial failure in a multi-step operation?" (saga/compensation, idempotency).
- "How do you keep error handling from drowning the happy path?" (boundaries, types, fail-fast).

---

## Quick-reference summary

| Question | Heuristic |
|---|---|
| Exception or value? | Bug/exceptional → exception/panic-then-fix; expected outcome → value/`Result`. |
| Handle or propagate? | Propagate until you have enough context to decide; handle at a boundary. |
| Retry or not? | Retry **transient** + **idempotent** with backoff+jitter; never retry permanent (4xx) or non-idempotent. |
| Catch broad or narrow? | Narrow, specific types; never swallow; preserve cause. |
| Defensive how much? | Rigorous at trust boundaries; rely on types internally. |
| Cleanup? | `finally` / try-with-resources / `defer` / context manager / RAII. |

**Three anchors:** (1) fail fast on bugs, handle expected errors gracefully; (2) preserve context and decide at the right boundary; (3) make retries safe with idempotency + backoff + timeouts + circuit breakers.
