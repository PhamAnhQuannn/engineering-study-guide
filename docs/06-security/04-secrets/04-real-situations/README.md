# Secrets & Least Privilege — Real-World Situations

[← Topic overview](../README.md)

> Topic: Secrets management, key rotation, least privilege.

Each scenario: **model approach → mitigate → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. AWS access key pushed to a public GitHub repo

**Situation:** CI alerts that an IAM access key was committed to a public repo. Within minutes, crypto-mining instances may spin up (bots scrape GitHub for keys constantly).

- **Mitigate:** **Deactivate/delete the leaked key immediately** in IAM. Don't wait to investigate — the key is already burned. Check for and stop any unauthorized resources (e.g., new EC2 instances).
- **Diagnose with data:** Review **CloudTrail** for actions taken with the key — what was created, accessed, or exfiltrated, and from which IPs. Determine the key's permissions to bound blast radius.
- **Communicate:** Open an incident; notify security/finance (cloud-cost abuse is common); if data was accessed, engage the breach process.
- **Root-cause fix:** Remove the key from git history (and accept it's permanently compromised); replace static keys with **IAM roles / short-lived credentials**.
- **Prevention:** Secret scanning + push-protection in CI and pre-commit; **stop issuing long-lived access keys** — use roles/OIDC federation; least-privilege so even a leak is low-impact; billing/anomaly alerts.

---

### S2. The on-call engineer must rotate a DB password but every service hardcodes it

**Situation:** A suspected leak requires rotating the production DB password, but six services each hold the literal password in config, so a naive change causes a cascading outage.

- **Mitigate:** Use the DB's ability to have **two valid credentials**: create a new user/password while the old still works, so nothing breaks mid-rotation.
- **Diagnose with data:** Enumerate every consumer of the credential (config audit, connection logs) so none is missed during cutover.
- **Communicate:** Schedule the cutover, warn service owners, and confirm rollback steps.
- **Root-cause fix:** Move the credential into a **secrets manager referenced by name**, so future rotation updates one place; ideally adopt **dynamic DB credentials** so rotation becomes automatic.
- **Prevention:** Indirection (reference by alias, not literal value) and rotation runbooks designed for **dual-active** windows; periodic rotation drills so it's mechanical, not heroic.

---

### S3. A departing employee had admin access to multiple systems

**Situation:** A senior engineer leaves; they held standing admin in cloud, the DB, and the secrets manager, plus knowledge of shared static credentials.

- **Mitigate:** Disable their identity in the IdP and revoke active sessions/tokens; **rotate any shared secrets they knew** (shared admin passwords, static keys).
- **Diagnose with data:** Audit recent privileged actions by that identity; list every credential they could have known or copied.
- **Communicate:** Confirm completion with security and the team; document rotated secrets.
- **Root-cause fix:** Eliminate **shared/standing admin** — move to per-person SSO identities and **JIT elevation** so no one holds permanent admin; replace shared static secrets with per-service dynamic ones.
- **Prevention:** SSO + SCIM deprovisioning tied to HR offboarding; no shared credentials; least-privilege with periodic access reviews; JIT for admin tasks.

---

### S4. Secrets discovered in application logs

**Situation:** A teammate notices that a debug log line dumps the full request, including an `Authorization` header and an API key, and these logs ship to a third-party log aggregator.

- **Mitigate:** Stop the logging immediately (config/flag); **rotate the exposed credentials** since they reached the log store and a third party.
- **Diagnose with data:** Search the log retention window for how many secrets were exposed and who/what had access to those logs.
- **Communicate:** Note exposure window and rotated secrets to security; if a vendor's log system held them, consider that data exposure.
- **Root-cause fix:** Add **log scrubbing/redaction** for sensitive fields (auth headers, keys, PII) at the logging layer; never log full requests in prod.
- **Prevention:** Centralized redaction middleware; lint rules / reviews flagging request dumps; least-privilege on log access; canary tokens to detect misuse.

---

### S5. Over-privileged service role enables lateral movement

**Situation:** A compromised image-processing service had `s3:*` on `*` and read access to the entire secrets manager — far more than it needed — so the attacker pivoted to other buckets and credentials.

- **Mitigate:** Revoke/scope down the role immediately; rotate any secrets the role could read; isolate the compromised workload.
- **Diagnose with data:** Use CloudTrail/audit logs to trace what the role accessed during the incident; map the actual permissions vs what the service truly needs.
- **Communicate:** Incident response; report blast radius (which buckets/secrets were reachable).
- **Root-cause fix:** Rewrite the policy to **least privilege** — only the specific bucket/prefix and the specific secrets this service uses; per-service identity.
- **Prevention:** IAM access analyzer to flag over-broad grants; permission boundaries; policy reviews in PRs; default-deny templates; periodic right-sizing of roles.

---

### S6. Vendor breach exposes an integration's API key

**Situation:** A SaaS vendor you integrate with announces a breach that may have exposed customer API keys, including yours.

- **Mitigate:** **Rotate the vendor API key** proactively (don't wait for confirmation); if the integration supports IP allow-listing or scoping, tighten it.
- **Diagnose with data:** Review the integration's audit logs for unusual activity since the breach window; assess what the key could access on your side.
- **Communicate:** Track the vendor's advisory; inform internal stakeholders of the rotation and any impact.
- **Root-cause fix:** Replace the key; scope it to the minimum needed; if the vendor supports short-lived tokens/OAuth, migrate off static keys.
- **Prevention:** Treat third-party keys like your own (managed, scoped, rotated); subscribe to vendor security advisories; minimize the privileges granted to integrations.

---

### S7. Encryption key rotation breaks decryption of old data

**Situation:** A scheduled rotation replaced the data-encryption key, and now records encrypted under the *old* key can't be decrypted — reads are failing.

- **Mitigate:** Restore access by **re-enabling the old key for decryption** (it should remain available for read until all data is migrated); roll forward carefully.
- **Diagnose with data:** Confirm the design assumed a single active key rather than keeping prior key versions available; identify how much data is under the old key.
- **Communicate:** Note the outage cause and recovery to stakeholders.
- **Root-cause fix:** Use **envelope encryption with key IDs** — each record records which KEK version wrapped its DEK, and the KMS retains old key versions so old data stays decryptable while new writes use the new key. Re-encrypt lazily or via a background job.
- **Prevention:** Never hard-delete a key that still protects data; rotate the KEK (not every DEK) so existing ciphertext stays valid; test rotation against real encrypted data before production.
