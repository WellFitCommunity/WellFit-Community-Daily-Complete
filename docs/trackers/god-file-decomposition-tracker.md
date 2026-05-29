# God File Decomposition Tracker

> **Last Updated:** 2026-05-29 (bulk-export decomposed — see row 4)
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **Estimated Effort:** ~40–60 hours across 15–20 sessions (spread over months — not a sprint)
> **Governance Rule:** CLAUDE.md Commandment #12 — 600 line max per file

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| TODO | Not started |
| IN PROGRESS | Decomposition underway in a branch |
| DONE | File now ≤ 600 lines + tests pass + barrel re-exports preserve all import paths |
| DEFER | Intentionally not decomposing (justification required in note column) |

---

## Why This Exists

The 600-line rule is enforced in CLAUDE.md but **two enforcement gaps** were discovered 2026-05-20:

1. `scripts/governance-check.sh` only fails on NEW god files, baselines pre-existing ones (`scripts/god-file-baseline.txt`)
2. The governance scripts do not scan `supabase/functions/` at all — **21 edge functions over 600 lines are invisible to enforcement**

This tracker is the affirmative work to shrink the baseline. It is NOT a refactor sprint — it is steady incremental decomposition tied to whatever feature work touches each file. When you open a god file to add a feature, leave it smaller than you found it.

---

## Current State (verified 2026-05-20 via `find + wc`)

| Bucket | src/ count | Notes |
|--------|------------|-------|
| 600–799 lines | 117 | Easiest tier — extract one cohesive sub-module each |
| 800–999 lines | 36 | Usually a service + 2-3 helper modules can split out |
| 1000–1499 lines | 10 | Real architectural decomposition needed |
| 1500+ lines | 0 | None — that's the good news |
| **Total src/ god files** | **163** | |

| Bucket | supabase/functions/ count | Notes |
|--------|---------------------------|-------|
| 600–799 lines | 14 | Likely toolHandlers split candidates |
| 800–999 lines | 7 | Real surgery |
| 1000+ lines | 0 | |
| **Total edge function god files** | **21** | |

**Grand total: 184 files over 600 lines across both code surfaces.**

---

## Priority Tier 1 — Top 10 Largest in src/ (start here)

These are the biggest offenders. Each one's decomposition unblocks several smaller ones in the same domain because shared sub-modules emerge.

| # | File | Lines | Domain | Status |
|---|------|-------|--------|--------|
| 1 | `src/services/ai/readmissionRiskPredictor.ts` | 1340 | AI clinical | TODO |
| 2 | `src/services/healthcareIntegrationsService.ts` | 1258 | Integration | TODO |
| 3 | `src/services/hospitalWorkforceService.ts` | 1217 | Workforce | TODO |
| 4 | `src/services/publicHealth/antimicrobialSurveillanceService.ts` | 1147 | Public health | TODO |
| 5 | `src/services/epcsService.ts` | 1134 | EPCS | TODO |
| 6 | `src/services/publicHealth/ecrService.ts` | 1119 | Public health | TODO |
| 7 | `src/services/claudeService.ts` | 1100 | AI core | TODO |
| 8 | `src/services/fhirInteroperabilityIntegrator.ts` | 1081 | FHIR | TODO |
| 9 | `src/services/mcp/mcpHL7X12Client.ts` | 1017 | MCP client | TODO |
| 10 | `src/services/mpiMatchingService.ts` | 1010 | MPI | TODO |

### Frontend god files (separately tracked — components, not services)

The src/ count above is service-heavy. Largest frontend god file deserves its own callout because it's tied to a pitch asset:

| # | File | Lines | Notes | Status |
|---|------|-------|-------|--------|
| F1 | `src/components/migration/EnterpriseMigrationDashboard.tsx` | 931 | Operator UI for the Intelligent Migration Engine (patent-pending IP). Largest single component file. Decompose into: panel-per-feature (lineage, snapshot, retry, workflow, quality, dedup) + shared types + barrel re-export. | TODO |
| F2 | `src/services/guardian-agent/AISystemRecorder.ts` | 667 | rrweb-based DOM recorder for Guardian Eyes. Decompose into: recorder lifecycle, snapshot batching, storage upload, security event filtering, performance metric collection — each with own tests. | TODO |

