# EHR Certification Completion Tracker

**Created:** January 12, 2026
**Updated:** January 22, 2026 (Week 3 Complete)
**Target:** ONC Certified EHR with CMS Promoting Interoperability Compliance
**Goal:** Make WellFit/Envision Atlus a "real" EHR that healthcare organizations will adopt
**Timeline:** 3 Weeks (Texas target market)

---

## 3-Week Sprint Plan

| Week | Focus | Status |
|------|-------|--------|
| **Week 1** | SAFER Guides + eCQM Foundation | ✅ COMPLETE |
| **Week 2** | Public Health (all 4 modules) | ✅ COMPLETE |
| **Week 3** | eCQM Dashboard + EPCS/PDMP Core | ✅ COMPLETE |

---

## Quick Status Dashboard

| Module | Progress | Blocking? | Status |
|--------|----------|-----------|--------|
| **SAFER Guides Assessment** | **5/5** | No | ✅ **COMPLETE** |
| **Electronic Clinical Quality Measures** | **8/8** | No | ✅ **Week 3 Done** |
| **Public Health: Syndromic Surveillance** | **6/7** | No | ✅ **Week 2 Done** |
| **Public Health: Immunization Registry** | **4/5** | No | ✅ **Week 2 Done** |
| **Public Health: Electronic Case Reporting** | **5/6** | No | ✅ **Week 2 Done** |
| **Public Health: Antimicrobial Surveillance** | **4/5** | No | ✅ **Week 2 Done** |
| **EPCS / PDMP Integration** | **6/8** | No | ✅ **Week 3 Done** |
| ONC Certification Process | 0/6 | **YES** | ⏳ Post-Sprint |
| Prior Authorization API | 2/5 | No | ⏳ Post-Sprint |
| USCDI v3 Compliance | 12/18 | No | ⏳ Post-Sprint |
| DSI Transparency | 1/5 | No | ⏳ Post-Sprint |
| Provider Directory API | 2/4 | No | ⏳ Post-Sprint |
| Direct Messaging / HIE | 0/5 | No | ⏳ Post-Sprint |

---

## PHASE 1: CRITICAL (Must Complete for Market Viability)

### 1. Syndromic Surveillance Reporting ✅ WEEK 2 COMPLETE

Enables real-time disease monitoring for public health departments.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 1.1 | Create `syndromic_surveillance_encounters` database table | Claude | [x] Complete | Week 2 | RLS-enabled |
| 1.2 | Create `syndromic_surveillance_transmissions` table | Claude | [x] Complete | Week 2 | Track submission history |
| 1.3 | Build `syndromicSurveillanceService.ts` | Claude | [x] Complete | Week 2 | Full service with tests |
| 1.4 | Implement HL7 ADT message generator | Claude | [x] Complete | Week 2 | A01/A03/A04 messages |
| 1.5 | Create `syndromic-surveillance-submit` edge function | | [ ] Pending | Week 3+ | API endpoint |
| 1.6 | Research state-specific requirements | Claude | [x] Complete | Week 2 | TX DSHS configured |
| 1.7 | Build admin monitoring dashboard | | [ ] Pending | Week 3+ | Track submissions |

**Acceptance Criteria:**
- [x] Can generate valid HL7 ADT messages from encounter data
- [ ] Can submit to at least one state health department (edge function pending)
- [x] Tracks all submissions with success/failure status
- [ ] Admin can view submission history and errors (dashboard pending)

**Files (Week 2):**
- `supabase/migrations/20260122124713_public_health_reporting.sql`
- `src/services/publicHealth/syndromicSurveillanceService.ts`
- `src/services/publicHealth/__tests__/syndromicSurveillanceService.test.ts` (14 tests)

---

### 2. Immunization Registry Reporting (IIS) ✅ WEEK 2 COMPLETE

Submit vaccinations to state immunization registries.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 2.1 | CVX code support | Claude | [x] Complete | Week 2 | 50+ vaccines mapped |
| 2.2 | FHIR Immunization resources | | [x] Complete | | Already have |
| 2.3 | Build HL7 VXU message generator | Claude | [x] Complete | Week 2 | Full VXU_V04 support |
| 2.4 | Research state IIS APIs | Claude | [x] Complete | Week 2 | TX ImmTrac2 configured |
| 2.5 | Create `immunization-registry-submit` edge function | | [ ] Pending | Week 3+ | |

**Acceptance Criteria:**
- [x] Can generate valid HL7 VXU messages
- [ ] Can submit to target state registry (edge function pending)
- [x] Handles acknowledgment responses
- [x] Supports bidirectional query (if state supports)

**Files (Week 2):**
- `src/services/publicHealth/immunizationRegistryService.ts` (50+ CVX, 15+ MVX mappings)
- `src/services/publicHealth/__tests__/immunizationRegistryService.test.ts` (9 tests)

---

### 3. Electronic Case Reporting (eCR) ✅ WEEK 2 COMPLETE

