# BLE Vitals + RPM Enrollment Readiness Tracker

> **Status:** Active — opened 2026-06-30
> **Owner:** Maria (AI System Director) · Clinical policy sign-off: Akima (CCO)
> **Goal:** Make Bluetooth (BLE) vital capture real and enrollment-ready for the four
> senior-priority devices, surface community vitals to the doctor as weekly averages
> (not 90 raw rows), and add a senior-safe "native system mode" banner for AI outages.
> **Scope devices (locked):** blood pressure cuff, glucometer, scale, pulse oximeter.
> Watches/wearables (Apple Watch, Fitbit, etc.) are explicitly OUT — later phase, younger demographic.

---

## 0. Established facts (verified, do not re-investigate)

| Fact | Evidence |
|---|---|
| BLE engine is REAL and spec-accurate for all 4 devices | `src/services/ble/bleConnectionManager.ts`, `src/services/ble/bleVitalParsers.ts` (GATT 0x1810 BP, 0x1808 glucose, 0x1822 pulse-ox, 0x181D scale; IEEE-11073 SFLOAT parsing) |
| The engine was never wired to any screen, and `ble-sync` was never called | Only importer of `bleConnectionManager` is its own test; `ble-sync` has zero callers in `src/` |
| Persistence endpoint is REAL and authed | `supabase/functions/ble-sync/index.ts` → writes `wearable_vital_signs` |
| Device pages + `DeviceService` already read/write the SAME table (`wearable_vital_signs`) | `src/services/deviceService.ts` |
| **Row-shape + naming mismatch** between `ble-sync` (atomic rows, `blood_glucose`) and `DeviceService` (composite row w/ metadata, `glucose`) | See §1 — must reconcile |
| **`wearable_vital_signs.vital_type` CHECK now allows** heart_rate, blood_pressure, oxygen_saturation, temperature, respiratory_rate, **blood_glucose, weight, body_temperature** | Widened + verified live 2026-06-30, migration `20260630170000_widen_wearable_vital_type_check.sql` |
| Check-in vitals ALREADY auto-convert to FHIR Observations (LOINC) via DB trigger | `supabase/migrations/20260207170000_rpm_checkin_fhir_observation_trigger.sql` — governance "gap" note is STALE |
| iPhone/iPad CANNOT do Web Bluetooth (Apple/WebKit limitation, all iOS browsers) | `src/components/vitals/useCapabilities.ts` already detects this |
| Doctor views show LATEST-only (`DoctorsView`) or RAW 90-point chart (`RpmPatientDetail`) — no statistical weekly summary | `src/pages/DoctorsView/useDoctorsViewData.ts`, `src/components/rpm/RpmPatientDetail.tsx` |
| Weekly-average logic already exists but is wired only to PATIENT screens | `src/components/HealthInsightsWidget.tsx` (`computeAvg`, 7d/30d) |

---

## 1. Canonical decisions (LOCKED — do not re-litigate)

1. **Storage table:** `wearable_vital_signs` for all BLE + device-page readings.
2. **Row shape — composite, one row per reading:**
   - Blood pressure → ONE row: `vital_type='blood_pressure'`, `value=systolic`, `unit='mmHg'`,
     `metadata={ systolic, diastolic, pulse }`.
   - Glucose → ONE row: `vital_type='blood_glucose'`, `value`, `unit='mg/dL'`, `metadata={ meal_context }`.
   - Pulse ox → ONE row: `vital_type='oxygen_saturation'`, `value=spo2`, `unit='%'`, `metadata={ pulse_rate }`.
   - Weight → ONE row: `vital_type='weight'`, `value`, `unit`, `metadata={ bmi?, body_fat?, muscle_mass? }`.
3. **Glucose naming:** `blood_glucose` everywhere. `DeviceService.saveGlucoseReading` / `getGlucoseReadings`
   MUST be updated from `'glucose'` → `'blood_glucose'` (currently broken against the constraint anyway).
