# API Design — Practice Questions

[← Topic overview](../README.md)

> Topic: REST, GraphQL, gRPC, versioning, idempotency.

Mix of recall, "explain to a junior," and MCQs.

---

### Q1. What does idempotent mean, and which HTTP methods are idempotent?

**Answer:** An idempotent operation produces the same result/state whether applied once or many times. **GET, HEAD, PUT, DELETE** are idempotent (GET/HEAD are also *safe* — no side effects). **POST and PATCH are not guaranteed idempotent** — repeating a POST typically creates duplicates. This matters because clients and proxies retry on timeouts; idempotent methods are safe to retry automatically.

---

### Q2. Explain idempotency keys to a junior using a payment example.

**Answer:** Imagine a user taps "Pay" and the request times out — did the charge go through? If they retry, you might charge twice. An **idempotency key** fixes this: the client generates a unique token (UUID) and sends it as `Idempotency-Key` with the request. The server records `key → result` the first time it processes the charge. If the same key arrives again, the server skips re-charging and returns the *original* result. So the retry is safe — at most one charge per key. The server must store the key+outcome atomically and keep it for a retention window.

---

### Q3. REST vs GraphQL vs gRPC — give a one-line "use when" for each.

**Answer:**
- **REST** — public/CRUD APIs that benefit from HTTP caching and broad tooling; resource-oriented.
- **GraphQL** — clients with diverse, nested data needs (mobile + web) where over/under-fetching hurts; one flexible query.
- **gRPC** — internal, high-throughput, low-latency service-to-service calls in a polyglot mesh, especially with streaming.

---

### Q4. What is over-fetching and under-fetching, and how does GraphQL address them?

**Answer:** **Over-fetching** = the endpoint returns more fields than the client needs (wasted bandwidth). **Under-fetching** = the client must make multiple calls to assemble what it needs (chatty, N+1 round trips). REST's fixed response shapes cause both. GraphQL lets the client specify exactly the fields it wants in a single query, fetching nested data in one round trip — eliminating both problems (at the cost of harder caching and query-cost control).

---

### Q5. Offset pagination vs cursor pagination — what's the difference and which scales?

**Answer:** **Offset/limit** (`?offset=1000&limit=20`) skips N rows — simple, but slow on large offsets (the DB still scans them) and *inconsistent* when data changes between pages (rows shift, causing skips/duplicates). **Cursor/keyset** pagination passes an opaque pointer (e.g., last-seen id/timestamp) and queries `WHERE id < cursor ORDER BY id LIMIT 20` — efficient (uses the index) and stable under inserts/deletes. **Cursor scales**; use it for feeds and large lists.

---

### Q6. How do you version an API without breaking existing clients?

**Answer:** Prefer **additive, backward-compatible evolution**: add optional fields, never remove/rename fields or change types/semantics, never tighten validation. When a breaking change is unavoidable, expose a new version — **URI** (`/v2/...`, visible and easy to route/cache) or **header** (`Accept` media type, cleaner URLs). Mark the old version with **`Deprecation`/`Sunset`** headers (RFC 9745/8594), publish a migration guide, and keep both versions running through a deprecation window.

---

### Q7. Why is GraphQL harder to cache than REST, and what do you do about it?

**Answer:** REST uses distinct URLs + GET, so HTTP/CDN caches work out of the box (cache by URL, use ETags/304). GraphQL typically POSTs every query to a single endpoint, so URL-based HTTP caching doesn't apply, and responses vary by the exact field selection. Mitigations: **persisted queries** (hash a known query → GET-able, cacheable), application-level caching keyed by query+variables, **DataLoader** to batch/cache resolver fetches per request, and field-level caching. You trade some of REST's free HTTP caching for query flexibility.

---

### Q8. What's the right way to return errors from a REST API?

**Answer:** Use the **correct HTTP status code** (4xx for client errors, 5xx for server) and a **structured, machine-readable body** — e.g., RFC 9457 Problem Details with `type`, `title`, `status`, `detail`, and a **stable application-specific error code** clients can branch on. Avoid leaking internals/stack traces, keep the shape consistent across all endpoints, and include enough context (field-level validation errors) for the client to act. Consistency lets clients build reliable retry/handling logic.

---

### Q9 (MCQ). Which method should be idempotent and is used for a full resource replacement?

A. POST
B. PUT
C. PATCH
D. GET

**Answer: B.** PUT replaces a resource fully and is idempotent — applying it repeatedly leaves the same state. POST creates (non-idempotent), PATCH partially updates, GET only reads.

---

### Q10 (MCQ). The best status code for "you've exceeded your rate limit" is:

A. 403 Forbidden
B. 409 Conflict
C. 429 Too Many Requests
D. 503 Service Unavailable

**Answer: C.** 429 specifically signals rate limiting; pair it with `Retry-After`. 403 is authorization, 409 is a state conflict, 503 is general unavailability.

---

### Q11 (MCQ). gRPC's primary serialization/transport is:

A. JSON over HTTP/1.1
B. XML over SOAP
C. Protocol Buffers over HTTP/2
D. MessagePack over WebSocket

**Answer: C.** gRPC uses Protocol Buffers (binary) over HTTP/2, enabling compact payloads, multiplexing, and streaming.

---

### Q12 (MCQ). To evolve a protobuf message without breaking old clients you should:

A. Reuse retired field numbers for new fields
B. Renumber fields to keep them sequential
C. Only add new fields with new field numbers and never reuse old ones
D. Change a field's type from int32 to string in place

**Answer: C.** Protobuf compatibility relies on stable field numbers; add new fields with fresh numbers, never reuse or renumber, and never change a field's type in place.

---

### Q13. A client times out on POST `/orders` and retries. Without idempotency, what's the risk, and what's the minimal fix?

**Answer:** Risk: a **duplicate order** — the first request may have succeeded server-side even though the client never saw the response. Minimal fix: require an **`Idempotency-Key`** on the create endpoint. The server stores the key with the created order id in the same transaction; a retry with the same key returns the existing order (200/idempotent replay) instead of creating a second one. Add a uniqueness constraint on the key as a backstop.
