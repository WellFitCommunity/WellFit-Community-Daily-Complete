/**
 * FHIR FamilyMemberHistory.condition Service
 *
 * Backs ONC 170.315(a)(12) Family Health History. A condition records a
 * diagnosis attributed to a family member, including the age at onset — the
 * field ONC (a)(12) evaluates. One FamilyMemberHistory may carry multiple
 * conditions.
 *
 * FHIR R4 Resource: FamilyMemberHistory.condition (backbone element)
 * HIPAA §164.312(b): PHI access logged via auditLogger.phi on every operation.
 *
 * Pattern parity with DeviceUseStatementService — same audit / error / return
 * shape.
 *
 * @see https://hl7.org/fhir/R4/familymemberhistory.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  FamilyMemberHistoryCondition,
  CreateFamilyMemberHistoryCondition,
  FHIRApiResponse,
} from '../../types/fhir';
import { auditLogger } from '../auditLogger';

const SELECT_COLS =
  'id, fhir_id, patient_id, family_member_history_id, condition_system, condition_code, condition_display, outcome_code, outcome_display, contributed_to_death, onset_age_string, onset_date, onset_string, note, external_id, tenant_id, created_at, updated_at';

export class FamilyMemberHistoryConditionService {
  /** All conditions across every family member of a patient. */
  static async getByPatient(
    patientId: string
  ): Promise<FHIRApiResponse<FamilyMemberHistoryCondition[]>> {
    try {
      await auditLogger.phi('FAMILY_HISTORY_CONDITION_LIST_READ', patientId, {
        resourceType: 'FamilyMemberHistory.condition',
        operation: 'getByPatient',
      });

      const { data, error } = await supabase
        .from('fhir_family_member_history_conditions')
        .select(SELECT_COLS)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch family history conditions',
      };
    }
  }

  /** All conditions attributed to one family member. */
  static async getByMember(
    familyMemberHistoryId: string
  ): Promise<FHIRApiResponse<FamilyMemberHistoryCondition[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_family_member_history_conditions')
        .select(SELECT_COLS)
        .eq('family_member_history_id', familyMemberHistoryId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch family history conditions',
      };
    }
  }

  /**
   * Create a condition. RLS requires tenant_id = get_current_tenant_id(); the
   * caller MUST resolve tenant_id from useOrderingProvider before invoking.
   */
  static async create(
    condition: CreateFamilyMemberHistoryCondition
  ): Promise<FHIRApiResponse<FamilyMemberHistoryCondition>> {
    try {
      await auditLogger.phi('FAMILY_HISTORY_CONDITION_CREATE', condition.patient_id, {
        resourceType: 'FamilyMemberHistory.condition',
        operation: 'create',
        family_member_history_id: condition.family_member_history_id,
        condition: condition.condition_display,
      });

      const { data, error } = await supabase
        .from('fhir_family_member_history_conditions')
        .insert([condition])
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create family history condition',
      };
    }
  }

  /** Update a condition (correction, outcome change). */
  static async update(
    id: string,
    updates: Partial<FamilyMemberHistoryCondition>
  ): Promise<FHIRApiResponse<FamilyMemberHistoryCondition>> {
    try {
      const { data, error } = await supabase
        .from('fhir_family_member_history_conditions')
        .update(updates)
        .eq('id', id)
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update family history condition',
      };
    }
  }
}
