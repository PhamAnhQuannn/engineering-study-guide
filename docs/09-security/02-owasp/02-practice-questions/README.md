# OWASP Top 10 — Practice Questions

[← Topic overview](../README.md)

> Topic: SQLi, XSS, CSRF, common web vulnerabilities.

---

### Q1. What is the OWASP Top 10, and what changed at the top in 2021?

**Answer:** It's a consensus list of the most critical web-application security *risk categories*, maintained by OWASP. In the 2021 edition, **Broken Access Control rose to #1** (it's the most commonly found serious flaw), **Cryptographic Failures** replaced "Sensitive Data Exposure," **XSS was folded into Injection (A03)**, and new categories appeared: **Insecure Design (A04)**, **Software & Data Integrity Failures (A08)**, and **SSRF (A10)**. It's a risk list organized around root causes, not a line-by-line checklist.

---

### Q2. Explain SQL injection to a junior and the single best fix.

**Answer:** SQLi happens when untrusted input is concatenated into a SQL string, so the input can change the query's *structure* — e.g., `' OR '1'='1` turns a login check into "always true." The robust fix is **parameterized queries (prepared statements)**: the query text and the data travel separately, so the database treats input strictly as a value, never as SQL. Input validation and escaping help as defense-in-depth but are not sufficient on their own.

---

### Q3. Why isn't input validation enough to stop SQL injection?

**Answer:** Validation rejects obviously bad input, but it can't anticipate every dangerous payload, and legitimate data (like a name with an apostrophe, `O'Brien`) is indistinguishable from an attack at the validation layer. Hand-escaping is error-prone and database-dialect specific. Parameterization eliminates the problem categorically because the data never enters the query parser as code. So: parameterize first, validate as a secondary guard.

---

### Q4. Describe stored, reflected, and DOM-based XSS.

**Answer:**
- **Stored XSS:** the malicious script is persisted server-side (e.g., a comment) and served to every viewer — highest impact.
- **Reflected XSS:** the script is echoed straight back from the request into the response (e.g., a search term shown unescaped) — typically delivered via a crafted link.
- **DOM-based XSS:** the vulnerability is entirely client-side — JavaScript reads attacker-controlled data and writes it to a dangerous sink like `innerHTML` or `eval`, never touching the server in a way the server could sanitize.
All are fixed by context-aware output encoding, avoiding dangerous sinks, and a strong CSP.

---

### Q5. How does CSRF work, and why doesn't it affect a pure bearer-token API?

**Answer:** CSRF abuses the browser automatically attaching **cookies** to any request to a site. An attacker's page can trigger a state-changing request (e.g., a form POST) to your site, and the browser sends the victim's session cookie, so the server thinks the user did it. A pure bearer-token API puts the token in an `Authorization` header that the browser does **not** attach automatically cross-site, so the forged request lacks credentials. Defenses for cookie-based auth: `SameSite` cookies and anti-CSRF tokens.

---

### Q6. Explain the difference between output encoding and input sanitization.

**Answer:** **Output encoding** transforms data so it's inert in a specific output context — HTML body, attribute, JavaScript, URL, or CSS — at the moment it's rendered. **Input sanitization** strips or neutralizes dangerous content from rich input (e.g., cleaning user-supplied HTML with DOMPurify so only safe tags remain). Encoding is context-specific and the default XSS defense; sanitization is needed when you must *allow* some markup. They solve different problems and aren't interchangeable.

---

### Q7. What is SSRF and how can it reach cloud secrets?

**Answer:** Server-Side Request Forgery: the server makes an HTTP request to a URL the attacker controls. If the app fetches a user-supplied URL, the attacker points it at internal targets — most famously the cloud **instance metadata endpoint** `http://169.254.169.254/`, which on misconfigured AWS (IMDSv1) can return temporary IAM credentials. Defenses: allow-list permitted hosts/schemes, block link-local and private IP ranges, disable unused URL schemes, and enforce IMDSv2 (which requires a session token and blocks naive SSRF).

---

### Q8. What is IDOR, and why are unguessable IDs not a fix?

**Answer:** Insecure Direct Object Reference — accessing an object via a supplied ID without checking the requester is authorized for it (`GET /docs/42`). Unguessable IDs (UUIDs) make enumeration harder but are **security through obscurity**: IDs leak through logs, referers, shared links, and the browser history. The real fix is an **object-level authorization check** scoping every access to the authenticated principal.

---

### Q9 (MCQ). Which is the most reliable defense against SQL injection?

A. Escaping single quotes in input
B. Blocking the word `SELECT` in inputs
C. Parameterized queries / prepared statements
D. Running the database as a non-root user

**Answer: C.** Parameterized queries separate code from data so input can't alter query structure. A and B are fragile and bypassable; D is good defense-in-depth (limits blast radius) but doesn't prevent the injection itself.

---

### Q10 (MCQ). Which control most directly mitigates CSRF for a cookie-authenticated app?

A. Content Security Policy
B. `SameSite` cookie attribute + anti-CSRF token
C. HTTP Strict Transport Security (HSTS)
D. Input validation

**Answer: B.** `SameSite` prevents the cookie from being sent on cross-site requests, and the anti-CSRF token ensures the request originated from your own form. CSP targets XSS/content loading, HSTS forces TLS, and input validation addresses injection — none directly stop CSRF.

---

### Q11 (MCQ). A page sets element content with `el.innerHTML = userInput`. Which XSS type is this most associated with, and the simplest fix?

A. Reflected XSS; add a WAF
B. DOM-based XSS; use `textContent` (or sanitize with DOMPurify)
C. Stored XSS; encode the database
D. None; `innerHTML` is always safe

**Answer: B.** Writing untrusted data to `innerHTML` is a classic DOM XSS sink. Use `textContent` for plain text, or sanitize with DOMPurify if HTML must be allowed.

---

### Q12. Why was "Insecure Design" (A04) added as its own category?

**Answer:** Because some vulnerabilities are flaws in the *design*, not the code — they can't be fixed by patching an implementation bug. Example: a "forgot password" flow that reveals whether an email exists, or a business process missing rate limits. A04 elevates **threat modeling and secure-design patterns** as a distinct discipline: you can implement a flawed design perfectly and still be insecure. It pushes security "left" into the design phase.

---

### Q13. How do "Vulnerable & Outdated Components" (A06) get exploited, and how do you manage the risk?

**Answer:** Applications pull in many third-party libraries; when one has a published CVE, attackers can target every app using the vulnerable version (e.g., Log4Shell). Management: maintain an **SBOM** (software bill of materials), run **SCA** tooling (Dependabot/Snyk/Trivy) in CI to flag vulnerable versions, patch promptly, pin and verify dependencies, and remove unused ones to shrink the attack surface.
