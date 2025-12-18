# ESLint Technical Debt Report

**Generated:** 2025-12-17
**Last Updated:** 2025-12-18
**Total Issues:** 2,140 warnings (down from 2,733)
**Status:** Recovered from sub-agent errors; cleanup continuing

## Progress Tracking

| Date | Warnings | Change | Notes |
|------|----------|--------|-------|
| 2025-12-17 | 2,733 | - | Initial report |
| 2025-12-17 | 2,589 | -144 | FhirAiService, EnhancedFhirService cleanup |
| 2025-12-18 | 2,499 | -90 | mentalHealthService, neuroSuiteService, more FHIR fixes |
| 2025-12-18 | 2,009 | -490 | Sub-agents made changes (introduced 628 TS errors) |
| 2025-12-18 | 2,140 | +131 | **RECOVERY:** Reverted 82 broken files, kept valid changes |

### Sub-Agent Incident (2025-12-18)

Sub-agents attempted to fix `no-unused-vars` warnings by removing error variable names from catch blocks. However, they removed variables that were **still being used** inside the catch blocks, causing 628 TypeScript errors across 79 files.

**Pattern of broken changes:**
```typescript
// Sub-agents changed this:
} catch (error) {
  throw new Error(`Failed: ${error.message}`);
}

// To this (BROKEN - error is still referenced):
} catch {
  throw new Error(`Failed: ${error.message}`);  // TS2304: Cannot find name 'error'
}
```

**Resolution:** Reverted all 82 affected service files using `git checkout HEAD --`. Valid changes in other files (type annotations, hook dependencies) were preserved.

## Summary

| Issue Type | Original | Current | Priority |
|------------|----------|---------|----------|
| `@typescript-eslint/no-explicit-any` | 1,636 | ~1,400 | P2 |
| `@typescript-eslint/no-unused-vars` | 902 | ~600 | P3 |
| `react-hooks/exhaustive-deps` | 98 | ~90 | P1 |
| `@typescript-eslint/no-non-null-assertion` | 95 | ~50 | P2 |
| Other (duplicate enum, dupe else-if) | 2 | 2 | P3 |

**Note:** Current counts are estimates. Total warnings: 2,140 (verified via `npm run lint`).

---

## Issue Breakdown

### 1. `no-explicit-any` (1,636 occurrences) - P2

**Problem:** Using `any` type bypasses TypeScript's type checking, reducing code safety and IDE support.

**Common Patterns:**
- Function parameters typed as `any`
- Catch block error types
- Third-party API response types
- Event handlers

**Fix Strategy:**
1. Create proper type definitions for external APIs
2. Use `unknown` instead of `any` for catch blocks
3. Add proper generics where appropriate
4. Use type guards for runtime type checking

**High-Impact Files (20+ occurrences):**
- `src/adapters/implementations/CernerFHIRAdapter.ts`
- `src/adapters/implementations/EpicFHIRAdapter.ts`
- `src/adapters/UniversalAdapterRegistry.ts`
- `src/services/intelligentMigrationEngine.ts`
- `src/components/admin/FhirIntegrationService.ts`

---

### 2. `no-unused-vars` (902 occurrences) - P3

**Problem:** Declared variables/imports that are never used bloat the codebase.

**Common Patterns:**
- Unused destructured variables (especially `error` in catch blocks)
- Unused function parameters
- Unused imports
- Variables assigned but never read

**Fix Strategy:**
1. Prefix intentionally unused vars with `_` (e.g., `_error`)
2. Remove truly unused imports
3. Remove dead code paths
4. Use `void` for intentionally ignored promises

**Quick Fix:** Run `eslint --fix` can auto-fix some of these.

---

### 3. `react-hooks/exhaustive-deps` (98 occurrences) - P1 (HIGH PRIORITY)

**Problem:** Missing dependencies in `useEffect`, `useCallback`, `useMemo` can cause:
- Stale closures
- Infinite re-renders
- Race conditions
- Memory leaks

