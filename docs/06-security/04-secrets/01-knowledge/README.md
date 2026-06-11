# Secrets & Least Privilege — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Secrets management, key rotation, least privilege.

> **🛒 Where we are in building ShopFast** — Last topic we applied [Cryptography](../../03-crypto/01-knowledge/README.md) to protect ShopFast's payment data with AES-GCM (AES Galois/Counter Mode) field encryption, Argon2id password hashes, and TLS (Transport Layer Security) in transit. But all of that protection is worthless if the **encryption keys, the payment-processor API keys, and the DB (database) credentials are stored insecurely**. This topic closes the loop: where those secrets live, how the application gets them without hardcoding them, and how we rotate them — especially the PCI (Payment Card Industry) payment-processor keys that VISA/Mastercard compliance requires us to protect. **Next:** the loop closes — a secure system is a designed system. Return to [From Idea to System](../../../03-system-design/08-idea-to-system/01-knowledge/README.md) to see how security requirements feed back into architecture decisions from the very first design step.

---

## Teaching arc: protecting ShopFast's secrets

### What it is

A **secret** is any credential that grants access or proves identity: a database password, an API key for the payment processor, an OAuth (Open Authorization) client secret, a TLS (Transport Layer Security) private key, a signing key, an SSH key, or a webhook signing secret. The defining property is stark: **possession = access**. Anyone who reads the secret has the same power as the system it belongs to.

The discipline of secrets management is about three things:
1. **Preventing secrets from ending up in the wrong place** (source code, logs, environment dumps, container images).
2. **Controlling and auditing who/what can read them** — machines and humans alike.
3. **Limiting blast radius when a leak happens** — because some leaks are inevitable; short-lived secrets and fast rotation dramatically cap the damage window.

Analogy: think of a house key. The problem isn't making a strong key (that's crypto) — it's controlling who has a copy, for how long, and knowing immediately when a copy goes missing. A master key that opens every door in the building (a "god-mode" admin key) is the most dangerous kind, even if the key itself is strong.

---

### What it looks like

ShopFast's secret surface at launch, from most dangerous to least:

```
Secret                     Where it lives (WRONG)       Where it lives (RIGHT)
────────────────────────   ──────────────────────────   ─────────────────────────────
STRIPE_SECRET_KEY          .env committed to git        AWS Secrets Manager
  (PCI-scoped key)         docker-compose.yml ENV       Injected at runtime via
                                                        IAM role → app memory only

DB_PASSWORD                hardcoded in config.ts       AWS Secrets Manager / RDS
  (Postgres master creds)  .env in container image      IAM auth (no password at all)

JWT_SIGNING_KEY            process.env in code          AWS Secrets Manager
  (signs all tokens)                                    Rotated on schedule

ADMIN_WEBHOOK_SECRET       Slack message to oncall      HashiCorp Vault
  (signs Stripe webhooks)  plain-text in config repo    Dynamic short-lived per-call

KMS_KEY_ID                 NOT a secret (public ID)     Config only (not a secret)
  (identifies the KEK)
```

The attack path we are preventing:

```
1. Developer commits .env to git by accident
         │
         ▼
2. GitHub secret scanning misses it (or repo is private — "security by obscurity")
         │
         ▼
3. Attacker clones repo / internal threat actor reads git history
         │
         ▼
4. STRIPE_SECRET_KEY used to:
   - List all customer charges
   - Issue refunds to attacker-controlled accounts
   - Pull full cardholder metadata
         │
         ▼
5. PCI DSS breach notification required → significant fines + reputational damage
```

---

### The code that builds it

Fetching secrets from AWS Secrets Manager at startup — the secret never touches disk or the image:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient({ region: "us-east-1" });

