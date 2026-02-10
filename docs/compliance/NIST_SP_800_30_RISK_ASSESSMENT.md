# NIST SP 800-30 Risk Assessment

**Envision Virtual Edge Group LLC**
**Assessment Date:** February 10, 2026
**Methodology:** NIST SP 800-30 Rev. 1 — Guide for Conducting Risk Assessments
**HIPAA Reference:** 45 CFR 164.308(a)(1)(ii)(A)
**Assessor:** Engineering Team with AI-assisted analysis
**Next Assessment:** August 10, 2026 (semi-annual)

---

## 1. System Characterization

### 1.1 System Overview

The Envision Atlus Intelligent Healthcare Interoperability System (I.H.I.S.) consists of two white-label products:

| Product | Purpose | Users |
|---------|---------|-------|
| **WellFit** | Community wellness engagement | Seniors, caregivers, community orgs |
| **Envision Atlus** | Clinical care management | Physicians, nurses, clinical staff |

### 1.2 System Architecture

| Component | Technology | Environment |
|-----------|-----------|-------------|
| Frontend | React 19, Vite, TypeScript | Vercel CDN |
| Backend | Supabase Edge Functions (Deno) | Supabase Cloud (AWS) |
| Database | PostgreSQL 17 | Supabase (AWS us-east-1) |
| AI Services | Anthropic Claude API | Anthropic Cloud |
| Interoperability | 10 MCP servers (FHIR, HL7, NPI, etc.) | Local/Cloud |
| Messaging | Twilio (SMS), MailerSend (email) | Third-party SaaS |

### 1.3 ePHI Scope

**ePHI stored in system (14 categories):**
- Patient demographics (name, DOB, phone, email, address)
- Vital signs (BP, HR, SpO2, glucose)
- Medical conditions, medications, allergies
- Lab results and diagnostic reports
- Care plans and risk assessments
- Clinical notes (SOAP, progress, discharge)
- Dental records
- EHR integration credentials (encrypted)

**ePHI data flow:** See `docs/compliance/PHI_DATA_FLOW.md` for complete entry-processing-storage-transmission diagram.

### 1.4 System Boundaries

| Boundary | Description |
|----------|-------------|
| External interfaces | FHIR R4, HL7 v2.x, clearinghouse (X12 837P/837I), Anthropic API |
| Authentication boundary | Supabase Auth (JWT), PIN sessions, TOTP |
| Tenant boundary | RLS policies with `tenant_id` isolation (2,037 policies) |
| Network boundary | HTTPS/TLS 1.3 on all connections |

---

## 2. Threat Identification

### 2.1 Threat Sources

| ID | Threat Source | Type | Capability | Motivation |
|----|-------------|------|-----------|------------|
| TS-1 | External attackers | Adversarial | High | Financial gain, data theft |
| TS-2 | Disgruntled employees | Adversarial | Moderate | Revenge, financial gain |
| TS-3 | Nation-state actors | Adversarial | Very High | Espionage, disruption |
| TS-4 | Opportunistic hackers | Adversarial | Low-Moderate | Curiosity, credential stuffing |
| TS-5 | Business associates | Adversarial/Accidental | Moderate | Negligence, data mishandling |
| TS-6 | Natural disasters | Environmental | N/A | N/A |
| TS-7 | Power/infrastructure failure | Environmental | N/A | N/A |
| TS-8 | Software defects | Accidental | N/A | N/A |
| TS-9 | Human error (staff) | Accidental | N/A | N/A |
| TS-10 | Human error (patients) | Accidental | N/A | N/A |

### 2.2 Threat Events

| ID | Threat Event | Source | Likelihood |
|----|-------------|--------|-----------|
| TE-1 | SQL injection against database | TS-1, TS-4 | Low |
| TE-2 | Cross-site scripting (XSS) | TS-1, TS-4 | Low |
| TE-3 | Credential stuffing/brute force | TS-1, TS-4 | Moderate |
| TE-4 | Insider unauthorized PHI access | TS-2 | Low |
| TE-5 | Ransomware deployment | TS-1, TS-3 | Low |
| TE-6 | Business associate data breach | TS-5 | Low |
| TE-7 | Natural disaster (AWS region failure) | TS-6 | Very Low |
| TE-8 | Misconfigured RLS policies | TS-8 | Low |
| TE-9 | Accidental PHI disclosure (email/screen) | TS-9 | Moderate |
| TE-10 | Session hijacking | TS-1 | Low |
| TE-11 | API key exposure | TS-8, TS-9 | Low |
| TE-12 | CORS/CSP bypass | TS-1 | Very Low |
| TE-13 | AI model data leakage | TS-5 | Very Low |
| TE-14 | Phishing against clinical staff | TS-1 | Moderate |
| TE-15 | Unpatched dependency vulnerability | TS-8 | Low |
| TE-16 | Clearinghouse transmission intercept | TS-1 | Very Low |
| TE-17 | Mobile device loss/theft | TS-10 | Moderate |
| TE-18 | Backup data exposure | TS-1 | Very Low |

