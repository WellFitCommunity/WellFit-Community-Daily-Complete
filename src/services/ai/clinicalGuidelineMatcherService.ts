/**
 * AI Clinical Guideline Matcher Service
 *
 * Skill #24: Smart guideline recommendations.
 * Integrates with the ai-clinical-guideline-matcher edge function.
 *
 * Matches patient conditions against evidence-based clinical guidelines to:
 * - Identify applicable guidelines for patient's conditions
 * - Detect adherence gaps (where care doesn't match guidelines)
 * - Provide specific recommendations with guideline references
 * - Track preventive care opportunities
 *
 * SAFETY GUARDRAILS:
 * 1. All AI-generated recommendations require clinician review (requiresReview: true)
 * 2. References specific guideline sources (ADA, ACC/AHA, USPSTF, etc.)
 * 3. Confidence thresholds flag low-confidence recommendations
 * 4. Prioritizes recommendations by clinical urgency
 * 5. Audit logging for all AI-generated content
 *
 * @module clinicalGuidelineMatcherService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// =====================================================
// TYPES
// =====================================================

export interface ClinicalGuideline {
  guidelineId: string;
  guidelineName: string;
  organization: string;
  year: number;
  condition: string;
  conditionCode?: string;
  url?: string;
}

export interface GuidelineRecommendation {
  recommendationId: string;
  guideline: ClinicalGuideline;
  category: 'treatment' | 'monitoring' | 'screening' | 'lifestyle' | 'referral' | 'diagnostic';
  recommendation: string;
  rationale: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'expert_consensus';
  urgency: 'routine' | 'soon' | 'urgent' | 'emergent';
  targetValue?: string;
  currentValue?: string;
  gap?: string;
  actionItems: string[];
}

export interface AdherenceGap {
  gapId: string;
  guideline: ClinicalGuideline;
  gapType:
    | 'missing_medication'
    | 'missing_test'
    | 'suboptimal_control'
    | 'missing_referral'
    | 'missing_screening'
    | 'lifestyle';
  description: string;
  expectedCare: string;
  currentState: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface PreventiveScreening {
  screeningId: string;
  screeningName: string;
  guidelineSource: string;
  applicableFor: string;
  frequency: string;
  lastPerformed?: string;
  nextDue?: string;
  status: 'current' | 'overdue' | 'never_done' | 'not_applicable';
  recommendation: string;
}

export interface GuidelineMatchResult {
  patientId: string;
  matchedGuidelines: ClinicalGuideline[];
  recommendations: GuidelineRecommendation[];
  adherenceGaps: AdherenceGap[];
  preventiveScreenings: PreventiveScreening[];
  summary: {
    totalGuidelines: number;
    totalRecommendations: number;
    criticalGaps: number;
    highPriorityGaps: number;
    overdueScreenings: number;
  };
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

export interface GuidelineMatchRequest {
  patientId: string;
  tenantId?: string;
  /** Optional: Focus on specific conditions */
  focusConditions?: string[];
  /** Include preventive care screening recommendations */
  includePreventiveCare?: boolean;
  /** Match against specific guideline categories */
  guidelineCategories?: string[];
}

export interface GuidelineMatchResponse {
  result: GuidelineMatchResult;
  metadata: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    patient_context: {
      age: number;
      conditions_count: number;
      medications_count: number;
    };
  };
}

export interface SavedGuidelineMatch {
  matchId: string;
  patientId: string;
  matchedAt: string;
  status: 'pending_review' | 'reviewed' | 'actioned' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  result: GuidelineMatchResult;
}

// =====================================================
// SAFETY THRESHOLDS
// =====================================================

const SAFETY_THRESHOLDS = {
  /** Minimum confidence to proceed without extra warnings */
  MIN_CONFIDENCE: 0.6,
  /** Confidence below this requires specialist review */
  SPECIALIST_REVIEW_THRESHOLD: 0.5,
  /** Maximum recommendations to prevent overwhelming clinicians */
  MAX_RECOMMENDATIONS: 15,
  /** Maximum gaps to display */
  MAX_GAPS: 10,
};

// =====================================================
// SERVICE
// =====================================================

