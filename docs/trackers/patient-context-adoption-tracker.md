# Patient Context Service Adoption Tracker

> **Goal:** Migrate ad-hoc patient data queries to the canonical `patientContextService` for ATLUS Unity + Accountability compliance.
>
> **Estimated effort:** 12-16 hours across 3 sessions
>
> **Started:** 2026-02-22

---

## Phase 0: Fix fetchTimeline.ts table/column bug (Prerequisite)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 0.1 | Change `daily_check_ins` -> `check_ins`, fix column names | `src/services/patient-context/fetchTimeline.ts` | DONE |
| 0.2 | Update `CheckInRow` type to match `check_ins` schema | `src/services/patient-context/types.ts` | DONE |
| 0.3 | Fix same table name bug in welfareCheckDispatcher | `src/services/ai/welfareCheckDispatcher.ts` | DONE |
| 0.4 | Fix same table name bug in emergencyAccessIntelligence | `src/services/ai/emergencyAccessIntelligence.ts` | DONE |
| 0.5 | Update tests for timeline + orchestrator | `__tests__/fetchTimeline.test.ts`, `__tests__/PatientContextService.test.ts` | DONE |

**Session 1 result:** 5/5 complete. All 38 patient-context tests pass.

---

## Phase 1: Add self_reports section to patientContextService

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Add `SelfReportEntry`, `SelfReportSummary` types | `src/types/patientContext.ts` | DONE |
| 1.2 | Add `includeSelfReports`, `maxSelfReports` options | `src/types/patientContext.ts` | DONE |
| 1.3 | Add `self_reports` field to `PatientContext` interface | `src/types/patientContext.ts` | DONE |
| 1.4 | Create `fetchSelfReports.ts` module | `src/services/patient-context/fetchSelfReports.ts` (NEW) | DONE |
| 1.5 | Wire `fetchSelfReports` into `PatientContextService.ts` Promise.all | `src/services/patient-context/PatientContextService.ts` | DONE |
| 1.6 | Update barrel export | `src/services/patient-context/index.ts` | DONE |
| 1.7 | Add `self_reports` mock to orchestrator test | `__tests__/PatientContextService.test.ts` | DONE |
| 1.8 | Create `fetchSelfReports.test.ts` (7 tests) | `__tests__/fetchSelfReports.test.ts` (NEW) | DONE |

**Session 1 result:** 8/8 complete. 51 patient-context tests pass (up from 38).

---

## Phase 2: Add batch demographics method

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | Add `getBatchDemographics()` method (max 500, single IN query) | `src/services/patient-context/PatientContextService.ts` | DONE |
| 2.2 | Add 6 tests for batch method | `__tests__/PatientContextService.test.ts` | DONE |

**Session 1 result:** 2/2 complete. File at 316 lines (under 600 limit).

---

## Phase 3: Migrate data-fetching.ts (CRITICAL)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Replace `fetchComprehensivePatientData()` with `getPatientContext()` call + adapter | `src/components/admin/enhanced-fhir/data-fetching.ts` | TODO |
| 3.2 | Replace `fetchPopulationData()` profiles query with `getBatchDemographics()` | `src/components/admin/enhanced-fhir/data-fetching.ts` | TODO |
| 3.3 | Verify downstream consumers unchanged (adapter preserves shape) | `EnhancedFhirServiceClass`, `clinical-decision-support`, `population-analytics` | TODO |

---

## Phase 4: Migrate DoctorsViewPage (CRITICAL)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4.1 | Extract data-fetching hook using `patientContextService` | `src/pages/DoctorsView/useDoctorsViewData.ts` (NEW) | TODO |
| 4.2 | Replace direct `check_ins` + `self_reports` queries | `src/pages/DoctorsViewPage.tsx` | TODO |
| 4.3 | Keep community engagement aggregate queries as direct (per CLAUDE.md) | `src/pages/DoctorsViewPage.tsx` | TODO |
| 4.4 | Decompose if over 600 lines | `src/pages/DoctorsView/` subdirectory | TODO |

---

## Phase 5: Migrate MPIReviewQueue

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5.1 | Replace 12-field profile fetch with `getMinimalContext()` | `src/components/admin/MPIReviewQueue.tsx` | TODO |
| 5.2 | Lazy-load address/email on expand for detailed comparison | `src/components/admin/MPIReviewQueue.tsx` | TODO |

---

## Phase 6: Final tests & verification

| # | Task | Status |
|---|------|--------|
| 6.1 | Verify all patient-context tests pass | TODO |
| 6.2 | Full suite: typecheck + lint + tests | TODO |
| 6.3 | Update PROJECT_STATE.md | TODO |

---

## Documented Exceptions (Keep as direct queries)

| File | Reason |
|------|--------|
| `PatientMergeWizard.tsx` | 21-field raw profile for field-by-field merge comparison |
| `mpiMergeService.ts` | 5-table clinical snapshot for rollback (write-path backup) |
| 8 Category A files | Single-field lookups (counts, role checks, existence checks) |

---

## Session Log

| Session | Date | Phases | Tests Before | Tests After | Result |
|---------|------|--------|-------------|-------------|--------|
| 1 | 2026-02-22 | 0 + 1 + 2 | 8,415 | 8,665 | typecheck 0, lint 0, 8,665 pass |
| 2 | TBD | 3 + 4 + 5 | 8,665 | — | — |
| 3 | TBD | 6 + verify | — | — | — |
