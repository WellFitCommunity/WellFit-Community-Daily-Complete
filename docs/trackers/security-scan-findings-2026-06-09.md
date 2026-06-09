# Security-Scan Findings — 2026-06-09

> **Source:** `/security-scan` (11-check HIPAA compliance scan) run 2026-06-09 by Claude Opus 4.8 (1M).
> **Owner:** Maria (AI System Director) · **Reviewer:** Akima (CCO)
> **Result of scan:** **COMPLIANT** — all 6 critical checks passed. Items below are quality/hardening gaps and stale tooling, not compliance violations.
> **Live DB verified:** project `xkybsjnvuohpqpbkikyn`, 681 tables, 2026-06-09.

---

## What the scan PASSED (verified, for the record)

| Check | Verified state |
|-------|----------------|
| PHI logging | 0 `console.*` in `src/` production code |
| `any` type | 0 real (4 grep hits are comments/string literals) |
| RLS coverage | 658 / 681 tables RLS-enabled (96.6%); 23 exceptions all reference/system/metrics, **no tenant PHI table missing RLS** |
| CORS/CSP wildcards | 0 wildcards, 0 `WHITE_LABEL_MODE` |
| Hardcoded secrets | 0 real (PEM-header literal + test fixtures only) |
| Edge-function auth | 163/163 use a CORS/auth helper; auth-before-validation pattern confirmed |
| MCP servers | 17/17 have auth + rate-limit + input validation |
| JWT verification | no `getSession()` in edge functions; JWKS verifier present (`_shared/mcpJwksVerifier.ts`) |

---

## Gaps to repair

Symbols: TODO / IN PROGRESS / DONE / DEFER

### SS-1 — God-file rule is aspirational, not enforced (152 production files > 600 lines) — **TODO**
**Finding:** `find src -name '*.ts(x)'` excluding tests + `.generated.` = **152 production files over 600 lines.** Worst: `TemplateMaker.tsx` (1110), `immunizationRegistryService.ts` (997), `fhirSyncIntegration.ts` (973), `EnvisionLoginPage.tsx` (971), `ExecutionSandbox.ts` (967), `UsersList.tsx` (967), `PhysicianPanel.tsx` (955), `pdmpService.ts` (953), `fallRiskPredictorService.ts` (951), `ccmEligibilityScorer.ts` (945).
**Why it's not a violation today:** `scripts/governance-check.sh` baselines pre-existing god files (`scripts/god-file-baseline.txt`) and only fails on NEW ones; `supabase/functions/` isn't scanned at all.
**Disposition:** This is the existing **`docs/trackers/god-file-decomposition-tracker.md`** scope. Do NOT create a parallel effort. **Action here = update that tracker's count to 152 and re-confirm the Tier-1 top-10 are still the right next targets.** Incremental: leave each file smaller than you found it when feature work touches it.
**Acceptance:** god-file tracker reflects the live 152 count; no new file crosses 600.

### SS-2 — "Audit-logging coverage 44%" is an uninterpretable metric — **TODO (re-measure, don't mass-edit)**
**Finding:** 254/576 service files contain `auditLogger`. The 44% is **misleading**: the denominator is inflated by god-file decomposition — many audit-less files are pure helper sub-modules (`readmission/clinicalFactors.ts`, `fhir-integrator/helpers.ts`, `billing-decision-tree/types.ts`) whose *parent* service does the logging, or are constants/types files.
**Action:** Replace the blanket grep with a **PHI-touch-specific** measure: which services that directly `INSERT`/`UPDATE`/`SELECT` PHI tables OR call an AI clinical edge function lack an `auditLogger` call on the mutation/decision path. Use `/audit-check` skill as the basis.
**Candidates to spot-verify first (sensitive, currently no `auditLogger` in-file — confirm parent/edge-fn logs):** `ai/dischargeSummaryService.ts`, `ai/medicationReconciliationAIService.ts`, `ai/phiExposureRiskScorerService.ts`, `claude/riskAssessmentTool.ts`, `fhir/DiagnosticReportService.ts`.
**Acceptance:** a real list of PHI-touching services missing audit logging on their write/decision path (likely small), each either fixed or justified (parent logs / edge fn logs).

