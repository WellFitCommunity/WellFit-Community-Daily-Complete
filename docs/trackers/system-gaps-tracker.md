# System Gaps Tracker

> **Source:** System Assessment 2026-03-27 (code-level audit)
> **Full report:** `docs/SYSTEM_ASSESSMENT_2026-03-27.md`

---

## P0 — Critical (Blocks Hospital Pilot)

| # | Gap | Description | Est. Hours | Status |
|---|-----|-------------|-----------|--------|
| G-1 | Push notification auth gap | `send-push-notification` edge function has no JWT/auth validation — any caller can send messages to patients | 2 | ✅ DONE |
| G-2 | AI functions crash on empty input | `ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-medication-reconciliation` return WORKER_ERROR instead of 400 validation error | 4 | ✅ DONE |
| G-3 | Drug interaction CORS on auth error | `check-drug-interactions` doesn't include CORS headers on 401 response — browser gets opaque CORS failure | 1 | ✅ DONE |

**P0 subtotal:** ~7 hours

---

## P1 — High (Should Fix Before Pilot)

| # | Gap | Description | Est. Hours | Status |
|---|-----|-------------|-----------|--------|
| G-4 | No generated database types | 603 tables with manual TypeScript interfaces — should auto-generate from schema | 4 | ✅ DONE (pre-existing: `npm run db:types` + 62K-line `database.generated.ts`) |
| G-5 | Wearable DB migrations skipped | `wearable_vital_signs`, `wearable_connections`, `wearable_activity_data`, `wearable_fall_detections`, `wearable_gait_analysis` defined but in `_ARCHIVE_SKIPPED/` — not applied | 2 | ✅ DONE |
| G-6 | BLE offline->cloud sync gap | Offline reading queue captures BLE vitals (500 item buffer) but no edge function exists to persist them to `wearable_vital_signs` | 6 | ✅ DONE |
| G-7 | Garmin OAuth 1.0a not implemented | Adapter skeleton exists, `getAuthorizationUrl()` throws. Needs HMAC-SHA1 signing. Second most popular wearable ecosystem. | 8 | TODO |

**P1 subtotal:** ~20 hours

---

## P2 — Next Up

| # | Gap | Description | Est. Hours | Status |
|---|-----|-------------|-----------|--------|
| G-8 | Samsung Health error handling | Adapter is implemented but needs auditLogger, retry logic, rate limiting (matches Fitbit pattern) | 2 | TODO |
| G-9 | Amazfit error handling | Adapter is implemented but has empty catch blocks in fetchVitals(), needs auditLogger, retry logic | 2 | TODO |
| G-10 | No wearable webhook listeners | Fitbit/Withings/Garmin can push real-time vital changes but no endpoint receives them | 8 | TODO |
| G-11 | RPM billing not wired to claims | CPT 99453-99458 types defined, `rpm_enrollments` schema exists, but not connected to `generate-837p` or claims pipeline | 12 | TODO |
| G-13 | No load/stress testing | Integration tests prove correctness (65 passing), not performance under concurrent load | 8 | TODO |

**P2 subtotal:** ~38 hours

---

## Deferred — Requires iOS Platform

| # | Gap | Description | Est. Hours | Status |
|---|-----|-------------|-----------|--------|
| G-12 | Apple HealthKit needs iOS app | Adapter reads from synced records, but no iOS companion app exists to push HealthKit data | 40+ | DEFERRED (requires native iOS app) |

---

## Summary

| Priority | Items | Hours | Focus |
|----------|-------|-------|-------|
| P0 Critical | 3 | ~7 | Security + stability (push auth, AI crashes, CORS) |
| P1 High | 4 | ~20 | Data infrastructure (DB types, wearable tables, BLE sync, Garmin) |
| P2 Next Up | 5 | ~38 | RPM billing, webhooks, adapters, load testing |
| Deferred | 1 | ~40+ | iOS app (different platform) |
| **Total** | **13** | **~105+** | |

**P0 + P1 COMPLETE.** Now executing P2.

---

## Rules

1. Follow the same governance as all other trackers (CLAUDE.md rules apply)
2. Each fix must include tests
3. Security fixes (G-1, G-3) require `/security-scan` validation after
4. Database changes (G-4, G-5) require `npx supabase db push` + verification
5. Edge function fixes (G-2, G-6) require deploy + live integration test
