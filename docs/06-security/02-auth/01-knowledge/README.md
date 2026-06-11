# AuthN (Authentication) & AuthZ (Authorization) — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: OAuth (Open Authorization), JWT (JSON Web Token), sessions, SSO (Single Sign-On), RBAC (Role-Based Access Control).

> **🛒 Where we are in building ShopFast** — Last topic we built the [Cryptography Basics](../../01-crypto/01-knowledge/README.md) layer — hashing, encryption, and signing primitives. Now we protect ShopFast's endpoints: this topic adds the **identity layer** — who is the caller, and what are they allowed to do? ShopFast adds JWT + OAuth2 (Open Authorization 2.0) auth, customer vs admin roles via RBAC (Role-Based Access Control), and a Redis token denylist for instant revocation. **Next:** [OWASP (Open Worldwide Application Security Project) Top 10](../../03-owasp/01-knowledge/README.md) — once you know who a user is, you still have to guard against the concrete attacks they (or adversaries) will try.

---

## Teaching arc: adding identity to ShopFast

### What it is

**Authentication (AuthN)** answers *"who are you?"* — verifying that a caller is who they claim to be.
**Authorization (AuthZ)** answers *"what are you allowed to do?"* — deciding whether that verified identity may perform a specific action on a specific resource.

They are distinct stages that happen in order. Think of a concert: the ticket scanner at the door checks your face against your ID (AuthN), and then a second person checks your wristband color before letting you into the VIP section (AuthZ). You can get through the first gate perfectly and still be denied at the second. **AuthN runs once per session or token issuance; AuthZ runs on every single request**, on the server.

A senior-level mistake is conflating the two: "we authenticate users" does not mean you've protected `/admin` — someone can be authenticated as a customer and still call admin endpoints if AuthZ is missing.

Related vocabulary:
- **Identification** — claiming an identity (e.g., "I am user #42").
- **Principal / subject** — the entity acting: a human user, a service account, or a device.
- **Credential** — proof of identity: a password, a token, a certificate.
- **Federation** — trusting an external Identity Provider (IdP) to authenticate on your behalf.

---

### What it looks like

Here is the full Authorization Code flow with PKCE (Proof Key for Code Exchange) and a JWT access token — stripped to the HTTP exchange so you can see the shape:

```
Browser                   ShopFast API               Auth Server (e.g. Okta)
  |                            |                              |
  |-- GET /login ----------->  |                              |
  |<-- redirect to /authorize  -----------------------------> |
  |                                                           |
  |   (user enters credentials at auth server)                |
  |                                                           |
  |<-- redirect to /callback?code=AUTH_CODE ------------------|
  |                            |                              |
  |-- POST /callback ---------->|                             |
  |    (exchanges code +        |-- POST /token ------------> |
  |     code_verifier)          |<-- { access_token (JWT),    |
  |                             |      refresh_token } -------|
  |<-- Set-Cookie: session -----|
  |    (HttpOnly, Secure,       |
  |     SameSite=Lax)           |
  |                             |
  |-- GET /v1/orders ---------->|
  |   Authorization: Bearer JWT |
  |                             |   verify JWT sig (no DB hit)
  |                             |   check role claim: "customer"
  |<-- 200 OK { orders } -------|
```

Key observations:
1. The browser **never sees the client secret** — only the server exchanges the code.
2. PKCE's `code_verifier` prevents an attacker who intercepts the redirect from using the code.
3. The JWT travels in the `Authorization: Bearer` header; session cookie holds the refresh token safely in `HttpOnly` storage.

---

### The code that builds it

Server-side: verifying and authorizing a JWT on an incoming request.

