# WellFit Platform Unification Plan

## Overview

This plan consolidates the WellFit platform from disconnected parts into ONE unified engine. The goal is architectural coherence - every piece should feel like it belongs to the same system.

---

## Current Architecture (Correct)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + Vercel | Web application hosting |
| **Backend** | Supabase | Database, Auth, Edge Functions, Storage |
| **Push Notifications** | Firebase | In-app notifications only |

This is a clean separation. No changes needed here.

---

## Phase 1: Unify Feature Flag Systems (Priority: HIGH)

### The Problem
Two separate systems doing the same thing:
- `featureFlagService.ts` - System-wide flags (19 flags, unused in UI)
- `tenantModuleService.ts` - Tenant module config (22 modules, actively used)

### The Solution
Consolidate into ONE system based on `tenantModuleService` (the better foundation).

### Why tenantModuleService Wins
1. Two-tier model (entitlements + active state) - proper B2B licensing
2. Already tenant-aware with RLS policies
3. Audit trail built-in
4. License tier tracking
5. Actually used in the admin UI

### Implementation Steps

#### Step 1.1: Add Global Override Layer
```sql
-- Add to tenant_module_config for emergency kill switches
ALTER TABLE tenant_module_config
ADD COLUMN IF NOT EXISTS global_overrides JSONB DEFAULT '{}';

-- Example: {"dental_enabled": {"force_disabled": true, "reason": "compliance review"}}
```

#### Step 1.2: Create Unified Access Check
```typescript
// New: src/services/moduleAccessService.ts
// Single source of truth for "can this tenant use this module?"

export async function canAccessModule(
  tenantId: string,
  moduleName: ModuleName
): Promise<{allowed: boolean; reason?: string}> {
  // 1. Check global force_disabled (emergency kill switch)
  // 2. Check tenant entitlement (did they pay for it?)
  // 3. Check tenant enabled (did they turn it on?)
  // Returns unified yes/no with reason
}
```

#### Step 1.3: Create Unified Hook
```typescript
// New: src/hooks/useModuleAccess.ts
// Replaces both useFeatureFlags and useTenantModules for access checks

export function useModuleAccess(moduleName: ModuleName) {
  // Single hook for "can I show this feature?"
  return { canAccess, isLoading, reason };
}
```

#### Step 1.4: Deprecate Old System
```typescript
// src/hooks/useFeatureFlags.ts
/** @deprecated Use useModuleAccess instead */
export function useFeatureFlags() { ... }
```

#### Step 1.5: Migration Mapping
| Old Feature Flag Key | New Module Name |
|---------------------|-----------------|
| clinical.dental_health | dental_enabled |
| clinical.memory_clinic | (add to modules) |
| clinical.mental_health | (add to modules) |
| clinical.stroke_assessment | (add to modules) |
| clinical.neuro_suite | nurseos_clarity_enabled |
| clinical.wearable_integration | (add to modules) |
| population.frequent_flyers | (add to modules) |
| population.discharge_tracking | (add to modules) |
| billing.revenue_dashboard | billing_integration_enabled |
| billing.billing_review | billing_integration_enabled |
| workflow.shift_handoff | (add to modules) |
| workflow.field_visits | (add to modules) |
| workflow.caregiver_portal | (add to modules) |
| emergency.ems_metrics | (add to modules) |
| emergency.coordinated_response | (add to modules) |
| emergency.law_enforcement | (add to modules) |
| admin.admin_reports | (superadmin only) |
| admin.enhanced_questions | (superadmin only) |
| monitoring.* | (superadmin only, separate table) |

---

## Phase 2: Standardize Service Layer (Priority: MEDIUM)

### The Problem
60+ services with no consistent interface. Some throw errors, some return nulls, some have caching, some don't.

### The Solution
Create a service interface standard that all services follow.

### Service Interface Standard

```typescript
// src/services/_base/ServiceResult.ts
export interface ServiceResult<T> {
  data: T | null;
  error: ServiceError | null;
  success: boolean;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
}

// All service methods return ServiceResult<T>
// Never throw - always return error in result
// Always log via auditLogger
```

### Implementation Steps

#### Step 2.1: Create Base Service Utilities
```typescript
// src/services/_base/index.ts
export { ServiceResult, ServiceError } from './ServiceResult';
export { withAuditLog } from './withAuditLog';
export { withErrorHandling } from './withErrorHandling';
```

