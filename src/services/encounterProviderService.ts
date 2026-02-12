/**
 * Encounter Provider Assignment Service
 *
 * Manages provider assignments for clinical encounters. Every encounter
 * requires at minimum an attending provider before advancing from draft.
 * Supports attending, supervising, referring, and consulting roles.
 *
 * Used by: encounter workflow, billing, scheduling
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type {
  EncounterProviderRole,
  EncounterProvider,
  EncounterProviderWithDetails,
  EncounterProviderAudit,
  AssignProviderResult,
  RemoveProviderResult,
} from '../types/encounterProvider';
import { isEncounterProviderRole } from '../types/encounterProvider';

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const encounterProviderService = {
  /**
   * Assign a provider to an encounter with a specific role.
   * For attending/supervising/referring: replaces existing provider in that role.
   * For consulting: adds to the list (multiple allowed).
   */
  async assignProvider(
    encounterId: string,
    providerId: string,
    role: EncounterProviderRole,
    assignedBy: string,
    notes?: string
  ): Promise<ServiceResult<AssignProviderResult>> {
    try {
      if (!encounterId || !providerId || !assignedBy) {
        return failure('INVALID_INPUT', 'Encounter ID, provider ID, and assigned_by are required');
      }

      if (!isEncounterProviderRole(role)) {
        return failure('VALIDATION_ERROR', `Invalid provider role: ${String(role)}`);
      }

      const { data, error } = await supabase.rpc('assign_encounter_provider', {
        p_encounter_id: encounterId,
        p_provider_id: providerId,
        p_role: role,
        p_is_primary: role === 'attending',
        p_assigned_by: assignedBy,
        p_notes: notes ?? null,
      });

      if (error) {
        await auditLogger.error(
          'PROVIDER_ASSIGNMENT_ERROR',
          new Error(error.message),
          { encounter_id: encounterId, provider_id: providerId, role }
        );
        return failure('DATABASE_ERROR', error.message);
      }

      const result = data as AssignProviderResult;

      if (!result.success) {
        const code = result.code;
        if (code === 'ENCOUNTER_NOT_EDITABLE') {
          return failure('IMMUTABILITY_VIOLATION', result.error ?? 'Encounter is not editable');
        }
        if (code === 'PROVIDER_NOT_FOUND') {
          return failure('NOT_FOUND', result.error ?? 'Provider not found');
        }
        if (code === 'ALREADY_ASSIGNED') {
          return failure('ALREADY_EXISTS', result.error ?? 'Provider already assigned');
        }
        if (code === 'INVALID_ROLE') {
          return failure('VALIDATION_ERROR', result.error ?? 'Invalid role');
        }
        return failure('OPERATION_FAILED', result.error ?? 'Assignment failed');
      }

      await auditLogger.clinical('PROVIDER_ASSIGNED', true, {
        encounter_id: encounterId,
        provider_id: providerId,
        role,
        assignment_id: result.assignment_id,
        assigned_by: assignedBy,
      });

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_ASSIGNMENT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId, provider_id: providerId, role }
      );
      return failure('UNKNOWN_ERROR', 'Failed to assign provider');
    }
  },

  /**
   * Remove a provider assignment from an encounter (soft delete).
   */
  async removeProvider(
    assignmentId: string,
    removedBy: string,
    reason?: string
  ): Promise<ServiceResult<RemoveProviderResult>> {
    try {
      if (!assignmentId || !removedBy) {
        return failure('INVALID_INPUT', 'Assignment ID and removed_by are required');
      }

      const { data, error } = await supabase.rpc('remove_encounter_provider', {
        p_assignment_id: assignmentId,
        p_removed_by: removedBy,
        p_reason: reason ?? null,
      });

      if (error) {
        await auditLogger.error(
          'PROVIDER_REMOVAL_ERROR',
          new Error(error.message),
          { assignment_id: assignmentId }
        );
        return failure('DATABASE_ERROR', error.message);
      }

      const result = data as RemoveProviderResult;

      if (!result.success) {
        const code = result.code;
        if (code === 'NOT_FOUND') {
          return failure('NOT_FOUND', result.error ?? 'Assignment not found');
        }
        if (code === 'ENCOUNTER_NOT_EDITABLE') {
          return failure('IMMUTABILITY_VIOLATION', result.error ?? 'Encounter is not editable');
        }
        return failure('OPERATION_FAILED', result.error ?? 'Removal failed');
      }

      await auditLogger.clinical('PROVIDER_REMOVED', true, {
        assignment_id: assignmentId,
        encounter_id: result.encounter_id,
        role: result.role,
        removed_by: removedBy,
        reason,
      });

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_REMOVAL_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { assignment_id: assignmentId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to remove provider');
    }
  },

  /**
   * Get all active provider assignments for an encounter.
   */
  async getEncounterProviders(
    encounterId: string
  ): Promise<ServiceResult<EncounterProviderWithDetails[]>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const { data, error } = await supabase
        .from('encounter_providers')
        .select(`
          *,
          provider:billing_providers(id, npi, organization_name, taxonomy_code, user_id)
        `)
        .eq('encounter_id', encounterId)
        .is('removed_at', null)
        .order('role');

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data ?? []) as unknown as EncounterProviderWithDetails[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'GET_ENCOUNTER_PROVIDERS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to get encounter providers');
    }
  },

  /**
   * Get the attending (primary) provider for an encounter.
   */
  async getAttendingProvider(
    encounterId: string
  ): Promise<ServiceResult<EncounterProviderWithDetails | null>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const { data, error } = await supabase
        .from('encounter_providers')
        .select(`
          *,
          provider:billing_providers(id, npi, organization_name, taxonomy_code, user_id)
        `)
        .eq('encounter_id', encounterId)
        .eq('role', 'attending')
        .is('removed_at', null)
        .maybeSingle();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data as unknown as EncounterProviderWithDetails | null);
    } catch (err: unknown) {
      await auditLogger.error(
        'GET_ATTENDING_PROVIDER_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to get attending provider');
    }
  },

  /**
   * Check if an encounter has the required provider assignments.
   * Currently: at least an attending provider.
   */
  async validateProviderAssignment(
    encounterId: string
  ): Promise<ServiceResult<{ valid: boolean; missing: string[] }>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const result = await this.getEncounterProviders(encounterId);
      if (!result.success) {
        return failure(result.error.code, result.error.message);
      }

      const providers = result.data;
      const missing: string[] = [];

      const hasAttending = providers.some(p => p.role === 'attending');
      if (!hasAttending) {
        // Also check legacy provider_id on encounters table
        const { data: encounter } = await supabase
          .from('encounters')
          .select('provider_id')
          .eq('id', encounterId)
          .single();

        if (!encounter?.provider_id) {
          missing.push('attending');
        }
      }

      return success({ valid: missing.length === 0, missing });
    } catch (err: unknown) {
      await auditLogger.error(
        'VALIDATE_PROVIDER_ASSIGNMENT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to validate provider assignment');
    }
  },

  /**
   * Get the provider assignment audit trail for an encounter.
   */
  async getProviderAuditTrail(
    encounterId: string
  ): Promise<ServiceResult<EncounterProviderAudit[]>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const { data, error } = await supabase
        .from('encounter_provider_audit')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('changed_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success((data ?? []) as EncounterProviderAudit[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'GET_PROVIDER_AUDIT_TRAIL_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to get provider audit trail');
    }
  },

  /**
   * Change a provider's role on an encounter.
   */
  async changeProviderRole(
    assignmentId: string,
    newRole: EncounterProviderRole,
    changedBy: string
  ): Promise<ServiceResult<EncounterProvider>> {
    try {
      if (!assignmentId || !newRole || !changedBy) {
        return failure('INVALID_INPUT', 'Assignment ID, new role, and changed_by are required');
      }

      if (!isEncounterProviderRole(newRole)) {
        return failure('VALIDATION_ERROR', `Invalid provider role: ${String(newRole)}`);
      }

      // Get current assignment
      const { data: current, error: fetchError } = await supabase
        .from('encounter_providers')
        .select('*')
        .eq('id', assignmentId)
        .is('removed_at', null)
        .single();

      if (fetchError || !current) {
        return failure('NOT_FOUND', 'Assignment not found or already removed');
      }

      const currentAssignment = current as unknown as EncounterProvider;

      if (currentAssignment.role === newRole) {
        return success(currentAssignment);
      }

      // Check encounter editability
      const { data: encounter } = await supabase
        .from('encounters')
        .select('status')
        .eq('id', currentAssignment.encounter_id)
        .single();

      const encounterRow = encounter as { status: string } | null;
      if (encounterRow && ['signed', 'ready_for_billing', 'billed', 'completed', 'cancelled', 'no_show'].includes(encounterRow.status)) {
        return failure('IMMUTABILITY_VIOLATION', `Cannot change provider role on ${encounterRow.status} encounter`);
      }

      // For attending role: auto-set is_primary
      const isPrimary = newRole === 'attending';

      // For attending/supervising/referring: remove existing in that role first
      if (['attending', 'supervising', 'referring'].includes(newRole)) {
        await supabase
          .from('encounter_providers')
          .update({ removed_at: new Date().toISOString(), removed_by: changedBy })
          .eq('encounter_id', currentAssignment.encounter_id)
          .eq('role', newRole)
          .is('removed_at', null)
          .neq('id', assignmentId);
      }

      const { data: updated, error: updateError } = await supabase
        .from('encounter_providers')
        .update({ role: newRole, is_primary: isPrimary, assigned_by: changedBy })
        .eq('id', assignmentId)
        .select()
        .single();

      if (updateError) {
        return failure('DATABASE_ERROR', updateError.message);
      }

      await auditLogger.clinical('PROVIDER_ROLE_CHANGED', true, {
        assignment_id: assignmentId,
        encounter_id: currentAssignment.encounter_id,
        provider_id: currentAssignment.provider_id,
        from_role: currentAssignment.role,
        to_role: newRole,
        changed_by: changedBy,
      });

      return success(updated as unknown as EncounterProvider);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_ROLE_CHANGE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { assignment_id: assignmentId, new_role: newRole }
      );
      return failure('UNKNOWN_ERROR', 'Failed to change provider role');
    }
  },
};

export default encounterProviderService;