/**
 * AI Clinical Guideline Matcher Service
 *
 * Provides methods for matching patient data against evidence-based
 * clinical guidelines with comprehensive safety guardrails.
 */
export class ClinicalGuidelineMatcherService {
  /**
   * Match patient data against clinical guidelines
   *
   * SAFETY: All generated recommendations have requiresReview=true
   *
   * @param request - The match request parameters
   * @returns ServiceResult containing the guideline matches
   */
  static async matchGuidelines(
    request: GuidelineMatchRequest
  ): Promise<ServiceResult<GuidelineMatchResponse>> {
    try {
      // Validate required fields
      if (!request.patientId) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-clinical-guideline-matcher', {
        body: {
          patientId: request.patientId,
          tenantId: request.tenantId,
          focusConditions: request.focusConditions || [],
          includePreventiveCare: request.includePreventiveCare ?? true,
          guidelineCategories: request.guidelineCategories || [],
        },
      });

      if (error) throw error;

      const response = data as GuidelineMatchResponse;

      // SAFETY: Apply guardrails to response
      response.result = this.applyGuardrails(response.result);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('GUIDELINE_MATCH_FAILED', error.message, error);
    }
  }

  /**
   * Match guidelines for a specific condition
   *
   * @param patientId - Patient ID
   * @param condition - Condition to focus on
   * @param tenantId - Optional tenant ID
   */
  static async matchForCondition(
    patientId: string,
    condition: string,
    tenantId?: string
  ): Promise<ServiceResult<GuidelineMatchResponse>> {
    return this.matchGuidelines({
      patientId,
      tenantId,
      focusConditions: [condition],
      includePreventiveCare: false,
    });
  }

  /**
   * Get preventive care recommendations for a patient
   *
   * @param patientId - Patient ID
   * @param tenantId - Optional tenant ID
   */
  static async getPreventiveCareRecommendations(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<GuidelineMatchResponse>> {
    return this.matchGuidelines({
      patientId,
      tenantId,
      focusConditions: [],
      includePreventiveCare: true,
    });
  }

  /**
   * Match guidelines for diabetes care
   * References ADA Standards of Care
   */
  static async matchDiabetesGuidelines(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<GuidelineMatchResponse>> {
    return this.matchGuidelines({
      patientId,
      tenantId,
      focusConditions: ['diabetes'],
      includePreventiveCare: true,
    });
  }

  /**
   * Match guidelines for cardiovascular care
   * References ACC/AHA Guidelines
   */
  static async matchCardiovascularGuidelines(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<GuidelineMatchResponse>> {
    return this.matchGuidelines({
      patientId,
      tenantId,
      focusConditions: ['hypertension', 'heart_failure', 'hyperlipidemia', 'afib', 'cad'],
      includePreventiveCare: true,
    });
  }

  /**
   * Match guidelines for respiratory conditions
   * References GOLD and GINA Guidelines
   */
  static async matchRespiratoryGuidelines(
    patientId: string,
    tenantId?: string
  ): Promise<ServiceResult<GuidelineMatchResponse>> {
    return this.matchGuidelines({
      patientId,
      tenantId,
      focusConditions: ['copd', 'asthma'],
      includePreventiveCare: false,
    });
  }

  /**
   * Apply safety guardrails to generated guideline matches
   * SAFETY: Ensures AI output is constrained and reviewed
   */
  private static applyGuardrails(result: GuidelineMatchResult): GuidelineMatchResult {
    // SAFETY: Always require review - never auto-approve AI recommendations
    result.requiresReview = true;

    // SAFETY: Ensure disclaimer is present
    if (!result.disclaimer || result.disclaimer.length < 20) {
      result.disclaimer =
        'These recommendations are for clinical decision support only and require verification by a licensed healthcare provider. Guidelines should be applied with consideration of individual patient circumstances.';
    }

    // SAFETY: Add review reason if confidence is low
    if (result.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
      if (!result.reviewReasons.includes('Low confidence score')) {
        result.reviewReasons.push('Low confidence score - requires careful clinician review');
      }
    }

    // SAFETY: Flag for specialist review if very low confidence
    if (result.confidence < SAFETY_THRESHOLDS.SPECIALIST_REVIEW_THRESHOLD) {
      if (!result.reviewReasons.includes('Specialist review recommended')) {
        result.reviewReasons.push('Specialist review recommended due to complexity');
      }
    }

    // SAFETY: Flag critical gaps prominently
    if (result.summary.criticalGaps > 0) {
      const criticalMessage = `CRITICAL: ${result.summary.criticalGaps} critical adherence gap(s) identified`;
      if (!result.reviewReasons.includes(criticalMessage)) {
        result.reviewReasons.unshift(criticalMessage);
      }
    }

    // SAFETY: Limit recommendations to prevent overwhelming
    if (result.recommendations.length > SAFETY_THRESHOLDS.MAX_RECOMMENDATIONS) {
      result.recommendations = result.recommendations.slice(0, SAFETY_THRESHOLDS.MAX_RECOMMENDATIONS);
      result.reviewReasons.push(`Recommendations limited to ${SAFETY_THRESHOLDS.MAX_RECOMMENDATIONS} - more may be available`);
    }

    // SAFETY: Limit gaps displayed
    if (result.adherenceGaps.length > SAFETY_THRESHOLDS.MAX_GAPS) {
      // Keep critical and high priority gaps first
      const sortedGaps = [...result.adherenceGaps].sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      result.adherenceGaps = sortedGaps.slice(0, SAFETY_THRESHOLDS.MAX_GAPS);
    }

    return result;
  }

  /**
   * Save a guideline match result to the patient record
   *
   * SAFETY: Saved as recommendation only, not as active order
   *
   * @param patientId - Patient ID
   * @param result - The guideline match result to save
   * @param clinicianId - ID of the clinician saving the result
   * @returns ServiceResult with the saved match ID
   */
  static async saveMatchResult(
    patientId: string,
    result: GuidelineMatchResult,
    clinicianId: string
  ): Promise<ServiceResult<{ matchId: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_guideline_matches')
        .insert({
          patient_id: patientId,
          status: 'pending_review', // SAFETY: Never auto-approved
          matched_guidelines: result.matchedGuidelines,
          recommendations: result.recommendations,
          adherence_gaps: result.adherenceGaps,
          preventive_screenings: result.preventiveScreenings,
          summary: result.summary,
          confidence: result.confidence,
          review_reasons: result.reviewReasons,
          disclaimer: result.disclaimer,
          created_by: clinicianId,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log PHI access for audit
      await supabase.from('audit_phi_access').insert({
        user_id: clinicianId,
        resource_type: 'guideline_match',
        resource_id: data.id,
        action: 'CREATE',
        details: {
          ai_generated: true,
          guidelines_count: result.matchedGuidelines.length,
          recommendations_count: result.recommendations.length,
          gaps_count: result.adherenceGaps.length,
          confidence: result.confidence,
        },
      });

      return success({ matchId: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('GUIDELINE_MATCH_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Mark a guideline match as reviewed
   *
   * @param matchId - The match ID to review
   * @param reviewerId - ID of the reviewing clinician
   * @param reviewNotes - Optional review notes
   */
  static async markAsReviewed(
    matchId: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<ServiceResult<{ matchId: string }>> {
    try {
      const { error } = await supabase
        .from('ai_guideline_matches')
        .update({
          status: 'reviewed',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', matchId);

      if (error) throw error;

      // Log review
      await supabase.from('audit_phi_access').insert({
        user_id: reviewerId,
        resource_type: 'guideline_match',
        resource_id: matchId,
        action: 'UPDATE',
        details: {
          action_type: 'guideline_match_reviewed',
          has_notes: !!reviewNotes,
        },
      });

      return success({ matchId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('GUIDELINE_MATCH_REVIEW_FAILED', error.message, error);
    }
  }

  /**
   * Get recent guideline matches for a patient
   *
   * @param patientId - Patient ID
   * @param limit - Maximum number of matches to return
   */
  static async getPatientMatches(
    patientId: string,
    limit: number = 10
  ): Promise<ServiceResult<SavedGuidelineMatch[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_guideline_matches')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const matches: SavedGuidelineMatch[] = (data || []).map((row: Record<string, unknown>) => ({
        matchId: row.id as string,
        patientId: row.patient_id as string,
        matchedAt: row.created_at as string,
        status: row.status as SavedGuidelineMatch['status'],
        reviewedBy: row.reviewed_by as string | undefined,
        reviewedAt: row.reviewed_at as string | undefined,
        reviewNotes: row.review_notes as string | undefined,
        result: {
          patientId: row.patient_id as string,
          matchedGuidelines: row.matched_guidelines as ClinicalGuideline[],
          recommendations: row.recommendations as GuidelineRecommendation[],
          adherenceGaps: row.adherence_gaps as AdherenceGap[],
          preventiveScreenings: row.preventive_screenings as PreventiveScreening[],
          summary: row.summary as GuidelineMatchResult['summary'],
          confidence: row.confidence as number,
          requiresReview: true,
          reviewReasons: row.review_reasons as string[],
          disclaimer: row.disclaimer as string,
        },
      }));

      return success(matches);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('GUIDELINE_MATCH_FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get available clinical guideline categories
   */
  static getAvailableCategories(): string[] {
    return [
      'diabetes',
      'hypertension',
      'hyperlipidemia',
      'heart_failure',
      'copd',
      'asthma',
      'afib',
      'ckd',
      'osteoporosis',
      'depression',
      'cad',
    ];
  }

  /**
   * Get guidelines for a specific condition (static lookup)
   */
  static getGuidelinesForCondition(condition: string): ClinicalGuideline[] {
    const guidelineMap: Record<string, ClinicalGuideline[]> = {
      diabetes: [
        {
          guidelineId: 'ada-2024',
          guidelineName: 'ADA Standards of Care in Diabetes',
          organization: 'American Diabetes Association',
          year: 2024,
          condition: 'Diabetes Mellitus',
          conditionCode: 'E11',
        },
      ],
      hypertension: [
        {
          guidelineId: 'acc-aha-htn-2017',
          guidelineName: 'ACC/AHA Hypertension Guidelines',
          organization: 'American College of Cardiology/American Heart Association',
          year: 2017,
          condition: 'Hypertension',
          conditionCode: 'I10',
        },
      ],
      heart_failure: [
        {
          guidelineId: 'acc-aha-hf-2022',
          guidelineName: 'ACC/AHA Heart Failure Guidelines',
          organization: 'American College of Cardiology/American Heart Association',
          year: 2022,
          condition: 'Heart Failure',
          conditionCode: 'I50',
        },
      ],
      copd: [
        {
          guidelineId: 'gold-2024',
          guidelineName: 'GOLD Guidelines',
          organization: 'Global Initiative for Chronic Obstructive Lung Disease',
          year: 2024,
          condition: 'COPD',
          conditionCode: 'J44',
        },
      ],
      asthma: [
        {
          guidelineId: 'gina-2024',
          guidelineName: 'GINA Guidelines',
          organization: 'Global Initiative for Asthma',
          year: 2024,
          condition: 'Asthma',
          conditionCode: 'J45',
        },
      ],
    };

    return guidelineMap[condition.toLowerCase()] || [];
  }

  /**
   * Get urgency color for UI display
   */
  static getUrgencyColor(urgency: GuidelineRecommendation['urgency']): string {
    switch (urgency) {
      case 'emergent':
        return 'red';
      case 'urgent':
        return 'orange';
      case 'soon':
        return 'yellow';
      case 'routine':
      default:
        return 'green';
    }
  }

  /**
   * Get priority color for adherence gaps
   */
  static getPriorityColor(priority: AdherenceGap['priority']): string {
    switch (priority) {
      case 'critical':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
      default:
        return 'green';
    }
  }

  /**
   * Get screening status color for UI display
   */
  static getScreeningStatusColor(status: PreventiveScreening['status']): string {
    switch (status) {
      case 'overdue':
        return 'red';
      case 'never_done':
        return 'orange';
      case 'current':
        return 'green';
      case 'not_applicable':
      default:
        return 'gray';
    }
  }
}

// Export singleton instance
export const clinicalGuidelineMatcherService = ClinicalGuidelineMatcherService;

export default ClinicalGuidelineMatcherService;
