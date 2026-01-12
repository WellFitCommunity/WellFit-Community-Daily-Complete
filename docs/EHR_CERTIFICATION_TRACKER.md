# EHR Certification Completion Tracker

**Created:** January 12, 2026
**Target:** ONC Certified EHR with CMS Promoting Interoperability Compliance
**Goal:** Make WellFit/Envision Atlus a "real" EHR that healthcare organizations will adopt

---

## Quick Status Dashboard

| Module | Progress | Blocking? |
|--------|----------|-----------|
| Public Health: Syndromic Surveillance | 0/7 | **YES** |
| Public Health: Immunization Registry | 2/5 | **YES** |
| Public Health: Electronic Case Reporting | 0/6 | **YES** |
| Public Health: Antimicrobial Surveillance | 0/5 | **YES** |
| SAFER Guides Assessment | 0/5 | **YES** |
| Electronic Clinical Quality Measures | 0/8 | **YES** |
| EPCS / PDMP Integration | 0/8 | **YES** |
| ONC Certification Process | 0/6 | **YES** |
| Prior Authorization API | 2/5 | No |
| USCDI v3 Compliance | 12/18 | No |
| DSI Transparency | 1/5 | No |
| Provider Directory API | 2/4 | No |
| Direct Messaging / HIE | 0/5 | No |

---

## PHASE 1: CRITICAL (Must Complete for Market Viability)

### 1. Syndromic Surveillance Reporting

Enables real-time disease monitoring for public health departments.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 1.1 | Create `syndromic_surveillance` database table | | [ ] Pending | | Store reportable encounters |
| 1.2 | Create `syndromic_surveillance_transmissions` table | | [ ] Pending | | Track submission history |
| 1.3 | Build `syndromicSurveillanceService.ts` | | [ ] Pending | | Core business logic |
| 1.4 | Implement HL7 ADT message generator | | [ ] Pending | | A01/A03/A04 messages |
| 1.5 | Create `syndromic-surveillance-submit` edge function | | [ ] Pending | | API endpoint |
| 1.6 | Research state-specific requirements | | [ ] Pending | | TX, FL, CA differ |
| 1.7 | Build admin monitoring dashboard | | [ ] Pending | | Track submissions |

**Acceptance Criteria:**
- [ ] Can generate valid HL7 ADT messages from encounter data
- [ ] Can submit to at least one state health department
- [ ] Tracks all submissions with success/failure status
- [ ] Admin can view submission history and errors

---

### 2. Immunization Registry Reporting (IIS)

Submit vaccinations to state immunization registries.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 2.1 | CVX code support | | [x] Complete | | Already have |
| 2.2 | FHIR Immunization resources | | [x] Complete | | Already have |
| 2.3 | Build HL7 VXU message generator | | [ ] Pending | | Vaccination updates |
| 2.4 | Research state IIS APIs | | [ ] Pending | | Each state is different |
| 2.5 | Create `immunization-registry-submit` edge function | | [ ] Pending | | |

**Acceptance Criteria:**
- [ ] Can generate valid HL7 VXU messages
- [ ] Can submit to target state registry
- [ ] Handles acknowledgment responses
- [ ] Supports bidirectional query (if state supports)

---

### 3. Electronic Case Reporting (eCR)

Automatically report notifiable conditions to public health.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 3.1 | Create `reportable_conditions` reference table | | [ ] Pending | | CDC/state trigger codes |
| 3.2 | Create `electronic_case_reports` table | | [ ] Pending | | Track generated reports |
| 3.3 | Build `ecrService.ts` service | | [ ] Pending | | Detection + generation |
| 3.4 | Implement eICR document generator | | [ ] Pending | | CDA format |
| 3.5 | Integrate RCKMS trigger codes | | [ ] Pending | | Condition detection |
| 3.6 | Create `ecr-submit` edge function | | [ ] Pending | | AIMS Platform |

**Acceptance Criteria:**
- [ ] Automatically detects reportable conditions from diagnoses
- [ ] Generates valid eICR documents
- [ ] Submits to AIMS platform
- [ ] Handles RR (Reportability Response) documents

