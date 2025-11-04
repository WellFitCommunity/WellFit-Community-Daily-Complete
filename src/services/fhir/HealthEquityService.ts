/**
 * FHIR Health Equity Service
 * INNOVATIVE: WellFit Differentiator - Bias detection & disparities tracking
 * Manages health equity metrics and disparity analysis
 *
 * @see https://hl7.org/fhir/R4/observation.html
 */

import { supabase } from '../../lib/supabaseClient';

export const HealthEquityService = {
  // Calculate health equity metrics for patient
  async calculateMetrics(patientId: string) {
    const { data, error } = await supabase
      .rpc('calculate_health_equity_metrics', { p_patient_id: patientId });

    if (error) throw error;
    return data;
  },

  // Get patients with disparities
  async getPatientsWithDisparities(options: {
    disparity_type?: 'access' | 'outcome' | 'utilization';
    insurance_type?: string;
  } = {}) {
    let query = supabase
      .from('health_equity_metrics')
      .select('*');

    if (options.disparity_type === 'access') {
      query = query.eq('has_access_disparity', true);
    } else if (options.disparity_type === 'outcome') {
      query = query.eq('has_outcome_disparity', true);
    } else if (options.disparity_type === 'utilization') {
      query = query.eq('has_utilization_disparity', true);
    }

    if (options.insurance_type) {
      query = query.eq('insurance_type', options.insurance_type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get equity interventions for patient
  async getInterventions(patientId: string) {
    const { data, error } = await supabase
      .from('health_equity_metrics')
      .select('equity_interventions')
      .eq('patient_id', patientId)
      .single();

    if (error) throw error;
    return data?.equity_interventions || [];
  },

  // Record equity intervention
  async recordIntervention(patientId: string, intervention: {
    intervention_type: string;
    intervention_date: string;
    outcome?: string;
  }) {
    // Append to existing interventions array
    const { data: current } = await supabase
      .from('health_equity_metrics')
      .select('equity_interventions')
      .eq('patient_id', patientId)
      .single();

    const interventions = current?.equity_interventions || [];
    interventions.push(intervention);

    const { data, error } = await supabase
      .from('health_equity_metrics')
      .update({ equity_interventions: interventions })
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Aggregate disparities by demographic
  async getDisparitiesByDemographic(demographic: 'age_group' | 'insurance_type' | 'preferred_language') {
    const { data, error } = await supabase
      .rpc('aggregate_disparities_by_demographic', { p_demographic: demographic });

    if (error) throw error;
    return data;
  },
};