4. **`ble-sync` must emit the composite shape above** (today it emits atomic rows + `blood_glucose`/`heart_rate` splits).
   Rewrite `DEVICE_TYPE_TO_VITAL` mapping into a per-device "compose one row" function.
5. **iPhone/iPad:** never show a pair button; show manual entry + the existing capability message. Android/desktop Chrome/Edge only for BLE.
6. **Doctor vitals view (Akima-approved):** weekly averages across selected window (1/3/6 mo),
   expandable to full reading list, with out-of-range + outliers surfaced separately and always visible.
7. **AI-outage banner copy (Maria-approved):** positive framing — e.g. **"Currently running in native system mode — your information is saving normally."** NOT "AI is down."
8. **Device-name memory (Maria-approved):** after first pairing, store a senior-friendly label on the
   `wearable_connections` row (reuse `device_model` or add `friendly_name`) so the UI shows "Connect My
   Blood Pressure Cuff", never the cryptic GATT name. Also use the browser's remembered-device path
   (`navigator.bluetooth.getDevices()`) to auto-reconnect without re-showing the chooser. First-ever pick
   still requires the system chooser once (Apple/Chrome security) — do it WITH the senior at enrollment (CHW).
9. **Report routing (Maria-approved):** report recipient is a per-tenant SETTING, never hardcoded.
   Today → WellFit admin; future → doctor's office (so the provider gets billing credit for review).
   Every report view logs **who reviewed it and when** (review-attribution = the billing-credit trail for
   RPM 99457/99458). iPhone seniors = manual entry = TPM (not billable RPM); Android BLE = device-transmitted.
   No cellular devices (no budget) — confirmed 2026-06-30.

---

## 2. Sessions

### ✅ Session A — BLE capture bridge + Blood Pressure vertical slice — DONE 2026-06-30 (commit 4d0726ea)
**Build:**
- [ ] New hook `src/hooks/useBleCapture.ts` — wraps `bleConnectionManager` + `useCapabilities`:
  returns `{ isSupported, isIOS, status, lastReading, error, pair(deviceType), disconnect() }`.
  On each reading: persist via a new client `src/services/ble/bleSyncClient.ts` that invokes
  `supabase.functions.invoke('ble-sync', { body: { readings:[reading] } })`. (Function name is `ble-sync` — dashes.)
- [ ] Fix `ble-sync` to emit the §1.2 composite shape (one row per reading, `blood_glucose`, BP metadata).
- [ ] Rewire `src/pages/devices/BloodPressureMonitorPage.tsx`:
  - Replace the fake `DeviceService.connectDevice` "Connect Monitor" (which only flips a DB flag) with `useBleCapture('blood_pressure').pair()`.
  - On iPhone/iPad (or any non-BLE browser): hide pair button, show `getCapabilityMessage('hasWebBluetooth', …)` + keep manual entry.
  - Remove/relabel the misleading "Compatible BP Monitors … Any Bluetooth-enabled monitor" block so it never implies iPhone works.
- [ ] **Senior-proofing (per §1.8):**
  - Detect non-Chrome / in-app webview (no `navigator.bluetooth`) and show "Open in Chrome to connect your cuff" instead of a dead button.
  - On first successful pair, save a friendly name to `wearable_connections` and show "Connect My Blood Pressure Cuff" thereafter.
  - Auto-reconnect via `navigator.bluetooth.getDevices()` so the chooser doesn't reappear each visit.
  - On-screen plain steps: "1. Press the button on your cuff until it flashes. 2. Tap Connect. 3. Pick your cuff."
- [ ] Test: `src/pages/devices/__tests__/BloodPressureMonitorPage.test.tsx` — assert (a) iPhone path shows manual-only + no pair button, (b) a parsed reading persists via mocked `ble-sync`, (c) saved reading renders, (d) saved friendly name renders on the connect button. Deletion-test compliant.
**Acceptance:** scoped typecheck 0 / lint 0 / tests pass. **Field proof (Maria):** on an Android phone in Chrome, pair a real BP cuff, take a reading, see it appear + land in `wearable_vital_signs` (verify row via SQL); reload and confirm it reconnects by friendly name without the chooser.

