/**
 * FHIR Care Coordination Service
 * INNOVATIVE: WellFit Differentiator - Real-time patient journey tracking
 * Manages care coordination events and care gap identification
 *
 * @see https://hl7.org/fhir/R4/careplan.html
 */

import { supabase } from '../../lib/supabaseClient';

export const CareCoordinationService = {
  // Log care coordination event
  async logEvent(event: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get patient's care journey (all events)
  async getPatientJourney(patientId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .gte('event_timestamp', since.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get active care coordination issues
  async getActiveIssues(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .in('event_status', ['scheduled', 'in-progress'])
      .order('event_timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get care gaps
  async getCareGaps(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('care_gap_identified', true)
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get incomplete handoffs
  async getIncompleteHandoffs(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('handoff_occurred', true)
      .in('handoff_quality', ['incomplete', 'missing-info'])
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get no-show appointments
  async getNoShows(patientId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('event_type', 'appointment')
      .eq('event_status', 'no-show')
      .gte('event_timestamp', since.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Update event status
  async updateEventStatus(eventId: string, status: string, notes?: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .update({
        event_status: status,
        notes: notes || undefined,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