### SS-3 — `sms-send-code` rate-limit / captcha — **rate-limit CODE-COMPLETE; captcha = Maria decision**
**Finding (confirmed by reading the function 2026-06-09):** `sms-send-code` is an intentional pre-auth OTP function — scoped `cors()`, phone validation (libphonenumber, US/CA/GB/AU only), timeout+retry, audit logging. It had **NO rate limiting and NO captcha** → any allowed origin could trigger unlimited Twilio Verify SMS to arbitrary numbers (victim SMS-bombing + Twilio spend).
**Done (rate limiting):** Added two `checkRateLimit` (`_shared/rateLimiter.ts`) gates BEFORE the Twilio call, both returning 429 + `Retry-After`:
- **per-phone:** 3 / 10 min (`sms_send_phone`) — stops bombing one victim
- **per-IP:** 10 / 10 min (`sms_send_ip`) — stops one host spraying many numbers
Backing table `rate_limit_attempts` verified live (id/identifier/attempted_at/metadata/tenant_id). `deno check` clean. `verify_jwt=false` pinned in `config.toml` (stays public — correct). Limiter fails OPEN on DB error (existing shared-util convention).
**Live-proven (2026-06-09):** Deployed `sms-send-code` per-function (`npx supabase functions deploy sms-send-code`, script 125.3kB). Seeded `rate_limit_attempts` to the per-phone limit for synthetic `+12025550123`, called the live endpoint → **HTTP 429 `RATE_LIMITED`** (`retryAfter: 586`) **before any Twilio call (zero SMS sent)**. Seed rows cleaned up. Gate confirmed working.

**Captcha (SS-3b) — NOT NEEDED. Resolved by tracing the flow, not by preference.** hCaptcha is already correctly placed: the **initial** code send goes through the `register` edge fn, which **verifies the hCaptcha token (line 172) before** calling `sms-send-code` server-side (line 324). The only un-captcha'd paths are (a) the VerifyCodePage **resend** button and (b) **direct POSTs** to the endpoint — both now closed by the rate limiting above. Adding a captcha token requirement to `sms-send-code` would mainly re-friction the resend path (senior-facing) for a path already capped at 3/phone/10min. **Decision: rate-limit is the correct and sufficient control; no captcha added to `sms-send-code`.**

**Acceptance:** ✅ burst returns 429 (live-proven); ✅ captcha placement verified at the front door (`register`); side-paths rate-limited. **SS-3 CLOSED.**

### SS-4 — MCP `community-engagement` tenant scoping + `chain-orchestrator` input validation — **DONE 2026-06-09 (SS-4a fixed)**

**SS-4a FIXED & live-proven (migration `20260609150000`):** revoked EXECUTE from `anon` + `PUBLIC` on `calculate_engagement_warning_score`; `authenticated` + `service_role` retained. Verified live: `has_function_privilege('anon',...)` = false, ACL now `{postgres, authenticated, service_role}`. Applied via `db push`. Optional future defense-in-depth (SECURITY INVOKER conversion) noted below but not required.


**`chain-orchestrator` — NOT a gap (grep miss).** It derives the caller's identity + tenant from the request (returns 403 "No tenant_id associated with caller"), enforces an action allow-list (start/resume/approve/cancel/status), and validates required fields per action (manual, not zod — which is why the scan's `VALIDATION|zod` grep missed it). It correctly derives tenant from the **caller, not args.** No change needed.

**SS-4a — `community-engagement` `get_engagement_score` — LOW severity, one-line fix.** Honest framing: this returns engagement *scores* (warning level + behavioral factors), not names/SSN/clinical data, keyed by a non-enumerable patient UUID, with **zero callers**. Worth tightening, not alarming. Verified live 2026-06-09:
- The tool calls RPC `calculate_engagement_warning_score(p_patient_id, p_days)` which is **`SECURITY DEFINER`** (`prosecdef=true`, confirmed in `pg_proc`) → **bypasses RLS**. `patient_id` comes straight from tool args with no caller-authorization check.
- The server uses the **global bare-anon client** (`initMCPServer` user_scoped → `SB_ANON_KEY`, no JWT forwarding), unlike the correct pattern (`createPerRequestClient(req)` used by `mcp-postgres-server`). `mcpServerBase.ts:323` documents that the global client is "only for SECURITY DEFINER RPCs" — but those RPCs must then do their own authorization, and this one doesn't.
- `verify_jwt=false` + the public anon/publishable key (shipped in every browser) ⇒ **anyone who supplies a patient UUID gets that patient's `warning_score`/`warning_level`/`concerning_factors`, cross-tenant.** HIPAA §164.312(a)(1) access-control concern (health-engagement risk data, no access control).
- The server's **other tools degrade safely**: `recommend_next_activity` (`patient_engagement_metrics`) and `get_personalized_greeting` (`profiles`) are RLS-keyed on `auth.uid()`, so the bare-anon client gets nothing back. Only the SECURITY DEFINER path leaks.
- **Blast radius: zero in-repo callers** of `get_engagement_score`; not wired into any gateway. Fixing it breaks nothing.

