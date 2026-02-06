# HIPAA Security Risk Assessment

**Envision Virtual Edge Group LLC**
**Assessment Date:** February 6, 2026
**Assessor:** Engineering Team
**HIPAA Reference:** 45 CFR 164.308(a)(1)(ii)(A)
**Next Assessment:** August 6, 2026

---

## Scope

This assessment covers the WellFit Community and Envision Atlus platforms, including:
- Frontend application (React 19 / Vite / Vercel)
- Backend services (Supabase Edge Functions / Deno)
- Database (PostgreSQL 17 via Supabase)
- 10 MCP servers (FHIR, HL7, NPI, CMS, Clearinghouse, Prior Auth, Claude)
- 40+ AI-powered clinical services (Anthropic Claude)
- External integrations (Twilio, MailerSend, clearinghouses, FHIR endpoints)

---

## Assessment Summary

| Category | Status | Score |
|----------|--------|-------|
| Administrative Safeguards | Implemented | 8/10 |
| Physical Safeguards | Delegated to Supabase/Vercel | 7/10 |
| Technical Safeguards | Implemented | 9/10 |
| **Overall Risk Level** | **LOW-MODERATE** | **8/10** |

---

## Administrative Safeguards (45 CFR 164.308)

### 164.308(a)(1) - Security Management Process

| Control | Status | Evidence |
|---------|--------|----------|
| Risk assessment conducted | Implemented | This document |
| Risk management policy | Implemented | CLAUDE.md governance + SECURITY.md |
| Sanction policy | Partial | No formal written sanction policy |
| Information system activity review | Implemented | `staff_audit_log`, `admin_audit_log`, SOC 2 monitoring views |

**Risk: Formal sanction policy not documented.**
- Likelihood: Low
- Impact: Medium
- Mitigation: Document formal sanction policy for workforce violations

### 164.308(a)(3) - Workforce Security

| Control | Status | Evidence |
|---------|--------|----------|
| Authorization procedures | Implemented | Role-based access via `user_roles` table, deny-by-default |
| Workforce clearance | Partial | No formal background check policy documented |
| Termination procedures | Implemented | Supabase Auth account disable, role revocation |

### 164.308(a)(4) - Information Access Management

| Control | Status | Evidence |
|---------|--------|----------|
| Access authorization | Implemented | 25 role codes, RLS policies, department scoping |
| Access establishment/modification | Implemented | `user_roles` table, service-role-only modification |
| Access review | Implemented | Quarterly review schedule in Access Control Matrix |

### 164.308(a)(5) - Security Awareness and Training

| Control | Status | Evidence |
|---------|--------|----------|
| Security reminders | Implemented | CLAUDE.md rules, PreToolUse hooks, CONTRIBUTING.md |
| Malicious software protection | Implemented | CSP headers, input sanitization (DOMPurify), hCaptcha |
| Login monitoring | Implemented | `staff_auth_attempts` table with IP, user agent, timestamps |
| Password management | Implemented | Supabase Auth with complexity requirements |

### 164.308(a)(6) - Security Incident Procedures

| Control | Status | Evidence |
|---------|--------|----------|
| Incident response plan | Implemented | SECURITY.md: P0-P3 classification, response actions, timelines |
| Incident reporting | Implemented | security@thewellfitcommunity.org, 24-hour acknowledgment SLA |
| Incident documentation | Partial | No formal incident log template |

### 164.308(a)(7) - Contingency Plan

| Control | Status | Evidence |
|---------|--------|----------|
| Data backup plan | Implemented | Supabase automated daily backups, 30-day retention, PITR |
| Disaster recovery plan | Not documented | Supabase handles infrastructure, but no formal DR document |
| Emergency mode operation | Implemented | Offline PWA mode for rural/disconnected scenarios |
| Testing and revision | Partial | No documented backup restoration test schedule |

**Risk: No formal disaster recovery plan documented.**
- Likelihood: Low (Supabase SLA covers infrastructure)
- Impact: High
- Mitigation: Create DR plan documenting Supabase recovery procedures and RTO/RPO targets

### 164.308(b)(1) - Business Associate Contracts

| Business Associate | BAA Status | Service |
|-------------------|:----------:|---------|
| Supabase Inc. | Signed | Database, Auth, Edge Functions |
| Anthropic PBC | Pending verification | AI clinical services |
| Twilio Inc. | Signed (HIPAA eligible) | SMS delivery |
| MailerSend | Needs verification | Email delivery |
| Vercel Inc. | N/A (no PHI processed) | CDN / hosting |

**Risk: Anthropic BAA not confirmed active.**
- Likelihood: Medium
- Impact: High (AI services process redacted clinical context)
- Mitigation: Verify Anthropic BAA is configured; PHI redaction applied as defense-in-depth

---

## Physical Safeguards (45 CFR 164.310)

All physical safeguards are delegated to infrastructure providers:

| Control | Provider | Status |
|---------|----------|--------|
| Facility access controls | Supabase (AWS) | SOC 2 Type II certified |
| Workstation use | End-user responsibility | Device policy in HIPAA compliance doc |
| Workstation security | End-user responsibility | Encryption + passcode required |
| Device and media controls | Supabase (AWS) | Encrypted storage, secure disposal |

**Risk: End-user device security depends on organizational policy enforcement.**
- Likelihood: Medium
- Impact: Medium
- Mitigation: Offline mode auto-deletes after sync; session timeout enforced; device encryption required

---

## Technical Safeguards (45 CFR 164.312)

### 164.312(a)(1) - Access Control

