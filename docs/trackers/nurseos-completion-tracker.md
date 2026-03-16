# NurseOS Intelligent Panel — Completion Tracker

> **Purpose:** Close all engineering gaps in NurseOS Emotional Resilience Hub — tests, routing, ServiceResult migration, god file decomposition, audit logging, AI integration, and production polish.

**Created:** 2026-03-16
**Owner:** Maria (approved direction), Claude implementing
**Estimated Total:** ~24-30 hours across 3-4 sessions
**Baseline:** 7 components, 1 service file, 1 types file, 4,044 lines, 0 tests, 0 routes wired

---

## Audit Summary (2026-03-16)

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | 0/7 components | 7/7 |
| Routes Wired | 0 | At least 1 (dashboard entry point) |
| ServiceResult Pattern | 0/18 functions | 18/18 |
| God Files (>600 lines) | 3 files | 0 files |
| Audit Logging (error paths) | 2/18 functions | 18/18 |
| AI Integration | 0 skills | At least 1 |
| `alert()` in production | 3 instances | 0 |

---

## P0 — Critical Blockers (Must Fix Before Demo)

These prevent the feature from being usable or safe.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P0-1 | Wire routes in App.tsx | Add lazy-loaded route for ResilienceHubDashboard (minimum `/nurse-wellness` or `/resilience-hub`). Verify route is accessible. | 1 | ⬜ Todo |
| P0-2 | Test suite: BurnoutAssessmentForm | MBI scoring accuracy (composite calculation, risk level thresholds), dimension score math, crisis detection triggering, form validation. **This is the highest-risk untested code — a miscalculated score could tell a nurse in crisis they're "low risk."** | 3 | ⬜ Todo |
| P0-3 | Test suite: DailyCheckinForm | Slider interactions, form submission, upsert behavior, Clarity vs Shield field visibility, error states | 2 | ⬜ Todo |
| P0-4 | Test suite: ResilienceHubDashboard | Dashboard stat rendering, intervention alert display, check-in prompt visibility, risk badge colors, loading/error states | 2 | ⬜ Todo |
| P0-5 | Remove `alert()` calls | Replace 3 `alert()` instances with proper toast/error state UI (ResilienceLibrary.tsx:108, :137, ResilienceHubDashboard.tsx:293) | 1 | ⬜ Todo |

**P0 subtotal:** ~9 hours (Session 1)

---

## P1 — ServiceResult Migration & Error Handling

Service layer must match codebase patterns. Currently throws exceptions instead of returning `failure()`.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P1-1 | Migrate check-in functions to ServiceResult | `submitDailyCheckin`, `getMyCheckins`, `hasCheckedInToday`, `getStressTrend`, `getCheckinStreak` — return `success()`/`failure()` instead of throwing | 2 | ⬜ Todo |
| P1-2 | Migrate assessment functions to ServiceResult | `submitBurnoutAssessment`, `getMyAssessments`, `getLatestBurnoutRisk`, `checkInterventionNeeded` | 1.5 | ⬜ Todo |
| P1-3 | Migrate training functions to ServiceResult | `getActiveModules`, `trackModuleStart`, `trackModuleCompletion`, `getMyCompletions` | 1.5 | ⬜ Todo |
| P1-4 | Migrate resource/circle functions to ServiceResult | `getResources`, `trackResourceView`, `getMyCircles`, `getCircleReflections`, `postReflection`, `markReflectionHelpful` | 2 | ⬜ Todo |
| P1-5 | Migrate dashboard aggregation to ServiceResult | `getDashboardStats` — update to handle `ServiceResult` returns from all sub-functions | 1 | ⬜ Todo |
| P1-6 | Fix missing auditLogger calls | Add `auditLogger.error()` to all 15 empty error paths in resilienceHubService.ts (lines 70, 99, 124, 144, 191, 214, 234, 254, 287, 325, 377, 487, 512, 549, 574) | 1 | ⬜ Todo |
| P1-7 | Update components for ServiceResult | Update ResilienceHubDashboard, DailyCheckinForm, BurnoutAssessmentForm, ResilienceLibrary, ResourceLibrary to check `.success` instead of try-catch | 2 | ⬜ Todo |

**P1 subtotal:** ~11 hours (Session 2)

---

## P2 — God File Decomposition

Three files exceed 600-line limit. Decompose without degrading functionality.

