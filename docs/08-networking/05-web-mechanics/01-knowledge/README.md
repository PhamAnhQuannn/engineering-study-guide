# Web Mechanics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: CORS, cookies, sessions, caching headers.

"Web mechanics" is the browser-enforced glue that makes web apps secure and stateful: the **same-origin policy** and **CORS**, **cookies** and how they carry session state, **sessions vs tokens**, and the **caching headers** that govern what browsers and CDNs store. These are the highest-frequency debugging topics in real backend work — CORS errors, missing cookies, stale caches.

---

## 1. Origins & the Same-Origin Policy (SOP)

An **origin** = scheme + host + port (`https://app.example.com:443`). Two URLs share an origin only if all three match. The SOP is a browser security boundary: scripts on one origin can't read responses from another origin by default. It's what stops `evil.com` from reading your `bank.com` data using your logged-in session.

- SOP restricts *reading* cross-origin responses, not *sending* requests — which is why CSRF (below) is a separate problem.
- Subdomains are different origins (`a.example.com` ≠ `b.example.com`); so is `http` vs `https` and a different port.

---

## 2. CORS — Cross-Origin Resource Sharing

CORS is the controlled relaxation of SOP. The **server** opts in by sending headers that tell the browser "this other origin may read my responses."

### Simple vs preflighted requests
- **Simple requests** (GET/HEAD/POST with safe content types, no custom headers) go straight through; the browser checks `Access-Control-Allow-Origin` on the response.
- **Preflighted requests** (PUT/DELETE/PATCH, custom headers like `Authorization`, JSON content type) trigger an automatic **`OPTIONS` preflight** first. The browser asks "can I send this?" and the server answers with allowed methods/headers before the real request is sent.

```
OPTIONS /api/orders            (preflight)
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: authorization, content-type

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, PUT, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 600          (cache the preflight)
```

### Key response headers
- `Access-Control-Allow-Origin` — the allowed origin (or `*`). **`*` cannot be combined with credentials.**
- `Access-Control-Allow-Credentials: true` — required to send cookies cross-origin; then `Allow-Origin` must echo the specific origin, not `*`.
- `Access-Control-Allow-Methods` / `-Headers` — what the preflight permits.
- `Access-Control-Max-Age` — how long to cache the preflight (cuts the extra round trip).
- `Access-Control-Expose-Headers` — which response headers JS may read.

**Critical senior point:** CORS is **enforced by the browser, not the server**. The request still reaches your server; the browser just hides the response from the JS if headers are missing. CORS is not a server-side authorization mechanism — it protects users in *browsers*, not your API from curl.

---

## 3. Cookies

A cookie is a small key/value the server sets via `Set-Cookie`; the browser returns it on matching requests via the `Cookie` header. Cookies are the default carrier of session identity.

### Attributes that matter
- **`HttpOnly`** — JS can't read it (`document.cookie`), mitigating cookie theft via XSS. Use for session cookies.
- **`Secure`** — only sent over HTTPS.
- **`SameSite`** — the main CSRF control:
  - `Strict` — never sent on cross-site requests (most secure, can break inbound links to logged-in pages).
  - `Lax` (modern default) — sent on top-level navigations (GET) but not on cross-site subrequests/POSTs.
  - `None` — sent on all cross-site requests; **requires `Secure`**. Needed for third-party/embedded contexts.
- **`Domain`** / **`Path`** — scope. `Domain=.example.com` shares across subdomains.
- **`Max-Age`** / **`Expires`** — persistent vs session (deleted on browser close) cookie.

---

## 4. Sessions vs tokens (how state is carried)

HTTP is stateless; you reconstruct "logged-in" state per request via:

### Server-side sessions (stateful)
- Server stores session data; the cookie holds only an opaque **session ID**.
- Pros: easy revocation (delete the server record), small cookie, secrets stay server-side.
- Cons: needs a shared session store (Redis) to scale horizontally; a lookup per request.

### Tokens / JWT (stateless)
- A signed token (e.g. JWT) carries claims; the server verifies the signature — no lookup needed.
- Pros: stateless, scales without a shared store, works across services.
- Cons: **hard to revoke before expiry** (token is valid until it expires); larger; if stored in `localStorage` it's XSS-exposed. Common pattern: short-lived access token + longer-lived refresh token (rotated), access token kept in memory or an `HttpOnly` cookie.

