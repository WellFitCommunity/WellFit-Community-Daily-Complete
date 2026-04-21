# Data Classification & Retention Policy

**Document ID:** DCR-005
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual
**Classification:** Internal — Confidential

---

## 1. Purpose

This policy establishes how the Company classifies data by sensitivity, how long each class is retained, and how data is securely deleted — to meet HIPAA, 21st Century Cures Act, GDPR (where applicable), and SOC 2 confidentiality and privacy requirements.

---

## 2. Scope

Applies to all data:
- Created, received, stored, transmitted, or processed by Company systems
- Whether in production, development, or archival storage
- Regardless of format (database, files, logs, exports, backups)

---

## 3. Data Classification

### 3.1 Classification Levels

| Level | Label | Description | Examples |
|-------|-------|-------------|----------|
| 1 | **Public** | Approved for unrestricted distribution | Marketing material, open-source code, published API docs |
| 2 | **Internal** | Internal use only; disclosure would cause minor harm | Internal documentation, non-sensitive metrics |
| 3 | **Confidential** | Disclosure would cause significant harm | Source code, business strategy, tenant configuration |
| 4 | **Restricted — PHI/PII** | Disclosure would cause significant harm + regulatory penalty | Patient names, SSN, DOB, clinical notes, check-in data, insurance info |

### 3.2 Handling Requirements by Level

| Handling | Level 1 | Level 2 | Level 3 | Level 4 |
|----------|---------|---------|---------|---------|
| Encryption at rest | Optional | Optional | Required | Required |
| Encryption in transit | Required | Required | Required | Required |
| Audit logging | No | Recommended | Required | Required |
| RLS enforcement | N/A | Recommended | Required | Required |
| Browser exposure | Allowed | Allowed | Internal systems only | **Forbidden** (patient IDs only) |
| Logged in plain text | Allowed | Allowed | Allowed | **Never** |
| Cross-tenant access | Allowed | Restricted | Forbidden | Forbidden (without explicit consent) |

### 3.3 Specific Data Types

| Data Type | Classification | Location | Notes |
|-----------|----------------|----------|-------|
| Patient names, DOB, SSN, MRN | Level 4 | `profiles`, `fhir_patients` | Encrypted fields; never in browser |
| Check-in vitals | Level 4 | `check_ins`, `mobile_vitals` | Tenant-isolated, encrypted |
| Self-reports (mood, symptoms) | Level 4 | `self_reports` | Tenant-isolated |
| Clinical notes | Level 4 | `clinical_notes` | Tenant-isolated, audit-logged on every read |
| Lab results | Level 4 | `lab_results`, `fhir_diagnostic_reports` | Tenant-isolated |
| Audit logs | Level 3 | `audit_logs`, `phi_access_logs` | Immutable; extended retention |
| Tenant branding config | Level 3 | `tenant_module_config` | Not PHI but competitive |
| Source code | Level 3 | GitHub | Proprietary |
| Test data (synthetic) | Level 2 | Test fixtures | No real PHI allowed in tests |
| Analytics dashboards (aggregated) | Level 2 | Views, reports | De-identified |
| Marketing copy | Level 1 | `docs/ANTHROPIC_OUTREACH_*.md`, GTM playbook | Public once released |

---

## 4. Retention Schedule

### 4.1 Minimum Retention (HIPAA/regulatory driven)

| Data Type | Minimum Retention | Maximum Retention | Basis |
|-----------|-------------------|-------------------|-------|
| PHI medical records | 6 years from last contact | 10 years | HIPAA 45 CFR § 164.530(j) |
| PHI access audit logs | 6 years | 10 years | HIPAA 45 CFR § 164.312(b) |
| Financial records (billing, claims) | 7 years | 10 years | IRS / Medicare |
| Business Associate Agreements | 6 years after contract ends | Indefinite | HIPAA |
| Authentication logs | 1 year | 2 years | SOC 2 CC7.2 |
| Security incident records | 6 years | Indefinite | SOC 2 CC7.3 / HIPAA |
| Backups | 7 days (Supabase default) | 30 days | Recoverability vs storage cost |
| Test/development data (synthetic only) | N/A | Until obsolete | Contains no real PHI |

