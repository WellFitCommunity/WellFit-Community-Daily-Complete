// =====================================================
// MCP FHIR Server - Validation Rules
// Purpose: FHIR resource validation against required fields and type rules
// =====================================================

/**
 * Required fields per FHIR resource type.
 * These map to the database column names, not FHIR element names.
 */
const REQUIRED_FIELDS: Record<string, string[]> = {
  MedicationRequest: ['medication_name', 'patient_id', 'status'],
  Condition: ['code_display', 'patient_id', 'clinical_status'],
  Observation: ['code', 'patient_id', 'status'],
  Procedure: ['code_display', 'patient_id', 'status'],
  Immunization: ['vaccine_code', 'patient_id', 'status'],
  CarePlan: ['title', 'patient_id', 'status'],
  Goal: ['description', 'patient_id', 'lifecycle_status'],
  AllergyIntolerance: ['code_display', 'patient_id'],
  Encounter: ['patient_id', 'status', 'class_code'],
};

/**
 * Validates a FHIR resource's data against required fields and type-specific rules.
 *
 * @param resourceType - The FHIR resource type (e.g., "Observation")
 * @param data - The resource data to validate (database column format)
 * @returns An object with `valid` boolean and `errors` array
 */
export function validateResource(
  resourceType: string,
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = REQUIRED_FIELDS[resourceType] || [];

  for (const field of required) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type-specific validation
  if (resourceType === 'Observation' && data.value_quantity) {
    const valueQuantity = data.value_quantity as Record<string, unknown>;
    if (typeof valueQuantity.value !== 'number') {
      errors.push('value_quantity.value must be a number');
    }
  }

  if (resourceType === 'MedicationRequest' && data.dosage_instructions) {
    if (typeof data.dosage_instructions !== 'string') {
      errors.push('dosage_instructions must be a string');
    }
  }

  return { valid: errors.length === 0, errors };
}
