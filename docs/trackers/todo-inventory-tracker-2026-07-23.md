# TODO Inventory Tracker — 2026-07-23

> **Source:** Full-repo TODO/FIXME/HACK sweep (Claude Fable 5, 2026-07-23 session)
> **Scope:** `src/` + `supabase/functions/` production code (test files excluded)
> **Total findings:** 10 TODOs. Zero FIXME. Zero HACK. No hidden "temporary fix" landmines found.
> **Estimated total:** ~6–10 hours, 1–2 sessions (T-1 is the bulk; T-2/T-3 are bookkeeping; T-4 rides the Guardian autonomy decision)

Every TODO in production code was read in context and traced to its callers before being classified. Three buckets: one real placeholder in a live user path, six `SELECT *` deferrals (two of which should be closed as design decisions, not fixed), and three roadmap doc-blocks on the Guardian agent.

---

## T-1 — Server-side OCR placeholder in photo-upload vitals path (THE ONE THAT MATTERS)

| Field | Detail |
|---|---|
| Location | `supabase/functions/process-vital-image/index.ts:268` (`performOCR()`) |
| Current behavior | `performOCR()` is a stub: logs image size, then `throw new Error('OCR_CLIENT_SIDE_REQUIRED')` (line 280). The handler catches that exact message (line 408) and returns `{ error: "ocr_client_required" }` (line 417). |
| Client handling (verified intact) | `src/components/vitals/VitalCapture.tsx:270` checks `processResult?.error === 'ocr_client_required'` → shows "Image processing is not available. Please enter your numbers manually." and switches to manual entry. Error-code mapping between edge fn and client confirmed end-to-end. |
| What still works | The live **camera-scan** path uses real client-side Tesseract.js (`src/components/vitals/useCameraScan.ts`; `tesseract.js` is in `package.json`). Nothing is broken. |
| The actual gap | The **photo-upload → auto-read** feature does not exist server-side. Every upload ends in manual entry. A senior who taps "upload photo" gets a working-but-disappointing dead end. The upload flow also creates a `temp_image_jobs` row + storage upload (`VitalCapture.tsx:235–257`) that serves no purpose if OCR never runs. |
| Status | **OPEN — needs Maria's product decision (Tier 3: touches an edge function + a user workflow)** |

### Decision required (pick one)

