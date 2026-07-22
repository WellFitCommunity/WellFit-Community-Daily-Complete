# EMS → Hospital & Hospital → Hospital Transfer — Repair Tracker

> **Created:** 2026-07-22 · **Status:** IN EXECUTION — Sessions 1–3 core DONE 2026-07-22 (see Execution Log at bottom); remaining: D4 nav links + visual acceptance, browser E2E walk, P-items (post-acute)
> **Scope (updated 2026-07-22, Maria: "I need all of this working"):** Make THREE transfer flows work end-to-end for a real user: EMS prehospital → ER (Subsystem A), hospital ↔ hospital handoff packets (Subsystem B), and post-acute/discharge-initiated transfers (Subsystem D — P-items). Subsystem C (Transfer Center) stays dormant per D5 (duplicate mechanism; tables untouched).
> **Estimate:** ~4 sessions (16–48h class per `implementation-discipline.md`).

---

## ⛔ EXECUTING-SESSION PROTOCOL — read before ANY work

1. Read `CLAUDE.md` in full, then `.claude/rules/supabase.md` (§2a GRANTs, §17 PHI keys), `.claude/rules/adversarial-audit-lessons.md`, `.claude/rules/typescript.md`. Sub-agents get the same rules in their prompts — no exceptions.
2. **Commandment #18:** every schema claim in this tracker was verified 2026-07-22 against `scripts/db-objects-snapshot.json` (regenerated from live 2026-07-14), the live `encounters` schema via mcp-postgres `get_table_schema`, and `src/types/database.generated.ts` (regenerated from live 2026-07-14). **Re-verify anything you write against before writing** — run the Phase-0 preflight below.
3. **MCP allowlist check:** run `mcp__claude_ai_Supabase__list_projects`. On 2026-07-22 the WellFit project `xkybsjnvuohpqpbkikyn` was **NOT in the allowlist** (only an unrelated project). If still missing: tell Maria to re-add it; fall back to `npx supabase db push` for migrations and `mcp__postgres__get_table_schema` (allowlisted tables only) for reads.
4. **Commandment #21 (DONE MEANS DONE):** an item is done only when the scoped workflow runs live end-to-end — form persists, route reachable from a real nav link, `tenant_id` populated, audit log fires, evidence reported (DB row / screenshot / curl).
5. Any migration you push: refresh `scripts/db-objects-snapshot.json` **in the same commit** (session-9 lesson) or the next push goes CI-red.
6. Verification gate per item: `bash scripts/typecheck-changed.sh && npm run lint` + **scoped** tests only (never full `npm test` — Maria's standing rule). Report counts.

### Phase-0 preflight (run at the start of EVERY session on this tracker)

Via Supabase MCP `execute_sql` on `xkybsjnvuohpqpbkikyn` (or ask Maria to run in SQL editor if MCP still blocked):

```sql
-- 1. GRANT posture on EMS tables (§2a — RLS ≠ GRANT)
SELECT t, has_table_privilege('authenticated','public.'||t,'SELECT') sel,
       has_table_privilege('authenticated','public.'||t,'INSERT') ins,
       has_table_privilege('authenticated','public.'||t,'UPDATE') upd
FROM unnest(ARRAY['prehospital_handoffs','ems_department_dispatches','ems_provider_signoffs','handoff_packets','handoff_attachments','handoff_logs']) t;

-- 2. Does acknowledge_department_dispatch still read profiles.full_name (a column that does NOT exist live)?
SELECT prosrc LIKE '%full_name%' AS reads_dead_column
FROM pg_proc WHERE proname='acknowledge_department_dispatch';

-- 3. Storage bucket (its CREATE lives only in _ARCHIVE_SKIPPED)
SELECT id, public FROM storage.buckets WHERE id='handoff-attachments';

-- 4. profiles.role live values (needed for H-2 patient match filter)
SELECT DISTINCT role FROM profiles WHERE role IS NOT NULL LIMIT 20;

-- 5. encounter_billing_suggestions columns (needed for D2/H-2 step 4)
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name='encounter_billing_suggestions' ORDER BY ordinal_position;

-- 6. Post-acute sources (needed for P-1): live columns of the REAL tables
--    (patient_medications / patient_allergies / functional_assessments DO NOT exist)
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_name IN ('allergy_intolerances','discharge_plans','risk_assessments')
ORDER BY table_name, ordinal_position;
-- risk_assessments is the live ADL/mobility/cognitive source (the readmission
-- feature-extractor already reads it) — reads go through risk_assessments_decrypted (§17).
```

Record results in this file before proceeding.

---

## VERIFIED LIVE STATE (evidence, 2026-07-22)

### Objects that EXIST live
| Object | Kind | Evidence |
|---|---|---|
| `prehospital_handoffs` (49 cols), `ems_department_dispatches` (23), `ems_provider_signoffs` (17) | tables | snapshot + generated types |
| RPCs `get_incoming_patients`, `get_coordinated_response_status`, `acknowledge_department_dispatch`, `mark_department_ready`, `auto_dispatch_departments`, `calculate_door_to_treatment_time`, `get_handoff_packet_by_token`, `acknowledge_handoff_packet` | functions | snapshot |
| `handoff_packets` — integration cols `patient_id, encounter_id, integrated_at, is_post_acute_transfer, post_acute_facility_type, discharge_encounter_id` ALL present | table | generated types |
| `fhir_observations` (77-col FHIR R4 shape — **the correct vitals target**) | table | generated types |
| `encounter_billing_suggestions`, `transfer_requests`, `facility_capacity`, `hospital_departments`, `encounter_diagnoses`, `medications`, `allergy_intolerances` | tables | snapshot |
| Trigger `trg_auto_dispatch_departments` AFTER INSERT/UPDATE OF alert flags ON `prehospital_handoffs` | trigger | archived migration `_SKIP_20251026000001` (function confirmed live in snapshot; re-verify trigger via `pg_trigger` in Phase-0 if touching) |

### Objects that DO NOT exist live (code references them anyway)
| Missing object | Referenced by |
|---|---|
| `billing_codes` table | `hospitalTransferIntegrationService.ts:423` |
| `send-department-alert` edge function | `emsNotificationService.ts:224` |
| `patient_medications`, `patient_allergies`, `functional_assessments` tables | `postAcuteTransferService.ts:223/239/316` |
| `fhir_patients` table | (context: `ehr_observations.fhir_patient_id` points at nothing) |
| Routes `/handoff/send`, `/handoff/view/:id`, `/handoff/receive/:token` | `HospitalTransferPortal.tsx:205,586`; `HandoffService.generateAccessUrl` |

### Live column truth for every table the rewrites touch

**`encounters` (live schema pulled 2026-07-22 via mcp-postgres — this is the COMPLETE column set):**
`id, patient_id (NOT NULL), provider_id, encounter_type, date_of_service (date, NOT NULL, no default), place_of_service (default '11'), status (default 'draft'), chief_complaint, clinical_notes, claim_frequency_code, subscriber_relation_code, created_by (default auth.uid()), created_at, updated_at, visit_mode, telehealth_session_id, tenant_id (NOT NULL, no default), facility_id, status_changed_at, status_changed_by, appointment_id, arrived_at, triaged_at, visit_started_at, visit_ended_at, signed_at, signed_by, coverage_verified_at, coverage_status, coverage_details`
→ There is **NO** `start_time`, `started_at`, `location`, `notes`, `urgency`, `metadata`, `admission_date`, `discharge_date`. Live statuses used by repaired code elsewhere: `arrived`, `triaged`, `in_progress`, `completed` (see session-4 EncounterService repair).

**`profiles` (relevant cols):** `user_id (uuid NOT NULL — the PK/join key), id (uuid nullable — do NOT key on it), first_name, last_name, dob` (**NOT** `date_of_birth`), `gender, mrn, role (text), role_code (NUMBER — never compare to a string), tenant_id (NOT NULL), created_by, email, phone`. There is **NO** `full_name`, **NO** `facility_name`.

**`ehr_observations` (7 cols — DO NOT write per-column vitals here):** `id, fhir_observation_id, fhir_patient_id, observation_data (jsonb), observation_date, tenant_id, created_at`.

**`fhir_observations` vitals-relevant cols:** `patient_id, encounter_id, tenant_id, status, category, code, code_display, code_system, value_quantity_value, value_quantity_unit, effective_datetime, sync_source, note`.

**`ems_provider_signoffs`:** insert column set used by `emsNotificationService.createProviderSignoff` matches live exactly; `tenant_id` is **nullable and never set** (see E-5).

**`hospital_departments`:** `id, tenant_id, code, name, description, floor_number, phone_extension, is_active` — **no SMS/email/pager contact columns** (drives D1).

---

## ROOT-CAUSE SUMMARY (what's actually broken)

1. **Both chart-integration writers are 100% dead** (never once succeeded against prod):
   - `emsIntegrationService.integrateEMSHandoff` — calls `supabase.auth.admin.createUser()` **from the browser** (requires service_role → always fails); profiles insert uses `date_of_birth`; encounters insert uses 4 nonexistent columns + omits NOT-NULL `tenant_id`/`date_of_service`; vitals insert targets the wrong `ehr_observations` shape.
   - `hospitalTransferIntegrationService.integrateHospitalTransfer` — profiles filter `role_code='patient'` (numeric column vs string → errors), insert uses `full_name`/`date_of_birth` + omits NOT-NULL `user_id`/`tenant_id`; encounters same class; vitals same class; billing targets nonexistent `billing_codes` (silently swallowed). Only step 5 (packet linking) is live-correct.
2. **Hospital-transfer sender path is unreachable:** "New Transfer" → dead route `/handoff/send`; the real sender form `LiteSenderPortal` (+`LiteSenderFormSteps`, `LiteSenderConfirmation`, `useLiteSenderLogic`) has zero importers; the access URL emailed to receiving facilities (`/handoff/receive/:token`) 404s. This is why `handoff_packets` has 0 real rows ever.
3. **EMS department paging is a void:** `send-department-alert` edge fn doesn't exist; no department contact registry exists.
4. **`acknowledge_department_dispatch` RPC likely errors** when called without an explicit name (archived body reads `profiles.full_name`). Phase-0 query #2 confirms/denies.
5. **No nav links** to `/ems`, `/er-dashboard`, `/hospital-transfer` (direct-URL-only); `/ems/metrics` + `/ems/coordinated-response/:id` behind unset feature flags.
6. **EMS schema is migration-orphaned:** every CREATE for the EMS tables/RPCs/bucket lives only under `supabase/migrations/_ARCHIVE_SKIPPED/` — live objects exist but a fresh environment would not recreate them.
7. **Why it all shipped green:** every test mocks Supabase and none asserts column sets (same class as the readmission-writer incident; fixed there by `readmissionWriterShape.test.ts`).

What already WORKS (verified): EMS paramedic form → `prehospital_handoffs` insert → auto-dispatch trigger → incoming board + dispatch dashboard + provider sign-off insert (column sets match live); `handoffService` packet CRUD/attachments/logs (columns match live); PHI encrypt/decrypt on the clinical Vault key (§17, repaired + live-proven 2026-07-13); receiving routes `/handoff/receiving` and `/transfer-logs` are nav-linked.

---

## DECISION QUEUE (Maria / Akima)

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| **D1** | Department alert delivery | ~~(a)/(b)/(c)~~ | **RESOLVED 2026-07-22 (Maria: "Twilio is built and activated"): (a)** — `send-department-alert` edge fn BUILT + deployed, rides existing Twilio `send-sms` + `send-email`; `hospital_departments.alert_phone/alert_email` contact columns added (NULL until an admin sets them → dashboard-only until then); AFTER INSERT pg_net trigger on dispatches (ld-alert-notifier pattern). No PHI in page bodies | E-3 |
| **D2** | Billing write target | ~~(a)/(b)~~ | **RESOLVED 2026-07-22: (a)** — advisory rows in `encounter_billing_suggestions`; urgency-based E/M only (99221/99222/99223, +99291 if critical); unconditional G0390 REMOVED. ⚑ Akima ratifies code choices | H-2 |
| **D3** | Patient-creation policy | ~~(a)/(b)~~ | **RESOLVED 2026-07-22: (a)** — service-role edge fn `register-transfer-patient` (JWT + clinical-role + tenant gated), match-first by MRN, temp-record metadata for MPI merge. ⚑ Akima ratifies temp-record policy | E-2, H-2 |
| **D4** | Nav placement for `/ems`, `/er-dashboard`, `/hospital-transfer` (+ optional `/ems/metrics`) | which menus/dashboards get the links | Propose: ER board + EMS form under clinical/admin workflow nav; hospital-transfer next to the existing `/transfer-logs` links (BedManagementPanel, ClinicalWorkflowWizard). **Visual acceptance #13 required** | E-1, H-3 |
| **D5** | Two overlapping hospital↔hospital mechanisms: handoff packets (B) vs Transfer Center `transfer_requests` (C, live tables + 5 RPCs, no UI) | (a) B is go-forward, C stays dormant; (b) converge later | **(a) — engineering call made 2026-07-22:** building C's UI would create a SECOND competing way to do the same job B does. C's tables/RPCs stay untouched (Tables-are-FEATURES). Maria may overrule if Transfer Center (request/approve/deny between facilities) is a distinct product need | none |
| **D6** | `postAcuteTransferService` (orphaned; reads 3 nonexistent tables + dead profiles cols) | ~~(a) repair / (b) defer~~ | **RESOLVED 2026-07-22 (Maria): (a) REPAIR — "I need all of this working."** Work items P-1…P-3 added; session plan extended to 4 | P-items |
| **D7** | Tokenized external receiver page | ~~(a)/(b)~~ | **RESOLVED 2026-07-22: (b) for now** — no unauthenticated PHI surface; notifications direct receiving staff to log in at `/handoff/receiving`. Token infra retained for a future Akima-approved external portal | H-1c |
| **D8** | Re-canonicalize EMS schema: new idempotent migration (`CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE`) copying the live shapes out of `_ARCHIVE_SKIPPED` so fresh environments work | yes / no | **Yes** (S-1) — zero risk to prod (objects exist; IF NOT EXISTS no-ops), removes the fresh-env landmine | S-1 |

---

## WORK ITEMS

### E-1 — EMS reachability
**Files:** `src/routes/routeConfig.ts`, `src/config/featureFlags.ts`, nav component(s) per D4.
- Verify flag `coordinatedResponse` exists in `src/config/featureFlags.ts`; if absent, the `/ems/coordinated-response/:handoffId` route is permanently filtered out by `RouteRenderer` — add the flag (default from `VITE_FEATURE_COORDINATED_RESPONSE`).
- Add nav links per D4. Route entries already exist for `/ems` (routeConfig:107, auth `user` — **review: should be clinical roles**, propose aligning to the `/er-dashboard` role set) and `/er-dashboard` (:463).
- **Accept:** each route reachable by clicking a real link as an authorized role; screenshot for Maria (#13).

### E-2 — Rewrite `emsIntegrationService.ts` against live schema *(blocked by D3)*
**File:** `src/services/emsIntegrationService.ts` (+ new edge fn per D3a).
- **Patient step:** replace browser `admin.createUser` with either edge-fn call (D3a) or match-only + MPI queue (D3b). Drop the `first_name = 'EMS-<unit>-<date>'` matching hack. Any profile insert (edge-fn side): `user_id, first_name, last_name, dob` (NOT `date_of_birth`), `gender, role, tenant_id` — tenant resolved from the CALLER's profile (`profiles.select('tenant_id').eq('user_id', caller.id)`), never hardcoded.
- **Encounter step:** insert exactly `{ patient_id, provider_id, encounter_type: 'emergency', status: 'arrived', chief_complaint, date_of_service: <today>, tenant_id, arrived_at: <now ISO>, clinical_notes: <EMS narrative text> }`. EMS context (unit, agency, paramedic, scene, alerts) does NOT go in a `metadata` column (none exists) — it already lives on `prehospital_handoffs`, which gets `encounter_id` linked in the final step; put a human-readable summary in `clinical_notes`.
- **Vitals step:** write `fhir_observations` rows (NOT `ehr_observations`): `{ patient_id, encounter_id, tenant_id, status: 'final', category: 'vital-signs', code: <LOINC>, code_system: 'http://loinc.org', code_display, value_quantity_value, value_quantity_unit, effective_datetime, sync_source: 'ems_handoff' }`. Map from `prehospital_handoffs.vitals` jsonb. LOINC set: 8480-6/8462-4 BP, 8867-4 HR, 8310-5 temp, 2708-6 SpO2, 9279-1 RR (already in code — keep).
- **Link step** (`prehospital_handoffs` update `patient_id, encounter_id, integrated_at`) is live-correct — keep.
- Error handling: every insert error checked + surfaced (no silent swallow); `auditLogger` per existing pattern; `ServiceResult` returns.
- **Pre-push:** if adding new files with `http://loinc.org` URIs, check `.github/workflows/security-scan.yml` exclusion list (implementation-discipline rule).
- **Accept:** live round-trip — insert a synthetic prehospital handoff (obviously fake: `unit_number 'TEST-555'`), run integrate as an authorized user, verify encounter + fhir_observations rows + linkage in DB, then clean up test rows (encounters/fhir_observations are deletable; NEVER probe-insert `audit_logs`).

### E-3 — Department alert channel *(blocked by D1)*
Per D1(c): remove/park `sendDepartmentNotification`'s dead invoke (verify zero callers first: `grep -rn "sendDepartmentNotification" src/`). If D1(a) chosen instead: new `supabase/functions/send-department-alert/index.ts` with the FULL edge-fn auth checklist (JWT `getUser`, clinical-role gate via `profiles.role_id`/`user_roles` keyed on **`user_id`**, tenant scope, `_shared/rateLimiter.ts`, input validation, `_shared/cors.ts`), contact columns migration on `hospital_departments`, deploy via `/deploy-edge`. **No PHI in page/SMS bodies** (ETA + complaint category only). Note: `generateAlertMessage` emoji prefixes are Commandment #22 adjacent (clinical channel, not JSX) — Maria call, default strip.

### E-4 — `acknowledge_department_dispatch` RPC repair *(conditional on Phase-0 #2)*
If `reads_dead_column = true`: migration `2026MMDDHHMMSS_fix_ack_dispatch_full_name.sql` — `CREATE OR REPLACE` the function with the archived body (`_SKIP_20251026000001` lines 326–363) except `full_name` → `TRIM(CONCAT(first_name,' ',last_name))`, keep `SECURITY DEFINER SET search_path = public`. Push + snapshot refresh same commit. **Accept:** RPC call with only `p_dispatch_id` succeeds against a test dispatch row.

### E-5 — §2a GRANT + tenant audit on EMS tables *(driven by Phase-0 #1)*
- Any `false` in Phase-0 #1 → migration adding the missing `GRANT <verbs> ON public.<t> TO authenticated` (grep sibling tables from the same era per §2a).
- `ems_provider_signoffs.tenant_id` + `ems_department_dispatches.tenant_id` are nullable and never set by writers: preferred fix = DB derive-trigger from the handoff row's tenant (mirrors the fhir-sync restore pattern, migration `20260713100000`), so client code stays unchanged.
- **Accept:** `has_table_privilege` true for intended verbs; new signoff row carries tenant_id.

### E-6 — Shape tests
New `src/services/__tests__/emsWriterShape.test.ts` mirroring `src/services/ai/readmission-predictor/__tests__/readmissionWriterShape.test.ts`: pin the exact insert-payload key sets of E-2's encounter + vitals + profile writers to the live column lists in this tracker; assert fail-loud on insert error. Deletion-test compliant.

### H-1 — Sender path wiring
**a) `/handoff/send`:** new `src/pages/HandoffSendPage.tsx` mounting `LiteSenderPortal` (`src/components/handoff/LiteSenderPortal.tsx`; props `{ facilityName?, onPacketCreated? }`) — `facilityName` from the caller's tenant/profile, `onPacketCreated` → success toast + `navigate('/hospital-transfer')`. Route entry (match existing style, routeConfig ~line 809):
```ts
{ path: '/handoff/send', component: 'HandoffSendPage', auth: 'admin',
  roles: ['admin','super_admin','nurse','physician','case_manager'], category: 'workflow' },
```
plus `lazyComponents.tsx` export + registry entry.
**b) `/handoff/view/:id`:** new `src/pages/HandoffPacketViewPage.tsx` — `HandoffService.getPacket` + `getAttachments` + `getLogs`, decrypt name/DOB via `HandoffService.decryptPHI` (clinical key path — do NOT call the RPC directly), PHI access logged (`auditLogger.phi`), same auth/roles. Uses EA components — read `docs/AI_COMPONENT_REFERENCE.md` first; **no decorative emojis** (System B).
**c) `/handoff/receive/:token`:** PARKED on D7. Interim (same session as H-1a): `handoffNotificationService.notifyPacketSent` must stop embedding the dead URL — replace with "log in to <origin>/handoff/receiving" wording.
**Accept:** click-through New Transfer → form → packet created → visible in portal + `/transfer-logs`; View Full Packet opens; 601+ line check (`wc -l`) on new pages; tests for both pages (behavioral, Deletion Test).

