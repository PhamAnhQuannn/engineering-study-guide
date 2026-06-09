# HTTP & Web Protocols — Practice Questions

[← Topic overview](../README.md)

> Topic: HTTP/1.1/2/3, methods, status codes, headers.

A mix of recall, "explain to a junior", and multiple-choice. Try to answer before expanding the **Answer**.

---

### Q1. What does it mean for an HTTP method to be *idempotent*, and why does it matter operationally?

**Answer:** Idempotent means making N identical requests leaves the server in the same state as making one. GET, HEAD, PUT, DELETE, OPTIONS are idempotent; POST and PATCH are not. It matters because **retries are only safe for idempotent operations**. A client (or load balancer, or service mesh) that retries a timed-out request must know whether a duplicate could double-charge a card or create two records. Note that idempotent refers to *state*, not the *response*: DELETE twice yields 204 then 404, but the resulting state is identical.

---

### Q2. Explain the difference between `401`, `403`, and `429` to a junior.

**Answer:**
- **401 Unauthorized** = "I don't know who you are." The credentials are missing or invalid; authenticate and retry. Server usually sends a `WWW-Authenticate` header.
- **403 Forbidden** = "I know exactly who you are, and you're not allowed." Re-authenticating won't help; it's an authorization (permission) failure.
- **429 Too Many Requests** = "You're going too fast." Rate limit hit; the server should send `Retry-After` telling you when to come back.

Mnemonic: 401 is about *identity*, 403 is about *permission*, 429 is about *rate*.

---

### Q3. A response has `Cache-Control: no-cache`. Can the browser store it? Explain.

**Answer:** Yes. `no-cache` is misleadingly named — it means "you may store this, but you MUST revalidate with the origin before reusing it" (via `ETag`/`If-None-Match` or `Last-Modified`/`If-Modified-Since`). The directive that actually forbids storage is **`no-store`**. So `no-cache` still saves a round trip's worth of bytes when the server replies `304 Not Modified`; `no-store` saves nothing.

---

### Q4. What problem does HTTP/2 multiplexing solve, and what problem does it *not* solve?

**Answer:** It solves **application-layer head-of-line blocking**: in HTTP/1.1 a connection handles one request at a time, so a slow response blocks everything behind it (browsers hacked around this with ~6 connections per origin). HTTP/2 sends many concurrent streams over a single TCP connection. What it does NOT solve is **transport-layer HOL blocking**: all streams share one TCP connection, so a single lost packet forces TCP to stall delivery of *every* stream until retransmission. HTTP/3 (QUIC over UDP) fixes that by giving each stream independent loss recovery.

---

### Q5. How would you make a `POST /payments` endpoint safe to retry?

**Answer:** Introduce an **idempotency key**. The client generates a unique key (e.g. a UUID) and sends it as `Idempotency-Key: <uuid>`. The server stores the key → result mapping (in Redis/DB) on first processing. On a retry with the same key, it returns the *stored* result instead of charging again. Combine with a uniqueness constraint at the DB level as a backstop. This converts a non-idempotent POST into an effectively idempotent operation, so clients and gateways can retry on timeouts without double-charging.

---

### Q6. Explain conditional requests and the `304` flow.

**Answer:** The server tags a response with a validator: `ETag: "abc"` (opaque content hash/version) and/or `Last-Modified`. On the next request the client sends `If-None-Match: "abc"` (or `If-Modified-Since`). If the resource is unchanged, the server returns **`304 Not Modified`** with no body — the client reuses its cached copy. If changed, it returns `200` with the new body and a new ETag. This saves bandwidth (no body) while keeping content fresh, and is the backbone of efficient browser/CDN caching.

---

### Q7. Why does the `Host` header exist, and what replaces it in HTTP/2?

**Answer:** One IP address can serve many domains (virtual hosting). The `Host` header tells the server which site the request is for, so it's mandatory in HTTP/1.1. In HTTP/2 the equivalent is the `:authority` pseudo-header (part of the binary framing). At the TLS layer, **SNI (Server Name Indication)** plays the analogous role so the server can present the correct certificate before the HTTP request is even sent.

---

### Q8. (MCQ) Which set is entirely *safe* AND *idempotent*?

- A) GET, POST, PUT
- B) GET, HEAD, OPTIONS
- C) PUT, DELETE, PATCH
- D) GET, PUT, DELETE

**Answer: B.** Safe methods don't intend to change state: GET, HEAD, OPTIONS (all also idempotent). PUT and DELETE are idempotent but **not safe** (they change state). POST and PATCH are neither.

---

### Q9. (MCQ) A load balancer returns `504 Gateway Timeout`. What happened?

- A) The client sent a malformed request
- B) The upstream server returned an invalid response
- C) The upstream server didn't respond within the timeout
- D) The user is rate-limited

**Answer: C.** `504` = the gateway/proxy reached an upstream but it **timed out**. Contrast with `502 Bad Gateway` (upstream replied with something invalid) and `503 Service Unavailable` (the gateway itself is overloaded/down). `400` is malformed request; `429` is rate-limited.

---

### Q10. (MCQ) Which HTTP/3 feature is impossible in HTTP/2?

- A) Header compression
- B) Stream multiplexing
- C) Connection migration across IP changes
- D) Request prioritization

**Answer: C.** Connection migration (surviving a Wi-Fi→cellular switch) works because QUIC identifies a connection by a **connection ID**, not the TCP 4-tuple (src/dst IP+port). HTTP/2 over TCP breaks when the IP changes. A, B, D all exist in HTTP/2.

---

### Q11. (MCQ) `Cache-Control: public, max-age=0, must-revalidate` means:

- A) Never cache the response
- B) Cache it, but always revalidate before serving (effectively `no-cache`)
- C) Cache for 0 seconds in private caches only
- D) Cache forever

**Answer: B.** `max-age=0` makes it immediately stale; `must-revalidate` forbids serving stale; `public` allows shared caches to store it. Net effect: it's stored but revalidated on every use — behaviorally like `no-cache`.

---

### Q12. Explain `Transfer-Encoding: chunked` and when you'd use it.

**Answer:** It lets the server stream a response in chunks **without knowing the total `Content-Length` up front**. Each chunk is prefixed with its size; a zero-length chunk signals the end. Use it for streaming generated content (e.g. a large export, server-side rendered HTML streamed progressively, or LLM token streaming) where computing the full length first would add latency or memory pressure. The client can start processing before the response completes.

---

### Q13. Why might HTTP/2 actually be *slower* than HTTP/1.1 on a lossy mobile network?

**Answer:** Because of TCP head-of-line blocking. HTTP/2 puts all streams on one TCP connection, so a single dropped packet stalls delivery of *every* concurrent stream until it's retransmitted. With HTTP/1.1's 6 separate connections, a packet loss only stalls one connection; the other five keep flowing. This is exactly the scenario HTTP/3 (independent per-stream loss recovery over QUIC) was built to fix.