**Option A — Build server OCR (recommended if the upload button stays):**
- Route the image through Claude vision in the edge function (consistent with `medication-image-extraction`'s existing AI-label-scanning pattern) OR bundle Tesseract WASM in Deno.
- Claude-vision route is the better fit: the parsing helpers (`parseBloodPressure`, `parseGlucose`, `parseTemperature`, etc.) already exist in the file to validate/clamp whatever text comes back; a vision model handles seven-segment LCD displays (BP cuffs, glucometers) far better than Tesseract does.
- Requirements if built: pin the model ID (Commandment #14), define a JSON response schema (Commandment #16), register in `ai_skills` with `patient_description`, keep the existing physiological-range clamps as the validation gate, rate-limit (image AI is expensive).
- Acceptance: upload a synthetic BP-monitor photo → reading auto-populates in `VitalCapture` confirm screen → row persists with `tenant_id` + audit log fires. Live round-trip, not mocks (DONE MEANS DONE).
- Estimate: ~4 hours, 1 session.

**Option B — Retire the upload button:**
- Remove the photo-upload input from `VitalCapture.tsx` (keep camera-scan + manual entry), remove the now-orphaned `temp_image_jobs` insert + storage upload from that path, and delete or annotate `performOCR()` as intentionally client-side-only.
- Acceptance: no UI path reaches `process-vital-image` expecting server OCR; camera scan and manual entry still work.
- Estimate: ~1 hour.

---

## T-2 — `SELECT *` deferrals that are real work (3 sites, one file)

| # | Location | TODO text (paraphrase) | Risk |
|---|---|---|---|
| T-2a | `src/services/engagementTracking.ts:210` | replace `*` with specific `user_questions` columns when usage is traced | Low — engagement data, not PHI |
| T-2b | `src/services/engagementTracking.ts:271` | specify columns when usage is traced | Low |
| T-2c | `src/services/engagementTracking.ts:294` | specify columns when usage is traced | Low |

**Work:** Trace each call site's actual consumers, replace `select('*')` with the explicit column list, type the result (kill the `Record<string, unknown>` returns).
**Acceptance:** zero `select('*')` in `engagementTracking.ts`; scoped typecheck + existing tests green; consumers verified against the narrowed columns (grep every caller — codebase-wide-grep rule).
**Estimate:** ~1.5 hours total.
**Status:** OPEN — Tier 1/2, no approval needed, safe to fold into any session touching engagement code.

## T-3 — `SELECT *` "TODOs" that are actually design decisions — ratify and close (3 sites)

| # | Location | Why it's design, not debt |
|---|---|---|
| T-3a | `src/services/fhirSyncIntegration.ts:618` | FHIR Bundle generation genuinely requires the full resource — every column IS the payload |
| T-3b | `src/services/fhirBulkExportService.ts:346` | Bulk NDJSON export over dynamic table names — full export is the feature's contract |
| T-3c | `src/api/fhirSearch.ts:68` | Polymorphic FHIR resource search across resource types — column set varies by table |

**Work:** Do NOT "fix" these. Rewrite each TODO comment as a design annotation stating why full-row select is intentional (e.g. `// INTENTIONAL full-row select: FHIR Bundle requires the complete resource; exception to no-SELECT-* rule`), so future sessions (and future audits) stop re-flagging them.
**Acceptance:** the three comments no longer contain the string `TODO`; each states the rationale; no query behavior changes.
**Estimate:** ~15 minutes.
**Status:** OPEN — needs Maria's one-line ratification that these are accepted exceptions to the no-`SELECT *` rule (they export PHI by design, so the exception deserves an explicit sign-off, not a silent one).

---

## T-4 — Guardian-agent roadmap doc-blocks (3 files — NOT defects, tracked for the autonomy decision)

These are end-of-file `✅ IMPLEMENTED / 🔲 TODO (Future Enhancements)` documentation blocks on a functional system. Nothing is stubbed; the ✅ lists are real (verified: SHA-256 checksums with constant-time comparison, resource limits, audit logging all present in code).

| # | Location | Future-enhancement items listed |
|---|---|---|
| T-4a | `src/services/guardian-agent/ExecutionSandbox.ts:948` | True process isolation (Web Workers / WASM), enhanced FS isolation, CPU-time enforcement, deeper security scanning |
| T-4b | `src/services/guardian-agent/ToolRegistry.ts:712` | **Tool signing (RS256/ES256 + X.509)**, **runtime capability enforcement**, tool versioning/rollback, tool marketplace |
| T-4c | `src/services/guardian-agent/SchemaValidator.ts:834` | Zod auto-generation from TS types, schema versioning, business-rule validators |

**Relevance:** If/when Maria green-lights overnight Guardian auto-heal (see `project_guardian_autoheal_direction` — awaiting autonomy-tier call), **T-4b's tool signing + capability enforcement are the two prerequisites** — they are the trust boundary for autonomous execution. Until that call, these stay parked.
**Status:** PARKED — blocked on the Guardian autonomy-tier decision. Do not start speculatively.

## Sole other edge-function TODO

The `supabase/functions/` sweep found exactly one TODO — it is T-1 above. No others exist.

---

## Regression check (re-run any session to verify this tracker stays current)

```bash
grep -rn "TODO\|FIXME\|HACK" src --include="*.ts" --include="*.tsx" | grep -v test
grep -rn "TODO\|FIXME\|HACK" supabase/functions --include="*.ts"
```

Expected after T-1/T-2/T-3 complete: only the three T-4 doc-blocks remain (or zero, if Guardian autonomy work lands).

## Summary

| Item | Type | Effort | Blocked on |
|---|---|---|---|
| T-1 server OCR placeholder | Real gap in live user path | 4h (build) or 1h (retire) | Maria: Option A vs B |
| T-2 engagementTracking columns | Bookkeeping | 1.5h | Nothing |
| T-3 FHIR full-select ratification | Comment rewrite | 15min | Maria: one-line sign-off |
| T-4 Guardian enhancements | Roadmap | — | Guardian autonomy-tier decision |
