/**
 * Shift Context Aggregator Tests
 *
 * P4-4: Behavioral tests for shift handoff context aggregation and narrative synthesis.
 *
 * Covers:
 * - Busy shift → prioritized narrative with critical items
 * - Quiet shift → minimal output
 * - Empty unit → passthrough with no MCP call
 * - Partial data failure → still synthesizes with available data
 * - MCP tool call verification
 * - MCP failure handling
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P4-4)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceResult } from '../../_base';
import { ShiftContextAggregator } from '../shiftContextAggregator';
import type { HandoffNarrativeResult } from '../shiftContextAggregator';

// ============================================================================
// Mocks
// ============================================================================

const { mockTableData, mockInvoke } = vi.hoisted(() => ({
  mockTableData: new Map<string, { data: unknown; error: unknown }>(),
  mockInvoke: vi.fn(),
}));

// Chain builder for supabase query mocking — every method returns itself
// AND the chain has data/error so it can be destructured at any point
function createChainMock(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    data: returnValue.data,
    error: returnValue.error,
  };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(chain);
  return chain;
}

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (tableName: string) => {
      const tableResult = mockTableData.get(tableName) ?? { data: [], error: null };
      return createChainMock(tableResult);
    },
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
  if (!result.success) throw new Error(`Expected success but got failure: ${result.error?.message}`);
}

function assertFailure(result: ServiceResult<unknown>): asserts result is { success: false; data: null; error: { code: string; message: string } } {
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure but got success');
}

function createMcpNarrativeResponse(result: HandoffNarrativeResult) {
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

describe('ShiftContextAggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTableData.clear();
    mockInvoke.mockReset();
  });

  describe('aggregateAndSynthesize', () => {
    it('synthesizes narrative for a busy shift with critical events', async () => {
      mockTableData.set('bed_assignments', {
        data: [
          { patient_id: 'patient-001' },
          { patient_id: 'patient-002' },
          { patient_id: 'patient-003' },
        ],
        error: null,
      });

      mockTableData.set('shift_handoff_events', {
        data: [
          { event_time: '2026-03-15T08:00:00Z', event_type: 'vital_change', event_severity: 'critical', event_description: 'BP dropped to 80/50', action_taken: 'Fluids administered' },
          { event_time: '2026-03-15T09:30:00Z', event_type: 'fall', event_severity: 'major', event_description: 'Patient fell in bathroom', action_taken: null },
          { event_time: '2026-03-15T11:00:00Z', event_type: 'medication_given', event_severity: 'minor', event_description: 'PRN pain medication', action_taken: 'Administered' },
          { event_time: '2026-03-15T12:00:00Z', event_type: 'lab_result', event_severity: 'moderate', event_description: 'Potassium 5.8', action_taken: null },
        ],
        error: null,
      });

      mockTableData.set('care_team_alerts', {
        data: [
          { alert_type: 'vitals_declining', title: 'Persistent hypotension', priority: 'urgent', severity: 'high', created_at: '2026-03-15T08:05:00Z' },
          { alert_type: 'readmission_risk_high', title: 'Readmission risk elevated', priority: 'routine', severity: 'medium', created_at: '2026-03-15T10:00:00Z' },
        ],
        error: null,
      });

      mockTableData.set('care_coordination_plans', {
        data: [
          { title: 'Post-fall care plan', status: 'active', updated_at: '2026-03-15T09:45:00Z' },
        ],
        error: null,
      });

      const narrativeResult: HandoffNarrativeResult = {
        narrative: 'Busy shift on Unit 3A. Patient-001 had critical hypotension (now resolved with fluids). Patient-002 fell — post-fall protocol initiated, care plan updated. Patient-003 has elevated potassium requiring monitoring.',
        critical_items: [
          {
            patient_id: 'patient-002',
            description: 'Post-fall assessment incomplete',
            reasoning: 'Fall occurred 5 hours ago, no follow-up neurological check documented',
            urgency: 'urgent',
            recommended_action: 'Complete neuro check within 1 hour of shift start',
          },
        ],
        resolved_since_last_shift: ['Patient-001 hypotension resolved with IV fluids'],
        watch_items: ['Patient-003 potassium 5.8 — recheck ordered for evening'],
        shift_summary_stats: {
          total_events: 4,
          critical_events: 1,
          patients_with_changes: 3,
          pending_actions_count: 2,
        },
      };

      mockInvoke.mockResolvedValue(createMcpNarrativeResponse(narrativeResult));

      const result = await ShiftContextAggregator.aggregateAndSynthesize(
        'unit-3a', 'tenant-test-001', 'day', new Date('2026-03-15')
      );

      assertSuccess(result);
      expect(result.data.critical_items).toHaveLength(1);
      expect(result.data.critical_items[0].urgency).toBe('urgent');
      expect(result.data.resolved_since_last_shift).toHaveLength(1);
      expect(result.data.shift_summary_stats.total_events).toBe(4);

      // Verify MCP was called with correct tool
      expect(mockInvoke).toHaveBeenCalledWith('mcp-claude-server', expect.objectContaining({
        body: expect.objectContaining({
          params: expect.objectContaining({
            name: 'synthesize-handoff-narrative',
          }),
        }),
      }));
    });

    it('returns minimal output for an empty unit', async () => {
      mockTableData.set('bed_assignments', { data: [], error: null });

      const result = await ShiftContextAggregator.aggregateAndSynthesize(
        'unit-empty', 'tenant-test-001', 'night'
      );

      assertSuccess(result);
      expect(result.data.narrative).toContain('No patients');
      expect(result.data.critical_items).toHaveLength(0);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('returns failure when unit patient fetch fails', async () => {
      mockTableData.set('bed_assignments', { data: null, error: { message: 'Connection lost' } });

      const result = await ShiftContextAggregator.aggregateAndSynthesize(
        'unit-broken', 'tenant-test-001', 'day'
      );

      assertFailure(result);
      expect(result.error.code).toBe('DATABASE_ERROR');
    });

    it('still synthesizes when some data sources fail', async () => {
      mockTableData.set('bed_assignments', {
        data: [{ patient_id: 'patient-010' }],
        error: null,
      });
      mockTableData.set('shift_handoff_events', { data: null, error: { message: 'Table not found' } });
      mockTableData.set('care_team_alerts', {
        data: [{ alert_type: 'missed_check_ins', title: 'Missed 3 check-ins', priority: 'routine', severity: 'medium', created_at: '2026-03-15T10:00:00Z' }],
        error: null,
      });
      mockTableData.set('care_coordination_plans', { data: null, error: { message: 'Permission denied' } });

      const narrativeResult: HandoffNarrativeResult = {
        narrative: 'Quiet shift with limited data. One pending alert for missed check-ins.',
        critical_items: [],
        resolved_since_last_shift: [],
        watch_items: ['Patient-010 missed check-ins'],
        shift_summary_stats: {
          total_events: 0,
          critical_events: 0,
          patients_with_changes: 0,
          pending_actions_count: 1,
        },
      };

      mockInvoke.mockResolvedValue(createMcpNarrativeResponse(narrativeResult));

      const result = await ShiftContextAggregator.aggregateAndSynthesize(
        'unit-partial', 'tenant-test-001', 'evening', new Date('2026-03-15')
      );

      assertSuccess(result);
      // Should still produce a narrative with partial data
      expect(result.data.narrative).toBeTruthy();
      expect(mockInvoke).toHaveBeenCalled();
    });

    it('returns failure when MCP narrative tool fails', async () => {
      mockTableData.set('bed_assignments', {
        data: [{ patient_id: 'patient-020' }],
        error: null,
      });

      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Claude unavailable' } });

      const result = await ShiftContextAggregator.aggregateAndSynthesize(
        'unit-mcp-fail', 'tenant-test-001', 'day'
      );

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_FAILED');
    });
  });
});
