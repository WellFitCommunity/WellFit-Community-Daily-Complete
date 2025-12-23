/**
 * Fall Risk Predictor Service
 *
 * Frontend service for AI-powered fall risk assessment.
 * Uses Claude Sonnet 4.5 for clinical accuracy based on validated tools:
 * - Morse Fall Scale
 * - STRATIFY risk assessment
 * - Evidence-based clinical predictors
 *
 * @module fallRiskPredictorService
 * @skill #30 - Fall Risk Predictor
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface RiskFactor {
  factor: string;
  category: 'age' | 'history' | 'medication' | 'condition' | 'mobility' | 'cognitive' | 'sensory' | 'environmental';
  severity: 'low' | 'moderate' | 'high';
  weight: number;
  evidence: string;
  interventionSuggestion?: string;
}

export interface ProtectiveFactor {
  factor: string;
  impact: string;
  category: string;
}

export interface FallRiskIntervention {
  intervention: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'environmental' | 'medication' | 'therapy' | 'equipment' | 'education' | 'monitoring';
  timeframe: string;
  responsible: string;
  estimatedRiskReduction: number;
}

export interface CategoryScores {
  age: number;
  fallHistory: number;
  medications: number;
  conditions: number;
  mobility: number;
  cognitive: number;
  sensory: number;
  environmental: number;
}

export interface FallRiskAssessment {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;
  assessmentContext: string;
  overallRiskScore: number;
  riskCategory: 'low' | 'moderate' | 'high' | 'very_high';
  morseScaleEstimate: number;
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  patientAge: number | null;
  ageRiskCategory: 'low' | 'moderate' | 'high';
  categoryScores: CategoryScores;
  interventions: FallRiskIntervention[];
  precautions: string[];
  monitoringFrequency: 'standard' | 'enhanced' | 'intensive';
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  plainLanguageExplanation: string;
  generatedAt: string;
}

export interface FallRiskAssessmentRequest {
  patientId: string;
  assessorId: string;
  assessmentContext?: 'admission' | 'routine' | 'post_fall' | 'discharge';
  includeEnvironmentalFactors?: boolean;
  customFactors?: string[];
}

export interface FallRiskAssessmentResponse {
  assessment: FallRiskAssessment;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
  };
}

export interface SavedFallRiskAssessment extends FallRiskAssessment {
  id: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Safety Thresholds
// ============================================================================

const SAFETY_THRESHOLDS = {
  MIN_CONFIDENCE: 0.5,
  HIGH_RISK_SCORE: 70,
  VERY_HIGH_RISK_SCORE: 85,
  URGENT_REVIEW_THRESHOLD: 0.6,
};

// ============================================================================
// Service Class
// ============================================================================

export class FallRiskPredictorService {
  /**
   * Assess fall risk for a patient
   */
  async assessRisk(
    request: FallRiskAssessmentRequest
  ): Promise<ServiceResult<FallRiskAssessmentResponse>> {
    try {
      // Validate inputs
      if (!request.patientId || !request.assessorId) {
        return failure(
          'INVALID_INPUT',
          'Patient ID and Assessor ID are required'
        );
      }

      // Get auth token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        return failure('UNAUTHORIZED', 'Authentication required');
      }

      auditLogger.info('fall_risk_assessment_started', {
        patientId: request.patientId.substring(0, 8) + '...',
        context: request.assessmentContext || 'routine',
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke(
        'ai-fall-risk-predictor',
        {
          body: {
            patientId: request.patientId,
            assessorId: request.assessorId,
            assessmentContext: request.assessmentContext || 'routine',
            includeEnvironmentalFactors: request.includeEnvironmentalFactors ?? true,
            customFactors: request.customFactors || [],
          },
        }
      );

      if (error) {
        auditLogger.error('fall_risk_assessment_failed', error.message);
        return failure(
          'FALL_RISK_ASSESSMENT_FAILED',
          `Failed to assess fall risk: ${error.message}`,
          error
        );
      }

      // Validate response
      if (!data?.assessment) {
        return failure(
          'FALL_RISK_ASSESSMENT_FAILED',
          'Invalid response from assessment service'
        );
      }

      const assessment = data.assessment as FallRiskAssessment;

      // Apply safety guardrails
      assessment.requiresReview = true; // Always require review

      // Flag high-risk patients for urgent review
      if (assessment.overallRiskScore >= SAFETY_THRESHOLDS.VERY_HIGH_RISK_SCORE) {
        assessment.reviewReasons = assessment.reviewReasons || [];
        if (!assessment.reviewReasons.includes('Very high fall risk - urgent review required')) {
          assessment.reviewReasons.push('Very high fall risk - urgent review required');
        }
      }

      if (assessment.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
        assessment.reviewReasons = assessment.reviewReasons || [];
        if (!assessment.reviewReasons.includes('Low confidence - requires careful review')) {
          assessment.reviewReasons.push('Low confidence - requires careful review');
        }
      }

      auditLogger.info('fall_risk_assessment_completed', {
        assessmentId: assessment.assessmentId,
        riskCategory: assessment.riskCategory,
        overallScore: assessment.overallRiskScore,
        confidence: assessment.confidence,
      });

      return success({
        assessment,
        metadata: data.metadata,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      auditLogger.error('fall_risk_assessment_error', error.message);
      return failure(
        'FALL_RISK_ASSESSMENT_FAILED',
        `Unexpected error during assessment: ${error.message}`,
        err
      );
    }
  }

  /**
   * Quick admission fall risk screening
   */
  async screenOnAdmission(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<FallRiskAssessmentResponse>> {
    return this.assessRisk({
      patientId,
      assessorId,
      assessmentContext: 'admission',
      includeEnvironmentalFactors: true,
    });
  }

  /**
   * Post-fall reassessment
   */
  async reassessAfterFall(
    patientId: string,
    assessorId: string,
    fallDetails?: string[]
  ): Promise<ServiceResult<FallRiskAssessmentResponse>> {
    return this.assessRisk({
      patientId,
      assessorId,
      assessmentContext: 'post_fall',
      customFactors: fallDetails || ['Recent fall event'],
    });
  }

  /**
   * Routine periodic assessment
   */
  async routineAssessment(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<FallRiskAssessmentResponse>> {
    return this.assessRisk({
      patientId,
      assessorId,
      assessmentContext: 'routine',
    });
  }

  /**
   * Save assessment to database
   */
  async saveAssessment(
    assessment: FallRiskAssessment,
    status: 'draft' | 'pending_review' = 'pending_review'
  ): Promise<ServiceResult<SavedFallRiskAssessment>> {
    try {
      const { data, error } = await supabase
        .from('ai_fall_risk_assessments')
        .insert({
          assessment_id: assessment.assessmentId,
          patient_id: assessment.patientId,
          assessor_id: assessment.assessorId,
          assessment_date: assessment.assessmentDate,
          assessment_context: assessment.assessmentContext,
          overall_risk_score: assessment.overallRiskScore,
          risk_category: assessment.riskCategory,
          morse_scale_estimate: assessment.morseScaleEstimate,
          risk_factors: assessment.riskFactors,
          protective_factors: assessment.protectiveFactors,
          patient_age: assessment.patientAge,
          age_risk_category: assessment.ageRiskCategory,
          category_scores: assessment.categoryScores,
          interventions: assessment.interventions,
          precautions: assessment.precautions,
          monitoring_frequency: assessment.monitoringFrequency,
          confidence: assessment.confidence,
          requires_review: assessment.requiresReview,
          review_reasons: assessment.reviewReasons,
          plain_language_explanation: assessment.plainLanguageExplanation,
          status,
        })
        .select()
        .single();

      if (error) {
        return failure(
          'FALL_RISK_SAVE_FAILED',
          `Failed to save assessment: ${error.message}`,
          error
        );
      }

      auditLogger.info('fall_risk_assessment_saved', {
        assessmentId: assessment.assessmentId,
        status,
      });

      return success(this.mapToSavedAssessment(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'FALL_RISK_SAVE_FAILED',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Approve an assessment after review
   */
  async approveAssessment(
    assessmentId: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<ServiceResult<SavedFallRiskAssessment>> {
    try {
      const { data, error } = await supabase
        .from('ai_fall_risk_assessments')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('assessment_id', assessmentId)
        .eq('status', 'pending_review')
        .select()
        .single();

      if (error) {
        return failure(
          'FALL_RISK_APPROVAL_FAILED',
          `Failed to approve assessment: ${error.message}`,
          error
        );
      }

      if (!data) {
        return failure(
          'NOT_FOUND',
          'Assessment not found or not in pending review status'
        );
      }

      auditLogger.info('fall_risk_assessment_approved', {
        assessmentId,
        reviewerId: reviewerId.substring(0, 8) + '...',
      });

      return success(this.mapToSavedAssessment(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'FALL_RISK_APPROVAL_FAILED',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Get patient's fall risk assessment history
   */
  async getPatientAssessments(
    patientId: string,
    options?: {
      limit?: number;
      status?: string;
    }
  ): Promise<ServiceResult<SavedFallRiskAssessment[]>> {
    try {
      let query = supabase
        .from('ai_fall_risk_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        return failure(
          'DATABASE_ERROR',
          `Failed to fetch assessments: ${error.message}`,
          error
        );
      }

      return success((data || []).map(this.mapToSavedAssessment));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'DATABASE_ERROR',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Get most recent assessment for a patient
   */
  async getLatestAssessment(
    patientId: string
  ): Promise<ServiceResult<SavedFallRiskAssessment | null>> {
    try {
      const { data, error } = await supabase
        .from('ai_fall_risk_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        return failure(
          'DATABASE_ERROR',
          `Failed to fetch assessment: ${error.message}`,
          error
        );
      }

      return success(data ? this.mapToSavedAssessment(data) : null);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'DATABASE_ERROR',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Get high-risk patients requiring attention
   */
  async getHighRiskPatients(
    options?: {
      minScore?: number;
      limit?: number;
    }
  ): Promise<ServiceResult<SavedFallRiskAssessment[]>> {
    try {
      const minScore = options?.minScore || SAFETY_THRESHOLDS.HIGH_RISK_SCORE;

      const { data, error } = await supabase
        .from('ai_fall_risk_assessments')
        .select('*')
        .gte('overall_risk_score', minScore)
        .eq('status', 'approved')
        .order('overall_risk_score', { ascending: false })
        .limit(options?.limit || 50);

      if (error) {
        return failure(
          'DATABASE_ERROR',
          `Failed to fetch high-risk patients: ${error.message}`,
          error
        );
      }

      return success((data || []).map(this.mapToSavedAssessment));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'DATABASE_ERROR',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Format assessment for clinical display
   */
  formatForClinicalDisplay(assessment: FallRiskAssessment): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('FALL RISK ASSESSMENT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Date: ${new Date(assessment.assessmentDate).toLocaleString()}`);
    lines.push(`Context: ${assessment.assessmentContext}`);
    lines.push(`Patient Age: ${assessment.patientAge || 'Unknown'}`);
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('RISK SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(`Overall Risk Score: ${assessment.overallRiskScore}/100`);
    lines.push(`Risk Category: ${assessment.riskCategory.toUpperCase().replace('_', ' ')}`);
    lines.push(`Morse Scale Estimate: ${assessment.morseScaleEstimate}/125`);
    lines.push(`Monitoring Frequency: ${assessment.monitoringFrequency}`);
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('CATEGORY SCORES');
    lines.push('-'.repeat(40));
    for (const [category, score] of Object.entries(assessment.categoryScores)) {
      const label = category.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      lines.push(`  ${label}: ${score}/100`);
    }
    lines.push('');

    if (assessment.riskFactors.length > 0) {
      lines.push('-'.repeat(40));
      lines.push('RISK FACTORS');
      lines.push('-'.repeat(40));
      for (const factor of assessment.riskFactors) {
        lines.push(`  [${factor.severity.toUpperCase()}] ${factor.factor}`);
        lines.push(`    Evidence: ${factor.evidence}`);
        if (factor.interventionSuggestion) {
          lines.push(`    Suggested: ${factor.interventionSuggestion}`);
        }
      }
      lines.push('');
    }

    if (assessment.interventions.length > 0) {
      lines.push('-'.repeat(40));
      lines.push('RECOMMENDED INTERVENTIONS');
      lines.push('-'.repeat(40));
      for (const intervention of assessment.interventions) {
        lines.push(`  [${intervention.priority.toUpperCase()}] ${intervention.intervention}`);
        lines.push(`    Category: ${intervention.category} | Timeframe: ${intervention.timeframe}`);
        lines.push(`    Responsible: ${intervention.responsible}`);
      }
      lines.push('');
    }

    if (assessment.precautions.length > 0) {
      lines.push('-'.repeat(40));
      lines.push('FALL PRECAUTIONS');
      lines.push('-'.repeat(40));
      for (const precaution of assessment.precautions) {
        lines.push(`  • ${precaution}`);
      }
      lines.push('');
    }

    lines.push('-'.repeat(40));
    lines.push('PATIENT/FAMILY EXPLANATION');
    lines.push('-'.repeat(40));
    lines.push(assessment.plainLanguageExplanation);
    lines.push('');

    lines.push('='.repeat(60));
    lines.push(`Confidence: ${(assessment.confidence * 100).toFixed(0)}%`);
    lines.push('AI-GENERATED - REQUIRES CLINICAL REVIEW');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  /**
   * Get risk level color for UI display
   */
  getRiskLevelColor(riskCategory: string): { bg: string; text: string; border: string } {
    switch (riskCategory) {
      case 'very_high':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' };
      case 'moderate':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' };
      case 'low':
      default:
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' };
    }
  }

  /**
   * Map database record to SavedFallRiskAssessment
   */
  private mapToSavedAssessment(data: Record<string, unknown>): SavedFallRiskAssessment {
    return {
      id: data.id as string,
      assessmentId: data.assessment_id as string,
      patientId: data.patient_id as string,
      assessorId: data.assessor_id as string,
      assessmentDate: data.assessment_date as string,
      assessmentContext: data.assessment_context as string,
      overallRiskScore: data.overall_risk_score as number,
      riskCategory: data.risk_category as FallRiskAssessment['riskCategory'],
      morseScaleEstimate: data.morse_scale_estimate as number,
      riskFactors: (data.risk_factors as RiskFactor[]) || [],
      protectiveFactors: (data.protective_factors as ProtectiveFactor[]) || [],
      patientAge: data.patient_age as number | null,
      ageRiskCategory: data.age_risk_category as FallRiskAssessment['ageRiskCategory'],
      categoryScores: (data.category_scores as CategoryScores) || {
        age: 0,
        fallHistory: 0,
        medications: 0,
        conditions: 0,
        mobility: 0,
        cognitive: 0,
        sensory: 0,
        environmental: 0,
      },
      interventions: (data.interventions as FallRiskIntervention[]) || [],
      precautions: (data.precautions as string[]) || [],
      monitoringFrequency: data.monitoring_frequency as FallRiskAssessment['monitoringFrequency'],
      confidence: data.confidence as number,
      requiresReview: data.requires_review as boolean,
      reviewReasons: (data.review_reasons as string[]) || [],
      plainLanguageExplanation: data.plain_language_explanation as string,
      generatedAt: data.created_at as string,
      status: data.status as SavedFallRiskAssessment['status'],
      reviewedBy: data.reviewed_by as string | undefined,
      reviewedAt: data.reviewed_at as string | undefined,
      reviewNotes: data.review_notes as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

// Export singleton instance
export const fallRiskPredictorService = new FallRiskPredictorService();
