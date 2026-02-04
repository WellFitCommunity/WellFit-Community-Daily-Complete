# AI-Assisted Development: Quality Standards & Anti-Pattern Prevention

**Created:** January 9, 2026
**Purpose:** Document how WellFit/Envision Atlus achieves enterprise-grade code quality using AI-assisted development with proper guardrails.

---

## Executive Summary

This codebase was built over 8 months using AI-assisted development by a non-programmer who learned to recognize patterns and enforce standards. The result:

| Metric | Value |
|--------|-------|
| Lines of Code | 350,406 |
| Source Files | 948 |
| Tests | 5,690 (100% pass rate) |
| Lint Warnings | 0 (down from 1,671 in one week) |
| `any` Type Usage | 0 (eliminated via cross-AI audit) |
| Database Tables | 616+ |
| AI Services | 50+ |

**Key Innovation:** Using multiple AI models to cross-audit each other's work, governed by a strict `CLAUDE.md` ruleset that prevents common AI coding mistakes.

---

## The 15 Anti-Patterns AI Gets Wrong (And How We Prevent Them)

### 1. Error Handling: `any` vs `unknown`

| AI Default | WellFit Standard |
|------------|------------------|
| `catch (err: any)` or `catch (err)` | `catch (err: unknown)` with proper type narrowing |
| Swallows errors silently | Always logs via `auditLogger` with context |

**Enforced Pattern:**
```typescript
catch (err: unknown) {
  await auditLogger.error('OPERATION_FAILED',
    err instanceof Error ? err : new Error(String(err)),
    { context: 'relevant data' }
  );
}
```

**Why It Matters:** Silent failures in healthcare software can have life-safety implications. Every error is logged for HIPAA audit trails.

---

### 2. Logging: console.log vs Audit Logger

| AI Default | WellFit Standard |
|------------|------------------|
| `console.log()` everywhere | `auditLogger.info/warn/error()` exclusively |
| Debug statements left in production | HIPAA-compliant audit trail |

**Enforcement:** Pre-commit hook blocks commits containing active `console.log` statements.

**Why It Matters:** HIPAA requires audit trails. Console.log doesn't persist, isn't searchable, and can leak PHI to browser dev tools.

---

### 3. Database Queries: SELECT * vs Explicit Columns

| AI Default | WellFit Standard |
|------------|------------------|
| `.select('*')` | `.select('id, name, status, created_at')` |
| Over-fetches data | Only fetches needed columns |

**Why It Matters:**
- Performance: Fetching 50 columns when you need 5 wastes bandwidth
- Security: Prevents accidental PHI exposure
- Maintainability: Explicit columns document data dependencies

---

### 4. API Assumptions: Fake APIs vs Reality

| AI Default | WellFit Standard |
|------------|------------------|
| Assumes all vendors have REST APIs | Researches actual integration patterns |
| Invents endpoints like `https://api.health.apple.com` | Understands Apple HealthKit has NO public REST API |

**Real Example:** AI initially created an Apple HealthKit adapter calling a non-existent REST API. Corrected to read from Supabase tables populated by iOS companion app using native HealthKit SDK.

**Why It Matters:** Fake APIs compile but fail at runtime. Production healthcare integrations must use real vendor specifications.

---

### 5. Type Safety: `as any` Casts vs Proper Interfaces

| AI Default | WellFit Standard |
|------------|------------------|
| `data as any` | Define interface, cast at boundary: `data as PatientRecord[]` |
| Bypasses TypeScript entirely | Uses `unknown` + type guards for dynamic data |

**Rule:** The `any` type is a **last resort** requiring written justification. Current count: 0.

**Why It Matters:** TypeScript's value is nullified by `any`. Type safety catches bugs at compile time, not in production with patient data.

---

### 6. Migrations: Write and Forget vs Write and Execute

| AI Default | WellFit Standard |
|------------|------------------|
| Creates migration file, moves on | Creates migration, runs `npx supabase db push`, verifies |
| Leaves migrations unapplied | Migrations are not complete until executed |

