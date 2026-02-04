# Data Retention Policy

**HIPAA Reference:** 45 CFR 164.530(j) - Retention and Destruction
**Last Updated:** 2026-01-03
**Document Status:** Policy Framework Defined

---

## Executive Summary

This document defines data retention requirements for WellFit Community and Envision Atlus platforms in compliance with HIPAA regulations and federal grant requirements.

| Data Category | Minimum Retention | Maximum Retention | Archive Required |
|---------------|-------------------|-------------------|------------------|
| Medical Records | 6 years | 10 years | Yes |
| Audit Logs | 6 years | 7 years | Yes |
| Session Data | 90 days | 1 year | No |
| Temporary Data | 7 days | 30 days | No |

---

## Regulatory Requirements

### HIPAA Retention Requirements

Per 45 CFR 164.530(j), covered entities must retain:

| Document Type | Retention Period | Reference |
|---------------|------------------|-----------|
| Policies and procedures | 6 years from creation or last effective date | 164.530(j)(1) |
| Documentation of actions/activities | 6 years from date created | 164.530(j)(2) |
| Designated record sets | 6 years | 164.524 |
| Accounting of disclosures | 6 years | 164.528 |

### State Requirements

Many states require longer retention:
- **California**: 7 years (minors: until age 25)
- **Texas**: 7 years
- **New York**: 6 years (hospitals: 6 years after discharge)
- **Florida**: 5 years (minors: until age 22)

**WellFit Standard:** 7 years minimum for all PHI records.

### Federal Grant Requirements

For federally-funded programs:
- Grant records: 3 years after final expenditure report
- Supporting documentation: Same as grant records
- Audit documentation: 3 years after audit completion

---

## Data Categories and Retention Periods

### 1. Protected Health Information (PHI)

| Table Category | Tables | Retention | Justification |
|----------------|--------|-----------|---------------|
| Check-ins | `check_ins`, `enhanced_check_in_responses` | 7 years | Clinical data |
| Vitals | `vital_signs`, `pulse_measurements` | 7 years | Clinical data |
| Assessments | `risk_assessments`, `dental_assessments` | 7 years | Clinical data |
| Care Plans | `fhir_care_plans`, `discharge_plans` | 7 years | Clinical data |
| Medications | `fhir_medication_requests`, `medication_*` | 7 years | Clinical data |
| Encounters | `encounters`, `encounter_*` | 7 years | Clinical data |
| Referrals | `patient_referrals`, `external_referrals` | 7 years | Clinical data |

### 2. Audit and Security Logs

| Table | Retention | Justification |
|-------|-----------|---------------|
| `audit_logs` | 7 years | HIPAA audit trail |
| `security_events` | 7 years | Security monitoring |
| `phi_access_log` | 7 years | PHI access tracking |
| `claude_api_audit` | 7 years | AI operation audit |
| `login_attempts` | 7 years | Authentication audit |
| `admin_audit_logs` | 7 years | Administrative actions |
| `super_admin_audit_log` | 7 years | Super admin actions |
| `passkey_audit_log` | 7 years | Passkey authentication |
| `consent_log` | 7 years | Consent tracking |
| `caregiver_access_log` | 7 years | Caregiver access |

**Note:** Audit logs are immutable (UPDATE/DELETE blocked by triggers).

### 3. Session and Temporary Data

| Table | Retention | Action |
|-------|-----------|--------|
| `envision_sessions` | 90 days | Purge expired |
| `caregiver_sessions` | 90 days | Purge expired |
| `admin_sessions` | 30 days | Purge expired |
| `envision_totp_pending` | 24 hours | Purge expired |
| `envision_reset_tokens` | 24 hours | Purge expired |
| `pending_registrations` | 7 days | Purge expired |

### 4. Operational Data

| Table | Retention | Justification |
|-------|-----------|---------------|
| `ai_predictions` | 1 year | Performance analysis |
| `ai_accuracy_metrics` | 2 years | Quality improvement |
| `feature_usage` | 1 year | Usage analytics |
| `error_logs` | 90 days | Troubleshooting |

### 5. Financial/Billing Data

| Table | Retention | Justification |
|-------|-----------|---------------|
| `claims` | 7 years | Billing records |
| `claim_lines` | 7 years | Billing details |
| `claim_payments` | 7 years | Payment records |
| `billing_providers` | 7 years | Provider records |

---

## Retention Policy Implementation

### Database Table: data_retention_policies

```sql
CREATE TABLE data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    retention_days INTEGER NOT NULL,
    archive_before_delete BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID
);
```

### Recommended Policy Configuration

```sql
-- Session cleanup (short retention)
INSERT INTO data_retention_policies (policy_name, table_name, retention_days, archive_before_delete) VALUES
('Session Cleanup', 'envision_sessions', 90, false),
('Session Cleanup', 'caregiver_sessions', 90, false),
('Session Cleanup', 'admin_sessions', 30, false),
('Token Cleanup', 'envision_totp_pending', 1, false),
('Token Cleanup', 'envision_reset_tokens', 1, false),
('Registration Cleanup', 'pending_registrations', 7, false);

-- Operational data (medium retention)
INSERT INTO data_retention_policies (policy_name, table_name, retention_days, archive_before_delete) VALUES
('AI Predictions Cleanup', 'ai_predictions', 365, true),
('Error Logs Cleanup', 'error_logs', 90, false),
('Usage Analytics', 'feature_usage', 365, true);

-- PHI/Clinical data (long retention - DO NOT DELETE before 7 years)
-- These are informational only - actual deletion requires manual approval
INSERT INTO data_retention_policies (policy_name, table_name, retention_days, archive_before_delete) VALUES
('PHI Retention', 'check_ins', 2555, true),  -- 7 years
('PHI Retention', 'encounters', 2555, true),
('PHI Retention', 'risk_assessments', 2555, true);
```

