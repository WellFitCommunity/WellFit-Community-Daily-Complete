/**
 * FHIR DiagnosticReport Service
 * Handles lab results and diagnostic findings
 *
 * FHIR R4 Resource: DiagnosticReport
 * Purpose: Records findings from diagnostic investigations (labs, imaging, pathology)
 *
 * @see https://hl7.org/fhir/R4/diagnosticreport.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  DiagnosticReport,
  CreateDiagnosticReport,
  FHIRApiResponse,
} from '../../types/fhir';

export class DiagnosticReportService {
  /**
   * Get all diagnostic reports for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All DiagnosticReport resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_diagnostic_reports')
        .select('id, fhir_id, patient_id, encounter_id, status, category, category_coding_system, category_code, category_display, code_system, code, code_display, code_text, effective_datetime, effective_period_start, effective_period_end, issued, performer_type, performer_id, performer_display, result_observation_ids, conclusion, conclusion_code, conclusion_code_display, presented_form_url, presented_form_title, report_priority, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('issued', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch diagnostic reports',
      };
    }
  }

  /**
   * Get recent reports
   *
   * Returns most recent diagnostic reports for quick clinical review
   *
   * @param patientId - FHIR Patient resource ID
   * @param limit - Maximum number of reports to return (default: 20)
   * @returns Recent DiagnosticReport resources
   */
  static async getRecent(
    patientId: string,
    limit: number = 20
  ): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_recent_diagnostic_reports', {
          patient_id_param: patientId,
          limit_param: limit,
        });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch recent reports',
      };
    }
  }

  /**
   * Get lab reports
   *
   * Returns laboratory test results (chemistry, hematology, microbiology, etc.)
   * Filtered by category = 'LAB'
   *
   * @param patientId - FHIR Patient resource ID
   * @param daysBack - Number of days to look back (default: 90)
   * @returns Laboratory DiagnosticReport resources
   */
  static async getLabReports(
    patientId: string,
    daysBack: number = 90
  ): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_lab_reports', {
          patient_id_param: patientId,
          days_back: daysBack,
        });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch lab reports',
      };
    }
  }

  /**
   * Get imaging reports
   *
   * Returns radiology and imaging study reports (X-ray, CT, MRI, ultrasound, etc.)
   * Filtered by category = 'RAD'
   *
   * @param patientId - FHIR Patient resource ID
   * @param daysBack - Number of days to look back (default: 365)
   * @returns Imaging DiagnosticReport resources
   */
  static async getImagingReports(
    patientId: string,
    daysBack: number = 365
  ): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_imaging_reports', {
          patient_id_param: patientId,
          days_back: daysBack,
        });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch imaging reports',
      };
    }
  }

  /**
   * Create a new diagnostic report
   *
   * Used when receiving lab results or imaging reports
   * Status should typically start as 'preliminary' or 'final'
   *
   * @param report - DiagnosticReport resource to create
   * @returns Created DiagnosticReport with server-assigned ID
   */
  static async create(report: CreateDiagnosticReport): Promise<FHIRApiResponse<DiagnosticReport>> {
    try {
      const { data, error } = await supabase
        .from('fhir_diagnostic_reports')
        .insert([report])
        .select('id, fhir_id, patient_id, encounter_id, status, category, category_coding_system, category_code, category_display, code_system, code, code_display, code_text, effective_datetime, effective_period_start, effective_period_end, issued, performer_type, performer_id, performer_display, result_observation_ids, conclusion, conclusion_code, conclusion_code_display, presented_form_url, presented_form_title, report_priority, created_at, updated_at')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create diagnostic report',
      };
    }
  }

  /**
   * Update diagnostic report
   *
   * Common use cases:
   * - Change status (preliminary → final)
   * - Add conclusion/interpretation
   * - Amend results
   *
   * @param id - DiagnosticReport resource ID
   * @param updates - Partial DiagnosticReport fields to update
   * @returns Updated DiagnosticReport resource
   */
  static async update(
    id: string,
    updates: Partial<DiagnosticReport>
  ): Promise<FHIRApiResponse<DiagnosticReport>> {
    try {
      const { data, error } = await supabase
        .from('fhir_diagnostic_reports')
        .update(updates)
        .eq('id', id)
        .select('id, fhir_id, patient_id, encounter_id, status, category, category_coding_system, category_code, category_display, code_system, code, code_display, code_text, effective_datetime, effective_period_start, effective_period_end, issued, performer_type, performer_id, performer_display, result_observation_ids, conclusion, conclusion_code, conclusion_code_display, presented_form_url, presented_form_title, report_priority, created_at, updated_at')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update diagnostic report',
      };
    }
  }

  /**
   * Get pending reports
   *
   * Returns reports with status = 'registered' or 'partial'
   * Used for tracking incomplete or in-progress diagnostic studies
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Pending DiagnosticReport resources
   */
  static async getPending(patientId: string): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_pending_reports', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch pending reports',
      };
    }
  }
}
