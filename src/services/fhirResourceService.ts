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
  Observation,
  CreateObservation,
  FHIRImmunization,
  FHIRCarePlan,
  FHIRCareTeam,
  FHIRCareTeamMember,
  FHIRPractitioner,
  FHIRPractitionerRole,
  // FHIRGoal - unused type
  // FHIRLocation - unused type
  // FHIROrganization - unused type
  // FHIRMedication - unused type
  // FHIRProvenance - unused type
  FHIRApiResponse,
  // FHIRSearchParams - unused type
} from '../types/fhir';

// ============================================================================
// BACKWARDS COMPATIBILITY ADAPTERS
// ============================================================================

/**
 * Normalizes Condition to support both FHIR array fields and simplified string fields
 * Ensures backwards compatibility with legacy systems and community-only deployments
 */
function normalizeCondition(condition: Condition): Condition {
  return {
    ...condition,
    // Sync FHIR array → simplified string (for UI)
    category_code: condition.category_code || condition.category?.[0],
    code_code: condition.code_code || condition.code,
    // Sync simplified string → FHIR array (for database/EHR)
    category: condition.category || (condition.category_code ? [condition.category_code] : undefined),
    code: condition.code || condition.code_code!,
  };
}

/**
 * Prepares Condition for database insertion (converts to FHIR format)
 */
function toFHIRCondition(condition: Partial<Condition>): Partial<Condition> {
  const normalized = { ...condition };

  // Ensure FHIR array fields are populated
  if (normalized.category_code && !normalized.category) {
    normalized.category = [normalized.category_code];
  }
  if (normalized.code_code && !normalized.code) {
    normalized.code = normalized.code_code;
  }

  return normalized;
}

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
      // Normalize for backwards compatibility
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
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
      // Normalize for backwards compatibility
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
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
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
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
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
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
      // Convert to FHIR format for database
      const fhirCondition = toFHIRCondition(condition);

      const { data, error } = await supabase
        .from('fhir_conditions')
        .insert([fhirCondition])
        .select()
        .single();

      if (error) throw error;
      // Normalize for backwards compatibility
      return { success: true, data: normalizeCondition(data) };
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
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
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
// OBSERVATION SERVICE
// ============================================================================

export class ObservationService {
  /**
   * Get all observations for a patient
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<Observation[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_observations')
        .select('*')
        .eq('patient_id', patientId)
        .order('effective_datetime', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch observations',
      };
    }
  }

  /**
   * Get vital signs for a patient
   */
  static async getVitalSigns(
    patientId: string,
    days: number = 30
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      const { data, error } = await supabase.rpc('get_patient_vital_signs', {
        patient_id_param: patientId,
        days_param: days,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch vital signs',
      };
    }
  }

  /**
   * Get laboratory results for a patient
   */
  static async getLabResults(
    patientId: string,
    days: number = 90
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      const { data, error } = await supabase.rpc('get_patient_lab_results', {
        patient_id_param: patientId,
        days_param: days,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch lab results',
      };
    }
  }

  /**
   * Get social history observations
   */
  static async getSocialHistory(patientId: string): Promise<FHIRApiResponse<Observation[]>> {
    try {
      const { data, error } = await supabase.rpc('get_patient_social_history', {
        patient_id_param: patientId,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch social history',
      };
    }
  }

  /**
   * Get observations by code (for trending)
   */
  static async getByCode(
    patientId: string,
    code: string,
    days: number = 365
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
      const { data, error } = await supabase.rpc('get_observations_by_code', {
        patient_id_param: patientId,
        code_param: code,
        days_param: days,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch observations by code',
      };
    }
  }

  /**
   * Get observations by category
   */
  static async getByCategory(
    patientId: string,
    category: string,
    days?: number
  ): Promise<FHIRApiResponse<Observation[]>> {
    try {
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch observations by category',
      };
    }
  }

