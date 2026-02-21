/**
 * useCMSCoverageCheck — React hook for CMS Coverage MCP integration
 *
 * Purpose: Checks LCD/NCD coverage requirements and prior authorization
 *          for procedure codes before superbill approval or claim submission.
 * Used by: SuperbillReviewPanel, EligibilityVerificationPanel
 *
 * MCP Integration: CMS Coverage (Tier 2) via mcpCMSCoverageClient
 */

import { useState, useCallback } from 'react';
import {
  getCoverageRequirements,
  checkPriorAuthRequired,
  type CoverageRequirements,
  type PriorAuthCheck,
} from '../services/mcp/mcpCMSCoverageClient';
import { auditLogger } from '../services/auditLogger';

export type CoverageCheckStatus = 'idle' | 'checking' | 'pass' | 'warnings' | 'error';

export interface CoverageCheckResult {
  coverageResults: CoverageRequirements[];
  priorAuthResults: PriorAuthCheck[];
  missingDocumentation: string[];
  codesRequiringAuth: string[];
}

export interface CoverageCheckState {
  status: CoverageCheckStatus;
  result: CoverageCheckResult | null;
  warningCount: number;
  error: string | null;
}

const initialState: CoverageCheckState = {
  status: 'idle',
  result: null,
  warningCount: 0,
  error: null,
};

export function useCMSCoverageCheck() {
  const [state, setState] = useState<CoverageCheckState>(initialState);

  /**
   * Check coverage requirements and prior auth for a set of CPT codes.
   * Optionally pass ICD-10 codes for more accurate prior auth checks.
   */
  const checkCoverage = useCallback(async (
    cptCodes: string[],
    icd10Codes?: string[],
    patientState?: string
  ): Promise<CoverageCheckState> => {
    if (cptCodes.length === 0) {
      const result: CoverageCheckState = {
        status: 'warnings',
        result: null,
        warningCount: 1,
        error: 'No procedure codes to check',
      };
      setState(result);
      return result;
    }

    setState(prev => ({ ...prev, status: 'checking', error: null }));

    try {
      // Step 1: Check coverage requirements for each CPT code
      const coveragePromises = cptCodes.map(code =>
        getCoverageRequirements(code, patientState)
      );
      const coverageResults = await Promise.all(coveragePromises);

      const validCoverage: CoverageRequirements[] = [];
      const allDocNeeded: string[] = [];

      for (const res of coverageResults) {
        if (res.success && res.data) {
          validCoverage.push(res.data);
          if (res.data.documentation_needed) {
            allDocNeeded.push(...res.data.documentation_needed);
          }
        }
      }

      // Step 2: Check prior authorization requirements for each CPT code
      const authPromises = cptCodes.map(code =>
        checkPriorAuthRequired(code, icd10Codes, patientState)
      );
      const authResults = await Promise.all(authPromises);

      const validAuth: PriorAuthCheck[] = [];
      const codesRequiringAuth: string[] = [];

      for (const res of authResults) {
        if (res.success && res.data) {
          validAuth.push(res.data);
          if (res.data.requires_prior_auth) {
            codesRequiringAuth.push(res.data.cpt_code);
            if (res.data.documentation_required) {
              allDocNeeded.push(...res.data.documentation_required);
            }
          }
        }
      }

      // Deduplicate documentation requirements
      const uniqueDocNeeded = [...new Set(allDocNeeded)];

      const warningCount = codesRequiringAuth.length + uniqueDocNeeded.length;

      await auditLogger.info('CMS_COVERAGE_CHECK_COMPLETE', {
        cptCount: cptCodes.length,
        coverageResultCount: validCoverage.length,
        priorAuthRequired: codesRequiringAuth.length,
        missingDocCount: uniqueDocNeeded.length,
      });

      const checkResult: CoverageCheckResult = {
        coverageResults: validCoverage,
        priorAuthResults: validAuth,
        missingDocumentation: uniqueDocNeeded,
        codesRequiringAuth,
      };

      const finalState: CoverageCheckState = {
        status: warningCount > 0 ? 'warnings' : 'pass',
        result: checkResult,
        warningCount,
        error: null,
      };
      setState(finalState);
      return finalState;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      await auditLogger.error(
        'CMS_COVERAGE_CHECK_FAILED',
        err instanceof Error ? err : new Error(error),
        { cptCodes }
      );
      const errorState: CoverageCheckState = {
        status: 'error',
        result: null,
        warningCount: 0,
        error: `Coverage check failed: ${error}`,
      };
      setState(errorState);
      return errorState;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    checkCoverage,
    reset,
  };
}
