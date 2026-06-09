# Secrets & Least Privilege — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Secrets management, key rotation, least privilege.

---

## 1. What counts as a "secret"

Any credential that grants access or proves identity: DB passwords, API keys, OAuth client secrets, TLS private keys, signing keys, SSH keys, encryption keys, service-account tokens, webhook signing secrets. The defining property: **possession = access**. So the whole discipline is about controlling *who/what can read a secret, for how long, and detecting when one leaks*.

**Core principles:**
- **Never hardcode secrets** in source, config files, container images, or client-side code.
- **Never commit secrets to version control** (git history is forever; assume any committed secret is burned).
- **Least privilege** — every identity gets the minimum access needed.
- **Short-lived over long-lived** — prefer ephemeral, auto-rotating credentials.
- **Auditable** — every secret access should be logged.

---

## 2. Where secrets should live (and shouldn't)

### Anti-patterns (where they end up by accident)
- Plaintext in source code / `.env` committed to git.
- Baked into Docker images (`docker history` reveals them).
- Passed as command-line args (visible in `ps`/process listings).
- Logged (stack traces, debug logs, request dumps).
- In client-side bundles or mobile apps (decompile and read).
- Long-lived static keys emailed/Slacked around.

### Proper homes
- **Dedicated secrets manager**: HashiCorp **Vault**, AWS **Secrets Manager**, GCP **Secret Manager**, Azure **Key Vault**. These store secrets encrypted, gate access via IAM/policies, log access, and support rotation.
- **KMS / HSM** for cryptographic keys — the key material never leaves the boundary; you call the service to encrypt/sign.
- **Injected at runtime** via environment variables or mounted files fetched from the manager at boot — *not* stored in the image.
- For Kubernetes: avoid plain `Secret` objects as the only layer (base64, not encrypted by default); use an external secrets operator + sealed secrets + encryption-at-rest for etcd.

---

## 3. Secret injection patterns

1. **Pull at startup:** app authenticates to the secrets manager (via an instance role / workload identity) and fetches secrets into memory. No secret in the image or repo.
2. **Sidecar/agent:** a co-located agent (e.g., Vault agent) fetches and renews secrets, writing them to a tmpfs file the app reads.
3. **Mutating webhook / CSI driver:** secrets injected as mounted volumes by the platform.
4. **Dynamic secrets:** the manager *generates* a short-lived credential on demand (e.g., Vault creates a DB user valid for 1 hour, then deletes it). This is the strongest pattern — there's no long-lived secret to steal.

The unifying idea: the application proves its **identity** (workload identity / IAM role) to get secrets, rather than holding a bootstrap secret. This is the "secret zero" problem — solved by platform-provided identity (IMDS, IRSA, GCP/Azure workload identity).

---

## 4. Key & credential rotation

**Rotation** = periodically replacing a secret with a new value. Limits the window a leaked secret is useful and forces hygiene.

- **Scheduled rotation** — every N days, automatically.
- **Event-driven rotation** — immediately on suspected compromise, employee departure, or vendor breach.
- **Graceful rotation** requires supporting **two valid secrets at once** during the cutover (old + new), so in-flight clients don't break. For signing keys, publish multiple keys with key IDs (`kid`) and accept both until the old one is retired.
- **Dynamic/ephemeral credentials** make rotation a non-event — they're short-lived by construction.

Rotation that requires a risky manual scramble is a sign you've coupled too tightly to a single static secret; design for rotation up front (indirection, key IDs, dual-active windows).

---

## 5. Least privilege & related principles

- **Principle of Least Privilege (PoLP):** grant the minimum permissions, on the minimum resources, for the minimum time. Default-deny.
- **Need to know:** access scoped to what a role actually requires.
- **Separation of duties:** no single identity can do an entire sensitive operation alone (e.g., one person requests, another approves).
- **Just-in-time (JIT) access:** elevate privileges temporarily on request, then auto-revoke. Replaces standing admin access.
- **Scoped credentials:** API keys/tokens limited by scope, resource, IP, and expiry — not god-mode keys.
- **Per-service identities:** each service has its own role; never share one super-credential across services (blast radius + un-auditable).
- **Privilege creep:** access accumulates over time; counter with **periodic access reviews** and automated expiry.

For cloud IAM specifically: prefer **roles assumed by workloads** over long-lived access keys; scope policies tightly; use permission boundaries and SCPs; turn on access analyzers to find over-broad grants.

---

## 6. Detection & response

- **Secret scanning** in pre-commit hooks and CI (gitleaks, trufflehog, GitHub secret scanning) to catch secrets before/after they land.
- **Audit logging** on the secrets manager and IAM (who read what, when).
- **Canary tokens** — fake credentials planted so any use is a guaranteed alert.
- **Leak response runbook:** rotate immediately, revoke, scan logs for misuse, scope the blast radius, and treat the secret as permanently compromised (rotating ≠ "un-leaking" — the old value is out forever).

---

## 7. Common pitfalls & misconceptions

- **"It's in a private repo, so it's fine."** Repos get cloned, forked, leaked, and made public; insiders see them. Private ≠ secret.
- **"We'll just `.gitignore` the `.env`."** Doesn't help if it was committed once — git history retains it.
- **Rotating a leaked key by editing it in three services by hand** — error-prone; design for rotation.
- **Base64 ≠ encryption** — Kubernetes `Secret` values are base64-encoded, readable by anyone with API access; enable encryption-at-rest and RBAC.
- **One shared admin key for everything** — huge blast radius, impossible to audit or rotate safely.
- **"Secret zero"** ignored — you still need *some* trusted identity to fetch secrets; solve it with platform workload identity, not another hardcoded secret.
- **Long-lived static cloud access keys** in CI — prefer OIDC federation / short-lived tokens.
- **Logging secrets** in error traces / request dumps — scrub them.

---

## 8. What interviewers probe

- Where do secrets live in your architecture, and how does the app get them without a hardcoded bootstrap secret? (secret zero / workload identity)
- How do you rotate a credential with zero downtime? (dual-active window, key IDs, dynamic secrets)
- What's your response when a key leaks into a public repo?
- Explain least privilege with a concrete IAM example; how do you prevent privilege creep?
- Static long-lived keys vs dynamic short-lived credentials — tradeoffs.
- How would you stop secrets from being committed in the first place?

---

## 9. Quick-reference summary

- A secret = "possession grants access." **Never hardcode, never commit, never log, never ship to clients.**
- Store in a **secrets manager** (Vault/AWS/GCP/Azure) or **KMS/HSM**; **inject at runtime**, not in images.
- Solve **secret zero** with **workload identity** (IMDS/IRSA/workload identity), not another hardcoded secret.
- Prefer **short-lived/dynamic credentials**; design **rotation** up front (dual-active window, key IDs).
- **Least privilege:** default-deny, scoped, per-service identities, JIT access, separation of duties; fight **privilege creep** with reviews + expiry.
- **Detect & respond:** secret scanning in CI, audit logs, canary tokens, a rotate-and-revoke runbook (a leaked secret is permanently burned).
