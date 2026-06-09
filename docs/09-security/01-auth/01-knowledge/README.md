# AuthN & AuthZ — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: OAuth, JWT, sessions, SSO, RBAC.

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

### Self-contained tokens (stateless) — JWT
- A **JWT** (JSON Web Token) is `base64url(header).base64url(payload).signature`. The signature (HMAC with a shared secret, or RSA/ECDSA with a private key) lets any service verify integrity **without a DB lookup**.
- **Claims**: `iss` (issuer), `sub` (subject), `aud` (audience), `exp` (expiry), `iat`, `nbf`, plus custom claims (roles, scopes).

**Pros:** stateless, horizontally scalable, works across services that share the verification key.
**Cons:** **can't be revoked before expiry** (the hard problem). Bigger than a session ID. Payload is readable (base64, *not* encrypted) — never put secrets in it.

> **The JWT revocation problem.** Because verification is offline, a stolen/abused token is valid until `exp`. Mitigations: short-lived access tokens (5–15 min) + long-lived refresh tokens; a token denylist (reintroduces state, eroding the main benefit); token versioning (`token_version` claim checked against a per-user counter — one cheap lookup).

### Access + refresh token pattern
- **Access token**: short-lived (minutes), sent on every API call, stateless.
- **Refresh token**: long-lived (days/weeks), stored securely, exchanged for new access tokens at the auth server (which *is* stateful and can revoke). **Rotate refresh tokens on each use** and detect reuse (a replayed old refresh token ⇒ theft ⇒ revoke the whole family).

### Where to store tokens in a browser
- **`HttpOnly`, `Secure`, `SameSite` cookie** — not readable by JS, immune to XSS theft, but needs CSRF protection.
- **`localStorage`** — readable by JS ⇒ any XSS steals it. Avoid for bearer tokens.
- Pragmatic answer: cookies for the browser; bearer headers for mobile/native and service-to-service.

---

## 4. OAuth 2.0 & OpenID Connect

**OAuth 2.0 is delegated *authorization*, not authentication.** It lets a user grant a third-party app limited access to their resources without sharing credentials.

Roles:
- **Resource owner** — the user.
- **Client** — the app requesting access.
- **Authorization server** — issues tokens.
- **Resource server** — the API holding the data.

### Authorization Code flow with PKCE (the one to know)
1. Client redirects user to the auth server with `response_type=code`, a `code_challenge` (PKCE), and a `state` param.
2. User authenticates and consents.
3. Auth server redirects back with an authorization **code** + the echoed `state`.
4. Client exchanges the code (plus `code_verifier`) at the token endpoint for an **access token** (and optionally refresh token).

- **PKCE** (Proof Key for Code Exchange) prevents code interception — now required for *all* clients, not just public/mobile ones.
- **`state`** prevents CSRF on the redirect.
- The **Implicit flow** (token in URL fragment) is **deprecated** — use Auth Code + PKCE everywhere.
- **Client Credentials** flow: machine-to-machine, no user involved.

### OpenID Connect (OIDC)
- A thin identity layer **on top of OAuth 2.0** that adds an **ID token** (a JWT describing the user). This is the standard way to do "Sign in with Google/Okta/etc."
- Key distinction: **access token = authorization (for the API); ID token = authentication (about the user)**. Never use an access token to identify the user, and never send an ID token to a resource server as a credential.

---

## 5. Single Sign-On (SSO) & federation

- **SSO**: authenticate once, access many apps. Implemented via OIDC or **SAML 2.0** (XML-based, common in enterprise).
- The **IdP** (Okta, Azure AD, Google) authenticates; **SPs** (your apps) trust it.
- **SAML** uses signed XML assertions — watch for XML signature wrapping attacks and canonicalization bugs.
- Benefits: central credential & MFA policy, instant deprovisioning (disable in IdP ⇒ access gone everywhere). Risk: the IdP is a single point of failure and a high-value target.

---

## 6. Authorization models

