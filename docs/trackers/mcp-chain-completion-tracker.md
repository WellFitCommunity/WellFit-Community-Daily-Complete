# MCP Chain Completion Tracker — Final Gaps

> **Source:** Code audit of all 16 MCP servers + 6 prior trackers — 2026-03-28
> **Verified by:** Claude Opus 4.6 — all servers read, all prior tracker items cross-referenced
> **Goal:** Close remaining 12 MCP gaps for hospital pilot readiness
> **Estimated total:** ~49 hours across 2 sessions + 1 external blocker
> **Prior trackers:** mcp-completion, mcp-hardening, mcp-blind-spots, mcp-infrastructure-repair, mcp-production-readiness, mcp-server-compliance (all cross-referenced)

---

## Status Summary

| Category | Done | Remaining |
|----------|------|-----------|
| Prior tracker items (6 trackers) | 61/73 | 12 open |
| MCP servers real end-to-end | 15/16 | 1 stub (clearinghouse) |
| Security hardening | — | 3 items (~15h) |
| Revenue/clinical features | — | 4 items (~34h) |
| External blockers | — | 1 (clearinghouse creds) |
| Clinical review | — | 1 (Akima) |
| Deferred by design | — | 1 (tool utilization) |

---

## Session 1 — Security Hardening (Must Fix Before Pilot) (~15 hours)

| # | Gap | Description | Files to Modify | Est. Hours | Status |
|---|-----|-------------|-----------------|-----------|--------|
| MCP-1 | `claude-chat` relay hardening | Open relay with no input sanitization, no mandatory safety system prompt. Any authenticated user can pass arbitrary prompts to Claude API. **HIGH risk.** | `supabase/functions/claude-chat/index.ts` — add mandatory safety system prompt, apply `sanitizeClinicalInput()` to all user messages, apply `strictDeidentify()` before API call, add per-user rate limiting | 4 | TODO |
| MCP-2 | `claude-personalization` injection guard | Accepts arbitrary `prompt` field, uses regex-only PHI redaction (not structural). **MEDIUM risk.** | `supabase/functions/claude-personalization/index.ts` — replace `redact()` with `strictDeidentify()`, wrap prompt in `sanitizeClinicalInput()` XML delimiters, add `CONDENSED_DRIFT_GUARD` to system prompt, log injection detection events | 3 | TODO |
| MCP-3 | Live adversarial testing against Claude API | Guard functions verified in unit tests but Claude's actual obedience to guards is untested against live API. 40 attack prompts against high-risk functions. ~$5-15 API cost. | Test against: `ai-patient-qa-bot`, `ai-soap-note-generator`, `ai-check-in-questions`, `claude-chat`, `claude-personalization`. Document results. | 8 | TODO |

**Session 1 subtotal:** ~15 hours

### Session 1 Notes
- **MCP-1 is the highest priority.** `claude-chat` is a direct relay to Claude with user-supplied system prompts. Hardening pattern: prepend mandatory safety prompt → sanitize user input → deidentify PHI → rate limit → log.
- **MCP-2 uses the same shared utilities** (`sanitizeClinicalInput`, `strictDeidentify`, `CONDENSED_DRIFT_GUARD`) already deployed in other edge functions. This is wiring, not invention.
- **MCP-3 should run after MCP-1 and MCP-2 are deployed.** Send real attack prompts to the hardened functions and verify Claude refuses. Document pass/fail per attack vector.

---

## Session 2 — Revenue & Clinical Features (~34 hours)

