# Cardiology Module Build Tracker

> **Last Updated:** 2026-02-23
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
| Database | BUILT | 9 tables (`card_*`), RLS policies, indexes, triggers (`calc_weight_change`, `update_updated_at`), migration `20260210000000` |
| Types | BUILT | `src/types/cardiology.ts` (579 lines) — 13 enums, 9 interfaces, 5 request types, helpers (CHA2DS2-VASc, LVEF, BNP, weight change) |
| Core Service | BUILT | `src/services/cardiology/cardiologyService.ts` (565 lines) — CRUD, dashboard aggregation, 8 alert types |
| FHIR Mapping | BUILT | `src/services/fhir/cardiology/` — 13 LOINC codes, 17 SNOMED codes, Observation builders for ECG/echo/HF |
| UI Dashboard | BUILT | `src/components/cardiology/` — 5 tabs (Overview, ECG, Heart Failure, Devices, Rehab), alerts component |
| Tests | BUILT | 51 tests (dashboard 12, registry form 13, ECG form 12, echo form 14), missing FHIR observation tests |
| Route | BUILT | `/heart-health` with feature flag `cardiology`, admin section wired |

**Alert Types Implemented (8):**
- STEMI detected on ECG (critical)
- EF < 20% (critical)
- AFib with RVR (high)
- BNP > 1000 pg/mL (high)
- Weight gain >= 2 lbs (medium/high)
- Symptomatic bradycardia (high)
- Device battery end-of-life (high)
- ICD shocks delivered (high)

---

# Phase 1 — Data Entry Forms

> Same gap as oncology: clinicians can VIEW but cannot CREATE data through the UI.

## Session 1: Registry + ECG + Echo Forms — DONE (2026-02-23, commit `87351744`)

| Feature | Status | What Was Built |
|---------|--------|---------------|
| Cardiac Registry Form | BUILT | `CardiacRegistryForm.tsx` (312 lines) — 10 conditions, 10 risk factors, NYHA class with descriptions, baseline LVEF with interpretation, CHA2DS2-VASc auto-calculator (shows for AFib). 13 tests. |
| ECG Result Form | BUILT | `ECGResultForm.tsx` (341 lines) — 14 rhythms, HR, PR/QRS/QTc/axis intervals, ST changes, STEMI flag with cath lab alert, findings, interpretation. FHIR Observation generation. 12 tests. |
| Echo Result Form | BUILT | `EchoResultForm.tsx` (371 lines) — LVEF% with interpretation, RV function, LV dimensions, 4-valve assessment (stenosis + regurgitation), wall motion abnormalities (8 regions), pericardial effusion, diastolic function. FHIR Observation generation. 14 tests. |
| Dashboard Wiring | BUILT | `CardiologyDashboard.tsx` updated (434 lines) — form state management, action buttons, form rendering with success/cancel callbacks. |

**Completed in:** 1 session

---

## Session 2: Heart Failure + Device Monitoring Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Heart Failure Assessment Form | MISSING | Record HF: NYHA class, BNP/NT-proBNP, weight (auto-calculates daily change via trigger), fluid status, edema grade, dyspnea/orthopnea/PND/JVD/crackles/S3 checkboxes, sodium/fluid restrictions. |
| Device Monitoring Form | MISSING | Record interrogation: device type (6 types), manufacturer, model, battery status/%, atrial/ventricular pacing %, lead impedance, sensing/thresholds, shocks delivered, ATP events, alerts. |
| Device Battery Alert Banner | MISSING | Visual alert when battery < 20% or end-of-life status. |

