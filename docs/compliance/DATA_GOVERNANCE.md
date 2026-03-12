# Data Governance Specification

**Envision Virtual Edge Group LLC**
**Last Updated:** March 12, 2026
**Regulatory Basis:** HIPAA (45 CFR 164), 42 CFR Part 2, 21st Century Cures Act, GDPR/CCPA, SOC 2 Type II
**Next Review:** September 12, 2026

---

## 1. Data Classification

| Classification | Examples | Storage Rules | Access Rules |
|---|---|---|---|
| **PHI** (Protected Health Information) | Names, DOB, SSN, diagnoses, medications, vitals, lab results | AES-256 encrypted at rest (`encrypt_phi_text()`), server-side only, audit logged | Role-based + tenant-isolated via RLS, never in browser storage |
| **Sensitive PHI** (42 CFR Part 2) | Substance use disorder, mental health, HIV/AIDS, genetic data | Column-level encryption, `sensitive_data_segments` segmentation, explicit consent required | `requires_explicit_consent = true`, redisclosure prohibited, authorization tracked in `cfr42_authorization_log` |
| **PII** (Personally Identifiable Information) | Email, phone, address, emergency contacts | Encrypted at rest (Supabase AES-256), minimal exposure | User self-access + admin within tenant |
| **Clinical Data** | FHIR resources, care plans, encounter records, SOAP notes | FHIR-compliant storage, versioned, tenant-scoped | Clinician roles required (`physician`, `nurse`, `case_manager`, etc.) |
| **Operational Data** | Audit logs, AI usage, metrics, consent records | Standard Supabase storage with RLS | Admin and `super_admin` access |
| **Public Data** | Tenant branding, feature flags, AI skill registry | Standard storage | Tenant-scoped, no PHI |

---

## 2. PHI Handling Rules

### Where PHI Lives

**Encrypted PHI columns** (via `encrypt_phi_text()` / `decrypt_phi_text()` from Supabase Vault):

| Table | PHI Columns |
|---|---|
| `profiles` | `first_name`, `last_name`, `date_of_birth`, `address`, `phone`, `ssn_last4` |
| `check_ins` | `notes`, free-text symptom fields |
| `clinical_notes` | `note_content`, `assessment`, `plan` |
| `self_reports` | `symptoms`, `notes` |

**Decrypted access views** (RLS-enforced, `security_invoker = on`):
- `check_ins_decrypted` — pass-through view for authorized clinical access
- `risk_assessments_decrypted` — pass-through view for risk data

**Encryption functions** (defined in migrations `20251112150000` and `20251120000000`):
- `encrypt_phi_text(data TEXT, use_clinical_key BOOLEAN)` — AES-256 via pgcrypto, key from Supabase Vault
- `decrypt_phi_text(data TEXT, use_clinical_key BOOLEAN)` — reverses encryption
- `encrypt_data(p_plaintext TEXT, p_key_name TEXT)` — general-purpose encryption
- Keys: `PHI_ENCRYPTION_KEY` (community) and `app.encryption_key` (clinical) — stored in Vault, never in source code

### PHI Prohibited Locations

| Location | Enforcement |
|---|---|
| Browser `localStorage` / `sessionStorage` | CLAUDE.md rule #8, code review |
| `console.log` / client-side logging | Lint rule: `auditLogger` required, `console.*` forbidden |
| Error messages (user-facing) | `failure()` returns generic messages, details in audit log |
| Test fixtures | Synthetic data only (`'Test Patient Alpha'`, `'2000-01-01'`) |
| URL query parameters | PHI transmitted via POST body or encrypted headers only |
| Git history | Migration `20251120000000` removed hardcoded encryption key |

### PHI Access Logging

**Hook:** `src/hooks/usePhiAccessLogging.ts`
**Table:** `audit_logs` (via `log_phi_access` RPC)
**Actions tracked:** `VIEW`, `EDIT`, `CREATE`, `DELETE`, `EXPORT`, `PRINT`

```typescript
// Every patient-facing component MUST include:
usePhiAccessLogging({
  resourceType: 'patient_dashboard',
  resourceId: patientId,
  action: 'VIEW'
});
```

**Components using PHI logging:** `ImmunizationDashboard`, `ConditionManager`, `AllergyManager`, `CarePlanDashboard`, `MedicineCabinet`, `ObservationDashboard`, `MedicationRequestManager`, `FhirAiPatientDashboard`.

