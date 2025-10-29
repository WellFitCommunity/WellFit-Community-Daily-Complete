/**
 * PT Session Service
 * Service layer for SOAP note documentation and treatment sessions
 *
 * Clinical Standards: SOAP note format, 8-minute billing rule
 * Compliance: HIPAA, Medicare documentation requirements, CPT coding
 */

import { supabase } from '../lib/supabaseClient';
import type {
  PTTreatmentSession,
  RecordTreatmentSessionRequest,
  SessionIntervention,
} from '../types/physicalTherapy';

/**
 * API Response wrapper
 */
export interface PTApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * PT Session Service - Main API
 */
export class PTSessionService {
  /**
   * Create new PT session (SOAP note)
   */
  static async createPTSession(
    request: RecordTreatmentSessionRequest
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate session number
      const { count } = await supabase
        .from('pt_treatment_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('treatment_plan_id', request.treatment_plan_id);

      const sessionNumber = (count || 0) + 1;

      // Calculate total timed minutes and billable units
      const totalTimedMinutes = request.interventions_delivered.reduce(
        (sum, intervention) => sum + intervention.time_spent_minutes,
        0
      );
      const billableUnits = this.calculateBillableUnits(totalTimedMinutes);

      // Extract CPT codes from interventions
      const cptCodesBilled = [
        ...new Set(request.interventions_delivered.map((i) => i.cpt_code)),
      ];

      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .insert({
          patient_id: request.patient_id,
          treatment_plan_id: request.treatment_plan_id,
          encounter_id: request.encounter_id,
          therapist_id: user.id,
          session_date: request.session_date,
          session_number: sessionNumber,
          session_duration_minutes: request.session_duration_minutes || totalTimedMinutes,
          attendance_status: request.attendance_status,
          patient_reported_status: request.patient_reported_status,
          pain_level_today: request.pain_level_today,
          hep_compliance: request.hep_compliance,
          barriers_today: request.barriers_today,
          vitals_if_needed: request.vitals_if_needed,
          reassessments_today: request.reassessments_today,
          interventions_delivered: request.interventions_delivered,
          progress_toward_goals: request.progress_toward_goals,
          functional_changes: request.functional_changes,
          clinical_decision_making: request.clinical_decision_making,
          plan_for_next_visit: request.plan_for_next_visit,
          plan_modifications: request.plan_modifications,
          goals_updated: request.goals_updated || false,
          total_timed_minutes: totalTimedMinutes,
          total_billable_units: billableUnits,
          cpt_codes_billed: cptCodesBilled,
          exercise_videos_shared: request.exercise_videos_shared,
          educational_materials_provided: request.educational_materials_provided,
          adverse_events: request.adverse_events,
          incident_report_filed: request.incident_report_filed || false,
        })
        .select()
        .single();

      if (error) throw error;

      // Note: visits_used is auto-incremented by database trigger
      // if attendance_status is 'attended'

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate billable units using 8-minute rule
   * Medicare rule: 8-22 min = 1 unit, 23-37 min = 2 units, etc.
   */
  static calculateBillableUnits(totalMinutes: number): number {
    if (totalMinutes < 8) return 0;
    if (totalMinutes <= 22) return 1;
    if (totalMinutes <= 37) return 2;
    if (totalMinutes <= 52) return 3;
    if (totalMinutes <= 67) return 4;
    if (totalMinutes <= 82) return 5;
    if (totalMinutes <= 97) return 6;
    if (totalMinutes <= 112) return 7;

    // For times >112 minutes, use the formula
    return Math.floor((totalMinutes - 8) / 15) + 1;
  }

  /**
   * Get all sessions for a treatment plan
   */
  static async getSessionsByTreatmentPlan(
    planId: string
  ): Promise<PTApiResponse<PTTreatmentSession[]>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .select('*')
        .eq('treatment_plan_id', planId)
        .order('session_date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get session by ID
   */
  static async getSessionById(
    sessionId: string
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get all sessions for a patient
   */
  static async getSessionsByPatient(
    patientId: string
  ): Promise<PTApiResponse<PTTreatmentSession[]>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .order('session_date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Update session
   */
  static async updateSession(
    sessionId: string,
    updates: Partial<PTTreatmentSession>
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Mark session for co-signature (for PTAs)
   */
  static async requestCoSignature(
    sessionId: string,
    supervisorId: string
  ): Promise<PTApiResponse<void>> {
    try {
      // This would typically create a notification/task for the supervisor
      // For now, we'll add a note to the session
      const { error } = await supabase
        .from('pt_treatment_sessions')
        .update({
          plan_modifications: {
            co_signature_requested: true,
            requested_from: supervisorId,
            requested_at: new Date().toISOString(),
          },
        })
        .eq('id', sessionId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Co-sign session (for supervising PTs)
   */
  static async coSignSession(
    sessionId: string,
    supervisorId: string
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .update({
          co_signed_by: supervisorId,
          co_signed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate total billable units for a treatment plan
   */
  static async calculateTotalBillableUnits(
    planId: string
  ): Promise<PTApiResponse<number>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .select('total_billable_units')
        .eq('treatment_plan_id', planId)
        .eq('attendance_status', 'attended');

      if (error) throw error;

      const total = (data || []).reduce(
        (sum, session) => sum + (session.total_billable_units || 0),
        0
      );

      return { success: true, data: total };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get sessions needing co-signature
   */
  static async getSessionsNeedingCoSignature(
    supervisorId: string
  ): Promise<PTApiResponse<PTTreatmentSession[]>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .select('*')
        .is('co_signed_by', null)
        .not('plan_modifications', 'is', null)
        .order('session_date', { ascending: false });

      if (error) throw error;

      // Filter for sessions requesting this supervisor's signature
      const filtered = (data || []).filter(
        (session: PTTreatmentSession) =>
          session.plan_modifications &&
          (session.plan_modifications as any).requested_from === supervisorId
      );

      return { success: true, data: filtered };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }
}
