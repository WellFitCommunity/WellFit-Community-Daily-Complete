# Tech Debt Elimination Tracker

> **Zero tech debt is WellFit's claim to fame. This tracker ensures we get there.**

**Created:** 2026-03-12
**Priority:** P1 — CI/CD pipeline fails on governance checks until resolved
**Estimated effort:** 5-8 sessions (175 files over 600 lines + any type cleanup)

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| Files over 600 lines | 175 | In progress |
| `any` type violations | 1 (fixed this session) | DONE |
| `console.log` violations | 0 | Clean |
| CORS/CSP wildcards | 0 | Clean |
| `process.env.REACT_APP_*` | 0 | Clean |
| `forwardRef` usage | 0 | Clean |

---

## Track 1: `any` Type Elimination

| # | File | Line | Pattern | Status |
|---|------|------|---------|--------|
| 1 | `src/routes/lazyComponents.tsx` | 269 | `Record<string, React.LazyExoticComponent<React.ComponentType<any>>>` | DONE (2026-03-12) — replaced with `Record<string, unknown>` |

**Goal:** Zero `any` types in production code. Currently at 0 violations after fix.

---

## Track 2: 600-Line File Decomposition

All files must be decomposed using the **barrel re-export pattern** proven on:
- `CommunityMoments.tsx` (941 → 7 files, max 376 lines) — 2026-03-12
- `SelfReportingPage.tsx` (867 → 6 files, max 407 lines) — 2026-03-12
- `fhirResourceService.ts` (3,498 → 14 modules) — previous session

### Priority: Tier 1 (over 1,000 lines — biggest offenders)

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | `src/services/ai/readmissionRiskPredictor.ts` | 1,302 | TODO |
| 2 | `src/services/healthcareIntegrationsService.ts` | 1,258 | TODO |
| 3 | `src/services/hospitalWorkforceService.ts` | 1,217 | TODO |
| 4 | `src/pages/TenantITDashboard.tsx` | 1,171 | TODO |
| 5 | `src/services/publicHealth/antimicrobialSurveillanceService.ts` | 1,147 | TODO |
| 6 | `src/services/epcsService.ts` | 1,134 | TODO |
| 7 | `src/services/publicHealth/ecrService.ts` | 1,119 | TODO |
| 8 | `src/services/claudeService.ts` | 1,100 | TODO |
| 9 | `src/services/fhirInteroperabilityIntegrator.ts` | 1,081 | TODO |
| 10 | `src/components/admin/SOC2ComplianceDashboard.tsx` | 1,062 | TODO |
| 11 | `src/components/admin/FhirAiDashboard.tsx` | 1,038 | TODO |
| 12 | `src/components/admin/AIFinancialDashboard.tsx` | 1,021 | TODO |
| 13 | `src/services/mcp/mcpHL7X12Client.ts` | 1,017 | TODO |
| 14 | `src/services/mpiMatchingService.ts` | 1,010 | TODO |
| 15 | `src/services/publicHealth/immunizationRegistryService.ts` | 997 | TODO |
| 16 | `src/components/admin/TemplateMaker.tsx` | 988 | TODO |
| 17 | `src/services/fhirSyncIntegration.ts` | 973 | TODO |
| 18 | `src/pages/EnvisionLoginPage.tsx` | 971 | TODO |
| 19 | `src/services/guardian-agent/ExecutionSandbox.ts` | 967 | TODO |
| 20 | `src/components/admin/UsersList.tsx` | 967 | TODO |

### Priority: Tier 2 (601-999 lines)

Remaining ~155 files between 601-999 lines. Full list available via:
```bash
bash scripts/governance-check.sh 2>&1 | grep "FAIL.*600-line" -A 200
```

---

## Decomposition Pattern (Mandatory)

```
# BEFORE: One god file
src/services/myService.ts (1,200 lines)

# AFTER: Modular architecture
src/services/my-service/
├── index.ts              # Barrel re-export (thin)
├── SubModule1.ts         # Focused responsibility (~200 lines)
├── SubModule2.ts         # Focused responsibility (~200 lines)
├── types.ts              # Shared interfaces
└── utils.ts              # Shared helpers (if needed)

# Original file becomes thin re-export:
src/services/myService.ts → export { ... } from './my-service';
```

### Rules
1. **Zero breaking changes** — barrel re-export preserves all import paths
2. **No file over 600 lines** — verify with `wc -l`
3. **No functionality loss** — all features preserved
4. **Scoped typecheck must pass** — `bash scripts/typecheck-changed.sh`
5. **All tests must pass** — `npm test`

---

## Session Plan

| Session | Target | Files | Estimated Hours |
|---------|--------|-------|-----------------|
| 1 | Tier 1 items 1-5 | 5 largest files | ~8 hours |
| 2 | Tier 1 items 6-10 | Next 5 files | ~8 hours |
| 3 | Tier 1 items 11-15 | Next 5 files | ~8 hours |
| 4 | Tier 1 items 16-20 | Last 5 Tier 1 files | ~8 hours |
| 5-8 | Tier 2 | ~155 files (601-999 lines) | ~8 hours each |

**After completion:** governance-check.sh passes with 0 file size violations.

---

## Done Log

| Date | What | By |
|------|------|----|
| 2026-03-12 | `CommunityMoments.tsx` decomposed (941 → 7 files) | Claude |
| 2026-03-12 | `SelfReportingPage.tsx` decomposed (867 → 6 files) | Claude |
| 2026-03-12 | `lazyComponents.tsx` `any` type eliminated | Claude |
| 2026-03-12 | `VoiceSearchOverlay.tsx` CI/CD fix (missing EntityType entries) | Claude |
