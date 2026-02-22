/**
 * FHIR Procedure Service
 * Handles medical procedures and interventions
 *
 * FHIR R4 Resource: Procedure
 * Purpose: Records procedures performed on patients (surgeries, therapies, interventions)
 *
 * @see https://hl7.org/fhir/R4/procedure.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  Procedure,
  CreateProcedure,
  FHIRApiResponse,
} from '../../types/fhir';

export class ProcedureService {
  /**
   * Get all procedures for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All Procedure resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<Procedure[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_procedures')
        .select('id, fhir_id, patient_id, encounter_id, status, status_reason_code, status_reason_display, category_code, category_display, category_system, code_system, code, code_display, code_text, performed_datetime, performed_period_start, performed_period_end, performed_string, performed_age_value, performed_age_unit, recorder_type, recorder_id, recorder_display, asserter_type, asserter_id, asserter_display, performer_function_code, performer_function_display, performer_actor_type, performer_actor_id, performer_actor_display, performer_on_behalf_of_id, primary_performer_practitioner_id, location_id, location_display, reason_code, reason_code_display, reason_reference_type, reason_reference_id, body_site_code, body_site_display, body_site_system, body_site_text, outcome_code, outcome_display, outcome_text, report_type, report_id, complication_code, complication_display, complication_detail_id, follow_up_code, follow_up_display, note, used_reference_type, used_reference_id, used_code, used_display, based_on_type, based_on_id, part_of_type, part_of_id, billing_code, billing_modifier, billing_charge_amount, billing_units, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('performed_datetime', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch procedures',
      };
    }
  }

  /**
   * Get recent procedures
   *
   * Returns most recent procedures for quick clinical review
   *
   * @param patientId - FHIR Patient resource ID
   * @param limit - Maximum number of procedures to return (default: 20)
   * @returns Recent Procedure resources
   */
  static async getRecent(
    patientId: string,
    limit: number = 20
  ): Promise<FHIRApiResponse<Procedure[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_recent_procedures', {
          patient_id_param: patientId,
          limit_param: limit,
        });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch recent procedures',
      };
    }
  }

  /**
   * Get procedures by encounter
   *
   * Returns all procedures performed during a specific clinical encounter
   * Used for encounter documentation and billing
   *
   * @param encounterId - FHIR Encounter resource ID
   * @returns Procedure resources for the encounter
   */
  static async getByEncounter(encounterId: string): Promise<FHIRApiResponse<Procedure[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_procedures_by_encounter', { encounter_id_param: encounterId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch encounter procedures',
      };
    }
  }

  /**
   * Create a new procedure
   *
   * Records a completed or in-progress procedure
   * Status should be 'in-progress', 'completed', or 'stopped'
   *
   * @param procedure - Procedure resource to create
   * @returns Created Procedure with server-assigned ID
   */
  static async create(procedure: CreateProcedure): Promise<FHIRApiResponse<Procedure>> {
    try {
      const { data, error } = await supabase
        .from('fhir_procedures')
        .insert([procedure])
        .select('id, fhir_id, patient_id, encounter_id, status, status_reason_code, status_reason_display, category_code, category_display, category_system, code_system, code, code_display, code_text, performed_datetime, performed_period_start, performed_period_end, performed_string, performed_age_value, performed_age_unit, recorder_type, recorder_id, recorder_display, asserter_type, asserter_id, asserter_display, performer_function_code, performer_function_display, performer_actor_type, performer_actor_id, performer_actor_display, performer_on_behalf_of_id, primary_performer_practitioner_id, location_id, location_display, reason_code, reason_code_display, reason_reference_type, reason_reference_id, body_site_code, body_site_display, body_site_system, body_site_text, outcome_code, outcome_display, outcome_text, report_type, report_id, complication_code, complication_display, complication_detail_id, follow_up_code, follow_up_display, note, used_reference_type, used_reference_id, used_code, used_display, based_on_type, based_on_id, part_of_type, part_of_id, billing_code, billing_modifier, billing_charge_amount, billing_units, created_at, updated_at')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create procedure',
      };
    }
  }

  /**
   * Update procedure
   *
   * Common use cases:
   * - Change status (in-progress → completed)
   * - Add outcome/complications
   * - Update performed datetime
   *
   * @param id - Procedure resource ID
   * @param updates - Partial Procedure fields to update
   * @returns Updated Procedure resource
   */
  static async update(id: string, updates: Partial<Procedure>): Promise<FHIRApiResponse<Procedure>> {
    try {
      const { data, error } = await supabase
        .from('fhir_procedures')
        .update(updates)
        .eq('id', id)
        .select('id, fhir_id, patient_id, encounter_id, status, status_reason_code, status_reason_display, category_code, category_display, category_system, code_system, code, code_display, code_text, performed_datetime, performed_period_start, performed_period_end, performed_string, performed_age_value, performed_age_unit, recorder_type, recorder_id, recorder_display, asserter_type, asserter_id, asserter_display, performer_function_code, performer_function_display, performer_actor_type, performer_actor_id, performer_actor_display, performer_on_behalf_of_id, primary_performer_practitioner_id, location_id, location_display, reason_code, reason_code_display, reason_reference_type, reason_reference_id, body_site_code, body_site_display, body_site_system, body_site_text, outcome_code, outcome_display, outcome_text, report_type, report_id, complication_code, complication_display, complication_detail_id, follow_up_code, follow_up_display, note, used_reference_type, used_reference_id, used_code, used_display, based_on_type, based_on_id, part_of_type, part_of_id, billing_code, billing_modifier, billing_charge_amount, billing_units, created_at, updated_at')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update procedure',
      };
    }
  }

  /**
   * Get billable procedures
   *
   * Returns procedures eligible for billing with CPT codes
   * Optionally filtered by encounter for claim generation
   *
   * @param patientId - FHIR Patient resource ID
   * @param encounterId - Optional FHIR Encounter resource ID
   * @returns Billable Procedure resources
   */
  static async getBillable(
    patientId: string,
    encounterId?: string
  ): Promise<FHIRApiResponse<Procedure[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_billable_procedures', {
          patient_id_param: patientId,
          encounter_id_param: encounterId || null,
        });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch billable procedures',
      };
    }
  }
}