---

## 3. Cross-Tenant Data Isolation

### RLS Enforcement

Every table with `tenant_id` has RLS enabled with policies using `get_current_tenant_id()`:

```sql
-- Standard tenant isolation pattern (applied to all multi-tenant tables)
CREATE POLICY "Tenant isolation" ON public.my_table
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());
```

**Migration history:** `20251108150000_complete_tenant_rls_policies.sql` applied tenant RLS to all tables. Gap fix in `_APPLIED_20260103000003_fix_tenant_rls_gaps.sql`.

### Isolation Rules

| Rule | Enforcement |
|---|---|
| No cross-tenant queries | RLS `USING (tenant_id = get_current_tenant_id())` on every query |
| Admin cannot see other tenants | Admin role is tenant-scoped, not platform-scoped |
| Super admin access | Only `super_admin` role (Maria/Akima UUIDs) bypasses tenant scope |
| Edge functions | Must use `createUserClient(authHeader)` for user-scoped queries; `createAdminClient()` only for system operations |
| Views | All views use `security_invoker = on` to enforce caller's RLS |

### Super Admin UUIDs (Platform-Wide Access)

| User | UUID | Role |
|---|---|---|
| Maria | `ba4f20ad-2707-467b-a87f-d46fe9255d2f` | `super_admin` |
| Akima | `06ce7189-1da3-4e22-a6b2-ede88aa1445a` | `super_admin` |

---

## 4. Data Retention Policies

### Retention Schedule

Defined in `data_retention_policies` table (migration `_SKIP_20251018160003_soc2_data_retention.sql`) and enforced via `retention_expires_at` columns (migration `20251106000005_security_data_retention.sql`).

| Data Type | Tables | Retention | Legal Basis |
|---|---|---|---|
| Clinical records (PHI) | `check_ins`, `fhir_conditions`, `fhir_observations`, `clinical_notes` | 10 years after last encounter | HIPAA 45 CFR 164.530(j), state laws |
| Immunization records | `fhir_immunizations` | Permanent | CDC/state requirements |
| Audit logs | `audit_logs`, `admin_audit_log`, `staff_audit_log` | 7 years | SOC 2, HIPAA |
| PHI access logs | `phi_access_logs`, `phi_access_logs_archive` | 6 years | HIPAA audit trail |
| AI decision logs | `ai_transparency_log`, `ai_confidence_scores` | 3 years | HTI-2 transparency |
| AI usage / billing | `claude_usage_logs`, `mcp_cost_metrics` | 7 years | Revenue audit |
| Privacy consent | `privacy_consent`, `patient_consents` | Relationship duration + 7 years | HIPAA |
| Geolocation data | `user_geolocation_history` | 90 days | PHI minimization |
| Anomaly detections | `anomaly_detections` | 2 years | SOC 2 |
| Self-reported wellness | `meals`, `community_moments` | 2 years rolling | Non-clinical |
| Session data | `login_attempts`, `account_lockouts` | 30 days | Operational |
| Consent verification | `consent_verification_log` | 7 years | HIPAA |
| FHIR sync logs | `fhir_sync_logs` | 90 days | Operational |

### Automatic Retention Triggers

Retention tracking is enforced via database triggers (migration `20251106000005`):

```sql
-- Example: Geolocation auto-expires after 90 days
CREATE TRIGGER trg_geolocation_retention
  BEFORE INSERT ON public.user_geolocation_history
  FOR EACH ROW
  EXECUTE FUNCTION update_geolocation_retention();
-- Sets retention_expires_at = timestamp + INTERVAL '90 days'
```

---

## 5. Data Export and Portability

### Patient Right to Access (21st Century Cures Act)

Patients access their records via the **My Health Hub** (`/my-health` route):

| Route | Data | Format |
|---|---|---|
| `/health-observations` | Vitals, lab results | FHIR Observation |
| `/immunizations` | Vaccine records | FHIR Immunization |
| `/care-plans` | Active care plans | FHIR CarePlan |
| `/allergies` | Allergy list | FHIR AllergyIntolerance |
| `/conditions` | Diagnoses | FHIR Condition |
| `/medicine-cabinet` | Medications | FHIR MedicationRequest |
| `/health-records-download` | Full export | FHIR Bundle, C-CDA, PDF, CSV |