```typescript
import jwt from "jsonwebtoken";

// middleware: verify JWT and attach the decoded principal to the request
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "no_token" });

  try {
    // IMPORTANT: pin the algorithm — never accept the token's own alg claim
    const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
      algorithms: ["RS256"],     // reject alg:none, HS256 confusion attacks
      audience: "shopfast-api",  // validate aud claim — reject tokens minted for other services
      issuer: "https://auth.shopfast.com", // validate iss
    });

    // check denylist — one Redis lookup re-adds revocation to stateless JWTs
    const revoked = await redis.get(`token:denylist:${payload.jti}`);
    if (revoked) return res.status(401).json({ error: "token_revoked" });

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

// middleware: check a required RBAC (Role-Based Access Control) role
function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.roles?.includes(role)) {
      return res.status(403).json({ error: "forbidden" }); // 403 ≠ 401
    }
    next();
  };
}

// Only admins may call this endpoint
app.get("/v1/admin/orders", requireAuth, requireRole("admin"), async (req, res) => {
  const orders = await orderModule.listAll();
  res.json(orders);
});
```

---

### The code that calls it

Client-side: the browser web app consuming ShopFast's authenticated API.

```typescript
// Kick off the OAuth2 Authorization Code + PKCE flow
async function loginWithOAuth() {
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID(); // store this
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""); // base64url

  sessionStorage.setItem("pkce_verifier", codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: "shopfast-web",
    redirect_uri: "https://shopfast.com/callback",
    scope: "openid profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: crypto.randomUUID(), // CSRF guard on the redirect
  });

  window.location.href = `https://auth.shopfast.com/authorize?${params}`;
}

