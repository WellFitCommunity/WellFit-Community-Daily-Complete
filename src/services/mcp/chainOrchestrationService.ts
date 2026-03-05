/**
 * Chain Orchestration Service — Browser-Side Client
 *
 * Provides a ServiceResult-based API for managing chain pipelines
 * via the mcp-chain-orchestrator edge function.
 *
 * Usage:
 *   import { chainOrchestrationService } from '@/services/mcp/chainOrchestrationService';
 *
 *   const result = await chainOrchestrationService.startChain(
 *     'medical_coding_revenue',
 *     { patient_id: '...', encounter_id: '...', service_date: '2026-03-04' }
 *   );
 */

import { supabase } from '../../lib/supabaseClient';
import { success, failure } from '../_base/ServiceResult';
import type { ServiceResult } from '../_base/ServiceResult';
import type {
  ChainDefinition,
  ChainRun,
  ChainStepDefinition,
  ChainStepResult,
  ChainStatusResponse,
  ChainRunFilters,
} from './chainOrchestration.types';

// ============================================================
// Edge function call helper
// ============================================================

async function callOrchestrator<T>(
  action: string,
  payload: Record<string, unknown>
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'mcp-chain-orchestrator',
      {
        body: { action, ...payload },
      }
    );

    if (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as Record<string, unknown>).message)
        : String(error);
      return failure('CHAIN_EXECUTION_FAILED', message, error);
    }

    if (!data) {
      return failure('CHAIN_EXECUTION_FAILED', 'No response from orchestrator');
    }

    const result = data as Record<string, unknown>;

    if (result.error) {
      const errMsg = typeof result.error === 'string'
        ? result.error
        : JSON.stringify(result.error);
      return failure('CHAIN_EXECUTION_FAILED', errMsg);
    }

    return success(data as T);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('CHAIN_EXECUTION_FAILED', error.message, err);
  }
}

// ============================================================
// Public API
// ============================================================