---

### 4. Antimicrobial Use & Resistance (AU/AR) Surveillance

Track antibiotic usage and resistance patterns for NHSN.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 4.1 | Create `antimicrobial_usage` table | | [ ] Pending | | Track antibiotic Rx |
| 4.2 | Create `antimicrobial_resistance` table | | [ ] Pending | | Lab resistance data |
| 4.3 | Build `antimicrobialSurveillanceService.ts` | | [ ] Pending | | |
| 4.4 | Implement NHSN CDA document generator | | [ ] Pending | | |
| 4.5 | Create `nhsn-submit` edge function | | [ ] Pending | | |

**Acceptance Criteria:**
- [ ] Captures antibiotic prescriptions with appropriate metadata
- [ ] Captures resistance patterns from microbiology results
- [ ] Generates valid NHSN CDA documents
- [ ] Automated monthly submission

---

### 5. SAFER Guides Self-Assessment

ONC's Safety Assurance Factors for EHR Resilience guides.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 5.1 | Create `safer_guide_assessments` table | | [ ] Pending | | Store responses |
| 5.2 | Build `SaferGuidesAssessment.tsx` component | | [ ] Pending | | All 9 guides |
| 5.3 | Create assessment templates for all 9 guides | | [ ] Pending | | JSON config |
| 5.4 | Build attestation report generator | | [ ] Pending | | PDF export |
| 5.5 | Add annual reminder notifications | | [ ] Pending | | |

**9 Required Guides:**
- [ ] High Priority Practices
- [ ] Organizational Responsibilities
- [ ] Contingency Planning
- [ ] System Configuration
- [ ] System Interfaces
- [ ] Patient Identification
- [ ] CPOE with Decision Support
- [ ] Test Results Reporting
- [ ] Clinician Communication

**Acceptance Criteria:**
- [ ] All 9 guide assessments available
- [ ] Responses stored with timestamps
- [ ] Can generate attestation report
- [ ] Annual reminder system works

---

### 6. Electronic Clinical Quality Measures (eCQM)

Calculate and report clinical quality measures to CMS.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 6.1 | Research CQL engine options | | [ ] Pending | | cql-execution vs cqf-ruler |
| 6.2 | Create `ecqm_measures` table | | [ ] Pending | | Measure definitions |
| 6.3 | Create `ecqm_results` table | | [ ] Pending | | Calculation results |
| 6.4 | Build `ecqmCalculationService.ts` | | [ ] Pending | | |
| 6.5 | Implement CQL execution engine | | [ ] Pending | | |
| 6.6 | Build QRDA Category I exporter | | [ ] Pending | | Patient-level |
| 6.7 | Build QRDA Category III exporter | | [ ] Pending | | Aggregate |
| 6.8 | Create `ECQMDashboard.tsx` component | | [ ] Pending | | Provider view |

**Required CMS Measures (6 minimum):**
- [ ] Select measures appropriate for specialty
- [ ] Test calculation against CMS test data
- [ ] Validate QRDA output with CMS tools

**Acceptance Criteria:**
- [ ] Can calculate at least 6 eCQMs
- [ ] QRDA I export validates
- [ ] QRDA III export validates
- [ ] Dashboard shows provider performance

---

### 7. EPCS / PDMP Integration

Electronic prescribing of controlled substances with monitoring.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 7.1 | Research DEA EPCS certification requirements | | [ ] Pending | | 21 CFR 1311 |
| 7.2 | Select identity proofing vendor | | [ ] Pending | | NIST IAL2 |
| 7.3 | Implement prescriber 2FA (hard token) | | [ ] Pending | | DEA required |
| 7.4 | Create `epcs_prescriptions` table | | [ ] Pending | | |
| 7.5 | Build `epcsService.ts` | | [ ] Pending | | |
| 7.6 | Research state PDMP APIs | | [ ] Pending | | State-specific |
| 7.7 | Create `pdmp-query` edge function | | [ ] Pending | | |
| 7.8 | Schedule annual EPCS audit | | [ ] Pending | | $15-30K/yr |

