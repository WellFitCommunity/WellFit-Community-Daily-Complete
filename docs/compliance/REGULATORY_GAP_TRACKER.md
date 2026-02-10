# Regulatory Gap Tracker

**Envision Virtual Edge Group LLC**
**Created:** February 10, 2026
**Source:** Envision Atlas Code Assessment (archive/architecture/Envision_Atlas_Code_Assessment.pdf)
**Owner:** Maria (AI System Director), Akima (CCO)

---

## Overview

This tracker documents 9 regulatory gaps identified in the independent code assessment of the Envision Atlus I.H.I.S. platform. Each gap is mapped to the specific federal regulation, implementation status, and deliverables.

---

## Gap Summary

| # | Gap | Regulation | Type | Phase | Status |
|---|-----|-----------|------|-------|--------|
| 1 | NIST SP 800-30 Risk Assessment | 45 CFR 164.308(a)(1)(ii)(A) | Documentation | 2 | Complete |
| 2 | Breach Notification Engine | 45 CFR 164.400-414 | Code + Migration | 1 | Complete |
| 3 | FDA CDS Classification | 21 CFR 820 / Cures Act | Documentation + Migration | 2 | Complete |
| 5 | Notice of Privacy Practices (NPP) | 45 CFR 164.520 | Code + Content | 1 | Complete |
| 6 | Patient Amendment Rights | 45 CFR 164.526 | Extend Existing Code | 2 | Complete |
| 7 | BAA Tracking Dashboard | 45 CFR 164.502(e) | Code + Migration | 1 | Complete |
| 8 | Anti-Kickback / Stark Law Policy | 42 USC 1320a-7b / 42 USC 1395nn | Documentation | 3 | Complete |
| 9 | HIPAA Workforce Training Tracking | 45 CFR 164.308(a)(5) | Code + Migration | 2 | Complete |
| + | FDA General Wellness Determination | FDA GW Guidance | Documentation | 3 | Complete |

---

## Phase 1 — Hospital-Critical

### Gap 2: Breach Notification Engine

**Regulation:** 45 CFR 164.400-414 (Breach Notification Rule)
**Requirement:** Notify HHS, affected individuals, and media (500+) within 60 days.

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration | `supabase/migrations/20260210_breach_notification_engine.sql` | Complete |
| Service | `src/services/breachNotificationService.ts` | Complete |
| Component | `src/components/admin/BreachNotificationDashboard.tsx` | Complete |
| Service Tests | `src/services/__tests__/breachNotificationService.test.ts` | Complete |
| Component Tests | `src/components/admin/__tests__/BreachNotificationDashboard.test.tsx` | Complete |

**Key features:**
- 4-factor risk assessment (nature of PHI, unauthorized person, acquired/viewed, mitigation)
- Safe harbor determination (low probability = no notification required)
- Tiered notification plan: individual, HHS, media (if 500+ affected)
- 60-day deadline tracking with escalation
- Full audit trail via `auditLogger`

### Gap 5: Notice of Privacy Practices (NPP)

**Regulation:** 45 CFR 164.520
**Requirement:** Formal NPP with patient acknowledgment tracking.

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration | `supabase/migrations/20260210_npp_tracking.sql` | Complete |
| Service | `src/services/nppService.ts` | Complete |
| Page | `src/pages/NoticeOfPrivacyPractices.tsx` | Complete |
| Service Tests | `src/services/__tests__/nppService.test.ts` | Complete |
| Component Tests | `src/pages/__tests__/NoticeOfPrivacyPractices.test.tsx` | Complete |

**Key features:**
- Versioned NPP content with effective dates
- Patient acknowledgment tracking (signed, electronic, verbal, refused)
- Acknowledgment status check for current version
- Route: `/notice-of-privacy-practices`

### Gap 7: BAA Tracking Dashboard

**Regulation:** 45 CFR 164.502(e)
**Requirement:** Track all Business Associate Agreements with renewal dates.

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration | `supabase/migrations/20260210_baa_tracking.sql` | Complete |
| Service | `src/services/baaTrackingService.ts` | Complete |
| Component | `src/components/admin/BAATrackingDashboard.tsx` | Complete |
| Service Tests | `src/services/__tests__/baaTrackingService.test.ts` | Complete |
| Component Tests | `src/components/admin/__tests__/BAATrackingDashboard.test.tsx` | Complete |

**Key features:**
- BAA lifecycle management (draft, active, expired, terminated)
- Renewal deadline tracking with configurable alerts
- Review history with audit trail
- Pre-seeded with known BAs: Supabase, Twilio

---

## Phase 2 — Regulatory Completeness

### Gap 1: NIST SP 800-30 Risk Assessment

**Regulation:** 45 CFR 164.308(a)(1)(ii)(A)
**Requirement:** Written risk analysis following NIST SP 800-30 methodology.

