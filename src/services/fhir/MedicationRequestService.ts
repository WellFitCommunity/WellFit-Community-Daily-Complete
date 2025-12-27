/**
 * FHIR MedicationRequest Service
 * Handles prescription and medication order management
 *
 * FHIR R4 Resource: MedicationRequest
 * Purpose: Records prescriptions, medication orders, and refill requests
 *
 * @see https://hl7.org/fhir/R4/medicationrequest.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  MedicationRequest,
  CreateMedicationRequest,
  FHIRApiResponse,
} from '../../types/fhir';

export class MedicationRequestService {
  /**
   * Get all medication requests for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All MedicationRequest resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<MedicationRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medication_requests')
        .select('*')
        .eq('patient_id', patientId)
        .order('authored_on', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch medication requests',
      };
    }
  }

  /**
   * Get active medication requests for a patient
   * Uses database RPC for optimized query with status filtering
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Active MedicationRequest resources (status: active, on-hold)
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<MedicationRequest[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_active_medication_requests', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch active medications',
      };
    }
  }

  /**
   * Create a new medication request
   *
   * SAFETY: Automatically checks for medication allergies before creating prescription
   * Returns error if allergy detected
   *
   * @param request - MedicationRequest resource to create
   * @returns Created MedicationRequest with server-assigned ID
   */
  static async create(request: CreateMedicationRequest): Promise<FHIRApiResponse<MedicationRequest>> {
    try {
      // Check for allergies first
      const allergyCheck = await supabase.rpc('check_medication_allergy_from_request', {
        patient_id_param: request.patient_id,
        medication_display_param: request.medication_display,
      });

      if (allergyCheck.data && allergyCheck.data.length > 0) {
        const allergy = allergyCheck.data[0];
        return {
          success: false,
          error: `ALLERGY ALERT: Patient is allergic to ${allergy.allergen_name}. Severity: ${allergy.severity || 'Unknown'}. ${allergy.reaction_description || ''}`,
        };
      }

      const { data, error } = await supabase
        .from('fhir_medication_requests')
        .insert([request])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create medication request',
      };
    }
  }

  /**
   * Update medication request
   *
   * Common use cases:
   * - Change status (active → completed, stopped)
   * - Update dosage instructions
   * - Add clinical notes
   *
   * @param id - MedicationRequest resource ID
   * @param updates - Partial MedicationRequest fields to update
   * @returns Updated MedicationRequest resource
   */
  static async update(
    id: string,
    updates: Partial<MedicationRequest>
  ): Promise<FHIRApiResponse<MedicationRequest>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medication_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update medication request',
      };
    }
  }

  /**
   * Cancel medication request
   *
   * Sets status to 'cancelled' and records reason in notes
   *
   * @param id - MedicationRequest resource ID
   * @param reason - Optional cancellation reason
   * @returns Updated MedicationRequest with cancelled status
   */
  static async cancel(id: string, reason?: string): Promise<FHIRApiResponse<MedicationRequest>> {
    return this.update(id, {
      status: 'cancelled',
      note: reason ? `Cancelled: ${reason}` : 'Cancelled',
    });
  }

  /**
   * Get medication history for a patient
   *
   * Returns historical medication requests including discontinued and completed
   * Useful for medication reconciliation and clinical review
   *
   * @param patientId - FHIR Patient resource ID
   * @param limit - Maximum number of records to return (default: 50)
   * @returns Historical MedicationRequest resources
   */
  static async getHistory(
    patientId: string,
    limit: number = 50
  ): Promise<FHIRApiResponse<MedicationRequest[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_medication_history', {
          patient_id_param: patientId,
          limit_param: limit,
        });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch medication history',
      };
    }
  }
}
