/**
 * FHIR Backwards Compatibility Adapters
 *
 * Normalizes FHIR resources to support both:
 * - FHIR-compliant enterprise deployments (full array/object structures)
 * - Legacy community-only deployments (simplified string fields)
 *
 * This ensures backwards compatibility as the system evolves from community
 * features to full FHIR R4 compliance for hospital integrations.
 */

import type { Condition } from '../../../types/fhir';

/**
 * Normalizes Condition to support both FHIR array fields and simplified string fields
 * Ensures backwards compatibility with legacy systems and community-only deployments
 *
 * @param condition - Condition resource (either format)
 * @returns Normalized Condition with both formats populated
 *
 * @example
 * // Handles legacy format:
 * { category_code: '123', code_code: 'diabetes' }
 * // Returns:
 * { category_code: '123', category: ['123'], code_code: 'diabetes', code: 'diabetes' }
 *
 * @example
 * // Handles FHIR format:
 * { category: ['123'], code: 'diabetes' }
 * // Returns:
 * { category: ['123'], category_code: '123', code: 'diabetes', code_code: 'diabetes' }
 */
export function normalizeCondition(condition: Condition): Condition {
  return {
    ...condition,
    // Sync FHIR array → simplified string (for UI)
    category_code: condition.category_code || condition.category?.[0],
    code_code: condition.code_code || condition.code,
    // Sync simplified string → FHIR array (for database/EHR)
    category: condition.category || (condition.category_code ? [condition.category_code] : undefined),
    code: condition.code || condition.code_code || '',
  };
}

/**
 * Prepares Condition for database insertion (converts to FHIR format)
 *
 * Ensures FHIR array fields are populated from simplified string fields
 * Used before INSERT/UPDATE operations to maintain FHIR compliance
 *
 * @param condition - Partial Condition resource (may have simplified fields)
 * @returns FHIR-compliant Condition ready for database storage
 *
 * @example
 * // Input (legacy format):
 * { category_code: '123', code_code: 'diabetes' }
 * // Output (FHIR-compliant):
 * { category: ['123'], code: 'diabetes', category_code: '123', code_code: 'diabetes' }
 */
export function toFHIRCondition(condition: Partial<Condition>): Partial<Condition> {
  const normalized = { ...condition };

  // Ensure FHIR array fields are populated
  if (normalized.category_code && !normalized.category) {
    normalized.category = [normalized.category_code];
  }
  if (normalized.code_code && !normalized.code) {
    normalized.code = normalized.code_code;
  }

  return normalized;
}
