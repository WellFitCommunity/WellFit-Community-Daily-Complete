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

### Caregiver Suite (Family Access)

Allows family caregivers to view senior health information using a PIN shared by the senior.

**Key Principle: NO REGISTRATION REQUIRED for caregivers** - just need senior's phone + PIN + their own name/phone for logging.

```
Senior sets 4-digit PIN in Settings
         │
         │ Shares PIN with family
         ▼
Caregiver goes to /caregiver-access
         │
         │ Enters: Senior phone + PIN + Their name/phone
         ▼
30-minute read-only session granted
         │
         │ All access is logged
         ▼
Senior can see "Who viewed my data" in Settings
```

**Routes:**
| Route | Purpose | Auth |
|-------|---------|------|
| `/caregiver-access` | Public entry point for caregivers | None (PIN-based) |
| `/senior-view/:seniorId` | Read-only health dashboard | Session token |
| `/senior-reports/:seniorId` | Printable health reports | Session token |
| `/set-caregiver-pin` | Senior sets their 4-digit PIN | Authenticated |
| `/caregiver-dashboard` | Legacy route for registered caregivers (role_code 6) | Authenticated |

**Database Tables:**
- `caregiver_pins` - Stores hashed PINs (PBKDF2 via `hash-pin` edge function)
- `caregiver_access_log` - HIPAA audit trail of all access
- `caregiver_sessions` - Active session management with 30-min expiry

**Key Functions:**
- `create_caregiver_session(...)` - Creates session after PIN verification
- `validate_caregiver_session(token)` - Validates active session
- `end_caregiver_session(token)` - Ends session and logs
- `get_my_access_history(limit)` - Senior views who accessed their data
- `log_caregiver_page_view(token, page)` - Logs which pages were viewed

**Components:**
- `CaregiverAccessPage` - Public PIN entry form
- `SeniorViewPage` - Read-only dashboard (check-ins, mood trends, meds)
- `SeniorReportsPage` - Printable health reports
- `CaregiverAccessHistory` - "Who viewed my data" in senior settings

**Security:**
- Sessions auto-expire after 30 minutes
- All access logged with caregiver identity (name + phone)
- PIN hashed with PBKDF2 (100,000 iterations)
- Senior can change PIN to revoke all access
- Senior can view complete access history

### Three Registration Flows

**CRITICAL: There are THREE distinct registration flows. Each creates different database records.**

#### Flow 1: Self-Registration (WellFit App)
**Who:** End users signing up themselves via `/register`

```
User fills form → SMS verification → auth.users created → profile created
```

| Aspect | Details |
|--------|---------|
| **Files** | `RegisterPage.tsx`, `supabase/functions/register/`, `sms-verify-code/` |
| **auth.users** | YES - created after SMS verification |
| **enrollment_type** | `app` |
| **role_code** | 4 (senior), 5 (volunteer), 6 (caregiver), 11 (contractor), 13 (regular) |
| **Can Login** | YES |
| **Phone Verified** | Via SMS code |

#### Flow 2: Admin/Nurse Enrollment (WellFit App)
**Who:** Staff enrolling community members via `/enroll-senior`

```
Admin fills form → auth.users created immediately → profile created → temp password given to member
```

| Aspect | Details |
|--------|---------|
| **Files** | `EnrollSeniorPage.tsx`, `supabase/functions/enrollClient/` |
| **auth.users** | YES - created immediately by admin |
| **enrollment_type** | `app` |
| **role_code** | 4 (senior) OR 19 (patient) |
| **Can Login** | YES - with temp password from admin |
| **Phone Verified** | Auto-verified (admin-attested) |
| **Audit** | `admin_enroll_audit` table, `created_by` field |

**Role Distinction:**
- **role_code 4 (senior)** - Geriatric patients with age-specific needs and UI
- **role_code 19 (patient)** - Regular (non-geriatric) patients

#### Flow 3: Hospital Registration (Envision Atlus Only)
**Who:** Hospital staff creating clinical patient records - **NO APP ACCESS**

```
Hospital staff fills form → profile ONLY created → NO auth.users record
```