| # | Item | File | Lines | Decomposition Plan | Est. Hours | Status |
|---|------|------|-------|-------------------|-----------|--------|
| P2-1 | Decompose resilienceHubService.ts | `src/services/resilienceHubService.ts` | 704 | Split into `src/services/nurseos/checkinService.ts`, `assessmentService.ts`, `trainingService.ts`, `supportCircleService.ts`, `dashboardService.ts`, `index.ts` (barrel) | 2 | ⬜ Todo |
| P2-2 | Decompose ResilienceLibrary.tsx | `src/components/nurseos/ResilienceLibrary.tsx` | 670 | Extract `BoxBreathingExercise`, `MicroBreakRoutine`, `BoundariesArticleContent`, `CommunicationScriptsContent` to `src/components/nurseos/interactive/` | 1.5 | ⬜ Todo |
| P2-3 | Decompose nurseos.ts (if needed) | `src/types/nurseos.ts` | 700 | Split into `assessment.types.ts`, `checkin.types.ts`, `training.types.ts`, `support.types.ts`, `constants.ts`, `index.ts` (barrel). Types files are borderline — decompose if Maria agrees. | 1 | ⬜ Todo |

**P2 subtotal:** ~4.5 hours (Session 2, after P1)

---

## P3 — Remaining Test Coverage

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P3-1 | Test suite: ResilienceLibrary | Module browsing, category filtering, start/complete tracking, celebration modal trigger, interactive exercises (box breathing timer) | 2 | ⬜ Todo |
| P3-2 | Test suite: ResourceLibrary | Resource filtering by category/type/role, emergency banner display, view tracking | 1.5 | ⬜ Todo |
| P3-3 | Test suite: CelebrationModal | Renders celebration content, shows confetti animation state, close behavior | 1 | ⬜ Todo |
| P3-4 | Test suite: LanguageSwitcher | Language toggle, translation key rendering, persistence | 0.5 | ⬜ Todo |
| P3-5 | Service unit tests | `calculateCompositeBurnoutScore`, `getBurnoutRiskLevel`, `calculateMBIDimensionScore` utility functions in nurseos.ts | 1 | ⬜ Todo |
| P3-6 | Anonymous post RLS check | Verify `postReflection` with `author_id: null` works with RLS policy on `provider_support_reflections`. If RLS blocks anonymous inserts, add policy or use system user. | 1 | ⬜ Todo |

**P3 subtotal:** ~7 hours (Session 3)

---

## P4 — AI Integration (Future Value)

Not blocking demo but transforms NurseOS from a tracking tool into an intelligent system.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P4-1 | Register NurseOS AI skill in `ai_skills` | `skill_key: 'nurseos_burnout_advisor'`, model pinned, patient_description for HTI-2 transparency | 0.5 | ⬜ Todo |
| P4-2 | AI-powered module recommendations | Edge function that analyzes check-in patterns + burnout risk and suggests specific resilience modules | 3 | ⬜ Todo |
| P4-3 | AI stress trend narrative | Edge function that generates plain-language stress trend summary ("Your stress has increased 30% this week, primarily on days with high patient census") | 2 | ⬜ Todo |
| P4-4 | Wire to Claude-in-Claude triage | Add nurse burnout signals to `triageSignalAggregationService` so meta-triage can reason about provider wellness alongside patient risk | 2 | ⬜ Todo |

**P4 subtotal:** ~7.5 hours (Session 4, stretch goal)

---

## Session Plan

| Session | Priorities | Focus | Est. Hours |
|---------|-----------|-------|-----------|
| Session 1 | P0 (all) | Routes, critical tests, alert() removal — **makes it demoable** | 8-9 |
| Session 2 | P1, P2 | ServiceResult migration, god file decomposition — **makes it compliant** | 12-15 |
| Session 3 | P3 | Remaining tests, RLS verification — **makes it shippable** | 7 |
| Session 4 | P4 | AI integration — **makes it intelligent** | 7.5 (stretch) |

---

## Governance Notes

- All new tests must pass the Deletion Test (would fail for empty `<div />`)
- All new service functions must return `ServiceResult<T>` (no throws)
- All error paths must call `auditLogger.error()` (no empty catches)
- Synthetic test data only — "Test Nurse Alpha", DOB 2000-01-01, etc.
- After decomposition: `bash scripts/typecheck-changed.sh && npm run lint && npm test`
- Sub-agents working on this tracker are bound by CLAUDE.md rules (no exceptions)
