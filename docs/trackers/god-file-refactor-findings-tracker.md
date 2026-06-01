# God-File Refactor Findings Tracker

> **Created:** 2026-06-01
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **Origin:** Surfaced while decomposing the Tier-1 top-10 service god files (2026-06-01).
> These are latent issues found by *reading* the code during decomposition — they were
> moved verbatim, so the decomposition commits did **not** change any of this behavior.

## Context

The 10 Tier-1 service decompositions were pure structural refactors (verbatim moves,
re-exported public surface, every consumer unchanged). While reading each file in full,
the following correctness / safety / hygiene issues were observed. None were fixed in the
decomposition commits. This tracker captures them with exact file:line refs and the fix.

Severity: **P1** = correctness/compliance defect that reads as a finished feature ·
**P2** = silent failure / injection-surface · **P3** = hygiene / debt.

---

## P1 — Defects that look done but aren't

### RF-1 — EPCS two-factor auth auto-approves any 6–8 digit token
- **File:** `src/services/epcs/twoFactor.ts:48-52`
- **What:** `verifyTwoFactorAuth` returns `{ valid: true }` for **any** token matching `/^\d{6,8}$/`. The comment says "in production, this would call the actual 2FA provider," but nothing prevents the simulated path from running in production. For a DEA EPCS signing control (21 CFR 1311.120) this is a stub masquerading as a security control.
- **Blast radius:** LOW today — `EPCSService` / `signPrescription` are **not wired to any live UI or hook** (only tests import the service). So failing closed will not break a real user flow.
- **Fix (interim, defensible):** Fail closed in production. Gate the simulated branch behind an explicit dev flag (`import.meta.env.MODE !== 'production'` AND `VITE_EPCS_SIMULATE_TFA === 'true'`); in production return `{ valid: false, reason: 'TFA provider not configured' }`. Shipping auto-approve fake 2FA is strictly worse than failing closed.
- **Fix (full, deferred — needs Maria/vendor):** Integrate a real TFA provider (RSA/Symantec/Duo) or route signing through a server-side edge function that performs real verification. Product/vendor decision.
- **Acceptance:** in `production` mode the function never returns `valid:true` from the simulated path; a unit test asserts production fail-closed; dev/test behavior unchanged.

### RF-2 — `getEPCSStats` signedCount operator-precedence bug
- **File:** `src/services/epcs/stats.ts:58`
- **What:** `signedCount: byStatus['signed'] || 0 + (byStatus['transmitted'] || 0) + (byStatus['filled'] || 0)`. `+` binds tighter than `||`, so this parses as `signed || (0 + transmitted + filled)` — if `signed` is 0 it returns transmitted+filled; if nonzero it ignores the other two. Intended: sum of all three.
- **Fix:** `(byStatus['signed'] || 0) + (byStatus['transmitted'] || 0) + (byStatus['filled'] || 0)`.
- **Acceptance:** unit test with signed=2, transmitted=3, filled=1 → signedCount=6.

### RF-3 — `CostTracker.checkBudgetAlerts` claims to alert but is a no-op
- **File:** `src/services/claude/costTracker.ts:51-55`
- **What:** computes `percentUsed`, then `if (percentUsed >= 80) { /* "Budget alert logged via auditLogger" */ }` — empty block. The comment asserts behavior that does not happen; an AI/maintainer reading it will think budget alerting exists.
- **Fix:** actually emit `auditLogger.warn('CLAUDE_BUDGET_ALERT', { userId, percentUsed })` at ≥80%. (CostTracker must import `auditLogger`.) Make `checkBudgetAlerts` async or fire-and-forget consistently with its caller.
- **Acceptance:** crossing 80% monthly spend produces an audit warn entry (test via mock).

---

## P2 — Silent failure & injection surface

### RF-4 — FHIR sub-resource fetch failures are indistinguishable from "no data"
- **File:** `src/services/fhir-integrator/fhirClient.ts:47,55,63`
- **What:** in `fetchPatientDataFromFHIR`, a non-OK response for Observation/Immunization/CarePlan falls back to `{ entry: [] }` silently. A 500 from the FHIR server looks identical to "patient has none." Same class of bug as the ccda-export vitals drop Maria caught 2026-05-29.
- **Fix:** when a sub-resource response is not OK, log `auditLogger.warn('FHIR_SUBRESOURCE_FETCH_FAILED', { resource, status })` before falling back, so the gap is visible. (Keep the graceful fallback — don't fail the whole import on one sub-resource — but make it observable.)
- **Acceptance:** a non-OK observations response emits a warn with the status code; import still proceeds.

### RF-5 — FHIR audit/security logging swallows write failures
- **File:** `src/services/fhir-integrator/audit.ts:20-22, 34-36`
- **What:** `logAuditEvent` / `logSecurityEvent` insert into `audit_logs` / `security_events` and on failure run an empty `catch {}`. An audit-write failure during a PHI import vanishes — wrong tradeoff for SOC 2.
- **Fix:** in the catch, record the failure via the app `auditLogger.error('FHIR_AUDIT_WRITE_FAILED', ...)` (a different sink) so a dropped audit write is itself audited. Still don't throw (don't fail the main op).
- **Acceptance:** a forced insert error produces an `auditLogger.error` call (test via mock).

