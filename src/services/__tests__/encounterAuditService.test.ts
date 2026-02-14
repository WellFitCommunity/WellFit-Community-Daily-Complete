/**
 * encounterAuditService Test Suite
 *
 * Tests timeline merge from 5 sources, header fetch, and export.
 * Deletion Test: All tests fail if service logic is removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encounterAuditService } from '../encounterAuditService';

// Mock Supabase
const {
  mockSelect,
  mockEq,
  mockSingle,
  mockOrder,
  mockIn,
  mockLimit,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockOrder: vi.fn(),
  mockIn: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      // Different mock chains for different tables
      if (table === 'encounters') {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === 'clinical_notes') {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              data: [{ id: 'note-1' }],
              error: null,
            }),
          }),
        };
      }
      // Default chain for other tables
      return {
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            order: mockOrder.mockReturnValue({
              limit: mockLimit,
            }),
            single: mockSingle,
          }),
          in: mockIn.mockReturnValue({
            order: mockOrder,
          }),
        }),
      };
    }),
  },
}));

// Mock encounterStateMachine
vi.mock('../encounterStateMachine', () => ({
  encounterStateMachine: {
    getStatusHistory: vi.fn(),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    phi: vi.fn(),
  },
}));

// Import the mock to control return values
import { encounterStateMachine } from '../encounterStateMachine';
import type { ServiceResult } from '../_base';
import type { EncounterStatusHistoryEntry } from '../../types/encounterStatus';

// Helper to create a properly typed ServiceResult
function successResult<T>(data: T): ServiceResult<T> {
  return { success: true, data, error: null };
}

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_HEADER = {
  id: 'enc-1',
  status: 'in_progress',
  patient_id: 'pat-1',
  provider_id: 'prov-1',
  encounter_date: '2026-02-14',
};

const MOCK_STATUS_HISTORY = [
  {
    id: 'sh-1',
    encounter_id: 'enc-1',
    from_status: null,
    to_status: 'planned',
    changed_by: 'user-1',
    changed_at: '2026-02-14T08:00:00Z',
    reason: 'Created',
    metadata: {},
  },
  {
    id: 'sh-2',
    encounter_id: 'enc-1',
    from_status: 'planned',
    to_status: 'in_progress',
    changed_by: 'user-1',
    changed_at: '2026-02-14T09:00:00Z',
    reason: 'Patient arrived',
    metadata: {},
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('encounterAuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- getEncounterHeader ----------
  describe('getEncounterHeader', () => {
    it('returns encounter header with status, patient, provider, date', async () => {
      mockSingle.mockResolvedValue({ data: MOCK_HEADER, error: null });

      const result = await encounterAuditService.getEncounterHeader('enc-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encounter_id).toBe('enc-1');
        expect(result.data.status).toBe('in_progress');
        expect(result.data.patient_id).toBe('pat-1');
        expect(result.data.provider_id).toBe('prov-1');
        expect(result.data.encounter_date).toBe('2026-02-14');
      }
    });

    it('returns failure when encounter not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await encounterAuditService.getEncounterHeader('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------- getEncounterTimeline ----------
  describe('getEncounterTimeline', () => {
    it('merges status history into timeline with correct source type', async () => {
      // Mock status history returns data
      vi.mocked(encounterStateMachine.getStatusHistory).mockResolvedValue(
        successResult(MOCK_STATUS_HISTORY as EncounterStatusHistoryEntry[])
      );

      // Other sources return empty (via mock chain)
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
        data: [],
        error: null,
      });
      mockIn.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const result = await encounterAuditService.getEncounterTimeline('enc-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThanOrEqual(2);
        const statusEntries = result.data.filter(e => e.source === 'status_change');
        expect(statusEntries.length).toBe(2);
        expect(statusEntries[0].summary).toContain('Status changed');
      }
    });

    it('sorts timeline entries by timestamp descending', async () => {
      vi.mocked(encounterStateMachine.getStatusHistory).mockResolvedValue(
        successResult(MOCK_STATUS_HISTORY as EncounterStatusHistoryEntry[])
      );

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
        data: [],
        error: null,
      });
      mockIn.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const result = await encounterAuditService.getEncounterTimeline('enc-1');

      expect(result.success).toBe(true);
      if (result.success && result.data.length >= 2) {
        const first = new Date(result.data[0].timestamp).getTime();
        const second = new Date(result.data[1].timestamp).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('returns empty timeline when encounter has no events', async () => {
      vi.mocked(encounterStateMachine.getStatusHistory).mockResolvedValue(
        successResult([] as EncounterStatusHistoryEntry[])
      );

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
        data: [],
        error: null,
      });
      mockIn.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const result = await encounterAuditService.getEncounterTimeline('enc-empty');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ---------- exportEncounterAudit ----------
  describe('exportEncounterAudit', () => {
    it('exports timeline as JSON string', async () => {
      vi.mocked(encounterStateMachine.getStatusHistory).mockResolvedValue(
        successResult(MOCK_STATUS_HISTORY as EncounterStatusHistoryEntry[])
      );

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
        data: [],
        error: null,
      });
      mockIn.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const result = await encounterAuditService.exportEncounterAudit('enc-1', 'json');

      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.data);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('exports timeline as CSV with headers', async () => {
      vi.mocked(encounterStateMachine.getStatusHistory).mockResolvedValue(
        successResult(MOCK_STATUS_HISTORY as EncounterStatusHistoryEntry[])
      );

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
        data: [],
        error: null,
      });
      mockIn.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const result = await encounterAuditService.exportEncounterAudit('enc-1', 'csv');

      expect(result.success).toBe(true);
      if (result.success) {
        const lines = result.data.split('\n');
        expect(lines[0]).toBe('id,timestamp,source,actor_id,summary,severity,category');
        expect(lines.length).toBeGreaterThan(1);
      }
    });
  });
});
