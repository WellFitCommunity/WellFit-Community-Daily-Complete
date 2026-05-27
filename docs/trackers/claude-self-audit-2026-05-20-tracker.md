# Claude Self-Audit Remediation Tracker (2026-05-20)

> **Source:** Claude Opus 4.7 internal code audit — 2026-05-20
> **Verified by:** Direct read of source, RLS migrations, edge function code (not docs)
> **Audits performed:** (1) Burnout suite, (2) Template Maker, (3) AI NurseOS Burnout Advisor, (4) Shift Handoff system, (5) MCP server infrastructure
> **Goal:** Close perimeter security gaps + feature-level critical bugs + CI enforcement
> **Estimated total:** ~32-36 hours across 5 sessions
> **Critical-rank:** S-PHI-1, T-1, AI-1 are the three highest-severity items in the codebase right now

---

## Session 1 — Critical Security (Must Fix Now) — **COMPLETE 2026-05-27**

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| S-PHI-1 | AES-256 master key shipped to browser via `VITE_PHI_ENCRYPTION_KEY` | **Scope reduced on discovery:** `phi-encrypt` edge function already existed (uses Supabase secret `PHI_ENCRYPTION_KEY` + Postgres `encrypt_phi_text` RPC). The real gap was that `phi-encrypt` only checked `Authorization` header presence — it never called `supabase.auth.getUser()` to verify the token, had no tenant check, no rate limit. **Hardened:** real JWT verification, caller tenant resolved from `profiles.user_id`, cross-tenant patientId blocked (logged as `PHI_ENCRYPT_CROSS_TENANT_BLOCKED`), persistent rate limit 60/min, audit logging on every code path. | UPDATED: `supabase/functions/phi-encrypt/index.ts` (135 → 348 lines) | 5 → ~2 | **DONE** |
| S-PHI-2 | Browser callers must move from direct crypto to edge function calls | **Scope reduced on discovery:** zero importers of the old `src/utils/phiEncryption.ts` in src — it was orphan dead code. All real PHI encryption already routed through `phiEncryptionClient.ts` → `phi-encrypt` edge function (or `handoffService` → Postgres pgcrypto RPC). **Done:** deleted dead `phiEncryption.ts`, removed `VITE_PHI_ENCRYPTION_KEY?` from `src/vite-env.d.ts` (line 45), rewrote `src/utils/secureStorage.ts` to use a random per-session AES-256 key (non-extractable, in-memory only) instead of an env-derived master key. **Backward compat:** ciphertext format on existing encrypted PHI in DB unchanged (handoff packets, CHW photos still decrypt). | DELETED: `src/utils/phiEncryption.ts`; UPDATED: `src/utils/secureStorage.ts`, `src/vite-env.d.ts` | 3 → ~1 | **DONE** |
| S-WH-1 | Withings webhook accepts unsigned POSTs as PHI source | Added HMAC-SHA256 signature verification via Web Crypto. Accepts `X-Withings-Signature` / `withings-signature` / `x-signature` / `signature` header, strips `sha256=` / `hmac-sha256=` prefix, constant-time compares against `HMAC-SHA256(rawBody, WITHINGS_NOTIF_SECRET)`. Reject = 401 + `audit_logs` insert with `event_type='webhook_signature_invalid'`. Verification gate runs BEFORE any DB read. | `supabase/functions/withings-webhook/index.ts` (141 → 257 lines) | 2 | **DONE** |
| S-WH-2 | Garmin webhook accepts unsigned POSTs as PHI source | Added OAuth 1.0a HMAC-SHA1 signature verification per RFC 5849 §3.4.1. Full RFC 3986 percent-encoding, sorted canonical base string, signing key `consumerSecret&` (unspecified-token form for Garmin Health API push). Constant-time compare. Reject = 401 + audit log. Verification gate runs BEFORE any DB read. **Tests added** (`__tests__/index.test.ts`: 158 → 333 lines). | `supabase/functions/garmin-webhook/index.ts` (199 → 445 lines) | 2 | **DONE** |
| S-WH-3 | Codebase-wide sister-bug sweep for unauthed webhooks | Swept all `supabase/functions/*webhook*` directories. Total of **3 webhook receivers** in codebase: withings, garmin, fitbit. Fitbit was the discovered sister bug — also lacked signature verification on the notification path. Added HMAC-SHA1 verification via `X-Fitbit-Signature` header per Fitbit Subscription API spec. `hl7-receive` was checked and is already authenticated (Bearer service-role OR per-connection API key). **New finding surfaced (FB-OAUTH-1)** — see below. | `supabase/functions/fitbit-webhook/index.ts` (314 → 429 lines) | 1 | **DONE** |