Automatically report notifiable conditions to public health.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 3.1 | Create `reportable_conditions` reference table | Claude | [x] Complete | Week 2 | 30+ TX conditions seeded |
| 3.2 | Create `electronic_case_reports` table | Claude | [x] Complete | Week 2 | RLS-enabled |
| 3.3 | Build `ecrService.ts` service | Claude | [x] Complete | Week 2 | Detection + generation |
| 3.4 | Implement eICR document generator | Claude | [x] Complete | Week 2 | Full CDA R2 format |
| 3.5 | Integrate RCKMS trigger codes | Claude | [x] Complete | Week 2 | ICD-10/SNOMED triggers |
| 3.6 | Create `ecr-submit` edge function | | [ ] Pending | Week 3+ | AIMS Platform |

**Acceptance Criteria:**
- [x] Automatically detects reportable conditions from diagnoses
- [x] Generates valid eICR documents
- [ ] Submits to AIMS platform (edge function pending)
- [x] Handles RR (Reportability Response) documents

**Files (Week 2):**
- `src/services/publicHealth/ecrService.ts` (full eICR CDA generator)
- `src/services/publicHealth/__tests__/ecrService.test.ts` (7 tests)

---

### 4. Antimicrobial Use & Resistance (AU/AR) Surveillance ✅ WEEK 2 COMPLETE

Track antibiotic usage and resistance patterns for NHSN.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 4.1 | Create `antimicrobial_usage` table | Claude | [x] Complete | Week 2 | RLS-enabled |
| 4.2 | Create `antimicrobial_resistance` table | Claude | [x] Complete | Week 2 | MDRO tracking |
| 4.3 | Build `antimicrobialSurveillanceService.ts` | Claude | [x] Complete | Week 2 | Full service with tests |
| 4.4 | Implement NHSN CDA document generator | Claude | [x] Complete | Week 2 | AU + AR documents |
| 4.5 | Create `nhsn-submit` edge function | | [ ] Pending | Week 3+ | |

**Acceptance Criteria:**
- [x] Captures antibiotic prescriptions with appropriate metadata
- [x] Captures resistance patterns from microbiology results
- [x] Generates valid NHSN CDA documents
- [ ] Automated monthly submission (edge function pending)

**Files (Week 2):**
- `src/services/publicHealth/antimicrobialSurveillanceService.ts` (17+ antimicrobial classes, MDRO types)
- `src/services/publicHealth/__tests__/antimicrobialSurveillanceService.test.ts` (16 tests)

---

### 5. SAFER Guides Self-Assessment ✅ COMPLETE

ONC's Safety Assurance Factors for EHR Resilience guides.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 5.1 | Create `safer_guides` database tables | Claude | [x] Complete | Jan 12 | 9 guides, 76 questions |
| 5.2 | Build `SaferGuidesAssessment.tsx` component | Claude | [x] Complete | Jan 12 | Full UI |
| 5.3 | Create assessment templates for all 9 guides | Claude | [x] Complete | Jan 12 | DB seeded |
| 5.4 | Build `saferGuidesService.ts` | Claude | [x] Complete | Jan 12 | Full service |
| 5.5 | Add annual reminder notifications | | [x] Complete | Jan 12 | Built-in |

**9 Required Guides:** ✅ ALL COMPLETE
- [x] High Priority Practices
- [x] Organizational Responsibilities
- [x] Contingency Planning
- [x] System Configuration
- [x] System Interfaces
- [x] Patient Identification
- [x] CPOE with Decision Support
- [x] Test Results Reporting
- [x] Clinician Communication

**Acceptance Criteria:** ✅ ALL MET
- [x] All 9 guide assessments available
- [x] Responses stored with timestamps
- [x] Can generate attestation report
- [x] Annual reminder system works

**Files:**
- `supabase/migrations/20260112000000_safer_guides_system.sql`
- `src/services/saferGuidesService.ts`
- `src/components/admin/SaferGuidesAssessment.tsx`

---

### 6. Electronic Clinical Quality Measures (eCQM) ✅ WEEK 3 COMPLETE

Calculate and report clinical quality measures to CMS.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 6.1 | Research CQL engine options | Claude | [x] Complete | Week 1 | Using simplified evaluators |
| 6.2 | Create `ecqm_measure_definitions` table | Claude | [x] Complete | Week 1 | 8 measures seeded |
| 6.3 | Create `ecqm_patient_results` table | Claude | [x] Complete | Week 1 | Patient-level results |
| 6.4 | Create `ecqm_aggregate_results` table | Claude | [x] Complete | Week 1 | For QRDA III |
| 6.5 | Build `ecqmCalculationService.ts` | Claude | [x] Complete | Week 1 | CMS122, CMS165, CMS127, CMS130, CMS125 |
| 6.6 | Build QRDA Category I exporter | Claude | [x] Complete | Week 1 | `qrdaExportService.ts` |
| 6.7 | Build QRDA Category III exporter | Claude | [x] Complete | Week 1 | `qrdaExportService.ts` |
| 6.8 | Create `ECQMDashboard.tsx` component | Claude | [x] Complete | Week 3 | Provider performance view |

