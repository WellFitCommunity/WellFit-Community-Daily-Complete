/**
 * Encounter State Machine Service
 *
 * Handles encounter status transitions with validation, audit logging,
 * and database-level enforcement. This service is the ONLY way to change
 * encounter status — direct updates to the status column will be blocked
 * by the immutability trigger for finalized encounters.
 *
 * Used by: EncounterService, front desk check-in, provider workflow
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type {
  EncounterStatus,
  EncounterStatusHistoryEntry,
  TransitionResult,
} from '../types/encounterStatus';
import {
  isEncounterStatus,
  canTransitionTo,
  isEditable,
  isFinalized,
  isTerminal,
  getAvailableTransitions,
  STATUS_DISPLAY,
} from '../types/encounterStatus';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface TransitionOptions {
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface EncounterStatusInfo {
  encounter_id: string;
  status: EncounterStatus;
  is_editable: boolean;
  is_finalized: boolean;
  is_terminal: boolean;
  available_transitions: readonly EncounterStatus[];
  display: { label: string; color: string; bgColor: string; description: string };
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const encounterStateMachine = {
  /**
   * Transition an encounter to a new status.
   * Validates the transition, updates the database, and records audit history.
   */
  async transitionStatus(
    encounterId: string,
    newStatus: EncounterStatus,
    changedBy: string,
    options: TransitionOptions = {}
  ): Promise<ServiceResult<TransitionResult>> {
    try {
      // Validate inputs
      if (!encounterId || !newStatus || !changedBy) {
        return failure('INVALID_INPUT', 'Encounter ID, new status, and changed_by are required');
      }

      if (!isEncounterStatus(newStatus)) {
        return failure('INVALID_STATUS', `Invalid encounter status: ${String(newStatus)}`);
      }

      // Call the database transition function (validates + executes atomically)
      const { data, error } = await supabase.rpc('transition_encounter_status', {
        p_encounter_id: encounterId,
        p_new_status: newStatus,
        p_changed_by: changedBy,
        p_reason: options.reason ?? null,
        p_metadata: options.metadata ?? {},
      });

      if (error) {
        // Check for immutability violation
        if (error.message?.includes('CLINICAL_IMMUTABILITY_VIOLATION')) {
          await auditLogger.clinical('ENCOUNTER_TRANSITION_BLOCKED', false, {
            encounter_id: encounterId,
            attempted_status: newStatus,
            changed_by: changedBy,
            error: error.message,
          });
          return failure('IMMUTABILITY_VIOLATION', 'Cannot modify finalized encounter. Use amendment workflow.');
        }

        // Check for invalid transition
        if (error.message?.includes('INVALID_TRANSITION')) {
          return failure('INVALID_TRANSITION', error.message);
        }

        await auditLogger.error(
          'ENCOUNTER_TRANSITION_ERROR',
          new Error(error.message),
          { encounter_id: encounterId, new_status: newStatus }
        );
        return failure('DATABASE_ERROR', error.message);
      }

      const result = data as TransitionResult;

      if (!result.valid) {
        const errorCode = result.code as string | undefined;
        const validCodes = ['INVALID_TRANSITION', 'TRANSITION_FAILED'] as const;
        const resolvedCode = validCodes.find(c => c === errorCode) ?? 'TRANSITION_FAILED';
        return failure(resolvedCode, result.error ?? 'Transition validation failed');
      }

      // Log successful transition
      if (!result.no_op) {
        await auditLogger.clinical('ENCOUNTER_STATUS_TRANSITION', true, {
          encounter_id: encounterId,
          from_status: result.from_status,
          to_status: result.to_status,
          changed_by: changedBy,
          reason: options.reason,
        });
      }

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'ENCOUNTER_TRANSITION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId, new_status: newStatus }
      );
      return failure('UNKNOWN_ERROR', 'Failed to transition encounter status');
    }
  },

  /**
   * Get the current status and available transitions for an encounter.
   */
  async getStatusInfo(encounterId: string): Promise<ServiceResult<EncounterStatusInfo>> {
    try {
      const { data, error } = await supabase
        .from('encounters')
        .select('id, status')
        .eq('id', encounterId)
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      if (!data) {
        return failure('NOT_FOUND', 'Encounter not found');
      }

      const row = data as { id: string; status: string };
      const status = row.status as EncounterStatus;

      if (!isEncounterStatus(status)) {
        return failure('INVALID_STATE', `Encounter has unexpected status: ${row.status}`);
      }

      const display = STATUS_DISPLAY[status];

      return success({
        encounter_id: row.id,
        status,
        is_editable: isEditable(status),
        is_finalized: isFinalized(status),
        is_terminal: isTerminal(status),
        available_transitions: getAvailableTransitions(status),
        display: {
          label: display.label,
          color: display.color,
          bgColor: display.bgColor,
          description: display.description,
        },
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'ENCOUNTER_STATUS_INFO_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to get encounter status info');
    }
  },

  /**
   * Get the status history for an encounter (audit trail).
   */
  async getStatusHistory(
    encounterId: string
  ): Promise<ServiceResult<EncounterStatusHistoryEntry[]>> {
    try {
      const { data, error } = await supabase
        .from('encounter_status_history')
        .select('id, encounter_id, from_status, to_status, changed_by, changed_at, reason, metadata, tenant_id')
        .eq('encounter_id', encounterId)
        .order('changed_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data ?? []) as EncounterStatusHistoryEntry[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'ENCOUNTER_HISTORY_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to get encounter status history');
    }
  },

  /**
   * Check if a specific transition is valid (without executing it).
   */
  canTransition(fromStatus: EncounterStatus, toStatus: EncounterStatus): boolean {
    return canTransitionTo(fromStatus, toStatus);
  },

  /**
   * Check if an encounter is in an editable state.
   */
  async isEncounterEditable(encounterId: string): Promise<ServiceResult<boolean>> {
    const result = await this.getStatusInfo(encounterId);
    if (!result.success) {
      return failure(result.error.code, result.error.message);
    }
    return success(result.data.is_editable);
  },

  /**
   * Validate that a transition would succeed (dry run).
   */
  async validateTransition(
    encounterId: string,
    newStatus: EncounterStatus
  ): Promise<ServiceResult<{ valid: boolean; from_status: EncounterStatus; to_status: EncounterStatus }>> {
    try {
      const { data, error } = await supabase.rpc('validate_encounter_transition', {
        p_encounter_id: encounterId,
        p_new_status: newStatus,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      const result = data as TransitionResult;
      if (!result.valid) {
        const errorCode = result.code as string | undefined;
        const resolvedCode = errorCode === 'INVALID_TRANSITION' ? 'INVALID_TRANSITION' as const : 'TRANSITION_FAILED' as const;
        return failure(resolvedCode, result.error ?? 'Transition not valid');
      }

      return success({
        valid: true,
        from_status: result.from_status as EncounterStatus,
        to_status: newStatus,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'ENCOUNTER_VALIDATE_TRANSITION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId, new_status: newStatus }
      );
      return failure('UNKNOWN_ERROR', 'Failed to validate transition');
    }
  },
};

export default encounterStateMachine;
