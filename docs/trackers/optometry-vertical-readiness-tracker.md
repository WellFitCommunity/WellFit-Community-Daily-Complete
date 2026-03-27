# Optometry Vertical Readiness Tracker

> **Last Updated:** 2026-03-25
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **RFP Reference:** RFP-730-UofH-3074 — University of Houston College of Optometry, Electronic Medical Record FY26
> **Estimated Effort:** ~84–92 hours across 12–13 sessions

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| HAVE | Already exists in codebase, functional |
| COUPLE | Existing infrastructure — just needs wiring to optometry |
| BUILD | Must be built from scratch |

---

## Executive Summary

Envision ATLUS already has **~70% of what an optometry EMR needs** through its shared clinical infrastructure (FHIR, billing, auth, patient portal, AI). The remaining **~30% is optometry-specific clinical content** — the exam types, visual acuity charting, prescription management, and optical dispensary that make it feel like an eye care system, not a generic EHR.

The dental module (`supabase/migrations/20251109000000_dental_health_module.sql`) is the build template. Every optometry component follows the same pattern: migration → types → service → FHIR mapping → dashboard → tests → route wiring.

---

## Part 1 — What We Already HAVE (No Work Needed)

These are production-ready capabilities that directly satisfy optometry EMR requirements.

### 1A. Core EHR Platform

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| Patient demographics & scheduling | `profiles`, `appointments` tables | Every EMR needs this |
| Multi-provider authentication | `AuthContext`, `AdminAuthContext`, `EnvisionAuthContext` | Faculty + student + staff logins |
| Role-based access control (RBAC) | `user_roles` table + RLS policies | Preceptor vs student permissions |
| Audit logging (HIPAA) | `audit_logs`, `phi_access_logs`, `auditLogger` service | Compliance requirement |
| Session management & timeout | `SessionTimeoutContext` | HIPAA § 164.312(a)(2)(iii) |
| Multi-tenant isolation | `tenant_id` + `get_current_tenant_id()` RLS | UH as a tenant |
| Passkey/biometric login | `passkey_credentials` table + edge functions | Modern auth (just completed 2026-03-24) |

### 1B. FHIR R4 Interoperability

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| FHIR R4 server | `supabase/functions/fhir-r4/` | ONC certification pathway |
| 14+ FHIR resource types | `src/types/fhir/` (7 modules) | Patient, Observation, Condition, Procedure, MedicationRequest, etc. |
| C-CDA export | `supabase/functions/ccda-export/` | Health information exchange |
| HL7 v2.x messaging | `supabase/functions/hl7-receive/` | Lab interface integration |
| FHIR semantic mapping (AI) | `supabase/functions/ai-fhir-semantic-mapper/` | Auto-maps non-standard data |
| Patient data export (Cures Act) | My Health Hub (`/my-health`) | 21st Century Cures Act compliance |

### 1C. Billing & Claims

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| Full claims lifecycle | `claims`, `claim_lines`, `claim_status_history` | Submit, track, appeal |
| 837P generation | `supabase/functions/generate-837p/` | Electronic claim submission |
| Clearinghouse integration | `clearinghouse_config`, MCP server | Route claims to payers |
| ICD-10, CPT, HCPCS code tables | `code_icd`, `code_cpt`, `code_hcpcs` | Diagnosis + procedure coding |
| AI coding suggestions | `supabase/functions/coding-suggest/` | Auto-suggest codes from notes |
| Fee schedules | `fee_schedules`, `fee_schedule_rates` | Contracted rate management |
| Remittance processing | `remittances` table, MCP clearinghouse | ERA/835 posting |

### 1D. Clinical Documentation

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| SOAP note generation (AI) | `supabase/functions/ai-soap-note-generator/` | Clinical documentation |
| Progress note synthesis (AI) | `supabase/functions/ai-progress-note-synthesizer/` | Visit summaries |
| Note locking & amendments | `clinical_notes`, `clinical_note_amendments` | Legal record integrity |
| Field-level provenance | `clinical_field_provenance` | Who entered what, when |
| Care plan generation (AI) | `supabase/functions/ai-care-plan-generator/` | Treatment planning |

### 1E. Medication Management

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| Medication tracking | `medications`, `medication_doses_taken` | Eye drops, oral meds |
| Drug interaction checking | `supabase/functions/check-drug-interactions/` | Safety alerts |
| AI medication reconciliation | `supabase/functions/ai-medication-reconciliation/` | Med review |
| Allergy/intolerance tracking | `allergy_intolerances` table | Critical for prescribing |
| AI medication instructions | `supabase/functions/ai-medication-instructions/` | Patient education |

### 1F. Patient Engagement (WellFit Side)

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| Daily check-ins | `check_ins`, `create-checkin` edge function | Post-procedure follow-up |
| Patient portal | My Health Hub — meds, conditions, labs, export | Patient access to records |
| Appointment reminders | `supabase/functions/send-appointment-reminder/` | No-show reduction |
| Telehealth video visits | `supabase/functions/create-telehealth-room/` | Remote consultations |
| SMS messaging | `supabase/functions/send-sms/` | Appointment confirmations |

### 1G. Provider Infrastructure

| Capability | Where It Lives | RFP Relevance |
|------------|---------------|---------------|
| NPI registry with optometry taxonomy | `mcp-npi-registry-server` — code `152W00000X` | Provider validation |
| Ophthalmology taxonomy | Same — code `207W00000X` | Referral to ophthalmologist |
| Provider workload tracking | `provider_workload_metrics` view | Clinic scheduling |
| Shift handoff | `handoff_packets`, `handoff_sections` | Student-to-preceptor handoff |

