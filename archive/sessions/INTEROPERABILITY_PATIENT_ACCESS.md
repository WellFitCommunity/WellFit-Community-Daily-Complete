# Patient Data Access & Interoperability Plan

**Status:** Planning (Not Yet Implemented)
**Last Updated:** 2025-12-14
**Owner:** [TBD]

---

## Core Principle

> **"No one should have to jump through hoops to get their own records."**

Patients own their health data. Healthcare organizations should share freely with proper permissions. Bureaucracy should never be a barrier to care.

---

## Part 1: Legal Framework

### 1.1 Federal Requirements

| Law/Regulation | Requirement | Our Compliance |
|----------------|-------------|----------------|
| **HIPAA Right of Access** | Patients can request their records; must be provided within 30 days (extendable to 60) | [ ] Implement self-service download |
| **21st Century Cures Act** | Prohibits "information blocking" - can't make it hard to share | [ ] No barriers to patient access |
| **TEFCA** | Trusted Exchange Framework - national network for sharing | [ ] Evaluate QHIN participation |
| **ONC Certification** | FHIR APIs required for certified EHRs | [ ] FHIR R4 endpoints |
| **CMS Interoperability Rules** | Payers must provide patient access API | [ ] (If applicable to payer functions) |

### 1.2 Special Protections (Require Extra Consent)

| Category | Law | What It Means |
|----------|-----|---------------|
| **Substance Abuse** | 42 CFR Part 2 | SUD treatment records need separate consent to share |
| **Mental Health** | State laws vary | Some states require separate consent for psych records |
| **HIV/AIDS** | State laws vary | Many states have special HIV disclosure rules |
| **Genetic Information** | GINA | Genetic data has employment/insurance protections |
| **Minors** | State laws vary | Emancipated minors, reproductive health, etc. |
| **Reproductive Health** | State laws vary | Post-Dobbs, some states restrict sharing |

### 1.3 Patient Exceptions ("Break the Glass" for Your Own Data)

**Patients can ALWAYS access their own records with limited exceptions:**

| Can Access | Cannot Access (HIPAA Exceptions) |
|------------|----------------------------------|
| All clinical notes | Psychotherapy notes (separate from medical record) |
| Lab results | Information compiled for legal proceedings |
| Imaging reports | Information that would endanger patient or others |
| Medications | Research data (if waived access for study) |
| Diagnoses | |
| Treatment plans | |
| Provider notes | |

**Key Point:** Even "sensitive" records (SUD, mental health, HIV) are accessible BY THE PATIENT. The restrictions are about sharing with OTHERS.

---

## Part 2: Interoperability Architecture

### 2.1 Data Exchange Standards

| Standard | Purpose | Implementation Status |
|----------|---------|----------------------|
| **FHIR R4** | Modern API standard for health data | [ ] Core resources implemented |
| **US Core IG** | US-specific FHIR profiles | [ ] Conformance validated |
| **SMART on FHIR** | OAuth2-based authorization | [ ] Patient app authorization |
| **CDS Hooks** | Clinical decision support triggers | [ ] (Future) |
| **USCDI v3** | Required data elements | [ ] All elements supported |
| **C-CDA** | Legacy document format (still needed) | [ ] Export capability |
| **Direct Messaging** | Secure provider-to-provider email | [ ] (Evaluate need) |

### 2.2 USCDI v3 Required Data Classes

These MUST be available to patients:

