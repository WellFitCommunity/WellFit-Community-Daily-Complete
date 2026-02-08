/**
 * MFA Enrollment Service Tests
 *
 * Tests getMfaStatus, updateMfaEnabled, getMfaComplianceReport, grantExemption.
 * Verifies ServiceResult pattern, audit logging, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: mockEq };
      },
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return { data: [], error: null };
      },
    }),
  },
}));

// Mock auditLogger
const mockLogInfo = vi.fn().mockResolvedValue(undefined);
const mockLogError = vi.fn().mockResolvedValue(undefined);

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: (...args: unknown[]) => mockLogInfo(...args),
    error: (...args: unknown[]) => mockLogError(...args),
    warn: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('mfaEnrollmentService', () => {
  let getMfaStatus: typeof import('../mfaEnrollmentService').getMfaStatus;
  let updateMfaEnabled: typeof import('../mfaEnrollmentService').updateMfaEnabled;
  let getMfaComplianceReport: typeof import('../mfaEnrollmentService').getMfaComplianceReport;
  let grantExemption: typeof import('../mfaEnrollmentService').grantExemption;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../mfaEnrollmentService');
    getMfaStatus = mod.getMfaStatus;
    updateMfaEnabled = mod.updateMfaEnabled;
    getMfaComplianceReport = mod.getMfaComplianceReport;
    grantExemption = mod.grantExemption;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getMfaStatus ───

  describe('getMfaStatus', () => {
    it('returns MFA status on success', async () => {
      const mockStatus = {
        mfa_required: true,
        mfa_enabled: false,
        enrollment_exists: true,
        enforcement_status: 'grace_period',
        grace_period_ends: '2026-02-15T00:00:00Z',
        days_remaining: 5,
        role: 'admin',
        mfa_method: null,
      };
      mockRpc.mockResolvedValue({ data: mockStatus, error: null });

      const result = await getMfaStatus('user-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mfa_required).toBe(true);
        expect(result.data.mfa_enabled).toBe(false);
        expect(result.data.enforcement_status).toBe('grace_period');
        expect(result.data.days_remaining).toBe(5);
        expect(result.data.role).toBe('admin');
      }
      expect(mockRpc).toHaveBeenCalledWith('get_mfa_enrollment_status', {
        p_user_id: 'user-123',
      });
    });

    it('returns failure when RPC returns error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found' },
      });

      const result = await getMfaStatus('user-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Function not found');
      }
      expect(mockLogError).toHaveBeenCalledWith(
        'MFA_STATUS_FETCH_FAILED',
        expect.objectContaining({ message: 'Function not found' }),
        { userId: 'user-123' }
      );
    });

    it('returns failure when no data returned', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await getMfaStatus('user-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('No MFA enrollment status found');
      }
    });

    it('handles thrown exceptions with unknown error type', async () => {
      mockRpc.mockRejectedValue('network failure');

      const result = await getMfaStatus('user-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to fetch MFA status');
      }
      expect(mockLogError).toHaveBeenCalledWith(
        'MFA_STATUS_FETCH_FAILED',
        expect.any(Error),
        { userId: 'user-123' }
      );
    });
  });

  // ─── updateMfaEnabled ───

  describe('updateMfaEnabled', () => {
    it('updates enrollment and logs success when enabling MFA', async () => {
      mockEq.mockResolvedValue({ error: null });

      const result = await updateMfaEnabled('user-456', true, 'totp');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          mfa_enabled: true,
          mfa_method: 'totp',
          enforcement_status: 'enforced',
        })
      );
      expect(mockLogInfo).toHaveBeenCalledWith('MFA_ENROLLMENT_UPDATED', {
        userId: 'user-456',
        enabled: true,
        method: 'totp',
      });
    });

    it('sets grace_period status when disabling MFA', async () => {
      mockEq.mockResolvedValue({ error: null });

      const result = await updateMfaEnabled('user-456', false, null);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          mfa_enabled: false,
          mfa_method: null,
          enforcement_status: 'grace_period',
          enrollment_date: null,
          last_verified: null,
        })
      );
    });

    it('returns failure on database error', async () => {
      mockEq.mockResolvedValue({
        error: { message: 'Row not found' },
      });

      const result = await updateMfaEnabled('user-456', true);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Row not found');
      }
      expect(mockLogError).toHaveBeenCalledWith(
        'MFA_UPDATE_FAILED',
        expect.objectContaining({ message: 'Row not found' }),
        { userId: 'user-456', enabled: true }
      );
    });
  });

  // ─── getMfaComplianceReport ───

  describe('getMfaComplianceReport', () => {
    it('returns compliance data from view', async () => {
      const mockRows = [
        {
          role: 'admin',
          total_users: 5,
          mfa_enabled_count: 3,
          non_compliant_count: 2,
          exempt_count: 0,
          compliance_pct: 60,
        },
        {
          role: 'nurse',
          total_users: 10,
          mfa_enabled_count: 8,
          non_compliant_count: 1,
          exempt_count: 1,
          compliance_pct: 90,
        },
      ];

      // Need to re-mock the from().select() chain for this test
      const { supabase } = await import('../../lib/supabaseClient');
      const mockSb = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      });

      const result = await getMfaComplianceReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].role).toBe('admin');
        expect(result.data[0].compliance_pct).toBe(60);
        expect(result.data[1].mfa_enabled_count).toBe(8);
      }
    });

    it('returns empty array when no data', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockSb = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await getMfaComplianceReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  // ─── grantExemption ───

  describe('grantExemption', () => {
    it('grants exemption and logs success', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await grantExemption('user-789', 'Shared workstation');

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('grant_mfa_exemption', {
        p_user_id: 'user-789',
        p_reason: 'Shared workstation',
      });
      expect(mockLogInfo).toHaveBeenCalledWith('MFA_EXEMPTION_GRANTED', {
        userId: 'user-789',
        reason: 'Shared workstation',
      });
    });

    it('returns failure when RPC succeeds but result indicates denial', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'Not a super admin' },
        error: null,
      });

      const result = await grantExemption('user-789', 'Test reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Not a super admin');
      }
    });

    it('returns failure on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' },
      });

      const result = await grantExemption('user-789', 'Test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Permission denied');
      }
      expect(mockLogError).toHaveBeenCalledWith(
        'MFA_EXEMPTION_FAILED',
        expect.objectContaining({ message: 'Permission denied' }),
        { userId: 'user-789' }
      );
    });

    it('handles thrown exceptions gracefully', async () => {
      mockRpc.mockRejectedValue(new Error('Network timeout'));

      const result = await grantExemption('user-789', 'Reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Failed to grant exemption');
      }
    });
  });
});