**Session 1 subtotal:** ~13 hours estimated, ~8 hours actual (scope reduced on phi-crypto discovery)

**Session 1 acceptance criteria (regression greps — verified 2026-05-27):**
```
✅ VITE_PHI_ENCRYPTION_KEY in src/: 0 matches
✅ VITE_PHI_ENCRYPTION_KEY in .env*: 0 matches
✅ withings-webhook contains signature/hmac/verify keywords (17 hits)
✅ garmin-webhook contains signature/hmac/oauth keywords (49 hits)
✅ fitbit-webhook contains signature/hmac/verify keywords (11 hits) [added by sister-bug sweep]
✅ Scoped typecheck on changed files: 0 errors
✅ npm run lint: 0 errors, 0 warnings
✅ src/services/__tests__/phiEncryption.test.ts: 23/23 pass
```

**Note on `crypto.subtle.*` remaining usages:** 12 call sites remain in src/ (offlineCrypto, secureStorage, GarminAdapter OAuth signing, enterprise-migration cryptoUtils, guardian-agent PHIEncryption). **None reference `VITE_*` master keys** — verified via `grep "VITE_\|import.meta.env"`. These are per-purpose key derivations (offline data, OAuth signatures, session-derived) and were never part of the S-PHI-* exposure. The original acceptance criterion's "must = 0" was overly broad.

### New finding from S-WH-3 sweep — defer to next sweep tracker

| # | Finding | Description | Files | Severity |
|---|---------|-------------|-------|----------|
| **FB-OAUTH-1** | Fitbit OAuth action endpoint accepts unauthenticated requests with caller-supplied tokens | The `fitbit-webhook` function has two code paths: (a) notification POST (signature-verified after S-WH-3), and (b) OAuth proxy POST with `{action: 'token_exchange'\|'refresh_token'\|'revoke_token', refresh_token, access_token, code}`. The OAuth path lacks Bearer-token authentication of the calling user. An attacker who guesses the URL could call `refresh_token` with a stolen refresh token OR `revoke_token` to deny service to legitimate users. The Fitbit `client_secret` itself stays server-side, but the per-user tokens are caller-controlled. | `supabase/functions/fitbit-webhook/index.ts` — `handleOAuthAction` (currently no `requireUser` check) | HIGH — pilot blocker |
| **G-3-SISTER-1** | `send-team-alert` interpolates `userName`, `alert_type`, `priority` into HTML email body without escaping | Same pattern as G-3 — `html: emailBody.replace(/\n/g, '<br>')` where `emailBody` contains raw `${userName}`, `${alert_type}`, `${priority}` interpolations. Attacker-controlled `alert_type` or `userName` could inject markup into the email. | `supabase/functions/send-team-alert/index.ts:139-158` | MEDIUM |
| **G-3-SISTER-2** | `ld-alert-notifier` interpolates PHI (`patientName`) into HTML email body without escaping | Same pattern — `html: alertBody.replace(/\n/g, "<br>")` where `alertBody` contains raw `${patientName}` and `${message}` interpolations. Clinical alert path → PHI exposure surface if patient name carries markup or if `message` is attacker-influenced. | `supabase/functions/ld-alert-notifier/index.ts:144-155` | MEDIUM-HIGH (PHI in alert path) |
| **CR-2-SISTER-1** | `_shared/modelFallback.ts` strips ```` ```json ```` fences before parsing | Same Rule #16 violation as CR-2. The fallback path that hits non-Anthropic models (or older Claude endpoints) still parses free text. When this code is next touched, migrate to whatever structured-output API the target provider offers. | `supabase/functions/_shared/modelFallback.ts:342` | LOW (Rule #16) |
| **CR-2-SISTER-2** | `_shared/peerConsultAnalyzer.ts` strips ```` ```json ```` fences before parsing | Same Rule #16 violation. Anthropic call should migrate to `tool_choice` pattern. | `supabase/functions/_shared/peerConsultAnalyzer.ts:112` | LOW (Rule #16) |
| **CR-2-SISTER-3** | `_shared/consultationAnalyzer.ts` strips ```` ```json ```` fences before parsing | Same Rule #16 violation. Anthropic call should migrate to `tool_choice` pattern. | `supabase/functions/_shared/consultationAnalyzer.ts:106` | LOW (Rule #16) |
| **CR-2-SISTER-4** | `mcp-claude-server/triageTools.ts` strips ```` ```json ```` fences before parsing | Same Rule #16 violation. MCP triage tool — when next touched, migrate to `tool_choice` pattern. | `supabase/functions/mcp-claude-server/triageTools.ts:422` | LOW (Rule #16) |

