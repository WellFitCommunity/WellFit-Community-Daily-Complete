---
owner: Compliance
last_updated: 2026-07-25
review_status: needs-review
---

# PHI Column Encryption — Format, Key Rotation Procedure, and Plaintext-Twin Inventory

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Companion to `.claude/rules/supabase.md` §17 (two-key architecture). Written 2026-07-25
> alongside the v2 primitive migration (`20260725110000_phi_encryption_v2_random_iv_aead.sql`,
> external audit finding 3).

---

## 1. Current format (v2, live since 2026-07-25)

| Property | v2 (current) | Legacy (pre-2026-07-25) |
|---|---|---|
| Primitive | `pgp_sym_encrypt`, `cipher-algo=aes256` | raw `encrypt(data, digest(key,'sha256'), 'aes')` — AES-CBC, **zero IV** |
| Determinism | Non-deterministic (random session key per call) | **Deterministic** — equal plaintexts had equal ciphertexts |
| Integrity | MDC — tampering raises `[PHI_DECRYPTION_FAILED]` | None |
| KDF | S2K mode 3 (salted + iterated, count 65011712) | Bare SHA-256 of key |
| Stored as | `'v2:' + base64(pgp packet)` | bare base64 (no prefix; base64 alphabet contains no `:`, so the formats cannot collide) |

**Functions** (all `SECURITY DEFINER`, fail-closed, ACLs unchanged): `encrypt_phi_text(data, use_clinical_key)`, `decrypt_phi_text(...)`, and the service_role-only `encrypt_phi_text_with_key(data, key)` / `decrypt_phi_text_with_key(...)`. Encrypt functions **always write v2**. Decrypt functions accept **both** formats; the legacy branch exists only so pre-migration rows stay readable and can be removed once no legacy ciphertext remains anywhere (verify: every `*_encrypted` value `LIKE 'v2:%'`).

**Re-encryption status:** all 14 legacy rows that existed at migration time (10 `profiles.dob_encrypted`, 4 `senior_demographics.date_of_birth_encrypted`) were re-encrypted to v2 from their plaintext twins and verified (`decrypt == plaintext`, 14/14). Every other ciphertext column held 0 rows.

**Long-term direction:** a KMS-backed envelope scheme (per-row data keys wrapped by a KMS master key) is the correct end state before large-scale PHI volume. v2 is the pragmatic in-database step.

---

## 2. Key rotation procedure

Two independent keys exist (§17): **Vault `app_encryption_key`** (Envision Atlus clinical; currently also the effective WellFit DB-side key because the `app.settings.PHI_ENCRYPTION_KEY` GUC is unset) and **Supabase Secrets `PHI_ENCRYPTION_KEY`** (WellFit, used by the `phi-encrypt` edge function via the `*_with_key` RPCs). Rotate them separately.

Ciphertext does not embed a key identifier, so rotation is a **re-encrypt sweep inside one maintenance transaction** — there is no dual-read window to manage.

### 2a. Rotating the Vault key (`app_encryption_key`)

1. **Generate** a new high-entropy key (≥32 random bytes, e.g. `openssl rand -base64 48`). Store it in the password manager first.
2. **Stage it** in Vault under a temporary name:
   `SELECT vault.create_secret('<new-key>', 'app_encryption_key_next');`
3. **Maintenance transaction** (psql as postgres; `SET LOCAL session_replication_role = replica;` to bypass the profiles guard trigger, exactly as migration `20260725110000` did). For **each** ciphertext column in §3's inventory:
   - Columns **with a plaintext twin**: `UPDATE t SET c_encrypted = 'v2:' || encode(extensions.pgp_sym_encrypt(plain::text, <new-key>, 'cipher-algo=aes256, s2k-mode=3, s2k-count=65011712'), 'base64') WHERE plain IS NOT NULL AND c_encrypted IS NOT NULL;`
   - Ciphertext-only columns: same, but source the plaintext from `extensions.pgp_sym_decrypt(decode(substring(c_encrypted FROM 4), 'base64'), <old-key>)`.
   - Fetch both keys inside the transaction from `vault.decrypted_secrets` — never paste key material into the SQL file or shell history.
