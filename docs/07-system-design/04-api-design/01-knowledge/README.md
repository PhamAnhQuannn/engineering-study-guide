# API Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: REST, GraphQL, gRPC, versioning, idempotency.

A good API is a *contract*: stable, predictable, evolvable, and hard to misuse. Senior API design is less about syntax and more about choosing the right style for the consumer, getting error/versioning/idempotency semantics right, and protecting the service from clients.

> **🛒 Where we are in building ShopFast** — Last topic we chose a [modular monolith](../../04-architecture-styles/01-knowledge/README.md). It has catalog/cart/order modules, but right now nothing *outside* can use them. This topic exposes those modules over the network so the web app and mobile app can browse products and check out. **Next:** the catalog endpoint will get hammered by reads — that's where [Caching](../../02-caching/01-knowledge/README.md) comes in.

---

## Teaching arc: exposing ShopFast over an API

### What it is
An **API** (Application Programming Interface) is a *contract for one program to ask another to do something*. It's a menu in a restaurant: the menu lists exactly what you can order and what you'll get back; you don't walk into the kitchen. The client orders "product 42"; the server's kitchen does the work and hands back a plate (the data) in an agreed shape. Neither side needs to know how the other is built — only the menu.

### What it looks like
Strip away the frameworks and a (REST) API call is just text over HTTP — a **request** and a **response**:

```http
GET /v1/products/42 HTTP/1.1          ← the client's "order": method + path
Host: api.shopfast.com
Accept: application/json

HTTP/1.1 200 OK                        ← the server's reply: status line...
Content-Type: application/json
Cache-Control: public, max-age=60

{ "id": "42", "name": "Wireless Mouse", "price": 1999, "inStock": true }   ← ...+ body
```

That's the whole "shape": a verb (`GET`), a resource (`/products/42`), a status (`200`), and a JSON body. Everything else is detail layered on this.

### The code that builds it
Defining the endpoint server-side — this is the "block of code that *creates* an API". It wires the HTTP path to the catalog module we built last topic:

```typescript
// server: define the ShopFast catalog API (framework-agnostic illustration)
import express from "express";
const app = express();

// GET /v1/products/:id  → read one product
app.get("/v1/products/:id", async (req, res) => {
  const product = await catalog.getProduct(req.params.id);   // calls our module from last topic
  if (!product) {
    return res.status(404).json({ type: "not_found", title: "No such product" });
  }
  res.set("Cache-Control", "public, max-age=60");            // lets clients/CDN cache reads
  res.json(product);
});

// POST /v1/orders  → create an order (NOT idempotent — see idempotency below)
app.post("/v1/orders", async (req, res) => {
  const order = await orders.placeOrder(req.body.userId, req.body.productId);
  res.status(201).json(order);                               // 201 Created
});

app.listen(8080);
```

### The code that calls it
The "piece of code that *calls* an API" — the web client. Same network, totally different side of the contract:

```typescript
// client (browser/mobile): consume the ShopFast API
async function loadProduct(id: string) {
  const res = await fetch(`https://api.shopfast.com/v1/products/${id}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;          // handle the contract's error codes
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();                            // { id, name, price, inStock }
}

// a write — note the idempotency key so a retry after a timeout won't double-charge
async function checkout(userId: string, productId: string) {
  return fetch("https://api.shopfast.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ userId, productId }),
  });
}
```

### Types & differences
| Style | One-line | Reach for it when |
|---|---|---|
| **REST** | resources + HTTP verbs, cacheable | public/CRUD APIs, browser clients, want HTTP caching (**ShopFast edge**) |
| **GraphQL** | one endpoint, client picks fields | many clients with different data needs, deeply nested data |
| **gRPC** | binary RPC (Remote Procedure Call) over HTTP/2, contract-first | internal service-to-service, low latency, streaming, polyglot |

Deep dive on each is in **The three dominant styles** below.

### Build it for real — ShopFast
Our clients are a **web app and a mobile app** hitting us over the public internet. We want the catalog reads to be **cacheable** (they dominate traffic and rarely change), the API to be debuggable from a browser/curl, and checkout to be **safe to retry** (mobile networks drop). 

**Decision:** **REST at the edge.** Resources map cleanly to our domain (`/products`, `/orders`), `GET` responses are cacheable via HTTP headers (huge, given the read-heavy catalog), and it's the lowest-friction contract for two external clients. Checkout (`POST /orders`) is **not idempotent**, so we add **idempotency keys** (see below) so a retried payment charges once. **Rejected:** GraphQL — caching is hard for browser clients (queries POST to one URL, so HTTP/CDN caching is lost), and we'd take on resolver complexity + N+1 risk (needs DataLoader batching) for a uniform 50:1-read catalog that simple REST caching already serves; revisit only if client data needs diverge. gRPC — not browser-native (needs a proxy), wrong tool at the public edge.

> **If we skipped idempotency keys:** a mobile client that times out on a flaky network and retries checkout would create *two* orders and **double-charge the customer** — the single most common, most damaging API bug at scale.

### Scaling story
- **Now (cheap):** one REST service in front of the monolith. *Placeholders we leave:* version the path (`/v1/...`) from day one so we can evolve without breaking clients, and set `Cache-Control` on reads so a CDN/cache can be slotted in front later with zero client changes. Cost: ~free, it's the same box.
- **Growth signal:** internal calls multiply (once we split services, order→catalog→inventory chatter dominates latency); JSON-over-HTTP overhead and N+1 round trips show up in p99 (99th-percentile latency); mobile complains it over-fetches on slow networks.
- **At scale (millions+):** keep **REST at the public edge** (caching + browser support stay valuable) but adopt **gRPC for internal service-to-service** calls (binary, multiplexed, typed contracts) once the monolith splits per [Architecture Styles](../../04-architecture-styles/01-knowledge/README.md). Protect the API with **rate limits** ([Resilience](../../05-resilience/01-knowledge/README.md)) and switch large list endpoints to **cursor pagination** (below). Consider GraphQL *only* if client data needs diverge enough to justify its cost.

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