---

## Session 2 — Perimeter Cleanup + CI Enforcement

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| S-OBS-1 | Other `VITE_*` secret-name env vars (Pillbox, Weather) need triage | Audit `VITE_PILLBOX_API_KEY` (`src/services/pillIdentifierService.ts:119`) and `VITE_WEATHER_API_KEY` (in `vite-env.d.ts:33`). For each: confirm whether provider requires a real secret OR if it's safe to be browser-visible. If real secret: move behind an edge function proxy. | `src/services/pillIdentifierService.ts`, weather API caller (find via grep), `.env*` | 1.5 | TODO |
| S-CI-1 | Add CI gate enforcing 600-line file limit (rule exists, not enforced) | Add a script `scripts/check-file-sizes.sh` that fails CI when any non-generated `.ts/.tsx` file in `src/` or `supabase/functions/` exceeds 600 lines. Exclude `src/types/database.generated.ts` and `__tests__`. Wire into `.github/workflows/`. **This is what makes the god-file decomposition tracker mechanically enforceable.** | NEW: `scripts/check-file-sizes.sh`, `.github/workflows/file-size-check.yml` | 1 | TODO |
| S-CI-2 | Add CI gate against `VITE_*` env vars matching `*KEY*|*SECRET*|*TOKEN*` patterns | Add a script that fails CI when an unsanctioned `VITE_*` env var is introduced. Allowlist known-public ones (`VITE_HCAPTCHA_SITE_KEY`, `VITE_SB_PUBLISHABLE_API_KEY`, `VITE_FIREBASE_API_KEY` — Firebase keys are public by design). Reject anything else with `KEY`/`SECRET`/`TOKEN` in the name. | NEW: `scripts/check-vite-secrets.sh`, `.github/workflows/secret-scan.yml` | 1 | TODO |
| S-HK-1 | Remove junk files from repo root (shell mishaps captured as filenames) | Delete: `=0.5.17`, `=1.2.50`, `ee you're not on main or the correct branch, switch:)`, `t changes so you don't overwrite anyone's work`, `git reset --hard e8f655a`. Verify none are referenced anywhere via grep. | repo root | 0.25 | TODO |
| S-HK-2 | Verify `nodemailer` is not bundled into browser code | `nodemailer` is in `package.json` dependencies (not devDependencies). It's Node-only. Run `npm run build` and grep `build/` for `nodemailer` — must not appear in any chunk loaded by `index.html`. If bundled: move to edge function or scripts, mark devDep. | `package.json`, build output | 0.5 | TODO |
| S-HK-3 | Document legacy JWT key cutover plan (no code change yet) | Write `docs/migrations/legacy-jwt-key-cutover.md` documenting (a) what currently uses `SUPABASE_ANON_KEY` / `SB_ANON_KEY` as fallback, (b) cutover order (edge functions first, frontend last), (c) rollback plan. No code changes — this is a planning doc Maria approves before execution. | NEW: `docs/migrations/legacy-jwt-key-cutover.md` | 1 | TODO |

**Session 2 subtotal:** ~5 hours

**Session 2 acceptance criteria:**
```bash
# Junk files gone
ls "=0.5.17" "=1.2.50" 2>&1 | grep -c "No such file"   # must = 2

# CI gates exist and pass
bash scripts/check-file-sizes.sh   # documents current violations OR enforces zero new violations
bash scripts/check-vite-secrets.sh   # must return 0

# nodemailer not in browser bundle
grep -l "nodemailer" build/assets/*.js 2>/dev/null | wc -l   # must = 0
```

---

---

