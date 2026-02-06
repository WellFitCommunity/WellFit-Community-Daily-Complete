# Developer Onboarding Guide

**Envision Virtual Edge Group LLC**
**Last Updated:** February 6, 2026

---

## Welcome

WellFit Community and Envision Atlus are two white-label healthcare products built on a shared codebase. This guide gets you from zero to productive.

**Before you write any code, read `CLAUDE.md` in the project root.** It contains the 10 non-negotiable rules that govern all code in this repository.

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 20+ (minimum 18.12) | `node --version` |
| npm | 10+ | `npm --version` |
| Git | 2.30+ | `git --version` |
| Supabase CLI | Latest | `npx supabase --version` |

Optional:
- Docker (for local Supabase)
- Deno (for edge function development)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete.git
cd WellFit-Community-Daily-Complete

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables below)

# 4. Verify everything works
npm run typecheck    # TypeScript compilation (0 errors expected)
npm run lint         # ESLint (0 errors, 0 warnings expected)
npm test             # All 7,490 tests should pass

# 5. Start the development server
npm run dev          # localhost:3000
# Or for GitHub Codespaces:
npm run start:cs     # port 3100
```

---

## Environment Variables

Create `.env.local` with these values (get credentials from team lead):

### Required

```env
VITE_SUPABASE_URL=https://xkybsjnvuohpqpbkikyn.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt-anon-key>
VITE_HCAPTCHA_SITE_KEY=<hcaptcha-site-key>
```

### Optional (for full functionality)

```env
VITE_ANTHROPIC_API_KEY=<claude-api-key>
VITE_FIREBASE_API_KEY=<firebase-key>
VITE_FIREBASE_VAPID_KEY=<firebase-vapid-key>
```

### Feature Flags

```env
VITE_FEATURE_PHYSICAL_THERAPY=true
VITE_FEATURE_CARE_COORDINATION=true
VITE_FEATURE_REFERRAL_MANAGEMENT=true
VITE_FEATURE_QUESTIONNAIRE_ANALYTICS=true
VITE_FEATURE_NEURO_SUITE=true
```

**Important:** This is a Vite project. All client-side env vars must use `VITE_` prefix. Never use `process.env` or `REACT_APP_` patterns.

---

## Architecture Overview

```
WellFit-Community-Daily-Complete/
├── src/                          # Frontend (React 19 + Vite)
│   ├── components/               # UI components
│   │   ├── admin/                # Admin dashboards
│   │   ├── envision-atlus/       # EA design system
│   │   └── patient-avatar/       # Patient visualization
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom hooks
│   ├── pages/                    # Route pages
│   ├── services/                 # Service layer
│   │   └── _base/                # ServiceResult pattern
│   └── types/                    # TypeScript interfaces
├── supabase/
│   ├── functions/                # 138 Edge Functions (Deno)
│   │   ├── _shared/              # Shared utilities
│   │   ├── mcp-fhir-server/      # MCP servers (10)
│   │   ├── ai-*/                 # AI services (40+)
│   │   └── ...
│   └── migrations/               # 522 database migrations
├── docs/                         # Documentation
├── CLAUDE.md                     # AI governance rules (READ THIS)
├── CONTRIBUTING.md               # Contribution guidelines
└── SECURITY.md                   # Security policy
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Two Products** | WellFit (community) and Envision Atlus (clinical) share one codebase |
| **Multi-Tenant** | All data isolated by `tenant_id` via PostgreSQL RLS |
| **White-Label** | Each tenant has custom branding via `useBranding()` hook |
| **25 Roles** | Role-based access from `super_admin` to `patient` |
| **MCP Servers** | 10 Model Context Protocol servers for healthcare data |
| **AI Services** | 40+ Claude-powered clinical intelligence features |
| **Offline-First** | PWA with IndexedDB queue for rural/unreliable internet |

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework (ref-as-prop, no forwardRef) |
| Vite | Latest | Build tool (not CRA/Webpack) |
| TypeScript | 5.x | Type safety (zero `any` types) |
| Tailwind CSS | 4.1.18 | Styling |
| Vitest | Latest | Testing framework |
| Supabase | PostgreSQL 17 | Database, Auth, Edge Functions |
| Deno | Latest | Edge function runtime |
| Claude AI | Opus/Sonnet/Haiku | Clinical AI services |

---

## Development Workflow

### Before Every Task

```bash
git log --oneline -3     # Review recent commits
npm run typecheck        # Verify types compile
npm run lint             # Check for warnings
npm test                 # All tests pass
```

### Creating a Feature

1. **Branch from main:** `git checkout -b claude/{feature-name}-{id}`
2. **Read existing patterns** in the area you're modifying
3. **Write the feature** following CLAUDE.md rules
4. **Add tests** in `__tests__/ComponentName.test.tsx`
5. **Verify:**
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
6. **Report results:**
   ```
   typecheck: 0 errors
   lint: 0 errors, 0 warnings
   tests: 7,490 passed, 0 failed
   ```

### Key Development Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run start:cs` | Dev server for Codespaces (port 3100) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode |
| `npm run test:ui` | Vitest UI dashboard |
| `npm run test:coverage` | Coverage report |

---

## Code Standards (Non-Negotiable)

These are the rules from CLAUDE.md that will get your PR rejected if violated:

### 1. No `any` Type

```typescript
// BAD
catch (err: any) { ... }
const data: any = response;

// GOOD
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
}
const data = response as PatientRecord[];
```

