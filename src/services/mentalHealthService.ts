/**
 * Mental Health Intervention Service
 * Enterprise service layer for FHIR-compliant mental health support
 *
 * Clinical Standards: Joint Commission, CMS CoP, Evidence-based suicide prevention
 * Compliance: HIPAA, Texas Health & Safety Code §161.0075
 */

import { supabase } from '../lib/supabaseClient';
import type {
  MentalHealthServiceRequest,
  MentalHealthTherapySession,
  MentalHealthRiskAssessment,
  MentalHealthSafetyPlan,
  MentalHealthEscalation,
  MentalHealthFlag,
  MentalHealthDischargeChecklist,
  PendingMentalHealthSession,
  DischargeBlocker,
  MentalHealthDashboardSummary,
  MentalHealthApiResponse,
  CreateMentalHealthServiceRequest,
  CreateTherapySession,
  CompleteTherapySession,
  CreateRiskAssessment,
  CreateSafetyPlan,
  RiskLevel,
} from '../types/mentalHealth';
import {
  generateCrisisHotlines,
  calculateOverallRisk,
} from '../types/mentalHealth';

/**
 * Mental Health Service - Main API
 */
export class MentalHealthService {
  // ============================================================================
  // SERVICE REQUESTS
  // ============================================================================

  /**
   * Create a mental health service request (auto-triggered or manual)
   */
  static async createServiceRequest(
    request: CreateMentalHealthServiceRequest
  ): Promise<MentalHealthApiResponse<MentalHealthServiceRequest>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_service_requests')
        .insert({
          patient_id: request.patient_id,
          encounter_id: request.encounter_id,
          status: request.status || 'active',
          intent: request.intent || 'order',
          priority: request.priority || 'routine',
          session_type: request.session_type,
          reason_code: request.reason_code,
          reason_display: request.reason_display,
          is_discharge_blocker: request.is_discharge_blocker || false,
          discharge_blocker_active: request.is_discharge_blocker || false,
          note: request.note,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // If this is a discharge blocker, create the checklist
      if (request.is_discharge_blocker) {
        await this.createDischargeChecklist(request.patient_id, request.encounter_id);
      }

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get service requests for a patient
   */
  static async getServiceRequestsByPatient(
    patientId: string
  ): Promise<MentalHealthApiResponse<MentalHealthServiceRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_service_requests')
        .select('id, fhir_id, created_at, updated_at, status, intent, priority, patient_id, encounter_id, code_system, code, code_display, category, requester_type, requester_id, requester_display, performer_type, performer_id, performer_display, reason_code, reason_display, reason_reference_type, reason_reference_id, occurrence_datetime, occurrence_period_start, occurrence_period_end, authored_on, session_type, session_number, total_sessions_required, min_duration_minutes, is_discharge_blocker, discharge_blocker_active, discharge_blocker_override_by, discharge_blocker_override_reason, discharge_blocker_override_at, note, supporting_info, completed_at, completed_by, outcome, created_by, updated_by')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Update service request status
   */
  static async updateServiceRequestStatus(
    id: string,
    status: string,
    outcome?: string
  ): Promise<MentalHealthApiResponse<MentalHealthServiceRequest>> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const updates: {
        status: string;
        updated_by: string | undefined;
        completed_at?: string;
        completed_by?: string;
        outcome?: string;
      } = {
        status,
        updated_by: userId,
      };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = userId;
        updates.outcome = outcome;
      }

      const { data, error } = await supabase
        .from('mental_health_service_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // THERAPY SESSIONS
  // ============================================================================

  /**
   * Schedule a therapy session
   */
  static async scheduleSession(
    session: CreateTherapySession
  ): Promise<MentalHealthApiResponse<MentalHealthTherapySession>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_therapy_sessions')
        .insert({
          patient_id: session.patient_id,
          service_request_id: session.service_request_id,
          session_number: session.session_number,
          session_type: session.session_type,
          is_first_session: session.is_first_session || false,
          is_discharge_required_session: session.is_discharge_required_session || false,
          scheduled_start: session.scheduled_start,
          scheduled_end: session.scheduled_end,
          participant_id: session.participant_id,
          participant_display: session.participant_display,
          modality: session.modality,
          location_display: session.location_display,
          room_number: session.room_number,
          status: 'planned',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Start a therapy session
   */
  static async startSession(
    sessionId: string
  ): Promise<MentalHealthApiResponse<MentalHealthTherapySession>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_therapy_sessions')
        .update({
          status: 'in-progress',
          actual_start: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Complete a therapy session
   */
  static async completeSession(
    sessionId: string,
    completion: CompleteTherapySession
  ): Promise<MentalHealthApiResponse<MentalHealthTherapySession>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_therapy_sessions')
        .update({
          status: completion.status,
          actual_start: completion.actual_start,
          actual_end: completion.actual_end,
          outcome_status: completion.outcome_status,
          chief_complaint: completion.chief_complaint,
          history_of_present_illness: completion.history_of_present_illness,
          assessment: completion.assessment,
          plan: completion.plan,
          outcome_note: completion.outcome_note,
          duration_exception_reason: completion.duration_exception_reason,
          duration_exception_code: completion.duration_exception_code,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      // Update discharge checklist if this was the required first session
      if (data.is_discharge_required_session && data.min_duration_met) {
        await this.updateDischargeChecklistItem(
          data.patient_id,
          'initial_therapy_session_completed',
          true,
          { initial_therapy_session_id: sessionId }
        );
      }

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get pending sessions (dashboard view)
   */
  static async getPendingSessions(): Promise<
    MentalHealthApiResponse<PendingMentalHealthSession[]>
  > {
    try {
      const { data, error } = await supabase
        .from('v_pending_mental_health_sessions')
        .select('session_id, patient_id, first_name, last_name, room_number, status, session_type, session_number, is_discharge_required_session, scheduled_start, scheduled_end, therapist, priority, risk_level')
        .order('scheduled_start', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // RISK ASSESSMENTS
  // ============================================================================

  /**
   * Create a risk assessment
   */
  static async createRiskAssessment(
    assessment: CreateRiskAssessment
  ): Promise<MentalHealthApiResponse<MentalHealthRiskAssessment>> {
    try {
      // Calculate PHQ-9 and GAD-7 severities if scores provided
      const phq9Severity = assessment.phq9_score
        ? this.getPhq9Severity(assessment.phq9_score)
        : undefined;
      const gad7Severity = assessment.gad7_score
        ? this.getGad7Severity(assessment.gad7_score)
        : undefined;

      // Calculate overall risk level
      const calculatedRisk = calculateOverallRisk(
        assessment.suicidal_ideation,
        assessment.suicidal_plan,
        assessment.suicidal_intent,
        assessment.means_access,
        assessment.phq9_score
      );

      // Use the higher of calculated or provided risk
      const finalRisk = this.getHigherRisk(calculatedRisk, assessment.risk_level);

      const { data, error } = await supabase
        .from('mental_health_risk_assessments')
        .insert({
          patient_id: assessment.patient_id,
          therapy_session_id: assessment.therapy_session_id,
          risk_level: finalRisk,
          suicidal_ideation: assessment.suicidal_ideation,
          suicidal_plan: assessment.suicidal_plan,
          suicidal_intent: assessment.suicidal_intent,
          means_access: assessment.means_access,
          phq9_score: assessment.phq9_score,
          phq9_severity: phq9Severity,
          gad7_score: assessment.gad7_score,
          gad7_severity: gad7Severity,
          clinical_impression: assessment.clinical_impression,
          adjustment_response: assessment.adjustment_response,
          coping_mechanisms: assessment.coping_mechanisms,
          support_system_adequate: assessment.support_system_adequate,
          patient_engagement: assessment.patient_engagement,
          protective_factors: assessment.protective_factors,
          risk_factors: assessment.risk_factors,
          note: assessment.note,
          status: 'final',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update discharge checklist
      await this.updateDischargeChecklistItem(
        assessment.patient_id,
        'risk_assessment_completed',
        true,
        { risk_assessment_id: data.id }
      );

      // Auto-escalate if high risk (handled by trigger, but we can also create flag)
      if (finalRisk === 'high') {
        await this.createFlag({
          patient_id: assessment.patient_id,
          flag_type: 'suicide_risk',
          code: 'suicide-risk-active',
          code_display: 'ACTIVE SUICIDE RISK - Monitoring Required',
          severity: 'critical',
          note: `High risk identified on ${new Date().toLocaleDateString()}. See risk assessment ${data.id}`,
        });
      }

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get latest risk assessment for patient
   */
  static async getLatestRiskAssessment(
    patientId: string
  ): Promise<MentalHealthApiResponse<MentalHealthRiskAssessment | null>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_risk_assessments')
        .select('id, fhir_id, created_at, updated_at, status, patient_id, therapy_session_id, code_system, code, code_display, category, effective_datetime, issued, performer_type, performer_id, performer_display, risk_level, suicidal_ideation, suicidal_plan, suicidal_intent, means_access, phq9_score, phq9_severity, gad7_score, gad7_severity, clinical_impression, adjustment_response, coping_mechanisms, support_system_adequate, patient_engagement, protective_factors, risk_factors, interpretation_code, interpretation_display, note, created_by, updated_by')
        .eq('patient_id', patientId)
        .order('effective_datetime', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      return { success: true, data: data || null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // SAFETY PLANS
  // ============================================================================

  /**
   * Create a safety plan
   */
  static async createSafetyPlan(
    plan: CreateSafetyPlan
  ): Promise<MentalHealthApiResponse<MentalHealthSafetyPlan>> {
    try {
      // Auto-populate crisis hotlines if not provided
      const crisisHotlines = plan.crisis_hotlines.length > 0
        ? plan.crisis_hotlines
        : generateCrisisHotlines();

      const { data, error } = await supabase
        .from('mental_health_safety_plans')
        .insert({
          patient_id: plan.patient_id,
          risk_assessment_id: plan.risk_assessment_id,
          therapy_session_id: plan.therapy_session_id,
          warning_signs: plan.warning_signs,
          internal_coping_strategies: plan.internal_coping_strategies,
          social_distraction_people: plan.social_distraction_people,
          social_distraction_places: plan.social_distraction_places,
          people_to_contact: plan.people_to_contact,
          professional_contacts: plan.professional_contacts,
          crisis_hotlines: crisisHotlines,
          means_restriction_steps: plan.means_restriction_steps,
          lethal_means_addressed: plan.lethal_means_addressed,
          patient_verbalized_understanding: plan.patient_verbalized_understanding,
          copy_given_to_patient: plan.copy_given_to_patient ?? false,
          copy_given_to_family: plan.copy_given_to_family ?? false,
          copy_in_chart: true,
          note: plan.note,
          status: 'current',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update discharge checklist
      await this.updateDischargeChecklistItem(
        plan.patient_id,
        'safety_plan_created',
        true,
        { safety_plan_id: data.id }
      );

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get active safety plan for patient
   */
  static async getActiveSafetyPlan(
    patientId: string
  ): Promise<MentalHealthApiResponse<MentalHealthSafetyPlan | null>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_safety_plans')
        .select('id, fhir_id, created_at, updated_at, status, patient_id, risk_assessment_id, therapy_session_id, type_code, type_display, category, security_label, date, author_type, author_id, author_display, warning_signs, internal_coping_strategies, social_distraction_people, social_distraction_places, people_to_contact, professional_contacts, crisis_hotlines, means_restriction_steps, lethal_means_addressed, scheduled_follow_ups, patient_signature_obtained, patient_signature_date, patient_verbalized_understanding, copy_given_to_patient, copy_given_to_family, copy_in_chart, note, document_url, content_type, created_by, updated_by')
        .eq('patient_id', patientId)
        .eq('status', 'current')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { success: true, data: data || null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // ESCALATIONS
  // ============================================================================

  /**
   * Get active escalations
   */
  static async getActiveEscalations(): Promise<
    MentalHealthApiResponse<MentalHealthEscalation[]>
  > {
    try {
      const { data, error } = await supabase
        .from('mental_health_escalations')
        .select('id, created_at, updated_at, patient_id, risk_assessment_id, therapy_session_id, escalation_level, escalation_reason, trigger_criteria, actions_required, psych_consult_ordered, psych_consult_id, one_to_one_observation_recommended, safety_plan_created, attending_notified, attending_notified_at, attending_notified_by, notifications_sent, status, resolved_at, resolved_by, resolution_note, created_by, updated_by')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Resolve an escalation
   */
  static async resolveEscalation(
    id: string,
    resolutionNote: string
  ): Promise<MentalHealthApiResponse<MentalHealthEscalation>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_escalations')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          resolution_note: resolutionNote,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // FLAGS
  // ============================================================================

  /**
   * Create a clinical flag
   */
  static async createFlag(params: {
    patient_id: string;
    flag_type: string;
    code: string;
    code_display: string;
    severity?: string;
    note?: string;
  }): Promise<MentalHealthApiResponse<MentalHealthFlag>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_flags')
        .insert({
          patient_id: params.patient_id,
          flag_type: params.flag_type,
          code: params.code,
          code_display: params.code_display,
          severity: params.severity || 'medium',
          note: params.note,
          status: 'active',
          show_on_banner: true,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get active flags for patient
   */
  static async getActiveFlags(
    patientId: string
  ): Promise<MentalHealthApiResponse<MentalHealthFlag[]>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_flags')
        .select('id, fhir_id, created_at, updated_at, status, patient_id, category, code_system, code, code_display, period_start, period_end, author_type, author_id, author_display, flag_type, severity, show_on_banner, alert_frequency, note, created_by, updated_by')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Deactivate a flag
   */
  static async deactivateFlag(
    id: string
  ): Promise<MentalHealthApiResponse<MentalHealthFlag>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_flags')
        .update({
          status: 'inactive',
          period_end: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // DISCHARGE CHECKLIST
  // ============================================================================

  /**
   * Create discharge checklist for patient
   */
  static async createDischargeChecklist(
    patientId: string,
    encounterId?: string
  ): Promise<MentalHealthApiResponse<MentalHealthDischargeChecklist>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_discharge_checklist')
        .insert({
          patient_id: patientId,
          encounter_id: encounterId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Update discharge checklist item
   */
  static async updateDischargeChecklistItem(
    patientId: string,
    field: string,
    value: boolean | string | null,
    additionalFields?: Record<string, string | boolean | null>
  ): Promise<MentalHealthApiResponse<MentalHealthDischargeChecklist>> {
    try {
      const updates: Record<string, string | boolean | null | undefined> = {
        [field]: value,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
        ...additionalFields,
      };

      const { data, error } = await supabase
        .from('mental_health_discharge_checklist')
        .update(updates)
        .eq('patient_id', patientId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get discharge checklist for patient
   */
  static async getDischargeChecklist(
    patientId: string
  ): Promise<MentalHealthApiResponse<MentalHealthDischargeChecklist | null>> {
    try {
      const { data, error } = await supabase
        .from('mental_health_discharge_checklist')
        .select('id, created_at, updated_at, patient_id, encounter_id, initial_therapy_session_completed, initial_therapy_session_id, risk_assessment_completed, risk_assessment_id, safety_plan_created, safety_plan_id, outpatient_therapy_scheduled, outpatient_first_appt_date, resources_provided, patient_education_completed, psychiatric_clearance_obtained, psychiatric_clearance_by, psychiatric_clearance_date, family_support_engaged, crisis_plan_provided, all_requirements_met, discharge_cleared, discharge_cleared_by, discharge_cleared_at, override_required, override_granted, override_by, override_reason, override_at, note, created_by, updated_by')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { success: true, data: data || null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get discharge blockers (patients not ready for discharge)
   */
  static async getDischargeBlockers(): Promise<
    MentalHealthApiResponse<DischargeBlocker[]>
  > {
    try {
      const { data, error } = await supabase
        .from('v_mental_health_discharge_blockers')
        .select('patient_id, first_name, last_name, mrn, room_number, service_request_id, session_type, initial_therapy_session_completed, risk_assessment_completed, safety_plan_created, outpatient_therapy_scheduled, all_requirements_met, override_granted, override_reason, active_flags');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(): Promise<
    MentalHealthApiResponse<MentalHealthDashboardSummary>
  > {
    try {
      // Get active patients
      const { data: patients, error: patientsError } = await supabase
        .from('v_active_mental_health_patients')
        .select('patient_id, first_name, last_name, mrn, room_number, service_request_id, service_request_status, session_type, priority, is_discharge_blocker, discharge_blocker_active, risk_level, last_risk_assessment_date, session_status, next_session_scheduled, discharge_ready, active_flag');

      if (patientsError) throw patientsError;

      // Get pending sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('v_pending_mental_health_sessions')
        .select('session_id, patient_id, first_name, last_name, room_number, status, session_type, session_number, is_discharge_required_session, scheduled_start, scheduled_end, therapist, priority, risk_level');

      if (sessionsError) throw sessionsError;

      // Get discharge blockers
      const { data: blockers, error: blockersError } = await supabase
        .from('v_mental_health_discharge_blockers')
        .select('patient_id, first_name, last_name, mrn, room_number, service_request_id, session_type, initial_therapy_session_completed, risk_assessment_completed, safety_plan_created, outpatient_therapy_scheduled, all_requirements_met, override_granted, override_reason, active_flags');

      if (blockersError) throw blockersError;

      // Get today's escalations
      const today = new Date().toISOString().split('T')[0];
      const { data: escalations, error: escalationsError } = await supabase
        .from('mental_health_escalations')
        .select('id')
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);

      if (escalationsError) throw escalationsError;

      // Get today's completed sessions
      const { data: completedSessions, error: completedError } = await supabase
        .from('mental_health_therapy_sessions')
        .select('duration_minutes')
        .eq('status', 'finished')
        .gte('actual_end', `${today}T00:00:00Z`)
        .lte('actual_end', `${today}T23:59:59Z`);

      if (completedError) throw completedError;

      // Calculate metrics
      const riskCounts = patients?.reduce(
        (acc, p) => {
          if (p.risk_level === 'high') acc.high++;
          else if (p.risk_level === 'moderate') acc.moderate++;
          else if (p.risk_level === 'low') acc.low++;
          return acc;
        },
        { high: 0, moderate: 0, low: 0 }
      ) || { high: 0, moderate: 0, low: 0 };

      const avgDuration = completedSessions && completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / completedSessions.length
        : undefined;

      const summary: MentalHealthDashboardSummary = {
        active_patients: patients?.length || 0,
        pending_sessions: sessions?.length || 0,
        discharge_blockers: blockers?.length || 0,
        high_risk_count: riskCounts.high,
        moderate_risk_count: riskCounts.moderate,
        low_risk_count: riskCounts.low,
        escalations_today: escalations?.length || 0,
        sessions_completed_today: completedSessions?.length || 0,
        avg_session_duration_today: avgDuration,
        patients: patients || [],
        pending_sessions_list: sessions || [],
        discharge_blockers_list: blockers || [],
      };

      return { success: true, data: summary };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static getPhq9Severity(score: number): string {
    if (score >= 20) return 'severe';
    if (score >= 15) return 'moderately_severe';
    if (score >= 10) return 'moderate';
    if (score >= 5) return 'mild';
    return 'none';
  }

  private static getGad7Severity(score: number): string {
    if (score >= 15) return 'severe';
    if (score >= 10) return 'moderate';
    if (score >= 5) return 'mild';
    return 'none';
  }

  private static getHigherRisk(risk1: RiskLevel, risk2: RiskLevel): RiskLevel {
    const riskOrder: Record<RiskLevel, number> = {
      high: 3,
      moderate: 2,
      low: 1,
    };
    return riskOrder[risk1] >= riskOrder[risk2] ? risk1 : risk2;
  }
}
