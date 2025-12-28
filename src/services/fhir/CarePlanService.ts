/**
 * FHIR CarePlan Service
 * Handles treatment and care coordination plans
 *
 * FHIR R4 Resource: CarePlan
 * Purpose: Records patient care plans, treatment goals, and planned activities
 *
 * @see https://hl7.org/fhir/R4/careplan.html
 */

import { supabase } from '../../lib/supabaseClient';
import { getErrorMessage } from '../../lib/getErrorMessage';
import type { FHIRCarePlan, FHIRApiResponse } from '../../types/fhir';

type RpcRow = Record<string, unknown>;

export class CarePlanService {
  /**
   * Get all care plans for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All CarePlan resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<FHIRCarePlan[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('created', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data as FHIRCarePlan[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch care plans',
      };
    }
  }

  /**
   * Get care plan by ID
   *
   * @param id - CarePlan resource ID
   * @returns CarePlan resource or null if not found
   */
  static async getById(id: string): Promise<FHIRApiResponse<FHIRCarePlan | null>> {
    try {
      const { data, error } = await supabase.from('fhir_care_plans').select('*').eq('id', id).single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null }; // Not found
        }
        throw error;
      }
      return { success: true, data: data as FHIRCarePlan };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch care plan',
      };
    }
  }

  /**
   * Get active care plans using database function
   *
   * Returns care plans with status = 'active'
   * Used for current care coordination view
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Active CarePlan resources
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<RpcRow[]>> {
    try {
      const { data, error } = await supabase.rpc('get_active_care_plans', {
        p_patient_id: patientId,
      });

      if (error) throw error;
      return { success: true, data: (data as RpcRow[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch active care plans',
      };
    }
  }

  /**
   * Get current care plan (most recent active)
   *
   * Returns the single most recent active care plan
   * Used when only one care plan should be active at a time
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Current CarePlan resource or null
   */
  static async getCurrent(patientId: string): Promise<FHIRApiResponse<RpcRow | null>> {
    try {
      const { data, error } = await supabase.rpc('get_current_care_plan', {
        p_patient_id: patientId,
      });

      if (error) throw error;

      const rows = (data as RpcRow[]) || [];
      return { success: true, data: rows.length > 0 ? rows[0] : null };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch current care plan',
      };
    }
  }

  /**
   * Get care plans by status
   *
   * Filters care plans by FHIR status
   * Statuses: draft, active, on-hold, revoked, completed, entered-in-error, unknown
   *
   * @param patientId - FHIR Patient resource ID
   * @param status - FHIR CarePlan status
   * @returns Filtered CarePlan resources
   */
  static async getByStatus(patientId: string, status: string): Promise<FHIRApiResponse<RpcRow[]>> {
    try {
      const { data, error } = await supabase.rpc('get_care_plans_by_status', {
        p_patient_id: patientId,
        p_status: status,
      });

      if (error) throw error;
      return { success: true, data: (data as RpcRow[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch care plans by status',
      };
    }
  }

  /**
   * Get care plans by category
   *
   * Filters by care plan type/category
   * Categories: assess-plan, longitudinal, episodic, encounter, etc.
   *
   * @param patientId - FHIR Patient resource ID
   * @param category - FHIR CarePlan category
   * @returns Filtered CarePlan resources
   */
  static async getByCategory(patientId: string, category: string): Promise<FHIRApiResponse<RpcRow[]>> {
    try {
      const { data, error } = await supabase.rpc('get_care_plans_by_category', {
        p_patient_id: patientId,
        p_category: category,
      });

      if (error) throw error;
      return { success: true, data: (data as RpcRow[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch care plans by category',
      };
    }
  }

  /**
   * Get activity summary for a care plan
   *
   * Returns aggregated statistics about care plan activities
   * Useful for progress tracking and completion metrics
   *
   * @param carePlanId - CarePlan resource ID
   * @returns Activity summary with counts and status
   */
  static async getActivitiesSummary(carePlanId: string): Promise<FHIRApiResponse<RpcRow | null>> {
    try {
      const { data, error } = await supabase.rpc('get_care_plan_activities_summary', {
        p_care_plan_id: carePlanId,
      });

      if (error) throw error;

      const rows = (data as RpcRow[]) || [];
      return { success: true, data: rows.length > 0 ? rows[0] : null };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch care plan activities summary',
      };
    }
  }

  /**
   * Create a new care plan
   *
   * Common use cases:
   * - Chronic disease management plans
   * - Post-discharge care plans
   * - Preventive care plans
   *
   * @param carePlan - CarePlan resource to create
   * @returns Created CarePlan with server-assigned ID
   */
  static async create(carePlan: Partial<FHIRCarePlan>): Promise<FHIRApiResponse<FHIRCarePlan>> {
    try {
      const { data, error } = await supabase.from('fhir_care_plans').insert([carePlan]).select().single();

      if (error) throw error;
      return { success: true, data: data as FHIRCarePlan };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to create care plan',
      };
    }
  }

  /**
   * Update a care plan
   *
   * Common use cases:
   * - Add or modify activities
   * - Update goals
   * - Change status
   *
   * @param id - CarePlan resource ID
   * @param updates - Partial CarePlan fields to update
   * @returns Updated CarePlan resource
   */
  static async update(id: string, updates: Partial<FHIRCarePlan>): Promise<FHIRApiResponse<FHIRCarePlan>> {
    try {
      const { data, error } = await supabase.from('fhir_care_plans').update(updates).eq('id', id).select().single();

      if (error) throw error;
      return { success: true, data: data as FHIRCarePlan };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to update care plan',
      };
    }
  }

  /**
   * Delete a care plan
   *
   * Use with caution - consider setting status to 'revoked' or 'entered-in-error'
   * instead for audit trail compliance
   *
   * @param id - CarePlan resource ID
   * @returns Success indicator
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_care_plans').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to delete care plan',
      };
    }
  }

  /**
   * Advanced search with filters
   *
   * Supports multiple filter criteria for reporting and analytics
   *
   * @param params - Search parameters (all optional)
   * @returns Filtered CarePlan resources
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
      return { success: true, data: (data as FHIRCarePlan[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to search care plans',
      };
    }
  }

  /**
   * Complete a care plan (set status to 'completed')
   *
   * Marks care plan as finished and records end date
   *
   * @param id - CarePlan resource ID
   * @returns Updated CarePlan with completed status
   */
  static async complete(id: string): Promise<FHIRApiResponse<FHIRCarePlan>> {
    return this.update(id, {
      status: 'completed',
      period_end: new Date().toISOString(),
    });
  }

  /**
   * Activate a care plan
   *
   * Sets status to 'active' and records start date
   * Use when transitioning from draft or on-hold
   *
   * @param id - CarePlan resource ID
   * @returns Updated CarePlan with active status
   */
  static async activate(id: string): Promise<FHIRApiResponse<FHIRCarePlan>> {
    return this.update(id, {
      status: 'active',
      period_start: new Date().toISOString(),
    });
  }

  /**
   * Put care plan on hold
   *
   * Pauses care plan execution
   * Used when patient unable to participate temporarily
   *
   * @param id - CarePlan resource ID
   * @param reason - Optional reason for hold
   * @returns Updated CarePlan with on-hold status
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
