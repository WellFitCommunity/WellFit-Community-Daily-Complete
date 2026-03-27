# BLE / RPM / Wearable Device Tracker

> **Source:** System Assessment 2026-03-27 (code-level audit)
> **Full report:** `docs/SYSTEM_ASSESSMENT_2026-03-27.md`

---

## Current State Summary

### BLE Devices (Web Bluetooth) — PRODUCTION READY

| Device | GATT Service | Parser | UI Page | Status |
|--------|-------------|--------|---------|--------|
| Blood Pressure Cuff | 0x1810 | `bleVitalParsers.ts` | `BloodPressureMonitorPage.tsx` | Ready |
| Glucometer | 0x1808 | `bleVitalParsers.ts` | `GlucometerPage.tsx` | Ready |
| Pulse Oximeter | 0x1822 | `bleVitalParsers.ts` | `PulseOximeterPage.tsx` | Ready |
| Smart Scale | 0x181D | `bleVitalParsers.ts` | `SmartScalePage.tsx` | Ready |
| Thermometer | 0x1809 | `bleVitalParsers.ts` | — | Parser only |

**Key files:**
- `src/services/ble/bleConnectionManager.ts` (485 lines) — Web Bluetooth API, auto-reconnect, offline queue
- `src/services/ble/bleVitalParsers.ts` (270 lines) — IEEE 11073 compliant GATT parsing
- `src/components/vitals/VitalCapture.tsx` — Multi-modal input (manual, camera, BLE)
- `src/components/vitals/useBluetooth.ts` — React hook for BLE device connection

**Browser support:** Chrome, Edge, Opera on Android; Chrome/Edge on desktop. Not Safari/Firefox.

### Wearable Adapters

| Adapter | File | Lines | OAuth | Status |
|---------|------|-------|-------|--------|
| Fitbit | `src/adapters/wearables/FitbitAdapter.ts` | 564 | OAuth 2.0 | Real |
| Withings | `src/adapters/wearables/WithingsAdapter.ts` | 511 | OAuth 2.0 | Real |
| iHealth | `src/adapters/wearables/IHealthAdapter.ts` | 472 | OAuth 2.0 | Real (FDA-cleared) |
| Apple HealthKit | `src/adapters/wearables/AppleHealthKitAdapter.ts` | 501 | Needs iOS app | Stub |
| Garmin | `src/adapters/wearables/GarminAdapter.ts` | 274 | OAuth 1.0a needed | Stub |
| Samsung Health | `src/adapters/wearables/SamsungHealthAdapter.ts` | 429 | Not implemented | Stub |
| Amazfit | `src/adapters/wearables/AmazfitAdapter.ts` | 442 | Not implemented | Stub |

**Registry:** `src/adapters/wearables/WearableRegistry.ts` (380 lines) — singleton adapter lifecycle management

### Database Schema (DEFINED BUT NOT APPLIED)

Tables in `supabase/migrations/_ARCHIVE_SKIPPED/`:
- `wearable_connections` — device pairings, OAuth tokens, sync frequency
- `wearable_vital_signs` — vitals from any device (type, value, unit, measured_at, quality, alert)
- `wearable_activity_data` — daily summaries (steps, distance, calories, sleep)
- `wearable_fall_detections` — fall events with severity, GPS, emergency response
- `wearable_gait_analysis` — Parkinson's-specific: cadence, stride, tremor, freezing episodes

### Data Flow Gap

```
[BLE Device] → [bleConnectionManager] → [bleVitalParsers] → [Offline Queue (500 items)]
                                                                    ↓
                                                              ❌ NO SYNC ENDPOINT
                                                              Tables don't exist yet

[Fitbit/Withings API] → [Adapter] → [WearableVitalData]
                                           ↓
                                     ❌ NO PERSISTENCE
                                     Tables don't exist yet
```

---