| # | Gap | Description | Files to Create/Modify | Est. Hours | Status |
|---|-----|-------------|------------------------|-----------|--------|
| MCP-4 | RPM billing infrastructure | Cannot bill Medicare RPM codes (CPT 99453-99458) for home vital monitoring. Need: enrollment table, device assignment, automated time tracking from check-in vitals, monthly billing summary, integration with 837P claim generation. | New migration: `_rpm_enrollment_tracking.sql`, new: `src/services/rpmBillingService.ts`, modify: `src/services/rpmClaimService.ts` (already exists, needs wiring) | 12 | TODO |
| MCP-5 | Wearable vitals → clinician dashboard | Apple Watch/Fitbit/Garmin data collected in `wearable_vital_signs` but invisible to clinicians. Need: 7/30/90-day vital trend charts, threshold-based alerts (abnormal BP, HR, SpO2, glucose), integration with PatientChartNavigator or DoctorsViewPage. | New: `src/components/admin/WearableVitalsDashboard.tsx`, modify: `src/components/chart/PatientChartNavigator.tsx` (add Wearables tab), new: `src/services/wearableAlertService.ts` | 8 | TODO |
| MCP-6 | Home vitals → FHIR Observation conversion | Check-in vitals and wearable data not converted to FHIR Observations. External EHRs cannot see home-generated vitals via FHIR API. | New: `supabase/functions/convert-vitals-to-fhir/index.ts`, LOINC code mapping (BP: 85354-9, HR: 8867-4, SpO2: 2708-6, glucose: 2345-7, temp: 8310-5, weight: 29463-7), provenance tracking (self-report vs device) | 6 | TODO |
| MCP-7 | Clearinghouse external API | `mcp-clearinghouse-server` is 100% stub. `loadConfig()` returns null. No real API calls to Waystar/Change Healthcare/Availity. **BLOCKED on vendor sandbox credentials.** | `supabase/functions/mcp-clearinghouse-server/client.ts` — wire `loadConfig()` to `clearinghouse_config` table, implement real HTTP calls to clearinghouse API, add credential management | 8-12 | BLOCKED |

**Session 2 subtotal:** ~34 hours (26 buildable + 8-12 blocked)

### Session 2 Notes
- **MCP-4 has partial infrastructure:** `rpmClaimService.ts` already exists, `rpm` encounter type is supported, fee schedule has 2026 CMS RPM rates seeded. The gap is enrollment tracking and automated time calculation.
- **MCP-5 and MCP-6 are connected:** Wearable data needs to be visible to clinicians (MCP-5) AND convertible to FHIR for external systems (MCP-6). Build MCP-5 first (clinician value), then MCP-6 (interop value).
- **MCP-7 remains BLOCKED.** Handler logic is structurally correct — once credentials are wired in, the server should work. No code changes needed until creds arrive.

---

## Non-Code Items (No Session Required)

| # | Gap | Description | Owner | Status |
|---|-----|-------------|-------|--------|
| MCP-8 | Cultural competency clinical review | Akima needs to validate prevalence rates, screening tools, drug interaction warnings, and trust factors across 8 population profiles. | Akima | PENDING |
| MCP-9 | Tool utilization gap (76/94 tools unwired) | 76 of ~140 total tools have no UI consumer. Each unwired tool is untested in production. Acceptable for pilot — tools exist for future integrations. | Deferred | ACCEPTED |

---

## Session 3 — MCP Architecture Hygiene (added 2026-04-21)

> **Source:** Adversarial review of MCP server structure. Namespace collisions, grouper divergence, and missing patient-context MCP identified as structural debt that will hurt AI routing reliability.
>
> **IP NOTE (2026-04-21):** The standalone `mcp-drg-grouper-server` is **patent-track IP** and must NOT be consolidated into `mcp-medical-coding-server`. They serve architecturally distinct roles:
> - **`mcp-drg-grouper-server`** = Revenue Intelligence Engine. Pulls **every billable item across the encounter into focus** — sweeps clinical documentation, identifies missed codes, upgrade opportunities, documentation gaps, modifier suggestions. The grouper is the holistic "what's the ceiling on this encounter's revenue" tool.
> - **`mcp-medical-coding-server`** = Downstream Processor. Receives codes and applies payer rules, charge aggregation, and revenue projection. Does NOT sweep the encounter for missed billables — only processes what is handed to it.
>
> Keep both. Differentiate the implementations so the distinction is visible in code (not just in intent). The DRG assignment logic may share a helper, but the surrounding "revenue sweep" vs "code processor" surfaces remain separate.

