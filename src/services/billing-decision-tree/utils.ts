// Billing Decision Tree - Utility Functions
// Pure helper functions with no external dependencies

import type { DecisionTreeInput } from '../../types/billingDecisionTree';

/**
 * Check if CPT code is an E/M code (99201-99499)
 */
export function isEMCode(cptCode: string): boolean {
  const code = parseInt(cptCode, 10);
  return code >= 99201 && code <= 99499;
}

/**
 * Check if CPT code is a procedure code (not E/M)
 */
export function isProcedureCode(cptCode: string): boolean {
  return !isEMCode(cptCode) && parseInt(cptCode, 10) < 99000;
}

/**
 * Assess risk level based on presenting diagnoses
 */
export function assessRiskLevel(
  input: DecisionTreeInput
): 'minimal' | 'low' | 'moderate' | 'high' {
  const diagnosisCount = input.presentingDiagnoses.length;

  if (diagnosisCount >= 3) return 'high';
  if (diagnosisCount >= 2) return 'moderate';
  if (diagnosisCount >= 1) return 'low';
  return 'minimal';
}

/**
 * Match ICD-10 code against pattern (supports wildcards)
 * E.g., "E11.*" matches "E11.0", "E11.65", etc.
 */
export function matchesPattern(code: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  // E.g., "E11.*" becomes "^E11\\..*$"
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(code);
}
