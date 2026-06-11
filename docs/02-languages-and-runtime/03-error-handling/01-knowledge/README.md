# Error Handling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Exceptions, result types, defensive coding.

> **🛒 Where we are in building ShopFast** — Last topic we chose [Paradigms](../../02-paradigms/01-knowledge/README.md) — OOP (Object-Oriented Programming) to protect order-state invariants, FP (Functional Programming) to keep the pricing pipeline pure. Now we face the hard part: *things go wrong*. A payment times out, a product goes out of stock mid-checkout, a Redis instance drops. This topic gives us all the building blocks we need — language, runtime, paradigms, and now error strategy. **Next:** [Clean Code](../../../03-code-quality-and-architecture/01-clean-code/01-knowledge/README.md) — readable, intention-revealing code at the expression level.

---

## Teaching arc: handling failure in ShopFast

### What it is

**Error handling** is the discipline of deciding what your program does when something goes wrong — and making that decision *explicit* in your code rather than hoping it never happens. Think of it like a pilot's pre-flight checklist: most flights are fine, but every possible failure mode has an assigned procedure. The checklist doesn't make flights slower; it makes them predictable.

The mistake juniors make is treating errors as edge cases. The mistake seniors avoid is letting errors collapse everything silently. The difference is visible in three questions: *which* errors are recoverable, *where* do you handle vs propagate, and *how* do you preserve enough context to debug what went wrong in production at 2am.

### What it looks like

The same ShopFast operation — placing an order and charging a payment — in the three dominant error models:

```python
# Exceptions (Python, Java, JS, Ruby) — control flow jumps to handler on failure
def place_order(user_id: str, product_id: str) -> dict:
    product = catalog.get(product_id)          # raises ProductNotFoundError if missing
    if product["inventory"] == 0:
        raise OutOfStockError(product_id)      # domain-specific, named exception

    try:
        charge = payment_provider.charge(      # external call — may raise TimeoutError
            user_id=user_id,
            amount_cents=product["price_cents"],
        )
    except TimeoutError:
        # transient — accept order as "pending", settle via queue (ShopFast pattern)
        return {"status": "pending", "message": "payment processing"}
    except PaymentDeclinedError as e:
        raise OrderFailedError("Card declined") from e   # chain cause — never discard it

    return {"status": "confirmed", "charge_id": charge.id}
```

```go
// Error values (Go) — errors are explicit return values; you MUST check them
func placeOrder(userID, productID string) (*Order, error) {
    product, err := catalog.Get(productID)
    if err != nil {
        return nil, fmt.Errorf("placeOrder: catalog lookup: %w", err)  // wrap with %w
    }
    if product.Inventory == 0 {
        return nil, &OutOfStockError{ProductID: productID}  // typed, inspectable error
    }
    charge, err := paymentProvider.Charge(userID, product.PriceCents)
    if err != nil {
        var declined *PaymentDeclinedError
        if errors.As(err, &declined) {
            return nil, fmt.Errorf("card declined: %w", err)  // permanent — don't retry
        }
        return nil, fmt.Errorf("payment provider: %w", err)  // transient — caller retries
    }
    return &Order{Status: "confirmed", ChargeID: charge.ID}, nil
}
```

```typescript
// Result types (TypeScript discriminated union — FP style)
type OrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "out_of_stock" | "payment_declined" | "timeout" };

async function placeOrder(userId: string, productId: string): Promise<OrderResult> {
    const product = await catalog.get(productId);
    if (!product || product.inventory === 0) {
        return { ok: false, reason: "out_of_stock" };  // value, not thrown
    }
    const result = await paymentProvider.charge(userId, product.priceCents);
    if (!result.success) {
        return { ok: false, reason: result.declined ? "payment_declined" : "timeout" };
    }
    return { ok: true, order: { status: "confirmed", chargeId: result.chargeId } };
}
// Caller MUST handle both branches — the type system enforces it.
```

