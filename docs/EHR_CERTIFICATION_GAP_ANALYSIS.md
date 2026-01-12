# EHR/EMR Certification Gap Analysis

**Analysis Date:** January 12, 2026
**Analyst:** Claude Code Comprehensive Codebase Scan
**Target:** ONC 2015 Edition Cures Update + USCDI v3 Compliance + CMS Promoting Interoperability

---

## Executive Summary

This analysis compares the current WellFit/Envision Atlus codebase against federal EHR certification requirements. The system has **exceptional foundational coverage** (200+ database tables, 45+ AI services, 80+ edge functions) but requires specific additions for formal ONC certification and CMS program participation.

| Category | Status | Priority |
|----------|--------|----------|
| Clinical Documentation | **90% Complete** | Medium |
| FHIR R4 / Interoperability | **85% Complete** | High |
| Public Health Reporting | **15% Complete** | **CRITICAL** |
| Patient Engagement | **80% Complete** | Medium |
| Security / HIPAA | **95% Complete** | Low |
| CMS Promoting Interoperability | **40% Complete** | **CRITICAL** |
| ONC Certification Process | **0% Complete** | **CRITICAL** |

---

## TIER 1: CRITICAL GAPS (Legally Required / Certification Blocking)

These items MUST be completed for healthcare organizations to consider the system for real deployment.

### 1.1 ONC Health IT Certification (BLOCKING)

**Status:** NOT STARTED
**Deadline:** Required before marketing as "Certified EHR"
**Estimated Effort:** 6-12 months

| Task | Description | Status |
|------|-------------|--------|
| [ ] Select ONC-ACB | Choose Accredited Certification Body (Drummond, ICSA, SLI) | Not Started |
| [ ] Gap Assessment | Formal gap analysis by ONC-ACB | Not Started |
| [ ] Test Plan Development | Create certification test procedures | Not Started |
| [ ] Certification Testing | Execute 170.315 criteria tests | Not Started |
| [ ] CHPL Listing | List on Certified Health IT Product List | Not Started |

**Files to Create:**
- `docs/certification/ONC_CERTIFICATION_PLAN.md`
- `docs/certification/170_315_CRITERIA_MAPPING.md`

---

### 1.2 Public Health Reporting (CMS MANDATORY)

**Status:** 15% COMPLETE
**Deadline:** Required for CMS Promoting Interoperability participation
**Impact:** Without this, hospitals cannot attest to CMS program = **$0 incentive + penalties**

#### 1.2.1 Syndromic Surveillance Reporting

**Status:** NOT IMPLEMENTED

| Task | Description | Status |
|------|-------------|--------|
| [ ] HL7 ADT Message Generation | Generate ADT messages for ED/urgent care visits | Not Started |
| [ ] State Health Dept Integration | Connect to state public health agencies | Not Started |
| [ ] NSSP BioSense Platform | Integration with CDC surveillance platform | Not Started |
| [ ] Automated Transmission | Real-time or batch reporting capability | Not Started |

**Files to Create:**
- `src/services/publicHealth/syndromicSurveillanceService.ts`
- `supabase/functions/syndromic-surveillance-report/index.ts`
- `supabase/migrations/XXXXXX_syndromic_surveillance_tables.sql`

#### 1.2.2 Immunization Registry Reporting (IIS)

**Status:** PARTIAL (CVX codes exist, registry submission missing)

| Task | Description | Status |
|------|-------------|--------|
| [x] CVX Code Support | Vaccine code vocabulary | Complete |
| [x] Immunization Records | FHIR Immunization resources | Complete |
| [ ] State IIS Integration | Connect to state immunization registries | Not Started |
| [ ] HL7 VXU Message Generation | Generate VXU immunization update messages | Not Started |
| [ ] Bidirectional Query | Query registry for patient history | Not Started |

**Files to Create:**
- `src/services/publicHealth/immunizationRegistryService.ts`
- `supabase/functions/immunization-registry-submit/index.ts`

#### 1.2.3 Electronic Case Reporting (eCR)

**Status:** NOT IMPLEMENTED

