# Claude Instructions for WellFit-Community-Daily-Complete

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

## Critical Development Principles

### Development Philosophy
**"I have time to do it right. I do not have time to do it twice."**

**"Always be a pace car, never a race car."**

These principles guide all development:
- Take the time to understand the problem fully before writing code
- Research the existing architecture and patterns before making changes
- Implement solutions thoroughly the first time rather than rushing
- When in doubt, pause and investigate rather than forge ahead

### Zero Technical Debt
- Do NOT introduce technical debt with quick fixes or workarounds
- Always implement proper, maintainable solutions
- Refactor when necessary to maintain code quality

### HIPAA Compliance & PHI Protection
- **NEVER introduce PHI (Protected Health Information) to the browser**
- All PHI must remain server-side only
- Use patient IDs/tokens for client-side operations, never names, SSN, DOB, etc.
- Use audit logger for all logging - **NEVER use console.log**
- All security-sensitive operations must be logged via the audit system

### Database Standards
- This project uses **PostgreSQL 17**
- Respect the existing database schema - review before making changes
- Use proper migrations for any schema changes

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

### Database Cleanup Policy - CRITICAL
**DO NOT aggressively delete database tables, functions, or data.**

When asked to "clean up":
1. **Tables that exist are FEATURES** - Even if not currently referenced in code
2. **Only delete obvious debug/backup tables** - Tables starting with `_` prefix
3. **NEVER delete without explicit confirmation**
4. **When in doubt, DON'T delete**

### Code Quality Standards
- **Be a surgeon, never a butcher** - make precise, targeted changes
- Respect the existing codebase architecture and patterns
- Only modify what is necessary to complete the task
- Preserve existing functionality unless explicitly asked to change it

### Route Connectivity & Wiring - CRITICAL
**ALWAYS ensure components are properly connected and routed.**

1. **Verify routes exist in `src/App.tsx`**
2. **Check lazy imports** - Components must be imported with `React.lazy()`
3. **Validate route references** - Links must point to actual routes

### Component Testing Requirements - MANDATORY
**When creating a new React component, you MUST create a corresponding test file.**

- Location: `src/components/admin/__tests__/MyComponent.test.tsx`
- Minimum: Rendering tests, loading states, data display, error handling

### UI/UX Requirements
- **Always ensure UI/UX remains in working order** after any changes
- Maintain responsive design principles
- Preserve accessibility features

### Context & Code Review Protocol
Before starting ANY work:
1. Review the last 3 commits using `git log --oneline -3`
2. Understand recent changes and their purpose
3. Review the affected schema/database tables

## Build System

**IMPORTANT: This is a Create React App (CRA) project, NOT Vite.**

- Environment variables must use `REACT_APP_` prefix
- NEVER use `import.meta.env` (that's Vite syntax)
- Always use `process.env.REACT_APP_*`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

**Supabase Key Naming:**
- `SB_PUBLISHABLE_KEY` (anon) - Client-side, safe to expose
- `SB_SECRET_KEY` (service_role) - Server-side only, NEVER expose

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run lint` - Run linting
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run tests

## Testing and Quality Assurance
Always run before considering work complete:
1. `npm run lint` - Must pass with 0 errors
2. `npm run typecheck` - Verify TypeScript types
3. `npm test` - Run test suite
4. Visual inspection - Ensure UI/UX functions correctly

## Git Workflow
- Main branch: `main`
- Only commit when explicitly requested
- Follow existing commit message patterns
- Always review last 3 commits before starting work

## Audit Logging Requirements
- Use the audit logger service for all application logging
- Never use `console.log`, `console.error`, etc. in production code

## Security Reminders
- All authentication must use secure tokens
- Rate limiting on sensitive endpoints
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS prevention via proper output encoding

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

## Current Status
- **Architecture**: White-label multi-tenant SaaS
- **CORS**: Fully white-label ready (any HTTPS origin allowed)
- **Database**: PostgreSQL 17 via Supabase with RLS
- **UI**: Envision Atlus design system migration in progress

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

### CORS for Edge Functions

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

## Branch Naming Convention
```
claude/{feature-description}-{unique-id}
```

---

## Feature Documentation (Separate Files)

Detailed documentation for specific features has been moved to the `docs/` folder:

| Document | Description |
|----------|-------------|
| [docs/REFERRAL_SYSTEM.md](docs/REFERRAL_SYSTEM.md) | External referral & reporting system |
| [docs/CAREGIVER_SUITE.md](docs/CAREGIVER_SUITE.md) | Family caregiver PIN-based access |
| [docs/REGISTRATION_FLOWS.md](docs/REGISTRATION_FLOWS.md) | Three registration flows (self, admin, hospital) |
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
REACT_APP_FEATURE_PHYSICAL_THERAPY=true
REACT_APP_FEATURE_CARE_COORDINATION=true
REACT_APP_FEATURE_REFERRAL_MANAGEMENT=true
REACT_APP_FEATURE_QUESTIONNAIRE_ANALYTICS=true
REACT_APP_FEATURE_NEURO_SUITE=true
```