---

## Part 2 — COUPLINGS (Existing Infrastructure, Needs Wiring)

These capabilities exist but need optometry-specific configuration or data seeding.

### 2A. Optometry CPT Code Seeding

**Status:** COUPLE — `code_cpt` table exists, needs optometry codes seeded

**What exists:** CPT code table with 500+ codes, AI coding suggest engine
**What to add:** Optometry-specific CPT code seed migration

| CPT Code | Description | Category |
|----------|-------------|----------|
| 92002 | Ophthalmological services — new patient, intermediate | Eye exam |
| 92004 | Ophthalmological services — new patient, comprehensive | Eye exam |
| 92012 | Ophthalmological services — established, intermediate | Eye exam |
| 92014 | Ophthalmological services — established, comprehensive | Eye exam |
| 92015 | Refraction | Refraction |
| 92060 | Sensorimotor exam | Binocular vision |
| 92081 | Visual field, limited | Visual field |
| 92082 | Visual field, intermediate | Visual field |
| 92083 | Visual field, extended | Visual field |
| 92100 | Serial tonometry | Glaucoma |
| 92132 | Scanning computerized ophthalmic imaging, anterior segment (OCT) | Imaging |
| 92133 | Scanning computerized ophthalmic imaging, posterior segment (OCT-RNFL) | Imaging |
| 92134 | Scanning computerized ophthalmic imaging, retina (OCT-macula) | Imaging |
| 92136 | Ophthalmic biometry (IOL calc) | Surgery planning |
| 92225 | Ophthalmoscopy, extended, initial | Fundus |
| 92226 | Ophthalmoscopy, extended, subsequent | Fundus |
| 92250 | Fundus photography | Imaging |
| 92285 | External ocular photography | Imaging |
| 92310 | Contact lens fitting, corneal | Contact lens |
| 92311 | Contact lens fitting, corneal, toric | Contact lens |
| 92312 | Contact lens fitting, corneal, bifocal | Contact lens |
| 92313 | Contact lens fitting, keratoconus | Contact lens |
| 92314 | Rx of optical/contact lens | Dispensing |
| 92340 | Spectacle fitting, single vision | Dispensing |
| 92341 | Spectacle fitting, bifocal | Dispensing |
| 92342 | Spectacle fitting, multifocal | Dispensing |
| 99173 | Visual acuity screening | Screening |
| 76511–76519 | Ophthalmic ultrasound (B-scan, A-scan) | Imaging |

**Effort:** ~4 hours (1 session) — seed migration + verify AI coding suggest picks them up
**Coupling file:** `supabase/migrations/` (new migration file)

---

### 2B. Optometry ICD-10 Code Seeding

**Status:** COUPLE — `code_icd` table exists, needs optometry-relevant diagnosis codes

| ICD-10 | Description | Category |
|--------|-------------|----------|
| H52.0 | Hypermetropia (farsightedness) | Refractive |
| H52.1 | Myopia (nearsightedness) | Refractive |
| H52.2 | Astigmatism | Refractive |
| H52.4 | Presbyopia | Refractive |
| H40.001–H40.9 | Glaucoma (all types) | Glaucoma |
| H40.10–H40.12 | Primary open-angle glaucoma | Glaucoma |
| H40.20 | Primary angle-closure glaucoma | Glaucoma |
| H25.0–H26.9 | Cataracts | Lens |
| H33.0–H33.5 | Retinal detachments & breaks | Retina |
| H35.30–H35.36 | Age-related macular degeneration | Retina |
| E08.3–E13.3 | Diabetic retinopathy | Retina/Systemic |
| H10.0–H10.9 | Conjunctivitis | Anterior segment |
| H04.1 | Dry eye syndrome | Anterior segment |
| H16.0–H16.9 | Keratitis | Cornea |
| H18.6 | Keratoconus | Cornea |
| H50.0–H50.9 | Strabismus | Binocular vision |
| H51.1 | Convergence insufficiency | Binocular vision |
| H47.1 | Papilledema | Neuro-ophthalmic |
| H46 | Optic neuritis | Neuro-ophthalmic |
| H02.4 | Ptosis | Lids/adnexa |

**Effort:** ~2 hours — seed migration
**Coupling file:** `supabase/migrations/` (same or separate migration)

---

### 2C. Route & Admin Panel Wiring

**Status:** COUPLE — 6 files need a one-line addition each

| # | File | What to Add |
|---|------|-------------|
| 1 | `src/routes/routeConfig.ts` (~line 76) | `{ path: '/eye-health', component: 'OptometryDashboard', auth: 'user', category: 'protected', featureFlag: 'optometry' }` |
| 2 | `src/routes/lazyComponents.tsx` (~line 260) | `export const OptometryDashboard = React.lazy(() => import('../components/optometry/OptometryDashboard'));` + add to componentList |
| 3 | `src/components/admin/sections/lazyImports.tsx` (~line 44) | `export const OptometryDashboard = lazy(() => import('../../optometry/OptometryDashboard'));` |
| 4 | `src/components/admin/sections/sectionDefinitions.tsx` (~line 250) | Section definition with `id: 'optometry'`, `icon: '👁️'`, `category: 'clinical'` |
| 5 | `src/types/tenantModules.ts` (~line 26) | `optometry_enabled: boolean;` and `optometry_entitled: boolean;` |
| 6 | `supabase/migrations/` | `ALTER TABLE tenant_module_config ADD COLUMN optometry_enabled BOOLEAN DEFAULT false, ADD COLUMN optometry_entitled BOOLEAN DEFAULT false;` |

