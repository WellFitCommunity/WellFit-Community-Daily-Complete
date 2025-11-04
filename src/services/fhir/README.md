# FHIR Services

Enterprise-grade services for managing FHIR R4 resources in the WellFit Community platform.

## Overview

This directory contains modular services for each FHIR (Fast Healthcare Interoperability Resources) resource type. FHIR is the HL7 standard for healthcare data exchange, supporting interoperability between EHR systems, hospitals, and health information exchanges (HIE).

### Supported FHIR R4 Resources

| Service | Resource Type | Purpose |
|---------|---------------|---------|
| `MedicationRequestService` | MedicationRequest | Prescription and medication order management |
| `ConditionService` | Condition | Patient diagnoses and health conditions |
| `DiagnosticReportService` | DiagnosticReport | Lab results and diagnostic findings |
| `ProcedureService` | Procedure | Medical procedures and interventions |
| `ObservationService` | Observation | Vital signs, lab values, clinical measurements |
| `ImmunizationService` | Immunization | Vaccination records |
| `CarePlanService` | CarePlan | Treatment and care coordination plans |
| `CareTeamService` | CareTeam | Care team composition and roles |

## Architecture

### Design Principles

1. **One Resource = One Service File**
   - Each FHIR resource type has its own service file
   - Max 500 lines per file (split if exceeded)
   - Clear separation of concerns

2. **Backwards Compatibility**
   - Barrel exports in `index.ts` maintain existing imports
   - Legacy redirect in parent `fhirResourceService.ts`
   - Zero breaking changes for existing code

3. **Type Safety**
   - Full TypeScript types from `src/types/fhir.ts`
   - Runtime validation for critical operations
   - Consistent error handling with `FHIRApiResponse<T>`

4. **HIPAA Compliance**
   - All operations audit-logged
   - Row-level security (RLS) enforced at database
   - PHI encryption for sensitive fields

### Directory Structure

```
/src/services/fhir/
├── index.ts                        # Barrel exports (use this for imports)
├── README.md                       # This file
├── MedicationRequestService.ts     # ~200 lines
├── ConditionService.ts             # ~160 lines
├── DiagnosticReportService.ts      # ~160 lines
├── ProcedureService.ts             # ~135 lines
├── ObservationService.ts           # ~215 lines
├── ImmunizationService.ts          # ~270 lines
├── CarePlanService.ts              # ~295 lines
├── CareTeamService.ts              # ~450 lines
├── utils/
│   └── fhirNormalizers.ts          # Shared utility functions
└── __tests__/
    ├── MedicationRequestService.test.ts
    ├── ConditionService.test.ts
    └── ...
```

## Usage

### Importing Services

**Preferred (New Code):**
```typescript
import { MedicationRequestService, ConditionService } from '@/services/fhir';
```

**Legacy (Still Supported):**
```typescript
import { MedicationRequestService } from '@/services/fhirResourceService';
```

### Common Patterns

#### Create a Resource
```typescript
const result = await MedicationRequestService.create({
  patient_id: 'patient-uuid',
  medication_code_coding: '123456',
  medication_display: 'Lisinopril 10mg',
  dosage_text: 'Take one tablet daily',
  status: 'active',
  intent: 'order',
  authored_on: new Date().toISOString(),
});

if (result.success) {
  console.log('Created:', result.data);
} else {
  console.error('Error:', result.error);
}
```

#### Query Resources
```typescript
const medications = await MedicationRequestService.getActive('patient-uuid');
const conditions = await ConditionService.getByPatient('patient-uuid');
```

#### Update a Resource
```typescript
await MedicationRequestService.update('resource-id', {
  status: 'completed',
});
```

## Maintenance Guidelines

### Adding New FHIR Resources

When adding support for a new FHIR resource type (e.g., AllergyIntolerance, Appointment):

1. **Create Service File**
   ```typescript
   // src/services/fhir/AllergyIntoleranceService.ts
   export class AllergyIntoleranceService {
     static async getByPatient(patientId: string): Promise<FHIRApiResponse<AllergyIntolerance[]>> {
       // Implementation
     }
     // ... other CRUD methods
   }
   ```

