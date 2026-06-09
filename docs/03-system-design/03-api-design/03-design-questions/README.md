# API Design — System Design Questions

[← Topic overview](../README.md)

> Topic: REST, GraphQL, gRPC, versioning, idempotency.

Structured prompts: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design a public payments API (retry-safe, versioned)

**Requirements / Scale**
- Third-party developers create charges/refunds. Must be retry-safe (no double charges), auditable, backward-compatible forever. Moderate volume (hundreds of RPS), high correctness bar.

**High-level design**
- **REST** over HTTPS, resource-oriented: `POST /v1/charges`, `POST /v1/refunds`, `GET /v1/charges/{id}`.
- **Idempotency-Key** header required on all writes; server dedups via a key store.
- API-key/OAuth2 auth with scopes; per-key rate limits (429 + Retry-After).
- Structured errors (Problem Details) with stable codes; webhooks for async settlement events.
- **URI versioning** (`/v1`) + additive evolution; `Deprecation`/`Sunset` on retirement.

**Data model**
- `charges(id, amount, currency, status, idempotency_key UNIQUE, created_at)`.
- `idempotency_keys(key PK, request_hash, response_body, status, expires_at)` — stores first outcome.
- `events(id, type, payload, delivered_at)` for webhooks.

**Scaling & bottlenecks**
- Idempotency store must be fast + consistent (DB unique constraint or Redis with persistence); it's on the write path.
- Webhook delivery needs retries with backoff + signature; consumers must be idempotent.
- Read-heavy `GET /charges` → cache + replicas.

**Tradeoffs & failure modes**
- Idempotency window vs storage: keys expire after, say, 24h — retries after that may duplicate; document it.
- Partial failure: charge succeeds but response lost → idempotent replay returns the original.
- Request hash mismatch on same key → reject (the client reused a key for a different payload).

---

## D2. Design an API serving both a mobile app and a web dashboard (different data needs)

**Requirements / Scale**
- Mobile wants minimal payloads (bandwidth/battery); web wants rich nested views. Rapid frontend iteration. Many entity relationships.

**High-level design**
- **GraphQL** gateway so each client requests exactly the fields it needs in one round trip.
- Resolvers backed by existing REST/gRPC services; **DataLoader** to batch and dedup downstream calls (kill N+1).
- **Persisted queries** (hashed, GET) for caching + to block arbitrary expensive queries from the public.
- **Query depth + complexity limits** and per-client rate limits to prevent abuse.

**Data model**
- A typed schema (`User`, `Order`, `Product`, connections for pagination via cursors).
- Deprecate fields with `@deprecated(reason:)` instead of removing — evolution without versioned URLs.

**Scaling & bottlenecks**
- Expensive nested queries → complexity scoring + timeouts; cap list sizes.
- Caching is harder than REST → persisted-query CDN caching + resolver-level caching.
- A slow downstream resolver drags the whole query → per-resolver timeouts + partial results with errors array.

**Tradeoffs & failure modes**
- Flexibility vs control: GraphQL frees clients but you must defend the backend (limits, allowlist).
- Observability: per-field metrics needed to find hot/slow resolvers.

---

## D3. Design internal service-to-service APIs for a microservice mesh

**Requirements / Scale**
- Dozens of internal services, polyglot, low-latency (sub-10 ms intra-call), high throughput, some streaming (e.g., live updates). Contracts must be enforced at compile time.

**High-level design**
- **gRPC** with `.proto` contracts in a shared schema repo; code-gen clients/servers per language.
- HTTP/2 multiplexing + binary protobuf for compactness; unary + server/bidi streaming where needed.
- **Edge** exposes REST/GraphQL to browsers; gRPC stays internal (gRPC-Web/proxy if a browser must call it).
- Deadlines/timeouts propagated per call; retries with backoff for idempotent RPCs only.

**Data model**
- Protobuf messages with stable field numbers; evolve additively (never reuse/renumber).
- Service definitions versioned via package names (`orders.v1`) for breaking changes.

**Scaling & bottlenecks**
- Connection reuse via HTTP/2 reduces handshake cost; use client-side load balancing or a service mesh (Envoy).
- Streaming connections are long-lived → manage backpressure and connection limits.
- Schema repo is a coordination point → CI checks for backward compatibility.

**Tradeoffs & failure modes**
- Binary is fast but less debuggable → invest in reflection/grpcurl + structured logging.
- Breaking proto changes → enforce compatibility linting; gate with `v2` package, not in-place edits.
- Browser/edge gap → keep a REST/GraphQL translation layer.
