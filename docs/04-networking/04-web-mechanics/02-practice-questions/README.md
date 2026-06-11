# Web Mechanics — Practice Questions

[← Topic overview](../README.md)

> Topic: CORS, cookies, sessions, caching headers.

---

### Q1. A browser `fetch` to your API fails with a CORS error. Did the request reach your server?

**Answer:** Usually **yes** — and that's the key insight. CORS is enforced by the *browser*, not the server. For a "simple" request, the browser sends it, your server processes it, and the browser then **blocks your JavaScript from reading the response** because the `Access-Control-Allow-Origin` header is missing/mismatched. (For non-simple requests, the *preflight* may be rejected, in which case the real request isn't sent.) Practical consequence: a CORS error is fixed by adding the right response headers on the server, and it does **not** mean your API is protected from non-browser clients like curl — CORS is not an authorization mechanism.

---

### Q2. Walk a junior through a CORS preflight.

**Answer:** When the browser is about to send a "non-simple" cross-origin request — e.g. a `PUT`, or a `POST` with `Content-Type: application/json`, or one carrying an `Authorization` header — it first sends an automatic **`OPTIONS`** request called the preflight. It asks: "I want to do `PUT` with these headers — is that allowed?" via `Access-Control-Request-Method` and `-Request-Headers`. The server replies with `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, the allowed `Access-Control-Allow-Origin`, and optionally `Access-Control-Max-Age` to cache the answer. Only if the preflight approves does the browser send the real request. So sometimes "it works in Postman but fails in the browser" — Postman doesn't do preflights.

---

### Q3. Why can't you use `Access-Control-Allow-Origin: *` with credentials?

**Answer:** Security. `*` means "any website may read my responses." If that were combined with credentials (cookies sent via `Access-Control-Allow-Credentials: true`), *any* malicious site could make authenticated requests with the victim's cookies and read the results — a catastrophic leak. So the spec forbids it: when credentials are allowed, `Access-Control-Allow-Origin` must echo a **specific origin** (and you must also set `Allow-Credentials: true`). You typically maintain an allowlist and reflect the matching origin.

---

### Q4. Explain `HttpOnly`, `Secure`, and `SameSite` cookie attributes.

**Answer:**
- **`HttpOnly`** — the cookie is not exposed to JavaScript (`document.cookie`), so an XSS payload can't steal it. Essential for session cookies.
- **`Secure`** — the cookie is only sent over HTTPS, so it can't leak over plaintext.
- **`SameSite`** — controls whether the cookie is attached on cross-site requests, the main CSRF defense: `Strict` (never cross-site), `Lax` (sent on top-level GET navigations only — the modern default), `None` (sent everywhere but **requires `Secure`**, needed for third-party embeds).

A good session cookie is typically `HttpOnly; Secure; SameSite=Lax`.

---

### Q5. Sessions vs JWTs — when would you pick each, and how do you revoke a JWT?

**Answer:** **Server-side sessions** store state on the server with only an opaque ID in the cookie — easy to revoke (delete the record), small, secrets stay server-side, but need a shared store (Redis) to scale and a lookup per request. **JWTs** are self-contained signed tokens the server verifies without a lookup — stateless, scale across services, but **hard to revoke before expiry** and larger. Pick sessions for classic monolithic web apps; pick JWTs for APIs/microservices/SPAs that need stateless scaling. To "revoke" a JWT you can't truly invalidate the token itself, so you: keep access tokens **short-lived** + use rotating refresh tokens, and/or maintain a server-side **denylist** of revoked token IDs (`jti`) — which reintroduces state, partly defeating the point.

---

### Q6. How do `SameSite` cookies stop CSRF?

**Answer:** CSRF works because browsers auto-attach a site's cookies to *any* request to that site, including ones triggered by a malicious third-party page. `SameSite=Lax` or `Strict` tells the browser **not to send the cookie on cross-site subrequests** (like a form POST or `fetch` from `evil.com` to `bank.com`). Without the session cookie, the forged request arrives unauthenticated and is rejected. `Lax` still allows the cookie on top-level GET navigations (so clicking a link to a logged-in page works), while blocking the dangerous cross-site state-changing POSTs.

---

### Q7. (MCQ) Which two URLs share the same origin?

- A) `http://example.com` and `https://example.com`
- B) `https://example.com` and `https://example.com:8443`
- C) `https://example.com/a` and `https://example.com/b`
- D) `https://a.example.com` and `https://b.example.com`

**Answer: C.** Origin = scheme + host + port; the **path doesn't matter**, so `/a` and `/b` are same-origin. A differs by scheme, B by port, D by host — all are cross-origin.

---

### Q8. (MCQ) Which request triggers a CORS preflight?

- A) `GET` with no custom headers
- B) `POST` with `Content-Type: text/plain`
- C) `PUT` with `Content-Type: application/json` and an `Authorization` header
- D) A simple form `POST` (`application/x-www-form-urlencoded`)

**Answer: C.** `PUT`, JSON content type, and a custom `Authorization` header all make it "non-simple," forcing an `OPTIONS` preflight. A, B, and D fall within the "simple request" rules and go straight through.

---

### Q9. (MCQ) The safest place to store a session credential in a browser SPA is:

- A) `localStorage`
- B) A JavaScript variable in global scope
- C) An `HttpOnly` cookie
- D) `sessionStorage`

**Answer: C.** An `HttpOnly` cookie is unreadable by JavaScript, so an XSS payload can't exfiltrate it. `localStorage`/`sessionStorage` and JS variables are all readable by any script running on the page — a single XSS bug leaks the token.

---

### Q10. (MCQ) You must cache a fingerprinted asset `app.3f8a.js` aggressively. The best header is:

- A) `Cache-Control: no-store`
- B) `Cache-Control: no-cache`
- C) `Cache-Control: public, max-age=31536000, immutable`
- D) `Cache-Control: private, max-age=0`

**Answer: C.** Because the filename contains a content hash, the file at that URL never changes — so cache it for a year and mark it `immutable` to skip even revalidation. A new build produces a new filename, guaranteeing freshness. The other options needlessly revalidate or forbid caching.

---

### Q11. Why is it dangerous to serve a per-user API response with `Cache-Control: public`?

**Answer:** `public` lets **shared caches** (CDNs, proxies) store the response and serve it to *other* users. If the response contains user-specific data (account info, personalized content), a shared cache can hand User A's data to User B — a severe data-leak bug. Per-user responses must be `private` (browser-only) or `no-store` (not cached at all), and you should set `Vary` appropriately (e.g. on auth) so caches key by user context. This is one of the most common and damaging caching mistakes.
