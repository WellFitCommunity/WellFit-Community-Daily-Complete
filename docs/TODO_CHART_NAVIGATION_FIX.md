# TODO: Unified Patient Chart Navigator

**Priority:** HIGH — UX roadblock reported by user
**Status:** COMPLETE (2026-02-06)
**Reporter:** User (2026-02-06)
**Problem:** Navigating between different documents in patient charts is not fluid. Roadblocks when switching between meds, care plans, labs, notes, avatar, etc.

---

## What's Wrong Now

### 1. Patient Selection Resets Between Chart Sections
- When a nurse/physician navigates from Medications to Care Plans, patient context can be lost
- User has to re-select the patient after switching sections
- Routes use `?patientId=` URL params but this doesn't always carry forward

### 2. No Unified Chart View
- Documents are scattered across separate routes:
  - `/medication-management` — Medications
  - `/care-plans` — Care Plans
  - `/health-observations` — Labs/Vitals
  - `/patient-avatar/:id` — Body Map
  - SOAP Notes — inside SmartScribe only
- No single page where you select a patient and browse ALL their documents
- Every navigation is a full page transition = friction

### 3. Nurse Panel Tab Context Loss
- NursePanel has tabs: Clinical, Telehealth, Documentation, Wellness
- Switching from Telehealth to Documentation tab requires patient selection
- No guidance back to patient selector when context is missing
- User sees blank state with no clear path forward

### 4. Back Button Unpredictable
- Most pages use `navigate(-1)` which can jump to unexpected places
- Browser history gets cluttered with tab switches

---

## The Fix: Build a Unified Patient Chart Navigator

### What to Build
A single `/patient-chart/:patientId` page with:

1. **Persistent patient header** — name, MRN, room, acuity (always visible)
2. **Tab bar for chart sections** — switch between document types WITHOUT losing patient context:
   - Medications
   - Care Plans
   - Observations (Labs/Vitals)
   - Body Map (Avatar)
   - Documents (SOAP Notes, Progress Notes)
   - Immunizations
   - History/Timeline
3. **Breadcrumb navigation** — always know where you are
4. **Patient stays selected** — patientId is in the URL, never lost

### Architecture
```
/patient-chart/:patientId
  ├── ?tab=medications    → reuse MedicationRequestManager
  ├── ?tab=care-plans     → reuse CarePlanDashboard
  ├── ?tab=observations   → reuse ObservationDashboard
  ├── ?tab=avatar         → reuse PatientAvatarPage
  ├── ?tab=documents      → NEW: clinical document list
  ├── ?tab=immunizations  → reuse ImmunizationDashboard
  └── ?tab=timeline       → patient event timeline
```

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/chart/PatientChartNavigator.tsx` | Main unified chart page |
| `src/components/chart/ChartTabBar.tsx` | Tab navigation bar |
| `src/components/chart/PatientChartHeader.tsx` | Persistent patient info header |
| `src/components/chart/ClinicalDocumentList.tsx` | Document browser (SOAP notes, etc.) |
| `src/components/chart/__tests__/*.test.tsx` | Tests for all new components |

### Files to Modify
| File | Change |
|------|--------|
| `src/routes/routeConfig.ts` | Add `/patient-chart/:patientId` route |
| `src/routes/lazyComponents.tsx` | Add lazy import for PatientChartNavigator |
| `src/routes/RouteRenderer.tsx` | Add wrapper component |
| `src/components/physician/PhysicianPanel.tsx` | Update navigation to use `/patient-chart/:id` |
| `src/components/nurse/NursePanel.tsx` | Update navigation to use `/patient-chart/:id` |
| `src/components/admin/AdminHeader.tsx` | Add "Charts" nav item |

### How It Should Feel
1. Physician clicks patient in list → lands on `/patient-chart/abc123?tab=medications`
2. Clicks "Care Plans" tab → URL changes to `?tab=care-plans`, patient stays, NO page reload
3. Clicks "Body Map" tab → `?tab=avatar`, same patient, instant switch
4. Clicks "Back to Census" → goes back to patient list cleanly
5. Every tab reuses EXISTING components (no new data fetching code needed)

---

## Instructions for Claude

When you pick this up:

1. Read CLAUDE.md first
2. Read this entire document
3. Read `src/components/physician/PhysicianPanel.tsx` to understand current navigation
4. Read `src/components/nurse/NursePanel.tsx` for same
5. Read `src/contexts/PatientContext.tsx` to understand patient selection state
6. Follow the plan above — create the unified chart navigator
7. Wire routes, update PhysicianPanel and NursePanel to navigate to `/patient-chart/:patientId`
8. Run `npm run typecheck && npm run lint && npm test` before done
9. Commit and push

### Key Constraint
- REUSE existing components as tab content (don't rebuild MedicationRequestManager, etc.)
- The tab bar just swaps which existing component is rendered
- Patient ID comes from URL params, not from PatientContext (URL is source of truth)

---

## Remaining from Avatar Feature Build

These still need to be done (were not done before battery died):

1. **Run migration:** `npx supabase db push` (for ai_avatar_entity_extractor skill)
2. **Deploy edge function:** `npx supabase functions deploy ai-avatar-entity-extractor --no-verify-jwt`
3. **Pre-existing test failure:** `BloodPressureMonitorPage.test.tsx` — unrelated to avatar work, investigate separately
