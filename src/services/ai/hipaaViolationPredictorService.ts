/**
 * HIPAA Violation Predictor Service
 *
 * Proactively identifies potential HIPAA violations before they occur
 * based on behavioral patterns and system configurations.
 *
 * Features:
 * - Predictive violation detection
 * - Risk factor analysis
 * - Regulatory mapping
 * - Preventive action recommendations
 * - Compliance gap identification
 *
 * @module hipaaViolationPredictorService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ViolationType =
  | 'access_control'
  | 'audit_control'
  | 'integrity'
  | 'transmission_security'
  | 'administrative'
  | 'physical'
  | 'breach_notification'
  | 'minimum_necessary'
  | 'authorization'
  | 'training';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PredictionStatus = 'active' | 'mitigated' | 'occurred' | 'false_positive';

export interface ContributingFactor {
  factor: string;
  category: string;
  weight: number;
  description: string;
  evidence: string[];
  remediationSteps: string[];
}

export interface RegulatoryReference {
  regulation: string;
  section: string;
  requirement: string;
  description: string;
  penaltyRange?: string;
}

export interface PreventiveAction {
  action: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  expectedEffectiveness: number;
  responsibleParty: string;
  deadline?: string;
  implementationSteps: string[];
}

export interface HIPAAViolationPrediction {
  predictionId: string;
  predictedAt: string;
  violationType: ViolationType;
  probability: number;
  riskLevel: RiskLevel;
  timeframe: string;
  description: string;
  potentialImpact: {
    patientCount: number;
    financialExposure: string;
    reputationalRisk: string;
    operationalImpact: string;
  };
  contributingFactors: ContributingFactor[];
  affectedSystems: Array<{
    system: string;
    component: string;
    vulnerability: string;
  }>;
  affectedUsers: Array<{
    userId: string;
    role: string;
    riskContribution: number;
  }>;
  preventiveActions: PreventiveAction[];
  regulatoryReferences: RegulatoryReference[];
  status: PredictionStatus;
  confidence: number;
}

export interface ComplianceGap {
  requirement: string;
  regulation: string;
  currentState: string;
  requiredState: string;
  gapSeverity: RiskLevel;
  remediationCost: string;
  remediationTimeframe: string;
}

export interface HIPAAViolationRequest {
  analysisScope?: 'full' | 'access_controls' | 'audit' | 'technical' | 'administrative';
  timeframeMonths?: number;
  includeHistoricalPatterns?: boolean;
  tenantId?: string;
}

export interface HIPAAViolationResponse {
  result: {
    predictions: HIPAAViolationPrediction[];
    complianceGaps: ComplianceGap[];
    overallComplianceScore: number;
    riskSummary: {
      criticalRisks: number;
      highRisks: number;
      mediumRisks: number;
      lowRisks: number;
      totalPredictions: number;
    };
    topPriorities: PreventiveAction[];
  };
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    factorsAnalyzed: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class HIPAAViolationPredictorService {
  /**
   * Generate HIPAA violation predictions
   */
  static async predictViolations(
    request: HIPAAViolationRequest
  ): Promise<ServiceResult<HIPAAViolationResponse>> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-hipaa-violation-predictor', {
        body: {
          analysisScope: request.analysisScope || 'full',
          timeframeMonths: request.timeframeMonths || 6,
          includeHistoricalPatterns: request.includeHistoricalPatterns ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as HIPAAViolationResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('PREDICTION_FAILED', error.message, error);
    }
  }

  /**
   * Save prediction to database
   */
  static async savePrediction(
    prediction: HIPAAViolationPrediction,
    tenantId: string
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_hipaa_violation_predictions')
        .insert({
          prediction_id: prediction.predictionId,
          predicted_at: prediction.predictedAt,
          violation_type: prediction.violationType,
          probability: prediction.probability,
          risk_level: prediction.riskLevel,
          contributing_factors: prediction.contributingFactors,
          affected_systems: prediction.affectedSystems,
          affected_users: prediction.affectedUsers,
          preventive_actions: prediction.preventiveActions,
          regulatory_references: prediction.regulatoryReferences,
          status: prediction.status,
          result: prediction,
          tenant_id: tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return success({ id: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Get active predictions
   */
  static async getActivePredictions(
    tenantId: string,
    riskLevel?: RiskLevel
  ): Promise<ServiceResult<HIPAAViolationPrediction[]>> {
    try {
      let query = supabase
        .from('ai_hipaa_violation_predictions')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('probability', { ascending: false });

      if (riskLevel) {
        query = query.eq('risk_level', riskLevel);
      }

      const { data, error } = await query;

      if (error) throw error;

      return success((data || []).map((d) => d.result as HIPAAViolationPrediction));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Update prediction status
   */
  static async updatePredictionStatus(
    predictionId: string,
    status: PredictionStatus,
    mitigatedBy?: string
  ): Promise<ServiceResult<void>> {
    try {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'mitigated') {
        updateData.mitigated_by = mitigatedBy;
        updateData.mitigated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('ai_hipaa_violation_predictions')
        .update(updateData)
        .eq('prediction_id', predictionId);

      if (error) throw error;

      return success(undefined);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UPDATE_FAILED', error.message, error);
    }
  }

  /**
   * Get compliance dashboard data
   */
  static async getComplianceDashboard(
    tenantId: string
  ): Promise<ServiceResult<{
    complianceScore: number;
    activeThreats: number;
    criticalGaps: number;
    recentPredictions: HIPAAViolationPrediction[];
    topActions: PreventiveAction[];
  }>> {
    try {
      const { data: predictions, error: predError } = await supabase
        .from('ai_hipaa_violation_predictions')
        .select('result, risk_level, status')
        .eq('tenant_id', tenantId)
        .order('predicted_at', { ascending: false })
        .limit(50);

      if (predError) throw predError;

      const activePredictions = (predictions || []).filter((p) => p.status === 'active');
      const criticalCount = activePredictions.filter((p) => p.risk_level === 'critical').length;

      // Calculate compliance score (inverse of risk)
      const avgProbability =
        activePredictions.length > 0
          ? activePredictions.reduce((sum, p) => sum + (p.result as HIPAAViolationPrediction).probability, 0) /
            activePredictions.length
          : 0;
      const complianceScore = Math.round((1 - avgProbability) * 100);

      // Get top actions from active predictions
      const allActions: PreventiveAction[] = [];
      for (const p of activePredictions.slice(0, 10)) {
        const pred = p.result as HIPAAViolationPrediction;
        allActions.push(...pred.preventiveActions);
      }

      // Sort by priority and deduplicate
      const topActions = allActions
        .sort((a, b) => {
          const priorityOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 5);

      return success({
        complianceScore,
        activeThreats: activePredictions.length,
        criticalGaps: criticalCount,
        recentPredictions: activePredictions
          .slice(0, 5)
          .map((p) => p.result as HIPAAViolationPrediction),
        topActions,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get violation type breakdown
   */
  static async getViolationTypeBreakdown(
    tenantId: string
  ): Promise<ServiceResult<Array<{ type: ViolationType; count: number; avgProbability: number }>>> {
    try {
      const { data, error } = await supabase
        .from('ai_hipaa_violation_predictions')
        .select('violation_type, probability')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (error) throw error;

      // Aggregate by type
      const typeData: Record<string, { count: number; totalProb: number }> = {};
      for (const p of data || []) {
        if (!typeData[p.violation_type]) {
          typeData[p.violation_type] = { count: 0, totalProb: 0 };
        }
        typeData[p.violation_type].count += 1;
        typeData[p.violation_type].totalProb += p.probability;
      }

      const result = Object.entries(typeData).map(([type, { count, totalProb }]) => ({
        type: type as ViolationType,
        count,
        avgProbability: totalProb / count,
      }));

      return success(result.sort((a, b) => b.avgProbability - a.avgProbability));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Generate quick risk assessment
   */
  static quickRiskAssessment(factors: {
    hasAuditLogs: boolean;
    hasAccessControls: boolean;
    hasEncryption: boolean;
    hasTraining: boolean;
    hasBaaWithVendors: boolean;
    hasIncidentPlan: boolean;
    lastRiskAssessmentMonths: number;
  }): { score: number; level: RiskLevel; gaps: string[] } {
    let score = 100;
    const gaps: string[] = [];

    if (!factors.hasAuditLogs) {
      score -= 20;
      gaps.push('Missing audit logging capability');
    }

    if (!factors.hasAccessControls) {
      score -= 25;
      gaps.push('Inadequate access controls');
    }

    if (!factors.hasEncryption) {
      score -= 20;
      gaps.push('Data encryption not implemented');
    }

    if (!factors.hasTraining) {
      score -= 10;
      gaps.push('Security awareness training not current');
    }

    if (!factors.hasBaaWithVendors) {
      score -= 15;
      gaps.push('Business Associate Agreements missing');
    }

    if (!factors.hasIncidentPlan) {
      score -= 10;
      gaps.push('Incident response plan not documented');
    }

    if (factors.lastRiskAssessmentMonths > 12) {
      score -= 10;
      gaps.push('Risk assessment overdue');
    }

    score = Math.max(0, score);

    let level: RiskLevel = 'low';
    if (score < 50) level = 'critical';
    else if (score < 70) level = 'high';
    else if (score < 85) level = 'medium';

    return { score, level, gaps };
  }
}

export default HIPAAViolationPredictorService;
