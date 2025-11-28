# Claude Instructions for WellFit-Community-Daily-Complete

## Project Overview
This codebase contains **two separate white-label products** that can be used independently or together:

### Two White-Label Products

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

**Format Breakdown:**
- `{ORG}` = 2-4 letter organization prefix (e.g., `WF`, `HH`, `VG`)
- `{LICENSE}` = Single digit indicating licensed products
- `{SEQUENCE}` = 3-digit sequence number

**License Digit Convention:**

| Digit | License Type | Example | Description |
|-------|--------------|---------|-------------|
| `0` | **Both Products** | `VG-0002` | Vegas Clinic - WellFit + Envision Atlus |
| `8` | **Envision Atlus Only** | `HH-8001` | Houston Hospital - Clinical engine only |
| `9` | **WellFit Only** | `MC-9001` | Miami Care - Community platform only |

**Example Tenant Codes:**

| Code | Organization | Products |
|------|--------------|----------|
| `WF-0001` | WellFit Community (default/testing) | Both |
| `HH-8001` | Houston Hospital | Envision Atlus Only |
| `VG-0002` | Vegas Clinic | Both |
| `MC-9003` | Miami Care Center | WellFit Only |

**Default Tenant for Testing:**
- `WF-0001` = WellFit Community (UUID: `2b902657-6a20-4435-a78a-576f397517ca`)
- Licensed for BOTH products to enable full integration testing

### White-Label Architecture
- **Multi-tenant**: Multiple organizations use the same codebase with their own domains
- **Dynamic origins**: CORS must accept any tenant's HTTPS domain (no hardcoded allowlists)
- **Tenant branding**: Each tenant can customize appearance via `useBranding()` hook
- **Shared backend**: All tenants share Supabase database with RLS for isolation
- **Shared tenant ID**: Same tenant_id used across both products when licensed together

### External Referral & Reporting System

Hospitals with Atlus-only licenses can refer patients to WellFit Community and receive reports:

```
Hospital (HH-8001, Atlus-only)
         │
         │ Refers patient
         ▼
WellFit Community (patient joins, does check-ins)
         │
         │ Generates reports & alerts
         ▼
Hospital receives insights about THEIR patients only
```

**Tables:**
- `external_referral_sources` - Organizations that can refer patients
- `patient_referrals` - Individual patient referrals with status tracking
- `referral_reports` - Generated engagement/health reports
- `referral_alerts` - Real-time alerts (missed check-ins, mood decline, SDOH flags)

**Subscription Tiers:**
- `basic` - Monthly summary reports
- `standard` - Weekly reports + alerts
- `premium` - Real-time alerts + dashboard access
- `enterprise` - FHIR integration + SLA

**Key Functions:**
- `link_user_to_referral(user_id, phone)` - Auto-links new user to pending referral
- `get_patient_engagement_summary(user_id, start, end)` - Generates engagement data
- `check_referral_alerts(user_id)` - Creates alerts based on patient activity

## Critical Development Principles

### Zero Technical Debt
- Do NOT introduce technical debt with quick fixes or workarounds
- Always implement proper, maintainable solutions
- Refactor when necessary to maintain code quality
- Document any temporary solutions with clear TODO comments and tracking

### HIPAA Compliance & PHI Protection
- **NEVER introduce PHI (Protected Health Information) to the browser**
- All PHI must remain server-side only
- Use patient IDs/tokens for client-side operations, never names, SSN, DOB, etc.
- Use audit logger for all logging - **NEVER use console.log**
- All security-sensitive operations must be logged via the audit system

### Database Standards
- This project uses **PostgreSQL 17**
- Always be proficient with Postgres 17 features and best practices
- Respect the existing database schema - review before making changes
- Use proper migrations for any schema changes
- Leverage Postgres 17 features (JSONB, CTEs, window functions, etc.)

### Code Quality Standards
- **Be a surgeon, never a butcher** - make precise, targeted changes
- Respect the existing codebase architecture and patterns
- Do not refactor unrelated code when making targeted fixes
- Only modify what is necessary to complete the task
- Preserve existing functionality unless explicitly asked to change it

### UI/UX Requirements
- **Always ensure UI/UX remains in working order** after any changes
- Test visual components after modifications
- Maintain responsive design principles
- Preserve accessibility features
- Do not break existing user workflows

