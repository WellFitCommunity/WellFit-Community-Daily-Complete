/**
 * referralFollowUpService Test Suite
 *
 * Tests aging referral queries, stats, follow-up history, config CRUD.
 * Deletion Test: All tests fail if service logic is removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { referralFollowUpService } from '../referralFollowUpService';

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
  chain.insert = vi.fn().mockImplementation(self);
  chain.update = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(() => Promise.resolve({ data: mockQueryResult.data, error: mockQueryResult.error }));
  chain.single = vi.fn().mockImplementation(() => Promise.resolve({ data: mockQueryResult.data, error: mockQueryResult.error }));

  return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => chainBuilder()),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
  },
}));

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_AGING_REFERRALS = [
  {
    referral_id: 'ref-1',
    referral_source_id: 'src-1',
    source_org_name: 'General Hospital',
    patient_phone: '+15551234567',
    patient_email: 'john@example.com',
    patient_first_name: 'John',
    patient_last_name: 'Doe',
    referral_status: 'pending',
    aging_days: 10,
    last_follow_up_at: null,
    follow_up_count: 0,
    tenant_id: 'tenant-1',
  },
  {
    referral_id: 'ref-2',
    referral_source_id: 'src-2',
    source_org_name: 'City Clinic',
    patient_phone: '+15559876543',
    patient_email: null,
    patient_first_name: 'Jane',
    patient_last_name: 'Smith',
    referral_status: 'invited',
    aging_days: 5,
    last_follow_up_at: '2026-02-10T10:00:00Z',
    follow_up_count: 1,
    tenant_id: 'tenant-1',
  },
];

const MOCK_STATS = {
  bucket_0_3: 5,
  bucket_3_7: 3,
  bucket_7_14: 2,
  bucket_14_plus: 1,
  status_pending: 6,
  status_invited: 3,
  status_enrolled: 2,
  total_aging: 11,
};

const MOCK_FOLLOW_UP_LOG = [
  {
    id: 'log-1',
    referral_id: 'ref-1',
    referral_source_id: 'src-1',
    follow_up_type: 'sms',
    follow_up_reason: 'pending_no_response',
    aging_days: 7,
    recipient_phone: '+15551234567',
    recipient_email: null,
    delivery_status: 'sent',
    error_message: null,
    tenant_id: 'tenant-1',
    created_at: '2026-02-10T10:00:00Z',
  },
];

const MOCK_CONFIG = {
  id: 'cfg-1',
  tenant_id: 'tenant-1',
  day_3_action: 'sms',
  day_7_action: 'sms_email',
  day_14_action: 'escalation',
  cooldown_hours: 24,
  max_follow_ups: 5,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

describe('referralFollowUpService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.data = null;
    mockQueryResult.error = null;
  });

  // ---------- getAgingReferrals ----------
  describe('getAgingReferrals', () => {
    it('returns aging referrals from RPC call', async () => {
      mockRpc.mockResolvedValue({ data: MOCK_AGING_REFERRALS, error: null });

      const result = await referralFollowUpService.getAgingReferrals('tenant-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].referral_id).toBe('ref-1');
        expect(result.data[0].aging_days).toBe(10);
        expect(result.data[1].source_org_name).toBe('City Clinic');
      }
    });

    it('returns empty array when no aging referrals exist', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await referralFollowUpService.getAgingReferrals();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await referralFollowUpService.getAgingReferrals();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------- getAgingStats ----------
  describe('getAgingStats', () => {
    it('returns aging bucket stats from RPC', async () => {
      mockRpc.mockResolvedValue({ data: [MOCK_STATS], error: null });

      const result = await referralFollowUpService.getAgingStats('tenant-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bucket_0_3).toBe(5);
        expect(result.data.bucket_3_7).toBe(3);
        expect(result.data.bucket_7_14).toBe(2);
        expect(result.data.bucket_14_plus).toBe(1);
        expect(result.data.total_aging).toBe(11);
      }
    });

    it('returns zeroes when RPC returns null row', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await referralFollowUpService.getAgingStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_aging).toBe(0);
        expect(result.data.bucket_14_plus).toBe(0);
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Stats failed' } });

      const result = await referralFollowUpService.getAgingStats();

      expect(result.success).toBe(false);
    });
  });

  // ---------- getFollowUpHistory ----------
  describe('getFollowUpHistory', () => {
    it('returns follow-up log entries for a referral', async () => {
      mockQueryResult.data = MOCK_FOLLOW_UP_LOG;
      mockQueryResult.error = null;

      const result = await referralFollowUpService.getFollowUpHistory('ref-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].follow_up_type).toBe('sms');
        expect(result.data[0].delivery_status).toBe('sent');
      }
    });

    it('returns empty array when no history exists', async () => {
      mockQueryResult.data = [];
      mockQueryResult.error = null;

      const result = await referralFollowUpService.getFollowUpHistory('ref-new');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ---------- getAgingConfig ----------
  describe('getAgingConfig', () => {
    it('returns tenant aging config', async () => {
      mockQueryResult.data = MOCK_CONFIG;
      mockQueryResult.error = null;

      const result = await referralFollowUpService.getAgingConfig('tenant-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cooldown_hours).toBe(24);
        expect(result.data.max_follow_ups).toBe(5);
        expect(result.data.is_active).toBe(true);
      }
    });

    it('returns failure when config not found', async () => {
      mockQueryResult.data = null;
      mockQueryResult.error = { message: 'Not found' };

      const result = await referralFollowUpService.getAgingConfig('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  // ---------- updateAgingConfig ----------
  describe('updateAgingConfig', () => {
    it('updates and returns new config values', async () => {
      mockQueryResult.data = { ...MOCK_CONFIG, cooldown_hours: 48 };
      mockQueryResult.error = null;

      const result = await referralFollowUpService.updateAgingConfig('tenant-1', {
        cooldown_hours: 48,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cooldown_hours).toBe(48);
      }
    });

    it('returns failure on update error', async () => {
      mockQueryResult.data = null;
      mockQueryResult.error = { message: 'Update failed' };

      const result = await referralFollowUpService.updateAgingConfig('tenant-1', {
        cooldown_hours: 48,
      });

      expect(result.success).toBe(false);
    });
  });

  // ---------- triggerManualFollowUp ----------
  describe('triggerManualFollowUp', () => {
    it('creates a manual follow-up log entry', async () => {
      mockQueryResult.data = {
        id: 'log-new',
        referral_id: 'ref-1',
        follow_up_type: 'sms',
        follow_up_reason: 'pending_no_response',
        aging_days: 0,
        delivery_status: 'sent',
        tenant_id: 'tenant-1',
        created_at: new Date().toISOString(),
      };
      mockQueryResult.error = null;

      const result = await referralFollowUpService.triggerManualFollowUp(
        'ref-1',
        'sms',
        'tenant-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.follow_up_type).toBe('sms');
        expect(result.data.referral_id).toBe('ref-1');
      }
    });
  });
});
