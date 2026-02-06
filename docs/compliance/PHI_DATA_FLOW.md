# PHI Data Flow Diagram

**Envision Virtual Edge Group LLC**
**Last Updated:** February 6, 2026
**HIPAA Reference:** 45 CFR 164.312(e)(1) - Transmission Security

---

## Overview

This document maps how Protected Health Information (PHI) enters, moves through, is stored in, and exits the WellFit Community and Envision Atlus platforms. Every PHI touchpoint includes the safeguard applied.

---

## PHI Data Flow

```
 ENTRY POINTS                    PROCESSING                     STORAGE
 ============                    ==========                     =======

 +------------------+
 | Patient Browser  |---HTTPS/TLS 1.3--->+-------------------+
 | (check-in form,  |                    |                   |
 |  self-reporting)  |                    |  Vercel CDN       |     +------------------+
 +------------------+                    |  (NO PHI stored)  |     |                  |
                                         |  Patient IDs only |---->| Supabase         |
 +------------------+                    +-------------------+     | PostgreSQL 17    |
 | Clinical Staff   |---HTTPS/TLS 1.3--->+-------------------+     |                  |
 | (assessments,    |                    |                   |     | - AES-256 at rest|
 |  care plans,     |                    | Supabase Edge     |---->| - RLS per tenant |
 |  SOAP notes)     |                    | Functions (Deno)  |     | - 7 encrypted    |
 +------------------+                    |                   |     |   PHI fields     |
                                         | - Auth verified   |     | - Audit triggers |
 +------------------+                    | - Role checked    |     +------------------+
 | Caregiver        |---HTTPS/TLS 1.3-->| - PHI encrypted   |            |
 | (PIN session,    |                    | - Audit logged    |            |
 |  read-only)      |                    +-------------------+            |
 +------------------+                           |                        |
                                                |                        |
 +------------------+                           v                        |
 | HL7 v2.x        |---TLS encrypted--->+-------------------+            |
 | (ADT, ORU, ORM  |                    | hl7-receive       |            |
 |  from hospitals) |                    | Edge Function     |----------->|
 +------------------+                    +-------------------+            |
                                                                         |
 +------------------+                    +-------------------+            |
 | FHIR R4         |---HTTPS/TLS 1.3-->| mcp-fhir-server   |            |
 | (Epic, external  |                    | (service role)    |----------->|
 |  EHR systems)    |                    +-------------------+
 +------------------+


 EXTERNAL TRANSMISSIONS (PHI leaves the system)
 ==============================================

 Supabase DB ----+
                 |
                 +--HTTPS-->+-------------------+--HTTPS-->+------------------+
                 |          | Clearinghouse     |          | Waystar /        |
                 |          | Edge Function     |          | Change Healthcare|
                 |          | (837P/837I claims)|          | (claims)         |
                 |          +-------------------+          +------------------+
                 |
                 +--HTTPS-->+-------------------+--HTTPS-->+------------------+
                 |          | enhanced-fhir-    |          | External FHIR    |
                 |          | export            |          | Servers (Epic)   |
                 |          +-------------------+          +------------------+
                 |
                 +--HTTPS-->+-------------------+--HTTPS-->+------------------+
                 |          | Claude AI Edge    |          | Anthropic API    |
                 |          | Functions         |          | (PHI redacted    |
                 |          | (PHI redaction    |          |  before send)    |
                 |          |  applied)         |          +------------------+
                 |          +-------------------+
                 |
                 +--HTTPS-->+-------------------+--HTTPS-->+------------------+
                 |          | send-sms          |          | Twilio           |
                 |          | (phone numbers    |          | (SMS delivery)   |
                 |          |  only, no PHI     |          +------------------+
                 |          |  in message body) |
                 |          +-------------------+
                 |
                 +--HTTPS-->+-------------------+--HTTPS-->+------------------+
                            | MailerSend        |          | MailerSend       |
                            | (email address    |          | (email delivery) |
                            |  only, no PHI     |          +------------------+
                            |  in email body)   |
                            +-------------------+
```

---

## PHI Categories and Locations

### Where PHI is Stored

| PHI Element | Database Table(s) | Encrypted? | Access Control |
|-------------|-------------------|-----------|----------------|
| Patient name | `profiles` (first_name, last_name) | At rest (Supabase AES-256) | RLS: own data + admin |
| Patient name (handoff) | `handoff_packets` (patient_name_encrypted) | Application-layer AES | RLS: clinical roles |
| Date of birth | `profiles` (dob) | At rest (Supabase AES-256) | RLS: own data + admin |
| Date of birth (handoff) | `handoff_packets` (patient_dob_encrypted) | Application-layer AES | RLS: clinical roles |
| Phone number | `profiles` (phone_encrypted) | Application-layer AES | RLS: own data + admin |
| Email address | `profiles` (email_encrypted) | Application-layer AES | RLS: own data + admin |
| Address | `profiles` (address) | At rest (Supabase AES-256) | RLS: own data + admin |
| Vitals (BP, HR, SpO2, glucose) | `check_ins` | At rest (Supabase AES-256) | RLS: own data + clinical |
| Medical conditions | `fhir_conditions` | At rest (Supabase AES-256) | RLS: clinical roles |
| Medications | `fhir_medication_requests` | At rest (Supabase AES-256) | RLS: clinical roles |
| Lab results | `fhir_diagnostic_reports`, `fhir_observations` | At rest (Supabase AES-256) | RLS: clinical + lab_tech |
| Care plans | `fhir_care_plans` | At rest (Supabase AES-256) | RLS: clinical roles |
| Risk assessments | `risk_assessments` | At rest (Supabase AES-256) | RLS: clinical roles |
| Dental records | `dental_assessments`, `dental_tooth_chart` | At rest (Supabase AES-256) | RLS: dental + admin |
| EHR credentials | `ehr_connections` (access_token_encrypted, refresh_token_encrypted, client_secret_encrypted) | Application-layer AES | RLS: admin only |

