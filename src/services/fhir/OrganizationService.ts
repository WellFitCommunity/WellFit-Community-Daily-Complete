/**
 * FHIR Organization Service
 * Manages healthcare organization resources (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/organization.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRApiResponse } from '../../types/fhir';

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
