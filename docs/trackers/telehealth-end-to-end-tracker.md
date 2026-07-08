# Telehealth End-to-End Connection Tracker

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**

**Created:** 2026-07-07
**Owner:** Maria (product) + Akima (clinical sign-off on PHI/RLS)
**Why now:** Louisiana pilot, telehealth is a required workflow, targeted to start next month.
**Preferred UX (Maria):** Senior uses the **WellFit app** to join; connects to the clinician in Envision Atlus.
**Connection model (Maria-decided 2026-07-07):** **Pre-create the Daily room at scheduling time.** Senior can open WellFit anytime, join, and wait in the lobby; clinician admits via Daily "knocking."

---

## VERDICT (evaluated 2026-07-07, live-DB verified)

**Telehealth is NOT connected end-to-end today.** A senior tapping "Join Video Call" in WellFit would **not** reach the doctor's room. The infrastructure is real and good (Daily.co, HIPAA config, 3 edge functions, 2 tables, a correct patient waiting-room component) — but the pieces are **not wired into one working flow**. This is a wiring/glue job, not a rebuild.

### What's built and solid
- Daily.co integration (`@daily-co/daily-js` ^0.85.0 installed), HIPAA room config (private, cloud recording, knocking, PHI access logging).
- Edge functions: `create-telehealth-room`, `create-patient-telehealth-token`, `send-telehealth-appointment-notification`.
- Tables (both live): `telehealth_appointments` (28 cols, 10 rows) + `telehealth_sessions` (20 cols, **0 rows**).
- **Correct patient join component already exists**: `src/components/telehealth/PatientWaitingRoom.tsx` — reads the session, mints a patient token, joins the SAME room. It is **orphaned** (routed nowhere, rendered by nothing).

### Confirmed defects (file:line)

| # | Severity | Defect | Evidence |
|---|----------|--------|----------|
| **T-1** | 🔴 Blocker | WellFit patient page renders the **provider** component. `TelehealthAppointmentsPage` → `<TelehealthConsultation patientId={user.id} …/>`. That component creates an encounter treating the current user as the **Practitioner** and calls `create-telehealth-room` as room **owner** → a senior spins up their *own* room, never joins the doctor's. | `src/pages/TelehealthAppointmentsPage.tsx:238`; `src/components/telehealth/TelehealthConsultation.tsx:88-134` |
| **T-2** | 🔴 Blocker | The room URL is **never populated**. `daily_room_url`/`session_id` on `telehealth_appointments`: **0 of 10 rows set**. No code path (scheduler, notification, or function) ever writes them. The appointment and the video room are never linked. | Live: `count(daily_room_url)=0, count(session_id)=0`; grep found zero writers of `telehealth_appointments.daily_room_url` |
| **T-3** | 🔴 Blocker | Even the doctor's own flow is broken by a table mismatch: `TelehealthConsultation.createEncounter` INSERTs into **`fhir_encounters`**, but `create-telehealth-room` authorizes by looking the id up in **`encounters`** (different table) → 403 "Unauthorized access to this encounter." This is why `telehealth_sessions` has 0 rows. | `TelehealthConsultation.tsx:91`; `supabase/functions/create-telehealth-room/index.ts:72-83` |
| **T-4** | 🔴 Security (PHI) | RLS on both tables is **tenant-wide, not patient-scoped**. `telehealth_appointments_select = USING (tenant_id = get_current_tenant_id() OR is_super_admin())`; `telehealth_sessions` policies are `is_admin()` / `provider_id=auth.uid()` / `tenant_id=get_current_tenant_id()`. No `patient_id = auth.uid()`. Once the patient flow works, a senior could read **other patients'** appointments/sessions in their tenant. The page hides it only via a query-level `.eq('patient_id',…)`. | `pg_policies` on both tables, live 2026-07-07 |
| **T-5** | 🟠 Hides failures | Swallowed errors: empty `catch {}` blocks in the patient page, scheduler, and consultation. When RLS/query/room-creation fails, the senior silently sees "No Upcoming Appointments" or a dead button with no error. | `TelehealthAppointmentsPage.tsx:120-124`; `TelehealthConsultation.tsx:152-159, 262-264`; `TelehealthScheduler.tsx:114-116, 184-188` |
| **T-6** | 🟡 Bug | `PatientWaitingRoom` embeds `provider:provider_id (full_name, email)` on `telehealth_sessions`. `profiles` has no `full_name` and the PK is `user_id` — embed will fail/return null. Must fetch provider name like the other pages do (first_name + last_name via `user_id`). | `PatientWaitingRoom.tsx:80-83` |

