# Secrets & Least Privilege — Practice Questions

[← Topic overview](../README.md)

> Topic: Secrets management, key rotation, least privilege.

---

### Q1. Why is committing a secret to a private git repo still dangerous?

**Answer:** "Private" controls *who can clone now*, not the secret's safety. Repos get forked, cloned to laptops, accidentally made public, exposed via misconfigured CI, or read by departing employees and contractors. And git **history is permanent** — even if you delete the secret in a later commit, it remains in the history (and on every clone). Once a secret touches a repo, treat it as compromised and rotate it. Private ≠ secret.

---

### Q2. Explain to a junior what "least privilege" means with a concrete example.

**Answer:** Least privilege means giving each identity only the permissions it actually needs, nothing more. Example: a reporting service that only reads from one table should get a DB user with `SELECT` on *that table only* — not `ALL PRIVILEGES` on the whole database, and definitely not the admin account. If that service is compromised, the attacker can only read that one table, not drop tables or read everything. The smaller the grant, the smaller the blast radius.

---

### Q3. What is the "secret zero" problem and how is it solved?

**Answer:** To fetch secrets from a secrets manager, an app needs *some* credential to authenticate — but if that bootstrap credential is itself a hardcoded secret, you've just moved the problem ("who guards the guard?"). That bootstrap credential is **secret zero**. The modern solution is **platform-provided workload identity**: the cloud/orchestrator vouches for the workload's identity (AWS IAM instance roles / IRSA, GCP/Azure workload identity, Kubernetes service-account tokens). The app proves *what it is* to the platform and exchanges that for short-lived credentials — no hardcoded bootstrap secret.

---

### Q4. How do you rotate a credential with zero downtime?

**Answer:** Support **two valid credentials simultaneously** during cutover. Steps: (1) create the new secret while the old one still works; (2) deploy/update consumers to start using the new one; (3) confirm nothing still uses the old one (via audit logs); (4) revoke the old one. For signing keys, publish multiple keys with **key IDs (`kid`)** and accept both until the old key is retired. Better still, use **dynamic/ephemeral credentials** so rotation is automatic and continuous.

---

### Q5. What are dynamic (ephemeral) secrets and why are they stronger than static keys?

**Answer:** A dynamic secret is generated **on demand with a short lifetime** — e.g., Vault creates a temporary DB user valid for one hour, then deletes it. Because the credential is short-lived and unique per request, there's effectively **no long-lived secret to steal**, rotation is automatic, and every credential is tied to a specific lease you can revoke. Static keys, by contrast, live indefinitely, are widely copied, and are painful to rotate. Dynamic secrets shrink both the theft window and the blast radius.

---

### Q6. Why aren't Kubernetes `Secret` objects sufficient on their own?

**Answer:** By default, `Secret` values are only **base64-encoded** (not encrypted), and they're stored in etcd which may not be encrypted at rest. Anyone with API/etcd access (or overly broad RBAC) can read them, and they don't rotate. To use them safely you need: **encryption-at-rest for etcd**, tight **RBAC** on who can read secrets, and ideally an **external secrets operator** that syncs from a real manager (Vault/cloud) plus dynamic/short-lived credentials. Base64 is encoding, not protection.

---

### Q7. A secret has leaked. Walk through the response.

**Answer:**
1. **Rotate immediately** — issue a new secret and deploy it.
2. **Revoke** the old secret so it stops working.
3. **Scope the blast radius** — what could this secret access?
4. **Hunt for misuse** — search audit/access logs for unexpected use of the leaked credential.
5. **Treat it as permanently burned** — rotation doesn't "un-leak"; the old value is out forever, so it must never be valid again.
6. **Post-incident** — fix the root cause (how it leaked: committed, logged, in an image) and add prevention (secret scanning, scrubbing).

---

### Q8. What is privilege creep and how do you prevent it?

**Answer:** Privilege creep is the gradual accumulation of permissions an identity no longer needs — from role changes, one-off grants that are never revoked, and copied policies. Over time identities become over-privileged, expanding blast radius and audit difficulty. Prevent it with: **periodic access reviews**, **time-bound / JIT access** that auto-expires, automated tooling (IAM access analyzers) flagging unused permissions, and granting access through roles tied to current job function rather than to individuals permanently.

---

### Q9 (MCQ). Which is the best place to store a production database password?

A. Hardcoded in the application source
B. In a `.env` file committed to the repo
C. In a managed secrets manager, injected at runtime
D. As a base64 string in a plain Kubernetes Secret with no encryption-at-rest

**Answer: C.** A secrets manager encrypts the value, gates access via IAM, logs reads, and supports rotation; the app fetches it at runtime via workload identity. A and B leak the secret into code/history; D is just base64 (not encryption) and is readable by anyone with cluster access.

---

### Q10 (MCQ). Which approach best minimizes the blast radius if one microservice is compromised?

A. All services share one admin credential for convenience
B. Each service has its own narrowly-scoped, per-service identity
C. Store the master key in every container image
D. Use one long-lived API key with full access, rotated yearly

**Answer: B.** Per-service, least-privilege identities mean a compromise is contained to that service's narrow permissions, and access is auditable. A, C, and D all create a single high-value, broadly-scoped credential whose compromise affects everything.

---

### Q11 (MCQ). What is the primary purpose of rotating secrets on a schedule?

A. To improve application performance
B. To limit the time window during which a leaked or compromised secret remains useful
C. To reduce storage costs in the secrets manager
D. To satisfy base64 encoding requirements

**Answer: B.** Rotation bounds how long any leaked secret stays valid (and forces good hygiene/automation). It has nothing to do with performance, storage, or encoding.

---

### Q12. How do you prevent secrets from being committed to git in the first place?

**Answer:** Layer defenses: **pre-commit hooks** running a secret scanner (gitleaks/trufflehog) so commits with secrets are blocked locally; **CI secret scanning** as a backstop (and GitHub's push-protection/secret scanning); a `.gitignore` for env files; developer education and a clear "secrets go in the manager" standard; and **canary tokens** so any leaked credential triggers an alert. The goal is to catch them before they land — and detect fast if one slips through.
