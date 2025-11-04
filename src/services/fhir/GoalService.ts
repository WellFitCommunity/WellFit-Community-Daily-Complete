/**
 * FHIR Goal Service
 * Manages patient health goals and targets (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/goal.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRApiResponse } from '../../types/fhir';

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
