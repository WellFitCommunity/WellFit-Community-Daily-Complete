/**
 * FHIR Organization Service
 * Manages healthcare organization resources (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/organization.html
 */

import { supabase } from '../../lib/supabaseClient';
import { getErrorMessage } from '../../lib/getErrorMessage';
import type { FHIRApiResponse } from '../../types/fhir';

type OrganizationRecord = Record<string, unknown>;

export const OrganizationService = {
  /**
   * Get all active organizations
   */
  async getAll(): Promise<FHIRApiResponse<OrganizationRecord[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch organizations',
      };
    }
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<OrganizationRecord>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data: (data || {}) as OrganizationRecord };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch organization',
      };
    }
  },

  /**
   * Get organization by NPI
   */
  async getByNPI(npi: string): Promise<FHIRApiResponse<OrganizationRecord>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('npi', npi)
        .single();

      if (error) throw error;
      return { success: true, data: (data || {}) as OrganizationRecord };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch organization by NPI',
      };
    }
  },

  /**
   * Search organizations by name
   */
  async search(searchTerm: string): Promise<FHIRApiResponse<OrganizationRecord[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to search organizations',
      };
    }
  },

  /**
   * Create organization
   */
  async create(organization: OrganizationRecord): Promise<FHIRApiResponse<OrganizationRecord>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .insert([organization])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: (data || {}) as OrganizationRecord };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to create organization',
      };
    }
  },

  /**
   * Update organization
   */
  async update(id: string, updates: OrganizationRecord): Promise<FHIRApiResponse<OrganizationRecord>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: (data || {}) as OrganizationRecord };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to update organization',
      };
    }
  },
};
