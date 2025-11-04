/**
 * FHIR Medication Service
 * Manages medication definitions and drug information (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/medication.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRApiResponse } from '../../types/fhir';

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
