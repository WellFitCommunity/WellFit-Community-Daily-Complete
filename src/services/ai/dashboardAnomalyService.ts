/**
 * Dashboard Anomaly Detection AI Service
 *
 * Analyzes dashboard metrics and detects anomalies, trends, and actionable insights.
 * Uses Claude Haiku for cost-effective, real-time analysis.
 *
 * @module DashboardAnomalyService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure as _failure } from '../_base';

export interface MetricData {
  name: string;
  current: number;
  previous?: number;
  average?: number;
  unit?: string;
  threshold?: { warning: number; critical: number };
}

export interface AnomalyDetectionRequest {
  dashboardType: string;
  metrics: MetricData[];
  timeRange?: string;
  tenantId?: string;
}

export interface DetectedAnomaly {
  metric_name: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'spike' | 'drop' | 'trend' | 'threshold' | 'pattern';
  description: string;
  recommendation: string;
  confidence: number;
}

export interface DashboardInsight {
  title: string;
  summary: string;
  key_observations: string[];
  anomalies: DetectedAnomaly[];
  recommendations: string[];
  trend_analysis: string;
}

export interface AnomalyResponse {
  insights: DashboardInsight;
  metadata: {
    analyzed_at: string;
    metrics_count: number;
    model: string;
  };
}

// Threshold-based anomaly detection (rule-based, runs locally)
function detectThresholdAnomalies(metrics: MetricData[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const metric of metrics) {
    // Check against defined thresholds
    if (metric.threshold) {
      if (metric.current >= metric.threshold.critical) {
        anomalies.push({
          metric_name: metric.name,
          severity: 'critical',
          type: 'threshold',
          description: `${metric.name} is at critical level: ${metric.current}${metric.unit || ''}`,
          recommendation: 'Immediate attention required',
          confidence: 1.0,
        });
      } else if (metric.current >= metric.threshold.warning) {
        anomalies.push({
          metric_name: metric.name,
          severity: 'warning',
          type: 'threshold',
          description: `${metric.name} exceeded warning threshold: ${metric.current}${metric.unit || ''}`,
          recommendation: 'Monitor closely and investigate',
          confidence: 1.0,
        });
      }
    }

    // Detect significant changes from previous period
    if (metric.previous !== undefined && metric.previous > 0) {
      const changePercent = ((metric.current - metric.previous) / metric.previous) * 100;

      if (Math.abs(changePercent) >= 50) {
        const type = changePercent > 0 ? 'spike' : 'drop';
        anomalies.push({
          metric_name: metric.name,
          severity: Math.abs(changePercent) >= 100 ? 'critical' : 'warning',
          type,
          description: `${metric.name} ${type === 'spike' ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(1)}%`,
          recommendation: `Investigate the ${type} in ${metric.name}`,
          confidence: 0.9,
        });
      }
    }

    // Detect deviation from average
    if (metric.average !== undefined && metric.average > 0) {
      const deviation = Math.abs((metric.current - metric.average) / metric.average) * 100;

      if (deviation >= 100) {
        anomalies.push({
          metric_name: metric.name,
          severity: deviation >= 200 ? 'critical' : 'warning',
          type: 'pattern',
          description: `${metric.name} is ${deviation.toFixed(0)}% ${metric.current > metric.average ? 'above' : 'below'} average`,
          recommendation: 'Review for unusual patterns or data issues',
          confidence: 0.85,
        });
      }
    }
  }

  return anomalies;
}

export class DashboardAnomalyService {
  /**
   * Analyze dashboard metrics for anomalies and insights
   */
  static async analyzeMetrics(
    request: AnomalyDetectionRequest
  ): Promise<ServiceResult<AnomalyResponse>> {
    try {
      // First, run local threshold-based detection
      const localAnomalies = detectThresholdAnomalies(request.metrics);

      // Then, get AI-powered insights
      const { data, error: _error } = await supabase.functions.invoke('claude-personalization', {
        body: {
          model: 'claude-3-5-haiku-20241022',
          prompt: buildAnalysisPrompt(request, localAnomalies),
          userId: request.tenantId || 'system',
          requestType: 'dashboard_anomaly_detection',
        },
      });

      if (_error) throw _error;

      // Parse AI response
      const aiContent = data?.content || '';
      let insights: DashboardInsight;

      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          insights = JSON.parse(jsonMatch[0]);
          // Merge local anomalies with AI-detected ones
          insights.anomalies = [
            ...localAnomalies,
            ...(insights.anomalies || []),
          ];
        } else {
          throw new Error('No JSON in response');
        }
      } catch {
        // Fallback to local analysis only
        insights = {
          title: `${request.dashboardType} Analysis`,
          summary: `Analyzed ${request.metrics.length} metrics`,
          key_observations: [],
          anomalies: localAnomalies,
          recommendations: localAnomalies.map((a) => a.recommendation),
          trend_analysis: 'AI analysis unavailable',
        };
      }

      return success({
        insights,
        metadata: {
          analyzed_at: new Date().toISOString(),
          metrics_count: request.metrics.length,
          model: 'claude-3-5-haiku-20241022',
        },
      });
    } catch (err: unknown) {
      const _error = err instanceof Error ? err : new Error(String(err));

      // Return local-only analysis on AI failure
      const localAnomalies = detectThresholdAnomalies(request.metrics);

      return success({
        insights: {
          title: `${request.dashboardType} Analysis`,
          summary: `Local analysis of ${request.metrics.length} metrics (AI unavailable)`,
          key_observations: [],
          anomalies: localAnomalies,
          recommendations: localAnomalies.map((a) => a.recommendation),
          trend_analysis: 'AI analysis unavailable - showing rule-based detection only',
        },
        metadata: {
          analyzed_at: new Date().toISOString(),
          metrics_count: request.metrics.length,
          model: 'local-rules',
        },
      });
    }
  }

  /**
   * Quick check for critical anomalies (fast, no AI call)
   */
  static detectCriticalAnomalies(metrics: MetricData[]): DetectedAnomaly[] {
    return detectThresholdAnomalies(metrics).filter(
      (a) => a.severity === 'critical'
    );
  }

  /**
   * Get anomaly summary for a specific metric
   */
  static getMetricStatus(metric: MetricData): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
  } {
    const anomalies = detectThresholdAnomalies([metric]);

    const critical = anomalies.find((a) => a.severity === 'critical');
    if (critical) {
      return {
        status: 'critical',
        message: critical.description,
      };
    }

    const warning = anomalies.find((a) => a.severity === 'warning');
    if (warning) {
      return {
        status: 'warning',
        message: warning.description,
      };
    }

    return { status: 'healthy', message: 'Metric within normal range' };
  }
}

