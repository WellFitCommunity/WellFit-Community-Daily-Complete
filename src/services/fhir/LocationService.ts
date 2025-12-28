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
  async getAll(): Promise<FHIRApiResponse<Record<string, unknown>[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return { success: true, data: (data as Record<string, unknown>[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch locations',
      };
    }
  },

  /**
   * Get location by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data: data as Record<string, unknown> };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch location',
      };
    }
  },

  /**
   * Get locations by type
   */
  async getByType(typeCode: string): Promise<FHIRApiResponse<Record<string, unknown>[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .contains('type', [typeCode])
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return { success: true, data: (data as Record<string, unknown>[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch locations by type',
      };
    }
  },

  /**
   * Create location
   */
  async create(location: Record<string, unknown>): Promise<FHIRApiResponse<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .insert([location])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as Record<string, unknown> };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create location',
      };
    }
  },

  /**
   * Update location
   */
  async update(
    id: string,
    updates: Record<string, unknown>
  ): Promise<FHIRApiResponse<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as Record<string, unknown> };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update location',
      };
    }
  },
};