### ✅ Session B — Glucometer, Scale, Pulse-Ox slices — DONE 2026-06-30
Glucose `'glucose'`→`'blood_glucose'` fixed in DeviceService (save+read); grep confirmed it was the only DB sister. All three pages use `useBleCapture` with iPhone gating + friendly name + senior steps; weight maps `lb`→`lbs`. 65 device/service tests pass.
- [ ] Apply the Session-A pattern to `GlucometerPage.tsx`, `SmartScalePage.tsx`, `PulseOximeterPage.tsx`.
- [ ] Update `DeviceService`: glucose `'glucose'`→`'blood_glucose'` (save + read); confirm weight/spo2 already align to §1.2.
- [ ] Tests per page (same three assertions). 
- [ ] Codebase-wide grep for any other `'glucose'` vital_type writer/reader; fix sisters.
**Acceptance:** scoped typecheck/lint/tests green. Field proof per device where hardware is available.

### 🟡 Session C — Doctor weekly-average vitals view — CODE DONE 2026-06-30 (FHIR sub-item deferred, Tier 3)
- [x] New service `src/services/vitalsSummaryService.ts`: weekly buckets `{ weekStart, avg, min, max, count, outOfRangeCount }`
  + flagged outliers. Scoped to the 4 BLE verticals (`blood_pressure`, `blood_glucose`, `oxygen_saturation`, `weight`)
  per the "skip wearables" decision. Live schema of `wearable_vital_signs` verified before design (rule 18). Clinical
  out-of-range bounds aligned to the RPM chart reference lines (BP 90/140, glucose 70/200, SpO2 low 92; weight = no
  absolute range). **Outlier method = Iglewicz–Hoaglin modified Z-score (MAD), not plain 2 SD** — plain SD lets a lone
  spike mask itself in the small samples typical of senior home monitoring. Engineering-judgment substitution, same intent.
- [x] New component `src/components/clinical/VitalsWeeklySummary.tsx`: weekly-average chart (recharts) + vital + window
  selectors + "View complete list" expander + a persistent, always-visible "Out of Range / Outliers" panel.
- [x] Wired into `src/pages/DoctorsView/DoctorsViewPage.tsx` (scoped to `userId`) and `RpmPatientDetail.tsx`.
- [ ] **FHIR (DEFERRED — Tier 3, awaiting Maria):** map check-in `weight` (LOINC 29463-7) in the trigger; add a
  wearable→`fhir_observations` path so BLE readings reach FHIR like check-ins do. Schema/trigger change — not a
  defect; the weekly view is fully functional without it.
- [x] Tests: `vitalsSummaryService` (20) + `VitalsWeeklySummary` (renders averages, panels always visible, expander
  reveals full list, window re-query, empty state).
**Verification (2026-06-30):** scoped typecheck 0 errors · lint 0/0 · tests 43 passed (20 service + component + 23 DoctorsView, no regression).
**Acceptance:** doctor sees one dot/week over 1/3/6 mo, can expand to full list, out-of-range always visible. ✅ code.
**Field proof (Maria, pending):** seed N days of device readings for an enrolled senior, open DoctorsView / RpmPatientDetail, confirm weekly rollup + flags render.

### Session D — Native-system-mode banner + contraindication safety message (~0.5 session)
- [ ] Shared `src/components/shared/NativeModeBanner.tsx` — shows §1.7 copy when AI is unavailable.
  Drive it off existing `claudeService.isAvailable()` / circuit-breaker state (`src/services/claude/circuitBreaker.ts`).
