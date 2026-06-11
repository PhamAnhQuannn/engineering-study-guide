# AuthN & AuthZ — Practice Questions

[← Topic overview](../README.md)

> Topic: OAuth, JWT, sessions, SSO, RBAC.

---

### Q1. What is the difference between authentication and authorization?

**Answer:** Authentication (AuthN) verifies *who* a principal is — checking credentials like a password, passkey, or certificate. Authorization (AuthZ) decides *what* that authenticated principal is allowed to do against a specific resource. AuthN typically happens once per session/token; AuthZ must be checked on **every request, server-side**. A system can authenticate correctly and still leak data if authorization is missing or checked in the wrong layer (e.g., only in the UI, or via IDOR).

---

### Q2. Explain to a junior: why can't we just store a JWT in `localStorage`?

**Answer:** `localStorage` is fully readable by any JavaScript running on the page. If the site has any cross-site scripting (XSS) hole — even in a third-party script — the attacker's JS can read the token and exfiltrate it, fully impersonating the user. A cookie marked `HttpOnly` is *not* readable by JS, so XSS can't steal it. The tradeoff is that cookies are sent automatically, which opens CSRF — but we mitigate that with `SameSite` and anti-CSRF tokens. So for browsers, prefer an `HttpOnly`, `Secure`, `SameSite` cookie over `localStorage`.

---

### Q3. Are JWTs encrypted? What does the signature actually protect?

**Answer:** No — a standard JWT (JWS) is **signed, not encrypted**. The header and payload are just base64url-encoded and trivially readable by anyone. The signature provides **integrity and authenticity**: it proves the token was issued by someone holding the signing key and that the claims weren't tampered with. It does **not** provide confidentiality. Never put secrets (passwords, PII you don't want exposed) in the payload. If you need confidentiality, use JWE (encrypted JWT).

---

### Q4. Walk through the OAuth 2.0 Authorization Code flow with PKCE and explain why each protection exists.

**Answer:**
1. The client redirects the user to the authorization server with `response_type=code`, a `state` value, and a `code_challenge` (a hash of a random `code_verifier`).
2. The user authenticates and consents.
3. The auth server redirects back to the client with an authorization **code** and the echoed `state`.
4. The client POSTs the code **plus the original `code_verifier`** to the token endpoint and receives access/refresh tokens.

- **`state`** is bound to the user's session and prevents CSRF on the redirect (an attacker can't trick the victim into completing a flow the attacker started).
- **PKCE** prevents authorization-code interception: even if an attacker steals the code from a redirect, they can't exchange it without the `code_verifier`, which never left the client. PKCE is now recommended for *all* clients, not just mobile/SPA.

---

### Q5. The Implicit flow returned the token directly in the URL fragment. Why is it deprecated?

**Answer:** Tokens in the URL fragment leak through browser history, `Referer` headers, logs, and any script on the page; there's no code-exchange step, so there's no way to apply PKCE-style interception protection, and access tokens are exposed to the front end with no confidential client involvement. The Authorization Code flow with PKCE achieves the same SPA use case while keeping tokens out of the URL and adding interception protection, so it replaces Implicit everywhere.

---

### Q6. How do you revoke a JWT before it expires in a stateless system?

**Answer:** Pure stateless JWTs can't be revoked — that's the core tradeoff. Practical options:
- **Short-lived access tokens** (5–15 min) so the blast radius is small, paired with **refresh tokens** handled by a stateful auth server that *can* revoke.
- **Token versioning**: store a `token_version` per user; bump it on logout/compromise; verify the token's version against the stored counter (one cheap lookup).
- **Denylist**: cache revoked token IDs (`jti`) until their `exp`. This reintroduces state but only for revoked tokens.
Most production systems use short access + rotating refresh tokens with reuse detection.

---

### Q7. What is refresh-token rotation and reuse detection?