**Effort:** ~1 hour — mechanical wiring, same pattern as dental/cardiology

---

### 2D. FHIR Observation Mapping for Eye Measurements

**Status:** COUPLE — FHIR Observation service exists, needs optometry LOINC codes

| LOINC Code | Description | Maps To |
|------------|-------------|---------|
| 79880-1 | Visual acuity, right eye, distance | VA charting |
| 79881-9 | Visual acuity, left eye, distance | VA charting |
| 79882-7 | Visual acuity, right eye, near | VA charting |
| 79883-5 | Visual acuity, left eye, near | VA charting |
| 56844-4 | Intraocular pressure, right eye | Tonometry |
| 56845-1 | Intraocular pressure, left eye | Tonometry |
| 29271-4 | Sphere, right eye | Refraction |
| 29272-2 | Sphere, left eye | Refraction |
| 29273-0 | Cylinder, right eye | Refraction |
| 29274-8 | Cylinder, left eye | Refraction |
| 29275-5 | Axis, right eye | Refraction |
| 29276-3 | Axis, left eye | Refraction |
| 79846-2 | Pupillary distance | Dispensing |
| 8310-5 | Cup-to-disc ratio | Glaucoma |

**Effort:** ~4 hours — create `src/services/fhir/optometry/` directory following dental pattern
**Pattern file:** `src/services/fhir/dental/DentalObservationService.ts`

---

### 2E. AI Edge Function Configuration

**Status:** COUPLE — AI skill registry and edge function infrastructure exist

| AI Capability | Existing Infrastructure | Optometry Use |
|---------------|------------------------|---------------|
| SOAP note generation | `ai-soap-note-generator` | Eye exam SOAP notes |
| Coding suggestions | `coding-suggest` | Auto-suggest 920xx CPT codes |
| Drug interaction checks | `check-drug-interactions` | Topical + systemic interaction |
| Care plan generation | `ai-care-plan-generator` | Glaucoma management plans |
| Patient education | `ai-patient-education` | Post-dilation instructions, contact lens care |
| Referral letters | `ai-referral-letter` | Ophthalmology referral letters |

**What to add:** Register optometry-specific AI skills in `ai_skills` table with pinned model versions and `patient_description` (HTI-2).

**Effort:** ~2 hours — INSERT rows into `ai_skills`, no new edge functions needed initially

---

## Part 3 — What We Must BUILD (New Code)

### 3A. Database Schema — Optometry Module Migration

**Status:** BUILD
**Pattern:** `supabase/migrations/20251109000000_dental_health_module.sql` (879 lines)
**Effort:** ~8 hours (1 session)

#### ENUMs to Create

```sql
CREATE TYPE opto_provider_role AS ENUM (
  'optometrist', 'ophthalmologist', 'optician', 'ophthalmic_tech',
  'optometry_student', 'optometry_resident', 'preceptor'
);

CREATE TYPE opto_visit_type AS ENUM (
  'comprehensive_exam', 'problem_focused', 'contact_lens_eval',
  'contact_lens_followup', 'visual_field', 'diabetic_eye_exam',
  'pediatric_exam', 'low_vision_eval', 'pre_surgical_eval',
  'post_surgical_followup', 'emergency', 'screening'
);

CREATE TYPE opto_exam_status AS ENUM (
  'in_progress', 'pending_preceptor_review', 'reviewed',
  'approved', 'addendum_required', 'finalized', 'cancelled'
);

CREATE TYPE opto_lens_type AS ENUM (
  'soft_spherical', 'soft_toric', 'soft_multifocal', 'rgp',
  'scleral', 'hybrid', 'ortho_k', 'prosthetic', 'bandage'
);

CREATE TYPE opto_rx_type AS ENUM (
  'spectacle', 'contact_lens', 'low_vision_device'
);
```

#### Tables to Create

