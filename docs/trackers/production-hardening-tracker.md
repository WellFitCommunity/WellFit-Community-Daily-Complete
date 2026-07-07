# Production Hardening Tracker

> **Source:** Cross-AI adversarial audit (ChatGPT, corrected/code-backed version, 2026-07-07) + live-DB verification by Claude the same night.
> **Rule:** Every finding below was re-verified against the **live** system (live DB via Supabase MCP, actual code, deployed edge functions). ChatGPT reads the static repo and cannot query the live DB — where we differ, the live check wins (see RPM below).
> **Goal:** Repair to production-grade. NOT scaling back the pitch — hardening the paths so the platform can carry the full story.

## Session-start note
Read this file + `CLAUDE.md` before executing any phase. Each item lists exact `file:line`, severity, the fix, and acceptance criteria so a fresh session can execute a phase cold. Do phases in order (security first). Live-DB migrations are marked **STAGED — needs supervised push**.

## Status legend
✅ done · 🔧 in progress · 📋 ready (spec complete) · ⏸ staged (needs supervised push) · ❌ false/stale finding

---

## Verified triage (all audit findings)

| # | Finding (file:line) | Audit sev | **Verified status** | Evidence |
|---|---|---|---|---|
| 1 | `fhir-r4/auth.ts` reads `expires_at` (col is `access_token_expires_at`) | Critical | ✅ **FIXED + DEPLOYED** (commit `d1a947ad`) | live `smart_access_tokens` cols confirmed; fhir-r4 redeployed + boots (FHIR 401, no 500) |
| 2 | `smart-authorize` stale cols (`client_id`,`scope`,`expires_at`…) | Critical | ✅ **FIXED** (commit `f1e45a25`) — deploy + `/authorize` route pending (Phase 2) | full rewrite to live schema; `deno check`+`lint` clean |
| 3 | RPM drift: `rpm_reports`,`rpm_report_settings`,`log_rpm_report_review` "missing" | High | ❌ **FALSE** — all three exist live | `to_regclass`/`pg_proc` all non-null. Gate/baseline is stale, objects are real. |
| 4 | `api/admin/grant-role.ts:15-29` broken caller-authz | Medium (→ **HIGH**) | ✅ **FIXED tonight** — needs UI smoke test | queried literal `'x'`, then only checked "any super_admin exists"; now verifies caller via service role |
| 5 | `_APPLIED_20251226000000_chw_kiosk_tables.sql:246-302` RLS `WITH CHECK (true)` | High | ⏸ **STAGED** (spec below) — no live writer yet (only in generated types), so low urgency, but real | 4 permissive INSERT/UPDATE policies |
| 6 | `auditLogger.ts:102-123` + `usePhiAccessLogging.ts` swallow failures | Medium | 📋 real | silent `catch {}` — audit gaps invisible |
| 7 | `EnvisionLoginPage.tsx:133-134,243-245,311-313` admin token in `localStorage` | High | 📋 real, **LOAD-BEARING** | `envision_session`/`envision_user` keys are *required* for super-admin flow (see MEMORY `reference_envision_session_keys_coupling`) — hardening is architectural, not a swap |
| 8 | `smartOnFhir.ts:165-172` simplified PKCE | High | 📋 real — **zero live consumers** (app registry empty) | line 166 "Simplified - in production use proper PKCE" |
| 9 | `SmartCallbackPage.tsx:68-74` token in `sessionStorage` | High | 📋 real — zero live consumers | stores `smart-session` |
| 10 | CSP `unsafe-inline`/`unsafe-eval` (`vercel.json:29`) | Medium | 📋 real (some needed by hCaptcha/wasm; inline-script is the target) | confirmed in CSP header |
| 11 | `vite.config.ts:53` prod sourcemaps; `vercel.json:6` `CI:false` | Medium | 📋 real, easy | `sourcemap: true`, `"CI":"false"` |
| 12 | `db-reference-drift-baseline.txt` (156 lines suppressed) | High | 📋 real hygiene — expect many stale like RPM | needs triage, not panic |
| 13 | `process-vital-image/index.ts:263-280` OCR placeholder throws | Medium | 📋 real — server OCR is a stub (`OCR_CLIENT_SIDE_REQUIRED`) | new in corrected audit |
| 14 | README `HIPAA/SOC2/Epic/zero-any/zero-console/all-tests-pass` | claim mismatch | 📋 real overclaim — cheap to make honest | `zero any` ~accurate in src; others overstated |
| 15 | `EpicFHIRAdapter.ts:410` SMART EHR launch "not implemented" | — | ✅ honest limitation (backend-services auth works) | confirmed earlier |

