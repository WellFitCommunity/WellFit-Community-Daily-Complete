/**
 * NeuroSuite Service
 * Enterprise service layer for Stroke & Dementia Care System
 *
 * Clinical Standards: NIH Stroke Scale, Modified Rankin Scale, MoCA, MMSE, CDR
 * Compliance: HIPAA, SOC2, Joint Commission stroke certification
 */

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess } from './phiAccessLogger';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import type {
  StrokeAssessment,
  ModifiedRankinScale,
  BarthelIndex,
  CognitiveAssessment,
  DementiaStaging,
  CaregiverAssessment,
  NeuroCarePlan,
  StrokeRiskAssessment,
  FallRiskAssessment,
  CognitiveDeclineTrajectory,
  CreateStrokeAssessmentRequest,
  CreateCognitiveAssessmentRequest,
  CreateCaregiverAssessmentRequest,
  NIHSSSeverity,
  BurdenLevel,
  DementiaStage,
  CDRScore,
} from '../types/neuroSuite';

/**
 * API Response wrapper for consistent error handling
 */
export interface NeuroApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * NeuroSuite Service - Main API
 */
export class NeuroSuiteService {
  // ============================================================================
  // STROKE ASSESSMENTS (NIH Stroke Scale)
  // ============================================================================

  /**
   * Create stroke assessment (baseline, 24hr, discharge, 90-day)
   */
  static async createStrokeAssessment(
    request: CreateStrokeAssessmentRequest
  ): Promise<NeuroApiResponse<StrokeAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // HIPAA §164.312(b): Log PHI access
      await logPhiAccess({
        phiType: 'assessment',
        phiResourceId: `stroke_assessment_${request.patient_id}`,
        patientId: request.patient_id,
        accessType: 'create',
        accessMethod: 'API',
        purpose: 'treatment',
      });

      // Calculate NIHSS total score
      const nihssTotal = this.calculateNIHSS({
        loc_score: request.loc_score || 0,
        loc_questions_score: request.loc_questions_score || 0,
        loc_commands_score: request.loc_commands_score || 0,
        best_gaze_score: request.best_gaze_score || 0,
        visual_fields_score: request.visual_fields_score || 0,
        facial_palsy_score: request.facial_palsy_score || 0,
        left_arm_motor_score: request.left_arm_motor_score || 0,
        right_arm_motor_score: request.right_arm_motor_score || 0,
        left_leg_motor_score: request.left_leg_motor_score || 0,
        right_leg_motor_score: request.right_leg_motor_score || 0,
        limb_ataxia_score: request.limb_ataxia_score || 0,
        sensory_score: request.sensory_score || 0,
        best_language_score: request.best_language_score || 0,
        dysarthria_score: request.dysarthria_score || 0,
        extinction_inattention_score: request.extinction_inattention_score || 0,
      });

      // Calculate severity interpretation
      const nihssSeverity = this.interpretNIHSS(nihssTotal);

      // Check tPA eligibility (must be <4.5 hours from symptom onset)
      const tpaEligible = request.symptom_onset && request.assessment_date
        ? this.isTpaEligible(request.symptom_onset, request.assessment_date)
        : false;