### Implement it / see it in code

The most interview-critical pattern is the **error boundary** — the layer that decides "retry, log, respond to user, or crash":

```python
# Request handler — the error boundary for the HTTP layer
from fastapi import HTTPException

@app.post("/v1/orders")
async def create_order(body: OrderRequest):
    try:
        order = await order_service.place_order(body.user_id, body.product_id)
        return order
    except OutOfStockError as e:
        # 409 Conflict: client error, permanent — don't retry
        raise HTTPException(status_code=409, detail=f"Out of stock: {e.product_id}")
    except OrderFailedError as e:
        # 402 Payment Required: client error (bad card), permanent
        raise HTTPException(status_code=402, detail=str(e))
    except TimeoutError:
        # 503 Service Unavailable: server/transient — client SHOULD retry with Idempotency-Key
        raise HTTPException(status_code=503, detail="Payment processor unavailable, retry")
    except Exception as e:
        logger.error("Unexpected order error", exc_info=True, user_id=body.user_id)
        raise HTTPException(status_code=500, detail="Internal error")
        # Never expose the raw exception to the user — information leak + bad UX
```

### Where it lives in real systems

**ShopFast's `POST /v1/orders`** is the highest-stakes endpoint in the system. Every error-handling principle shows up here:

1. **Transient vs permanent determines retry strategy.** A payment provider `TimeoutError` is transient — ShopFast accepts the order as `pending` and queues an async settlement job (the circuit-breaker pattern). A `PaymentDeclinedError` is permanent — retrying would just decline again and annoy the customer. The distinction is not academic: retrying a declined charge is wasted load; *not* retrying a timed-out charge loses revenue.

2. **Idempotency keys make retries safe.** `POST /v1/orders` is not idempotent by definition. A mobile client on a flaky network that times out and retries without an idempotency key creates *two* orders and double-charges the customer. ShopFast requires an `Idempotency-Key` header and stores the key→result mapping so any retry returns the original outcome. This is the single most damaging API bug at scale — error handling and API design intersect here.

3. **Result types catch the out-of-stock race condition at checkout.** Between a user viewing a product and submitting the order, another user may buy the last unit. This is an *expected* error, not a bug. Modeling it as `OutOfStockError` (exception) or `{ ok: false, reason: "out_of_stock" }` (Result type) forces every caller to handle it explicitly. If you model it as `return None`, you get a `NullPointerException` / `AttributeError` at the point of use — far from the root cause.

4. **Error context chains keep 2am debugging possible.** When the payment provider fails, ShopFast's error log must show: which user, which product, which order attempt, what the downstream error was. Go's `fmt.Errorf("placeOrder: catalog lookup: %w", err)` builds a chain. Python's `raise X from e` preserves the cause. Without this, the log shows "Internal Error" and nothing else — you are debugging blind.

5. **GC (Garbage Collection) pauses + timeouts interact.** ShopFast sets a 2-second timeout on payment provider calls. A JVM GC pause of 200ms eats into that budget. Designing the timeout to be at the *call site*, not at the load balancer, means the application can observe the failure and trigger the pending-order fallback instead of returning a 504 with no recovery logic.

### Types & differences

| Error model | How errors flow | Reach for it when |
|---|---|---|
| **Exceptions** (Python, Java, JS) | Control jumps up the call stack to nearest handler | Language default; use named exception types per domain error; never catch `Exception` broadly |
| **Error values** (Go, C) | Returned as a second value; caller checks `if err != nil` | Go idiom; forces explicitness; wrap with context at each layer using `%w` |
| **Result / Either types** (Rust, TS discriminated unions, Kotlin sealed classes) | Error is part of the return type; pattern-matching forces handling | FP codebases; you want the compiler to reject unhandled error paths |
| **Panic / unrecoverable** (Go `panic`, Java `Error`, Python `SystemExit`) | Crash + unwind; not meant for caller handling | Truly exceptional programmer errors (nil deref, invariant violated); never for expected errors |