### Where PHI is NOT Stored

| Component | What It Sees | PHI Present? |
|-----------|-------------|:------------:|
| Vercel CDN / React app | Patient IDs, UI templates | No |
| Browser localStorage | Session tokens, UI preferences | No (enforced by policy) |
| IndexedDB (offline mode) | Queued check-ins with device encryption | Temporary only, deleted after sync |
| Git repository | Source code only | No |
| CI/CD logs | Build output, test results | No |

---

## Safeguards at Each Point

### Entry Points

| Entry Point | Transport Security | Authentication | PHI Handling |
|------------|-------------------|----------------|-------------|
| Patient browser | HTTPS / TLS 1.3 | Supabase Auth (JWT) | Patient IDs only in frontend; PHI submitted directly to Supabase |
| Clinical staff browser | HTTPS / TLS 1.3 | Password + PIN | Role verified before data access |
| Caregiver browser | HTTPS / TLS 1.3 | PIN session (30 min timeout) | Read-only proxy access, all access logged |
| HL7 messages | TLS encrypted | API key + source validation | Parsed and stored via `hl7-receive` edge function |
| FHIR resources | HTTPS / TLS 1.3 | Service role key + clinical role | Validated against FHIR R4 schema |

### Processing

| Component | Safeguard | Audit |
|-----------|-----------|-------|
| Supabase Edge Functions | Role verification, CORS (explicit origins), rate limiting | `auditLogger` on all PHI operations |
| MCP FHIR Server | Service role + clinical access verification via `mcpAuthGate` | PHI access logged |
| AI services (Claude) | PHI redaction before API call (email, phone, SSN, address, DOB stripped) | AI usage logged to `claude_usage_logs` |
| Clearinghouse functions | Service role only, rate limited | Claims submission logged |

### Storage

| Safeguard | Implementation |
|-----------|---------------|
| Encryption at rest | AES-256 (Supabase managed) on all tables |
| Application-layer encryption | 7 PHI fields with additional AES encryption |
| Row Level Security | 2,037 policies across 720+ RLS-enabled tables |
| Tenant isolation | `tenant_id` on all queries, enforced by RLS |
| Automated backups | Encrypted, 30-day retention |

### External Transmissions

| Destination | What PHI Leaves | Safeguard | BAA Status |
|-------------|----------------|-----------|:----------:|
| Anthropic (Claude API) | Redacted clinical context (PHI stripped) | PHI redaction function strips: names, SSN, DOB, email, phone, address, MRN, member ID | Verification pending |
| Clearinghouse (Waystar/Change/Availity) | Claims data (837P/837I) with patient demographics | HTTPS, EDI standard encryption, service role auth | Per clearinghouse contract |
| External FHIR servers (Epic) | FHIR Bundles (clinical data) | HTTPS, OAuth 2.0, SMART on FHIR | Per BAA with health system |
| Twilio | Phone numbers only (no PHI in SMS body) | HTTPS, Twilio BAA | Yes (Twilio HIPAA) |
| MailerSend | Email addresses only (no PHI in email body) | HTTPS | Verification needed |
| Supabase | All data (primary data processor) | HTTPS, AES-256 at rest | Yes (Supabase BAA) |

---

## Offline Mode PHI Handling

When operating offline (rural/unreliable internet):

1. **Data queued in IndexedDB** with device-level encryption:
   - Windows: DPAPI (AES-256)
   - macOS: Keychain / FileVault2 (AES-256)
   - iOS: Secure Enclave (AES-256)
   - Android: Keystore (hardware-backed AES)
2. **Session timeout**: Auto-logout after inactivity
3. **Sync on reconnect**: Queued data transmitted via HTTPS/TLS 1.3
4. **Auto-delete after sync**: Local copy removed after server confirmation
5. **Device requirements**: Encryption enabled, passcode required, auto-lock within 5 minutes

---

## PHI Breach Detection

| Detection Method | What It Catches |
|-----------------|-----------------|
| Audit log monitoring | Unusual access patterns, after-hours access, bulk exports |
| Authentication logging | Failed login attempts, brute force detection |
| RLS policy enforcement | Cross-tenant access attempts (blocked and logged) |
| CORS enforcement | Unauthorized origin requests (blocked) |
| Security scan (automated) | Hardcoded credentials, CORS wildcards, console.log statements |

---

## Review Schedule

- **Quarterly**: Verify data flow matches this document
- **On integration change**: Update when new external systems are connected
- **Annually**: Full PHI flow audit with compliance officer
- **On breach**: Immediate review and update

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
