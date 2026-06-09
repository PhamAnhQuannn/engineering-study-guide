# OWASP Top 10 — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: SQLi, XSS, CSRF, common web vulnerabilities.

---

## 1. What the OWASP Top 10 is

The **OWASP Top 10** is a periodically updated, consensus list of the most critical web-application security risks, maintained by the Open Worldwide Application Security Project. It's a *risk* list (categories), not a checklist of bugs. The **2021** revision is the current widely-referenced edition; categories were reorganized around root causes rather than individual CWEs. Know the categories, their root causes, and concrete defenses — interviewers care about *why* each happens and how you'd stop it, not rote recall of the ranking.

### The 2021 categories
1. **A01 Broken Access Control** — users acting outside their permissions (IDOR, missing function-level checks, path traversal). *Now #1 — the most common serious flaw.*
2. **A02 Cryptographic Failures** — sensitive data exposed due to weak/missing crypto (plaintext storage, weak hashes, no TLS). (Formerly "Sensitive Data Exposure.")
3. **A03 Injection** — untrusted input interpreted as code/commands: SQLi, NoSQLi, OS command injection, LDAP. **XSS now lives here.**
4. **A04 Insecure Design** — flaws baked into the design, not the implementation; missing threat modeling and secure-design patterns.
5. **A05 Security Misconfiguration** — default creds, verbose errors, open cloud buckets, unnecessary features enabled. (XXE folded in here.)
6. **A06 Vulnerable & Outdated Components** — using libraries/frameworks with known CVEs.
7. **A07 Identification & Authentication Failures** — weak credential handling, broken session management, no MFA. (Formerly "Broken Authentication.")
8. **A08 Software & Data Integrity Failures** — unsigned updates, insecure deserialization, compromised CI/CD supply chain.
9. **A09 Security Logging & Monitoring Failures** — can't detect or respond to breaches.
10. **A10 Server-Side Request Forgery (SSRF)** — server tricked into making requests to internal/unintended targets.

---

## 2. Injection (A03) — the classics

### SQL Injection (SQLi)
Untrusted input concatenated into a SQL query lets an attacker alter its structure.

```python
# VULNERABLE — string concatenation
cur.execute("SELECT * FROM users WHERE email = '" + email + "'")
# email = "' OR '1'='1" -> returns all rows; "'; DROP TABLE users; --" -> destructive
```

**Defense (in priority order):**
- **Parameterized queries / prepared statements** — the only robust fix. Data is sent separately from the query text, so it can never change structure.
- **ORMs** that parameterize by default (but raw fragments can still be unsafe).
- **Allow-listing** for things that can't be parameterized (e.g., a column name in `ORDER BY`).
- **Least-privilege DB accounts** (defense in depth — limits blast radius).
- Input validation helps but is **not** a primary defense; escaping by hand is error-prone.

### Command / NoSQL / LDAP injection
Same root cause — input crossing into an interpreter. Use safe APIs (parameterized queries, `execve`-style arg arrays instead of shell strings, query builders that separate operators from values).

### Cross-Site Scripting (XSS) — now under Injection
Attacker-controlled data ends up in a page as executable script.
- **Stored XSS**: payload persisted (e.g., a comment) and served to other users.
- **Reflected XSS**: payload echoed straight back from the request (e.g., a search term in the response).
- **DOM-based XSS**: client-side JS writes untrusted data into a sink (`innerHTML`, `eval`).

**Defense:**
- **Context-aware output encoding** — encode for HTML body, attribute, JS, URL, or CSS context appropriately. The framework's auto-escaping (React, modern templating) handles most of this — don't bypass it (`dangerouslySetInnerHTML`, `v-html`).
- **Content Security Policy (CSP)** — restrict script sources; a strong defense-in-depth that limits impact even if encoding is missed.
- **Avoid dangerous sinks** (`innerHTML`, `eval`); use `textContent`.
- Sanitize rich HTML with a vetted library (DOMPurify) when you must allow markup.

---

## 3. Cross-Site Request Forgery (CSRF)

CSRF tricks an authenticated user's **browser** into sending a state-changing request the user didn't intend. It exploits the browser's habit of **automatically attaching cookies** to requests for a site, regardless of who initiated them.

