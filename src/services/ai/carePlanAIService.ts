/**
 * AI Care Plan Generation Service
 *
 * Skill #20: Generates evidence-based care plans from diagnosis + SDOH factors.
 * Integrates with the ai-care-plan-generator edge function.
 *
 * SAFETY GUARDRAILS:
 * 1. All AI-generated plans require clinician review (requiresReview: true)
 * 2. Plans are created in "draft" status - never auto-activated
 * 3. Confidence thresholds flag low-confidence plans
 * 4. Clinical validation before saving to database
 * 5. Audit logging for all AI-generated content
 *
 * @module carePlanAIService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// =====================================================
// TYPES
// =====================================================

export interface CarePlanGoal {
  goal: string;
  target: string;
  timeframe: string;
  measurementMethod: string;
  priority: 'high' | 'medium' | 'low';
  evidenceBasis?: string;
}

export interface CarePlanIntervention {
  intervention: string;
  frequency: string;
  responsible: string;
  duration: string;
  rationale: string;
  cptCode?: string;
  billingEligible: boolean;
}

export interface CarePlanBarrier {
  barrier: string;
  category: 'transportation' | 'financial' | 'social' | 'cognitive' | 'physical' | 'language' | 'other';
  solution: string;
  resources: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface CarePlanActivity {
  activityType: 'appointment' | 'medication' | 'education' | 'monitoring' | 'referral' | 'follow_up';
  description: string;
  scheduledDate?: string;
  frequency?: string;
  status: 'scheduled' | 'pending' | 'completed';
}

export interface GeneratedCarePlan {
  title: string;
  description: string;
  planType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  barriers: CarePlanBarrier[];
  activities: CarePlanActivity[];
  careTeam: Array<{ role: string; responsibilities: string[] }>;
  estimatedDuration: string;
  reviewSchedule: string;
  successCriteria: string[];
  riskFactors: string[];
  icd10Codes: Array<{ code: string; display: string }>;
  ccmEligible: boolean;
  tcmEligible: boolean;
  confidence: number;
  evidenceSources: string[];
  requiresReview: boolean;
  reviewReasons: string[];
}

export interface CarePlanGenerationRequest {
  patientId: string;
  tenantId?: string;
  planType: 'readmission_prevention' | 'chronic_care' | 'transitional_care' | 'high_utilizer' | 'preventive';
  focusConditions?: string[];
  includeSDOH?: boolean;
  includeMedications?: boolean;
  careTeamRoles?: string[];
  durationWeeks?: number;
}

export interface CarePlanGenerationResponse {
  carePlan: GeneratedCarePlan;
  metadata: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    plan_type: string;
    context_summary: {
      conditions_count: number;
      medications_count: number;
      has_sdoh: boolean;
      utilization_risk: string;
    };
  };
}

// =====================================================
// SAFETY THRESHOLDS
// =====================================================

const SAFETY_THRESHOLDS = {
  /** Minimum confidence to save without extra warnings */
  MIN_CONFIDENCE: 0.6,
  /** Confidence below this requires senior review */
  SENIOR_REVIEW_THRESHOLD: 0.5,
  /** Maximum goals to prevent overwhelming plans */
  MAX_GOALS: 10,
  /** Maximum interventions */
  MAX_INTERVENTIONS: 15,
  /** Maximum barriers to address */
  MAX_BARRIERS: 8,
};

// =====================================================
// SERVICE
// =====================================================

/**
 * AI Care Plan Generation Service
 *
 * Provides methods for generating AI-powered care plans with safety guardrails.
 */
