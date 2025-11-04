/**
 * FHIR Practitioner Service
 * Manages healthcare provider/practitioner resources (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/practitioner.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRPractitioner } from '../../types/fhir';

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
