# Canonical Patient Context Spine

## ATLUS Requirements

This implementation satisfies two core ATLUS requirements:

| Requirement | How Satisfied |
|-------------|---------------|
| **Unity** | Single `getPatientContext()` entry point for all patient data |
| **Accountability** | Every context includes `context_meta` with data sources and timestamps |

---

## Overview

The Patient Context Spine provides:

1. **Single Source of Truth** - One canonical `PatientContext` type
2. **Centralized Fetching** - One `getPatientContext()` function
3. **Traceability** - Full metadata on every fetch
4. **Consistent Identity** - Clear `patient_id` vs `user_id` standard

---

## Files

| File | Purpose |
|------|---------|
| `src/types/patientContext.ts` | Type definitions for `PatientContext` and all related types |
| `src/services/patientContextService.ts` | Canonical fetch service |
| `src/contexts/PatientContext.tsx` | UI state (selected patient across dashboards) |

---

## Identity Standard: `patient_id` vs `user_id`

### The Historical Issue

The codebase has two naming conventions for the same UUID:

| Table | Column Name | References |
|-------|-------------|------------|
| `profiles` | `user_id` | `auth.users(id)` |
| `patient_admissions` | `patient_id` | `auth.users(id)` |
| `care_coordination_plans` | `patient_id` | `auth.users(id)` |
| `encounters` | `patient_id` | `auth.users(id)` |
| (all other clinical tables) | `patient_id` | `auth.users(id)` |

**They are the SAME value** - just named differently.

### Canonical Standard

**Use `patient_id` in all new code.**

When interfacing with legacy code:
```typescript
// profiles.user_id === patient_id (same UUID)
const patientId = profileRow.user_id; // This IS the patient_id

// The canonical type uses patient_id
interface PatientDemographics {
  patient_id: string;  // ← Always use patient_id
  first_name: string | null;
  // ...
}
```

---

## PatientContext Structure

```typescript
interface PatientContext {
  // Always included
  demographics: PatientDemographics;

  // Optional (based on fetch options)
  hospital_details: HospitalPatientDetails | null;
  contacts: PatientContactGraph | null;
  timeline: PatientTimelineSummary | null;
  risk: PatientRiskSummary | null;
  care_plan: PatientCarePlanSummary | null;

  // Always included - ATLUS Accountability
  context_meta: PatientContextMeta;
}
```

### Context Metadata (Traceability)

Every `PatientContext` includes `context_meta`:

```typescript
interface PatientContextMeta {
  generated_at: string;           // ISO 8601 timestamp
  request_id: string;             // Unique request ID for tracing
  options_requested: {...};       // What was requested
  data_sources: DataSourceRecord[]; // Which tables were queried
  data_freshness: 'real_time' | 'recent' | 'stale';
  warnings: string[];             // Any issues during fetch
  fetch_duration_ms: number;      // Performance metric
}
```

This metadata allows:
- Tracing any AI/clinical decision back to its inputs
- Understanding data freshness for risk assessment
- Debugging fetch issues
- Auditing data access patterns

---

## Usage Examples

### Basic Usage

```typescript
import { patientContextService } from '@/services/patientContextService';

// Fetch with defaults (includes contacts, timeline, risk, care_plan)
const result = await patientContextService.getPatientContext(patientId);

if (result.success) {
  const { demographics, contacts, timeline, context_meta } = result.data;

  // Log traceability info
  console.log(`Context generated at: ${context_meta.generated_at}`);
  console.log(`Data freshness: ${context_meta.data_freshness}`);
}
```

### Minimal Fetch (Demographics Only)

```typescript
// Only fetches demographics - faster, less data
const result = await patientContextService.getMinimalContext(patientId);
```

### Full Fetch (Everything Including Hospital Details)

```typescript
// Includes hospital admission info
const result = await patientContextService.getFullContext(patientId);
```

### Custom Options

```typescript
// Custom selection
const result = await patientContextService.getPatientContext(patientId, {
  includeContacts: true,
  includeTimeline: false,
  includeRisk: true,
  includeCarePlan: false,
  includeHospitalDetails: true,
  timelineDays: 14,        // Override default 7 days
  maxTimelineEvents: 20,   // Override default 10
});
```

---

## Fetch Options