| Task | Description | Status |
|------|-------------|--------|
| [ ] Reportable Condition Detection | Identify reportable conditions from diagnoses | Not Started |
| [ ] eICR Generation | Generate electronic Initial Case Reports | Not Started |
| [ ] RCKMS Integration | Reportable Conditions Knowledge Management System | Not Started |
| [ ] AIMS Platform Connection | Association of Public Health Laboratories | Not Started |

**Files to Create:**
- `src/services/publicHealth/electronicCaseReportingService.ts`
- `supabase/functions/ecr-generate/index.ts`
- `supabase/migrations/XXXXXX_electronic_case_reporting.sql`

#### 1.2.4 Antimicrobial Use & Resistance (AU/AR) Surveillance

**Status:** NOT IMPLEMENTED
**Impact:** CMS gives ZERO points if "No" is attested

| Task | Description | Status |
|------|-------------|--------|
| [ ] AU Data Collection | Track antibiotic prescriptions and usage | Not Started |
| [ ] AR Data Collection | Track resistance patterns from lab results | Not Started |
| [ ] NHSN Integration | National Healthcare Safety Network submission | Not Started |
| [ ] CDA Document Generation | Generate AU/AR CDA documents | Not Started |

**Files to Create:**
- `src/services/publicHealth/antimicrobialSurveillanceService.ts`
- `supabase/functions/nhsn-au-ar-submit/index.ts`
- `supabase/migrations/XXXXXX_antimicrobial_surveillance.sql`

---

### 1.3 Electronic Prescribing for Controlled Substances (EPCS)

**Status:** NOT IMPLEMENTED
**Deadline:** Required for full e-prescribing compliance
**Regulatory:** DEA 21 CFR Part 1311

| Task | Description | Status |
|------|-------------|--------|
| [ ] DEA EPCS Certification | Obtain DEA certification for EPCS | Not Started |
| [ ] Identity Proofing | Implement NIST IAL2 identity verification | Not Started |
| [ ] Two-Factor Authentication | Hard token or biometric for prescribers | Not Started |
| [ ] PDMP Integration | Prescription Drug Monitoring Program queries | Not Started |
| [ ] Audit Trail | EPCS-specific audit requirements | Not Started |
| [ ] Third-Party Audit | Annual EPCS system audit | Not Started |

**Files to Create:**
- `src/services/prescribing/epcsService.ts`
- `src/services/prescribing/pdmpIntegrationService.ts`
- `supabase/functions/pdmp-query/index.ts`
- `supabase/migrations/XXXXXX_epcs_system.sql`

---

### 1.4 Clinical Quality Measures (eCQM)

**Status:** NOT IMPLEMENTED
**Deadline:** Required for CMS quality reporting
**Impact:** Hospitals need to report 6 eCQMs for 4 quarters

| Task | Description | Status |
|------|-------------|--------|
| [ ] CQL Engine Integration | Clinical Quality Language execution | Not Started |
| [ ] eCQM Calculation | Automated measure calculation | Not Started |
| [ ] QRDA Category I Export | Patient-level quality data | Not Started |
| [ ] QRDA Category III Export | Aggregate quality data | Not Started |
| [ ] CMS Submission | Submit to CMS quality programs | Not Started |
| [ ] Measure Dashboard | Provider-facing eCQM performance view | Not Started |

**Files to Create:**
- `src/services/qualityMeasures/ecqmCalculationService.ts`
- `src/services/qualityMeasures/cqlEngineService.ts`
- `supabase/functions/ecqm-calculate/index.ts`
- `supabase/functions/qrda-export/index.ts`
- `src/components/admin/ECQMDashboard.tsx`
- `supabase/migrations/XXXXXX_clinical_quality_measures.sql`

---

### 1.5 SAFER Guides Self-Assessment

**Status:** NOT IMPLEMENTED
**Deadline:** Required for CMS Promoting Interoperability (all 9 guides)
**Effort:** Low (documentation/checklist feature)

| Task | Description | Status |
|------|-------------|--------|
| [ ] High Priority Practices | Safety assessment checklist | Not Started |
| [ ] Organizational Responsibilities | Admin safety checklist | Not Started |
| [ ] Contingency Planning | Downtime procedures | Not Started |
| [ ] System Configuration | Configuration safety review | Not Started |
| [ ] System Interfaces | Interface safety assessment | Not Started |
| [ ] Patient Identification | Patient matching safety | Not Started |
| [ ] CPOE with Decision Support | Order entry safety | Not Started |
| [ ] Test Results Reporting | Results review safety | Not Started |
| [ ] Clinician Communication | Messaging safety | Not Started |

