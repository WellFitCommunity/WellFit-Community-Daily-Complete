# Claude Instructions for WellFit-Community-Daily-Complete

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
- Every catch block properly typed (`err: unknown`) with `auditLogger`
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

## Test Standards - MANDATORY

### Test Baseline
| Metric | Current |
|--------|---------|
| Total Tests | 1,778 |
| Test Suites | 96 |
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
- **Dynamic origins**: CORS must accept any tenant's HTTPS domain (no hardcoded allowlists)
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
3. `npm test` - All 1,778 tests must pass
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
- **Tests**: 1,778 tests across 96 suites (100% pass rate, 0 skipped)
