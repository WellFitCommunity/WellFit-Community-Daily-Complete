# FHIR Backwards Compatibility Architecture

## Overview

WellFit supports **dual-field architecture** for FHIR resources to ensure backwards compatibility across different tenant deployment types:

- **EHR-integrated deployments**: Full FHIR R4 compliance with array-based fields
- **Community-only deployments**: Simplified string-based fields
- **Legacy systems**: Existing integrations continue to work without changes

## Architecture Pattern

### Dual-Field Support

All FHIR resources (Condition, DiagnosticReport, MedicationRequest, Procedure) support **both** field patterns:

```typescript
// FHIR R4 Native (for EHR interoperability)
{
  category: ['problem-list-item', 'encounter-diagnosis'],  // Array
  code: 'E11.9'                                            // Standard name
}

// Simplified/Legacy (for backwards compatibility)
{
  category_code: 'problem-list-item',  // Single string
  code_code: 'E11.9'                   // Alternative name
}
```

### Database Schema

The database uses **FHIR R4-compliant schema**:

```sql
-- fhir_conditions table
category TEXT[] DEFAULT ARRAY['problem-list-item']  -- FHIR array
code TEXT NOT NULL                                  -- FHIR standard name

-- fhir_diagnostic_reports table
category TEXT[] NOT NULL DEFAULT ARRAY['LAB']       -- FHIR array
code TEXT NOT NULL                                  -- FHIR standard name
```

### Service Layer Normalization

The `fhirResourceService.ts` includes adapter functions that automatically synchronize fields:

```typescript
// Reading from database
function normalizeCondition(condition: Condition): Condition {
  return {
    ...condition,
    // Populate simplified fields from FHIR arrays
    category_code: condition.category_code || condition.category?.[0],
    code_code: condition.code_code || condition.code,
    // Populate FHIR arrays from simplified fields
    category: condition.category || (condition.category_code ? [condition.category_code] : undefined),
    code: condition.code || condition.code_code!,
  };
}

// Writing to database
function toFHIRCondition(condition: Partial<Condition>): Partial<Condition> {
  const normalized = { ...condition };

  // Ensure FHIR fields are populated
  if (normalized.category_code && !normalized.category) {
    normalized.category = [normalized.category_code];
  }
  if (normalized.code_code && !normalized.code) {
    normalized.code = normalized.code_code;
  }

  return normalized;
}
```

## Usage Examples

### For UI Components (Can Use Either Pattern)

```typescript
// Option 1: Use simplified fields (backwards compatible)
const formData = {
  category_code: 'problem-list-item',
  code_code: 'E11.9',
  code_display: 'Type 2 diabetes'
};

// Option 2: Use FHIR arrays (new EHR integrations)
const formData = {
  category: ['problem-list-item'],
  code: 'E11.9',
  code_display: 'Type 2 diabetes'
};

// Both work! Service layer normalizes automatically
await ConditionService.create(formData);
```

### For EHR Sync Integration

```typescript
// External FHIR data comes in with arrays
const fhirCondition = {
  category: [
    { coding: [{ code: 'problem-list-item' }] }
  ],
  code: {
    coding: [{ code: 'E11.9', display: 'Type 2 diabetes' }]
  }
};

// Sync populates BOTH field patterns
const condition = {
  category: ['problem-list-item'],        // FHIR native
  category_code: 'problem-list-item',     // Backwards compat
  code: 'E11.9',                          // FHIR native
  code_code: 'E11.9',                     // Backwards compat
};
```

## Migration Strategy

### For Existing Tenants

No migration needed! Existing code using simplified fields will continue to work:

```typescript
// Old code (still works)
if (condition.category_code === 'chronic') { ... }

// New code (also works)
if (condition.category?.includes('chronic')) { ... }
```

### For New Integrations

Prefer FHIR R4 fields for new code:

```typescript
// Recommended for new features
const categories = condition.category || [];
const primaryCode = condition.code;
```

## Benefits

1. **Zero Breaking Changes**: Existing tenant integrations continue working
2. **EHR Interoperability**: Full FHIR R4 compliance for health system integrations
3. **Tenant Flexibility**: Community-only deployments don't need FHIR complexity
4. **Gradual Migration**: Teams can migrate to FHIR fields at their own pace
5. **Standards Compliance**: Database follows healthcare interoperability standards

## Technical Details

### Affected Resources

- **Condition**: `category[]` ↔ `category_code`, `code` ↔ `code_code`
- **DiagnosticReport**: `category[]` ↔ `category_code`, `code` ↔ `code_code`
- **MedicationRequest**: Simplified fields for route and dispense quantities
- **Procedure**: Already uses simplified `category_code` and `code` in database

### Service Methods with Normalization

All read operations automatically normalize:
- `ConditionService.getByPatient()` → Returns dual fields
- `ConditionService.getActive()` → Returns dual fields
- `ConditionService.getProblemList()` → Returns dual fields
- `ConditionService.getChronic()` → Returns dual fields

All write operations accept either pattern:
- `ConditionService.create()` → Accepts simplified OR FHIR
- `ConditionService.update()` → Accepts simplified OR FHIR

## Future Considerations

### Phase 1 (Current): Dual Support
- Both field patterns supported
- Automatic synchronization
- Zero migration needed

### Phase 2 (Optional Future): FHIR-Only
If all tenants migrate to FHIR-native:
1. Deprecate simplified fields (with long notice period)
2. Remove normalization layer
3. Use only FHIR R4 fields

This is **optional** and only if business requirements dictate it. Current architecture supports indefinite dual-field usage.

## Questions?

Contact the WellFit engineering team for clarification on FHIR implementation patterns.
