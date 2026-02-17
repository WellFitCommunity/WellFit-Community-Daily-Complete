# Oncology Module Build Tracker

> **Last Updated:** 2026-02-17
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| BUILT | Exists in codebase, functional |
| PARTIAL | Infrastructure exists, gaps remain |
| MISSING | Not built yet |

---

## Foundation (Complete)

| Layer | Status | What Exists |
|-------|--------|-------------|
| Database | BUILT | 10 tables (`onc_*`), RLS policies, indexes, 8 seeded regimens, migration `20260210000002` |
| Types | BUILT | `src/types/oncology.ts` (432 lines) — 15 enums, 10 interfaces, 4 clinical helpers, 5 constants |
| Core Service | BUILT | `src/services/oncology/oncologyService.ts` (418 lines) — CRUD, dashboard aggregation, 8 alert types |
| FHIR Mapping | BUILT | `src/services/fhir/oncology/` — LOINC codes, SNOMED codes, Observation builders |
| UI Dashboard | BUILT | `src/components/oncology/` — 5 tabs (Overview, Treatment, Labs, Imaging, Survivorship) |
| Tests | BUILT | 11 tests passing — dashboard + service + helper functions |
| Route | BUILT | `/cancer-care` with feature flag `oncology`, admin section wired |

---

# Phase 1 — Data Entry Forms

> Clinicians can VIEW oncology data but cannot CREATE it. These forms close that gap.

## Session 1: Cancer Registry + TNM Staging Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Cancer Registry Form | MISSING | Create/edit form: cancer type (ICD-10 search), histology, grade, ECOG status, biomarkers, diagnosis date. Validate against `onc_cancer_registry` schema. |
| TNM Staging Form | MISSING | Record staging: T/N/M dropdowns (AJCC 8th edition values from enums), overall stage auto-calculated, staging date, method (clinical/pathological). |
| Registry List View | MISSING | Table of patient's cancer diagnoses with status badges, click to edit. |

**Depends on:** Nothing (foundation is complete)
**Estimated effort:** 1 session (~4 hours)

---

## Session 2: Treatment Plan + Chemotherapy Session Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Treatment Plan Form | MISSING | Create plan: select regimen (from `onc_standard_regimens` or custom), modality, intent (curative/palliative/adjuvant/neoadjuvant), planned cycles, start date. Link to registry. |
| Chemotherapy Session Form | MISSING | Log infusion: cycle number, drugs administered (multi-select), doses, pre-meds, vitals (pre/post), modifications, adverse events during session, next scheduled date. |
| Treatment Timeline View | MISSING | Visual timeline of treatment plan with completed/upcoming cycles. |

**Depends on:** Session 1 (registry must exist to link treatment plan)
**Estimated effort:** 1 session (~4 hours)

---

## Session 3: Radiation + Side Effects Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Radiation Session Form | MISSING | Log fraction: fraction number/total, dose (cGy), technique (IMRT/3D-CRT/SBRT/proton), treatment site, machine, duration, skin reaction grade. |
| CTCAE Side Effect Form | MISSING | Record adverse event: category dropdown (from `CTCAECategory` enum), specific event, CTCAE grade (1-5), onset date, resolution date, intervention, outcome. |
| Side Effects Summary | MISSING | Table of active side effects sorted by grade, with resolution tracking. |

