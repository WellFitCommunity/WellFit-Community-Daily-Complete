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
| G-8 | Samsung Health error handling | Already had auditLogger in catch blocks — confirmed, no changes needed | 0 | ✅ DONE |
| G-9 | Amazfit error handling | Added auditLogger import and error logging to 2 empty catch blocks in fetchVitals() | 1 | ✅ DONE |
| G-10 | Wearable webhook listeners | 3 edge functions: `fitbit-webhook`, `withings-webhook`, `garmin-webhook` — receive push notifications, insert to wearable_vital_signs with needs_sync flag | 8 | ✅ DONE |
| G-11 | RPM billing wired to claims | `rpmClaimService.ts` orchestrates eligibility → encounter → procedure → claim. Fee schedule migration with CMS 2026 rates. 19 tests. | 12 | ✅ DONE |
| G-13 | Load/stress testing | k6 scripts: `edge-functions.js` (health/CORS/auth), `stress-test.js` (ramp to 200 VUs), `checkin-flow.js` (realistic check-in flow) | 4 | ✅ DONE |

**P2 subtotal:** ~25 hours → ALL DONE

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

**ALL GAPS COMPLETE** (except G-12 iOS app — different platform, deferred).

---

## Rules

1. Follow the same governance as all other trackers (CLAUDE.md rules apply)
2. Each fix must include tests
3. Security fixes (G-1, G-3) require `/security-scan` validation after
4. Database changes (G-4, G-5) require `npx supabase db push` + verification
5. Edge function fixes (G-2, G-6) require deploy + live integration test