| | Server session | JWT/token |
|---|---|---|
| State | Server store | Self-contained |
| Scale | Needs shared store | Stateless |
| Revoke | Easy (delete) | Hard (until expiry) |
| Size | Tiny cookie | Larger |
| Best for | Classic web apps | APIs, microservices, SPAs |

---

## 5. CSRF (and why it's separate from CORS)

Because the browser **automatically attaches cookies** to requests to a site, a malicious page can trick the victim's browser into making a state-changing request to your site *with the victim's cookies* — without ever reading the response (so SOP/CORS don't stop it). Defenses:
- **`SameSite=Lax/Strict`** cookies — the primary modern defense.
- **CSRF tokens** — a per-session secret the server requires in a header/body that an attacker can't read cross-origin.
- **Checking `Origin`/`Referer`** on state-changing requests.
- Using `Authorization: Bearer` tokens (not cookies) sidesteps CSRF because the attacker can't inject the header.

---

## 6. Caching headers (the operational lever)

(See HTTP knowledge for the full caching model.) The headers you set on responses control browser and CDN behavior:

- `Cache-Control: public, max-age=31536000, immutable` — fingerprinted static assets (`app.3f8a.js`): cache forever, never revalidate.
- `Cache-Control: private, no-cache` — per-user HTML: store but revalidate (`ETag`) each time.
- `Cache-Control: no-store` — sensitive data (account pages, anything with PII you don't want on disk).
- `Vary: Accept-Encoding, Origin` — tells caches to key by these headers so they don't serve a gzip body to a client that can't decompress, or a CORS response for the wrong origin.
- `ETag` + `If-None-Match` → `304` for cheap revalidation.

**Cache-busting** via content-hashed filenames is how you get "cache forever" *and* instant deploys: a new build = new filename = guaranteed fresh.

---

## 7. Common pitfalls & misconceptions

- "CORS secures my API." No — CORS is a *browser* feature that protects *users*; your endpoint is still reachable by curl/Postman. Authn/authz is separate.
- "Set `Access-Control-Allow-Origin: *` to fix CORS." Breaks the moment you need credentials (cookies) — `*` + credentials is forbidden; echo the specific origin.
- Forgetting the **preflight** when adding an `Authorization` header or switching to JSON → "works in Postman, fails in browser."
- Storing JWTs in `localStorage` → XSS can exfiltrate them. Prefer `HttpOnly` cookies or in-memory.
- Thinking `SameSite=Strict` is always best — it breaks legitimate cross-site navigations (clicking a link to a logged-in page); `Lax` is the usual choice.
- Caching a per-user response as `public` → one user's data served to another (a classic, severe bug). Use `private`/`no-store` for user-specific content.
- Missing `Vary` → cache poisoning across encodings/origins.

---

## 8. What interviewers probe

- "Why did my fetch get a CORS error — and does the request reach the server?" (Yes; browser blocks the *response*.)
- "Walk me through a CORS preflight."
- "Sessions vs JWT — tradeoffs, and how do you revoke a JWT?"
- "How do `SameSite` cookies prevent CSRF?"
- "How do you cache a per-user page safely vs a static asset?"
- "`Allow-Origin: *` with cookies — why doesn't it work?"

---

## Quick-reference summary

- **Origin** = scheme+host+port; **SOP** blocks cross-origin *reads* in the browser.
- **CORS** = server opt-in (`Access-Control-Allow-*`); **browser-enforced**, not API security. Non-simple requests trigger an **`OPTIONS` preflight**. `*` ≠ credentials.
- **Cookies**: `HttpOnly` (anti-XSS), `Secure` (HTTPS), `SameSite` (anti-CSRF; `Lax` default), `Domain/Path`, `Max-Age`.
- **Sessions** (stateful, easy revoke, needs store) vs **JWT** (stateless, hard revoke, XSS risk in localStorage). Use short access + refresh tokens.
- **CSRF** ≠ CORS: cookies auto-attach → defend with `SameSite` + CSRF tokens + `Origin` checks.
- **Caching headers**: `immutable` for fingerprinted assets, `private/no-cache` for per-user, `no-store` for sensitive, always `Vary` correctly.