## Session 3 — Feature-Level Critical Bugs (Must Fix Before Pilot)

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| T-1 | Template Maker insert omits `tenant_id` | The TS interface declares `tenant_id`, the DB column exists nullable with no default, but the insert payload at `TemplateMaker.tsx:313-328` omits it. Newly created templates get `tenant_id = NULL` and may be invisible to non-super-admin users via tenant RLS. **Verify first** with `SELECT id, template_name, tenant_id FROM documentation_templates WHERE created_at > now() - interval '7 days';` — if NULLs present, fix. **Fix:** fetch caller's `profiles.tenant_id` and add to payload before insert. | `src/components/admin/TemplateMaker.tsx` | 1 | TODO |
| AI-1 | AI Burnout Advisor — auth without authorization (cross-user data access) | `requireUser(req)` confirms WHO the caller is, but never checks that caller is allowed to see `providerId`'s data. `createAdminClient()` then bypasses RLS. A logged-in nurse can request burnout analysis for any other provider in any tenant. **Fix:** after `requireUser`, resolve caller's `practitioner_id` and role; require `caller.practitioner_id === providerId OR caller.role IN ('admin','care_manager','super_admin')`. Return 403 otherwise. Log admin access to `phi_access_logs` (or equivalent). | `supabase/functions/ai-nurseos-burnout-advisor/index.ts:65-125` | 2 | TODO |
| SH-2 | Shift Handoff narrative — caller-supplied `tenantId` | `generateHandoffNarrative(unitId, tenantId, ...)` accepts tenant from caller. Use the `resolveTenantId` pattern from `_shared/mcpIdentity.ts:87-125` (identity wins; mismatch = security event). **Fix:** drop `tenantId` parameter; derive from authenticated session inside `ShiftContextAggregator.aggregateAndSynthesize`. | `src/services/shiftHandoffService.ts:449-460`, `src/services/ai/shiftContextAggregator.ts` | 2 | TODO |
| B-1 | Verify `provider_burnout_assessments` RLS — possible privacy regression | The original `20251018090900_resilience_hub.sql` policies are correct (`auth.uid() = user_id`). The later `20251108150000_complete_tenant_rls_policies.sql` adds a `FOR ALL` tenant policy that may OR with the per-user one, making all burnout data visible to anyone in the same tenant. **Verify first:** `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'provider_burnout_assessments';`. If tenant policy lacks role check, write a migration narrowing it to admins/care_managers only. | DB only (potentially new migration) | 1.5 | TODO |

**Session 3 subtotal:** ~6.5 hours

**Session 3 acceptance criteria:**
```sql
-- T-1: no NULL tenant_ids in templates created after fix
SELECT COUNT(*) FROM documentation_templates WHERE tenant_id IS NULL AND created_at > now() - interval '1 day';   -- expect 0

-- AI-1: cross-user request returns 403
-- (manual test: log in as user A, request advisor for user B's providerId, expect 403)

-- B-1: tenant policy USING clause references is_tenant_admin() or similar role check
SELECT qual FROM pg_policies WHERE tablename = 'provider_burnout_assessments' AND policyname = 'provider_burnout_assessments_tenant';
```

---