### Config prerequisites (verify before pilot — not code)
- [ ] `DAILY_API_KEY` set in Supabase secrets (both room functions throw on boot without it).
- [ ] WellFit pilot domain in `ALLOWED_ORIGINS` (CORS) for the 3 telehealth functions.
- [ ] Confirm `verify_jwt` posture for the 3 functions in `config.toml` (per the verify-jwt reconciliation tracker — do NOT bulk-deploy).
- [ ] Confirm a WellFit senior actually has a `tenant_id` that matches the appointment's tenant, or T-4's tenant read returns 0 rows and the page shows "no appointments." (Community users' tenant context must be verified.)

---

## PROGRESS (2026-07-07) — Sessions 1, 2, and S3.1 DONE

Branch `claude/telehealth-e2e-connection` (commits `c8d1eb4d`, `59a544d7`, + S3.1).

**DONE & verified:**
- **S1.1** create-telehealth-room refactored (appointment-driven, idempotent, back-links the
  appointment, ad-hoc path preserved, encounters/fhir_encounters mismatch removed). Deno check clean.
- **S1.2** patient-scoped RLS migration `20260707130000` applied + live-verified (leak closed).
- **S1.3** live-proven: patient A sees only own rows (0 of B's); encounter→session→appointment
  write path proven via rolled-back transaction. **Live proof caught 2 real vocab mismatches**
  (encounters.encounter_type must be 'telehealth'/status 'scheduled'; telehealth_sessions.status
  must be 'active') — fixed before they could fail at runtime.
- **S2.1** WellFit page renders PatientWaitingRoom (not the provider component), gates Join on room
  readiness, surfaces load errors (T-1, T-5). **S2.2** provider-name fetch fixed (T-6).
  **S2.3** no route needed — /telehealth-appointments already nav-reachable.
  **S2.4** scheduler pre-creates the room at booking + scheduleAppointment now sets tenant_id.
  Typecheck 0 / lint 0 / page 6 + appt-service 13 tests green.
- **S3.1** TelehealthConsultation joins the appointment's pre-created room via appointmentId
  (idempotent); broken createEncounter removed; endCall closes the session.
- **Edge function DEPLOYED** to prod (`create-telehealth-room`) + live-probed: unauth POST → 401,
  OPTIONS → 204 (live, secure, CORS ok). Full invoke-with-real-room is the S3.2 round-trip.

**S3.1b — DONE (2026-07-08, Maria-approved route + page).**
- Route `/provider/telehealth/:appointmentId` → `ProviderTelehealthVisitWrapper` loads the
  appointment, resolves the patient name, and renders `TelehealthConsultation` keyed to the
  appointment (provider joins the SAME pre-created room). Wired into both routers, provider-role
  gated. Route added, NOT bolted onto the scheduler.
- Provider day view `/provider/telehealth` → **`TodaysTelehealthVisits`** (new page): lists the
  signed-in provider's telehealth appointments for today via `getProviderAppointments`, each with
  a "Start Visit" button → the visit route. Surfaces load errors (no silent empty list). Reachable
  via a new tile on the CHW Command Center (`CHWDashboardPage`).
- 4 behavior tests (deletion-test quality, synthetic data) green.

**S3.1c — Compass-Riley connected to telehealth (2026-07-08).** The physician's telehealth visit
  now gets the SAME scribe benefit as in-person: `TelehealthConsultation` passes
  `selectedPatientId` + `selectedPatientName` + the visit's `encounterId` into `RealTimeSmartScribe`
  (default `compass-riley` mode = SOAP + billing intelligence). Threaded `encounterId` through
  `RealTimeSmartScribe → useSmartScribe → saveScribeSession → scribe_sessions.encounter_id` so the
  SOAP note + suggested CPT/ICD-10 codes persist against the telehealth encounter. Previously the
  scribe rendered prop-less at `TelehealthConsultation.tsx:469` → generated a note but saved nothing.
  Live-verified the write path is runtime-safe (scribe_sessions: only patient_id is NOT NULL;
  INSERT RLS `created_by/provider_id = auth.uid()` satisfied). 388 existing scribe/appt/page tests
  still green.

**REMAINING:**
- **Physician-dashboard nav placement (follow-up).** `TodaysTelehealthVisits` is reachable from the
  CHW Command Center (admin/nurse/case-manager/clinical-supervisor). If physicians (physician/np/pa)
  need it on a physician-specific dashboard, tell me where and I'll add the tile. `/provider/availability`
  and `/appointment-analytics` are likewise typed-URL-only today — same nav gap.
- **S3.2 — full live two-party round-trip** (senior in WellFit + clinician in Envision, same Daily
  room, two-way A/V) + **visual acceptance [Maria, Commandment #13]**. Requires the branch frontend
  deployed (merge) + a real provider & patient session.
- **Prereqs to confirm in the pilot env:** WellFit domain in ALLOWED_ORIGINS; community seniors have
  a tenant_id matching their appointment (else the tenant-scoped reads return nothing).
- **Follow-ups (non-blocking):** encounter status lifecycle on `encounters` (visit start/complete);
  resolve the `encounters` vs `fhir_encounters` duplication (separate architecture decision);
  a behavior test for TelehealthConsultation (none exists today).

---

## S3.2 — PRE-MERGE ROUND-TRIP TEST SETUP (deferred 2026-07-08, Maria not ready)

When ready to run the live two-party test, here's the exact setup (backend recon already done):

**Deploy:** Frontend can't be deployed from the Claude session (Vercel MCP token scoped to a
different team → 403; no CLI). Vercel Git integration auto-builds a **preview** for the pushed
branch `claude/telehealth-e2e-connection` — get the preview URL from the Vercel dashboard.

**Confirmed already set (Supabase secrets):** `DAILY_API_KEY` ✅ present, `ALLOWED_ORIGINS` set.
`DEV_ALLOW_VERCEL` is NOT set. `verify_jwt = true` on both `create-telehealth-room` and
`create-patient-telehealth-token` (browser-called by an authenticated user — correct).

**The one blocker for a PREVIEW round-trip: CORS.** The telehealth edge functions only accept
origins in `ALLOWED_ORIGINS`; a `*.vercel.app` preview URL is not in it → Start Visit + senior join
would be CORS-blocked. **Tier-3 CORS decision — pick one:**
- **A.** Add the exact preview URL to `ALLOWED_ORIGINS` + redeploy the 2 room functions (surgical; URL changes per deploy).
- **B.** Set `DEV_ALLOW_VERCEL=true` + redeploy (allows any `*.vercel.app` preview; turn off after). Gated by `supabase/functions/_shared/cors.ts` `VERCEL_PATTERN`.
- **C.** Merge to `main` → production (`wellfitcommunity.live` already whitelisted; no CORS change needed).

**Test data needed:** a `telehealth_appointments` row — `provider_id` = physician test login,
`patient_id` = senior test login, same `tenant_id`, status scheduled/confirmed, `appointment_time`
= today (so it appears in "Today's Telehealth Visits"). Claude can seed this given the two account
UUIDs. Senior's `profiles.tenant_id` must match the appointment tenant (tracker prereq).

**Click-path to verify:** physician logs in → `/physician-dashboard` → "Telehealth Video
Appointments" → "Today's Telehealth Visits" → Start Visit (joins room, scribe panel present);
senior logs into WellFit → `/telehealth-appointments` → Join → same Daily room; confirm two-way A/V,
`telehealth_sessions` row active→completed, and a `scribe_sessions` row written with
`encounter_id` set (proves S3.1c billing/SOAP linkage). **[Visual acceptance — Maria, Commandment #13]**

---

## TARGET ARCHITECTURE (Model B — room pre-created at scheduling)

```
SCHEDULING (provider/staff books in TelehealthScheduler)
  └─ INSERT telehealth_appointments (patient_id, provider_id, tenant_id, appointment_time, encounter_type)
  └─ invoke create-telehealth-room { appointment_id }        ← NEW trigger point
        ├─ create Daily room (private, knocking on)
        ├─ INSERT telehealth_sessions (appointment link, room_url, room_name, provider_id, patient_id, tenant_id, status='scheduled')
        └─ UPDATE telehealth_appointments SET session_id, daily_room_url, daily_room_name   ← THE BRIDGE (fixes T-2)
        └─ IDEMPOTENT: if a session already exists for this appointment, return it (no duplicate rooms)

SENIOR JOINS (WellFit app)
  └─ TelehealthAppointmentsPage → <PatientWaitingRoom sessionId={appt.session_id} />   ← fixes T-1
        └─ invoke create-patient-telehealth-token { session_id }  (verifies patient_id=auth.uid())
        └─ daily.join(room_url?t=token)  → waits in lobby

CLINICIAN JOINS (Envision / PhysicianPanel)
  └─ "Start Telehealth" → joins the SAME session's room as owner, admits the knocking senior
        └─ (provider component keyed to the appointment's existing session, NOT creating a new room)
```

No new tables. Uses columns that already exist. `encounters` vs `fhir_encounters` standardized on **`fhir_encounters`** (what the app uses); `create-telehealth-room` stops requiring the legacy `encounters` row (fixes T-3).

---

## SESSION PLAN (ordered; each item live-verified + committed)

### Session 1 — Backend bridge + security (no UI-visible change yet)
- [ ] **S1.1** Refactor `create-telehealth-room` to accept `appointment_id`, authorize off `telehealth_appointments` (caller is the appointment's provider OR tenant admin), create room, INSERT `telehealth_sessions`, and **UPDATE the appointment with session_id/daily_room_url/daily_room_name**. Make it **idempotent**. Remove the `encounters` dependency (T-3). Keep the existing `encounter_id` path working for the provider ad-hoc flow if still needed.
- [ ] **S1.2** Migration: add **patient-scoped SELECT RLS** — `telehealth_appointments` and `telehealth_sessions` readable when `patient_id = auth.uid()` (in addition to provider/admin). Keep writes provider/admin/service-only. **[Tier-3 — Maria sign-off]** **[Akima: confirm patient-visibility scope is clinically correct]**
- [ ] **S1.3** Live-prove: seed a synthetic appointment → invoke → session row created, appointment back-linked, second invoke returns same room (idempotent), patient RLS lets patient read own / denies other.

### Session 2 — Wire the senior's WellFit join
- [ ] **S2.1** `TelehealthAppointmentsPage`: render **`PatientWaitingRoom`** (pass `session_id`) instead of `TelehealthConsultation`; guard "Join" until `session_id` is present ("Your doctor hasn't started the room yet" if null). Fix T-5 swallowed catches → surface a real error.
- [ ] **S2.2** Fix `PatientWaitingRoom` provider-name fetch (T-6).
- [ ] **S2.3** Route `PatientWaitingRoom` if a standalone route is needed. **[Tier-3 route change — Maria sign-off]**
- [ ] **S2.4** Trigger room pre-creation from the scheduler (S1.1 invoke) so `daily_room_url` is set at booking.
- [ ] **S2.5** Live/visual: senior joins from WellFit, lands in lobby. **[Visual acceptance — Maria]**

### Session 3 — Clinician side + full round-trip
- [ ] **S3.1** Provider "Start Telehealth" joins the **appointment's existing session room** (not a fresh one); admits the knocking senior.
- [ ] **S3.2** Full end-to-end live test: senior (WellFit) + clinician (Envision) in the SAME Daily room, two-way A/V, session status transitions, PHI access logged, recording per policy.
- [ ] **S3.3** Update tests (deletion-test quality, synthetic data). Full verify checkpoint. **[Visual acceptance — Maria]**

## Acceptance criteria (DONE MEANS DONE)
- A senior with a scheduled appointment opens WellFit, taps Join, and lands in the **same Daily room** the clinician joins from Envision — two-way audio/video.
- `telehealth_appointments.session_id`/`daily_room_url` populated at scheduling; `telehealth_sessions` row exists and transitions scheduled→active→completed.
- Patient RLS: a senior can read ONLY their own appointment/session (cross-patient read denied — live-proven).
- No swallowed errors: a failure shows the senior a real message, not "no appointments."
- Config prerequisites checklist all green in the pilot environment.
