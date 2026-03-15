/**
 * Alert Batching Service Tests
 *
 * P2-2 + P2-4: Behavioral tests for alert batching and consolidation.
 *
 * Covers:
 * - Fetch recent alerts within time window
 * - Below-threshold passthrough (< minAlerts)
 * - 5+ related alerts → 1 consolidated summary
 * - Unrelated alerts → separate dispositions
 * - Empty/single alert → passthrough
 * - MCP tool call verification
 * - MCP failure handling
 * - Full pipeline (fetch → consolidate)
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P2-2, P2-4)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceResult } from '../../_base';
import { AlertBatchingService } from '../alertBatchingService';
import type { AlertConsolidationResult } from '../alertBatchingService';

// ============================================================================
// Mocks
// ============================================================================

const { mockSelect, mockInvoke } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInvoke: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: () => ({
            in: () => ({
              gte: () => ({
                order: () => ({
                  order: () => ({
                    limit: () => mockSelect.mock.results[mockSelect.mock.results.length - 1]?.value
                      ?? { data: [], error: null },
                  }),
                }),
              }),
            }),
          }),
        };
      },
    }),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function assertSuccess<T>(result: ServiceResult<T>): asserts result is { success: true; data: T; error: null } {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected success but got failure');
}

function assertFailure(result: ServiceResult<unknown>): asserts result is { success: false; data: null; error: { code: string; message: string } } {
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure but got success');
}

/** Create a mock care_team_alerts row */
function createMockAlert(overrides: Partial<{
  id: string;
  patient_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  created_at: string;
}> = {}) {
  return {
    id: overrides.id ?? `alert-${Math.random().toString(36).slice(2, 8)}`,
    patient_id: overrides.patient_id ?? 'patient-test-001',
    alert_type: overrides.alert_type ?? 'readmission_risk_high',
    severity: overrides.severity ?? 'high',
    priority: 'urgent',
    title: overrides.title ?? 'Test Alert Alpha',
    description: overrides.description ?? 'Test alert description',
    alert_data: { skill_key: 'ai-readmission-predictor' },
    status: 'active' as const,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

function createMcpConsolidationResponse(result: AlertConsolidationResult) {
  return {
    data: {
      result: {
        content: [{ text: JSON.stringify(result) }],
      },
    },
    error: null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AlertBatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
    mockInvoke.mockReset();
  });

  describe('fetchRecentAlerts', () => {
    it('fetches active alerts within the time window', async () => {
      const alerts = [createMockAlert({ id: 'alert-1' }), createMockAlert({ id: 'alert-2' })];
      mockSelect.mockReturnValue({ data: alerts, error: null });

      const result = await AlertBatchingService.fetchRecentAlerts('patient-test-001');

      assertSuccess(result);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('alert-1');
    });

    it('returns empty array when no alerts in window', async () => {
      mockSelect.mockReturnValue({ data: [], error: null });

      const result = await AlertBatchingService.fetchRecentAlerts('patient-test-001');

      assertSuccess(result);
      expect(result.data).toHaveLength(0);
    });

    it('returns failure on database error', async () => {
      mockSelect.mockReturnValue({ data: null, error: { message: 'Connection refused' } });

      const result = await AlertBatchingService.fetchRecentAlerts('patient-test-001');

      assertFailure(result);
      expect(result.error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('consolidateAlerts', () => {
    it('passes through single alert without calling MCP', async () => {
      const alert = createMockAlert({ id: 'alert-solo' });

      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', [alert]
      );

      assertSuccess(result);
      expect(result.data.total_alerts).toBe(1);
      expect(result.data.consolidated_count).toBe(0);
      expect(result.data.alert_dispositions[0].disposition).toBe('standalone');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('passes through empty alerts without calling MCP', async () => {
      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', []
      );

      assertSuccess(result);
      expect(result.data.total_alerts).toBe(0);
      expect(result.data.consolidated_severity).toBe('none');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('calls MCP consolidation tool when alerts meet threshold', async () => {
      const alerts = [
        createMockAlert({ id: 'alert-1', severity: 'critical', alert_type: 'readmission_risk_high' }),
        createMockAlert({ id: 'alert-2', severity: 'high', alert_type: 'vitals_declining' }),
        createMockAlert({ id: 'alert-3', severity: 'medium', alert_type: 'missed_check_ins' }),
      ];

      const consolidatedResult: AlertConsolidationResult = {
        consolidated_severity: 'emergency',
        actionable_summary: 'Patient showing multi-system decline: readmission risk + declining vitals + disengagement',
        root_causes: [{
          description: 'Progressive clinical deterioration post-discharge',
          related_alert_ids: ['alert-1', 'alert-2', 'alert-3'],
          confidence: 0.85,
          recommended_intervention: 'Immediate provider contact and home health reassessment',
        }],
        alert_dispositions: [
          { alert_id: 'alert-1', disposition: 'consolidated', reasoning: 'Primary indicator of readmission risk', root_cause_index: 0 },
          { alert_id: 'alert-2', disposition: 'consolidated', reasoning: 'Supporting evidence of deterioration', root_cause_index: 0 },
          { alert_id: 'alert-3', disposition: 'consolidated', reasoning: 'Behavioral pattern consistent with decline', root_cause_index: 0 },
        ],
        total_alerts: 3,
        consolidated_count: 3,
        requires_review: true,
      };

      mockInvoke.mockResolvedValue(createMcpConsolidationResponse(consolidatedResult));

      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', alerts
      );

      assertSuccess(result);
      expect(result.data.consolidated_severity).toBe('emergency');
      expect(result.data.root_causes).toHaveLength(1);
      expect(result.data.consolidated_count).toBe(3);
      expect(result.data.requires_review).toBe(true);

      // Verify MCP tool was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('mcp-claude-server', expect.objectContaining({
        body: expect.objectContaining({
          method: 'tools/call',
          params: expect.objectContaining({
            name: 'consolidate-alerts',
            arguments: expect.objectContaining({
              patient_id: 'patient-test-001',
              tenant_id: 'tenant-test-001',
              collection_window: 'PT60S',
            }),
          }),
        }),
      }));
    });

    it('maps alert severities to escalation levels for MCP tool', async () => {
      const alerts = [
        createMockAlert({ id: 'a1', severity: 'critical' }),
        createMockAlert({ id: 'a2', severity: 'low' }),
      ];

      const consolidatedResult: AlertConsolidationResult = {
        consolidated_severity: 'emergency',
        actionable_summary: 'Mixed severity alerts',
        root_causes: [],
        alert_dispositions: [
          { alert_id: 'a1', disposition: 'standalone', reasoning: 'Critical alert', root_cause_index: null },
          { alert_id: 'a2', disposition: 'standalone', reasoning: 'Low alert', root_cause_index: null },
        ],
        total_alerts: 2,
        consolidated_count: 0,
        requires_review: false,
      };

      mockInvoke.mockResolvedValue(createMcpConsolidationResponse(consolidatedResult));

      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', alerts
      );

      assertSuccess(result);

      // Verify the alerts sent to MCP have mapped severity
      const invokeCall = mockInvoke.mock.calls[0];
      const sentAlerts = invokeCall[1].body.params.arguments.alerts as Array<{ severity: string }>;
      expect(sentAlerts[0].severity).toBe('emergency'); // critical → emergency
      expect(sentAlerts[1].severity).toBe('monitor');   // low → monitor
    });

    it('returns failure when MCP call fails', async () => {
      const alerts = [
        createMockAlert({ id: 'a1' }),
        createMockAlert({ id: 'a2' }),
      ];

      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Service unavailable' } });

      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', alerts
      );

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_FAILED');
    });

    it('returns failure when MCP returns empty response', async () => {
      const alerts = [
        createMockAlert({ id: 'a1' }),
        createMockAlert({ id: 'a2' }),
      ];

      mockInvoke.mockResolvedValue({ data: { result: { content: [] } }, error: null });

      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', alerts
      );

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_EMPTY');
    });

    it('respects custom minAlerts threshold', async () => {
      const alerts = [
        createMockAlert({ id: 'a1' }),
        createMockAlert({ id: 'a2' }),
        createMockAlert({ id: 'a3' }),
      ];

      // With minAlerts: 5, three alerts should passthrough
      const result = await AlertBatchingService.consolidateAlerts(
        'patient-test-001', 'tenant-test-001', alerts, { minAlerts: 5 }
      );

      assertSuccess(result);
      expect(result.data.consolidated_count).toBe(0);
      expect(result.data.alert_dispositions).toHaveLength(3);
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('batchAndConsolidate (full pipeline)', () => {
    it('fetches and consolidates alerts in one call', async () => {
      const alerts = [
        createMockAlert({ id: 'pipe-1', severity: 'high' }),
        createMockAlert({ id: 'pipe-2', severity: 'high' }),
      ];
      mockSelect.mockReturnValue({ data: alerts, error: null });

      const consolidatedResult: AlertConsolidationResult = {
        consolidated_severity: 'escalate',
        actionable_summary: 'Two high-severity alerts consolidated',
        root_causes: [{
          description: 'Common clinical pattern',
          related_alert_ids: ['pipe-1', 'pipe-2'],
          confidence: 0.9,
          recommended_intervention: 'Review care plan',
        }],
        alert_dispositions: [
          { alert_id: 'pipe-1', disposition: 'consolidated', reasoning: 'Related', root_cause_index: 0 },
          { alert_id: 'pipe-2', disposition: 'consolidated', reasoning: 'Related', root_cause_index: 0 },
        ],
        total_alerts: 2,
        consolidated_count: 2,
        requires_review: false,
      };

      mockInvoke.mockResolvedValue(createMcpConsolidationResponse(consolidatedResult));

      const result = await AlertBatchingService.batchAndConsolidate(
        'patient-test-001', 'tenant-test-001'
      );

      assertSuccess(result);
      expect(result.data.consolidated_count).toBe(2);
      expect(result.data.root_causes).toHaveLength(1);
    });

    it('returns passthrough when no alerts exist', async () => {
      mockSelect.mockReturnValue({ data: [], error: null });

      const result = await AlertBatchingService.batchAndConsolidate(
        'patient-test-001', 'tenant-test-001'
      );

      assertSuccess(result);
      expect(result.data.total_alerts).toBe(0);
      expect(result.data.consolidated_severity).toBe('none');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('returns failure when fetch fails', async () => {
      mockSelect.mockReturnValue({ data: null, error: { message: 'Database timeout' } });

      const result = await AlertBatchingService.batchAndConsolidate(
        'patient-test-001', 'tenant-test-001'
      );

      assertFailure(result);
      expect(result.error.code).toBe('DATABASE_ERROR');
    });
  });
});
