/**
 * FHIR SDOH (Social Determinants of Health) Service
 * INNOVATIVE: WellFit Differentiator - Built-in health equity screening
 * Manages social determinants of health observations and interventions (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/observation.html
 * @see http://hl7.org/fhir/us/sdoh-clinicalcare/
 */

import { supabase } from '../../lib/supabaseClient';

export const SDOHService = {
  // Screen patient for social determinants of health
  async screenPatient(
    patientId: string,
    screeningResponses: Record<string, unknown>[]
  ) {
    const results = await Promise.all(
      screeningResponses.map((response) =>
        supabase
          .from('sdoh_observations')
          .insert([{
            patient_id: patientId,
            ...response,
          }])
          .select('id, fhir_id, patient_id, tenant_id, status, category, risk_level, priority_level, effective_datetime, next_assessment_date, performer_id, performer_name, loinc_code, z_codes, snomed_code, value_text, value_code, interpretation, notes, intervention_provided, referral_made, referral_to, follow_up_needed, follow_up_date, health_impact, created_at, updated_at, created_by, updated_by')
          .single()
      )
    );

    return results.map(r => r.data);
  },

  // Get all SDOH data for patient
  async getAll(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('id, patient_id, category, risk_level, effective_datetime, performer_id, next_assessment_date, z_codes, loinc_code, snomed_code, value_text, interpretation, notes, health_impact, priority_level, status, intervention_provided, referral_made')
      .eq('patient_id', patientId)
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get SDOH by category (food, housing, transportation, etc.)
  async getByCategory(patientId: string, category: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('id, patient_id, category, risk_level, effective_datetime, performer_id, next_assessment_date, z_codes, loinc_code, snomed_code, value_text, interpretation, notes, health_impact, priority_level, status, intervention_provided, referral_made')
      .eq('patient_id', patientId)
      .eq('category', category)
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get high-risk SDOH issues
  async getHighRisk(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('id, patient_id, category, risk_level, effective_datetime, performer_id, next_assessment_date, z_codes, loinc_code, snomed_code, value_text, interpretation, notes, health_impact, priority_level, status, intervention_provided, referral_made')
      .eq('patient_id', patientId)
      .in('risk_level', ['high', 'critical'])
      .eq('status', 'final')
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get SDOH issues needing intervention
  async getNeedingIntervention(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('id, patient_id, category, risk_level, effective_datetime, performer_id, next_assessment_date, z_codes, loinc_code, snomed_code, value_text, interpretation, notes, health_impact, priority_level, status, intervention_provided, referral_made')
      .eq('patient_id', patientId)
      .eq('intervention_provided', false)
      .in('risk_level', ['moderate', 'high', 'critical'])
      .order('risk_level', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Record intervention/referral
  async recordIntervention(id: string, intervention: {
    intervention_provided: boolean;
    referral_made: boolean;
    referral_to?: string;
    follow_up_needed?: boolean;
    follow_up_date?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .update(intervention)
      .eq('id', id)
      .select('id, fhir_id, patient_id, tenant_id, status, category, risk_level, priority_level, effective_datetime, next_assessment_date, performer_id, performer_name, loinc_code, z_codes, snomed_code, value_text, value_code, interpretation, notes, intervention_provided, referral_made, referral_to, follow_up_needed, follow_up_date, health_impact, created_at, updated_at, created_by, updated_by')
      .single();

    if (error) throw error;
    return data;
  },

  // Calculate SDOH composite risk score
  async calculateRiskScore(patientId: string) {
    const { data, error } = await supabase
      .rpc('calculate_sdoh_risk_score', { p_patient_id: patientId });

    if (error) throw error;
    return data;
  },
};
