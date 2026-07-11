# Project State — Envision ATLUS I.H.I.S.

> **Read this file FIRST at the start of every session.**
> **Update this file LAST at the end of every session.**

**Last Updated:** 2026-07-11 (fifth session)

---
### 📨 HANDOFF FOR NEXT SESSION (read this first)

**Session 2026-07-11 (fifth) — CI repair + OPEN #3 (SOC2 dashboards) substantially fixed.**
*Earlier today, already on `main` before this session and now captured here for the record:* global-search repair + dashboard keyword jump + PHI audit (`32b0969d`); migration-engine PHI redaction for LLM+UI + forced structured output + `EnterpriseMigrationDashboard` god-file split 931→453 + tests (`8b1e703a`/`9ecb60f4`/`6fbd839b`); `risk_assessments` made writable+readable on the clinical Vault key + `risk_assessments_decrypted` view (`fe80ac33`) + Risk Assessment route reachable + clinical de-emoji (`e8023fea`).
- **CI red → green (`a7310d53`):** `Unit Tests (components)` failed 9/19 on `RiskAssessmentManager` — `fe80ac33` correctly repointed its list read to `risk_assessments_decrypted` but the test mock still keyed on `risk_assessments` → `0 Total Assessments`. Repointed the mock; 19/19, CI green.
- **OPEN #3 — SOC2/Security/Guardian console-error wall REPAIRED (`18377fe0`).** Live-verified all 7 triage root causes against `information_schema`/`pg_proc` (Commandment #18). **Code:** `getSecurityEvents` `ip_address` alias (security_events has `ip_address`, NOT `actor_ip_address` — the wrong column was erroring the query → empty security/incident dashboards); `DatabaseAdminPanel` `billing_claims`→`claims`/`patient_encounters`→`encounters`; `ActiveSessionManager` dropped the invalid `profiles()` embed (no FK) → separate profiles fetch keyed on user_id. **Views (migration `20260711200000`, `db push`, all live-proven — exist, `security_invoker=on`, GRANT true, resolve; `compliance_status`=6 rows):** restored 5 islanded aggregate views the dashboards read (`security_monitoring_dashboard`, `phi_access_audit`, `security_events_analysis`, `incident_response_queue`, `compliance_status`), adapted to CURRENT columns (`actor_ip_address`→`ip_address`; `data_retention_policies.enabled`→`is_active`) + hardened DEFINER→`security_invoker` (§3) + GRANT (§2a); snapshot updated, 5 entries removed from drift baseline. **Triage corrections (Commandment #18 wins — verified, NO fix needed):** (v) `create_guardian_review_ticket` — live RPC's 17 arg names/types/order EXACTLY match `guardianApprovalService.createTicket`; (iii) `audit_logs` read drift does NOT manifest in this scope (`getAuditLogs` selects only real cols). **DEFERRED / surfaced (NOT silently done):** `encryption_status_view` (live `encryption_keys` LOST `key_purpose`/`key_algorithm` → schema decision, no fabrication); **(vii) `mcp-postgres-server` 500** = GET on a JSON-RPC POST-only server (POST returns 200/202) → edge-fn method-handling fix + redeploy; **`BulkExportPanel` audit_logs INSERT uses `user_id`/`action` (nonexistent cols) → PHI-export audit writes FAIL** — needs an ad-hoc-audit-insert sister-grep sweep; `FHIRConflictResolution.resourceTableMap` is broader FHIR-write drift (whole map suspect); `phi_access_audit` surfaces `patient_name`/`actor_email` from audit metadata (COALESCE→'Unknown') — restored per existing admin-gated design, **flag for Akima §17 awareness**. Verify: scoped tsc 0/3, eslint 0, 104 tests (soc2 + guardian), drift gate green.