| # | Gap | Description | Files to Modify | Est. Hours | Status |
|---|-----|-------------|-----------------|-----------|--------|
| MCP-10 | **Grouper — backport SDK crash fix to standalone server** | `mcp-drg-grouper-server/drgGrouperHandlers.ts` still uses the Anthropic SDK which pulls in a 1.1MB bundle that crashes the Deno worker. `mcp-medical-coding-server` already has the fix (direct `fetch` to `https://api.anthropic.com/v1/messages`). Backport this fix so the standalone grouper runs in production. DO NOT consolidate the servers — they are architecturally distinct (see IP NOTE above). | Modify `supabase/functions/mcp-drg-grouper-server/drgGrouperHandlers.ts` — replace `new Anthropic({ apiKey })` + `anthropic.messages.create(...)` with direct `fetch` call matching the pattern in `mcp-medical-coding-server/drgGrouperHandlers.ts` lines 283-309. Remove `import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0?target=deno"`. Re-run tests. | 2 | **DONE** (commit bef7b264 — also fixed same pattern in revenueOptimizerHandlers.ts) |
| MCP-10b | **Grouper — make the architectural distinction visible in code** | The two servers share ~95% of DRG handler code but serve different purposes (revenue-sweep vs code-processor). Right now the only way to tell them apart is reading the tool name list. Extract the shared DRG 3-pass logic into `_shared/drgThreePassLogic.ts`; have each server wrap it with its own surrounding behavior — standalone grouper adds the full revenue sweep (`flag_revenue_risk`, `validate_coding`, `estimate_reimbursement`); coding server uses it only as a processor step. This preserves IP distinction AND eliminates code drift. | New: `supabase/functions/_shared/drgThreePassLogic.ts` (pure 3-pass AI call + response parsing). Modify both `drgGrouperHandlers.ts` files to call the shared function for the grouping step, but keep their own persistence/surface behavior. Document the architectural distinction in each server's header comment. | 6 | TODO |
| MCP-11 | **Grouper compliance gap — POA indicators** (BOTH servers) | No Present-on-Admission tracking on secondary diagnoses. Medicare HAC policy says certain CC/MCC codes don't count if hospital-acquired. Without POA, CC/MCC upgrades are over-claimed → denial risk + False Claims Act exposure. **Required before billing automation; acceptable for pilot advisory mode.** Apply to BOTH `mcp-drg-grouper-server` AND `mcp-medical-coding-server` DRG handlers (or to the shared helper from MCP-10b if built first). | Modify both `drgGrouperHandlers.ts` files (or shared helper) to require POA flag per secondary diagnosis, update `DRGAnalysisResponse` interface (add `poa_indicator: 'Y'\|'N'\|'U'\|'W'` per secondary), update prompt to extract POA from clinical notes, update `drg_grouping_results` schema to persist POA array, suppress CC/MCC upgrade if POA='N' and code is on HAC list | 8 | TODO |
| MCP-12 | **Grouper compliance gap — authoritative DRG weight lookup** (BOTH servers) | DRG weights currently come from Claude's training data (AI returns `weight: 1.7024` from memory). CMS updates weights every Oct 1. For revenue math this is materially wrong. Need CMS MS-DRG weights table keyed by fiscal year. Override AI-returned weight with authoritative lookup in BOTH servers. | New migration: `_ms_drg_weights_table.sql` with `(fiscal_year, drg_code, weight, mdc_code, mdc_description)`, seed with FY2026 weights from CMS, modify both `drgGrouperHandlers.ts` files (or shared helper) to look up weight from table after AI assigns code (override AI-returned weight), add reconciliation report when AI weight diverges from CMS weight by >5% | 6 | TODO |
| MCP-13 | **Grouper safety gates** — encounter type + age/sex + discharge disposition (BOTH servers) | Handler processes any encounter regardless of type. DRGs are inpatient acute-care only — ED/observation/outpatient should be rejected. Obstetric DRGs (540-782) require female + reproductive age. Newborn DRGs (789-795) require age=0. Discharge disposition required for post-acute transfer adjustments. Apply to BOTH servers. | Modify `handleRunDRGGrouper` in both servers to fetch encounter.type + patient age/sex from profile, reject with clear error if encounter is not inpatient, reject if DRG-range mismatches demographics, require `discharge_disposition` input (or fetch from encounter) | 4 | TODO |
| MCP-14 | **Grouper — clinician ID in cost log, not patient** (codebase-wide) | `claude_usage_logs.user_id` is set to `patient_id` in both `drgGrouperHandlers.ts` files. Should be the authenticated clinician who triggered grouping. PHI in a cost audit trail is a HIPAA § 164.312 violation waiting to happen. Fix all MCP handlers that log usage — this pattern likely exists in sister files. | Modify both grouper `drgGrouperHandlers.ts` files — extract caller user_id from auth context, set `user_id: callerId`, add `patient_id` to metadata instead. Codebase-wide grep: `grep -rn "user_id:\s*patient" supabase/functions/mcp-*/ --include="*.ts"` and fix all sister occurrences (adversarial-audit-lessons.md Rule 1). | 3 | TODO |
| MCP-15 | **Grouper — idempotency / result caching** (BOTH servers) | Re-running grouper on same encounter costs money every time. No check for existing recent result. Apply to BOTH servers. | Modify `handleRunDRGGrouper` in both servers to first query `drg_grouping_results` for the encounter; if a result exists within N hours (default 24) and status != 'preliminary', return existing result unless `force_regroup: true` is passed | 2 | TODO |
| MCP-16 | **Grouper — 600-line violation** | `mcp-medical-coding-server/drgGrouperHandlers.ts` is 607 lines (your own 600-line rule). `mcp-drg-grouper-server/drgGrouperHandlers.ts` is 590 lines (at-risk). If MCP-10b is built first, most of the length moves to the shared helper and both drop below 600 naturally. | If MCP-10b done: verify both handlers are < 600 after extraction. If MCP-10b deferred: extract `buildDRGGrouperPrompt`, `buildClinicalText`, and `DRGAnalysisResponse` interface into sibling files (`drgGrouperPrompt.ts`, `drgGrouperTypes.ts`). Verify `wc -l` on all < 600. | 1 | TODO |
| MCP-17 | **Namespace collision — `check_prior_auth_required`** | Exists in both `mcp-cms-coverage-server/tools.ts` and `mcp-prior-auth-server/tools.ts`. Calling AIs will coin-flip. Semantic difference: cms-coverage checks LCD/NCD rules (is this service covered at all?), prior-auth checks if a specific patient+service requires auth submission. | Rename cms-coverage tool to `check_coverage_auth_policy` (policy-level check). Keep `check_prior_auth_required` only in prior-auth server (patient-specific workflow). Update any callers. | 1 | TODO |
| MCP-18 | **Namespace collision — `submit_prior_auth`** | Exists in both `mcp-clearinghouse-server/tools.ts` and `mcp-prior-auth-server/tools.ts`. Different surfaces: clearinghouse submits via 278 X12 to payer, prior-auth manages internal workflow. Maria already flagged this. | Rename clearinghouse tool to `submit_278_auth_transaction` (transport layer name). Keep `submit_prior_auth` in prior-auth server (workflow layer). Update any callers. | 1 | TODO |
| MCP-19 | **`mcp-claude-server` too generic** | As Anthropic's MCP ecosystem grows, `claude` will conflict with first-party MCP servers named `claude`. Rename to reflect that this is the Atlus reasoning layer (calibrate-confidence, evaluate-escalation-conflict, consolidate-alerts, synthesize-handoff-narrative). | Rename `supabase/functions/mcp-claude-server/` → `supabase/functions/mcp-atlus-reasoning-server/`, update all `mcp__claude__*` tool prefixes → `mcp__atlus_reasoning__*`, update MCP registration, grep for references in src/ and docs/ | 2 | TODO |
| MCP-20 | **Missing `mcp-patient-context-server`** | `patientContextService` is the canonical cross-system read path (Shared Spine S5 in governance-boundaries.md), but it is not exposed as MCP tools. Every other tool that needs patient context re-implements lookups. This is the highest-leverage gap — exposing it makes every other AI reasoning call immediately smarter. | New: `supabase/functions/mcp-patient-context-server/` with tools: `get_patient_context` (full), `get_minimal_context` (demographics only), `get_patient_contacts`, `get_patient_timeline`, `get_patient_risk_summary`, `patient_exists`. Wrap `patientContextService` methods. Include `context_meta` in responses (ATLUS Accountability). | 6 | **DONE** (commit 724249d4) |
| MCP-21 | **Naming confusion — `mcp-medical-codes` vs `mcp-medical-coding`** | Differ by one character. `-codes-server` handles CPT/ICD-10/HCPCS lookups; `-coding-server` handles grouper/payer rules/charge aggregation. The names don't telegraph that difference. | Rename `mcp-medical-codes-server` → `mcp-medical-code-lookup-server` (action-oriented: "looks up codes") OR rename `mcp-medical-coding-server` → `mcp-revenue-coding-server`. Pick one. Update tool prefixes + callers. | 2 | TODO |