**Files to Create:**
- `src/components/admin/SaferGuidesAssessment.tsx`
- `supabase/migrations/XXXXXX_safer_guides_tracking.sql`

---

## TIER 2: HIGH PRIORITY GAPS (Competitive Disadvantage)

These items are not strictly required but expected by healthcare organizations.

### 2.1 Prior Authorization API (CMS Rule)

**Status:** PARTIAL (basic prior auth exists, FHIR API missing)
**Deadline:** January 1, 2027 (CMS-0057-F)

| Task | Description | Status |
|------|-------------|--------|
| [x] Prior Auth Data Model | Database tables exist | Complete |
| [ ] Da Vinci PAS Implementation | Prior Auth Support FHIR IG | Not Started |
| [ ] X12 278 Generation | EDI prior auth transactions | Not Started |
| [ ] Real-time Determination | Automated auth decisions | Not Started |
| [ ] Provider Portal | Prior auth request interface | Not Started |

**Files to Create:**
- `src/services/priorAuth/daVinciPasService.ts`
- `supabase/functions/prior-auth-fhir/index.ts`

---

### 2.2 Provider Directory FHIR API

**Status:** PARTIAL (UI exists, FHIR endpoint missing)

| Task | Description | Status |
|------|-------------|--------|
| [x] Practitioner Records | Database and FHIR resources exist | Complete |
| [x] PractitionerRole | Role assignments exist | Complete |
| [ ] Provider Directory IG | Da Vinci PDex Plan Net compliance | Not Started |
| [ ] Public API Endpoint | Externally accessible provider search | Not Started |
| [ ] NPI Validation | National Provider Identifier verification | Not Started |

**Files to Create:**
- `supabase/functions/provider-directory-fhir/index.ts`

---

### 2.3 Direct Messaging / Health Information Exchange

**Status:** NOT IMPLEMENTED

| Task | Description | Status |
|------|-------------|--------|
| [ ] Direct Protocol Support | RFC 5322 healthcare messaging | Not Started |
| [ ] HISP Integration | Health Information Service Provider | Not Started |
| [ ] Certificate Management | X.509 certificate handling | Not Started |
| [ ] XDR/XDM Support | IHE Cross-Enterprise Document protocols | Not Started |
| [ ] Carequality/CommonWell | National network connectivity | Not Started |

**Files to Create:**
- `src/services/hie/directMessagingService.ts`
- `src/services/hie/carequalityService.ts`
- `supabase/functions/direct-message-send/index.ts`

---

### 2.4 USCDI v3 Full Compliance

**Status:** 75% COMPLETE
**Deadline:** January 1, 2026 (HTI-1 Rule)

| Data Element | Status | Notes |
|--------------|--------|-------|
| [x] Patient Demographics | Complete | |
| [x] Problems/Conditions | Complete | ICD-10, SNOMED |
| [x] Medications | Complete | RxNorm |
| [x] Allergies | Complete | |
| [x] Vital Signs | Complete | |
| [x] Laboratory Results | Complete | LOINC |
| [x] Procedures | Complete | CPT, HCPCS |
| [x] Immunizations | Complete | CVX |
| [x] Clinical Notes | Complete | |
| [x] Care Team | Complete | |
| [x] Goals | Complete | |
| [x] Care Plans | Complete | |
| [ ] Tribal Affiliation | Not Started | New in v3 |
| [ ] Disability Status | Not Started | New in v3 |
| [ ] Caregiver Relationships | Partial | Need structured capture |
| [ ] Time of Death | Not Started | New in v3 |
| [ ] Average Blood Pressure | Not Started | New in v3 |
| [ ] SDOH Goals | Partial | Need goal linking |

**Files to Update:**
- `supabase/migrations/XXXXXX_uscdi_v3_demographics.sql`
- `src/types/patient.ts`

---

### 2.5 Decision Support Intervention (DSI) Transparency

