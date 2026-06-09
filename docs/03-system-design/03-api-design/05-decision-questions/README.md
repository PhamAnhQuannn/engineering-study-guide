# API Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: REST, GraphQL, gRPC, versioning, idempotency.

Named options, a reasoned recommendation, and "what would change the answer."

---

### DC1. REST vs GraphQL vs gRPC for a new API

**Recommendation:** **REST** for a public, resource-oriented, cacheable CRUD API (broad tooling, HTTP caching). **GraphQL** when many clients need different, nested data and over/under-fetching is the pain. **gRPC** for internal, low-latency, high-throughput, polyglot service-to-service calls and streaming. Common architecture: gRPC internally, REST or GraphQL at the edge.

**What changes it:** Public third-party developers → REST (familiar, debuggable). Diverse mobile+web clients + rapid iteration → GraphQL. Internal mesh with strict perf/streaming → gRPC. Browser-native requirement → not raw gRPC.

---

### DC2. URI versioning vs header/media-type versioning

**Recommendation:** **URI versioning** (`/v1`) for public APIs — visible, trivially routable and cacheable, easy for developers to reason about. **Header/media-type** versioning when you want clean URLs and proper content negotiation and your consumers are sophisticated. Either way, prefer **additive evolution** so you rarely need a new version at all.

**What changes it:** Public, developer-facing API → URI. Hypermedia/content-negotiation purists or internal APIs → headers. Frequent breaking changes → reconsider the design; lean additive.

---

### DC3. Versioned API vs additive (never-break) evolution

**Recommendation:** **Additive evolution by default** — add optional fields, never remove/rename/retype, never tighten validation. Introduce a **new version only for genuinely breaking changes**, with deprecation + sunset headers and a migration window. This minimizes client churn and version sprawl.

**What changes it:** A change is fundamentally incompatible (semantics, removal) → new version. Schema tech supports in-place deprecation (GraphQL `@deprecated`, protobuf field numbers) → you may avoid versioning entirely.

---

### DC4. Idempotency keys vs natural deduplication vs "do nothing"

**Recommendation:** **Idempotency keys** for any non-idempotent write where retries can cause harm (payments, orders) — explicit, client-controlled, robust. **Natural dedup** (a unique business key like `order_number`) when one exists and is reliable — simpler. **Do nothing** only for truly idempotent operations (PUT/DELETE) or where duplicates are harmless.

**What changes it:** Money/inventory at stake → idempotency keys (and a unique constraint backstop). A strong natural key already exists → use it. Operation already idempotent → no extra machinery.

---

### DC5. Offset vs cursor pagination

**Recommendation:** **Cursor (keyset) pagination** for large, frequently-changing, or feed-style datasets — efficient and stable. **Offset/limit** only for small, stable datasets or admin tables where "jump to page 50" UX is required and the data barely changes.

**What changes it:** Large dataset / infinite scroll / high write rate → cursor. Need random page access on a small static list → offset. Deep offsets causing slow scans → switch to cursor.

---

### DC6. Synchronous request/response vs async (webhook/queue) API

**Recommendation:** **Synchronous** for fast, deterministic operations the client needs answered now. **Async** (accept → 202 + status URL or webhook) for long-running or unreliable work (video transcode, third-party settlement, bulk jobs) — keeps the request path fast and decouples failure. Async requires idempotent consumers + a way to report completion.

**What changes it:** Operation completes in tens of ms → sync. Operation is slow/variable or depends on flaky externals → async. Client can't handle callbacks → sync with polling status endpoint.

---

### DC7. Return errors via HTTP status codes vs always-200-with-error-body

**Recommendation:** **Use HTTP status codes correctly** (4xx/5xx) plus a structured error body. This is the standard, lets proxies/clients/monitoring react properly (retries on 5xx/429, no retry on 4xx), and is self-documenting. "Always 200 with an error field" is an anti-pattern except where a transport forces it (some GraphQL/RPC-over-HTTP cases return 200 with an `errors` array by spec).

**What changes it:** GraphQL semantics → 200 + `errors` array is expected. Legacy client that mishandles non-2xx → may force 200, but treat as debt. Otherwise: status codes + structured body, always.