---

## Priority Tier 2 — Top 10 Largest Edge Functions

The governance script does not scan these. They are production server code and equally subject to the 600-line rule.

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | `supabase/functions/ai-treatment-pathway/index.ts` | 990 | TODO |
| 2 | `supabase/functions/ai-progress-note-synthesizer/index.ts` | 962 | TODO |
| 3 | `supabase/functions/ai-infection-risk-predictor/index.ts` | 958 | TODO |
| 4 | `supabase/functions/bulk-export/index.ts` | ~~868~~ → 175 | **DONE** (`ad1d4c0a`, 2026-05-29) — 6 modules all <600 + `_shared/exportColumns.ts`; repaired export_jobs drift + ONC-10 integrity |
| 5 | `supabase/functions/ai-missed-checkin-escalation/index.ts` | 848 | TODO |
| 6 | `supabase/functions/ccda-export/index.ts` | 836 | **NEXT** — ONC-10 ccda path. Verify live schema first (bulk-export had hidden drift). |
| 7 | `supabase/functions/ai-fall-risk-predictor/index.ts` | 807 | TODO |
| 8 | `supabase/functions/ai-care-escalation-scorer/index.ts` | 793 | TODO |
| 9 | `supabase/functions/pdf-health-summary/index.ts` | 776 | TODO |
| 10 | `supabase/functions/_shared/promptABTesting.ts` | 750 | TODO |

---

## Decomposition Pattern (from CLAUDE.md)

```
src/components/feature-name/
├── FeatureName.tsx           # Main component — under 600 lines
├── FeatureNameForm.tsx       # Extracted sub-component
├── FeatureNameList.tsx       # Extracted sub-component
├── FeatureName.types.ts      # Shared types
├── FeatureName.hooks.ts      # Extracted hooks
├── __tests__/                # Tests for everything above
└── index.ts                  # Barrel re-export — preserves existing import paths
```

For services: same idea — `feature-name/` directory with `index.ts` barrel, sub-modules by responsibility.

**Non-negotiable invariants:**
- All existing import paths must continue to work (barrel re-export)
- Test suite must still pass (zero regressions)
- `bash scripts/typecheck-changed.sh` clean
- No file ends up over 600 lines

---

## Enforcement Gap to Close

The current governance scripts don't catch all god files. To fix this:

1. **Add edge function scanning to `governance-check.sh` and `governance-drift-check.sh`** — currently only `src/` is scanned. Add `supabase/functions/` with the same exclusion list (no `__tests__`, no `*.test.*`).
2. **Extend the baseline file** — `scripts/god-file-baseline.txt` should grow a second section for edge functions, or split into two files (`god-file-baseline-src.txt` + `god-file-baseline-functions.txt`).
3. **Remove from baseline on decomposition** — every time a file drops below 600 lines, remove it from the baseline. The baseline should monotonically shrink.

This enforcement gap closure is its own line item in the weekly housekeeping.

---

## Session Cadence

Don't make this a dedicated sprint — it never gets prioritized that way. Instead:

- Every time you open a god file for any reason (bug, feature, audit), **decompose it before leaving**
- If the surrounding work doesn't allow it, log the file + reason in a "deferred this session" note in the commit message
- One **deliberate decomposition session per month** to tackle one Tier 1 item

At ~1 file per month deliberate + ~2 files per month opportunistic = ~36 files per year. The baseline will halve in ~2.5 years at that pace. That is OK — the rule was always about preventing growth, not erasing history overnight.

---

## Cross-References

- `CLAUDE.md` Commandment #12: "No god files - 600 line max per file"
- `scripts/governance-check.sh`: enforces no NEW god files
- `scripts/governance-drift-check.sh`: now reports current baselined files (post 2026-05-20 fix)
- `scripts/god-file-baseline.txt`: 166-line registry of pre-existing src/ files
