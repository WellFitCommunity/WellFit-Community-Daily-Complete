# Project State — Envision ATLUS I.H.I.S.

> **Read this file FIRST at the start of every session.**
> **Update this file LAST at the end of every session.**

**Last Updated:** 2026-06-17
**Last Session (2026-06-17):** **Community Moments — emoji reactions feature + two carried-over fixes; then EQ-5 rate-limiting sweep.** Committed + pushed `f1479cd4` on `main`. (1) **Community Moment Reactions** — tappable emoji reactions UNDER each post: migration `20260616210000_community_moment_reactions.sql` (table `community_moment_reactions`, tenant-scoped RLS — `cmr_select_tenant` read, `cmr_insert_own`/`cmr_delete_own` identity-enforced writes, emoji CHECK matching `REACTION_EMOJIS`, unique `(moment,user,emoji)`, indexes on moment/tenant/user). **Migration verified ALREADY APPLIED + registered live** (Commandment #18 check via Supabase MCP — table/RLS/all 3 policies/constraints/FKs match the repo file exactly; version `20260616210000` present in `schema_migrations`). New `MomentReactions.tsx` + `useMomentReactions.ts` hook (toggle + live counts); `REACTION_EMOJIS`/`REACTION_LABELS` (a11y names) in `types.ts`. **Auto-publish:** moments now post live immediately (`approval_status:'approved'`) with post-hoc admin moderation; upload copy updated. (2) **fix(envision-login):** writes canonical `envision_session`/`envision_user` localStorage keys so `/super-admin` no longer bounces to `/envision` after a valid TOTP code (see [[reference_envision_session_keys_coupling]]). (3) **fix(service-worker):** reload-once on SW update + re-check on visibilitychange/online/hourly so installed PWAs stop running stale builds. Verify: scoped tsc 0 / lint 0/0 / pre-commit gate exit 0. ⚠️ **Reactions UI needs Maria's visual acceptance (Commandment #13) before truly "done."** **THEN — Engineering-Quality tracker EQ-5** (rate-limit sweep of `ai-*` edge functions) — see `docs/trackers/engineering-quality-findings-2026-06-07.md`.
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
- **S-HK-2** — Verify `nodemailer` not bundled into browser
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