**Depends on:** Session 2 (treatment plan must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 4: Lab Monitoring + Imaging Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Lab Monitoring Form | MISSING | Record labs: WBC, ANC, hemoglobin, platelets, creatinine, ALT, AST, tumor markers (CEA, CA-125, CA 19-9, PSA, AFP, HCG). Auto-flag critical values using existing helper functions. |
| Imaging Results Form | MISSING | Record scan: modality, date, RECIST response (auto-calculate from lesion measurements using existing `calculateRECIST()`), target lesion sum, findings text, new lesions flag. |
| Lab Trend Chart | MISSING | Line chart showing lab values over time with normal range bands. |

**Depends on:** Session 1 (registry must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 5: Survivorship + Oncology Office Dashboard

| Feature | Status | What to Build |
|---------|--------|---------------|
| Survivorship Assessment Form | MISSING | Record status: survivorship status, remission date, QoL score (1-100), late effects (multi-select), psychosocial concerns, surveillance plan. |
| Oncology Office Dashboard | MISSING | Dedicated route `/oncology-office` — tabbed dashboard aggregating: patient priority, active treatment tracking, lab monitoring alerts, imaging schedule, side effect management. Similar pattern to physician/nurse office dashboards. |
| Navigation from Physician/Nurse Office | MISSING | Quick-link button to oncology office from physician and nurse office dashboards. |

**Depends on:** Sessions 1-4 (all forms complete)
**Estimated effort:** 1 session (~4 hours)

---

# Phase 2 — Edge Functions (Data Ingestion API)

## Session 6: Core Oncology Edge Functions

| Feature | Status | What to Build |
|---------|--------|---------------|
| `oncology-create-registry` | MISSING | Edge function: validate + insert cancer registry entry with tenant resolution, audit logging, FHIR observation generation for staging. |
| `oncology-record-treatment` | MISSING | Edge function: create treatment plan, log chemo/radiation sessions, validate drug doses against regimen protocol. |
| `oncology-record-labs` | MISSING | Edge function: insert lab monitoring entry, auto-generate alerts for critical values (febrile neutropenia, severe anemia, thrombocytopenia), create FHIR Observations. |
| `oncology-record-imaging` | MISSING | Edge function: insert imaging result, auto-calculate RECIST from lesion measurements, flag new metastasis, create FHIR Observations. |

**Depends on:** Phase 1 (forms call these edge functions)
**Estimated effort:** 1 session (~4 hours)

---

## Session 7: Alert + Side Effect Edge Functions

| Feature | Status | What to Build |
|---------|--------|---------------|
| `oncology-alert-dispatch` | MISSING | Edge function: evaluate all active oncology patients for alert conditions, send notifications to care team for critical alerts (febrile neutropenia, grade 4-5 AEs). |
| `oncology-record-side-effect` | MISSING | Edge function: insert CTCAE side effect, auto-escalate grade 4-5 to attending physician, audit trail. |
| `oncology-survivorship-assessment` | MISSING | Edge function: insert survivorship record, generate follow-up surveillance schedule. |

**Depends on:** Session 6 (core functions must exist)
**Estimated effort:** 1 session (~4 hours)

---

# Phase 3 — AI Services

## Session 8: AI Alert Escalation + Treatment Recommendations

| Feature | Status | What to Build |
|---------|--------|---------------|
| `ai-oncology-alert-escalator` | MISSING | AI skill: refine alert severity based on patient history, comorbidities, treatment phase. Register in `ai_skills` table. |
| `ai-oncology-treatment-advisor` | MISSING | AI skill: suggest dose modifications based on lab values + side effects + NCCN guidelines. Not prescriptive — decision support only. |

**Depends on:** Phase 2 (edge functions generate data for AI to analyze)
**Estimated effort:** 1 session (~4 hours)

---

## Session 9: AI RECIST Calculator + Patient Summary

| Feature | Status | What to Build |
|---------|--------|---------------|
| `ai-recist-assessment` | MISSING | AI skill: analyze imaging report text to extract lesion measurements and auto-calculate RECIST 1.1 response. Supplements manual entry. |
| `ai-oncology-patient-summary` | MISSING | AI skill: generate narrative oncology summary for tumor board / care team meetings — diagnosis, staging, treatment history, response, current status. |

**Depends on:** Sessions 6-7 (data must exist for AI to summarize)
**Estimated effort:** 1 session (~4 hours)

---

# Phase 4 — EHR Integration

## Session 10: Lab + Imaging Import

| Feature | Status | What to Build |
|---------|--------|---------------|
| Oncology lab result importer | MISSING | HL7/FHIR inbound receiver for lab results from hospital LIS — map to `onc_lab_monitoring`, auto-flag critical values. |
| Imaging report importer | MISSING | Parse radiology reports (HL7 ORU or FHIR DiagnosticReport) into `onc_imaging_results`, extract RECIST-relevant data. |
| Outbound FHIR export | MISSING | Export oncology Conditions, Procedures, MedicationRequests to external EHR systems. |

**Depends on:** Phase 2 (edge functions provide data layer)
**Estimated effort:** 1-2 sessions (~4-8 hours)

---

## Session 11: Scheduling + Reminders

| Feature | Status | What to Build |
|---------|--------|---------------|
| Chemo infusion scheduling | MISSING | Database table for infusion appointments, calendar UI, chair/room assignment. |
| Radiation scheduling | MISSING | Daily fraction scheduling, vault assignment, treatment plan linkage. |
| Pre-chemo lab order generation | MISSING | Auto-generate lab order 2-3 days before scheduled chemo (CBC, CMP required before infusion). |
| Appointment reminders | MISSING | SMS/push notification for upcoming chemo/radiation appointments. |

**Depends on:** Phase 1 (treatment plans define the schedule)
**Estimated effort:** 1-2 sessions (~4-8 hours)

---

# Overall Summary

| Phase | Sessions | Status | What It Delivers |
|-------|----------|--------|-----------------|
| Foundation | — | BUILT | Read-only dashboard, types, DB, FHIR, tests |
| Phase 1: Data Entry | 5 sessions | MISSING | Clinicians can create/edit all oncology data |
| Phase 2: Edge Functions | 2 sessions | MISSING | API layer for data ingestion + alerts |
| Phase 3: AI Services | 2 sessions | MISSING | AI-powered decision support + summaries |
| Phase 4: EHR Integration | 2-3 sessions | MISSING | Hospital system connectivity + scheduling |

**MVP (Phases 1-2):** 7 sessions — clinicians can enter and manage oncology data
**Full Production (all phases):** 11-12 sessions — complete oncology vertical with AI + EHR

---

# Build Priority

| Priority | Session | What | Why First |
|----------|---------|------|-----------|
| P1 | Session 1 | Registry + Staging forms | Can't do anything without a cancer diagnosis on file |
| P2 | Session 2 | Treatment Plan + Chemo forms | Core workflow — tracking what treatment the patient receives |
| P3 | Session 3 | Radiation + Side Effects forms | Completes the treatment tracking loop |
| P4 | Session 4 | Lab Monitoring + Imaging forms | Response assessment — is the treatment working? |
| P5 | Session 5 | Survivorship + Office Dashboard | Completes patient journey from diagnosis to survivorship |
| P6 | Session 6 | Core edge functions | API layer for programmatic data ingestion |
| P7 | Session 7 | Alert + Side Effect edge functions | Automated clinical safety alerts |
| P8 | Session 8 | AI Alert + Treatment advisor | AI-powered clinical decision support |
| P9 | Session 9 | AI RECIST + Summary | AI-powered response assessment + tumor board prep |
| P10 | Session 10 | Lab/Imaging import | Hospital EHR connectivity |
| P11 | Session 11 | Scheduling + Reminders | Appointment management |
