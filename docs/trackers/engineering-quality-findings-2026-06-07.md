# Engineering-Quality Findings — 2026-06-07

> **Origin:** Maria asked for an honest, code-level (not docs-level) review of the platform.
> Two sub-agents (Explore) swept the service/AI/edge layer and the test/MCP/governance
> layer; the lead agent then **verified each high-stakes claim against the actual source**
> before writing it here. Claims are labeled **[verified]** (lead read the code) or
> **[reported]** (sub-agent said it; not yet lead-confirmed — confirm before acting).
>
> **Litmus test (house standard):** a fresh Claude can pick any one item below and execute
> it without asking questions. Exact paths + line refs + fix + acceptance criteria included.
>
> **Tier meaning:** T0 = patient-safety / security, fix first. T1 = correctness/robustness.
> T2 = quality/consistency. T3 = needs Maria's product/architecture call.

---

## ✅ DONE THIS SESSION (2026-06-07)

### EQ-1 [verified] Silent zeros in readmission risk inputs — FIXED
**File:** `supabase/functions/ai-readmission-predictor/index.ts` → `gatherPatientData()`
**Was:** one `try { …4 queries… } catch { return data }` wrapper, and each query ignored its
`error`. Any failure (table down, RLS reject, timeout) collapsed to `0`/`false`. For a risk
model, "0 prior readmissions" and "couldn't read the readmissions table" are **clinically
opposite**, and the function reported them identically. No audit log of the failure.
**Now:** each of the 4 sources (`patient_readmissions`, `sdoh_indicators`,
`patient_daily_check_ins`, `care_coordination_plans`) checks its own `error`, logs it via
`createLogger('ai-readmission-predictor')`, and pushes a source name into `warnings[]`. The
function returns `{ data, warnings }`. The HTTP response now carries
`dataCompleteness: { complete, unavailableSources }` and the `message` says **"generated from
PARTIAL data (missing: …)"** when any source failed — so a clinician can never read a degraded
zero as "no risk."
**Acceptance:** ✅ edits applied. ⏳ live proof pending (deno not installed locally; CI deno
check + a real invoke with one table denied should show `dataCompleteness.complete=false`).

### EQ-3 [verified] `ai-soap-note-generator` had no enforced auth — FIXED
**File:** `supabase/functions/ai-soap-note-generator/index.ts`
**Was:** the only `getUser` call was inside `if (!resolvedStyle)` and used **solely** to look up
the physician's writing style — no rejection on missing/invalid token, no role gate, no tenant
check. A SOAP note (synthesized PHI) was generated for any caller who could reach the URL.
**Now:** a full entry gate mirroring `ai-readmission-predictor` — (1) require Bearer → 401;
(2) `getUser` → 401; (3) `RATE_LIMITS.AI` per-user rate limit → 429 (also closes EQ-5 for this
function); (4) load `profiles` (by `user_id`), require `tenant_id` → 403; (5) clinical/admin role
gate via `ALLOWED_SOAP_ROLES` → 403; (6) super-admin cross-tenant check; (7) caller locked to own
tenant → 403; (8) if `patientId` given, verify patient ∈ effective tenant → 403. The style lookup
now reuses the authenticated `user`; usage logging attributes to `effectiveTenantId`.
**Acceptance:** ✅ edits applied, lead-verified consistent (single `user` decl, gate ordering).
⏳ live proof pending (no token → 401; non-clinical role → 403; cross-tenant patient → 403).
**Sweep still owed (EQ-5/§1):** other `ai-*` functions — see sweep commands below.

### EQ-2 [verified] No rate limiting on the readmission predictor — FIXED
**File:** same.
**Was:** authenticated callers could hammer an expensive AI endpoint unbounded. The shared
`_shared/rateLimiter.ts` existed but wasn't called here.
**Now:** `checkRateLimit(user.id, RATE_LIMITS.AI)` (30/60s) runs right after `getUser`, keyed by
**authenticated user id** (not IP), returns `429` with `Retry-After` when exceeded, and logs the
event. Placed before any heavy DB/AI work.
**Acceptance:** ✅ edits applied. ⏳ live proof pending (31 rapid calls → 31st returns 429).

---

## 🔴 TIER 0 — security / patient-safety (need Maria's call where noted)