## Session 4 — Feature-Level High-Priority Bugs

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| B-2 | AdminBurnoutRadar divide-by-zero | `(stats.riskDistribution.high + stats.riskDistribution.critical) / stats.totalStaff` at line 232 — if no practitioners exist, division by zero → NaN cascades into width styles (lines 357, 382, 399). Other guards in same file use `\|\| 1` (lines 135, 174). **Fix:** `/ (stats.totalStaff \|\| 1)` at line 232. | `src/components/wellness/AdminBurnoutRadar.tsx:232` | 0.25 | TODO |
| B-3 | AdminBurnoutRadar full page reload navigation | `window.location.href = '/admin/...'` at lines 499, 505 kills SPA state and re-runs auth. **Fix:** import `useNavigate` from `react-router-dom`, replace both with `navigate('/admin/team-huddle')` / `navigate('/admin/wellness-report')`. **Also verify both routes exist in `src/App.tsx`** — grep `/admin/team-huddle` and `/admin/wellness-report`. | `src/components/wellness/AdminBurnoutRadar.tsx:499,505` + `src/App.tsx` | 0.5 | TODO |
| T-2 | Template Maker is a 988-line god file | Decompose using barrel re-export pattern: `TemplateMaker/index.tsx` (orchestrator <200 lines), `TemplateList.tsx`, `TemplateEditor.tsx`, `FieldBuilder.tsx`, `TemplatePreview.tsx`, `types.ts`, `hooks.ts`. Update `src/routes/lazyComponents.tsx` and `src/routes/routeConfig.ts` imports. Tests at `src/components/admin/__tests__/TemplateMaker.test.tsx` (494 lines) should continue to pass without modification — verify post-decomposition. | `src/components/admin/TemplateMaker.tsx` (988 lines) | 4 | TODO |
| T-3 | Template content rendering — verify XSS-safe | Templates allow `{placeholder}` substitution into `content_template`. **Verify** the renderer never uses `dangerouslySetInnerHTML` with template output. **Find the renderer:** `grep -rn "content_template" src --include="*.ts" --include="*.tsx" \| grep -v __tests__`. Confirm output is text-substituted into `<textarea>` or text node only. If `dangerouslySetInnerHTML` is found, sanitize via DOMPurify before injection. | TBD via grep | 1 | TODO |
| AI-2 | AI Burnout Advisor — no JSON response schema | Uses prompt-based JSON shaping at `index.ts:149-186`, parses with `JSON.parse`. Violates CLAUDE.md Rule #16. **Fix:** add Anthropic structured-output `response_format: { type: 'json_schema', json_schema: { name: 'burnout_advice', schema: BurnoutAdvisorResponseSchema } }`. Define `BurnoutAdvisorResponseSchema` matching the `BurnoutAdvisorResponse` interface. | `supabase/functions/ai-nurseos-burnout-advisor/index.ts:149-186` | 1.5 | TODO |
| AI-3 | AI Burnout Advisor — no rate limiting | Authenticated user can loop the endpoint at request rate; each call burns ~1500 Sonnet tokens. **Fix:** import `checkPersistentRateLimit` and `MCP_RATE_LIMITS.claude` (15 req/min) from `_shared/mcpRateLimiter.ts`. Apply after `requireUser`, before AI call. | `supabase/functions/ai-nurseos-burnout-advisor/index.ts` | 1 | TODO |
| SH-1 | Shift Handoff bulk confirm — server-side ownership check | `bulkConfirmAutoScores` at `shiftHandoffService.ts:93-118` does a direct UPDATE with client-supplied `riskScoreIds`. **Fix:** create RPC `bulk_nurse_review_handoff_risks(p_ids UUID[])` that validates each ID belongs to a patient assigned to the calling nurse's unit + current shift before updating. Replace client UPDATE with `.rpc()` call. | NEW migration + `src/services/shiftHandoffService.ts:93-118` | 2.5 | TODO |

**Session 4 subtotal:** ~10.75 hours

---

