/**
 * FHIR AllergyIntolerance Service
 * Manages patient allergy and intolerance records (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/allergyintolerance.html
 */

import { supabase } from '../../lib/supabaseClient';

export const AllergyIntoleranceService = {
  // Get all allergies for a patient
  async getAll(patientId: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .order('criticality', { ascending: false, nullsFirst: false })
      .order('allergen_name');

    if (error) throw error;
    return data || [];
  },

  // Get active allergies only (clinical_status = 'active')
  async getActive(patientId: string) {
    const { data, error } = await supabase
      .rpc('get_active_allergies', { user_id_param: patientId });

    if (error) throw error;
    return data || [];
  },

  // Get by allergen type
  async getByType(
    patientId: string,
    allergenType: 'medication' | 'food' | 'environment' | 'biologic'
  ) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .eq('allergen_type', allergenType)
      .eq('clinical_status', 'active')
      .order('criticality', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data || [];
  },

  // Get high-risk allergies (criticality = 'high')
  async getHighRisk(patientId: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .eq('clinical_status', 'active')
      .eq('criticality', 'high')
      .order('allergen_name');

    if (error) throw error;
    return data || [];
  },

  // CRITICAL: Check if medication causes allergy
  async checkMedicationAllergy(patientId: string, medicationName: string) {
    const { data, error } = await supabase
      .rpc('check_medication_allergy', {
        user_id_param: patientId,
        medication_name_param: medicationName
      });

    if (error) throw error;
    return data || [];
  },

  // Create new allergy
  async create(allergy: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .insert([allergy])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update allergy
  async update(id: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete allergy (soft delete - set to 'entered-in-error')
  async delete(id: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update({
        verification_status: 'entered-in-error',
        clinical_status: 'inactive'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
