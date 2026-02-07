# Test Coverage Scale Readiness Tracker

**Goal:** Every vertical production-ready for public scale -- not just pilot.
**Created:** 2026-02-04
**Updated:** 2026-02-04 (verified file-by-file audit)
**Owner:** Maria

---

## Current Baseline

| Metric | Count |
|--------|-------|
| Total test suites | 287 |
| Total tests | 7,109 |
| Pass rate | 100% |
| Component verticals at 100% | 10 |
| Component verticals at 0% | **21** |
| Component verticals between 1-79% | 11 |
| Service layers at 90%+ | 3 (ai, fhir, publicHealth) |

---

## Scale Readiness Summary

```
GREEN  = 80%+ test coverage, production-ready
YELLOW = 30-79%, needs work before scale
RED    = 0-29%, blocks public launch
```

| Status | Count | Action |
|--------|-------|--------|
| GREEN | 13 | Monitor, maintain |
| YELLOW | 5 | Fill gaps this sprint |
| RED | **21** | Must resolve before scale |

---

## PRIORITY 1 -- Critical Path (Blocks Any Deployment)

These verticals touch patient safety, core operations, or infrastructure.

### 1A. Handoff System (Patient Safety)

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/handoff/AdminTransferLogs.tsx` | Admin transfer log viewer | NO | [ ] TODO |
| `src/components/handoff/LabResultVault.tsx` | Lab result secure storage | NO | [ ] TODO |
| `src/components/handoff/LiteSenderConfirmation.tsx` | Lite sender confirmation step | NO | [ ] TODO |
| `src/components/handoff/LiteSenderFormSteps.tsx` | Lite sender form wizard | NO | [ ] TODO |
| `src/components/handoff/LiteSenderPortal.tsx` | Lite sender portal entry | NO | [ ] TODO |
| `src/components/handoff/MedicationReconciliationAlert.tsx` | Medication reconciliation alerts | NO | [ ] TODO |
| `src/components/handoff/ReceivingDashboard.tsx` | Receiving facility dashboard | NO | [ ] TODO |
| `src/components/handoff/hooks/useLiteSenderLogic.ts` | Lite sender business logic hook | NO | [ ] TODO |

**Coverage:** 0% (0/8)
**Risk if untested:** Care gaps during transfers. Patient safety incident.

---

### 1B. Patient Module (Core Senior UX)

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/patient/` | 19 source files | 1 test file | [ ] TODO |

**Coverage:** 5% (1/19)
**Risk if untested:** Seniors encounter broken workflows. HIPAA violations.

---

### 1C. Admin Dashboard (Operations Center)

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/admin/` | 77 source files | 9 test files | [ ] TODO |

**Coverage:** 11% (9/77)
**Risk if untested:** Tenant management, claims, billing, operations all fragile.

---

### 1D. Super Admin

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/superAdmin/` | 16 source files | 2 test files | [ ] TODO |

**Coverage:** 12% (2/16)
**Risk if untested:** Platform-wide admin controls untested.

---

### 1E. Vitals Capture

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/vitals/` | 7 source files | 1 test file | [ ] TODO |

**Coverage:** 14% (1/7)
**Risk if untested:** Incorrect vital sign recording. Clinical decisions based on bad data.

---

## PRIORITY 2 -- CHW / Community Health Workers

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/chw/CHWVitalsCapture.tsx` | Field vitals capture | YES | [x] DONE |
| `src/components/chw/KioskCheckIn.tsx` | Kiosk check-in workflow | YES (+security) | [x] DONE |
| `src/components/chw/SDOHAssessment.tsx` | PRAPARE SDOH assessment | YES | [x] DONE |
| `src/components/chw/CHWAlertsWidget.tsx` | Critical alerts from field visits | NO | [ ] TODO |
| `src/components/chw/KioskDashboard.tsx` | Kiosk status monitoring | NO | [ ] TODO |
| `src/components/chw/MedicationPhotoCapture.tsx` | Medication reconciliation camera | NO | [ ] TODO |
| `src/components/chw/TelehealthLobby.tsx` | Telehealth waiting room | NO | [ ] TODO |
| `src/pages/CHWDashboardPage.tsx` | CHW command center page | NO | [ ] TODO |
| `src/services/chwService.ts` | CHW business logic | YES | [x] DONE |
| `src/services/specialist-workflow-engine/templates/chwTemplate.ts` | CHW workflow config | NO (parent covers) | [ ] TODO |

**Coverage:** 4/10 (40%)
**Target:** 10/10 (100%)

---

## PRIORITY 3 -- Clinical Specialty Modules (Hospital Scale)