**Acceptance Criteria:**
- [ ] DEA-compliant EPCS workflow
- [ ] Hard token 2FA for prescribers
- [ ] PDMP query before controlled Rx
- [ ] Complete audit trail
- [ ] Annual third-party audit scheduled

---

### 8. ONC Certification Process

Formal certification through ONC-Accredited Certification Body.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 8.1 | Select ONC-ACB | | [ ] Pending | | Drummond, ICSA, or SLI |
| 8.2 | Schedule gap assessment | | [ ] Pending | | |
| 8.3 | Create 170.315 criteria mapping document | | [ ] Pending | | |
| 8.4 | Develop test procedures | | [ ] Pending | | |
| 8.5 | Execute certification testing | | [ ] Pending | | 4-8 weeks |
| 8.6 | Submit for CHPL listing | | [ ] Pending | | |

**170.315 Criteria to Certify:**
- [ ] (a)(1) CPOE - Medications
- [ ] (a)(2) CPOE - Laboratory
- [ ] (a)(3) CPOE - Diagnostic Imaging
- [ ] (a)(4) Drug-Drug, Drug-Allergy Checks
- [ ] (a)(5) Demographics
- [ ] (a)(9) Clinical Decision Support
- [ ] (a)(14) Implantable Device List
- [ ] (b)(1) Transitions of Care
- [ ] (b)(2) Clinical Information Reconciliation
- [ ] (b)(3) Electronic Prescribing
- [ ] (b)(6) Data Export
- [ ] (b)(10) Electronic Health Information Export
- [ ] (c)(1-3) Clinical Quality Measures
- [ ] (d)(1-13) Privacy and Security
- [ ] (e)(1) View, Download, Transmit
- [ ] (f)(1-7) Public Health
- [ ] (g)(4-10) Design & Performance

**Acceptance Criteria:**
- [ ] All selected criteria pass testing
- [ ] Listed on CHPL
- [ ] Can market as "ONC Certified"

---

## PHASE 2: HIGH PRIORITY (Competitive Advantage)

### 9. Prior Authorization API (Da Vinci PAS)

FHIR-based prior authorization for CMS compliance.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 9.1 | Prior auth data model | | [x] Complete | | Tables exist |
| 9.2 | Basic prior auth workflow | | [x] Complete | | |
| 9.3 | Implement Da Vinci PAS FHIR IG | | [ ] Pending | | |
| 9.4 | Build X12 278 transaction generator | | [ ] Pending | | |
| 9.5 | Create `prior-auth-fhir` edge function | | [ ] Pending | | |

---

### 10. USCDI v3 Compliance

Complete all v3 data elements by January 2026 deadline.

| # | Data Element | Owner | Status | Due | Notes |
|---|--------------|-------|--------|-----|-------|
| 10.1 | Patient Demographics | | [x] Complete | | |
| 10.2 | Problems/Conditions | | [x] Complete | | |
| 10.3 | Medications | | [x] Complete | | |
| 10.4 | Allergies | | [x] Complete | | |
| 10.5 | Vital Signs | | [x] Complete | | |
| 10.6 | Laboratory | | [x] Complete | | |
| 10.7 | Procedures | | [x] Complete | | |
| 10.8 | Immunizations | | [x] Complete | | |
| 10.9 | Clinical Notes | | [x] Complete | | |
| 10.10 | Care Team | | [x] Complete | | |
| 10.11 | Goals | | [x] Complete | | |
| 10.12 | Care Plans | | [x] Complete | | |
| 10.13 | Tribal Affiliation | | [ ] Pending | | New in v3 |
| 10.14 | Disability Status | | [ ] Pending | | New in v3 |
| 10.15 | Caregiver Relationships | | [ ] Pending | | Structured |
| 10.16 | Time of Death | | [ ] Pending | | New in v3 |
| 10.17 | Average Blood Pressure | | [ ] Pending | | New in v3 |
| 10.18 | SDOH Goals | | [ ] Pending | | Link to conditions |

