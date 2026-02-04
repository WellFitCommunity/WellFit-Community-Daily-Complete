# Pagination Quick Start Guide

**For WellFit Developers**

This is a quick reference for using the pagination utility in your services.

---

## TL;DR

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

// Your existing unbounded query
const query = supabase
  .from('table_name')
  .select('*')
  .eq('some_field', value)
  .order('created_at', { ascending: false });

// Fix: Add pagination
const data = await applyLimit<YourType>(query, PAGINATION_LIMITS.APPROPRIATE_LIMIT);
```

---

## Common Use Cases

### 1. Patient Lab Results

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

async getLabHistory(patientMRN: string): Promise<LabResult[]> {
  const query = supabase
    .from('lab_results')
    .select('*')
    .eq('patient_mrn', patientMRN)
    .order('created_at', { ascending: false });

  return applyLimit<LabResult>(query, PAGINATION_LIMITS.LABS);
}
```

### 2. Wearable Vitals (High Volume)

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

async getVitalHistory(userId: string, vitalType: string): Promise<WearableVitalSign[]> {
  const query = supabase
    .from('wearable_vital_signs')
    .select('*')
    .eq('user_id', userId)
    .eq('vital_type', vitalType)
    .gte('measured_at', startDate.toISOString())
    .order('measured_at', { ascending: true });

  // Wearables can be 1/min = 1440/day, use higher limit
  return applyLimit<WearableVitalSign>(query, PAGINATION_LIMITS.WEARABLE_VITALS);
}
```

### 3. Billing Claims

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

async searchClaims(filters: ClaimFilters): Promise<Claim[]> {
  let query = supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.providerId) query = query.eq('billing_provider_id', filters.providerId);

  return applyLimit<Claim>(query, PAGINATION_LIMITS.CLAIMS);
}
```

### 4. Discharge Plans

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

async getActiveDischargePlans(): Promise<DischargePlan[]> {
  const query = supabase
    .from('discharge_plans')
    .select('*')
    .in('status', ['draft', 'pending_items', 'ready'])
    .order('planned_discharge_date', { ascending: true });

  return applyLimit<DischargePlan>(query, PAGINATION_LIMITS.DISCHARGE_PLANS);
}
```

### 5. Assessments (PT, Neuro, etc.)

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

async getAssessmentsByPatient(patientId: string): Promise<Assessment[]> {
  const query = supabase
    .from('pt_functional_assessments')
    .select('*')
    .eq('patient_id', patientId)
    .order('assessment_date', { ascending: false });

  return applyLimit<Assessment>(query, PAGINATION_LIMITS.ASSESSMENTS);
}
```

### 6. Audit Logs

```typescript
import { applyLimit, PAGINATION_LIMITS } from '../utils/pagination';

async getUserAuditLogs(userId: string): Promise<AuditLog[]> {
  const query = supabase
    .from('admin_usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  return applyLimit<AuditLog>(query, PAGINATION_LIMITS.TRACKING_EVENTS);
}
```

---

## Available Limits

```typescript
PAGINATION_LIMITS = {
  // Clinical data
  VITALS: 100,
  LABS: 50,
  OBSERVATIONS: 100,

  // Wearables (high volume)
  WEARABLE_VITALS: 500,
  WEARABLE_ACTIVITIES: 100,
  DEVICE_READINGS: 500,

  // Patient data
  PATIENTS: 50,
  ENCOUNTERS: 50,
  APPOINTMENTS: 50,

  // Billing
  CLAIMS: 100,
  CLAIM_LINES: 200,
  FEE_SCHEDULES: 50,
  FEE_SCHEDULE_ITEMS: 1000,

  // Audit
  AUDIT_LOGS: 100,
  PHI_ACCESS_LOGS: 100,
  SECURITY_EVENTS: 50,
  TRACKING_EVENTS: 200,

  // Care coordination
  CARE_PLANS: 50,
  DISCHARGE_PLANS: 50,
  HANDOFFS: 50,
  ALERTS: 100,

  // Assessments
  ASSESSMENTS: 50,
  QUESTIONNAIRES: 50,

  // Lists
  PROVIDERS: 100,
  FACILITIES: 100,
  MEDICATIONS: 100,

  // Defaults
  DEFAULT: 50,
  MAX: 1000,
}
```

