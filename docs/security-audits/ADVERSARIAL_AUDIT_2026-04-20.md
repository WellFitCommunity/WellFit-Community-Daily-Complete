# Adversarial Audit Report — 2026-04-20

> **Automated adversarial scan + auto-repair session**
> **Auditor:** Claude Opus 4.6 (adversarial reviewing agent)
> **Scope:** Full codebase — 169 edge functions, 780K+ lines TypeScript
> **Exclusions:** Clearinghouse MCP server (blocked on vendor credentials)

---

## Executive Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| **CRITICAL** | 4 | 4 | 0 |
| **HIGH** | 3 | 0 | 3 (require Maria's decision) |
| **MEDIUM** | 2 | 0 | 2 |
| **LOW** | 1 | 0 | 1 |
| **Clean** | 6 categories | — | No issues |

**Total files modified:** 29
**profiles.user_id regressions fixed:** 34 occurrences across 27 files

---

## CRITICAL — Fixed

### C-1: `update-profile-note` — Zero Auth + profiles.id Bug

**File:** `supabase/functions/update-profile-note/index.ts`

| Aspect | Before | After |
|--------|--------|-------|
| JWT verification | None | `supabase.auth.getUser(token)` |
| Role gating | None | Roles 1-3 (super_admin, admin, clinical) |
| Tenant isolation | None | Target profile must share caller's tenant_id |
| profiles query | `.eq("id", id)` — wrong PK | `.eq("user_id", id)` — correct PK |
| Input validation | None | Required `id` + `notes` (string) |
| Audit logging | Partial (errors only) | Success + error logging with actor/target |

**Impact before fix:** Any anonymous HTTP client could write arbitrary notes to any patient's profile across all tenants.

### C-2: profiles.user_id Regression — 34 Occurrences in 27 Files

The `profiles` table PK is `user_id`, not `id`. This bug was first fixed in adversarial audit A-9 (2026-03) but regressed massively. `Home.tsx` even had a comment `// ✅ use id, not user_id` actively enshrining the bug as correct.

**Edge functions fixed (9 files, 10 occurrences):**

| File | Line | Context |
|------|------|---------|
| `update-profile-note/index.ts` | 29 | WRITE operation — most critical |
| `ai-care-escalation-scorer/index.ts` | 280 | Patient name/DOB lookup |
| `ai-progress-note-synthesizer/index.ts` | 377 | Patient demographics |
| `ai-fall-risk-predictor/index.ts` | 429 | Patient DOB/gender |
| `ai-infection-risk-predictor/index.ts` | 273 | Patient DOB |
| `ai-referral-letter/index.ts` | 256, 270 | Patient + provider lookup |
| `ai-appointment-prep-instructions/index.ts` | 203 | Patient DOB |
| `ai-missed-checkin-escalation/index.ts` | 274 | Patient emergency contacts |
| `mcp-fhir-server/patientSummary.ts` | 39 | FHIR patient demographics |

**Frontend fixed (18 files, 24 occurrences):**

| File | Line(s) | Context |
|------|---------|---------|
| `Home.tsx` | 28 | User profile load + removed misleading comment |
| `ChangePasswordPage.tsx` | 122 | Password change flag clear |
| `WearableDashboard.tsx` | 194 | Caregiver phone lookup |
| `BedCommandCenter.tsx` | 39 | Tenant ID lookup |
| `authService.ts` | 102 | Login routing profile check |
| `dischargePlanningService.ts` | 244 | Patient DOB |
| `readmissionRiskPredictor.ts` | 621 | Patient chronic conditions |
| `postAcuteTransferService.ts` | 64 | Patient demographics |
| `ccmEligibilityScorer.ts` | 388 | Chronic conditions |
| `readmissionRiskPredictionService.ts` | 442 | Patient DOB |
| `socialDeterminants.ts` | 243 | Patient address |
| `dischargeToWellnessBridge.ts` | 57, 697 | Patient contact info |
| `postDischargeFactors.ts` | 81 | PCP assignment |
| `patientOutreachService.ts` | 98, 431 | Patient phone/name |
| `tenantAssignmentService.ts` | 53, 232 | User profile/tenant |
| `shiftHandoffTimeTracking.ts` | 31 | Tenant ID |
| `readmissionTrackingService.ts` | 269 | Patient existence check |
| `dentalHealthService.ts` | 636 | Patient name |

**Regression check command (run in future sessions):**
```bash
grep -rn "from.*profiles.*\.eq.*['\"]id['\"]" supabase/functions/ src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__
# Expected: 0 results
```

### C-3: `extract-patient-form` — Zero Auth on PHI Extraction

**File:** `supabase/functions/extract-patient-form/index.ts`

| Aspect | Before | After |
|--------|--------|-------|
| JWT verification | None | `supabase.auth.getUser(token)` |
| Role gating | None | Roles 1-3 (super_admin, admin, clinical) |
| PHI protection | Open — SSN, DOB, names extractable by anyone | Clinical role required |

**Impact before fix:** Any HTTP client could submit patient form images and receive extracted PHI (SSN, DOB, insurance numbers) with zero authentication. Also exposed Anthropic API key to billing abuse.

### C-4: `security-alert-processor` — Variable Shadowing + No Auth

**File:** `supabase/functions/security-alert-processor/index.ts`

| Aspect | Before | After |
|--------|--------|-------|
| Variable shadowing | `const SUPABASE_URL = SUPABASE_URL!` (self-reference) | `const INTERNAL_URL = SUPABASE_URL` (no shadowing) |
| Caller verification | None — any HTTP client could trigger | Cron secret or Bearer token required |
| External messaging | Unprotected Twilio/MailerSend/Slack/PagerDuty | Gated behind auth |

---

## HIGH — Remaining (Require Maria's Decision)

### H-1: `vital-threshold-monitor` — No Auth on Clinical Data

**File:** `supabase/functions/vital-threshold-monitor/index.ts`
- Cron-triggered function with no caller verification
- Uses service role to read all RPM enrollments
- **Recommendation:** Add `CRON_SECRET` validation or Supabase cron JWT check

### H-2: `nurse-question-auto-escalate` — No Auth on Clinical Workflow

**File:** `supabase/functions/nurse-question-auto-escalate/index.ts`
- Cron-triggered, modifies `user_questions` status
- **Recommendation:** Add `CRON_SECRET` validation

### H-3: God Files — 28+ Files Exceed 600-Line Limit

Worst offenders (excluding test files and `database.generated.ts`):

| File | Lines |
|------|-------|
| `readmissionRiskPredictor.ts` | 1,340 |
| `healthcareIntegrationsService.ts` | 1,258 |
| `hospitalWorkforceService.ts` | 1,217 |
| `claudeService.ts` | 1,100 |
| `epcsService.ts` | 1,134 |
| `antimicrobialSurveillanceService.ts` | 1,147 |
| `ecrService.ts` | 1,119 |
| `fhirInteroperabilityIntegrator.ts` | 1,081 |
| `mcpHL7X12Client.ts` | 1,017 |
| `mpiMatchingService.ts` | 1,010 |

**Recommendation:** Multi-session decomposition effort. Not a surgical fix.

---

## MEDIUM — Remaining

### M-1: `prometheus-metrics` Uses `SUPABASE_URL` Without SB_URL Fallback

**File:** `supabase/functions/prometheus-metrics/index.ts:55`
- Uses `Deno.env.get('SUPABASE_URL')` — should prefer `SB_URL`
- Low risk until legacy keys are fully deprecated

### M-2: PROJECT_STATE.md Stale

- Last updated 2026-03-28 (23 days ago)
- MCP-1/MCP-2 completed in commit `7d267332` but tracker shows "NEXT"
- **Updated in this session** (see below)

---

## LOW — Remaining

### L-1: `test-users` and `test_users` Both Exist

Both directories exist under `supabase/functions/`. Supabase uses directory names for invocation — the underscore version follows the wrong convention. Maria should decide which to keep/remove.

---

## Clean Categories (No Issues Found)

| Category | Result |
|----------|--------|
| `any` type violations in `src/` | 0 |
| `console.log` in production `src/` | 0 |
| CORS wildcards in edge functions | 0 |
| Function name mismatches (underscore invocations) | 0 |
| `security_invoker` on recent views | All correct |
| Stale `SUPABASE_*` env vars in new code | 0 (only legacy fallback chains) |

---

## Verification Checkpoint

```
✅ typecheck (scoped): 0 errors in 18 changed files
✅ lint: 0 errors, 0 warnings
✅ tests: 11,726 passed, 0 failed (583 suites)
```