**Answer:** Each time a refresh token is used, the auth server issues a *new* refresh token and invalidates the old one (rotation). If an *already-used* (old) refresh token is presented again, that signals the token was stolen and replayed — the server then revokes the entire token family for that user/session. This limits the window a stolen refresh token is useful and turns theft into a detectable event.

---

### Q8. Explain to a junior the difference between OAuth and OpenID Connect.

**Answer:** OAuth 2.0 is about **authorization** — granting an app limited access to your resources (e.g., "let this app read my Google Drive"). It issues an **access token** for an API. OAuth alone doesn't reliably tell you *who* the user is. OpenID Connect (OIDC) is a thin identity layer on top of OAuth that adds an **ID token** — a JWT describing the authenticated user. So "Sign in with Google" uses OIDC. Rule of thumb: **access token = for calling APIs; ID token = for knowing who the user is.** Don't use one in place of the other.

---

### Q9. Compare RBAC, ABAC, and ReBAC. When would you reach for each?

**Answer:**
- **RBAC** (role-based): permissions bundled into roles, users assigned roles. Simple, coarse-grained; default choice for most apps. Pitfall: role explosion when you encode every edge case as a role.
- **ABAC** (attribute-based): decisions computed from attributes of the user, resource, and environment via policy (e.g., "managers can approve expenses under $5k in their own department during business hours"). Fine-grained and contextual, but harder to reason about and audit.
- **ReBAC** (relationship-based, à la Google Zanzibar/OpenFGA): authorization derived from a relationship graph ("user can view doc because they're an editor of the parent folder"). Ideal for deeply nested sharing/collaboration models.
Many systems use RBAC as the base and layer ABAC-style conditions for the fine-grained cases.

---

### Q10. What is IDOR and how do you prevent it?

**Answer:** Insecure Direct Object Reference — using a user-supplied identifier to access an object **without verifying the requester is allowed to access that object**. Example: `GET /orders/123` returns order 123 to anyone authenticated, even if it belongs to another user. Prevention: always **scope the query to the authenticated principal** (`WHERE order.id = ? AND order.user_id = current_user`), enforce object-level authorization in the API/service layer (not the UI), and consider unguessable IDs as defense-in-depth (not a substitute for the check).

---

### Q11 (MCQ). Which token storage option in a browser is most resistant to XSS token theft?

A. `localStorage`
B. `sessionStorage`
C. A JavaScript-readable cookie
D. An `HttpOnly`, `Secure`, `SameSite` cookie

**Answer: D.** `HttpOnly` makes the cookie unreadable to JavaScript, so XSS cannot exfiltrate it. A, B, and C are all readable by page scripts.

---

### Q12 (MCQ). A JWT library accepts `alg: none` from the token header. What is the risk?

A. Tokens become too large
B. An attacker can forge an unsigned token that the server accepts as valid
C. Tokens expire too quickly
D. Nothing — `none` is fine for internal services

**Answer: B.** With `alg: none` the token has no signature to verify, so an attacker can craft arbitrary claims (e.g., `admin: true`). The server must pin the expected algorithm and reject `none` (and reject RS256↔HS256 algorithm confusion).

---

### Q13 (MCQ). In OIDC, which token should a client use to call a protected resource API?

A. The ID token
B. The access token
C. The refresh token
D. Either the ID token or the access token

**Answer: B.** The access token is the credential for calling resource APIs. The ID token is for the client to learn the user's identity and must not be sent to resource servers as an API credential. The refresh token is only exchanged at the auth server for new access tokens.

---

### Q14. How would you prevent session fixation and session hijacking?

**Answer:**
- **Session fixation**: an attacker plants a known session ID before login. Prevent by **regenerating the session ID on authentication and on any privilege change**, and never accepting a session ID from the URL/query.
- **Session hijacking**: stealing a valid session ID. Mitigate with `HttpOnly`+`Secure`+`SameSite` cookies (block XSS theft and reduce cross-site sending), TLS everywhere, binding sessions to additional signals cautiously (don't hard-bind to IP for mobile users), short idle timeouts, and re-authentication for sensitive actions.