---

### 11. DSI Transparency (AI Model Cards)

Document all AI/ML models per HTI-1 requirements.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 11.1 | AI services exist | | [x] Complete | | 45+ models |
| 11.2 | Create model card template | | [ ] Pending | | 31 attributes |
| 11.3 | Document all predictive models | | [ ] Pending | | |
| 11.4 | Build AI transparency dashboard | | [ ] Pending | | |
| 11.5 | Add user-facing AI explanations | | [ ] Pending | | |

---

### 12. Provider Directory API

FHIR-based provider directory for network access.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 12.1 | Practitioner records | | [x] Complete | | |
| 12.2 | PractitionerRole | | [x] Complete | | |
| 12.3 | Da Vinci PDex Plan Net IG | | [ ] Pending | | |
| 12.4 | Public API endpoint | | [ ] Pending | | |

---

### 13. Direct Messaging / HIE

Secure health information exchange via Direct protocol.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 13.1 | Research HISP vendors | | [ ] Pending | | DirectTrust |
| 13.2 | Implement Direct protocol | | [ ] Pending | | RFC 5322 |
| 13.3 | Certificate management | | [ ] Pending | | X.509 |
| 13.4 | XDR/XDM support | | [ ] Pending | | IHE profiles |
| 13.5 | Carequality/CommonWell | | [ ] Pending | | National networks |

---

## Weekly Progress Template

Copy this for weekly status updates:

```markdown
## Week of [DATE]

### Completed This Week
- [ ]

### In Progress
- [ ]

### Blocked
- [ ]

### Next Week Goals
- [ ]

### Risks/Issues
-
```

---

## Milestone Targets

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Public Health Reporting MVP | Q1 2026 | Not Started |
| SAFER Guides Complete | Q1 2026 | Not Started |
| eCQM System MVP | Q2 2026 | Not Started |
| EPCS/PDMP Integration | Q2 2026 | Not Started |
| ONC Certification Testing | Q3 2026 | Not Started |
| CHPL Listing | Q4 2026 | Not Started |
| Full CMS PI Compliance | Q4 2026 | Not Started |

---

## External Dependencies

| Dependency | Vendor/Contact | Status | Notes |
|------------|----------------|--------|-------|
| ONC-ACB Selection | Drummond/ICSA/SLI | Not Started | Need RFP |
| EPCS Audit Vendor | TBD | Not Started | Annual $15-30K |
| HISP Provider | DirectTrust member | Not Started | Monthly fee |
| State IIS APIs | State health depts | Not Started | Per-state |
| State PDMP APIs | State boards | Not Started | Per-state |
| CQL Engine License | TBD | Not Started | May be open source |

---

## Budget Estimates

| Item | One-Time | Annual | Notes |
|------|----------|--------|-------|
| ONC Certification | $50-150K | $10-20K | Initial + maintenance |
| EPCS Third-Party Audit | - | $15-30K | DEA required |
| HISP Services | $5K setup | $5-15K | Direct messaging |
| CQL Engine | $0-50K | $0-20K | Depends on choice |
| Development (internal) | 12-18 mo | - | Team capacity |

**Total Estimated:** $55-205K one-time + $30-85K/year

---

## Contacts & Resources

| Resource | Link |
|----------|------|
| ONC Certification Program | https://www.healthit.gov/topic/certification-ehrs |
| CHPL (Certified Products) | https://chpl.healthit.gov |
| CMS Promoting Interoperability | https://www.cms.gov/medicare/regulations-guidance/promoting-interoperability-programs |
| USCDI Standards | https://www.healthit.gov/isp/united-states-core-data-interoperability-uscdi |
| SAFER Guides | https://www.healthit.gov/topic/safety/safer-guides |
| Da Vinci Implementation Guides | https://www.hl7.org/fhir/us/davinci-alerts/ |
| DEA EPCS Info | https://www.deadiversion.usdoj.gov/ecomm/e_rx/ |

---

## Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-01-12 | Initial tracker created | Claude Code |