| Data Class | Elements | Our Support |
|------------|----------|-------------|
| **Patient Demographics** | Name, DOB, Sex, Race, Ethnicity, Address, Phone, Email | [ ] |
| **Allergies & Intolerances** | Substance, Reaction, Severity | [ ] |
| **Medications** | Name, Dose, Frequency, Status | [ ] |
| **Problems/Conditions** | Diagnosis, ICD-10, Status | [ ] |
| **Immunizations** | Vaccine, Date, Status | [ ] |
| **Vital Signs** | BP, HR, Temp, Weight, Height, BMI, SpO2 | [ ] |
| **Lab Results** | Test, Result, Units, Reference Range | [ ] |
| **Procedures** | Name, Date, Status | [ ] |
| **Clinical Notes** | Progress notes, H&P, Discharge summaries | [ ] |
| **Care Team** | Provider names, roles, contact info | [ ] |
| **Goals** | Health goals, target dates | [ ] |
| **Assessment/Plan** | Clinical assessments, care plans | [ ] |
| **Health Concerns** | Patient-reported concerns | [ ] |
| **Social Determinants** | SDOH screening results | [ ] |
| **Provenance** | Data source, author, timestamp | [ ] |

### 2.3 Exchange Patterns

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PATIENT-CENTERED DATA FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

                          ┌─────────────┐
                          │   PATIENT   │
                          │  (Data Owner)│
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │  WellFit  │ │  Patient  │ │  3rd Party│
            │Health Hub │ │  Portal   │ │   Apps    │
            └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                  │             │             │
                  └─────────────┼─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │     FHIR API Layer    │
                    │   (SMART on FHIR)     │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Hospital A  │     │   Clinic B    │     │   Lab C       │
│   (Atlus)     │     │   (External)  │     │   (External)  │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## Part 3: Consent Management

### 3.1 Consent Types

| Consent Type | Scope | Duration | Revocable? |
|--------------|-------|----------|------------|
| **Broad Treatment Consent** | Share for treatment, payment, operations (TPO) | Until revoked | Yes |
| **Specific Provider Consent** | Share with named provider/org | As specified | Yes |
| **Research Consent** | Use for specific study | Study duration | Varies |
| **HIE Participation** | Share via health information exchange | Until revoked | Yes |
| **App Authorization** | 3rd party app access via SMART | As specified | Yes |
| **Emergency Override** | Share in emergency without consent | Emergency only | N/A |
| **42 CFR Part 2** | SUD-specific consent | As specified | Yes |

### 3.2 Consent Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONSENT WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────┘

1. PATIENT GRANTS CONSENT
   ├── Who can access? (Provider, Organization, App, HIE)
   ├── What data? (All, specific categories, exclude sensitive)
   ├── For what purpose? (Treatment, Research, Personal use)
   ├── How long? (One-time, duration, until revoked)
   └── Any restrictions? (No SUD data, no mental health, etc.)

2. CONSENT STORED
   ├── FHIR Consent resource created
   ├── Linked to patient record
   ├── Audit trail started
   └── Expiration tracked

3. ACCESS REQUESTED
   ├── Requestor identified
   ├── Consent checked
   ├── Data filtered per consent
   └── Access logged

4. PATIENT CAN:
   ├── View all active consents
   ├── Revoke any consent
   ├── See access history
   └── Report concerns