### 3A. EMS Integration

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/ems/` | 5 source files | 0 test files | [ ] TODO |
| `src/pages/EMSPage.tsx` | EMS page | NO | [ ] TODO |

**Coverage:** 0%

### 3B. Neurological Suite

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/neuro-suite/` | 3 source files | 0 test files | [ ] TODO |
| `src/components/neuro/` | 3 source files | 0 test files | [ ] TODO |

**Coverage:** 0%

### 3C. SDOH Module (Components)

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/sdoh/SDOHDetailPanel.tsx` | SDOH detail view | NO | [ ] TODO |
| `src/components/sdoh/SDOHIndicatorBadge.tsx` | SDOH status badge | NO | [ ] TODO |
| `src/components/sdoh/SDOHPassiveDetectionPanel.tsx` | Passive SDOH detection | NO | [ ] TODO |
| `src/components/sdoh/SDOHStatusBar.tsx` | SDOH status bar | NO | [ ] TODO |

**Coverage:** 0% (0/4)
**Note:** `services/publicHealth/` (which includes SDOH service logic) IS tested at 100%.

### 3D. NurseOS (Nurse Resilience)

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/nurseos/` | 7 source files | 0 test files | [ ] TODO |

**Coverage:** 0%

### 3E. Healthcare Integrations (EHR/Pharmacy/Lab/Imaging)

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/healthcareIntegrations/HealthcareIntegrationsDashboard.tsx` | Main integrations dashboard | NO | [ ] TODO |
| `src/components/healthcareIntegrations/components/ActionItem.tsx` | Action item display | NO | [ ] TODO |
| `src/components/healthcareIntegrations/components/ConnectionCard.tsx` | Integration connection card | NO | [ ] TODO |
| `src/components/healthcareIntegrations/components/ConnectionStatusRow.tsx` | Connection status row | NO | [ ] TODO |
| `src/components/healthcareIntegrations/components/StatusBadge.tsx` | Status badge | NO | [ ] TODO |
| `src/components/healthcareIntegrations/panels/ImagingPanel.tsx` | Imaging integration panel | NO | [ ] TODO |
| `src/components/healthcareIntegrations/panels/InsurancePanel.tsx` | Insurance integration panel | NO | [ ] TODO |
| `src/components/healthcareIntegrations/panels/LabSystemsPanel.tsx` | Lab systems integration panel | NO | [ ] TODO |
| `src/components/healthcareIntegrations/panels/PharmacyPanel.tsx` | Pharmacy integration panel | NO | [ ] TODO |

**Coverage:** 0% (0/9)

### 3F. Other Clinical Verticals at 0%

| Vertical | Component | Files | Coverage | Status |
|----------|-----------|-------|----------|--------|
| `dental/` | DentalHealthDashboard.tsx | 1 | 0% | [ ] TODO |
| `mental-health/` | MentalHealthDashboard.tsx | 1 | 0% | [ ] TODO |
| `physicalTherapy/` | PhysicalTherapyDashboard.tsx | 1 | 0% | [ ] TODO |
| `careCoordination/` | CareCoordinationDashboard.tsx | 1 | 0% | [ ] TODO |
| `case-manager/` | CaseManagerPanel.tsx | 1 | 0% | [ ] TODO |
| `social-worker/` | SocialWorkerPanel.tsx | 1 | 0% | [ ] TODO |
| `referrals/` | ReferralsDashboard.tsx | 1 | 0% | [ ] TODO |
| `questionnaires/` | QuestionnaireAnalyticsDashboard.tsx | 1 | 0% | [ ] TODO |

---

## PRIORITY 4 -- Platform Infrastructure

### 4A. Envision Atlus Design System

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/envision-atlus/` | 20 source files | 3 test files | [ ] TODO |

**Coverage:** 15% (3/20)

### 4B. Patient Avatar Visualization

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/patient-avatar/` | 10 source files | 1 test file | [ ] TODO |

**Coverage:** 10% (1/10)

### 4C. Smart Health

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/smart/` | 13 source files | 2 test files | [ ] TODO |

**Coverage:** 15% (2/13)

### 4D. Wellness Platform

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/wellness/` | 10 source files | 1 test file | [ ] TODO |

**Coverage:** 10% (1/10)

### 4E. Dashboard Components

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/dashboard/` | 12 source files | 2 test files | [ ] TODO |

**Coverage:** 16% (2/12)

### 4F. Telehealth

| File | Purpose | Test Exists | Status |
|------|---------|-------------|--------|
| `src/components/telehealth/` | 10 source files | 5 test files | [ ] TODO |

**Coverage:** 50% (5/10)

---