**CLAUDE.md Rule:** "ALWAYS run migrations you create. Do NOT leave migrations unexecuted."

**Why It Matters:** Unapplied migrations cause schema mismatches between code and database, leading to runtime errors.

---

### 7. Security: Afterthought vs First-Class

| AI Default | WellFit Standard |
|------------|------------------|
| Hardcoded CORS origins | Dynamic `corsFromRequest()` for white-label multi-tenant |
| Forgets RLS policies | 616+ tables with Row Level Security |
| Exposes PHI to browser | PHI stays server-side, tokens client-side |

**Architecture:**
- Multi-tenant with tenant ID isolation
- RLS policies on every table
- PHI encryption via database triggers
- JWT validation on all Edge Functions

**Why It Matters:** Healthcare data breaches average $10.9M per incident. Security must be foundational, not bolted on.

---

### 8. Test Coverage: Optional vs Mandatory

| AI Default | WellFit Standard |
|------------|------------------|
| "Tests can be added later" | Tests required for task completion |
| Skips edge cases | 5,690 tests covering rendering, loading, errors |
| Uses `.skip()` to hide failures | 100% pass rate enforced |

**Rule:** Work is not complete until:
1. `npm run typecheck` passes
2. `npm run lint` passes with 0 warnings
3. `npm test` passes (all 5,690 tests)

**Why It Matters:** Tests document expected behavior and catch regressions. In healthcare, regressions can affect patient care.

---

### 9. Over-Engineering: Kitchen Sink vs Surgical Precision

| AI Default | WellFit Standard |
|------------|------------------|
| Adds abstractions "for the future" | Only implements what's needed now |
| Refactors surrounding code | "Be a surgeon, never a butcher" |
| Adds feature flags for everything | Minimal complexity |

**CLAUDE.md Philosophy:**
- "I have time to do it right. I do not have time to do it twice."
- "Always be a pace car, never a race car."
- Only modify what is necessary to complete the task.

**Why It Matters:** Over-engineering creates maintenance burden and introduces bugs in code that didn't need to change.

---

### 10. Backwards Compatibility Hacks: Cruft vs Clean Deletion

| AI Default | WellFit Standard |
|------------|------------------|
| `const _unusedVar = ...` | Delete unused code entirely |
| `// removed: old function` | No cruft comments |
| Re-exports for "compatibility" | If unused, remove it |

**Rule:** "Avoid backwards-compatibility hacks like renaming unused `_vars`, re-exporting types, adding `// removed` comments. If something is unused, delete it completely."

**Why It Matters:** Dead code confuses future developers (and AI), increases bundle size, and creates false dependencies.

---

### 11. React Patterns: Legacy vs Modern

| AI Default | WellFit Standard |
|------------|------------------|
| `forwardRef()` wrappers | React 19: `ref` as prop directly |
| `process.env.REACT_APP_*` | Vite: `import.meta.env.VITE_*` |
| Class components | Functional components with hooks |

**Stack:** React 19 + Vite + Tailwind CSS 4.x (migrated December 2025)

**Why It Matters:** Modern patterns are more performant, have better TypeScript support, and align with framework direction.

---

### 12. Service Layer: Exceptions vs Result Types

| AI Default | WellFit Standard |
|------------|------------------|
| `throw new Error()` | `return failure('CODE', 'message')` |
| Try/catch at every call site | `ServiceResult<T>` pattern |
| Unpredictable error flow | Consistent `success()`/`failure()` |

**Pattern:**
```typescript
import { ServiceResult, success, failure } from './_base';

async function getData(id: string): Promise<ServiceResult<Data>> {
  try {
    const { data, error } = await supabase.from('table').select().eq('id', id).single();
    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success(data);
  } catch (err) {
    return failure('UNKNOWN_ERROR', 'Failed to get data', err);
  }
}
```

**Why It Matters:** Consistent error handling makes code predictable and easier to debug.

---

### 13. Accessibility: Afterthought vs Senior-First