### Export Audit Trail

Every export is logged via `usePhiAccessLogging({ action: 'EXPORT' })`. Edge functions for bulk export (`bulk-export`, `enhanced-fhir-export`, `ccda-export`) log to `audit_logs` with export metadata.

### Bulk Export Restrictions

- Bulk export requires `admin` or `super_admin` role
- Rate-limited per tenant
- Export status tracked via `export-status` edge function
- No cross-tenant bulk exports (RLS enforced)

---

## 6. Data Deletion (GDPR / State Privacy)

### Architecture

| Table | Purpose | Status |
|---|---|---|
| `gdpr_deletion_requests` | Deletion request queue with status workflow | Defined in archived migration; deploy when needed |
| `data_deletion_log` | Audit trail for all deletions | Defined in archived migration; deploy when needed |

**Migration:** `_SKIP_20251018160003_soc2_data_retention.sql` defines both tables with full RLS. Currently archived (prefix `_SKIP_`) pending activation for production use.

### HIPAA vs GDPR Conflict Resolution

| Data Type | GDPR Says | HIPAA Says | Resolution |
|---|---|---|---|
| Clinical records (< 7 years old) | Delete on request | Must retain 7 years minimum | **HIPAA wins** — retain, inform patient |
| Clinical records (> 7 years old) | Delete on request | No requirement to retain | **GDPR wins** — delete or anonymize |
| Non-clinical data (meals, moments) | Delete on request | No HIPAA coverage | **GDPR wins** — delete immediately |
| Audit logs | Delete on request | Must retain 6 years | **HIPAA wins** — retain, explain legal basis |
| Consent records | Delete on request | Must retain with PHI | **HIPAA wins** — retain alongside clinical data |

### Deletion Workflow

```
Patient request → gdpr_deletion_requests (status: 'pending')
  → Admin review (30-day window)
    → Non-clinical data: hard delete, log to data_deletion_log
    → Clinical data under retention: deny with legal basis
    → Clinical data past retention: anonymize or delete, log
  → gdpr_deletion_requests (status: 'completed' | 'denied')
```

### Soft Delete vs Hard Delete

| Approach | When Used |
|---|---|
| **Soft delete** (`is_deleted = true`, `deleted_at`) | Clinical records under retention, data with audit dependencies |
| **Hard delete** | Geolocation past 90 days, non-clinical wellness data on GDPR request, expired session data |
| **Anonymize** | Research data, aggregated metrics where structure must persist |

---

## 7. Anonymization and De-identification

### Safe Harbor Method (18 HIPAA Identifiers to Remove)

| # | Identifier | Tables Affected |
|---|---|---|
| 1 | Names | `profiles.first_name`, `profiles.last_name` |
| 2 | Geographic (below state) | `profiles.address`, `profiles.zip_code` |
| 3 | Dates (except year) | `profiles.date_of_birth`, `check_ins.created_at` |
| 4 | Phone numbers | `profiles.phone` |
| 5 | Email addresses | `profiles.email` (via `auth.users`) |
| 6 | SSN | `profiles.ssn_last4` |
| 7-18 | MRN, device IDs, URLs, IPs, biometrics, photos | Various clinical tables |

### Synthetic Test Data (Enforced via CLAUDE.md)

| Field | Required Pattern | Forbidden |
|---|---|---|
| Names | `'Test Patient Alpha'` | `'John Smith'` |
| DOB | `'2000-01-01'` | Realistic dates |
| Phone | `'555-0100'` | Real area codes |
| SSN | `'000-00-0000'` | Any realistic SSN |
| IDs | `'patient-abc'`, `'user-123'` | Production-like UUIDs |

---

## 8. Third-Party Data Sharing

### FHIR API Access Controls

| Mechanism | Scope |
|---|---|
| SMART on FHIR authorization | Per-app scopes (`patient/*.read`, `user/*.write`) via `smart-authorize` / `smart-token` edge functions |
| App registration | `SmartAppManagementPanel` — admin registers apps with specific scopes |
| Token lifecycle | `fhir_token_lifecycle` table tracks token issuance, refresh, and revocation |

### 42 CFR Part 2 Disclosure Tracking

All disclosures of sensitive data are logged in `sensitive_disclosure_log`:
- Recipient identity and organization
- Disclosure basis (patient authorization, emergency, court order)
- Data types disclosed
- Redisclosure notice inclusion
- Authorization reference (`cfr42_authorization_log`)

