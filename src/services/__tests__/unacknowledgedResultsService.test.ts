/**
 * unacknowledgedResultsService tests — validates data retrieval, filtering,
 * metrics aggregation, acknowledgment insertion, and error handling.
 *
 * Deletion Test: Every test would FAIL if the service were an empty object.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

// Terminal mocks — set per-test to control resolved values
const mockViewResult = vi.fn();
const mockAckInsertResult = vi.fn();
const mockAckSelectResult = vi.fn();
const mockInsert = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'v_unacknowledged_results') {
        // getUnacknowledgedResults: .select('id, patient_id, ...').order(...)
        // getResultMetrics:         .select('id, patient_id, ...')  (no .order)
        // Both paths resolve via mockViewResult
        return {
          select: () => {
            const promise = mockViewResult();
            // Make the return value both thenable (for await) and chainable (for .order)
            const result = {
              order: () => mockViewResult(),
              then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
                promise.then(resolve, reject),
            };
            return result;
          },
        };
      }
      if (table === 'result_acknowledgments') {
        // acknowledgeResult:       .insert({}).select('id').single()
        // getAcknowledgmentHistory: .select(...).eq(...).order(...)
        return {
          insert: (payload: unknown) => {
            mockInsert(payload);
            return {
              select: () => ({
                single: () => mockAckInsertResult(),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              order: () => mockAckSelectResult(),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) };
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
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

import { unacknowledgedResultsService } from '../unacknowledgedResultsService';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_VIEW_DATA = [
  {
    id: 'rpt-1',
    patient_id: 'pat-1',
    first_name: 'John',
    last_name: 'Doe',
    code_display: 'CBC',
    category: ['LAB'],
    status: 'final',
    report_priority: 'stat',
    issued: '2026-02-14T06:00:00Z',
    conclusion: null,
    tenant_id: 't-1',
    hours_since_issued: 2,
    aging_status: 'critical',
  },
  {
    id: 'rpt-2',
    patient_id: 'pat-2',
    first_name: 'Jane',
    last_name: 'Smith',
    code_display: 'X-Ray',
    category: ['RAD'],
    status: 'final',
    report_priority: 'routine',
    issued: '2026-02-13T20:00:00Z',
    conclusion: null,
    tenant_id: 't-1',
    hours_since_issued: 12,
    aging_status: 'warning',
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('unacknowledgedResultsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUnacknowledgedResults', () => {
    it('returns formatted data from the view', async () => {
      mockViewResult.mockResolvedValue({ data: MOCK_VIEW_DATA, error: null });

      const result = await unacknowledgedResultsService.getUnacknowledgedResults();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].code_display).toBe('CBC');
        expect(result.data[1].code_display).toBe('X-Ray');
      }
    });

    it('applies priority filter correctly', async () => {
      mockViewResult.mockResolvedValue({ data: MOCK_VIEW_DATA, error: null });

      const result = await unacknowledgedResultsService.getUnacknowledgedResults({
        priority: 'stat',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].report_priority).toBe('stat');
      }
    });

    it('returns failure on database error', async () => {
      mockViewResult.mockResolvedValue({ data: null, error: { message: 'DB connection lost' } });

      const result = await unacknowledgedResultsService.getUnacknowledgedResults();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to load unacknowledged results');
      }
    });
  });

  describe('getResultMetrics', () => {
    it('returns correct aggregated counts', async () => {
      mockViewResult.mockResolvedValue({ data: MOCK_VIEW_DATA, error: null });

      const result = await unacknowledgedResultsService.getResultMetrics();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_unacknowledged).toBe(2);
        expect(result.data.critical_count).toBe(1);
        expect(result.data.warning_count).toBe(1);
        expect(result.data.by_category).toEqual(
          expect.arrayContaining([
            { category: 'LAB', count: 1 },
            { category: 'RAD', count: 1 },
          ])
        );
      }
    });
  });

  describe('acknowledgeResult', () => {
    it('inserts record and returns success', async () => {
      mockAckInsertResult.mockResolvedValue({ data: { id: 'ack-1' }, error: null });

      const result = await unacknowledgedResultsService.acknowledgeResult(
        'rpt-1',
        'user-1',
        'reviewed',
        'Looks normal'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('ack-1');
      }
      expect(mockInsert).toHaveBeenCalledWith({
        report_id: 'rpt-1',
        acknowledged_by: 'user-1',
        acknowledgment_type: 'reviewed',
        notes: 'Looks normal',
      });
    });

    it('returns failure on database error', async () => {
      mockAckInsertResult.mockResolvedValue({ data: null, error: { message: 'Constraint violation' } });

      const result = await unacknowledgedResultsService.acknowledgeResult(
        'rpt-1',
        'user-1',
        'reviewed'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to acknowledge result');
      }
    });
  });

  describe('getAcknowledgmentHistory', () => {
    it('returns acknowledgment records for a report', async () => {
      const mockAckData = [
        {
          id: 'ack-1',
          report_id: 'rpt-1',
          acknowledged_by: 'user-1',
          acknowledged_at: '2026-02-14T10:00:00Z',
          acknowledgment_type: 'reviewed',
          notes: null,
        },
      ];

      mockAckSelectResult.mockResolvedValue({ data: mockAckData, error: null });

      const result = await unacknowledgedResultsService.getAcknowledgmentHistory('rpt-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].acknowledgment_type).toBe('reviewed');
      }
    });
  });
});