| Aspect | Details |
|--------|---------|
| **Files** | `HospitalPatientEnrollment.tsx`, `enroll_hospital_patient()` function |
| **auth.users** | **NO** - patient cannot login |
| **enrollment_type** | `hospital` |
| **role_code** | 1 (patient - clinical context) |
| **Can Login** | **NO** - backend/clinical record only |
| **Clinical Fields** | MRN, room_number, bed_number, acuity_level, code_status, admission_date, attending_physician_id |
| **Purpose** | EHR integration, physician workflows, shift handoffs |

#### Quick Reference Table

| Aspect | Self-Registration | Admin Enrollment | Hospital Registration |
|--------|-------------------|------------------|----------------------|
| **Product** | WellFit | WellFit | Envision Atlus |
| **auth.users Created** | YES | YES | **NO** |
| **enrollment_type** | `app` | `app` | `hospital` |
| **Can Login to App** | YES | YES | **NO** |
| **role_code** | 4,5,6,11,13 | 4 (senior) or 19 (patient) | 1 |
| **Clinical Fields** | No | No | Yes |

#### Key Schema Fields

```sql
-- Differentiates app users from hospital-only patients
enrollment_type TEXT DEFAULT 'app' CHECK (enrollment_type IN ('hospital', 'app'))

-- Hospital-specific fields (Flow 3 only)
mrn, hospital_unit, bed_number, acuity_level, code_status,
admission_date, attending_physician_id, enrolled_by, enrollment_notes
```

#### Database Views

```sql
-- Filter by enrollment type
CREATE VIEW hospital_patients AS SELECT ... WHERE enrollment_type = 'hospital';
CREATE VIEW app_patients AS SELECT ... WHERE enrollment_type = 'app';
```

## Critical Development Principles

### Development Philosophy
**"I have time to do it right. I do not have time to do it twice."**

**"Always be a pace car, never a race car."**

These principles guide all development on this codebase:
- Take the time to understand the problem fully before writing code
- Research the existing architecture and patterns before making changes
- Implement solutions thoroughly the first time rather than rushing
- Slow, deliberate progress prevents costly rework and technical debt
- When in doubt, pause and investigate rather than forge ahead

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

### Supabase Migration Workflow - CRITICAL
**ALWAYS run migrations you create. Do NOT leave migrations unexecuted.**

**Login Early - Supabase/Docker takes time:**
```bash
# Do this FIRST thing in your session - it takes 30-60 seconds
npx supabase login
```
Supabase and Docker need time to initialize. Log in early so you're not waiting when you need to run migrations.

**Running Migrations:**
```bash
# Link to project (if not already linked)
npx supabase link --project-ref xkybsjnvuohpqpbkikyn

# Push migrations to remote database
npx supabase db push

# Or run a specific migration directly via psql
PGPASSWORD="$DATABASE_PASSWORD" psql "postgresql://postgres.xkybsjnvuohpqpbkikyn:$DATABASE_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f supabase/migrations/MIGRATION_FILE.sql
```

**After creating any migration file, you MUST:**
1. Run the migration against the database
2. Verify it succeeded (check for errors)
3. Test that the new schema works as expected
4. Only then commit and push

**DO NOT** create migration files and leave them unexecuted - this causes schema drift between code and database.

### Database Cleanup Policy - CRITICAL
**DO NOT aggressively delete database tables, functions, or data.**

When asked to "clean up" or reduce "tech debt":
1. **Tables that exist are FEATURES** - Even if not currently referenced in code, they represent planned functionality
2. **Only delete obvious debug/backup tables** - Tables starting with `_` prefix (e.g., `_policy_backup`, `_trigger_log`)
3. **NEVER delete without explicit confirmation** - List candidates and get approval before dropping anything
4. **Seniors vs Patients are DIFFERENT** - Geriatric care (role_code 4) requires separate tracking tables (senior_demographics, senior_health, senior_sdoh) from regular patients
5. **When in doubt, DON'T delete** - It's easier to clean up later than to restore lost schema/data

**Feature modules to PRESERVE (even if not yet wired up in UI):**
- Mobile app support (mobile_*)
- Hospital/shift handoff (hospital_*, handoff_*, shift_handoff_*) - ShiftHandoffDashboard exists
- Billing/claims (claim_*, clearinghouse_*, remittances) - BillingDashboard exists
- Medical codes reference (code_cpt, code_icd10, code_hcpcs, code_modifiers)

