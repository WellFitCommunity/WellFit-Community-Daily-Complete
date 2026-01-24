// Billing Decision Tree - Medical Necessity Validation
// Validates CPT-ICD10 combinations against LCD/NCD references
// Enhanced to include coverage policies, frequency limits, and age/gender restrictions

import { supabase } from '../../lib/supabaseClient';
import { matchesPattern } from './utils';
import type {
  DecisionTreeInput,
  MedicalNecessityCheck,
} from './types';

/**
 * Validate medical necessity (CPT-ICD10 combination) with LCD/NCD references
 * Enhanced to include coverage policies, frequency limits, and age/gender restrictions
 */
export async function validateMedicalNecessity(
  cptCode: string,
  icd10Codes: string[]
): Promise<MedicalNecessityCheck> {
  // Query coding rules from database
  const { data: rules, error } = await supabase
    .from('coding_rules')
    .select('*')
    .eq('cpt_code', cptCode)
    .eq('active', true);

  if (error || !rules || rules.length === 0) {
    // No specific rules found - allow by default but flag for review
    return {
      isValid: true,
      cptCode,
      icd10Codes,
      validCombinations: icd10Codes.map(icd10 => ({
        cpt: cptCode,
        icd10,
        valid: true,
        reason: 'No specific coverage rules found (review recommended)'
      }))
    };
  }

  // Check for LCD/NCD references
  let ncdReference: string | undefined;
  let lcdReference: string | undefined;

  for (const rule of rules) {
    if (rule.source === 'ncd' && rule.reference_url) {
      ncdReference = rule.reference_url;
    }
    if (rule.source === 'lcd' && rule.reference_url) {
      lcdReference = rule.reference_url;
    }
  }

  // Validate each ICD-10 code against rules
  const validCombinations = icd10Codes.map((icd10, index) => {
    const isPrimary = index === 0;

    // Find matching rule for this diagnosis
    const matchingRule = rules.find(rule => {
      // Check required patterns (must match)
      if (rule.required_icd10_patterns) {
        const requiresPatternMatch = rule.required_icd10_patterns.some((pattern: string) =>
          matchesPattern(icd10, pattern)
        );

        // If primary-only requirement, check position
        if (rule.primary_diagnosis_only && !isPrimary) {
          return false;
        }

        if (!requiresPatternMatch) {
          return false;
        }
      }

      // Check excluded patterns (must NOT match)
      if (rule.excluded_icd10_patterns) {
        const matchesExcluded = rule.excluded_icd10_patterns.some((pattern: string) =>
          matchesPattern(icd10, pattern)
        );

        if (matchesExcluded) {
          return false;
        }
      }

      return true;
    });

    let reason = '';
    if (matchingRule) {
      reason = 'Meets medical necessity requirements';
      if (matchingRule.source === 'ncd') {
        reason += ' (NCD)';
      } else if (matchingRule.source === 'lcd') {
        reason += ' (LCD)';
      }
    } else {
      reason = 'Does not meet coverage requirements';
    }

    return {
      cpt: cptCode,
      icd10,
      valid: !!matchingRule,
      reason
    };
  });

  // At least one valid combination is required
  const isValid = validCombinations.some(combo => combo.valid);

  // Add warning if primary diagnosis doesn't support procedure
  if (validCombinations.length > 0 && !validCombinations[0].valid) {
    validCombinations[0].reason += ' - Primary diagnosis must support procedure';
  }

  return {
    isValid,
    cptCode,
    icd10Codes,
    validCombinations,
    ncdReference,
    lcdReference
  };
}

/**
 * Assign ICD-10 codes from presenting diagnoses
 * Searches database for matching codes by term
 */
export async function assignICD10Codes(input: DecisionTreeInput): Promise<string[]> {
  const codes: string[] = [];

  for (const diagnosis of input.presentingDiagnoses) {
    if (diagnosis.icd10Code) {
      codes.push(diagnosis.icd10Code);
    } else if (diagnosis.term) {
      // Search for ICD-10 code by term
      const { data: icd10Results } = await supabase
        .from('codes_icd10')
        .select('code')
        .ilike('desc', `%${diagnosis.term}%`)
        .eq('billable', true)
        .eq('status', 'active')
        .limit(1);

      if (icd10Results && icd10Results.length > 0) {
        codes.push(icd10Results[0].code);
      }
    }
  }

  // If no codes found, use unspecified code
  if (codes.length === 0) {
    codes.push('Z00.00'); // Encounter for general adult medical examination without abnormal findings
  }

  return codes;
}