| Model | Idea | Best for |
|---|---|---|
| **RBAC** | Permissions grouped into roles; users get roles | Most apps; coarse-grained |
| **ABAC** | Decisions from attributes (user, resource, environment) via policy | Fine-grained, contextual rules |
| **ReBAC** | Relationship graph (Google Zanzibar / OpenFGA) | "Can user X view doc Y because they're in folder Z's group" |
| **ACL** | Per-resource list of who-can-do-what | Small, explicit sets |

- **RBAC** pitfalls: role explosion (a new role per edge case), and roles that don't map to real org structure. Keep roles to *job functions*, attach permissions to roles.
- **Principle of least privilege**: grant the minimum needed. Default-deny.
- **Centralize the policy decision** (a policy engine like OPA/Cedar, or a shared authz library) so it isn't re-implemented inconsistently per endpoint. **Policy Decision Point (PDP)** vs **Policy Enforcement Point (PEP)**.

---

## 7. Tradeoffs interviewers want you to reason about

- **Stateful sessions vs stateless JWT** — revocation & control vs scalability & no shared store. The "right" answer is context: internal monolith → sessions; large fan-out microservices / mobile → short JWT + refresh.
- **Token lifetime** — long-lived = convenient but dangerous if stolen; short-lived = safe but more refresh traffic. Resolve with access+refresh split.
- **Cookie vs header storage** — cookie = CSRF risk + automatic sending; header = XSS risk + manual handling.
- **Build vs buy auth** — rolling your own is a classic mistake. Prefer Auth0/Okta/Cognito/Keycloak unless you have a strong reason; auth bugs are catastrophic.

---

## 8. Common pitfalls & misconceptions

- **"JWTs are encrypted."** No — they're *signed*. Payload is readable. Use JWE if you need encryption.
- **Accepting `alg: none`** — historic JWT vuln. Pin the expected algorithm server-side; never let the token dictate it. Also reject `alg` confusion (RS256 token verified as HS256 using the public key as the HMAC secret).
- **Not validating `aud`/`iss`/`exp`** — a token minted for another service should not be accepted.
- **Checking AuthZ only in the UI** — the API must enforce it. Hiding a button ≠ security.
- **IDOR** — using a user-supplied ID without checking ownership (`/orders/123`). Always scope queries to the principal.
- **Long-lived refresh tokens without rotation/reuse detection.**
- **Lockout as the only brute-force defense** — enables account-lockout DoS. Prefer rate limiting + MFA + breach checks.
- **Putting the user's role in the JWT and never re-checking** — a demoted user keeps their old role until `exp`.

---

## 9. What interviewers probe

- Walk through the OAuth Authorization Code + PKCE flow and *why each piece exists* (`state`, PKCE, code exchange).
- Difference between OAuth and OIDC; access token vs ID token.
- How you'd revoke a compromised JWT in a stateless system.
- Where to store tokens in a browser and the CSRF/XSS tradeoff.
- Design RBAC for a multi-tenant SaaS; how to prevent cross-tenant access.
- How session fixation / session hijacking work and how to prevent them (regenerate session ID on privilege change, `HttpOnly`/`Secure`/`SameSite`).

---

## 10. Quick-reference summary

- **AuthN = who; AuthZ = what.** AuthN once, AuthZ every request, on the **server**.
- Passwords: `argon2id`, salted, slow. Prefer **passkeys/WebAuthn** (phishing-resistant).
- **Sessions** = stateful, easy revoke; **JWT** = stateless, hard revoke → use **short access + rotating refresh**.
- **OAuth = delegated authorization; OIDC adds identity (ID token).** Use **Auth Code + PKCE**; never Implicit.
- Browser tokens → `HttpOnly` `Secure` `SameSite` cookies (+ CSRF defense).
- Validate `alg`, `iss`, `aud`, `exp`. Pin the algorithm. Never trust the token's own `alg=none`.
- **RBAC** for most; ABAC/ReBAC for fine-grained. Default-deny, least privilege, centralized policy.
- **Don't roll your own auth.** Watch for IDOR and UI-only authz.