**Session 3 subtotal:** ~38 hours (11 items, split as needed)

### Session 3 Notes
- **MCP-10 through MCP-16 are all grouper items** and should be done together in one focused session since they touch the same files.
- **MCP-17, MCP-18, MCP-19, MCP-21 are renames** — cheap but need grep discipline (codebase-wide update + tool registration update + tests).
- **MCP-20 (`mcp-patient-context-server`) is the single highest-leverage item in this tracker.** Exposing `patientContextService` as MCP tools means every AI call across the platform becomes context-aware without re-implementing lookups. Build this first if Session 3 gets sliced up.
- **MCP-14 (clinician vs patient in cost log) may exist in other MCP handlers** — after fixing the grouper, grep for `user_id:.*patient_id` across all `supabase/functions/mcp-*` directories to find sister occurrences. This is an `adversarial-audit-lessons.md` Rule 1 violation.

### Session 3 Regression Checks
```bash
# After MCP-10 — verify SDK crash fix backported (no more @anthropic-ai/sdk import)
grep -rn "@anthropic-ai/sdk" supabase/functions/mcp-drg-grouper-server/ --include="*.ts"  # Should return 0
grep -rn "api.anthropic.com/v1/messages" supabase/functions/mcp-drg-grouper-server/ --include="*.ts"  # Should find direct fetch

# After MCP-10b — verify architectural distinction preserved
ls supabase/functions/mcp-drg-grouper-server/index.ts supabase/functions/mcp-medical-coding-server/index.ts  # Both must exist
ls supabase/functions/_shared/drgThreePassLogic.ts  # Shared helper should exist

# After MCP-14 — verify no PHI in cost logs across all MCP handlers
grep -rn "user_id:\s*patient" supabase/functions/mcp-*/ --include="*.ts"  # Should return 0

# After MCP-17/18 — verify namespace resolution
grep -rn "check_prior_auth_required" supabase/functions/ --include="*.ts" | wc -l  # Should be 1 (prior-auth only)
grep -rn "submit_prior_auth" supabase/functions/ --include="*.ts" | grep -v "submit_278" | wc -l  # Should be 1 (prior-auth only)

# After MCP-19 — verify rename
grep -rn "mcp__claude__" supabase/functions/ src/ --include="*.ts" --include="*.tsx" | wc -l  # Should be 0
grep -rn "mcp__atlus_reasoning__" supabase/functions/ src/ --include="*.ts" --include="*.tsx" | wc -l  # Should match prior count

# After MCP-20 — verify patient context MCP exists and is wired
ls supabase/functions/mcp-patient-context-server/index.ts  # Should exist
grep -rn "mcp__patient_context__get_patient_context" src/ --include="*.ts" --include="*.tsx" | wc -l  # Should be > 0
```

