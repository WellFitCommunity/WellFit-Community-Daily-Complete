/**
 * referralCompletionService Test Suite
 *
 * Tests specialist completion queries, stats, recording, and history.
 * Deletion Test: All tests fail if service logic is removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { referralCompletionService } from '../referralCompletionService';

// Flexible query result holder — set per-test
const mockQueryResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as { message: string } | null,
}));

const mockRpc = vi.hoisted(() => vi.fn());

// Build a fluent mock chain that always resolves with mockQueryResult
function chainBuilder() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;

  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: mockQueryResult.data, error: mockQueryResult.error })
  );
  chain.single = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: mockQueryResult.data, error: mockQueryResult.error })
  );

  return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => chainBuilder()),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const mockAuditInfo = vi.fn();
const mockAuditError = vi.fn();

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: (...args: unknown[]) => mockAuditInfo(...args),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockAuditError(...args),
    debug: vi.fn(),
    clinical: vi.fn(),
  },
}));

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_AWAITING_REFERRALS = [
  {
    referral_id: 'ref-1',
    referral_source_id: 'src-1',
    source_org_name: 'General Hospital',
    patient_first_name: 'John',
    patient_last_name: 'Doe',
    referral_status: 'active',
    referral_reason: 'Cardiology consult',
    created_at: '2026-01-15T10:00:00Z',
    days_waiting: 35,
    specialist_completion_status: 'awaiting',
    specialist_name: null,
    specialist_completion_date: null,
    specialist_confirmed_at: null,
    tenant_id: 'tenant-1',
  },
  {
    referral_id: 'ref-2',
    referral_source_id: 'src-2',
    source_org_name: 'City Clinic',
    patient_first_name: 'Jane',
    patient_last_name: 'Smith',
    referral_status: 'enrolled',
    referral_reason: 'Physical therapy',
    created_at: '2026-02-10T10:00:00Z',
    days_waiting: 9,
    specialist_completion_status: 'awaiting',
    specialist_name: null,
    specialist_completion_date: null,
    specialist_confirmed_at: null,
    tenant_id: 'tenant-1',
  },
];

const MOCK_STATS = {
  total_awaiting: 5,
  total_overdue: 2,
  confirmed_this_month: 3,
  avg_days_to_confirm: 8.5,
};

const MOCK_HISTORY = [
  {
    id: 'log-1',
    referral_id: 'ref-1',
    referral_source_id: 'src-1',
    follow_up_type: 'provider_task',
    follow_up_reason: 'specialist_completion_recorded',
    aging_days: 30,
    recipient_phone: null,
    recipient_email: null,
    delivery_status: 'delivered',
    error_message: null,
    tenant_id: 'tenant-1',
    created_at: '2026-02-14T10:00:00Z',
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('referralCompletionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.data = null;
    mockQueryResult.error = null;
  });

  // ---------- getAwaitingConfirmation ----------
  describe('getAwaitingConfirmation', () => {
    it('returns referrals from RPC call', async () => {
      mockRpc.mockResolvedValue({ data: MOCK_AWAITING_REFERRALS, error: null });

      const result = await referralCompletionService.getAwaitingConfirmation('tenant-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].referral_id).toBe('ref-1');
        expect(result.data[0].days_waiting).toBe(35);
        expect(result.data[1].source_org_name).toBe('City Clinic');
      }
      expect(mockRpc).toHaveBeenCalledWith('get_referrals_awaiting_confirmation', {
        p_tenant_id: 'tenant-1',
      });
    });

    it('returns empty array when no referrals exist', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await referralCompletionService.getAwaitingConfirmation();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await referralCompletionService.getAwaitingConfirmation();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------- getCompletionStats ----------
  describe('getCompletionStats', () => {
    it('returns stats with numeric conversions from RPC', async () => {
      mockRpc.mockResolvedValue({ data: [MOCK_STATS], error: null });

      const result = await referralCompletionService.getCompletionStats('tenant-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_awaiting).toBe(5);
        expect(result.data.total_overdue).toBe(2);
        expect(result.data.confirmed_this_month).toBe(3);
        expect(result.data.avg_days_to_confirm).toBe(8.5);
      }
    });

    it('returns zeroes and null avg when RPC returns empty', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await referralCompletionService.getCompletionStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_awaiting).toBe(0);
        expect(result.data.total_overdue).toBe(0);
        expect(result.data.confirmed_this_month).toBe(0);
        expect(result.data.avg_days_to_confirm).toBeNull();
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Stats failed' } });

      const result = await referralCompletionService.getCompletionStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------- recordCompletion ----------
  describe('recordCompletion', () => {
    it('calls RPC with correct params and logs audit event', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          referral_id: 'ref-1',
          confirmed_at: '2026-02-19T10:00:00Z',
          confirmed_by: 'user-123',
        },
        error: null,
      });

      const result = await referralCompletionService.recordCompletion({
        referral_id: 'ref-1',
        specialist_name: 'Dr. Smith',
        completion_date: '2026-02-18',
        report: 'Normal findings',
        recommendations: 'Follow up in 6 months',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.referral_id).toBe('ref-1');
        expect(result.data.confirmed_at).toBe('2026-02-19T10:00:00Z');
      }

      expect(mockRpc).toHaveBeenCalledWith('record_specialist_completion', {
        p_referral_id: 'ref-1',
        p_specialist_name: 'Dr. Smith',
        p_completion_date: '2026-02-18',
        p_report: 'Normal findings',
        p_recommendations: 'Follow up in 6 months',
      });

      expect(mockAuditInfo).toHaveBeenCalledWith('SPECIALIST_COMPLETION_RECORDED', {
        referralId: 'ref-1',
        specialistName: 'Dr. Smith',
        completionDate: '2026-02-18',
      });
    });

    it('returns failure when RPC returns validation error', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'Referral must be active or enrolled' },
        error: null,
      });

      const result = await referralCompletionService.recordCompletion({
        referral_id: 'ref-99',
        specialist_name: 'Dr. Smith',
        completion_date: '2026-02-18',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Referral must be active or enrolled');
      }
    });

    it('returns failure on RPC transport error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const result = await referralCompletionService.recordCompletion({
        referral_id: 'ref-1',
        specialist_name: 'Dr. Smith',
        completion_date: '2026-02-18',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('returns failure and logs error on exception', async () => {
      mockRpc.mockRejectedValue(new Error('Unexpected failure'));

      const result = await referralCompletionService.recordCompletion({
        referral_id: 'ref-1',
        specialist_name: 'Dr. Smith',
        completion_date: '2026-02-18',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(mockAuditError).toHaveBeenCalled();
    });
  });

  // ---------- getCompletionHistory ----------
  describe('getCompletionHistory', () => {
    it('returns filtered log entries for specialist reasons', async () => {
      mockQueryResult.data = MOCK_HISTORY;
      mockQueryResult.error = null;

      const result = await referralCompletionService.getCompletionHistory('ref-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].follow_up_reason).toBe('specialist_completion_recorded');
      }
    });

    it('returns empty array when no history exists', async () => {
      mockQueryResult.data = [];
      mockQueryResult.error = null;

      const result = await referralCompletionService.getCompletionHistory('ref-new');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on query error', async () => {
      mockQueryResult.data = null;
      mockQueryResult.error = { message: 'Query failed' };

      const result = await referralCompletionService.getCompletionHistory('ref-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });
});