  /**
   * Create a new observation
   */
  static async create(observation: CreateObservation): Promise<FHIRApiResponse<Observation>> {
    try {
      const { data, error } = await supabase
        .from('fhir_observations')
        .insert([observation])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create observation',
      };
    }
  }

  /**
   * Update an observation
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update observation',
      };
    }
  }

  /**
   * Delete an observation
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_observations').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete observation',
      };
    }
  }
}

// ============================================================================
// IMMUNIZATION SERVICE
// ============================================================================

export class ImmunizationService {
  /**
   * Get all immunizations for a patient
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

// ============================================================================
// CARE PLAN SERVICE
// ============================================================================

export class CarePlanService {
  /**
   * Get all care plans for a patient
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<FHIRCarePlan[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('created', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care plans',
      };
    }
  }

  /**
   * Get care plan by ID
   */
  static async getById(id: string): Promise<FHIRApiResponse<FHIRCarePlan | null>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_plans')
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
        error: error instanceof Error ? error.message : 'Failed to fetch care plan',
      };
    }
  }

  /**
   * Get active care plans using database function
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_active_care_plans', {
        p_patient_id: patientId,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active care plans',
      };
    }
  }

  /**
   * Get current care plan (most recent active)
   */
  static async getCurrent(patientId: string): Promise<FHIRApiResponse<any | null>> {
    try {
      const { data, error } = await supabase.rpc('get_current_care_plan', {
        p_patient_id: patientId,
      });

      if (error) throw error;
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch current care plan',
      };
    }
  }

  /**
   * Get care plans by status
   */
  static async getByStatus(
    patientId: string,
    status: string
  ): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error} = await supabase.rpc('get_care_plans_by_status', {
        p_patient_id: patientId,
        p_status: status,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care plans by status',
      };
    }
  }

  /**
   * Get care plans by category
   */
  static async getByCategory(
    patientId: string,
    category: string
  ): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_care_plans_by_category', {
        p_patient_id: patientId,
        p_category: category,
      });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care plans by category',
      };
    }
  }

  /**
   * Get activity summary for a care plan
   */
  static async getActivitiesSummary(carePlanId: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('get_care_plan_activities_summary', {
        p_care_plan_id: carePlanId,
      });

      if (error) throw error;
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch care plan activities summary',
      };
    }
  }

  /**
   * Create a new care plan
   */
  static async create(carePlan: Partial<FHIRCarePlan>): Promise<FHIRApiResponse<FHIRCarePlan>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_plans')
        .insert([carePlan])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create care plan',
      };
    }
  }

  /**
   * Update a care plan
   */
  static async update(
    id: string,
    updates: Partial<FHIRCarePlan>
  ): Promise<FHIRApiResponse<FHIRCarePlan>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update care plan',
      };
    }
  }

  /**
   * Delete a care plan
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_care_plans').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete care plan',
      };
    }
  }

  /**
   * Advanced search with filters
   */
  static async search(params: {
    patientId?: string;
    status?: string;
    category?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<FHIRApiResponse<FHIRCarePlan[]>> {
    try {
      let query = supabase.from('fhir_care_plans').select('*');

      if (params.patientId) {
        query = query.eq('patient_id', params.patientId);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }
      if (params.category) {
        query = query.contains('category', [params.category]);
      }
      if (params.fromDate) {
        query = query.gte('period_start', params.fromDate);
      }
      if (params.toDate) {
        query = query.lte('period_end', params.toDate);
      }

      query = query.order('created', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search care plans',
      };
    }
  }

  /**
   * Complete a care plan (set status to 'completed')
   */
  static async complete(id: string): Promise<FHIRApiResponse<FHIRCarePlan>> {
    return this.update(id, {
      status: 'completed',
      period_end: new Date().toISOString(),
    });
  }

  /**
   * Activate a care plan
   */
  static async activate(id: string): Promise<FHIRApiResponse<FHIRCarePlan>> {
    return this.update(id, {
      status: 'active',
      period_start: new Date().toISOString(),
    });
  }

  /**
   * Put care plan on hold
   */
  static async hold(id: string, reason?: string): Promise<FHIRApiResponse<FHIRCarePlan>> {
    const updates: Partial<FHIRCarePlan> = {
      status: 'on-hold',
    };
    if (reason) {
      updates.note = reason;
    }
    return this.update(id, updates);
  }
}

// ============================================================================
// CARE TEAM SERVICE
// ============================================================================

export class CareTeamService {
  /**
   * Get all care teams for a patient
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<FHIRCareTeam[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care teams',
      };
    }
  }

  /**
   * Get care team by ID
   */
  static async getById(id: string): Promise<FHIRApiResponse<FHIRCareTeam | null>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
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
        error: error instanceof Error ? error.message : 'Failed to fetch care team',
      };
    }
  }

  /**
   * Get active care teams for a patient
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<FHIRCareTeam[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active care teams',
      };
    }
  }

  /**
   * Get care teams by status
   */
  static async getByStatus(
    patientId: string,
    status: string
  ): Promise<FHIRApiResponse<FHIRCareTeam[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', status)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care teams by status',
      };
    }
  }

  /**
   * Create a new care team
   */
  static async create(careTeam: Partial<FHIRCareTeam>): Promise<FHIRApiResponse<FHIRCareTeam>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .insert([careTeam])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create care team',
      };
    }
  }

  /**
   * Update a care team
   */
  static async update(
    id: string,
    updates: Partial<FHIRCareTeam>
  ): Promise<FHIRApiResponse<FHIRCareTeam>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .update(updates)
        .eq('id', id)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update care team',
      };
    }
  }

  /**
   * Soft delete a care team
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('fhir_care_teams')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete care team',
      };
    }
  }

  /**
   * Activate a care team
   */
  static async activate(id: string): Promise<FHIRApiResponse<FHIRCareTeam>> {
    return this.update(id, {
      status: 'active',
      period_start: new Date().toISOString(),
    });
  }

  /**
   * Suspend a care team
   */
  static async suspend(id: string, reason?: string): Promise<FHIRApiResponse<FHIRCareTeam>> {
    const updates: Partial<FHIRCareTeam> = {
      status: 'suspended',
    };
    if (reason) {
      updates.note = reason;
    }
    return this.update(id, updates);
  }

  /**
   * End a care team (set period_end and status to inactive)
   */
  static async end(id: string): Promise<FHIRApiResponse<FHIRCareTeam>> {
    return this.update(id, {
      status: 'inactive',
      period_end: new Date().toISOString(),
    });
  }

  // ============================================================================
  // CARE TEAM MEMBERS
  // ============================================================================

  /**
   * Get all members of a care team
   */
  static async getMembers(careTeamId: string): Promise<FHIRApiResponse<FHIRCareTeamMember[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care team members',
      };
    }
  }

  /**
   * Get active members of a care team
   */
  static async getActiveMembers(
    careTeamId: string
  ): Promise<FHIRApiResponse<FHIRCareTeamMember[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active care team members',
      };
    }
  }

  /**
   * Get primary contact for a care team
   */
  static async getPrimaryContact(
    careTeamId: string
  ): Promise<FHIRApiResponse<FHIRCareTeamMember | null>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .eq('is_primary_contact', true)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
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
        error: error instanceof Error ? error.message : 'Failed to fetch primary contact',
      };
    }
  }

  /**
   * Add a member to a care team
   */
  static async addMember(
    member: Partial<FHIRCareTeamMember>
  ): Promise<FHIRApiResponse<FHIRCareTeamMember>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .insert([member])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add care team member',
      };
    }
  }

  /**
   * Update a care team member
   */
  static async updateMember(
    id: string,
    updates: Partial<FHIRCareTeamMember>
  ): Promise<FHIRApiResponse<FHIRCareTeamMember>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update care team member',
      };
    }
  }

  /**
   * Remove a member from a care team (set period_end)
   */
  static async removeMember(id: string): Promise<FHIRApiResponse<FHIRCareTeamMember>> {
    return this.updateMember(id, {
      period_end: new Date().toISOString(),
    });
  }

  /**
   * Delete a care team member
   */
  static async deleteMember(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_care_team_members').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete care team member',
      };
    }
  }

  /**
   * Get members by role
   */
  static async getMembersByRole(
    careTeamId: string,
    roleCode: string
  ): Promise<FHIRApiResponse<FHIRCareTeamMember[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .eq('role_code', roleCode)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch members by role',
      };
    }
  }
}