### EQ-3 — ✅ FIXED 2026-06-07 (Maria-directed). See the DONE-THIS-SESSION section above.
The remaining obligation is the **codebase-wide sweep** of the other `ai-*` functions (EQ-5 / §1)
— `for d in supabase/functions/ai-*/; do grep -Lq "getUser" "$d/index.ts" && echo "$d"; done`.
**Do not assume soap-note + readmission were the only two.**

### EQ-4 [reported] No structured-output validation on AI responses
**Files:** `ai-readmission-predictor`, `ai-soap-note-generator`, likely most `ai-*`.
**Finding:** Claude's JSON output is consumed without schema validation. A hallucinated/missing
field passes straight through to clinical display. Violates CLAUDE.md Rule #16 (structured AI
output) for new/modified functions.
**Fix:** define a JSON schema per function and validate before use (or use Anthropic
`response_format: json_schema`). Grandfathered functions get migrated when next touched.
**Acceptance:** each touched AI function rejects/flags a response missing a required field.

---

## 🟠 TIER 1 — correctness / robustness

### EQ-5 — ✅ DONE 2026-06-17. All 29/29 `ai-*` functions now rate-limited.
**Sweep re-run 2026-06-17:** baseline had improved to 8 covered / 21 missing (more were added
after 2026-06-07). Added the canonical `checkRateLimit(user.id, RATE_LIMITS.AI)` block (429 +
`Retry-After`, keyed off the authenticated user, placed immediately after the auth gate) to all
21 — byte-identical to the deployed `ai-treatment-pathway` reference. 20 use the shared
`requireUser()` pattern (`user`/`logger`/`corsHeaders` already in scope); `ai-billing-suggester`
uses an inline `auth.getUser` + has no `logger`, so its block omits the warn line (no
`console.log` introduced). The 1 remaining "uncovered" by the `checkRateLimit` grep —
`ai-nurseos-burnout-advisor` — already rate-limits via the MCP persistent limiter
(`checkPersistentRateLimit` / `MCP_RATE_LIMITS.claude`, 15/min) = legitimately covered.
**Verify:** sweep → 29/29 rate-limited; brace/paren balance clean on all 21; additions introduce
ZERO `deno check` errors (proven: the deployed-good reference emits the same 26 lockfile-version
errors under local `--no-lock`, none referencing the rate-limit additions; CI runs the real
pinned-deno check). **⏳ Remaining = DEPLOY + live 429 proof.** Per the verify_jwt-reconciliation
tracker, deploy **per-function only (NOT bulk)** — pin each `verify_jwt` in `config.toml` first.
Live acceptance = 31 rapid authenticated calls → 31st returns 429.

---

### EQ-5 (original finding, retained for history) — Rate limiting missing on 27 of 29 AI functions
**SWEEP RUN 2026-06-07 (lead, against actual source). Results corrected a wrong earlier claim.**

**Auth (authentication): 29/29 ai-* functions ARE gated — ZERO wide open.** The earlier tracker
line "~28 exposed" was **WRONG** and is retracted. Most functions use the shared
`requireUser()` helper (`_shared/auth.ts:33`, which calls `supabaseAdmin.auth.getUser(token)` —
real verification); a prior "AI-1-SWEEP" already added these. `ai-soap-note-generator` was the
one genuine outlier (cosmetic `getUser`, now fixed = EQ-3). The original `getUser`-only grep was
the wrong probe — it missed the `requireUser` helper.

**Rate limiting: only 2/29 (`ai-readmission-predictor`, `ai-soap-note-generator`).** The other
**27** have an auth gate but no per-user rate limit on an expensive AI endpoint. This is the
clear, mechanical, safe-to-mass-apply gap.
**Fix:** add the same 3-line `checkRateLimit(<user>.id, RATE_LIMITS.AI)` block to each. Note:
most use `requireUser()` which returns the user object — key the limiter off that, not a fresh
getUser.
**Acceptance:** every ai-* function returns 429 past its window; re-run the sweep → 29/29 ratelimit=yes.

