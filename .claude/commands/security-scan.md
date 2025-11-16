# HIPAA Security Compliance Scan

Run comprehensive HIPAA compliance checks to ensure Protected Health Information (PHI) is properly secured.

## What This Command Does

Executes the **HIPAA Compliance Checker skill** to scan for:
1. PHI logging violations
2. Missing RLS policies
3. Unencrypted PHI fields
4. Missing audit logging
5. Hardcoded credentials

## Execution

Invoke the HIPAA Compliance Checker skill with full scan mode.

## Expected Output (Success)

```
🏥 HIPAA COMPLIANCE SCAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Scanning for PHI logging violations...
✅ No PHI logging violations found

[2/5] Verifying RLS policies...
✅ RLS enabled on 87 tables
✅ All PHI tables have RLS policies

[3/5] Checking field encryption...
✅ Found 12 encrypted fields
✅ All required PHI fields encrypted:
  - email_encrypted
  - phone_encrypted
  - date_of_birth_encrypted
  - access_token_encrypted
  - ssn_encrypted (if applicable)

[4/5] Validating audit logging...
✅ Audit logging found in 15 PHI-handling services
✅ All critical operations logged to audit_logs

[5/5] Scanning for hardcoded secrets...
✅ No exposed credentials found
✅ All API keys in environment variables

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HIPAA COMPLIANCE: PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  ✅ PHI Logging: Clean
  ✅ RLS Policies: 87/87 tables
  ✅ Encryption: 12/12 fields
  ✅ Audit Logging: 15 services
  ✅ Secret Scanning: Clean

🎯 Compliance Status:
  ✅ HIPAA § 164.312(a)(1) - Access Control
  ✅ HIPAA § 164.312(a)(2)(iv) - Encryption
  ✅ HIPAA § 164.312(b) - Audit Controls
  ✅ HIPAA § 164.312(c)(1) - Integrity
  ✅ HIPAA § 164.312(e)(1) - Transmission Security

Ready for SOC2 Type II audit! 🚀
Ready for Methodist Hospital demo! 🏥
```

## Expected Output (Violations Found)

```
🏥 HIPAA COMPLIANCE SCAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Scanning for PHI logging violations...
❌ Found 3 PHI logging violations

Violations:
  📄 src/services/phiEncryption.ts:145
     console.log(patientId, encryptedData)
     ⚠️ RISK: Patient ID exposed in logs

  📄 src/api/medications.ts:89
     console.error('Medication error:', medicationDetails)
     ⚠️ RISK: Medication data in error logs

  📄 src/components/PatientProfile.tsx:203
     console.log('Profile loaded:', profile)
     ⚠️ RISK: Full patient profile in browser console

[2/5] Verifying RLS policies...
⚠️ WARNING: 2 tables missing RLS policies

Missing RLS:
  📋 vital_signs (created in migration 20251018160001)
     ACTION: Add RLS policy for tenant isolation

  📋 wearable_data (no RLS policy found)
     ACTION: Add RLS policy before production deployment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ HIPAA COMPLIANCE: FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Critical Issues Found:
  ❌ 3 PHI logging violations (CRITICAL)
  ⚠️ 2 tables missing RLS (HIGH)

🚨 IMMEDIATE ACTION REQUIRED:
  1. Remove console.log from PHI-handling code
  2. Add RLS policies to vital_signs and wearable_data
  3. Run security scan again after fixes
  4. Do NOT deploy until all issues resolved

📋 Remediation Steps:

For PHI Logging Violations:
  - Search and remove all console.log in PHI services
  - Use audit logging service instead: auditLogger.phi()
  - Run: npm run lint to catch remaining violations

For Missing RLS:
  - Create migration: npx supabase migration new add_rls_policies
  - Add policies for vital_signs and wearable_data
  - Test with different user roles
  - Verify tenant isolation

🔴 COMPLIANCE STATUS: NOT READY FOR PRODUCTION
```

## When to Run

**Before every commit:**
- Part of pre-commit validation
- Catches issues early

**Before demos:**
- Methodist Hospital demo requires clean scan
- Shows security commitment

**Weekly security review:**
- Regular compliance audits
- Track security posture over time

**Before SOC2 audit:**
- Validate audit readiness
- Document compliance controls

**After adding PHI fields:**
- Verify new fields are encrypted
- Ensure RLS policies updated
- Confirm audit logging added

## Integration with Other Commands

This command is included in:
- `/demo-ready` - Methodist demo validation
- Pre-commit skill - Code quality gates
- Deployment skill - Pre-deployment checks

## Related Documentation

This scan validates controls documented in:
- `docs/HIPAA_SOC2_SECURITY_AUDIT.md`
- `docs/HIPAA_COMPLIANCE.md`
- `docs/SOC2_SECURITY_CONTROLS.md`

## Quick Fixes

**PHI Logging Violations:**
```bash
# Find all violations
grep -rn "console\.\(log\|error\)" src/services/phi* src/utils/phi*

# Replace with audit logging
# Before: console.log(patientData)
# After:  auditLogger.phi('Accessed patient data', patientId, { operation: 'view' })
```

**Missing RLS Policies:**
```sql
-- Template for adding RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their tenant's data"
ON table_name
FOR ALL
USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

## Automated Scanning

For automated daily scanning, set up a cron job:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/project && /security-scan > /var/log/hipaa-scan.log
```

This ensures continuous compliance monitoring.

## Notes

- This scan is read-only (no automatic fixes)
- Reports all violations (even minor ones)
- Prioritizes critical issues (PHI exposure)
- Cross-references HIPAA § 164.312 requirements
- Provides actionable remediation steps
