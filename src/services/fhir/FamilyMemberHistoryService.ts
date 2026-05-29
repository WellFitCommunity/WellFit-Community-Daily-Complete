/**
 * FHIR FamilyMemberHistory Service
 *
 * Backs ONC 170.315(a)(12) Family Health History. This service handles CRUD on
 * the family member record; the member's conditions (with age at onset) live on
 * FamilyMemberHistory.condition and are handled by
 * FamilyMemberHistoryConditionService.
 *
 * FHIR R4 Resource: FamilyMemberHistory
 * HIPAA §164.312(b): PHI access logged via auditLogger.phi on every operation.
 *
 * Pattern parity with DeviceService (ONC-5) — same audit / error / return shape.
 *
 * @see https://hl7.org/fhir/R4/familymemberhistory.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  FamilyMemberHistory,
  CreateFamilyMemberHistory,
  FHIRApiResponse,
} from '../../types/fhir';
import { auditLogger } from '../auditLogger';

const SELECT_COLS =
  'id, fhir_id, patient_id, status, relationship_system, relationship_code, relationship_display, name, sex_code, sex_display, born_date, born_string, age_string, deceased_boolean, deceased_age_string, deceased_date, note, external_id, last_synced_at, sync_source, tenant_id, created_at, updated_at';

export class FamilyMemberHistoryService {
  /** All family member history records on a patient. */
  static async getByPatient(
    patientId: string
  ): Promise<FHIRApiResponse<FamilyMemberHistory[]>> {
    try {
      await auditLogger.phi('FAMILY_HISTORY_LIST_READ', patientId, {
        resourceType: 'FamilyMemberHistory',
        operation: 'getByPatient',
      });

      const { data, error } = await supabase
        .from('fhir_family_member_history')
        .select(SELECT_COLS)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch family history',
      };
    }
  }

  /**
   * Create a new FamilyMemberHistory record. RLS requires tenant_id =
   * get_current_tenant_id(); the caller MUST resolve tenant_id from
   * useOrderingProvider before invoking this method.
   */
  static async create(
    member: CreateFamilyMemberHistory
  ): Promise<FHIRApiResponse<FamilyMemberHistory>> {
    try {
      await auditLogger.phi('FAMILY_HISTORY_CREATE', member.patient_id, {
        resourceType: 'FamilyMemberHistory',
        operation: 'create',
        relationship: member.relationship_display,
      });

      const { data, error } = await supabase
        .from('fhir_family_member_history')
        .insert([member])
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create family history',
      };
    }
  }

  /** Update an existing FamilyMemberHistory (status change, correction). */
  static async update(
    id: string,
    updates: Partial<FamilyMemberHistory>
  ): Promise<FHIRApiResponse<FamilyMemberHistory>> {
    try {
      const { data, error } = await supabase
        .from('fhir_family_member_history')
        .update(updates)
        .eq('id', id)
        .select(SELECT_COLS)
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update family history',
      };
    }
  }
}