---

## 3. Vulnerability Analysis

### 3.1 Vulnerability-to-Control Mapping

| Vuln ID | Vulnerability | Existing Controls | Residual Risk |
|---------|-------------|-------------------|--------------|
| V-1 | SQL injection | Supabase parameterized queries, RLS, no raw SQL in app | Very Low |
| V-2 | XSS attacks | DOMPurify sanitization, CSP headers, React auto-escaping | Very Low |
| V-3 | Weak authentication | JWT + PIN two-factor, hCaptcha, account lockout, TOTP for clinical | Low |
| V-4 | Excessive privileges | 25 role codes, deny-by-default, RLS on all tables, role-based views | Low |
| V-5 | Unencrypted data at rest | AES-256 Supabase encryption + 7 application-layer encrypted PHI fields | Very Low |
| V-6 | Unencrypted data in transit | HTTPS/TLS 1.3 enforced on all connections, no HTTP | Very Low |
| V-7 | Insufficient audit logging | 150 services instrumented with `auditLogger`, PHI access logged, 7-year retention | Very Low |
| V-8 | CORS misconfiguration | Explicit `ALLOWED_ORIGINS` (zero wildcards, verified by automated scan) | Very Low |
| V-9 | Session management | JWT expiration, refresh token rotation, 15-min idle timeout, 30-min caregiver session | Low |
| V-10 | Dependency vulnerabilities | Automated dependency updates, npm audit | Low |
| V-11 | AI PHI leakage | PHI redaction strips 8 identifiers before API call; Anthropic no-training policy | Very Low |
| V-12 | Cross-tenant data leak | `tenant_id` on all queries, RLS enforcement, 2,037 policies | Very Low |
| V-13 | Backup security | Supabase encrypted backups, 30-day retention, PITR | Low |
| V-14 | Offline data exposure | IndexedDB encryption (device-level), auto-delete after sync, session timeout | Low |
| V-15 | API key management | Environment variables (not in code), Supabase key rotation support | Low |

---

## 4. Risk Determination

### 4.1 Risk Level Matrix

| | **Very Low Impact** | **Low Impact** | **Moderate Impact** | **High Impact** | **Very High Impact** |
|---|:---:|:---:|:---:|:---:|:---:|
| **Very High Likelihood** | Low | Moderate | High | Very High | Very High |
| **High Likelihood** | Low | Moderate | High | High | Very High |
| **Moderate Likelihood** | Low | Low | Moderate | High | High |
| **Low Likelihood** | Very Low | Low | Low | Moderate | High |
| **Very Low Likelihood** | Very Low | Very Low | Low | Low | Moderate |

### 4.2 Risk Register

| Risk ID | Threat Event | Vulnerability | Likelihood | Impact | Risk Level | Status |
|---------|-------------|---------------|:----------:|:------:|:----------:|--------|
| R-1 | TE-1 SQL injection | V-1 | Very Low | High | **Low** | Mitigated |
| R-2 | TE-2 XSS | V-2 | Very Low | Moderate | **Low** | Mitigated |
| R-3 | TE-3 Credential stuffing | V-3 | Moderate | Moderate | **Moderate** | Mitigated |
| R-4 | TE-4 Insider PHI access | V-4, V-7 | Low | High | **Moderate** | Mitigated |
| R-5 | TE-5 Ransomware | V-5, V-13 | Low | Very High | **High** | Partially mitigated |
| R-6 | TE-6 BA data breach | V-11 | Low | High | **Moderate** | Mitigated |
| R-7 | TE-7 Regional failure | V-13 | Very Low | Very High | **Low** | Mitigated (DR plan) |
| R-8 | TE-8 RLS misconfiguration | V-12 | Low | High | **Moderate** | Mitigated |
| R-9 | TE-9 Accidental PHI disclosure | V-7 | Moderate | Moderate | **Moderate** | Partially mitigated |
| R-10 | TE-10 Session hijacking | V-9 | Low | Moderate | **Low** | Mitigated |
| R-11 | TE-11 API key exposure | V-15 | Low | High | **Moderate** | Mitigated |
| R-12 | TE-13 AI data leakage | V-11 | Very Low | High | **Low** | Mitigated |
| R-13 | TE-14 Phishing | V-3 | Moderate | High | **High** | Partially mitigated |
| R-14 | TE-15 Dependency vuln | V-10 | Low | Moderate | **Low** | Mitigated |
| R-15 | TE-17 Device loss/theft | V-14 | Moderate | Moderate | **Moderate** | Mitigated |

### 4.3 Risk Summary

| Risk Level | Count | Percentage |
|-----------|:-----:|:----------:|
| Very Low | 0 | 0% |
| Low | 6 | 40% |
| Moderate | 7 | 47% |
| High | 2 | 13% |
| Very High | 0 | 0% |
| **Overall** | **15** | **Low-Moderate** |

---

## 5. Control Recommendations

### 5.1 Existing Controls (Implemented)