```

### 3.3 Patient Self-Service Consent Portal

**Features needed:**

- [ ] View who has access to my data
- [ ] Grant access to new provider/org
- [ ] Revoke access at any time
- [ ] Download my complete record (FHIR bundle or PDF)
- [ ] See who accessed my data (audit log)
- [ ] Set preferences for sensitive data
- [ ] Authorize third-party apps (SMART on FHIR)
- [ ] Opt-in/out of HIE participation
- [ ] Designate personal representatives (family, caregivers)

---

## Part 4: Cross-Organization Sharing

### 4.1 Sharing Scenarios

| Scenario | Legal Basis | Consent Needed? | Technical Method |
|----------|-------------|-----------------|------------------|
| **Referral to specialist** | TPO | No (treatment) | FHIR transfer or Direct message |
| **Hospital admits patient** | TPO | No (treatment) | Query via HIE or FHIR |
| **Patient requests records** | Right of Access | Patient request = consent | FHIR download or PDF |
| **Insurance claim** | TPO | No (payment) | X12 837/835 or FHIR |
| **Research study** | Research consent | Yes (IRB approved) | De-identified or consented |
| **Public health reporting** | Legal mandate | No (required by law) | HL7 message or FHIR |
| **Caregiver access** | Patient authorization | Yes | PIN-based (our system) |
| **Emergency** | Emergency exception | No | Provider attestation |

### 4.2 Information Blocking Prevention

**21st Century Cures Act prohibits these behaviors:**

| Blocking Behavior | Our Prevention |
|-------------------|----------------|
| Excessive fees for records | [ ] Free electronic access, reasonable paper fees |
| Unreasonable delays | [ ] Real-time API access |
| Requiring fax/mail when electronic possible | [ ] Electronic by default |
| Limiting to proprietary formats | [ ] Standard FHIR/C-CDA |
| Requiring in-person pickup | [ ] Remote download available |
| Not providing complete records | [ ] Full USCDI dataset |
| Denying third-party app access | [ ] SMART on FHIR enabled |

### 4.3 Network Participation Options

| Network | Type | Coverage | Consideration |
|---------|------|----------|---------------|
| **Carequality** | National query network | 70%+ of US health data | [ ] Evaluate |
| **CommonWell** | National network | Major EHR vendors | [ ] Evaluate |
| **eHealth Exchange** | Federal/regional | Federal agencies, large systems | [ ] Evaluate |
| **State HIEs** | Regional | Varies by state | [ ] Per-state evaluation |
| **TEFCA QHINs** | National (new) | Growing | [ ] Future consideration |

---

## Part 5: Patient-Facing Health Hub

### 5.1 Health Hub Vision (WellFit Community)

The Health Hub should give patients (including seniors) easy access to:

| Feature | Description | Senior-Friendly Design |
|---------|-------------|------------------------|
| **My Health Summary** | Conditions, meds, allergies at a glance | Large cards with icons + text |
| **My Records** | Download or view full medical record | Big "Download My Records" button |
| **Share My Data** | Grant access to family or providers | Simple wizard with confirmation |
| **Who Has Access** | See all active consents | Clear list with "Remove" option |
| **Access History** | Who viewed my data and when | Timeline view |
| **My Care Team** | Providers involved in my care | Photos, names, roles, contact |
| **Health Badges** | Visual status indicators | LARGE, labeled (not clinical icons) |

### 5.2 Senior-Friendly Health Badges

**NOT the clinical badges - these are patient-facing:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SENIOR-FRIENDLY HEALTH BADGES                    │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    💊            │  │    💉            │  │    ⚠️            │
│    MEDICATIONS   │  │    ALLERGIES     │  │    FALL RISK     │
│                  │  │                  │  │                  │
│  3 Active Meds   │  │  Penicillin      │  │  Use Walker      │
│  [View List]     │  │  Shellfish       │  │  [Learn More]    │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    ❤️            │  │    🫁            │  │    🩸            │
│    HEART         │  │    LUNGS         │  │    DIABETES      │
│    HEALTH        │  │                  │  │                  │
│  CHF - Managed   │  │  COPD - Stable   │  │  Type 2 - Good   │
│  [View Details]  │  │  [View Details]  │  │  [View Details]  │
└──────────────────┘  └──────────────────┘  └──────────────────┘

Design Principles:
✓ Large text (minimum 16px, preferably 18-20px)
✓ High contrast (dark text on light background)
✓ Emoji/icon + TEXT label (never icon alone)
✓ Simple language (not medical jargon)
✓ Big tap targets (44px minimum)
✓ Clear action buttons
```

### 5.3 Patient Data Export Options

| Format | Use Case | Implementation |
|--------|----------|----------------|
| **FHIR Bundle (JSON)** | Apps, portability | [ ] Standard export |
| **C-CDA (XML)** | Legacy systems | [ ] Generate from FHIR |
| **PDF Summary** | Printing, email | [ ] Human-readable format |
| **Blue Button (text)** | Simple download | [ ] Legacy support |
| **Apple Health** | iPhone integration | [ ] FHIR via SMART |
| **CommonHealth** | Android integration | [ ] FHIR via SMART |