### EQ-5b [verified-coarse] Authorization DEPTH — 10 functions show authN but no in-file role/tenant/patient check
**These verify WHO the caller is but show no role/tenant/patient `authZ` keyword in `index.ts`
(coarse grep — CANDIDATES for review, NOT confirmed holes; some may gate via a context helper):**
`ai-appointment-prep-instructions`, `ai-care-escalation-scorer`, `ai-clinical-guideline-matcher`,
`ai-discharge-summary`, `ai-infection-risk-predictor`, `ai-medication-instructions`,
`ai-medication-reconciliation`, `ai-patient-education`, `ai-progress-note-synthesizer`,
`ai-referral-letter`.
**Why it matters:** `requireUser` proves identity; it does NOT prove the caller may access *this
patient* in *this tenant*. `ai-contraindication-detector` already learned this and added
`requirePatientAccess` (see its "AI-1-SWEEP fix" comment). The 10 above each touch patient data —
each needs a per-function read to confirm whether a `requirePatientAccess`/tenant scope is present
in a sub-module or genuinely missing.
**Fix:** per-function review; add `requirePatientAccess(user, patientId)` where a patient is
addressed. **Do NOT mass-apply blindly — some legitimately operate on tenant-aggregate data.**
**Acceptance:** each of the 10 either has a documented patient/tenant gate or one is added.

### EQ-6 [verified] Rate limiter has a check-then-insert race + silent insert loss
**File:** `supabase/functions/_shared/rateLimiter.ts:40-103`
**Finding:** (a) `count` (lines 41-45) and `insert` (lines 89-99) are **not atomic** — two
concurrent requests can both read count=4 (limit 5) and both insert → 6 recorded. (b) If the
insert fails (line 101) it only `warn`s and lets the request through, so the next window
undercounts. Acceptable for messaging; weak for a hard cap.
**Fix:** move the count+insert into a single `SECURITY DEFINER` Postgres function
(`SET search_path = public`) that does an atomic windowed count-and-insert and returns the
decision; call it via `.rpc()`. Keep fail-open behavior explicit.
**Acceptance:** a concurrency test firing N+5 simultaneous requests admits exactly N.

### EQ-7 [verified] `patientContextService` silently degrades partial failures
**File:** `src/services/patient-context/PatientContextService.ts` (approx. lines 105-150)
**Finding:** sub-fetch failures are downgraded to `warnings[]` and the call still returns
`success`. A consumer reading `timeline` can't tell "patient has no events" from "timeline fetch
was forbidden/timed out." Mirrors the EQ-1 silent-zero class on the client side.
**Fix:** include per-source status in `context_meta` (loaded | empty | failed) so consumers can
distinguish absent-data from failed-fetch; consider failing hard when a *required* source fails.
**Acceptance:** a forced sub-fetch error surfaces as `failed` in `context_meta`, not as silent
absence. **[reported — confirm exact line numbers before editing.]**

### EQ-8 [reported] AI functions have no Claude-API retry / backoff / timeout SLA
**Files:** `ai-soap-note-generator:~231`, others.
**Finding:** non-200 from Claude is logged but not retried; no exponential backoff, no circuit
breaker, no latency alert threshold. A transient Claude blip fails the clinician's request.
**Fix:** wrap the Claude call in a small retry-with-backoff helper in `_shared/` (cap ~2 retries);
log when `responseTime` exceeds a threshold.
**Acceptance:** a simulated one-shot 529 succeeds on retry; latency over threshold logs a warn.

---

## 🟡 TIER 2 — quality / consistency

### EQ-9 [reported] Over-mocked tests — **Maria's flagged irritation**
**What Maria said:** the mock tests Claude Code built irritate her; we're going to fix that.
**Finding:** the suite is ~70% real behavioral tests (genuinely good — e.g.
`useBillingCodeValidation.test.ts` catching 99213-vs-99214 bundling conflicts), but ~30% mock the
**entire** Supabase client (`vi.mock('../../lib/supabaseClient')`). Consequence: **no test hits a
real database**, so if the Supabase SDK changes a response shape the mocks stay green while real
code breaks. The mock simulates the API; it doesn't prove the SQL is right.
**Plan (Maria-directed, do not delete tests):**
1. **Inventory** — `grep -rln "vi.mock.*supabaseClient\|jest.mock.*supabaseClient" src` to list
   every fully-mocked suite; classify each as (a) legitimately a unit test (logic only) vs
   (b) a thing that should be proven against a real DB.
2. **Add a thin live-integration layer** — a small set of tests that run against a real Supabase
   (local stack or the live project read paths) for the highest-value flows: RLS isolation,
   ServiceResult round-trips, FHIR search column correctness. This is the
   `live-integration-testing-tracker.md` direction — cross-reference it.
3. **Keep the unit mocks** for fast logic feedback; the fix is *adding* live proof, not deleting
   mocks. Aligns with the memory `feedback_live_proof_over_mocks`.
**Acceptance:** the top ~5 data flows each have at least one test that fails if the real schema
drifts (i.e., a mock-green / live-red gap is now caught).

