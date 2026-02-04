# SOC 2 FHIR Backend Deployment Guide
**Version**: 1.0
**Last Updated**: 2025-10-18
**Status**: Production-Ready (Post Security Implementation)

---

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Encryption Key Setup](#encryption-key-setup)
3. [Migration Deployment](#migration-deployment)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Monitoring Setup](#monitoring-setup)
6. [Operational Procedures](#operational-procedures)
7. [Incident Response](#incident-response)
8. [Compliance Validation](#compliance-validation)

---

## Pre-Deployment Checklist

### Required Before Production Deployment

- [ ] **Encryption Key Generated** (see [Encryption Key Setup](#encryption-key-setup))
- [ ] **Key Storage Configured** (AWS Secrets Manager / Azure Key Vault / HashiCorp Vault)
- [ ] **Backup Strategy Verified** (encrypted backups, tested restore)
- [ ] **Database Performance Baseline** (query performance metrics)
- [ ] **Monitoring Alerts Configured** (security events, rate limits, errors)
- [ ] **Access Control Review** (RLS policies, user roles)
- [ ] **Penetration Test Scheduled** (external security audit)
- [ ] **Incident Response Plan** (documented, team trained)
- [ ] **Data Retention Policy Approved** (legal review completed)
- [ ] **Disaster Recovery Plan** (documented, tested)

### Development/Staging Environment Requirements

- [ ] Separate encryption keys for each environment
- [ ] Test data only (no production PHI)
- [ ] Network isolation
- [ ] Identical schema to production

---

## Encryption Key Setup

### 1. Generate Encryption Key

```bash
# Generate a strong 256-bit encryption key
openssl rand -base64 32
```

Example output: `a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==`

### 2. Store Key Securely

#### Option A: AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name wellfit/prod/encryption-key \
  --description "WellFit FHIR encryption master key" \
  --secret-string "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6=="
```

#### Option B: Azure Key Vault

```bash
az keyvault secret set \
  --vault-name wellfit-keyvault \
  --name encryption-key \
  --value "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6=="
```

#### Option C: HashiCorp Vault

```bash
vault kv put secret/wellfit/encryption-key \
  value="a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6=="
```

### 3. Configure Supabase

#### Via Supabase Dashboard:
1. Go to **Project Settings** → **Database**
2. Scroll to **Custom PostgreSQL Configuration**
3. Add parameter:
   ```
   app.encryption_key = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6=='
   ```
4. Click **Save**
5. **Restart Database** (required for parameter to take effect)

#### Via SQL (Self-Hosted PostgreSQL):
```sql
ALTER SYSTEM SET app.encryption_key TO 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==';
SELECT pg_reload_conf();
```

### 4. Verify Encryption Key

```sql
-- Should return your encryption key (only visible to database admins)
SHOW app.encryption_key;

-- Test encryption
SELECT public.encrypt_data('test');
-- Should return encrypted string

SELECT public.decrypt_data(public.encrypt_data('test'));
-- Should return 'test'
```

### 5. Key Rotation Procedure

**Frequency**: Annually or upon security incident

```sql
-- 1. Generate new key
-- 2. Set new key as app.encryption_key_new
-- 3. Run migration to re-encrypt all data
BEGIN;

-- Re-encrypt all access tokens
UPDATE fhir_connections
SET access_token_encrypted = public.encrypt_data(
  public.decrypt_data(access_token_encrypted)
);

-- Re-encrypt all profiles
UPDATE profiles
SET
  phone_encrypted = public.encrypt_data(public.decrypt_data(phone_encrypted)),
  email_encrypted = public.encrypt_data(public.decrypt_data(email_encrypted));

-- 4. Remove old key
-- 5. Rename new key to app.encryption_key

COMMIT;
```

---

## Migration Deployment

### Deployment Order (CRITICAL - DO NOT CHANGE)

Deploy migrations in this exact order:

```bash
# 1. Security Foundation (creates audit_logs, security_events, encryption infrastructure)
psql -f supabase/migrations/20251018160000_soc2_security_foundation.sql

# 2. Field Encryption (adds encrypted columns and triggers)
psql -f supabase/migrations/20251018160001_soc2_field_encryption.sql

# 3. Audit Triggers (enables automatic audit logging)
psql -f supabase/migrations/20251018160002_soc2_audit_triggers.sql

# 4. Data Retention (creates retention policies and GDPR functions)
psql -f supabase/migrations/20251018160003_soc2_data_retention.sql
```

### Using Supabase CLI

```bash
# 1. Ensure Supabase is linked
supabase link --project-ref your-project-ref

# 2. Push migrations (automatically deploys in order)
supabase db push

# 3. Verify migrations
supabase db migration list
```

### Rollback Procedure (Emergency Only)

```bash
# DANGER: This will remove all security controls
# Only use in catastrophic failure

# 1. Stop application traffic
# 2. Backup database
pg_dump -Fc wellfit_db > backup_$(date +%Y%m%d_%H%M%S).dump

# 3. Rollback migrations (reverse order)
psql -f rollback_20251018160003.sql
psql -f rollback_20251018160002.sql
psql -f rollback_20251018160001.sql
psql -f rollback_20251018160000.sql
```

---

## Post-Deployment Configuration

### 1. Migrate Existing Data to Encrypted Columns

```sql
-- Encrypt existing plaintext data (run once after deployment)
BEGIN;

-- Migrate FHIR connection tokens
UPDATE fhir_connections
SET
  access_token_encrypted = public.encrypt_data(access_token),
  refresh_token_encrypted = public.encrypt_data(refresh_token),
  access_token = NULL,
  refresh_token = NULL
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

-- Migrate profile data
UPDATE profiles
SET
  phone_encrypted = public.encrypt_data(phone),
  email_encrypted = public.encrypt_data(email),
  first_name_encrypted = public.encrypt_data(first_name),
  last_name_encrypted = public.encrypt_data(last_name),
  dob_encrypted = public.encrypt_data(dob)
WHERE phone IS NOT NULL
   OR email IS NOT NULL
   OR first_name IS NOT NULL
   OR last_name IS NOT NULL
   OR dob IS NOT NULL;

COMMIT;

-- Verify encryption
SELECT
  COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) AS encrypted_count,
  COUNT(*) FILTER (WHERE access_token IS NOT NULL) AS plaintext_count
FROM fhir_connections;
-- plaintext_count should be 0
```

### 2. Schedule Automated Jobs

#### Option A: pg_cron (Supabase Pro or Self-Hosted)

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily retention cleanup (2 AM UTC)
SELECT cron.schedule(
  'daily-retention-cleanup',
  '0 2 * * *',
  'SELECT public.daily_retention_cleanup()'
);

-- Weekly token expiration check (Monday 8 AM UTC)
SELECT cron.schedule(
  'weekly-token-check',
  '0 8 * * 1',
  'SELECT public.get_expired_fhir_tokens()'
);

-- Monthly database vacuum (1st of month, 3 AM UTC)
SELECT cron.schedule(
  'monthly-vacuum',
  '0 3 1 * *',
  'VACUUM ANALYZE audit_logs, security_events, fhir_sync_logs'
);

-- View scheduled jobs
SELECT * FROM cron.job;
```

#### Option B: External Scheduler (GitHub Actions, cron, etc.)

```yaml
# .github/workflows/retention-cleanup.yml
name: Daily Retention Cleanup
on:
  schedule:
    - cron: '0 2 * * *' # 2 AM UTC daily

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Run retention cleanup
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/daily_retention_cleanup" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

### 3. Configure Application Code

Update `fhirInteroperabilityIntegrator.ts` to use security service:

```typescript
import { ErrorSanitizer, AuditLogger, RateLimiter, FHIRValidator } from './fhirSecurityService';

// Replace all try-catch blocks
try {
  // FHIR operation
} catch (error) {
  // OLD: console.error(error)
  // NEW:
  const sanitizedError = ErrorSanitizer.sanitize(error);
  await ErrorSanitizer.logError(error, { context: 'FHIR import' });
  throw new Error(sanitizedError);
}

// Add rate limiting to sync operations
async syncFromFHIR(connectionId: string, userIds?: string[]): Promise<SyncResult> {
  // Check rate limit
  await RateLimiter.enforce('FHIR_SYNC', 50, 60);

  // ... rest of implementation
}
```

---

## Monitoring Setup

### 1. Security Monitoring Queries

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW public.security_dashboard AS
SELECT
  -- Last 24 hours
  COUNT(*) FILTER (WHERE se.timestamp >= NOW() - INTERVAL '24 hours') AS events_24h,
  COUNT(*) FILTER (WHERE se.severity = 'CRITICAL' AND se.timestamp >= NOW() - INTERVAL '24 hours') AS critical_24h,
  COUNT(*) FILTER (WHERE se.severity = 'HIGH' AND se.timestamp >= NOW() - INTERVAL '24 hours') AS high_24h,
  COUNT(*) FILTER (WHERE se.requires_investigation AND NOT se.investigated) AS requires_investigation,

  -- PHI Access
  (SELECT COUNT(*) FROM audit_logs WHERE event_category = 'PHI_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours') AS phi_access_24h,

  -- Failed operations
  COUNT(*) FILTER (WHERE NOT al.success AND al.timestamp >= NOW() - INTERVAL '24 hours') AS failed_operations_24h
FROM security_events se
CROSS JOIN audit_logs al;

-- Grant access
GRANT SELECT ON public.security_dashboard TO authenticated;
```

### 2. Alert Configuration

```sql
-- Function to check for critical security events
CREATE OR REPLACE FUNCTION public.check_critical_security_events()
RETURNS TABLE (
  alert_type TEXT,
  count BIGINT,
  severity TEXT,
  requires_action BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'Critical Security Events' AS alert_type,
    COUNT(*) AS count,
    'CRITICAL' AS severity,
    TRUE AS requires_action
  FROM security_events
  WHERE severity = 'CRITICAL'
    AND timestamp >= NOW() - INTERVAL '1 hour'
    AND NOT investigated

  UNION ALL

  SELECT
    'Failed Authentication Attempts',
    COUNT(*),
    'HIGH',
    COUNT(*) > 10
  FROM security_events
  WHERE event_type IN ('FAILED_LOGIN', 'BRUTE_FORCE_ATTEMPT')
    AND timestamp >= NOW() - INTERVAL '1 hour'

  UNION ALL

  SELECT
    'Rate Limit Violations',
    COUNT(*),
    'MEDIUM',
    COUNT(*) > 5
  FROM security_events
  WHERE event_type = 'RATE_LIMIT_EXCEEDED'
    AND timestamp >= NOW() - INTERVAL '1 hour';
END;
$$;
```

### 3. Grafana Dashboard (Optional)

```sql
-- Metrics for Grafana PostgreSQL datasource

-- Security events over time
SELECT
  date_trunc('hour', timestamp) AS time,
  severity,
  COUNT(*) AS count
FROM security_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1;

-- PHI access patterns
SELECT
  date_trunc('day', timestamp) AS time,
  event_type,
  COUNT(*) AS count
FROM audit_logs
WHERE event_category = 'PHI_ACCESS'
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1;
```

---

## Operational Procedures

### Daily Operations Checklist

- [ ] Review security events dashboard
- [ ] Check failed authentication attempts
- [ ] Verify backup completion
- [ ] Review rate limit violations
- [ ] Check token expiration warnings

### Weekly Operations Checklist

- [ ] Review PHI access reports
- [ ] Audit log integrity check
- [ ] Performance metrics review
- [ ] Expired token cleanup
- [ ] Review GDPR deletion requests

### Monthly Operations Checklist

- [ ] Compliance report generation
- [ ] Security event trend analysis
- [ ] Capacity planning review
- [ ] Access control audit
- [ ] Backup restore test

### Quarterly Operations Checklist

- [ ] External security audit
- [ ] Penetration testing
- [ ] Disaster recovery drill
- [ ] Compliance documentation update
- [ ] Key rotation (if applicable)

---

## Incident Response

### Security Incident Classification

| Severity | Examples | Response Time |
|----------|----------|---------------|
| **CRITICAL** | Data breach, unauthorized PHI access, system compromise | Immediate (< 15 min) |
| **HIGH** | Brute force attack, mass data export, SQL injection attempt | < 1 hour |
| **MEDIUM** | Rate limit violations, suspicious login patterns | < 4 hours |
| **LOW** | Single failed login, minor config issue | < 24 hours |

### Incident Response Procedure

1. **Detection**
   ```sql
   -- Check for critical events
   SELECT * FROM public.check_critical_security_events();

   -- Investigate specific incident
   SELECT * FROM security_events WHERE id = '<event-id>';
   SELECT * FROM audit_logs WHERE related_security_event_id = '<event-id>';
   ```

2. **Containment**
   ```sql
   -- Revoke compromised tokens
   SELECT public.revoke_fhir_token('<connection-id>', 'Security incident');

   -- Disable user account
   UPDATE auth.users SET banned_until = NOW() + INTERVAL '24 hours'
   WHERE id = '<user-id>';

   -- Block IP address (application firewall level)
   ```

3. **Investigation**
   ```sql
   -- Get full audit trail for user
   SELECT * FROM audit_logs
   WHERE actor_user_id = '<user-id>'
   ORDER BY timestamp DESC
   LIMIT 1000;

   -- Check for data exfiltration
   SELECT * FROM audit_logs
   WHERE event_type = 'PHI_EXPORT'
     AND timestamp >= '<incident-time>' - INTERVAL '24 hours'
   ORDER BY timestamp DESC;
   ```

4. **Remediation**
   - Apply security patches
   - Rotate encryption keys (if compromised)
   - Update access controls
   - Notify affected parties (HIPAA Breach Notification Rule)

5. **Documentation**
   ```sql
   -- Mark incident as investigated
   UPDATE security_events
   SET investigated = TRUE,
       investigated_by = auth.uid(),
       investigated_at = NOW(),
       resolution = 'Description of resolution steps taken'
   WHERE id = '<event-id>';
   ```

---

## Compliance Validation

### SOC 2 Audit Evidence Collection

```sql
-- 1. Access Control Report
SELECT
  ur.user_id,
  ur.role,
  p.email,
  ur.created_at AS role_assigned_at
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.user_id
ORDER BY ur.created_at DESC;

-- 2. Audit Log Completeness
SELECT
  date_trunc('day', timestamp) AS date,
  COUNT(*) AS log_entries,
  COUNT(DISTINCT actor_user_id) AS unique_users,
  COUNT(*) FILTER (WHERE success = FALSE) AS failed_operations
FROM audit_logs
WHERE timestamp >= NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 3. Encryption Verification
SELECT
  'fhir_connections' AS table_name,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) AS encrypted_records,
  ROUND(100.0 * COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) / NULLIF(COUNT(*), 0), 2) AS encryption_percentage
FROM fhir_connections
UNION ALL
SELECT
  'profiles',
  COUNT(*),
  COUNT(*) FILTER (WHERE phone_encrypted IS NOT NULL OR email_encrypted IS NOT NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE phone_encrypted IS NOT NULL OR email_encrypted IS NOT NULL) / NULLIF(COUNT(*), 0), 2)
FROM profiles;

-- 4. Data Retention Compliance
SELECT * FROM public.execute_retention_policies();

-- 5. Security Events Summary
SELECT
  severity,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE investigated) AS investigated_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE investigated) / COUNT(*), 2) AS investigation_rate_pct
FROM security_events
WHERE timestamp >= NOW() - INTERVAL '90 days'
GROUP BY severity
ORDER BY
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END;
```

---

## Support and Escalation

### Internal Team Contacts
- **Security Team**: security@wellfit.com
- **Database Team**: dba@wellfit.com
- **On-Call**: oncall@wellfit.com

### External Vendors
- **Supabase Support**: Enterprise Support Portal
- **SOC 2 Auditor**: [Your Audit Firm]
- **Penetration Testing**: [Your Security Vendor]

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-18 | Claude Code | Initial deployment guide created |

---

**End of Deployment Guide**