**Feature modules NOW WIRED UP (as of 2025-12-02):**
- Referral system - `/referrals` route, `ReferralsDashboard` component
- Physical therapy - `/physical-therapy` route, `PhysicalTherapyDashboard` component
- Mental health - `/mental-health` route, `MentalHealthDashboard` component
- Questionnaires - `/questionnaire-analytics` route, `QuestionnaireAnalyticsDashboard` component
- Care coordination - `/care-coordination` route, `CareCoordinationDashboard` component
- **Parkinson's tracking** - `/neuro-suite` route (Parkinson's tab), integrated into `NeuroSuiteDashboard`
- **NeuroSuite** - `/neuro-suite` route, `NeuroSuiteDashboard` (Stroke, Dementia, Parkinson's, Alerts, Wearables)

### Code Quality Standards
- **Be a surgeon, never a butcher** - make precise, targeted changes
- Respect the existing codebase architecture and patterns
- Do not refactor unrelated code when making targeted fixes
- Only modify what is necessary to complete the task
- Preserve existing functionality unless explicitly asked to change it

### Route Connectivity & Wiring - CRITICAL
**ALWAYS ensure components are properly connected and routed.**

When creating or referencing components:
1. **Verify routes exist in `src/App.tsx`** - Every page/dashboard needs a `<Route path="..." />` entry
2. **Check lazy imports** - Components must be imported with `React.lazy()` at the top of App.tsx
3. **Validate route references** - If a component links to `/some-route`, that route MUST exist
4. **Test navigation paths** - Demo pages, menus, and links must point to actual routes

**Before completing any feature work:**
```bash
# Verify route exists in App.tsx
grep -c 'path="/your-route"' src/App.tsx  # Should return 1+

# Verify component is imported
grep -c 'YourComponent' src/App.tsx  # Should return 2+ (import + usage)
```

**Common routing issues to avoid:**
- Creating a component but forgetting to add its route
- Referencing routes in UI that don't exist (e.g., Demo Page linking to missing routes)
- Mismatched route names (e.g., `/memory-lane` vs `/memory-lane-trivia`)
- Missing `RequireAuth` or `RequireAdminAuth` wrappers on protected routes

**Demo Page routes must be verified** - The Demo Page (`/demo`) is used for client presentations. ALL routes referenced in `src/pages/DemoPage.tsx` MUST exist in App.tsx.

### Component Testing Requirements - MANDATORY
**When creating a new React component, you MUST create a corresponding test file.**

**Test File Location:**
- For component at `src/components/admin/MyComponent.tsx`
- Create test at `src/components/admin/__tests__/MyComponent.test.tsx`

**Minimum Test Coverage Required:**
1. **Rendering tests** - Component renders without crashing
2. **Loading state tests** - Loading skeleton/spinner displays correctly
3. **Data display tests** - Data from API renders in UI
4. **Error handling tests** - Errors are caught and displayed gracefully
5. **User interaction tests** - Buttons, forms, filters work correctly

**Test File Template:**
```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '../MyComponent';

// Mock the AuthContext
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
}));

describe('MyComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<MyComponent />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });

  // Add more tests...
});
```

**DO NOT skip tests when:**
- Creating any component in `src/components/`
- Creating any page in `src/pages/`
- Adding significant new functionality

**Exceptions (tests optional):**
- Pure utility functions without React (still encouraged)
- Simple wrapper components with no logic
- Temporary/debug components

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

## Build System

**IMPORTANT: This is a Create React App (CRA) project, NOT Vite.**

- Environment variables must use `REACT_APP_` prefix
- NEVER use `import.meta.env` (that's Vite syntax)
- Always use `process.env.REACT_APP_*`

## Environment Variables

**Frontend (CRA):**
| Variable | Purpose |
|----------|---------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

**Supabase Key Naming Migration:**
Supabase has migrated to new naming conventions:
| Old Name | New Name | Usage |
|----------|----------|-------|
| `anon` key | `SB_PUBLISHABLE_KEY` | Client-side, safe to expose |
| `service_role` key | `SB_SECRET_KEY` | Server-side only, NEVER expose |

For edge functions, use the Deno.env.get() pattern with the new names when available.

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

### Supabase Timing - Wait for Changes to Propagate
**IMPORTANT:** After deploying edge functions, running migrations, or making database changes via Supabase:
- **Wait at least 60 seconds** before testing changes
- Supabase needs time to propagate changes across their infrastructure
- Edge function deployments may take 30-90 seconds to become active
- RLS policy changes may take a moment to take effect
- If something isn't working immediately after a change, wait and retry before debugging

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
| `src/components/envision-atlus/` | Shared UI component library (EA design system) |
| `src/components/neuro/` | NeuroSuite: Stroke, Dementia, Parkinson's tracking |
| `src/components/physicalTherapy/` | PT workflow dashboard (ICF-based) |
| `src/components/careCoordination/` | Interdisciplinary care team management |
| `src/components/referrals/` | External referral management (hospital partnerships) |
| `src/components/questionnaires/` | SMART questionnaire deployment & analytics |
| `src/services/_base/` | ServiceResult pattern utilities |
| `src/services/parkinsonsService.ts` | Parkinson's disease management service |
| `src/types/parkinsons.ts` | Parkinson's TypeScript types (UPDRS, ROBERT/FORBES) |
| `src/hooks/` | Custom React hooks (useModuleAccess, etc.) |
| `supabase/functions/` | Edge functions (Deno runtime) |
| `supabase/functions/_shared/` | Shared utilities for edge functions |

## Branch Naming Convention
Claude Code branches follow this pattern:
```
claude/{feature-description}-{unique-id}
```
Example: `claude/fix-service-worker-api-01SydJ7ZTrj4W9T3DDpW3sUJ`

---

## Newly Wired Feature Dashboards (2025-12-02)

The following dashboards were wired up to connect existing backend infrastructure to the UI:

### Physical Therapy Dashboard
| Aspect | Details |
|--------|---------|
| **Route** | `/physical-therapy` |
| **Component** | `src/components/physicalTherapy/PhysicalTherapyDashboard.tsx` |
| **Service** | `src/services/physicalTherapyService.ts` |
| **Types** | `src/types/physicalTherapy.ts` (1,023 lines - comprehensive) |
| **Feature Flag** | `REACT_APP_FEATURE_PHYSICAL_THERAPY=true` |
| **Allowed Roles** | admin, super_admin, physical_therapist, pt, physician, nurse |
| **Features** | ICF-based assessments, treatment plans, SMART goals, HEP management, outcome measures (LEFS, ODI, etc.) |

### Care Coordination Dashboard
| Aspect | Details |
|--------|---------|
| **Route** | `/care-coordination` |
| **Component** | `src/components/careCoordination/CareCoordinationDashboard.tsx` |
| **Service** | `src/services/careCoordinationService.ts` |
| **Feature Flag** | `REACT_APP_FEATURE_CARE_COORDINATION=true` |
| **Allowed Roles** | admin, super_admin, case_manager, social_worker, nurse, physician |
| **Features** | Care plan management, team alerts, interdisciplinary coordination, AI recommendations |

### Referrals Dashboard
| Aspect | Details |
|--------|---------|
| **Route** | `/referrals` |
| **Component** | `src/components/referrals/ReferralsDashboard.tsx` |
| **Database Tables** | `external_referral_sources`, `patient_referrals`, `referral_alerts`, `referral_reports` |
| **Feature Flag** | `REACT_APP_FEATURE_REFERRAL_MANAGEMENT=true` |
| **Allowed Roles** | admin, super_admin, case_manager, nurse |
| **Features** | Hospital referral tracking, patient linking, engagement reports, subscription tiers |

### Questionnaire Analytics Dashboard
| Aspect | Details |
|--------|---------|
| **Route** | `/questionnaire-analytics` |
| **Component** | `src/components/questionnaires/QuestionnaireAnalyticsDashboard.tsx` |
| **Database Tables** | `questionnaire_deployments`, `questionnaire_responses`, `question_templates` |
| **Feature Flag** | `REACT_APP_FEATURE_QUESTIONNAIRE_ANALYTICS=true` |
| **Allowed Roles** | admin, super_admin, nurse, case_manager, quality_manager |
| **Features** | SMART questionnaire deployment, response tracking, completion analytics, risk flag detection |

### NeuroSuite Dashboard (with Parkinson's Tab)
| Aspect | Details |
|--------|---------|
| **Route** | `/neuro-suite` |
| **Component** | `src/components/neuro/NeuroSuiteDashboard.tsx` |
| **Service** | `src/services/neuroSuiteService.ts`, `src/services/parkinsonsService.ts` |
| **Types** | `src/types/neuroSuite.ts`, `src/types/parkinsons.ts` |
| **Database Tables** | `parkinsons_patient_registry`, `parkinsons_medications`, `parkinsons_medication_log`, `parkinsons_symptom_diary`, `parkinsons_updrs`, `parkinsons_dbs_sessions`, `parkinsons_robert_tracking`, `parkinsons_forbes_tracking` |
| **Feature Flag** | `REACT_APP_FEATURE_NEURO_SUITE=true` |
| **Allowed Roles** | admin, super_admin, physician, doctor, nurse |
| **Tabs** | Stroke, Dementia, **Parkinson's**, Alerts, Wearables |
| **Parkinson's Features** | Patient registry, medication tracking, UPDRS assessments, DBS session logging, symptom diary, ROBERT & FORBES framework guides, risk stratification |

### Enabling These Dashboards
Add the following to your `.env` file to enable these dashboards:
```env
REACT_APP_FEATURE_PHYSICAL_THERAPY=true
REACT_APP_FEATURE_CARE_COORDINATION=true
REACT_APP_FEATURE_REFERRAL_MANAGEMENT=true
REACT_APP_FEATURE_QUESTIONNAIRE_ANALYTICS=true
REACT_APP_FEATURE_NEURO_SUITE=true
```

---

## Voice Command Infrastructure (ATLUS: Intuitive Technology)

The application includes **continuous global voice recognition** for healthcare workers, enabling hands-free navigation and actions throughout the platform.

### Voice Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `VoiceCommandBar` | `src/components/admin/VoiceCommandBar.tsx` | Global floating voice UI (rendered in App.tsx) |
| `VoiceCommandButton` | `src/components/voice/VoiceCommandButton.tsx` | Standalone floating "Hey Riley" button |
| `useVoiceCommand` | `src/hooks/useVoiceCommand.ts` | React hook for voice recognition |
| `voiceCommandService` | `src/services/voiceCommandService.ts` | "Hey Riley" wake word service |
| `workflowPreferences` | `src/services/workflowPreferences.ts` | Voice command registry (VOICE_COMMANDS array) |

### How Voice Works

1. **Global Availability**: `VoiceCommandBar` is rendered in `App.tsx` - available on ALL pages
2. **Keyboard Shortcut**: `Ctrl+Shift+V` toggles listening
3. **Wake Word**: Say "Hey Riley" to activate the VoiceCommandButton
4. **Command Matching**: Spoken phrases matched against `VOICE_COMMANDS` in `workflowPreferences.ts`

### Adding New Voice Commands

Add commands to `VOICE_COMMANDS` array in `src/services/workflowPreferences.ts`:

```typescript
{
  phrases: ['my command', 'alternative phrase'],
  targetType: 'route' | 'section' | 'category' | 'action',
  targetId: '/route-path' | 'section-id' | 'action:identifier',
  displayName: 'Human Readable Name',
}
```

**Target Types:**
- `route` - Navigate to a page (targetId = route path)
- `section` - Scroll to section in admin panel
- `category` - Expand/collapse category in admin panel
- `action` - Custom action (handled by component)

### Healthcare Voice Commands (Current)

| Command | Action |
|---------|--------|
| "Shift handoff" | Navigate to `/shift-handoff` |
| "Available beds" | Filter bed board to available |
| "High risk patients" | Filter to critical patients |
| "NeuroSuite" | Navigate to `/neuro-suite` |
| "Care coordination" | Navigate to `/care-coordination` |
| "Refresh beds" | Reload bed board data |

### Voice in Specific Dashboards

Some dashboards have **local voice commands** for context-specific actions:

- **BedManagementPanel**: "Mark bed 205A ready", "Start cleaning room 302"
- **ShiftHandoffDashboard**: "Accept all handoffs", "Escalate patient in room 101"

These are implemented directly in the component and work in addition to global commands.

### SmartScribe (Medical Transcription)

For real-time medical documentation, use **SmartScribe**:
- Location: `src/components/smart/RealTimeSmartScribe.tsx`
- Route: `/smart-scribe`
- Features: Real-time transcription, SOAP notes, CPT/ICD-10 suggestions
- Voice: "Start scribe", "Stop recording"

---

## Current Development Status (2025-12-10)

### Recently Completed
- **P0 AI Quick Wins** (2025-12-10)
  - `PatientRiskStrip` component for unified risk display in patient headers
  - `AIFeedbackButton` component for one-click AI feedback capture (learning health system)
  - Demographic columns added to `ai_predictions` for bias detection
  - **PENDING MIGRATION**: `20251210120000_ai_demographic_tracking.sql` - run via Supabase dashboard or psql
- **AI/ML Scale Optimization Audit** - Full 7-area analysis with 90-day roadmap (see `docs/AI_ML_SCALE_OPTIMIZATION_AUDIT.md`)
- **ATLUS Alignment Audit** - Comprehensive audit of platform alignment with ATLUS principles
- **Global Voice Commands** - `VoiceCommandBar` integrated in App.tsx with 40+ voice commands
- **Bed Management Voice** - Local voice commands for bed management workflows
- **Test Suites** - VoiceCommandBar (27 tests), useVoiceCommand (29 tests) - all passing

### Next Agent Todo: P1 Items (90-Day Roadmap Month 2)

**Priority 1 - Differentiation Features:**

1. **GuardianFlowEngine** (`src/services/ai/guardianFlowEngine.ts`)
   - ED crowding prediction (predict ambulance arrivals, estimate wait times)
   - Recommend diversions when capacity critical
   - Calculate EMS capacity impact score
   - Tables: Use existing `bed_management_*`, `shift_handoff_*` data

2. **Patient-Friendly AVS Generation** (`src/services/ai/patientFriendlyAVS.ts`)
   - Generate After Visit Summaries at Flesch-Kincaid grade 6 reading level
   - Use SmartScribe transcription as input
   - Output: plain-language discharge instructions

3. **Plain-Language AI Explanations**
   - Add `plainLanguageExplanation` field to AI prediction outputs
   - Example: "Risk is HIGH because Maria missed 3 check-ins AND has transportation barriers"
   - Start with readmission risk, then extend to other skills

4. **Rural Model Weights** (`src/services/ai/readmissionFeatureExtractor.ts`)
   - Add distance-to-care as risk factor
   - Weight differently for rural vs urban patients
   - Use `patient_rurality` column from new demographic tracking

**Reference:**
- See `docs/AI_ML_SCALE_OPTIMIZATION_AUDIT.md` for full context
- Priority matrix: P0 (done) -> P1 (next) -> P2 -> P3
- 90-day roadmap: Month 1 complete, start Month 2 items

### ATLUS Audit Summary (Score: 7/10)

The ATLUS alignment audit identified key areas for improvement:

| Principle | Score | Key Gap |
|-----------|-------|---------|
| **A - Accountability** | 9/10 | AI reasoning transparency |
| **T - Technology** | 6/10 | Too many clicks (70% reduction needed) |
| **L - Leading** | 7.5/10 | Missing real-time collaboration |
| **U - Unity** | 5.5/10 | No PatientContext (critical) |
| **S - Service** | 7/10 | No provider affirmations |

**Critical Gaps to Address:**
1. **PatientContext** - Patient selection lost between dashboards
2. **Session Persistence** - Navigation history lost on refresh
3. **Click Reduction** - Voice commands added, but need more voice-first workflows

### Super Admin Credentials Reference
| User | Email | UUID | Role |
|------|-------|------|------|
| Maria | maria@wellfitcommunity.com | `ba4f20ad-2707-467b-a87f-d46fe9255d2f` | super_admin |
| Akima | akima@wellfitcommunity.com | `06ce7189-1da3-4e22-a6b2-ede88aa1445a` | super_admin |

---