### Context & Code Review Protocol
Before starting ANY work, ALWAYS:
1. Review the last 3 commits using `git log --oneline -3` and `git show` for context
2. Understand recent changes and their purpose
3. Check for related branches that might provide context
4. Review the affected schema/database tables
5. Understand the full scope of the change before implementing

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run lint` - Run linting
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run tests

## Key Files and Directories
- `src/components/` - React components
- `src/services/` - Service layer for API calls and business logic
- `supabase/` - Database schema, migrations, and functions
- Registration flow includes hCaptcha widget integration

## Testing and Quality Assurance
Always run the following before considering work complete:
1. `npm run lint` - Ensure code style compliance (must pass with 0 errors)
2. `npm run typecheck` - Verify TypeScript types
3. `npm test` - Run test suite if available
4. Visual inspection - Ensure UI/UX functions correctly
5. Schema review - Verify no unintended database changes

## Git Workflow
- Main branch: `main`
- Only commit when explicitly requested by the user
- Follow existing commit message patterns from git log
- Always review last 3 commits before starting work

## Audit Logging Requirements
- Use the audit logger service for all application logging
- Never use `console.log`, `console.error`, etc. in production code
- Audit logs must include:
  - User ID (when applicable)
  - Action taken
  - Timestamp
  - Relevant context (without PHI)
  - Security-sensitive operations

## Security Reminders
- All authentication must use secure tokens
- Rate limiting on sensitive endpoints
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS prevention via proper output encoding
- CSRF protection on state-changing operations

## Architecture Patterns

### Module Access (Feature Flags)
- Use `useModuleAccess(moduleName)` hook - the ONE way to check module access
- Two-tier system: entitlements (paid for) + enabled (turned on)
- See `src/hooks/useModuleAccess.ts` for implementation
- See `src/types/tenantModules.ts` for module definitions

### Service Layer Standards
- All services should use `ServiceResult<T>` return type from `src/services/_base/`
- Never throw exceptions - return errors in the result
- Always log errors via `auditLogger`
- Use `success()` and `failure()` helpers for consistent responses

Example:
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
- **Edge Functions**: All using shared `_shared/cors.ts` module

## Envision Atlus Design System

The codebase is being migrated to the **Envision Atlus** design system - a clinical-grade UI component library.

### Component Location
- `src/components/envision-atlus/` - All EA components
- `src/styles/envision-atlus-theme.ts` - Theme utilities and color palette

### Available Components
| Component | Purpose |
|-----------|---------|
| `EACard` | Card containers with header/content/footer |
| `EAButton` | Clinical-grade buttons |
| `EABadge` | Status badges |
| `EAMetricCard` | Dashboard metric displays |
| `EAAlert` | Alert/notification displays |
| `EASlider` | Input sliders |
| `EASelect` | Dropdown selections |
| `EAPageLayout` | Page layout wrapper |
| `EARiskIndicator` | Risk level indicators |
| `EASwitch` | Toggle switches for settings |
| `EATabs` | Tab navigation with accessibility |

### Theme Colors
- **Primary (Teal)**: `#00857a` (main), `#33bfb7` (light)
- **Background**: Slate-based dark theme (`slate-900`, `slate-800`)
- **Text**: High contrast for accessibility

### Usage Pattern
```typescript
import { EACard, EAButton, EASwitch } from '../envision-atlus';

// Use components with consistent styling
<EACard>
  <EACardHeader>Title</EACardHeader>
  <EACardContent>...</EACardContent>
</EACard>
```

## Common Issues & Solutions

### Null-Safe Number Formatting
When displaying database values with `.toFixed()`, always use null coalescing:
```typescript
// ❌ Unsafe - will throw if value is null
{metrics.total_saved.toFixed(2)}

// ✅ Safe - handles null values
{(metrics.total_saved ?? 0).toFixed(2)}

// ✅ Safe division - prevents divide by zero
{(((numerator ?? 0) / (denominator || 1)) * 100).toFixed(0)}%
```

### CORS for Edge Functions (White-Label Ready)

**CRITICAL: This is a white-label multi-tenant SaaS. CORS must work for ANY tenant domain.**

All edge functions MUST use the shared CORS module - NEVER create local CORS implementations:

```typescript
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get dynamic CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  // Use corsHeaders in all responses
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

**How it works:**
- `WHITE_LABEL_MODE=true` (default) - allows any HTTPS origin
- Each request's origin is echoed back (NOT wildcard `*`)
- Credentials supported (`Access-Control-Allow-Credentials: true`)
- NEVER use hardcoded origin allowlists in individual functions

**Available exports from `_shared/cors.ts`:**
| Export | Usage |
|--------|-------|
| `corsFromRequest(req)` | Returns `{ headers, allowed }` for the request's origin |
| `handleOptions(req)` | Returns preflight response (use for OPTIONS) |
| `cors(origin, options)` | Generate headers for specific origin string |
| `withCors(req, response)` | Merge CORS headers into existing response |
| `corsHeaders` | Legacy static export (avoid - use `corsFromRequest`) |

**Auth helper with CORS:**
```typescript
import { withCORS } from '../_shared/auth.ts';

serve(withCORS(async (req) => {
  // Your handler - CORS is handled automatically
  return new Response(JSON.stringify({ ok: true }));
}));
```

## Important Directories

| Directory | Purpose |
|-----------|---------|
| `src/components/admin/` | Admin dashboards and management panels |
| `src/components/superAdmin/` | Super admin features (tenant management) |
| `src/components/envision-atlus/` | Shared UI component library |
| `src/services/_base/` | ServiceResult pattern utilities |
| `src/hooks/` | Custom React hooks (useModuleAccess, etc.) |
| `supabase/functions/` | Edge functions (Deno runtime) |
| `supabase/functions/_shared/` | Shared utilities for edge functions |

## Branch Naming Convention
Claude Code branches follow this pattern:
```
claude/{feature-description}-{unique-id}
```
Example: `claude/fix-service-worker-api-01SydJ7ZTrj4W9T3DDpW3sUJ`
