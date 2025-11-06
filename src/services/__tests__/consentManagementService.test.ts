/**
 * CONSENT MANAGEMENT SERVICE - JEST TESTS (INTEGRATED SCHEMA)
 *
 * Tests for integrated privacy_consent table - ZERO TECH DEBT
 *
 * Test Coverage:
 * - ✅ Consent granting
 * - ✅ Consent verification
 * - ✅ Consent withdrawal
 * - ✅ Sharing permissions updates
 * - ✅ Expiration tracking
 * - ✅ Audit logging
 * - ✅ Error handling
 *
 * @module ConsentManagementServiceTests
 */

import {
  ConsentManagementService,
  ConsentType,
  ConsentMethod,
  SharingPermissions,
  GrantConsentParams,
  Consent,
} from '../consentManagementService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// Mock dependencies
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  },
}));

jest.mock('../auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    error: jest.fn(),
    phi: jest.fn(),
    clinical: jest.fn(),
  },
}));

// Mock fetch for IP address
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ ip: '192.168.1.1' }),
  })
) as jest.Mock;

// Test data
const mockUserId = 'user-123-456-789';
const mockConsentId = 12345; // BIGINT (number, not UUID)
const mockRequestingUserId = 'user-admin-999';

const mockConsent = {
  id: mockConsentId,
  user_id: mockUserId,
  consent_type: 'treatment' as ConsentType,
  consented: true,
  first_name: 'John',
  last_name: 'Doe',
  file_path: `${mockUserId}/privacy_John_Doe_1234567890.png`,
  consent_method: 'electronic_signature' as ConsentMethod,
  consented_at: new Date().toISOString(),
  effective_date: new Date().toISOString(),
  expiration_date: null,
  withdrawn_at: null,
  withdrawal_reason: null,
  sharing_permissions: {
    share_with_providers: true,
    share_with_family: false,
    share_with_researchers: false,
    allowed_third_parties: [],
    data_types_allowed: [],
    data_types_restricted: []
  } as SharingPermissions,
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0...',
  witness_id: null,
  notes: 'Initial consent at registration',
  audit_trail: [
    {
      action: 'granted',
      timestamp: new Date().toISOString(),
      method: 'electronic_signature',
    },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('ConsentManagementService', () => {
  let service: ConsentManagementService;

  beforeEach(() => {
    service = new ConsentManagementService();
    jest.clearAllMocks();

    // Default auth session mock
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: mockRequestingUserId },
        },
      },
    });
  });

  // ==========================================================================
  // CONSENT GRANTING TESTS
  // ==========================================================================

  describe('grantConsent', () => {
    it('should grant consent with all parameters', async () => {
      const grantParams: GrantConsentParams = {
        userId: mockUserId,
        consentType: 'treatment',
        consentMethod: 'electronic_signature',
        firstName: 'John',
        lastName: 'Doe',
        filePath: `${mockUserId}/privacy_John_Doe_1234567890.png`,
        sharingPermissions: {
          share_with_providers: true,
          share_with_family: false,
        },
        expirationMonths: 12,
        notes: 'Patient consented during visit',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockConsent,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.grantConsent(grantParams);

      expect(result).toEqual(mockConsent);
      expect(supabase.from).toHaveBeenCalledWith('privacy_consent');
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CONSENT_GRANTED',
        true,
        expect.objectContaining({
          user_id: mockUserId,
          consent_type: 'treatment',
        })
      );
    });

    it('should grant consent without optional parameters', async () => {
      const grantParams: GrantConsentParams = {
        userId: mockUserId,
        consentType: 'privacy',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockConsent, consent_type: 'privacy' },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.grantConsent(grantParams);

      expect(result).toBeDefined();
      expect(result.consent_type).toBe('privacy');
      expect(result.user_id).toBe(mockUserId);
    });

    it('should calculate expiration date correctly', async () => {
      const grantParams: GrantConsentParams = {
        userId: mockUserId,
        consentType: 'research',
        expirationMonths: 6,
      };

      let capturedConsentData: any;

      // Mock insert for consent (first call)
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockImplementation((data) => {
          capturedConsentData = data;
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockConsent, ...data },
                error: null,
              }),
            }),
          };
        }),
      });

      // Mock insert for verification log (second call)
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await service.grantConsent(grantParams);

      expect(capturedConsentData).toBeDefined();
      expect(capturedConsentData.expiration_date).toBeDefined();

      const expirationDate = new Date(capturedConsentData.expiration_date);
      const now = new Date();
      const monthsDiff =
        (expirationDate.getFullYear() - now.getFullYear()) * 12 +
        (expirationDate.getMonth() - now.getMonth());

      expect(monthsDiff).toBe(6);
    });

    it('should handle grant consent errors', async () => {
      const grantParams: GrantConsentParams = {
        userId: mockUserId,
        consentType: 'treatment',
      };

      const mockError = new Error('Database constraint violation');

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(service.grantConsent(grantParams)).rejects.toThrow(
        'Failed to grant consent'
      );

      expect(auditLogger.error).toHaveBeenCalledWith(
        'CONSENT_GRANT_FAILED',
        mockError,
        expect.any(Object)
      );
    });

    it('should include audit trail on grant', async () => {
      const grantParams: GrantConsentParams = {
        userId: mockUserId,
        consentType: 'treatment',
      };

      let capturedConsentData: any;

      // Mock insert for consent
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockImplementation((data) => {
          capturedConsentData = data;
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockConsent, ...data },
                error: null,
              }),
            }),
          };
        }),
      });

      // Mock insert for verification log
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await service.grantConsent(grantParams);

      expect(capturedConsentData).toBeDefined();
      expect(capturedConsentData.audit_trail).toBeDefined();
      expect(capturedConsentData.audit_trail.length).toBe(1);
      expect(capturedConsentData.audit_trail[0].action).toBe('granted');
    });
  });

  // ==========================================================================
  // CONSENT VERIFICATION TESTS
  // ==========================================================================

  describe('checkUserConsent', () => {
    it('should verify valid consent exists', async () => {
      const mockRpcResult = [
        {
          has_consent: true,
          consent_id: mockConsentId,
          expires_at: null,
          is_expired: false,
          sharing_permissions: { share_with_providers: true },
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      const result = await service.checkUserConsent(
        mockUserId,
        'treatment',
        'fhir_sync'
      );

      expect(result.has_consent).toBe(true);
      expect(result.is_expired).toBe(false);
      expect(supabase.rpc).toHaveBeenCalledWith('check_user_consent', {
        p_user_id: mockUserId,
        p_consent_type: 'treatment',
      });
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'CONSENT_VERIFIED',
        mockUserId,
        expect.objectContaining({
          consent_type: 'treatment',
          has_consent: true,
        })
      );
    });

    it('should return false when no consent exists', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.checkUserConsent(
        mockUserId,
        'research'
      );

      expect(result.has_consent).toBe(false);
      expect(result.is_expired).toBe(false);
      expect(result.consent_id).toBeUndefined();
    });

    it('should detect expired consent', async () => {
      const mockRpcResult = [
        {
          has_consent: false,
          consent_id: mockConsentId,
          expires_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          is_expired: true,
          sharing_permissions: {},
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      const result = await service.checkUserConsent(
        mockUserId,
        'research'
      );

      expect(result.has_consent).toBe(false);
      expect(result.is_expired).toBe(true);
    });

    it('should handle consent check errors', async () => {
      const mockError = new Error('RPC function failed');

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        service.checkUserConsent(mockUserId, 'treatment')
      ).rejects.toThrow('Failed to check user consent');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'CONSENT_CHECK_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // CONSENT WITHDRAWAL TESTS
  // ==========================================================================

  describe('withdrawConsent', () => {
    it('should withdraw consent successfully', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.withdrawConsent({
        consentId: mockConsentId,
        withdrawalReason: 'Patient requested withdrawal',
      });

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('withdraw_consent', {
        p_consent_id: mockConsentId,
        p_withdrawal_reason: 'Patient requested withdrawal',
      });
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CONSENT_WITHDRAWN',
        true,
        expect.objectContaining({
          consent_id: mockConsentId,
          withdrawal_reason: 'Patient requested withdrawal',
        })
      );
    });

    it('should withdraw consent without reason', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.withdrawConsent({
        consentId: mockConsentId,
      });

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('withdraw_consent', {
        p_consent_id: mockConsentId,
        p_withdrawal_reason: undefined,
      });
    });

    it('should handle withdrawal errors', async () => {
      const mockError = new Error('Consent not found');

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        service.withdrawConsent({ consentId: mockConsentId })
      ).rejects.toThrow('Failed to withdraw consent');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'CONSENT_WITHDRAWAL_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // SHARING PERMISSIONS TESTS
  // ==========================================================================

  describe('updateSharingPermissions', () => {
    it('should update sharing permissions', async () => {
      const newPermissions: SharingPermissions = {
        share_with_providers: true,
        share_with_family: true,
        share_with_researchers: false,
        allowed_third_parties: ['fitbit', 'apple_health'],
      };

      // Mock select (fetch existing consent)
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockConsent,
              error: null,
            }),
          }),
        }),
      });

      // Mock update
      (supabase.from as jest.Mock).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockConsent, sharing_permissions: newPermissions },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.updateSharingPermissions(
        mockConsentId,
        newPermissions
      );

      expect(result.sharing_permissions).toEqual(newPermissions);
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'SHARING_PERMISSIONS_UPDATED',
        true,
        expect.objectContaining({
          consent_id: mockConsentId,
          old_permissions: mockConsent.sharing_permissions,
          new_permissions: newPermissions,
        })
      );
    });

    it('should maintain audit trail when updating permissions', async () => {
      let capturedUpdateData: any;

      // Mock select
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockConsent,
              error: null,
            }),
          }),
        }),
      });

      // Mock update - capture data
      (supabase.from as jest.Mock).mockReturnValueOnce({
        update: jest.fn().mockImplementation((data) => {
          capturedUpdateData = data;
          return {
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockConsent, ...data },
                  error: null,
                }),
              }),
            }),
          };
        }),
      });

      const newPermissions: SharingPermissions = { share_with_providers: false };

      await service.updateSharingPermissions(mockConsentId, newPermissions);

      expect(capturedUpdateData.audit_trail).toBeDefined();
      expect(capturedUpdateData.audit_trail.length).toBeGreaterThan(
        mockConsent.audit_trail.length
      );

      const lastAuditEntry =
        capturedUpdateData.audit_trail[capturedUpdateData.audit_trail.length - 1];
      expect(lastAuditEntry.action).toBe('permissions_updated');
      expect(lastAuditEntry.old_permissions).toEqual(
        mockConsent.sharing_permissions
      );
      expect(lastAuditEntry.new_permissions).toEqual(newPermissions);
    });

    it('should handle permission update errors', async () => {
      const mockError = new Error('Update failed');

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(
        service.updateSharingPermissions(mockConsentId, {})
      ).rejects.toThrow('Failed to fetch consent');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'CONSENT_FETCH_FOR_UPDATE_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // EXPIRATION TRACKING TESTS
  // ==========================================================================

  describe('getExpiringConsents', () => {
    it('should fetch expiring consents', async () => {
      const mockExpiringConsents = [
        {
          user_id: mockUserId,
          consent_id: mockConsentId,
          consent_type: 'research' as ConsentType,
          expiration_date: new Date(Date.now() + 15 * 86400000).toISOString(),
          days_until_expiration: 15,
          user_email: 'patient@example.com',
          user_name: 'John Doe',
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockExpiringConsents,
        error: null,
      });

      const result = await service.getExpiringConsents(30);

      expect(result).toEqual(mockExpiringConsents);
      expect(supabase.rpc).toHaveBeenCalledWith('get_expiring_consents', {
        p_days_until_expiration: 30,
      });
      expect(auditLogger.info).toHaveBeenCalledWith(
        'EXPIRING_CONSENTS_RETRIEVED',
        expect.objectContaining({
          count: 1,
          days_until_expiration: 30,
        })
      );
    });

    it('should use default expiration window', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getExpiringConsents();

      expect(supabase.rpc).toHaveBeenCalledWith('get_expiring_consents', {
        p_days_until_expiration: 30, // Default value
      });
    });
  });

  describe('createExpirationAlert', () => {
    it('should create expiration alert', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      await service.createExpirationAlert(
        mockUserId,
        mockConsentId,
        'expiring_soon_7d'
      );

      expect(supabase.from).toHaveBeenCalledWith('consent_expiration_alerts');
      expect(auditLogger.info).toHaveBeenCalledWith(
        'EXPIRATION_ALERT_CREATED',
        expect.objectContaining({
          user_id: mockUserId,
          consent_id: mockConsentId,
          alert_type: 'expiring_soon_7d',
        })
      );
    });
  });

  // ==========================================================================
  // USER CONSENT RETRIEVAL TESTS
  // ==========================================================================

  describe('getUserConsents', () => {
    it('should fetch all consents for a user', async () => {
      const mockConsents = [mockConsent];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockConsents,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getUserConsents(mockUserId);

      expect(result).toEqual(mockConsents);
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'CONSENT_RECORDS_ACCESSED',
        mockUserId,
        expect.objectContaining({
          count: 1,
        })
      );
    });
  });

  describe('getActiveUserConsents', () => {
    it('should fetch only active consents', async () => {
      const mockActiveConsents = [mockConsent];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                or: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockActiveConsents,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getActiveUserConsents(mockUserId);

      expect(result).toEqual(mockActiveConsents);
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'ACTIVE_CONSENTS_ACCESSED',
        mockUserId,
        expect.objectContaining({
          count: 1,
        })
      );
    });
  });

  // ==========================================================================
  // AUDIT TRAIL TESTS
  // ==========================================================================

  describe('getConsentVerificationHistory', () => {
    it('should fetch verification history', async () => {
      const mockHistory = [
        {
          id: 'log-123',
          user_id: mockUserId,
          consent_type: 'treatment' as ConsentType,
          verification_result: true,
          consent_found: true,
          consent_expired: false,
          consent_withdrawn: false,
          verified_at: new Date().toISOString(),
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockHistory,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.getConsentVerificationHistory(mockUserId, 50);

      expect(result).toEqual(mockHistory);
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'VERIFICATION_HISTORY_ACCESSED',
        mockUserId,
        expect.objectContaining({
          count: 1,
          limit: 50,
        })
      );
    });
  });

  // ==========================================================================
  // ERROR HANDLING & EDGE CASES
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Network request timeout');

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockRejectedValue(timeoutError),
          }),
        }),
      });

      await expect(service.getUserConsents(mockUserId)).rejects.toThrow();
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('should handle invalid consent IDs', async () => {
      const mockError = { message: 'Invalid consent ID', code: '22003' };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        service.withdrawConsent({ consentId: -1 })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle full consent lifecycle', async () => {
      // 1. Grant consent
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockConsent,
              error: null,
            }),
          }),
        }),
      });

      const grantedConsent = await service.grantConsent({
        userId: mockUserId,
        consentType: 'treatment',
      });

      expect(grantedConsent.consented).toBe(true);

      // 2. Verify consent
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            has_consent: true,
            consent_id: mockConsentId,
            is_expired: false,
          },
        ],
        error: null,
      });

      const verification = await service.checkUserConsent(
        mockUserId,
        'treatment'
      );

      expect(verification.has_consent).toBe(true);

      // 3. Withdraw consent
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const withdrawn = await service.withdrawConsent({
        consentId: mockConsentId,
        withdrawalReason: 'Patient request',
      });

      expect(withdrawn).toBe(true);

      // Verify all audit logs were created
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CONSENT_GRANTED',
        true,
        expect.any(Object)
      );
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'CONSENT_VERIFIED',
        mockUserId,
        expect.any(Object)
      );
      expect(auditLogger.clinical).toHaveBeenCalledWith(
        'CONSENT_WITHDRAWN',
        true,
        expect.any(Object)
      );
    });

    it('should maintain existing UI compatibility for photo/privacy consent', async () => {
      // Simulates existing ConsentPhotoPage.tsx / ConsentPrivacyPage.tsx workflow
      const existingUIParams: GrantConsentParams = {
        userId: mockUserId,
        consentType: 'photo', // or 'privacy'
        firstName: 'Jane',
        lastName: 'Smith',
        filePath: `${mockUserId}/photo_Jane_Smith_9876543210.png`,
      };

      const photoConsentResult = {
        ...mockConsent,
        consent_type: 'photo' as ConsentType,
        file_path: `${mockUserId}/photo_Jane_Smith_9876543210.png`,
        first_name: 'Jane',
        last_name: 'Smith',
      };

      // Mock insert for consent
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: photoConsentResult,
              error: null,
            }),
          }),
        }),
      });

      // Mock insert for verification log
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await service.grantConsent(existingUIParams);

      expect(result.consent_type).toBe('photo');
      expect(result.file_path).toContain('photo_Jane_Smith');
      expect(supabase.from).toHaveBeenCalledWith('privacy_consent');
    });
  });
});