- **Audit-insert sweep — RESOLVED the #3 `BulkExportPanel` deferral, fleet-wide (`97a15dba`).** Maria said "do the bulkexport audit insert sweep" → a parser over every `.from('audit_logs').insert(...)` found the same drift in **28 sites / 20 files**, mostly **auth-critical edge fns** (login, TOTP, PIN, super-admin) whose audit trail was **silently failing** (writes 400'd on nonexistent cols, swallowed by fire-and-forget catch). Live-verified vs schema (#18): `user_id`→`actor_user_id` (no FK), `action`→`event_type`, `ip_address`→`actor_ip_address` (INET), `details`/`event_data`→`metadata`, drop `created_at`; frontend inserts also need `actor_user_id = auth.uid()` (RLS `WITH CHECK`) via `getSession`. Corrected shape live-proven to insert. Surgical rename script (top-level keys only, inside each flagged insert's byte range) + 3 manual specials. Also repaired, in the touched files: pre-existing `.insert().catch()` → `.then(undefined,fn)` (7 auth fns; PostgrestBuilder has no `.catch`) and `.select('*')` → explicit cols (`bed-management` ×3 incl. the `get_unit_capacity` reassignment trap that forced the 2026-07-09 revert — now if/else branched; `vital-threshold-monitor` ×1). **All 17 changed edge fns deployed `--use-api`** (verify_jwt=false pins preserved). ⚠️ **One synthetic probe row (`SWEEP_TEST_AUTH`, `{"probe":true}`, no PHI) is stuck in `audit_logs`** — the table is immutable (HIPAA DELETE trigger); it can't be removed. Lesson saved: verify columns via `information_schema`, never probe-insert an immutable audit table. New memory [[reference_audit_logs_immutable_and_shape]]. Prefer routing ad-hoc inserts through `src/services/auditLogger.ts` (canonical shape) going forward.
- **TOTP WebCrypto type fix (`6f61c381`).** `admin-totp-setup`/`admin-totp-verify` HMAC helper failed `deno check` (TS2769/TS2345 — lib types `Uint8Array<ArrayBufferLike>` not accepted as WebCrypto `BufferSource`, though it is one at runtime). Added `as BufferSource` boundary cast on `importKey`/`sign`; both fns deno-clean, deployed. (Pre-existing, unrelated to the audit sweep — flagged there, fixed on Maria's go.)

**Current OPEN status after this session:** #1 engineering DONE (Akima ratification only); #2 unchanged (product-separation Part 1 not built); **#3 substantially DONE** (code + 5 views live; the BulkExport audit-insert deferral now RESOLVED fleet-wide, see above). See **⚠️ CURRENT OPEN (updated 2026-07-11)** just below the collapsed prior handoff.

<details><summary>Prior handoff (2026-07-10, fourth session) — MCP schema-drift gate generalization</summary>

**This session's arc:** Executed the third session's named next step — **generalized the FHIR schema-drift gate from the MCP FHIR server to EVERY `mcp-*` server + the app-side `src/services/fhir/` layer.** First full-scope run flagged **46 candidate column-drifts across 8 files**; each was live-verified against `information_schema` by reading the actual source line — **all 46 were REAL runtime-dead drift; 0 false positives, 0 snapshot staleness.** Fixed every one. **8 commits, two pushes (`d4d1f4a9..fa34f1f8`), all on `main`, all live-verified + deployed; gate now 0-baselined; nothing mid-flight.**
- **Gate generalized** (`625b5be8`): `scripts/check-fhir-service-schema.py` now walks `supabase/functions/mcp-*` recursively (was fhir-only) + validates any snapshot table. Snapshot expanded to the tables the other servers touch. Full triage + per-finding dispositions in **`docs/trackers/mcp-schema-drift-triage-2026-07-10.md`**.
- **mcp-patient-context-server** (canonical spine S5, `7f53032d`): care_team (`member_` prefix), check_ins (`mood→emotional_state`), readmission (`readmission_risk_score`/`risk_category`), fall-risk (`overall_risk_score`/`risk_category`/`assessment_date`), self_reports (dropped nonexistent `symptom_category`/`severity`, summary from real `mood`), profiles (dropped nonexistent `preferred_language`).
- **mcp-prior-auth** (`8e3a2ba7`): service lines → `cpt_code`/`cpt_description`/`requested_units`/`line_status`.
- **mcp-medical-coding + mcp-drg-grouper twins** (`cee35325`,`e38f0e48`): `clinical_notes.type→note_type`, `encounters.notes→clinical_notes`, and the claims charge-agg fallback rewired **patient→encounters→claims** (claims has NO `patient_id`/`service_date` — a claim links to a patient only via its encounter).
- **src/services/fhir/EncounterService** (`60a775ef`, **Option A** — Maria's call): dropped the FHIR-shaped column list (`class_code`/`period_start`/`reason_code`/`participant`/`hospitalization` — in NEITHER `encounters` NOR its same-shape twin `fhir_encounters`), now selects the operational columns; `complete()`→`visit_ended_at`+`status='completed'`; `getActive` uses live statuses (`arrived`/`triaged`/`in_progress`); `getByClass→getByType`. Consumer `patient-context/fetchTimeline.extractLastEncounter` + both test files updated (34/34 green).
- **B1 caregiver contacts — DONE via boundary-layer view** (`fa34f1f8`): the contacts fetcher queried `caregiver_view_grants` (the access-grant / PIN edge) for contact columns it lacks. New view **`v_patient_caregiver_contacts`** (migration `20260710140000`, `security_invoker=on`, `GRANT SELECT TO authenticated`) UNIONs (1) the senior's own `profiles.caregiver_*` primary with (2) active view-grant holders resolved to their own profile — Maria's "more than one way to reach caregiver info." Fetcher repointed; snapshot adds the view; live-verified (exists, security_invoker on, GRANT true, cols resolve; **0 rows — tenant has no caregiver data, so column-proven not seeded**).
- **🔑 Maria's standing rule (2026-07-10):** every NEW migration carries its own GRANTs (supabase.md §2a); OLD tables missing grants get them in a **year-end cleanup** — do NOT retrofit old-table grants ad hoc now.
- **Deploy:** 5 servers redeployed `--use-api` (verify_jwt pins preserved, all ACTIVE): mcp-chain-orchestrator, mcp-patient-context-server (×2), mcp-prior-auth-server, mcp-medical-coding-server, mcp-drg-grouper-server. deno at `~/.deno/bin/deno` (NOT on PATH).
- **B2 — DONE** (`c5e0417c`, migration `20260710150000`): added `claims.patient_id`
  `uuid REFERENCES auth.users(id)` + `idx_claims_patient_id` + backfill + keep-in-sync
  trigger `trg_set_claim_patient_id`/`set_claim_patient_id` (SECURITY DEFINER,
  search_path=public) deriving it from the encounter. claims already GRANTs authenticated
  (§2a). **Live round-trip proven** (insert w/o patient_id → trigger populated it; test row
  deleted, 0 residue). charge-agg fallback keeps its encounter-join (needs `date_of_service`).
- **pg_constraint sweep — DONE** (`d00afd54`, migration `20260710160000`): fleet-wide sweep for the `user_questions_status_check1` class (duplicate CHECK that intersects → narrows the valid domain). **That dangerous class is CLEAN** (0 tables with >1 CHECK on the same column). Of 9 duplicate FK/UNIQUE constraints (7 tables), most are **LOAD-BEARING PostgREST embed hints** (`profiles!<constraint>` in app code — security_alerts/encounters/community_moments) and were intentionally KEPT; dropped only the **4** that are exact-duplicates AND zero-reference (fhir_care_plans, fhir_practitioners, fee_schedule_rates, security_events). Details + the kept load-bearing FKs in `docs/trackers/pg-constraint-collision-sweep-2026-07-10.md`.
- **encounters.patient_id two-parent FK — RESOLVED** (`99560310`, migration `20260710170000`): the sweep's flag. Repointed the same-named `encounters_patient_id_profiles_fkey` from `profiles(id)` to `profiles(user_id)` (the PK/unique join key) — divergence-proof, zero code change (embeds resolve by name), auth.users FK + RESTRICT preserved, live-verified.
- **🔐 ADMIN PRODUCT-SEPARATION workstream (Maria-initiated; Part 2 DONE, Part 1 pending her sign-off).** Audit (Explore agent) found the admin layer enforces separation **by ROLE only, never by PRODUCT** — the `tenants.licensed_products` `text[]` (`'wellfit'`/`'atlus'`) mechanism exists in the DB but **no route/guard/section/edge-fn reads it**. Also: "WellFit EMR" is NOT a 3rd product — it's Envision Atlus (System B); there are **2 products** + shared spine. Two concrete (latent — all tenants currently `['wellfit','atlus']`) exposures found + FIXED in **Part 2** (`3850aab7`): (1) `DashboardSection.roles` was dead metadata → the super_admin-only MCP-API-Key panel rendered for any `admin`; `getSectionsByCategory(category, userRole)` now fails-closed on `section.roles` (5 category callers thread `userRole`; only the MCP panel is newly hidden from plain admin, zero collateral). (2) `generate-api-key` edge fn authorized any `admin` with no product scope → added an `'atlus'`-license gate (403 for WellFit-only tenants); redeployed `--use-api`. Verify: deno 0, scoped tsc 0/6, eslint 0, 36 tests. **⚑ UI who-sees-what change → needs Maria's visual acceptance (#13).** **Part 1 (the full `useProductAccess()` gate across routes + sections + other edge fns) is drafted + waiting on 3 decisions** in `docs/trackers/product-separation-feature-list-2026-07-10.md`: (a) API-key policy super_admin-only vs Atlus-tenant-admin, (b) audit/SOC2 Shared-vs-Atlus split, (c) whether `license_tier=enterprise` gates anything beyond the `atlus` product. **UPDATE (later same session — Maria clarified the model + gave go on the operator-retighten):** the correct model is **3 ENTITIES** (supersedes the "2 products" line above): **Envision = parent/operator** (Layer 1, `super_admin` — the "parent specifics," stripped from every white-label), **WellFit EMR = the `atlus` product**, **WellFit Community Daily = the `wellfit` product** (the non-profit origin; sold together/separately per license `8`/`9`/`0`). Documented canonically in **`docs/architecture/PRODUCT_ARCHITECTURE.md`** (+ README updated). **Operator-retighten (`1206d9b5`):** `generate-api-key` retightened to `['super_admin']` only (dropped the wrong-axis `atlus` gate from Part 2); MCP keys already super_admin. Decision #1 (API-key policy) RESOLVED = super_admin/operator. **Hybrid DB verified** (`docs/trackers/tenant-isolation-silo-tracker.md`): Pool (shared+RLS, LIVE) + Silo (per-client project, PLANNED-not-built) + hybrid-on-demand — matches Maria's memory; the design is ready, not yet built. **Cross-system bridges verified intact** after the drift work (all coupling views + `profiles` embed-FKs present; the drift work repaired the patient-context spine, didn't sever anything).
- **⚠️ OPEN:**
  1. **CARRIED FROM THIRD SESSION — still BLOCKED on Akima:** `risk_assessments` UN-INSERTABLE live (its trigger calls the dropped `encrypt_phi_jsonb`) → PHI §17 territory. Proposal in `docs/clinical/RISK_ASSESSMENTS_ENCRYPTION_REVIEW.md`; unsent Gmail draft to Akima. Awaiting her 4 decisions.
  2. **Admin product-separation — remaining work.** (a) **SOC2/compliance operator-vs-tenant split** (feature-list decision #2) — the last Layer-1 operator gate (SOC2 dashboards → super_admin) is blocked on this; dovetails with #3 below. (b) **`license_tier` axis** (decision #3). (c) **Part 1 build:** `useProductAccess()` (reads `licensed_products`) gating routes/sections/edge-fns for the EMR-vs-Community split. (d) **Visual acceptance** of the Part 2 section change (MCP panel now hidden from non-super-admin — Commandment #13). Model + layers in `docs/architecture/PRODUCT_ARCHITECTURE.md`; decisions in the feature-list draft.
  3. **SOC2 / Security / Guardian dashboards throw a wall of console errors** (Maria pasted a login-session console dump). Triaged to **7 root causes** (NOT a security break — all READ-side; audit *writes* return 200): (i) wrong table names `patient_encounters`→`encounters`, `billing_claims`→`claims`, `phi_access_audit`→`phi_access_logs` (DatabaseAdminPanel, soc2MonitoringService); (ii) `security_events.actor_ip_address`→`ip_address` (SOC2*Dashboard + soc2-compliance/*Tab); (iii) `audit_logs` heavy column drift (`category`→`event_category`, `created_at`→`timestamp`, no `severity`/`action`/`details`/`actor_name`/`patient_id`; real cols use `operation`/`metadata`/`target_user_id`/`actor_*`); (iv) `user_sessions?select=*,profiles(email)` 400 — user_sessions.user_id FKs auth.users not profiles (embed needs a profiles FK, like encounters); (v) `create_guardian_review_ticket` 400 — RPC takes 17 `p_*` args, `guardianApprovalService` calls with mismatched shape; (vi) 3 missing aggregate views never created — `security_monitoring_dashboard`, `incident_response_queue`, `compliance_status`; (vii) `mcp-postgres-server` 500 (needs edge-fn log). NOT yet fixed — scoped but pending (Phase 1 = the code drift fixes i/ii/iii/v; Phase 2 = the FK #iv, the 3 views #vi, the 500 #vii, + an aria-hidden/inert a11y warning on a focused iframe).
---

**Last Session (2026-07-10, fourth):** **Generalized the FHIR schema-drift gate to ALL `mcp-*` servers + the app-side FHIR layer (the third session's named next step) → it flagged 46 candidate drifts, all live-verified REAL, all fixed.** 8 commits on `main` (`d4d1f4a9..fa34f1f8`), two pushes, 6 servers + 1 new view deployed/applied, **gate now 0-baselined**. Fixes: patient-context spine (`7f53032d` — care_team/check_ins/readmission/fall-risk/self_reports/profiles drift), prior-auth service lines (`8e3a2ba7`), medical-coding + drg-grouper twins (`cee35325`/`e38f0e48` — clinical_notes/encounters + claims encounter-join), EncounterService **Option-A** operational remap (`60a775ef`, +consumer +tests 34/34), and **B1 caregiver contacts** via new boundary-layer view `v_patient_caregiver_contacts` (migration `20260710140000`, security_invoker, GRANT §2a — `fa34f1f8`). Gate generalization itself in `625b5be8`; chain-orchestrator subquery refactor `b76e499c`. **Maria set a standing rule:** new migrations carry their GRANTs, old-table grant gaps are a year-end cleanup (don't retrofit now). Verify: every `deno check` 0; scoped tsc 0; eslint 0; 34/34 affected tests; gate green; all columns live-verified vs `information_schema`; 5 servers `--use-api` (verify_jwt preserved, all ACTIVE); view live-verified. **Then B2 (`c5e0417c`, migration `20260710150000`):** added `claims.patient_id` (uuid→auth.users, index, backfill, keep-in-sync SECURITY DEFINER trigger) — live round-trip proven (insert w/o patient_id → trigger populated it from the encounter; test row deleted). **Then the pg_constraint name-collision sweep (`d00afd54`, migration `20260710160000`):** dangerous duplicate-CHECK class CLEAN fleet-wide; dropped 4 exact-duplicate zero-reference FK/UNIQUE constraints, KEPT the load-bearing PostgREST embed-hint FKs (documented in `docs/trackers/pg-constraint-collision-sweep-2026-07-10.md`); the sweep's `encounters.patient_id` two-parent-FK flag then **RESOLVED** (`99560310`, repointed to `profiles(user_id)`). **Then an admin PRODUCT-SEPARATION audit (Maria-initiated):** the admin layer gates by ROLE only, never by PRODUCT (`tenants.licensed_products` unused in code); Part 2 hardening (`3850aab7`) enforced dead `section.roles` metadata (super_admin-only MCP-key panel was showing to any admin) + added an `'atlus'`-license gate to the `generate-api-key` edge fn. Part 1 (full `useProductAccess()` gate) drafted + waiting on Maria's 3 decisions (`docs/trackers/product-separation-feature-list-2026-07-10.md`). **Also triaged (not fixed):** the SOC2/Security/Guardian dashboards' console-error wall → 7 read-side root causes (see OPEN #3). **Open:** RiskAssessment block (Akima), admin-separation Part 1, SOC2 dashboard repairs.

</details>

### ⚠️ CURRENT OPEN (updated 2026-07-11)

1. **RiskAssessments encryption — engineering DONE, Akima ratification only.** `risk_assessments` is now writable+readable (trigger rewired to `encrypt_phi_text(use_clinical_key=true)`, `risk_assessments_decrypted` view — `fe80ac33`, migration `20260711190000`). What remains is Akima's §17 clinical-key-scope sign-off (`docs/clinical/RISK_ASSESSMENTS_ENCRYPTION_REVIEW.md`, unsent Gmail draft). No longer a code blocker.
2. **Admin product-separation — Part 1 NOT built.** `useProductAccess()` (reads `tenants.licensed_products`) gating routes/sections/edge-fns for the EMR-vs-Community split is drafted only (`docs/trackers/product-separation-feature-list-2026-07-10.md`). Decision #1 (API-key policy) RESOLVED = super_admin/operator; decisions #2 (SOC2 Shared-vs-Atlus split) and #3 (`license_tier` axis) still open. Part 2's MCP-panel visibility change still needs Maria's visual acceptance (#13).
3. **SOC2 dashboards — REPAIRED this session (`18377fe0`), with scoped deferrals.** Code drift + 5 restored views are live. Remaining follow-ups (each surfaced, none silently dropped): (a) `encryption_status_view` — blocked on a schema decision (`encryption_keys` lost `key_purpose`/`key_algorithm`); (b) **`mcp-postgres-server` GET→500** — MCP servers are POST-only; edge-fn method-handling fix + redeploy; (c) ~~ad-hoc `audit_logs` inserts write `user_id`/`action`~~ **DONE (`97a15dba`)** — fleet-wide sweep fixed 28 sites, deployed; (d) `FHIRConflictResolution.resourceTableMap` — broader FHIR-write table drift (whole map suspect, unverified); (e) `phi_access_audit` surfaces `patient_name`/`actor_email` from audit metadata → **Akima §17 awareness**.

<details><summary>Prior Session (2026-07-10, third) — MCP FHIR runtime revival + schema-drift gate extension</summary>

**Last Session (2026-07-10, third):** **The MCP `.select('*')` §9 pass + live-column audit (the second session's two open follow-ups) → uncovered that most of the MCP FHIR server was RUNTIME-DEAD and revived it, one commit per resource.** **13 commits on `main` (`72d2b411`→`96105a51`), all pushed, all live-verified, 4 servers + 2 views deployed/applied.** **(A) Hygiene + a real bug:** `72d2b411` chain-orchestrator — the approve-step handler looked up `approval_role` from a **non-existent `chain_steps` table** → errored → `requiredRole` undefined → **approval-role authorization gate silently bypassed** (wrong-role user could approve a gated step); repointed to `chain_step_definitions`, live-proven (`to_regclass('chain_steps') IS NULL`); + 11 `select('*')`→explicit (new `columns.ts`, dynamic-string selects degrade supabase-js inference to `GenericStringError` → 9 `as unknown as` boundary casts). `8925f650` medical-coding/drg-grouper — 5 `select('*')` on `payer_rules`/`daily_charge_snapshots`→explicit (no drift, byte-identical). **(B) FHIR revival (11 commits):** `b23fd180` **Patient/profiles — `export_patient_bundle` was fully dead** (selected `date_of_birth`/`middle_name`/`address_line1`; live: `dob`, single `address`, no middle_name) → "Patient not found" for every patient; fixed `types.ts` ProfileRecord + `tools.ts` FHIR_SELECT_COLUMNS + `resourceQueries.ts` + `bundleBuilder.ts` toFHIRPatient + `patientSummary.ts` demographics, and **rewrote the two Tier-5 junk Patient tests to actually call `toFHIRPatient`**; proven via a live patient row. `f05f1256`→`3bceb2a7` per-resource column drift: DiagnosticReport (`effective_date`→`effective_datetime`), Practitioner (`name`/`specialty`→`family_name`+`given_names`/`specialty_display`), Encounter (`class`/`type`/`period_*`/`reason_code`→`encounter_type`/`date_of_service`/`chief_complaint`), Medication (`manufacturer`→`manufacturer_id`+`_display`), Procedure (`category`/`performed_date`→`category_code`+`_display`/`performed_datetime`), `72aa902b` Immunization (`occurrence_date`/`site`/`route`→`_datetime`/`_code`+`_display`), `c696a800` Goal (`description`/`status`/`target_date`→`description_text`/`lifecycle_status`/`target`). `dd758e38` **`get_patient_summary` was broken in nearly EVERY section** (independent of FHIR_SELECT_COLUMNS) — fixed conditions/medications/vitals/careplans selects+reads. **(C) Missing-table resources (Maria: "we need documentation" → back them, don't drop):** `78474eb1` **AllergyIntolerance** + `99b6c903` **DocumentReference** — both `fhir_allergies`/`fhir_document_references` were aspirational names that never existed; created `security_invoker` **VIEWS** (governance §3 boundary-layer) over the real `allergy_intolerances` (patient_id←user_id) and `ai_progress_notes` (migrations `20260710092103`/`092104`, `db push --include-all`, live-verified) — **zero code change**, FHIR_TABLES already named them; + fixed `get_patient_summary` allergies (dropped nonexistent `substance`). `96105a51` `ai_risk_assessments`→`risk_assessments` bundle repoint (outcome←risk_level, prob←overall_score, basis←risk_factors w/ Array.isArray guard). **Verify (all live):** every `deno check` 0; chain 35 + fhir 42 test steps green; **0 of 33 corrected FHIR columns missing** (single `information_schema` LEFT JOIN proof); both views exist w/ `security_invoker=on` + GRANT true; per-resource commits; 4 servers redeployed `--use-api` (verify_jwt preserved). **⚠️ Caveats (not defects):** the allergy/note/risk tables are **empty live** so those paths are column-resolution-proven, not seeded-round-trip-proven; DocumentReference covers only `ai_progress_notes` (clinical_notes is encounter-scoped); `getPatientBundle` uses `profiles.id` vs summary's `user_id` (id==user_id today).

</details>

<details><summary>Prior Session (2026-07-10, second) — KPI "scalar" bug → fleet-wide MCP schema-drift/type-debt repair + FHIR runtime revival</summary>

**A "KPI unavailable" UI error → uncovered + repaired systemic MCP schema-drift + type-debt; every mcp-* server now deno-clean and the runtime-dead FHIR tools live again.** **(A) The reported bug — `get_dashboard_metrics` (`PlatformKPIPanel`) — was TWO bugs:** (1) `mcp-postgres-server/toolHandlers.ts` `JSON.stringify`'d the params array into `execute_safe_query`'s **jsonb** param → PostgREST stored a jsonb SCALAR string → `jsonb_array_elements_text` threw "cannot extract elements from a scalar", breaking EVERY whitelisted query (fixed: pass a real array); (2) the query targeted tables/columns that never existed (`patients`/`care_tasks`/`sdoh_flags`/`readmission_risk_30`/`encounter_date`). Maria confirmed "those were supposed to exist" → rewired to the REAL live tables: `profiles.enrollment_type/risk_score`, `encounters.created_at`, **`provider_tasks`** (the real task table), **`passive_sdoh_detections`**. Live-proven via the MCP tool path (`active_members:40`, etc.). Commits `784f9104`, `d97bd296`. **(B) MCP type-debt sweep (Maria-directed, "surgeon not butcher", one commit per root-cause, per-server verify):** cleared ~57 `deno check` errors across 7 servers → 0 fleet-wide. `cb8cea95` #1 `MCPToolDefinition.inputSchema.required` → optional (JSON Schema; +propagated to fhir local TOOLS type); `17090b4f` #2 added the missing flat `standard` tier to `MCP_TIMEOUT_CONFIG` (runtime value unchanged — callers already `?? 15_000`); `5360beeb` #3 two-arg `.then(ok,err)` on PostgREST audit inserts (PromiseLike has no `.catch`) **+ 6 pre-existing billing `.select('*')` → explicit columns** (the pre-commit gate forced this; enumerated ALL live columns so tool output is byte-identical, every column live-verified); `179646a2` #4 misc (redundant cast, `validationErrors` null-guard, `result` Record widening, patient-context supabase-js **version-skew** import alignment `@2?target=deno`→`@2`); `4cd453f8` the **cascade regression I introduced with #1 and caught only via a full-fleet sweep** (5 more servers — clearinghouse/hl7-x12/edge-functions/medical-codes/postgres — had a local mandatory `required: string[]`; widened them too). **(C) FHIR runtime repairs (#5, the delicate one — Maria approved each resource):** all four handlers were `42703`-dead. `2bd56586` medications (`medication_name`→`medication_display`, `dosage_instructions`→`dosage_text`, `frequency`→`dosage_timing_frequency`, `route`→`dosage_route_display`, `end_date`→`validity_period_end`); `05708c81` conditions (`severity`→`severity_display`, `onset_date`→`onset_datetime`); `caffb170` observations (`effective_date`→`effective_datetime` in select+filters+order, `value_codeable_concept`→`_display`, `value_quantity`/`unit`→`value_quantity_value`/`_unit`) + typed the generic Observation bundle spread; `1d6f0c02` **care_teams restructured** — `participants` was NOT a column (members normalized into `fhir_care_team_members`), so rewired to fetch+group members from that table, + the mechanical infra fixes (`tier: string`→`MCPTier`, `caller.* ?? undefined`, 3 typed bundle spreads), + extracted the 5 `Fhir*Row` interfaces to `types.ts` to keep `toolHandlers.ts` under 600 (561). `b53c872a` repointed the SDOH `active_flags` from the nonexistent `sdoh_flags` table to **`passive_sdoh_detections`** (`sdoh_category`/`risk_level`/`ai_summary`/`detected_at`, active = `status NOT IN ('resolved','dismissed')`). **Verify (all live):** every mcp server `deno check` 0; fhir 36→0; `get_medication_list` returns real meds end-to-end through the deployed MCP tool; all rewritten column lists live-verified against `information_schema`; no `any` (boundary casts only per typescript.md); per-group commits; `mcp-fhir-server` + `mcp-postgres-server` deployed via `--use-api`.

</details>

<details><summary>Prior Session (2026-07-10, first) — nurse-question auto-escalate cron + constraint drift</summary>

**Recovered crash-interrupted nurse-question-auto-escalate work → scheduled the never-created cron, closed an open data-mutating endpoint, and — via live-proof — caught + repaired a status-constraint drift bug that was silently breaking the ENTIRE nurse claim + escalate workflow in production.** The safety feature `nurse-question-auto-escalate` (unclaimed >2h → charge_nurse; claimed-unanswered >4h → supervisor) documented "Runs every 15 minutes via Supabase cron" but **no cron was ever created** (verified live: 0 `cron.job` rows) — same class as the 2026-07-09 health-monitor / bed-capacity-monitor "designed cron-triggered but never scheduled" findings. **Two commits on `main`, all live-proven:** (1) `0d1e4bc1` — **auth gate** (`isAuthorizedCronCaller`; the fn is `verify_jwt=false` in config.toml with **zero app/edge callers** verified via grep, so this closed a previously-open, *data-mutating* endpoint; mirrors health-monitor/guardian-agent, accepts `X-Cron-Secret` or Bearer = `CRON_SECRET`/`SB_SECRET_KEY`) + migration `20260710120000` **scheduling** the `*/15 * * * *` cron (Vault `sb_secret_key` Bearer, same pattern as guardian-daily-summary/health-monitor) + migration `20260710121000` **repairing the constraint drift**. (2) `dfba0ebc` — typed the edge-fn client as `SupabaseClient` (`_shared/auth.ts` pattern), clearing **5 pre-existing `deno check` errors** (un-annotated `createClient` inferred every table as `never` → `.update()`/`.insert()` failed; lines 159/183/264/285/303, none in my auth-gate change — fixed anyway per "don't dismiss errors as pre-existing when touching the file"). **🔎 THE HEADLINE FINDING (surfaced by live-proof, not code review):** firing the cron authed returned **200 but 4/4 escalations FAILED** on `user_questions_status_check1`. Root cause = **CHECK-constraint drift**: `user_questions.status` carried TWO constraints at once — the authoritative 5-value `user_questions_status_check` (`pending,claimed,answered,escalated,closed`, defined by `20260224100000_nurse_question_system.sql` with the comment "include 'claimed' and 'escalated'") AND a **stale duplicate `user_questions_status_check1`** (`pending,answered,closed`). A row must satisfy BOTH → the effective domain was the intersection, so **`claimed` and `escalated` could NEVER be written** — silently breaking not just the cron but the entire nurse **claim** RPC (`claim_question` → status='claimed') and **escalate** RPC (`escalate_question` → status='escalated') live. `check1` traces to a `CREATE TABLE IF NOT EXISTS` with an inline unnamed CHECK added while the base constraint already existed (Postgres auto-suffixed `_check1`); it is owned by no current forward migration. Migration `20260710121000` **drops the stale duplicate + re-asserts the authoritative 5-value constraint** (zero row impact — all live rows are `pending`/`answered`; fully reversible). **Verify (all live against prod):** `deno check` **5→0**; unauthed/bogus-bearer → **401**, Vault-authed → **200**; post-fix escalation **4/4 SUCCEEDED** (was 4/4 failing), 4 rows now `status=escalated`/`escalation_level=charge_nurse`, 4 `nurse_question_notes` "ESCALATED to…" logged (4h cooldown now armed so the next tick skips them); constraint check confirms only the 5-value `user_questions_status_check` remains; cron `active=true` `*/15`; per-function `--use-api` deploy (other verify_jwt pins preserved). Scoped app typecheck empty (edge fn is Deno, out of app tsconfig). **⚠️ Follow-up (surfaced, NOT done):** the same 5-value `_check1` duplicate-constraint / `never`-typed-client patterns likely recur on sibling tables/edge-fns — a codebase-wide `pg_constraint` sweep for name-collision drift + a `createClient` annotation sweep would be worthwhile but were out of this recovery's scope.

</details>

<details><summary>Prior Session (2026-07-09, second) — Guardian Agent + Eyes audit</summary>

**Guardian Agent + Eyes end-to-end audit → killed a 41k-row alert-noise runaway, activated the dormant watchdog, and repaired a dead CRITICAL edge function — all live-proven.** Traced the whole Guardian pipeline vs the live DB. **Finding:** `guardian-automated-monitoring` cron (every 5 min) inserted byte-identical `slow_query` alerts with ZERO dedup, and `check_alert_escalation()` escalated EVERY unaddressed `new` alert regardless of severity → **41,411 `security_alerts`, 99.9% `escalated`** (severity signal destroyed). The flagged "slow queries" are Supabase's own **schema-introspection** (table/view editor + MCP `list_tables` over 761 tables) + a one-off pg_net read — **NOT app code**. **Four fixes (Maria-directed, all live-proven, all pushed to main):** (1) `592e0a86` **dedup** — `guardian-agent/monitoring.ts` now bumps `occurrence_count`/`last_occurrence_at` on the open alert of the same `(tenant_id, alert_type)` instead of inserting a dup; email only on a genuinely-NEW critical/high. (2) `592e0a86` **escalation policy** (migration `20260709170000`) — `slow_query` NEVER escalates; med/high/critical keep the 15-min rule; low escalates only at `occurrence_count >= 20`. Live-proven: RPC run left slow_query un-escalated at count 8277. (3) `592e0a86` **backlog cleanup** — collapsed **41,411 → 46 rows** (one counting row per tenant/type; de-escalated slow_query survivors), surfacing a real, previously-buried `critical` `anomalous_behavior` alert. (4) `6a49387f` **activated health-monitor** (GRD #4) — the ONLY writer path to `guardian_eyes_recordings` (0 rows ever) via its record-on-critical-failure call, but it had NO cron AND no caller auth (latent open endpoint). Added server-to-server cron-secret auth (mirror of guardian-agent) + scheduled `health-monitor-checks` every 15 min (migration `20260709180000`, Vault-authed). Live-proven: authed→**200** `{healthy:2,degraded:6,unhealthy:1,total:9}`, unauthed→**401**. **The watchdog immediately caught a dead CRITICAL function:** `bed-capacity-monitor` returned **503 BOOT_ERROR** on every call — `dd58db69` fixed it (it imported `{ getEnv }` from `_shared/env.ts`, which exports no such member → ES-module load crash → never booted; switched to the `SUPABASE_URL`/`SB_SECRET_KEY` constants; sister-grep clean; live re-probe **503→200**). Then `7224b15e` **scheduled bed-capacity-monitor** (15-min cron `20260709190000` + cron-secret auth + closed its own open endpoint; it was designed cron-triggered but never scheduled). Live-proven authed→200 / unauthed→401; watchdog now reads it `healthy`. **Verify:** `deno check` 0 on every changed fn; 11 guardian-agent deno tests green; per-function `--use-api` deploys (verify_jwt pins preserved, no bulk deploy). Also committed `182e9259` (insights report md+html). **⚠️ Open follow-ups (surfaced, NOT done):** (a) ✅ **health-probe contract FIXED (commit `f95f16ef`)** — probe-side liveness interpretation in `health-monitor` (only ≥500 / timeout = down; 4xx = alive with an honest `probe_note`) + a shared `_shared/healthCheck.ts` handshake wired into guardian-agent / agent-orchestrator / bed-capacity-monitor. Watchdog now reads **9/9 healthy, 0 down** (5 real handshake + 4 honest heuristic). **🔎 NEW finding from this:** adding explicit columns to bed-optimizer's pre-existing `select('*')` (gate) surfaced a real latent bug — its placement scoring reads `v_bed_board` columns that DON'T EXIST (`is_isolation`/`is_negative_pressure`/`unit_occupancy_pct`/`id` vs real `has_isolation_capability`/`has_negative_pressure`/`<none>`/`bed_id`), so **isolation & negative-pressure requirement scoring is silently broken** (always penalizes). ✅ **bed-optimizer placement bug FIXED (commit `9d019145`)** — corrected to the real `has_isolation_capability`/`has_negative_pressure`, sourced real per-unit occupancy from `v_unit_capacity.occupancy_pct` (no design decision needed — the data existed), `bed_id`, typed selects that exclude PHI, + re-added its real health handshake. Live-proven: deno 0, all fixed column sets resolve against real data (6 available beds / 5 units w/ occupancy / 14 LOS rows), probe→200. **bed-management** was left on `select('*')` (reverted; its issue was only a TS type-shape conflict on the get_unit_capacity reassignment, NOT a runtime bug) — a minor explicit-columns lint cleanup if ever desired. (b) `bed-capacity-monitor` + `health-monitor` crons run **no-op until facility/agent data exists** (`facilities_checked:0`). (c) **Pre-existing** `deno check` SupabaseClient generic-clash at `checkReferenceDataFreshness(sb)` in health-monitor (present before this session; affects any edge fn using that helper).

</details>

<details><summary>Prior Session (2026-07-09, first) — RPM Session E part 2 verified done</summary>

**Session (2026-07-09, first):** **BLE/RPM Session E part 2 verified DONE + a real GRANT-gap defect fixed + recipients configured.** Maria said "give Session E part 2 the go-ahead" — investigation found it was **already built, committed AND pushed** (`81eafc32`); the earlier "part 2 NOT built" note here was **stale**. Live DB confirmed the whole pipeline exists: `rpm_reports` + `rpm_report_settings` tables, `log_rpm_report_review` RPC (SECURITY DEFINER, tenant-admin gated, first-reviewer-wins), `rpm_reports_tenant_read` RLS, cron `rpm-weekly-report` (`0 13 * * 1` = Mon 13:00 UTC), edge fn deployed **ACTIVE** (`verify_jwt=false`, pinned in config.toml). Edge-fn column assumptions re-verified live (`wearable_vital_signs`.user_id/vital_type/value/measured_at, `check_ins`.user_id/timestamp) — sound. **ONE real defect found + fixed (`6f6c67a4`):** the `20260704180000` pipeline migration enabled RLS + policies but **omitted the table GRANTs** (§2a RLS≠GRANT footgun; built 07-04, one day before that lesson was baselined) → `has_table_privilege('authenticated','rpm_reports','SELECT')` was **false**, so the review-UI read path (`rpmReportService.listPatientReports`) would 403 the moment a report existed. New forward migration `20260709160000_rpm_report_grants.sql` (GRANT SELECT on rpm_reports; full CRUD on rpm_report_settings matching its FOR ALL policy); applied via `db push` + **live-verified false→true**. **Recipients set (Maria-provided):** WF-0001 `rpm_report_settings.recipient_emails` = `[maria@, akima@]`, is_active=true (live UPDATE — tenant config, not a migration). **Empty-run LIVE-PROVEN:** fired the cron-path POST to `rpm-weekly-report` (Bearer from Vault, never exposed) → **200 `{"ok":true,"reportsGenerated":0,"reportsSent":0}`** — auth + deploy + 0-enrollment logic all green. **Still NOT proven (environmental, not code):** real-data email delivery needs an enrolled senior with device data (live: **0 active enrollments / 0 wearable rows**) + MailerSend under its monthly cap (see 2026-06-06 caveat). ⚠️ **Native-mode banner visual acceptance (Session D) still pending Maria** (Commandment #13). Verify: no TS/TSX touched (SQL migration + live config only) → scoped typecheck/lint empty-scope; existing rpmReportService tests unaffected.

</details>

<details><summary>Prior Session (2026-07-04)</summary>

**CI green + BLE/RPM tracker Sessions D & E (part 1) — with a live-DB bug caught by "not mock test right?".** Three pushes on `main`. (0) **CI fix `c88502e5`:** the only red check was `TypeScript Type Check` on `666a4063` — recharts `<Tooltip formatter>` in `VitalsWeeklySummary.tsx` typed its value param as `number`; recharts wants `ValueType`. Coerced with `Number()` to match the existing `EquityResults.tsx` idiom. Full `tsc` 0, pipeline green. (1) **Session D DONE `c21eefbd` — native-system-mode banner + contraindication fail-safe.** New `src/components/shared/NativeModeBanner.tsx` (positive-framing §1.7 copy — "Currently running in native system mode — your information is saving normally," never "AI is down") + `src/hooks/useNativeSystemMode.ts`. Signal = the Claude client's in-memory **circuit-breaker OPEN** state via `getServiceStatus()` — NOT `isInitialized`, which is unreliable here (the Claude singleton inits lazily, so it reads "unavailable" at startup → would false-positive). Wired into the senior check-in (`CheckInTracker`) + dashboard (`SeniorCommunityDashboard`). `LDContraindicationPanel`: on ANY failure of the automated check, shows the explicit **"Automated contraindication safety check is unavailable — perform manual review"** (fail-safe, clinically correct for all outage causes), underlying error kept as sub-text. 13 tests. ⚠️ **Banner copy/placement needs Maria visual acceptance (Commandment #13).** (2) **Session E part 1 DONE `8fd982fa` — the "Generate" link.** New `src/services/rpmReportService.ts` assembles one report per ACTIVE enrollment from existing parts (no invented math): weekly averages + out-of-range/outlier counts per BLE vital (`vitalsSummaryService`, Session C) + the 16-day transmission count + 99454 eligibility + minutes (`rpmDashboardService.getBillingEligibility`). Per-vital and per-patient failures are skipped, not fatal. 7 tests. **🔎 LIVE-DB PROOF (Maria asked "not mock test right?") caught a real pre-existing bug the mocks hid:** `rpmDashboardService.getTransmissionDays` queried `wearable_vital_signs.recorded_at` — that column **DOES NOT EXIST** live (it's `measured_at`; verified via `information_schema` + a live query that errors `42703`). The wearable branch of the transmission-day count therefore errored on **every** call, breaking CPT 99454 eligibility for BOTH the RPM dashboard AND `rpmClaimService`. Fixed `recorded_at`→`measured_at` (select/gte/order + row read + `WearableRow` type); live-proven (`measured_at` resolves, `recorded_at` 42703). The existing billing/claim tests stayed green because they mock the wearable chain **without asserting the column** — textbook mock-hides-drift (feeds EQ-9 live-integration need). **Verify:** full `tsc` 0 · lint 0/0 · Session D 13 + rpmReportService 7 + rpmBilling 12 + rpmClaim 14 tests green. **⏳ Session E part 2 NOT built (Tier 3 + no live data to prove against):** schedule (weekly cron), send (per-tenant recipient §1.9), review-attribution (`rpm_report_reviews` table for `reviewed_by/at` = the 99457/99458 billing-credit trail). Live DB has **0 active `rpm_enrollments` + 0 `wearable_vital_signs` rows** — the email pipeline can't be end-to-end live-proven until a senior is enrolled with device data, and the cron + new table are **Tier-3 (need Maria's `db push` sign-off + cadence confirm)**. **Also note:** BLE Sessions A–C (`4d0726ea`→`666a4063`) landed 2026-06-30 — the prior header (2026-06-19) predated them.
</details>

<details><summary>Prior Session (2026-06-19)</summary>

**CI fix — Security Scan green again (nodemailer HIGH advisory).** The `Security Scan` workflow was the only failing check on `main` (last 2 pushes red; all other workflows green). Root cause was a dependency vuln, **not** code — `gh run view --log-failed` showed `FAIL_REASONS: npm-audit|audit-ci|`, and `npm audit` pinned it to **`nodemailer <=9.0.0` HIGH** (GHSA-p6gq-j5cr-w38f — message-level `raw` option bypasses `disableFileAccess`/`disableUrlAccess`, arbitrary file read + SSRF). Both CI gates (`npm-audit` step and `audit-ci --high`) fail only on HIGH/CRITICAL. **Fix: bumped `nodemailer` `^8.0.7 → ^9.0.1` in `package.json` + reinstalled (lockfile updated).** Codebase-wide sweep first (Commandment: grep all sisters) confirmed **nodemailer is declared-but-unused in active code** — email actually flows through MailerSend edge functions; the only `createTransport` hits in `src/services/transportService.ts` are *patient-transport* false positives. So the major bump carries zero functional/breakage risk (Tier-2 dependency update per `ai-repair-authority.md` — notify + proceed). Post-fix `npm audit`: **HIGH 0 / CRITICAL 0** (7 moderates remain — all dev-only `@vercel/*` + `smol-toml`/`js-yaml`/`ajv` transitive, below the gate, non-blocking). Dependency-only change: no `.ts/.tsx` touched, so scoped typecheck/tests have empty scope (full suite skipped per lockfile-only guidance). Resolves housekeeping item **S-HK-2**. Stale `deno.lock` `npm:nodemailer@^8.0.7` entry left untouched (orphaned — no Deno function imports it). **THEN — documentation freshness + index tooling** (Maria's request after a doc-quality review): the gap wasn't *what's written* but that a reader couldn't tell what's *still true* + the hand-curated `docs/README.md` index drifts from the 244 actual docs. Two re-runnable, idempotent ESM CLI tools added: (1) **`scripts/stamp-doc-frontmatter.mjs`** — stamps lightweight YAML frontmatter on the 36 clinical+compliance docs: `owner` (Clinical/Compliance by path), `last_updated` (FACTUAL git last-commit date — never a fabricated "verified" date), `review_status: needs-review` (pessimistic default so staleness is visible; a human flips it on sign-off). (2) **`scripts/generate-docs-index.mjs`** — regenerates a complete file index in `docs/README.md` between `<!-- AUTO-INDEX:START/END -->` markers (curated role-based intro PRESERVED), pulling each doc's H1 title + freshness badges; covers all 244 docs / 27 categories so a doc can never be unreachable again. Both have a `--check` mode (exit 1 on drift) → CI-gate-ready (ties into S-CI items). npm scripts: `docs:index`, `docs:index:check`, `docs:stamp`, `docs:stamp:check`. Verify: both `--check` modes green, eslint 0/0 on the 2 scripts (used `import process from 'node:process'` for the browser-targeted eslint config), 36 docs stamped. **Owner assignment (Clinical vs Compliance) + flipping `needs-review`→`reviewed` is Maria/Akima's call** — the tooling just makes the state visible.
</details>

<details><summary>Prior Session (2026-06-17)</summary>

 **Community Moments — emoji reactions feature + two carried-over fixes; then EQ-5 rate-limiting sweep.** Committed + pushed `f1479cd4` on `main`. (1) **Community Moment Reactions** — tappable emoji reactions UNDER each post: migration `20260616210000_community_moment_reactions.sql` (table `community_moment_reactions`, tenant-scoped RLS — `cmr_select_tenant` read, `cmr_insert_own`/`cmr_delete_own` identity-enforced writes, emoji CHECK matching `REACTION_EMOJIS`, unique `(moment,user,emoji)`, indexes on moment/tenant/user). **Migration verified ALREADY APPLIED + registered live** (Commandment #18 check via Supabase MCP — table/RLS/all 3 policies/constraints/FKs match the repo file exactly; version `20260616210000` present in `schema_migrations`). New `MomentReactions.tsx` + `useMomentReactions.ts` hook (toggle + live counts); `REACTION_EMOJIS`/`REACTION_LABELS` (a11y names) in `types.ts`. **Auto-publish:** moments now post live immediately (`approval_status:'approved'`) with post-hoc admin moderation; upload copy updated. (2) **fix(envision-login):** writes canonical `envision_session`/`envision_user` localStorage keys so `/super-admin` no longer bounces to `/envision` after a valid TOTP code (see [[reference_envision_session_keys_coupling]]). (3) **fix(service-worker):** reload-once on SW update + re-check on visibilitychange/online/hourly so installed PWAs stop running stale builds. Verify: scoped tsc 0 / lint 0/0 / pre-commit gate exit 0. ⚠️ **Reactions UI needs Maria's visual acceptance (Commandment #13) before truly "done."** **THEN — Engineering-Quality tracker EQ-5** (rate-limit sweep of `ai-*` edge functions) — see `docs/trackers/engineering-quality-findings-2026-06-07.md`.
</details>

**Prior Session (2026-06-12):** **Dashboard wiring — connected 11 orphaned admin dashboards to real nav (Commandment #21d).** Committed + pushed `bc746678` on `main`. Maria's directive: *get everything connected; designs come later.* Reachability audit of 49 admin dashboards found 21 not in the section nav; of those, 7 were already reachable through `/admin/system` (SystemAdministrationPage — nav-linked via `AdminHeader.tsx:203` "System Admin", super_admin) and 1 (ECQMDashboard) is a re-export alias of the already-connected QualityMeasuresDashboard. The remaining genuine orphans were wired into `/admin/system`'s existing tabs (engineer's call — reuse the one connected hub, no nav sprawl): **security tab** = SOC2 Executive/Security/Audit/IncidentResponse + AuditAnalytics; **ai-usage tab** = AICost/AIFinancial/MCPCost/AIAccuracy; **compliance tab** = DisclosureAccounting; **database tab** = DisasterRecovery (all lazy; SOC2*/MCPCost are named exports mapped to `default`; all 11 propless). Added 3 `AdminHeader` settings nav links: Interoperability (`/interoperability`), Engagement Metrics (`/metrics`), Guardian Agent (`/guardian/dashboard`, super_admin). **#19 RESOLVED (Maria's call): keep + wire BOTH** `/metrics` (MetricsPage) and PatientEngagementDashboard — both now nav-reachable. ⚠️ MetricsPage still renders raw `user_id` UUIDs in an unstyled table (weakest of the two engagement views — flagged for the deferred design pass). Files: `src/pages/SystemAdministrationPage.tsx`, `src/components/admin/AdminHeader.tsx`. Verify: full `tsc` 0 errors in changed files / eslint 0/0 / 11 dashboards confirmed rendered under `/admin/system`. Visual acceptance + full test-suite intentionally deferred (no test references the 2 changed files). **THEN (commit `63cd5540`) — modular visibility per Maria's directive (*"wire it modularly and be able to make them inaccessible if the course of action changes"*):** added per-dashboard feature flags in `src/config/featureFlags.ts` (default ON; `VITE_FEATURE_<NAME>=false` = hide, no code change), reusing the two defined-but-UNUSED internal flags (`soc2Dashboards`, `aiCostTracking` — now enforced, default flipped to ON, zero prior consumers so safe). Each added CollapsibleSection in SystemAdministrationPage + each added AdminHeader link is gated by its flag. **Tier classification (Maria-confirmed):** `[tenant]` (RLS-scoped, all admins) = AICost, AIFinancial, AIAccuracy, Compliance, ClaudeBilling, AuditAnalytics, DisclosureAccounting, Interoperability, EngagementMetrics, TenantAIUsage; `[envision]` (platform/super-admin) = SOC2 suite, MCPCost, DisasterRecovery, Guardian. tsc 0 / lint 0 on the 3 files. **THEN — tenant-admin surfacing DONE:** registered the 5 tab-based `[tenant]` dashboards (AICost, AIFinancial, AIAccuracy → Revenue/Admin; AuditAnalytics, DisclosureAccounting → Security) as sections in the admin section nav (`/admin-tools` → IntelligentAdminPanel, reachable by `roles: ['admin','super_admin']` = tenant admins). Added an optional `featureFlag?: keyof FeatureFlags` field to `DashboardSection` (`sections/types.ts`) and a flag-filter in `getSectionsByCategory` so the SAME modular toggle governs both surfaces. New file `sections/tenantDashboardSections.tsx` (86 lines) holds the 5 sections — extracted to keep `sectionDefinitions.tsx` under the 600 limit (was pushed to 652 → back to 589; mirrors the existing `getRevenueSections`/`getMcpSections` extraction). tsc 0 / lint 0 across the 4 section files. **⚠️ Non-breaking duplication (Maria's call):** the 5 also still appear in `/admin/system` (super-admin only) from the earlier commit — super-admins see them in both places; tenant admins see them only in `/admin-tools`. Pre-existing tenant-based tabs there (TenantAIUsage, ClaudeBilling, Compliance) were left untouched (not my placement to restructure). If you want `/admin/system` decluttered to Envision-only, that's a quick follow-up. **THEN — islanded-panel sweep triaged.** Of 9 islanded `*Page/*Dashboard/*Panel` components: ECQMDashboard = dead re-export alias of the already-connected QualityMeasuresDashboard (no action). **HospitalAdapterManagementPanel WIRED** (propless, non-clinical) → new "EHR Adapters" tab in `InteroperabilityDashboard` (commit `fbcc523f`, tsc 0 / lint 0). The remaining **7 are built-but-unwired CLINICAL/workflow panels** — each needs a placement + (mostly) clinical sign-off, NOT a mechanical wire (investigation found each "obvious" parent is a god-file, already has an overlapping section, or can't supply the required context prop — e.g. ReadmissionRiskPanel needs a `predictionId` the discharge checklist doesn't have). **Per Maria's request, wrote a plain-English review doc for Maria+Akima approval: `docs/trackers/unconnected-clinical-panels-review-2026-06-12.md`** (commit `bf0af8e3`) — describes each panel (FamilyEmergencyInfo, StrokeAssessment/NIHSS, ReadmissionRisk, SDOHPassiveDetection, BillingCodeSuggestion, CodingSuggestion/Atlus, BedStatusQuick): what it does, the home screen it needs, what to add, who decides (🩺 Akima clinical / 🔒 privacy), with `approve/change/hold` checkboxes. **▶ NEXT: await Maria (placement) + Akima (clinical/compliance) markup on that doc, then wire each approved panel individually with a screenshot for visual acceptance.** Whole session pushed to `main` (commits `bc746678`→`bf0af8e3`); tree clean.
**Prior Session (2026-06-10, second):** **DB-reference drift triage Batches 15–17 + #33 + #19-secure — `rpc::` baseline 15 → 11.** **Batch 17 (`20260610130000`): `generate_patient_lab_token`** — hardened restore of the lab-token vault (table self-destructed too). **The original was anon-mintable for ANY MRN** (DEFINER, no search_path, no caller check) → fixed: admin-only mint guard, URL-safe hex token (base64 breaks in URLs), 7d TTL (was 30d), anon/PUBLIC revoked. Live-proven incl. the guard rejecting an unauthenticated caller (0 rows minted). **Data layer only — the patient-facing `/patient/labs/:token` route is a Tier-3 PHI-exposure surface → Akima sign-off, NOT built** (feature is unwired on both ends: 0 callers, no route). **#33 `increment_visits_used`:** Maria-approved Tier-3 deletion of the dead method (0 callers; trigger auto-increments). **#19 secured:** found `/metrics` (MetricsPage) registered as a PUBLIC route — moved to admin auth + wired the real tenant from `profiles.tenant_id` (RLS had been saving it: anon→0 rows). ⏳ nav placement + PatientEngagementDashboard overlap + visual acceptance = Maria. Verify: scoped tsc 0 (3 files) / lint 0 / gate exit 0; no tests reference the changed modules. — **Earlier this session:** Batches 15 + 16 (two clean B-author wins) — see below.

<details><summary>Earlier 2026-06-10 — Batches 15 + 16</summary>

**DB-reference drift triage Batches 15 + 16 — `rpc::` baseline 15 → 13 (two clean B-author wins).** **Batch 15 (`20260610120000`): `get_slow_queries`** — Guardian Check 4's pg_stat_statements wrapper was never defined (silently no-op for months: rpc error swallowed by `Promise.all`). Authored SECURITY DEFINER (+search_path public,extensions), returns **only** queryid+mean_exec_time — never the query TEXT (no PHI). EXECUTE revoked PUBLIC/anon. Live-proven (threshold=1→100 rows cap, threshold=100M→0). **Batch 16 (`20260610120001`+`120002`): `get_patient_engagement_metrics`** — authored vs the live tenant-scoped base table `patient_engagement_metrics` using the STORED `engagement_score` column (no invented algorithm, unlike #1/#4/#5). **SECURITY INVOKER** so the table's RLS (`is_admin OR own row`) stays the ceiling; `_tenant`/`_user` only narrow (Batch 11 precedent). `120002` revoked a residual default PUBLIC grant the first migration missed. Live-proven (shape resolves; 0 rows — base table unpopulated for WF-0001). ⚠️ **Maria note (non-blocking):** #19's caller (`src/api/metrics.ts`+`MetricsPage.tsx`) is UNROUTED scaffolding (placeholder TENANT_ID) overlapping the live `PatientEngagementDashboard` — authoring is non-destructive + clears drift; keep-vs-retire is your product call. **#33 `increment_visits_used` confirmed C-dead** (0 callers of `incrementVisitsUsed`; `increment_pt_visits` trigger auto-increments) — deletion is Tier-3, needs your sign-off. **The other 11 remaining `rpc::` are genuinely gated:** clearinghouse Vault secrets (#12/#36), law-enforcement welfare checks (#17/#27, schema rebuild + sensitive), clinical readmission algo (#5), health-equity analytics needing intent (#1/#4), skipped caching infra (#30/#31), demo seeder (#3), `create_fhir_patient_from_profile` table:: deferral (#7), `generate_patient_lab_token` (#10 — its backing `patient_lab_access_tokens` table is ALSO missing live → schema rebuild + access-token security review, surfaced to Maria). **PRIOR (this header's history below):** Batches 10–14 — `rpc::` 22 → 15.**

</details>

<details><summary>Prior session (2026-06-07, fourth) — Batches 10–14</summary>

**DB-reference drift triage Batches 10 + 11 + 12 — `rpc::` baseline 22 → 15 (+3 table:: entries).** **Batch 14 (`20260607150000`+`150001`): 42 CFR Part 2 sensitive-data subsystem REBUILT** — the whole subsystem (3 tables + 5 fns + RLS) had self-destructed via migrate:down; rebuilt fail-closed with `check_sensitive_consent` bound to the dedicated `cfr42_authorization_log` (not the wrong SMART `patient_consents`), disclosure-log INSERT identity-enforced (was spoofable `WITH CHECK(true)`), anon EXECUTE revoked, all DEFINER search_path-hardened. Confirmed islanded (no active exposure) first; fail-closed gate live-proven (no-auth→deny, valid-auth→allow, expired/revoked/wrong-type→deny). Resolved 4 drift entries (1 rpc + 3 table). ⚠️ Akima compliance-review items noted (purpose-scoping, tenant_id, diagnosis auto-classify wiring, UI surfacing). **Batch 13 (investigation, no migration):** #6 + #7 turned out NOT to be self-contained RPC restores. **#7 `create_fhir_patient_from_profile`** writes to `fhir_patients` which doesn't exist live (superseded by `fhir_patient_bundle`); verbatim restore = no-op → deferred to the `table::` pass (caller fails gracefully, nothing broken). **#6 `check_sensitive_consent`** → 🔒 **HOLD FOR AKIMA**: the whole 42 CFR Part 2 subsystem (3 tables + 5 fns + patient_consents columns + RLS) self-destructed via migrate:down; needs a compliance-reviewed subsystem rebuild, not a drift batch. **Batch 12** (`20260607140000`): `get_nurse_bypass_count_last_7_days` — the SH emergency-bypass rebuild (`20260527025534`) created the dedicated `handoff_emergency_bypasses` table + log fn but never re-created the count RPC the UI calls; authored fresh vs that table as SECURITY INVOKER, live-proven. **Batch 11** (`20260607130000`): neuro-suite analytics `get_dementia_patients_due_for_assessment` + `identify_high_burden_caregivers` — both were dropped-as-broken but their neuro_* backing tables EXIST live (verified); restored as **SECURITY INVOKER** (the dropped originals were unscoped DEFINER → cross-tenant leak; the neuro tables have tenant+staff RLS, so INVOKER is the security-correct fix). Callers already correct → migration-only, both live-proven. **Batch 10** (`20260607120000`): counter RPCs (#8 broken `decrement` caller, #29 injection-prone generic `increment`, #32 `increment_template_usage`). See prior-session detail below. Migration `20260607120000_restore_counter_functions.sql` (3 tightly-scoped SECURITY DEFINER counters, all live-proven via rolled-back round-trips): `increment_template_usage` → `questionnaire_templates` (NOT documentation_templates — 5th name-collision trap); `increment_resource_view_count` replaces a generic injection-prone `rpc('increment',{table,row,col})`; `decrement_beta_participants` replaces NON-FUNCTIONAL `rpc('decrement',{x:1})` embedded inside `.update()`. **#30/#31 cache counters BLOCKED → deferred to the `table::` pass** (backing `billing_code_cache`/`cultural_content_cache` are in a deliberately-SKIPPED caching-infra migration — needs Maria's call before un-skipping). scoped tsc 0 / lint 0 / 37 questionnaire tests green. ⚠️ betaProgramService + resourceService have no test suites (relied on live proof). Earlier this session: fixed 2 failing MCP servers (postgres/medical-codes returned 4xx on `notifications/initialized` → now 202; `4d10b8e9`, deployed). **PRIOR (batches 1–9):** `rpc::` 36 → 27, TWO systemic root causes, FHIR questionnaire system rebuilt as two separate systems. Tracker: `docs/trackers/db-reference-drift-triage-tracker.md`. Batches: **#34** `log_audit_event` → direct `audit_logs` insert (fixed two empty silent-failure catch blocks) `e88c4dd5`; **#2/#35** encounter-provider feature restored `25025ac0`; **#11/#20** fhir_procedures helpers restored `cfdc9573`; **#14/#15** employee directory RPCs (author-from-contract, +ambiguous-column fix caught live) `d6423122`; **#9/#21** FHIR questionnaire deploy+stats `4b315ca4`. New migrations `20260604000000…04` (all via `db push`, all live-proven). **Then built the FHIR Form Builder stats UI** (`QuestionnaireStatsPanel` + 📊 Stats toggle) `801cdc6a` — get_questionnaire_stats had no UI caller.

</details>

**🚨 TWO SYSTEMIC ROOT CAUSES (documented in the triage tracker, both feed [[supabase-mcp-migration-drift]] memory):** (1) **~40 migrations carry dbmate `-- migrate:down` blocks after the up COMMIT** — `supabase db push` runs the whole file, so any CLI-applied one self-destructed (created objects then dropped them; registry says applied, live is empty). Fix = re-author the up-section only into a new forward migration. (2) **`20251209110000_drop_broken_functions.sql` deliberately dropped ~50 functions** referencing missing schema — **15 of the remaining baseline `rpc::` entries trace to this.** A full **VERDICT MAP** for those 15 is in the tracker (deps-present vs schema-rebuild vs sensitive/Maria-sign-off). **Maria's call (2026-06-04): restore the whole feature set properly — don't delete; find purpose, check if replaced, rebuild if not** (new memory [[feedback_investigate_purpose_before_dead]]).
**Updated By:** Claude Opus 4.8 (1M context)
**Codebase Health (2026-06-10, second):** 4 migrations this session applied via `db push` + live-proven (15/16 authoring + 17 lab-token vault + the 120002 grant fix); snapshot refreshed (**761 tables / 1473 functions**); drift gate exit 0. Scoped tsc **0 errors in 3 changed TS files** (0 project-wide), lint **0/0**; no test references the changed modules. `rpc::` drift baseline **15 → 11** (Batches 15/16/17 + #33 + #19-secure); **`table::` half SCOPED + first repoints — 153 → 148.** 2 stale removed (`encounter_providers`/`encounter_provider_audit`, live since rpc Batch 3). New tracker `docs/trackers/db-reference-drift-table-pass-tracker.md`. **A1 column-verified (key finding): name-similarity ≠ schema-compatibility — only 3 of the 17 "confirmed-live" A1 entries were actually clean repoints.** Did the 3 (`cpt_codes`→`code_cpt`, `hcpcs_codes`→`code_hcpcs`, `icd10_codes`→`code_icd10`; all in `mcp-medical-codes-server` fallback branches, live round-trip proven — ⏳ needs that edge fn redeployed). Re-classified the other 14: A3 (repoint + documented column rewrite), 2 → patient_id/user_id clinical mismatch (AV-1 tie-in), 4 → wrong-target B-create, 1 → false-positive (`community` = storage bucket), 1 → heavy (`ai_risk_assessments`). **Then did 2 A3 entries (→ 146):** `behavioral_anomalies`→`anomaly_detections` (PostgREST column aliasing) and `checkins`→`check_ins` — the latter **exposed + fixed a real bug: the Wearable SOS check-in never set `check_ins.tenant_id` (NOT NULL) so it had been failing**; now resolves `profiles.tenant_id` first. mcp-medical-codes-server deployed. ⏳ **Awaiting Maria/Akima:** (1) **Akima** — #10 patient-lab-token: approve the URL-bearer-token-to-PHI pattern + 7d TTL before the `/patient/labs/:token` route is built (data layer restored + hardened; route intentionally not built); (2) **Maria** — #19 `/metrics`: now admin-gated + tenant-wired, but nav placement + overlap with `PatientEngagementDashboard` is your call, and the page needs visual acceptance; (3) carried-over: visual acceptance of QuestionnaireStatsPanel + one in-app admin click on the FHIR "🚀 Deploy to WellFit" button.

---

## 🧠 NEW TRACKER (2026-07-07) — Mental & Behavioral Health Suite

**Tracker:** `docs/trackers/mental-health-suite-tracker.md`
**Governance (NEW, suite-wide):** `.claude/rules/mental-health.md` — registered in the CLAUDE.md rules index. Behavioral-health rules where the law is **stricter than HIPAA**: 42 CFR Part 2 (SUD), psychotherapy notes, data segmentation/break-the-glass, suicide-risk safety obligations, duty-to-warn/mandatory reporting, Cures Act exceptions, minor/adolescent consent. Core principle: **HIPAA is the floor, not the ceiling.**
**Akima review doc (plain-English, approve/change/hold):** `docs/clinical/MENTAL_HEALTH_COMPLIANCE_REVIEW.md`
**Finding:** The mental-health intervention module (built 2026-10-22, commit `abfa9d9d`) has **10 live `mental_health_*` tables + working code but is ISLANDED** — `/mental-health` route exists but feature flag `mentalHealth` (`VITE_FEATURE_MENTAL_HEALTH`) is unset → defaults `false` → `RouteRenderer` filters the route out; and there is **zero clickable nav link** (only a voice phrase + breadcrumb label). No real user can reach it.
**Blocked on Akima (8 🔒 clinical/legal sign-off items):** 42 CFR Part 2 four open items, duty-to-warn posture, mandatory-reporting/hold scope, psychotherapy-notes handling, minor consent, approved screening instruments + thresholds, break-the-glass posture, pilot state jurisdiction. **Engineering (MH-E1..E8)** — RLS+role gating verify, Part 2 gate wiring, sensitivity labelling, break-the-glass wiring, 988 crisis resources, auto-escalation, then LAST: flag-on + nav link (Tier 3, Maria sign-off) + visual acceptance.
**Estimate:** ~16–24h across 2–3 sessions **once Akima sign-off unblocks it**. Reachability is the last step, not the first.

---

## 🔒 NEW TRACKER (2026-06-09) — Security-Scan Findings (`/security-scan` run)

**Tracker:** `docs/trackers/security-scan-findings-2026-06-09.md`
**Scan result:** **COMPLIANT** — all 6 critical checks passed (PHI logging, RLS, CORS/CSP, secrets, edge-fn auth, JWT). Live DB verified: 681 tables, **658 RLS-enabled (96.6%)**, 23 exceptions all reference/system/metrics (no tenant PHI table missing RLS). 163/163 edge functions authed; 17/17 MCP servers have auth+rate-limit+validation; 0 console/`any`/wildcards/secrets; no `getSession()` in edge fns.
**Gaps to repair (none are compliance violations):**
- **SS-1** — 152 production files > 600 lines. Defers to existing `god-file-decomposition-tracker.md` (update its count; the rule is baselined/aspirational, not enforced).
- **SS-2** — "44% audit coverage" is an artifact of god-file decomposition (helper modules counted as services). Re-measure PHI-touch-specifically via `/audit-check`, don't mass-edit.
- **SS-3** — ✅ **DONE (2026-06-09).** Added per-phone (3/10min) + per-IP (10/10min) rate limiting to `sms-send-code` before the Twilio call; deployed per-function; **live-proven 429 before Twilio (zero SMS)**. Captcha **not needed** — traced the flow: hCaptcha already gates the initial send via `register` (verifies token then calls sms-send-code); only resend + direct-POST paths were open, now rate-limited.
- **SS-4** — ✅ **DONE (2026-06-09).** `chain-orchestrator` clean (authed + tenant-from-caller + manual validation). `community-engagement` SS-4a (low: anon could call a SECURITY DEFINER engagement-score RPC, zero callers) fixed via migration `20260609150000` — revoked anon/PUBLIC execute; live-verified anon=false.
- **SS-5** — ✅ **DONE (2026-06-09, PASS no fix).** SSN never persists to client storage (no localStorage/session/IndexedDB repo-wide) and isn't persisted server-side either — `handleEnrollPatient` drops `ssn` (not in the RPC params or `profiles` updateFields). Held in ephemeral React state during review only. Product note: SSN shown but silently dropped on enroll — Maria/Akima decision if capture is ever needed (must use server-side encryption, not `profiles`).
- **SS-6** — ✅ **DONE (2026-06-09).** Corrected `/security-scan` SKILL.md baselines (681 tables / 17 MCP / 152 god files), broadened Step-6 auth grep (0 false positives now), fixed Step-9 `find` precedence. Tooling now reports real numbers.
**Remaining self-contained repairs:** SS-4, SS-5. **Estimate:** ~2–4h.

---

## 🆕 NEW TRACKER (2026-06-09, Maria-directed) — Equity & Population-Health Analytics Query System

**Tracker:** `docs/trackers/equity-analytics-query-system-tracker.md`
**Gap-closure one-pager (separate, from code-level system analysis):** `docs/system-analysis-gap-closure-2026-06-09.md`
**Goal:** Admin/physician/researcher asks a question **in plain language** → gets an **aggregated chart** (percentages, trends, intersectional cross-tabs by race/ethnicity/language × age/sex × SDOH/zip × clinical). **Never raw rows, never identifiers.**
**Safety spine:** aggregate-only by construction; **no LLM-authored SQL** (Claude fills a whitelisted JSON spec, engine compiles to one parameterized aggregate query); **k=11 small-cell suppression**; **3-digit ZCTA** geography; role-gated + tenant-scoped + audit-logged; **researcher = stricter de-identified tier**.
**Substrate verified live 2026-06-09:** `profiles` is the demographic spine (race/race_omb_categories, ethnicity/ethnicity_omb, gender, dob, zip_code, income_range, insurance_type, sdoh_risk_factors jsonb) + `senior_demographics.preferred_language` + `senior_sdoh`/`passive_sdoh_detections`/`sdoh_goals` + clinical sources (`check_ins`, `readmission_risk_predictions`). Substrate is complete — feature is fully feasible.
**Decisions locked:** interactive query builder + plain-language (both compile to same spec); researcher stricter tier; all 4 dimension families; k=11; 3-digit zip.
**Sessions:** S1 = catalog + safe aggregation engine + suppression (`supabase/functions/equity-analytics/` + `equityAnalyticsService.ts`, live-proven, no-raw-row proof); S2 = NL→spec via claude-chat forced tool_use (Rule #16) + server-side re-validation; S3 = `EquityInsightsDashboard` UI + charts + researcher tier + visual acceptance.
**Open (surface, don't assume):** clinical measure priority list = **Akima**; charting lib = engineering call at S3.
**Estimate:** ~16–48h, 3–4 sessions.

---

## 🛰️ ACTIVE BUILD (2026-06-04, autonomous, Maria-directed) — Guardian ↔ Behavioral-Anomaly Integration

**Tracker:** `docs/trackers/guardian-anomaly-integration-tracker.md`
**Why:** The behavioral-anomaly subsystem (`anomaly_detections` + `behavioralAnalyticsService` + `securityAutomationService`) is BUILT but islanded from Guardian. Maria's directive: *"they need to be included [in Guardian Eyes]."* Confirmed architecture: Detection → `anomaly_detections` → `securityAutomationService` (already imports `guardian-agent/SecurityAlertNotifier`) → `security_alerts` → Guardian (cron + Eyes + Brain). Gap = nothing runs layers 1–2; the table is empty; both services have zero importers.
**Plan (piece by piece, commit each):** GA-1 Guardian *reads* anomaly_detections → security_alerts (Check 5); GA-2 Guardian *persists* server-side PHI-access detection into anomaly_detections; GA-3 e2e live proof (synthetic → detect → record → alert → cleanup); GA-4 admin visibility UI (get_uninvestigated_anomalies, VISUAL ACCEPTANCE PENDING); GA-5 (future) full real-time detection suite + securityAutomationService `anomaly_type`→`event_type` fix + scheduled threshold checks.
**Status (2026-06-05):** ✅ **GA-1 + GA-2 + GA-3 DONE and live-proven.** Wiring uncovered + fixed FOUR pre-existing show-stoppers: (1) `phi_access_logs.records_accessed` never existed → Check 3 was dead → column added via `20260605143400` (Maria-directed: keep accountability, add column); (2) `update_anomaly_retention` trigger referenced `NEW.created_at` → `anomaly_detections` was un-insertable (why it was always empty) → fixed `20260605143500`; (3) `create_alert_from_anomaly` trigger referenced `anomaly_type`/`risk_score`/`details` → fixed same migration + propagates tenant_id; (4) Guardian's alert INSERT never persisted (used `message`/missing `alert_type`/`status:'pending'`) → mapped to real schema + enum extended `20260605143600`. guardian-agent deployed; deno check + 11 deno tests green; drift gates green. **Remaining:** GA-4 UI (pending Maria visual acceptance). **Handed-off separate bugs:** guardian cron 403 "Origin not allowed" (cron checks never run); 3 phi_access_logs writers insert drifted columns. See tracker progress log.

---

## 🟢 SESSION 2026-06-07 (second) — Live-Supabase integration workflow un-blocked + MCP admin key reissued

**The `Integration Tests (Live Supabase)` workflow (`.github/workflows/integration-tests.yml`, `workflow_dispatch` manual-only) was failing on `❌ SUPABASE_URL not set` — the GitHub Actions secrets it maps from were never set. KEY POINT: GitHub Actions secrets are a SEPARATE store from Supabase Edge secrets; "the URL is in Supabase" does NOT make it available to CI.**
- **Secrets wired (GitHub repo → Settings → Secrets → Actions):** `SB_URL` + `SB_PUBLISHABLE_API_KEY` set via `gh secret set` from the codespace (the web UI was blocking Maria); `SB_SECRET_KEY` set by Maria. `MCP_ADMIN_KEY` was already present. Workflow now runs live and gets past the env gate.
- **MCP admin key reissued (Tier-3 DB write, Maria-approved).** Root cause of the 4 admin-server 401s ("Authentication required for tool discovery on admin servers"): the GitHub `MCP_ADMIN_KEY` value no longer matched any active row in `mcp_keys`. `mcp_keys` stores only a SHA-256 fingerprint (raw key unrecoverable), so the old `mcp_cc400238` "Integration Test Key" plaintext was lost. Minted fresh key **`mcp_80da7345` "Integration Test Key (reissued)"** with the same 6 scopes (`mcp:admin,fhir,prior_auth,claude,hl7_x12,edge_functions`); set the GitHub secret silently via `gh` (plaintext never printed to transcript/repo), stored its fingerprint via `execute_sql`, and revoked `mcp_cc400238`. Re-run → **Admin Tools List 5/5 pass** (fhir, prior-auth, hl7-x12, claude, cultural-competency).
- **Fixed 3 stale assertions** in `supabase/functions/__tests__/expanded-coverage-integration.test.ts` — `ai-care-plan-generator` / `send-sms` / `send-email` "validates required fields" expected `400` but the auth-hardened functions now correctly return `401` (auth-before-validation, called with the anon key = no real user). Renamed to "rejects unauthenticated caller" + assert 401 + non-empty error. **NOT a bug — evidence the AI-1-SWEEP / 2026-06-07 auth gates work.** `generate-837p` / `immunization-registry-submit` / `syndromic-surveillance-submit` already returned 400 → left untouched. The 400 validation path needs an authenticated-session fixture → **EQ-9 / `live-integration-testing-tracker.md`**.
- **Legacy-key grep (toward the eventual legacy-key disable):** 0 hardcoded `eyJ…` keys; all 91 edge-fn references + all frontend refs use new-key-primary `getEnv()`/`||` fallback chains. Code is READY. The real gate is env-config (confirm `SB_PUBLISHABLE_API_KEY`+`SB_SECRET_KEY` set in Supabase Edge secrets, `VITE_SB_*` in Vercel) + watching legacy "Last used" in the dashboard go cold for a cron cycle (7–30 days). Disabling legacy API keys ≠ rotating the legacy JWT *signing secret* (the latter signs out every active user — separate, later, zero-downtime migration).

**Caveats:** (1) `integration-tests.yml` is still manual-only (`workflow_dispatch`) — it does NOT gate pushes; re-run by hand after changes. (2) `MCP_ADMIN_KEY` value lives only in GitHub (encrypted) + the DB fingerprint — if ever needed again it must be reissued, not recovered.

---

## 🟢 SESSION 2026-06-06 — Cron-auth closed + MailerSend quota burn stopped + email functions consolidated

**Commits (all on `main`, all live-proven):**
- `5d02ff08` **guardian cron-auth gap CLOSED** — scheduled `guardian-automated-monitoring` was 401-ing at the gateway (`UNAUTHORIZED_INVALID_JWT_FORMAT`): the cron sends the new non-JWT `sb_secret_*` key and guardian-agent wasn't pinned. Fix (Maria's chosen posture): `[functions.guardian-agent] verify_jwt=false` + in-function cron-secret auth (accepts `CRON_SECRET`/`SB_SECRET_KEY`, NOT the legacy JWT key). Real scheduled run flipped **401→200** across the deploy. Migration `20260606120000` gave the `guardian-daily-summary` cron its missing auth header.
- `df1f80b5` **security-alert-processor cron-auth gap CLOSED** (same root cause; its cron read a Vault `cron_secret` that doesn't exist). `verify_jwt=false` + migration `20260606130000` re-points its cron at `vault.sb_secret_key`. Live-proven 200 — cleared a real 2-alert backlog.
- `34285028` **CI MailerSend quota burn STOPPED** — `ci-cd.yml` + `security-scan.yml` emailed on `if: always()` (every push to main = 2 emails to `info@`, pass or fail → blew the MailerSend free monthly cap). Flipped both to `if: failure()`. Recipient unchanged (`info@`; the `maria@` copy is a Google-Workspace forward of `info@`, costs 0 MailerSend quota).
- `9d9b0644` **email functions consolidated + insecure orphan retired** — `send_email` (underscore) was an **unauthenticated, wildcard-CORS email relay** on the verified `.org` domain (source deleted Jan 2026 but never undeployed; only caller was `emergency-alert-dispatch`). Migrated `emergency-alert-dispatch` onto the hardened `send-email` (dash) (adapted payload to its `to:[{email,name}]`+`html` contract; fixed a pre-existing `deno check` logger-type error); **deleted `send_email`** (zero callers, zero live traffic); pinned `send-email`/`send_welcome_email`/`emergency-alert-dispatch` in `config.toml` as `verify_jwt=false`; set Supabase secret **`ADMIN_EMAIL=maria@thewellfitcommunity.org`** (guardian + emergency alerts now reach a real inbox).

**⚠️ Caveats carried forward:** (1) MailerSend is **over its monthly cap** — alerts won't deliver until reset; the CI throttle stops it refilling. (2) A real *emergency* email was NOT test-fired (would send a live alert + burn quota); the wiring is verified via service-key auth probe + `deno check` + healthy boot, but delivery shares the MailerSend cap.

**🚨 NEW TRACKER (next-session priority) — `docs/trackers/edge-function-verify-jwt-reconciliation-tracker.md`.** This session surfaced that **`config.toml` declares `verify_jwt` for only 30 of 168 live functions, while 159 are live-`false` → 129 would flip to `verify_jwt=true` (breaking their cron/webhook/service-key callers) on a bulk `supabase functions deploy`.** Until reconciled: **deploy per-function only, pin `verify_jwt` in `config.toml` first, NO bulk deploy.** Two Maria-approved tasks in the tracker: **#1** reconcile `config.toml` to match live for all 159 (per-function `true`/`false` judgment — NOT blind false; propose any `true` flips for Maria sign-off; done when a live-vs-config diff = 0 mismatches); **#2** build `scripts/edge-function-health-sweep.sh` to ping all 168 and report ALIVE/MISSING/FAILING.

---

## NEXT SESSION — START HERE

> **🔒 SESSION 2026-06-03 — MCP tier-drift gate HARDENED (committed `312b7c7b`).** `scripts/governance-drift-check.sh` now **HARD-FAILS** on any MCP server whose live `SERVER_CONFIG.tier` ≠ its documented S9 tier (was warn-only — wrong for a *security* control, since tier selects anon-key+RLS vs service-key+RLS-bypass). The only accepted gap is an explicit `(target)` annotation in S9 (the reviewed escape valve; the clearinghouse stub uses it). Also fixed a `set -euo pipefail` crash that had silently skipped tier-checking the 5 servers after `mcp-chain-orchestrator`, and corrected two stale S9 rows: `mcp-postgres-server` + `mcp-medical-codes-server` **T3→T2** (doc over-claimed admin; code is the *safer* `user_scoped`+RLS — verified vs each server's `SERVER_CONFIG.tier`). Proven green → (injected mis-tier) → FAIL → green.
>
> **⚠️ A11y/ONC-11 finding — NOT done, needs Maria's sequencing call.** The `[WARN]` accessibility surface is a red herring: `accessibility-test.sh` is a manual browser helper (needs app on `:3000`), **not in CI**. The real CI lever, `eslint-plugin-jsx-a11y`, is **installed but unregistered** in `eslint.config.js` AND currently **throws `minimatch is not a function` under ESLint 9.39**. Enabling it = (1) fix the plugin/ESLint incompatibility, THEN (2) clear the surfaced violation backlog = effectively **ONC-11**. Do not flip it on without sequencing that — it would crash lint / turn CI red against existing debt.
>
> **Open "what's next" candidates (Maria to pick):** (a) adversarial/injection testing — **MCP-3** (40 attack prompts, labeled NEXT in the MCP-chain tracker) or a `pentest` sweep; (b) the drift-baseline triage (the standing marked slot just below); (c) unblock a11y/ONC-11 per the finding above.

> **▶ NEXT SESSION STARTS HERE (updated 2026-06-10, second): continue the `rpc::` drift triage — 11 left of 36.** All 11 remaining are **genuinely Maria/Akima-gated** (no clean engineering-authorable ones left): clearinghouse Vault secrets #12/#36, law-enforcement welfare checks #17/#27 (schema rebuild + sensitive), clinical readmission algo #5, health-equity analytics needing intent #1/#4, deliberately-skipped caching infra #30/#31 (table:: pass), demo seeder #3, `create_fhir_patient_from_profile` table:: deferral #7. **Recommend pivoting** to the **`table::` half** (now scoped — 151 entries, tracker `db-reference-drift-table-pass-tracker.md`) or another tracker, and batching the gated `rpc::` items only once Maria/Akima give the per-item calls. #10/#19/#22/#33 DONE. **`table::` next pickup: the A3 bucket (6 repoint + column-rewrite, per-entry fixes documented in the tracker)** — e.g. `conditions`→`fhir_conditions` (onset_date→onset_datetime, status→clinical_status), the quality-measures cluster. Then `ai_risk_assessments` (14 refs, its own batch). **Do NOT blind-repoint** — the A1 pass proved the targets exist but columns diverge (patient_id↔user_id, FHIR-vs-flat); verify columns per caller. The 4 wrong-target entries (`immunizations`/`clinician_time_tracking`/`daily_check_ins`/`payers`) are B-create and need Maria intent. Tracker `docs/trackers/db-reference-drift-triage-tracker.md` is the airtight spec (per-entry buckets + the VERDICT MAP + two SYSTEMIC FINDINGS). **⚠️ LIVE-VERIFY EVERY BACKING TABLE before authoring (CLAUDE.md #18) — the tracker's table guesses have now been WRONG 5 times** (5 name-collision traps: patient_consents→privacy_consent, clinician_time_tracking→time_clock_entries, behavioral_anomalies→anomaly_detections, documentation_templates→questionnaire_templates). Query `information_schema.columns` first. **Blocked → table:: pass:** `increment_billing_cache_hit`/`increment_cultural_cache_hit` (#30/#31) need `billing_code_cache`/`cultural_content_cache`, both in a deliberately-SKIPPED caching-infra migration — Maria's call before un-skipping. **Open unblocked B-restore candidates** (run the migrate:down forensic + live-verify each): **🔒 Compliance/Akima hold:** `check_sensitive_consent` #6 (42 CFR Part 2 subsystem rebuild — see Batch 13 finding). **table:: pass:** `create_fhir_patient_from_profile` #7 (fhir_patients gone). **Maria sign-off items:** clearinghouse pair #12/#36 (Vault secrets), `calculate_readmission_risk_score` #5 (clinical algo), law-enforcement #17/#27 (sensitive + schema rebuild), `auto_generate_clinical_data_for_hospital_patient` #3 (likely C-dead demo seeder). **B-author analytics** #1/#4/#19/#22 need Maria intent (don't invent algorithms). The 156 `table::` entries come after the rpc half.
>
> **🧭 DRIFT-BASELINE TRIAGE — the standing backlog after 2026-06-02.** Two CI gates now FREEZE the DB-reference perimeter (nothing new can drift in); the backlog is to work DOWN the grandfathered baselines by reachability, removing each entry as it's fixed.
>
> **Source-of-truth files (do not guess — read these):**
> - `scripts/db-reference-drift-baseline.txt` — **196 entries**: 156 `table::<name>` (`.from()` targets absent from live) + 40 `rpc::<name>` (`.rpc()` targets absent from live). Gate: `scripts/check-db-reference-drift.py` (snapshot `scripts/db-objects-snapshot.json`, refresh `scripts/refresh-db-objects-snapshot.sql`).
> - `scripts/fhir-schema-gate-baseline.txt` — **0 entries** (FHIR service layer fully clean; gate `scripts/check-fhir-service-schema.py`).
>
> **How to triage (per entry):** (1) `grep -rn "\.from('<name>')\|\.rpc('<name>')" src supabase/functions --include=*.ts --exclude-dir=__tests__` to find callers; (2) decide the bucket — **(a) legacy/renamed** (e.g. `conditions`→`fhir_conditions`, `daily_check_ins`→`check_ins`, `patients`→`profiles`/`fhir_patients`, `medication_requests`→`fhir_medication_requests`): repoint the caller to the real object + live round-trip; **(b) genuinely missing but needed**: CREATE via migration (`db push`, NOT MCP) — see the `fhir_goals`/SOC/note-locking precedents this session; **(c) dead code**: confirm 0 reachable importers, then it can stay baselined or the dead service removed (Tier-3, ask). (3) Remove the entry from the baseline + re-run the gate. **Safety-critical RPCs are already fixed** (med-allergy fail-open `73df04a7`, SOC `bce63b8f`, note-locking `5502346b`); what remains is mostly harmless legacy names. Start with the `rpc::` half (40 — smaller, higher signal) before the 156 tables. **Litmus test:** a fresh Claude can pick one baseline line and execute the triage above without asking questions.

> **🚨🩺 NEW TOP PRIORITY (2026-06-01) — CLINICAL-LOGIC ADVERSARIAL AUDIT. Tracker: `docs/trackers/clinical-logic-adversarial-audit-2026-06-01.md`.** A 4-reviewer adversarial sweep of the clinical layer found real, lead-verified patient-safety defects. **The clinical layer is NOT pilot-ready until Tier 0 is fixed.** 5 CRITICALs verified against the live DB + code: (AV-1) `AllergyIntoleranceService` selects columns that don't exist in live `allergy_intolerances` (PK is `user_id`, not `patient_id`) → `/allergies` page throws → swallowed error reads as **"no known allergies"**; (AV-2) `fhir_medications` table doesn't exist → `MedicationService` dead; (AV-3) `ConditionService` selects nonexistent `category_code`/`code_code`; (AV-4) `check-drug-interactions` severity rank omits `contraindicated` → most dangerous class ranks lowest; (AV-5) `ai-care-escalation-scorer` `|| 0`/`|| "none"` fail-unsafe discards rule-based critical-vitals score. ~25 more credible agent-reported findings (fail-open drug cache, holistic-risk dilution math, NaN-lab-as-normal, incomplete CQM engine that can report >100%) in the tracker, marked verified-vs-reported. **Remediation IN PROGRESS — Tier 0 first.** The recently-built FHIR services (MedicationRequest/Observation/ServiceRequest/Immunization) audited CLEAN — drift is in the older services. Proposed Tier-1 regression guard: `check-fhir-service-schema.sh` (FHIR analogue of the new `check-edge-sdk-hygiene.sh`).
>
> **UPDATE 2026-06-02 (session 2): Tier 0 FULLY CLOSED + the regression gate is BUILT.** Remaining Tier-0 items landed and deployed: med-safety cache poisoning + fail-open cache read + AI severity-downgrade + NKDA-on-error + contraindication NaN-lab (`be2eceb1`), and fall-risk null-DOB under-triage (`ae4c30b0`, v17). The Tier-1 gate shipped as **`scripts/check-fhir-service-schema.py`** (committed snapshot + baseline + refresh SQL; wired into CI Governance Boundary Check) — `b7935d47`. It immediately surfaced **10 pre-existing drifts the 4-reviewer audit missed**: 6 lead-verified column drifts (MedicationRequest `dosage_route`; Practitioner `fhir_id`+`full_name`; Immunization `fhir_id`; PractitionerRole `fhir_id`; CareTeam `fhir_id`) and **4 dead services querying non-existent tables (`fhir_goals`/`fhir_locations`/`fhir_organizations`/`fhir_provenance`)**. **Tier-1 schema-drift repair (Maria-directed 2026-06-02 — CREATE migrations, NOT service deletion):** ✅ **the 4 missing tables are now CREATED** — migration `20260602210000` adds `fhir_goals`/`fhir_provenance` (patient PHI, RLS like `fhir_conditions`) + `fhir_locations`/`fhir_organizations` (catalog, RLS like `fhir_medications`); applied via `db push`, all 4 service query shapes live-proven, snapshot refreshed (27 tables), baseline down to 6. ✅ **the 6 column drifts are now FIXED too (2026-06-02):** all phantom columns removed from their SELECTs (MedicationRequest `dosage_route`; Practitioner `fhir_id`+`full_name`; Immunization `fhir_id`; PractitionerRole `fhir_id`; CareTeam `fhir_id`) + the matching type drift (`FHIRPractitioner`/`FHIRImmunization`/`FHIRPractitionerRole`/`FHIRCareTeam` now `Omit<FHIRResource,'fhir_id'>`). Live-proven, full `tsc` 0, lint 0, 150 service tests green. **Gate baseline is now EMPTY — FHIR service layer fully schema-clean.** With this, the entire clinical-audit Tier-1 schema-drift class is closed and guarded by `check-fhir-service-schema.py`. Remaining audit work is Tier 2/3 (AI-scoring hardening + CQM correctness). 
>
> **DB-reference drift gate BUILT (2026-06-02, "#2"):** `scripts/check-db-reference-drift.py` (committed snapshot `db-objects-snapshot.json` of all 753 live tables + 1444 functions; refresh via `refresh-db-objects-snapshot.sql`; wired into CI Governance Boundary Check). It freezes the whole `.from()`/`.rpc()` perimeter — **196 pre-existing drifts baselined** (156 missing tables + 40 missing RPCs, mostly legacy/renamed names) and NO new drift can land. Triage the baseline by reachability next (the safety-critical RPCs already fixed).

> **🔧 Two CI fixes + an SDK-hygiene gate shipped 2026-06-01** (commits `513a34ed`, `de4d8585`, `9a8df610`; full pipeline green). Fixed a vitest critical CVE + a claude-chat Deno type error (RF-8). Added `scripts/check-edge-sdk-hygiene.sh` (wired into CI) — pinned all 4 Anthropic-SDK edge fns to `0.39.0`, added 3 to the Deno type-check gate, and fixed 4 latent edge-fn bugs the new coverage exposed. Supabase 8-version sweep + Gates 2/3 deferred → `docs/trackers/edge-sdk-hygiene-tracker.md`. **RF-8's claude-chat is now on 0.39.0 — the pending deploy note below still applies (deploy `claude-chat`).**

> **⏸️ UNCOMMITTED (awaiting Maria's visual acceptance): ONC-11/13 work** — SkipLink wired into RootLayout, axe-core harness + `test:a11y`, label sweeps on CheckInFormBody + HealthMetricsForm, 2 a11y tests, ONC matrix (`docs/compliance/ONC_170.315_CERTIFICATION_MATRIX.md`). Commit after Maria tabs through the skip link.


> **🔔 PENDING DEPLOY (RF-8) — `npx supabase functions deploy claude-chat`.** The `claude-chat` edge fn was updated to forward `tools`/`tool_choice` for structured risk-assessment output (commit `3fddcd67`). The change is additive/backward-compatible and committed, but **not yet deployed**. Until it is, `analyzeRiskAssessment` (live on RiskAssessmentForm) **fails safe** to a low-confidence "manual review" result — correct but non-functional for the structured path. Deploy via CLI (not MCP — claude-chat has `_shared` deps the CLI bundles automatically; it proxies ALL Claude traffic so don't risk a hand-bundled deploy). After deploy, verify with an authenticated admin on the Risk Assessment form. Tracker: `god-file-refactor-findings-tracker.md` RF-8.

> **🔎 NEW TRACKER (2026-06-07) — `docs/trackers/engineering-quality-findings-2026-06-07.md`.** Maria asked for an honest code-level (not docs) review. A 2-agent sweep + lead verification produced 17 findings (EQ-1…EQ-17), labeled **[verified]** vs **[reported]**. **Two already FIXED this session in `ai-readmission-predictor`:** EQ-1 silent-zero risk inputs (each source now reports failure via `dataCompleteness`, no more degraded-zero-as-"no-risk") and EQ-2 rate limiting (`checkRateLimit(user.id, RATE_LIMITS.AI)`). ⏳ both await live proof (deno not installed locally). **Top open items:** EQ-3 **`ai-soap-note-generator` has NO enforced auth** — its `getUser` is style-lookup only, never rejects (Tier 3, needs Maria's OK to add the §2 gate + sweep all `ai-*`); EQ-9 **the over-mocked tests Maria flagged** — ~30% mock the whole Supabase client so no test hits a real DB → add a live-integration layer, don't delete mocks (ties to `live-integration-testing-tracker.md`); EQ-5 rate-limit the other 27 `ai-*` functions; EQ-6 rate-limiter check-then-insert race. **Sweep RAN 2026-06-07:** all 29 ai-* functions DO have an enforced auth gate (most via the shared `requireUser()` helper from a prior AI-1-SWEEP — the earlier "~28 exposed" claim was WRONG, retracted); the real gap is **rate limiting (2/29)** + **authZ depth on 10 functions** (authN-only, need per-function patient/tenant gate review — EQ-5b). Sweep commands + acceptance in the tracker.

> **🚨 Read CLAUDE.md Commandment #21 first.** "DONE MEANS DONE" is the second-highest-value rule in this codebase as of 2026-05-28. The scoped workflow MUST work end-to-end for a real user — compiles + tests pass + persists + reachable + audited — before calling a task done. Filing a defect as a "follow-up" = not done. The new rule is enforced because ONC-1 and ONC-2 were initially declared "done" while neither could submit (RLS rejected the payload) and neither had nav links. Maria caught it. Don't re-do that mistake.

> **🎯 NEXT SESSION STARTS HERE: ONC Tier 2 FULLY CLOSED + Guardian Session 2 FULLY CLOSED (9/9).** Open options: ONC Tier 3 (ONC-11 WCAG AA audit + ONC-13 Drummond evidence matrix), MCP-3 adversarial testing, or **continue god-file decomposition** (Tier 1 top-10 services ALL done 2026-06-01; next would be the 800–999 line band of services, or F1 `EnterpriseMigrationDashboard.tsx` 931 — but that one is UI/patent-tied and needs Maria's visual acceptance, so confirm before decomposing it). Decomposition pattern is well-established now: extract by responsibility into a `<dir>/`, barrel/re-export the full public surface from the original path, verify with the existing test suite + scoped typecheck + lint.

> **ccda-export — DONE (2026-05-29).** Decomposed 836-line `ccda-export/index.ts` into 6 modules <600 (index/types/helpers/sections/document/queries; max 469). Replaced all 9 bare `select('*')` with EXPLICIT column lists (§9) verified against live `information_schema`. **Rule #18 caught 3 real schema-drift bugs, all silently broken before** (masked by `select('*')` + optional chaining + fallbacks): (1) `fhir_observations` code read `value_quantity`/`value_unit`; live columns are `value_quantity_value`/`value_quantity_unit` → vitals always rendered "0"; (2) `fhir_observations.category` is `text[]` so `.eq('category','vital-signs')` matched ZERO rows — fixed to `.contains('category',['vital-signs'])`; (3) `lab_results` code read `extracted_at` which does not exist → fixed to `result_date`. ONC-10 (d)(7)/(d)(8) integrity wired via `_shared/integrityHash.ts`: SHA-256 over the XML, RFC 3230 `Digest` header + `X-Integrity-Algorithm` + integrity block in JSON body. 9 new behavioral deno tests (import the real modules — deletion-test passing) + corrected 2 stale fixtures in `index.test.ts`. **No migration needed** (ccda returns XML inline, no export_jobs persistence). deno check clean, deno test 9/9, deployed (94.46kB). Live proof: unauth→401, bogus token→401, and the corrected vitals query returns real data live (BP 138/85, HR 72) the old code dropped to zero.

### ONC Certification — Tier 1 ✅ 5/5 + Tier 2 ✅ 6/6 COMPLETE (ONC-6/7/8/9 + ONC-10 FHIR, bulk & ccda paths all done)

**Tier 1 (Session 1) — COMPLETE:**
- **ONC-4** (a)(5) Race & Ethnicity — DONE. `bff477f6`.
- **ONC-1** (a)(1) Medication CPOE — DONE. `71be44c4` + `a25e0c71`.
- **ONC-2** (a)(2) Lab CPOE — DONE. `40cfec3f` + `a25e0c71`.
- **ONC-3** (a)(3) Imaging CPOE — DONE. `894b6aea`.
- **ONC-5** (a)(14) Implantable Device List — DONE. `894b6aea`.

**Tier 2 (Session 2) — 3 of 5 done this session (`a117d999`):**
- **ONC-6** (a)(9) CDS interaction alerts — DONE for MedicationOrderForm. `InteractionAlertModal` + `useMedicationOrderSubmit` hook orchestrates validate → CDS check → modal → persist. Contraindicated severities require typed override reason; HIGH allows one-click override. `CDS_INTERACTION_OVERRIDE` audit log entry fires AFTER successful persist with override reason + blocking severities. CDS-endpoint soft-fail (a 503 must not block care). 6 behavioral tests.
- **ONC-7** (a)(10) Drug formulary check — DONE. `FormularyService.lookupByNdc()` + `summarizeFormulary()` maps DB CHECK constraint values to UI levels (preferred/covered/non_formulary/unknown). NDC field on MedicationOrderForm with color-coded status banner. NDC is captured for lookup ONLY — NOT persisted on FHIR MedicationRequest (no `ndc_code` column on `fhir_medication_requests`, verified via information_schema). 5 test formulary rows seeded under non-routable `TEST-FORMULARY` BIN (Lisinopril/Metformin/Atorvastatin preferred, Eliquis prior_auth, Humira step_therapy). 12 service tests + 5 form tests.
- **ONC-10** (d)(7)/(d)(8) Data integrity — DONE for `enhanced-fhir-export`. New shared helper `_shared/integrityHash.ts` (FIPS-correct SHA-256, 11 Deno tests). Sets RFC 3230 `Digest: sha-256=<base64>` header + `X-Integrity-Algorithm: SHA-256`. Migration `20260528130000` adds `sha256_hex` + `integrity_algorithm` columns to `export_jobs` for when bulk-export wiring lands.
- ✅ **ONC-10 bulk path — DONE** (`ad1d4c0a`). `bulk-export/index.ts` (868 lines) decomposed into 6 modules <600 (index/types/csv/fhirBundle/exportQueries/exportProcessor) + `_shared/exportColumns.ts`. SHA-256 (`sha256_hex` + `integrity_algorithm`) persisted on the job. Repaired the export_jobs schema drift (6 nonexistent columns → added in `fb8642c7`). All 4 bare `select('*')` replaced by runtime `get_exportable_columns` resolution. deno check clean, deployed, live rolled-back INSERT/UPDATE proof.
- ✅ **ONC-10 ccda path — DONE** (2026-05-29). `ccda-export/index.ts` (836 lines) decomposed into 6 modules <600 (index/types/helpers/sections/document/queries). Explicit SELECT columns (§9) replacing 9 bare `*`. **Rule #18 verification caught 3 latent schema-drift bugs** (observations `value_quantity_value`/`value_quantity_unit`, observations `category` text[] needs `.contains()` not `.eq()`, lab_results `result_date` not `extracted_at`) — all fixed and live-proven. SHA-256 integrity (Digest header + body) via `_shared/integrityHash.ts`. No migration (returns XML inline). deno check clean, 9 new behavioral tests, deployed + live-proven. **ONC Tier 2 now fully closed.**
- ✅ **ONC-8** (a)(12) FHIR FamilyMemberHistory — DONE (`72d4e0ed`). Parent+child tables (CASCADE), 2 services, decomposed `FamilyHistoryPanel` + page + route `/admin/family-history/:patientId` + chart nav card. 14 tests. Live FK+CASCADE round-trip verified. **Visually accepted by Maria 2026-05-29.**
- ✅ **ONC-9** (d)(6) Break-the-glass — DONE (`1f4d50c9` + `92f135e6`). `BreakTheGlassModal` (reason+duration, grant/revoke) on the patient-chart Overview + new accessor-gated `notify-emergency-access` edge fn (deployed). 8 modal + 5 service tests; live grant+revoke round-trip verified. **Visually accepted by Maria 2026-05-29.**
- ✅ **Role self-escalation security fix + assignRole RPC wiring** (`01eb0b87`/`9db8fc87`/`519ebe42`) and **MCP migration-drift hook** (`6f3dff1e`) — see the session summary at the top.

**Deno typing-debt cleanup (this session):**
- `_shared/supabaseClient.ts`: `batchQueries` and `sequentialQueries` rewritten to use a tuple-inferring generic (`Q extends readonly (() => PromiseLike<unknown>)[]` returning `{ -readonly [K in keyof Q]: Awaited<ReturnType<Q[K]>> }`). `PromiseLike` widening lets PostgrestFilterBuilder thenables satisfy the parameter type without breaking Promise.all at runtime. Cleared all 18 Deno errors and revealed 6 latent `string | undefined` bugs in `pdf-health-summary/index.ts` (VitalReading.date set from possibly-undefined Supabase fields) — those are now guarded by skipping incomplete vital readings rather than rendering bad data.

### Session A of the API-3 plan COMPLETE — earlier in the same session

AI-1-SWEEP and CR-2-SISTER-1..4 also closed (commits `721640fb` + `f6b48729`, both 2026-05-27). Pick up at one of the candidates below.

**Status snapshot (self-audit tracker — `docs/trackers/claude-self-audit-2026-05-20-tracker.md`):**
- Sessions 1–5 complete (22 items)
- Session 6 wave 1 complete (9 items: CR-1, CR-2, CR-7, G-1, G-3, G-4, API-2, API-5, API-6)
- **Session 6 wave 2 (API-3 Session A) COMPLETE: API-3a through API-3g (7 items)** — `api_keys` is at feature parity with `mcp_keys`, validation RPC is live, UI wired, tests in place
- **Session 6 wave 3 (sister bugs) COMPLETE: G-3-SISTER-1, G-3-SISTER-2, G-3-SISTER-3** — all use the escapeHtml fragment-builder pattern from the original G-3 fix (SISTER-3 in `emergency-alert-dispatch` was newly discovered by widening the Rule #1 grep)
- **Session 6 wave 4 (CR-2 sister bugs) COMPLETE: CR-2-SISTER-1/2/3/4** — `_shared/modelFallback.ts` deleted as orphan; `peerConsultAnalyzer.ts`, `consultationAnalyzer.ts`, `triageTools.ts` migrated to forced tool_use per Rule #16
- **Session 6 wave 5 (AI-1-SWEEP) COMPLETE: 5 cross-user PHI exposures closed** in `ai-contraindication-detector`, `ai-caregiver-briefing`, `ai-missed-checkin-escalation`, `ai-treatment-pathway`, `ai-care-plan-generator` — all gated through new `requirePatientAccess()` helper in `_shared/auth.ts`
- **Total: 50/55 DONE**

**ROADMAP — TWO ACTIVE PRIORITIES RIGHT NOW (Maria confirmed 2026-05-28):**

> Only two things are active: **finish ONC, then finish Guardian.** Everything else (god-file decomposition, API-3 Session B, Nephrology, SOC 2, MCP Chain, Avatar) is BACKLOG until both land.

**Priority 1 — Finish ONC Tier 2 — ✅ DONE this session (ONC-8 + ONC-9 landed).** The only ONC Tier 2 item left is ONC-10's `bulk-export`/`ccda-export` SHA-256 integrity wiring, which is **blocked on decomposing those two god files** (868 + 836 lines, pre-existing SELECT * the pre-commit gate won't pass). So the next ONC step IS the bulk/ccda god-file decomposition (see BACKLOG below) — that single slice is on the ONC critical path. After that, Tier 3 (ONC-11 WCAG audit, ONC-13 evidence matrix). **Outstanding before calling ONC-8/ONC-9 fully done: Maria's visual acceptance of the two new UIs.**

**Priority 2 — Finish Guardian Agent Session 2 (GRD-6 through GRD-9, ~10h):**
- GRD-6 Eyes→approval wiring, GRD-7 `guardian_flow_config` migration, GRD-8 guardian-pr-service keep/wire/remove decision (needs Maria), GRD-9 full end-to-end integration test. Full detail in the **PRIORITY 2 — Guardian** section below.

**BACKLOG — God-file decomposition (was the prior #2; superseded by Guardian per Maria 2026-05-28):**

Still the next major refactor focus once the two priorities land. Concrete data point from the ONC Tier 2 Session A commit (`a117d999`): `bulk-export/index.ts` (868 lines) and `ccda-export/index.ts` (836 lines) BOTH blocked finishing ONC-10 because the pre-commit gate refuses to let any touched god file ship with pre-existing SELECT * violations. Until they're decomposed, any feature work that needs to touch them stalls.

Pattern (already established in this codebase — today's `useMedicationOrderSubmit` extraction did exactly this):
```
ComponentName/
  index.tsx                 ← orchestrator (barrel re-export)
  ComponentName.types.ts    ← shared types
  SubComponent.tsx          ← extracted concerns
  useComponentLogic.ts      ← extracted state/logic hook
  __tests__/                 ← tests
```
External callers still `import { ComponentName } from '.../ComponentName'` — the barrel `index.tsx` makes the decomposition invisible to consumers.

**Suggested prioritization** (different from the tracker's listed order, based on actively-observed blockage — not theoretical):
1. **`bulk-export/index.ts` + `ccda-export/index.ts`** — already blocked ONC-10 wiring. Decomposing these UNBLOCKS the deferred integrity work AND removes 10 SELECT * violations each. ~6-8h total.
2. **`EnterpriseMigrationDashboard.tsx`** (931 lines, F1 priority on tracker) — biggest single file; patent-tied IP, deserves clean structure. Not actively blocking but the tracker has it as F1.
3. **The other ~161 files** — incremental, lowest priority first if no active features touch them.

Tracker: `docs/trackers/god-file-decomposition-tracker.md` (163 src/ + 21 edge function files >600 lines, per the snapshot in the Active Tracker Index below).

**Also in BACKLOG — other open trackers (all below the two active priorities):**

1. **API-3 Session B** (Maria's scope decisions needed first) — API-3h–l: scopes JSONB column + expires_at + scope-aware validation + generate-api-key RPC + UI scope/expiration selectors. ~5h once unblocked. Open questions in the tracker:
   - **Scope vocabulary** — probable starter: `fhir.read.own_patients`, `webhook.subscribe`, `referral.write`. Confirm against actual partner use case.
   - **Expiration default** — 90 days or 1 year from `created_at`?

2. **Sweep the remaining `?target=deno` SDK drift** — AI-1-SWEEP's commit message notes 103 other edge functions still import `https://esm.sh/@supabase/supabase-js@2` without `?target=deno`. No security implication; hygiene only. ~1–2h.

5. **Pivot to a fresh tracker:** Guardian Agent Session 2 (GRD-6/7/8/9, ~10h), MCP-3 adversarial testing (~8h), Nephrology pilot Phase 1 sessions.

**Important context for next session:**
- Origin/main is fully synced as of 2026-05-28 (no unpushed local commits as of this write)
- `api_keys` table is empty in production (0 rows) — schema changes were non-destructive
- Three HIGH-severity npm advisories closed via `package.json` `overrides` (js-cookie@^3.0.7, tmp@^0.2.6, uuid@^11.1.1) — parents NOT downgraded; codebase only uses `useWindowSize` from `react-use`, no js-cookie coupling
- Pre-commit gate now correctly exempts `TO service_role` policies from the audit-table `WITH CHECK (true)` rule — per-block awk parse, won't mask a real violation if a user-facing policy in the same file also uses `WITH CHECK (true)`
- The older 36-test file at `src/components/admin/__tests__/ApiKeyManager.test.tsx` had been silently failing CI since the API-2 decomposition commit (5032cf08, 2026-05-27) — fixed in API-3g commit by adding the 4 tracking columns to the mock rows and updating the "total usage" assertion from `'0'` to `'49'`

**Headline finding (still true):** MCP server infrastructure is the strongest layer in the codebase by a wide margin — order-of-magnitude lower defect density than application features. **Lead the Anthropic pitch with the MCP architecture story, not the feature list.** See [project_mcp_protocol_governance.md](../memory/project_mcp_protocol_governance.md).

**Session 1–4 surface findings worth surfacing:**
- 2 new CRITICAL exposures were caught by the gate we built this session (CRIT-1 Anthropic key in .env files; CRIT-2 MailerSend key in browser bundle via emailService) — both now closed.
- 2 sister bugs of AI-1 cross-user PHI access were found by Rule 1 grep and fixed (`ai-nurseos-stress-narrative`, `ai-nurseos-module-recommendations`). 6 more third-degree candidates filed for sweep next session (AI-1-SWEEP).
- B-1 verified: live RLS on `provider_burnout_assessments` is already correctly scoped — repo migration files don't reflect that. Source-of-truth drift filed as DRIFT-1.

---

## BACKLOG — Claude Self-Audit Remediation (50/55 DONE)

**Tracker:** `docs/trackers/claude-self-audit-2026-05-20-tracker.md`
**Status:** Sessions 1-5 complete (22 items). Session 6 wave 1 complete (9 items: CR-1, CR-2, CR-7, G-1, G-3, G-4, API-2, API-5, API-6). Session 6 wave 2 = **API-3 Session A complete** (7 items: API-3a–g). Session 6 wave 3 = **3 G-3 sister bugs complete** (G-3-SISTER-1/2/3). Session 6 wave 4 = **4 CR-2 sister bugs complete** (CR-2-SISTER-1/2/3/4, commit `f6b48729`). Session 6 wave 5 = **AI-1-SWEEP complete** (5 functions, commit `721640fb`). Total **50/55**. **Next: API-3 Session B (blocked on Maria's scope/expiration call), `?target=deno` SDK-drift hygiene sweep, or pivot trackers — see "NEXT SESSION" above.**
**Newly filed during 2026-05-27 / 2026-05-28 sessions:** CRIT-1, CRIT-2, AI-1-SISTER-1, AI-1-SISTER-2, AI-1-SWEEP, DRIFT-1, UI-MISSING-ROUTES-1, RPC-SEARCH-PATH-1, G-3-SISTER-3 (caught by widened Rule #1 grep), CR-2-SISTER-1, CR-2-SISTER-2, CR-2-SISTER-3, CR-2-SISTER-4
**Live DB migrations applied via MCP across these sessions:** `bulk_nurse_review_handoff_risks_rpc` (SH-1), `burnout_thresholds_tenant_config` (B-6), `documentation_templates_richer_fields` (T-4), `fix_mcp_audit_logs_rls` (M-4), `handoff_emergency_bypasses_rebuild` (SH-3/4 + DRIFT-2), `fix_api_keys_rls_with_check` (API-3a), `add_api_keys_tracking_columns` (API-3b), `create_api_key_audit_log` (API-3c), `create_validate_api_key_rpc` (API-3d).

### Session 1 — Critical Security: PHI Key + Webhooks (~13h, 5 items)
- **S-PHI-1** — Move PHI master key out of browser; build `phi-crypto` edge function
- **S-PHI-2** — Migrate all callers from direct crypto to edge function via new `phiCryptoService.ts`
- **S-WH-1** — Withings webhook HMAC-SHA256 signature verification
- **S-WH-2** — Garmin webhook OAuth signature verification
- **S-WH-3** — Codebase-wide sister-bug sweep for other unauthed webhooks

### Session 2 — Perimeter + CI Enforcement (~5h, 6 items)
- **S-OBS-1** — Triage `VITE_PILLBOX_API_KEY` / `VITE_WEATHER_API_KEY` (proxy if real secrets)
- **S-CI-1** — CI gate enforcing 600-line file limit (makes god-file tracker mechanically enforceable)
- **S-CI-2** — CI gate blocking new `VITE_*` secret-name patterns
- **S-HK-1** — Delete junk files from repo root
- **S-HK-2** — ✅ RESOLVED (2026-06-19) — `nodemailer` is declared-but-unused (email = MailerSend edge fns); bumped `^8.0.7 → ^9.0.1` to clear HIGH advisory GHSA-p6gq-j5cr-w38f. Not imported anywhere in active code → never reaches the browser bundle.
- **S-HK-3** — Document legacy JWT key cutover plan

### Session 3 — Feature Critical Bugs (~6.5h, 4 items)
- **T-1** — Template Maker insert omits `tenant_id` (CRITICAL — templates may be invisible)
- **AI-1** — AI Burnout Advisor allows cross-user data access (CRITICAL — auth without authorization)
- **SH-2** — Shift Handoff narrative accepts caller-supplied `tenantId` (cross-tenant via Claude)
- **B-1** — Verify `provider_burnout_assessments` tenant RLS policy (possible privacy regression)

### Session 4 — Feature High Priority (~10.75h, 7 items)
- **B-2** — AdminBurnoutRadar divide-by-zero (NaN cascade)
- **B-3** — AdminBurnoutRadar `window.location.href` SPA-killer
- **T-2** — Template Maker 988-line god file decomposition
- **T-3** — Verify template renderer is XSS-safe
- **AI-2** — AI Burnout Advisor — add Anthropic structured-output schema (CLAUDE.md Rule #16)
- **AI-3** — AI Burnout Advisor — add rate limiting (cost amplification protection)
- **SH-1** — Shift Handoff `bulkConfirmAutoScores` needs server-side ownership RPC

### Session 5 — Polish + MCP Hardening (~13.75h, 12 items)
- **M-1** — Audit MCP servers for in-memory vs persistent rate-limiter usage
- **M-2** — Verify MCP `protocolVersion` string is current
- **M-3** — Audit log triple-failure alerting
- **M-4** — Verify RLS on `mcp_audit_logs` and `mcp_key_audit_log`
- Plus B-4 through B-6, T-4, T-5, AI-4, SH-3, SH-4 (feature polish)

### Session 6 — Compass Riley + Guardian + ApiKeyManager (~14.35h, 10 items)
- **CR-1** — Codebase-wide shadow-import sweep (7+ edge functions) + CI gate
- **CR-2** — Compass Riley structured-output migration
- **CR-7** — V2 reasoning + WS auth integration test (TDZ bug went 80 days undetected because no test covered this path)
- **G-1** — Guardian `SELECT *` cleanup on monitoring queries
- **G-3** — Guardian HTML email body escape
- **G-4** — Guardian `Math.max(...arr)` stack overflow risk
- **API-2** — ApiKeyManager god-file decomposition (940 lines)
- **API-3** — ApiKeyManager fake usage_count/last_used — implement tracking OR remove
- **API-5, API-6** — ApiKeyManager polish (deprecated substr, aggressive Date.parse)

### Acceptance Criteria (Session 1 — all must return 0)
```bash
grep -rn "VITE_PHI_ENCRYPTION_KEY" src --include="*.ts" --include="*.tsx" | wc -l
grep -rn "crypto.subtle.encrypt\|crypto.subtle.decrypt" src --include="*.ts" --include="*.tsx" | grep -v "__tests__\|.test." | wc -l
```

### Acceptance Criteria (Session 3 — verify first, then fix)
```sql
-- T-1: any templates with NULL tenant?
SELECT COUNT(*) FROM documentation_templates WHERE tenant_id IS NULL;

-- B-1: does the tenant policy enforce a role check?
SELECT qual FROM pg_policies WHERE tablename = 'provider_burnout_assessments' AND policyname = 'provider_burnout_assessments_tenant';
```

---

## PRIORITY 1 — ONC 170.315 Certification Gap Closure (8/13)

**Tracker:** `docs/trackers/onc-certification-tracker.md`
**Status:** **8/13 ACTUALLY DONE end-to-end** (Tier 1: ONC-1, ONC-2, ONC-3, ONC-4, ONC-5; Tier 2 Session A: ONC-6, ONC-7, ONC-10 for the FHIR Bundle path). **Tier 2 Session A landed `a117d999`.** Remaining: ONC-8, ONC-9 (~10h), ONC-10 wiring for bulk + ccda (blocked on SELECT * decomp), ONC-11 + ONC-13 (Tier 3, ~10h), ONC-12 (Surescripts, vendor-blocked).
**Estimated total:** ~57 hours across 3-4 sessions (~18h remaining of buildable work + Tier 3 polish)
**ACB:** Drummond Group (Austin) recommended — $70-130K budget

### What's Already Certified-Ready (27+ criteria)
All (b)(1-2), (b)(6-7), (b)(10), (c)(1-3), (d)(1-5), (d)(9), (d)(12-13), (e)(1-3), (f)(1-2), (f)(4-5), (f)(7), (g)(4), (g)(6-10), SAFER (9/9), USCDI v3 (18/18), EPCS, (a)(4), (a)(6-8) — **no work needed, code complete.**

### Session Plan

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| **1** | CPOE forms (meds, lab, imaging) + demographics (race/ethnicity) + implantable device list | ONC-1 through ONC-5 | ~32 | **5 of 5 DONE ✅** |
| **2** | CDS integration into CPOE + formulary activation + family health history + break-the-glass + data integrity | ONC-6 through ONC-10 | ~19 | **3 of 5 DONE** (ONC-6, ONC-7, ONC-10 for FHIR Bundle) |
| **3** | WCAG AA accessibility audit + Surescripts prep + ONC compliance matrix document | ONC-11 through ONC-13 | ~10 | PENDING |

### Tier 1 Blockers (Session 1) — actual end-to-end status — COMPLETE

- ✅ **ONC-4** (a)(5) Race & Ethnicity — DONE. Migration `20260528094350` applied. OMB 1997 multi-race + Hispanic/Latino ethnicity captured via `BasicDemographicsStep.tsx`. Persists to `profiles.race_omb_categories` + `profiles.ethnicity_omb`. Reachable via existing `/demographics` flow. Audit-logged. 29 tests behavioral, all green. Commit `bff477f6`.
- ✅ **ONC-1** (a)(1) Medication CPOE — DONE end-to-end. Persists to `fhir_medication_requests` with `tenant_id` + `requester_*` populated via `useOrderingProvider`. Reachable from `PatientChartNavigator` → "New medication order" card. Server-side allergy check. Commits `71be44c4` + `a25e0c71`.
- ✅ **ONC-2** (a)(2) Lab CPOE — DONE end-to-end. Persists to `fhir_service_requests` with `category=['laboratory']`. Same `useOrderingProvider`. Reachable from `PatientChartNavigator` → "New lab order" card. Migration `20260528102906` + RLS fix `20260528104213`. Commits `40cfec3f` + `a25e0c71`.
- ✅ **ONC-3** (a)(3) Imaging CPOE — DONE end-to-end (this session). Persists to `fhir_service_requests` with `category=['imaging']`. Modality (DICOM), body site (SNOMED), laterality, contrast. `ImagingOrderForm` mirrors lab form pattern. Route `/admin/cpoe/imaging/:patientId`. 3rd card on PatientChartNavigator. 18 behavioral tests. Live-DB round-trip verified.
- ✅ **ONC-5** (a)(14) Implantable Device List — DONE end-to-end (this session). Migration `20260528120000_create_fhir_devices.sql` applied via Supabase MCP. New tables `fhir_devices` + `fhir_device_use_statements` with RLS (INSERT WITH CHECK tenant_id, UPDATE both USING + WITH CHECK). `DeviceService` + `DeviceUseStatementService`. Decomposed UI: `ImplantableDevicesPanel` (orchestrator) + `AddDeviceForm` + `DeviceListView`. Route `/admin/devices/:patientId`. New "Patient records" section on PatientChartNavigator. 16 behavioral tests. Live-DB round-trip verified (Device + DUS pair with CASCADE delete).

### Tier 2 (Session 2) — actual end-to-end status

- ✅ **ONC-6** (a)(9) CDS interaction alerts — DONE for MedicationOrderForm. `InteractionAlertModal` + `useMedicationOrderSubmit` hook gate the submit pipeline on drug-interaction severity. Contraindicated requires typed override reason; HIGH allows one-click override. Audit log entry `CDS_INTERACTION_OVERRIDE` after persist. CDS-endpoint soft-fail (a 503 must not block care). 6 behavioral tests. Commit `a117d999`.
- ✅ **ONC-7** (a)(10) Drug formulary check — DONE. `FormularyService.lookupByNdc()` + `summarizeFormulary()`. NDC field on MedicationOrderForm with color-coded status banner (preferred/covered/non_formulary/unknown). 5 test formulary rows seeded under `TEST-FORMULARY` BIN. 17 tests. Commit `a117d999`.
- ⬜ **ONC-8** (a)(12) Family health history — TODO (~6h). Same shape as ONC-5: new `fhir_family_member_history` table + `FamilyMemberHistoryService` + decomposed UI panel + page wrapper + route + chart nav card.
- ⬜ **ONC-9** (d)(6) Break-the-glass emergency access — TODO (~4h). New `emergency_access_log` table + `emergencyAccessService` + `BreakTheGlassModal`. Time-limited override + supervisor notify via `send-email` + audit-logged on every grant + revoke.
- ✅ **ONC-10** (d)(7)/(d)(8) SHA-256 integrity hashes on exports — DONE for all three export paths: `enhanced-fhir-export` (a117d999), `bulk-export` (ad1d4c0a, persists sha256_hex + integrity_algorithm on export_jobs), and `ccda-export` (2026-05-29, RFC 3230 Digest header + X-Integrity-Algorithm + integrity block in JSON body over the C-CDA XML). Shared helper `_shared/integrityHash.ts` (11 Deno tests).

### Tier 3 (Session 3)
- **ONC-11:** (g)(5) WCAG AA audit — Lighthouse/axe-core across all routes
- **ONC-12:** (b)(3) Surescripts enrollment — BLOCKED on external vendor (3-6 month timeline)
- **ONC-13:** Formal ONC compliance evidence matrix for Drummond Group

---

## BACKLOG — PILOT DRIVEN — Nephrology Vertical + Acumen Epic Connect Integration (0/13)

**Tracker:** `docs/trackers/nephrology-module-tracker.md`
**Status:** 0/13 sessions — greenfield build, customer pilot identified
**Estimated total:** ~52-60 hours across 13 sessions
**Pilot driver:** Nephrology clinic on Acumen Epic Connect — established internal sponsor at the clinic
**Target timeline:** 6-8 weeks to first physician encounter scribed end-to-end (1 month possible if BAA + Fresenius FHIR provisioning move fast)

### Why This Matters
- First real customer pilot — beats horizontal "any specialty" pitch with concrete vertical + concrete clinic
- Acumen = Epic underneath → existing `EpicFHIRAdapter.ts` (645 lines), `fhirBulkExportService.ts` (466 lines), full SMART on FHIR auth flow are already built
- Cures Act + ONC Information Blocking Rule = clinic owns its data, no Fresenius approval needed beyond enabling FHIR client
- Nephrology data density (dialysis = ~150 visits/year/patient, dense labs, KDIGO guidelines) is where Compass Riley's longitudinal reasoning shines
- Strengthens Anthropic pitch: real pilot + real vertical = case study story

### Critical Path (External Gates)
1. **BAA executed with clinic** — 1-3 weeks
2. **Fresenius enables Epic FHIR client** — 1-4 weeks (most likely bottleneck — clinic IT files ticket)
3. **OAuth credentials provisioned + first FHIR pull** — 1-2 weeks
4. **First physician encounter scribed + DocumentReference written back** — 1-2 weeks

### Build Sequence (Internal)
| Phase | Sessions | What |
|-------|----------|------|
| Phase 1: Data Entry Forms | 1-6 | CKD registry, HD treatment + adequacy, vascular access, anemia + CKD-MBD, PD + transplant, office dashboard |
| Phase 2: Edge Functions | 7-8 | Core CRUD + alert dispatch (10 alert types: hyperkalemia, AKI, access infection, missed treatment, under-dialysis, etc.) |
| Phase 3: AI Services | 9-10 | CKD progression predictor, AKI risk, dialysis adequacy advisor, ESA dosing optimizer, patient summary |
| Phase 4: Acumen Integration + Advanced | 11-13 | **Session 11 = pilot go-live gate** (bi-directional FHIR sync), KDIGO content for `guidelineReferenceEngine`, ESRD billing (CPT 90935-90999), transplant workflow |

### MVP for pilot demo
Phases 1-2 + Session 11 = 9 sessions. Vertical and Acumen integration progress in parallel; Session 11 sequenced ahead of AI Phase 3 because go-live depends on data flowing.

### Open Questions for Maria's Meeting Today (2026-04-27)
See tracker for the 6 questions to bring to the clinic stakeholder conversation.

---

## BACKLOG — SOC 2 Readiness: Policy & Evidence Gap Closure (0/14)

**Tracker:** `docs/trackers/soc2-readiness-tracker.md`
**Status:** 0/14 items — 8 policy templates **drafted** (Phase 1) and ready for Maria + Akima review/signature; 6 evidence items pending (Phase 2/3)
**Estimated total:** ~32 hours across 3-4 sessions
**Note:** We are NOT declaring SOC 2 compliance. SOC 2 requires an independent AICPA-certified auditor. This tracker prepares us for that engagement.

**Technical alignment:** ~80% (code + controls strong). **Paper alignment:** ~20% (policies, vendor evidence, pen test). This tracker closes the paper gap.

**Phase 1 — Policies (drafted 2026-04-21):**
- 8 policies in `docs/compliance/soc2-policies/` (ISP-001, ACP-002, IRP-003, BCP-004, DCR-005, CMP-006, VRM-007, AUP-008)
- Each cross-references actual controls (CLAUDE.md, rules/, migrations, edge functions)
- Requires Maria + Akima signature before being official

**Phase 2 — Evidence (pending):**
- Vendor SOC 2 reports + BAAs/DPAs (Supabase, Anthropic, MailerSend, Twilio, Vercel)
- Security training records
- Quarterly access review (first entry)
- DR tabletop exercise (first run)

**Phase 3 — External validation (pending):**
- Third-party pen test ($8-15K, not internal adversarial audit)
- SOC 2 evidence matrix (AICPA TSP 100 criterion → live artifact crosswalk)

---

## PRIORITY 2 — Guardian Agent Gap Closure (9/9) ✅ COMPLETE

**Tracker:** `docs/trackers/guardian-system-tracker.md`
**Status:** ✅ 9/9 — Session 1 shipped 2026-04-21; Session 2 (GRD-6/7/8/9) closed 2026-05-29. Two DB-layer bugs that made the approval workflow non-functional were found + fixed during Session 2 (create-ticket CHECK constraint; dropped approve/reject RPCs).
**Estimated total:** DONE.
**Risk:** Resolved — alerts fire end-to-end via cron + multi-channel, AND the review/approval lifecycle now works end-to-end (proven by the live GRD-9 test).

**Session 1 (DONE):**
- ✅ **GRD-1:** cron scheduled via migration 20260421120000 + auth bypass fix + PagerDuty→internal swap (commit 44ef6789)
- ✅ **GRD-2:** createTicket() wired in both guardian-agent autoHeal and AgentBrain.initiateHealing (commit ce654114)
- ✅ **GRD-3:** Browser Guardian starts in all non-test modes (commit ce654114)
- ✅ **GRD-4:** Guardian API scan returns real findings from 4 parallel queries (commit ce654114)
- ✅ **GRD-5:** End-to-end test with 4 cases including auth-bypass regression guard (commit aa3ff030)

**Session 2 (IN PROGRESS — 2026-05-29):**
- ✅ **GRD-6:** DONE + live-proven + visually accepted. Eyes recordings now link to tickets via `security_alert_id` (`create_guardian_review_ticket` writes a correlated recording; migration `20260529160000`). New `getAlertRecordings` + `GuardianEyesRecordingViewer`. **🚨 Found + fixed a CRITICAL pre-existing bug: the RPC that creates every Guardian ticket was dead at the DB layer** (`alert_type='guardian_approval_required'` violated a CHECK constraint → 0 tickets ever created). Fixed by migration `20260529170000`. The whole approval workflow is now functional.
- ✅ **GRD-7:** DONE (verified) — `guardian_flow_config` already exists live (migration `20251211230000`); engine reads it + falls back gracefully. April tracker was stale. Nothing to build.
- ✅ **GRD-8:** DONE (manual path). Deleted the dead `gh`-CLI auto-PR code (`guardian-pr-service` edge fn + `GitService` + `approveAndCreatePR` — never runnable server-side, 0 callers). Fixed misleading "Auto-Apply" labels to match reality (Guardian surfaces the healing plan; Maria creates the PR herself). Scoped typecheck 0, lint 0, 61 guardian tests green.
- ✅ **GRD-9:** DONE — live lifecycle e2e test (`guardian-ticket-lifecycle-e2e.test.ts`), 4/4 passing, no mocks (real super_admin via generateLink+verifyOtp, real RPCs, real state transitions, self-cleaning). **🚨 SECOND CRITICAL FIX found building it: `approve_guardian_ticket` + `reject_guardian_ticket` didn't exist in the live DB** (dropped by `20251209110000` via the dead `log_audit_event` dep, never recreated) → approve/reject failed at runtime. Restored by migration `20260529180000`. **Guardian approval workflow is now functional end-to-end for the first time.**

**✅ GUARDIAN SESSION 2 COMPLETE (9/9). Guardian tracker fully closed.** Both active priorities (ONC Tier 2 + Guardian) are now done. Next: pick from BACKLOG (god-file decomposition, API-3 Session B, MCP-3 adversarial testing, Nephrology, SOC 2) or a fresh priority from Maria.

**🔔 Notification delivery — diagnosed live 2026-05-29 (post-Guardian).** The alert→notify pipeline was probed end-to-end. Findings: (1) the GRD-5 notification test (`security-alert-notification-e2e.test.ts`) was broken by schema drift (`message`→`description`, `status 'pending'`→`'new'`, missing `alert_type`) AND called the processor with the new `sb_secret_*` key, which the `verify_jwt` gateway rejects — fixed: pass an anon JWT in `Authorization` + the secret in `X-Cron-Secret`. (2) **Fixed the in-app channel NOT-NULL bug** — `sendInternalNotification` inserted `alert.message` (undefined; the column is `description`) → null-violated `security_notifications.message`. Now reads `alert.description ?? alert.title` (interface + 4 call sites corrected). In-app notifications now deliver; GRD-5 test 5/5 green. (3) **STILL OPEN — Maria's config task (needs laptop):** email + SMS report "not configured" because the processor requires recipient lists `SECURITY_ALERT_EMAILS` / `SECURITY_ALERT_PHONES` (non-empty) AND `MAILERSEND_FROM_EMAIL` AND Twilio `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` (the project's Twilio secrets are named differently). Set those Supabase Edge secrets to enable email/SMS. Slack intentionally not connected. **Pre-existing deno-check typing debt in the processor (untyped supabase client `.insert`/param types) was NOT introduced here and remains.**

**What works now:** Cron fires every minute, email+SMS+Slack+internal all deliver, tickets auto-create for non-performance auto-heal proposals, browser Guardian runs in dev/staging/prod, scan returns real security findings.
**What still doesn't:** Eyes→approval link (GRD-6), multi-facility ED crowding config (GRD-7), PR service wiring (GRD-8 decision).

---

## BACKLOG — Patient Avatar Improvements (0/6)

**Tracker:** `docs/trackers/avatar-improvement-tracker.md`
**Status:** 0/6 items complete — system is production-ready (A- grade) with minor gaps
**Estimated total:** ~32 hours across 2 sessions

**Key items:**
- **AVT-1:** Clinical data sync — markers don't reflect FHIR conditions/allergies/meds (patient safety)
- **AVT-2:** Marker search/filter — 15+ markers becomes unusable
- **AVT-3:** Export to PDF for nursing handoff
- **AVT-4-6:** Bulk import, history timeline UI, 3D marker persistence

---

## BACKLOG — MCP Chain Completion: Final Gaps (2/9)

**Tracker:** `docs/trackers/mcp-chain-completion-tracker.md`
**Status:** 2/9 items complete — 15 of 16 MCP servers are real end-to-end. 63 of 73 prior tracker items done (86%).
**Estimated total:** ~34 hours buildable + ~8-12h blocked on vendor
**Prior work:** 6 trackers (compliance, infrastructure, production-readiness, blind-spots, completion, hardening) — 63 items already resolved

### What's Already Done
- ✅ 15/16 MCP servers are real end-to-end (DB queries, external APIs, real logic)
- ✅ Chain orchestrator built with DB state machine, approval gates, retry logic
- ✅ Chains 1-6 defined in database with 29 integration tests
- ✅ Per-request auth binding, input validation, audit logging on all servers
- ✅ 85 prompt injection tests + 64 clinical constraint tests passing
- ✅ mcp-server-compliance-tracker: 23/23 DONE
- ✅ mcp-infrastructure-repair-tracker: 26/26 DONE
- ✅ **MCP-1:** `claude-chat` hardened — input sanitization + safety prompt (commit 7d267332)
- ✅ **MCP-2:** `claude-personalization` hardened — injection guard + drift protection (commit 7d267332)
- ✅ OpenAI references removed — Claude-only fallback chain (commit 7f0f329d)

### Session Plan

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| ~~**1**~~ | ~~Security hardening — claude-chat relay, claude-personalization injection guard~~ | ~~MCP-1, MCP-2~~ | ~~7~~ | **DONE** (commit 7d267332) |
| **1** | Live adversarial testing — 40 attack prompts against hardened functions | MCP-3 | ~8 | **NEXT** |
| **2** | Revenue — RPM billing, wearable vitals dashboard, home vitals → FHIR conversion | MCP-4 through MCP-6 | ~26 | PENDING |
| **—** | Clearinghouse activation (when vendor creds arrive) | MCP-7 | ~8-12 | BLOCKED |

### Remaining Items
- ~~**MCP-1:** `claude-chat` relay — DONE (commit 7d267332)~~
- ~~**MCP-2:** `claude-personalization` — DONE (commit 7d267332)~~
- **MCP-3:** Live adversarial testing — 40 attack prompts against hardened functions (8h) — **NEXT**
- **MCP-4:** RPM billing infrastructure — CPT 99453-99458 enrollment + time tracking (12h)
- **MCP-5:** Wearable vitals → clinician dashboard — trend charts + threshold alerts (8h)
- **MCP-6:** Home vitals → FHIR Observation conversion — LOINC mapping + provenance (6h)
- **MCP-7:** Clearinghouse external API — BLOCKED on Waystar/Change Healthcare creds (8-12h)
- **MCP-8:** Cultural competency clinical review — waiting on Akima (0h code)
- **MCP-9:** Tool utilization gap (76/140 unwired) — ACCEPTED, deferred by design

### Session 3 — MCP Architecture Hygiene (added 2026-04-21)
- ~~**MCP-10:** Grouper SDK crash fix backported to standalone server — DONE (commit bef7b264)~~
- **MCP-10b:** Extract shared DRG 3-pass logic into `_shared/drgThreePassLogic.ts` (~6h)
- **MCP-11:** POA indicators in DRG grouper (HAC compliance) (~8h)
- **MCP-12:** Authoritative CMS DRG weight lookup table (~6h)
- **MCP-13:** Grouper safety gates — encounter type + age/sex + discharge disposition (~4h)
- **MCP-14:** Clinician ID in cost log, not patient (PHI audit fix + codebase-wide sweep) (~3h)
- **MCP-15:** Grouper idempotency / result caching (~2h)
- **MCP-16:** Grouper 600-line decomposition (~1h — naturally resolved if MCP-10b done first)
- **MCP-17:** Resolve `check_prior_auth_required` namespace collision (~1h)
- **MCP-18:** Resolve `submit_prior_auth` namespace collision (~1h)
- **MCP-19:** Rename `mcp-claude-server` → `mcp-atlus-reasoning-server` (~2h)
- ~~**MCP-20:** Build `mcp-patient-context-server` — DONE (commit 724249d4)~~
- **MCP-21:** Resolve `medical-codes` vs `medical-coding` naming collision (~2h)

---

---

## Active Tracker Index

For full priority detail, open the tracker referenced in each "## CURRENT PRIORITY" block above. The table below is the canonical registry of all live trackers.

| Tracker | Path | Status |
|---------|------|--------|
| **Nurse Handoff & Documentation** | `docs/trackers/nurse-handoff-documentation-tracker.md` | **COMPLETE — Feature 1 (3 sessions) + Feature 2 (3 sessions) all done** |
| **Compass Riley Reasoning** | `docs/trackers/compass-riley-reasoning-tracker.md` | **COMPLETE — all 10 sessions done** |
| **Patient Context Adoption** | `docs/trackers/patient-context-adoption-tracker.md` | **COMPLETE — all 6 phases done across 3 sessions** |
| L&D Module | `docs/trackers/ld-module-tracker.md` | COMPLETE — all 8 sessions done |
| **Tenant Admin Panel** | `docs/trackers/tenant-admin-panel-tracker.md` | **Sessions 1-5 COMPLETE (Tenant Suspension done)** |
| **Admin Panel Hardening** | `docs/trackers/envision-admin-panel-hardening-tracker.md` | **Tier 1-3 Session 5 DONE — 870+ tests, Tier 3 Sessions 6-7 TODO** |
| **MCP Server Compliance** | `docs/trackers/mcp-server-compliance-tracker.md` | **COMPLETE — 23/23 done, 8 sessions** |
| **Compass Riley V2 Reasoning** | `docs/trackers/compass-riley-v2-reasoning-modes-tracker.md` | **COMPLETE — 3/3 sessions done, 123 tests** |
| **Cultural Competency MCP** | `docs/trackers/cultural-competency-mcp-tracker.md` | **COMPLETE — 3 sessions, 138 tests** |
| **MCP Blind Spots** | `docs/trackers/mcp-blind-spots-tracker.md` | **10/12 fixed — S3-1 (clearinghouse) + S4-4 (idle tools) remain** |
| **MCP Completion** | `docs/trackers/mcp-completion-tracker.md` | **0/18 — NEW: Full ecosystem wiring (chains, tools, cost, security)** |
| Oncology Module | `docs/trackers/oncology-module-tracker.md` | Foundation BUILT, Phase 1 next (11 sessions total) |
| Cardiology Module | `docs/trackers/cardiology-module-tracker.md` | Foundation BUILT, Phase 1 next (12-13 sessions total) |
| Clinical Revenue Build | `docs/CLINICAL_REVENUE_BUILD_TRACKER.md` | Phase 1: 88%, Phase 2: 89% |
| Test Coverage Scale | `docs/TEST_COVERAGE_SCALE_TRACKER.md` | Stale (Feb 4) — needs refresh |
| **God File Decomposition** | `docs/trackers/god-file-decomposition-tracker.md` | **Tier-1 top-10 services ALL DONE 2026-06-01 (src/ god files 162→152). Remaining offenders in 800–999 band + F1 EnterpriseMigrationDashboard.tsx (931, UI — needs visual acceptance). Incremental.** |
| **God-File Refactor Findings** | `docs/trackers/god-file-refactor-findings-tracker.md` | **NEW (2026-06-01): 9 latent issues found while reading the god files. RF-2..RF-7 FIXED (precedence bug, EPCS 2FA fail-closed, silent-failure + injection-surface hardening, CDA dedup). RF-1 full EPCS verifier PARKED (EPCS unused — design captured). RF-9 ACCEPTED/won't-fix (low value). RF-8 code complete + tested (`3fddcd67`, structured tool_use on RiskAssessmentForm path) — **`claude-chat` deploy pending** (fail-safe meanwhile). All 9 dispositioned.** |
| **Migration System Hardening** | `docs/trackers/migration-system-hardening-tracker.md` | **NEW (2026-05-20): Part A (schema workflow CI gate, dead scripts, audit_logs SoT, _APPLIED_ convention) + Part B (intelligent migration engine — decompose dashboard, edge function wrapper, end-to-end demo, patent ↔ code alignment). ~22 hours total, A1 highest leverage.** |

---

## Weekly Housekeeping Checklist (NOT automated — run manually every Monday)

The session on 2026-05-20 surfaced multiple silent-drift issues (Vercel unbuilt 65 days, GitHub App credential stale, 14 orphaned Vercel env vars, drift script lying under continue-on-error, 114 undeployed edge functions). None of these were caught by existing scheduled jobs — they were found by manual dashboard inspection. The current cron coverage is:

- GitHub Actions hourly: `cleanup-pending-registrations` (DB cleanup only)
- GitHub Actions Monday 2 AM UTC: `security-scan` (code lint only — doesn't check infra)
- Supabase pg_cron: Guardian monitoring, billing, security retention, security-alert-processor (DB-internal only)
- Vercel crons: **none configured**

Until a real infra-health cron exists, this is a manual list. Run every Monday:

| # | Check | How | Pass criteria |
|---|-------|-----|---------------|
| 1 | Vercel deploy freshness | https://vercel.com/maria-leblancs-projects/well-fit-community-daily-complete/deployments | Latest deploy within the past week |
| 2 | Vercel env vars "needs attention" | https://vercel.com/maria-leblancs-projects/well-fit-community-daily-complete/settings/environment-variables | No yellow/red indicator on any var |
| 3 | GitHub App still connected to Vercel | https://github.com/settings/installations | Vercel listed with WellFit-Community-Daily-Complete in access |
| 4 | Supabase security advisor | https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/advisors/security | Only the documented false positives remain (see Known False Positives section) |
| 5 | Supabase performance advisor | Same dashboard, performance tab | No new ERROR-level findings |
| 6 | Edge function deploy drift | `git diff --name-only $(git log --format=%H --before="1 week ago" \| head -1)..HEAD -- supabase/functions/ \| head` | Recently touched functions are deployed (compare to `supabase functions list`) |
| 7 | CI/CD pipeline last run | `gh run list --limit 5` | Most recent on `main` is green |
| 8 | Governance scripts honest | `bash scripts/governance-check.sh && bash scripts/governance-drift-check.sh --skip-tests` | Both exit 0 |
| 9 | Migration drift | `npx supabase db push --dry-run` | "Remote database is up to date" |
| 10 | God file baseline drift | `bash scripts/governance-drift-check.sh --skip-tests 2>&1 \| grep god` | Pre-existing count not growing |

**Time budget: 15-20 minutes if everything is healthy. Up to a few hours when something has drifted (like 2026-05-20).**

The right long-term fix is to automate items 1-9 as a Sunday-night GitHub Action that emails Maria a report. Until that exists, this manual list is the safety net.

---

## Codebase Health Snapshot

> **This table is the single source of truth for codebase-health counts.** CLAUDE.md and other docs link here rather than restating numbers — update them in one place only. Counts are the last *recorded* values (from the dated session), not a fresh full-suite run.

| Metric | Value | As Of |
|--------|-------|-------|
| Tests | 11,880+ passed, 0 failed | 2026-05-28 |
| Test Suites | 571+ | 2026-05-28 |
| Typecheck | 0 errors (8GB heap — fixed OOM) | 2026-03-04 |
| Lint | 0 errors, 0 warnings | 2026-03-04 |
| God files (>600 lines) | 1 flagged: SOC2ComplianceDashboard (1,062 lines) — MCP servers all under 600 | 2026-02-27 |
| AI Model Versions | Centralized — 0 hardcoded strings remaining | 2026-02-23 |
| Edge Functions Deployed | 137+ functions, all live (7 MCP servers redeployed 2026-03-04) | 2026-03-04 |
| MCP Server Compliance | 23/23 complete | 2026-03-01 |
| MCP Blind Spots | 10/12 fixed (see `mcp-blind-spots-tracker.md`) | 2026-03-04 |
| MCP Completion | 0/18 — NEW tracker for full ecosystem wiring | 2026-03-10 |
| MCP Key Security | Per-server key isolation — 13 scoped keys, shared key revoked | 2026-03-04 |
| Congruency Audit | COMPLETE — all findings remediated | 2026-02-22 |

---

## Pitch-Ready Assets (verified 2026-05-20)

These are systems in the codebase that are real, working, and competitively differentiating for pilot/grant/investor conversations. Each has been verified by direct code inspection, not by trusting tracker claims.

| Asset | Where | Why it matters |
|---|---|---|
| **Intelligent Migration Engine with DNA Fingerprinting** | `src/services/migration-engine/` + `src/services/enterprise-migration/` + migrations `20251210100000` + `20251212100000` | Patent-pending IP (546-line spec at `docs/patent/PATENT_SPECIFICATION_MIGRATION_ENGINE.md`). 2,100 lines of SQL, 4,400 lines of TS, 136 behavioral tests. Self-learning field mappings with confidence-capped scoring (≤0.95), 40+ healthcare patterns (LOINC, ICD-10, NPI with Luhn validation), multi-tenant org isolation. **Hospital migration conversations open with this.** See B-series items in `docs/trackers/migration-system-hardening-tracker.md` for the remaining work to make it pilot-grade. |
| **Compass Riley V2 — Proportional Reasoning** | `supabase/functions/_shared/compass-riley/` (10 files, 1,054 lines) | Chain-of-Thought + Tree-of-Thought reasoning with fixed safety/evidence/blast-radius/reversibility rubric, user-wins-system-warns override pattern, HTI-2 transparency logging. Production deploy as of 2026-05-20 v63 (the 80-day TDZ outage ended). 167 tests across 5 files. |
| **Compass Riley — Ambient Learning** | `src/services/physicianStyleProfiler.ts`, `soapNoteEditObserver.ts`, `proactiveCorrectionDetector.ts`, `useSessionPatternLearning.ts`, dictation cadence in `audioProcessor.ts:170-264`, `ai-soap-note-generator/promptBuilder.ts:97-128` | **~90% complete (re-verified 2026-05-20).** Sessions 1, 2 fully DONE. Session 3 at ~95%: 3.2/3.3/3.4/3.5 fully done, 3.1 calibration logic+tests done but UI accept flow / audit log on accept / 30-day cooldown not verified. Session 4 at ~60%: 4/7 explicit test files exist (4.1 lifecycle, 4.3 profiler, 4.4 specialty partial, 4.5 calibration). Missing: 4.2 maturity progression boundaries, 4.6 comprehensive edge cases. **The learning loop CLOSES** — physician style observations actually shape the SOAP note Claude generates. ~5 hours of work remaining to claim 100%. |
| **Governance System** | `CLAUDE.md`, `.claude/rules/*`, `.claude/hooks/*`, `scripts/governance-check.sh`, `scripts/governance-drift-check.sh`, `scripts/weekly-housekeeping.py` | The control system that prevents AI-introduced debt. Real-time hooks block forbidden patterns at edit time; weekly housekeeping automation (Sunday 23:00 UTC, posts GitHub issue) catches infra drift. Unusually rigorous for a healthcare codebase. |
| **MCP Orchestration with Embedded Governance** | `supabase/functions/mcp-*` (17 servers documented in governance-boundaries.md S9) + `docs/patent/PATENT_SPECIFICATION_MCP_ORCHESTRATION.md` | Sister patent application drafted 2026-03-10. Approval gates + anti-hallucination grounding + multi-layer security across AI workflows. |

---

## Known False Positives / Accepted Warnings

These are advisor/linter findings we have deliberately accepted as non-issues. Do not re-investigate or attempt to "fix" them in future sessions unless explicitly requested.

| Finding | Source | Reason accepted | Date | Action |
|---|---|---|---|---|
| `RLS Disabled in Public — public.spatial_ref_sys` | Supabase security advisor lint 0011 | PostGIS extension reference table (~8,500 static SRID rows like WGS84). Owned by `postgres` superuser; neither CLI migrations nor the Dashboard SQL Editor have ALTER privileges. Zero PHI. Affects every Supabase project with PostGIS — documented limitation. Migration `20260520005000_enable_rls_spatial_ref_sys.sql` attempted both via CLI and SQL Editor, both failed with `must be owner of table spatial_ref_sys`. Migration file removed. | 2026-05-20 | Dismissed in Supabase Dashboard → Advisors → Security |

---

## History Archive

Prior session logs, completed initiatives, and historical progress notes have been moved to:

**[`docs/PROJECT_STATE_HISTORY.md`](./PROJECT_STATE_HISTORY.md)**

That file holds the chronological record. This file (PROJECT_STATE.md) is the live priority surface — keep it under 300 lines and link historical entries out as they roll off.