### H-2 — Rewrite `hospitalTransferIntegrationService.ts` *(blocked by D2, D3)*
**File:** `src/services/hospitalTransferIntegrationService.ts`.
- **Step 1 (match/create):** match by `profiles.select('user_id').eq('mrn', packet.patient_mrn)` — drop the `role_code='patient'` string filter (numeric column); if a role filter is wanted use `role` (text) with a live-verified value from Phase-0 #4. Return `user_id` as patientId (NOT `id`). No-match → D3 path (edge fn or MPI queue). Keep decrypt via `use_clinical_key: true` (live-correct since 2026-07-13).
- **Step 2 (encounter):** same live shape as E-2, with `encounter_type` = `'emergency'` for critical/emergent else `'inpatient'`, `status: 'arrived'`, `chief_complaint: 'Transfer from <sending_facility>: <reason_for_transfer>'`, `clinical_notes: packet.sender_notes`, `date_of_service`, `tenant_id` (caller-resolved), `arrived_at`.
- **Step 3 (vitals):** `fhir_observations` per E-2 spec, `sync_source: 'hospital_transfer'`, mapping from `packet.clinical_data.vitals` (existing LOINC mapping is right — only the target table/columns change).
- **Step 4 (billing):** per D2 — if (a): insert into `encounter_billing_suggestions` with Phase-0-verified columns, suggestions only (99221/99222/99223 by urgency; 99291 only if critical; G0390 REMOVED unless trauma criteria met — Akima ratifies); if (b): delete step.
- **Step 5:** unchanged (live-correct).
- All errors checked + thrown/surfaced — `ReceivingDashboard` already branches on `integrationResult.success` (ReceivingDashboard.tsx:123); today it can only ever hit the warning toast.
- **Accept:** live round-trip with a synthetic packet (Test Patient Alpha, DOB 2000-01-01, MRN `TEST-MRN-0001` — synthetic-only rule #15): acknowledge → integrate → encounter + vitals + suggestion rows + packet linked; clean up test rows.

### H-3 — Portal nav + entry points
`HospitalTransferPortal.tsx:205` now targets the real `/handoff/send`; `:586` targets real `/handoff/view/:id`. Add nav link(s) to `/hospital-transfer` per D4. **Accept:** zero dead `navigate()` targets (grep `navigate('/handoff` → all resolve to defined routes); visual acceptance (#13).

### H-4 — Shape + reachability tests
`src/services/__tests__/hospitalTransferWriterShape.test.ts` (same pattern as E-6) + update `hospitalTransferIntegrationService.test.ts` + `HospitalTransferPortal.test.tsx` for the new nav targets. Route-reachability assertion: every `navigate()` literal in the two portals exists in `routeConfig`.

### H-5 — Storage bucket *(conditional on Phase-0 #3)*
If `handoff-attachments` missing: migration recreating bucket + policies from `_SKIP_20251003190001` (adapted to current storage-policy syntax). **Accept:** upload + signed-URL fetch of a test attachment round-trips.

### P-1 — Rewrite `postAcuteTransferService.ts` against live schema
**File:** `src/services/postAcuteTransferService.ts`. Every read below is currently dead or drifted; Phase-0 #6 supplies the authoritative column lists before coding.
- **Profiles read (line ~61):** `full_name, date_of_birth, facility_name` → `first_name, last_name, dob, mrn, gender, phone` (compose name in code; there is no `facility_name` — the sending facility comes from the caller's tenant/facility context, not the patient row). Key on `user_id`.
- **Encounters read (line ~75):** `admission_date, discharge_date` do not exist → use `date_of_service, arrived_at, visit_ended_at, status` (live set in this tracker's schema section).
- **Medications:** `patient_medications` → **`medications`** (live), keyed `user_id`; columns `medication_name, dosage` (NOT `dose`), `frequency, route, instructions, status` — filter `status = 'active'` (verify live status vocabulary in Phase-0).
- **Allergies:** `patient_allergies` → **`allergy_intolerances`** (live; columns from Phase-0 #6).
- **Vitals:** `ehr_observations` per-column read → **`fhir_observations`** (`code, code_display, value_quantity_value, value_quantity_unit, effective_datetime`, latest per LOINC code).
- **Functional status:** `functional_assessments` → **`risk_assessments`** via `risk_assessments_decrypted` (§17 clinical key; ADL/mobility/cognitive fields per Phase-0 #6). If a patient has no assessment, the packet section says "no assessment on file" — never fabricate values (fabricated-compliance-value class).
- **Diagnoses:** `encounter_diagnoses` exists live — verify its columns match the read (`diagnosis_code, diagnosis_description, diagnosis_type`) in Phase-0.
- `discharge_plans` read/update (incl. `post_acute_handoff_packet_id`) — verify column set in Phase-0 #6 before trusting.
- Packet creation continues through `HandoffService.createPacket`/`sendPacket` (live-correct, clinical-key encryption) with `is_post_acute_transfer: true`, `post_acute_facility_type`, `discharge_encounter_id` (all live columns).
- **Accept:** unit tests + a live composition run for a synthetic patient producing a draft packet whose clinical_data sections match the chart rows; shape test pins all read/write column sets (P-3).

### P-2 — Wire post-acute/hospital transfer into the discharge flow
**Files:** `src/components/admin/bed-board/useDischargeFlow.ts` (the LIVE discharge path — session 8 wired `dischargeTrigger` here), `src/components/discharge/DischargeDispositionSelector.tsx` (disposition vocabulary source: `snf, irf, ltach, hospice, hospital_transfer`), `src/components/admin/BedManagementPanel.tsx`.
- On discharge with a facility-transfer disposition (SNF/IRF/LTACH/hospice/`hospital_transfer` — the same labels `dischargeTrigger.ts:47` already branches on), call `postAcuteTransferService.createPostAcuteTransfer` to compose a **DRAFT** packet from the chart, then navigate the clinician to `/handoff/view/<id>` (H-1b page) to complete receiving-facility contact details and SEND. Auto-compose, human completes + sends — a packet must never leave without receiving-facility contact info and a human click.
- Packet creation failure must NOT block the discharge (mirror the dischargeTrigger fire-and-forget contract) — but unlike prediction, surface a visible error toast telling the clinician to create the transfer manually at `/handoff/send`.
- Watch the 600-line limit on `BedManagementPanel.tsx` (currently ~583 — decompose if the wiring pushes it over).
- **Accept:** live walk — discharge a synthetic patient with disposition "Hospital Transfer" → draft packet exists, pre-filled with meds/allergies/vitals/diagnoses, clinician completes + sends, receiving side sees it. **Maria visual acceptance (#13)** on the discharge-to-packet flow.

### P-3 — Post-acute shape tests
`src/services/__tests__/postAcuteWriterShape.test.ts` — pin every `.from()` read/write column set in P-1 to the live lists; discharge-flow test asserting a transfer disposition triggers draft-packet creation and a non-transfer disposition doesn't (Deletion Test compliant).

### S-1 — Re-canonicalize EMS schema *(per D8)*
One idempotent migration reproducing live shapes (source: `_ARCHIVE_SKIPPED/_SKIP_20251024000004`, `_SKIP_20251026000001`, `_SKIP_20251027000001/2` — but columns MUST be taken from live `information_schema`, not trusted from the archived files): `CREATE TABLE IF NOT EXISTS` × 3 tables (+ `ems_dispatch_protocols` if live — it is NOT in the snapshot; verify, likely skip), `CREATE OR REPLACE` RPCs, trigger, RLS + GRANTs. Prod no-ops; fresh envs become buildable. Snapshot refresh same commit.

### S-2 — Regression greps (run at the end of EVERY session)
```bash
grep -rn "date_of_birth" src/services/emsIntegrationService.ts src/services/hospitalTransferIntegrationService.ts src/services/postAcuteTransferService.ts   # expect 0
grep -rn "\.from('billing_codes')\|from(\"billing_codes\")" src/                                    # expect 0
grep -rn "auth\.admin\.createUser" src/ --include="*.ts" --include="*.tsx"                          # expect 0 (browser code)
grep -rn "navigate('/handoff" src/ | grep -v "/handoff/receiving\|/handoff/send\|/handoff/view"     # expect 0
grep -rn "send-department-alert" src/                                                               # expect 0 (D1c) or edge fn exists (D1a)
grep -rn "\.eq('role_code', *'" src/                                                                # expect 0 (numeric column)
```

---

## SESSION PLAN

**Session 1 — DB posture + sender wiring** (no product blockers except D4 nav placement): Phase-0 preflight → E-4, E-5, H-5 (conditional migrations) → H-1a/b + H-3 + interim H-1c wording fix → H-4 route-reachability test → visual acceptance list for Maria.
**Session 2 — hospital-transfer writer** (needs D2, D3): H-2 rewrite + H-4 shape tests → live round-trip proof → E-1 nav links (if D4 decided).
**Session 3 — EMS writer** (needs D3; D1 if (a)): E-2 (+ edge fn) + E-6 → E-3 → S-1.
**Session 4 — post-acute + closeout:** P-1 → P-2 → P-3 → S-2 sweep → full E2E walk of all three flows with evidence → PROJECT_STATE update.

**Definition of done for the tracker:** a clinician can (1) click to `/ems`, submit a paramedic handoff, see it on the ER board, acknowledge, mark arrived, transfer-to-ER, and find the patient's encounter + vitals in the chart; (2) click New Transfer, send a packet, and the receiving side can acknowledge + integrate it into a chart; (3) discharge a patient with a facility-transfer disposition and get an auto-composed draft packet they complete and send — all live, all tenant-stamped, all audit-logged, with Maria's visual acceptance on every new/changed screen.


---

## EXECUTION LOG — 2026-07-22 (same-day session, Maria: "use your professional judgement to do D1–D3 and D7, please repair")

**Decisions:** D1=(a) Twilio paging (Maria overrode mid-session: "Twilio is built and activated"); D2=(a) advisory `encounter_billing_suggestions`; D3=(a) `register-transfer-patient` edge fn (⚑ Akima ratifies temp-record policy); D7=(b) no unauthenticated token page (notifications now say "log in at /handoff/receiving"; token infra retained).

**NEW LIVE FINDING (probe-only class):** the live `auto_dispatch_departments()` still referenced `ems_dispatch_protocols` (a table that did NOT exist live) + old-shape `hospital_departments` columns → **every alert-flagged EMS handoff INSERT errored in production**. Found by a rolled-back synthetic insert probe; invisible to static analysis because the drift was inside a live pg function vs a missing table.

**DONE (all live-verified):**
- **Migration `20260722120000`** (pushed + verified): tenant-derive BEFORE INSERT triggers on `prehospital_handoffs` (from caller) + `ems_department_dispatches`/`ems_provider_signoffs` (from parent handoff, SECURITY DEFINER); GRANT INSERT/UPDATE `encounter_billing_suggestions` + SELECT `allergy_intolerances` (§2a); `hospital_departments.alert_phone/alert_email`; `trg_notify_department_dispatch` AFTER INSERT → pg_net → `send-department-alert` (Vault sb_secret_key bearer); `handoff-attachments` storage bucket (private, 50MB, pdf/jpeg/png) + 3 storage policies.
- **Migration `20260722130000`** (pushed + verified): recreated `ems_dispatch_protocols` (FK → live `hospital_departments.code`, RLS read policy + GRANT, UNIQUE(alert_type,department_code)); seeded 9 standard departments for WF-0001 (table was EMPTY live) + 25 archived alert protocols; **rewrote `auto_dispatch_departments()`** against live shapes (hd.code/hd.name, tenant-scoped join, stamps tenant_id) with an EXCEPTION guard so dispatch failure can never again reject the paramedic's handoff insert.
- **Edge fns deployed (ACTIVE, unauthed probes 401):** `send-department-alert` (server-caller gate = CRON_SECRET/SB_SECRET_KEY; SMS via send-sms `{phone,message}`, email via send-email `{to,subject,html}`; no PHI, no emojis; audit_logs canonical insert; verify_jwt=false pinned) and `register-transfer-patient` (JWT getUser + clinical-role gate + caller-tenant stamp; MRN match-first; createUser then UPDATE the handle_new_user-created profile with dob/role='patient'/role_code=1; audit logged; verify_jwt=true).
- **`hospitalTransferIntegrationService` rewritten (H-2):** MRN match on `profiles.user_id` (dropped numeric-role-vs-string filter) → edge-fn registration; encounters live shape (tenant_id + date_of_service + arrived_at + clinical_notes, status 'arrived'); vitals → `fhir_observations` (LOINC, `sync_source:'hospital_transfer'`); billing → advisory suggestions row (G0390 REMOVED, ⚑ Akima ratify codes); step-5 link unchanged; all errors checked + audit-logged.
- **`emsIntegrationService` rewritten (E-2):** browser `auth.admin.createUser` ELIMINATED → edge fn (source 'ems', estimated DOB from age, `EMS-<unit>`/Unidentified naming); encounters live shape with EMS narrative in clinical_notes; vitals → `fhir_observations` (`sync_source:'ems_handoff'`); advisory billing suggestions; `getHandoffIntegrationStatus` repointed to fhir_observations.
- **Sender path wired (H-1a/b, H-3):** routes `/handoff/send` (new `HandoffSendPage` mounting `LiteSenderPortal`) + `/handoff/view/:id` (new `HandoffPacketViewPage`: decrypted identity via clinical key, transfer details, vitals, attachments, audit trail, PHI-access logged) in routeConfig + lazyComponents. HospitalTransferPortal's dead navigate targets now resolve. `handoffNotificationService` stopped embedding the dead token URL (D7b) + emoji strip on clinical messages (also `emsNotificationService.generateAlertMessage`).
- **Tests:** new `transferWriterShape.test.ts` (11 — pins encounters/fhir_observations/encounter_billing_suggestions/link payload column sets to the live schema, fail-loud, no-G0390); `hospitalTransferIntegrationService.test.ts` + `emsIntegrationService.test.ts` rewritten behavioral (auth/tenant gates, MRN match, decrypt fail, severity codes, status reads); page tests for both new pages. 64/64 green.
- **Live proofs (rolled back, 0 residue):** (1) postgres probe: trauma handoff insert → tenant derived + **5 trauma dispatches created, all tenant-stamped** (was: hard ERROR); (2) `SET ROLE authenticated` probe: handoff + provider sign-off inserts **pass RLS** with tenants derived and dispatches visible to the tenant user (sign-offs were 100% RLS-rejected before).
- **Gates:** scoped tsc 0/8 changed (3 pre-existing project-wide), lint 0 errors 0 warnings, 64 tests, drift gate green (snapshot refreshed same commit: 787 tables / 1492 fns).

**REMAINING (not silently done):**
1. **D4 nav links** for `/ems`, `/er-dashboard`, `/hospital-transfer` — needs Maria's placement call + **⚑ visual acceptance (#13)** on HandoffSendPage, HandoffPacketViewPage, and the wired portal flow.
2. **Browser E2E walk** of both flows (paramedic form → board → acknowledge → integrate; New Transfer → send → receive → integrate) — write-shapes and DB chain are live-proven; the clinician-click path needs a browser session.
3. **P-1..P-3 post-acute** (Session 4 per plan) — untouched.
4. **D8 re-canonicalization** of the remaining `_ARCHIVE_SKIPPED` EMS schema (prehospital_handoffs/dispatches/signoffs CREATEs) — protocols table now has an active migration; the other three still only exist via archive.
5. **⚑ Akima ratifications:** D2 billing code choices, D3 temp-record policy, `coordinatedResponse`/`emsMetrics` feature-flag defaults (E-1 unfinished — flags still gate `/ems/metrics` + `/ems/coordinated-response`).
6. Department paging contacts: `alert_phone`/`alert_email` are NULL for all 9 seeded departments — an admin must populate them before real SMS paging fires (dashboard notification works regardless).


---

## EXECUTION LOG 2 — 2026-07-22 (Maria: nav placement mine, round trip, solidify D8)

**Nav wiring (D4 — my placement, ⚑ visual acceptance #13 pending):**
- ClinicalWorkflowWizard: new "Patient Transfers" workflow (Send New Transfer → /handoff/send, Track → /hospital-transfer, Receive & Integrate → /handoff/receiving, ER Incoming → /er-dashboard). Icon intentionally blank (#22; the wizard's OTHER four workflows still carry pre-existing emoji icons — cleanup candidate).
- Bed board header: new "Hospital Transfer" EAButton (→ /hospital-transfer) beside Transfer Logs.
- ER Command Center: "Paramedic Handoff Form" link (→ /ems) in the stats strip; replaced the decorative ambulance emoji with the lucide icon (#22); **fixed pre-existing dead stats** — the strip queried `ems_handoffs` (table never existed live; stats always 0, swallowed) → repointed to `prehospital_handoffs` live columns/statuses.
- Voice phrases added for Hospital Transfer Portal + ER Command Center (workflowPreferences).
- Feature flags `emsMetrics`/`coordinatedResponse` verified present in featureFlags.ts (env-gated, default off) — deploy-env decision, not code.

**ROUND TRIP (item 3) — full hospital-transfer lifecycle proven as the `authenticated` role, rolled back, 0 residue:** encrypt (clinical key) → create packet (number/token generated, **tenant derived**) → send → handoff_logs audit row → `acknowledge_handoff_packet` RPC → decrypt round-trip → encounter (live shape) → 2 LOINC vitals into fhir_observations → advisory billing-suggestion row → packet linked. Two MORE live defects found by the probe and fixed:
- **Migration `20260722150000`:** handoff_packets INSERT was RLS-rejected for every clinician (tenant policy unsatisfiable: tenant_id nullable, no default, no writer sets it; only user_roles-admins passed). Tenant-derive triggers added for handoff_packets (from caller) + handoff_attachments/handoff_logs (from parent packet). Same class as the EMS tables.
- **Migration `20260722160000`:** encounters.encounter_type CHECK only allowed outpatient values → additive widen with 'emergency' + 'inpatient'.
- `fhir_observations.category` is **text[]** — both writers now send `['vital-signs']`.

**D8 solidified (item 4) — migration `20260722140000` (pushed, prod no-op, post-push probe green):** full re-canonicalization of prehospital_handoffs + ems_department_dispatches + ems_provider_signoffs from LIVE DDL (information_schema/pg_constraint/pg_indexes/pg_get_functiondef dumps — constraints inline in CREATE TABLE IF NOT EXISTS so existing DBs skip them), all 20 live indexes, live RLS policies, GRANTs, updated_at trigger, and the 5 EMS RPCs via CREATE OR REPLACE. A fresh environment can now rebuild the entire EMS schema from active migrations.

**Gates after Log 2:** scoped tsc 0, lint 0/0, 74/74 tests (transfer + bed-board), drift gate green (snapshot 787 tables / 1494 fns).

**STILL REMAINING:** ⚑ Maria visual acceptance on: HandoffSendPage, HandoffPacketViewPage, Patient Transfers wizard entry, bed-board Hospital Transfer button, ER stats strip + paramedic link. Browser click-walk (the only untested layer is the React UI event handling — every service payload + DB interaction + RPC + RLS path is live-proven). P-1..P-3 post-acute (Session 4). ⚑ Akima: D2/D3 + wizard emoji-icon cleanup. Department alert contacts (alert_phone/alert_email) still NULL.
