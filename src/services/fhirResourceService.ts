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
  FHIRPractitioner,
  FHIRPractitionerRole,
  FHIRApiResponse,
  FHIRSearchParams,
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

const ImmunizationService = {
  /**
   * Get all immunizations for a patient
   */
  async getByPatient(patientId: string): Promise<FHIRImmunization[]> {
    const { data, error } = await supabase
      .from('fhir_immunizations')
      .select('*')
      .eq('patient_id', patientId)
      .order('occurrence_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get immunization history (helper function)
   */
  async getHistory(patientId: string, days: number = 365): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_patient_immunizations', {
        p_patient_id: patientId,
        p_days: days
      });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get immunizations by vaccine type
   */
  async getByVaccineCode(patientId: string, vaccineCode: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_immunizations_by_vaccine', {
        p_patient_id: patientId,
        p_vaccine_code: vaccineCode
      });

    if (error) throw error;
    return data || [];
  },

  /**
   * Check if vaccine is due (care gap)
   */
  async checkVaccineDue(
    patientId: string,
    vaccineCode: string,
    monthsSinceLast: number = 12
  ): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('check_vaccine_due', {
        p_patient_id: patientId,
        p_vaccine_code: vaccineCode,
        p_months_since_last: monthsSinceLast
      });

    if (error) throw error;
    return data || false;
  },

  /**
   * Get vaccine gaps (care opportunities)
   */
  async getVaccineGaps(patientId: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_vaccine_gaps', {
        p_patient_id: patientId
      });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create new immunization record
   */
  async create(immunization: Partial<FHIRImmunization>): Promise<FHIRImmunization> {
    const { data, error } = await supabase
      .from('fhir_immunizations')
      .insert(immunization)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update immunization record
   */
  async update(id: string, updates: Partial<FHIRImmunization>): Promise<FHIRImmunization> {
    const { data, error } = await supabase
      .from('fhir_immunizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete immunization record
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('fhir_immunizations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get immunization by ID
   */
  async getById(id: string): Promise<FHIRImmunization | null> {
    const { data, error } = await supabase
      .from('fhir_immunizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  },

  /**
   * Get completed immunizations only
   */
  async getCompleted(patientId: string): Promise<FHIRImmunization[]> {
    const { data, error } = await supabase
      .from('fhir_immunizations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'completed')
      .order('occurrence_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Search immunizations with filters
   */
  async search(params: {
    patientId?: string;
    status?: string;
    vaccineCode?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<FHIRImmunization[]> {
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
    return data || [];
  },
};

// ============================================================================
// CARE PLAN SERVICE
// ============================================================================

const CarePlanService = {
  /**
   * Get all care plans for a patient
   */
  async getByPatient(patientId: string): Promise<FHIRCarePlan[]> {
    const { data, error } = await supabase
      .from('fhir_care_plans')
      .select('*')
      .eq('patient_id', patientId)
      .order('created', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get active care plans
   */
  async getActive(patientId: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_active_care_plans', {
        p_patient_id: patientId
      });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get current care plan (most recent active)
   */
  async getCurrent(patientId: string): Promise<any | null> {
    const { data, error } = await supabase
      .rpc('get_current_care_plan', {
        p_patient_id: patientId
      });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  /**
   * Get care plans by status
   */
  async getByStatus(patientId: string, status: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_care_plans_by_status', {
        p_patient_id: patientId,
        p_status: status
      });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get care plans by category
   */
  async getByCategory(patientId: string, category: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_care_plans_by_category', {
        p_patient_id: patientId,
        p_category: category
      });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get care plan by ID
   */
  async getById(id: string): Promise<FHIRCarePlan | null> {
    const { data, error } = await supabase
      .from('fhir_care_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get activity summary for a care plan
   */
  async getActivitiesSummary(carePlanId: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_care_plan_activities_summary', {
        p_care_plan_id: carePlanId
      });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  /**
   * Create a new care plan
   */
  async create(carePlan: Partial<FHIRCarePlan>): Promise<FHIRCarePlan> {
    const { data, error } = await supabase
      .from('fhir_care_plans')
      .insert([carePlan])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a care plan
   */
  async update(id: string, updates: Partial<FHIRCarePlan>): Promise<FHIRCarePlan> {
    const { data, error } = await supabase
      .from('fhir_care_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a care plan
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('fhir_care_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Advanced search with filters
   */
  async search(params: {
    patientId?: string;
    status?: string;
    category?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<FHIRCarePlan[]> {
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
    return data || [];
  },
};

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
// UNIFIED FHIR SERVICE (Single Entry Point)
// ============================================================================

export const FHIRService = {
  MedicationRequest: MedicationRequestService,
  Condition: ConditionService,
  DiagnosticReport: DiagnosticReportService,
  Procedure: ProcedureService,
  Observation: ObservationService,
  Immunization: ImmunizationService,
  CarePlan: CarePlanService,
  Practitioner: PractitionerService,
  PractitionerRole: PractitionerRoleService,
};

export default FHIRService;
