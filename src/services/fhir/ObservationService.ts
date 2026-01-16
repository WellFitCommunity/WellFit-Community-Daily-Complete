/**
 * FHIR Observation Service
 * Handles vital signs, lab values, and clinical measurements
 *
 * FHIR R4 Resource: Observation
 * Purpose: Records measurements and assertions (vitals, labs, social history, etc.)
 *
 * HIPAA §164.312(b): PHI access logging enabled
 *
 * @see https://hl7.org/fhir/R4/observation.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  Observation,
  CreateObservation,
  FHIRApiResponse,
} from '../../types/fhir';
import { auditLogger } from '../auditLogger';

export class ObservationService {
  /**
   * Get all observations for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All Observation resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<Observation[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('OBSERVATION_LIST_READ', patientId, {
        resourceType: 'Observation',
        operation: 'getByPatient',
      });

      const { data, error } = await supabase
        .from('fhir_observations')
        .select('*')
        .eq('patient_id', patientId)
        .order('effective_datetime', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch observations',
      };
    }
  }

  /**
   * Get vital signs for a patient
   *
   * Returns observations with category = 'vital-signs'
   * Includes: BP, HR, RR, temp, SpO2, height, weight, BMI
   *
   * @param patientId - FHIR Patient resource ID
   * @param days - Number of days to look back (default: 30)
   * @returns Vital sign Observation resources
   */
  static async getVitalSigns(
    patientId: string,
    days: number = 30
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('OBSERVATION_VITAL_SIGNS_READ', patientId, {
        resourceType: 'Observation',
        operation: 'getVitalSigns',
        daysBack: days,
      });

      const { data, error } = await supabase.rpc('get_patient_vital_signs', {
        patient_id_param: patientId,
        days_param: days,
      });

      if (error) throw error;
      return { success: true, data: (data as Observation[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch vital signs',
      };
    }
  }

  /**
   * Get laboratory results for a patient
   *
   * Returns observations with category = 'laboratory'
   * Includes: chemistry panels, CBC, metabolic panels, etc.
   *
   * @param patientId - FHIR Patient resource ID
   * @param days - Number of days to look back (default: 90)
   * @returns Laboratory Observation resources
   */
  static async getLabResults(
    patientId: string,
    days: number = 90
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('OBSERVATION_LAB_RESULTS_READ', patientId, {
        resourceType: 'Observation',
        operation: 'getLabResults',
        daysBack: days,
      });

      const { data, error } = await supabase.rpc('get_patient_lab_results', {
        patient_id_param: patientId,
        days_param: days,
      });

      if (error) throw error;
      return { success: true, data: (data as Observation[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch lab results',
      };
    }
  }

  /**
   * Get social history observations
   *
   * Returns observations with category = 'social-history'
   * Includes: smoking status, alcohol use, occupation, living situation
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Social history Observation resources
   */
  static async getSocialHistory(patientId: string): Promise<FHIRApiResponse<Observation[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('OBSERVATION_SOCIAL_HISTORY_READ', patientId, {
        resourceType: 'Observation',
        operation: 'getSocialHistory',
      });

      const { data, error } = await supabase.rpc('get_patient_social_history', {
        patient_id_param: patientId,
      });

      if (error) throw error;
      return { success: true, data: (data as Observation[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch social history',
      };
    }
  }

  /**
   * Get observations by code (for trending)
   *
   * Returns all observations with a specific LOINC code
   * Useful for tracking specific values over time (e.g., A1C, glucose)
   *
   * @param patientId - FHIR Patient resource ID
   * @param code - LOINC code to filter by
   * @param days - Number of days to look back (default: 365)
   * @returns Observation resources matching the code
   */
  static async getByCode(
    patientId: string,
    code: string,
    days: number = 365
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('OBSERVATION_BY_CODE_READ', patientId, {
        resourceType: 'Observation',
        operation: 'getByCode',
        code,
        daysBack: days,
      });

      const { data, error } = await supabase.rpc('get_observations_by_code', {
        patient_id_param: patientId,
        code_param: code,
        days_param: days,
      });

      if (error) throw error;
      return { success: true, data: (data as Observation[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch observations by code',
      };
    }
  }

  /**
   * Get observations by category
   *
   * Returns observations filtered by FHIR category
   * Categories: vital-signs, laboratory, social-history, imaging, survey, etc.
   *
   * @param patientId - FHIR Patient resource ID
   * @param category - FHIR observation category
   * @param days - Optional number of days to look back
   * @returns Observation resources in the category
   */
  static async getByCategory(
    patientId: string,
    category: string,
    days?: number
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('OBSERVATION_BY_CATEGORY_READ', patientId, {
        resourceType: 'Observation',
        operation: 'getByCategory',
        category,
        daysBack: days,
      });

      let query = supabase
        .from('fhir_observations')
        .select('*')
        .eq('patient_id', patientId)
        .contains('category', [category])
        .in('status', ['final', 'amended', 'corrected'])
        .order('effective_datetime', { ascending: false });

      if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.gte('effective_datetime', cutoffDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch observations by category',
      };
    }
  }

  /**
   * Create a new observation
   *
   * Common use cases:
   * - Record vital signs during encounter
   * - Store lab results from diagnostic report
   * - Document patient-reported outcomes
   *
   * @param observation - Observation resource to create
   * @returns Created Observation with server-assigned ID
   */
  static async create(observation: CreateObservation): Promise<FHIRApiResponse<Observation>> {
    try {
      // HIPAA §164.312(b): Log PHI write
      await auditLogger.phi('OBSERVATION_CREATE', observation.patient_id, {
        resourceType: 'Observation',
        operation: 'create',
        category: observation.category,
      });

      const { data, error } = await supabase
        .from('fhir_observations')
        .insert([observation])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create observation',
      };
    }
  }

  /**
   * Update an observation
   *
   * Common use cases:
   * - Change status (preliminary → final)
   * - Amend incorrect values
   * - Add interpretation or notes
   *
   * @param id - Observation resource ID
   * @param updates - Partial Observation fields to update
   * @returns Updated Observation resource
   */
  static async update(
    id: string,
    updates: Partial<Observation>
  ): Promise<FHIRApiResponse<Observation>> {
    try {
      const { data, error } = await supabase
        .from('fhir_observations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update observation',
      };
    }
  }

  /**
   * Delete an observation
   *
   * Use with caution - consider setting status to 'entered-in-error' instead
   * for audit trail compliance
   *
   * @param id - Observation resource ID
   * @returns Success indicator
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_observations').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete observation',
      };
    }
  }
}
