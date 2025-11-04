/**
 * FHIR Medication Affordability Service
 * INNOVATIVE: WellFit Differentiator - Real-time cost comparison + alternatives
 * Manages medication affordability checks and patient assistance programs
 *
 * @see https://hl7.org/fhir/R4/medication.html
 */

import { supabase } from '../../lib/supabaseClient';

export const MedicationAffordabilityService = {
  // Check medication affordability (integrates with pricing APIs)
  async checkAffordability(input: {
    patient_id: string;
    medication_name: string;
    rxnorm_code?: string;
    quantity: number;
    days_supply: number;
  }) {
    // This would integrate with GoodRx API, Cost Plus Drugs API, etc.
    // For now, we'll store the check and return mock data
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .insert([{
        ...input,
        checked_date: new Date().toISOString(),
        is_affordable: true, // Would be calculated based on patient income + price
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get affordability checks for patient
  async getChecks(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Find unaffordable medications
  async getUnaffordable(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_affordable', false)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get medications with patient assistance available
  async getWithAssistance(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .eq('patient_assistance_available', true)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Add therapeutic alternatives
  async addAlternatives(checkId: string, alternatives: any[]) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .update({ alternatives })
      .eq('id', checkId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