| Control | Status | Evidence |
|---------|--------|----------|
| Unique user identification | Implemented | Supabase Auth UUID per user |
| Emergency access procedure | Implemented | `super_admin` role, service role key |
| Automatic logoff | Implemented | Session timeout, 30-min caregiver timeout |
| Encryption and decryption | Implemented | 7 application-layer encrypted PHI fields + AES-256 at rest |

**Strength:** 2,037 RLS policies across 720+ tables. Deny-by-default role authority.

### 164.312(b) - Audit Controls

| Control | Status | Evidence |
|---------|--------|----------|
| Audit logging | Implemented | 150 services instrumented with `auditLogger` |
| PHI access logging | Implemented | Caregiver access trail, clinical data access logged |
| AI operation logging | Implemented | `claude_usage_logs` tracks all AI calls with tokens/cost |
| Log retention | Implemented | 7-year retention policy |

**Strength:** Zero `console.log` in production (enforced by lint + hooks). All logging via audit system.

### 164.312(c)(1) - Integrity

| Control | Status | Evidence |
|---------|--------|----------|
| Data integrity mechanisms | Implemented | Foreign key constraints, check constraints on vitals |
| Type safety | Implemented | Zero `any` types, zero lint warnings, 7,490 tests |
| Input validation | Implemented | DOMPurify, Zod schemas, E.164 phone validation |

### 164.312(d) - Person or Entity Authentication

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication method | Implemented | Supabase Auth (JWT), phone verification, hCaptcha |
| Staff authentication | Implemented | Password + PIN (two-factor for admin roles) |
| Caregiver authentication | Implemented | PIN-based with 30-minute session |
| Token management | Implemented | JWT with expiration, refresh token rotation |

### 164.312(e)(1) - Transmission Security

| Control | Status | Evidence |
|---------|--------|----------|
| Encryption in transit | Implemented | HTTPS / TLS 1.3 enforced on all connections |
| CORS security | Implemented | Explicit `ALLOWED_ORIGINS`, zero wildcards (verified by scan) |
| CSP headers | Implemented | Content Security Policy on all responses |
| API security | Implemented | Rate limiting on MCP servers, API key required |

**Strength:** Latest security scan (Feb 3, 2026) shows zero CORS violations, zero exposed credentials, zero PHI in logs.

---

## Risk Register

| ID | Risk | Likelihood | Impact | Level | Mitigation | Status |
|----|------|:----------:|:------:|:-----:|-----------|--------|
| R1 | Anthropic BAA not confirmed | Medium | High | **HIGH** | Verify BAA; PHI redaction as defense-in-depth | Open |
| R2 | No formal DR plan document | Low | High | **MEDIUM** | Document Supabase recovery procedures, RTO/RPO | Open |
| R3 | MailerSend BAA not confirmed | Medium | Low | **MEDIUM** | Verify BAA; no PHI in email bodies currently | Open |
| R4 | No formal sanction policy | Low | Medium | **LOW** | Draft workforce sanction policy | Open |
| R5 | End-user device security | Medium | Medium | **MEDIUM** | Device policy exists; offline auto-delete mitigates | Mitigated |
| R6 | No penetration test on record | Medium | Medium | **MEDIUM** | Schedule annual pen test | Open |
| R7 | FHIR backend SOC2 gaps | Low | High | **MEDIUM** | 11 critical findings from Jan 2026 audit - remediation in progress | In Progress |
| R8 | No formal backup restore testing | Low | High | **MEDIUM** | Schedule quarterly backup restoration test | Open |

---

## Remediation Plan

| Priority | Risk ID | Action | Owner | Target Date |
|----------|---------|--------|-------|-------------|
| 1 | R1 | Verify Anthropic BAA is active | Maria | March 2026 |
| 2 | R3 | Verify MailerSend BAA or switch to HIPAA-compliant provider | Maria | March 2026 |
| 3 | R2 | Document disaster recovery plan with RTO/RPO | Engineering | April 2026 |
| 4 | R7 | Complete FHIR backend SOC2 remediation | Engineering | April 2026 |
| 5 | R6 | Schedule penetration test | Maria | Q2 2026 |
| 6 | R8 | Conduct first backup restoration test | Engineering | Q2 2026 |
| 7 | R4 | Draft formal workforce sanction policy | Maria | Q2 2026 |

---

## Assessment Methodology

This assessment was conducted by:
1. Reviewing all database migrations for RLS policies and encryption
2. Analyzing Edge Function source code for PHI handling
3. Reviewing existing compliance documentation (HIPAA compliance doc, SOC2 audit, security scans)
4. Mapping data flows from entry to storage to external transmission
5. Evaluating BAA status with all business associates
6. Cross-referencing against HIPAA Security Rule requirements (45 CFR 164.308-312)

### Documents Reviewed
- `docs/clinical/HIPAA_COMPLIANCE.md`
- `docs/compliance/COMPLIANCE_STATUS_CURRENT.md`
- `docs/compliance/SOC2_FHIR_COMPLIANCE_AUDIT.md`
- `docs/security/MULTI_TENANT_SECURITY_ANALYSIS.md`
- `docs/clinical/HIPAA_SECURITY_SCAN_2026-02-03.md`
- `SECURITY.md`
- Database migration files (RLS policies, encryption triggers)
- Edge Function source code (PHI handling, audit logging)

---

## Signatures

| Role | Name | Date |
|------|------|------|
| Security Officer | _________________ | ________ |
| Compliance Officer | _________________ | ________ |
| Clinical Director | _________________ | ________ |

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
