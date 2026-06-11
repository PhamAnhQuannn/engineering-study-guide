# AuthN & AuthZ — Real-World Situations

[← Topic overview](../README.md)

> Topic: OAuth, JWT, sessions, SSO, RBAC.

Each scenario follows: **model approach → mitigate → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. Leaked signing key — all JWTs are now forgeable

**Situation:** A repo audit reveals the JWT HMAC signing secret was committed to a public mirror months ago. Any attacker can mint valid tokens, including `admin` claims.

- **Mitigate (now):** Rotate the signing key immediately. Because tokens are signed with the old key, rotating invalidates all existing tokens — accept the forced logout. If using asymmetric keys, publish a new key in the JWKS and remove the old `kid`. Bump a global `token_version` if you have one.
- **Diagnose with data:** Query auth logs for tokens whose `iat` predates the rotation but were used after; look for anomalous `admin`/privileged claims, unusual IPs, and tokens with `kid` of the leaked key. Check whether any privileged actions occurred during the exposure window.
- **Communicate:** Notify security leadership and on-call; if privileged abuse is confirmed, trigger incident response and (if user data is implicated) legal/comms for breach disclosure. Tell users they've been logged out and why, at the right altitude.
- **Root-cause fix:** Move the secret into a managed secrets store (Vault/KMS/Secrets Manager); remove it from history (and treat it as permanently burned). Migrate to short-lived asymmetric (RS256/ES256) signing with rotation support.
- **Prevention:** Pre-commit secret scanning + CI secret scanning; key stored only in the secrets manager; scheduled rotation; least-privilege on who can read the key.

---

### S2. "Sign in with Google" suddenly fails for all users

**Situation:** OIDC login via Google breaks across the app; users see a generic error after consenting.

- **Mitigate:** Check whether a fallback (email/password) is available and surface it. Confirm it's not a Google outage (status page) before deep-diving.
- **Diagnose with data:** Inspect the token-exchange step logs. Common culprits: clock skew causing `exp`/`iat` validation to fail; a redirect URI mismatch after a deploy changed the callback path; the OIDC discovery document / JWKS rotated and your cache pinned an old key (`kid` not found); `state` mismatch from a cookie/`SameSite` change.
- **Communicate:** Status update to support and affected users with ETA; if it's our config, own it.
- **Root-cause fix:** If JWKS rotation: refresh the key cache and honor `kid`. If redirect mismatch: register the new URI or revert the path. If clock skew: fix NTP / allow small leeway.
- **Prevention:** Auto-refresh JWKS on unknown `kid`; treat redirect URIs as config under review in deploy checklists; synthetic login monitor that exercises the full OIDC flow.

---

### S3. IDOR found in production — users can read others' invoices

**Situation:** A bug report shows `GET /api/invoices/{id}` returns any invoice regardless of owner.

- **Mitigate:** Hot-patch the endpoint to scope by owner (`WHERE id = ? AND account_id = current_account`). If exploitation is suspected, consider temporarily restricting the endpoint.
- **Diagnose with data:** Search access logs for sequential/enumeration patterns on `/invoices/{id}` and cross-account access (requester account ≠ invoice account). Quantify how many records and which accounts were exposed.
- **Communicate:** This is potential data exposure — loop in security/legal early. Prepare customer notification if PII/financial data was accessed.
- **Root-cause fix:** Add object-level authorization in the service layer, not just this endpoint. Audit sibling endpoints for the same pattern.
- **Prevention:** Centralized authorization checks (shared library/PEP); automated tests asserting cross-tenant access returns 403/404; default-deny query helpers that require an owner scope; pen-test/IDOR fuzzing in CI.

---

### S4. Refresh-token theft — account takeovers reported

**Situation:** Several users report sessions they didn't start; refresh tokens appear to have been stolen (likely via XSS or a malicious browser extension).

- **Mitigate:** Force-revoke affected refresh-token families; if rotation+reuse-detection is enabled, the system should already have flagged replays — escalate those. Push affected users through re-authentication.
- **Diagnose with data:** Look for refresh-token reuse events (old token replayed), geographically improbable logins, and a common entry vector (a recently shipped page with an XSS sink, a vulnerable dependency).
- **Communicate:** Notify affected users to re-secure accounts and check for unauthorized activity; brief leadership on scope.
- **Root-cause fix:** Patch the XSS source; move tokens to `HttpOnly` cookies so JS can't read them; ensure refresh rotation + reuse detection is on and revokes the whole family on replay.
- **Prevention:** CSP to reduce XSS impact; `HttpOnly` storage; refresh rotation by default; anomaly detection on login geo/device; subresource integrity for third-party scripts.

---

### S5. Departing employee retained access after offboarding

**Situation:** An ex-contractor's credentials still work days after their last day; access was only removed in one of several systems.

- **Mitigate:** Immediately disable the identity in the central IdP and revoke active sessions/tokens everywhere. Rotate any shared secrets they could have known.
- **Diagnose with data:** Audit which systems honored local accounts vs SSO; check access logs for any post-offboarding activity by that principal.
- **Communicate:** Report to security; if any sensitive access occurred, escalate.
- **Root-cause fix:** Route all app access through SSO/SCIM so deprovisioning in the IdP propagates everywhere; eliminate local standalone accounts.
- **Prevention:** SCIM-based automated provisioning/deprovisioning tied to HR offboarding; periodic access reviews; alert on local (non-SSO) account creation.

---

### S6. Privilege escalation via stale role in JWT

**Situation:** A user demoted from `admin` to `member` can still perform admin actions until their token expires an hour later.

- **Mitigate:** For the immediate case, invalidate the user's tokens (token-version bump or session revocation). 
- **Diagnose with data:** Confirm the authorization check reads the role from the token claim rather than re-checking current authority. Review whether any privileged actions occurred in the gap.
- **Communicate:** Note the window and any actions taken to the resource owner/security.
- **Root-cause fix:** For sensitive operations, re-check authorization against the source of truth (or a fast cache) rather than trusting a long-lived claim; shorten access-token lifetime; bump `token_version` on role changes so stale tokens fail.
- **Prevention:** Treat role changes as security events that revoke tokens; keep access tokens short; document which actions require live authority checks (step-up).

---

### S7. Brute-force / credential-stuffing wave against the login endpoint

**Situation:** Login traffic spikes 50× with many failed attempts across many accounts from rotating IPs — classic credential stuffing using a breached password list.

- **Mitigate:** Apply rate limiting per IP and per account, add CAPTCHA/proof-of-work on suspicious attempts, and block known-bad IP ranges at the edge. Avoid naive per-account lockout (enables targeted DoS).
- **Diagnose with data:** Distinguish stuffing (many accounts, low attempts each) from brute force (one account, many attempts); correlate user agents and ASN; measure success rate to gauge exposure.
- **Communicate:** Alert security; if any accounts were compromised, force resets and notify those users.
- **Root-cause fix:** Enforce MFA (kills stuffing even with valid passwords), check submitted passwords against breach corpora at set/login, and add device/risk-based step-up.
- **Prevention:** MFA by default, breach-password screening, bot-management at the edge, and monitoring/alerting on auth anomaly baselines.