## Session 5 — Polish + MCP Hardening

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| M-1 | MCP servers use in-memory rate limiter only | `mcp-patient-context-server/index.ts:118` and likely other MCP servers use `checkMCPRateLimit` (in-memory) when they should use `checkPersistentRateLimit` post-auth for cross-instance enforcement. **Fix:** audit each MCP server with `grep -rn "checkMCPRateLimit\b" supabase/functions/mcp-*/`. For each server, replace post-auth rate limit calls with `checkPersistentRateLimit(sb, getCallerRateLimitId(caller), CONFIG)`. Pre-auth IP-based path can keep using in-memory. | All `supabase/functions/mcp-*/index.ts` | 2 | TODO |
| M-2 | Verify MCP protocol version string | `mcpServerBase.ts:132` declares `protocolVersion: "2025-11-25"`. Check current MCP spec at https://modelcontextprotocol.io/specification — if wrong, update to current. If intentional (forward-looking), add a code comment explaining. | `supabase/functions/_shared/mcpServerBase.ts:132` | 0.25 | TODO |
| M-3 | Audit log silent triple-failure | `mcpAudit.ts:89-97` swallows both primary and fallback failures, leaving only a `logger.error` call. For HIPAA-critical PHI access, add a third-tier alert/sink. **Fix:** when both inserts fail, write to a local file `/tmp/mcp_audit_critical.log` AND emit a structured alert via existing alertNotificationService. | `supabase/functions/_shared/mcpAudit.ts:89-97` | 1 | TODO |
| M-4 | Verify RLS on `mcp_audit_logs` and `mcp_key_audit_log` | `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename IN ('mcp_audit_logs', 'mcp_key_audit_log');` — confirm tenant-scoped SELECT for admins, no SELECT for non-admins. If missing, add tenant-isolation migration. | DB only (possibly new migration) | 0.5 | TODO |
| B-4 | AdminBurnoutRadar phantom filter props | `_organizationId`, `_departmentFilter`, `_roleFilter` declared in interface (lines 47-50) but underscored = unused. **Fix:** either remove from interface (callers will get a TS error and stop passing them) OR wire them through to the queries with proper filtering. Recommendation: remove unless filtering is on the roadmap. | `src/components/wellness/AdminBurnoutRadar.tsx:47-50` | 0.5 | TODO |
| B-5 | AdminBurnoutRadar no auto-refresh | Data only refetches when `timeframe` changes. **Fix:** add `setInterval(loadStats, 60_000)` in the useEffect with cleanup, OR (better) subscribe to realtime changes on `provider_daily_checkins` filtered to tenant. Cleanup on unmount. | `src/components/wellness/AdminBurnoutRadar.tsx:224` | 1 | TODO |
| B-6 | AdminBurnoutRadar hardcoded clinical thresholds | Stress > 7 = high alert, etc. — should be tenant-configurable. **Fix:** add columns to `tenant_module_config` (e.g., `burnout_thresholds JSONB`), fetch in `loadStats`, fall back to current defaults if absent. | `src/components/wellness/AdminBurnoutRadar.tsx:234-243` + new migration | 2 | TODO |
| T-4 | Template Maker lossy field metadata | `fieldsToObject` (line 208-213) drops `label`, `placeholder`, `options`, `required` from `TemplateField` — only persists `{name: type}`. **Fix:** change `required_fields` / `optional_fields` JSONB columns to store the full `TemplateField[]` array, update reads/writes accordingly. Test migration of existing data. | `src/components/admin/TemplateMaker.tsx:199-213` + migration | 2 | TODO |
| T-5 | Template Maker field name validation | `handleUpdateField` accepts any string for `name`. **Fix:** validate `/^[a-z][a-z0-9_]{0,62}$/` + uniqueness within the template before allowing save. Display inline error in `renderFieldRow`. | `src/components/admin/TemplateMaker.tsx:259` | 1 | TODO |
| AI-4 | AI Burnout Advisor — provider data to Claude without consent flag | Provider's `unsafe_staffing`, `felt_overwhelmed`, `lateral_violence_incident` flags sent to Claude. **Action:** confirm with Akima this is acceptable for HIPAA/employment-law purposes. If yes, document consent at MBI submission time in `BurnoutAssessmentForm.tsx` instructions screen. If no, redact behavioral flags from prompt. | `supabase/functions/ai-nurseos-burnout-advisor/index.ts:251-263` + `BurnoutAssessmentForm.tsx:251-320` | 1 | TODO |
| SH-3 | Shift Handoff bypass payload contains PHI names | `pendingPatientNames` flows from client over the wire. Reduce surface: pass only `pendingPatientIds`; let RPC `log_handoff_override` fetch names server-side. | `src/services/shiftHandoffService.ts:243-247, 260` + `log_handoff_override` RPC | 1.5 | TODO |
| SH-4 | Shift Handoff bypass IP captured client-side | `p_ip_address: null` in client call; real IP only available server-side. **Fix:** in `log_handoff_override` RPC, populate `ip_address` from `current_setting('request.headers')::json->>'x-forwarded-for'` (or equivalent). Drop the parameter from the client signature. | `log_handoff_override` RPC + `shiftHandoffService.ts:264-265` | 1 | TODO |

**Session 5 subtotal:** ~13.75 hours

---