**Status:** PARTIAL (AI exists, transparency documentation missing)
**Deadline:** January 1, 2025 (HTI-1 Rule)

| Task | Description | Status |
|------|-------------|--------|
| [x] AI/ML Models | 45+ clinical AI services exist | Complete |
| [ ] Source Attribute Documentation | 31 attributes per predictive DSI | Not Started |
| [ ] Intervention Details | AI model cards for each service | Not Started |
| [ ] Algorithm Transparency | Provenance and validation data | Not Started |
| [ ] User-facing Descriptions | Plain language AI explanations | Not Started |

**Files to Create:**
- `docs/ai-transparency/MODEL_CARDS.md`
- `src/components/admin/AITransparencyDashboard.tsx`
- `supabase/migrations/XXXXXX_dsi_transparency.sql`

---

## TIER 3: RECOMMENDED ENHANCEMENTS

### 3.1 Patient-Generated Health Data (PGHD)

**Status:** PARTIAL

| Task | Description | Status |
|------|-------------|--------|
| [x] Wearable Integration | Multiple device adapters | Complete |
| [x] Mobile Vitals | Mobile vital capture | Complete |
| [ ] Apple HealthKit | iOS health data import | Not Started |
| [ ] Google Fit | Android health data import | Not Started |
| [ ] PGHD Verification | Clinical review workflow | Partial |

---

### 3.2 Payer-to-Payer Data Exchange

**Status:** NOT IMPLEMENTED
**Deadline:** January 1, 2027 (CMS-0057-F)

| Task | Description | Status |
|------|-------------|--------|
| [ ] Member Attribution API | Patient matching with payers | Not Started |
| [ ] Bulk FHIR Export | Large-scale data transfer | Partial |
| [ ] Da Vinci PDex | Payer Data Exchange IG | Not Started |

---

### 3.3 Real-Time Benefit Tool (RTBT)

**Status:** NOT IMPLEMENTED

| Task | Description | Status |
|------|-------------|--------|
| [ ] Medication Cost Display | Show patient cost at prescribing | Not Started |
| [ ] Formulary Integration | Payer formulary lookup | Not Started |
| [ ] Alternative Suggestions | Lower-cost medication options | Not Started |

---

## Implementation Priority Matrix

| Priority | Items | Timeline |
|----------|-------|----------|
| **P0 - Immediate** | Public Health Reporting (all 4), SAFER Guides | Q1 2026 |
| **P1 - Critical** | eCQM System, EPCS/PDMP, ONC Certification Start | Q2 2026 |
| **P2 - High** | Prior Auth API, USCDI v3 Complete, DSI Transparency | Q3 2026 |
| **P3 - Standard** | Direct Messaging, Provider Directory API | Q4 2026 |
| **P4 - Enhancement** | PGHD Expansion, Payer Exchange, RTBT | 2027 |

---

## Tracking Checklist

### Public Health Reporting (P0)

- [ ] **Syndromic Surveillance**
  - [ ] Database schema for surveillance data
  - [ ] HL7 ADT message generator
  - [ ] State health department API integration
  - [ ] NSSP BioSense Platform connection
  - [ ] Automated daily transmission job
  - [ ] Monitoring and error handling
  - [ ] Documentation and training materials

- [ ] **Immunization Registry (IIS)**
  - [ ] State registry API research (varies by state)
  - [ ] HL7 VXU message generator
  - [ ] Bidirectional query capability
  - [ ] Consent management for registry sharing
  - [ ] Error reconciliation workflow

- [ ] **Electronic Case Reporting (eCR)**
  - [ ] RCKMS trigger code integration
  - [ ] eICR document generator
  - [ ] Reportable Condition Trigger (RCT) engine
  - [ ] AIMS Platform connection
  - [ ] Response handling (RR documents)

- [ ] **Antimicrobial Surveillance (AU/AR)**
  - [ ] Antibiotic usage data model
  - [ ] Resistance pattern capture
  - [ ] NHSN CDA document generator
  - [ ] Automated submission pipeline
  - [ ] Quality metrics dashboard

### SAFER Guides (P0)

- [ ] Build self-assessment UI
- [ ] Create all 9 guide checklists
- [ ] Store assessment results
- [ ] Generate attestation reports
- [ ] Annual reminder system

