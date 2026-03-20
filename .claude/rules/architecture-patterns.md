# Architecture Patterns

## Module Access (Feature Flags)
- Use `useModuleAccess(moduleName)` hook - the ONE way to check module access
- Two-tier system: entitlements (paid for) + enabled (turned on)

## Service Layer Standards
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

## Audit Logging Requirements
- Use the audit logger service for all application logging
- **NEVER use console.log, console.error, etc. in production code**

## Error Handling Pattern - REQUIRED

**All error handling MUST follow this pattern:**

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

## Canonical Patient Context Spine - ATLUS Unity + Accountability

**Use `patientContextService.getPatientContext()` for patient context aggregation.**

### Files
| File | Purpose |
|------|---------|
| `src/types/patientContext.ts` | Canonical type definitions |
| `src/services/patientContextService.ts` | Canonical fetch function |
| `src/contexts/PatientContext.tsx` | UI state (selected patient) |

### Identity Standard (patient_id vs user_id)
The codebase has two naming conventions:
- `user_id` in `profiles` table (legacy)
- `patient_id` in clinical tables (newer)

**Current State:** Both refer to `auth.users.id` (1:1 mapping).
**Future State:** Do NOT assume permanent 1:1. Caregiver/proxy support will add mapping.

**CANONICAL STANDARD: Use `patient_id` in all new code.** The service abstracts the resolution.

### When to Use the Canonical Service
| Use Case | Approach |
|----------|----------|
| AI/clinical decisions needing traceability | `getPatientContext()` with `context_meta` |
| Dashboard displaying patient summary | `getPatientContext()` with selective options |
| Contact graph, timeline, risk aggregation | `getPatientContext()` (centralizes joins) |
| Single-field lookup (e.g., just name) | Direct query is OK (avoid over-fetch) |
| Checking if patient exists | `patientContextService.patientExists()` or direct |

### Usage Pattern
```typescript
import { patientContextService } from '@/services/patientContextService';
import type { PatientContext } from '@/types/patientContext';

// Full context (default options)
const result = await patientContextService.getPatientContext(patientId);
if (result.success) {
  const { demographics, contacts, timeline, context_meta } = result.data;
  // context_meta provides traceability (ATLUS Accountability)
}

// Minimal context (demographics only - fast)
const minResult = await patientContextService.getMinimalContext(patientId);

// Selective fetch (avoid over-fetching)
const customResult = await patientContextService.getPatientContext(patientId, {
  includeContacts: true,
  includeTimeline: false,
  includeRisk: true,
});
```

### ATLUS Requirements
- **Unity**: Single source of truth - all modules use the same context
- **Accountability**: Every context includes `context_meta` with data sources, timestamps, and freshness

### What NOT to Do
```typescript
// ❌ BAD - Re-implementing identity resolution or "latest" logic ad-hoc
const { data } = await supabase.from('profiles').select('*').eq('user_id', id);
const contacts = await supabase.from('caregiver_access').select('*')...
const lastCheckIn = await supabase.from('daily_check_ins').select('*')...
// ^ This scatters the "patient context" definition across services

// ✅ GOOD - Use canonical service for context
const result = await patientContextService.getPatientContext(id);

// ✅ ALSO OK - Direct query for single field (performance)
const { data } = await supabase.from('profiles').select('first_name').eq('user_id', id).single();
```