## Session 6 — Compass Riley / Guardian / API Generator Audit Findings (2026-05-20 second pass)

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| CR-1 | Variable shadowing of imports — codebase-wide sweep | Pattern `const X = Deno.env.get("X") ?? X;` where `X` is also imported violates `adversarial-audit-lessons.md` Rule #5. **Done:** swept all 347 edge function `.ts` files. Fixed 6 files (`realtime_medical_transcription`, `generate-api-key`, `admin_start_session`, `admin_end_session`, `test-users`, `enrollClient`) — dropped local re-lookups, use imports from `_shared/env.ts` directly. `_shared/cors.ts:76` was a false positive (CSP string, not a shadow). Added CI gate `scripts/check-shadow-imports.sh` + `.github/workflows/shadow-import-check.yml` enforcing the pattern via perl multi-line regex. Full-codebase sweep returns 0 matches. | 6 edge functions + 1 CI gate + 1 workflow | 2 | **DONE** |
| CR-2 | Compass Riley JSON regex stripping | **Done:** migrated to Anthropic `tool_choice` forced tool_use pattern (canonical Anthropic structured-output API; `response_format: json_schema` is OpenAI syntax). New `TRANSCRIPTION_ANALYSIS_TOOL` schema lives in `_shared/scribeHelpers.ts` (covers all 7 fields of `TranscriptionAnalysis` including loose `encounterStateUpdate` for forward-compat). Parse path now extracts `data.content[].find(b => b.type === "tool_use").input` — no more text + regex + JSON.parse. Schema extracted to shared module to keep `realtime_medical_transcription/index.ts` under 600 lines (584 final). Rule-1 grep surfaced 4 sister bugs (see CR-2-SISTER-1 through -4 below). | `supabase/functions/realtime_medical_transcription/index.ts:412-481` + `supabase/functions/_shared/scribeHelpers.ts:13-83` | 1.5 | **DONE** |
| CR-7 | Compass Riley test gap — V2 reasoning + WebSocket auth path | The TDZ bug went 80 days undetected because no test exercised the WS auth flow with V2 reasoning enabled. **Fix:** add an integration test that opens a WS, authenticates with a valid token, requests `?mode=compass-riley&reasoning_mode=chain`, and confirms the connection establishes without runtime errors. | NEW `supabase/functions/realtime_medical_transcription/__tests__/v2-reasoning-auth.test.ts` or similar | 2 | TODO |
| G-1 | Guardian — `SELECT *` on 3 monitoring queries | **Done:** replaced with explicit columns — `audit_logs(id, ip_address, created_at)`, `system_errors(id, error_type, created_at)`, `phi_access_logs(id, user_id, records_accessed, accessed_at)`. | `supabase/functions/guardian-agent/index.ts:188-209` | 0.5 | **DONE** |
| G-3 | Guardian — HTML email body not escaped | **Done:** added `escapeHtml` helper, all `alert.title`/`alert.message`/`alert.category`/`alert.severity` interpolations now go through it. `send-email` only accepts an `html` field (no `text`-only path), so HTML-escape was the correct fix. Codebase-wide grep found 2 sister bugs filed as G-3-SISTER-1/2 below. | `supabase/functions/guardian-agent/index.ts:314-348` | 0.5 | **DONE** |
| G-4 | Guardian — `Math.max(...arr)` stack overflow risk | **Done:** replaced `Math.max(...unusualAccess.map(...))` with `unusualAccess.reduce((max, a) => Math.max(max, a.records_accessed), 0)`. | `supabase/functions/guardian-agent/index.ts:258` | 0.25 | **DONE** |
| API-2 | ApiKeyManager 940-line god file | Decompose into `ApiKeyManager/index.tsx` (orchestrator), `KeyList.tsx`, `GenerateKeyForm.tsx`, `KeyDisplayModal.tsx`, `ClipboardUtils.ts`, `ToastContainer.tsx`, `hooks.ts`. Mirrors the T-2 pattern. The S-CI-1 file-size gate will force this. | `src/components/admin/ApiKeyManager.tsx` (940 lines) | 4 | TODO |
| API-3 | ApiKeyManager — fake usage_count/last_used | Lines 156-158: UI displays `usage_count: 0, last_used: null` because schema doesn't track these. The "high-usage revoke confirmation" at line 298 NEVER triggers (usage_count always 0). **Two options: (a) Implement tracking** — add `api_key_uses` table with FK to `api_keys`, increment in `validate_mcp_key` RPC and other validation paths, or **(b) Remove columns** from the UI. Recommend (a) since the security control at line 298 is meaningful. | `src/components/admin/ApiKeyManager.tsx:156-158, 298` + new migration | 3 | TODO |
| API-5 | Deprecated `String.prototype.substr` | **Done:** `substr(2, 9)` → `substring(2, 11)` at line 112. | `src/components/admin/ApiKeyManager.tsx:112` | 0.1 | **DONE** |
| API-6 | Date.parse aggressive sort | **Done:** added strict ISO 8601 regex gate (`/^\d{4}-\d{2}-\d{2}(T...)?$/`) before invoking `Date.parse`. Org names like `"2024 Healthcare Inc."` now stay strings — no false timestamp sort. Hoisted `ISO_8601` + `toComparable` outside the component to keep `useMemo` deps stable. 36/36 component tests still pass. | `src/components/admin/ApiKeyManager.tsx:95-110` | 0.5 | **DONE** |

**Session 6 subtotal:** ~14.35 hours

**Session 6 acceptance criteria:**
```bash
# CR-1: shadow pattern eliminated from edge functions
grep -rEnB1 "^\s*\?\? ([A-Z_]+)\s*;?\s*$" supabase/functions --include="*.ts" | grep -B1 "const " | wc -l   # expect 0
```

---

## Summary

