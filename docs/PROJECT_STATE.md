# Project State — Envision ATLUS I.H.I.S.

> **Read this file FIRST at the start of every session.**
> **Update this file LAST at the end of every session.**

**Last Updated:** 2026-05-28 (end-of-day, third session)
**Last Session:** **Tier 2 Session A — ONC-6 + ONC-7 + partial ONC-10 landed (`a117d999`); 18 Deno type errors in batchQueries/sequentialQueries fully repaired + 6 latent VitalReading bugs surfaced and fixed in pdf-health-summary; new CLAUDE.md AI Mistakes row added for "verify target column set before designing payload writer" (the `ndc_code`-on-MedicationRequest near-miss).** Tier 2 (Session 2 in the ONC tracker) is now 3 of 5 done. ONC-10 SHA-256 integrity helper lives in `_shared/integrityHash.ts` with 11 Deno tests (FIPS 180-2 reference vectors green) and is wired into `enhanced-fhir-export` only — `bulk-export` and `ccda-export` wiring deferred because both are 800+ line god files with pre-existing `SELECT *` violations that the pre-commit gate refuses to let me touch them lightly. ONC-7 ships `FormularyService` + 5 seeded test formulary rows + `NDC` field on MedicationOrderForm with color-coded status banner. ONC-6 ships `InteractionAlertModal` + `useMedicationOrderSubmit` hook (extracted to keep the form under the 600-line cap) + `CDS_INTERACTION_OVERRIDE` audit log entry on every override. 6 new behavioral tests cover the CDS modal flow including the required-override-reason for contraindicated severities.
**Updated By:** Claude Opus 4.7 (1M context)
**Codebase Health:** 11,880+ tests passing (~50 added this session: 11 Deno integrity + 12 FormularyService + 6 CDS modal flow + 21 prior). 0 lint warnings. 0 typecheck errors project-wide (scoped script). **Deno typecheck now CLEAN on the 5 reviewed export functions** (was 18 errors before the `batchQueries` signature fix — `PromiseLike<T>` widening + tuple-inferring generic via `{ -readonly [K in keyof Q]: Awaited<ReturnType<Q[K]>> }`). CI gates active: file-size, VITE_*-secret pattern, shadow-import TDZ, governance-boundary, secret-scan, pre-commit (17 AI-fingerprint rules — caught my SELECT * indirect violation this session). 7 migrations applied via Supabase MCP this day (5 prior + add_export_integrity_columns + seed_formulary_test_data). Largest new file: AddDeviceForm.tsx at 493 lines.

---

## NEXT SESSION — START HERE

> **🚨 Read CLAUDE.md Commandment #21 first.** "DONE MEANS DONE" is the second-highest-value rule in this codebase as of 2026-05-28. The scoped workflow MUST work end-to-end for a real user — compiles + tests pass + persists + reachable + audited — before calling a task done. Filing a defect as a "follow-up" = not done. The new rule is enforced because ONC-1 and ONC-2 were initially declared "done" while neither could submit (RLS rejected the payload) and neither had nav links. Maria caught it. Don't re-do that mistake.

### ONC Certification — Tier 1 ✅ 5/5 + Tier 2 Session A: 3 of 5 done

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
- **ONC-10 PARTIAL — deferred wiring:** `bulk-export/index.ts` (868 lines, 4× SELECT *) and `ccda-export/index.ts` (836 lines, 6× SELECT *) both god files with pre-existing violations the pre-commit gate refuses to let pass on any touched file. Fixing is decompose-grade work that belongs on the god-file tracker, not bundled into ONC. `_shared/integrityHash.ts` is ready; both files just need the call inserted once the SELECT * is fixed.
- **ONC-8** (a)(12) FHIR FamilyMemberHistory — TODO (~6h). Same shape as ONC-5: new fhir_family_member_history table + service + decomposed UI panel + page + route + chart nav card.
- **ONC-9** (d)(6) Break-the-glass — TODO (~4h). New emergency_access_log table + emergencyAccessService + BreakTheGlassModal. Time-limited override + supervisor notification via send-email + audit-logged on every grant + revoke.

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

**Priority 1 — Finish ONC Tier 2 (~10h):**
- **ONC-8 + ONC-9** — net-new tables + services + UI on the scale of ONC-5. ONC-8 (FamilyMemberHistory) is the larger one but mechanical given the ONC-5 template. ONC-9 (break-the-glass) is smaller but more security-sensitive. Doing both in one session fully closes Tier 2 minus the deferred bulk/ccda integrity wiring. Full detail in the **PRIORITY 1 — ONC** section below.

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
- ⚠️ **ONC-10** (d)(7)/(d)(8) SHA-256 integrity hashes on exports — DONE for `enhanced-fhir-export`; PARTIAL for bulk + ccda (helper ready, wiring blocked on SELECT * decomp). Helper in `_shared/integrityHash.ts` (11 Deno tests). RFC 3230 `Digest` header set. Migration `20260528130000` adds `sha256_hex` + `integrity_algorithm` columns to `export_jobs`. Commit `a117d999`.

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

## PRIORITY 2 — Guardian Agent Gap Closure (5/9)

**Tracker:** `docs/trackers/guardian-system-tracker.md`
**Status:** 5/9 items complete — Session 1 shipped 2026-04-21. Session 2 (GRD-6 through GRD-9) pending.
**Estimated total:** ~10 hours remaining (Session 2)
**Risk:** Was HIGH — security alerts now fire end-to-end via cron + multi-channel.

**Session 1 (DONE):**
- ✅ **GRD-1:** cron scheduled via migration 20260421120000 + auth bypass fix + PagerDuty→internal swap (commit 44ef6789)
- ✅ **GRD-2:** createTicket() wired in both guardian-agent autoHeal and AgentBrain.initiateHealing (commit ce654114)
- ✅ **GRD-3:** Browser Guardian starts in all non-test modes (commit ce654114)
- ✅ **GRD-4:** Guardian API scan returns real findings from 4 parallel queries (commit ce654114)
- ✅ **GRD-5:** End-to-end test with 4 cases including auth-bypass regression guard (commit aa3ff030)

**Session 2 (PENDING):**
- **GRD-6:** Wire Guardian Eyes recordings to approval form (~3h)
- **GRD-7:** Create guardian_flow_config migration (~2h)
- **GRD-8:** Decision on guardian-pr-service — keep/wire/remove (needs Maria's input)
- **GRD-9:** Full end-to-end integration test (~4h)

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
| **God File Decomposition** | `docs/trackers/god-file-decomposition-tracker.md` | **NEW (2026-05-20): 163 src/ + 21 edge function files >600 lines + EnterpriseMigrationDashboard.tsx (931 lines, F1). Incremental, not a sprint.** |
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
