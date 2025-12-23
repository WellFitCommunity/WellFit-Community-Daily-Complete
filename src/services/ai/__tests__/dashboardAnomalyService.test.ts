/**
 * Dashboard Anomaly Detection Service Tests
 *
 * Tests for AI-powered dashboard metric analysis and anomaly detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
const mockInvoke = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { DashboardAnomalyService, MetricData } from '../dashboardAnomalyService';

describe('DashboardAnomalyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeMetrics', () => {
    it('should analyze metrics and return insights', async () => {
      const mockAIResponse = {
        content: JSON.stringify({
          title: 'Bed Management Analysis',
          summary: 'Overall metrics look healthy',
          key_observations: ['High occupancy', 'Quick turnover'],
          anomalies: [],
          recommendations: ['Monitor weekend admissions'],
          trend_analysis: 'Stable trend',
        }),
      };

      mockInvoke.mockResolvedValueOnce({ data: mockAIResponse, error: null });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Bed Management',
        metrics: [
          { name: 'Occupancy Rate', current: 85, unit: '%' },
          { name: 'Average Stay', current: 4.2, unit: ' days' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.insights.title).toBe('Bed Management Analysis');
      expect(result.data?.metadata.metrics_count).toBe(2);
    });

    it('should detect threshold anomalies locally', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { content: '{}' },
        error: null,
      });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          {
            name: 'Error Rate',
            current: 15,
            threshold: { warning: 5, critical: 10 },
          },
        ],
      });

      expect(result.success).toBe(true);
      const criticalAnomalies = result.data?.insights.anomalies.filter(
        (a) => a.severity === 'critical'
      );
      expect(criticalAnomalies?.length).toBeGreaterThan(0);
      expect(criticalAnomalies?.[0].type).toBe('threshold');
    });

    it('should detect warning thresholds', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { content: '{}' },
        error: null,
      });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          {
            name: 'Response Time',
            current: 7,
            threshold: { warning: 5, critical: 10 },
          },
        ],
      });

      expect(result.success).toBe(true);
      const warningAnomalies = result.data?.insights.anomalies.filter(
        (a) => a.severity === 'warning' && a.type === 'threshold'
      );
      expect(warningAnomalies?.length).toBeGreaterThan(0);
    });

    it('should detect significant spikes from previous period', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { content: '{}' },
        error: null,
      });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          { name: 'Requests', current: 1000, previous: 400 }, // 150% increase
        ],
      });

      expect(result.success).toBe(true);
      const spikeAnomalies = result.data?.insights.anomalies.filter(
        (a) => a.type === 'spike'
      );
      expect(spikeAnomalies?.length).toBeGreaterThan(0);
      expect(spikeAnomalies?.[0].severity).toBe('critical'); // > 100%
    });

    it('should detect significant drops from previous period', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { content: '{}' },
        error: null,
      });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          { name: 'Active Users', current: 50, previous: 100 }, // 50% decrease
        ],
      });

      expect(result.success).toBe(true);
      const dropAnomalies = result.data?.insights.anomalies.filter(
        (a) => a.type === 'drop'
      );
      expect(dropAnomalies?.length).toBeGreaterThan(0);
    });

    it('should detect deviation from average', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { content: '{}' },
        error: null,
      });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          { name: 'Processing Time', current: 500, average: 100 }, // 400% above average
        ],
      });

      expect(result.success).toBe(true);
      const patternAnomalies = result.data?.insights.anomalies.filter(
        (a) => a.type === 'pattern'
      );
      expect(patternAnomalies?.length).toBeGreaterThan(0);
    });

    it('should fallback to local analysis when AI fails', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('AI unavailable'),
      });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          { name: 'Metric', current: 100, threshold: { warning: 50, critical: 80 } },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.model).toBe('local-rules');
      expect(result.data?.insights.trend_analysis).toContain('AI analysis unavailable');
    });

    it('should merge local and AI anomalies', async () => {
      const mockAIResponse = {
        content: JSON.stringify({
          title: 'Test Analysis',
          summary: 'Test',
          key_observations: [],
          anomalies: [
            {
              metric_name: 'AI Detected',
              severity: 'info',
              type: 'trend',
              description: 'AI found a trend',
              recommendation: 'Watch it',
              confidence: 0.9,
            },
          ],
          recommendations: [],
          trend_analysis: 'Test',
        }),
      };

      mockInvoke.mockResolvedValueOnce({ data: mockAIResponse, error: null });

      const result = await DashboardAnomalyService.analyzeMetrics({
        dashboardType: 'Test',
        metrics: [
          { name: 'Error Rate', current: 15, threshold: { warning: 5, critical: 10 } },
        ],
      });

      expect(result.success).toBe(true);
      // Should have both local threshold anomaly and AI-detected trend
      expect(result.data?.insights.anomalies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectCriticalAnomalies', () => {
    it('should only return critical anomalies', () => {
      const metrics: MetricData[] = [
        { name: 'Critical', current: 100, threshold: { warning: 50, critical: 80 } },
        { name: 'Warning', current: 60, threshold: { warning: 50, critical: 100 } },
        { name: 'Normal', current: 30, threshold: { warning: 50, critical: 100 } },
      ];

      const criticalAnomalies = DashboardAnomalyService.detectCriticalAnomalies(metrics);

      expect(criticalAnomalies.length).toBe(1);
      expect(criticalAnomalies[0].metric_name).toBe('Critical');
      expect(criticalAnomalies[0].severity).toBe('critical');
    });

    it('should return empty array when no critical anomalies', () => {
      const metrics: MetricData[] = [
        { name: 'Normal', current: 30, threshold: { warning: 50, critical: 100 } },
      ];

      const criticalAnomalies = DashboardAnomalyService.detectCriticalAnomalies(metrics);

      expect(criticalAnomalies.length).toBe(0);
    });
  });

  describe('getMetricStatus', () => {
    it('should return critical status for critical threshold', () => {
      const metric: MetricData = {
        name: 'Test',
        current: 100,
        threshold: { warning: 50, critical: 80 },
      };

      const status = DashboardAnomalyService.getMetricStatus(metric);

      expect(status.status).toBe('critical');
      expect(status.message).toContain('critical level');
    });

    it('should return warning status for warning threshold', () => {
      const metric: MetricData = {
        name: 'Test',
        current: 60,
        threshold: { warning: 50, critical: 100 },
      };

      const status = DashboardAnomalyService.getMetricStatus(metric);

      expect(status.status).toBe('warning');
      expect(status.message).toContain('warning threshold');
    });

    it('should return healthy status when within range', () => {
      const metric: MetricData = {
        name: 'Test',
        current: 30,
        threshold: { warning: 50, critical: 100 },
      };

      const status = DashboardAnomalyService.getMetricStatus(metric);

      expect(status.status).toBe('healthy');
      expect(status.message).toBe('Metric within normal range');
    });

    it('should return healthy status when no thresholds defined', () => {
      const metric: MetricData = {
        name: 'Test',
        current: 100,
      };

      const status = DashboardAnomalyService.getMetricStatus(metric);

      expect(status.status).toBe('healthy');
    });

    it('should detect spike from previous as warning', () => {
      const metric: MetricData = {
        name: 'Test',
        current: 200,
        previous: 100, // 100% increase
      };

      const status = DashboardAnomalyService.getMetricStatus(metric);

      expect(status.status).toBe('critical'); // 100%+ is critical
    });

    it('should prioritize critical over warning', () => {
      const metric: MetricData = {
        name: 'Test',
        current: 100,
        previous: 40, // 150% spike (critical)
        threshold: { warning: 50, critical: 200 }, // warning only
      };

      const status = DashboardAnomalyService.getMetricStatus(metric);

      expect(status.status).toBe('critical');
    });
  });
});
