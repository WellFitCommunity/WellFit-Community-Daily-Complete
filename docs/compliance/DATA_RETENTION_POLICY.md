# Data Retention Policy

**Envision Virtual Edge Group LLC**
**Effective Date:** February 6, 2026
**Last Review:** February 6, 2026
**Next Review:** August 6, 2026

---

## Purpose

This policy defines retention periods for all data categories within the WellFit Community and Envision Atlus platforms. It ensures compliance with HIPAA (45 CFR 164.530(j)), state medical record laws, and CMS requirements.

---

## Retention Schedule

### Clinical Records (PHI)

| Data Category | Tables | Retention Period | Legal Basis |
|---------------|--------|-----------------|-------------|
| Patient demographics | `profiles` | 10 years after last encounter | HIPAA, state medical record laws |
| Daily check-ins / vitals | `check_ins`, `health_entries` | 7 years | HIPAA minimum |
| Risk assessments | `risk_assessments` | 7 years | HIPAA minimum |
| Dental assessments | `dental_assessments`, `dental_tooth_chart` | 7 years | HIPAA minimum |
| FHIR clinical resources | `fhir_conditions`, `fhir_observations`, `fhir_medication_requests`, `fhir_care_plans`, `fhir_procedures` | 7 years | HIPAA, FHIR R4 standard |
| Diagnostic reports | `fhir_diagnostic_reports` | 7 years | HIPAA minimum |
| Dental imaging | `dental_imaging` | 7 years | HIPAA, ADA guidelines |
| Immunization records | `fhir_immunizations` | Permanent | CDC/state immunization requirements |
| Care plans | `fhir_care_plans` | 7 years after plan closure | HIPAA minimum |
| SHIELD welfare check records | `welfare_check_*` | 7 years | HIPAA, law enforcement coordination |

### Patient Self-Reported Data

| Data Category | Tables | Retention Period | Notes |
|---------------|--------|-----------------|-------|
| Patient dental tracking | `patient_dental_health_tracking` | 2 years rolling | Non-clinical self-report |
| Meal logs | `meals` | 2 years rolling | Wellness data |
| Community moments | `community_moments`, `community_photos` | 2 years rolling | Social engagement |

### Administrative & Audit Records

| Data Category | Tables | Retention Period | Legal Basis |
|---------------|--------|-----------------|-------------|
| Audit logs | `staff_audit_log`, `admin_audit_log`, `claude_usage_logs` | 7 years | SOC 2, HIPAA |
| Authentication attempts | `staff_auth_attempts` | 3 years | Security monitoring |
| FHIR sync logs | `fhir_sync_logs` | 90 days | Operational |
| Privacy consent records | `privacy_consent` | Duration of relationship + 7 years | HIPAA |
| Phone verification | `phone_auth` | Duration of account | Operational |

### AI Service Records

| Data Category | Tables | Retention Period | Notes |
|---------------|--------|-----------------|-------|
| AI usage logs | `claude_usage_logs` | 7 years | Billing audit trail |
| AI skill registry | `ai_skills` | Permanent | Configuration |
| Billing code suggestions | Logged in audit tables | 7 years | Revenue cycle compliance |

### Billing & Claims

| Data Category | Retention Period | Legal Basis |
|---------------|-----------------|-------------|
| Claims (837P/837I) | 7 years | CMS, state requirements |
| Remittance advice (835) | 7 years | CMS |
| Prior authorization records | 7 years | CMS, payer contracts |
| CDT code history | 7 years | ADA, billing audit |

### System & Operational Data

| Data Category | Retention Period | Notes |
|---------------|-----------------|-------|
| Edge function logs | 30 days | Supabase default |
| Error logs | 90 days | Debugging |
| Performance metrics | 90 days | Monitoring |
| Offline sync queue | Deleted after successful sync | HIPAA offline compliance |

---

## Encryption at Rest

All retained data is protected by:

| Layer | Method | Scope |
|-------|--------|-------|
| Database encryption | AES-256 (Supabase managed) | All tables |
| Application-layer encryption | AES (PHI fields) | 7 encrypted fields: `patient_name_encrypted`, `patient_dob_encrypted`, `phone_encrypted`, `email_encrypted`, `access_token_encrypted`, `refresh_token_encrypted`, `client_secret_encrypted` |
| Backup encryption | AES-256 (Supabase managed) | All automated backups |

---

## Data Deletion Procedures

### Routine Deletion

Automated cleanup runs for:
- FHIR sync logs older than 90 days
- Offline sync queue after successful sync
- Expired session tokens

### Patient-Requested Deletion

Upon valid patient request:
1. Verify identity through existing authentication
2. Export patient data (FHIR Bundle) for patient records
3. Delete patient data from all tables where `user_id` or `patient_id` matches
4. Retain de-identified audit logs (HIPAA requires audit trail preservation)
5. Document deletion in `staff_audit_log`
6. Confirm deletion to patient within 30 days

### Account Termination

When a tenant terminates service:
1. Export complete data set for tenant
2. Retain data for minimum retention period
3. Purge after retention period expires
4. Document in compliance records

---

## Backup Retention

| Backup Type | Retention | Frequency |
|-------------|-----------|-----------|
| Supabase automated | 30 days | Daily |
| Point-in-time recovery | 7 days | Continuous (WAL) |
| Manual snapshots | Per retention schedule | Before major changes |

---

## Compliance Monitoring

- **Quarterly**: Review retention schedule against regulatory changes
- **Annually**: Audit data volumes and verify automated cleanup
- **On change**: Update policy when new data categories are introduced

---

## Responsibilities

| Role | Responsibility |
|------|---------------|
| Data Controller | Envision Virtual Edge Group LLC |
| Data Processor | Supabase Inc. (BAA in place) |
| AI Processor | Anthropic PBC (BAA verification pending) |
| Compliance Review | Quarterly by designated compliance officer |

---

*Policy Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
