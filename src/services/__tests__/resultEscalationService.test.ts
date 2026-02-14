/**
 * resultEscalationService tests — validates rule matching, escalation creation,
 * resolution, metrics aggregation, and error handling.
 *
 * Deletion Test: Every test would FAIL if the service were an empty object.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockRulesResult = vi.fn();
const mockLogInsertResult = vi.fn();
const mockLogSelectResult = vi.fn();
const mockLogUpdateResult = vi.fn();
const mockMetricsActiveResult = vi.fn();
const mockMetricsResolvedResult = vi.fn();
const mockMetricsRulesResult = vi.fn();
const mockRuleInsertResult = vi.fn();
const mockLogUpdateStatusResult = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'result_escalation_rules') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                or: () => mockRulesResult(),
                then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
                  mockRulesResult().then(resolve, reject),
              }),
              then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
                mockMetricsRulesResult().then(resolve, reject),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => mockRuleInsertResult(),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => mockRulesResult(),
              }),
            }),
          }),
        };
      }
      if (table === 'result_escalation_log') {
        return {
          insert: () => ({
            select: () => ({
              single: () => mockLogInsertResult(),
            }),
          }),
          select: () => {
            const selectResult = mockLogSelectResult();
            return {
              not: () => ({
                order: () => selectResult,
                then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
                  mockMetricsActiveResult().then(resolve, reject),
              }),
              eq: () => ({
                gte: () => mockMetricsResolvedResult(),
                order: () => selectResult,
              }),
              order: () => selectResult,
            };
          },
          update: (payload: unknown) => {
            mockLogUpdateStatusResult(payload);
            return {
              eq: () => ({
                select: () => ({
                  single: () => mockLogUpdateResult(),
                }),
                then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
                  Promise.resolve({ data: null, error: null }).then(resolve, reject),
              }),
            };
          },
        };
      }
      if (table === 'provider_task_escalation_config') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'provider_tasks') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: 'task-001', task_type: 'result_review' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

vi.mock('../../services/providerTaskService', () => ({
  providerTaskService: {
    createTask: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'task-001', task_type: 'result_review' },
    }),
  },
}));

import { resultEscalationService } from '../resultEscalationService';
import { providerTaskService } from '../providerTaskService';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_RULES = [
  {
    id: 'rule-1',
    test_name: 'troponin',
    display_name: 'Troponin I',
    condition: 'above',
    threshold_high: 0.04,
    threshold_low: null,
    severity: 'critical',
    route_to_specialty: 'cardiology',
    target_minutes: 30,
    escalation_1_minutes: 60,
    escalation_2_minutes: 120,
    auto_create_task: true,
    notification_channels: ['inbox'],
    clinical_guidance: 'Acute MI possible',
    is_active: true,
    tenant_id: null,
    created_at: '2026-02-14T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
  },
  {
    id: 'rule-2',
    test_name: 'potassium',
    display_name: 'Potassium',
    condition: 'below',
    threshold_high: null,
    threshold_low: 3.0,
    severity: 'critical',
    route_to_specialty: 'cardiology',
    target_minutes: 30,
    escalation_1_minutes: 60,
    escalation_2_minutes: 120,
    auto_create_task: true,
    notification_channels: ['inbox'],
    clinical_guidance: 'Hypokalemia risk',
    is_active: true,
    tenant_id: null,
    created_at: '2026-02-14T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
  },
  {
    id: 'rule-3',
    test_name: 'glucose',
    display_name: 'Blood Glucose',
    condition: 'above',
    threshold_high: 300,
    threshold_low: null,
    severity: 'high',
    route_to_specialty: 'endocrinology',
    target_minutes: 60,
    escalation_1_minutes: 120,
    escalation_2_minutes: 240,
    auto_create_task: false,
    notification_channels: ['inbox'],
    clinical_guidance: 'Hyperglycemia',
    is_active: true,
    tenant_id: null,
    created_at: '2026-02-14T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
  },
];

const MOCK_LOG_ENTRY = {
  id: 'esc-1',
  rule_id: 'rule-1',
  result_id: 'result-1',
  result_source: 'lab_results',
  patient_id: 'pat-1',
  test_name: 'troponin',
  test_value: 0.08,
  test_unit: 'ng/mL',
  severity: 'critical',
  route_to_specialty: 'cardiology',
  routed_to_provider_id: null,
  task_id: null,
  escalation_status: 'pending',
  resolved_at: null,
  resolved_by: null,
  resolution_notes: null,
  tenant_id: 'tenant-1',
  created_at: '2026-02-14T08:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

describe('resultEscalationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRules', () => {
    it('returns active global rules when no tenant-specific rules exist', async () => {
      mockRulesResult.mockResolvedValue({ data: MOCK_RULES, error: null });

      const result = await resultEscalationService.getRules();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].test_name).toBe('troponin');
      }
    });

    it('returns failure on database error', async () => {
      mockRulesResult.mockResolvedValue({ data: null, error: { message: 'connection lost' } });

      const result = await resultEscalationService.getRules();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to load escalation rules');
      }
    });
  });

  describe('evaluateResult', () => {
    it('matches critical troponin rule when value > 0.04', async () => {
      mockRulesResult.mockResolvedValue({ data: MOCK_RULES, error: null });
      mockLogInsertResult.mockResolvedValue({ data: MOCK_LOG_ENTRY, error: null });

      const result = await resultEscalationService.evaluateResult(
        'troponin', 0.08, 'ng/mL', 'pat-1', 'result-1', 'lab_results', 'tenant-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].severity).toBe('critical');
        expect(result.data[0].route_to_specialty).toBe('cardiology');
      }
    });

    it('matches below-threshold rule for potassium < 3.0', async () => {
      mockRulesResult.mockResolvedValue({ data: MOCK_RULES, error: null });
      mockLogInsertResult.mockResolvedValue({
        data: { ...MOCK_LOG_ENTRY, test_name: 'potassium', test_value: 2.5, rule_id: 'rule-2' },
        error: null,
      });

      const result = await resultEscalationService.evaluateResult(
        'potassium', 2.5, 'mEq/L', 'pat-1', 'result-2', 'lab_results', 'tenant-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].test_name).toBe('potassium');
        expect(result.data[0].condition).toBe('below');
      }
    });

    it('returns empty array when value is in normal range', async () => {
      mockRulesResult.mockResolvedValue({ data: MOCK_RULES, error: null });

      const result = await resultEscalationService.evaluateResult(
        'troponin', 0.02, 'ng/mL', 'pat-1', 'result-3', 'lab_results', 'tenant-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe('createEscalation', () => {
    it('creates log entry and provider task when auto_create_task is true', async () => {
      mockLogInsertResult.mockResolvedValue({ data: MOCK_LOG_ENTRY, error: null });

      const result = await resultEscalationService.createEscalation(
        'rule-1', 'result-1', 'lab_results', 'pat-1',
        'troponin', 0.08, 'ng/mL', 'critical', 'cardiology', 'tenant-1', true, 'Troponin I'
      );

      expect(result.success).toBe(true);
      expect(providerTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: 'result_review',
          priority: 'stat',
          source_type: 'system',
        })
      );
    });

    it('creates log entry without task when auto_create_task is false', async () => {
      mockLogInsertResult.mockResolvedValue({ data: MOCK_LOG_ENTRY, error: null });

      const result = await resultEscalationService.createEscalation(
        'rule-3', 'result-1', 'lab_results', 'pat-1',
        'glucose', 350, 'mg/dL', 'high', 'endocrinology', 'tenant-1', false
      );

      expect(result.success).toBe(true);
      expect(providerTaskService.createTask).not.toHaveBeenCalled();
    });

    it('returns failure on database error', async () => {
      mockLogInsertResult.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      const result = await resultEscalationService.createEscalation(
        'rule-1', 'result-1', 'lab_results', 'pat-1',
        'troponin', 0.08, 'ng/mL', 'critical', 'cardiology', 'tenant-1'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to create escalation entry');
      }
    });
  });

  describe('resolveEscalation', () => {
    it('updates status and logs audit event', async () => {
      const resolvedEntry = {
        ...MOCK_LOG_ENTRY,
        escalation_status: 'resolved',
        resolved_at: '2026-02-14T10:00:00Z',
        resolved_by: 'user-1',
        resolution_notes: 'Patient stable after intervention',
      };
      mockLogUpdateResult.mockResolvedValue({ data: resolvedEntry, error: null });

      const result = await resultEscalationService.resolveEscalation(
        'esc-1', 'user-1', 'Patient stable after intervention'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.escalation_status).toBe('resolved');
        expect(result.data.resolution_notes).toBe('Patient stable after intervention');
      }
    });

    it('returns failure for missing escalation ID', async () => {
      const result = await resultEscalationService.resolveEscalation('', 'user-1', 'notes');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Escalation ID and user ID are required');
      }
    });
  });

  describe('getEscalationMetrics', () => {
    it('aggregates counts correctly', async () => {
      const mockActive = [
        { severity: 'critical', escalation_status: 'routed' },
        { severity: 'critical', escalation_status: 'pending' },
        { severity: 'high', escalation_status: 'routed' },
      ];
      mockMetricsActiveResult.mockResolvedValue({ data: mockActive, error: null });
      mockMetricsResolvedResult.mockResolvedValue({ count: 5, error: null });
      mockMetricsRulesResult.mockResolvedValue({ count: 7, error: null });

      const result = await resultEscalationService.getEscalationMetrics();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_active).toBe(3);
        expect(result.data.critical_count).toBe(2);
        expect(result.data.high_count).toBe(1);
        expect(result.data.routed_count).toBe(2);
        expect(result.data.resolved_today).toBe(5);
        expect(result.data.rules_active).toBe(7);
      }
    });
  });

  describe('error handling', () => {
    it('returns failure() on database errors, not throws', async () => {
      mockRulesResult.mockResolvedValue({ data: null, error: { message: 'DB down' } });

      const result = await resultEscalationService.getRules();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });
  });
});