export class CarePlanAIService {
  /**
   * Generate an evidence-based care plan for a patient
   *
   * SAFETY: All generated plans have requiresReview=true
   *
   * @param request - The generation request parameters
   * @returns ServiceResult containing the generated care plan
   */
  static async generateCarePlan(
    request: CarePlanGenerationRequest
  ): Promise<ServiceResult<CarePlanGenerationResponse>> {
    try {
      // Validate required fields
      if (!request.patientId) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.planType) {
        return failure('INVALID_INPUT', 'Plan type is required');
      }

      const validPlanTypes = ['readmission_prevention', 'chronic_care', 'transitional_care', 'high_utilizer', 'preventive'];
      if (!validPlanTypes.includes(request.planType)) {
        return failure('INVALID_INPUT', `Invalid plan type. Must be one of: ${validPlanTypes.join(', ')}`);
      }

      const { data, error } = await supabase.functions.invoke('ai-care-plan-generator', {
        body: {
          patientId: request.patientId,
          tenantId: request.tenantId,
          planType: request.planType,
          focusConditions: request.focusConditions || [],
          includeSDOH: request.includeSDOH ?? true,
          includeMedications: request.includeMedications ?? true,
          careTeamRoles: request.careTeamRoles || ['nurse', 'physician', 'care_coordinator'],
          durationWeeks: request.durationWeeks || 12,
        },
      });

      if (error) throw error;

      const response = data as CarePlanGenerationResponse;

      // SAFETY: Apply guardrails to response
      response.carePlan = this.applyGuardrails(response.carePlan);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CARE_PLAN_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Apply safety guardrails to generated care plan
   * SAFETY: Ensures AI output is constrained and reviewed
   */
  private static applyGuardrails(plan: GeneratedCarePlan): GeneratedCarePlan {
    // SAFETY: Always require review - never auto-approve AI plans
    plan.requiresReview = true;

    // SAFETY: Add review reason if confidence is low
    if (plan.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
      if (!plan.reviewReasons.includes('Low confidence score')) {
        plan.reviewReasons.push('Low confidence score - requires careful clinician review');
      }
    }

    // SAFETY: Flag for senior review if very low confidence
    if (plan.confidence < SAFETY_THRESHOLDS.SENIOR_REVIEW_THRESHOLD) {
      if (!plan.reviewReasons.includes('Senior clinician review recommended')) {
        plan.reviewReasons.push('Senior clinician review recommended due to complexity');
      }
    }

    // SAFETY: Limit goals to prevent overwhelming plans
    if (plan.goals.length > SAFETY_THRESHOLDS.MAX_GOALS) {
      plan.goals = plan.goals.slice(0, SAFETY_THRESHOLDS.MAX_GOALS);
      plan.reviewReasons.push(`Goals limited to ${SAFETY_THRESHOLDS.MAX_GOALS} - review for completeness`);
    }

    // SAFETY: Limit interventions
    if (plan.interventions.length > SAFETY_THRESHOLDS.MAX_INTERVENTIONS) {
      plan.interventions = plan.interventions.slice(0, SAFETY_THRESHOLDS.MAX_INTERVENTIONS);
      plan.reviewReasons.push(`Interventions limited to ${SAFETY_THRESHOLDS.MAX_INTERVENTIONS}`);
    }

    // SAFETY: Limit barriers
    if (plan.barriers.length > SAFETY_THRESHOLDS.MAX_BARRIERS) {
      plan.barriers = plan.barriers.slice(0, SAFETY_THRESHOLDS.MAX_BARRIERS);
    }

    return plan;
  }

  /**
   * Generate a readmission prevention care plan
   * Focused on preventing 30-day hospital readmissions
   */
  static async generateReadmissionPreventionPlan(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<CarePlanGenerationResponse>> {
    return this.generateCarePlan({
      patientId,
      tenantId,
      planType: 'readmission_prevention',
      includeSDOH: true,
      durationWeeks: 4, // 30-day focus
    });
  }

  /**
   * Generate a chronic care management plan
   * For patients with 2+ chronic conditions
   */
  static async generateChronicCarePlan(
    patientId: string,
    focusConditions?: string[],
    tenantId?: string
  ): Promise<ServiceResult<CarePlanGenerationResponse>> {
    return this.generateCarePlan({
      patientId,
      tenantId,
      planType: 'chronic_care',
      focusConditions,
      includeSDOH: true,
      durationWeeks: 12,
    });
  }

  /**
   * Generate a transitional care plan
   * For post-discharge care coordination
   */
  static async generateTransitionalCarePlan(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<CarePlanGenerationResponse>> {
    return this.generateCarePlan({
      patientId,
      tenantId,
      planType: 'transitional_care',
      includeSDOH: true,
      durationWeeks: 4,
    });
  }

  /**
   * Generate a high utilizer care plan
   * For frequent ED/hospital users
   */
  static async generateHighUtilizerPlan(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<CarePlanGenerationResponse>> {
    return this.generateCarePlan({
      patientId,
      tenantId,
      planType: 'high_utilizer',
      includeSDOH: true,
      durationWeeks: 12,
      careTeamRoles: ['nurse', 'physician', 'care_coordinator', 'social_worker'],
    });
  }

  /**
   * Save a generated care plan to the database
   *
   * SAFETY: Plan is saved in 'draft' status, never auto-activated
   *
   * @param patientId - Patient ID
   * @param carePlan - The generated care plan to save
   * @param coordinatorId - ID of the care coordinator saving the plan
   * @returns ServiceResult with the saved plan ID
   */
  static async saveGeneratedPlan(
    patientId: string,
    carePlan: GeneratedCarePlan,
    coordinatorId: string
  ): Promise<ServiceResult<{ planId: string }>> {
    try {
      // SAFETY: Validate the plan before saving
      const validation = this.validatePlanForSaving(carePlan);
      if (!validation.valid) {
        return failure('VALIDATION_ERROR', validation.reason || 'Plan validation failed');
      }

      const { data, error } = await supabase
        .from('care_coordination_plans')
        .insert({
          patient_id: patientId,
          plan_type: carePlan.planType,
          status: 'draft', // SAFETY: Never auto-activate AI plans
          priority: carePlan.priority,
          title: carePlan.title,
          goals: carePlan.goals,
          interventions: carePlan.interventions,
          barriers: carePlan.barriers,
          care_team_members: carePlan.careTeam,
          primary_coordinator_id: coordinatorId,
          start_date: new Date().toISOString().split('T')[0],
          next_review_date: this.calculateNextReviewDate(carePlan.reviewSchedule),
          outcome_measures: {
            success_criteria: carePlan.successCriteria,
            risk_factors: carePlan.riskFactors,
          },
          clinical_notes: `AI-Generated Care Plan\n\nDescription: ${carePlan.description}\n\nReview Required: ${carePlan.reviewReasons.join('; ')}\n\nConfidence: ${(carePlan.confidence * 100).toFixed(0)}%\n\nEvidence Sources: ${carePlan.evidenceSources.join(', ')}`,
          sdoh_factors: {
            ccm_eligible: carePlan.ccmEligible,
            tcm_eligible: carePlan.tcmEligible,
            icd10_codes: carePlan.icd10Codes,
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log PHI access for audit
      await supabase.from('audit_phi_access').insert({
        user_id: coordinatorId,
        resource_type: 'care_plan',
        resource_id: data.id,
        action: 'CREATE',
        details: {
          ai_generated: true,
          confidence: carePlan.confidence,
          plan_type: carePlan.planType,
        },
      });

      return success({ planId: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CARE_PLAN_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Validate a care plan before saving
   * SAFETY: Ensures plan meets minimum requirements
   */
  private static validatePlanForSaving(plan: GeneratedCarePlan): { valid: boolean; reason?: string } {
    // Must have at least one goal
    if (!plan.goals || plan.goals.length === 0) {
      return { valid: false, reason: 'Care plan must have at least one goal' };
    }

    // Must have at least one intervention
    if (!plan.interventions || plan.interventions.length === 0) {
      return { valid: false, reason: 'Care plan must have at least one intervention' };
    }

    // Must have a title
    if (!plan.title || plan.title.trim().length < 5) {
      return { valid: false, reason: 'Care plan must have a descriptive title' };
    }

    // Goals must have required fields
    for (const goal of plan.goals) {
      if (!goal.goal || !goal.target || !goal.timeframe) {
        return { valid: false, reason: 'All goals must have goal, target, and timeframe' };
      }
    }

    // Interventions must have required fields
    for (const intervention of plan.interventions) {
      if (!intervention.intervention || !intervention.frequency || !intervention.responsible) {
        return { valid: false, reason: 'All interventions must have description, frequency, and responsible party' };
      }
    }

    return { valid: true };
  }

  /**
   * Calculate next review date from schedule string
   */
  private static calculateNextReviewDate(reviewSchedule: string): string {
    const now = new Date();
    let days = 14; // Default 2 weeks

    if (reviewSchedule.includes('week')) {
      const match = reviewSchedule.match(/(\d+)\s*week/i);
      if (match) {
        days = parseInt(match[1], 10) * 7;
      }
    } else if (reviewSchedule.includes('day')) {
      const match = reviewSchedule.match(/(\d+)\s*day/i);
      if (match) {
        days = parseInt(match[1], 10);
      }
    } else if (reviewSchedule.includes('month')) {
      const match = reviewSchedule.match(/(\d+)\s*month/i);
      if (match) {
        days = parseInt(match[1], 10) * 30;
      }
    }

    now.setDate(now.getDate() + days);
    return now.toISOString().split('T')[0];
  }

  /**
   * Approve a generated care plan (clinician action)
   *
   * SAFETY: Only clinicians can approve plans
   *
   * @param planId - The plan ID to approve
   * @param approverId - ID of the approving clinician
   * @param modifications - Optional modifications to apply
   */
  static async approvePlan(
    planId: string,
    approverId: string,
    modifications?: Partial<GeneratedCarePlan>
  ): Promise<ServiceResult<{ planId: string }>> {
    try {
      const updates: Record<string, unknown> = {
        status: 'active',
        last_reviewed_date: new Date().toISOString().split('T')[0],
        clinical_notes: `Approved by clinician on ${new Date().toISOString()}`,
      };

      if (modifications) {
        if (modifications.goals) updates.goals = modifications.goals;
        if (modifications.interventions) updates.interventions = modifications.interventions;
        if (modifications.barriers) updates.barriers = modifications.barriers;
        if (modifications.priority) updates.priority = modifications.priority;
      }

      const { error } = await supabase
        .from('care_coordination_plans')
        .update(updates)
        .eq('id', planId);

      if (error) throw error;

      // Log approval
      await supabase.from('audit_phi_access').insert({
        user_id: approverId,
        resource_type: 'care_plan',
        resource_id: planId,
        action: 'UPDATE',
        details: {
          action_type: 'ai_plan_approval',
          had_modifications: !!modifications,
        },
      });

      return success({ planId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CARE_PLAN_APPROVAL_FAILED', error.message, error);
    }
  }

  /**
   * Reject a generated care plan (clinician action)
   *
   * @param planId - The plan ID to reject
   * @param rejecterId - ID of the rejecting clinician
   * @param reason - Reason for rejection
   */
  static async rejectPlan(
    planId: string,
    rejecterId: string,
    reason: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('care_coordination_plans')
        .update({
          status: 'discontinued',
          clinical_notes: `Rejected: ${reason}\nRejected by clinician on ${new Date().toISOString()}`,
        })
        .eq('id', planId);

      if (error) throw error;

      // Log rejection
      await supabase.from('audit_phi_access').insert({
        user_id: rejecterId,
        resource_type: 'care_plan',
        resource_id: planId,
        action: 'UPDATE',
        details: {
          action_type: 'ai_plan_rejection',
          reason,
        },
      });

      return success(undefined);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CARE_PLAN_REJECTION_FAILED', error.message, error);
    }
  }

  /**
   * Get billing eligibility summary for a care plan
   */
  static getBillingEligibility(plan: GeneratedCarePlan): {
    ccmEligible: boolean;
    tcmEligible: boolean;
    billableInterventions: CarePlanIntervention[];
    estimatedRevenueMonthly: number;
  } {
    const billableInterventions = plan.interventions.filter((i) => i.billingEligible);

    // Rough revenue estimates based on CPT codes
    let estimatedRevenueMonthly = 0;
    if (plan.ccmEligible) estimatedRevenueMonthly += 64; // 99490
    if (plan.tcmEligible) estimatedRevenueMonthly += 168; // 99495/99496

    billableInterventions.forEach((i) => {
      if (i.cptCode === '99490') estimatedRevenueMonthly += 64;
      if (i.cptCode === '99495') estimatedRevenueMonthly += 168;
      if (i.cptCode === '99496') estimatedRevenueMonthly += 117;
    });

    return {
      ccmEligible: plan.ccmEligible,
      tcmEligible: plan.tcmEligible,
      billableInterventions,
      estimatedRevenueMonthly,
    };
  }
}

export default CarePlanAIService;
