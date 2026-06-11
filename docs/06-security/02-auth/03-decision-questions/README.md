# AuthN & AuthZ — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: OAuth, JWT, sessions, SSO, RBAC.

---

### D1. Stateful sessions vs stateless JWTs for a web app?

**Options**
- **A. Server-side sessions** (opaque ID in cookie + Redis/DB store).
- **B. Stateless JWT** (signed token, verified offline).
- **C. Hybrid** — short stateless access token + stateful refresh token at the auth server.

**Recommendation:** For a single app or modest microservice count, **A (sessions)** is the simplest correct choice: trivial revocation, full server control, small cookie. For large fan-out across many services and mobile/native clients, **C (hybrid)** gives JWT's scalability while keeping a revocation point. Pure **B** is justified only when you genuinely can't afford a lookup and can tolerate "revocation = wait for expiry."

**What would change the answer:** A hard requirement for instant global logout/ban pushes toward A or C. A multi-team microservice estate where a shared session store becomes a bottleneck pushes toward B/C. Strict regulatory "kill access now" requirements rule out long-lived pure JWTs.

---

### D2. Build your own auth vs use a managed provider (Auth0/Cognito/Okta) vs self-host (Keycloak)?

**Options**
- **A. Roll your own** (full control, no per-MAU cost, total responsibility).
- **B. Managed SaaS** (Auth0/Okta/Cognito) — fast, secure defaults, MFA/SSO built in, ongoing cost + lock-in.
- **C. Self-hosted OSS** (Keycloak/Ory) — control + standards compliance, but you run and patch it.

**Recommendation:** **B for most teams.** Auth is high-blast-radius and easy to get subtly wrong (token handling, MFA, account recovery, breach response). Buying battle-tested auth is one of the clearest build-vs-buy wins. Choose **C** when cost at scale, data residency, or avoiding vendor lock-in dominate and you have the ops maturity to run it. Choose **A** only with a dedicated security team and a strong, specific reason.

**What would change the answer:** Very high MAU making SaaS pricing painful → C. Strict data-residency/air-gapped requirements → C or A. A tiny internal tool with no real attack surface might justify a thin A.

---

### D3. Where to store the access token in a browser SPA: `HttpOnly` cookie vs `localStorage` vs in-memory?

**Options**
- **A. `HttpOnly` `Secure` `SameSite` cookie** — XSS-safe storage, needs CSRF defense.
- **B. `localStorage`** — easy, but XSS-readable.
- **C. In-memory (JS variable)** — gone on refresh, needs silent re-auth; not persisted so not stealable from storage.

**Recommendation:** **A** as the default — `HttpOnly` defeats XSS token theft, and `SameSite=Lax/Strict` plus a CSRF token closes the CSRF gap. **C (in-memory) + refresh via `HttpOnly` cookie** is an excellent pattern for SPAs that want bearer-header semantics without persisting the token. **Avoid B** — any XSS becomes full account takeover.

**What would change the answer:** A pure API consumed only by native/mobile (no browser) removes the XSS-vs-CSRF dilemma — bearer headers are fine. A strict no-cookie architecture (e.g., cross-domain APIs) leans toward C with careful refresh handling.

---

### D4. RBAC vs ABAC for a growing SaaS authorization model?

**Options**
- **A. Pure RBAC** — roles → permissions.
- **B. Pure ABAC** — policy over attributes.
- **C. RBAC base + ABAC conditions** (attribute-augmented roles).

**Recommendation:** Start with **A** — it's auditable, easy to reason about, and covers 80% of needs. Move to **C** when you hit requirements RBAC can't express cleanly without role explosion (ownership, tenancy, time/location, resource attributes). Reserve full **B** for genuinely policy-driven domains (e.g., regulated access control) where a policy engine (OPA/Cedar) is warranted.

**What would change the answer:** Multi-tenant isolation and per-resource sharing (docs, folders) may push toward **ReBAC** (Zanzibar/OpenFGA) instead. If auditors need "who can do what" to be statically enumerable, lean RBAC; ABAC's dynamic decisions are harder to audit.

---

### D5. Access-token lifetime: long (hours) vs short (minutes) + refresh?

**Options**
- **A. Long-lived access token** (hours/days), no refresh.
- **B. Short access token (5–15 min) + refresh token.**
- **C. Medium (1 hr) access token, no refresh.**

**Recommendation:** **B.** Short access tokens bound the damage of theft to minutes, while refresh tokens (rotated, with reuse detection) keep UX smooth and provide a revocation point. **A** maximizes blast radius — a leaked token is valid for a long time with no way to pull it back. **C** is a weak middle ground only acceptable for low-risk internal APIs.

**What would change the answer:** Very chatty clients where refresh overhead matters might lengthen the access token slightly. Extremely high-value operations might *shorten* it further and add step-up re-auth.

---

### D6. SSO via SAML vs OIDC for enterprise integration?

**Options**
- **A. SAML 2.0** — entrenched in enterprise IdPs, XML assertions.
- **B. OIDC** — modern, JSON/JWT, mobile-friendly, simpler.

**Recommendation:** **B (OIDC)** for new integrations — simpler, better tooling, works cleanly with SPAs and mobile, fewer footguns than XML signature handling. Support **A (SAML)** when selling into enterprises whose IdPs only speak SAML — that's a sales/compatibility reality, not a technical preference. Many B2B products end up supporting both.

**What would change the answer:** The customer's IdP capabilities dominate. If every target buyer mandates SAML, you support SAML regardless of its complexity.

---

### D7. Centralized policy engine (OPA/Cedar) vs in-code authorization checks?

**Options**
- **A. In-code checks** scattered at each endpoint.
- **B. Shared authorization library** (single module, called everywhere).
- **C. External policy engine** (OPA/Cedar as a PDP).

**Recommendation:** Avoid **A** at scale — checks drift and get forgotten (the #1 cause of broken access control). **B** is the pragmatic default: one place to encode and test authorization logic, enforced at each PEP. Graduate to **C** when policy must be decoupled from code, shared across many services/languages, audited, or updated without redeploys.

**What would change the answer:** Polyglot microservices and a need to change policy without shipping code favor C. A single monolith is well served by B and shouldn't take on OPA's operational weight prematurely.