**Defenses:**
- **`SameSite` cookies** (`Lax` default in modern browsers, `Strict` for sensitive) — stop cookies from being sent on cross-site requests. Primary modern defense.
- **Anti-CSRF tokens** — a per-session/per-request unpredictable token the server issues and validates (synchronizer token pattern). Required for the form/POST that mutates state.
- **Double-submit cookie** pattern as a stateless alternative.
- **Re-check `Origin`/`Referer`** headers for sensitive actions.
- Note: CSRF mainly affects **cookie-based** auth. Bearer tokens in `Authorization` headers aren't auto-sent cross-site, so they're not CSRF-vulnerable in the same way (but then watch XSS).

---

## 4. Other categories worth depth

- **Broken Access Control (A01):** enforce **server-side, default-deny, object-level** checks. Don't rely on hidden UI or unguessable IDs. Watch IDOR, missing function-level authorization, and path traversal (`../`).
- **SSRF (A10):** the server fetches a user-supplied URL and an attacker points it at `http://169.254.169.254/` (cloud metadata) or internal services. Defend with **allow-lists** of hosts/schemes, blocking link-local/private IP ranges, disabling unused URL schemes, and using IMDSv2 on AWS.
- **Insecure Deserialization (A08):** never deserialize untrusted data into rich objects (Java/Python `pickle`/PHP). Prefer data-only formats (JSON) with strict schemas; if you must, sign the payload.
- **XXE (within A05):** disable external entity resolution in XML parsers.
- **Security Misconfiguration (A05):** harden defaults, remove debug endpoints, set security headers (`HSTS`, `X-Content-Type-Options: nosniff`, CSP), lock down cloud storage permissions.
- **Vulnerable Components (A06):** maintain an **SBOM**, run SCA (Dependabot/Snyk), patch promptly.

---

## 5. Cross-cutting defenses (the senior framing)

- **Defense in depth** — no single control; layer parameterization + least privilege + monitoring.
- **Secure by default** — frameworks that auto-escape, ORMs that parameterize, `SameSite` defaults.
- **Least privilege** everywhere — DB accounts, service roles, token scopes.
- **Validate input, encode output** — and know they solve different problems (validation rejects bad data; encoding makes data safe *for a specific context*).
- **Shift left** — threat modeling (A04 exists because design flaws can't be patched away), SAST/DAST/SCA in CI, security reviews.

---

## 6. Common pitfalls & misconceptions

- **"Input validation stops SQLi."** It helps but isn't sufficient — **parameterized queries** are the real fix. Escaping by hand is fragile.
- **"We use an ORM, so we're safe from SQLi."** Only for parameterized paths; raw SQL fragments and unsafe `LIKE`/`ORDER BY` interpolation reintroduce it.
- **"Encoding and sanitization are the same."** Encoding renders data inert for a context; sanitization strips dangerous content from rich input. Different tools.
- **"CSRF tokens stop XSS"** (and vice versa) — they defend different attacks. XSS can defeat CSRF tokens by reading them.
- **"Unguessable IDs fix IDOR."** That's obscurity, not authorization. Always check ownership.
- **"HTTPS protects against XSS/SQLi."** TLS only protects data in transit; injection is an application-layer flaw.
- **Trusting client-side validation** — it's UX only; the server must re-validate and re-authorize.

---

## 7. What interviewers probe

- Given a vulnerable code snippet, identify the flaw and rewrite it safely (SQLi → prepared statement; XSS → encoding/CSP).
- Difference between stored, reflected, and DOM XSS, and the matching defenses.
- Why parameterization beats escaping/validation for SQLi.
- How CSRF works mechanically and why `SameSite` + tokens stop it; why bearer-token APIs differ.
- How SSRF reaches cloud metadata and how to lock it down.
- The distinction between authentication and authorization failures (A07 vs A01).

---

## 8. Quick-reference summary

- **A01 Broken Access Control is #1** — server-side, default-deny, object-level checks; beware IDOR.
- **Injection (A03)**: fix SQLi with **parameterized queries**; fix XSS with **context-aware output encoding + CSP**; never feed untrusted input to an interpreter.
- **XSS** = stored / reflected / DOM; avoid `innerHTML`/`eval`; sanitize rich HTML with DOMPurify.
- **CSRF**: `SameSite` cookies + anti-CSRF tokens; mainly a cookie-auth problem.
- **SSRF (A10)**: allow-list hosts, block link-local/private ranges, IMDSv2.
- **Crypto failures (A02)**: TLS in transit, strong hashing at rest, no plaintext secrets.
- **A06 components**: SBOM + SCA + patch. **A09**: log & monitor so you can detect breaches.
- Mindset: **defense in depth, secure by default, least privilege, validate input / encode output.**