function buildAnalysisPrompt(
  request: AnomalyDetectionRequest,
  localAnomalies: DetectedAnomaly[]
): string {
  const metricsText = request.metrics
    .map((m) => {
      let text = `- ${m.name}: ${m.current}${m.unit || ''}`;
      if (m.previous !== undefined) text += ` (previous: ${m.previous})`;
      if (m.average !== undefined) text += ` (avg: ${m.average})`;
      return text;
    })
    .join('\n');

  const anomaliesText =
    localAnomalies.length > 0
      ? `\nDETECTED ANOMALIES:\n${localAnomalies.map((a) => `- ${a.description}`).join('\n')}`
      : '';

  return `Analyze these ${request.dashboardType} dashboard metrics and provide insights.

METRICS:
${metricsText}
${anomaliesText}

TIME RANGE: ${request.timeRange || 'Current period'}

Provide a JSON response with:
{
  "title": "Brief analysis title",
  "summary": "2-3 sentence executive summary",
  "key_observations": ["3-5 key observations"],
  "anomalies": [
    {
      "metric_name": "metric",
      "severity": "warning|critical|info",
      "type": "spike|drop|trend|pattern",
      "description": "What was detected",
      "recommendation": "What to do",
      "confidence": 0.85
    }
  ],
  "recommendations": ["2-4 actionable recommendations"],
  "trend_analysis": "Brief trend summary"
}

Focus on actionable insights. Return ONLY the JSON.`;
}

export default DashboardAnomalyService;