- [ ] Senior side: show banner on check-in/dashboard when AI degraded. Clinician side: on the contraindication panel,
  replace the generic error with an explicit **"Automated contraindication safety check is unavailable — perform manual review"** (file: the contraindication panel that calls `ai-contraindication-detector`).
- [ ] Tests: banner renders only when AI unavailable; contraindication panel shows the explicit manual-review message on outage.
**Acceptance:** typecheck/lint/tests green. Visual check (Maria) of banner copy/placement.

### Session E — Automated RPM/vitals report pipeline (~1.5–2 sessions)
**Verified 2026-06-30: NO end-to-end report pipeline exists today.** All three links are broken —
generation is screen/print-only, there is no scheduler for it, and nothing emails a report to staff.
What exists is an unrelated daily *security/alert* email (`guardian-daily-summary`) and an alert-only
`vital-threshold-monitor` — neither is the vitals report. This session assembles the real one from
existing parts (assembly, not invention).

**Build:**
- [ ] **Generate** — new `src/services/rpmReportService.ts` (or edge fn) that builds one report per enrolled
  senior: readings per vital over the period + weekly averages (reuse `vitalsSummaryService` from Session C)
  + out-of-range flags + the 16-day transmission count (reuse `rpmDashboardService.getTransmissionDays` /
  `getBulkBillingEligibility`). Render the document by reusing `supabase/functions/pdf-health-summary` (already builds an HTML vitals summary).
- [ ] **Schedule** — new `cron.schedule(...)` migration modeled on `guardian-daily-summary`
  (`20251107180000_guardian_cron_monitoring.sql`). Default cadence: **weekly** (confirm with Maria). **(cron = Tier 3, confirm before push.)**
- [ ] **Send** — deliver via `send-email` / `send-team-alert` (pattern from `nightly-excel-backup`, which already
  emails an Excel export to `ADMIN_EMAILS`). Recipient is a **per-tenant setting** (§1.9) — WellFit now, doctor's office later — NOT hardcoded.
- [ ] **Review-attribution (§1.9)** — when a recipient opens/acknowledges a report, log `reviewed_by` + `reviewed_at`
  (new column or small `rpm_report_reviews` table). This is the billing-credit trail for RPM 99457/99458. (New table = Tier 3, confirm.)
- [ ] Tests: report builder (weekly rollup, flags, transmission count, empty/zero-reading senior), recipient-setting resolution, review-log write.
**Acceptance:** scoped typecheck/lint/tests green. **Live proof:** trigger the job for a test tenant, confirm an email
arrives at the configured recipient with real readings, and that opening it writes a `reviewed_by/at` row.
**Reusable foundations:** `guardian-daily-summary` cron, `nightly-excel-backup` (generate-file+email-admin), `pdf-health-summary` (vitals HTML), `rpmDashboardService` (data + transmission days), `send-email`/`send-team-alert`.

---

## 3. Field-test checklist (BLE cannot be verified in CI — needs hardware)
- [ ] Android phone or tablet, Chrome browser, HTTPS (secure context required).
- [ ] Real device per type, in pairing mode.
- [ ] Pair → take reading → reading appears on page → row present in `wearable_vital_signs` (SQL check).
- [ ] Repeat on an iPhone: confirm NO pair button, manual entry works, no false "Connected".

## 4. Out of scope (do not build here)
- Native iOS app for iPhone BLE (CoreBluetooth) — separate future project.
- Watches/CGMs/cloud-sync wearables (Withings/Fitbit/Garmin) — existing webhook adapters, separate track.
- Alternate (non-Anthropic) AI provider failover — noted, not in this tracker.

## 5. Governance notes
- Migration `20260630170000` already applied + verified (constraint widened).
- Session C FHIR trigger/weight mapping = schema change → Tier 3, confirm before `db push`.
- Every bug fix: codebase-wide grep for sisters (per adversarial-audit-lessons §1).
- `profiles` queries use `user_id`. Edge functions keep JWT+tenant auth (`ble-sync` already does).