---

## Phase 0 — Done tonight ✅
- **#1** fhir-r4 token validation fixed + deployed (`d1a947ad`).
- **#2** smart-authorize rewritten to live schema (`f1e45a25`).
- **#4** grant-role caller-authz hardened (this session — see commit).

---

## Phase 1 — Security hardening (~2 sessions)

### 1a — `grant-role` caller-authz ✅ (done tonight; **needs UI smoke test**)
- **File:** `api/admin/grant-role.ts`
- **Fix applied:** identity from `getServerSession()`; caller's `super_admin` role verified against `user_roles` via service role (RLS-independent). Removed the `'x'` literal + "any super_admin exists" logic. Removed 2 `any`.
- **Acceptance:** from `UserRoleManager.tsx`, a real super_admin can still grant a role; a non-super-admin gets 403. **Maria: test the grant-role UI when awake.**

### 1b — CHW kiosk RLS ⏸ STAGED (do not push until write-path confirmed)
- **File:** `supabase/migrations/_APPLIED_20251226000000_chw_kiosk_tables.sql:246-302`
- **Problem:** `WITH CHECK (true)` / `USING (true)` on INSERT/UPDATE for `chw_kiosk_sessions`, `chw_patient_consent`, `chw_kiosk_usage_analytics`.
- **Blocking question:** how are these written? (grep found writers only in `database.generated.ts` — i.e., **no live writer yet**.) Confirm the intended path (service-role edge fn vs anon kiosk client vs staff) before choosing a policy.
  - If **service-role edge fn**: drop the permissive policies entirely (service role bypasses RLS); authenticated/anon then cannot write. Safest.
  - If **staff-authenticated**: replace `WITH CHECK (true)` with the staff-role `EXISTS(...profiles...role IN (...))` pattern already used by the SELECT policies in the same file.
  - `chw_patient_consent` is the sensitive one (consent records) — never leave it `WITH CHECK (true)`.
- **Acceptance:** each policy scopes writes to a real identity; the kiosk flow (once wired) still works; no anon write to consent.

### 1c — Surface audit-log failures 📋
- **Files:** `src/services/auditLogger.ts:102-123`, `src/hooks/usePhiAccessLogging.ts:64-74,97-113`
- **Fix:** don't silently `catch {}`. On a logging failure, escalate to a monitored server-side path (or a `security_alerts`/edge sink) so compliance dashboards can't look complete while events are missing. Keep UX non-blocking, but make the *failure* observable.
- **Caution:** wide blast radius (used everywhere) — change carefully, add a test that fails if the failure is swallowed.
- **Acceptance:** a forced logging failure produces a visible signal (alert row / server log), not silence.

### 1d — Service-role blast-radius review 📋
- Grep every `SERVICE_ROLE_KEY` use in `api/` and `supabase/functions/`; confirm each is preceded by explicit caller authorization (like 1a now is). Document any that aren't.

---

## Phase 2 — SMART production-grade (~2 sessions)
*(Real but zero live consumers today — `smart_registered_apps` is empty.)*

