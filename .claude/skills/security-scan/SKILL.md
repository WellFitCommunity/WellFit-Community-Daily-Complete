# HIPAA Compliance Checker Skill

## Purpose
Automated scanning for HIPAA compliance violations in code to ensure Protected Health Information (PHI) is properly secured.

## What This Skill Does

Scans the codebase for common HIPAA compliance issues:

1. **PHI Logging Violations** - Detect console.log() in PHI-handling code
2. **Missing RLS Policies** - Verify Row-Level Security on database tables
3. **Unencrypted PHI Fields** - Check for PHI columns without encryption
4. **Missing Audit Logging** - Ensure PHI access is logged
5. **Hardcoded Credentials** - Scan for exposed API keys or secrets

## Execution Steps

### Step 1: PHI Logging Violations
Scan for active logging in PHI-handling code:
```bash
# Search for console statements in PHI services
grep -rn "console\.\(log\|error\|warn\|info\)" \
  src/services/phi* \
  src/utils/phi* \
  src/api/medications* \
  src/services/fhir* \
  src/components/*Patient* \
  src/components/*Medical* \
  --exclude-dir=__tests__ \
  --exclude="*.test.ts" \
  --exclude="*.test.tsx"
```

**Violations to report:**
- `console.log()` with patient data
- `console.error()` with PHI
- Uncommented debug statements

### Step 2: Database RLS Policy Check
Verify RLS is enabled on all PHI tables:
```bash
# Check migration files for RLS policies
grep -l "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql | wc -l
```

**Tables requiring RLS:**
- `profiles` (patient data)
- `medications`
- `health_assessments`
- `vital_signs`
- `encounters`
- `lab_results`
- `fhir_*` tables
- `phi_access_logs`
- `audit_logs`

### Step 3: Encryption Validation
Check for PHI fields with encryption:
```bash
# Look for encrypted column definitions
grep -r "_encrypted" supabase/migrations/*.sql
```

**Required encrypted fields:**
- `email_encrypted`
- `phone_encrypted`
- `ssn_encrypted` (if exists)
- `date_of_birth_encrypted`
- `access_token_encrypted`

### Step 4: Audit Logging Coverage
Verify audit logging for PHI access:
```bash
# Check for auditLogger calls in services
grep -r "auditLogger\.\(phi\|clinical\)" src/services/*.ts | wc -l
```

**Services requiring audit logging:**
- PHI encryption service
- FHIR integration service
- Medication service
- Health assessment service
- Patient profile service

### Step 5: Secret Scanning
Scan for hardcoded credentials:
```bash
# Search for potential secrets (excluding node_modules)
grep -rn --exclude-dir={node_modules,.git,dist,build} \
  -E "(sk-ant-|AKIA|BEGIN PRIVATE KEY|postgres://|mysql://)" .
```

**Patterns to detect:**
- Anthropic API keys: `sk-ant-*`
- AWS keys: `AKIA*`
- Private keys: `BEGIN PRIVATE KEY`
- Database URLs: `postgres://`, `mysql://`
- Supabase keys: Long alphanumeric strings

## Compliance Checks Matrix

| Check | HIPAA Requirement | Status |
|-------|-------------------|--------|
| PHI Logging | §164.312(b) - Audit Controls | Check |
| RLS Policies | §164.312(a)(1) - Access Control | Check |
| Encryption | §164.312(a)(2)(iv) - Encryption | Check |
| Audit Logging | §164.312(b) - Audit Controls | Check |
| Secret Management | §164.312(a)(2)(i) - Unique User ID | Check |

## Output Format

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
✅ All required PHI fields encrypted

[4/5] Validating audit logging...
✅ Audit logging found in 15 PHI-handling services
✅ All critical operations logged

[5/5] Scanning for hardcoded secrets...
✅ No exposed credentials found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HIPAA COMPLIANCE: PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  ✅ PHI Logging: Clean
  ✅ RLS Policies: 87/87 tables
  ✅ Encryption: 12/12 fields
  ✅ Audit Logging: 15 services
  ✅ Secret Scanning: Clean

Ready for SOC2 audit!
```

## Failure Output Format

```
🏥 HIPAA COMPLIANCE SCAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Scanning for PHI logging violations...
❌ Found 3 PHI logging violations

Violations:
  src/services/phiEncryption.ts:145 - console.log(patientId, encryptedData)
  src/api/medications.ts:89 - console.error(medicationDetails)
  src/components/PatientProfile.tsx:203 - console.log(profile)

[2/5] Verifying RLS policies...
⚠️ WARNING: 2 tables missing RLS policies

Missing RLS:
  - vital_signs (line 1423 in migration)
  - wearable_data (no policy found)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ HIPAA COMPLIANCE: FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Critical Issues:
  ❌ 3 PHI logging violations
  ⚠️ 2 tables missing RLS

Recommended Actions:
  1. Remove console.log from PHI-handling code
  2. Add RLS policies to vital_signs and wearable_data tables
  3. Re-run scan after fixes
```

## When to Use This Skill

- **Before Methodist demo** - Ensure compliance for hospital presentation
- **Before commits** - Part of pre-commit validation
- **Weekly security review** - Regular compliance audits
- **Before SOC2 audit** - Validate audit readiness
- **After adding PHI fields** - Verify new fields are protected

## Integration with Security Documentation

This skill validates the controls documented in:
- `docs/HIPAA_SOC2_SECURITY_AUDIT.md`
- `docs/HIPAA_COMPLIANCE.md`
- `docs/SOC2_SECURITY_CONTROLS.md`

## Notes for AI Agent

- Report all violations (don't hide issues)
- Provide file paths and line numbers for violations
- Prioritize critical issues (PHI exposure) over warnings
- Suggest remediation actions for each violation
- Cross-reference with HIPAA requirements (§164.312)
- Track compliance score over time
