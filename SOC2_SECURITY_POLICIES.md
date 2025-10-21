# SOC2 Security Policies & Procedures
## WellFit Community Health System

**Document Version:** 1.0
**Effective Date:** October 21, 2025
**Last Updated:** October 21, 2025
**Document Owner:** Chief Information Security Officer (CISO)
**Review Cycle:** Quarterly

---

## Table of Contents

1. [Access Control Policy](#1-access-control-policy)
2. [Multi-Factor Authentication Policy](#2-multi-factor-authentication-policy)
3. [Data Protection & Encryption Policy](#3-data-protection--encryption-policy)
4. [Audit Logging & Monitoring Policy](#4-audit-logging--monitoring-policy)
5. [Incident Response Plan](#5-incident-response-plan)
6. [Business Continuity & Disaster Recovery](#6-business-continuity--disaster-recovery)
7. [Vendor Management Policy](#7-vendor-management-policy)
8. [Change Management Policy](#8-change-management-policy)
9. [Security Awareness Training](#9-security-awareness-training)
10. [Compliance & Audit Policy](#10-compliance--audit-policy)

---

## 1. Access Control Policy

### 1.1 Purpose
To ensure that only authorized individuals have access to WellFit systems and protected health information (PHI) based on the principle of least privilege.

### 1.2 Scope
All employees, contractors, vendors, and third parties with access to WellFit systems.

### 1.3 Policy Statements

#### 1.3.1 Role-Based Access Control (RBAC)
- **Roles Defined:**
  - **Super Admin:** Full system access, user management, security configuration
  - **Admin:** User management, reporting, system configuration (limited)
  - **Physician:** Clinical data access, medical coding, prescriptions
  - **Nurse:** Patient care, handoffs, vital signs, medication administration
  - **Billing:** Claims, coding, revenue cycle management
  - **Case Manager:** Care coordination, discharge planning, CCM
  - **Patient:** Personal health data, self-check-ins, community features
  - **Caregiver:** Dependent patient data (with consent)

#### 1.3.2 Access Provisioning
- **New User Onboarding:**
  1. Manager submits access request via ticketing system
  2. HR verifies employment status and background check
  3. IT provisions account with appropriate role
  4. User completes security training (mandatory)
  5. User enables MFA within 7 days (grace period)
  6. Access logged in audit trail

- **Access Changes:**
  1. Manager submits change request
  2. IT reviews and approves
  3. Changes implemented within 24 hours
  4. User notified of changes
  5. Change logged in audit trail

- **Access Termination:**
  1. HR notifies IT of termination
  2. Access disabled within 1 hour
  3. All sessions terminated immediately
  4. User data retained per retention policy
  5. Termination logged in audit trail

#### 1.3.3 Password Requirements
- **Minimum length:** 12 characters
- **Complexity:** Must include uppercase, lowercase, number, special character
- **Expiration:** 90 days (admin/clinical), 180 days (non-clinical)
- **History:** Cannot reuse last 12 passwords
- **Lockout:** 5 failed attempts = 30-minute lockout
- **Storage:** Bcrypt hashed with salt (via Supabase Auth)

#### 1.3.4 Session Management
- **Timeout:** 30 minutes of inactivity (clinical users), 15 minutes (admin users)
- **Concurrent sessions:** Maximum 2 per user
- **Secure cookies:** HttpOnly, Secure, SameSite=Strict
- **Session expiry:** 12 hours maximum (re-authentication required)

#### 1.3.5 Privileged Access Management
- **Super Admin access:**
  - Limited to 2-3 individuals maximum
  - Requires MFA with hardware token (YubiKey preferred)
  - All actions logged and reviewed monthly
  - Break-glass procedures documented for emergencies

- **Database access:**
  - Production database access restricted to DBAs only
  - All queries logged with user attribution
  - No direct patient data queries (use views/functions)
  - Emergency read-only access requires approval

### 1.4 Access Review Process
- **Quarterly reviews:**
  - All user accounts reviewed by managers
  - Inactive accounts (90+ days) disabled
  - Role assignments verified against HR records
  - Excessive permissions identified and removed

- **Annual comprehensive audit:**
  - Third-party security firm reviews all access
  - Penetration testing conducted
  - Vulnerabilities remediated within SLA
  - Report provided to leadership

### 1.5 Compliance Metrics
- **Target:** 100% of users have appropriate role assignments
- **Target:** 0 orphaned accounts (former employees still active)
- **Target:** 100% MFA adoption for admin/clinical users
- **Target:** 95%+ quarterly access review completion rate

---

## 2. Multi-Factor Authentication Policy

### 2.1 Purpose
To add an additional layer of security beyond passwords to protect against unauthorized access and credential theft.

### 2.2 Scope
All users with access to PHI, billing data, or administrative functions.

### 2.3 Policy Statements

#### 2.3.1 MFA Requirements by Role
| Role | MFA Required | Grace Period | Enforcement Date |
|------|--------------|--------------|------------------|
| Super Admin | ✅ Mandatory | 7 days | Immediate |
| Admin | ✅ Mandatory | 7 days | Immediate |
| Physician | ✅ Mandatory | 7 days | Immediate |
| Nurse | ✅ Mandatory | 7 days | Immediate |
| Billing | ✅ Mandatory | 7 days | Immediate |
| Case Manager | ✅ Mandatory | 7 days | Immediate |
| Patient | ⚠️ Recommended | N/A | Optional |
| Caregiver | ⚠️ Recommended | N/A | Optional |

#### 2.3.2 Supported MFA Methods
1. **TOTP (Time-Based One-Time Password)** - Preferred
   - Google Authenticator
   - Authy
   - Microsoft Authenticator
   - 1Password

2. **SMS (Text Message)** - Allowed but discouraged
   - Vulnerable to SIM swapping
   - Use only if TOTP unavailable

3. **Email OTP** - Backup only
   - For account recovery
   - Not primary MFA method

4. **Hardware Tokens** - Super Admins only
   - YubiKey
   - Titan Security Key
   - Requires USB or NFC support

#### 2.3.3 MFA Enrollment Process
1. User receives MFA requirement notification upon login
2. User has 7-day grace period to enroll
3. During grace period, system displays daily reminder
4. On day 8, account locked until MFA enabled
5. User contacts IT for MFA setup assistance if needed
6. Backup codes generated and user instructed to save securely

#### 2.3.4 MFA Verification
- **Frequency:** Every login (no "remember this device")
- **Timeout:** 30 seconds to enter code
- **Failed attempts:** 3 failures = 15-minute lockout
- **Bypass:** Only via super admin approval (emergency only)

#### 2.3.5 MFA Recovery
- **Lost device procedure:**
  1. User contacts IT support
  2. Identity verified via security questions + manager confirmation
  3. MFA reset by super admin
  4. User required to re-enroll within 24 hours
  5. All sessions terminated
  6. Security event logged

- **Backup codes:**
  - 10 single-use backup codes generated at enrollment
  - User must store securely (password manager or secure location)
  - Used when primary device unavailable
  - New codes generated after 5 codes used

#### 2.3.6 MFA Exemptions
- **Criteria for exemption:**
  - Technical limitation (e.g., no mobile device)
  - Disability accommodation (ADA compliance)
  - Temporary exemption for testing (max 7 days)

- **Approval process:**
  1. User or manager submits exemption request
  2. CISO reviews and approves/denies
  3. If approved, compensating controls required (e.g., stronger password, more frequent changes)
  4. Exemption reviewed monthly
  5. All exemptions logged

### 2.4 Compliance Metrics
- **Target:** 100% MFA adoption for mandatory roles within 30 days
- **Target:** <1% MFA bypass events per month
- **Target:** <5% exemption rate
- **Current Status:** Grace period active (7 days from policy effective date)

---

## 3. Data Protection & Encryption Policy

### 3.1 Purpose
To protect sensitive data (PHI, PII, financial) from unauthorized access, disclosure, alteration, or destruction.

### 3.2 Scope
All data processed, stored, or transmitted by WellFit systems.

### 3.3 Policy Statements

#### 3.3.1 Data Classification
| Classification | Description | Examples | Protection Level |
|----------------|-------------|----------|------------------|
| **PHI** | Protected Health Information | Patient names, DOB, diagnoses, vitals | ⭐⭐⭐⭐⭐ Highest |
| **PII** | Personally Identifiable Information | SSN, address, phone | ⭐⭐⭐⭐⭐ Highest |
| **Financial** | Billing and payment data | Insurance, claims, payments | ⭐⭐⭐⭐ High |
| **Clinical** | Non-identifiable clinical data | Aggregate statistics, research data | ⭐⭐⭐ Medium |
| **Public** | Publicly available information | Marketing materials, blog posts | ⭐ Low |

#### 3.3.2 Encryption Standards

**Data at Rest:**
- **Database:** AES-256 encryption (Supabase default)
- **File storage:** AES-256 encryption
- **Backups:** AES-256 encryption with separate keys
- **Laptops/devices:** Full disk encryption (BitLocker/FileVault)
- **Key management:** AWS KMS or similar (keys rotated annually)

**Data in Transit:**
- **Web traffic:** TLS 1.3 minimum (HTTPS enforced)
- **API calls:** TLS 1.3 with certificate pinning
- **Database connections:** SSL/TLS encrypted
- **Email:** TLS enforced for PHI (encrypted email for sensitive data)
- **File transfers:** SFTP or HTTPS only (no FTP)

**Data in Use:**
- **Memory encryption:** Enabled on server VMs
- **Secure enclaves:** Used for cryptographic operations
- **RAM scrubbing:** On server decommissioning

#### 3.3.3 Data Access Controls
- **Row-Level Security (RLS):** Enabled on all database tables
- **Field-level encryption:** Social Security Numbers, credit cards
- **Tokenization:** Payment card data (PCI-DSS compliance)
- **Data masking:** PHI masked in logs and non-production environments
- **Audit logging:** All PHI access logged with user, timestamp, purpose

#### 3.3.4 Data Retention & Destruction

**Retention Periods:**
| Data Type | Retention Period | Regulatory Requirement |
|-----------|------------------|------------------------|
| Medical records | 7 years | HIPAA |
| Billing records | 10 years | IRS, CMS |
| Audit logs | 7 years | SOC2, HIPAA |
| Security logs | 2 years | SOC2 |
| Patient consent forms | Lifetime + 7 years | HIPAA |
| Employee records | Termination + 7 years | EEOC |

**Destruction Methods:**
- **Electronic data:** Secure wipe (DOD 5220.22-M standard) or cryptographic erasure
- **Databases:** DROP with VACUUM FULL + key destruction
- **Backups:** Overwrite 3 times + physical destruction
- **Hard drives:** Degaussing + physical shredding
- **Paper records:** Cross-cut shredding (1/32" particles)

#### 3.3.5 Data Loss Prevention (DLP)
- **Email DLP:** Prevent PHI in unencrypted emails
- **USB blocking:** Removable media disabled on workstations
- **Print controls:** PHI printing logged and restricted
- **Screen privacy:** Privacy filters on monitors in public areas
- **Clipboard monitoring:** PHI copy/paste alerts

### 3.4 Compliance Metrics
- **Target:** 100% of PHI encrypted at rest and in transit
- **Target:** 0 unencrypted PHI transmissions
- **Target:** 100% audit log coverage for PHI access
- **Target:** Data retention policy compliance >99%

---

## 4. Audit Logging & Monitoring Policy

### 4.1 Purpose
To maintain comprehensive audit trails for security events, PHI access, and system changes to support compliance and incident investigation.

### 4.2 Scope
All systems, applications, and infrastructure components.

### 4.3 Policy Statements

#### 4.3.1 Events Logged
**Security Events:**
- User authentication (success/failure)
- MFA verification (success/failure)
- Password changes/resets
- Account lockouts
- Privilege escalation
- Security policy violations

**PHI Access Events:**
- Patient record views (read)
- Patient record modifications (create/update/delete)
- Report generation with PHI
- Data exports containing PHI
- Prescription access
- Billing record access

**Administrative Events:**
- User account creation/modification/deletion
- Role changes
- Permission grants/revokes
- System configuration changes
- Database schema changes
- Backup/restore operations

**System Events:**
- Application errors/crashes
- Database connection failures
- API rate limit violations
- Unusual data access patterns
- Failed backups
- Performance anomalies

#### 4.3.2 Log Data Elements
Each log entry must include:
- **Timestamp:** ISO 8601 format with timezone
- **User ID:** UUID of user (or 'system' for automated)
- **User email:** For human readability
- **Event type:** Standardized category (e.g., 'phi_access')
- **Action:** Specific operation (e.g., 'read_patient_record')
- **Resource:** What was accessed (e.g., patient_id=123)
- **Result:** Success/failure
- **IP address:** Source IP of request
- **User agent:** Browser/app information
- **Session ID:** For correlation
- **Metadata:** Additional context (JSON)

#### 4.3.3 Log Storage & Retention
- **Storage:** Centralized logging system (Supabase database + Sentry)
- **Retention:** 7 years for audit logs, 2 years for system logs
- **Immutability:** Logs cannot be modified or deleted (append-only)
- **Encryption:** AES-256 at rest, TLS in transit
- **Backups:** Daily backups with 90-day retention
- **Archive:** Moved to cold storage after 1 year

#### 4.3.4 Log Monitoring & Alerting
**Real-Time Alerts (Slack/Email):**
- Multiple failed login attempts (5+ in 5 minutes)
- Successful login from new location
- MFA bypass attempts
- Privilege escalation
- Unusual PHI access (after-hours, bulk exports)
- Database schema changes
- Security event severity: CRITICAL or HIGH

**Daily Summary Reports:**
- Total logins by role
- Failed authentication attempts
- MFA adoption rate
- PHI access volume
- Security events by type
- System errors and warnings

**Weekly Security Review:**
- Access pattern analysis
- Anomaly detection results
- Failed MFA trends
- Privilege usage audit
- Dormant account identification

#### 4.3.5 Log Analysis & SIEM
- **Tools:** Sentry (error tracking), Supabase Dashboard (query logs)
- **Correlation:** Link related events across systems
- **Anomaly detection:** Machine learning for unusual patterns
- **Threat intelligence:** Integration with known threat databases
- **Forensics:** Log export for incident investigation

### 4.4 Compliance Metrics
- **Target:** 100% of required events logged
- **Target:** <1 hour log processing delay
- **Target:** 99.9% log availability
- **Target:** 0 log tampering incidents

---

## 5. Incident Response Plan

### 5.1 Purpose
To establish procedures for detecting, responding to, and recovering from security incidents.

### 5.2 Scope
All security incidents affecting WellFit systems, data, or operations.

### 5.3 Incident Classification

| Severity | Definition | Examples | Response Time |
|----------|------------|----------|---------------|
| **P0 - CRITICAL** | Active data breach, ransomware, complete system outage | PHI exposed publicly, database encrypted, all systems down | < 15 minutes |
| **P1 - HIGH** | Potential breach, significant unauthorized access | Admin account compromised, SQL injection detected | < 1 hour |
| **P2 - MEDIUM** | Security vulnerability, suspicious activity | Unpatched critical CVE, unusual login patterns | < 4 hours |
| **P3 - LOW** | Policy violation, minor security issue | Password policy not followed, failed audit | < 24 hours |

### 5.4 Incident Response Team

**Core Team:**
- **Incident Commander:** CTO or CISO (P0/P1), IT Manager (P2/P3)
- **Technical Lead:** Senior DevOps Engineer
- **Security Analyst:** Information Security Specialist
- **Legal Counsel:** Healthcare Attorney (PHI breaches only)
- **Communications:** PR/Marketing Director (public disclosure)
- **Compliance Officer:** HIPAA Compliance Officer (PHI breaches)

**On-Call Rotation:**
- Primary: 24/7 on-call (weekly rotation)
- Secondary: Backup on-call
- Escalation: CTO/CISO for P0/P1

### 5.5 Incident Response Phases

#### Phase 1: Detection & Analysis (Identify)
1. **Alert received** via monitoring system or user report
2. **Initial triage** - Verify incident is real (not false positive)
3. **Severity assessment** - Assign P0/P1/P2/P3
4. **Team assembly** - Page on-call team based on severity
5. **Create incident ticket** - Document in incident management system
6. **Start timer** - Track response time SLA

**Tools:**
- Monitoring: Supabase Dashboard, Sentry
- Alerting: Slack, PagerDuty, Email
- Ticketing: GitHub Issues (label: `incident`)
- War room: Slack channel (#incident-YYYY-MM-DD)

#### Phase 2: Containment (Contain)
1. **Isolate affected systems** - Prevent spread
   - Disable compromised accounts
   - Block malicious IPs at firewall
   - Take affected servers offline (if necessary)
   - Revoke API keys/tokens

2. **Preserve evidence** - For forensic analysis
   - Snapshot affected systems
   - Export relevant logs
   - Document state before changes
   - Chain of custody maintained

3. **Short-term containment** - Immediate mitigation
   - Apply temporary patches/rules
   - Implement workarounds
   - Restore from clean backup (if ransomware)

4. **Long-term containment** - Sustainable solution
   - Rebuild affected systems from scratch
   - Apply permanent fixes
   - Update security controls

#### Phase 3: Eradication (Eliminate)
1. **Root cause analysis** - Determine how breach occurred
2. **Remove threat** - Delete malware, close vulnerabilities
3. **Verify clean state** - Scan for persistence mechanisms
4. **Patch vulnerabilities** - Fix underlying issues
5. **Review access** - Revoke excessive permissions

#### Phase 4: Recovery (Restore)
1. **Restore systems** - Bring affected services back online
2. **Monitor closely** - Watch for recurring issues
3. **Gradual rollout** - Phased restoration (not all at once)
4. **User communication** - Notify affected users
5. **Verify functionality** - Test all systems operational

#### Phase 5: Lessons Learned (Learn)
1. **Post-incident review** - Within 72 hours of resolution
2. **Root cause documentation** - What happened and why
3. **Timeline reconstruction** - Detailed sequence of events
4. **Impact assessment** - Scope of data/systems affected
5. **Improvement plan** - Prevent recurrence
6. **Update runbooks** - Document new procedures
7. **Training** - Share learnings with team

### 5.6 Breach Notification Requirements

**HIPAA Breach Notification Rule:**
- **Affected individuals:** Notify within 60 days of discovery
- **HHS (OCR):** Notify within 60 days if >500 individuals
- **Media:** Notify prominent media outlets if >500 individuals in a state
- **Business associates:** Notify within 60 days

**State Laws:**
- **California (CCPA):** Notify without unreasonable delay
- **Other states:** Vary by state, consult legal counsel

**Content of Notification:**
- Description of breach
- Types of PHI involved
- Steps individuals should take
- What WellFit is doing
- Contact information

### 5.7 Incident Response Metrics
- **Target:** P0 response time <15 minutes
- **Target:** P1 response time <1 hour
- **Target:** 100% post-incident reviews completed
- **Target:** 0 repeat incidents from same root cause

---

## 6. Business Continuity & Disaster Recovery

### 6.1 Purpose
To ensure WellFit can continue operations and recover quickly from disruptions.

### 6.2 Scope
All critical business functions and IT systems.

### 6.3 Business Impact Analysis

| System/Function | RTO* | RPO** | Criticality | Backup Frequency |
|-----------------|------|-------|-------------|------------------|
| Patient Portal | 4 hours | 15 minutes | CRITICAL | Continuous |
| Physician Dashboard | 4 hours | 15 minutes | CRITICAL | Continuous |
| Nurse Handoff System | 2 hours | 5 minutes | CRITICAL | Continuous |
| Billing System | 8 hours | 1 hour | HIGH | Hourly |
| Admin Panel | 24 hours | 4 hours | MEDIUM | Daily |
| Reporting | 48 hours | 24 hours | LOW | Daily |

*RTO = Recovery Time Objective (max downtime)
**RPO = Recovery Point Objective (max data loss)

### 6.4 Backup Strategy

**Database Backups:**
- **Frequency:** Continuous (Point-in-Time Recovery)
- **Retention:**
  - Daily backups: 30 days
  - Weekly backups: 90 days
  - Monthly backups: 1 year
- **Storage:** Supabase automatic backups + manual exports to S3
- **Encryption:** AES-256 with separate keys
- **Testing:** Monthly restore tests (alternating systems)

**Application Code:**
- **Frequency:** Every git commit
- **Retention:** Indefinite (Git history)
- **Storage:** GitHub (primary), GitLab (mirror)
- **Disaster recovery:** Can redeploy from any commit

**Configuration:**
- **Frequency:** On change
- **Retention:** Version controlled
- **Storage:** Git repository (encrypted secrets)
- **Disaster recovery:** Infrastructure as Code (Terraform)

### 6.5 Disaster Scenarios

**Scenario 1: Database Corruption**
1. Detect via monitoring or user reports
2. Stop writes to affected database
3. Assess scope of corruption
4. Restore from last known good backup
5. Replay transaction logs (if available)
6. Verify data integrity
7. Resume operations
8. **Estimated RTO:** 2-4 hours

**Scenario 2: Supabase Outage**
1. Confirm outage via status page
2. Activate read-only mode (if possible)
3. Communicate with users
4. Monitor Supabase status
5. Resume when restored
6. **Estimated RTO:** Dependent on Supabase (historical 99.9% uptime)

**Scenario 3: Ransomware Attack**
1. Isolate infected systems immediately
2. Do NOT pay ransom (policy)
3. Identify patient zero
4. Restore from clean offline backups
5. Rebuild infected systems from scratch
6. Apply security patches
7. Conduct forensic analysis
8. **Estimated RTO:** 8-24 hours

**Scenario 4: Natural Disaster (Datacenter)**
1. Supabase auto-failover to different region
2. Update DNS if manual failover needed
3. Verify all systems operational
4. Monitor closely
5. **Estimated RTO:** <1 hour (Supabase handles)

### 6.6 Backup Verification

**Automated Testing:**
- Daily: Verify backups completed successfully
- Weekly: Automated restore to test environment
- Monthly: Full restore drill with timing

**Manual Testing:**
- Quarterly: Restore production backup to staging
- Annually: Full disaster recovery simulation

**Success Criteria:**
- Backup completes without errors
- Restored data matches original
- Restore time within RTO
- All functionality works after restore

### 6.7 Communication Plan

**Internal:**
- Incident Commander leads communication
- Slack #incidents channel for real-time updates
- Email to all staff on major incidents
- Daily standups during prolonged outages

**External:**
- Status page (status.wellfit.com) updated
- Patient notifications via email/SMS
- Hospital partners notified via phone
- Media relations (if public disclosure needed)

**Templates:**
- Initial notification (incident detected)
- Progress updates (every 2-4 hours)
- Resolution notification (incident closed)
- Post-mortem summary (24-72 hours after)

### 6.8 Recovery Procedures

**Database Recovery:**
```sql
-- Restore from Point-in-Time
-- Supabase Dashboard → Database → Backups → Restore

-- Verify data integrity
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM fhir_observations;

-- Check for missing recent data
SELECT MAX(created_at) FROM profiles;
```

**Application Recovery:**
```bash
# Redeploy from known good commit
git checkout <commit-hash>
npm run build
npx supabase functions deploy --all

# Verify deployment
curl https://app.wellfit.com/health
```

### 6.9 Compliance Metrics
- **Target:** 99.9% uptime (43 minutes downtime/month)
- **Target:** 100% backup success rate
- **Target:** <4 hour RTO for critical systems
- **Target:** <15 minute RPO for critical data

---

## 7. Vendor Management Policy

### 7.1 Purpose
To ensure third-party vendors meet WellFit security and compliance standards.

### 7.2 Critical Vendors

| Vendor | Service | Risk Level | Contract Type | SOC2/HIPAA |
|--------|---------|------------|---------------|------------|
| **Supabase** | Database, Auth, Storage | CRITICAL | BAA Signed | SOC2 Type II |
| **Anthropic** | AI/ML (Claude API) | HIGH | BAA Required | In Progress |
| **Twilio** | SMS/Voice | MEDIUM | BAA Signed | HIPAA Compliant |
| **Stripe** | Payment Processing | HIGH | PCI-DSS | Level 1 Certified |
| **Sentry** | Error Tracking | MEDIUM | DPA Signed | SOC2 Type II |
| **GitHub** | Code Hosting | MEDIUM | Standard Terms | SOC2 Type II |
| **Vercel** | Hosting (Frontend) | HIGH | Standard Terms | ISO 27001 |

### 7.3 Vendor Assessment Process

**Pre-Engagement:**
1. Security questionnaire (SIG Lite)
2. SOC2 report review
3. BAA negotiation (if PHI involved)
4. Contract review by legal
5. Risk assessment scoring
6. Executive approval

**Ongoing:**
- Annual SOC2 report refresh
- Quarterly security reviews
- Contract renewal assessment
- Incident notification monitoring

**Criteria for Approval:**
- SOC2 Type II report (within 12 months)
- HIPAA BAA (if PHI)
- Insurance: Cyber liability $5M+
- SLA: 99.9% uptime minimum
- Security: Encryption, MFA, audit logs
- Support: 24/7 for critical vendors

### 7.4 Data Sharing with Vendors

**PHI Sharing Rules:**
- Minimum necessary standard
- BAA must be signed before sharing
- Data use limited to specified purpose
- Audit vendor access annually
- Vendor must report breaches within 24 hours

**Non-PHI Data:**
- De-identified data for analytics
- Aggregate statistics for research
- Error logs (scrubbed of PHI)

### 7.5 Vendor Offboarding
1. Terminate access immediately
2. Delete all WellFit data (verify)
3. Return or destroy PHI (certificate)
4. Remove from systems
5. Update documentation

---

## 8. Change Management Policy

### 8.1 Purpose
To ensure system changes are planned, tested, and approved to minimize risk.

### 8.2 Change Categories

| Category | Examples | Approval Required | Testing Required |
|----------|----------|-------------------|------------------|
| **Standard** | Code deploy, config change | Tech Lead | Staging test |
| **Emergency** | Security patch, outage fix | CTO (post-facto) | Minimal |
| **Major** | Database migration, architecture change | CTO + CISO | Full UAT |

### 8.3 Change Process
1. **Request:** GitHub Issue created
2. **Review:** Tech Lead approval
3. **Test:** Staging environment
4. **Schedule:** Maintenance window (if needed)
5. **Deploy:** Follow runbook
6. **Verify:** Smoke tests pass
7. **Document:** Update CHANGELOG
8. **Close:** Mark issue complete

### 8.4 Rollback Plan
- Every change must have rollback steps
- Rollback tested in staging
- Trigger: >5% error rate increase
- Execute: Within 15 minutes of detection

---

## 9. Security Awareness Training

### 9.1 Purpose
To educate employees on security best practices and compliance requirements.

### 9.2 Training Requirements

**New Hire Training (Day 1):**
- HIPAA basics
- Password policy
- MFA enrollment
- Phishing awareness
- Incident reporting
- Acceptable use policy

**Annual Refresher (All Staff):**
- HIPAA updates
- Recent breaches (lessons learned)
- New threats (ransomware, etc.)
- Policy changes
- Quiz (80% pass required)

**Role-Specific Training:**
- Developers: Secure coding, OWASP Top 10
- Admins: Privilege management, audit review
- Clinical: PHI handling, minimum necessary

### 9.3 Simulated Phishing
- Monthly phishing tests
- Click rate target: <5%
- Mandatory training if clicked
- No punishment, education focus

### 9.4 Metrics
- **Target:** 100% training completion within 30 days
- **Target:** <5% phishing click rate
- **Target:** 80%+ quiz pass rate (first attempt)

---

## 10. Compliance & Audit Policy

### 10.1 Internal Audits
- **Frequency:** Quarterly
- **Scope:** Access controls, logs, backups
- **Owner:** Compliance Officer
- **Remediation:** 30 days for findings

### 10.2 External Audits
- **SOC2 Type II:** Annual audit by CPA firm
- **HIPAA:** Risk assessment annually
- **Penetration Testing:** Annual by third party

### 10.3 Audit Trail
- All audits documented
- Findings tracked to closure
- Evidence retained 7 years
- Results reported to leadership

---

## Document Control

**Approval:**
- CISO: _____________________ Date: _____
- CTO: _____________________ Date: _____
- CEO: _____________________ Date: _____

**Review History:**
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-21 | Initial version | CISO |

**Next Review Date:** 2026-01-21 (Quarterly)
