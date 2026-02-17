# Project State — Envision ATLUS I.H.I.S.

> **Read this file FIRST at the start of every session.**
> **Update this file LAST at the end of every session.**

**Last Updated:** 2026-02-17
**Last Session:** Built Physician & Nurse Office Dashboards, audited Oncology & Cardiology modules, created trackers
**Updated By:** Claude Opus 4.6

---

## Current Priority: L&D Module (Session 8 Next)

The Labor & Delivery module is the active build. Sessions 1-7 are complete.

**Tracker:** `docs/trackers/ld-module-tracker.md`

| Session | Status | What Was Built |
|---------|--------|----------------|
| 1 | Done | Data entry forms (prenatal, labor, delivery) |
| 2 | Done | Monitoring + newborn + postpartum forms |
| 3 | Done | Partogram + alert persistence + risk assessment |
| 4 | Done | FHIR mapping + billing suggestions + delivery summary |
| 5 | Done | Alert persistence in dashboard + edge function |
| 6 | Done | Tier 1 AI integrations (escalation, progress note, drug interaction, discharge) |
| 7 | Done | Tier 2 AI integrations (guideline compliance, shift handoff, SDOH detection) |
| 8 | Pending | Tier 3 AI (birth plan, PPD early warning, contraindication, patient education) |

**Next action:** Start Session 8 — Tier 3 AI moonshot features, OR move to next priority per Maria's direction.

---

## Active Trackers (Fixed Paths)

| Tracker | Path | Status |
|---------|------|--------|
| L&D Module | `docs/trackers/ld-module-tracker.md` | Active — Session 8 next |
| Oncology Module | `docs/trackers/oncology-module-tracker.md` | Foundation BUILT, Phase 1 next (11 sessions total) |
| Cardiology Module | `docs/trackers/cardiology-module-tracker.md` | Foundation BUILT, Phase 1 next (12-13 sessions total) |
| Clinical Revenue Build | `docs/CLINICAL_REVENUE_BUILD_TRACKER.md` | Phase 1: 88%, Phase 2: 89% |
| Test Coverage Scale | `docs/TEST_COVERAGE_SCALE_TRACKER.md` | Stale (Feb 4) — needs refresh |

---

## Codebase Health Snapshot

| Metric | Value | As Of |
|--------|-------|-------|
| Tests | 8,441 passed, 0 failed | 2026-02-17 |
| Test Suites | 431 | 2026-02-17 |
| Typecheck | 0 errors | 2026-02-17 |
| Lint | 0 errors, 0 warnings | 2026-02-17 |
| God files (>600 lines) | 0 violations | 2026-02-17 |

---

## What Was Completed Today (2026-02-17)

1. Built AI Patient Priority Boards (physician + nurse scoring, click-to-chart)
2. Built Physician Office Dashboard (`/physician-office`) — 6 tabs, 14 composed admin sections
3. Built Nurse Office Dashboard (`/nurse-office`) — 6 tabs, nurse-specific workflow
4. Audited Oncology module — foundation 100% built, 11 sessions remaining for full production
5. Created Oncology Module Tracker (`docs/trackers/oncology-module-tracker.md`)
6. Audited Cardiology module — foundation 60-65% built, 12-13 sessions remaining
7. Created Cardiology Module Tracker (`docs/trackers/cardiology-module-tracker.md`)
8. Tests: 8,415 → 8,441 (+26), Suites: 429 → 431 (+2)

---

## Action Items (Time-Sensitive)

- [ ] **Run headless scripts to generate feature list + user manual** — Maria is excited about this, do it TODAY or TOMORROW
  - `bash scripts/headless/generate-feature-list.sh > docs/FEATURE_LIST.md`
  - `bash scripts/headless/generate-manual.sh > docs/USER_MANUAL.md`

## Blocked Items

None currently blocked.

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-16 | All skills use SKILL.md (uppercase) | Consistency across 7 skills |
| 2026-02-16 | PROJECT_STATE.md at docs/ root | Fixed path so Claude never hunts for it |
| 2026-02-16 | Test coverage tracker needs refresh | Baseline was 7,109 tests on Feb 4; now 8,415 |

---

## Session Start Protocol

At the start of every session, Claude MUST:

1. Read `docs/PROJECT_STATE.md` (this file)
2. Read `CLAUDE.md` (governance rules)
3. Report a 5-line status summary:
   - Last session date and what was completed
   - Current tracker and next priority item
   - Codebase health (tests/lint/typecheck from last known)
   - Any blocked items
   - Estimated sessions remaining for current priority
4. Confirm with Maria before starting work