| Table | Purpose | Columns (Key) | RLS |
|-------|---------|---------------|-----|
| `opto_exams` | Main exam record | patient_id, provider_id, preceptor_id, visit_type, chief_complaint, exam_status, encounter_id, fhir_encounter_id | tenant + provider |
| `opto_visual_acuity` | VA measurements (per eye, per condition) | exam_id, eye (OD/OS/OU), distance_sc, distance_cc, distance_ph, near_sc, near_cc, method (Snellen/LogMAR/ETDRS), notes | tenant + exam |
| `opto_refraction` | Refraction data | exam_id, eye, sphere, cylinder, axis, add_power, pd, method (manifest/cycloplegic/autorefraction), best_corrected_va | tenant + exam |
| `opto_anterior_segment` | Slit lamp findings | exam_id, eye, lids_lashes, conjunctiva, cornea, anterior_chamber, iris, lens, tear_film, angles, fluorescein_pattern | tenant + exam |
| `opto_posterior_segment` | Dilated fundus exam | exam_id, eye, optic_disc, cup_disc_ratio, macula, vessels, peripheral_retina, vitreous, dfe_method | tenant + exam |
| `opto_tonometry` | IOP measurements | exam_id, eye, iop_value, method (GAT/NCT/iCare/Tono-Pen), time_measured, pachymetry_adjusted_iop, central_corneal_thickness | tenant + exam |
| `opto_prescriptions` | Rx records (spectacle + CL) | patient_id, exam_id, rx_type, od_sphere, od_cylinder, od_axis, od_add, os_sphere, os_cylinder, os_axis, os_add, pd, expiration_date, prescriber_id | tenant + patient |
| `opto_contact_lens_fits` | CL fitting details | exam_id, eye, lens_type, brand, base_curve, diameter, power, cylinder, axis, wearing_schedule, replacement_schedule, solution, over_refraction | tenant + exam |
| `opto_imaging` | OCT, photos, visual fields | exam_id, image_type (OCT/fundus_photo/visual_field/gonioscopy/topography/pachymetry/meibography), eye, device, file_url, findings, fhir_diagnostic_report_id | tenant + exam |
| `opto_visual_field_results` | Perimetry data | exam_id, eye, test_type (Humphrey/Goldmann/FDT), strategy (SITA-Standard/SITA-Fast/24-2/10-2), mean_deviation, pattern_std_deviation, vfi, reliability (fixation_losses, false_pos, false_neg), ght_result | tenant + exam |
| `opto_assessment_plan` | Diagnosis + plan per exam | exam_id, diagnosis_icd10, diagnosis_description, eye_laterality, plan_text, follow_up_interval, referral_needed, referral_specialty | tenant + exam |
| `patient_eye_health_tracking` | Community self-reported (WellFit side) | patient_id, symptom (blurred_vision/flashes/floaters/eye_pain/redness/discharge/dryness/light_sensitivity), severity, onset_date, notes | tenant + patient |

#### Views to Create

| View | Purpose |
|------|---------|
| `v_opto_exam_summary` | Latest exam + VA + IOP + Rx per patient (security_invoker) |
| `v_opto_student_workload` | Exams per student, pending reviews, preceptor queue |
| `v_opto_clinic_schedule` | Today's appointments + exam status |

---

### 3B. TypeScript Types

**Status:** BUILD
**Pattern:** `src/types/dentalHealth/` (4 files)
**Effort:** ~4 hours

```
src/types/optometry/
├── baseTypes.ts          — Union types for all ENUMs above
├── clinicalInterfaces.ts — OptoExam, VisualAcuity, Refraction, AnteriorSegment, etc.
├── apiAndDashboard.ts    — Request types, dashboard summary, alert types
└── index.ts              — Barrel export
```

#### Key Interfaces

| Interface | Key Fields |
|-----------|-----------|
| `OptoExam` | id, patient_id, provider_id, preceptor_id, visit_type, exam_status, chief_complaint, assessment_plan[] |
| `VisualAcuity` | eye, distance_sc, distance_cc, distance_ph, near_sc, near_cc, method |
| `Refraction` | eye, sphere, cylinder, axis, add_power, pd, method, best_corrected_va |
| `AnteriorSegmentFindings` | eye, lids_lashes, conjunctiva, cornea, anterior_chamber, iris, lens, tear_film |
| `PosteriorSegmentFindings` | eye, optic_disc, cup_disc_ratio, macula, vessels, peripheral_retina, vitreous |
| `Tonometry` | eye, iop_value, method, pachymetry_adjusted_iop |
| `OptometryPrescription` | rx_type, od_sphere/cyl/axis/add, os_sphere/cyl/axis/add, pd, expiration |
| `ContactLensFit` | eye, lens_type, brand, base_curve, diameter, power, wearing_schedule |
| `VisualFieldResult` | eye, test_type, strategy, mean_deviation, pattern_std_deviation, vfi, reliability |
| `OptoImaging` | image_type, eye, device, file_url, findings |

#### Alert Types

| Alert | Trigger | Severity |
|-------|---------|----------|
| IOP > 21 mmHg | Tonometry result | High |
| IOP > 30 mmHg | Tonometry result | Critical |
| Cup-to-disc ratio > 0.7 | Posterior segment | High |
| Cup-to-disc ratio asymmetry > 0.2 | Comparing OD vs OS | High |
| Visual field progression (MD worsening > 1dB/year) | Serial VF data | Medium |
| VA worse than 20/40 (driving standard) | VA measurement | Medium |
| Diabetic patient overdue for dilated exam | Patient conditions + exam history | Medium |
| Exam pending preceptor review > 48 hours | Exam status timestamp | Medium |
| Contact lens overwear (> recommended hours) | Self-report | Low |

---

### 3C. Service Layer

**Status:** BUILD
**Pattern:** `src/services/dentalHealthService.ts` (579 lines)
**Effort:** ~8 hours (1–2 sessions)

```
src/services/optometryService.ts
```

#### Methods Required

| Category | Methods |
|----------|---------|
| Exams | `createExam()`, `getExam()`, `updateExam()`, `listPatientExams()`, `submitForReview()`, `approveExam()` |
| Visual Acuity | `recordVisualAcuity()`, `getLatestVA()`, `getVAHistory()` |
| Refraction | `recordRefraction()`, `compareRefraction()` (Rx change detection) |
| Anterior/Posterior | `recordAnteriorSegment()`, `recordPosteriorSegment()` |
| Tonometry | `recordTonometry()`, `getIOPHistory()`, `detectIOPSpike()` |
| Prescriptions | `createPrescription()`, `getActivePrescriptions()`, `checkRxExpiration()` |
| Contact Lens | `recordContactLensFit()`, `getCLHistory()`, `getWearingSchedule()` |
| Imaging | `recordImaging()`, `getImagingHistory()` |
| Visual Fields | `recordVisualField()`, `detectVFProgression()` |
| Dashboard | `getDashboardSummary()`, `getAlerts()`, `getStudentWorkload()` |

