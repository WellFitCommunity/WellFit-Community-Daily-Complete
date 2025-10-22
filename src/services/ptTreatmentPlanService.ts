/**
 * PT Treatment Plan Service
 * Service layer for SMART goal-based treatment plans
 *
 * Clinical Standards: SMART goals, evidence-based interventions
 * Compliance: HIPAA, Medicare visit authorization tracking
 */

import { supabase } from '../lib/supabaseClient';
import type {
  PTTreatmentPlan,
  CreateTreatmentPlanRequest,
  DischargeReadiness,
  SMARTGoal,
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
 * PT Treatment Plan Service - Main API
 */
export class PTTreatmentPlanService {
  /**
   * Create new treatment plan
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
    } catch (error: any) {
      console.error('PTTreatmentPlanService.createTreatmentPlan error:', error);
      return { success: false, error: error.message };
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
    } catch (error: any) {
      console.error('PTTreatmentPlanService.getActiveTreatmentPlan error:', error);
      return { success: false, error: error.message };
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
    } catch (error: any) {
      console.error('PTTreatmentPlanService.getTreatmentPlanById error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all treatment plans for patient
   */
  static async getTreatmentPlans(
    patientId: string
  ): Promise<PTApiResponse<PTTreatmentPlan[]>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.getTreatmentPlans error:', error);
      return { success: false, error: error.message };
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
      // Get current plan
      const { data: plan, error: fetchError } = await supabase
        .from('pt_treatment_plans')
        .select('goals')
        .eq('id', planId)
        .single();

      if (fetchError) throw fetchError;

      // Update the specific goal
      const updatedGoals = (plan.goals as SMARTGoal[]).map((goal: SMARTGoal) => {
        if (goal.goal_id === goalId) {
          return {
            ...goal,
            progress_percentage: progressPercentage,
            achieved: progressPercentage >= 100,
            achieved_date: progressPercentage >= 100 ? new Date().toISOString() : goal.achieved_date,
          };
        }
        return goal;
      });

      // Update the plan
      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .update({ goals: updatedGoals })
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.updateGoalProgress error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if patient ready for discharge
   */
  static async evaluateDischargeReadiness(
    planId: string
  ): Promise<PTApiResponse<DischargeReadiness>> {
    try {
      const { data, error } = await supabase.rpc('evaluate_discharge_readiness', {
        p_plan_id: planId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.evaluateDischargeReadiness error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get treatment plan with sessions included
   */
  static async getTreatmentPlanWithSessions(
    planId: string
  ): Promise<PTApiResponse<any>> {
    try {
      const { data: plan, error: planError } = await supabase
        .from('pt_treatment_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError) throw planError;

      const { data: sessions, error: sessionsError } = await supabase
        .from('pt_treatment_sessions')
        .select('*')
        .eq('treatment_plan_id', planId)
        .order('session_date', { ascending: false });

      if (sessionsError) throw sessionsError;

      return {
        success: true,
        data: {
          ...plan,
          sessions: sessions || [],
        },
      };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.getTreatmentPlanWithSessions error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Increment visits used (manual adjustment - normally done by trigger)
   */
  static async incrementVisitsUsed(
    planId: string
  ): Promise<PTApiResponse<PTTreatmentPlan>> {
    try {
      const { data, error } = await supabase.rpc('increment_visits_used', {
        p_plan_id: planId,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.incrementVisitsUsed error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update treatment plan status
   */
  static async updatePlanStatus(
    planId: string,
    status: 'active' | 'on_hold' | 'modified' | 'completed' | 'discontinued'
  ): Promise<PTApiResponse<PTTreatmentPlan>> {
    try {
      const updates: any = { status };

      if (status === 'completed' || status === 'discontinued') {
        updates.actual_end_date = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .update(updates)
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.updatePlanStatus error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update treatment plan
   */
  static async updateTreatmentPlan(
    planId: string,
    updates: Partial<PTTreatmentPlan>
  ): Promise<PTApiResponse<PTTreatmentPlan>> {
    try {
      const { data, error } = await supabase
        .from('pt_treatment_plans')
        .update(updates)
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('PTTreatmentPlanService.updateTreatmentPlan error:', error);
      return { success: false, error: error.message };
    }
  }
}