2. **Add Types** (if not already in `src/types/fhir.ts`)
   ```typescript
   export interface AllergyIntolerance {
     id: string;
     patient_id: string;
     // ... FHIR R4 fields
   }
   ```

3. **Export from Barrel**
   ```typescript
   // src/services/fhir/index.ts
   export { AllergyIntoleranceService } from './AllergyIntoleranceService';
   ```

4. **Add Tests**
   ```typescript
   // src/services/fhir/__tests__/AllergyIntoleranceService.test.ts
   describe('AllergyIntoleranceService', () => { ... });
   ```

5. **Update This README**
   - Add to supported resources table
   - Document any special patterns

### File Size Limits

**Hard limits to maintain long-term:**

- **Service files:** Max 500 lines
- **If exceeded:** Split by functionality:
  - `[Resource]Service.ts` (core CRUD)
  - `[Resource]Validation.ts` (validation logic)
  - `[Resource]Transforms.ts` (data transformations)

### Code Standards

1. **Use Static Methods**
   ```typescript
   export class MedicationRequestService {
     static async getByPatient(...) { }
   }
   ```

2. **Return FHIRApiResponse**
   ```typescript
   return { success: true, data: result };
   // or
   return { success: false, error: 'Error message' };
   ```

3. **JSDoc All Public Methods**
   ```typescript
   /**
    * Get active medications for a patient
    * @param patientId - FHIR Patient resource ID
    * @returns Active MedicationRequest resources
    */
   ```

4. **Handle Errors Consistently**
   ```typescript
   try {
     const { data, error } = await supabase.from('table').select();
     if (error) throw error;
     return { success: true, data };
   } catch (error) {
     return {
       success: false,
       error: error instanceof Error ? error.message : 'Unknown error'
     };
   }
   ```

## FHIR Compliance

### Standards Adherence

- **FHIR Version:** R4 (4.0.1)
- **Conformance:** US Core Implementation Guide
- **Validation:** Server-side validation against FHIR profiles
- **Terminology:** LOINC, SNOMED CT, RxNorm code systems

### Backwards Compatibility Adapters

Some resources include normalizer functions to support:
- Legacy community-only deployments (simplified fields)
- FHIR-compliant enterprise deployments (full FHIR structure)

Example:
```typescript
// Supports both:
condition.category_code = '123';           // Simplified (community)
condition.category = [{ coding: [...] }]; // FHIR-compliant (enterprise)
```

See `utils/fhirNormalizers.ts` for implementation details.

## Database Schema

All FHIR resources are stored in PostgreSQL tables with naming convention:

```
fhir_[resource_type_snake_case]
```

Examples:
- `fhir_medication_requests`
- `fhir_conditions`
- `fhir_diagnostic_reports`

### Security

- **Row-Level Security (RLS):** Enabled on all tables
- **Access Control:** Enforced at database level
- **Audit Logging:** All operations logged to `audit_logs`
- **PHI Encryption:** Sensitive fields encrypted at rest

## Testing

### Running Tests

```bash
npm test -- fhir
```

### Test Coverage Goals

- **Service methods:** 70%+ coverage
- **Critical paths:** 100% coverage (create, update, patient queries)
- **Error handling:** All error paths tested

### Mock Data

Use FHIR R4 example resources from `src/__mocks__/fhir/` for consistent test data.

## Troubleshooting

### Common Issues

**Import Errors After Migration:**
- Old: `import { Service } from '../services/fhirResourceService'`
- New: `import { Service } from '../services/fhir'`
- Both work due to backwards compatibility layer

**Type Errors:**
- Ensure `src/types/fhir.ts` is up to date
- Check for missing exports in `index.ts`

**Database Errors:**
- Verify RLS policies allow operation
- Check user has correct role permissions
- Ensure patient_id exists and is valid UUID

## Resources

- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [US Core Implementation Guide](http://hl7.org/fhir/us/core/)
- [FHIR Resource Index](https://hl7.org/fhir/R4/resourcelist.html)

## Migration History

- **2025-11-03:** Split from monolithic `fhirResourceService.ts` (3,498 lines) into modular services
  - Maintained backwards compatibility
  - Zero breaking changes
  - Improved maintainability for long-term scaling

---

**For questions or architectural decisions, see:** `/docs/architecture/fhir-services.md`