### BAA Requirements

| Third Party | Data Shared | BAA Required |
|---|---|---|
| Supabase | All data (hosting) | Yes |
| Anthropic (Claude) | De-identified clinical context for AI | Yes |
| Clearinghouse (Waystar/Change Healthcare) | Claims with PHI | Yes |
| EHR systems (via FHIR/HL7) | Clinical records | Yes (covered by BAA or QHIN agreement) |

### MCP Server Data Boundaries

All MCP servers run with service role keys (Tier 3 — infrastructure). Data boundaries:
- `mcp-fhir-server`: FHIR resources only, tenant-scoped
- `mcp-clearinghouse-server`: Claims data, payer-scoped
- `mcp-prior-auth-server`: Authorization data, patient-scoped
- No MCP server stores PHI locally — all queries route to Supabase

---

## 9. Audit and Compliance Verification

### Monthly Audit Log Review

```sql
-- Count PHI access events by action type (last 30 days)
SELECT action, COUNT(*) as event_count
FROM audit_logs
WHERE event_type = 'PHI_ACCESS'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY action
ORDER BY event_count DESC;
```

### Quarterly PHI Access Review

```sql
-- Identify users with highest PHI access volume
SELECT user_id, COUNT(*) as access_count,
       array_agg(DISTINCT resource_type) as resource_types
FROM audit_logs
WHERE event_type = 'PHI_ACCESS'
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY user_id
ORDER BY access_count DESC
LIMIT 20;
```

### Annual Data Retention Cleanup

```sql
-- Find data past retention expiration
SELECT table_name, retention_period, last_execution, records_processed_last_run
FROM data_retention_policies
WHERE enabled = true
  AND (next_execution IS NULL OR next_execution < NOW())
ORDER BY next_execution ASC;

-- Check geolocation data pending cleanup
SELECT COUNT(*) as expired_records
FROM user_geolocation_history
WHERE retention_expires_at < NOW();
```

### Consent Expiration Monitoring

```sql
-- Consents expiring in the next 30 days
SELECT user_id, consent_type, expiration_date
FROM privacy_consent
WHERE consented = true
  AND withdrawn_at IS NULL
  AND expiration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY expiration_date ASC;
```

### Compliance Verification Checklist

| Check | Frequency | Query / Action |
|---|---|---|
| All tables have RLS enabled | Monthly | `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;` |
| No PHI in client-side code | Per commit | `npm run lint` + PHI scan in `/pre-commit` skill |
| Audit log completeness | Monthly | Verify `audit_logs` count > 0 for each PHI-bearing table |
| Encryption key rotation | Quarterly | Verify `vault.decrypted_secrets` key age < 90 days |
| Consent enforcement active | Monthly | Verify `has_valid_privacy_consent()` function exists and is called |
| 42 CFR Part 2 disclosures logged | Quarterly | `SELECT COUNT(*) FROM sensitive_disclosure_log WHERE disclosed_at > NOW() - INTERVAL '90 days';` |
| GDPR deletion requests processed | Monthly | `SELECT status, COUNT(*) FROM gdpr_deletion_requests GROUP BY status;` |
| Test data is synthetic | Per commit | CLAUDE.md enforcement + code review |

---

## References

| Document | Path |
|---|---|
| PHI Data Flow Diagram | `docs/compliance/PHI_DATA_FLOW.md` |
| Data Retention Policy | `docs/compliance/DATA_RETENTION_POLICY.md` |
| Access Control Matrix | `docs/compliance/ACCESS_CONTROL_MATRIX.md` |
| HIPAA Risk Assessment | `docs/compliance/HIPAA_RISK_ASSESSMENT.md` |
| Governance Boundaries | `.claude/rules/governance-boundaries.md` |
| Encryption Functions | `supabase/migrations/20251120000000_fix_hardcoded_phi_encryption_key.sql` |
| Consent Enforcement | `supabase/migrations/20251203000000_consent_enforcement_rls.sql` |
| 42 CFR Part 2 | `supabase/migrations/20260123000003_42_cfr_part2_consent.sql` |
| Retention Triggers | `supabase/migrations/20251106000005_security_data_retention.sql` |
| PHI Access Hook | `src/hooks/usePhiAccessLogging.ts` |