// Called once at app startup — secrets loaded into process memory only
async function loadSecrets(): Promise<AppSecrets> {
  // The app's IAM (Identity and Access Management) role has a policy allowing
  // GetSecretValue only on these specific ARNs (Amazon Resource Names).
  // No hardcoded credentials needed — the SDK reads the IMDS (Instance Metadata Service)
  // role credentials automatically (the "secret zero" solution).

  const [stripeRes, jwtRes, dbRes] = await Promise.all([
    sm.send(new GetSecretValueCommand({ SecretId: "shopfast/prod/stripe-secret-key" })),
    sm.send(new GetSecretValueCommand({ SecretId: "shopfast/prod/jwt-signing-key" })),
    sm.send(new GetSecretValueCommand({ SecretId: "shopfast/prod/db-password" })),
  ]);

  return {
    stripeKey: stripeRes.SecretString!,   // never logged, never written to disk
    jwtSigningKey: jwtRes.SecretString!,
    dbPassword: dbRes.SecretString!,
  };
}

// Never do this — env vars can leak via process dumps, error traces, admin APIs
// const stripeKey = process.env.STRIPE_SECRET_KEY;  // ← BAD if sourced from .env in repo
```

---

### The code that calls it

Rotation with a dual-active window — in-flight requests with the old key succeed while the new key rolls out:

```typescript
// Key ring: support multiple active signing keys by kid (Key ID)
// so rotation doesn't invalidate in-flight tokens
const keyRing: Map<string, string> = new Map();

async function refreshKeyRing() {
  // Fetch the current and previous key versions from Secrets Manager
  const current = await sm.send(new GetSecretValueCommand({
    SecretId: "shopfast/prod/jwt-signing-key",
    VersionStage: "AWSCURRENT",
  }));
  const previous = await sm.send(new GetSecretValueCommand({
    SecretId: "shopfast/prod/jwt-signing-key",
    VersionStage: "AWSPREVIOUS",   // the key that was current before rotation
  })).catch(() => null);           // may not exist on first rotation

  keyRing.clear();
  const currentPayload = JSON.parse(current.SecretString!);
  keyRing.set(currentPayload.kid, currentPayload.key);

  if (previous) {
    const prevPayload = JSON.parse(previous.SecretString!);
    keyRing.set(prevPayload.kid, prevPayload.key);   // old key still accepted until TTL
  }
}

