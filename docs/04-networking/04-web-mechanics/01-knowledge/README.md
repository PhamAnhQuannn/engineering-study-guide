# Web Mechanics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: CORS, cookies, sessions, caching headers.

> **🛒 Where we are in building ShopFast** — Last topic we added [TLS & HTTPS](../../03-tls/01-knowledge/README.md) — encryption that makes HTTPS connections secure. Now we look at the **browser-side glue** that makes ShopFast's web client work correctly and securely: **CORS (Cross-Origin Resource Sharing)** controls which origins the browser lets read API responses, **cookies** carry the session state that makes "logged in" persist across pages, and **caching headers** govern what the browser and CDN (Content Delivery Network) store so repeat catalog loads are instant. These are the highest-frequency real-world debugging topics on a web team. **Next:** [WebSockets & Streaming](../../05-websockets/01-knowledge/README.md) — persistent bidirectional channels for live order and inventory updates.

---

## Teaching arc: making ShopFast's web client work across origins, sessions, and caches

### What it is

**CORS (Cross-Origin Resource Sharing)** is the browser's mechanism for letting your frontend (served from `https://www.shopfast.com`) call your API (served from `https://api.shopfast.com`) without being silently blocked. Without CORS, the browser's **SOP (Same-Origin Policy)** would prevent the JavaScript on `www.shopfast.com` from reading responses from `api.shopfast.com` — they are different origins (different subdomain).

**Cookies** are small key/value pairs the server deposits in the browser via `Set-Cookie`. On every subsequent request to a matching domain, the browser automatically sends the cookie back. This is how "logged in" state persists across pages without the user re-authenticating on every click.

**Caching headers** (`Cache-Control`, `ETag`, `Vary`) are the instructions the server sends to tell browsers and CDNs how long to hold a response before asking for it again. The ShopFast catalog is read-heavy (50:1 read:write ratio); effective caching headers mean a product page load from a returning visitor costs zero origin requests.

Think of SOP/CORS as a building's visitor policy: by default, only residents (same-origin scripts) can enter. CORS is the front desk authorizing specific visitors (other origins) to pass. Cookies are the visitor badge the desk gives you on arrival — automatically shown on re-entry. Caching headers are the expiry date stamped on the badge: "valid for 60 seconds, then come back to the desk."

### What it looks like

**A CORS preflight for ShopFast's checkout API** — triggered because `POST` with `application/json` and a custom `Authorization` header is not a "simple" request:

```http
OPTIONS /v1/orders HTTP/1.1                           ← browser auto-sends this BEFORE the real POST
Origin: https://www.shopfast.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization, content-type

HTTP/1.1 204 No Content                               ← server grants permission
Access-Control-Allow-Origin: https://www.shopfast.com ← only this origin (not *)
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Credentials: true                ← cookies may be sent cross-origin
Access-Control-Max-Age: 600                           ← cache this preflight for 10 min

POST /v1/orders HTTP/1.1                              ← real request now sent
Origin: https://www.shopfast.com
Authorization: Bearer eyJ...
Content-Type: application/json
Cookie: session=abc123                                ← browser attaches automatically

HTTP/1.1 201 Created
Access-Control-Allow-Origin: https://www.shopfast.com ← must echo on every credentialed response
```

**Session cookie set after login:**

```http
HTTP/1.1 200 OK
Set-Cookie: session=abc123;
            HttpOnly;           ← JS cannot read it (blocks XSS (Cross-Site Scripting) theft)
            Secure;             ← only sent over HTTPS
            SameSite=Lax;       ← sent on top-level nav but not cross-site subrequests (anti-CSRF)
            Domain=.shopfast.com; ← shared across www.shopfast.com and api.shopfast.com
            Max-Age=86400       ← 1-day persistence
```

**Caching headers for different ShopFast resources:**

```http
# Product page — public CDN-cacheable, 60s freshness, ETag for revalidation
Cache-Control: public, max-age=60, stale-while-revalidate=30
ETag: "prod42-v17"

# Cart (per-user, never CDN-cache)
Cache-Control: private, no-cache
ETag: "cart-u99-v3"

# Order confirmation (sensitive, never store)
Cache-Control: no-store

# Fingerprinted JS bundle — cache forever, bust via filename
Cache-Control: public, max-age=31536000, immutable
# /static/app.3f8ab2.js — new deploy = new filename = instant cache bust
```

### The code that builds it

Server-side CORS and caching configuration (Express):