| AI Default | WellFit Standard |
|------------|------------------|
| 12px font, tiny buttons | 18px+ font, 44x44px minimum touch targets |
| Low contrast gray text | WCAG AA 4.5:1 contrast ratio |
| Complex nested navigation | Simple, clear labels |

**Target Users:** Seniors with vision and motor impairments

**Requirements:**
- Large, clear buttons
- High contrast text
- Voice command support
- Simple navigation
- Non-technical error messages

**Why It Matters:** Our primary users are seniors. Accessibility isn't optional—it's the core UX requirement.

---

### 14. Workarounds: Quick Fixes vs Proper Solutions

| AI Default | WellFit Standard |
|------------|------------------|
| "Temporary fix, refactor later" | No workarounds without explicit approval |
| Hacks to make it compile | Fix the root cause |
| Technical debt accepted | Technical debt forbidden |

**CLAUDE.md Rule:** "Do NOT implement workarounds, hacks, or 'temporary' solutions. If blocked, STOP and ASK."

**Why It Matters:** Workarounds compound. One hack leads to another. Enterprise deployments require clean foundations.

---

### 15. AI Cross-Auditing: Single Source vs Adversarial Review

| AI Default | WellFit Standard |
|------------|------------------|
| Single AI writes and approves its own code | Multiple AI models audit each other |
| Blind spots go unnoticed | Different models catch different issues |
| "Looks good to me" syndrome | Adversarial review finds real problems |

**Strategy:**
- Claude writes code → GPT audits for issues
- GPT suggests changes → Claude reviews for CLAUDE.md compliance
- Different AI models have different training biases
- Cross-checking catches more bugs than single-model review

**Why It Works:**
1. **Different training data** - Models have different blind spots
2. **No ego** - AI doesn't get defensive when critiqued
3. **Fresh perspective** - Each model approaches code without "why I wrote it this way" bias
4. **Pattern detection** - One AI might recognize anti-patterns another missed

---

## The CLAUDE.md Framework

The `CLAUDE.md` file serves as a **constitution** that governs all AI-assisted development:

### Core Principles
```
"I have time to do it right. I do not have time to do it twice."
"Always be a pace car, never a race car."
"Be a surgeon, never a butcher."
```

### Hard Gates (Work Not Complete Until)
1. `npm run typecheck` - Zero TypeScript errors
2. `npm run lint` - Zero warnings
3. `npm test` - All 5,690 tests pass
4. Visual inspection - UI functions correctly
5. Route verification - New pages accessible

### Stop and Ask Protocol
AI must stop and ask before:
- Requirements are unclear
- Multiple valid approaches exist
- About to change existing patterns
- About to delete anything
- The "right" solution seems harder than a shortcut

---

## Results

This framework produces enterprise-grade code despite the primary developer having no prior programming experience:

| Quality Metric | Status |
|----------------|--------|
| TypeScript Strict Mode | Enabled |
| `any` Type Count | 0 |
| Lint Warnings | 0 |
| Test Pass Rate | 100% |
| HIPAA Compliance | Built-in |
| SOC 2 Readiness | Architected |
| Multi-tenant Isolation | Complete |
| PHI Encryption | Database-level |

---

## Conclusion

AI-assisted development can produce high-quality, enterprise-grade code when governed by:

1. **Explicit rules** documented in CLAUDE.md
2. **Pattern examples** showing correct implementations
3. **Hard quality gates** that block incomplete work
4. **Cross-model auditing** to catch blind spots
5. **Human pattern recognition** to identify when output "looks wrong"

The key insight: **AI is a powerful tool that requires governance.** Without rules, it produces inconsistent, hacky code. With proper guardrails, it can build production healthcare software.

---

## For Grant Applications

This methodology demonstrates:
- **Innovation in AI-assisted development** - Novel cross-auditing approach
- **Accessibility-first design** - Senior-focused UX from day one
- **Enterprise security architecture** - HIPAA/SOC 2 ready
- **Rapid development** - 350K+ LOC in 8 months
- **Quality at scale** - 5,690 tests, zero warnings

---

*Document maintained by WellFit/Envision Atlus development team*