---

### 3D. Dashboard UI

**Status:** BUILD
**Pattern:** `src/components/dental/DentalHealthDashboard.tsx` + `src/components/cardiology/`
**Effort:** ~16 hours (2–3 sessions)

```
src/components/optometry/
├── OptometryDashboard.tsx          — Main 6-tab dashboard
├── tabs/
│   ├── ExamOverviewTab.tsx         — Patient summary, latest VA/IOP/Rx, alerts
│   ├── ExamDocumentationTab.tsx    — Full exam form (VA, slit lamp, DFE, assessment)
│   ├── RefractionTab.tsx           — Refraction history, Rx comparison, spectacle/CL Rx
│   ├── ContactLensTab.tsx          — CL fitting, trials, wearing schedules
│   ├── ImagingTab.tsx              — OCT, visual fields, fundus photos, topography
│   └── ClinicManagementTab.tsx     — Student workload, preceptor queue, schedule
├── forms/
│   ├── VisualAcuityForm.tsx        — Snellen/LogMAR entry for OD/OS, SC/CC/PH
│   ├── RefractionForm.tsx          — Sphere/cyl/axis/add with transposition calculator
│   ├── AnteriorSegmentForm.tsx     — Slit lamp structured documentation
│   ├── PosteriorSegmentForm.tsx    — DFE structured documentation
│   ├── TonometryForm.tsx           — IOP entry with pachymetry correction
│   ├── ContactLensFitForm.tsx      — CL parameters + trial lens tracking
│   ├── PrescriptionForm.tsx        — Generate spectacle/CL Rx
│   └── AssessmentPlanForm.tsx      — Dx (ICD-10 search) + plan + follow-up
├── components/
│   ├── VisualAcuityChart.tsx       — Snellen chart visualization
│   ├── IOPTrendGraph.tsx           — IOP over time with target pressure line
│   ├── RxComparisonCard.tsx        — Side-by-side old vs new prescription
│   └── PreceptorReviewBanner.tsx   — Alert when exam needs sign-off
├── __tests__/
│   └── (test files per component)
└── index.ts                        — Barrel export
```

---

### 3E. Student Clinic / Preceptor Workflow (UH-Specific Differentiator)

**Status:** BUILD — This is the **key differentiator** for an academic institution RFP
**Effort:** ~12 hours (2 sessions)

Academic optometry clinics have a unique workflow that commercial EMRs handle poorly:

```
Student documents exam → Marks "Ready for Review" → Preceptor reviews →
  ├── Approves (co-signs) → Exam finalized
  ├── Requests changes → Student revises → Re-submit
  └── Takes over (complex case) → Preceptor documents directly
```

#### What to Build

| Component | Purpose |
|-----------|---------|
| `PreceptorReviewQueue.tsx` | List of exams pending review, filtered by preceptor |
| `StudentExamTracker.tsx` | Student's view: my exams, status, feedback received |
| `ExamCoSignature.tsx` | Preceptor approval workflow with audit trail |
| `PreceptorFeedbackPanel.tsx` | Structured teaching feedback per exam section |
| `ClinicRotationSchedule.tsx` | Which students are in which clinic on which days |

#### Database Additions

| Table | Purpose |
|-------|---------|
| `opto_preceptor_reviews` | Review records: reviewer_id, exam_id, decision, feedback, sections_reviewed, reviewed_at |
| `opto_student_rotations` | Student clinic assignments: student_id, clinic_location, rotation_start, rotation_end, preceptor_id |
| `opto_competency_tracking` | Skills checklist: student_id, competency (slit_lamp, DFE, refraction, CL_fitting, etc.), status (observed/assisted/performed/independent), verified_by |

#### Coupling to Existing

- Leverages existing `handoff_packets` pattern for student → preceptor handoff
- Uses `clinical_note_amendments` pattern for preceptor corrections
- Uses `audit_logs` for co-signature audit trail
- `user_roles` gets new roles: `optometry_student`, `optometry_preceptor`

---

### 3F. Optical Dispensary Module (Optional but Expected)

**Status:** BUILD — Most optometry EMRs include this; academic clinics always have a dispensary
**Effort:** ~8 hours (1–2 sessions)

| Table | Purpose |
|-------|---------|
| `opto_frame_inventory` | Frame stock: brand, model, color, size, upc, wholesale_cost, retail_price, quantity_on_hand |
| `opto_lens_orders` | Lens lab orders: patient_id, rx_id, lens_type, material, coating, tint, lab_vendor, order_status, tracking |
| `opto_dispensing_records` | What was dispensed: patient_id, frame_id, lens_order_id, dispensed_by, fitting_adjustments, dispensed_at |

#### UI Components

| Component | Purpose |
|-----------|---------|
| `FrameInventoryPanel.tsx` | Search/browse frames, check stock |
| `LensOrderForm.tsx` | Submit order to lab with Rx + frame measurements |
| `DispensingForm.tsx` | Record frame fitting, PD verification, patient acceptance |

---

### 3G. Clinical Imaging Storage & Display — Honest Gap Analysis

**Status:** PARTIAL — storage infrastructure exists, display and device integration do not
**Effort:** ~16–24 hours (2–3 sessions) for Phase 1–3; Phase 4 is post-contract