// When verifying a JWT: pick the key by the token's kid header
function verifyToken(token: string) {
  const decoded = jwt.decode(token, { complete: true }) as any;
  const signingKey = keyRing.get(decoded.header.kid);
  if (!signingKey) throw new Error("unknown_kid");   // not a key we ever issued
  return jwt.verify(token, signingKey, { algorithms: ["HS256"] });
}
```

---

### Types & differences

| Pattern | One-line | Reach for it when |
|---|---|---|
| **Secrets Manager (AWS/GCP/Azure/Vault)** | Encrypted store + IAM gate + audit log + rotation API | Any production secret; the default choice |
| **KMS (Key Management Service) / HSM (Hardware Security Module)** | Key material never leaves the boundary; you call the service to encrypt/sign | Cryptographic keys (KEK / Key Encryption Key), signing keys |
| **Dynamic / ephemeral secrets** | Manager generates a credential on demand (valid 1 hour, then deleted) | DB credentials, cloud tokens — strongest pattern; nothing static to steal |
| **Environment variables (injected at runtime)** | Secret injected by orchestrator (ECS task def, K8s secret mounted) into process env | Simpler workloads; acceptable if secrets manager backs them, not `.env` files |
| **Workload identity (IMDS, IRSA, GCP WI)** | Platform-provided identity; no bootstrap secret needed | "Secret zero" problem — how does the app authenticate to the secrets manager? |
| **OIDC (OpenID Connect) federation for CI/CD** | CI runner gets a short-lived token from the IdP, exchanges for cloud credentials | GitHub Actions, GitLab CI — eliminates long-lived static cloud keys in CI |

---

### Build it for real — ShopFast

ShopFast's payment processor keys (Stripe `sk_live_...`) are PCI (Payment Card Industry) DSS (Data Security Standard) scoped — a breach that exposes them could allow unauthorized charges to all ShopFast customers.

**Decision:** store all production secrets in **AWS Secrets Manager**, accessed via IAM (Identity and Access Management) role attached to the ECS (Elastic Container Service) task definition. The application calls Secrets Manager at startup and holds decrypted values in process memory. No secrets in the container image, no secrets in environment variables sourced from `.env` files, no secrets in git.

- **STRIPE_SECRET_KEY** — AWS Secrets Manager; rotated every 90 days (PCI requirement) using Secrets Manager's Lambda rotation function. Dual-active window: Stripe supports two simultaneous live keys; new key activated before old key is deactivated, so zero downtime.
- **JWT_SIGNING_KEY** — AWS Secrets Manager; rotated every 30 days. JWKS (JSON Web Key Set) endpoint publishes current + previous public key so services can verify tokens issued before and after rotation.
- **DB_PASSWORD** — AWS Secrets Manager with automatic RDS (Relational Database Service) rotation (Lambda rotates the Postgres password and updates the secret in one atomic step).
- **OWASP top-10 tie-in:** A05 Security Misconfiguration often means secrets in default locations; A08 Software & Data Integrity Failures can include compromised CI/CD pipelines that leak secrets.

**Rejected:** `.env` files checked into git (even private repos — git history is forever, insiders can read them, accidental public forks happen). Rejected: hardcoded fallbacks like `process.env.KEY ?? "dev-key"` — in production, a missing env var should crash loudly, not silently fall back to an insecure value.

> **If you get this wrong…** A Stripe secret key committed to a private GitHub repo is typically found by automated scanners (both malicious and GitHub's own secret scanning) within minutes of the commit. Even after deletion from the branch, it remains in git history until a force-rewrite. Real-world breaches via leaked API keys have cost companies millions in unauthorized charges and PCI fines. The "it's a private repo" defense has failed repeatedly.

---

### Scaling story

- **Now (launch):** AWS Secrets Manager, IAM role on ECS task, secrets loaded at startup. Secret scanning (git-secrets or Gitleaks) in CI (Continuous Integration) pre-commit hooks. Cost: Secrets Manager charges ~$0.40/secret/month — negligible.
- **Growth signal:** more services → each service needing its own set of secrets → manual secret management becomes error-prone. An engineer accidentally passes the wrong secret to the wrong service. Rotation requires coordinating across 10 services that share a key.
- **At scale (millions+):** adopt **per-service IAM roles** with **scoped policies** (least-privilege: each service can only read its own secrets). Move to **dynamic secrets** via Vault (HashiCorp Vault) for DB credentials — each service gets a unique, short-lived Postgres user that expires after 1 hour. Integrate a **canary token** (a fake API key wired to an alert) into git history so any use is an instant detection signal. Implement **JIT (Just-In-Time) access** for human admin access: no standing permissions; engineers request elevated access, it is granted for 1 hour, then auto-revoked. See [Auth](../../01-auth/01-knowledge/README.md) for how the JWT signing keys fit into this picture.

---

## 1. What counts as a "secret"

Any credential that grants access or proves identity: DB passwords, API keys, OAuth (Open Authorization) client secrets, TLS (Transport Layer Security) private keys, signing keys, SSH keys, encryption keys, service-account tokens, webhook signing secrets. The defining property: **possession = access**. So the whole discipline is about controlling *who/what can read a secret, for how long, and detecting when one leaks*.

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
- **Dedicated secrets manager**: HashiCorp **Vault**, AWS **Secrets Manager**, GCP (Google Cloud Platform) **Secret Manager**, Azure **Key Vault**. These store secrets encrypted, gate access via IAM (Identity and Access Management)/policies, log access, and support rotation.
- **KMS (Key Management Service) / HSM (Hardware Security Module)** for cryptographic keys — the key material never leaves the boundary; you call the service to encrypt/sign.
- **Injected at runtime** via environment variables or mounted files fetched from the manager at boot — *not* stored in the image.
- For Kubernetes: avoid plain `Secret` objects as the only layer (base64, not encrypted by default); use an external secrets operator + sealed secrets + encryption-at-rest for etcd.

---

## 3. Secret injection patterns

1. **Pull at startup:** app authenticates to the secrets manager (via an instance role / workload identity) and fetches secrets into memory. No secret in the image or repo.
2. **Sidecar/agent:** a co-located agent (e.g., Vault agent) fetches and renews secrets, writing them to a tmpfs file the app reads.
3. **Mutating webhook / CSI (Container Storage Interface) driver:** secrets injected as mounted volumes by the platform.
4. **Dynamic secrets:** the manager *generates* a short-lived credential on demand (e.g., Vault creates a DB user valid for 1 hour, then deletes it). This is the strongest pattern — there's no long-lived secret to steal.

The unifying idea: the application proves its **identity** (workload identity / IAM role) to get secrets, rather than holding a bootstrap secret. This is the "secret zero" problem — solved by platform-provided identity (IMDS / Instance Metadata Service, IRSA / IAM Roles for Service Accounts, GCP/Azure workload identity).

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
- **JIT (Just-In-Time) access:** elevate privileges temporarily on request, then auto-revoke. Replaces standing admin access.
- **Scoped credentials:** API keys/tokens limited by scope, resource, IP, and expiry — not god-mode keys.
- **Per-service identities:** each service has its own role; never share one super-credential across services (blast radius + un-auditable).
- **Privilege creep:** access accumulates over time; counter with **periodic access reviews** and automated expiry.

For cloud IAM (Identity and Access Management) specifically: prefer **roles assumed by workloads** over long-lived access keys; scope policies tightly; use permission boundaries and SCPs (Service Control Policies); turn on access analyzers to find over-broad grants.

---

## 6. Detection & response

- **Secret scanning** in pre-commit hooks and CI (Continuous Integration — gitleaks, trufflehog, GitHub secret scanning) to catch secrets before/after they land.
- **Audit logging** on the secrets manager and IAM (who read what, when).
- **Canary tokens** — fake credentials planted so any use is a guaranteed alert.
- **Leak response runbook:** rotate immediately, revoke, scan logs for misuse, scope the blast radius, and treat the secret as permanently compromised (rotating ≠ "un-leaking" — the old value is out forever).

---

## 7. Common pitfalls & misconceptions

- **"It's in a private repo, so it's fine."** Repos get cloned, forked, leaked, and made public; insiders see them. Private ≠ secret.
- **"We'll just `.gitignore` the `.env`."** Doesn't help if it was committed once — git history retains it.
- **Rotating a leaked key by editing it in three services by hand** — error-prone; design for rotation.
- **Base64 ≠ encryption** — Kubernetes `Secret` values are base64-encoded, readable by anyone with API access; enable encryption-at-rest and RBAC (Role-Based Access Control).
- **One shared admin key for everything** — huge blast radius, impossible to audit or rotate safely.
- **"Secret zero" ignored** — you still need *some* trusted identity to fetch secrets; solve it with platform workload identity, not another hardcoded secret.
- **Long-lived static cloud access keys in CI (Continuous Integration)** — prefer OIDC (OpenID Connect) federation / short-lived tokens.
- **Logging secrets** in error traces / request dumps — scrub them.

---

## 8. What interviewers probe

- Where do secrets live in your architecture, and how does the app get them without a hardcoded bootstrap secret? (secret zero / workload identity)
- How do you rotate a credential with zero downtime? (dual-active window, key IDs, dynamic secrets)
- What's your response when a key leaks into a public repo?
- Explain least privilege with a concrete IAM (Identity and Access Management) example; how do you prevent privilege creep?
- Static long-lived keys vs dynamic short-lived credentials — tradeoffs.
- How would you stop secrets from being committed in the first place?

---

## 9. Quick-reference summary

- A secret = "possession grants access." **Never hardcode, never commit, never log, never ship to clients.**
- Store in a **secrets manager** (Vault/AWS/GCP/Azure) or **KMS (Key Management Service) / HSM (Hardware Security Module)**; **inject at runtime**, not in images.
- Solve **secret zero** with **workload identity** (IMDS / Instance Metadata Service / IRSA / IAM Roles for Service Accounts / workload identity), not another hardcoded secret.
- Prefer **short-lived/dynamic credentials**; design **rotation** up front (dual-active window, key IDs).
- **Least privilege:** default-deny, scoped, per-service identities, JIT (Just-In-Time) access, separation of duties; fight **privilege creep** with reviews + expiry.
- **Detect & respond:** secret scanning in CI (Continuous Integration), audit logs, canary tokens, a rotate-and-revoke runbook (a leaked secret is permanently burned).