| Deliverable | Path | Status |
|-------------|------|--------|
| Documentation | `docs/compliance/NIST_SP_800_30_RISK_ASSESSMENT.md` | Complete |

**Key sections:**
- System characterization (ePHI scope, data flows)
- Threat identification (18 threat sources)
- Vulnerability analysis (mapped to existing controls)
- Risk determination matrix (likelihood x impact)
- Control recommendations with implementation status

### Gap 3: FDA CDS Classification

**Regulation:** 21 CFR 820, 21st Century Cures Act Section 3060
**Requirement:** Classify all AI clinical decision support per FDA criteria.

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration | `supabase/migrations/20260210_ai_skills_fda_classification.sql` | Complete |
| Documentation | `docs/compliance/FDA_CDS_CLASSIFICATION.md` | Complete |

**Key findings:**
- 22 of 28 AI skills qualify as exempt CDS (clinician makes final decision)
- 6 skills classified as non-device (general wellness, administrative)
- 0 skills classified as Class II device (no autonomous clinical decisions)
- All skills documented with 4-factor Cures Act exemption analysis

### Gap 6: Patient Amendment Rights

**Regulation:** 45 CFR 164.526
**Requirement:** Patients can request amendments to their health records.

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration | `supabase/migrations/20260210_patient_amendment_rights.sql` | Complete |
| Service | `src/services/patientAmendmentService.ts` | Complete |
| Clinical Component | `src/components/admin/PatientAmendmentReviewQueue.tsx` | Complete |
| Patient Page | `src/pages/MyAmendmentRequests.tsx` | Complete |
| Service Tests | `src/services/__tests__/patientAmendmentService.test.ts` | Complete |
| Component Tests | `src/components/admin/__tests__/PatientAmendmentReviewQueue.test.tsx` | Complete |
| Page Tests | `src/pages/__tests__/MyAmendmentRequests.test.tsx` | Complete |

**Key features:**
- Patient-initiated amendment requests (distinct from clinical note amendments)
- Clinical staff review queue with accept/deny + reason
- Disagreement statement support (patient can respond to denial)
- 60-day response deadline tracking
- Routes: `/my-amendments` (patient), admin dashboard section (clinical)

### Gap 9: HIPAA Workforce Training Tracking

**Regulation:** 45 CFR 164.308(a)(5)
**Requirement:** Security awareness and training program with completion tracking.

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration | `supabase/migrations/20260210_workforce_training_tracking.sql` | Complete |
| Service | `src/services/trainingTrackingService.ts` | Complete |
| Component | `src/components/admin/TrainingComplianceDashboard.tsx` | Complete |
| Service Tests | `src/services/__tests__/trainingTrackingService.test.ts` | Complete |
| Component Tests | `src/components/admin/__tests__/TrainingComplianceDashboard.test.tsx` | Complete |

**Key features:**
- Training course registry with recurrence intervals
- Completion tracking per employee
- Overdue training alerts
- Tenant-wide compliance rate dashboard
- Leverages existing `employee_profiles.hipaa_training_date` column

---

## Phase 3 — Documentation

### Gap 8: Anti-Kickback / Stark Law Policy

**Regulation:** 42 USC 1320a-7b (Anti-Kickback), 42 USC 1395nn (Stark Law)

| Deliverable | Path | Status |
|-------------|------|--------|
| Documentation | `docs/compliance/ANTI_KICKBACK_STARK_COMPLIANCE.md` | Complete |

### FDA General Wellness Determination

**Regulation:** FDA General Wellness Guidance (2019)

| Deliverable | Path | Status |
|-------------|------|--------|
| Documentation | Included in `docs/compliance/FDA_CDS_CLASSIFICATION.md` | Complete |

---

## Deliverables Inventory

| Type | Count | Files |
|------|-------|-------|
| Migrations | 6 | breach, npp, baa, fda_classification, patient_amendments, training |
| Services | 5 | breachNotification, npp, baaTracking, patientAmendment, trainingTracking |
| Components | 6 | BreachDashboard, NPP page, BAADashboard, AmendmentQueue, MyAmendments, TrainingDashboard |
| Test Files | 11 | Service + component tests for each code gap |
| Documentation | 3 | NIST risk assessment, FDA CDS classification, Anti-Kickback/Stark |

---

## Verification

All deliverables verified on February 10, 2026:
```
✅ typecheck: 0 errors
✅ lint: 0 errors, 0 warnings
✅ tests: 7,376 passed, 0 failed (349 suites)
```

**New tests added:** 93 behavioral tests (Tier 1-4) across 11 test files
**New test suites:** 11 (5 service + 6 component)
**All files under 600-line limit** (largest: MyAmendmentRequests.tsx at 559 lines)

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
