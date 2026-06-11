# HTTP & Web Protocols — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: HTTP/1.1/2/3, methods, status codes, headers.

> **🛒 Where we are in building ShopFast** — Last topic we established [TCP/UDP & DNS](../../01-tcp-udp-dns/01-knowledge/README.md) — the reliable byte-stream and DNS resolution underneath. Now we go one layer up: **HTTP (HyperText Transfer Protocol)** is the application-layer protocol that every `GET /v1/products` and `POST /v1/orders` rides over — the vocabulary the browser and the server use to speak. **Next:** [TLS & HTTPS](../../03-tls/01-knowledge/README.md) — encrypting the HTTP connection to protect ShopFast checkout data.

---

## Teaching arc: HTTP as the language of ShopFast's API

### What it is

**HTTP (HyperText Transfer Protocol)** is a stateless, request/response protocol at the application layer. "Stateless" means every request stands alone — the server remembers nothing between requests; each one must carry everything it needs (who you are, what format you want, etc.).

Think of HTTP like ordering at a restaurant counter, not at a table with a waiter who remembers you. Every time you walk up to the counter you must say your full order, show your loyalty card, and specify "no onions" again — the counter person has no memory of your last visit. That forgetfulness is a feature: any server in the cluster can handle any request without coordinating with others.

### What it looks like

A ShopFast catalog fetch is literally text (in HTTP/1.1) or binary frames (HTTP/2/3) carrying these same logical parts:

```http
GET /v1/products/42 HTTP/1.1          ← verb + path + version
Host: api.shopfast.com                ← mandatory in HTTP/1.1 (enables virtual hosting)
Accept: application/json              ← client says what format it wants
Authorization: Bearer eyJ...          ← client proves identity on every request (stateless)

HTTP/1.1 200 OK                       ← server's reply: status code + reason phrase
Content-Type: application/json        ← what format the body is
Cache-Control: public, max-age=60     ← ShopFast: CDN/browser may cache this for 60 seconds
ETag: "a1b2c3"                        ← fingerprint for later conditional revalidation

{ "id": "42", "name": "Wireless Mouse", "price": 1999, "inStock": true }
```

The `Cache-Control: public, max-age=60` line is doing real work: because the ShopFast catalog is read-heavy (~50:1 read:write ratio), caching catalog GETs for 60 seconds at the CDN layer eliminates the overwhelming majority of origin hits.

### The code that builds it

Server-side: define the HTTP surface. The handler wires a method + path to business logic and sets the caching semantics:

```typescript
import express from "express";
const app = express();

// Catalog read — safe, idempotent, cacheable
app.get("/v1/products/:id", async (req, res) => {
  const product = await catalog.getProduct(req.params.id);
  if (!product) {
    // 404 — structured body so clients don't parse a 200 looking for "error"
    return res.status(404).json({ type: "not_found", title: "No such product", status: 404 });
  }
  res.set("Cache-Control", "public, max-age=60");   // lets CDN absorb the read-heavy catalog
  res.set("ETag", product.version);                 // enables cheap 304 revalidation
  res.json(product);
});

// Order creation — NOT safe, NOT idempotent → must never be retried without an idempotency key
app.post("/v1/orders", async (req, res) => {
  const key = req.headers["idempotency-key"];        // client must send; server dedups retries
  const order = await orders.placeOrder(req.body, key);
  res.status(201).json(order);                       // 201 Created (not 200 OK)
});
```

### The code that calls it

Client-side: consume the HTTP contract. The browser/mobile app speaks the same protocol but from the other side:

```typescript
// Browser: fetch a ShopFast product
async function loadProduct(id: string) {
  const res = await fetch(`https://api.shopfast.com/v1/products/${id}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;            // branch on status code, not body content
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Browser: place an order with an idempotency key so mobile retries don't double-charge
async function checkout(userId: string, cartId: string) {
  const res = await fetch("https://api.shopfast.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),     // unique per attempt; server dedups
    },
    body: JSON.stringify({ userId, cartId }),
  });
  if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
  return res.json();
}
```

### Types & differences

| Version | Wire format | Multiplexing | Transport HOL blocking | Handshake cost | Reach for it when |
|---|---|---|---|---|---|
| **HTTP/1.1** | Text | ❌ (6 parallel conns per origin) | n/a | TCP + TLS (2–3 RTT (Round-Trip Times)) | legacy clients; keep-alive covers most cases |
| **HTTP/2** | Binary frames | ✅ (one TCP connection, many streams) | ✅ still blocks | TCP + TLS (~2 RTT (Round-Trip Times)) | most modern HTTPS traffic; default at CDN edge |
| **HTTP/3** | Binary frames over QUIC | ✅ | ❌ fixed (QUIC/UDP) | 1-RTT (Round-Trip Time) / 0-RTT | mobile, lossy networks, latency-sensitive endpoints |

**RTT (Round-Trip Time)** = the time for a packet to travel from client to server and back. On a typical 4G mobile link, one RTT ≈ 60–100 ms, so saving one RTT is saving up to 100 ms of perceived latency.

**HOL (Head-of-Line) blocking** = when one slow item stalls everything behind it, like a traffic jam caused by a slow truck.

### Build it for real — ShopFast

ShopFast's web and mobile clients hit the public edge over HTTPS. The catalog is read-heavy (50:1 ratio, ~1,800 peak read QPS (Queries Per Second)), and checkout must be retry-safe on flaky mobile networks.

**Decision:** Use **HTTP/2 at the CDN edge** (binary framing + multiplexing gives mobile clients better performance), with `Cache-Control: public, max-age=60` on catalog `GET` responses (absorbed by CDN, protects the origin). `POST /v1/orders` carries an `Idempotency-Key` header (as established in the [API Design](../../../03-system-design/03-api-design/01-knowledge/README.md) topic) so a network retry never double-charges.

**Rejected:** HTTP/3 at launch — QUIC/UDP is sometimes blocked by corporate firewalls and adds operational complexity; HTTP/2 covers the mobile latency problem well enough for launch with ~1M users. Revisit at scale if p99 (99th-percentile latency) on mobile becomes a signal.

> **If you get this wrong:** Setting `Cache-Control: public, max-age=86400` (one day) on the product catalog sounds great for performance — until you update a price or mark a product out-of-stock and the old data is served for 24 hours to everyone. The right setting is `max-age=60` (or use `stale-while-revalidate`) with `ETag` for cheap revalidation, giving freshness without staleness risk.

### Scaling story

- **Now (cheap):** HTTP/2, `Cache-Control: public, max-age=60` on catalog reads, `ETag` for revalidation, idempotency keys on `POST /v1/orders`. The app tier is stateless (sessions in Redis) behind an L7 (Layer 7) load balancer — any server handles any request. Cost: essentially free to add correct headers.
- **Growth signal:** catalog read QPS climbs past origin capacity; cache hit rate drops; CDN misses spike. Or mobile users report slow first-load (high p99 on connection setup).
- **At scale:** slot a CDN in front with zero client changes (the `Cache-Control` placeholder was already set). Upgrade the CDN edge to HTTP/3 for mobile tail latency. Add `stale-while-revalidate` so the CDN serves stale content instantly while refreshing in the background. Cross-links: [Caching](../../../03-system-design/02-caching/01-knowledge/README.md) for Redis/CDN strategy; [TLS](../../03-tls/01-knowledge/README.md) for the HTTPS layer underneath.

---

## 1. The request/response model

A request line + headers + optional body; a status line + headers + optional body in response.

```
GET /users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJ...

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 57
Cache-Control: private, max-age=30