| Priority | Items | Est. Hours | Status |
|----------|-------|-----------|--------|
| Session 1 — Critical Security (PHI key + webhooks) | S-PHI-1, S-PHI-2, S-WH-1, S-WH-2, S-WH-3 | ~13h (actual ~8h) | **5/5 DONE** |
| Session 2 — Perimeter + CI Gates | S-OBS-1, S-CI-1, S-CI-2, S-HK-1, S-HK-2, S-HK-3 | ~5h | **0/6 TODO** |
| Session 3 — Feature Critical Bugs | T-1, AI-1, SH-2, B-1 | ~6.5h | **0/4 TODO** |
| Session 4 — Feature High Priority | B-2, B-3, T-2, T-3, AI-2, AI-3, SH-1 | ~10.75h | **0/7 TODO** |
| Session 5 — Polish + MCP Hardening | M-1, M-2, M-3, M-4, B-4, B-5, B-6, T-4, T-5, AI-4, SH-3, SH-4 | ~13.75h | **0/12 TODO** |
| Session 6 — Compass Riley + Guardian + ApiKeyManager | CR-1, CR-2, CR-7, G-1, G-3, G-4, API-2, API-3, API-5, API-6 | ~14.35h | **0/10 TODO** |
| **Total** | **44 items** | **~63h** | **0/44** |

---

## What This Tracker Does NOT Cover

- **God file decomposition** — already tracked in `docs/trackers/god-file-decomposition-tracker.md`. Once S-CI-1 lands, the file-size gate forces that tracker to move.
- **Test quality audit** (120 raw `toBeTruthy()` calls) — defer to a separate test-quality pass; not safety-critical.
- **`audit_logs` actor spoofing within tenant** — was already remediated by adversarial-audit-tracker.md A-3 (`20260327200000_fix_audit_log_rls_identity_enforcement.sql`). Re-verify it's still in place during Session 1 as a side-check.

---

## Audit Claims I Was Wrong About (Self-Correction)

| Initial Claim | Reality |
|--------------|---------|
| "43 edge functions have no auth" | **Mostly false.** A first-pass grep missed centralized auth gates. Functions using `verifyAdminAccess`/`verifyClinicalAccess` from `_shared/mcpAuthGate.ts` are properly authed. Pre-login functions (`login`, `register`, `hash-pin`, `passkey-auth-*`, `verify-hcaptcha`, `setup-admin-credentials`) are legitimately un-authed by design. The real gaps were the two webhooks. |
| "audit_logs INSERT spoofable" | **Already fixed.** Migration `20260327200000_fix_audit_log_rls_identity_enforcement.sql` (A-3 from prior tracker) enforces `actor_user_id = auth.uid()`. Earlier policies had been weaker but have been replaced. |
| "177 `WITH CHECK (true)` is alarming" | **Overstated.** Vast majority are scoped `TO service_role` or named `*_service_role_bypass`. Service role bypasses RLS anyway — permissive WITH CHECK on service-role-only policies is meaningless. |

---

## Rules for This Tracker

1. **Every fix includes a codebase-wide regression grep** — listed in acceptance criteria above
2. **Deploy edge functions after fixing:** `npx supabase functions deploy phi-crypto withings-webhook garmin-webhook`
3. **Run verification checkpoint after each item:** `bash scripts/typecheck-changed.sh && npm run lint && npm test` (scoped tests only — per [feedback memory](../../memory/feedback_no_full_test_suite.md))
4. **No item is DONE until deployed and acceptance grep returns the expected count**
5. **If stuck for 2+ attempts, STOP AND ASK Maria** — per CLAUDE.md rule #1
6. **S-PHI-1 is the priority** — it's an active HIPAA § 164.312(a)(2)(iv) exposure. Don't reorder.

---

## How to Execute (For a Fresh Claude Session)

```
1. Read this tracker top-to-bottom.
2. Read /workspaces/WellFit-Community-Daily-Complete/CLAUDE.md
3. Read /workspaces/WellFit-Community-Daily-Complete/.claude/rules/supabase.md  (for edge function patterns)
4. Read /workspaces/WellFit-Community-Daily-Complete/.claude/rules/adversarial-audit-lessons.md  (the why)
5. Start with S-PHI-1. Build the phi-crypto edge function. Use the existing AES-256-GCM logic from src/utils/phiEncryption.ts:13-93 — port it to Deno.
6. Run regression greps after each item. Do not declare DONE until they return the expected count.
7. Update this tracker's Status column as you go: TODO → IN_PROGRESS → DONE.
```
