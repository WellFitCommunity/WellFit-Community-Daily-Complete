/**
 * FHIR Location Service
 * Manages healthcare facility and location resources (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/location.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRApiResponse } from '../../types/fhir';

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
