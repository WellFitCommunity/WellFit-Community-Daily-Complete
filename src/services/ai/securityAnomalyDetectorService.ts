/**
 * Security Anomaly Detector Service
 *
 * ML-powered behavioral analysis detecting unusual access patterns,
 * potential breaches, and insider threats in real-time.
 *
 * Features:
 * - Real-time access pattern analysis
 * - Baseline behavior modeling
 * - Anomaly scoring and classification
 * - Threat correlation
 * - Automated alerting
 * - Investigation support
 *
 * @module securityAnomalyDetectorService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnomalyType =
  | 'access_pattern'
  | 'data_exfiltration'
  | 'privilege_escalation'
  | 'brute_force'
  | 'insider_threat'
  | 'account_compromise'
  | 'unusual_location'
  | 'off_hours_access'
  | 'bulk_access'
  | 'policy_violation';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';

export interface AccessEvent {
  timestamp: string;
  userId: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceType?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: { country?: string; region?: string; city?: string };
  sessionId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface BaselineBehavior {
  userId: string;
  typicalLoginTimes: Array<{ hour: number; dayOfWeek: number; frequency: number }>;
  typicalLocations: Array<{ location: string; frequency: number }>;
  typicalResources: Array<{ resource: string; frequency: number }>;
  typicalActions: Array<{ action: string; frequency: number }>;
  avgDailyActions: number;
  avgSessionDuration: number;
  lastUpdated: string;
}

export interface DetectedAnomaly {
  anomalyId: string;
  detectedAt: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceAccessed?: string;
  actionTaken?: string;
  riskScore: number;
  description: string;
  baselineDeviation: {
    metric: string;
    expected: string;
    observed: string;
    deviationPercent: number;
  };
  relatedEvents: AccessEvent[];
  indicators: string[];
  recommendations: string[];
  correlatedAnomalies?: string[];
  status: AnomalyStatus;
}

export interface ThreatAssessment {
  overallThreatLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  activeThreats: number;
  recentAnomalies24h: number;
  topAnomalyTypes: Array<{ type: AnomalyType; count: number }>;
  riskiestUsers: Array<{ userId: string; riskScore: number; anomalyCount: number }>;
  systemHealth: {
    authenticationHealth: number;
    accessControlHealth: number;
    dataProtectionHealth: number;
  };
  recommendations: string[];
}

export interface SecurityAnomalyRequest {
  events: AccessEvent[];
  userId?: string;
  timeWindowHours?: number;
  includeCorrelation?: boolean;
  tenantId?: string;
}

export interface SecurityAnomalyResponse {
  result: {
    anomalies: DetectedAnomaly[];
    threatAssessment: ThreatAssessment;
    baselineUpdates?: BaselineBehavior[];
  };
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    eventsAnalyzed: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class SecurityAnomalyDetectorService {
  /**
   * Analyze events for security anomalies
   */
  static async analyzeEvents(
    request: SecurityAnomalyRequest
  ): Promise<ServiceResult<SecurityAnomalyResponse>> {
    try {
      if (!request.events || request.events.length === 0) {
        return failure('INVALID_INPUT', 'At least one event is required for analysis');
      }

      const { data, error } = await supabase.functions.invoke('ai-security-anomaly-detector', {
        body: {
          events: request.events,
          userId: request.userId,
          timeWindowHours: request.timeWindowHours || 24,
          includeCorrelation: request.includeCorrelation ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as SecurityAnomalyResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('ANALYSIS_FAILED', error.message, error);
    }
  }

  /**
   * Save detected anomaly
   */
  static async saveAnomaly(
    anomaly: DetectedAnomaly,
    tenantId: string
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_security_anomalies')
        .insert({
          anomaly_id: anomaly.anomalyId,
          detected_at: anomaly.detectedAt,
          anomaly_type: anomaly.anomalyType,
          severity: anomaly.severity,
          user_id: anomaly.userId,
          ip_address: anomaly.ipAddress,
          user_agent: anomaly.userAgent,
          resource_accessed: anomaly.resourceAccessed,
          action_taken: anomaly.actionTaken,
          baseline_behavior: anomaly.baselineDeviation,
          detected_deviation: {
            indicators: anomaly.indicators,
            relatedEvents: anomaly.relatedEvents,
          },
          risk_score: anomaly.riskScore,
          recommendations: anomaly.recommendations,
          status: anomaly.status,
          result: anomaly,
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
   * Get open anomalies
   */
  static async getOpenAnomalies(
    tenantId: string,
    severity?: AnomalySeverity
  ): Promise<ServiceResult<DetectedAnomaly[]>> {
    try {
      let query = supabase
        .from('ai_security_anomalies')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .order('risk_score', { ascending: false });

      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data, error } = await query;

      if (error) throw error;

      return success((data || []).map((d) => d.result as DetectedAnomaly));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Update anomaly status
   */
  static async updateAnomalyStatus(
    anomalyId: string,
    status: AnomalyStatus,
    resolvedBy?: string,
    resolutionNotes?: string
  ): Promise<ServiceResult<void>> {
    try {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'resolved' || status === 'false_positive') {
        updateData.resolved_by = resolvedBy;
        updateData.resolved_at = new Date().toISOString();
        updateData.resolution_notes = resolutionNotes;
      }

      const { error } = await supabase
        .from('ai_security_anomalies')
        .update(updateData)
        .eq('anomaly_id', anomalyId);

      if (error) throw error;

      return success(undefined);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UPDATE_FAILED', error.message, error);
    }
  }

  /**
   * Get threat assessment for tenant
   */
  static async getThreatAssessment(
    tenantId: string
  ): Promise<ServiceResult<ThreatAssessment>> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get recent anomalies
      const { data: recentAnomalies, error: anomalyError } = await supabase
        .from('ai_security_anomalies')
        .select('anomaly_type, severity, risk_score, user_id, status')
        .eq('tenant_id', tenantId)
        .gte('detected_at', twentyFourHoursAgo);

      if (anomalyError) throw anomalyError;

      const anomalies = recentAnomalies || [];

      // Calculate metrics
      const activeThreats = anomalies.filter((a) => a.status === 'open').length;
      const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
      const highCount = anomalies.filter((a) => a.severity === 'high').length;

      // Determine threat level
      let overallThreatLevel: ThreatAssessment['overallThreatLevel'] = 'low';
      if (criticalCount > 0) overallThreatLevel = 'critical';
      else if (highCount > 2) overallThreatLevel = 'high';
      else if (highCount > 0 || anomalies.length > 10) overallThreatLevel = 'elevated';
      else if (anomalies.length > 5) overallThreatLevel = 'moderate';

      // Aggregate by type
      const typeCounts: Record<string, number> = {};
      for (const a of anomalies) {
        typeCounts[a.anomaly_type] = (typeCounts[a.anomaly_type] || 0) + 1;
      }

      // Aggregate by user
      const userRisks: Record<string, { score: number; count: number }> = {};
      for (const a of anomalies) {
        if (a.user_id) {
          if (!userRisks[a.user_id]) {
            userRisks[a.user_id] = { score: 0, count: 0 };
          }
          userRisks[a.user_id].score += a.risk_score;
          userRisks[a.user_id].count += 1;
        }
      }

      const assessment: ThreatAssessment = {
        overallThreatLevel,
        activeThreats,
        recentAnomalies24h: anomalies.length,
        topAnomalyTypes: Object.entries(typeCounts)
          .map(([type, count]) => ({ type: type as AnomalyType, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        riskiestUsers: Object.entries(userRisks)
          .map(([userId, { score, count }]) => ({
            userId,
            riskScore: score / count,
            anomalyCount: count,
          }))
          .sort((a, b) => b.riskScore - a.riskScore)
          .slice(0, 5),
        systemHealth: {
          authenticationHealth: criticalCount === 0 ? 95 : 60,
          accessControlHealth: highCount === 0 ? 90 : 70,
          dataProtectionHealth: 85,
        },
        recommendations: this.generateRecommendations(anomalies),
      };

      return success(assessment);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('ASSESSMENT_FAILED', error.message, error);
    }
  }

  /**
   * Generate recommendations based on anomalies
   */
  private static generateRecommendations(anomalies: Array<{ anomaly_type: string; severity: string }>): string[] {
    const recommendations: string[] = [];

    const types = new Set(anomalies.map((a) => a.anomaly_type));

    if (types.has('brute_force')) {
      recommendations.push('Enable account lockout policies after failed attempts');
      recommendations.push('Consider implementing CAPTCHA for login');
    }

    if (types.has('privilege_escalation')) {
      recommendations.push('Review role assignments and permission boundaries');
      recommendations.push('Implement principle of least privilege');
    }

    if (types.has('data_exfiltration')) {
      recommendations.push('Enable data loss prevention (DLP) controls');
      recommendations.push('Review bulk export permissions');
    }

    if (types.has('unusual_location')) {
      recommendations.push('Consider implementing geo-blocking for high-risk regions');
      recommendations.push('Require MFA for logins from new locations');
    }

    if (types.has('off_hours_access')) {
      recommendations.push('Review after-hours access policies');
      recommendations.push('Consider time-based access controls');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring for anomalous activity');
      recommendations.push('Ensure security awareness training is up to date');
    }

    return recommendations;
  }

  /**
   * Get user risk profile
   */
  static async getUserRiskProfile(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<{
    riskScore: number;
    anomalyCount: number;
    recentAnomalies: DetectedAnomaly[];
    riskFactors: string[];
  }>> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('ai_security_anomalies')
        .select('result, risk_score, anomaly_type')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('detected_at', thirtyDaysAgo)
        .order('detected_at', { ascending: false });

      if (error) throw error;

      const anomalies = data || [];
      const avgRiskScore =
        anomalies.length > 0
          ? anomalies.reduce((sum, a) => sum + a.risk_score, 0) / anomalies.length
          : 0;

      const riskFactors = [...new Set(anomalies.map((a) => a.anomaly_type))];

      return success({
        riskScore: avgRiskScore,
        anomalyCount: anomalies.length,
        recentAnomalies: anomalies.slice(0, 5).map((a) => a.result as DetectedAnomaly),
        riskFactors,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }
}

export default SecurityAnomalyDetectorService;