Optometry is one of the most image-heavy specialties in medicine. Every comprehensive exam can generate:

| Imaging Type | File Size | Device | Frequency |
|-------------|-----------|--------|-----------|
| OCT (retinal/RNFL/anterior) | 5–50 MB | Zeiss Cirrus, Heidelberg Spectralis, Topcon Maestro | Every glaucoma/retina patient |
| Fundus photography | 2–10 MB | Optos, Canon, Topcon | Most comprehensive exams |
| Visual field (Humphrey) | 1–5 MB | Zeiss HFA, Octopus | Glaucoma patients, neuro cases |
| Corneal topography | 2–8 MB | Pentacam, Medmont, Orbscan | Contact lens, keratoconus, pre-surgical |
| Anterior segment photography | 1–5 MB | Slit lamp camera | Corneal conditions, post-surgical |
| Meibography | 1–3 MB | LipiView, Oculus Keratograph | Dry eye patients |
| Gonioscopy imaging | 1–3 MB | EyeCam, various | Angle-closure suspects |
| Ophthalmic ultrasound (B-scan) | 2–10 MB | Ellex, Quantel | Vitreous/retinal pathology |

**This is the area where we'd falter against purpose-built optometry EMRs.** Here's exactly what we have, what we don't, and how to close the gap.

#### What We ALREADY Have (Stronger Than Expected)

| Layer | What Exists | File Location |
|-------|------------|---------------|
| **PACS integration types** | Full DICOM/DICOMweb/WADO type system — `PACSConnection`, `ImagingOrder`, `ImagingStudy`, `ImagingReport` with laterality, modality codes, DICOM UIDs, series/instance counts | `src/types/healthcareIntegrations/imaging.ts` |
| **Imaging UI panel** | `ImagingPanel.tsx` — PACS connection status, critical findings display with communication tracking | `src/components/healthcareIntegrations/panels/ImagingPanel.tsx` |
| **Enterprise file upload** | Chunked uploads for files >5MB, SHA-256 integrity verification, HIPAA audit trail, PHI data classification, progress tracking, automatic retry | `src/services/EnterpriseFileUploadService.ts` |
| **Supabase Storage buckets** | 6+ buckets already created and proven (avatars, community-moments, meal-photos, temp-vital-images, guardian-eyes, consent-signatures, CQL libraries) | Various migrations |
| **Dental imaging table** | `dental_imaging` with `storage_url`, image types, device tracking, FHIR DiagnosticReport linkage — **direct template for optometry** | `supabase/migrations/20251109000000_dental_health_module.sql` |
| **Signed URL utility** | Time-limited access to private bucket files — HIPAA compliant (no permanent public URLs for clinical images) | `src/utils/getSignedUrl.ts` |
| **FHIR DiagnosticReport** | `fhir_diagnostic_reports` table + full TypeScript types — standard resource for imaging results | `src/types/fhir/clinical.ts` |
| **FHIR ImagingStudy references** | `fhirImagingStudyId` and `fhirDiagnosticReportId` fields already on `ImagingOrder` and `ImagingStudy` types | `src/types/healthcareIntegrations/imaging.ts` |
| **DICOMweb API types** | `dicomwebUrl`, `dicomwebQidoPath` (query), `dicomwebWadoPath` (retrieve), `dicomwebStowPath` (store) on `PACSConnection` | `src/types/healthcareIntegrations/imaging.ts` |

#### What's MISSING (The Actual Gaps)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **No `clinical-imaging` storage bucket** | Cannot store uploaded OCT/fundus/VF files. Need private bucket with HIPAA RLS, 50MB file size limit, allowed MIME types (DICOM, PNG, JPEG, PDF) | ~2 hours | P0 — session 1 |
| **DICOM modality codes missing `OP` and `OPT`** | Our `ImagingModality` union type has `CR`, `CT`, `MR`, `US`, etc. but not `OP` (Ophthalmic Photography) or `OPT` (Optical Coherence Tomography) — standard DICOM modality codes for eye care | ~1 hour | P0 — session 1 |
| **No DICOM file viewer** | Can store DICOM but cannot display it in-browser. Optometry devices export DICOM for OCT, visual fields, topography. Without a viewer, clinicians must open images in separate software | ~8–16 hours | P1 — session 6 |
| **No DICOMweb client implementation** | Types exist (`PACSConnection` with DICOMweb fields) but no actual HTTP client that queries/retrieves from a PACS server | ~8 hours | P1 — session 6 |
| **No image annotation tools** | Clinicians want to mark up fundus photos (circle lesions, draw on OCT cross-sections, annotate visual field defects) | ~12 hours for basic tools | P2 — post-MVP |
| **No direct device integration** | OCT machines, visual field analyzers, auto-refractors don't push data to us automatically — requires vendor partnerships (Zeiss, Heidelberg, Topcon) | Vendor partnership (months) | P3 — post-contract |

#### How Optometry Imaging Actually Works in Practice

```
Patient sits at OCT/camera → Device captures image → Image saved to...
  ├── Device local drive (always — this is the guaranteed copy)
  ├── PACS server via DICOM send (if clinic has a mini-PACS)
  ├── Vendor cloud (Zeiss FORUM Connect, Heidelberg HEYEX, Topcon Harmony)
  └── EMR via integration API (if EMR supports vendor-specific API)
```

**Key insight:** UH almost certainly already has imaging devices with their own storage (Zeiss FORUM is the most common in academic optometry). They don't need us to *replace* their imaging infrastructure — they need us to **connect to it** and display results in the chart. That's what our DICOMweb types are designed for.

