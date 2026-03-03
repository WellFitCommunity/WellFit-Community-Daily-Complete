/**
 * usePriorAuthMCP — React hook for MCP Prior Auth operations
 *
 * Wraps mcpPriorAuthClient with React state management for loading,
 * error, and result tracking. Provides typed wrappers for all 11
 * prior auth MCP server tools.
 *
 * Used by: PriorAuthDashboard, PriorAuthCreateForm, PriorAuthList
 */

import { useState, useCallback } from 'react';
import { priorAuthMCP } from '../services/mcp/mcpPriorAuthClient';
import type {
  PriorAuthRequest,
  PriorAuthRecord,
  PriorAuthDecision,
  PriorAuthAppeal,
  PriorAuthAppealRecord,
  PriorAuthRequiredCheck,
  PriorAuthStatistics,
  FHIRClaimResource,
} from '../services/mcp/mcpPriorAuthClient';

// =====================================================
// Types
// =====================================================

export type PriorAuthMCPStatus = 'idle' | 'loading' | 'success' | 'error';

interface PriorAuthMCPState {
  status: PriorAuthMCPStatus;
  error: string | null;
}

// =====================================================
// Hook
// =====================================================

export function usePriorAuthMCP() {
  const [state, setState] = useState<PriorAuthMCPState>({
    status: 'idle',
    error: null,
  });

  const setLoading = useCallback(() => {
    setState({ status: 'loading', error: null });
  }, []);

  const setSuccess = useCallback(() => {
    setState({ status: 'success', error: null });
  }, []);

  const setError = useCallback((error: string) => {
    setState({ status: 'error', error });
  }, []);

  const resetState = useCallback(() => {
    setState({ status: 'idle', error: null });
  }, []);

  // ─────────────────────────────────────────────────────
  // Create & Submit
  // ─────────────────────────────────────────────────────

  const createPriorAuth = useCallback(async (request: PriorAuthRequest): Promise<PriorAuthRecord | null> => {
    setLoading();
    const result = await priorAuthMCP.createPriorAuth(request);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to create prior authorization');
    return null;
  }, [setLoading, setSuccess, setError]);

  const submitPriorAuth = useCallback(async (priorAuthId: string): Promise<PriorAuthRecord | null> => {
    setLoading();
    const result = await priorAuthMCP.submitPriorAuth(priorAuthId);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to submit prior authorization');
    return null;
  }, [setLoading, setSuccess, setError]);

  // ─────────────────────────────────────────────────────
  // Decision & Appeals
  // ─────────────────────────────────────────────────────

  const recordDecision = useCallback(async (decision: PriorAuthDecision): Promise<PriorAuthRecord | null> => {
    setLoading();
    const result = await priorAuthMCP.recordDecision(decision);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to record decision');
    return null;
  }, [setLoading, setSuccess, setError]);

  const createAppeal = useCallback(async (appeal: PriorAuthAppeal): Promise<PriorAuthAppealRecord | null> => {
    setLoading();
    const result = await priorAuthMCP.createAppeal(appeal);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to create appeal');
    return null;
  }, [setLoading, setSuccess, setError]);

  // ─────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────

  const checkRequired = useCallback(async (
    payerId: string,
    serviceCodes: string[],
  ): Promise<PriorAuthRequiredCheck | null> => {
    setLoading();
    const result = await priorAuthMCP.checkPriorAuthRequired(payerId, serviceCodes);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to check prior auth requirements');
    return null;
  }, [setLoading, setSuccess, setError]);

  const getStatistics = useCallback(async (): Promise<PriorAuthStatistics | null> => {
    setLoading();
    const result = await priorAuthMCP.getStatistics();
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to fetch statistics');
    return null;
  }, [setLoading, setSuccess, setError]);

  const cancelAuth = useCallback(async (priorAuthId: string, reason?: string): Promise<PriorAuthRecord | null> => {
    setLoading();
    const result = await priorAuthMCP.cancelPriorAuth(priorAuthId, reason);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to cancel prior authorization');
    return null;
  }, [setLoading, setSuccess, setError]);

  const exportToFHIR = useCallback(async (priorAuthId: string): Promise<FHIRClaimResource | null> => {
    setLoading();
    const result = await priorAuthMCP.toFhirClaim(priorAuthId);
    if (result.success && result.data) {
      setSuccess();
      return result.data;
    }
    setError(result.error || 'Failed to export FHIR claim');
    return null;
  }, [setLoading, setSuccess, setError]);

  return {
    // State
    status: state.status,
    error: state.error,
    isLoading: state.status === 'loading',

    // Create & Submit
    createPriorAuth,
    submitPriorAuth,

    // Decision & Appeals
    recordDecision,
    createAppeal,

    // Utilities
    checkRequired,
    getStatistics,
    cancelAuth,
    exportToFHIR,

    // State management
    resetState,
  };
}