{"id":42,"name":"Ada"}
```

- **Stateless by design.** Every request must carry everything the server needs (auth token, content negotiation). State is layered on top via cookies/sessions/tokens.
- **Host header** is mandatory in HTTP/1.1 — it enables virtual hosting (many domains, one IP). In HTTP/2/3 it becomes the `:authority` pseudo-header.

---

## 2. Methods and their semantics

| Method | Safe | Idempotent | Cacheable | Typical use |
|--------|------|-----------|-----------|-------------|
| GET | ✅ | ✅ | ✅ | Read a resource |
| HEAD | ✅ | ✅ | ✅ | Headers only (size, existence) |
| OPTIONS | ✅ | ✅ | ❌ | Capabilities, CORS (Cross-Origin Resource Sharing) preflight |
| POST | ❌ | ❌ | rarely | Create / non-idempotent action |
| PUT | ❌ | ✅ | ❌ | Replace resource at known URI (Uniform Resource Identifier) |
| PATCH | ❌ | ❌ | ❌ | Partial update |
| DELETE | ❌ | ✅ | ❌ | Remove resource |

- **Safe** = no intended server state change (caches, prefetchers, crawlers may call freely).
- **Idempotent** = N identical calls leave the server in the same state as 1 call. Critical for **safe retries**. PUT and DELETE are idempotent; POST is not (which is why payment APIs add an `Idempotency-Key` header to make POST safely retryable).
- A common senior trap: idempotent ≠ same *response*. `DELETE` twice may return 204 then 404 — the *state* is identical, the response differs.

---

## 3. Status codes — the families that matter

- **1xx Informational** — `100 Continue` (client may send body), `101 Switching Protocols` (WebSocket upgrade).
- **2xx Success** — `200 OK`, `201 Created` (+ `Location`), `202 Accepted` (async), `204 No Content`, `206 Partial Content` (range requests).
- **3xx Redirect** — `301` permanent (cacheable, SEO (Search Engine Optimization)), `302`/`307` temporary, `304 Not Modified` (conditional GET cache hit), `308` permanent + preserve method.
- **4xx Client error** — `400` malformed, `401` unauthenticated, `403` authenticated-but-forbidden, `404`, `405` method not allowed, `409` conflict (optimistic concurrency), `422` semantic validation failure, `429` rate-limited (+ `Retry-After`).
- **5xx Server error** — `500` generic, `502` bad gateway (upstream returned garbage), `503` unavailable (overload/maintenance, + `Retry-After`), `504` gateway timeout (upstream slow).

**Senior nuance:** `401` vs `403` — 401 means "I don't know who you are, authenticate"; 403 means "I know who you are, you still can't." `502` vs `504` distinguishes "upstream replied badly" from "upstream never replied in time" — load balancers emit these and they drive different runbooks.

---

## 4. Headers worth knowing cold

- **Content negotiation:** `Accept`, `Accept-Encoding`, `Accept-Language`, `Content-Type`, `Content-Encoding`. Paired with `Vary` on responses so caches key correctly.
- **Caching:** `Cache-Control` (`max-age`, `no-cache`, `no-store`, `private`, `public`, `must-revalidate`, `stale-while-revalidate`), `ETag`/`If-None-Match`, `Last-Modified`/`If-Modified-Since`, `Age`, `Expires` (legacy).
- **Connection:** `Connection: keep-alive`, `Keep-Alive`, `Transfer-Encoding: chunked` (streaming with unknown length), `Content-Length`.
- **Security:** `Strict-Transport-Security` (HSTS (HTTP Strict Transport Security)), `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Authorization`, `WWW-Authenticate`.
- **Range:** `Range: bytes=0-1023` + `Accept-Ranges: bytes` → `206 Partial Content`. Enables resumable downloads and video seeking.

---

## 5. Caching model (read this slowly — it shows up everywhere)

Two validation modes:

1. **Freshness** — response is fresh if within `max-age`/`Expires`; served with no network round trip.
2. **Validation** — when stale, the cache revalidates: client sends `If-None-Match: "<etag>"`; server returns `304 Not Modified` (cheap, no body) or `200` with fresh body.

- `no-cache` means "store it but revalidate every time", NOT "don't store". `no-store` means "never write to disk/memory". This distinction is constantly confused.
- `private` = browser cache only; `public` = shared (CDN (Content Delivery Network)/proxy) caches allowed.
- `stale-while-revalidate=N` lets a CDN serve stale content instantly while fetching fresh in the background — huge for tail latency.

---

## 6. Wire formats: HTTP/1.1 vs HTTP/2 vs HTTP/3

### HTTP/1.1 (1997)
- One request per connection at a time. Pipelining existed but was broken in practice.
- **HOL (Head-of-Line) blocking at the application layer:** a slow response blocks the connection. Browsers worked around it with **6 parallel connections per origin** + domain sharding.
- Keep-alive reuses TCP (Transmission Control Protocol) connections; still serial per connection.

### HTTP/2 (2015)
- **Binary framing** instead of text.
- **Multiplexing:** many concurrent streams over ONE TCP connection — fixes *application-layer* HOL blocking.
- **Header compression (HPACK):** repeated headers (cookies, user-agent) sent once.
- **Server push** (largely deprecated — replaced by `103 Early Hints` + preload).
- **Stream prioritization.**
- **Remaining flaw:** because it rides on a single TCP connection, a single lost packet stalls *all* streams — **TCP-level HOL blocking**.

### HTTP/3 (2022)
- Runs over **QUIC** (over **UDP (User Datagram Protocol)**), not TCP.
- QUIC implements streams natively, so a lost packet only stalls *its own* stream → eliminates TCP HOL blocking.
- **0-RTT / 1-RTT (Round-Trip Time) handshake**: TLS (Transport Layer Security) 1.3 is baked into QUIC, merging transport + crypto handshake → faster connection setup.
- **Connection migration:** survives IP changes (Wi-Fi → cellular) via a connection ID instead of the 4-tuple.
- Trade-off: UDP is sometimes throttled by middleboxes; CPU cost of userspace congestion control.

| Property | HTTP/1.1 | HTTP/2 | HTTP/3 |
|----------|----------|--------|--------|
| Transport | TCP | TCP | QUIC/UDP |
| Multiplexing | ❌ (6 conns) | ✅ | ✅ |
| App-layer HOL | ✅ blocks | fixed | fixed |
| Transport HOL | n/a | ✅ blocks | fixed |
| Header compression | ❌ | HPACK | QPACK |
| Handshake RTTs | TCP+TLS (2-3) | TCP+TLS | 1-RTT / 0-RTT |

---

## 7. Connection lifecycle & latency

A first HTTPS request to a new origin over HTTP/2 costs roughly: DNS (Domain Name System) lookup → TCP 3-way handshake (1 RTT) → TLS 1.3 handshake (1 RTT) → request/response (1 RTT). That's why connection reuse, keep-alive, TLS session resumption, and HTTP/3's 0-RTT matter so much for tail latency on mobile.

---

## 8. Common pitfalls & misconceptions

- "POST is for create, PUT is for update" — wrong framing. The real distinction is **idempotency** and **whether the client picks the URI** (PUT) vs the server (POST).
- "HTTP/2 is always faster" — on lossy networks, TCP HOL blocking can make HTTP/2 *slower* than 6 HTTP/1.1 connections; HTTP/3 is the actual fix.
- "`no-cache` disables caching" — no, it forces *revalidation*. `no-store` disables it.
- Treating `200` with an error body as success — clients should branch on status, not parse a body to find `{"error":...}` inside a 200.
- Forgetting `Vary` → cache poisoning (a gzip response served to a client that can't decompress).
- Putting mutating actions behind GET → crawlers/prefetchers trigger them.

---

## 9. What interviewers probe

- "Walk me through what happens when you type a URL and press enter." (DNS → TCP → TLS → HTTP → render.)
- "Why is HTTP/2 multiplexing not enough on mobile?" (TCP HOL blocking → HTTP/3.)
- "How do you make a POST safely retryable?" (Idempotency-Key + server-side dedup.)
- "Explain ETag vs Last-Modified and when a 304 is returned."
- "401 vs 403? 502 vs 504?" — they want crisp operational distinctions.
- "When would you choose 202 over 201?" (async accepted vs synchronously created.)

---

## Quick-reference summary

- HTTP = stateless request/response; semantics (methods/status/caching) are separate from wire format.
- **Safe**: GET/HEAD/OPTIONS. **Idempotent**: GET/HEAD/PUT/DELETE/OPTIONS. POST/PATCH neither.
- Status families: 2xx ok, 3xx redirect (304 = cache hit), 4xx client (401≠403, 429), 5xx server (502≠504).
- Caching = freshness (`max-age`) then validation (`ETag`/`304`). `no-cache` revalidates; `no-store` never stores.
- HTTP/2 = multiplexing over one TCP conn (fixes app HOL, leaves TCP HOL). HTTP/3 = QUIC/UDP (fixes TCP HOL, 0-RTT, connection migration).
- Tail latency is dominated by handshakes → reuse connections, TLS resumption, HTTP/3.
