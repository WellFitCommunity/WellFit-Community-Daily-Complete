/**
 * FHIR PractitionerRole Service
 * Manages practitioner role assignments and relationships (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/practitionerrole.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRPractitionerRole } from '../../types/fhir';

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