```typescript
import cors from "cors";

// CORS middleware — configure per route, not globally with "*"
const corsOptions = {
  origin: (origin: string | undefined, cb: Function) => {
    const allowed = ["https://www.shopfast.com", "https://admin.shopfast.com"];
    // Allow same-origin (no Origin header) and explicit allowlist
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,           // allow cookies to be sent cross-origin
  maxAge: 600,                 // cache the preflight OPTIONS for 10 minutes
};

app.use("/v1", cors(corsOptions));

// Cache headers on the catalog endpoint
app.get("/v1/products/:id", async (req, res) => {
  const product = await catalog.getProduct(req.params.id);
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
  res.set("ETag", `"${product.version}"`);   // client will revalidate with If-None-Match
  res.set("Vary", "Accept-Encoding");        // cache keyed by encoding so gzip/identity don't collide
  res.json(product);
});

// Session cookie set after login
app.post("/v1/auth/login", async (req, res) => {
  const session = await auth.createSession(req.body.email, req.body.password);
  res.cookie("session", session.token, {
    httpOnly: true,    // no JS access
    secure: true,      // HTTPS only
    sameSite: "lax",   // SameSite=Lax blocks CSRF (Cross-Site Request Forgery) on POST
    domain: ".shopfast.com",  // shared across subdomains
    maxAge: 86400 * 1000,     // 1 day in ms (express uses ms, not seconds)
  });
  res.json({ ok: true });
});
```

### The code that calls it

Browser client — mostly automatic, but knowing what to send matters:

```typescript
// fetch with credentials — sends cookies and receives Set-Cookie cross-origin
// ONLY works if server echoes specific origin and credentials:true
const res = await fetch("https://api.shopfast.com/v1/cart", {
  credentials: "include",   // ← without this, cookies are NOT sent cross-origin
  headers: { Accept: "application/json" },
});

// Conditional GET — send ETag back to avoid re-downloading unchanged data
const cached = sessionStorage.getItem("product-42-etag");
const res2 = await fetch("https://api.shopfast.com/v1/products/42", {
  headers: {
    "If-None-Match": cached ?? "",   // server returns 304 (Not Modified) if ETag matches
  },
});
if (res2.status === 304) {
  return JSON.parse(sessionStorage.getItem("product-42-body")!);  // use cached body
}
const body = await res2.json();
sessionStorage.setItem("product-42-etag", res2.headers.get("ETag") ?? "");
sessionStorage.setItem("product-42-body", JSON.stringify(body));
```

### Types & differences

| Cookie attribute | What it does | ShopFast setting | Why |
|---|---|---|---|
| `HttpOnly` | Blocks JS `document.cookie` access | ✅ on session cookie | Mitigates cookie theft via XSS |
| `Secure` | Only sent over HTTPS | ✅ | Prevents leaking on HTTP |
| `SameSite=Strict` | Never sent on any cross-site request | — | Too strict: breaks inbound links to logged-in pages |
| `SameSite=Lax` | Sent on top-level nav; not cross-site sub-requests | ✅ default | Blocks CSRF POST; allows link clicks |
| `SameSite=None` | Sent everywhere | Only if needed for embedded checkout | Requires `Secure`; needed for third-party contexts |
| `Domain=.shopfast.com` | Shared across all subdomains | ✅ | `www` and `api` share the session |

| Caching pattern | Header | When |
|---|---|---|
| Immutable static asset | `Cache-Control: public, max-age=31536000, immutable` | Content-hash in filename (e.g. `app.3f8a.js`) |
| CDN-cacheable API response | `Cache-Control: public, max-age=60` + `ETag` | Catalog product reads |
| Per-user page | `Cache-Control: private, no-cache` + `ETag` | Cart, account pages |
| Sensitive data | `Cache-Control: no-store` | Order confirmation, payment data |

**Reach for `no-store`** whenever the response contains PII (Personally Identifiable Information), payment data, or anything you never want written to disk — `no-cache` still stores it, just forces revalidation.

### Build it for real — ShopFast

ShopFast's web client is served from `https://www.shopfast.com` and calls `https://api.shopfast.com`. These are different origins — CORS must be configured or every API call fails silently in the browser.

**Decision 1 — CORS:** Allowlist `https://www.shopfast.com` and `https://admin.shopfast.com` explicitly. Set `credentials: true` so session cookies pass cross-origin. Set `Access-Control-Max-Age: 600` so the `OPTIONS` preflight is cached for 10 minutes — checkout generates a preflight on every page load otherwise, adding a full RTT (Round-Trip Time).

**Rejected:** `Access-Control-Allow-Origin: *` — incompatible with `credentials: true` (the browser rejects this combination). Reflecting every `Origin` without a whitelist — any malicious site could read ShopFast API responses in the user's logged-in context.

**Decision 2 — Session cookies:** `HttpOnly; Secure; SameSite=Lax; Domain=.shopfast.com`. `Lax` is the right choice (not `Strict`) because legitimate navigation from a Google Shopping link to `www.shopfast.com/orders` must arrive with the session cookie so the user lands logged in.