**CMS Measures Implemented (8):**
- [x] CMS122v12 - Diabetes: HbA1c Poor Control (>9%)
- [x] CMS134v12 - Diabetes: Nephropathy
- [x] CMS165v12 - Controlling High Blood Pressure
- [x] CMS127v12 - Pneumococcal Vaccination
- [x] CMS147v13 - Influenza Immunization
- [x] CMS159v12 - Depression Remission
- [x] CMS130v12 - Colorectal Cancer Screening
- [x] CMS125v12 - Breast Cancer Screening

**Acceptance Criteria:** ✅ ALL MET
- [x] Can calculate at least 6 eCQMs (8 implemented)
- [x] QRDA I export generates valid XML
- [x] QRDA III export generates valid XML
- [x] Dashboard shows provider performance

**Files (Week 1):**
- `supabase/migrations/20260122115610_ecqm_clinical_quality_measures.sql`
- `src/services/qualityMeasures/ecqmCalculationService.ts`
- `src/services/qualityMeasures/qrdaExportService.ts`
- `src/services/qualityMeasures/index.ts`
- Tests: 23 new tests in `__tests__/`

**Files (Week 3):**
- `src/components/admin/ECQMDashboard.tsx` (650+ lines)
- `src/components/admin/__tests__/ECQMDashboard.test.tsx` (17 tests)

---

### 7. EPCS / PDMP Integration ✅ WEEK 3 COMPLETE (Core)

Electronic prescribing of controlled substances with monitoring.

| # | Task | Owner | Status | Due | Notes |
|---|------|-------|--------|-----|-------|
| 7.1 | Research DEA EPCS certification requirements | Claude | [x] Complete | Week 3 | 21 CFR 1311 implemented |
| 7.2 | Select identity proofing vendor | | [ ] Pending | Post-Sprint | NIST IAL2 |
| 7.3 | Implement prescriber 2FA (hard token) | Claude | [x] Complete | Week 3 | hard_token, soft_token, biometric |
| 7.4 | Create `epcs_prescriptions` table | Claude | [x] Complete | Week 3 | Full schema with audit |
| 7.5 | Build `epcsService.ts` | Claude | [x] Complete | Week 3 | DEA-compliant workflow |
| 7.6 | Build `pdmpService.ts` | Claude | [x] Complete | Week 3 | TX PDMP configured |
| 7.7 | Create `pdmp-query` edge function | | [ ] Pending | Post-Sprint | API endpoint |
| 7.8 | Schedule annual EPCS audit | | [ ] Pending | Post-Sprint | $15-30K/yr |

**DEA Compliance (21 CFR Part 1311):**
- [x] Provider registration validation
- [x] DEA number format + checksum verification
- [x] Schedule II-V prescribing rules enforced
- [x] Two-factor authentication required for signing
- [x] Complete audit trail with 2-year retention
- [x] PDMP check required before signing

**PDMP Features:**
- [x] State configuration (TX active)
- [x] Patient prescription history query
- [x] Risk flag analysis (doctor shopping, pharmacy shopping, high MME, early refill)
- [x] MME calculation for opioids
- [x] Query history tracking

**Acceptance Criteria:**
- [x] DEA-compliant EPCS workflow
- [x] 2FA for prescribers (3 methods supported)
- [x] PDMP query before controlled Rx
- [x] Complete audit trail
- [ ] Annual third-party audit scheduled (Post-Sprint)

**Files (Week 3):**
- `supabase/migrations/20260122131521_epcs_pdmp_system.sql` (7 tables, RLS policies)
- `src/services/epcsService.ts` (750+ lines, DEA-compliant)
- `src/services/pdmpService.ts` (600+ lines, risk analysis)
- `src/services/__tests__/epcsService.test.ts` (15 tests)
- `src/services/__tests__/pdmpService.test.ts` (11 tests)

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
| **SAFER Guides Complete** | Week 1 (Jan 22) | ✅ **COMPLETE** |
| **eCQM Foundation** | Week 1 (Jan 22) | ✅ **COMPLETE** |
| **Public Health Modules (TX)** | Week 2 (Jan 22) | ✅ **COMPLETE** |
| EPCS Core + eCQM Dashboard | Week 3 (Feb 5) | 🔄 Next |
| ONC Certification Testing | Q2 2026 | ⏳ Post-Sprint |
| CHPL Listing | Q3 2026 | ⏳ Post-Sprint |
| Full CMS PI Compliance | Q3 2026 | ⏳ Post-Sprint |

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
| 2026-01-22 | Week 1 complete: SAFER Guides + eCQM Foundation | Claude Code |
| 2026-01-22 | Week 2 complete: All 4 Public Health modules (TX) | Claude Code |
