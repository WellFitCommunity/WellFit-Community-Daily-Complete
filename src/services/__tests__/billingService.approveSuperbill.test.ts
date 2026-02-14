/**
 * BillingService.approveSuperbill / rejectSuperbill Test Suite
 *
 * Tests superbill approval/rejection RPC calls, validation, pending query.
 * Deletion Test: All tests fail if approval methods are removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from '../billingService';

// Mock Supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    phi: vi.fn(),
  },
}));

// Mock pagination utility used by other methods
vi.mock('../../utils/pagination', () => ({
  PAGINATION_LIMITS: { PROVIDERS: 100, CLAIM_LINES: 100, FEE_SCHEDULES: 50, FEE_SCHEDULE_ITEMS: 500 },
  applyLimit: vi.fn(async (query: { data: unknown[] }) => query.data || []),
}));

describe('BillingService — Superbill Approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('approveSuperbill', () => {
    it('calls approve_superbill RPC with correct params', async () => {
      const approvalResult = { claim_id: 'claim-1', approved_by: 'provider-1', approved_at: '2026-02-16T00:00:00Z' };
      mockRpc.mockResolvedValue({ data: approvalResult, error: null });

      const result = await BillingService.approveSuperbill('claim-1', 'provider-1', 'Looks correct');

      expect(mockRpc).toHaveBeenCalledWith('approve_superbill', {
        p_claim_id: 'claim-1',
        p_provider_id: 'provider-1',
        p_notes: 'Looks correct',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.claim_id).toBe('claim-1');
        expect(result.data.approved_by).toBe('provider-1');
      }
    });

    it('passes null notes when none provided', async () => {
      mockRpc.mockResolvedValue({ data: { claim_id: 'claim-1' }, error: null });

      await BillingService.approveSuperbill('claim-1', 'provider-1');

      expect(mockRpc).toHaveBeenCalledWith('approve_superbill', {
        p_claim_id: 'claim-1',
        p_provider_id: 'provider-1',
        p_notes: null,
      });
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Claim must be in generated status' } });

      const result = await BillingService.approveSuperbill('claim-1', 'provider-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUPERBILL_APPROVAL_FAILED');
        expect(result.error.message).toContain('generated status');
      }
    });

    it('returns failure on exception', async () => {
      mockRpc.mockRejectedValue(new Error('Network timeout'));

      const result = await BillingService.approveSuperbill('claim-1', 'provider-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUPERBILL_APPROVAL_FAILED');
      }
    });
  });

  describe('rejectSuperbill', () => {
    it('calls reject_superbill RPC with correct params', async () => {
      const rejectResult = { claim_id: 'claim-1', returned_by: 'provider-1', reason: 'E/M level seems too high for documented work' };
      mockRpc.mockResolvedValue({ data: rejectResult, error: null });

      const result = await BillingService.rejectSuperbill('claim-1', 'provider-1', 'E/M level seems too high for documented work');

      expect(mockRpc).toHaveBeenCalledWith('reject_superbill', {
        p_claim_id: 'claim-1',
        p_provider_id: 'provider-1',
        p_reason: 'E/M level seems too high for documented work',
      });
      expect(result.success).toBe(true);
    });

    it('validates minimum reason length', async () => {
      const result = await BillingService.rejectSuperbill('claim-1', 'provider-1', 'too short');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUPERBILL_REJECTION_FAILED');
        expect(result.error.message).toContain('10 characters');
      }
    });

    it('rejects empty reason', async () => {
      const result = await BillingService.rejectSuperbill('claim-1', 'provider-1', '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUPERBILL_REJECTION_FAILED');
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Claim not found' } });

      const result = await BillingService.rejectSuperbill('claim-1', 'provider-1', 'This needs correction because of coding error');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUPERBILL_REJECTION_FAILED');
      }
    });
  });

  describe('getClaimsAwaitingApproval', () => {
    it('queries claims with pending approval status', async () => {
      const mockClaims = [
        { id: 'claim-1', status: 'generated', approval_status: 'pending', total_charge: 150 },
      ];
      // Build chain from inside out to avoid mockEq re-use issue
      const innerEq = vi.fn().mockReturnValue({
        order: mockOrder.mockReturnValue({
          limit: mockLimit.mockResolvedValue({ data: mockClaims, error: null }),
        }),
      });
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({ eq: outerEq }),
      });

      const result = await BillingService.getClaimsAwaitingApproval();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claim-1');
    });

    it('throws on query error', async () => {
      const innerEq = vi.fn().mockReturnValue({
        order: mockOrder.mockReturnValue({
          limit: mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      });
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({ eq: outerEq }),
      });

      await expect(BillingService.getClaimsAwaitingApproval()).rejects.toThrow(/failed/i);
    });
  });
});