## P0 — Database & Persistence (Must fix first)

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| R-1 | Apply wearable DB migrations | Move from `_ARCHIVE_SKIPPED/` to active, review schema, `npx supabase db push` | 2 | TODO |
| R-2 | Create BLE sync edge function | `sync-wearable-vitals` — accepts offline queue batch, validates, inserts to `wearable_vital_signs` | 4 | TODO |
| R-3 | Wire BLE offline queue to sync endpoint | `bleConnectionManager.syncOfflineReadings()` calls the new edge function | 2 | TODO |
| R-4 | Wire wearable adapters to persistence | After OAuth fetch, adapters save to `wearable_vital_signs` via the sync function | 2 | TODO |

**P0 subtotal:** ~10 hours

---

## P1 — OAuth Completion (Expand device coverage)

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| R-5 | Garmin OAuth 1.0a implementation | HMAC-SHA1 signing, request token flow, access token exchange | 8 | TODO |
| R-6 | Samsung Health API integration | OAuth setup, vital/activity fetch, data mapping | 6 | TODO |
| R-7 | Amazfit/Zepp Cloud API integration | OAuth setup, vital/sleep/activity fetch | 4 | TODO |

**P1 subtotal:** ~18 hours

---

## P2 — Real-Time & Clinical Integration

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| R-8 | Webhook listeners for Fitbit/Withings/Garmin | Receive push notifications when vitals change (near real-time) | 8 | TODO |
| R-9 | Vital threshold alerts | When BLE/wearable reading exceeds threshold → care team notification | 6 | TODO |
| R-10 | RPM billing (CPT 99453-99458) | Wire `rpm_enrollments` to claims pipeline, track transmission days | 12 | TODO |
| R-11 | Wearable vitals → FHIR Observations | Convert `wearable_vital_signs` to FHIR Observation resources for EHR sync | 8 | TODO |
| R-12 | Provider RPM dashboard | Clinician view of patient wearable data: trends, alerts, compliance | 8 | TODO |
| R-13 | Longitudinal vital trending | 7/30/90-day trend charts for home vitals (BP, glucose, weight, SpO2) | 6 | TODO |

**P2 subtotal:** ~48 hours

---

## P3 — Native Mobile (Long-term)

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| R-14 | iOS companion app for Apple HealthKit | Native Swift app using HealthKit SDK → POST to sync endpoint | 40+ | TODO |
| R-15 | Android Health Connect integration | Native/React Native bridge for Google Health Connect API | 30+ | TODO |

**P3 subtotal:** ~70+ hours

---

## Summary

| Priority | Items | Hours | Focus |
|----------|-------|-------|-------|
| P0 Database & Persistence | 4 | ~10 | Apply migrations, create sync endpoint, wire BLE + adapters |
| P1 OAuth Completion | 3 | ~18 | Garmin, Samsung, Amazfit |
| P2 Clinical Integration | 6 | ~48 | Webhooks, alerts, billing, FHIR, dashboard, trends |
| P3 Native Mobile | 2 | ~70+ | iOS HealthKit app, Android Health Connect |
| **Total** | **15** | **~146+** | |

**P0 alone enables the full BLE → database flow.** ~10 hours (1-2 sessions).

---

## Device Capability Matrix

| Vital | BLE | Fitbit | Withings | iHealth | Apple | Garmin | Samsung | Amazfit |
|-------|-----|--------|----------|---------|-------|--------|---------|---------|
| Heart Rate | — | Yes | Yes | — | Yes | Yes | Yes | Yes |
| Blood Pressure | Yes | — | Yes | Yes | Yes | Yes | Yes | — |
| SpO2 | Yes | Yes | Yes | Yes | Yes | Yes | — | Yes |
| Glucose | Yes | — | — | Yes | Yes | — | — | — |
| Weight/BMI | Yes | — | Yes | Yes | Yes | — | — | — |
| Temperature | Yes | — | Yes | — | Yes | Yes | — | — |
| Steps/Activity | — | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Sleep | — | Yes | Yes | — | Yes | Yes | Yes | Yes |
| Fall Detection | — | — | — | — | Yes | — | — | — |
| ECG | — | Yes* | — | — | Yes | — | Yes | — |

*Fitbit ECG: Sense/Sense 2 only