---

## Regression Checks

```bash
# After Session 1 — verify security hardening
grep -r "sanitizeClinicalInput\|strictDeidentify" supabase/functions/claude-chat/ --include="*.ts"  # Should find both
grep -r "CONDENSED_DRIFT_GUARD\|FULL_DRIFT_GUARD" supabase/functions/claude-personalization/ --include="*.ts"  # Should find drift guard
grep -r "rateLimiter\|checkRateLimit" supabase/functions/claude-chat/ --include="*.ts"  # Should find rate limiting

# After Session 2 — verify revenue/clinical features
grep -r "rpm_enrollment\|rpm_billing" supabase/migrations/ --include="*.sql" -l  # Should find RPM migration
grep -r "wearable_vital_signs" src/components/ --include="*.tsx" -l  # Should find dashboard component
grep -r "convert-vitals-to-fhir" supabase/functions/ -l  # Should find edge function directory
grep -r "85354-9\|8867-4\|2708-6" supabase/functions/ --include="*.ts"  # Should find LOINC codes
```

---

## Timeline

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| **1** | Security hardening — claude-chat, claude-personalization, live adversarial testing | MCP-1 through MCP-3 | ~15 | **NEXT** |
| **2** | Revenue — RPM billing, wearable dashboard, FHIR vitals conversion | MCP-4 through MCP-6 | ~26 | PENDING |
| **3a** | Grouper hardening — SDK fix backport, architectural distinction preserved, clinical gates (POA, weights, encounter type, age/sex, cost log PHI, idempotency, god file) | MCP-10, 10b, 11 through 16 | ~32 | PENDING |
| **3b** | Namespace hygiene (collision fixes, claude-server rename, patient-context MCP, medical-codes/coding rename) | MCP-17 through MCP-21 | ~12 | PENDING |
| **—** | Clearinghouse activation (when creds arrive) | MCP-7 | ~8-12 | BLOCKED |
| **—** | Akima clinical review of cultural competency profiles | MCP-8 | 0 code | PENDING |

**Total buildable work:** ~79 hours (4 sessions)
**Blocked work:** ~8-12 hours (clearinghouse, awaiting vendor)
**Non-code work:** Akima review + tool utilization acceptance
