/**
 * PHI Exposure Risk Scorer Service
 *
 * Assesses risk of PHI exposure based on access patterns, data sensitivity,
 * user roles, and compliance requirements.
 *
 * Features:
 * - Access pattern risk analysis
 * - Data sensitivity classification
 * - Role appropriateness validation
 * - Temporal pattern analysis
 * - Exposure event correlation
 * - Mitigation recommendations
 *
 * @module phiExposureRiskScorerService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ScopeType = 'user' | 'role' | 'department' | 'system';
export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted' | 'phi' | 'pii';

export interface AccessPattern {
  userId: string;
  resourceType: string;
  accessCount: number;
  uniquePatients: number;
  avgRecordsPerAccess: number;
  accessTimes: string[];
  accessMethods: string[];
  exportCount: number;
  printCount: number;
}

export interface DataClassification {
  resourceType: string;
  sensitivityLevel: DataSensitivity;
  phiElements: string[];
  retentionPolicy: string;
  encryptionStatus: 'encrypted' | 'unencrypted' | 'partial';
  accessControls: string[];
}

export interface RoleAppropriatenessCheck {
  userId: string;
  role: string;
  department: string;
  accessedResources: string[];
  appropriateAccess: string[];
  questionableAccess: string[];
  inappropriateAccess: string[];
  accessJustifications: Record<string, string>;
}

export interface RiskFactor {
  factor: string;
  category: 'access' | 'data' | 'role' | 'temporal' | 'behavioral';
  severity: RiskLevel;
  score: number;
  description: string;
  evidence: string[];
  mitigationActions: string[];
}

export interface PHIExposureScore {
  scoreId: string;
  scoredAt: string;
  scope: ScopeType;
  scopeId: string;
  scopeName?: string;
  overallRiskScore: number;
  riskLevel: RiskLevel;
  accessPatternScore: number;
  dataSensitivityScore: number;
  roleAppropriatenessScore: number;
  temporalPatternScore: number;
  riskFactors: RiskFactor[];
  topExposures: Array<{
    resourceType: string;
    exposureType: string;
    riskScore: number;
    patientCount: number;
    description: string;
  }>;
  complianceImpact: {
    hipaaRisk: RiskLevel;
    affectedSafeguards: string[];
    regulatoryExposure: string[];
  };
  mitigationRecommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
    expectedRiskReduction: number;
    implementationEffort: 'low' | 'medium' | 'high';
    affectedFactors: string[];
  }>;
  trendData: Array<{
    date: string;
    score: number;
  }>;
}

export interface PHIExposureRequest {
  scope: ScopeType;
  scopeId: string;
  accessPatterns?: AccessPattern[];
  timeWindowDays?: number;
  includeRecommendations?: boolean;
  compareToPrevious?: boolean;
  tenantId?: string;
}

export interface PHIExposureResponse {
  result: PHIExposureScore;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    dataPointsAnalyzed: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class PHIExposureRiskScorerService {
  /**
   * Calculate PHI exposure risk score
   */
  static async calculateRiskScore(
    request: PHIExposureRequest
  ): Promise<ServiceResult<PHIExposureResponse>> {
    try {
      if (!request.scope || !request.scopeId) {
        return failure('INVALID_INPUT', 'Scope and scope ID are required');
      }

      const { data, error } = await supabase.functions.invoke('ai-phi-exposure-scorer', {
        body: {
          scope: request.scope,
          scopeId: request.scopeId,
          accessPatterns: request.accessPatterns,
          timeWindowDays: request.timeWindowDays || 30,
          includeRecommendations: request.includeRecommendations ?? true,
          compareToPrevious: request.compareToPrevious ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as PHIExposureResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SCORING_FAILED', error.message, error);
    }
  }

  /**
   * Save risk score
   */
  static async saveScore(
    request: PHIExposureRequest,
    response: PHIExposureResponse
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_phi_exposure_scores')
        .insert({
          score_id: response.result.scoreId,
          scored_at: response.result.scoredAt,
          scope: request.scope,
          scope_id: request.scopeId,
          overall_risk_score: response.result.overallRiskScore,
          risk_level: response.result.riskLevel,
          access_pattern_score: response.result.accessPatternScore,
          data_sensitivity_score: response.result.dataSensitivityScore,
          role_appropriateness_score: response.result.roleAppropriatenessScore,
          temporal_pattern_score: response.result.temporalPatternScore,
          risk_factors: response.result.riskFactors,
          mitigation_recommendations: response.result.mitigationRecommendations,
          result: response.result,
          tenant_id: request.tenantId,
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
   * Get high-risk users
   */
  static async getHighRiskUsers(
    tenantId: string,
    threshold: number = 70
  ): Promise<ServiceResult<Array<{ userId: string; riskScore: number; riskLevel: RiskLevel }>>> {
    try {
      const { data, error } = await supabase
        .from('ai_phi_exposure_scores')
        .select('scope_id, overall_risk_score, risk_level')
        .eq('tenant_id', tenantId)
        .eq('scope', 'user')
        .gte('overall_risk_score', threshold)
        .order('overall_risk_score', { ascending: false });

      if (error) throw error;

      return success(
        (data || []).map((d) => ({
          userId: d.scope_id,
          riskScore: d.overall_risk_score,
          riskLevel: d.risk_level as RiskLevel,
        }))
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get department risk summary
   */
  static async getDepartmentRiskSummary(
    tenantId: string
  ): Promise<ServiceResult<Array<{ department: string; avgRiskScore: number; riskLevel: RiskLevel; userCount: number }>>> {
    try {
      const { data, error } = await supabase
        .from('ai_phi_exposure_scores')
        .select('scope_id, overall_risk_score, risk_level')
        .eq('tenant_id', tenantId)
        .eq('scope', 'department')
        .order('overall_risk_score', { ascending: false });

      if (error) throw error;

      // In a real implementation, we'd aggregate by department
      // For now, return the direct query results
      return success(
        (data || []).map((d) => ({
          department: d.scope_id,
          avgRiskScore: d.overall_risk_score,
          riskLevel: d.risk_level as RiskLevel,
          userCount: 0, // Would need a join to get actual count
        }))
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get risk score history
   */
  static async getRiskScoreHistory(
    scope: ScopeType,
    scopeId: string,
    tenantId: string,
    days: number = 90
  ): Promise<ServiceResult<Array<{ date: string; score: number }>>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('ai_phi_exposure_scores')
        .select('scored_at, overall_risk_score')
        .eq('tenant_id', tenantId)
        .eq('scope', scope)
        .eq('scope_id', scopeId)
        .gte('scored_at', startDate)
        .order('scored_at', { ascending: true });

      if (error) throw error;

      return success(
        (data || []).map((d) => ({
          date: d.scored_at,
          score: d.overall_risk_score,
        }))
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get system-wide risk dashboard data
   */
  static async getSystemRiskDashboard(
    tenantId: string
  ): Promise<ServiceResult<{
    overallRiskScore: number;
    riskLevel: RiskLevel;
    criticalUsers: number;
    highRiskUsers: number;
    topRiskFactors: RiskFactor[];
    recentScoreChange: number;
  }>> {
    try {
      // Get most recent system-level score
      const { data: systemScore, error: systemError } = await supabase
        .from('ai_phi_exposure_scores')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('scope', 'system')
        .order('scored_at', { ascending: false })
        .limit(1)
        .single();

      if (systemError && systemError.code !== 'PGRST116') throw systemError;

      // Get user risk counts
      const { data: userScores, error: userError } = await supabase
        .from('ai_phi_exposure_scores')
        .select('risk_level')
        .eq('tenant_id', tenantId)
        .eq('scope', 'user');

      if (userError) throw userError;

      const criticalUsers = (userScores || []).filter((s) => s.risk_level === 'critical').length;
      const highRiskUsers = (userScores || []).filter((s) => s.risk_level === 'high').length;

      const result = systemScore?.result as PHIExposureScore | undefined;

      return success({
        overallRiskScore: result?.overallRiskScore || 0,
        riskLevel: result?.riskLevel || 'low',
        criticalUsers,
        highRiskUsers,
        topRiskFactors: result?.riskFactors?.slice(0, 5) || [],
        recentScoreChange: 0, // Would calculate from trend data
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Quick risk check for a specific access
   */
  static calculateQuickRiskScore(
    accessPattern: AccessPattern,
    dataClassification: DataClassification
  ): { score: number; level: RiskLevel; factors: string[] } {
    let score = 0;
    const factors: string[] = [];

    // High access count
    if (accessPattern.accessCount > 100) {
      score += 20;
      factors.push('High access volume');
    }

    // Many unique patients
    if (accessPattern.uniquePatients > 50) {
      score += 15;
      factors.push('Access to many patient records');
    }

    // Data exports
    if (accessPattern.exportCount > 0) {
      score += 25;
      factors.push('Data export activity');
    }

    // Print activity
    if (accessPattern.printCount > 10) {
      score += 10;
      factors.push('Frequent printing');
    }

    // Data sensitivity
    if (dataClassification.sensitivityLevel === 'phi') {
      score += 20;
      factors.push('PHI data access');
    } else if (dataClassification.sensitivityLevel === 'restricted') {
      score += 15;
      factors.push('Restricted data access');
    }

    // Unencrypted data
    if (dataClassification.encryptionStatus === 'unencrypted') {
      score += 15;
      factors.push('Unencrypted data exposure');
    }

    // Determine level
    let level: RiskLevel = 'low';
    if (score >= 80) level = 'critical';
    else if (score >= 60) level = 'high';
    else if (score >= 40) level = 'medium';

    return { score: Math.min(score, 100), level, factors };
  }
}

export default PHIExposureRiskScorerService;
