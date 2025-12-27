/**
 * Physical Therapy Service
 * Enterprise service layer for ICF-based PT workflow system
 *
 * Clinical Standards: APTA Clinical Practice Guidelines, ICF Framework
 * Compliance: HIPAA, SOC2, Medicare 8-minute rule billing
 */

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import type {
  PTFunctionalAssessment,
  PTTreatmentPlan,
  PTTreatmentSession,
  PTHomeExerciseProgram,
  PTOutcomeMeasure,
  PTCaseloadPatient,
  DischargeReadiness,
  CreatePTAssessmentRequest,
  CreateTreatmentPlanRequest,
  RecordTreatmentSessionRequest,
  AssignHEPRequest,
  RecordOutcomeMeasureRequest,
  AttendanceStatus,
} from '../types/physicalTherapy';

/**
 * API Response wrapper for consistent error handling
 */
export interface PTApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Physical Therapy Service - Main API
 */
export class PhysicalTherapyService {
  // ============================================================================
  // FUNCTIONAL ASSESSMENTS
  // ============================================================================

  /**
   * Create PT functional assessment (initial, interim, discharge evaluation)
   */
  static async createAssessment(
    request: CreatePTAssessmentRequest
  ): Promise<PTApiResponse<PTFunctionalAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .insert({
          patient_id: request.patient_id,
          encounter_id: request.encounter_id,
          therapist_id: user.id,
          assessment_type: request.assessment_type,
          assessment_date: request.assessment_date || new Date().toISOString(),
          visit_number: request.visit_number || 1,
          chief_complaint: request.chief_complaint,
          history_present_illness: request.history_present_illness,
          mechanism_of_injury: request.mechanism_of_injury,
          onset_date: request.onset_date,
          onset_type: request.onset_type,
          prior_level_of_function: request.prior_level_of_function,
          comorbidities: request.comorbidities,
          medications_affecting_rehab: request.medications_affecting_rehab,
          surgical_history: request.surgical_history,
          imaging_results: request.imaging_results,
          precautions: request.precautions,
          contraindications: request.contraindications,
          living_situation: request.living_situation,
          home_accessibility: request.home_accessibility,
          support_system: request.support_system,
          transportation_access: request.transportation_access,
          occupation: request.occupation,
          work_demands: request.work_demands,
          hobbies_recreational_activities: request.hobbies_recreational_activities,
          patient_stated_goals: request.patient_stated_goals,
          participation_goals: request.participation_goals,
          cardiovascular_respiratory_findings: request.cardiovascular_respiratory_findings,
          integumentary_findings: request.integumentary_findings,
          musculoskeletal_findings: request.musculoskeletal_findings,
          neuromuscular_findings: request.neuromuscular_findings,
          pain_assessment: request.pain_assessment,
          range_of_motion_data: request.range_of_motion_data,
          muscle_strength_data: request.muscle_strength_data,
          sensory_assessment: request.sensory_assessment,
          reflex_testing: request.reflex_testing,
          special_tests: request.special_tests,
          posture_analysis: request.posture_analysis,
          gait_analysis: request.gait_analysis,
          balance_assessment: request.balance_assessment,
          coordination_assessment: request.coordination_assessment,
          bed_mobility_score: request.bed_mobility_score,
          transfer_ability_score: request.transfer_ability_score,
          ambulation_score: request.ambulation_score,
          stair_negotiation_score: request.stair_negotiation_score,
          outcome_measures: request.outcome_measures,
          primary_diagnosis: request.primary_diagnosis,
          secondary_diagnoses: request.secondary_diagnoses,
          clinical_impression: request.clinical_impression,
          rehab_potential: request.rehab_potential,
          prognosis_narrative: request.prognosis_narrative,
          expected_duration_weeks: request.expected_duration_weeks,
          expected_visit_frequency: request.expected_visit_frequency,
          barriers_to_recovery: request.barriers_to_recovery,
          clinical_reasoning: request.clinical_reasoning,
          evidence_based_rationale: request.evidence_based_rationale,
          video_assessment_url: request.video_assessment_url,
          imaging_links: request.imaging_links,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get PT assessments for a patient
   */
  static async getAssessmentsByPatient(
    patientId: string
  ): Promise<PTApiResponse<PTFunctionalAssessment[]>> {
    try {
      // Limit to 50 PT assessments per patient (scoped to single patient - PAGINATION_LIMITS.ASSESSMENTS)
      const query = supabase
        .from('pt_functional_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      const data = await applyLimit<PTFunctionalAssessment>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get specific assessment by ID
   */
  static async getAssessmentById(
    assessmentId: string
  ): Promise<PTApiResponse<PTFunctionalAssessment>> {
    try {
      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Update existing assessment
   */
  static async updateAssessment(
    assessmentId: string,
    updates: Partial<PTFunctionalAssessment>
  ): Promise<PTApiResponse<PTFunctionalAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // TREATMENT PLANS
  // ============================================================================

  /**
   * Create PT treatment plan with SMART goals
   */
  static async createTreatmentPlan(
    request: CreateTreatmentPlanRequest
  ): Promise<PTApiResponse<PTTreatmentPlan>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .insert({
          patient_id: request.patient_id,
          assessment_id: request.assessment_id,
          care_plan_id: request.care_plan_id,
          therapist_id: user.id,
          status: 'active',
          start_date: request.start_date,
          projected_end_date: request.projected_end_date,
          total_visits_authorized: request.total_visits_authorized,
          visits_used: 0,
          frequency: request.frequency,
          goals: request.goals,
          interventions: request.interventions,
          treatment_approach: request.treatment_approach,
          clinical_practice_guidelines_followed: request.clinical_practice_guidelines_followed,
          hep_prescribed: request.hep_prescribed || false,
          hep_delivery_method: request.hep_delivery_method,
          hep_compliance_tracking: request.hep_compliance_tracking || false,
          discharge_criteria: request.discharge_criteria,
          discharge_destination: request.discharge_destination,
          interdisciplinary_referrals: request.interdisciplinary_referrals,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get active treatment plan for patient
   */
  static async getActiveTreatmentPlan(
    patientId: string
  ): Promise<PTApiResponse<PTTreatmentPlan | null>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get treatment plan by ID
   */
  static async getTreatmentPlanById(
    planId: string
  ): Promise<PTApiResponse<PTTreatmentPlan>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Update goal progress
   */
  static async updateGoalProgress(
    planId: string,
    goalId: string,
    progressPercentage: number
  ): Promise<PTApiResponse<PTTreatmentPlan>> {
    try {
      // Fetch current plan
      const { data: plan, error: fetchError } = await supabase
        .from('pt_treatment_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (fetchError) throw fetchError;
      if (!plan) throw new Error('Treatment plan not found');

      // Update the specific goal
      const updatedGoals = plan.goals.map((goal: any) =>
        goal.goal_id === goalId
          ? { ...goal, progress_percentage: progressPercentage }
          : goal
      );

      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .update({
          goals: updatedGoals,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Evaluate discharge readiness
   */
  static async evaluateDischargeReadiness(
    planId: string
  ): Promise<PTApiResponse<DischargeReadiness>> {
    try {
      const { data, error } = await supabase.rpc('evaluate_pt_discharge_readiness', {
        p_plan_id: planId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // TREATMENT SESSIONS (SOAP NOTES)
  // ============================================================================

  /**
   * Record PT treatment session (SOAP note)
   */
  static async recordSession(
    request: RecordTreatmentSessionRequest
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate billable units using 8-minute rule
      const totalTimedMinutes = request.interventions_delivered.reduce(
        (sum, intervention) => sum + intervention.time_spent_minutes,
        0
      );
      const billableUnits = this.calculate8MinuteRuleUnits(totalTimedMinutes);

      // Extract CPT codes
      const cptCodesBilled = [
        ...new Set(request.interventions_delivered.map(i => i.cpt_code)),
      ];

      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .insert({
          patient_id: request.patient_id,
          treatment_plan_id: request.treatment_plan_id,
          encounter_id: request.encounter_id,
          therapist_id: user.id,
          session_date: request.session_date,
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

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get sessions for a treatment plan
   */
  static async getSessionsByTreatmentPlan(
    planId: string
  ): Promise<PTApiResponse<PTTreatmentSession[]>> {
    try {
      // Limit to 50 sessions per treatment plan (scoped to single plan - reasonable for typical PT episode)
      const query = supabase
        .from('pt_treatment_sessions')
        .select('*')
        .eq('treatment_plan_id', planId)
        .order('session_date', { ascending: false });

      const data = await applyLimit<PTTreatmentSession>(query, 50);
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Calculate billable units using Medicare 8-minute rule
   * 8-22 min = 1 unit, 23-37 min = 2 units, 38-52 min = 3 units, etc.
   */
  static calculate8MinuteRuleUnits(totalMinutes: number): number {
    if (totalMinutes < 8) return 0;
    if (totalMinutes <= 22) return 1;
    return Math.floor((totalMinutes - 8) / 15) + 1;
  }

  /**
   * Request co-signature (for PTAs)
   */
  static async requestCoSignature(
    sessionId: string,
    supervisorId: string
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .update({
          co_sign_requested: true,
          co_sign_requested_from: supervisorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Co-sign session (for supervising PTs)
   */
  static async coSignSession(
    sessionId: string
  ): Promise<PTApiResponse<PTTreatmentSession>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pt_treatment_sessions')
        .update({
          co_signed_by: user.id,
          co_signed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // HOME EXERCISE PROGRAMS
  // ============================================================================

  /**
   * Assign Home Exercise Program to patient
   */
  static async assignHEP(
    request: AssignHEPRequest
  ): Promise<PTApiResponse<PTHomeExerciseProgram>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pt_home_exercise_programs')
        .insert({
          patient_id: request.patient_id,
          treatment_plan_id: request.treatment_plan_id,
          therapist_id: user.id,
          program_name: request.program_name,
          prescribed_date: new Date().toISOString(),
          active: true,
          exercises: request.exercises,
          overall_instructions: request.overall_instructions,
          frequency_guidance: request.frequency_guidance,
          time_of_day_recommendation: request.time_of_day_recommendation,
          expected_duration_minutes: request.expected_duration_minutes,
          patient_tracking_enabled: request.patient_tracking_enabled || false,
          delivery_method: request.delivery_method,
          patient_acknowledged: false,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get active HEP for patient
   */
  static async getActiveHEP(
    patientId: string
  ): Promise<PTApiResponse<PTHomeExerciseProgram | null>> {
    try {
      const { data, error } = await supabase
        .from('pt_home_exercise_programs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('active', true)
        .order('prescribed_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // OUTCOME MEASURES
  // ============================================================================

  /**
   * Record outcome measure (LEFS, ODI, DASH, etc.)
   */
  static async recordOutcomeMeasure(
    request: RecordOutcomeMeasureRequest
  ): Promise<PTApiResponse<PTOutcomeMeasure>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get previous score if exists
      const { data: previousScores } = await supabase
        .from('pt_outcome_measures')
        .select('raw_score')
        .eq('patient_id', request.patient_id)
        .eq('measure_acronym', request.measure_acronym)
        .order('administration_date', { ascending: false })
        .limit(1);

      const previousScore = previousScores?.[0]?.raw_score;
      const changeFromPrevious = previousScore
        ? request.raw_score - previousScore
        : null;

      const { data, error } = await supabase
        .from('pt_outcome_measures')
        .insert({
          patient_id: request.patient_id,
          therapist_id: user.id,
          assessment_id: request.assessment_id,
          session_id: request.session_id,
          measure_name: request.measure_name,
          measure_acronym: request.measure_acronym,
          body_region: request.body_region,
          mcid: request.mcid,
          mdm: request.mdm,
          administration_date: request.administration_date,
          administration_context: request.administration_context,
          raw_score: request.raw_score,
          percentage_score: request.percentage_score,
          interpretation: request.interpretation,
          previous_score: previousScore,
          change_from_previous: changeFromPrevious,
          mcid_achieved: request.mcid && changeFromPrevious
            ? Math.abs(changeFromPrevious) >= request.mcid
            : null,
          tool_validation_reference: request.tool_validation_reference,
          normative_data_reference: request.normative_data_reference,
          digital_form_used: request.digital_form_used || false,
          auto_calculated: request.auto_calculated || false,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get outcome measures for patient
   */
  static async getOutcomeMeasures(
    patientId: string,
    measureAcronym?: string
  ): Promise<PTApiResponse<PTOutcomeMeasure[]>> {
    try {
      // Limit to 50 outcome measures per patient (scoped to single patient - PAGINATION_LIMITS.ASSESSMENTS)
      let query = supabase
        .from('pt_outcome_measures')
        .select('*')
        .eq('patient_id', patientId);

      if (measureAcronym) {
        query = query.eq('measure_acronym', measureAcronym);
      }

      query = query.order('administration_date', { ascending: false });

      const data = await applyLimit<PTOutcomeMeasure>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // DASHBOARD & REPORTING
  // ============================================================================

  /**
   * Get therapist's active caseload
   */
  static async getTherapistCaseload(
    therapistId: string
  ): Promise<PTApiResponse<PTCaseloadPatient[]>> {
    try {
      const { data, error } = await supabase.rpc('get_pt_therapist_caseload', {
        p_therapist_id: therapistId,
      });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Calculate functional improvement between assessments
   */
  static async calculateFunctionalImprovement(
    patientId: string
  ): Promise<PTApiResponse<number>> {
    try {
      const { data, error } = await supabase.rpc('calculate_pt_functional_improvement', {
        p_patient_id: patientId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
