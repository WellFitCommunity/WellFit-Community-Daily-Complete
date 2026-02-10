# Information Blocking Policy

> **Envision Virtual Edge Group LLC**
> **Regulation:** 21st Century Cures Act, Section 4004 (ONC Information Blocking Rule, 45 CFR Part 171)
> **Version:** 1.0 | **Effective:** February 10, 2026
> **Next Review:** August 10, 2026 (semi-annual)
> **Owner:** Security Officer (Maria) + CCO (Akima)

---

## 1. Purpose

This policy establishes Envision Virtual Edge Group LLC's commitment to compliance with the 21st Century Cures Act's Information Blocking provisions. We will not engage in practices that are likely to interfere with, prevent, or materially discourage access, exchange, or use of electronic health information (EHI).

---

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Electronic Health Information (EHI)** | ePHI as defined by HIPAA, encompassing the USCDI data set and all EHI in a designated record set |
| **Information Blocking** | Practice that is likely to interfere with, prevent, or materially discourage access, exchange, or use of EHI (45 CFR 171.103) |
| **Health IT Developer** | Envision Virtual Edge Group LLC, as developer of Envision ATLUS I.H.I.S. and WellFit Community |
| **USCDI** | United States Core Data for Interoperability (currently v3) |

---

## 3. Policy Statement

**Envision Virtual Edge Group LLC will NOT:**

1. **Prevent or restrict** patient access to their own EHI through any technical or operational means
2. **Impose unreasonable fees** for accessing or exchanging EHI beyond actual costs
3. **Impose unreasonable terms or conditions** on access to or exchange of EHI
4. **Implement technology** in a manner that restricts authorized access, exchange, or use of EHI
5. **Delay or withhold** EHI from patients, providers, or authorized third parties
6. **Require exclusive use** of our platform as a condition of data access
7. **Degrade or disable** interoperability features (FHIR, C-CDA, HL7) to limit data portability

---

## 4. Patient Access Implementation

### 4.1 My Health Hub (Patient Portal)

All patients have electronic access to their health information via the `/my-health` route:

| Route | USCDI Data Class | Format |
|-------|-----------------|--------|
| `/health-observations` | Vital signs, laboratory results | FHIR Observation |
| `/immunizations` | Immunization records | FHIR Immunization |
| `/care-plans` | Active care plans | FHIR CarePlan |
| `/allergies` | Allergies and intolerances | FHIR AllergyIntolerance |
| `/conditions` | Medical conditions and diagnoses | FHIR Condition |
| `/medicine-cabinet` | Current medications | FHIR MedicationRequest |
| `/health-records-download` | Full record export (PDF, FHIR, C-CDA, CSV) | Multiple |

### 4.2 Data Export Capabilities

Patients may export their data in multiple standard formats:

| Format | Standard | Use Case |
|--------|----------|----------|
| **FHIR R4 Bundle** | HL7 FHIR R4 | Interoperable exchange with other health systems |
| **C-CDA** | HL7 CDA R2 | Continuity of Care Document for provider transitions |
| **PDF** | Human-readable | Personal records |
| **CSV** | Tabular | Personal analysis |

### 4.3 USCDI v3 Data Elements

All USCDI v3 required data classes are implemented (migration `20260122_uscdi_v3_elements.sql`):
- Patient demographics (including tribal affiliation, disability status)
- Conditions, medications, allergies, immunizations
- Vital signs, laboratory results
- Care plans, goals (including SDOH goals)
- Caregiver relationships
- Clinical notes, procedures

---

## 5. Interoperability Commitments

### 5.1 Standards Supported

| Standard | Implementation | Purpose |
|----------|---------------|---------|
| **FHIR R4** | fhirMappingService.ts + fhir-r4 edge function | Standard API for EHI exchange |
| **SMART on FHIR** | smart-authorize, smart-token, smart-configuration | Third-party app authorization |
| **C-CDA** | ccda-export edge function | Document-based exchange |
| **HL7 v2.x** | hl7-receive edge function + HL7ToFHIRTranslator | Legacy system integration |
| **Da Vinci PAS** | 5 prior authorization services | Payer interoperability |
| **X12 837P/837I** | generate-837p edge function | Claims submission |

### 5.2 EHR Adapter Support

Multi-EHR FHIR adapters ensure data flows freely between systems:
- Epic
- Cerner (Oracle Health)
- Meditech
- Generic FHIR-compliant systems

---

## 6. Recognized Exceptions

The ONC Information Blocking Rule recognizes eight exceptions (45 CFR 171.200-171.403). We may invoke these only when documented:

| Exception | When We May Invoke | Documentation Required |
|-----------|-------------------|----------------------|
| **Preventing Harm** (171.201) | Patient safety risk from data release | Clinical justification by licensed provider |
| **Privacy** (171.202) | HIPAA Privacy Rule requirements (e.g., 42 CFR Part 2 consent) | Consent status verification |
| **Security** (171.203) | Active security threat to ePHI | Security incident record |
| **Infeasibility** (171.204) | Technical inability (e.g., format not supported) | Technical assessment |
| **Health IT Performance** (171.205) | Maintenance or system updates | Scheduled maintenance notice |
| **Content and Manner** (171.301) | Alternate means of access offered | Access alternatives documented |
| **Fees** (171.302) | Reasonable cost-based fees | Fee schedule published |
| **Licensing** (171.303) | IP licensing terms | License agreement |

**Process:** Any exception invocation must be:
1. Documented with specific justification
2. Approved by the Privacy Officer
3. Logged in `audit_logs` with event type `INFORMATION_BLOCKING_EXCEPTION`
4. Time-limited (re-evaluate within 30 days)
5. Patient notified of alternative access methods

---

## 7. Complaint Handling

### 7.1 Internal Complaints

If a patient, provider, or third party believes we are blocking access to EHI:

1. Submit complaint to Privacy Officer (akima@wellfitcommunity.com)
2. Privacy Officer acknowledges within 2 business days
3. Investigation completed within 10 business days
4. Written response provided to complainant
5. If access was improperly blocked, restore immediately and document corrective action

### 7.2 External Complaints

- **ONC:** Patients may file complaints with the ONC at healthit.gov
- **HHS OCR:** HIPAA-related complaints filed with the Office for Civil Rights
- We will cooperate fully with any ONC or HHS investigation

---

## 8. Monitoring and Enforcement

| Control | Implementation | Frequency |
|---------|---------------|-----------|
| **Patient data export availability** | Smoke test My Health Hub routes | Weekly |
| **FHIR endpoint availability** | Health check on fhir-r4 function | Daily |
| **SMART on FHIR registration** | Verify smart-register-app accepts new apps | Monthly |
| **Access request response time** | Track time from request to data delivery | Per request |
| **Exception audit** | Review all exception invocations | Quarterly |

---

## 9. Workforce Training

All workforce members with access to EHI systems must complete annual training on:
- Information blocking prohibitions
- Patient access rights under the Cures Act
- How to handle data access requests
- Exception documentation requirements

Training completion tracked in `training_completions` table (course category: `compliance`).

---

## 10. Policy Maintenance

- **Review frequency:** Semi-annual (February + August)
- **Update triggers:** ONC rule changes, new interoperability standards, complaint findings
- **Approval:** Privacy Officer + Security Officer
- **Distribution:** All workforce members

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Maria + Claude Code | Initial formal information blocking policy |