### 4.2 Retention Implementation

4.2.1 Retention policies are codified in the `data_retention_policies` table (schema: `supabase/migrations/20251106000005_security_data_retention.sql`).

4.2.2 Each table's retention is configured with:
- `table_name`
- `retention_period`
- `policy_type`: `archive`, `delete`, or `anonymize`
- `date_column` (usually `created_at`)
- `enabled` flag

4.2.3 Automated retention jobs run daily. Records exceeding retention:
- **archive** policy: moved to archive table (schema: `<table>_archive`)
- **delete** policy: hard deleted (with final audit log entry)
- **anonymize** policy: PII fields replaced with hashed tokens; record preserved for analytics

### 4.3 Hold Orders (Legal Hold)

4.3.1 When litigation is anticipated or in progress, retention policies are suspended for affected records. The Chief Compliance Officer issues and rescinds hold orders.

4.3.2 Hold orders documented in `docs/compliance/legal-holds/<YYYY-MM-DD-case-name>.md`.

---

## 5. Secure Deletion

### 5.1 Patient Right to Deletion (GDPR / state privacy laws where applicable)

5.1.1 Patients in applicable jurisdictions may request deletion of their data. Requests are logged in `gdpr_deletion_requests`.

5.1.2 Deletion workflow:
1. Verify identity of requester
2. Check for conflicts (ongoing treatment, HIPAA minimum retention, legal hold)
3. If permitted, execute deletion:
   - Anonymize records that must be retained for audit/billing
   - Hard delete records not subject to retention
   - Log deletion in `data_deletion_log`
4. Confirm to requester within 30 days

### 5.2 Hard Deletion Technique

5.2.1 Hard deletes use `DELETE` statements with RLS bypass via service role. Post-delete, the row is not recoverable except via point-in-time backup restore (backups expire per retention schedule).

5.2.2 For highly sensitive deletions (PHI), the deletion is followed by:
- Backup trimming (once backup window passes)
- Audit log entry confirming deletion
- Notification to the Chief Compliance Officer

### 5.3 Media Disposal

5.3.1 The Company does not own physical media (fully cloud-hosted). If developer machines are retired:
- Drive encryption is verified (FileVault / BitLocker)
- Drives are wiped via OS-level secure erase or destroyed
- No production data is ever cached on developer machines beyond ephemeral debugging

---

## 6. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| AI Systems Director | Defines retention schedules; approves classification changes |
| Chief Compliance Officer | Approves legal holds; signs off on PHI-handling changes |
| All Personnel | Correctly classify data they create; use synthetic data in tests |

---

## 7. Evidence and Controls

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| Retention policy table | `data_retention_policies` | C1.1, PI1.5 |
| Retention execution | Scheduled cron on retention jobs | C1.1 |
| PHI encryption | `encrypt_data()` / `decrypt_data()` pgcrypto functions | C1.1 |
| Data deletion log | `data_deletion_log` | P4.2 |
| GDPR request queue | `gdpr_deletion_requests` | P5.1, P5.2 |
| Synthetic test data rule | CLAUDE.md Rule #15 | C1.2 |

---

## 8. Related Documents

- Information Security Policy (ISP-001)
- Access Control Policy (ACP-002)
- `/.claude/rules/supabase.md` §11 (Database Cleanup Policy)

---

## 9. Approval and Signatures

**AI Systems Director**
Name: Maria LeBlanc
Signature: _______________________________
Date: _____________________________________

**Chief Compliance and Accountability Officer**
Name: Akima Nelson
Signature: _______________________________
Date: _____________________________________

---

## Revision History

| Version | Date | Author | Change Summary |
|---------|------|--------|----------------|
| 1.0 | `<YYYY-MM-DD>` | Maria LeBlanc | Initial policy |