---

## Part 6: Implementation Phases

### Phase 1: Foundation (Q1)
- [ ] FHIR R4 API endpoints for USCDI data
- [ ] Patient authentication (SMART on FHIR)
- [ ] Basic record download (PDF + FHIR)
- [ ] Consent storage (FHIR Consent resource)
- [ ] Audit logging

### Phase 2: Patient Portal (Q2)
- [ ] Health Hub integration
- [ ] View my records
- [ ] Download my records
- [ ] Senior-friendly health badges
- [ ] Consent management UI

### Phase 3: Sharing (Q3)
- [ ] Grant provider access
- [ ] Revoke access
- [ ] Caregiver authorization
- [ ] Access history view
- [ ] Third-party app authorization

### Phase 4: Network (Q4)
- [ ] HIE integration evaluation
- [ ] Carequality/CommonWell connection
- [ ] Cross-organization queries
- [ ] Incoming data reconciliation

---

## Part 7: Open Questions

**Decisions needed before implementation:**

1. **Which HIE networks to join?**
   - Cost, coverage, technical requirements

2. **How to handle state-specific rules?**
   - Mental health consent varies by state
   - Some states have stricter HIV rules

3. **Sensitive data defaults?**
   - Opt-in or opt-out for sharing SUD/mental health?
   - How granular should controls be?

4. **Third-party app vetting?**
   - Any apps allowed, or curated list?
   - How to warn patients about data use?

5. **Emergency access process?**
   - How does provider attest to emergency?
   - What audit trail is needed?

6. **Paper records?**
   - How to handle requests for physical records?
   - Fees and timelines?

---

## Part 8: Legal Checklist

Before launch, verify compliance with:

- [ ] HIPAA Privacy Rule (45 CFR 164)
- [ ] HIPAA Security Rule (45 CFR 164)
- [ ] HIPAA Right of Access (45 CFR 164.524)
- [ ] 21st Century Cures Act (Information Blocking)
- [ ] ONC Certification requirements (if applicable)
- [ ] CMS Interoperability rules (if applicable)
- [ ] 42 CFR Part 2 (SUD records)
- [ ] State privacy laws (per operating state)
- [ ] State consent laws (per operating state)
- [ ] GINA (genetic information)
- [ ] State minor consent laws

---

## Appendix A: FHIR Resources for Interoperability

| FHIR Resource | USCDI Data Class | Priority |
|---------------|------------------|----------|
| Patient | Demographics | P0 |
| Condition | Problems | P0 |
| Medication, MedicationRequest | Medications | P0 |
| AllergyIntolerance | Allergies | P0 |
| Observation | Vital Signs, Labs, SDOH | P0 |
| Immunization | Immunizations | P1 |
| Procedure | Procedures | P1 |
| DiagnosticReport | Lab Results, Imaging | P1 |
| DocumentReference | Clinical Notes | P1 |
| CarePlan | Assessment/Plan | P1 |
| Goal | Goals | P2 |
| CareTeam | Care Team | P2 |
| Consent | Consent | P0 |
| Provenance | Provenance | P1 |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **FHIR** | Fast Healthcare Interoperability Resources - modern API standard |
| **HIE** | Health Information Exchange - network for sharing data |
| **SMART** | Substitutable Medical Applications and Reusable Technologies |
| **USCDI** | US Core Data for Interoperability - required data elements |
| **TPO** | Treatment, Payment, Operations - no consent needed |
| **42 CFR Part 2** | Federal law protecting substance abuse records |
| **C-CDA** | Consolidated Clinical Document Architecture - legacy format |
| **TEFCA** | Trusted Exchange Framework and Common Agreement |
| **QHIN** | Qualified Health Information Network |
| **ONC** | Office of the National Coordinator for Health IT |

---

*This document is a planning artifact. Implementation requires legal review, technical architecture, and stakeholder alignment.*