#### Phased Imaging Implementation Plan

| Phase | What | Timeline | Maturity Level |
|-------|------|----------|----------------|
| **Phase 1: Upload + Store** | Create `clinical-imaging` storage bucket. Upload OCT/fundus/VF images via `EnterpriseFileUploadService`. Link to `opto_imaging` table. Display via signed URLs + basic image viewer (PNG/JPEG). | Sessions 1–2 | MVP — "works but manual upload" |
| **Phase 2: DICOMweb Query/Retrieve** | Implement DICOMweb client using existing `PACSConnection` types. QIDO-RS (query studies), WADO-RS (retrieve images). Connect to UH's existing PACS or vendor cloud. | Session 6 | Production — "pulls from PACS automatically" |
| **Phase 3: In-Browser DICOM Viewer** | Integrate [OHIF Viewer](https://ohif.org/) (open-source, MIT license) or [Cornerstone.js](https://www.cornerstonejs.org/) for native DICOM display. Measurement tools, windowing, zoom, scroll through OCT slices. | Session 6–7 | Full — "view DICOM natively in the chart" |
| **Phase 4: Direct Device APIs** | Partner with Zeiss (FORUM Connect API), Heidelberg (HEYEX API), Topcon (Harmony API) for automatic image push from devices to EMR. Requires vendor agreements and certification. | Post-contract, Year 1 | Enterprise — "images appear automatically" |

#### OHIF Viewer Integration (Phase 3 Detail)

[OHIF](https://ohif.org/) is the gold standard open-source DICOM viewer, used by academic medical centers worldwide. MIT licensed — free to embed.

| Feature | OHIF Provides |
|---------|--------------|
| DICOM display | All modalities including OCT, fundus, VF |
| Measurement tools | Length, area, angle, Hounsfield |
| Windowing/leveling | Adjust brightness/contrast |
| Multi-panel layout | Compare OD vs OS side-by-side |
| Series navigation | Scroll through OCT slices |
| DICOM SR display | Structured reports from devices |
| DICOMweb native | QIDO-RS, WADO-RS built in |

**Integration approach:** Embed OHIF as an iframe or React component within the Imaging tab. Point it at the DICOMweb endpoint (UH's PACS or our Supabase-backed DICOMweb proxy).

#### What to Say in the RFP About Imaging

> **Imaging Architecture:** Envision ATLUS supports DICOM, DICOMweb (QIDO-RS, WADO-RS, STOW-RS), and FHIR ImagingStudy/DiagnosticReport resources natively. The platform integrates with existing PACS infrastructure via industry-standard DICOMweb APIs, allowing the University Eye Institute to continue using its current imaging devices and PACS while gaining AI-powered clinical decision support on the imaging data.
>
> **Go-Live:** Direct image upload and storage with HIPAA-compliant access controls, linked to patient exam records with FHIR DiagnosticReport mapping.
>
> **90 Days Post Go-Live:** DICOMweb integration with existing PACS for automated study query/retrieve. Embedded DICOM viewer (OHIF-based) for native in-browser image review with measurement and annotation tools.
>
> **Year 1:** Direct device integration APIs for automated image capture from Zeiss, Heidelberg, and Topcon instruments pending vendor partnership agreements.

#### Competitive Reality Check

| Capability | Compulink | RevolutionEHR | Eyefinity | **ATLUS (Phase 1)** | **ATLUS (Phase 3)** |
|------------|-----------|---------------|-----------|---------------------|---------------------|
| Manual image upload | Yes | Yes | Yes | **Yes** | **Yes** |
| PACS/DICOMweb integration | Yes (mature) | Limited | Limited | No (types only) | **Yes** |
| In-browser DICOM viewer | Yes (licensed) | Basic | Basic | No | **Yes (OHIF)** |
| Direct device integration | Yes (20+ devices) | Some | Some | No | No (Year 1) |
| AI analysis on images | **No** | **No** | **No** | **No (future)** | **Possible (Claude vision)** |
| FHIR ImagingStudy mapping | No | No | No | **Yes** | **Yes** |

**The honest pitch:** We don't have 20 years of device partnerships. We do have a modern imaging architecture (DICOMweb + FHIR + OHIF) that's more standards-compliant than any optometry EMR on the market, plus the only AI platform that could eventually analyze retinal images. Phase 1 covers UH's needs at go-live; Phase 3 matches or exceeds competitors within 90 days.

---

## Part 4 — Full Build Sequence (Session Plan)

| Session | Focus | Hours | Deliverables |
|---------|-------|-------|-------------|
| **1** | Database migration + ENUMs + tables + RLS + indexes + `clinical-imaging` bucket | ~8 | Migration file, storage bucket, `npx supabase db push` |
| **2** | TypeScript types (4 files) + service layer (CRUD) | ~8 | `src/types/optometry/`, `src/services/optometryService.ts` |
| **3** | FHIR mapping + CPT/ICD-10 seed migrations | ~6 | `src/services/fhir/optometry/`, seed migrations |
| **4** | Dashboard shell + ExamOverview + VA/Refraction tabs | ~8 | `src/components/optometry/` initial dashboard |
| **5** | Anterior/Posterior segment + Tonometry + Assessment forms | ~8 | Exam documentation tab complete |
| **6** | Contact Lens tab + Imaging tab (upload + basic display) + VF results | ~8 | All clinical tabs complete |
| **7** | Student/Preceptor workflow (queue, review, co-sign) | ~8 | Clinic management tab |
| **8** | Optical dispensary (frames, lens orders, dispensing) | ~6 | Dispensary module |
| **9** | DICOMweb client + OHIF viewer integration | ~12 | In-browser DICOM display, PACS query/retrieve |
| **10** | Route wiring + admin panel + feature flag + AI skill registration | ~4 | End-to-end accessible |
| **11** | Tests (all components + service + forms) | ~8 | Full test coverage |
| **12–13** | Polish, edge cases, imaging hardening, demo prep | ~8 | Demo-ready |

**Total: ~84–92 hours across 12–13 sessions**

---

## Part 5 — Competitive Positioning

### Where ATLUS Beats Purpose-Built Optometry EMRs

| Advantage | Detail |
|-----------|--------|
| **AI-first** | 28+ AI clinical tools (SOAP notes, coding, drug interactions, care plans) — no optometry EMR has this |
| **FHIR-native** | Born with FHIR R4, not bolted on — critical for ONC certification and health information exchange |
| **Academic workflow** | Student-preceptor review workflow designed specifically for teaching clinics |
| **Interoperability** | HL7 v2.x + FHIR R4 + C-CDA export + clearinghouse — connects to hospital systems |
| **Patient portal** | 21st Century Cures Act compliant My Health Hub — patients see their own eye records |
| **Modern stack** | React 19, real-time subscriptions, mobile-ready, WebAuthn/biometric login |
| **Multi-tenant** | UH can run multiple clinic locations as one tenant with department-level isolation |
| **Cost** | Built at fraction of enterprise EMR cost |

### Where Purpose-Built Optometry EMRs Beat Us (Until We Build)

| Gap | Competitors Who Have It | Priority | Our Path |
|-----|------------------------|----------|----------|
| **Direct device integration (OCT, VF, auto-refractor)** | Compulink (20+ devices), MaximEyes | Post-contract | Phase 1: manual upload. Phase 2: DICOMweb. Phase 4: vendor APIs |
| **In-browser DICOM viewer** | Compulink (licensed viewer), RevolutionEHR (basic) | Session 9 | OHIF Viewer (open source, MIT) — matches or exceeds licensed viewers |
| Frame inventory + lens ordering integration | Eyefinity, RevolutionEHR, Compulink | Session 8 | Build from scratch — straightforward CRUD |
| Insurance eligibility (VSP, EyeMed, Davis Vision) | All major optometry EMRs | Post-MVP | Couple to existing `verify_eligibility` MCP tool |
| Visual field device import (Humphrey XML/DICOM) | Compulink, MaximEyes | Session 9 | DICOMweb retrieval or manual upload |
| Decades of optometry-specific workflow polish | All | Ongoing | AI fills workflow gaps; modern UX compensates for feature count |

### The AI Advantage — What NO Competitor Has

No optometry EMR on the market (RevolutionEHR, Compulink, Eyefinity, MaximEyes, EyeMD) has built-in clinical AI. This is not a minor gap — it's a generational gap.

| AI Capability | What It Does for Optometry | Competitor Equivalent |
|---------------|---------------------------|----------------------|
| AI SOAP note generation | Generates eye exam documentation from structured findings | Manual typing (15+ min/encounter) |
| AI coding suggestions | Auto-suggests 920xx CPT + ICD-10 eye codes from documentation | Code lookup books / memorization |
| AI drug interaction checking | Flags topical + systemic interactions (e.g., timolol + beta-blockers) | Basic formulary lookup (if any) |
| AI care plan generation | Generates glaucoma/diabetic retinopathy management plans | Static templates |
| AI patient education | Multilingual instructions (Houston is 44% Hispanic) | Printed English handouts |
| AI referral letters | Generates ophthalmology referral letters from exam findings | Manual dictation |
| AI clinical guideline matching | Matches findings to AAO/AOA preferred practice patterns | Provider's memory |
| **Future: AI retinal image analysis** | Claude Vision API on fundus photos — diabetic retinopathy screening, glaucoma disc analysis | **Does not exist in any optometry EMR** |

The last item — AI retinal image analysis — is the long-term differentiator. Google Health and IDx-DR have FDA-cleared AI for diabetic retinopathy screening, but no *EMR* has it built in. We could be first.

---

## Part 6 — RFP Response Checklist

Before responding to RFP-730-UofH-3074, verify:

- [ ] Pull actual RFP document from [Texas SmartBuy ESBD](https://www.txsmartbuy.gov/esbd) — search `730-UofH-3074`
- [ ] Confirm submission deadline (posted Dec 2025 — may be closed or extended)
- [ ] Contact Robert S. Adkins (rsadkins@central.uh.edu / 713-743-7488) for vendor registration
- [ ] Check if RFP requires ONC Health IT certification (if yes, impacts timeline significantly)
- [ ] Check if RFP requires specific device integrations (auto-refractor, OCT brands)
- [ ] Check if RFP weights academic/teaching features (preceptor workflow = our differentiator)
- [ ] Determine if demo is required (if yes, build Sessions 1–4 first for functional demo)
- [ ] Check insurance panel requirements (VSP, EyeMed, Davis Vision, Spectera)

---

> **Bottom Line:** We're not starting from zero. We're starting from a production-grade clinical platform that needs an optometry skin. The 30% we need to build is well-defined, follows a proven pattern (dental module), and the architecture was designed for exactly this kind of specialty expansion.
