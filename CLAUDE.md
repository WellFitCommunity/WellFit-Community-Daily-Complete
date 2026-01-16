# Claude Instructions for WellFit-Community-Daily-Complete

---

## Quick Reference - The 10 Commandments

| # | Rule | Violation = Reject |
|---|------|-------------------|
| 1 | **STOP AND ASK** if unclear, blocked, or choosing between approaches | Guessing, improvising |
| 2 | **No `any` type** - use `unknown` + type guards (see [TypeScript Standards](#typescript-standards)) | `data: any`, `catch (err: any)` |
| 3 | **No `console.log`** - use `auditLogger` for all logging | Any console.* in production |
| 4 | **Run `npm run typecheck`** before considering work done | Skipping type verification |
| 5 | **All 6,695 tests must pass** - no skips, no deletions | `.skip()`, `.only()`, deleting tests |
| 6 | **No workarounds** - if blocked, ask Maria | "temporary fix", "for now", "hack" |
| 7 | **Vite environment** - `import.meta.env.VITE_*` only | `process.env.REACT_APP_*` |
| 8 | **No PHI in browser** - patient IDs only, data stays server-side | Names, SSN, DOB in frontend |
| 9 | **Run migrations you create** - `npx supabase db push` | Unexecuted migration files |
| 10 | **No CORS/CSP wildcards** - use explicit `ALLOWED_ORIGINS` only | `frame-ancestors *`, `connect-src *`, `WHITE_LABEL_MODE=true` |

### Before Every Task
```bash
git log --oneline -3     # Review recent commits
npm run typecheck        # Verify types compile
npm run lint             # Check for warnings
npm test                 # All tests pass
```

### Error Handling Template
```typescript
catch (err: unknown) {
  await auditLogger.error('OPERATION_FAILED',
    err instanceof Error ? err : new Error(String(err)),
    { context: 'data here' }
  );
  return failure('OPERATION_FAILED', 'User-friendly message');
}
```

---

## Common AI Mistakes - Why These Rules Exist

This codebase eliminated 1,400+ `any` violations and 1,671 total lint warnings in January 2026. These rules exist because AI coding assistants consistently make these mistakes:

| AI Mistake | Our Prevention | Why AIs Do This |
|------------|----------------|-----------------|
| `catch (err)` or `catch (e: any)` | Requires `err: unknown` | AIs copy legacy patterns from training data |
| `console.log` debugging left in code | Requires `auditLogger` | Quick output during generation |
| Creating new files instead of editing | "Prefer editing existing files" | Starting fresh feels easier than understanding |
| Guessing when blocked | STOP AND ASK protocol | AIs want to appear helpful, not "stuck" |
| "Temporary" workarounds | No workarounds policy | Solves immediate problem, defers pain |
| `process.env.REACT_APP_*` | Requires `import.meta.env.VITE_*` | CRA patterns dominate training data |
| `forwardRef()` wrapper | React 19 ref-as-prop | Pre-React 19 patterns in training |
| Deleting "unused" code aggressively | "Tables that exist are FEATURES" | Cleanup instinct without context |
| Skipping tests with `.skip()` | Explicitly forbidden | Makes the error "go away" |
| Over-engineering simple requests | "Surgeon, not butcher" | AIs love showing off abstractions |
| Not verifying routes are wired | Route connectivity check | Writes component, forgets App.tsx |
| Silent error swallowing | Must log + return `failure()` | Empty catch blocks "handle" errors |
| PHI in frontend code | HIPAA section | Doesn't understand data sensitivity |
| Committing without running typecheck | Required before completion | Eager to show "done" |
| Using `as Error` instead of narrowing | `err instanceof Error ? ...` | Shorter = seems better |
| CORS/CSP wildcards (`*`) | Explicit `ALLOWED_ORIGINS` required | "Permissive = easier" mentality |

**The STOP AND ASK protocol is the highest-value rule.** Most AI mistakes stem from continuing when uncertain rather than asking.

---

# ⛔ NO SHORTCUTS. NO EXCUSES. NO EXCEPTIONS. ⛔

**THIS CODEBASE REQUIRES ANTHROPIC-QUALITY ENGINEERING.**

We do NOT accept:
- Sloppy, error-ridden code that leaves technical debt
- "Quick fixes" that break other things
- Removing variables without checking if they're used
- Ignoring CLAUDE.md rules to save time
- Sub-agent work that isn't verified before completion
- ANY pattern that prioritizes speed over correctness

We REQUIRE:
- **Seasoned, stable, careful coding** that Anthropic is known for
- Every change verified with `npm run typecheck` before considering it done
- Reading and following EVERY rule in this document
- Asking questions when uncertain instead of guessing

**If you take a shortcut, Maria has to fix it. That is unacceptable.**

**Do it right the first time. There is no second chance.**

---

## CRITICAL RULES - READ FIRST

### Development Philosophy - NON-NEGOTIABLE

**"I have time to do it right. I do not have time to do it twice."**

**"Always be a pace car, never a race car."**

**"Be a surgeon, never a butcher."**

These are not suggestions. They are requirements.

---

### Default Assumption - PRODUCTION FIRST

**ALL code in this codebase is enterprise-grade, HIPAA-compliant, production-ready.**

There is no "quick version" followed by "real version."
The first version IS the real version.

- No hardcoded values that should be fetched from database
- No placeholder implementations
- No "we can improve this later"
- No shortcuts that require a second commit to fix

**Every line of code must be shippable to Methodist Hospital tomorrow.**

---

### Pre-Implementation Checklist - MANDATORY

**Before writing ANY code, you MUST answer these questions:**

1. **What data does this need?** Where does it come from? (Database, API, props, context?)
2. **Am I hardcoding anything that should be dynamic?** (Values, IDs, config that varies by patient/tenant)
3. **Is this the complete solution or a placeholder?** (If placeholder, STOP - do the real thing)
4. **Would I ship this to Methodist Hospital tomorrow?** (If "no" - stop and do it right)

**If you cannot answer "yes, this is production-ready" to #4 - do NOT write the code.**

Ask Maria for clarification instead of implementing something incomplete.

---

### NO WORKAROUNDS POLICY - ABSOLUTE

- **Do NOT implement workarounds, hacks, or "temporary" solutions**
- If blocked, **STOP and ASK** - do not improvise
- If you find yourself typing "workaround", "hack", "temporary fix", "for now", or "we can refactor later" - **STOP IMMEDIATELY**
- Workarounds ARE technical debt. Technical debt is forbidden.
- Violating this requires **explicit written approval from Maria**

---

### STOP AND ASK PROTOCOL

**When ANY of these apply, STOP and ask before proceeding:**

- Requirements are unclear or ambiguous
- Multiple valid implementation approaches exist
- You're about to change an existing pattern
- You're about to delete anything (tables, functions, files, tests)
- The "right" solution seems harder than a shortcut
- You're unsure if something violates these rules

**Do NOT guess. Do NOT improvise. ASK.**

---

### Zero Technical Debt - ENFORCED

- Do NOT introduce technical debt with quick fixes
- Always implement proper, maintainable solutions
- Refactor when necessary to maintain code quality
- "We can fix it later" is not acceptable
- Every shortcut creates future problems during enterprise deployments

---

### TypeScript Standards

<a id="typescript-standards"></a>

**The `any` type is forbidden. Use `unknown` + type guards or define interfaces.**

| Situation | Wrong | Right |
|-----------|-------|-------|
| Unknown object shape | `any` | `unknown` then narrow with type guards |
| Database query results | `data: any[]` | Define interface, cast: `data as MyInterface[]` |
| JSON parsing | `JSON.parse(str) as any` | Generic: `parseJSON<T>(str): T` |
| Function parameters | `(data: any)` | `(data: unknown)` or proper interface |
| Third-party data | `response: any` | Define expected interface |
| Error handling | `catch (err: any)` | `catch (err: unknown)` |

**Proper patterns:**

```typescript
// Database results - define interfaces FIRST
interface PatientRecord {
  id: string;
  name: string;
  admission_date: string;
}
const { data } = await supabase.from('patients').select('*');
const patients = (data || []) as PatientRecord[];

// JSON parsing - use generics
function parseJSON<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

// Unknown data - narrow with type guards
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Error handling - always use unknown
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  await auditLogger.error('OPERATION_FAILED', error, { context });
}
```

**Before using `any`:**
1. STOP - try to define proper types first
2. Create an interface for the data structure
3. Use `unknown` with type guards if truly dynamic
4. If `any` is genuinely the only option, add a comment explaining why
5. Ask Maria if unsure

### Type Cast Boundaries - `as unknown as X`

**The `as unknown as X` pattern is acceptable ONLY at system boundaries:**

| Allowed (Edge) | Forbidden (Interior) |
|----------------|----------------------|
| SDK initialization | Business logic |
| External API adapters | Domain transformations |
| Database row transforms | Service-to-service calls |
| Transport/serialization boundaries | Anywhere types should verify correctness |

**Examples:**
```typescript
// ✅ GOOD - SDK initialization boundary
this.client = new Anthropic(config) as unknown as AIClient;

// ✅ GOOD - Database row transform at query boundary
const patients = data as unknown as PatientRecord[];

// ✅ GOOD - External callback adapter
.on('postgres_changes', {}, (payload) =>
  callback(payload as unknown as TypedPayload)
)

// ❌ BAD - Cast in business logic
function calculateRisk(patient: unknown) {
  const p = patient as unknown as Patient; // NO - fix the caller
  return p.riskScore * 100;
}

// ❌ BAD - Cast to fix type errors in core code
const result = processData(input as unknown as ExpectedType); // NO
```

**Rule: Casts must never move closer to business logic.** If you need a cast inside a function, the problem is upstream - fix the caller or the interface.

**Current lint warning count: 0** (down from 1,671 in January 2026) - all `any` types and React hooks warnings eliminated through cross-AI auditing (Claude Code + ChatGPT).

### Lint Warning Policy - ZERO NEW WARNINGS

**Do NOT introduce new lint warnings unless absolutely necessary for a future build or development course.**

- Every PR/commit must not increase the lint warning count
- If you must add a warning temporarily, document WHY and create a task to fix it
- Before committing: run `npm run lint` and verify warning count did not increase
- New features must be lint-clean from the start
- This is a hard gate - work is not complete if it introduces new warnings

---

## Test Standards - MANDATORY

### Test Baseline
| Metric | Current |
|--------|---------|
| Total Tests | 6,663 |
| Test Suites | 262 |
| Pass Rate Required | 100% |

### Test Rules
- **All tests must pass before any work is considered complete**
- New components MUST include corresponding test files
- Do NOT delete, skip, or disable existing tests
- Do NOT use `.skip()` or `.only()` in committed code
- Location: `src/components/admin/__tests__/ComponentName.test.tsx`
- Minimum coverage: Rendering, loading states, data display, error handling

---

## React 19 / Vite Standards - ENFORCED

**This project migrated to Vite + React 19 in December 2025.**

### Required Patterns
| Do This | Not This |
|---------|----------|
| `import.meta.env.VITE_*` | `process.env.REACT_APP_*` |
| `ref` as prop directly | `forwardRef()` wrapper |
| `use()` hook for promises | `useEffect` + state for data fetching |
| Entry: `/index.html` (root) | `/public/index.html` |

### Forbidden Patterns
- NO `process.env` anywhere in client code
- NO `forwardRef` - React 19 passes ref as prop
- NO Create React App patterns or assumptions
- NO Webpack-specific configurations

---

## Project Overview

This codebase contains **two separate white-label products** that can be used independently or together:

| Product | Purpose | Target Users |
|---------|---------|--------------|
| **WellFit** | Community engagement platform | Seniors, caregivers, community orgs |
| **Envision Atlus** | Clinical care management engine | Healthcare providers, clinicians |

**Deployment Options:**
- **WellFit Only** - Community org uses just the member-facing wellness platform
- **Envision Atlus Only** - Healthcare org uses just the clinical care engine
- **Both Together** - Full integration with WellFit as community-facing + Envision Atlus as clinical backend

### Tenant ID Convention

Tenant codes follow the format: `{ORG}-{LICENSE}{SEQUENCE}`

| Digit | License Type | Example |
|-------|--------------|---------|
| `0` | **Both Products** | `VG-0002` |
| `8` | **Envision Atlus Only** | `HH-8001` |
| `9` | **WellFit Only** | `MC-9001` |

**Default Tenant for Testing:** `WF-0001` (UUID: `2b902657-6a20-4435-a78a-576f397517ca`)

### White-Label Architecture
- **Multi-tenant**: Multiple organizations use the same codebase with their own domains
- **Explicit origins**: CORS uses `ALLOWED_ORIGINS` env var - add tenant domains as they onboard (no wildcards)
- **Tenant branding**: Each tenant can customize appearance via `useBranding()` hook
- **Shared backend**: All tenants share Supabase database with RLS for isolation

---

## HIPAA Compliance & PHI Protection - CRITICAL

- **NEVER introduce PHI (Protected Health Information) to the browser**
- All PHI must remain server-side only
- Use patient IDs/tokens for client-side operations, never names, SSN, DOB, etc.
- Use audit logger for all logging - **NEVER use console.log**
- All security-sensitive operations must be logged via the audit system

---

## Code Quality Standards

### Surgical Precision Required
- **Be a surgeon, never a butcher** - make precise, targeted changes
- Respect the existing codebase architecture and patterns
- Only modify what is necessary to complete the task
- Preserve existing functionality unless explicitly asked to change it
- Review affected code thoroughly before making changes

### Before Starting ANY Work
1. Review the last 3 commits: `git log --oneline -3`
2. Understand recent changes and their purpose
3. Review the affected schema/database tables
4. Identify existing patterns in similar code
5. If unclear, **STOP and ASK**

---

## Database Standards

### PostgreSQL 17 via Supabase
- Respect the existing database schema - review before making changes
- Use proper migrations for any schema changes
- **DO NOT aggressively delete database tables, functions, or data**

### Database Cleanup Policy - CRITICAL
When asked to "clean up":
1. **Tables that exist are FEATURES** - Even if not currently referenced in code
2. **Only delete obvious debug/backup tables** - Tables starting with `_` prefix
3. **NEVER delete without explicit confirmation from Maria**
4. **When in doubt, DON'T delete**

### Supabase Migration Workflow - CRITICAL
**ALWAYS run migrations you create. Do NOT leave migrations unexecuted.**

```bash
# Login early - takes 30-60 seconds
npx supabase login

# Link to project (if not already linked)
npx supabase link --project-ref xkybsjnvuohpqpbkikyn

# Push migrations to remote database
npx supabase db push
```

**After creating any migration file, you MUST:**
1. Run the migration against the database
2. Verify it succeeded (check for errors)
3. Test that the new schema works as expected

---

## Route Connectivity & Wiring - CRITICAL

**ALWAYS ensure components are properly connected and routed.**

1. **Verify routes exist in `src/App.tsx`**
2. **Check lazy imports** - Components must be imported with `React.lazy()`
3. **Validate route references** - Links must point to actual routes
4. After creating any new page/component, verify it's accessible in the browser

---

## UI/UX Requirements

- **Always ensure UI/UX remains in working order** after any changes
- Maintain responsive design principles
- Preserve accessibility features
- Test visual changes in the browser before considering complete

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase JWT anon key (required for auth) |
| `VITE_HCAPTCHA_SITE_KEY` | hCaptcha site key for bot protection |
| `VITE_ANTHROPIC_API_KEY` | Claude AI API key |

### Supabase Key Migration (December 2025)

**Database:** Fully migrated to **PostgreSQL 17** via Supabase.

**Key Naming Convention (Current):**

| Key Name | Format | Usage |
|----------|--------|-------|
| `SB_PUBLISHABLE_API_KEY` | `sb_publishable_*` | New publishable key format |
| `SB_SECRET_KEY` | `sb_secret_*` | New secret key format (server-side only) |
| `SB_SERVICE_ROLE_KEY` | JWT (`eyJhbGci...`) | Legacy service role key (Supabase default name) |
| `SB_ANON_KEY` | JWT (`eyJhbGci...`) | Legacy JWT anon key |
| `SUPABASE_ANON_KEY` | JWT (`eyJhbGci...`) | Legacy JWT anon key (alias) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT | Legacy service role key (alias) |

**IMPORTANT - Key Format Compatibility:**
- **Client-side auth REQUIRES the JWT format** (`VITE_SUPABASE_ANON_KEY` or `SB_ANON_KEY`)
- The new `sb_publishable_*` format is NOT yet supported by Supabase JS client for authentication
- Edge Functions should prefer `SB_ANON_KEY` (JWT) for user token validation
- Service role operations use `SB_SECRET_KEY` (new format works)
- Legacy JWT keys remain functional until fully deprecated by Supabase

**Order of Preference in Edge Functions:**
```typescript
// For user-context operations:
getEnv("SB_ANON_KEY", "SUPABASE_ANON_KEY", "SB_PUBLISHABLE_API_KEY")

// For service role operations (MUST include SB_SERVICE_ROLE_KEY):
getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY")
```

### JWT Fundamentals (Supabase)

**Structure:** `<header>.<payload>.<signature>` (Base64-URL encoded JSON)

**Key Claims in Supabase JWTs:**
| Claim | Description |
|-------|-------------|
| `iss` | Issuer URL (e.g., `https://project_id.supabase.co/auth/v1`) |
| `exp` | Expiration timestamp (after which token is invalid) |
| `sub` | Subject - the unique user ID |
| `role` | Postgres role for RLS (`authenticated`, `anon`, etc.) |

**Verification Methods:**
1. **Supabase Auth JWTs**: Use `supabase.auth.getClaims()` or JWKS endpoint
2. **Legacy/Custom JWTs (HS256)**: Verify via Auth server: `GET /auth/v1/user`
3. **JWKS Endpoint**: `https://project-id.supabase.co/auth/v1/.well-known/jwks.json` (cached 10 min)

**Security Considerations:**
- Shared secrets (HS256) are **NOT recommended** for HIPAA/SOC2/PCI-DSS compliance
- Prefer asymmetric keys (RSA, EC) for production
- Wait **20+ minutes** after rotating signing keys (due to 10 min edge cache)
- Never implement JWT verification manually - use established libraries (`jose`, etc.)

**Client Library Usage (Custom JWTs):**
```typescript
// DON'T: Set custom Authorization headers
// DO: Use accessToken option
const supabase = createClient(url, key, {
  accessToken: async () => '<your JWT here>'
});
```

### JWT Signing Keys System

**Two Systems (Legacy vs New):**
| System | Type | Recommendation |
|--------|------|----------------|
| Legacy JWT Secret | Shared secret (HS256) | **NOT recommended** - hard to rotate, signs anon/service_role |
| Signing Keys | Asymmetric (ES256/RS256) | **Recommended** - zero-downtime rotation, HIPAA compliant |
| Signing Keys | Shared secret (HS256) | Available but not recommended |

**CRITICAL: `anon` and `service_role` ARE JWTs** signed by the legacy JWT secret. Revoking the legacy secret requires disabling these keys first.

**Algorithm Recommendations:**
| Algorithm | JWT `alg` | Notes |
|-----------|-----------|-------|
| NIST P-256 (EC) | ES256 | **Recommended** - fast, short signatures, good for cookies |
| RSA 2048 | RS256 | Widely supported but slower |
| Ed25519 | EdDSA | Coming soon |
| HMAC | HS256 | **Avoid** - compliance issues, can't revoke without downtime |

**Key Lifecycle:** `standby` → `in use` → `previously used` → `revoked` → `delete`

**Timing Constraints:**
- **5 minutes**: Wait between key state changes
- **10 min edge cache + 10 min client cache = 20 min total propagation**
- **Wait `access_token_expiry + 15 min`** before revoking old key (prevents user signouts)

**Key Rotation (Zero-Downtime):**
1. Create standby key (asymmetric preferred)
2. Wait for JWKS cache propagation (~20 min)
3. Rotate keys (Auth starts using new key)
4. Wait `access_token_expiry + 15 min`
5. Revoke old key

**Minting Custom JWTs:**
```bash
# Generate a signing key
supabase gen signing-key --algorithm ES256

# Generate a bearer token
supabase gen bearer-jwt --role authenticated --sub <user-uuid>
```

**Custom JWT Required Headers:**
```json
{ "alg": "ES256", "kid": "<key-id-from-import>", "typ": "JWT" }
```

**Custom JWT Required Claims:**
```json
{ "sub": "<user-uuid>", "role": "authenticated", "exp": <timestamp> }
```

**Security Notes:**
- Private keys **cannot be extracted** from Supabase (security feature)
- To use your own key: generate locally, import to Supabase
- Separate `apikey` header still required (publishable/secret) - JWT alone won't work

### Auth Session Security

| Method | Server-Safe? | Notes |
|--------|--------------|-------|
| `supabase.auth.getSession()` | **NO** | Can be spoofed - only use client-side |
| `supabase.auth.getClaims()` | **YES** | Validates JWT signature against public keys |
| `supabase.auth.getUser()` | **YES** | Makes Auth server request to validate |

**In Edge Functions**: Never trust client-provided session data. Use service role key to independently verify/query user data.

---

## Development Commands

```bash
npm run dev        # Start development server
npm run build      # Build the project
npm run lint       # Run linting
npm run typecheck  # Run TypeScript type checking
npm test           # Run tests
```

---

## Quality Assurance Checklist - REQUIRED

**Run ALL before considering work complete:**

1. `npm run lint` - Must pass with 0 errors
2. `npm run typecheck` - Verify TypeScript types
3. `npm test` - All 6,663 tests must pass
4. Visual inspection - Ensure UI/UX functions correctly
5. Route verification - New pages are accessible

---

## Git Workflow

- Main branch: `main`
- Only commit when explicitly requested
- Follow existing commit message patterns
- Always review last 3 commits before starting work
- Branch naming: `claude/{feature-description}-{unique-id}`

---

## Architecture Patterns

### Module Access (Feature Flags)
- Use `useModuleAccess(moduleName)` hook - the ONE way to check module access
- Two-tier system: entitlements (paid for) + enabled (turned on)

### Service Layer Standards
- All services should use `ServiceResult<T>` return type from `src/services/_base/`
- Never throw exceptions - return errors in the result
- Use `success()` and `failure()` helpers

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

### Audit Logging Requirements
- Use the audit logger service for all application logging
- **NEVER use console.log, console.error, etc. in production code**

---

## AI Services Standards

This codebase contains **40+ AI-powered services** using Claude. All AI services must follow these patterns.

### Skill Registration
All AI services must be registered in the `ai_skills` database table:

| Field | Purpose |
|-------|---------|
| `skill_key` | Unique identifier (e.g., `care_team_chat_summarizer`) |
| `skill_number` | Sequential number for tracking/billing |
| `description` | What the skill does |
| `model` | Which Claude model to use |
| `is_active` | Whether skill is enabled |

### AI Service Pattern
```typescript
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from './_base';

export async function analyzePatientRisk(
  input: PatientRiskInput
): Promise<ServiceResult<RiskAnalysis>> {
  // 1. Log AI operation start
  await auditLogger.ai('AI_RISK_ANALYSIS_START', {
    patientId: input.patientId,
    skillKey: 'risk_analyzer'
  });

  try {
    // 2. Call AI service
    const result = await callClaudeAPI(input);

    // 3. Log success
    await auditLogger.ai('AI_RISK_ANALYSIS_COMPLETE', {
      patientId: input.patientId,
      riskLevel: result.riskLevel
    });

    return success(result);
  } catch (err: unknown) {
    // 4. Log failure with auditLogger (never console.log)
    await auditLogger.error('AI_RISK_ANALYSIS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId: input.patientId }
    );
    return failure('AI_ERROR', 'Risk analysis failed');
  }
}
```

### AI Cost Tracking
- All AI calls are tracked for billing purposes
- Use `/cost-check` skill to analyze AI spending
- Monitor token usage in production

---

## Error Handling Pattern - REQUIRED

**All error handling MUST follow this pattern** (see [TypeScript Standards](#typescript-standards) for `unknown` vs `any`):

```typescript
try {
  // operation
} catch (err: unknown) {
  await auditLogger.error('OPERATION_FAILED',
    err instanceof Error ? err : new Error(String(err)),
    { context: 'relevant data here' }
  );
  return failure('OPERATION_FAILED', 'User-friendly message');
}
```

### Rules
| Do This | Not This |
|---------|----------|
| `err instanceof Error ? err : new Error(String(err))` | `err as Error` |
| `auditLogger.error(...)` | `console.error(...)` |
| Return `failure()` result | Throw exceptions |

### Never
- Swallow errors silently
- Use `console.log/error/warn` for error logging

---

## Accessibility (a11y) Standards - REQUIRED

**Target users include seniors with vision/motor impairments. Accessibility is not optional.**

### WCAG Compliance Requirements

| Requirement | Standard | Reason |
|-------------|----------|--------|
| Font size | Minimum 16px, prefer 18px+ | Senior vision |
| Touch targets | Minimum 44x44px | Motor impairments |
| Color contrast | WCAG AA (4.5:1 minimum) | Low vision |
| Focus indicators | Visible on all interactive elements | Keyboard navigation |
| Alt text | All images must have descriptive alt text | Screen readers |

### Senior-Friendly UI Rules
- **Large, clear buttons** - Easy to tap/click
- **High contrast text** - Dark text on light backgrounds
- **Simple navigation** - Minimal nesting, clear labels
- **Readable fonts** - Sans-serif, adequate line height
- **Voice command support** - Where possible
- **Error messages** - Clear, non-technical language

### Testing Accessibility
```bash
# Run accessibility audit
npx lighthouse --only-categories=accessibility <url>
```

### Common Patterns
```tsx
// ✅ GOOD - Large touch target, clear label
<button className="min-h-[44px] min-w-[44px] text-lg font-medium">
  Check In
</button>

// ❌ BAD - Too small, unclear
<button className="text-xs p-1">
  <Icon />
</button>
```

---

## Component File Structure

### Standard Component Layout
```
src/components/feature-name/
├── FeatureName.tsx           # Main component
├── FeatureName.types.ts      # TypeScript interfaces (if complex)
├── __tests__/
│   └── FeatureName.test.tsx  # Tests (REQUIRED)
└── index.ts                  # Barrel export (optional)
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PatientDashboard.tsx` |
| Hooks | camelCase with `use` prefix | `usePatientData.ts` |
| Services | camelCase with `Service` suffix | `patientService.ts` |
| Types | PascalCase | `PatientTypes.ts` |
| Tests | Same name + `.test` | `PatientDashboard.test.tsx` |
| Constants | SCREAMING_SNAKE_CASE | `const MAX_RETRIES = 3` |

### Component Template
```tsx
/**
 * ComponentName - Brief description
 *
 * Purpose: What this component does
 * Used by: Where it's used
 */

import React from 'react';
import { ComponentNameProps } from './ComponentName.types';

export const ComponentName: React.FC<ComponentNameProps> = ({
  prop1,
  prop2
}) => {
  return (
    <div>
      {/* Implementation */}
    </div>
  );
};

export default ComponentName;
```

---

## Performance Guidelines

### Code Splitting
- Use `React.lazy()` for all route-level components
- Dynamic imports for heavy libraries

```typescript
// ✅ GOOD - Lazy loaded route
const PatientDashboard = React.lazy(() => import('./pages/PatientDashboard'));

// ❌ BAD - Direct import for routes
import PatientDashboard from './pages/PatientDashboard';
```

### Image Optimization
- Use WebP format when possible
- Always include `loading="lazy"` for below-fold images
- Specify width/height to prevent layout shift

### Database Performance
- Always use indexes on frequently queried columns
- Limit query results: `.limit(100)`
- Use pagination for large datasets
- Avoid `SELECT *` - specify needed columns

### List Virtualization
- Virtualize lists with > 100 items
- Use `react-window` or similar for long lists

### Bundle Monitoring
```bash
# Check bundle size after changes
npm run build
# Review dist/ folder sizes
```

---

## Available Skills

Custom skills available via `/skill-name` commands:

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/security-scan` | HIPAA compliance check | Before commits, demos, audits |
| `/demo-ready` | Methodist Hospital demo validation | Before customer demos |
| `/cost-check` | AI cost analysis | Monthly review, budget planning |

### Running Skills
```bash
# In Claude Code CLI
/security-scan
/demo-ready
/cost-check
```

---

## Security Requirements

- All authentication must use secure tokens
- Rate limiting on sensitive endpoints
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS prevention via proper output encoding

---

## CORS for Edge Functions

All edge functions MUST use the shared CORS module:

```typescript
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }
  const { headers: corsHeaders } = corsFromRequest(req);
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### CORS/CSP Security - NO WILDCARDS

**NEVER use wildcards in CORS or CSP configurations. This is a security violation.**

| Forbidden | Required Instead |
|-----------|------------------|
| `frame-ancestors *` | `frame-ancestors 'none'` or explicit domains |
| `connect-src *` | `connect-src 'self' https://*.supabase.co ...` |
| `WHITE_LABEL_MODE=true` | `ALLOWED_ORIGINS` env var with explicit tenant domains |

**Why this matters:**
- Wildcards fail GitHub security scans
- Wildcards violate HIPAA § 164.312(e)(1) transmission security
- Wildcards enable clickjacking and data exfiltration attacks

**To add a new tenant domain:**
1. Add domain to `ALLOWED_ORIGINS` in Supabase secrets (comma-separated)
2. Redeploy edge functions: `npx supabase functions deploy --no-verify-jwt`

**DO NOT** enable `WHITE_LABEL_MODE` unless explicitly approved by Maria for dynamic tenant onboarding.

---

## Common Issues & Solutions

### Supabase Timing
**Wait at least 60 seconds** after deploying edge functions or running migrations before testing.

### Null-Safe Number Formatting
```typescript
// Safe - handles null values
{(metrics.total_saved ?? 0).toFixed(2)}

// Safe division - prevents divide by zero
{(((numerator ?? 0) / (denominator || 1)) * 100).toFixed(0)}%
```

---

## Important Directories

| Directory | Purpose |
|-----------|---------|
| `src/components/admin/` | Admin dashboards and management panels |
| `src/components/envision-atlus/` | Shared UI component library (EA design system) |
| `src/components/patient-avatar/` | Patient Avatar Visualization System |
| `src/services/_base/` | ServiceResult pattern utilities |
| `src/hooks/` | Custom React hooks |
| `supabase/functions/` | Edge functions (Deno runtime) |
| `supabase/functions/_shared/` | Shared utilities for edge functions |

---

## Feature Documentation

Detailed documentation for specific features is in the `docs/` folder:

| Document | Description |
|----------|-------------|
| [docs/REFERRAL_SYSTEM.md](docs/REFERRAL_SYSTEM.md) | External referral & reporting system |
| [docs/CAREGIVER_SUITE.md](docs/CAREGIVER_SUITE.md) | Family caregiver PIN-based access |
| [docs/REGISTRATION_FLOWS.md](docs/REGISTRATION_FLOWS.md) | Three registration flows |
| [docs/ENVISION_ATLUS_DESIGN.md](docs/ENVISION_ATLUS_DESIGN.md) | EA design system components |
| [docs/FEATURE_DASHBOARDS.md](docs/FEATURE_DASHBOARDS.md) | Feature dashboard routes & config |
| [docs/VOICE_COMMANDS.md](docs/VOICE_COMMANDS.md) | Voice command infrastructure |
| [docs/PATIENT_AVATAR.md](docs/PATIENT_AVATAR.md) | Patient avatar visualization system |
| [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) | Current dev status & ATLUS alignment |

---

## Quick Reference

### Super Admin Credentials
| User | Email | UUID |
|------|-------|------|
| Maria | maria@wellfitcommunity.com | `ba4f20ad-2707-467b-a87f-d46fe9255d2f` |
| Akima | akima@wellfitcommunity.com | `06ce7189-1da3-4e22-a6b2-ede88aa1445a` |

### Feature Flags
```env
VITE_FEATURE_PHYSICAL_THERAPY=true
VITE_FEATURE_CARE_COORDINATION=true
VITE_FEATURE_REFERRAL_MANAGEMENT=true
VITE_FEATURE_QUESTIONNAIRE_ANALYTICS=true
VITE_FEATURE_NEURO_SUITE=true
```

---

## Current Status
- **Architecture**: White-label multi-tenant SaaS
- **CORS**: Fully white-label ready (any HTTPS origin allowed)
- **Database**: PostgreSQL 17 via Supabase with RLS (fully migrated December 2025)
- **Authentication**: JWT anon keys + new sb_publishable/sb_secret key format (hybrid until Supabase SDK full support)
- **UI**: Envision Atlus design system migration in progress
- **Build**: Vite + React 19 (migrated December 2025)
- **CSS**: Tailwind CSS 4.1.18 (migrated December 2025)
- **Tests**: 6,663 tests across 262 suites (100% pass rate, 0 skipped)