### eCQM System (P1)

- [ ] Evaluate CQL engines (cql-execution, cqf-ruler)
- [ ] Implement measure calculation service
- [ ] Build QRDA I/III export
- [ ] Create provider performance dashboard
- [ ] Test with CMS test measures
- [ ] Integrate with CMS submission portal

### EPCS/PDMP (P1)

- [ ] Research DEA certification requirements
- [ ] Select EPCS audit vendor
- [ ] Implement identity proofing (NIST IAL2)
- [ ] Add prescriber 2FA (hard token)
- [ ] Build PDMP query integration (state-specific)
- [ ] Create EPCS audit trail
- [ ] Schedule annual third-party audit

### ONC Certification (P1)

- [ ] Select ONC-ACB (Drummond recommended)
- [ ] Schedule gap assessment
- [ ] Create 170.315 criteria mapping
- [ ] Develop test procedures
- [ ] Execute certification testing
- [ ] Submit for CHPL listing
- [ ] Marketing and announcement

---

## Resource Estimates

| Component | Dev Effort | External Cost |
|-----------|------------|---------------|
| Public Health Reporting | 3-4 months | $0 (API costs) |
| eCQM System | 2-3 months | CQL engine license |
| EPCS/PDMP | 2-3 months | DEA audit ($15-30K/yr) |
| ONC Certification | 1-2 months | $50-150K (testing) |
| SAFER Guides | 2-3 weeks | $0 |
| Prior Auth API | 1-2 months | $0 |
| Direct Messaging | 2-3 months | HISP fees ($5-15K/yr) |

**Total Estimated Timeline:** 12-18 months for full certification readiness

---

## What You Already Have (Strengths)

Your codebase is exceptionally strong in several areas:

### Clinical Documentation (90%)
- Comprehensive encounter management
- SOAP notes, progress notes, discharge summaries
- AI-generated clinical documentation
- Care plans and goals

### FHIR R4 Interoperability (85%)
- 21+ FHIR resource types implemented
- SMART on FHIR authorization
- Bidirectional sync with external EHRs
- HL7 v2 translation

### Clinical Decision Support (95%)
- 45+ AI models for clinical predictions
- Drug interaction checking
- Contraindication detection
- Clinical guideline matching

### Security/HIPAA (95%)
- Comprehensive audit logging
- TOTP multi-factor authentication
- Row-level security policies
- PHI de-identification
- Encryption at rest and in transit

### Specialty Modules (Unique Differentiators)
- Neuro suite (Parkinson's, stroke, cognitive)
- Dental module
- Physical therapy
- Mental health
- SDOH passive detection

---

## Next Steps

1. **Immediate (This Week)**
   - Review this gap analysis with stakeholders
   - Prioritize public health reporting based on target markets
   - Research state-specific IIS and PDMP requirements

2. **Short Term (Q1 2026)**
   - Begin public health reporting implementation
   - Build SAFER Guides self-assessment
   - Contact ONC-ACB for certification timeline

3. **Medium Term (Q2-Q3 2026)**
   - Complete eCQM system
   - Implement EPCS/PDMP
   - Begin ONC certification testing

4. **Long Term (Q4 2026+)**
   - Achieve ONC certification
   - Implement Direct messaging
   - Expand payer integrations

---

## References

- [ONC Certification Program](https://www.healthit.gov/topic/certification-ehrs/certification-health-it)
- [170.315 Certification Criteria](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-D/part-170/subpart-C/section-170.315)
- [USCDI v3 Standards](https://www.healthit.gov/isp/united-states-core-data-interoperability-uscdi)
- [CMS Promoting Interoperability](https://www.cms.gov/medicare/regulations-guidance/promoting-interoperability-programs)
- [HTI-1 Final Rule](https://www.federalregister.gov/documents/2024/01/09/2023-28857/health-data-technology-and-interoperability-certification-program-updates-algorithm-transparency-and)
- [21st Century Cures Act](https://www.healthit.gov/topic/information-blocking)
- [SAFER Guides](https://www.healthit.gov/topic/safety/safer-guides)
- [DEA EPCS Requirements](https://www.deadiversion.usdoj.gov/ecomm/e_rx/)