### 2a — `/authorize` React consent route 📋 (was mid-build)
- Approach locked with Maria: **reuse existing login + consent**. New route `/authorize` (protected). Reads `client_id,redirect_uri,scope,state,code_challenge,code_challenge_method`; shows scopes; on Approve POSTs to `smart-authorize?action=approve` with the Supabase session token; on success `window.location = redirect_uri`.
- Route wiring: `src/routes/routeConfig.ts` (+ lazy in the router). Session token via `supabase.auth.getSession()`.
- **Visual acceptance required** (patient-facing).
### 2b — Deploy `smart-authorize` (`verify_jwt=false` per config.toml). Set `APP_BASE_URL` secret (GET falls back to `ALLOWED_ORIGINS[0]`).
### 2c — Real PKCE in `src/lib/smartOnFhir.ts:165-172` (preserve verifier; S256). Or move exchange behind a BFF.
### 2d — SMART token custody: move off `sessionStorage` (`SmartCallbackPage.tsx:68-74`) to server-side/HttpOnly.
### 2e — End-to-end SMART test: register a synthetic app → authorize → token → FHIR read. This is also the live proof for #1/#2.

---

## Phase 3 — Build/config hardening (~1 session)
- **CSP** (`vercel.json:29`): drop `'unsafe-inline'` for `script-src` (keep hCaptcha/daily/wasm needs); verify hCaptcha + Daily.co + Supabase still load.
- **Sourcemaps** (`vite.config.ts:53`): `sourcemap: false` (or hidden) for production build.
- **CI gate** (`vercel.json:6`): remove `"CI":"false"` so warnings fail the build; fix whatever surfaces.
- **Admin session storage** (#7): plan migration of `envision_session*` off `localStorage` to HttpOnly cookies — **careful, load-bearing**; requires reworking the Envision auth flow. Separate sub-plan.

---

## Phase 4 — Drift + doc honesty (~1 session)
- **Drift baseline** (`scripts/db-reference-drift-baseline.txt`): triage all 156 lines against the **live DB** (like RPM — many are likely stale). Delete truly-dead code, restore genuinely-missing objects, purge false entries. Make the gate CI-blocking once clean.
- **README** (`README.md:77-85`): make claims match reality — soften "HIPAA-compliant"/"SOC2-ready"/"Epic-ready"/"all tests pass" to accurate language; keep "zero any" only where true.
- **process-vital-image** (#13): either implement server OCR or clearly mark the client-side requirement so it's not read as a broken server path.
- **CapabilityStatement** (`fhir-metadata`): ensure it doesn't advertise more than endpoints prove.

---

## STAGED SQL — CHW kiosk RLS (Phase 1b) — DO NOT PUSH until 1b write-path confirmed
```sql
-- Option A (service-role writer): drop permissive write policies; service role bypasses RLS.
-- DROP POLICY "System can insert kiosk sessions"   ON public.chw_kiosk_sessions;
-- DROP POLICY "System can update kiosk sessions"   ON public.chw_kiosk_sessions;
-- DROP POLICY "System can insert patient consents" ON public.chw_patient_consent;
-- DROP POLICY "System can insert kiosk analytics"  ON public.chw_kiosk_usage_analytics;
--
-- Option B (staff-authenticated writer): replace WITH CHECK (true) using the same
-- staff-role EXISTS(...profiles...) pattern the SELECT policies in this file already use.
-- (Choose per confirmed write path; never leave chw_patient_consent WITH CHECK (true).)
```

---

## Verification log — 2026-07-07 (night)
- Live DB (`execute_sql`): `smart_access_tokens` = `access_token_expires_at`/`refresh_token_expires_at`/`revoked` (no `expires_at`); `smart_auth_codes` = `app_id`/`scopes_granted[]`; `smart_registered_apps` status enum incl `approved`; `smart_authorizations` UNIQUE(app_id,patient_id); `rpm_reports`/`rpm_report_settings`/`log_rpm_report_review` all EXIST; `account_lockouts` empty.
- Login/captcha "outage" was a transient hCaptcha issue — config verified correct (enabled, real secret). No code change.
- Deployed: `fhir-r4` (boots clean). Committed: `d1a947ad` (fhir-r4), `f1e45a25` (smart-authorize), grant-role (this session).
```
