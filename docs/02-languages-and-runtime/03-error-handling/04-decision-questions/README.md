# Error Handling — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Exceptions, result types, defensive coding.

Each prompt poses competing options. Give a reasoned recommendation and, crucially, state **what would change the answer** — interviewers reward contingent thinking over absolutes.

---

### D1. Exceptions vs Result types vs error-return values for a new service's error model

**Options:** A) exceptions (try/catch), B) `Result`/`Either` value types, C) Go-style `(value, error)` returns.

**Recommendation:** **Follow the language's idiom and apply it consistently.** In Java/Python/JS, use **exceptions** for truly exceptional/unexpected conditions but model **expected** outcomes (not-found, validation) as return values or `Optional`. In Rust/Scala/Kotlin, lean on **`Result`/`Either`** with `?`/pattern matching. In Go, embrace `(value, error)` with wrapping. The worst choice is **mixing models inconsistently** or fighting the language (e.g., Go-style returns bolted onto Java).

**What would change the answer:** If correctness is safety-critical (finance, avionics), prefer the model that makes error handling **type-checked and exhaustive** (`Result`) so a forgotten case is a compile error. If the team is unfamiliar with FP and the language is exception-based, forcing `Result` everywhere adds friction with little payoff. Performance-critical hot paths argue against exceptions-as-control-flow regardless of language.

---

### D2. Checked vs unchecked exceptions (Java) for a library you publish

**Options:** A) checked exceptions for recoverable failures, B) all unchecked, C) a small set of checked at the public boundary only.

**Recommendation:** **C — mostly unchecked, with checked reserved for genuinely recoverable, caller-actionable conditions at the public boundary.** Checked exceptions leak into every caller and break lambdas/streams; unchecked keep signatures clean. But a published library has callers you can't see, so a *small, deliberate* set of checked exceptions for conditions the caller must handle (e.g., `ConfigNotFoundException`) can be appropriate — document them clearly.

**What would change the answer:** If your consumers are internal and the org already standardizes on unchecked + centralized handling, go all-unchecked (B). If the failure is something every caller genuinely must handle differently and silently ignoring it would be catastrophic, checked has merit. Modern bias (and Kotlin/Scala interop) leans unchecked.

---

### D3. Retry in the client/caller vs in the infrastructure (service mesh / gateway)

**Options:** A) application-level retries in code, B) mesh/sidecar retries (Envoy/Istio), C) both.

**Recommendation:** **Push generic transient retries to the infrastructure (B) for uniform policy, and keep application-level retries (A) only where business semantics require it** (e.g., idempotency-key handling, partial-batch retry). Mesh retries give consistent backoff/budgets without code changes and apply across all services. The danger of "both" (C) is **retry amplification** — layered retries multiply load (3 × 3 × 3 = 27 attempts) and can cause a retry storm during an outage.

**What would change the answer:** No service mesh → you must do it in-app. Operations that aren't idempotent → never blanket-retry at the infra layer; handle explicitly in code. If you do allow both layers, enforce a **retry budget** and disable lower-layer retries where an upper layer already retries.

---

### D4. Return `null` vs `Optional` vs throw, for a `findUser(id)` that may not match

**Options:** A) return `null`, B) return `Optional<User>`, C) throw `UserNotFoundException`.

**Recommendation:** **B — `Optional<User>`** when "not found" is a normal, expected outcome the caller should handle. It's type-safe and self-documenting. Use **C (throw)** only when absence is genuinely exceptional and indicates a bug or violated precondition (e.g., looking up a user you just created). **A (null)** is the weakest — no type enforcement, easy to forget, leads to NPEs far from the cause.

**What would change the answer:** On a very hot path, `Optional` allocation overhead might matter (rare, but measurable in tight loops) — a nullable + `@Nullable` annotation with static analysis can be the pragmatic choice. If the language has first-class nullable types (Kotlin `User?`), use those instead of `Optional`.

---

### D5. Fail-open vs fail-closed when an auth/dependency check errors

**Options:** A) fail-open (allow the request through on error), B) fail-closed (deny on error).

**Recommendation:** **Default to fail-closed for anything security- or correctness-sensitive** (authz, payment, quota): if you can't verify, deny. The cost of wrongly allowing (data breach, fraud) usually dwarfs the cost of wrongly denying. **Fail-open is acceptable for non-critical enrichment** (e.g., a recommendations service is down → render the page without recommendations) where availability beats completeness.

**What would change the answer:** A fail-closed auth dependency that's flaky can take down your whole product (auth outage = total outage). Mitigate with caching/short-TTL tokens and graceful degradation rather than flipping to fail-open. The decision is per-feature: classify each dependency as "must be correct" (fail-closed) vs "nice to have" (fail-open).

---

### D6. Circuit breaker vs simple timeout + retry for a flaky downstream

**Options:** A) timeouts + bounded retries only, B) add a circuit breaker, C) full bulkhead + breaker + fallback.

**Recommendation:** **Start with A (timeouts + capped retries with backoff/jitter) — it's mandatory and cheap.** Add **B (circuit breaker)** once you have a dependency whose failures are *sustained* (not just blips), because retries alone during a full outage pile load onto a dead service and exhaust your own threads. Reserve **C** for high-traffic critical paths where a single dependency could exhaust shared resources.

**What would change the answer:** Low-traffic internal calls rarely need a breaker — the operational complexity isn't worth it. If the dependency outage frequently cascades (resource exhaustion, latency amplification), jump straight to breaker + bulkhead. If you have a meaningful fallback (stale cache, default), the breaker becomes much more valuable because "open" can serve the fallback instead of erroring.

---

### D7. Centralized error handling (middleware/boundary) vs handle-at-each-call-site

**Options:** A) one error boundary (HTTP middleware, top-level handler), B) handle everywhere locally, C) hybrid.

**Recommendation:** **C — propagate by default, with a single boundary for cross-cutting concerns and local handling only where you can meaningfully recover.** A centralized boundary (request middleware, job runner wrapper) maps errors to responses, logs once with correlation IDs, and converts internal errors to safe client messages — this avoids log spam and duplicated mapping. Handle locally **only** when the caller can do something specific (retry, fallback, compensate). Most code should just propagate with added context.

**What would change the answer:** A library (no top-level boundary of its own) must surface errors cleanly to its caller rather than assume a boundary exists. Highly heterogeneous error responses per endpoint reduce the value of full centralization. The anti-pattern to avoid in all cases: logging *and* rethrowing at every layer.

---

### D8. Logging errors: log-and-rethrow at each layer vs log-once-at-boundary

**Options:** A) log at every layer as it bubbles, B) log only at the outermost boundary, C) log at boundary + structured context added per layer (but not full log lines).

**Recommendation:** **C — log once at the boundary, but enrich the error with context at each layer it passes through** (via wrapping). This gives you a single, complete log entry (with the full breadcrumb trail and stack) per failure, instead of N duplicate entries that fragment the signal and inflate cost. The per-layer wrapping preserves the "where" without emitting redundant log lines.

**What would change the answer:** For very long-lived async flows where the boundary is far away or unclear (event pipelines, sagas), a few strategic intermediate log points with correlation IDs aid debugging. Debug/trace level can log more liberally; production *error* level should stay log-once to keep alerts and cost sane.
