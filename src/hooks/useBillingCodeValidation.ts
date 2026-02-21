/**
 * useBillingCodeValidation — React hook for Medical Codes MCP integration
 *
 * Purpose: Validates CPT/ICD-10 code combinations, checks bundling,
 *          and provides code detail lookups for billing workflows
 * Used by: BillingQueueDashboard, SuperbillReviewPanel
 *
 * MCP Integration: Medical Codes (Tier 2) via mcpMedicalCodesClient
 */

import { useState, useCallback } from 'react';
import {
  validateBillingCodes,
  checkCodeBundling,
  getCodeInfo,
  suggestCodesForDescription,
  type CodeValidationResult,
  type BundlingIssue,
  type CPTCode,
  type ICD10Code,
  type MedicalCodeResult,
} from '../services/mcp/mcpMedicalCodesClient';
import { auditLogger } from '../services/auditLogger';

export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'warnings' | 'error';

export interface CodeValidationState {
  status: ValidationStatus;
  result: CodeValidationResult | null;
  bundlingIssues: BundlingIssue[];
  warningCount: number;
  error: string | null;
}

export interface CodeSuggestion {
  cpt: CPTCode[];
  icd10: ICD10Code[];
}

const initialState: CodeValidationState = {
  status: 'idle',
  result: null,
  bundlingIssues: [],
  warningCount: 0,
  error: null,
};

export function useBillingCodeValidation() {
  const [state, setState] = useState<CodeValidationState>(initialState);
  const [suggestions, setSuggestions] = useState<CodeSuggestion | null>(null);
  const [suggestingCodes, setSuggestingCodes] = useState(false);

  const validateCodes = useCallback(async (
    cptCodes: string[],
    icd10Codes: string[],
    modifiers?: string[]
  ): Promise<CodeValidationState> => {
    if (cptCodes.length === 0 && icd10Codes.length === 0) {
      const result: CodeValidationState = {
        status: 'warnings',
        result: null,
        bundlingIssues: [],
        warningCount: 1,
        error: 'No codes to validate',
      };
      setState(result);
      return result;
    }

    setState(prev => ({ ...prev, status: 'validating', error: null }));

    try {
      // Step 1: Validate code combinations
      const validationResult: MedicalCodeResult<CodeValidationResult> =
        await validateBillingCodes(cptCodes, icd10Codes, modifiers);

      if (!validationResult.success || !validationResult.data) {
        const result: CodeValidationState = {
          status: 'error',
          result: null,
          bundlingIssues: [],
          warningCount: 0,
          error: validationResult.error || 'Code validation failed',
        };
        setState(result);
        return result;
      }

      // Step 2: Check bundling if multiple CPT codes
      let bundlingIssues: BundlingIssue[] = [];
      if (cptCodes.length > 1) {
        const bundlingResult = await checkCodeBundling(cptCodes);
        if (bundlingResult.success && bundlingResult.data) {
          bundlingIssues = bundlingResult.data;
        }
      }

      const validation = validationResult.data;
      const warningCount = bundlingIssues.length +
        (validation.cpt_validation?.filter(v => !v.valid).length ?? 0) +
        (validation.icd10_validation?.filter(v => !v.valid).length ?? 0);

      await auditLogger.info('BILLING_CODES_VALIDATED', {
        cptCount: cptCodes.length,
        icd10Count: icd10Codes.length,
        isValid: validation.is_valid,
        warningCount,
        bundlingIssues: bundlingIssues.length,
      });

      const result: CodeValidationState = {
        status: warningCount > 0 ? 'warnings' : 'valid',
        result: validation,
        bundlingIssues,
        warningCount,
        error: null,
      };
      setState(result);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      await auditLogger.error(
        'BILLING_CODE_VALIDATION_FAILED',
        err instanceof Error ? err : new Error(error),
        { cptCodes, icd10Codes }
      );
      const result: CodeValidationState = {
        status: 'error',
        result: null,
        bundlingIssues: [],
        warningCount: 0,
        error: `Validation error: ${error}`,
      };
      setState(result);
      return result;
    }
  }, []);

  const suggestCodes = useCallback(async (clinicalDescription: string): Promise<CodeSuggestion | null> => {
    if (!clinicalDescription.trim()) return null;

    setSuggestingCodes(true);
    try {
      const result = await suggestCodesForDescription(clinicalDescription, ['cpt', 'icd10'], 5);
      if (result.success && result.data) {
        const suggestion: CodeSuggestion = {
          cpt: result.data.cpt || [],
          icd10: result.data.icd10 || [],
        };
        setSuggestions(suggestion);
        return suggestion;
      }
      return null;
    } catch (err: unknown) {
      await auditLogger.error(
        'CODE_SUGGESTION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { description: clinicalDescription }
      );
      return null;
    } finally {
      setSuggestingCodes(false);
    }
  }, []);

  const lookupCode = useCallback(async (
    code: string,
    codeType: 'cpt' | 'icd10' | 'hcpcs'
  ): Promise<CPTCode | ICD10Code | null> => {
    try {
      const result = await getCodeInfo(code, codeType);
      if (result.success && result.data) {
        return result.data as CPTCode | ICD10Code;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setSuggestions(null);
  }, []);

  return {
    ...state,
    suggestions,
    suggestingCodes,
    validateCodes,
    suggestCodes,
    lookupCode,
    reset,
  };
}