4. **Swap**: `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='app_encryption_key'), '<new-key>');` then delete `app_encryption_key_next`. Commit.
5. **Verify** (read-only): round-trip `decrypt_phi_text(encrypt_phi_text('probe', true), true)`; for every twin column `count(decrypt == plaintext) == count(ciphertext)`; spot-check each `*_decrypted` view.
6. **Record** the rotation (date, operator, row counts) in the audit trail and this file's history table below.

### 2b. Rotating the WellFit edge secret (`PHI_ENCRYPTION_KEY`)

1. Identify all data encrypted through `encrypt_phi_text_with_key` (CHW kiosk media path via `supabase/functions/phi-encrypt`). Re-encrypt those rows by decrypting with the old secret and encrypting with the new one — through the service_role RPCs (`SELECT encrypt_phi_text_with_key(decrypt_phi_text_with_key(c, '<old>'), '<new>')`), never in the browser.
2. `supabase secrets set PHI_ENCRYPTION_KEY=<new-key>` and redeploy `phi-encrypt`.
3. Verify a live encrypt/decrypt round-trip through the edge function.

### Rotation history

| Date | Key | Operator | Rows re-encrypted | Notes |
|---|---|---|---|---|
| — | — | — | — | No rotation performed yet. Primitive upgrade 2026-07-25 (14 rows) was not a key rotation. |

---

## 3. Ciphertext column inventory + plaintext-twin status

Live-verified 2026-07-25. **The plaintext twins mean encryption is currently decorative for those columns** (audit finding 3): an attacker with table read access reads the plaintext directly. Dropping the twins is an **irreversible schema change requiring Maria's explicit sign-off (+ Akima for clinical scope)** and application repair first — readers still select the plaintext columns.

| Table.column (ciphertext) | Plaintext twin | Twin populated? | Writer | Key flag |
|---|---|---|---|---|
| `profiles.dob_encrypted` | `dob` | **Yes (10)** | trigger `encrypt_dob_on_change` | community |
| `senior_demographics.date_of_birth_encrypted` | `date_of_birth` | **Yes (4)** | trigger | community |
| `patient_referrals.patient_dob_encrypted` | `patient_dob` | empty | trigger | community |
| `fhir_practitioners.birth_date_encrypted` | `birth_date` | empty | trigger | community |
| `hc_staff.date_of_birth_encrypted` | `date_of_birth` | empty | trigger | community |
| `billing_providers.ein_encrypted` | `ein` | empty | trigger `encrypt_tax_id_on_change` | community |
| `facilities.tax_id_encrypted` | `tax_id` | empty | trigger | community |
| `hc_organization.tax_id_encrypted` | `tax_id` | empty | trigger | community |
| `hc_provider_group.tax_id_encrypted` | `tax_id` | empty | trigger | community |
| `risk_assessments.assessment_notes_encrypted` (+`risk_factors`/`recommended_actions`) | none — trigger NULLs plaintext | n/a | trigger `encrypt_risk_assessments_phi` | clinical |
| `handoff_packets.patient_name_encrypted` / `patient_dob_encrypted` | none | n/a | `handoffService.encryptPHI` (client → RPC) | clinical |
| CHW kiosk media (`phi-encrypt` edge fn) | none | n/a | `chwService` → `*_with_key` | WellFit secret |

**Recommended sequence for the twin-drop decision (NOT yet executed):** (1) migrate readers of `profiles.dob` / `senior_demographics.date_of_birth` (and the other twins as they populate) to the `*_decrypted` views; (2) convert the dual-write triggers to the NULL-out pattern `encrypt_risk_assessments_phi` already uses; (3) only then drop the plaintext columns. Until step 3, "PHI encrypted at rest" must not be claimed for the twin columns.

---

## 4. Open items

| Item | Owner | Status |
|---|---|---|
| Plaintext-twin drop decision (§3) | Maria (+ Akima for clinical columns) | OPEN — irreversible, needs sign-off |
| Provision the WellFit GUC `app.settings.PHI_ENCRYPTION_KEY` so the DB-side two-key split is real (§17 known item) | Maria | OPEN (pre-existing) |
| Remove the legacy decrypt branch once zero non-`v2:` ciphertext exists platform-wide | Any session | OPEN — verify first |
| KMS-backed envelope encryption (long-term) | Future tracker | OPEN |
| Akima ratification of the v2 primitive change (clinical-key scope) | Akima | OPEN — add to next packet |
