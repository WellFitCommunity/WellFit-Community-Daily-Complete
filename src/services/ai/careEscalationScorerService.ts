/**
 * Care Escalation Scorer Service
 *
 * Frontend service for AI-powered care escalation scoring.
 * Provides confidence-level escalation decisions for patient care,
 * integrating with shift handoff and care coordination systems.
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module careEscalationScorerService
 * @skill #32 - Care Escalation Scorer
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';
import { getNotificationService } from '../notificationService';

// ============================================================================
// Types
// ============================================================================

export type EscalationCategory = 'none' | 'monitor' | 'notify' | 'escalate' | 'emergency';
export type UrgencyLevel = 'routine' | 'elevated' | 'urgent' | 'critical';
export type AssessmentContext = 'shift_handoff' | 'routine_assessment' | 'condition_change' | 'urgent_review';

export interface ClinicalIndicator {
  indicator: string;
  category: 'vital_signs' | 'labs' | 'symptoms' | 'functional_status' | 'behavioral';
  currentValue: string;
  trend: 'improving' | 'stable' | 'worsening' | 'critical';
  weight: number;
  concernLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface EscalationFactor {
  factor: string;
  category: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  evidence: string;
  weight: number;
}

export interface EscalationRecommendation {
  action: string;
  urgency: 'routine' | 'soon' | 'urgent' | 'immediate';
  responsible: string;
  timeframe: string;
  rationale: string;
}

export interface EscalationScore {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;
  context: string;

  // Scores
  overallEscalationScore: number;
  confidenceLevel: number;
  escalationCategory: EscalationCategory;
  urgencyLevel: UrgencyLevel;

  // Clinical indicators
  clinicalIndicators: ClinicalIndicator[];
  escalationFactors: EscalationFactor[];
  protectiveFactors: string[];

  // Trend analysis
  overallTrend: 'improving' | 'stable' | 'declining' | 'rapidly_declining';
  trendConfidence: number;
  hoursToReassess: number;

  // Recommendations
  recommendations: EscalationRecommendation[];
  requiredNotifications: string[];
  documentationRequired: string[];

  // Safety
  requiresPhysicianReview: boolean;
  requiresRapidResponse: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  handoffPriority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationRequest {
  patientId: string;
  assessorId: string;
  context?: AssessmentContext;
  triggerReason?: string;
}

export interface EscalationResponse {
  assessment: EscalationScore;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
  };
}

// ============================================================================
// Service
// ============================================================================

export const CareEscalationScorerService = {
  /**
   * Score a patient for care escalation needs
   */
  async scorePatient(
    request: EscalationRequest
  ): Promise<ServiceResult<EscalationResponse>> {
    try {
      const { patientId, assessorId, context, triggerReason } = request;

      if (!patientId || !assessorId) {
        return failure('VALIDATION_ERROR', 'Patient ID and Assessor ID are required');
      }

      await auditLogger.info('CARE_ESCALATION_SCORING_STARTED', {
        patientId: patientId.substring(0, 8) + '...',
        context: context || 'routine_assessment',
        category: 'CLINICAL',
      });

      const { data, error } = await supabase.functions.invoke('ai-care-escalation-scorer', {
        body: {
          patientId,
          assessorId,
          context: context || 'routine_assessment',
          triggerReason,
        },
      });

      if (error) {
        await auditLogger.error('CARE_ESCALATION_SCORING_FAILED', error as Error, {
          patientId: patientId.substring(0, 8) + '...',
          category: 'CLINICAL',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'Escalation scoring failed');
      }

      await auditLogger.info('CARE_ESCALATION_SCORING_COMPLETED', {
        patientId: patientId.substring(0, 8) + '...',
        escalationCategory: data.assessment?.escalationCategory,
        overallScore: data.assessment?.overallEscalationScore,
        category: 'CLINICAL',
      });

      const assessment = data.assessment as EscalationScore;

      // CRITICAL: Send immediate notification for emergency escalation or rapid response
      const isEmergency = assessment.escalationCategory === 'emergency';
      const needsRapidResponse = assessment.requiresRapidResponse;
      const isCriticalUrgency = assessment.urgencyLevel === 'critical';

      if (isEmergency || needsRapidResponse || isCriticalUrgency) {
        try {
          const notificationService = getNotificationService();
          const criticalIndicators = assessment.clinicalIndicators
            ?.filter(i => i.concernLevel === 'critical' || i.concernLevel === 'high')
            .map(i => `${i.indicator}: ${i.currentValue} (${i.trend})`)
            .slice(0, 3)
            .join('; ') || 'See assessment';

          const immediateActions = assessment.recommendations
            ?.filter(r => r.urgency === 'immediate' || r.urgency === 'urgent')
            .map(r => r.action)
            .slice(0, 3)
            .join('; ') || 'Review patient immediately';

          // Send URGENT notification to assessor and on-call team
          await notificationService.sendClinicalNotification(
            { userId: assessorId },
            `🚨 ${isEmergency ? 'EMERGENCY' : 'URGENT'}: Care Escalation - Patient ${patientId.substring(0, 8)}`,
            `Escalation: ${assessment.escalationCategory?.toUpperCase()} (Score: ${assessment.overallEscalationScore}/100). ` +
            `Urgency: ${assessment.urgencyLevel?.toUpperCase()}. ` +
            `${needsRapidResponse ? '⚡ RAPID RESPONSE REQUIRED. ' : ''}` +
            `Critical indicators: ${criticalIndicators}. ` +
            `Immediate actions: ${immediateActions}.`,
            {
              priority: 'urgent',
              actionUrl: `/patients/${patientId}/escalation`,
              expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // 1 hour (urgent!)
            }
          );

          // Also notify physician if physician review required
          if (assessment.requiresPhysicianReview) {
            await notificationService.sendClinicalNotification(
              { roleIds: ['physician'] }, // Notify on-call physicians
              `🩺 Physician Review Required - Patient ${patientId.substring(0, 8)}`,
              `Care escalation score indicates physician intervention needed. ` +
              `Category: ${assessment.escalationCategory}. Urgency: ${assessment.urgencyLevel}. ` +
              `${needsRapidResponse ? 'RAPID RESPONSE TEAM may be needed. ' : ''}` +
              `Summary: ${assessment.clinicalSummary?.substring(0, 200) || 'See full assessment'}...`,
              {
                priority: 'urgent',
                actionUrl: `/patients/${patientId}/escalation`,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
              }
            );
          }

          await auditLogger.info('CARE_ESCALATION_ALERT_SENT', {
            patientId: patientId.substring(0, 8) + '...',
            escalationCategory: assessment.escalationCategory,
            urgencyLevel: assessment.urgencyLevel,
            requiresRapidResponse: needsRapidResponse,
            requiresPhysicianReview: assessment.requiresPhysicianReview,
          });
        } catch (notifyErr: unknown) {
          // CRITICAL: For emergency alerts, we should log this prominently but not fail
          await auditLogger.error('CARE_ESCALATION_NOTIFICATION_FAILED',
            notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)),
            {
              patientId: patientId.substring(0, 8) + '...',
              escalationCategory: assessment.escalationCategory,
              CRITICAL: 'Emergency notification delivery failed - manual intervention may be required'
            }
          );
        }
      }

      return success(data as EscalationResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARE_ESCALATION_SCORING_ERROR', error, {
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Score for shift handoff
   */
  async scoreForHandoff(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<EscalationResponse>> {
    return this.scorePatient({
      patientId,
      assessorId,
      context: 'shift_handoff',
    });
  },

  /**
   * Score after condition change
   */
  async scoreConditionChange(
    patientId: string,
    assessorId: string,
    changeDescription: string
  ): Promise<ServiceResult<EscalationResponse>> {
    return this.scorePatient({
      patientId,
      assessorId,
      context: 'condition_change',
      triggerReason: changeDescription,
    });
  },

  /**
   * Urgent review scoring
   */
  async urgentReview(
    patientId: string,
    assessorId: string,
    urgentReason: string
  ): Promise<ServiceResult<EscalationResponse>> {
    return this.scorePatient({
      patientId,
      assessorId,
      context: 'urgent_review',
      triggerReason: urgentReason,
    });
  },

  /**
   * Batch score multiple patients (for shift handoff)
   */
  async batchScoreForHandoff(
    patientIds: string[],
    assessorId: string
  ): Promise<ServiceResult<EscalationResponse[]>> {
    try {
      const results: EscalationResponse[] = [];

      for (const patientId of patientIds) {
        const result = await this.scoreForHandoff(patientId, assessorId);
        if (result.success && result.data) {
          results.push(result.data);
        }
      }

      return success(results);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('AI_SERVICE_ERROR', error.message);
    }
  },

  /**
   * Get escalation history for a patient
   */
  async getEscalationHistory(
    patientId: string,
    days: number = 7
  ): Promise<ServiceResult<Array<{
    id: string;
    risk_category: string;
    risk_level: string;
    risk_score: number;
    confidence: number;
    summary: string;
    assessed_at: string;
  }>>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('ai_risk_assessments')
        .select('id, risk_category, risk_level, risk_score, confidence, summary, assessed_at')
        .eq('patient_id', patientId)
        .eq('risk_category', 'care_escalation')
        .gte('assessed_at', startDate)
        .order('assessed_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data || []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get patients requiring escalation
   */
  async getPatientsRequiringEscalation(
    options?: {
      minScore?: number;
      categories?: EscalationCategory[];
      limit?: number;
    }
  ): Promise<ServiceResult<Array<{
    patient_id: string;
    risk_level: string;
    risk_score: number;
    summary: string;
    assessed_at: string;
  }>>> {
    try {
      const minScore = options?.minScore || 40;
      const categories = options?.categories || ['notify', 'escalate', 'emergency'];

      const { data, error } = await supabase
        .from('ai_risk_assessments')
        .select('patient_id, risk_level, risk_score, summary, assessed_at')
        .eq('risk_category', 'care_escalation')
        .gte('risk_score', minScore)
        .in('risk_level', categories)
        .order('risk_score', { ascending: false })
        .limit(options?.limit || 50);

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data || []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get color styling for escalation category
   */
  getEscalationCategoryStyle(category: EscalationCategory): {
    bg: string;
    text: string;
    border: string;
  } {
    switch (category) {
      case 'emergency':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' };
      case 'escalate':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' };
      case 'notify':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' };
      case 'monitor':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' };
      case 'none':
      default:
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' };
    }
  },

  /**
   * Get label for escalation category
   */
  getEscalationCategoryLabel(category: EscalationCategory): string {
    switch (category) {
      case 'emergency':
        return 'Emergency - Immediate Response Required';
      case 'escalate':
        return 'Escalate - Physician Notification Required';
      case 'notify':
        return 'Notify - Increased Monitoring Needed';
      case 'monitor':
        return 'Monitor - Continue Current Care';
      case 'none':
      default:
        return 'Stable - No Escalation Needed';
    }
  },
};

export default CareEscalationScorerService;