**Decision 3 — Caching headers:** `public, max-age=60` on catalog `GET` responses (consistent with the [API Design](../../../03-system-design/03-api-design/01-knowledge/README.md) and [HTTP](../../01-http/01-knowledge/README.md) decisions). `private, no-cache` on cart. `no-store` on order confirmation (contains payment summary). `Vary: Accept-Encoding` on all responses to prevent cache poisoning across gzip/identity.

> **If you get this wrong:** Caching a cart response (`GET /v1/cart`) as `public` on the CDN means User A's cart could be served to User B on the same CDN node. This is a critical data leak that bypasses all authentication — the CDN serves the response before the auth middleware even runs. Always use `Cache-Control: private` (or `no-store`) for any per-user response.

### Scaling story

- **Now (cheap):** CORS allowlist in Express middleware, session cookies with the right attributes, correct `Cache-Control` + `ETag` + `Vary` headers on catalog endpoints. Zero additional infrastructure — just correct headers.
- **Growth signal:** CDN cache hit rate for catalog reads below target; OPTIONS preflight rate climbing (add `Max-Age`); CSRF reports or session fixation alerts.
- **At scale:** Move CORS validation to the CDN/edge (handled before the request hits origin servers); adopt JWT (JSON Web Token) short-lived access tokens + `HttpOnly` refresh-token cookie for a stateless auth layer (eliminating the shared Redis session store bottleneck); add `stale-while-revalidate` on catalog reads for zero-latency cache updates. Cross-links: [HTTP](../../01-http/01-knowledge/README.md) for the full caching model; [Auth](../../../09-security/01-auth/01-knowledge/README.md) for JWT/session architecture next.

---

## 1. Origins & the Same-Origin Policy (SOP)

An **origin** = scheme + host + port (`https://app.example.com:443`). Two URLs share an origin only if all three match. The SOP (Same-Origin Policy) is a browser security boundary: scripts on one origin can't read responses from another origin by default. It's what stops `evil.com` from reading your `bank.com` data using your logged-in session.

- SOP restricts *reading* cross-origin responses, not *sending* requests — which is why CSRF (Cross-Site Request Forgery) (below) is a separate problem.
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
- **`HttpOnly`** — JS can't read it (`document.cookie`), mitigating cookie theft via XSS (Cross-Site Scripting). Use for session cookies.
- **`Secure`** — only sent over HTTPS.
- **`SameSite`** — the main CSRF (Cross-Site Request Forgery) control:
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

### Tokens / JWT (JSON Web Token — stateless)
- A signed token (e.g. JWT) carries claims; the server verifies the signature — no lookup needed.
- Pros: stateless, scales without a shared store, works across services.
- Cons: **hard to revoke before expiry** (token is valid until it expires); larger; if stored in `localStorage` it's XSS-exposed. Common pattern: short-lived access token + longer-lived refresh token (rotated), access token kept in memory or an `HttpOnly` cookie.

| | Server session | JWT/token |
|---|---|---|
| State | Server store | Self-contained |
| Scale | Needs shared store | Stateless |
| Revoke | Easy (delete) | Hard (until expiry) |
| Size | Tiny cookie | Larger |
| Best for | Classic web apps | APIs, microservices, SPAs (Single-Page Applications) |

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
- `Cache-Control: no-store` — sensitive data (account pages, anything with PII (Personally Identifiable Information) you don't want on disk).
- `Vary: Accept-Encoding, Origin` — tells caches to key by these headers so they don't serve a gzip body to a client that can't decompress, or a CORS response for the wrong origin.
- `ETag` + `If-None-Match` → `304 Not Modified` for cheap revalidation.

**Cache-busting** via content-hashed filenames is how you get "cache forever" *and* instant deploys: a new build = new filename = guaranteed fresh.

---

## 7. Common pitfalls & misconceptions

- "CORS secures my API." No — CORS is a *browser* feature that protects *users*; your endpoint is still reachable by curl/Postman. Authn (Authentication)/authz (Authorization) is separate.
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

- **Origin** = scheme+host+port; **SOP (Same-Origin Policy)** blocks cross-origin *reads* in the browser.
- **CORS (Cross-Origin Resource Sharing)** = server opt-in (`Access-Control-Allow-*`); **browser-enforced**, not API security. Non-simple requests trigger an **`OPTIONS` preflight**. `*` ≠ credentials.
- **Cookies**: `HttpOnly` (anti-XSS), `Secure` (HTTPS), `SameSite` (anti-CSRF; `Lax` default), `Domain/Path`, `Max-Age`.
- **Sessions** (stateful, easy revoke, needs store) vs **JWT (JSON Web Token)** (stateless, hard revoke, XSS risk in localStorage). Use short access + refresh tokens.
- **CSRF (Cross-Site Request Forgery)** ≠ CORS: cookies auto-attach → defend with `SameSite` + CSRF tokens + `Origin` checks.
- **Caching headers**: `immutable` for fingerprinted assets, `private/no-cache` for per-user, `no-store` for sensitive, always `Vary` correctly.
