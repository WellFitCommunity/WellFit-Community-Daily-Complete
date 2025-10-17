/**
 * FHIR Resource Service
 * Enterprise-grade service for managing FHIR R4 resources
 * Provides unified interface for MedicationRequest, Condition, DiagnosticReport, and Procedure
 */

import { supabase } from '../lib/supabaseClient';
import type {
  MedicationRequest,
  CreateMedicationRequest,
  Condition,
  CreateCondition,
  DiagnosticReport,
  CreateDiagnosticReport,
  Procedure,
  CreateProcedure,
  FHIRApiResponse,
  FHIRSearchParams,
} from '../types/fhir';

// ============================================================================
// MEDICATION REQUEST SERVICE
// ============================================================================

export class MedicationRequestService {
  /**
   * Get all medication requests for a patient
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch medication requests',
      };
    }
  }

  /**
   * Get active medication requests for a patient
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<MedicationRequest[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_active_medication_requests', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active medications',
      };
    }
  }

  /**
   * Create a new medication request
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication request',
      };
    }
  }

  /**
   * Update medication request
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update medication request',
      };
    }
  }

  /**
   * Cancel medication request
   */
  static async cancel(id: string, reason?: string): Promise<FHIRApiResponse<MedicationRequest>> {
    return this.update(id, {
      status: 'cancelled',
      note: reason ? `Cancelled: ${reason}` : 'Cancelled',
    });
  }

  /**
   * Get medication history
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch medication history',
      };
    }
  }
}

// ============================================================================
// CONDITION SERVICE
// ============================================================================

export class ConditionService {
  /**
   * Get all conditions for a patient
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_conditions')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch conditions',
      };
    }
  }

  /**
   * Get active conditions (problem list)
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_active_conditions', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active conditions',
      };
    }
  }

  /**
   * Get problem list
   */
  static async getProblemList(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_problem_list', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch problem list',
      };
    }
  }

  /**
   * Get encounter diagnoses
   */
  static async getByEncounter(encounterId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_encounter_diagnoses', { encounter_id_param: encounterId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch encounter diagnoses',
      };
    }
  }

  /**
   * Create a new condition
   */
  static async create(condition: CreateCondition): Promise<FHIRApiResponse<Condition>> {
    try {
      const { data, error } = await supabase
        .from('fhir_conditions')
        .insert([condition])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create condition',
      };
    }
  }

  /**
   * Update condition
   */
  static async update(id: string, updates: Partial<Condition>): Promise<FHIRApiResponse<Condition>> {
    try {
      const { data, error } = await supabase
        .from('fhir_conditions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update condition',
      };
    }
  }

  /**
   * Resolve condition
   */
  static async resolve(id: string): Promise<FHIRApiResponse<Condition>> {
    return this.update(id, {
      clinical_status: 'resolved',
      abatement_datetime: new Date().toISOString(),
    });
  }

  /**
   * Get chronic conditions
   */
  static async getChronic(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_chronic_conditions', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chronic conditions',
      };
    }
  }
}

// ============================================================================
// DIAGNOSTIC REPORT SERVICE
// ============================================================================

export class DiagnosticReportService {
  /**
   * Get all diagnostic reports for a patient
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_diagnostic_reports')
        .select('*')
        .eq('patient_id', patientId)
        .order('issued', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch diagnostic reports',
      };
    }
  }

  /**
   * Get recent reports
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recent reports',
      };
    }
  }

  /**
   * Get lab reports
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch lab reports',
      };
    }
  }

  /**
   * Get imaging reports
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch imaging reports',
      };
    }
  }

  /**
   * Create a new diagnostic report
   */
  static async create(report: CreateDiagnosticReport): Promise<FHIRApiResponse<DiagnosticReport>> {
    try {
      const { data, error } = await supabase
        .from('fhir_diagnostic_reports')
        .insert([report])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create diagnostic report',
      };
    }
  }

  /**
   * Update diagnostic report
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
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update diagnostic report',
      };
    }
  }

  /**
   * Get pending reports
   */
  static async getPending(patientId: string): Promise<FHIRApiResponse<DiagnosticReport[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_pending_reports', { patient_id_param: patientId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pending reports',
      };
    }
  }
}

// ============================================================================
// PROCEDURE SERVICE
// ============================================================================

export class ProcedureService {
  /**
   * Get all procedures for a patient
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch procedures',
      };
    }
  }

  /**
   * Get recent procedures
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recent procedures',
      };
    }
  }

  /**
   * Get procedures by encounter
   */
  static async getByEncounter(encounterId: string): Promise<FHIRApiResponse<Procedure[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_procedures_by_encounter', { encounter_id_param: encounterId });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch encounter procedures',
      };
    }
  }

  /**
   * Create a new procedure
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create procedure',
      };
    }
  }

  /**
   * Update procedure
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update procedure',
      };
    }
  }

  /**
   * Get billable procedures
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch billable procedures',
      };
    }
  }
}

// ============================================================================
// UNIFIED FHIR SERVICE (Single Entry Point)
// ============================================================================

export const FHIRService = {
  MedicationRequest: MedicationRequestService,
  Condition: ConditionService,
  DiagnosticReport: DiagnosticReportService,
  Procedure: ProcedureService,
};

export default FHIRService;