### RF-6 — MPI blocking filter built by raw string interpolation
- **File:** `src/services/mpi/identity.ts:147,158` (`date_of_birth.eq.${criteria.dateOfBirth}`, `mrn.eq.${criteria.mrn}`)
- **What:** `findPotentialMatches` interpolates `dateOfBirth` and `mrn` straight into a PostgREST `.or()` filter string. soundex/phone are sanitized; these two are not. A comma or PostgREST meta-char in `mrn` can alter or break the filter structure (filter-structure injection, not classic SQLi).
- **Fix:** validate before interpolating — `dateOfBirth` must match `^\d{4}-\d{2}-\d{2}$`; `mrn` stripped to a safe charset (`[^A-Za-z0-9._-]` removed) or rejected if it contains PostgREST meta-chars (`,(){}`). Skip the blocking condition if validation fails.
- **Acceptance:** an MRN containing `,` or `(` does not reach the `.or()` string unsanitized; a unit test covers it.

---

## P3 — Hygiene / debt

### RF-7 — Duplicated CDA/HL7 formatters across two public-health services
- **Files:** `src/services/publicHealth/antimicrobial-surveillance/cdaDocuments.ts:340,344,359...` and `src/services/publicHealth/ecr/eicrDocument.ts:456,464,479...`
- **What:** byte-identical `escapeXml`, `formatHL7DateTime`, `formatHL7Date`, `formatDisplayDate`, `generateDocumentId`, and a `CODE_SYSTEMS` OID map exist in both. Both are public-health CDA generators.
- **Fix:** extract a shared `src/services/publicHealth/cda/formatters.ts` (+ shared CODE_SYSTEMS) and import from both. Behavior-neutral.
- **Acceptance:** one copy of each formatter; both services import it; existing tests for both still green.

### RF-8 — `parseRiskAnalysis` regex-scrapes clinical risk from LLM prose
- **File:** `src/services/claude/formatters.ts:156` (`analysis.match(/(LOW|MODERATE|HIGH|CRITICAL)/i)`)
- **What:** clinical risk level + risk factors + recommendations are extracted from free-text LLM output via regex + bullet heuristics. Brittle; exactly the pattern Rule #16 (structured AI output) exists to eliminate. Grandfathered, but clinical.
- **Fix (deferred — feature change, needs Maria):** migrate the underlying Claude call to a JSON response schema (risk_level enum, factors[], recommendations[]) and drop the regex parser. Requires the `claude-chat` edge function to support `response_format` / structured output. Not mechanical.
- **Acceptance:** risk analysis returns structured fields from a schema, not regex.

### RF-9 — Service singletons instantiate at module import
- **Files:** `claudeService.ts` (`claudeService = ClaudeService.getInstance()`), `fhirInteroperabilityIntegrator.ts` (`new FHIRInteroperabilityIntegrator()` → `new FHIRIntegrationService()`), `mcpHL7X12Client.ts` (`hl7x12MCP`), `mpiMatchingService.ts`.
- **What:** importing the module runs the constructor (side effects at import). Minor; complicates isolated import in tests/SSR.
- **Fix (deferred — low value):** consider lazy `getInstance()` accessors. Document as accepted if not worth the churn.
- **Acceptance:** N/A unless prioritized.

---

## Execution order

1. **RF-2** (stats bug — trivial, mechanical) ✅ start
2. **RF-1** (EPCS 2FA fail-closed — defensible interim)
3. **RF-3** (budget alert no-op → real warn)
4. **RF-4** (FHIR silent drop → warn)
5. **RF-5** (FHIR audit swallow → audited)
6. **RF-6** (MPI filter validation)
7. **RF-7** (CDA formatter dedup)
8. **RF-8, RF-9** — DEFERRED (need Maria / feature work). Left documented above.

Each fix: scoped typecheck + lint + the affected test suite, committed individually.