---

## When NOT to Use Pagination

### Safe Scenarios (No Limit Needed)

1. **Single record lookups**
```typescript
// ✅ Safe - .single() returns exactly 1 record
const user = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();
```

2. **Aggregation queries**
```typescript
// ✅ Safe - Returns single row with count
const { count } = await supabase
  .from('claims')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'submitted');
```

3. **Already scoped to small datasets**
```typescript
// ✅ Probably safe - Claim lines are typically 1-20 per claim
const { data } = await supabase
  .from('claim_lines')
  .eq('claim_id', claimId)
  .order('position');

// But still better to add a safety limit:
return applyLimit<ClaimLine>(query, PAGINATION_LIMITS.CLAIM_LINES);
```

---

## Advanced: Cursor-Based Pagination

For time-series data with millions of records (e.g., wearable vitals):

```typescript
import { applyCursorPagination, PAGINATION_LIMITS } from '../utils/pagination';

async getVitalsWithCursor(
  userId: string,
  cursor?: string
): Promise<CursorPaginatedResult<WearableVitalSign>> {
  const query = supabase
    .from('wearable_vital_signs')
    .select('*')
    .eq('user_id', userId);

  return applyCursorPagination<WearableVitalSign>(
    query,
    'measured_at',  // Timestamp field for cursor
    'id',           // ID field for cursor
    {
      cursor,
      pageSize: PAGINATION_LIMITS.WEARABLE_VITALS,
    }
  );
}
```

**Result:**
```typescript
{
  data: [...],  // Up to 500 records
  meta: {
    nextCursor: "base64_encoded_cursor",
    previousCursor: "base64_encoded_cursor",
    hasMore: true,
    pageSize: 500
  }
}
```

---

## Full Pagination with Metadata

For dashboards that need page counts:

```typescript
import { applyPagination, PAGINATION_LIMITS } from '../utils/pagination';

async getClaimsPaginated(page: number): Promise<PaginatedResult<Claim>> {
  const query = supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false });

  return applyPagination<Claim>(
    query,
    { page, pageSize: PAGINATION_LIMITS.CLAIMS }
  );
}
```

**Result:**
```typescript
{
  data: [...],  // Up to 100 records
  meta: {
    page: 2,
    pageSize: 100,
    total: 1523,
    totalPages: 16,
    hasNextPage: true,
    hasPreviousPage: true
  }
}
```

---

## Error Handling

The `applyLimit()` function throws errors, so wrap in try-catch:

```typescript
async getLabHistory(patientMRN: string): Promise<LabResult[]> {
  try {
    const query = supabase
      .from('lab_results')
      .select('*')
      .eq('patient_mrn', patientMRN)
      .order('created_at', { ascending: false });

    return await applyLimit<LabResult>(query, PAGINATION_LIMITS.LABS);
  } catch (error: any) {
    console.error('Failed to fetch lab history:', error);
    throw new Error(`Lab history query failed: ${error.message}`);
  }
}
```

---

## Code Review Checklist

Before submitting a PR, verify:

- [ ] All `.select()` queries have limits (use `applyLimit()`)
- [ ] No `SELECT *` (specify columns you need)
- [ ] Appropriate limit chosen from `PAGINATION_LIMITS`
- [ ] Error handling added
- [ ] TypeScript types specified
- [ ] Tested with realistic data volumes (1000+ records)

---

## Questions?

- **Full Documentation:** [docs/PERFORMANCE_OPTIMIZATIONS.md](PERFORMANCE_OPTIMIZATIONS.md)
- **Utility Source:** [src/utils/pagination.ts](../src/utils/pagination.ts)
- **Examples:** See fixed services in [PERFORMANCE_FIX_SUMMARY.md](../PERFORMANCE_FIX_SUMMARY.md)
