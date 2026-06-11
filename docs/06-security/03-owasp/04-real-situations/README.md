# OWASP Top 10 — Real-World Situations

[← Topic overview](../README.md)

> Topic: SQLi, XSS, CSRF, common web vulnerabilities.

Each scenario: **model approach → mitigate → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. SQL injection discovered in a legacy search endpoint

**Situation:** A bug-bounty report shows `/search?q=` is SQL-injectable; the report includes a proof-of-concept dumping table names.

- **Mitigate:** Deploy a WAF rule to block the obvious payload as a stopgap (buys time, not a fix), and rate-limit the endpoint. If exploitation looks active, consider taking the endpoint offline.
- **Diagnose with data:** Grep DB and app logs for the injection markers (`UNION SELECT`, `information_schema`, error-based patterns) to scope what was accessed and whether data was exfiltrated. Check the DB account's privileges to bound the blast radius.
- **Communicate:** Acknowledge the report on the agreed timeline; if data exposure is confirmed, engage security/legal for breach assessment.
- **Root-cause fix:** Rewrite the query with **parameterized statements**; audit the codebase for the same string-concatenation pattern (it's rarely a single instance).
- **Prevention:** SAST in CI to catch concatenated SQL; least-privilege DB accounts; coding standard mandating parameterization; regression test asserting the payload is now inert.

---

### S2. Stored XSS in user profiles is hijacking sessions

**Situation:** Reports that viewing certain profiles steals session cookies — a stored XSS payload in the "bio" field executes for every viewer.

- **Mitigate:** Identify and quarantine the malicious payloads (null out or escape affected bios); deploy a CSP that blocks inline scripts and external script sources to neutralize live payloads immediately.
- **Diagnose with data:** Query the bios table for script-like content; correlate with reports of account takeover; check whether `HttpOnly` was missing on the session cookie (that's why JS could read it).
- **Communicate:** Notify affected users to re-authenticate; brief security on scope and whether tokens were exfiltrated.
- **Root-cause fix:** Apply **context-aware output encoding** when rendering bios (or sanitize with DOMPurify if HTML is allowed); set `HttpOnly` on session cookies so XSS can't read them.
- **Prevention:** Framework auto-escaping (no raw `innerHTML`/`dangerouslySetInnerHTML`); CSP as standing defense-in-depth; `HttpOnly`/`Secure`/`SameSite` cookies; XSS tests in CI.

---

### S3. CSRF lets attackers change victim email addresses

**Situation:** A researcher shows that an attacker page can silently submit the "change email" form for any logged-in user, enabling account takeover via password reset.

- **Mitigate:** Set `SameSite=Lax` (or `Strict` for this action) on the session cookie immediately, and require re-authentication for email changes.
- **Diagnose with data:** Audit recent email-change events for ones lacking a valid anti-CSRF token or originating from cross-site referers; identify any accounts already taken over.
- **Communicate:** Reset affected accounts and notify users; report timeline to security.
- **Root-cause fix:** Add a **synchronizer anti-CSRF token** to all state-changing forms and validate it server-side; require the current password for sensitive changes.
- **Prevention:** CSRF protection by default in the framework/middleware; `SameSite` cookie defaults; step-up auth for account-security changes; tests verifying mutating endpoints reject missing/invalid tokens.

---

### S4. SSRF via image-URL feature exposes cloud credentials

**Situation:** An "import image from URL" feature is abused to make the server fetch `http://169.254.169.254/latest/meta-data/iam/security-credentials/` and return AWS credentials.

- **Mitigate:** Disable the URL-import feature; rotate the exposed IAM role credentials immediately and review CloudTrail for misuse.
- **Diagnose with data:** Inspect logs for outbound requests to link-local/private ranges; check CloudTrail for API calls made with the leaked credentials and any resources touched.
- **Communicate:** Treat as a potential breach — engage security/incident response; assess whether downstream data was accessed.
- **Root-cause fix:** Validate fetch URLs against an **allow-list**, block private/loopback/link-local IP ranges, and enforce **IMDSv2** (token-required) so naive SSRF can't read metadata. Apply least-privilege to the instance role.
- **Prevention:** Central SSRF-safe HTTP client; IMDSv2 enforced fleet-wide; egress filtering; least-privilege IAM so even a leak is low-impact.

---

### S5. A vulnerable dependency (CVE) lands in production

**Situation:** A new critical CVE drops for a logging/serialization library you depend on (think Log4Shell-class). Exploits are circulating within hours.

- **Mitigate:** Apply the documented temporary mitigation (config flag/env var) and/or WAF rule immediately while the patched version is rolled out. Identify all services using the library via the SBOM.
- **Diagnose with data:** Use SCA tooling to enumerate affected services and versions; check logs/IDS for exploitation attempts matching the CVE's signature.
- **Communicate:** Open an incident, set a patch SLA, and report status to leadership; coordinate across teams owning affected services.
- **Root-cause fix:** Upgrade to the patched version everywhere; verify the mitigation held in the interim.
- **Prevention:** SCA/Dependabot in CI with severity gating, an up-to-date SBOM, a documented rapid-patch runbook, and removing unused dependencies to shrink exposure.

---

### S6. Security misconfiguration — verbose errors leak stack traces and secrets

**Situation:** Production 500 pages render full stack traces, framework versions, and a database connection string.

- **Mitigate:** Flip the app to production error mode (generic error pages, no stack traces) and rotate any credentials exposed in the traces.
- **Diagnose with data:** Reproduce error pages across environments; scan logs/screenshots shared externally; confirm which secrets appeared and where the debug flag came from (default config, env var, recent deploy).
- **Communicate:** Note exposure window and rotated secrets to security.
- **Root-cause fix:** Enforce `DEBUG=false` (or equivalent) in prod via validated config; centralize error handling to return safe responses while logging detail server-side only.
- **Prevention:** Config validation that fails the build/boot if debug is on in prod; security headers and hardening baked into the base image; pre-prod config review in the deploy checklist.

---

### S7. Broken function-level authorization — non-admins reach the admin API

**Situation:** The admin UI is hidden from regular users, but the underlying `/api/admin/*` endpoints don't check the caller's role, so anyone who guesses the path can use them.

- **Mitigate:** Add a server-side role check (default-deny) to the admin routes immediately; consider blocking the path at the gateway for non-admin tokens.
- **Diagnose with data:** Review access logs for non-admin principals hitting admin endpoints; quantify any unauthorized actions taken.
- **Communicate:** If privileged actions occurred, escalate to security and remediate affected data.
- **Root-cause fix:** Enforce authorization **at the API/service layer**, not the UI; centralize the check so every admin route is covered by one tested policy.
- **Prevention:** Default-deny middleware on privileged route groups; automated tests asserting non-admins get 403; security review of new admin endpoints; never rely on UI hiding for authorization.