      const { data, error } = await supabase
        .from('neuro_stroke_assessments')
        .insert({
          patient_id: request.patient_id,
          encounter_id: request.encounter_id,
          assessor_id: user.id,
          assessment_date: request.assessment_date || new Date().toISOString(),
          assessment_type: request.assessment_type,
          stroke_type: request.stroke_type,
          stroke_territory: request.stroke_territory,
          last_known_well: request.last_known_well,
          symptom_onset: request.symptom_onset,
          arrival_time: request.arrival_time,
          ct_time: request.ct_time,
          time_to_assessment_minutes: request.time_to_assessment_minutes,
          loc_score: request.loc_score,
          loc_questions_score: request.loc_questions_score,
          loc_commands_score: request.loc_commands_score,
          best_gaze_score: request.best_gaze_score,
          visual_fields_score: request.visual_fields_score,
          facial_palsy_score: request.facial_palsy_score,
          left_arm_motor_score: request.left_arm_motor_score,
          right_arm_motor_score: request.right_arm_motor_score,
          left_leg_motor_score: request.left_leg_motor_score,
          right_leg_motor_score: request.right_leg_motor_score,
          limb_ataxia_score: request.limb_ataxia_score,
          sensory_score: request.sensory_score,
          best_language_score: request.best_language_score,
          dysarthria_score: request.dysarthria_score,
          extinction_inattention_score: request.extinction_inattention_score,
          nihss_total_score: nihssTotal,
          nihss_severity: nihssSeverity,
          tpa_eligible: tpaEligible,
          tpa_administered: request.tpa_administered,
          tpa_bolus_time: request.tpa_bolus_time,
          thrombectomy_eligible: request.thrombectomy_eligible,
          thrombectomy_performed: request.thrombectomy_performed,
          groin_puncture_time: request.groin_puncture_time,
          recanalization_time: request.recanalization_time,
          clinical_notes: request.clinical_notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate NIHSS total score (0-42)
   */
  static calculateNIHSS(scores: {
    loc_score: number;
    loc_questions_score: number;
    loc_commands_score: number;
    best_gaze_score: number;
    visual_fields_score: number;
    facial_palsy_score: number;
    left_arm_motor_score: number;
    right_arm_motor_score: number;
    left_leg_motor_score: number;
    right_leg_motor_score: number;
    limb_ataxia_score: number;
    sensory_score: number;
    best_language_score: number;
    dysarthria_score: number;
    extinction_inattention_score: number;
  }): number {
    return Object.values(scores).reduce((sum, score) => sum + score, 0);
  }

  /**
   * Interpret NIHSS severity
   */
  static interpretNIHSS(score: number): NIHSSSeverity {
    if (score === 0) return 'no_stroke';
    if (score <= 4) return 'minor_stroke';
    if (score <= 15) return 'moderate_stroke';
    if (score <= 20) return 'moderate_severe_stroke';
    return 'severe_stroke';
  }

  /**
   * Check tPA eligibility based on symptom onset time
   * tPA must be given within 4.5 hours (270 minutes) of symptom onset
   */
  static isTpaEligible(symptomOnset: string, assessmentDate: string): boolean {
    const onset = new Date(symptomOnset);
    const assessment = new Date(assessmentDate);
    const diffMinutes = (assessment.getTime() - onset.getTime()) / 60000;
    return diffMinutes <= 270; // 4.5 hours = 270 minutes
  }

  /**
   * Calculate door-to-needle time (quality metric)
   */
  static async calculateDoorToNeedleTime(
    assessmentId: string
  ): Promise<NeuroApiResponse<number>> {
    try {
      const { data: assessment, error } = await supabase
        .from('neuro_stroke_assessments')
        .select('arrival_time, tpa_bolus_time')
        .eq('id', assessmentId)
        .single();

      if (error) throw error;
      if (!assessment.arrival_time || !assessment.tpa_bolus_time) {
        throw new Error('Missing arrival or tPA bolus time');
      }

      const arrival = new Date(assessment.arrival_time);
      const tpaTime = new Date(assessment.tpa_bolus_time);
      const diffMinutes = (tpaTime.getTime() - arrival.getTime()) / 60000;

      return { success: true, data: diffMinutes };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get stroke assessments for patient
   */
  static async getStrokeAssessmentsByPatient(
    patientId: string
  ): Promise<NeuroApiResponse<StrokeAssessment[]>> {
    try {
      // Limit to 50 stroke assessments per patient (scoped to single patient - PAGINATION_LIMITS.ASSESSMENTS)
      const query = supabase
        .from('neuro_stroke_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      const data = await applyLimit<StrokeAssessment>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // MODIFIED RANKIN SCALE (mRS) - Stroke Outcomes
  // ============================================================================

  /**
   * Create Modified Rankin Scale assessment
   */
  static async createMRS(
    patientId: string,
    strokeAssessmentId: string | undefined,
    mrsScore: number,
    timepoint: 'pre_stroke' | 'discharge' | '90_day' | '6_month' | '1_year' | 'annual',
    functionalDescription?: string
  ): Promise<NeuroApiResponse<ModifiedRankinScale>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('neuro_modified_rankin_scale')
        .insert({
          patient_id: patientId,
          stroke_assessment_id: strokeAssessmentId,
          assessor_id: user.id,
          assessment_date: new Date().toISOString(),
          assessment_timepoint: timepoint,
          mrs_score: mrsScore,
          functional_description: functionalDescription,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get 90-day mRS outcome (primary stroke endpoint)
   */
  static async get90DayOutcome(
    patientId: string
  ): Promise<NeuroApiResponse<ModifiedRankinScale | null>> {
    try {
      // Already has .limit(1) - this is properly bounded
      const { data, error } = await supabase
        .from('neuro_modified_rankin_scale')
        .select('*')
        .eq('patient_id', patientId)
        .eq('assessment_timepoint', '90_day')
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // COGNITIVE ASSESSMENTS (MoCA, MMSE, SLUMS)
  // ============================================================================

  /**
   * Create cognitive assessment (MoCA, MMSE, or SLUMS)
   */
  static async createCognitiveAssessment(
    request: CreateCognitiveAssessmentRequest
  ): Promise<NeuroApiResponse<CognitiveAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate total scores based on assessment tool
      let totalScore = 0;
      let educationAdjustmentApplied = false;

      if (request.assessment_tool === 'MoCA') {
        totalScore =
          (request.moca_visuospatial || 0) +
          (request.moca_naming || 0) +
          (request.moca_attention || 0) +
          (request.moca_language || 0) +
          (request.moca_abstraction || 0) +
          (request.moca_delayed_recall || 0) +
          (request.moca_orientation || 0);

        // Apply education adjustment (add 1 point if ≤12 years education)
        if (request.years_education && request.years_education <= 12) {
          totalScore += 1;
          educationAdjustmentApplied = true;
        }
      } else if (request.assessment_tool === 'MMSE') {
        totalScore =
          (request.mmse_orientation_time || 0) +
          (request.mmse_orientation_place || 0) +
          (request.mmse_registration || 0) +
          (request.mmse_attention_calculation || 0) +
          (request.mmse_recall || 0) +
          (request.mmse_naming || 0) +
          (request.mmse_repetition || 0) +
          (request.mmse_comprehension || 0) +
          (request.mmse_reading || 0) +
          (request.mmse_writing || 0) +
          (request.mmse_drawing || 0);
      }

      // Determine cognitive status
      const cognitiveStatus = this.interpretCognitiveScore(
        request.assessment_tool,
        totalScore
      );

      const { data, error } = await supabase
        .from('neuro_cognitive_assessments')
        .insert({
          patient_id: request.patient_id,
          assessor_id: user.id,
          encounter_id: request.encounter_id,
          assessment_date: request.assessment_date || new Date().toISOString(),
          assessment_tool: request.assessment_tool,
          years_education: request.years_education,
          education_adjustment_applied: educationAdjustmentApplied,
          moca_visuospatial: request.moca_visuospatial,
          moca_naming: request.moca_naming,
          moca_attention: request.moca_attention,
          moca_language: request.moca_language,
          moca_abstraction: request.moca_abstraction,
          moca_delayed_recall: request.moca_delayed_recall,
          moca_orientation: request.moca_orientation,
          moca_total_score: request.assessment_tool === 'MoCA' ? totalScore : null,
          mmse_orientation_time: request.mmse_orientation_time,
          mmse_orientation_place: request.mmse_orientation_place,
          mmse_registration: request.mmse_registration,
          mmse_attention_calculation: request.mmse_attention_calculation,
          mmse_recall: request.mmse_recall,
          mmse_naming: request.mmse_naming,
          mmse_repetition: request.mmse_repetition,
          mmse_comprehension: request.mmse_comprehension,
          mmse_reading: request.mmse_reading,
          mmse_writing: request.mmse_writing,
          mmse_drawing: request.mmse_drawing,
          mmse_total_score: request.assessment_tool === 'MMSE' ? totalScore : null,
          cognitive_status: cognitiveStatus,
          concerns_noted: request.concerns_noted,
          behavioral_observations: request.behavioral_observations,
          informant_report: request.informant_report,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Interpret cognitive score
   */
  static interpretCognitiveScore(tool: string, score: number): string {
    if (tool === 'MoCA') {
      // MoCA: ≥26 = normal, 18-25 = MCI, <18 = dementia
      if (score >= 26) return 'Normal cognition';
      if (score >= 18) return 'Mild Cognitive Impairment (MCI)';
      return 'Cognitive impairment consistent with dementia';
    } else if (tool === 'MMSE') {
      // MMSE: ≥24 = normal, 18-23 = mild, 10-17 = moderate, <10 = severe
      if (score >= 24) return 'Normal cognition';
      if (score >= 18) return 'Mild cognitive impairment';
      if (score >= 10) return 'Moderate cognitive impairment';
      return 'Severe cognitive impairment';
    }
    return 'Assessment pending interpretation';
  }

  /**
   * Get cognitive assessment history for patient
   */
  static async getCognitiveAssessmentHistory(
    patientId: string
  ): Promise<NeuroApiResponse<CognitiveAssessment[]>> {
    try {
      // Limit to 50 cognitive assessments per patient (scoped to single patient - PAGINATION_LIMITS.ASSESSMENTS)
      const query = supabase
        .from('neuro_cognitive_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      const data = await applyLimit<CognitiveAssessment>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate cognitive decline rate
   */
  static async calculateCognitiveDeclineRate(
    patientId: string
  ): Promise<NeuroApiResponse<CognitiveDeclineTrajectory>> {
    try {
      const { data, error } = await supabase.rpc('calculate_cognitive_decline_rate', {
        p_patient_id: patientId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // DEMENTIA STAGING (CDR Scale)
  // ============================================================================

  /**
   * Create dementia staging assessment (Clinical Dementia Rating)
   */
  static async createDementiaStaging(
    patientId: string,
    cdrScores: {
      memory: CDRScore;
      orientation: CDRScore;
      judgment: CDRScore;
      community: CDRScore;
      home: CDRScore;
      personal_care: CDRScore;
    },
    informantName?: string,
    informantRelationship?: string,
    functionalDeclineExamples?: string
  ): Promise<NeuroApiResponse<DementiaStaging>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate CDR global score using algorithm (memory is weighted most)
      const cdrGlobalScore = this.calculateCDRGlobal(cdrScores);

      // Calculate sum of boxes (0-18)
      const cdrSumBoxes =
        cdrScores.memory +
        cdrScores.orientation +
        cdrScores.judgment +
        cdrScores.community +
        cdrScores.home +
        cdrScores.personal_care;

      // Determine dementia stage
      const dementiaStage = this.interpretCDRStage(cdrGlobalScore);

      const { data, error } = await supabase
        .from('neuro_dementia_staging')
        .insert({
          patient_id: patientId,
          assessor_id: user.id,
          assessment_date: new Date().toISOString(),
          cdr_memory: cdrScores.memory,
          cdr_orientation: cdrScores.orientation,
          cdr_judgment_problem_solving: cdrScores.judgment,
          cdr_community_affairs: cdrScores.community,
          cdr_home_hobbies: cdrScores.home,
          cdr_personal_care: cdrScores.personal_care,
          cdr_global_score: cdrGlobalScore,
          cdr_sum_boxes: cdrSumBoxes,
          dementia_stage: dementiaStage,
          informant_name: informantName,
          informant_relationship: informantRelationship,
          functional_decline_examples: functionalDeclineExamples,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate CDR Global Score using algorithm
   * Memory is weighted most heavily
   */
  static calculateCDRGlobal(scores: {
    memory: CDRScore;
    orientation: CDRScore;
    judgment: CDRScore;
    community: CDRScore;
    home: CDRScore;
    personal_care: CDRScore;
  }): CDRScore {
    // Simplified algorithm: if memory and ≥3 other domains are same score, use that
    // Otherwise use memory score as primary driver
    const otherScores = [
      scores.orientation,
      scores.judgment,
      scores.community,
      scores.home,
      scores.personal_care,
    ];

    const matchingMemory = otherScores.filter(s => s === scores.memory).length;
    if (matchingMemory >= 3) return scores.memory;

    // Otherwise, use memory as primary with secondary consideration
    return scores.memory;
  }

  /**
   * Interpret CDR stage
   */
  static interpretCDRStage(cdrScore: CDRScore): DementiaStage {
    if (cdrScore === 0) return 'no_dementia';
    if (cdrScore === 0.5) return 'questionable_dementia_mci';
    if (cdrScore === 1) return 'mild_dementia';
    if (cdrScore === 2) return 'moderate_dementia';
    return 'severe_dementia';
  }

  /**
   * Get dementia staging history
   */
  static async getDementiaStagingHistory(
    patientId: string
  ): Promise<NeuroApiResponse<DementiaStaging[]>> {
    try {
      // Limit to 50 dementia staging assessments per patient (scoped to single patient - PAGINATION_LIMITS.ASSESSMENTS)
      const query = supabase
        .from('neuro_dementia_staging')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      const data = await applyLimit<DementiaStaging>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // CAREGIVER BURDEN ASSESSMENT (Zarit)
  // ============================================================================

  /**
   * Create caregiver burden assessment (Zarit Burden Interview)
   */
  static async createCaregiverAssessment(
    request: CreateCaregiverAssessmentRequest
  ): Promise<NeuroApiResponse<CaregiverAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate Zarit total score (12 items, 0-4 each = 0-48 total)
      const zbiTotalScore =
        (request.zbi_feel_strain || 0) +
        (request.zbi_time_affected || 0) +
        (request.zbi_stressed || 0) +
        (request.zbi_embarrassed || 0) +
        (request.zbi_angry || 0) +
        (request.zbi_relationships_affected || 0) +
        (request.zbi_health_suffered || 0) +
        (request.zbi_privacy_affected || 0) +
        (request.zbi_social_life_affected || 0) +
        (request.zbi_lost_control || 0) +
        (request.zbi_uncertain_what_to_do || 0) +
        (request.zbi_should_do_more || 0);

      // Determine burden level
      const burdenLevel = this.interpretZaritBurden(zbiTotalScore);

      const { data, error } = await supabase
        .from('neuro_caregiver_assessments')
        .insert({
          patient_id: request.patient_id,
          caregiver_id: request.caregiver_id,
          assessor_id: user.id,
          assessment_date: new Date().toISOString(),
          caregiver_name: request.caregiver_name,
          caregiver_relationship: request.caregiver_relationship,
          caregiver_lives_with_patient: request.caregiver_lives_with_patient,
          hours_caregiving_per_week: request.hours_caregiving_per_week,
          other_caregivers_available: request.other_caregivers_available,
          zbi_feel_strain: request.zbi_feel_strain,
          zbi_time_affected: request.zbi_time_affected,
          zbi_stressed: request.zbi_stressed,
          zbi_embarrassed: request.zbi_embarrassed,
          zbi_angry: request.zbi_angry,
          zbi_relationships_affected: request.zbi_relationships_affected,
          zbi_health_suffered: request.zbi_health_suffered,
          zbi_privacy_affected: request.zbi_privacy_affected,
          zbi_social_life_affected: request.zbi_social_life_affected,
          zbi_lost_control: request.zbi_lost_control,
          zbi_uncertain_what_to_do: request.zbi_uncertain_what_to_do,
          zbi_should_do_more: request.zbi_should_do_more,
          zbi_total_score: zbiTotalScore,
          burden_level: burdenLevel,
          respite_care_needed: request.respite_care_needed,
          support_group_interest: request.support_group_interest,
          counseling_needed: request.counseling_needed,
          financial_assistance_needed: request.financial_assistance_needed,
          caregiver_concerns: request.caregiver_concerns,
          interventions_recommended: request.interventions_recommended,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Interpret Zarit burden score
   */
  static interpretZaritBurden(score: number): BurdenLevel {
    if (score <= 20) return 'little_no_burden';
    if (score <= 40) return 'mild_moderate_burden';
    return 'moderate_severe_burden';
  }

  /**
   * Get caregiver burden history
   */
  static async getCaregiverBurdenHistory(
    patientId: string
  ): Promise<NeuroApiResponse<CaregiverAssessment[]>> {
    try {
      // Limit to 50 caregiver assessments per patient (scoped to single patient - PAGINATION_LIMITS.ASSESSMENTS)
      const query = supabase
        .from('neuro_caregiver_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      const data = await applyLimit<CaregiverAssessment>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Identify high-burden caregivers (for proactive intervention)
   */
  static async identifyHighBurdenCaregivers(): Promise<
    NeuroApiResponse<CaregiverAssessment[]>
  > {
    try {
      const { data, error } = await supabase.rpc('identify_high_burden_caregivers');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // NEURO CARE PLANS
  // ============================================================================

  /**
   * Create neuro care plan (stroke or dementia)
   */
  static async createNeuroCarePlan(
    patientId: string,
    carePlanType: 'acute_stroke' | 'stroke_rehab' | 'stroke_secondary_prevention' | 'dementia_early_stage' | 'dementia_moderate_stage' | 'dementia_advanced_stage' | 'mci_monitoring',
    options?: {
      strokePreventionMeds?: any;
      cognitiveActivities?: any;
      behavioralStrategies?: any;
      safetyInterventions?: any;
      followUpSchedule?: any;
    }
  ): Promise<NeuroApiResponse<NeuroCarePlan>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('neuro_care_plans')
        .insert({
          patient_id: patientId,
          care_plan_type: carePlanType,
          status: 'active',
          start_date: new Date().toISOString(),
          stroke_prevention_medications: options?.strokePreventionMeds,
          cognitive_stimulation_activities: options?.cognitiveActivities,
          behavioral_management_strategies: options?.behavioralStrategies,
          safety_interventions: options?.safetyInterventions,
          follow_up_schedule: options?.followUpSchedule,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get active care plan for patient
   */
  static async getActiveCarePlan(
    patientId: string
  ): Promise<NeuroApiResponse<NeuroCarePlan | null>> {
    try {
      // Already has .limit(1) - this is properly bounded
      const { data, error } = await supabase
        .from('neuro_care_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // DASHBOARD & ANALYTICS
  // ============================================================================

  /**
   * Get active stroke patients for neurologist
   */
  static async getActiveStrokePatients(
    neurologistId: string
  ): Promise<NeuroApiResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_active_stroke_patients', {
        p_neurologist_id: neurologistId,
      });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get dementia patients needing reassessment
   */
  static async getDementiaPatientsNeedingReassessment(): Promise<
    NeuroApiResponse<any[]>
  > {
    try {
      const { data, error } = await supabase.rpc(
        'get_dementia_patients_due_for_assessment'
      );

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate stroke outcome improvement
   */
  static async calculateStrokeOutcomeImprovement(
    patientId: string
  ): Promise<NeuroApiResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('calculate_stroke_outcome_improvement', {
        p_patient_id: patientId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }
}