// ============================================================================
// PRACTITIONER SERVICE
// ============================================================================

export const PractitionerService = {
  /**
   * Get all active practitioners
   */
  async getAll(): Promise<FHIRPractitioner[]> {
    const { data, error } = await supabase.rpc('get_active_practitioners');
    if (error) throw error;
    return data || [];
  },

  /**
   * Get practitioner by ID
   */
  async getById(id: string): Promise<FHIRPractitioner | null> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get practitioner by user ID
   */
  async getByUserId(userId: string): Promise<FHIRPractitioner | null> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error
    return data;
  },

  /**
   * Get practitioner by NPI
   */
  async getByNPI(npi: string): Promise<FHIRPractitioner | null> {
    const { data, error } = await supabase.rpc('get_practitioner_by_npi', { p_npi: npi });
    if (error) throw error;
    return data?.[0] || null;
  },

  /**
   * Search practitioners by name, specialty, or NPI
   */
  async search(searchTerm: string): Promise<FHIRPractitioner[]> {
    const { data, error } = await supabase.rpc('search_practitioners', {
      p_search_term: searchTerm,
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Get practitioners by specialty
   */
  async getBySpecialty(specialty: string): Promise<FHIRPractitioner[]> {
    const { data, error } = await supabase.rpc('get_practitioners_by_specialty', {
      p_specialty: specialty,
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new practitioner
   */
  async create(practitioner: Partial<FHIRPractitioner>): Promise<FHIRPractitioner> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .insert({
        ...practitioner,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update practitioner
   */
  async update(id: string, updates: Partial<FHIRPractitioner>): Promise<FHIRPractitioner> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete practitioner (soft delete by setting active = false)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('fhir_practitioners')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Hard delete practitioner (only for super admins)
   */
  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase.from('fhir_practitioners').delete().eq('id', id);

    if (error) throw error;
  },

  /**
   * Validate NPI format (10 digits)
   */
  validateNPI(npi: string): boolean {
    return /^\d{10}$/.test(npi);
  },

  /**
   * Generate full name from name parts
   */
  getFullName(practitioner: FHIRPractitioner): string {
    const parts: string[] = [];

    if (practitioner.prefix?.length) {
      parts.push(practitioner.prefix.join(' '));
    }
    if (practitioner.given_names?.length) {
      parts.push(practitioner.given_names.join(' '));
    }
    if (practitioner.family_name) {
      parts.push(practitioner.family_name);
    }
    if (practitioner.suffix?.length) {
      parts.push(practitioner.suffix.join(', '));
    }

    return parts.join(' ').trim();
  },
};

// ============================================================================
// PRACTITIONER ROLE SERVICE
// ============================================================================

export const PractitionerRoleService = {
  /**
   * Get all roles for a practitioner
   */
  async getByPractitioner(practitionerId: string): Promise<FHIRPractitionerRole[]> {
    const { data, error } = await supabase.rpc('get_practitioner_roles', {
      p_practitioner_id: practitionerId,
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Get active roles for a practitioner
   */
  async getActiveByPractitioner(practitionerId: string): Promise<FHIRPractitionerRole[]> {
    const { data, error } = await supabase
      .from('fhir_practitioner_roles')
      .select('*')
      .eq('practitioner_id', practitionerId)
      .eq('active', true)
      .is('period_end', null)
      .or(`period_end.gte.${new Date().toISOString()}`);

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new practitioner role
   */
  async create(role: Partial<FHIRPractitionerRole>): Promise<FHIRPractitionerRole> {
    const { data, error } = await supabase
      .from('fhir_practitioner_roles')
      .insert({
        ...role,
        period_start: role.period_start || new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update practitioner role
   */
  async update(id: string, updates: Partial<FHIRPractitionerRole>): Promise<FHIRPractitionerRole> {
    const { data, error } = await supabase
      .from('fhir_practitioner_roles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * End a practitioner role (set period_end to now)
   */
  async end(id: string): Promise<void> {
    const { error } = await supabase
      .from('fhir_practitioner_roles')
      .update({
        period_end: new Date().toISOString(),
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete practitioner role
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('fhir_practitioner_roles').delete().eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// ALLERGY INTOLERANCE SERVICE
// ============================================================================

export const AllergyIntoleranceService = {
  // Get all allergies for a patient
  async getAll(patientId: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .order('criticality', { ascending: false, nullsFirst: false })
      .order('allergen_name');

    if (error) throw error;
    return data || [];
  },

  // Get active allergies only (clinical_status = 'active')
  async getActive(patientId: string) {
    const { data, error } = await supabase
      .rpc('get_active_allergies', { user_id_param: patientId });

    if (error) throw error;
    return data || [];
  },

  // Get by allergen type
  async getByType(patientId: string, allergenType: 'medication' | 'food' | 'environment' | 'biologic') {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .eq('allergen_type', allergenType)
      .eq('clinical_status', 'active')
      .order('criticality', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data || [];
  },

  // Get high-risk allergies (criticality = 'high')
  async getHighRisk(patientId: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .eq('clinical_status', 'active')
      .eq('criticality', 'high')
      .order('allergen_name');

    if (error) throw error;
    return data || [];
  },

  // CRITICAL: Check if medication causes allergy
  async checkMedicationAllergy(patientId: string, medicationName: string) {
    const { data, error } = await supabase
      .rpc('check_medication_allergy', {
        user_id_param: patientId,
        medication_name_param: medicationName
      });

    if (error) throw error;
    return data || [];
  },

  // Create new allergy
  async create(allergy: any) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .insert([allergy])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update allergy
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete allergy (soft delete - set to 'entered-in-error')
  async delete(id: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update({
        verification_status: 'entered-in-error',
        clinical_status: 'inactive'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// ENCOUNTER SERVICE
// ============================================================================

export const EncounterService = {
  // Get encounters for a patient
  async getAll(patientId: string, options: { status?: string; class_code?: string } = {}) {
    let query = supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .order('period_start', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.class_code) {
      query = query.eq('class_code', options.class_code);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get active encounters (status = 'in-progress')
  async getActive(patientId: string) {
    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', ['arrived', 'triaged', 'in-progress', 'onleave'])
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get by encounter class (inpatient, outpatient, emergency)
  async getByClass(patientId: string, classCode: string) {
    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .eq('class_code', classCode)
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get recent encounters (last 30 days)
  async getRecent(patientId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .gte('period_start', since.toISOString())
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create encounter
  async create(encounter: any) {
    const { data, error } = await supabase
      .from('encounters')
      .insert([encounter])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update encounter
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('encounters')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Complete encounter (set status to 'finished' and period_end)
  async complete(id: string) {
    const { data, error } = await supabase
      .from('encounters')
      .update({
        status: 'finished',
        period_end: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// DOCUMENT REFERENCE SERVICE
// ============================================================================

export const DocumentReferenceService = {
  // Get all documents for a patient
  async getAll(patientId: string, options: { type_code?: string; status?: string } = {}) {
    let query = supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });

    if (options.type_code) {
      query = query.eq('type_code', options.type_code);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get by document type (clinical notes, discharge summaries, lab reports, etc.)
  async getByType(patientId: string, typeCode: string) {
    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .eq('type_code', typeCode)
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get clinical notes (LOINC codes: 11506-3, 34133-9, etc.)
  async getClinicalNotes(patientId: string) {
    const clinicalNoteCodes = [
      '11506-3', // Progress note
      '34133-9', // Summary of episode note
      '18842-5', // Discharge summary
      '28570-0', // Procedure note
      '11488-4', // Consultation note
    ];

    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .in('type_code', clinicalNoteCodes)
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get discharge summaries
  async getDischargeSummaries(patientId: string) {
    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .eq('type_code', '18842-5') // LOINC code for discharge summary
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get by encounter (documents associated with a specific encounter)
  async getByEncounter(encounterId: string) {
    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .contains('context', { encounter_id: encounterId })
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create document reference
  async create(document: any) {
    const { data, error } = await supabase
      .from('document_references')
      .insert([document])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update document reference
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('document_references')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Supersede document (mark as superseded and create new version)
  async supersede(id: string, newDocument: any) {
    // Mark old document as superseded
    await supabase
      .from('document_references')
      .update({ status: 'superseded' })
      .eq('id', id);

    // Create new version
    const { data, error } = await supabase
      .from('document_references')
      .insert([{
        ...newDocument,
        related_to: [{ reference: id, display: 'Supersedes previous version' }]
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: SDOH (SOCIAL DETERMINANTS OF HEALTH) SERVICE
// WellFit Differentiator: Built-in health equity screening
// ============================================================================

export const SDOHService = {
  // Screen patient for social determinants of health
  async screenPatient(patientId: string, screeningResponses: any[]) {
    const results = await Promise.all(
      screeningResponses.map((response) =>
        supabase.from('sdoh_observations').insert([{
          patient_id: patientId,
          ...response,
        }]).select().single()
      )
    );

    return results.map(r => r.data);
  },

  // Get all SDOH data for patient
  async getAll(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get SDOH by category (food, housing, transportation, etc.)
  async getByCategory(patientId: string, category: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('category', category)
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get high-risk SDOH issues
  async getHighRisk(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .in('risk_level', ['high', 'critical'])
      .eq('status', 'final')
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get SDOH issues needing intervention
  async getNeedingIntervention(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('intervention_provided', false)
      .in('risk_level', ['moderate', 'high', 'critical'])
      .order('risk_level', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Record intervention/referral
  async recordIntervention(id: string, intervention: {
    intervention_provided: boolean;
    referral_made: boolean;
    referral_to?: string;
    follow_up_needed?: boolean;
    follow_up_date?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .update(intervention)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Calculate SDOH composite risk score
  async calculateRiskScore(patientId: string) {
    const { data, error } = await supabase
      .rpc('calculate_sdoh_risk_score', { p_patient_id: patientId });

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: MEDICATION AFFORDABILITY SERVICE
// WellFit Differentiator: Real-time cost comparison + alternatives
// ============================================================================

export const MedicationAffordabilityService = {
  // Check medication affordability (integrates with pricing APIs)
  async checkAffordability(input: {
    patient_id: string;
    medication_name: string;
    rxnorm_code?: string;
    quantity: number;
    days_supply: number;
  }) {
    // This would integrate with GoodRx API, Cost Plus Drugs API, etc.
    // For now, we'll store the check and return mock data
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .insert([{
        ...input,
        checked_date: new Date().toISOString(),
        is_affordable: true, // Would be calculated based on patient income + price
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get affordability checks for patient
  async getChecks(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Find unaffordable medications
  async getUnaffordable(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_affordable', false)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get medications with patient assistance available
  async getWithAssistance(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .eq('patient_assistance_available', true)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Add therapeutic alternatives
  async addAlternatives(checkId: string, alternatives: any[]) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .update({ alternatives })
      .eq('id', checkId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: CARE COORDINATION HUB SERVICE
// WellFit Differentiator: Real-time patient journey tracking
// ============================================================================

export const CareCoordinationService = {
  // Log care coordination event
  async logEvent(event: any) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get patient's care journey (all events)
  async getPatientJourney(patientId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .gte('event_timestamp', since.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get active care coordination issues
  async getActiveIssues(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .in('event_status', ['scheduled', 'in-progress'])
      .order('event_timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get care gaps
  async getCareGaps(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('care_gap_identified', true)
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get incomplete handoffs
  async getIncompleteHandoffs(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('handoff_occurred', true)
      .in('handoff_quality', ['incomplete', 'missing-info'])
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get no-show appointments
  async getNoShows(patientId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('event_type', 'appointment')
      .eq('event_status', 'no-show')
      .gte('event_timestamp', since.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Update event status
  async updateEventStatus(eventId: string, status: string, notes?: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .update({
        event_status: status,
        notes: notes || undefined,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: HEALTH EQUITY ANALYTICS SERVICE
// WellFit Differentiator: Bias detection & disparities tracking
// ============================================================================

export const HealthEquityService = {
  // Calculate health equity metrics for patient
  async calculateMetrics(patientId: string) {
    const { data, error } = await supabase
      .rpc('calculate_health_equity_metrics', { p_patient_id: patientId });

    if (error) throw error;
    return data;
  },

  // Get patients with disparities
  async getPatientsWithDisparities(options: {
    disparity_type?: 'access' | 'outcome' | 'utilization';
    insurance_type?: string;
  } = {}) {
    let query = supabase
      .from('health_equity_metrics')
      .select('*');

    if (options.disparity_type === 'access') {
      query = query.eq('has_access_disparity', true);
    } else if (options.disparity_type === 'outcome') {
      query = query.eq('has_outcome_disparity', true);
    } else if (options.disparity_type === 'utilization') {
      query = query.eq('has_utilization_disparity', true);
    }

    if (options.insurance_type) {
      query = query.eq('insurance_type', options.insurance_type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get equity interventions for patient
  async getInterventions(patientId: string) {
    const { data, error } = await supabase
      .from('health_equity_metrics')
      .select('equity_interventions')
      .eq('patient_id', patientId)
      .single();

    if (error) throw error;
    return data?.equity_interventions || [];
  },

  // Record equity intervention
  async recordIntervention(patientId: string, intervention: {
    intervention_type: string;
    intervention_date: string;
    outcome?: string;
  }) {
    // Append to existing interventions array
    const { data: current } = await supabase
      .from('health_equity_metrics')
      .select('equity_interventions')
      .eq('patient_id', patientId)
      .single();

    const interventions = current?.equity_interventions || [];
    interventions.push(intervention);

    const { data, error } = await supabase
      .from('health_equity_metrics')
      .update({ equity_interventions: interventions })
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Aggregate disparities by demographic
  async getDisparitiesByDemographic(demographic: 'age_group' | 'insurance_type' | 'preferred_language') {
    const { data, error } = await supabase
      .rpc('aggregate_disparities_by_demographic', { p_demographic: demographic });

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// GOAL SERVICE
// ============================================================================

export const GoalService = {
  /**
   * Get all goals for a patient
   */
  async getAll(patientId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch goals',
      };
    }
  },

  /**
   * Get active goals
   */
  async getActive(patientId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .select('*')
        .eq('patient_id', patientId)
        .in('lifecycle_status', ['proposed', 'planned', 'accepted', 'active'])
        .order('priority_code', { ascending: true, nullsFirst: false })
        .order('start_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active goals',
      };
    }
  },

  /**
   * Get goals by category
   */
  async getByCategory(patientId: string, category: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .select('*')
        .eq('patient_id', patientId)
        .contains('category', [category])
        .order('start_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch goals by category',
      };
    }
  },

  /**
   * Create a new goal
   */
  async create(goal: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .insert([goal])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create goal',
      };
    }
  },

  /**
   * Update goal
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update goal',
      };
    }
  },

  /**
   * Complete goal
   */
  async complete(id: string): Promise<FHIRApiResponse<any>> {
    return this.update(id, {
      lifecycle_status: 'completed',
      status_date: new Date().toISOString(),
    });
  },
};

// ============================================================================
// LOCATION SERVICE
// ============================================================================

export const LocationService = {
  /**
   * Get all active locations
   */
  async getAll(): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch locations',
      };
    }
  },

  /**
   * Get location by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch location',
      };
    }
  },

  /**
   * Get locations by type
   */
  async getByType(typeCode: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .contains('type', [typeCode])
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch locations by type',
      };
    }
  },

  /**
   * Create location
   */
  async create(location: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .insert([location])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
      };
    }
  },

  /**
   * Update location
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update location',
      };
    }
  },
};

// ============================================================================
// ORGANIZATION SERVICE
// ============================================================================

export const OrganizationService = {
  /**
   * Get all active organizations
   */
  async getAll(): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organizations',
      };
    }
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization',
      };
    }
  },

  /**
   * Get organization by NPI
   */
  async getByNPI(npi: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('npi', npi)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization by NPI',
      };
    }
  },

  /**
   * Search organizations by name
   */
  async search(searchTerm: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search organizations',
      };
    }
  },

  /**
   * Create organization
   */
  async create(organization: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .insert([organization])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create organization',
      };
    }
  },

  /**
   * Update organization
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update organization',
      };
    }
  },
};

// ============================================================================
// MEDICATION SERVICE
// ============================================================================

export const MedicationService = {
  /**
   * Get medication by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch medication',
      };
    }
  },

  /**
   * Get medication by RxNorm code
   */
  async getByRxNorm(rxnormCode: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .select('*')
        .eq('code', rxnormCode)
        .eq('code_system', 'http://www.nlm.nih.gov/research/umls/rxnorm')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch medication by RxNorm',
      };
    }
  },

  /**
   * Search medications by name
   */
  async search(searchTerm: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .select('*')
        .ilike('code_display', `%${searchTerm}%`)
        .order('code_display');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search medications',
      };
    }
  },

  /**
   * Create medication
   */
  async create(medication: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .insert([medication])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication',
      };
    }
  },

  /**
   * Update medication
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update medication',
      };
    }
  },
};

// ============================================================================
// PROVENANCE SERVICE
// ============================================================================

export const ProvenanceService = {
  /**
   * Get provenance for a resource
   */
  async getForResource(resourceId: string, resourceType?: string): Promise<FHIRApiResponse<any[]>> {
    try {
      let query = supabase
        .from('fhir_provenance')
        .select('*')
        .contains('target_references', [resourceId])
        .order('recorded', { ascending: false });

      if (resourceType) {
        query = query.contains('target_types', [resourceType]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch provenance',
      };
    }
  },

  /**
   * Get provenance by agent (who did it)
   */
  async getByAgent(agentId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_provenance')
        .select('*')
        .contains('agent', [{ who_id: agentId }])
        .order('recorded', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch provenance by agent',
      };
    }
  },

  /**
   * Get audit trail for patient
   */
  async getAuditTrail(patientId: string, days: number = 90): Promise<FHIRApiResponse<any[]>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('fhir_provenance')
        .select('*')
        .contains('target_references', [patientId])
        .gte('recorded', since.toISOString())
        .order('recorded', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit trail',
      };
    }
  },

  /**
   * Create provenance record
   */
  async create(provenance: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_provenance')
        .insert([{
          ...provenance,
          recorded: provenance.recorded || new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create provenance',
      };
    }
  },

  /**
   * Record audit event (helper method)
   */
  async recordAudit(params: {
    targetReferences: string[];
    targetTypes?: string[];
    activity: string;
    agentId: string;
    agentType?: string;
    agentRole?: string;
    onBehalfOfId?: string;
    reason?: string;
  }): Promise<FHIRApiResponse<any>> {
    const provenance = {
      target_references: params.targetReferences,
      target_types: params.targetTypes,
      recorded: new Date().toISOString(),
      activity: {
        code: params.activity,
        system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
      },
      agent: [{
        who_id: params.agentId,
        type: params.agentType ? {
          code: params.agentType,
          system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
        } : undefined,
        role: params.agentRole ? [{
          code: params.agentRole,
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        }] : undefined,
        on_behalf_of_id: params.onBehalfOfId,
      }],
      reason: params.reason ? [{
        code: params.reason,
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
      }] : undefined,
    };

    return this.create(provenance);
  },
};

// ============================================================================
// UNIFIED FHIR SERVICE (Single Entry Point)
// ============================================================================

export const FHIRService = {
  // Core FHIR Resources (US Core - 13/13 COMPLETE)
  MedicationRequest: MedicationRequestService,
  Condition: ConditionService,
  DiagnosticReport: DiagnosticReportService,
  Procedure: ProcedureService,
  Observation: ObservationService,
  Immunization: ImmunizationService,
  CarePlan: CarePlanService,
  CareTeam: CareTeamService,
  Practitioner: PractitionerService,
  PractitionerRole: PractitionerRoleService,
  AllergyIntolerance: AllergyIntoleranceService,
  Encounter: EncounterService,
  DocumentReference: DocumentReferenceService,
  Goal: GoalService,
  Location: LocationService,
  Organization: OrganizationService,
  Medication: MedicationService,
  Provenance: ProvenanceService,

  // WellFit Innovative Services (Differentiators)
  SDOH: SDOHService,
  MedicationAffordability: MedicationAffordabilityService,
  CareCoordination: CareCoordinationService,
  HealthEquity: HealthEquityService,
};

export default FHIRService;