### 2. No `console.log`

```typescript
// BAD
console.log('Debug:', data);

// GOOD
await auditLogger.info('DATA_LOADED', { count: data.length });
await auditLogger.error('OPERATION_FAILED', error, { context });
```

### 3. Error Handling Pattern

```typescript
try {
  // operation
} catch (err: unknown) {
  await auditLogger.error('OPERATION_FAILED',
    err instanceof Error ? err : new Error(String(err)),
    { context: 'relevant data' }
  );
  return failure('OPERATION_FAILED', 'User-friendly message');
}
```

### 4. Service Layer Pattern

```typescript
import { ServiceResult, success, failure } from './_base';

async function getData(id: string): Promise<ServiceResult<Data>> {
  try {
    const { data, error } = await supabase.from('table').select().eq('id', id).single();
    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success(data);
  } catch (err: unknown) {
    return failure('UNKNOWN_ERROR', 'Failed to get data', err);
  }
}
```

### 5. Vite Environment Variables

```typescript
// BAD (CRA pattern)
process.env.REACT_APP_API_URL

// GOOD (Vite pattern)
import.meta.env.VITE_SUPABASE_URL
```

### 6. React 19 Patterns

```tsx
// BAD (pre-React 19)
const MyComponent = forwardRef((props, ref) => { ... });

// GOOD (React 19)
function MyComponent({ ref, ...props }) { ... }
```

---

## Database

### Connecting

The project uses Supabase PostgreSQL 17 with Row Level Security on all tables.

```typescript
import { supabase } from '@/lib/supabase';

// User-scoped query (RLS enforced)
const { data } = await supabase
  .from('profiles')
  .select('first_name, last_name')
  .eq('user_id', userId)
  .single();
```

### Migrations

```bash
# Login to Supabase
npx supabase login

# Link to project
npx supabase link --project-ref xkybsjnvuohpqpbkikyn

# Push migrations
npx supabase db push

# Start local Supabase (requires Docker)
npm run sb:start
```

**Rule:** Always run migrations you create. Never leave unexecuted migration files.

### Multi-Tenancy

Every query is automatically filtered by `tenant_id` via RLS. The default test tenant is:
- **Code:** `WF-0001`
- **UUID:** `2b902657-6a20-4435-a78a-576f397517ca`

---

## Testing

### Test Structure

```
src/components/feature-name/
├── FeatureName.tsx
└── __tests__/
    └── FeatureName.test.tsx
```

### What to Test

| Area | Required |
|------|:--------:|
| Component rendering | Yes |
| Loading states | Yes |
| Data display | Yes |
| Error handling | Yes |
| User interactions | Yes |

### Running Tests

```bash
npm test                          # All tests
npm test -- --run FeatureName     # Specific file
npm run test:watch                # Watch mode
npm run test:coverage             # Coverage report
```

### Rules

- All tests must pass (100% pass rate required)
- No `.skip()` or `.only()` in committed code
- New components must include tests
- Never delete existing tests

---

## Edge Functions

Edge functions run on Deno (not Node.js) and are deployed to Supabase.

### Structure

```
supabase/functions/
├── _shared/               # Shared utilities (CORS, auth, logging)
│   ├── cors.ts            # CORS handling (no wildcards)
│   ├── mcpServerBase.ts   # MCP server initialization
│   ├── mcpAuthGate.ts     # Role-based auth for MCP servers
│   ├── auditLogger.ts     # Audit logging
│   └── supabaseClient.ts  # Database client
├── mcp-fhir-server/       # FHIR R4 operations
├── ai-medication-*/       # AI clinical services
└── ...
```

### Deploying

```bash
# Deploy a single function
npx supabase functions deploy <function-name> --no-verify-jwt

# Deploy all functions
npx supabase functions deploy --no-verify-jwt
```

Wait 60+ seconds after deploying before testing.

---

## Patient Context

Use the canonical patient context service for any patient data aggregation:

```typescript
import { patientContextService } from '@/services/patientContextService';

// Full context
const result = await patientContextService.getPatientContext(patientId);

// Minimal context (fast)
const minResult = await patientContextService.getMinimalContext(patientId);
```

Do NOT manually join patient data from multiple tables. The service handles identity resolution, data freshness, and traceability.

---

## Key Directories

| Directory | What's There |
|-----------|-------------|
| `src/components/admin/` | Admin dashboards and management |
| `src/components/envision-atlus/` | EA design system components |
| `src/services/_base/` | ServiceResult pattern |
| `src/hooks/` | Custom React hooks |
| `src/types/` | TypeScript interfaces |
| `supabase/functions/_shared/` | Shared edge function utilities |
| `docs/` | All documentation |
| `docs/architecture/` | Architecture decisions and API reference |
| `docs/clinical/` | HIPAA, FHIR, clinical features |
| `docs/compliance/` | Risk assessment, access control, data retention |

---

## Getting Help

1. **Read CLAUDE.md** - It has the answer to most code pattern questions
2. **Check docs/** - Comprehensive documentation for every feature
3. **Review existing code** - Follow established patterns
4. **Ask before guessing** - When in doubt, ask the team

---

## Accessibility Reminder

Target users include seniors with vision and motor impairments:

- Minimum font size: 16px (prefer 18px+)
- Touch targets: minimum 44x44px
- Color contrast: WCAG AA (4.5:1 minimum)
- Clear, non-technical error messages

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