| Control | HIPAA Section | Status | Evidence |
|---------|-------------|--------|----------|
| Encryption at rest (AES-256) | 164.312(a)(2)(iv) | Implemented | Supabase encryption + 7 app-layer fields |
| Encryption in transit (TLS 1.3) | 164.312(e)(1) | Implemented | All connections HTTPS |
| Access controls (RBAC + RLS) | 164.312(a)(1) | Implemented | 25 roles, 2,037 RLS policies |
| Audit logging | 164.312(b) | Implemented | `auditLogger` on 150 services |
| Unique user identification | 164.312(a)(2)(i) | Implemented | Supabase Auth UUID |
| Automatic logoff | 164.312(a)(2)(iii) | Implemented | 15-min idle timeout |
| Emergency access | 164.312(a)(2)(ii) | Implemented | `super_admin` role, service key |
| Contingency plan | 164.308(a)(7) | Implemented | DR plan documented |
| BAA tracking | 164.308(b)(1) | Implemented | BAA tracking dashboard (this remediation) |
| Breach notification | 164.400-414 | Implemented | Breach notification engine (this remediation) |
| Training tracking | 164.308(a)(5) | Implemented | Training compliance dashboard (this remediation) |
| PHI redaction (AI) | 164.502(d) | Implemented | 8-field PHI strip before Claude API |

### 5.2 Recommended Additional Controls

| Priority | Control | Risk Addressed | Target Date | Owner |
|:--------:|---------|---------------|-------------|-------|
| 1 | Annual penetration test | R-3, R-5, R-13 | Q2 2026 | Maria |
| 2 | Security awareness training program | R-9, R-13 | Q2 2026 | Akima |
| 3 | Quarterly backup restoration test | R-5, R-7 | Q2 2026 | Engineering |
| 4 | Formal workforce sanction policy | R-4, R-9 | Q2 2026 | Maria |
| 5 | Phishing simulation program | R-13 | Q3 2026 | Maria |
| 6 | Endpoint detection & response (EDR) | R-5 | Q3 2026 | Engineering |
| 7 | SOC 2 Type II certification | All | Q4 2026 | Maria |

---

## 6. Assessment Methodology

### 6.1 Approach

This assessment followed NIST SP 800-30 Rev. 1 methodology:

1. **Prepare for Assessment** — Defined scope, identified information sources, established risk model
2. **Conduct Assessment** — Identified threats, vulnerabilities, likelihood, impact, and risk
3. **Communicate Results** — This document
4. **Maintain Assessment** — Semi-annual updates, triggered by significant changes

### 6.2 Information Sources

| Source | Type | Date |
|--------|------|------|
| HIPAA Security Risk Assessment | Internal assessment | Feb 6, 2026 |
| PHI Data Flow Diagram | Architecture document | Feb 6, 2026 |
| SOC 2 FHIR Compliance Audit | Internal audit | Jan 2026 |
| HIPAA Security Scan | Automated scan | Feb 3, 2026 |
| Multi-Tenant Security Analysis | Architecture review | Jan 2026 |
| Database migration files | Code review | Ongoing |
| Edge function source code | Code review | Ongoing |

### 6.3 Risk Model

- **Likelihood Scale:** Very Low (1), Low (2), Moderate (3), High (4), Very High (5)
- **Impact Scale:** Very Low (1), Low (2), Moderate (3), High (4), Very High (5)
- **Risk Level:** Likelihood x Impact mapped to 5x5 matrix (Section 4.1)

### 6.4 Assumptions

1. Supabase maintains its SOC 2 Type II and HIPAA compliance posture
2. Anthropic maintains its data handling policy (no training on API data)
3. All clinical users follow device security policies (encryption, passcode)
4. Twilio maintains its HIPAA-eligible product status

### 6.5 Limitations

1. No penetration test performed (recommended for Q2 2026)
2. Physical security delegated to cloud providers (not independently verified)
3. Social engineering resistance not tested
4. Backup restoration not verified (recommended for Q2 2026)

---

## 7. Cross-References

| Document | Relationship |
|----------|-------------|
| `docs/compliance/HIPAA_RISK_ASSESSMENT.md` | Simplified assessment (this document provides NIST-structured version) |
| `docs/compliance/PHI_DATA_FLOW.md` | ePHI flow diagram referenced in Section 1.3 |
| `docs/compliance/DISASTER_RECOVERY_PLAN.md` | Contingency plan referenced in Section 5.1 |
| `docs/compliance/REGULATORY_GAP_TRACKER.md` | Gap remediation status |
| `docs/compliance/FDA_CDS_CLASSIFICATION.md` | AI risk classification |
| `SECURITY.md` | Incident response procedures |

---

## Signatures

| Role | Name | Date |
|------|------|------|
| Security Officer | _________________ | ________ |
| Compliance Officer (CCO) | Akima — MDiv, BSN, RN, CCM | ________ |
| AI System Director | Maria | ________ |

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
*Classification: Confidential — Internal Use Only*