**Recommended fix (proportionate, one line):** `REVOKE EXECUTE ON FUNCTION calculate_engagement_warning_score(uuid,integer) FROM anon, PUBLIC;` (keep `authenticated` + `service_role`). That alone closes the "anyone with the public key" path. Optional defense-in-depth later: convert the fn to `SECURITY INVOKER` so the table's existing RLS governs it (verified `authenticated` has the table SELECT it needs). Maria's call (2026-06-09) was "harden the RPC itself." **Tier-3 (fn-security) → migration via `db push` when Maria says go.**
**Acceptance:** `has_function_privilege('anon', ...)` = false; an authenticated self/tenant-admin caller still works.

### SS-5 — `ssn` field in `ExtractedDataPreview.tsx` (frontend) — **DONE 2026-06-09 (PASS, no fix)**
**Verified (read-only trace):**
- **No client persistence.** Repo-wide: zero `localStorage`/`sessionStorage`/`indexedDB` writes of this data. `ExtractedDataPreview` holds it only in ephemeral React `useState` (`editedData`), discarded on unmount.
- **SSN is never persisted server-side either.** In `PaperFormScanner.handleEnrollPatient`, the `enroll_hospital_patient` RPC params and the `profiles` `updateFields` map include every demographic/insurance field **except `ssn`** — the field is extracted by `extract-patient-form`, shown for staff review, then **dropped** on enroll. It is never written to any table.
- Lifecycle: scanned image → `extract-patient-form` (server) → returned to browser → displayed in review modal (in-memory only) → dropped on save. No persistent storage, client or server.
**Product observation (not security):** SSN is shown in the review UI but silently dropped on enroll — staff may expect it saved. If SSN capture is ever actually needed, it must go through server-side encryption (`phi-encrypt`), never `profiles`. Flag for Maria/Akima as a product decision, not a defect.
**Acceptance:** ✅ confirmed SSN never lands in persistent client storage (nor server). **SS-5 CLOSED.**

### SS-6 — `/security-scan` skill's own baselines are stale — **DONE (2026-06-09)**
**Fixed in `.claude/skills/security-scan/SKILL.md`:** Step 3 baseline → 681 tables / 658 RLS (with the 23 exceptions enumerated); Step 6 grep broadened to `withCORS|requireUser|requireRole|getUser|getClaims|cors(` + helper-name callout + 3 pre-auth flows added to known-public (verified: **0 false-positive auth flags** post-fix); Step 7 → 17 servers (enumerate, don't hardcode) + public-reference-tier exemption note; Step 9 baseline → 152 (corrected `find` precedence + test/generated exclusion, verified =152); Step 11 → flagged informational with the decomposition-inflation caveat; output/rules → dynamic server count + bash-grep fallback documented.

**Finding:** The skill drifted from reality (mild irony given this repo's anti-drift discipline):
- Claims "Baseline: 0 god files" → actual **152**.
- "Verify all **11** MCP servers" → actual **17**.
- "Baseline: 248+ tables" → actual **681**.
- Step 6 grep misses the real helper names (`withCORS`, `requireUser`, `requireRole`, `cors`) → 4 false-positive "unsecured function" flags every run.
**Action:** Update `.claude/skills/security-scan/SKILL.md`: correct the three baselines, expand the MCP loop to all `mcp-*` dirs, and broaden the Step-6 auth-marker grep to include `withCORS|requireUser|requireRole|cors`.
**Acceptance:** a clean run produces 0 false-positive auth flags and the baseline numbers match live.

---

## Notes
- This tracker is **findings + disposition only** — per `/security-scan` rules, the scan does not fix; repair is separate work.
- SS-1 defers to the existing god-file tracker; SS-2 defers to `/audit-check`. The genuinely new, self-contained repairs are **SS-3, SS-4, SS-5, SS-6**.
