/**
 * FHIR Condition Service
 * Handles patient diagnoses and health conditions
 *
 * FHIR R4 Resource: Condition
 * Purpose: Records clinical diagnoses, problems, and health concerns
 *
 * HIPAA §164.312(b): PHI access logging enabled
 *
 * @see https://hl7.org/fhir/R4/condition.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  Condition,
  CreateCondition,
  FHIRApiResponse,
} from '../../types/fhir';
import { normalizeCondition, toFHIRCondition } from './utils/fhirNormalizers';
import { auditLogger } from '../auditLogger';

export class ConditionService {
  /**
   * Get all conditions for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All Condition resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('CONDITION_LIST_READ', patientId, {
        resourceType: 'Condition',
        operation: 'getByPatient',
      });

      const { data, error } = await supabase
        .from('fhir_conditions')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_date', { ascending: false });

      if (error) throw error;
      // Normalize for backwards compatibility
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch conditions',
      };
    }
  }

  /**
   * Get active conditions (problem list)
   *
   * Returns conditions with clinical_status = 'active' or 'recurrence'
   * Excludes resolved, inactive, and remission statuses
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Active Condition resources
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('CONDITION_ACTIVE_READ', patientId, {
        resourceType: 'Condition',
        operation: 'getActive',
      });

      const { data, error } = await supabase
        .rpc('get_active_conditions', { patient_id_param: patientId });

      if (error) throw error;
      // Normalize for backwards compatibility
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch active conditions',
      };
    }
  }

  /**
   * Get problem list
   *
   * Returns conditions with category = 'problem-list-item'
   * Commonly used for active clinical problems requiring ongoing management
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Problem list Condition resources
   */
  static async getProblemList(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('CONDITION_PROBLEM_LIST_READ', patientId, {
        resourceType: 'Condition',
        operation: 'getProblemList',
      });

      const { data, error } = await supabase
        .rpc('get_problem_list', { patient_id_param: patientId });

      if (error) throw error;
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch problem list',
      };
    }
  }

  /**
   * Get encounter diagnoses
   *
   * Returns conditions linked to a specific clinical encounter
   * Used for billing and clinical documentation
   *
   * @param encounterId - FHIR Encounter resource ID
   * @returns Condition resources for the encounter
   */
  static async getByEncounter(encounterId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_encounter_diagnoses', { encounter_id_param: encounterId });

      if (error) throw error;
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch encounter diagnoses',
      };
    }
  }

  /**
   * Create a new condition
   *
   * Automatically converts simplified fields to FHIR-compliant format
   * Supports both legacy and FHIR input formats
   *
   * @param condition - Condition resource to create
   * @returns Created Condition with server-assigned ID
   */
  static async create(condition: CreateCondition): Promise<FHIRApiResponse<Condition>> {
    try {
      // Convert to FHIR format for database
      const fhirCondition = toFHIRCondition(condition);

      // HIPAA §164.312(b): Log PHI write
      await auditLogger.phi('CONDITION_CREATE', condition.patient_id, {
        resourceType: 'Condition',
        operation: 'create',
        code: condition.code,
      });

      const { data, error } = await supabase
        .from('fhir_conditions')
        .insert([fhirCondition])
        .select()
        .single();

      if (error) throw error;
      // Normalize for backwards compatibility
      return { success: true, data: normalizeCondition(data) };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create condition',
      };
    }
  }

  /**
   * Update condition
   *
   * Common use cases:
   * - Change clinical status (active → resolved)
   * - Update severity
   * - Add clinical notes
   *
   * @param id - Condition resource ID
   * @param updates - Partial Condition fields to update
   * @returns Updated Condition resource
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
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update condition',
      };
    }
  }

  /**
   * Resolve condition
   *
   * Sets clinical_status to 'resolved' and records abatement date
   * Used when condition is cured or no longer clinically relevant
   *
   * @param id - Condition resource ID
   * @returns Updated Condition with resolved status
   */
  static async resolve(id: string): Promise<FHIRApiResponse<Condition>> {
    return this.update(id, {
      clinical_status: 'resolved',
      abatement_datetime: new Date().toISOString(),
    });
  }

  /**
   * Get chronic conditions
   *
   * Returns long-term conditions requiring ongoing management
   * Typically includes diabetes, hypertension, COPD, etc.
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Chronic Condition resources
   */
  static async getChronic(patientId: string): Promise<FHIRApiResponse<Condition[]>> {
    try {
      // HIPAA §164.312(b): Log PHI access
      await auditLogger.phi('CONDITION_CHRONIC_READ', patientId, {
        resourceType: 'Condition',
        operation: 'getChronic',
      });

      const { data, error } = await supabase
        .rpc('get_chronic_conditions', { patient_id_param: patientId });

      if (error) throw error;
      const normalized = (data || []).map(normalizeCondition);
      return { success: true, data: normalized };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch chronic conditions',
      };
    }
  }
}
