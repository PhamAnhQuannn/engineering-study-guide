# HTTP & Web Protocols — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: HTTP/1.1/2/3, methods, status codes, headers.

HTTP is a stateless, text-then-binary request/response protocol at the application layer. As a senior engineer you are expected to reason about its semantics (methods, status, caching, idempotency) *independently* of the wire format (HTTP/1.1 vs HTTP/2 vs HTTP/3), and to know how the wire format affects latency, head-of-line blocking, and connection management.

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
| OPTIONS | ✅ | ✅ | ❌ | Capabilities, CORS preflight |
| POST | ❌ | ❌ | rarely | Create / non-idempotent action |
| PUT | ❌ | ✅ | ❌ | Replace resource at known URI |
| PATCH | ❌ | ❌ | ❌ | Partial update |
| DELETE | ❌ | ✅ | ❌ | Remove resource |

- **Safe** = no intended server state change (caches, prefetchers, crawlers may call freely).
- **Idempotent** = N identical calls leave the server in the same state as 1 call. Critical for **safe retries**. PUT and DELETE are idempotent; POST is not (which is why payment APIs add an `Idempotency-Key` header to make POST safely retryable).
- A common senior trap: idempotent ≠ same *response*. `DELETE` twice may return 204 then 404 — the *state* is identical, the response differs.

---

## 3. Status codes — the families that matter

- **1xx Informational** — `100 Continue` (client may send body), `101 Switching Protocols` (WebSocket upgrade).
- **2xx Success** — `200 OK`, `201 Created` (+ `Location`), `202 Accepted` (async), `204 No Content`, `206 Partial Content` (range requests).
- **3xx Redirect** — `301` permanent (cacheable, SEO), `302`/`307` temporary, `304 Not Modified` (conditional GET cache hit), `308` permanent + preserve method.
- **4xx Client error** — `400` malformed, `401` unauthenticated, `403` authenticated-but-forbidden, `404`, `405` method not allowed, `409` conflict (optimistic concurrency), `422` semantic validation failure, `429` rate-limited (+ `Retry-After`).
- **5xx Server error** — `500` generic, `502` bad gateway (upstream returned garbage), `503` unavailable (overload/maintenance, + `Retry-After`), `504` gateway timeout (upstream slow).

**Senior nuance:** `401` vs `403` — 401 means "I don't know who you are, authenticate"; 403 means "I know who you are, you still can't." `502` vs `504` distinguishes "upstream replied badly" from "upstream never replied in time" — load balancers emit these and they drive different runbooks.

---

## 4. Headers worth knowing cold

- **Content negotiation:** `Accept`, `Accept-Encoding`, `Accept-Language`, `Content-Type`, `Content-Encoding`. Paired with `Vary` on responses so caches key correctly.
- **Caching:** `Cache-Control` (`max-age`, `no-cache`, `no-store`, `private`, `public`, `must-revalidate`, `stale-while-revalidate`), `ETag`/`If-None-Match`, `Last-Modified`/`If-Modified-Since`, `Age`, `Expires` (legacy).
- **Connection:** `Connection: keep-alive`, `Keep-Alive`, `Transfer-Encoding: chunked` (streaming with unknown length), `Content-Length`.
- **Security:** `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Authorization`, `WWW-Authenticate`.
- **Range:** `Range: bytes=0-1023` + `Accept-Ranges: bytes` → `206 Partial Content`. Enables resumable downloads and video seeking.

---

## 5. Caching model (read this slowly — it shows up everywhere)

Two validation modes:

1. **Freshness** — response is fresh if within `max-age`/`Expires`; served with no network round trip.
2. **Validation** — when stale, the cache revalidates: client sends `If-None-Match: "<etag>"`; server returns `304 Not Modified` (cheap, no body) or `200` with fresh body.

- `no-cache` means "store it but revalidate every time", NOT "don't store". `no-store` means "never write to disk/memory". This distinction is constantly confused.
- `private` = browser cache only; `public` = shared (CDN/proxy) caches allowed.
- `stale-while-revalidate=N` lets a CDN serve stale content instantly while fetching fresh in the background — huge for tail latency.

---

## 6. Wire formats: HTTP/1.1 vs HTTP/2 vs HTTP/3

### HTTP/1.1 (1997)
- One request per connection at a time. Pipelining existed but was broken in practice.
- **Head-of-line (HOL) blocking at the application layer:** a slow response blocks the connection. Browsers worked around it with **6 parallel connections per origin** + domain sharding.
- Keep-alive reuses TCP connections; still serial per connection.

### HTTP/2 (2015)
- **Binary framing** instead of text.
- **Multiplexing:** many concurrent streams over ONE TCP connection — fixes *application-layer* HOL blocking.
- **Header compression (HPACK):** repeated headers (cookies, user-agent) sent once.
- **Server push** (largely deprecated — replaced by `103 Early Hints` + preload).
- **Stream prioritization.**
- **Remaining flaw:** because it rides on a single TCP connection, a single lost packet stalls *all* streams — **TCP-level HOL blocking**.

### HTTP/3 (2022)
- Runs over **QUIC** (over **UDP**), not TCP.
- QUIC implements streams natively, so a lost packet only stalls *its own* stream → eliminates TCP HOL blocking.
- **0-RTT / 1-RTT handshake**: TLS 1.3 is baked into QUIC, merging transport + crypto handshake → faster connection setup.
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

A first HTTPS request to a new origin over HTTP/2 costs roughly: DNS lookup → TCP 3-way handshake (1 RTT) → TLS 1.3 handshake (1 RTT) → request/response (1 RTT). That's why connection reuse, keep-alive, TLS session resumption, and HTTP/3's 0-RTT matter so much for tail latency on mobile.

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
