/**
 * FHIR Immunization Service
 * Handles vaccination records and immunization tracking
 *
 * FHIR R4 Resource: Immunization
 * Purpose: Records vaccines administered and immunization history
 *
 * @see https://hl7.org/fhir/R4/immunization.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  FHIRImmunization,
  FHIRApiResponse,
} from '../../types/fhir';

export class ImmunizationService {
  /**
   * Get all immunizations for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All Immunization resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<FHIRImmunization[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_immunizations')
        .select('*')
        .eq('patient_id', patientId)
        .order('occurrence_datetime', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch immunizations',
      };
    }
  }

  /**
   * Get immunization by ID
   *
   * @param id - Immunization resource ID
   * @returns Immunization resource or null if not found
   */
  static async getById(id: string): Promise<FHIRApiResponse<FHIRImmunization | null>> {
    try {
      const { data, error } = await supabase
        .from('fhir_immunizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null }; // Not found
        }
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch immunization',
      };
    }
  }

  /**
   * Get completed immunizations only
   *
   * Filters out not-done and entered-in-error statuses
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Completed Immunization resources
   */
  static async getCompleted(patientId: string): Promise<FHIRApiResponse<FHIRImmunization[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_immunizations')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('occurrence_datetime', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch completed immunizations',
      };
    }
  }

  /**
   * Get immunization history using database function
   *
   * Optimized query for immunization history reports
   *
   * @param patientId - FHIR Patient resource ID
   * @param days - Number of days to look back (default: 365)
   * @returns Immunization history data
   */
  static async getHistory(
    patientId: string,
    days: number = 365
  ): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_patient_immunizations', {
        p_patient_id: patientId,
        p_days: days,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch immunization history',
      };
    }
  }

  /**
   * Get immunizations by vaccine type
   *
   * Returns all doses of a specific vaccine (e.g., all COVID-19 vaccines)
   * Useful for tracking vaccination series completion
   *
   * @param patientId - FHIR Patient resource ID
   * @param vaccineCode - CVX vaccine code
   * @returns Immunization resources for the vaccine type
   */
  static async getByVaccineCode(
    patientId: string,
    vaccineCode: string
  ): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_immunizations_by_vaccine', {
        p_patient_id: patientId,
        p_vaccine_code: vaccineCode,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch immunizations by vaccine code',
      };
    }
  }

  /**
   * Check if vaccine is due (care gap detection)
   *
   * Determines if patient needs a vaccine based on time since last dose
   * Used for preventive care reminders and quality metrics
   *
   * @param patientId - FHIR Patient resource ID
   * @param vaccineCode - CVX vaccine code
   * @param monthsSinceLast - Months required between doses (default: 12)
   * @returns True if vaccine is due
   */
  static async checkVaccineDue(
    patientId: string,
    vaccineCode: string,
    monthsSinceLast: number = 12
  ): Promise<FHIRApiResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('check_vaccine_due', {
        p_patient_id: patientId,
        p_vaccine_code: vaccineCode,
        p_months_since_last: monthsSinceLast,
      });

      if (error) throw error;
      return { success: true, data: data || false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check vaccine due status',
      };
    }
  }

  /**
   * Get vaccine gaps (care opportunities)
   *
   * Identifies missing or overdue vaccinations based on ACIP guidelines
   * Returns recommended vaccines for patient's age and risk factors
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Array of vaccine gaps with recommendations
   */
  static async getVaccineGaps(patientId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_vaccine_gaps', {
        p_patient_id: patientId,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch vaccine gaps',
      };
    }
  }

  /**
   * Create new immunization record
   *
   * Records vaccine administration with lot number, expiration, site
   * Automatically triggers care gap recalculation
   *
   * @param immunization - Immunization resource to create
   * @returns Created Immunization with server-assigned ID
   */
  static async create(
    immunization: Partial<FHIRImmunization>
  ): Promise<FHIRApiResponse<FHIRImmunization>> {
    try {
      const { data, error } = await supabase
        .from('fhir_immunizations')
        .insert(immunization)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create immunization',
      };
    }
  }

  /**
   * Update immunization record
   *
   * Common use cases:
   * - Correct lot number or expiration date
   * - Add reaction information
   * - Update status (not-done if contraindicated)
   *
   * @param id - Immunization resource ID
   * @param updates - Partial Immunization fields to update
   * @returns Updated Immunization resource
   */
  static async update(
    id: string,
    updates: Partial<FHIRImmunization>
  ): Promise<FHIRApiResponse<FHIRImmunization>> {
    try {
      const { data, error } = await supabase
        .from('fhir_immunizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update immunization',
      };
    }
  }

  /**
   * Delete immunization record
   *
   * Use with caution - consider setting status to 'entered-in-error' instead
   * for audit trail compliance
   *
   * @param id - Immunization resource ID
   * @returns Success indicator
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_immunizations').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete immunization',
      };
    }
  }

  /**
   * Search immunizations with filters
   *
   * Advanced search supporting multiple filter criteria
   * Used for reporting, analytics, and population health queries
   *
   * @param params - Search parameters (all optional)
   * @returns Filtered Immunization resources
   */
  static async search(params: {
    patientId?: string;
    status?: string;
    vaccineCode?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<FHIRApiResponse<FHIRImmunization[]>> {
    try {
      let query = supabase.from('fhir_immunizations').select('*');

      if (params.patientId) {
        query = query.eq('patient_id', params.patientId);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }
      if (params.vaccineCode) {
        query = query.eq('vaccine_code', params.vaccineCode);
      }
      if (params.fromDate) {
        query = query.gte('occurrence_datetime', params.fromDate);
      }
      if (params.toDate) {
        query = query.lte('occurrence_datetime', params.toDate);
      }

      query = query.order('occurrence_datetime', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search immunizations',
      };
    }
  }
}
