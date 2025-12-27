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
        .select('*')
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
        .select()
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
        .select()
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