// After redirect — call our own backend; the access token stays server-side
async function loadMyOrders() {
  const res = await fetch("/v1/orders", {
    credentials: "include", // send the HttpOnly session cookie
  });
  if (res.status === 401) { loginWithOAuth(); return; }
  return res.json();
}
```

---

### Types & differences

| Mechanism | One-line | Reach for it when |
|---|---|---|
| **Server-side session** | Opaque ID in cookie; state in Redis/DB | Internal/monolith apps; trivial revocation needed |
| **JWT (JSON Web Token)** | Signed self-contained token; no DB lookup to verify | Distributed/microservices; mobile → API; cross-service |
| **OAuth2 Auth Code + PKCE** | Delegated authorization via redirect + code exchange | "Sign in with Google/Okta"; any third-party login |
| **OpenID Connect (OIDC)** | OAuth2 + ID token (proves identity, not just access) | "Who is this user?" — use ID token for identity, access token for API |
| **Client Credentials** | Machine-to-machine; no user involved | Service A calling Service B |
| **SAML 2.0** | XML assertions; enterprise SSO (Single Sign-On) | Legacy enterprise IdPs (Okta/Azure SAML) |

---

### Build it for real — ShopFast

ShopFast has two classes of user: **customers** (browse, cart, checkout) and **admins** (manage catalog, view all orders). It also has a payment flow that touches card data, which means a compromised token is a financial liability.

**Decision:** JWT (JSON Web Token) access tokens + OAuth2 (Open Authorization 2.0) for issuance, with a **Redis token denylist** for revocation.

- **Short-lived access tokens (15 min)** + **rotating refresh tokens (7 days)** — stolen access tokens expire fast; stolen refresh tokens are detected by reuse-detection.
- **RBAC (Role-Based Access Control)** with two roles: `customer` and `admin`. The `roles` claim is embedded in the JWT and verified server-side on every request. Admins are a tiny set; role explosion is not a risk at our scale.
- **Redis denylist keyed by `jti` (JWT ID)** — on logout or forced revocation, write `token:denylist:<jti>` with TTL equal to the token's remaining lifetime. One Redis lookup per request, but we already have Redis for caching — no new dependency.
- **Tokens stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies** — not in `localStorage`, which is readable by any XSS payload.

**Rejected:** opaque session IDs only — once we extract the `order` service (per our [modular monolith](../../../03-system-design/04-architecture-styles/01-knowledge/README.md) plan), sessions would require a shared Redis store that each service hits; JWTs let catalog/order verify independently without coupling through a session store. Rejected: no denylist — a 15-min window is tolerable for most tokens but unacceptable if an admin account is compromised mid-session.

> **If you get this wrong…** Skipping the Redis denylist means a compromised admin token lets an attacker manage your catalog or view all orders for up to 15 minutes after you detect the breach and terminate the session. At ShopFast's scale that could mean thousands of orders exposed or products deleted. The one Redis read per request is a trivial cost compared to that blast radius.

---

### Scaling story

- **Now (launch):** JWT + Redis denylist on the monolith. Refresh token rotation on a single auth endpoint. Admin RBAC with two roles. Cost: Redis already in use for cache — denylist is a free namespace.
- **Growth signal:** Auth logic is copy-pasted across services as the monolith begins to split. A third role ("support agent") is added but it has no clear permission boundaries. Token refresh rate shows up in auth server metrics (> 10 req/s per MAU).
- **At scale (millions+):** Extract a dedicated **Auth Service** that is the sole issuer and revocation source. Adopt a **policy engine** (OPA, Cedar) as a Policy Decision Point (PDP) so RBAC rules are centralized and testable, not scattered in middleware. Distribute the JWT public key via **JWKS (JSON Web Key Set)** endpoint so new services pick it up automatically. Consider OIDC-compliant tokens and an enterprise SSO integration for B2B customers. See also [Secrets](../../04-secrets/01-knowledge/README.md) for how to store the signing key safely.

---

## 1. Core concepts: the two questions

- **Authentication (AuthN)** — *who are you?* Verifying identity (password, passkey, OTP, certificate).
- **Authorization (AuthZ)** — *what are you allowed to do?* Deciding whether an authenticated principal may perform an action on a resource.

They are distinct stages. A common senior-level failure is conflating them: a system can authenticate a user perfectly and still leak data because authorization is checked in the wrong place (or not at all — see IDOR / OWASP "Broken Access Control"). **Authentication runs once per session/token; authorization runs on every request.**

Related vocabulary:
- **Identification** — claiming an identity (username).
- **Principal / subject** — the entity acting (user, service account, device).
- **Credential** — proof of identity (secret, key, token).
- **Federation** — trusting an external identity provider (IdP) to authenticate.

---

## 2. Authentication mechanisms

### Passwords
- Never store plaintext or reversibly encrypted. Store a **salted, slow hash**: `bcrypt`, `scrypt`, or `argon2id` (preferred). See the crypto module for why.
- Defenses: rate limiting, account lockout *with care* (lockout is a DoS vector), breach-password checks (HaveIBeenPwned k-anonymity API), MFA.

### Multi-factor authentication (MFA)
- **Something you know** (password), **have** (TOTP app, hardware key), **are** (biometric).
- **TOTP** (RFC 6238): time-based 6-digit codes from a shared secret. Phishable.
- **WebAuthn / FIDO2 / passkeys**: public-key based, **origin-bound**, phishing-resistant. The gold standard now. Private key never leaves the authenticator; server stores only the public key.
- SMS OTP is weak (SIM swap, SS7 interception) — acceptable as a fallback, not a primary factor for high-value accounts.

### Passwordless
- Magic links (email), passkeys, OTP. Shifts trust to the email/SMS channel — only as strong as that channel.

---

## 3. Sessions vs tokens

### Server-side sessions (stateful)
1. User authenticates → server creates a session record (in Redis/DB), returns an opaque **session ID** in a cookie.
2. Each request sends the cookie; server looks up the session.

**Pros:** trivial revocation (delete the row), small cookie, server controls all state.
**Cons:** requires a session store; lookup on every request; sticky-session or shared store needed when horizontally scaled.

### Self-contained tokens (stateless) — JWT (JSON Web Token)
- A **JWT (JSON Web Token)** is `base64url(header).base64url(payload).signature`. The signature (HMAC with a shared secret, or RSA/ECDSA with a private key) lets any service verify integrity **without a DB lookup**.
- **Claims**: `iss` (issuer), `sub` (subject), `aud` (audience), `exp` (expiry), `iat`, `nbf`, plus custom claims (roles, scopes).

**Pros:** stateless, horizontally scalable, works across services that share the verification key.
**Cons:** **can't be revoked before expiry** (the hard problem). Bigger than a session ID. Payload is readable (base64, *not* encrypted) — never put secrets in it.

> **The JWT revocation problem.** Because verification is offline, a stolen/abused token is valid until `exp`. Mitigations: short-lived access tokens (5–15 min) + long-lived refresh tokens; a token denylist (reintroduces state, eroding the main benefit); token versioning (`token_version` claim checked against a per-user counter — one cheap lookup).

### Access + refresh token pattern
- **Access token**: short-lived (minutes), sent on every API call, stateless.
- **Refresh token**: long-lived (days/weeks), stored securely, exchanged for new access tokens at the auth server (which *is* stateful and can revoke). **Rotate refresh tokens on each use** and detect reuse (a replayed old refresh token ⇒ theft ⇒ revoke the whole family).

### Where to store tokens in a browser
- **`HttpOnly`, `Secure`, `SameSite` cookie** — not readable by JS, immune to XSS (Cross-Site Scripting) theft, but needs CSRF (Cross-Site Request Forgery) protection.
- **`localStorage`** — readable by JS ⇒ any XSS steals it. Avoid for bearer tokens.
- Pragmatic answer: cookies for the browser; bearer headers for mobile/native and service-to-service.

---

## 4. OAuth 2.0 (Open Authorization 2.0) & OpenID Connect (OIDC)

**OAuth 2.0 is delegated *authorization*, not authentication.** It lets a user grant a third-party app limited access to their resources without sharing credentials.

Roles:
- **Resource owner** — the user.
- **Client** — the app requesting access.
- **Authorization server** — issues tokens.
- **Resource server** — the API holding the data.

### Authorization Code flow with PKCE (Proof Key for Code Exchange) (the one to know)
1. Client redirects user to the auth server with `response_type=code`, a `code_challenge` (PKCE), and a `state` param.
2. User authenticates and consents.
3. Auth server redirects back with an authorization **code** + the echoed `state`.
4. Client exchanges the code (plus `code_verifier`) at the token endpoint for an **access token** (and optionally refresh token).

- **PKCE (Proof Key for Code Exchange)** prevents code interception — now required for *all* clients, not just public/mobile ones.
- **`state`** prevents CSRF (Cross-Site Request Forgery) on the redirect.
- The **Implicit flow** (token in URL fragment) is **deprecated** — use Auth Code + PKCE everywhere.
- **Client Credentials** flow: machine-to-machine, no user involved.

### OpenID Connect (OIDC)
- A thin identity layer **on top of OAuth 2.0** that adds an **ID token** (a JWT (JSON Web Token) describing the user). This is the standard way to do "Sign in with Google/Okta/etc."
- Key distinction: **access token = authorization (for the API); ID token = authentication (about the user)**. Never use an access token to identify the user, and never send an ID token to a resource server as a credential.

---

## 5. Single Sign-On (SSO) & federation

- **SSO (Single Sign-On)**: authenticate once, access many apps. Implemented via OIDC or **SAML 2.0** (XML-based, common in enterprise).
- The **IdP** (Identity Provider — Okta, Azure AD, Google) authenticates; **SPs (Service Providers)** (your apps) trust it.
- **SAML** uses signed XML assertions — watch for XML signature wrapping attacks and canonicalization bugs.
- Benefits: central credential & MFA policy, instant deprovisioning (disable in IdP ⇒ access gone everywhere). Risk: the IdP is a single point of failure and a high-value target.

---

## 6. Authorization models

| Model | Idea | Best for |
|---|---|---|
| **RBAC (Role-Based Access Control)** | Permissions grouped into roles; users get roles | Most apps; coarse-grained |
| **ABAC (Attribute-Based Access Control)** | Decisions from attributes (user, resource, environment) via policy | Fine-grained, contextual rules |
| **ReBAC (Relationship-Based Access Control)** | Relationship graph (Google Zanzibar / OpenFGA) | "Can user X view doc Y because they're in folder Z's group" |
| **ACL (Access Control List)** | Per-resource list of who-can-do-what | Small, explicit sets |

- **RBAC (Role-Based Access Control)** pitfalls: role explosion (a new role per edge case), and roles that don't map to real org structure. Keep roles to *job functions*, attach permissions to roles.
- **Principle of least privilege**: grant the minimum needed. Default-deny.
- **Centralize the policy decision** (a policy engine like OPA/Cedar, or a shared authz library) so it isn't re-implemented inconsistently per endpoint. **PDP (Policy Decision Point)** vs **PEP (Policy Enforcement Point)**.

---

## 7. Tradeoffs interviewers want you to reason about

- **Stateful sessions vs stateless JWT (JSON Web Token)** — revocation & control vs scalability & no shared store. The "right" answer is context: internal monolith → sessions; large fan-out microservices / mobile → short JWT + refresh.
- **Token lifetime** — long-lived = convenient but dangerous if stolen; short-lived = safe but more refresh traffic. Resolve with access+refresh split.
- **Cookie vs header storage** — cookie = CSRF (Cross-Site Request Forgery) risk + automatic sending; header = XSS (Cross-Site Scripting) risk + manual handling.
- **Build vs buy auth** — rolling your own is a classic mistake. Prefer Auth0/Okta/Cognito/Keycloak unless you have a strong reason; auth bugs are catastrophic.

---

## 8. Common pitfalls & misconceptions

- **"JWTs are encrypted."** No — they're *signed*. Payload is readable. Use JWE (JSON Web Encryption) if you need encryption.
- **Accepting `alg: none`** — historic JWT (JSON Web Token) vuln. Pin the expected algorithm server-side; never let the token dictate it. Also reject `alg` confusion (RS256 token verified as HS256 using the public key as the HMAC secret).
- **Not validating `aud`/`iss`/`exp`** — a token minted for another service should not be accepted.
- **Checking AuthZ only in the UI** — the API must enforce it. Hiding a button ≠ security.
- **IDOR (Insecure Direct Object Reference)** — using a user-supplied ID without checking ownership (`/orders/123`). Always scope queries to the principal.
- **Long-lived refresh tokens without rotation/reuse detection.**
- **Lockout as the only brute-force defense** — enables account-lockout DoS. Prefer rate limiting + MFA + breach checks.
- **Putting the user's role in the JWT and never re-checking** — a demoted user keeps their old role until `exp`.

---

## 9. What interviewers probe

- Walk through the OAuth (Open Authorization) Authorization Code + PKCE (Proof Key for Code Exchange) flow and *why each piece exists* (`state`, PKCE, code exchange).
- Difference between OAuth and OIDC (OpenID Connect); access token vs ID token.
- How you'd revoke a compromised JWT (JSON Web Token) in a stateless system.
- Where to store tokens in a browser and the CSRF (Cross-Site Request Forgery)/XSS (Cross-Site Scripting) tradeoff.
- Design RBAC (Role-Based Access Control) for a multi-tenant SaaS; how to prevent cross-tenant access.
- How session fixation / session hijacking work and how to prevent them (regenerate session ID on privilege change, `HttpOnly`/`Secure`/`SameSite`).

---

## 10. Quick-reference summary

- **AuthN = who; AuthZ = what.** AuthN once, AuthZ every request, on the **server**.
- Passwords: `argon2id`, salted, slow. Prefer **passkeys/WebAuthn** (phishing-resistant).
- **Sessions** = stateful, easy revoke; **JWT (JSON Web Token)** = stateless, hard revoke → use **short access + rotating refresh**.
- **OAuth (Open Authorization) = delegated authorization; OIDC (OpenID Connect) adds identity (ID token).** Use **Auth Code + PKCE (Proof Key for Code Exchange)**; never Implicit.
- Browser tokens → `HttpOnly` `Secure` `SameSite` cookies (+ CSRF defense).
- Validate `alg`, `iss`, `aud`, `exp`. Pin the algorithm. Never trust the token's own `alg=none`.
- **RBAC (Role-Based Access Control)** for most; ABAC/ReBAC for fine-grained. Default-deny, least privilege, centralized policy.
- **Don't roll your own auth.** Watch for IDOR (Insecure Direct Object Reference) and UI-only authz.
