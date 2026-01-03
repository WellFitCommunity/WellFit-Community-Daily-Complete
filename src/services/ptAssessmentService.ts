/**
 * PT Assessment Service
 * Service layer for Physical Therapy Functional Assessments
 *
 * Clinical Standards: ICF Framework, APTA documentation guidelines
 * Compliance: HIPAA, Medicare documentation requirements
 */

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';
import type {
  PTFunctionalAssessment,
  CreatePTAssessmentRequest,
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
 * PT Assessment Service - Main API
 */
export class PTAssessmentService {
  /**
   * Create PT functional assessment
   */
  static async createPTAssessment(
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
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get PT assessments for patient
   */
  static async getPTAssessments(
    patientId: string
  ): Promise<PTApiResponse<PTFunctionalAssessment[]>> {
    try {
      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get specific PT assessment by ID
   */
  static async getPTAssessmentById(
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
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Update existing PT assessment
   */
  static async updatePTAssessment(
    assessmentId: string,
    updates: Partial<PTFunctionalAssessment>
  ): Promise<PTApiResponse<PTFunctionalAssessment>> {
    try {
      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .update(updates)
        .eq('id', assessmentId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
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
      const { data, error } = await supabase.rpc('calculate_functional_improvement', {
        p_patient_id: patientId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get initial evaluation for patient
   */
  static async getInitialEvaluation(
    patientId: string
  ): Promise<PTApiResponse<PTFunctionalAssessment | null>> {
    try {
      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('assessment_type', 'initial_evaluation')
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get discharge evaluation for patient
   */
  static async getDischargeEvaluation(
    patientId: string
  ): Promise<PTApiResponse<PTFunctionalAssessment | null>> {
    try {
      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('assessment_type', 'discharge_evaluation')
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Sign assessment (mark as complete)
   */
  static async signAssessment(
    assessmentId: string
  ): Promise<PTApiResponse<PTFunctionalAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pt_functional_assessments')
        .update({
          signed_by: user.id,
          signed_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
