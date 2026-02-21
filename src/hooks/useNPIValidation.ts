/**
 * useNPIValidation — React hook for NPI Registry MCP integration
 *
 * Purpose: Validates NPI numbers and looks up provider details
 * Used by: BillingProviderForm, EncounterProviderPanel
 */

import { useState, useCallback } from 'react';
import {
  validateNPI,
  lookupProviderByNPI,
  isValidNPIFormat,
  type NPIValidation,
  type ProviderDetails,
  type NPIRegistryResult,
} from '../services/mcp/mcpNPIRegistryClient';
import { auditLogger } from '../services/auditLogger';

export type NPIValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error';

export interface NPIValidationState {
  status: NPIValidationStatus;
  validation: NPIValidation | null;
  provider: ProviderDetails | null;
  error: string | null;
  formatValid: boolean;
}

const initialState: NPIValidationState = {
  status: 'idle',
  validation: null,
  provider: null,
  error: null,
  formatValid: false,
};

export function useNPIValidation() {
  const [state, setState] = useState<NPIValidationState>(initialState);

  const checkFormat = useCallback((npi: string): boolean => {
    const valid = isValidNPIFormat(npi);
    setState(prev => ({ ...prev, formatValid: valid }));
    return valid;
  }, []);

  const validateAndLookup = useCallback(async (npi: string): Promise<NPIValidationState> => {
    // Client-side format check first
    if (!isValidNPIFormat(npi)) {
      const result: NPIValidationState = {
        status: 'invalid',
        validation: null,
        provider: null,
        error: 'Invalid NPI format. Must be 10 digits passing Luhn check.',
        formatValid: false,
      };
      setState(result);
      return result;
    }

    setState(prev => ({ ...prev, status: 'validating', error: null, formatValid: true }));

    try {
      // Step 1: Validate NPI with registry
      const validationResult: NPIRegistryResult<NPIValidation> = await validateNPI(npi);

      if (!validationResult.success || !validationResult.data) {
        const result: NPIValidationState = {
          status: 'error',
          validation: null,
          provider: null,
          error: validationResult.error || 'NPI validation failed',
          formatValid: true,
        };
        setState(result);
        return result;
      }

      const validation = validationResult.data;

      if (!validation.is_active) {
        const result: NPIValidationState = {
          status: 'invalid',
          validation,
          provider: null,
          error: `NPI ${validation.status}: ${validation.validation_message}`,
          formatValid: true,
        };
        setState(result);
        return result;
      }

      // Step 2: Lookup full provider details
      const lookupResult = await lookupProviderByNPI(npi);
      const provider = lookupResult.success && lookupResult.data?.found
        ? lookupResult.data.provider ?? null
        : null;

      await auditLogger.info('NPI_VALIDATED', {
        npi,
        status: validation.status,
        provider_name: validation.provider_name,
      });

      const result: NPIValidationState = {
        status: 'valid',
        validation,
        provider,
        error: null,
        formatValid: true,
      };
      setState(result);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      await auditLogger.error(
        'NPI_VALIDATION_FAILED',
        err instanceof Error ? err : new Error(error),
        { npi }
      );
      const result: NPIValidationState = {
        status: 'error',
        validation: null,
        provider: null,
        error: `Validation error: ${error}`,
        formatValid: true,
      };
      setState(result);
      return result;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    checkFormat,
    validateAndLookup,
    reset,
  };
}