**Fix Strategy:**
1. Add missing dependencies to dependency arrays
2. Use `useRef` for values that shouldn't trigger re-renders
3. Extract functions outside component or wrap in `useCallback`
4. Consider if the effect needs restructuring

**High-Risk Files:**
- `src/hooks/useRealtimeSubscription.ts`
- `src/hooks/useVoiceCommand.ts`
- `src/components/admin/AdminFeatureToggle.tsx`
- `src/pages/SettingsPage.tsx`

---

### 4. `no-non-null-assertion` (95 occurrences) - P2

**Problem:** Using `!` (non-null assertion) tells TypeScript to trust that a value isn't null/undefined, but it can crash at runtime if wrong.

**Common Patterns:**
```typescript
// Risky
const value = someNullableValue!;

// Safe alternatives
const value = someNullableValue ?? defaultValue;
if (someNullableValue) { /* use it */ }
```

**Fix Strategy:**
1. Use optional chaining (`?.`)
2. Use nullish coalescing (`??`)
3. Add proper null checks
4. Use type guards

---

## Files Requiring Most Attention

### Adapters (FHIR Integration)
These files have the highest concentration of `any` types due to external API interactions:

| File | Any Count | Unused Vars |
|------|-----------|-------------|
| `CernerFHIRAdapter.ts` | 24 | 4 |
| `EpicFHIRAdapter.ts` | 23 | 4 |
| `GenericFHIRAdapter.ts` | 18 | 2 |
| `MeditechFHIRAdapter.ts` | 15 | 3 |
| `UniversalAdapterRegistry.ts` | 21 | 5 |

**Recommendation:** Create shared FHIR type definitions in `src/types/fhir.d.ts`

### Services
| File | Issues | Primary Type |
|------|--------|--------------|
| `intelligentMigrationEngine.ts` | 45+ | any, unused |
| `ccmAutopilotService.ts` | 25+ | any, deps |
| `fhirCodeGeneration.ts` | 20+ | any |

### Hooks
| File | Issues | Primary Type |
|------|--------|--------------|
| `useRealtimeSubscription.ts` | 15+ | deps, any |
| `useVoiceCommand.ts` | 12+ | deps |
| `useBranding.ts` | 8+ | deps |

---

## Recommended Fix Order

### Phase 1: High Priority (react-hooks/exhaustive-deps)
Fix all 98 hook dependency issues first - these can cause runtime bugs.

```bash
# Find all exhaustive-deps issues
npm run lint 2>&1 | grep "exhaustive-deps"
```

### Phase 2: Type Safety (no-explicit-any)
Create proper types for:
1. FHIR resources and responses
2. Supabase query results
3. External API payloads
4. Event handlers

### Phase 3: Cleanup (no-unused-vars)
```bash
# Auto-fix where possible
npx eslint --fix "src/**/*.{ts,tsx}"
```

### Phase 4: Null Safety (no-non-null-assertion)
Replace `!` with proper null handling.

---

## Current ESLint Configuration

These rules are currently set to `off` to match CRA behavior:

```javascript
// eslint.config.js - CRA-compatible settings
'no-empty': 'off',
'no-useless-catch': 'off',
'no-case-declarations': 'off',
'no-useless-escape': 'off',
'@typescript-eslint/ban-ts-comment': 'off',
'@typescript-eslint/no-require-imports': 'off',
'@typescript-eslint/no-empty-object-type': 'off',
'@typescript-eslint/triple-slash-reference': 'off',
```

**Goal:** Gradually enable these as errors after fixing underlying issues.

---

## Tracking Progress

To regenerate this report:
```bash
npm run lint 2>&1 | grep -c "warning"
```

Target milestones:
- [ ] < 2000 warnings (140 to go)
- [ ] < 1000 warnings
- [ ] < 500 warnings
- [ ] < 100 warnings
- [ ] 0 warnings (enable strict rules)

---

*This document should be updated as issues are resolved.*