**Error taxonomy — the most important table:**

| Error type | Examples | Action |
|---|---|---|
| **Programmer error / bug** | Nil deref, index out of bounds, broken invariant | Fail fast (panic/assert in dev/test); fix the code |
| **Operational / expected** | Network timeout, file not found, 404 from dependency | Handle gracefully; log with context; retry if transient |
| **Transient** | Timeout, 503, rate limit (429) | Retry with exponential backoff + jitter; cap attempts |
| **Permanent** | 400 bad request, 404 not found, 402 payment declined | Do NOT retry; surface clean error to caller |
| **Unrecoverable** | OOM (Out of Memory), disk full, corrupted DB | Crash loudly; let a supervisor restart; alert on-call |

### Gotchas

| Mistake | What goes wrong | ShopFast consequence |
|---|---|---|
| `except Exception: pass` / `catch (Exception e) {}` | Swallows ALL errors silently | A failed charge is treated as success; order is "confirmed" but money was never taken |
| Logging AND rethrowing at every layer | Log spam; true error signal buried | Five log lines for one checkout failure; on-call alert fatigue |
| Retrying a permanent error (4xx) | Infinite wasted load | Retrying a declined payment 10× hammers the payment provider and delays the user |
| Retrying a non-idempotent operation | Duplicate side effects | Retrying `POST /v1/orders` without an idempotency key → double charge |
| Returning `null` / `None` for "not found" | NPE (NullPointerException) / `AttributeError` downstream | Product lookup returns `None`; order total computed as `None * qty` → unhandled exception in a different function |
| No timeout on payment call | Indefinite hang; thread/connection pool exhaustion | One slow payment provider drains all worker threads; entire checkout goes down |
| Exposing stack traces to users | Information leak + terrible UX | User sees `java.lang.NullPointerException at OrderService.java:42` — a security and trust issue |
| Catching `Throwable` / `BaseException` | Catches `OutOfMemoryError`, `SystemExit` | Process can't shut down cleanly; health checks pass when they should fail |

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
- **Cleanup guarantees**: `finally` / `try-with-resources` / `defer` / context managers / RAII (Resource Acquisition Is Initialization) to release resources even on the error path.

---

## 4. Resilience patterns (the distributed angle)

- **Retries with exponential backoff + jitter**: retry transient failures, but back off to avoid hammering a struggling dependency; add jitter to prevent thundering-herd synchronization. Cap total attempts/time.
- **Timeouts everywhere**: a call with no timeout is a latent hang and a resource leak; set them on every network/IO (Input/Output) call and propagate deadlines.
- **Circuit breaker**: after N consecutive failures, "open" and fail fast for a cooldown so you stop wasting resources and give the dependency time to recover; "half-open" probes recovery.
- **Bulkheads**: isolate resource pools so one failing dependency can't exhaust threads/connections for everything.
- **Graceful degradation / fallbacks**: serve stale cache, a default, or a reduced feature instead of a hard failure.
- **DLQ (Dead-Letter Queue)**: park messages that fail repeatedly for later inspection instead of blocking the stream or infinite-retrying.
- **Saga / compensation**: in distributed transactions, undo prior steps when a later step fails (no global rollback available).

---

## 5. Observability of errors

- **Structured logging** with correlation/trace IDs so an error can be traced across services.
- **Error categorization & rates** feeding alerts/SLOs (Service Level Objectives) (distinguish 4xx user errors from 5xx server errors).
- **Don't log secrets / PII (Personally Identifiable Information)** in error messages or stack traces.
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
| Cleanup? | `finally` / try-with-resources / `defer` / context manager / RAII (Resource Acquisition Is Initialization). |

**Three anchors:** (1) fail fast on bugs, handle expected errors gracefully; (2) preserve context and decide at the right boundary; (3) make retries safe with idempotency + backoff + timeouts + circuit breakers.
