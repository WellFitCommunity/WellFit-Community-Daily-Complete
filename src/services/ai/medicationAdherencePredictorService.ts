/**
 * Medication Adherence Predictor Service
 *
 * Frontend service for AI-powered medication adherence prediction.
 * Analyzes patient factors to predict likelihood of medication adherence
 * and identify barriers with interventions.
 *
 * Key features:
 * - Regimen complexity analysis
 * - Barrier identification (cost, cognitive, social, access)
 * - Per-medication risk scoring
 * - Historical adherence pattern analysis
 * - Evidence-based intervention recommendations
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module medicationAdherencePredictorService
 * @skill #31 - Medication Adherence Predictor
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';
import { getNotificationService } from '../notificationService';

// ============================================================================
// Types
// ============================================================================

export type AdherenceCategory = 'excellent' | 'good' | 'moderate' | 'poor' | 'very_poor';
export type BarrierCategory = 'cost' | 'complexity' | 'side_effects' | 'cognitive' | 'social' | 'access' | 'belief' | 'physical';
export type HealthLiteracy = 'low' | 'moderate' | 'adequate' | 'high' | 'unknown';
export type SocialSupport = 'none' | 'limited' | 'moderate' | 'strong' | 'unknown';

export interface MedicationInfo {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  costTier?: 'generic' | 'preferred_brand' | 'non_preferred' | 'specialty';
  sideEffectsReported?: string[];
  startDate?: string;
}

export interface AdherenceBarrier {
  barrier: string;
  category: BarrierCategory;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  evidence: string;
  mitigable: boolean;
  interventions: string[];
}

export interface MedicationRisk {
  medication: string;
  adherenceRisk: 'low' | 'moderate' | 'high' | 'very_high';
  riskScore: number;
  riskFactors: string[];
  simplificationOpportunity?: string;
}

export interface AdherenceIntervention {
  intervention: string;
  category: 'education' | 'simplification' | 'reminder' | 'financial' | 'social_support' | 'monitoring';
  priority: 'routine' | 'recommended' | 'strongly_recommended' | 'critical';
  expectedImpact: 'low' | 'moderate' | 'high';
  implementedBy: string;
  timeframe: string;
}

export interface RegimenComplexity {
  totalMedications: number;
  dailyDoses: number;
  uniqueDoseTimes: number;
  complexityScore: number;
  complexityLevel: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

export interface HistoricalAdherence {
  refillAdherence: number;
  appointmentAdherence: number;
  checkInAdherence: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AdherencePrediction {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;

  // Overall prediction
  overallAdherenceScore: number;
  adherenceCategory: AdherenceCategory;
  confidenceLevel: number;

  // Barriers
  barriers: AdherenceBarrier[];
  primaryBarrier: string | null;
  barrierCount: number;

  // Medication analysis
  medicationRisks: MedicationRisk[];
  highRiskMedications: string[];

  // Regimen analysis
  regimenComplexity: RegimenComplexity;
  historicalAdherence?: HistoricalAdherence;

  // Interventions
  recommendedInterventions: AdherenceIntervention[];
  urgentInterventions: string[];

  // Risk summary
  riskFactorSummary: {
    factor: string;
    impact: 'low' | 'moderate' | 'high';
    modifiable: boolean;
  }[];

  // Patient context
  healthLiteracy: HealthLiteracy;
  socialSupport: SocialSupport;
  financialConcerns: boolean;
  cognitiveImpairment: boolean;

  // Review requirements
  requiresPharmacistReview: boolean;
  requiresCareCoordination: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  patientTalkingPoints: string[];
}

export interface AdherenceRequest {
  patientId: string;
  assessorId: string;
  medications?: MedicationInfo[];
  tenantId?: string;
}

export interface AdherenceResponse {
  assessment: AdherencePrediction;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
    medications_analyzed: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export const MedicationAdherencePredictorService = {
  /**
   * Predict medication adherence for a patient
   */
  async predictAdherence(
    request: AdherenceRequest
  ): Promise<ServiceResult<AdherenceResponse>> {
    try {
      const { patientId, assessorId, medications, tenantId } = request;

      if (!patientId || !assessorId) {
        return failure('VALIDATION_ERROR', 'Patient ID and Assessor ID are required');
      }

      await auditLogger.info('MEDICATION_ADHERENCE_PREDICTION_STARTED', {
        patientId: patientId.substring(0, 8) + '...',
        medicationCount: medications?.length || 'auto',
        category: 'CLINICAL',
      });

      const { data, error } = await supabase.functions.invoke('ai-medication-adherence-predictor', {
        body: {
          patientId,
          assessorId,
          medications: medications?.map(m => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            route: m.route,
            indication: m.indication,
            cost_tier: m.costTier,
            side_effects_reported: m.sideEffectsReported,
            start_date: m.startDate,
          })),
          tenantId,
        },
      });

      if (error) {
        await auditLogger.error('MEDICATION_ADHERENCE_PREDICTION_FAILED', error as Error, {
          patientId: patientId.substring(0, 8) + '...',
          category: 'CLINICAL',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'Adherence prediction failed');
      }

      await auditLogger.info('MEDICATION_ADHERENCE_PREDICTION_COMPLETED', {
        patientId: patientId.substring(0, 8) + '...',
        adherenceScore: data.assessment?.overallAdherenceScore,
        adherenceCategory: data.assessment?.adherenceCategory,
        barrierCount: data.assessment?.barrierCount,
        category: 'CLINICAL',
      });

      const assessment = data.assessment as AdherencePrediction;

      // CRITICAL: Send notification for very poor adherence or critical barriers
      const hasCriticalBarriers = assessment.barriers?.some(b => b.severity === 'critical');
      const isVeryPoorAdherence = assessment.adherenceCategory === 'very_poor' || assessment.adherenceCategory === 'poor';

      if (hasCriticalBarriers || isVeryPoorAdherence) {
        try {
          const notificationService = getNotificationService();
          const criticalBarrierList = assessment.barriers
            ?.filter(b => b.severity === 'critical' || b.severity === 'high')
            .map(b => b.barrier)
            .slice(0, 3)
            .join(', ') || 'Multiple barriers identified';

          await notificationService.sendClinicalNotification(
            { userId: assessorId },
            `⚠️ Medication Adherence Alert - Patient ${patientId.substring(0, 8)}`,
            `Predicted adherence: ${assessment.adherenceCategory?.toUpperCase()} (Score: ${assessment.overallAdherenceScore}/100). ` +
            `${hasCriticalBarriers ? 'CRITICAL BARRIERS: ' + criticalBarrierList + '. ' : ''}` +
            `${assessment.requiresPharmacistReview ? 'Pharmacist review required. ' : ''}` +
            `High-risk medications: ${assessment.highRiskMedications?.slice(0, 3).join(', ') || 'None flagged'}.`,
            {
              priority: hasCriticalBarriers ? 'urgent' : 'high',
              actionUrl: `/patients/${patientId}/medications`,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            }
          );

          // Also notify pharmacy if pharmacist review required
          if (assessment.requiresPharmacistReview) {
            await notificationService.sendClinicalNotification(
              { roleIds: ['pharmacist'] }, // Notify pharmacists
              `📋 Pharmacist Review Required - Patient ${patientId.substring(0, 8)}`,
              `Medication adherence prediction indicates pharmacist intervention needed. ` +
              `Adherence category: ${assessment.adherenceCategory}. ` +
              `Barriers: ${criticalBarrierList}. ` +
              `Urgent interventions: ${assessment.urgentInterventions?.join(', ') || 'See full assessment'}.`,
              {
                priority: 'high',
                actionUrl: `/patients/${patientId}/medications`,
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
              }
            );
          }

          await auditLogger.info('MEDICATION_ADHERENCE_ALERT_SENT', {
            patientId: patientId.substring(0, 8) + '...',
            adherenceCategory: assessment.adherenceCategory,
            hasCriticalBarriers,
            requiresPharmacistReview: assessment.requiresPharmacistReview,
          });
        } catch (notifyErr: unknown) {
          // Log but don't fail the prediction if notification fails
          await auditLogger.error('MEDICATION_ADHERENCE_NOTIFICATION_FAILED',
            notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)),
            { patientId: patientId.substring(0, 8) + '...' }
          );
        }
      }

      return success(data as AdherenceResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('MEDICATION_ADHERENCE_PREDICTION_ERROR', error, {
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get adherence prediction history for a patient
   */
  async getAdherenceHistory(
    patientId: string,
    days: number = 90
  ): Promise<ServiceResult<Array<{
    id: string;
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
        .select('id, risk_level, risk_score, confidence, summary, assessed_at')
        .eq('patient_id', patientId)
        .eq('risk_category', 'medication_adherence')
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
   * Get patients with poor adherence predictions
   */
  async getPatientsAtRisk(
    options?: {
      maxScore?: number;
      categories?: AdherenceCategory[];
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
      const maxScore = options?.maxScore || 50;
      const categories = options?.categories || ['poor', 'very_poor'];

      const { data, error } = await supabase
        .from('ai_risk_assessments')
        .select('patient_id, risk_level, risk_score, summary, assessed_at')
        .eq('risk_category', 'medication_adherence')
        .lte('risk_score', maxScore)
        .in('risk_level', categories)
        .order('risk_score', { ascending: true })
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
   * Get color styling for adherence category
   */
  getAdherenceCategoryStyle(category: AdherenceCategory): {
    bg: string;
    text: string;
    border: string;
  } {
    switch (category) {
      case 'excellent':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' };
      case 'good':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' };
      case 'moderate':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' };
      case 'poor':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' };
      case 'very_poor':
      default:
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' };
    }
  },

  /**
   * Get label for adherence category
   */
  getAdherenceCategoryLabel(category: AdherenceCategory): string {
    switch (category) {
      case 'excellent':
        return 'Excellent - High likelihood of adherence';
      case 'good':
        return 'Good - Likely to adhere with minimal support';
      case 'moderate':
        return 'Moderate - May need support for consistent adherence';
      case 'poor':
        return 'Poor - Significant barriers to adherence';
      case 'very_poor':
      default:
        return 'Very Poor - Critical barriers requiring immediate intervention';
    }
  },

  /**
   * Get barrier category label
   */
  getBarrierCategoryLabel(category: BarrierCategory): string {
    switch (category) {
      case 'cost':
        return 'Financial/Cost';
      case 'complexity':
        return 'Regimen Complexity';
      case 'side_effects':
        return 'Side Effects';
      case 'cognitive':
        return 'Cognitive/Memory';
      case 'social':
        return 'Social Support';
      case 'access':
        return 'Access/Transportation';
      case 'belief':
        return 'Beliefs/Concerns';
      case 'physical':
      default:
        return 'Physical Limitations';
    }
  },

  /**
   * Get icon for barrier category
   */
  getBarrierCategoryIcon(category: BarrierCategory): string {
    switch (category) {
      case 'cost':
        return '💰';
      case 'complexity':
        return '🔄';
      case 'side_effects':
        return '⚠️';
      case 'cognitive':
        return '🧠';
      case 'social':
        return '👥';
      case 'access':
        return '🚗';
      case 'belief':
        return '💭';
      case 'physical':
      default:
        return '🤲';
    }
  },

  /**
   * Format intervention priority for display
   */
  formatInterventionPriority(priority: AdherenceIntervention['priority']): {
    label: string;
    style: { bg: string; text: string };
  } {
    switch (priority) {
      case 'critical':
        return {
          label: 'CRITICAL',
          style: { bg: 'bg-red-600', text: 'text-white' },
        };
      case 'strongly_recommended':
        return {
          label: 'Strongly Recommended',
          style: { bg: 'bg-orange-500', text: 'text-white' },
        };
      case 'recommended':
        return {
          label: 'Recommended',
          style: { bg: 'bg-blue-500', text: 'text-white' },
        };
      case 'routine':
      default:
        return {
          label: 'Routine',
          style: { bg: 'bg-gray-400', text: 'text-white' },
        };
    }
  },

  /**
   * Format regimen complexity for display
   */
  formatRegimenComplexity(complexity: RegimenComplexity): string {
    const level = complexity.complexityLevel.charAt(0).toUpperCase() +
      complexity.complexityLevel.slice(1).replace('_', ' ');
    return `${level} (${complexity.totalMedications} medications, ${complexity.dailyDoses} daily doses)`;
  },

  /**
   * Get trend indicator
   */
  getTrendIndicator(trend: 'improving' | 'stable' | 'declining'): {
    icon: string;
    label: string;
    color: string;
  } {
    switch (trend) {
      case 'improving':
        return { icon: '↑', label: 'Improving', color: 'text-green-600' };
      case 'declining':
        return { icon: '↓', label: 'Declining', color: 'text-red-600' };
      case 'stable':
      default:
        return { icon: '→', label: 'Stable', color: 'text-gray-600' };
    }
  },

  /**
   * Generate patient-friendly summary
   */
  generatePatientSummary(prediction: AdherencePrediction): string {
    const lines: string[] = [];

    lines.push(`You're taking ${prediction.regimenComplexity.totalMedications} medication(s).`);

    if (prediction.barriers.length > 0) {
      lines.push(`We've identified some things that might make it harder to take your medications:`);
      prediction.barriers.slice(0, 3).forEach(b => {
        lines.push(`- ${b.barrier}`);
      });
    }

    if (prediction.urgentInterventions.length > 0) {
      lines.push(`\nLet's work together on:`);
      prediction.urgentInterventions.forEach(i => {
        lines.push(`- ${i}`);
      });
    }

    return lines.join('\n');
  },
};

export default MedicationAdherencePredictorService;