### EQ-10 [reported] Claims a "deletion test" standard the suite doesn't contain
**Finding:** governance references a deletion-test standard, but the sub-agent found **zero**
tests that actually assert delete/cascade/soft-vs-hard behavior.
**Note:** "deletion test" in CLAUDE.md is partly the *thought experiment* ("would this test fail
for an empty `<div/>`?") — but actual delete-behavior tests are also genuinely absent.
**Fix:** either (a) add real deletion-behavior tests where delete paths exist, or (b) clarify the
doc wording so the standard isn't over-claimed. **Maria to choose framing.**
**Acceptance:** doc and suite agree.

### EQ-11 [verified] `ServiceResult` is not adopted in edge functions
**Finding:** the discriminated-union `ServiceResult` pattern (`src/services/_base/`) is well-built
and used client-side, but edge functions hand-roll error responses and some `throw`. The promise
"services never throw" doesn't hold across the server boundary.
**Fix:** lower-priority consistency pass — adopt a shared edge-side result/error helper, or
explicitly document that edge functions use raw `Response` by design. **Not urgent.**

### EQ-12 [verified] CORS legacy static `corsHeaders` export is a foot-gun
**File:** `supabase/functions/_shared/cors.ts:233-243`
**Finding:** the static `corsHeaders` export uses `ALLOWED_ORIGINS[0]` / a prod fallback and
**cannot validate the request origin dynamically** (its own comment admits this). Any function
importing it bypasses `corsFromRequest()`'s per-request validation.
**Fix:** grep importers of the static export; migrate them to `corsFromRequest(req)`; then
deprecate/remove the static export.
**Acceptance:** 0 functions import the static `corsHeaders`.

### EQ-13 [reported] `env.ts` does no validation of loaded values
**File:** `supabase/functions/_shared/env.ts:44-53`
**Finding:** `SUPABASE_URL` isn't validated as a URL; `ALLOWED_ORIGINS` is split/trimmed but each
entry isn't checked, so a typo (`httpss://…`) passes silently and fails later at call time.
**Fix:** validate URL shape on load; warn on malformed origins. Low risk, easy.

### EQ-14 [reported] CSP allows `script-src 'unsafe-inline'`
**File:** `supabase/functions/_shared/cors.ts:79`
**Finding:** weakens XSS protection (may be required by hCaptcha). **Confirm hCaptcha need;** if
removable, move to nonce-based inline.

---

## 🔵 TIER 3 — architecture / nice-to-have (Maria's call)

- **EQ-15 [reported]** No shared base-class harness for MCP servers — each `mcp-*` server
  re-implements a near-identical `serve()`/dispatch block. Copy-paste-friendly, not DRY. A
  `_shared` MCP base handler would cut duplication. (Counterpoint: the *tiered init* +
  *validation learning loop* are genuinely well-factored already.)
- **EQ-16 [reported]** No mutation testing / no JSON-RPC contract tests for MCP responses — shape
  regressions can slip through because every test mocks the return.
- **EQ-17 [verified]** `patientContextService` has no caching layer despite a 5-minute freshness
  comment — a hot dashboard re-fetches every call. Add memoization only if profiling shows it
  matters.

---

## Sweep commands (regression-prevention, per `adversarial-audit-lessons.md §1 & §9`)

```bash
# AI functions missing an enforced auth gate (EQ-3):
for d in supabase/functions/ai-*/; do grep -Lq "getUser" "$d/index.ts" 2>/dev/null && echo "NO getUser: $d"; done

# AI functions missing rate limiting (EQ-5):
for d in supabase/functions/ai-*/; do grep -Lq "checkRateLimit\|withRateLimit" "$d/index.ts" 2>/dev/null && echo "NO rate limit: $d"; done

# Fully-mocked Supabase test suites (EQ-9):
grep -rln "vi.mock.*supabaseClient\|jest.mock.*supabaseClient" src --include=*.test.* | sort

# Importers of the foot-gun static corsHeaders (EQ-12):
grep -rln "corsHeaders" supabase/functions --include=*.ts | xargs grep -l "import.*corsHeaders.*cors.ts" 2>/dev/null
```

---

## Cross-references
- `docs/trackers/live-integration-testing-tracker.md` — the home for EQ-9's live-test layer.
- `.claude/rules/adversarial-audit-lessons.md` — §1 (sweep on every fix), §2 (edge-fn auth).
- Memory: `feedback_live_proof_over_mocks`, `feedback_investigate_purpose_before_dead`.