---

## Archive Process

### Before Deletion

1. **Export to archive storage**
   - S3 bucket with server-side encryption
   - Separate archive per tenant
   - Immutable storage (WORM)

2. **Verify archive integrity**
   - SHA-256 hash of archive
   - Record count verification
   - Sample data spot-check

3. **Create deletion audit record**
   - Records deleted count
   - Date range deleted
   - Archived location
   - Authorized by

### Archive Format

```
archives/
├── {tenant_id}/
│   ├── {year}/
│   │   ├── check_ins_{date_range}.parquet.gz
│   │   ├── encounters_{date_range}.parquet.gz
│   │   └── manifest.json
│   └── deletion_log.json
```

### Manifest Contents

```json
{
  "tenant_id": "uuid",
  "table_name": "check_ins",
  "record_count": 15000,
  "date_range": {
    "start": "2019-01-01",
    "end": "2019-12-31"
  },
  "archived_at": "2026-01-03T00:00:00Z",
  "sha256": "abc123...",
  "archived_by": "system:retention_job",
  "retention_policy": "PHI Retention"
}
```

---

## Deletion Process

### Automated Deletion (Session/Temp Data Only)

```sql
-- Scheduled job: daily at 3 AM UTC
CREATE OR REPLACE FUNCTION execute_retention_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    policy RECORD;
    deleted_count INTEGER;
BEGIN
    FOR policy IN
        SELECT * FROM data_retention_policies
        WHERE is_active = true
        AND table_name IN (
            'envision_sessions', 'caregiver_sessions', 'admin_sessions',
            'envision_totp_pending', 'envision_reset_tokens', 'pending_registrations',
            'error_logs'
        )
    LOOP
        EXECUTE format(
            'DELETE FROM %I WHERE created_at < NOW() - INTERVAL ''%s days''',
            policy.table_name,
            policy.retention_days
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;

        IF deleted_count > 0 THEN
            INSERT INTO audit_logs (event_type, event_category, metadata)
            VALUES (
                'RETENTION_CLEANUP',
                'SYSTEM_EVENT',
                jsonb_build_object(
                    'table', policy.table_name,
                    'policy', policy.policy_name,
                    'deleted_count', deleted_count
                )
            );
        END IF;

        UPDATE data_retention_policies
        SET last_executed_at = NOW()
        WHERE id = policy.id;
    END LOOP;
END;
$$;
```

### Manual Deletion (PHI Data)

PHI data deletion requires:

1. **Written request** from authorized administrator
2. **Legal review** confirming retention period satisfied
3. **Archive verification** confirming backup exists
4. **Dual authorization** (two admin approvals)
5. **Audit trail** in `super_admin_audit_log`

---

## Data Subject Rights

### Right to Deletion (HIPAA/State Laws)

Patients may request deletion of their PHI. Process:

1. Verify identity of requester
2. Check if minimum retention period satisfied
3. Check for legal holds or litigation
4. Archive data before deletion
5. Delete from active systems
6. Retain audit log of deletion

### Exceptions to Deletion

Data cannot be deleted if:

- Retention period not satisfied
- Active legal hold
- Ongoing investigation
- Required for continued treatment
- Required for payment processing

---

## Audit and Compliance

### Annual Retention Audit

1. Verify all tables have assigned policies
2. Review archive storage integrity
3. Verify deletion jobs executing correctly
4. Sample audit log review
5. Update policies for regulatory changes

### Reporting

| Report | Frequency | Audience |
|--------|-----------|----------|
| Deletion Summary | Monthly | Compliance Officer |
| Archive Inventory | Quarterly | IT Security |
| Policy Compliance | Annually | Executive Team |
| Audit Log Analysis | On-demand | Auditors |

---

## Implementation Status

### Phase 1: Policy Framework (Complete)

- [x] Define retention periods
- [x] Document policy table structure
- [x] Create documentation

### Phase 2: Automated Cleanup (Pending)

- [ ] Implement `execute_retention_policies()` function
- [ ] Schedule daily cleanup job via pg_cron
- [ ] Configure session data cleanup
- [ ] Test in development environment

### Phase 3: PHI Archive System (Pending)

- [ ] Set up S3 archive bucket with WORM
- [ ] Implement archive export function
- [ ] Create archive manifest system
- [ ] Test archive/restore process

### Phase 4: Monitoring (Pending)

- [ ] Add retention alerts to Guardian AI
- [ ] Create compliance dashboard
- [ ] Set up archive storage monitoring
- [ ] Annual audit automation

---

## Contacts

| Role | Responsibility |
|------|----------------|
| Data Protection Officer | Policy approval, legal review |
| Compliance Officer | Audit oversight, regulatory updates |
| IT Security | Archive storage, encryption |
| Database Administrator | Cleanup jobs, performance |

---

## Revision History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-01-03 | 1.0 | Initial policy framework | Claude Code |
