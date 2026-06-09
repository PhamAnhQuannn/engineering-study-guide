# API Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: REST, GraphQL, gRPC, versioning, idempotency.

A good API is a *contract*: stable, predictable, evolvable, and hard to misuse. Senior API design is less about syntax and more about choosing the right style for the consumer, getting error/versioning/idempotency semantics right, and protecting the service from clients.

---

## The three dominant styles

### REST (Representational State Transfer)
Resources identified by URLs, manipulated with HTTP verbs, stateless requests.
- **Verbs:** GET (read, safe, cacheable), POST (create/non-idempotent action), PUT (full replace, idempotent), PATCH (partial update), DELETE (idempotent).
- **Resource modeling:** nouns not verbs (`/orders/42/items`, not `/getOrderItems`). Hierarchy expresses relationships.
- **Strengths:** ubiquitous, cacheable via HTTP, simple, great tooling, leverages HTTP semantics (status codes, conditional requests).
- **Weaknesses:** over-/under-fetching (fixed response shapes), chatty for nested data (N+1 round trips), no built-in schema.

### GraphQL
A single endpoint with a typed schema; clients ask for exactly the fields they need in one query.
- **Strengths:** no over/under-fetching; one round trip for nested data; strongly typed schema + introspection; great for diverse clients (mobile vs web).
- **Weaknesses:** HTTP caching is hard (usually POST to one URL); complexity (resolvers, N+1 → needs DataLoader batching); expensive/abusive queries (need depth/complexity limits); harder rate limiting.
- **Use when:** many clients with different data needs, deeply nested graphs, rapid frontend iteration.

### gRPC
Contract-first RPC over HTTP/2 using Protocol Buffers (binary).
- **Strengths:** compact + fast (binary, multiplexed HTTP/2), strong typed contracts (`.proto`), streaming (client/server/bidi), code generation across languages.
- **Weaknesses:** not browser-native (needs gRPC-Web/proxy); binary is less human-debuggable; weaker HTTP caching; steeper tooling.
- **Use when:** internal service-to-service calls, low-latency/high-throughput, polyglot microservices, streaming.

> **Senior framing:** REST for public/CRUD/cacheable APIs; GraphQL for flexible client-driven data; gRPC for internal high-performance service mesh. They coexist (gRPC inside, REST/GraphQL at the edge).

---

## Idempotency (critical at senior level)

An operation is **idempotent** if doing it N times has the same effect as once. GET/PUT/DELETE are idempotent by definition; **POST is not**.

- Why it matters: networks retry. A client that times out and retries a payment must not charge twice.
- **Idempotency keys:** the client sends a unique `Idempotency-Key` header; the server stores the key→result mapping. A retry with the same key returns the *original* result instead of re-executing. Stripe popularized this pattern.
- Server must persist the key + outcome atomically (often in the same transaction or a dedup table) and define a retention window.
- Related: **at-least-once delivery** ⇒ consumers must be idempotent (dedup by message/event id).

---

## Versioning & evolution

You can't break existing clients. Strategies:

- **URI versioning** (`/v1/orders`): explicit, visible, easy to route/cache. Most common for public APIs. Downside: version sprawl, encourages whole-API bumps.
- **Header versioning** (`Accept: application/vnd.api.v2+json`): cleaner URLs, content negotiation; less visible/discoverable.
- **Query param** (`?version=2`): simple but messy caching.
- **No-version / additive evolution:** never break — only add fields, never remove/rename, treat unknown fields as ignorable. Tools: GraphQL deprecates fields; gRPC/protobuf evolves via field numbers (never reuse/renumber).

**Backward compatibility rules:** add optional fields, don't remove/rename, don't change types or semantics, don't tighten validation. Use **deprecation headers** (RFC 9745 `Deprecation`, RFC 8594 `Sunset`) + a migration window.

---

## Errors & status codes

- Use HTTP status correctly: 2xx success, 4xx client error (400 bad request, 401 unauthenticated, 403 unauthorized, 404 not found, 409 conflict, 422 unprocessable, 429 rate-limited), 5xx server error (500, 502, 503, 504).
- Return a **structured, machine-readable error body** (e.g., RFC 9457 *Problem Details*: `type`, `title`, `status`, `detail`, `instance`) with a stable error code, not just a string.
- Be consistent: clients build retry/handling logic on your codes.

---

## Pagination, filtering, partial responses

- **Offset/limit:** simple but slow + inconsistent on large/changing datasets (skipping/duplicates as data shifts).
- **Cursor/keyset pagination:** opaque cursor (e.g., last-seen id/timestamp); stable and efficient at scale. Preferred for feeds/large lists.
- Support filtering, sorting, sparse fieldsets to avoid over-fetching in REST.

---

## Other senior concerns

- **Rate limiting & quotas:** protect the service; return `429` + `Retry-After` + rate-limit headers. (See Resilience topic.)
- **Authentication/authorization:** OAuth2/OIDC, API keys, JWT; scope per endpoint. (See Security tier.)
- **Idempotent + safe semantics** drive cacheability and retry-safety.
- **HATEOAS** (hypermedia links in responses) — REST's discoverability ideal; rarely fully adopted.
- **Consistency of conventions:** naming, casing, date formats (ISO 8601/UTC), error shapes — predictability is a feature.
- **Backwards/forwards compatibility** in schemas (protobuf field numbers, GraphQL deprecation).

---

## Key terms & definitions

| Term | Definition |
|---|---|
| Idempotency | Repeating an operation yields the same result/state. |
| Idempotency key | Client token letting the server dedup retried writes. |
| Safe method | A method with no side effects (GET, HEAD). |
| Cursor pagination | Opaque pointer-based paging; stable at scale. |
| Over/under-fetching | Getting too much / too little data per call. |
| Problem Details | RFC 9457 structured JSON error format. |
| Backward compatible | Old clients keep working against a new server. |
| HATEOAS | Hypermedia-driven navigation of a REST API. |
| Content negotiation | Choosing representation via `Accept`/media type. |

---

## What interviewers probe

- "REST vs GraphQL vs gRPC — when each, and why?"
- "How do you make a payment endpoint safe to retry?" → idempotency keys.
- "How do you version an API without breaking clients?" → additive evolution + URI/header strategy + deprecation/sunset.
- "Offset vs cursor pagination?" → consistency + performance at scale.
- "How do you return errors?" → status codes + structured body + stable codes.
- "How do you stop a client from over-fetching / abusing the API?" → field selection, complexity limits, rate limiting.

---

## Quick-reference summary

- **REST** = cacheable CRUD/public; **GraphQL** = flexible client-driven data; **gRPC** = fast internal RPC + streaming.
- **POST isn't idempotent** — use **idempotency keys** for retry-safe writes.
- **Evolve additively**; version via URI/header; deprecate with `Deprecation`/`Sunset` + a migration window.
- **Use correct status codes + structured error bodies** (Problem Details) with stable codes.
- Prefer **cursor pagination** at scale; protect the API with **rate limits** and (for GraphQL) **complexity limits**.
- Consistency of conventions is itself a feature — predictable APIs are easy to use correctly.