**Depends on:** Session 1 (registry must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 3: Stress Test + Catheterization Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Stress Test Form | MISSING | Record test: protocol (6 types), duration, target/max HR, METs achieved, Duke treadmill score, ischemic changes, symptoms, BP response, imaging findings. |
| Cardiac Catheterization Form | MISSING | Record cath: access site, coronary arteries with stenosis grading per vessel (LAD, LCx, RCA, LMCA), interventions performed, stent details (type, location, diameter, length), hemodynamics, complications. |
| Stress Test Ischemia Localization | MISSING | Map ischemic changes to vessel territories (LAD → anterior/septal, LCx → lateral, RCA → inferior). |

**Depends on:** Session 1 (registry must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 4: Arrhythmia Events + Cardiac Rehab Forms

| Feature | Status | What to Build |
|---------|--------|---------------|
| Arrhythmia Event Form | MISSING | Record event: type (9 types), detected by, duration, HR during event, hemodynamic stability, symptoms, treatment given, cardioversion details. |
| Cardiac Rehab Session Form | MISSING | Log session: phase (1-3), session number, exercise type, HR monitoring (rest/peak/recovery), BP, METs achieved, RPE (6-20 Borg scale), symptoms, functional notes. |
| Rehab Enrollment Workflow | MISSING | Enroll patient in rehab: select phase, set total sessions, exercise prescription, HR targets, contraindications. Track phase progression. |

**Depends on:** Session 1 (registry must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 5: Anticoagulation Tracking (NEW — Critical Gap)

| Feature | Status | What to Build |
|---------|--------|---------------|
| Anticoagulation Tracking Table | MISSING | New DB table `card_anticoagulation_tracking`: patient_id, registry_id, medication (warfarin/apixaban/rivaroxaban/edoxaban/dabigatran), dose, INR (for warfarin), target INR range, date_checked, next_check_date, adherence_score, complications. |
| INR Monitoring Form | MISSING | Record INR: value, target range, dose adjustment, next check date. Flag sub/supra-therapeutic values. |
| DOAC Adherence Form | MISSING | Track DOAC compliance: medication, dose, last filled date, days supply, adherence %. |
| Anticoagulation Dashboard Tab | MISSING | New tab in CardiologyDashboard: INR trend chart, therapeutic time-in-range %, dose history, bleeding risk alerts. |
| Drug Interaction Alerts | MISSING | Integrate with `drugInteractionService` for cardiac-specific interactions: warfarin + NSAIDs, warfarin + amiodarone, DOACs + P-gp inhibitors. |

**Depends on:** Session 1 (registry must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 6: Cardiology Office Dashboard + Vitals Integration

| Feature | Status | What to Build |
|---------|--------|---------------|
| Cardiology Office Dashboard | MISSING | Dedicated route `/cardiology-office` — tabbed dashboard: patient priority, active HF monitoring, ECG review queue, device alerts, anticoagulation tracking, rehab scheduling. |
| Community Vitals Integration | MISSING | Pull BP, HR, weight from `check_ins` table into cardiology dashboard. Show home-generated vitals alongside clinical readings for trend comparison. |
| Automated Vital Sign Alerts | MISSING | Trigger alerts for BP > 180/120, HR > 120 or < 50, weight gain > 3 lbs in 24h from home vitals. |

**Depends on:** Sessions 1-5 (all forms complete)
**Estimated effort:** 1 session (~4 hours)

---

# Phase 2 — Edge Functions (Data Ingestion API)

## Session 7: Core Cardiology Edge Functions

| Feature | Status | What to Build |
|---------|--------|---------------|
| `cardiology-create-registry` | MISSING | Edge function: validate + insert cardiac registry, auto-calculate CHA2DS2-VASc, audit logging, FHIR Condition generation. |
| `cardiology-record-ecg` | MISSING | Edge function: insert ECG result, auto-flag STEMI, generate FHIR Observations for HR/rhythm/intervals. |
| `cardiology-record-echo` | MISSING | Edge function: insert echo result, interpret LVEF, generate FHIR Observations. |
| `cardiology-record-hf` | MISSING | Edge function: insert HF assessment, auto-calculate weight change, generate BNP FHIR Observation, trigger decompensation alert if criteria met. |

**Depends on:** Phase 1 (forms call these edge functions)
**Estimated effort:** 1 session (~4 hours)

---

## Session 8: Alert + Device + Rehab Edge Functions

| Feature | Status | What to Build |
|---------|--------|---------------|
| `cardiology-alert-dispatch` | MISSING | Edge function: evaluate active cardiac patients for alert conditions (STEMI, low EF, AFib RVR, BNP spike, weight gain, device battery), send notifications to care team. |
| `cardiology-record-device` | MISSING | Edge function: insert device interrogation, flag battery end-of-life, flag ICD shocks, generate device summary for provider. |
| `cardiology-record-anticoag` | MISSING | Edge function: insert INR/DOAC record, flag sub/supra-therapeutic INR, calculate time-in-therapeutic-range. |
| `cardiology-rehab-session` | MISSING | Edge function: log rehab session, track phase progression, calculate completion %. |

**Depends on:** Session 7 (core functions must exist)
**Estimated effort:** 1 session (~4 hours)

---

# Phase 3 — AI Services

## Session 9: AI Risk Analysis + AFib Management

| Feature | Status | What to Build |
|---------|--------|---------------|
| `ai-cardiac-risk-analyzer` | MISSING | AI skill: chest pain risk stratification using HEART score components, troponin trends, ECG findings. Register in `ai_skills` table. Decision support only. |
| `ai-afib-management-advisor` | MISSING | AI skill: anticoagulation recommendation based on CHA2DS2-VASc, HAS-BLED, current medications, renal function. Suggest rate vs rhythm control strategy. |

**Depends on:** Phase 2 (edge functions generate data for AI)
**Estimated effort:** 1 session (~4 hours)

---

## Session 10: AI HF Prediction + Patient Summary

| Feature | Status | What to Build |
|---------|--------|---------------|
| `ai-hf-decompensation-predictor` | MISSING | AI skill: predict HF exacerbation from weight trends, BNP trajectory, vital sign patterns, medication adherence. Early warning for readmission prevention. |
| `ai-cardiac-patient-summary` | MISSING | AI skill: generate narrative cardiac summary for care team — diagnosis, EF history, medication regimen, device status, rehab progress, recent events. |
| `ai-ecg-interpreter` | MISSING | AI skill: assist with ECG interpretation — flag STEMI patterns, long QT, Brugada markers, new-onset AFib. Not replacing cardiologist — flagging for review. |

**Depends on:** Sessions 7-8 (data must exist for AI)
**Estimated effort:** 1 session (~4 hours)

---

# Phase 4 — Advanced Features

## Session 11: PCI Outcomes + Enhanced Echo

| Feature | Status | What to Build |
|---------|--------|---------------|
| PCI Outcomes Table | MISSING | New DB table `card_pci_outcomes`: patient_id, cath_report_id, stent_type, vessel, location, diameter, length, deployment_pressure, result (TIMI flow grade), complications, follow-up dates. |
| PCI Outcomes Form | MISSING | Record PCI: stent details, post-procedure TIMI flow, complications, dual antiplatelet therapy duration, next angiography date. |
| Enhanced Echo Assessment | MISSING | Add diastolic dysfunction grading (E/A ratio, E/e', LA pressure), right heart markers (TAPSE, FAC), strain imaging (GLS). |
| Re-stenosis Monitoring | MISSING | Track stent patency over time, flag symptoms suggestive of re-stenosis. |

**Depends on:** Phase 1 (cath form must exist)
**Estimated effort:** 1 session (~4 hours)

---

## Session 12: EHR Integration + Device Telemetry

| Feature | Status | What to Build |
|---------|--------|---------------|
| Lab result importer | MISSING | HL7/FHIR inbound for cardiac labs (troponin, BNP, lipid panel, INR) from hospital LIS → `card_heart_failure` / `card_anticoagulation_tracking`. |
| ECG data importer | MISSING | Parse structured ECG data (GE MUSE, Philips) into `card_ecg_results`. |
| Device telemetry connector | MISSING | API integration for remote device monitoring (Medtronic CareLink, Boston Scientific LATITUDE, Abbott Merlin). |
| Outbound FHIR export | MISSING | Export cardiac Conditions, Procedures, Observations to external EHR systems. |

**Depends on:** Phase 2 (edge functions provide data layer)
**Estimated effort:** 1-2 sessions (~4-8 hours)

---

## Session 13: Billing Integration + Patient Education

| Feature | Status | What to Build |
|---------|--------|---------------|
| Billing automation | MISSING | Integrate `CARDIAC_BILLING_CODES` (CPT 93000, 93306, 93350, 93452, 93289, 93798, 78452) with encounter billing bridge. Auto-suggest codes based on recorded procedures. |
| Patient education content | MISSING | HF self-management: daily weight tracking, sodium restriction (<2g/day), fluid restriction (<2L/day), medication adherence. Cardiac risk factor education: smoking cessation, exercise, lipid management. |
| Medication titration tracking | MISSING | Track beta-blocker, ACE-I/ARB, ARNI, MRA titration to target doses per GDMT (guideline-directed medical therapy). |

**Depends on:** Phase 1 (forms must exist)
**Estimated effort:** 1 session (~4 hours)

---

# Overall Summary

| Phase | Sessions | Status | What It Delivers |
|-------|----------|--------|-----------------|
| Foundation | — | BUILT | Read-only dashboard, types, DB (9 tables), FHIR, 8 alert types |
| Phase 1: Data Entry | 6 sessions | SESSION 1 DONE | All clinical forms + anticoagulation + office dashboard + vitals integration |
| Phase 2: Edge Functions | 2 sessions | MISSING | API layer for data ingestion + clinical alerts |
| Phase 3: AI Services | 2 sessions | MISSING | Risk analysis, AFib advisor, HF predictor, ECG interpreter, patient summary |
| Phase 4: Advanced | 2-3 sessions | MISSING | PCI outcomes, enhanced echo, EHR integration, billing, patient education |

**MVP (Phases 1-2):** 8 sessions — clinicians can enter and manage all cardiac data
**Full Production (all phases):** 12-13 sessions — complete cardiology vertical with AI + EHR

---

# Build Priority

| Priority | Session | What | Why First |
|----------|---------|------|-----------|
| P1 | Session 1 | Registry + ECG + Echo forms | Can't track a cardiac patient without a diagnosis and baseline studies |
| P2 | Session 2 | Heart Failure + Device forms | HF is the #1 cardiac readmission driver — must track early |
| P3 | Session 3 | Stress Test + Cath forms | Completes diagnostic workup — drives intervention decisions |
| P4 | Session 4 | Arrhythmia + Rehab forms | Arrhythmia events are safety-critical; rehab is revenue (CPT 93798) |
| P5 | Session 5 | Anticoagulation tracking | **Critical clinical gap** — AFib patients on blood thinners need INR/DOAC monitoring |
| P6 | Session 6 | Office dashboard + vitals | Aggregated physician view + home vital sign integration |
| P7 | Session 7 | Core edge functions | API layer for ECG/echo/HF data ingestion |
| P8 | Session 8 | Alert + device + rehab functions | Automated clinical safety alerts |
| P9 | Session 9 | AI risk + AFib advisor | HEART score, CHA2DS2-VASc integration, anticoag recommendations |
| P10 | Session 10 | AI HF predictor + summary | Readmission prevention + tumor board prep equivalent |
| P11 | Session 11 | PCI outcomes + enhanced echo | Long-term intervention tracking |
| P12 | Session 12 | EHR integration + device telemetry | Hospital system connectivity |
| P13 | Session 13 | Billing + education + med titration | Revenue capture + patient engagement |
