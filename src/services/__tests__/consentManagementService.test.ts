/**
 * Consent Management Service Tests
 *
 * Tests for HIPAA §164.508 compliant consent management:
 * - User consent retrieval (all and active)
 * - Consent granting with audit trail
 * - Consent verification and checking
 * - Consent withdrawal
 * - Sharing permissions management
 * - Expiration alerts and notifications
 * - Verification history
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConsentManagementService,
  consentManagementService,
  type Consent,
  type GrantConsentParams,
  type SharingPermissions,
  type ExpiringConsent,
  type ConsentVerificationLog,
} from '../consentManagementService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockGetSession = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: {
        getSession: mockGetSession,
      },
    },
  };
});

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock fetch for IP address lookup
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: { getSession: ReturnType<typeof vi.fn> };
};

// Helper to create mock consent
function createMockConsent(overrides?: Partial<Consent>): Consent {
  return {
    id: 1,
    user_id: 'user-123',
    consent_type: 'privacy',
    consented: true,
    first_name: 'John',
    last_name: 'Doe',
    consented_at: '2025-01-01T10:00:00Z',
    consent_method: 'electronic_signature',
    effective_date: '2025-01-01T10:00:00Z',
    sharing_permissions: {
      share_with_providers: true,
      share_with_family: false,
      share_with_researchers: false,
    },
    audit_trail: [{ action: 'granted', timestamp: '2025-01-01T10:00:00Z' }],
    created_at: '2025-01-01T10:00:00Z',
    ...overrides,
  };
}

// Helper to create chainable mock query
function createChainableMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  // Make the chain awaitable at any point
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  chain.limit.mockResolvedValue(result);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  return chain;
}

describe('ConsentManagementService', () => {
  let service: ConsentManagementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConsentManagementService();

    // Default mock for auth session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'requesting-user-123' } } },
    });

    // Default mock for fetch (IP lookup)
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ip: '192.168.1.1' }),
    });

    // Default mock for navigator
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Test Browser' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getUserConsents Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getUserConsents', () => {
    it('should return all consents for a user', async () => {
      const mockConsents = [
        createMockConsent({ id: 1, consent_type: 'privacy' }),
        createMockConsent({ id: 2, consent_type: 'treatment' }),
      ];

      const chain = createChainableMock({ data: mockConsents, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await service.getUserConsents('user-123');

      expect(result).toEqual(mockConsents);
      expect(mockSupabase.from).toHaveBeenCalledWith('privacy_consent');
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'CONSENT_RECORDS_ACCESSED',
        'user-123',
        expect.objectContaining({ count: 2 })
      );
    });

    it('should return empty array when no consents exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await service.getUserConsents('user-456');

      expect(result).toEqual([]);
    });

    it('should throw error and log when query fails', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabase.from.mockReturnValue(chain);

      await expect(service.getUserConsents('user-123')).rejects.toThrow(
        'Failed to fetch user consents: Database error'
      );
      expect(auditLogger.error).toHaveBeenCalledWith(
        'USER_CONSENT_FETCH_FAILED',
        expect.any(Object),
        expect.objectContaining({ user_id: 'user-123' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getActiveUserConsents Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getActiveUserConsents', () => {
    it('should return only active (non-withdrawn, non-expired) consents', async () => {
      const mockConsents = [
        createMockConsent({ id: 1, consent_type: 'privacy', consented: true }),
      ];

      const chain = createChainableMock({ data: mockConsents, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await service.getActiveUserConsents('user-123');

      expect(result).toEqual(mockConsents);
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(chain.eq).toHaveBeenCalledWith('consented', true);
      expect(chain.is).toHaveBeenCalledWith('withdrawn_at', null);
    });

    it('should filter by expiration date', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.getActiveUserConsents('user-123');

      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining('expiration_date.is.null')
      );
    });

    it('should throw error when query fails', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Query failed' },
      });
      mockSupabase.from.mockReturnValue(chain);

      await expect(service.getActiveUserConsents('user-123')).rejects.toThrow(
        'Failed to fetch active user consents: Query failed'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // grantConsent Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('grantConsent', () => {
    it('should grant consent with all parameters', async () => {
      const mockConsent = createMockConsent({ id: 1 });
      const insertChain = createChainableMock({ data: mockConsent, error: null });
      const verificationChain = createChainableMock({ data: null, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'privacy_consent') return insertChain;
        if (table === 'consent_verification_log') return verificationChain;
        return insertChain;
      });

      const params: GrantConsentParams = {
        userId: 'user-123',
        consentType: 'privacy',
        consentMethod: 'electronic_signature',
        firstName: 'John',
        lastName: 'Doe',
        filePath: '/signatures/sig-123.png',
        sharingPermissions: {
          share_with_providers: true,
          share_with_family: true,
        },
        expirationMonths: 12,
        witnessId: 'witness-456',
        notes: 'Patient verbally confirmed understanding',
      };

      const result = await service.grantConsent(params);

      expect(result).toEqual(mockConsent);
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          consent_type: 'privacy',
          consented: true,
          first_name: 'John',
          last_name: 'Doe',
          witness_id: 'witness-456',
        })
      );
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CONSENT_GRANTED',
        true,
        expect.objectContaining({
          user_id: 'user-123',
          consent_type: 'privacy',
          witnessed: true,
        })
      );
    });

    it('should use default values when optional params not provided', async () => {
      const mockConsent = createMockConsent();
      const chain = createChainableMock({ data: mockConsent, error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.grantConsent({
        userId: 'user-123',
        consentType: 'treatment',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          consent_method: 'electronic_signature',
          sharing_permissions: expect.objectContaining({
            share_with_providers: true,
            share_with_family: false,
            share_with_researchers: false,
          }),
        })
      );
    });

    it('should calculate expiration date when expirationMonths provided', async () => {
      const mockConsent = createMockConsent();
      const chain = createChainableMock({ data: mockConsent, error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.grantConsent({
        userId: 'user-123',
        consentType: 'research',
        expirationMonths: 6,
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          expiration_date: expect.any(String),
        })
      );
    });

    it('should capture IP address and user agent', async () => {
      const mockConsent = createMockConsent();
      const chain = createChainableMock({ data: mockConsent, error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.grantConsent({
        userId: 'user-123',
        consentType: 'privacy',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0 Test Browser',
        })
      );
    });

    it('should handle IP lookup failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const mockConsent = createMockConsent();
      const chain = createChainableMock({ data: mockConsent, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await service.grantConsent({
        userId: 'user-123',
        consentType: 'privacy',
      });

      expect(result).toEqual(mockConsent);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: undefined,
        })
      );
    });

    it('should throw error when insert fails', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Insert failed' },
      });
      mockSupabase.from.mockReturnValue(chain);

      await expect(
        service.grantConsent({
          userId: 'user-123',
          consentType: 'privacy',
        })
      ).rejects.toThrow('Failed to grant consent: Insert failed');
    });

    it('should include audit trail in consent record', async () => {
      const mockConsent = createMockConsent();
      const chain = createChainableMock({ data: mockConsent, error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.grantConsent({
        userId: 'user-123',
        consentType: 'privacy',
        consentMethod: 'verbal_recorded',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          audit_trail: expect.arrayContaining([
            expect.objectContaining({
              action: 'granted',
              method: 'verbal_recorded',
            }),
          ]),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkUserConsent Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkUserConsent', () => {
    it('should return valid consent status', async () => {
      const verificationChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(verificationChain);
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            has_consent: true,
            consent_id: 123,
            expires_at: '2026-01-01T00:00:00Z',
            is_expired: false,
            sharing_permissions: { share_with_providers: true },
          },
        ],
        error: null,
      });

      const result = await service.checkUserConsent('user-123', 'privacy', 'billing-service');

      expect(result).toEqual({
        has_consent: true,
        consent_id: 123,
        expires_at: '2026-01-01T00:00:00Z',
        is_expired: false,
        sharing_permissions: { share_with_providers: true },
        verification_reason: 'billing-service',
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_user_consent', {
        p_user_id: 'user-123',
        p_consent_type: 'privacy',
      });
    });

    it('should return no consent when not found', async () => {
      const verificationChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(verificationChain);
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.checkUserConsent('user-123', 'research');

      expect(result.has_consent).toBe(false);
      expect(result.is_expired).toBe(false);
    });

    it('should handle expired consent', async () => {
      const verificationChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(verificationChain);
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            has_consent: false,
            consent_id: 123,
            is_expired: true,
          },
        ],
        error: null,
      });

      const result = await service.checkUserConsent('user-123', 'treatment');

      expect(result.has_consent).toBe(false);
      expect(result.is_expired).toBe(true);
    });

    it('should log verification to audit', async () => {
      const verificationChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(verificationChain);
      mockSupabase.rpc.mockResolvedValue({
        data: [{ has_consent: true }],
        error: null,
      });

      await service.checkUserConsent('user-123', 'privacy', 'ai-service');

      expect(auditLogger.phi).toHaveBeenCalledWith(
        'CONSENT_VERIFIED',
        'user-123',
        expect.objectContaining({
          consent_type: 'privacy',
          requesting_service: 'ai-service',
        })
      );
    });

    it('should throw error when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.checkUserConsent('user-123', 'privacy')).rejects.toThrow(
        'Failed to check user consent: RPC failed'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // withdrawConsent Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('withdrawConsent', () => {
    it('should withdraw consent successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.withdrawConsent({
        consentId: 123,
        withdrawalReason: 'Patient request',
      });

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('withdraw_consent', {
        p_consent_id: 123,
        p_withdrawal_reason: 'Patient request',
      });
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CONSENT_WITHDRAWN',
        true,
        expect.objectContaining({
          consent_id: 123,
          withdrawal_reason: 'Patient request',
        })
      );
    });

    it('should withdraw without reason', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      await service.withdrawConsent({ consentId: 456 });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('withdraw_consent', {
        p_consent_id: 456,
        p_withdrawal_reason: undefined,
      });
    });

    it('should throw error when withdrawal fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Withdrawal failed' },
      });

      await expect(
        service.withdrawConsent({ consentId: 123 })
      ).rejects.toThrow('Failed to withdraw consent: Withdrawal failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateSharingPermissions Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateSharingPermissions', () => {
    it('should update sharing permissions and audit trail', async () => {
      const existingConsent = createMockConsent({
        id: 123,
        sharing_permissions: { share_with_providers: true },
        audit_trail: [{ action: 'granted', timestamp: '2025-01-01T00:00:00Z' }],
      });
      const updatedConsent = createMockConsent({
        id: 123,
        sharing_permissions: { share_with_providers: true, share_with_family: true },
      });

      const fetchChain = createChainableMock({ data: existingConsent, error: null });
      const updateChain = createChainableMock({ data: updatedConsent, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchChain : updateChain;
      });

      const newPermissions: SharingPermissions = {
        share_with_providers: true,
        share_with_family: true,
      };

      const result = await service.updateSharingPermissions(123, newPermissions);

      expect(result).toEqual(updatedConsent);
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          sharing_permissions: newPermissions,
          audit_trail: expect.arrayContaining([
            expect.objectContaining({ action: 'permissions_updated' }),
          ]),
        })
      );
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'SHARING_PERMISSIONS_UPDATED',
        true,
        expect.objectContaining({
          consent_id: 123,
          old_permissions: existingConsent.sharing_permissions,
          new_permissions: newPermissions,
        })
      );
    });

    it('should throw error when consent not found', async () => {
      const fetchChain = createChainableMock({
        data: null,
        error: { message: 'Consent not found' },
      });
      mockSupabase.from.mockReturnValue(fetchChain);

      await expect(
        service.updateSharingPermissions(999, { share_with_providers: false })
      ).rejects.toThrow('Failed to fetch consent: Consent not found');
    });

    it('should throw error when update fails', async () => {
      const existingConsent = createMockConsent();
      const fetchChain = createChainableMock({ data: existingConsent, error: null });
      const updateChain = createChainableMock({
        data: null,
        error: { message: 'Update failed' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchChain : updateChain;
      });

      await expect(
        service.updateSharingPermissions(123, { share_with_family: true })
      ).rejects.toThrow('Failed to update sharing permissions: Update failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getExpiringConsents Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getExpiringConsents', () => {
    it('should return expiring consents with default 30 days', async () => {
      const mockExpiring: ExpiringConsent[] = [
        {
          user_id: 'user-1',
          consent_id: 1,
          consent_type: 'privacy',
          expiration_date: '2025-02-01T00:00:00Z',
          days_until_expiration: 25,
          user_email: 'user1@example.com',
          user_name: 'User One',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockExpiring,
        error: null,
      });

      const result = await service.getExpiringConsents();

      expect(result).toEqual(mockExpiring);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_expiring_consents', {
        p_days_until_expiration: 30,
      });
      expect(auditLogger.info).toHaveBeenCalledWith(
        'EXPIRING_CONSENTS_RETRIEVED',
        expect.objectContaining({ count: 1, days_until_expiration: 30 })
      );
    });

    it('should accept custom days parameter', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getExpiringConsents(7);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_expiring_consents', {
        p_days_until_expiration: 7,
      });
    });

    it('should throw error when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      await expect(service.getExpiringConsents()).rejects.toThrow(
        'Failed to fetch expiring consents: RPC error'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createExpirationAlert Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createExpirationAlert', () => {
    it('should create expiration alert', async () => {
      const chain = createChainableMock({ data: null, error: null });
      // Override insert to resolve immediately
      chain.insert.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.createExpirationAlert('user-123', 456, 'expiring_soon_30d');

      expect(mockSupabase.from).toHaveBeenCalledWith('consent_expiration_alerts');
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        consent_id: 456,
        alert_type: 'expiring_soon_30d',
        notification_sent: false,
      });
      expect(auditLogger.info).toHaveBeenCalledWith(
        'EXPIRATION_ALERT_CREATED',
        expect.objectContaining({
          user_id: 'user-123',
          consent_id: 456,
          alert_type: 'expiring_soon_30d',
        })
      );
    });

    it('should handle all alert types', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.insert.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      const alertTypes = ['expiring_soon_30d', 'expiring_soon_7d', 'expired', 'requires_reauthorization'] as const;

      for (const alertType of alertTypes) {
        await service.createExpirationAlert('user-123', 1, alertType);
        expect(chain.insert).toHaveBeenLastCalledWith(
          expect.objectContaining({ alert_type: alertType })
        );
      }
    });

    it('should throw error when insert fails', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.insert.mockResolvedValue({ error: { message: 'Insert failed' } });
      mockSupabase.from.mockReturnValue(chain);

      await expect(
        service.createExpirationAlert('user-123', 456, 'expired')
      ).rejects.toThrow('Failed to create expiration alert: Insert failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // markAlertAsSent Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('markAlertAsSent', () => {
    it('should mark alert as sent', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.markAlertAsSent('alert-123', 'email');

      expect(mockSupabase.from).toHaveBeenCalledWith('consent_expiration_alerts');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_sent: true,
          notification_method: 'email',
          notification_sent_at: expect.any(String),
        })
      );
      expect(auditLogger.info).toHaveBeenCalledWith(
        'ALERT_MARKED_AS_SENT',
        expect.objectContaining({
          alert_id: 'alert-123',
          notification_method: 'email',
        })
      );
    });

    it('should support different notification methods', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      const methods = ['email', 'sms', 'push', 'in_app'];

      for (const method of methods) {
        await service.markAlertAsSent('alert-123', method);
        expect(chain.update).toHaveBeenLastCalledWith(
          expect.objectContaining({ notification_method: method })
        );
      }
    });

    it('should throw error when update fails', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: { message: 'Update failed' } });
      mockSupabase.from.mockReturnValue(chain);

      await expect(
        service.markAlertAsSent('alert-123', 'email')
      ).rejects.toThrow('Failed to mark alert as sent: Update failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordAlertResponse Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('recordAlertResponse', () => {
    it('should record patient renewed response', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.recordAlertResponse('alert-123', 'renewed');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_responded: true,
          patient_action: 'renewed',
          patient_response_at: expect.any(String),
        })
      );
      expect(auditLogger.info).toHaveBeenCalledWith(
        'ALERT_RESPONSE_RECORDED',
        expect.objectContaining({
          alert_id: 'alert-123',
          patient_action: 'renewed',
        })
      );
    });

    it('should record patient withdrew response', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.recordAlertResponse('alert-456', 'withdrew');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ patient_action: 'withdrew' })
      );
    });

    it('should record patient ignored response', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(chain);

      await service.recordAlertResponse('alert-789', 'ignored');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ patient_action: 'ignored' })
      );
    });

    it('should throw error when update fails', async () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ error: { message: 'Update failed' } });
      mockSupabase.from.mockReturnValue(chain);

      await expect(
        service.recordAlertResponse('alert-123', 'renewed')
      ).rejects.toThrow('Failed to record alert response: Update failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getConsentVerificationHistory Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getConsentVerificationHistory', () => {
    it('should return verification history with default limit', async () => {
      const mockHistory: ConsentVerificationLog[] = [
        {
          id: 'log-1',
          user_id: 'user-123',
          consent_type: 'privacy',
          verification_result: true,
          consent_found: true,
          consent_expired: false,
          consent_withdrawn: false,
          additional_metadata: {},
          verified_at: '2025-01-05T10:00:00Z',
        },
      ];

      // Create chain where order returns object with limit method
      const mockLimit = vi.fn().mockResolvedValue({ data: mockHistory, error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await service.getConsentVerificationHistory('user-123');

      expect(result).toEqual(mockHistory);
      expect(mockSupabase.from).toHaveBeenCalledWith('consent_verification_log');
      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'VERIFICATION_HISTORY_ACCESSED',
        'user-123',
        expect.objectContaining({ count: 1, limit: 100 })
      );
    });

    it('should accept custom limit', async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await service.getConsentVerificationHistory('user-123', 50);

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('should throw error when query fails', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await expect(
        service.getConsentVerificationHistory('user-123')
      ).rejects.toThrow('Failed to fetch verification history: Query failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Singleton Export Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Export', () => {
    it('should export singleton instance', () => {
      expect(consentManagementService).toBeInstanceOf(ConsentManagementService);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle full consent lifecycle', async () => {
      // 1. Grant consent
      const mockConsent = createMockConsent({ id: 1 });
      const grantChain = createChainableMock({ data: mockConsent, error: null });
      mockSupabase.from.mockReturnValue(grantChain);

      const granted = await service.grantConsent({
        userId: 'user-123',
        consentType: 'privacy',
        expirationMonths: 12,
      });
      expect(granted.id).toBe(1);

      // 2. Check consent
      mockSupabase.rpc.mockResolvedValue({
        data: [{ has_consent: true, consent_id: 1 }],
        error: null,
      });

      const check = await service.checkUserConsent('user-123', 'privacy');
      expect(check.has_consent).toBe(true);

      // 3. Update permissions
      const fetchChain = createChainableMock({ data: mockConsent, error: null });
      const updateChain = createChainableMock({
        data: { ...mockConsent, sharing_permissions: { share_with_family: true } },
        error: null,
      });
      let updateCallCount = 0;
      mockSupabase.from.mockImplementation(() => {
        updateCallCount++;
        return updateCallCount === 1 ? fetchChain : updateChain;
      });

      const updated = await service.updateSharingPermissions(1, {
        share_with_family: true,
      });
      expect(updated.sharing_permissions).toEqual({ share_with_family: true });

      // 4. Withdraw consent
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const withdrawn = await service.withdrawConsent({
        consentId: 1,
        withdrawalReason: 'Patient request',
      });
      expect(withdrawn).toBe(true);
    });

    it('should handle consent expiration workflow', async () => {
      // 1. Get expiring consents
      const expiring: ExpiringConsent[] = [
        {
          user_id: 'user-123',
          consent_id: 1,
          consent_type: 'privacy',
          expiration_date: '2025-02-01T00:00:00Z',
          days_until_expiration: 7,
          user_email: 'user@example.com',
          user_name: 'Test User',
        },
      ];
      mockSupabase.rpc.mockResolvedValue({ data: expiring, error: null });

      const expiringConsents = await service.getExpiringConsents(7);
      expect(expiringConsents).toHaveLength(1);

      // 2. Create alert
      const alertChain = createChainableMock({ data: null, error: null });
      alertChain.insert.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue(alertChain);

      await service.createExpirationAlert('user-123', 1, 'expiring_soon_7d');

      // 3. Mark alert as sent
      alertChain.eq.mockResolvedValue({ error: null });
      await service.markAlertAsSent('alert-1', 'email');

      // 4. Record patient response
      await service.recordAlertResponse('alert-1', 'renewed');

      expect(auditLogger.info).toHaveBeenCalledWith(
        'ALERT_RESPONSE_RECORDED',
        expect.any(Object)
      );
    });
  });
});