## PRIORITY 5 -- Supporting Layers

### 5A. Custom Hooks

| Layer | Source Files | Test Files | Coverage | Status |
|-------|-------------|------------|----------|--------|
| `src/hooks/` | 35 | 8 | 22.9% | [ ] TODO |

### 5B. React Contexts

| Layer | Source Files | Test Files | Coverage | Status |
|-------|-------------|------------|----------|--------|
| `src/contexts/` | 10 | 2 | 20% | [ ] TODO |

### 5C. Pages

| Layer | Source Files | Test Files | Coverage | Status |
|-------|-------------|------------|----------|--------|
| `src/pages/` | 63 | 10 | 15.8% | [ ] TODO |

### 5D. Services (Root Level)

| Layer | Source Files | Test Files | Coverage | Status |
|-------|-------------|------------|----------|--------|
| `src/services/` (root) | 115 | ~35 | ~30% | [ ] TODO |
| `src/services/_base/` | 3 | 0 | 0% | [ ] TODO |
| `src/services/guardian-agent/` | 26 | 1 | 3% | [ ] TODO |
| `src/services/billing-decision-tree/` | 11 | 0 | 0% | [ ] TODO |
| `src/services/hl7/` | 3 | 0 | 0% | [ ] TODO |

---

## PRIORITY 6 -- Remaining Zero-Coverage Verticals

| Vertical | Files | Purpose | Status |
|----------|-------|---------|--------|
| `atlas/` | 6 | Atlus design system | [ ] TODO |
| `ai/` | 5 | AI infrastructure UI | [ ] TODO |
| `collaboration/` | 4 | Team collaboration | [ ] TODO |
| `community/` | 1 | Community features | [ ] TODO |
| `features/` | 3 | Feature management | [ ] TODO |
| `healthcareIntegrations/` | 9 | EHR/pharmacy/lab/imaging/insurance panels | [ ] TODO |
| `layout/` | 6 | Layout infrastructure | [ ] TODO |
| `search/` | 1 | Search functionality | [ ] TODO |
| `shared/` | 3 | Shared UI components | [ ] TODO |
| `specialist/` | 2 | Specialist workflows | [ ] TODO |
| `system/` | 4 | System components | [ ] TODO |
| `wearables/` | 1 | Wearable devices | [ ] TODO |

---

## GREEN Verticals (100% -- Maintain)

These are production-ready. Do not regress.

| Vertical | Files | Tests | Notes |
|----------|-------|-------|-------|
| `auth/` | 4 | 4 | Security-critical |
| `billing/` | 5 | 5 | Payment processing |
| `claude-care/` | 8 | 8 | AI care integration |
| `devices/` | 3 | 3 | Medical devices |
| `discharge/` | 3 | 3 | Patient discharge |
| `lawEnforcement/` | 5 | 5 | LE integration |
| `nurse/` | 7 | 7 | Nurse workflows |
| `physician/` | 7 | 7 | Physician interfaces |
| `security/` | 2 | 2 | Security utilities |
| `user/` | 1 | 1 | User management |
| `services/ai/` | 49 | 47 | AI services (95%) |
| `services/fhir/` | 25 | 24 | FHIR integration (96%) |
| `services/publicHealth/` | 4 | 4 | Public health services |

---

## Evening Work Session Plan

**Recommended order for tonight:**

1. **CHW segment** (Priority 2) -- 5 files need tests, you asked about this first
2. **Handoff system** (Priority 1A) -- 7 files, patient safety critical
3. **Vitals capture** (Priority 1E) -- 6 files need tests, clinical data integrity

**Each test file should cover:**
- Component rendering
- Loading states
- Data display with mock data
- Error handling
- User interactions
- Accessibility (44px touch targets, WCAG AA contrast)

---

## Progress Log

| Date | Vertical | Files Tested | Tests Added | Running Total |
|------|----------|-------------|-------------|---------------|
| 2026-02-04 | _(starting point)_ | -- | -- | 7,109 |
| | | | | |
| | | | | |

---

## Scale Readiness Checklist

Before declaring any vertical "scale-ready":

- [ ] 100% of source files have corresponding test files
- [ ] Tests cover: rendering, loading, data display, errors, interactions
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run lint` passes with 0 warnings
- [ ] `npm test` passes at 100%
- [ ] HIPAA audit logging verified (no console.log)
- [ ] Accessibility verified (senior-friendly: 16px+ fonts, 44px+ touch targets)
- [ ] Route wiring verified in App.tsx
- [ ] No `any` types
- [ ] Error handling uses `unknown` + type guards

---

_This tracker is the single source of truth for scale readiness. Update it as tests are written._