export const chainOrchestrationService = {
  /**
   * List available chain definitions.
   */
  async listChains(): Promise<ServiceResult<ChainDefinition[]>> {
    try {
      const { data, error } = await supabase
        .from('chain_definitions')
        .select('*')
        .eq('is_active', true)
        .order('chain_key');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as ChainDefinition[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  /**
   * List step definitions for a specific chain.
   * Ordered by step_order ascending.
   */
  async listChainSteps(
    chainDefinitionId: string
  ): Promise<ServiceResult<ChainStepDefinition[]>> {
    if (!chainDefinitionId) {
      return failure('INVALID_INPUT', 'chain_definition_id is required');
    }

    try {
      const { data, error } = await supabase
        .from('chain_step_definitions')
        .select('*')
        .eq('chain_definition_id', chainDefinitionId)
        .order('step_order');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as ChainStepDefinition[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  /**
   * Start a new chain run.
   *
   * @param chainKey - Chain definition key (e.g., 'medical_coding_revenue')
   * @param inputParams - Input parameters for the chain
   * @returns The created chain run (may be running, awaiting_approval, or completed)
   */
  async startChain(
    chainKey: string,
    inputParams: Record<string, unknown>
  ): Promise<ServiceResult<{ run: ChainRun }>> {
    if (!chainKey) {
      return failure('INVALID_INPUT', 'chain_key is required');
    }

    return callOrchestrator<{ run: ChainRun }>('start', {
      chain_key: chainKey,
      input_params: inputParams,
    });
  },

  /**
   * Get the current status of a chain run, including all step results.
   */
  async getChainStatus(
    chainRunId: string
  ): Promise<ServiceResult<ChainStatusResponse>> {
    if (!chainRunId) {
      return failure('INVALID_INPUT', 'chain_run_id is required');
    }

    return callOrchestrator<ChainStatusResponse>('status', {
      chain_run_id: chainRunId,
    });
  },

  /**
   * Approve or reject a step that is awaiting approval.
   *
   * @param chainRunId - The chain run ID
   * @param stepResultId - The specific step result ID to approve/reject
   * @param decision - 'approved' or 'rejected'
   * @param notes - Optional notes explaining the decision
   */
  async approveStep(
    chainRunId: string,
    stepResultId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ): Promise<ServiceResult<{ step: ChainStepResult }>> {
    if (!chainRunId || !stepResultId) {
      return failure('INVALID_INPUT', 'chain_run_id and step_result_id are required');
    }

    return callOrchestrator<{ step: ChainStepResult }>('approve', {
      chain_run_id: chainRunId,
      step_result_id: stepResultId,
      decision,
      notes,
    });
  },

  /**
   * Resume a chain that is paused (awaiting_approval after approve) or failed.
   */
  async resumeChain(
    chainRunId: string
  ): Promise<ServiceResult<{ run: ChainRun }>> {
    if (!chainRunId) {
      return failure('INVALID_INPUT', 'chain_run_id is required');
    }

    return callOrchestrator<{ run: ChainRun }>('resume', {
      chain_run_id: chainRunId,
    });
  },

  /**
   * Cancel a running or paused chain.
   */
  async cancelChain(
    chainRunId: string
  ): Promise<ServiceResult<{ run: ChainRun }>> {
    if (!chainRunId) {
      return failure('INVALID_INPUT', 'chain_run_id is required');
    }

    return callOrchestrator<{ run: ChainRun }>('cancel', {
      chain_run_id: chainRunId,
    });
  },

  /**
   * List chain runs with optional filters.
   * Reads directly from database (RLS-scoped to caller's tenant).
   */
  async listChainRuns(
    filters?: ChainRunFilters
  ): Promise<ServiceResult<ChainRun[]>> {
    try {
      let query = supabase
        .from('chain_runs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.chain_key) {
        query = query.eq('chain_key', filters.chain_key);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      query = query.limit(filters?.limit ?? 50);

      const { data, error } = await query;

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as ChainRun[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  // ============================================================
  // Chain Definition CRUD
  // ============================================================

  /**
   * Create a new chain definition.
   */
  async createChainDefinition(
    chainKey: string,
    displayName: string,
    description: string | null
  ): Promise<ServiceResult<ChainDefinition>> {
    if (!chainKey || !displayName) {
      return failure('INVALID_INPUT', 'chain_key and display_name are required');
    }

    try {
      const { data, error } = await supabase
        .from('chain_definitions')
        .insert({
          chain_key: chainKey,
          display_name: displayName,
          description,
          version: 1,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as ChainDefinition);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  /**
   * Update a chain definition.
   */
  async updateChainDefinition(
    id: string,
    updates: { display_name?: string; description?: string | null; is_active?: boolean }
  ): Promise<ServiceResult<ChainDefinition>> {
    if (!id) {
      return failure('INVALID_INPUT', 'id is required');
    }

    try {
      const { data, error } = await supabase
        .from('chain_definitions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as ChainDefinition);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  /**
   * Delete a chain definition and its step definitions.
   * Only allowed if no runs reference this definition.
   */
  async deleteChainDefinition(id: string): Promise<ServiceResult<{ deleted: boolean }>> {
    if (!id) {
      return failure('INVALID_INPUT', 'id is required');
    }

    try {
      // Check for existing runs
      const { data: runs } = await supabase
        .from('chain_runs')
        .select('id')
        .eq('chain_definition_id', id)
        .limit(1);

      if (runs && runs.length > 0) {
        return failure(
          'CONSTRAINT_VIOLATION',
          'Cannot delete chain with existing runs. Deactivate it instead.'
        );
      }

      // Delete steps first (FK constraint)
      await supabase
        .from('chain_step_definitions')
        .delete()
        .eq('chain_definition_id', id);

      const { error } = await supabase
        .from('chain_definitions')
        .delete()
        .eq('id', id);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success({ deleted: true });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  // ============================================================
  // Chain Step Definition CRUD
  // ============================================================

  /**
   * Create a new step definition for a chain.
   */
  async createStepDefinition(
    chainDefinitionId: string,
    step: Omit<ChainStepDefinition, 'id' | 'chain_definition_id'>
  ): Promise<ServiceResult<ChainStepDefinition>> {
    if (!chainDefinitionId) {
      return failure('INVALID_INPUT', 'chain_definition_id is required');
    }

    try {
      const { data, error } = await supabase
        .from('chain_step_definitions')
        .insert({
          chain_definition_id: chainDefinitionId,
          ...step,
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as ChainStepDefinition);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  /**
   * Update a step definition.
   */
  async updateStepDefinition(
    stepId: string,
    updates: Partial<Omit<ChainStepDefinition, 'id' | 'chain_definition_id'>>
  ): Promise<ServiceResult<ChainStepDefinition>> {
    if (!stepId) {
      return failure('INVALID_INPUT', 'step id is required');
    }

    try {
      const { data, error } = await supabase
        .from('chain_step_definitions')
        .update(updates)
        .eq('id', stepId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as ChainStepDefinition);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },

  /**
   * Delete a step definition.
   */
  async deleteStepDefinition(stepId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    if (!stepId) {
      return failure('INVALID_INPUT', 'step id is required');
    }

    try {
      const { error } = await supabase
        .from('chain_step_definitions')
        .delete()
        .eq('id', stepId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success({ deleted: true });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DATABASE_ERROR', error.message, err);
    }
  },
};