| Option | Default | Description |
|--------|---------|-------------|
| `includeContacts` | `true` | Fetch caregivers, emergency contacts, providers |
| `includeTimeline` | `true` | Fetch recent events, last check-in |
| `includeRisk` | `true` | Fetch risk assessment summary |
| `includeCarePlan` | `true` | Fetch active care plan summary |
| `includeHospitalDetails` | `false` | Fetch admission, room, unit info |
| `includeSensitive` | `false` | Include sensitive data (requires permissions) |
| `timelineDays` | `7` | Days of timeline history |
| `maxTimelineEvents` | `10` | Maximum timeline events to return |

---

## Migration Checklist

### Priority 1: High-Risk AI Services (Immediate)

These services make clinical decisions based on patient data:

| Service | File | Risk Level | Migration Notes |
|---------|------|------------|-----------------|
| `readmissionRiskPredictionService` | `src/services/readmissionRiskPredictionService.ts` | **CRITICAL** | Must use context_meta for AI traceability |
| `readmissionRiskPredictor` | `src/services/ai/readmissionRiskPredictor.ts` | **CRITICAL** | AI decisions need full traceability |
| `holisticRiskAssessment` | `src/services/holisticRiskAssessment.ts` | **HIGH** | Aggregates multiple risk factors |
| `careCoordinationService` | `src/services/careCoordinationService.ts` | **HIGH** | Care plan decisions |
| `caregiverBriefingService` | `src/services/ai/caregiverBriefingService.ts` | **HIGH** | Generates patient summaries |

### Priority 2: Clinical Services (Next Sprint)

| Service | File | Notes |
|---------|------|-------|
| `dischargePlanningService` | Various | Discharge decisions |
| `postAcuteTransferService` | `src/services/postAcuteTransferService.ts` | Transfer planning |
| `encounterService` | `src/services/encounterService.ts` | Clinical encounters |
| `patientAvatarService` | `src/services/patientAvatarService.ts` | Avatar visualization |

### Priority 3: Supporting Services (Future)

| Service | File | Notes |
|---------|------|-------|
| `patientOutreachService` | `src/services/patientOutreachService.ts` | Outreach campaigns |
| `neuroSuiteService` | `src/services/neuroSuiteService.ts` | Neuro assessments |
| `seniorDataService` | `src/services/seniorDataService.ts` | Senior data access |

### Migration Pattern

**Before (Direct Query):**
```typescript
// ❌ BAD - Multiple scattered queries
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', patientId)
  .single();

const { data: admission } = await supabase
  .from('patient_admissions')
  .select('*')
  .eq('patient_id', patientId)
  .eq('is_active', true)
  .single();

// No traceability, inconsistent data shapes
```

**After (Canonical Service):**
```typescript
// ✅ GOOD - Single canonical fetch
const result = await patientContextService.getPatientContext(patientId, {
  includeHospitalDetails: true,
});

if (result.success) {
  const { demographics, hospital_details, context_meta } = result.data;

  // Full traceability via context_meta
  auditLogger.info('PATIENT_DATA_ACCESSED', {
    patientId,
    requestId: context_meta.request_id,
    dataSources: context_meta.data_sources.map(s => s.source),
  });
}
```

---

## Guardrails

### Code Review Checklist

When reviewing PRs that touch patient data:

1. **Direct table queries?** - If PR queries `profiles`, `patient_admissions`, etc. directly, it should use `patientContextService` instead
2. **Missing traceability?** - If patient data is used without logging `context_meta`, add it
3. **Inconsistent identity?** - If using `user_id` where `patient_id` should be, fix it

### Lint Rule (Future)

Consider adding an ESLint rule:

```javascript
// eslint-plugin-patient-context (future implementation)
{
  "rules": {
    "patient-context/no-direct-query": "error",
    "patient-context/use-canonical-service": "error"
  }
}
```

---

## Relationship to Existing PatientContext.tsx

The existing `src/contexts/PatientContext.tsx` is for **UI state**:
- Stores the currently selected patient for cross-dashboard navigation
- Persists to localStorage
- Maintains recent patient history

The new `patientContextService` is for **data fetching**:
- Fetches complete patient data from database
- Provides traceability metadata
- Centralizes all patient data queries

They work together:
```typescript
// UI Context - track selection
const { selectedPatient, selectPatient } = usePatientContext();

// Data Service - fetch details when needed
if (selectedPatient) {
  const result = await patientContextService.getPatientContext(selectedPatient.id);
  // Use full context data
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-29 | Initial implementation of canonical Patient Context Spine |
