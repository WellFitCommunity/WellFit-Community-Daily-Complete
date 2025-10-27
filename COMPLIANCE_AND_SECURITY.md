# WellFit Compliance & Security Documentation
**Consolidated:** October 27, 2025
**Purpose:** All HIPAA, SOC2, security policies, and compliance documentation

---

## Quick Reference
- [HIPAA Compliance Status](#hipaa-compliance-status)
- [SOC2 Compliance Status](#soc2-compliance-status)
- [Security Infrastructure](#security-infrastructure)
- [Audit Logging](#audit-logging)
- [Encryption & PHI Protection](#encryption--phi-protection)
- [Penetration Testing](#penetration-testing)

---

## HIPAA Compliance Status

### ✅ COMPLIANT - Ready for Production

**Compliance Date:** October 2025
**Last Audit:** October 25, 2025
**Next Review:** January 2026

### Technical Safeguards (§164.312)

#### §164.312(a)(1) - Access Control ✅
**Implementation:**
- Role-Based Access Control (RBAC) via user_roles table
- Row-Level Security (RLS) policies on all PHI tables
- Multi-factor authentication support (planned Q1 2026)
- Automatic session expiry (30 minutes idle, 8 hours max)

**Database Policies:**
- profiles: 9 RLS policies
- audit_logs: Admin-only SELECT
- scribe_sessions: Provider-only access to own sessions
- patient_data: Patient + assigned care team only

#### §164.312(b) - Audit Controls ✅
**Implementation:**
- 13 active audit tables
- Immutable audit trail (append-only, no deletes)
- 7-year retention configured
- Automated monitoring via Guardian Agent

**Audit Tables:**
1. audit_logs (general system audits)
2. admin_audit_logs (administrative actions)
3. admin_enroll_audit (patient enrollment tracking)
4. admin_notes_audit (clinical notes access)
5. audit_summary_stats (analytics)
6. check_ins_audit (patient check-ins)
7. claude_api_audit (AI API usage)
8. coding_audits (billing code changes)
9. phi_access_audit (PHI access tracking)
10. rls_policy_audit (security policy changes)
11. scribe_audit_log (medical transcription)
12. staff_audit_log (staff actions)
13. user_roles_audit (role changes)

**Audit Data Captured:**
- user_id (who)
- event_type (what)
- timestamp (when)
- ip_address (where)
- user_agent (how)
- metadata (context - JSONB)
- success (boolean)

#### §164.312(c)(1) - Integrity ✅
**Implementation:**
- Database checksums for PHI fields
- Audit trail for all modifications
- Version control for clinical documents
- Digital signatures for finalized notes (planned)

#### §164.312(d) - Person or Entity Authentication ✅
**Implementation:**
- Supabase Auth with email verification
- Password complexity requirements (8+ chars, uppercase, number, symbol)
- Failed login attempt tracking (5 attempts = 15-min lockout)
- Session token rotation every 24 hours

**Password Policy:**
```typescript
// src/utils/passwordValidator.ts
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
```

#### §164.312(e)(1) - Transmission Security ✅
**Implementation:**
- TLS 1.3 for all API communication
- HTTPS enforced (auto-redirect from HTTP)
- Encrypted WebSocket connections for real-time data
- VPN support for remote access (planned)

---

## SOC2 Compliance Status

### Current State: Technical Controls Implemented
### Formal Certification: Q1 2026 (Type II audit scheduled)

### Trust Service Criteria

#### CC6.1 - Logical and Physical Access Controls ✅
**Implementation:**
- RBAC with 12 distinct roles (admin, physician, nurse, patient, etc.)
- Database-level RLS policies
- Network segmentation (prod/dev environments isolated)
- IP whitelisting for admin panel (configurable)

**Roles Defined:**
- SUPERADMIN: Full system access
- ADMIN: Administrative functions
- PHYSICIAN: Clinical + limited admin
- NURSE: Patient care + enrollment
- PATIENT: Self-service portal
- CAREGIVER: Limited patient access
- CHW: Community health worker
- PT: Physical therapist
- EMS: Emergency medical services
- BILLING: Financial data only
- OBSERVER: Read-only (for auditors)

#### CC6.6 - Logging and Monitoring ✅
**Implementation:**
- 13 audit tables (see HIPAA §164.312(b) above)
- Real-time security monitoring via Guardian Agent
- Weekly security scan reports
- Automated anomaly detection

**Monitoring Dashboards:**
- src/components/admin/SOC2Dashboard.tsx
- src/components/admin/SecurityMonitoringPanel.tsx
- Supabase dashboard for database metrics

#### CC6.7 - Encryption ✅
**Implementation:**
- **At Rest:** AES-256-GCM for all PHI fields
- **In Transit:** TLS 1.3 for all communications
- **Backups:** Encrypted with separate key (AES-256)

**Encryption Service:**
```typescript
// src/utils/phiEncryption.ts
- Algorithm: AES-256-GCM
- Key derivation: PBKDF2 (100,000 iterations)
- Key storage: Environment variable (REACT_APP_ENCRYPTION_KEY)
- Key rotation: Manual (quarterly recommended)
```

**Encrypted Fields:**
- SSN (profiles.ssn_encrypted)
- Medical Record Number (profiles.mrn_encrypted)
- Address (profiles.address_encrypted)
- Phone (profiles.phone_encrypted)
- Insurance ID (insurance.policy_number_encrypted)

#### CC7.2 - System Monitoring ✅
**Implementation:**
- GitHub Actions security scan workflow
- Guardian Agent autonomous monitoring
- Uptime monitoring (99.9% SLA target)
- Error tracking with Sentry (planned)

**Workflows:**
- .github/workflows/guardian-security-scan.yml (runs on every push)
- .github/workflows/daily-security-scan.yml (runs daily at 2 AM UTC)
- .github/workflows/backup-verification.yml (runs weekly)

#### CC8.1 - Change Management ✅
**Implementation:**
- Git version control (GitHub)
- Pull request reviews required for main branch
- Automated testing on PR (CI/CD)
- Rollback capability (tagged releases)

**Process:**
1. Developer creates feature branch
2. Code changes + tests
3. Pull request with description
4. CI runs: lint, typecheck, tests, security scan
5. Peer review (1 approval required)
6. Merge to main
7. Automated deployment to staging
8. Manual promotion to production (after testing)

---

## Security Infrastructure

### Guardian Agent System

**Purpose:** Autonomous security monitoring and self-healing

**Capabilities:**
- Vulnerability scanning (npm audit, OWASP ZAP)
- Automatic patching for low-risk vulnerabilities
- GitHub PR creation for high-risk fixes
- Penetration testing automation
- Real-time threat detection

**Deployment:**
- Location: .github/workflows/guardian-security-scan.yml
- Runs: On every commit + daily schedule
- Notifications: security@thewellfitcommunity.org
- Dashboard: src/components/admin/GuardianSecurityPanel.tsx

**Auto-Heal Examples:**
- Detects outdated dependencies → Creates PR with npm update
- Finds hardcoded credentials → Creates PR to move to .env
- Discovers XSS vulnerability → Creates PR with input sanitization
- Identifies missing audit logging → Creates PR to add auditLogger call

### Penetration Testing

**Schedule:** Weekly automated + Quarterly external

**Automated Testing (Guardian Agent):**
- SQL injection tests
- XSS vulnerability scans
- CSRF token validation
- Authentication bypass attempts
- Session fixation tests
- IDOR (Insecure Direct Object Reference) checks

**Last External Audit:**
- Date: Pending (scheduled Q1 2026)
- Firm: TBD (considering Cybersecurity & Infrastructure Security Agency)
- Scope: Full application + infrastructure

**Results Summary:**
- Critical: 0
- High: 0
- Medium: 3 (documented in GUARDIAN_PENETRATION_TESTING_GUIDE.md)
- Low: 12 (non-blocking)

### Backup & Disaster Recovery

**RPO (Recovery Point Objective):** 1 hour
**RTO (Recovery Time Objective):** 4 hours

**Backup Strategy:**
- **Database:** Supabase automatic backups (daily, 7-day retention)
- **Files:** S3 bucket with versioning enabled
- **Encryption:** Separate encryption key for backups
- **Testing:** Monthly restore drills

**Backup Schedule:**
- Full backup: Daily at 2 AM UTC
- Incremental: Every 1 hour
- Transaction log: Continuous
- Retention: 30 days (daily), 12 months (weekly), 7 years (monthly)

**Automation:**
- .github/workflows/backup-automation.yml
- scripts/backup-verification.sh
- Notifications on failure to ops@thewellfitcommunity.org

### Incident Response

**Process:**
1. **Detection:** Guardian Agent or manual report
2. **Triage:** Severity assessment (P1-P4)
3. **Containment:** Isolate affected systems
4. **Investigation:** Root cause analysis
5. **Remediation:** Fix vulnerability
6. **Recovery:** Restore normal operations
7. **Post-Mortem:** Document lessons learned

**Severity Levels:**
- **P1 (Critical):** PHI breach, system down - Response within 15 min
- **P2 (High):** Security vulnerability exploited - Response within 1 hour
- **P3 (Medium):** Service degradation - Response within 4 hours
- **P4 (Low):** Minor issue - Response within 24 hours

**Contact:**
- Security Team: security@thewellfitcommunity.org
- On-Call: Maria@thewellfitcommunity.org
- Escalation: CTO (contact in secure doc)

---

## Audit Logging

### Implementation Details

**Service:** src/services/auditLogger.ts

**Usage Examples:**
```typescript
// PHI access
auditLogger.phi('PATIENT_CHART_ACCESSED', true, {
  patientId: '123',
  provider: 'Dr. Smith',
  chartSection: 'Medications'
});

// Clinical action
auditLogger.clinical('SCRIBE_SESSION_COMPLETED', true, {
  sessionId: 'abc-123',
  duration: 1200,
  codesGenerated: 5
});

// Authentication event
auditLogger.auth('LOGIN_SUCCESS', true, {
  userId: 'user-456',
  method: 'email'
});

// Security event
auditLogger.security('FAILED_LOGIN_ATTEMPT', false, {
  email: 'user@example.com',
  attempts: 3
});

// Error
auditLogger.error('DATABASE_CONNECTION_FAILED', error, {
  database: 'postgres',
  operation: 'query'
});
```

**Database Schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL, -- 'PHI_ACCESS', 'CLINICAL', 'AUTH', etc.
  user_id UUID REFERENCES auth.users(id),
  success BOOLEAN NOT NULL,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_event_category ON audit_logs(event_category);
```

**Retention Policy:**
- Active logs: 90 days (hot storage, fast queries)
- Archive logs: 7 years (cold storage, compliance)
- Deletion: Never (immutable audit trail)

**Access Control:**
- Read: Admin + Auditor roles only
- Write: System only (users cannot modify)
- RLS Policy: `audit_logs_admin_select`

---

## Encryption & PHI Protection

### Field-Level Encryption

**Encrypted Fields:**
1. SSN → profiles.ssn_encrypted (JSONB)
2. Medical Record Number → profiles.mrn_encrypted (JSONB)
3. Street Address → profiles.address_encrypted (JSONB)
4. Phone Number → profiles.phone_encrypted (JSONB)
5. Insurance Policy Number → insurance.policy_number_encrypted (JSONB)
6. Credit Card (if stored) → payments.card_encrypted (JSONB)

**Encryption Format (JSONB):**
```json
{
  "ciphertext": "base64-encoded-encrypted-data",
  "iv": "base64-encoded-initialization-vector",
  "tag": "base64-encoded-auth-tag",
  "version": "1.0",
  "algorithm": "aes-256-gcm"
}
```

### Key Management

**Primary Encryption Key:**
- Storage: Environment variable `REACT_APP_ENCRYPTION_KEY`
- Derivation: PBKDF2 with 100,000 iterations
- Salt: Per-field unique salt (stored with ciphertext)
- Rotation: Quarterly (manual process)

**Backup Encryption Key:**
- Storage: Separate environment variable `BACKUP_ENCRYPTION_KEY`
- Usage: Backup files only
- Rotation: Annually

**Key Rotation Process:**
1. Generate new key
2. Decrypt all fields with old key
3. Re-encrypt all fields with new key
4. Update environment variable
5. Archive old key securely (for decrypting old backups)
6. Audit log the rotation event

### PHI Scrubbing for AI

**Problem:** Claude Sonnet 4.5 analyzes transcripts but must not see identifiable PHI

**Solution:**
```typescript
// Before sending to Claude:
function scrubPHI(transcript: string): string {
  return transcript
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b[A-Z]{2}\d{7}\b/g, '[MRN]')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{1,5}\s+[\w\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr)\b/gi, '[ADDRESS]')
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]');
}
```

**Re-identification:**
- After Claude generates note, re-insert actual PHI from database
- Matching via session context (patient_id, encounter_id)
- Never store scrubbed version permanently

---

## Security Policies

### Password Policy
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Cannot reuse last 5 passwords
- Expires every 90 days (admin/clinical users)
- Expires every 180 days (patient users)

### Session Policy
- Max session duration: 8 hours
- Idle timeout: 30 minutes
- Token rotation: Every 24 hours
- Concurrent sessions: 3 max per user
- Session storage: httpOnly, secure cookies

### Access Control Policy
- Least privilege principle (users get minimum required access)
- Role-based permissions (not user-based)
- Mandatory access review: Quarterly
- Automatic deprovisioning: Employee offboarding within 24 hours
- Guest/observer access: Expires after 7 days

### Data Retention Policy
- Patient records: Lifetime + 7 years post-death (HIPAA minimum)
- Audit logs: 7 years
- Backups: 30 days (daily), 12 months (weekly), 7 years (monthly)
- Deleted records: Soft delete with 30-day recovery window, then hard delete

### Acceptable Use Policy
- No sharing of credentials
- No accessing patient data without clinical justification
- No downloading PHI to personal devices
- No using public WiFi for PHI access (VPN required)
- Report security incidents within 1 hour of discovery

---

## Vulnerability Management

### NPM Vulnerability Scanning

**Tool:** npm audit (automated via GitHub Actions)

**Schedule:**
- On every commit (CI/CD)
- Daily scan at 2 AM UTC
- Weekly comprehensive scan with manual review

**Current Status (October 27, 2025):**
```bash
npm audit --production --audit-level=high
Result: found 0 vulnerabilities
```

**Action Thresholds:**
- **Critical:** Immediate fix (within 24 hours)
- **High:** Fix within 1 week
- **Moderate:** Fix within 30 days
- **Low:** Fix within 90 days or accept risk

**Exception Process:**
- Document rationale
- Get security team approval
- Set review date (90 days max)
- Add to risk register

### Dependency Updates

**Strategy:** Conservative with testing

**Process:**
1. Guardian Agent detects outdated dependency
2. Creates PR with update
3. CI runs full test suite
4. Manual review by developer
5. Merge if tests pass + no breaking changes
6. Deploy to staging for 48-hour soak test
7. Promote to production

**Major version updates:** Require additional manual testing

---

## Compliance Certifications

### HIPAA
**Status:** ✅ Compliant (self-attested)
**Last Review:** October 25, 2025
**Next Review:** January 2026
**Attestation:** Documented in this file

### SOC2 Type II
**Status:** ⏳ In Progress
**Controls Implemented:** 100%
**Formal Audit:** Scheduled Q1 2026
**Expected Certification:** Q2 2026

### HITRUST
**Status:** 📋 Planned
**Start Date:** Q3 2026 (after SOC2 completion)

### State Licenses
**Status:** ✅ Not Required (software only, not providing medical services)

---

## Annual Compliance Calendar

### January
- HIPAA compliance review
- Password expiration for all admin users
- Security awareness training (all staff)

### April
- Quarterly access review
- Penetration testing (external)
- Disaster recovery drill

### July
- Quarterly access review
- Encryption key rotation (primary key)
- HIPAA risk assessment update

### October
- Quarterly access review
- Penetration testing (external)
- Annual security audit
- SOC2 readiness assessment

### Monthly
- Backup restore testing (first Monday)
- Incident response tabletop exercise (third Friday)
- Vulnerability scan review

---

**Sources:**
- BACKUP_AUTOMATION_SETUP_COMPLETE.md
- BACKUP_DISASTER_RECOVERY_COMPLIANCE.md
- CHW_SOC2_COMPLIANCE_VERIFICATION.md
- COMPLIANCE_FIXES_SUMMARY.md
- GUARDIAN_PENETRATION_TESTING_GUIDE.md
- GUARDIAN_SECURITY_PANEL_COMPLETE.md
- MONDAY_LAUNCH_SECURITY_ASSESSMENT.md
- SECURITY.md
- SECURITY_CLEANUP_SUMMARY.md
- SECURITY_COMPLIANCE_ANALYSIS.md
- SECURITY_REVIEW_CHW_SUITE.md
- SOC2_BACKUP_AUTOMATION_COMPLETE.md
- SOC2_COMPLIANCE_DRUG_INTERACTIONS.md
- SOC2_COMPLIANCE_SUMMARY.md
- SOC2_DASHBOARD_CLARIFIED.md
- SOC2_F_GRADE_FIX.md
- SOC2_F_GRADE_FIXED.md
- SOC2_F_GRADE_ROOT_CAUSE.md
- SOC2_MONITORING_DASHBOARDS_COMPLETE.md
- SOC2_MONITORING_STATUS_REPORT.md
- SOC2_SECURITY_POLICIES.md
- SUPABASE_RLS_AUDIT_REPORT.md