#### Step 2.2: Refactor Critical Services First
Priority order:
1. `tenantModuleService.ts` (already good, minor tweaks)
2. `superAdminService.ts`
3. `auditLogger.ts` (already good)
4. `authService.ts`
5. `patientService.ts`

#### Step 2.3: Create Service Template
```typescript
// Template for all new services
import { ServiceResult, withErrorHandling } from './_base';
import { auditLogger } from './auditLogger';

export const ExampleService = {
  async getData(id: string): Promise<ServiceResult<Data>> {
    return withErrorHandling(async () => {
      // Implementation
      auditLogger.info('DATA_FETCHED', { id });
      return { data, error: null, success: true };
    });
  }
};
```

---

## Phase 3: Organize Component Taxonomy (Priority: MEDIUM)

### The Problem
30+ component directories with no clear organization:
- `/neuro` AND `/neuro-suite` (duplication)
- Role-based folders (`/admin`, `/physician`, `/nurse`) mixed with feature folders (`/billing`, `/dental`)

### The Solution
Reorganize by feature domain, not by role.

### New Structure
```
src/components/
├── _shared/              # Truly shared (Button, Modal, etc.)
├── auth/                 # Authentication flows
├── dashboard/            # Dashboard components
├── check-ins/            # Daily check-in system
├── clinical/
│   ├── dental/
│   ├── neuro/            # Merge neuro + neuro-suite
│   ├── mental-health/
│   └── medications/
├── communication/
│   ├── telehealth/
│   └── messaging/
├── billing/
├── admin/
│   ├── tenant/           # Tenant admin components
│   └── super/            # SuperAdmin components
├── patient/
├── provider/
│   ├── physician/
│   ├── nurse/
│   └── chw/
└── integrations/
    ├── ehr/
    └── fhir/
```

### Implementation Steps

#### Step 3.1: Audit Current Components
- List all components
- Identify duplicates
- Map current location → new location

#### Step 3.2: Create Migration Script
```bash
# Don't move manually - use a script to update all imports
```

#### Step 3.3: Merge Duplicates
- `neuro/` + `neuro-suite/` → `clinical/neuro/`
- Identify other duplicates

#### Step 3.4: Update Imports
- Use IDE refactoring or codemod
- Run typecheck after each batch

---

## Phase 4: Clean Up Dead Code (Priority: LOW)

### The Problem
Accumulated unused code from different Claude Code sessions.

### Implementation Steps

#### Step 4.1: Find Unused Exports
```bash
# Use ts-prune or similar
npx ts-prune | grep -v "used in module"
```

#### Step 4.2: Find Unused Files
```bash
# Check for files with no imports
```

#### Step 4.3: Remove Carefully
- Only remove after confirming not used
- Commit separately with clear messages

---

## Phase 5: Documentation (Priority: ONGOING)

### Add to CLAUDE.md
```markdown
## Architecture Principles

### Service Layer
- All services return `ServiceResult<T>`
- Never throw exceptions
- Always log via auditLogger
- See `src/services/_base/` for patterns

### Feature Access
- Use `useModuleAccess(moduleName)` hook
- Three-tier check: global override → entitlement → enabled
- Never check features directly in components

### Component Organization
- Organized by feature domain, not role
- Shared components in `_shared/`
- See `src/components/` structure
```

---

## Execution Order

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | 1.1-1.3 | Unified module access service + hook |
| 1 | 1.4 | Deprecation warnings on old hooks |
| 2 | 1.5 | Migration of all 19 flags to module system |
| 2 | 2.1 | Base service utilities created |
| 3 | 2.2 | Top 5 services refactored |
| 3 | 3.1 | Component audit complete |
| 4 | 3.2-3.4 | Component reorganization |
| 5 | 4.1-4.3 | Dead code removal |
| Ongoing | 5 | Documentation updates |

---

## Success Criteria

After unification, the codebase should:

1. **One way to check feature access** - `useModuleAccess()` only
2. **Consistent service responses** - All return `ServiceResult<T>`
3. **Clear component locations** - Find any component in <10 seconds
4. **No duplicate code** - One implementation per feature
5. **Self-documenting** - New developer understands structure from folders

---

## Notes

- Firebase stays for push notifications (correct usage)
- Supabase is the backend (correct)
- Vercel hosts frontend (correct)
- The three-environment "issue" was misidentified - this is proper separation of concerns
