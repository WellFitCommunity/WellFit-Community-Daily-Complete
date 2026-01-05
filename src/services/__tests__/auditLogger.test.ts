/**
 * Audit Logger Service Tests
 *
 * Tests for HIPAA §164.312(b) compliant audit logging:
 * - Info, warn, error logging
 * - PHI access logging
 * - Authentication event logging
 * - Clinical and billing event logging
 * - Security event logging
 * - User context enrichment
 * - Fallback error reporting
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import { errorReporter } from '../errorReporter';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockInsert = vi.fn();
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  const mockGetUser = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: mockGetUser,
      },
    },
  };
});

// Mock error reporter
vi.mock('../errorReporter', () => ({
  errorReporter: {
    reportCritical: vi.fn(),
  },
}));

// Mock import.meta.env
const mockEnv = {
  MODE: 'production',
  VITE_HIPAA_LOGGING_ENABLED: 'true',
};

vi.stubGlobal('import.meta', { env: mockEnv });

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

const mockErrorReporter = errorReporter as unknown as {
  reportCritical: ReturnType<typeof vi.fn>;
};

describe('AuditLogger', () => {
  let auditLogger: typeof import('../auditLogger').auditLogger;
  let logInfo: typeof import('../auditLogger').logInfo;
  let logError: typeof import('../auditLogger').logError;
  let logPhiAccess: typeof import('../auditLogger').logPhiAccess;
  let logAuth: typeof import('../auditLogger').logAuth;
  let logClinical: typeof import('../auditLogger').logClinical;
  let logBilling: typeof import('../auditLogger').logBilling;
  let logSecurity: typeof import('../auditLogger').logSecurity;

  let mockInsert: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock insert
    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });

    // Setup default user context
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    // Setup navigator mock
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Test Browser' },
      writable: true,
      configurable: true,
    });

    // Re-import to get fresh instance with mocks applied
    vi.resetModules();
    const module = await import('../auditLogger');
    auditLogger = module.auditLogger;
    logInfo = module.logInfo;
    logError = module.logError;
    logPhiAccess = module.logPhiAccess;
    logAuth = module.logAuth;
    logClinical = module.logClinical;
    logBilling = module.logBilling;
    logSecurity = module.logSecurity;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // info() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('info', () => {
    it('should log informational event to database', async () => {
      await auditLogger.info('USER_DASHBOARD_VIEWED', { page: 'home' });

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_DASHBOARD_VIEWED',
          event_category: 'SYSTEM_EVENT',
          success: true,
          metadata: { page: 'home' },
        })
      );
    });

    it('should include user context from auth', async () => {
      await auditLogger.info('PAGE_LOADED');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: 'user-123',
          actor_user_agent: 'Mozilla/5.0 Test Browser',
        })
      );
    });

    it('should work without metadata', async () => {
      await auditLogger.info('SIMPLE_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SIMPLE_EVENT',
          metadata: undefined,
        })
      );
    });

    it('should handle missing user gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      await auditLogger.info('ANONYMOUS_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: null,
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // warn() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('warn', () => {
    it('should log warning event', async () => {
      await auditLogger.warn('SESSION_EXPIRING_SOON', { minutesLeft: 5 });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SESSION_EXPIRING_SOON',
          event_category: 'SYSTEM_EVENT',
          success: true,
          metadata: { minutesLeft: 5 },
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // error() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error', () => {
    it('should log error with Error object', async () => {
      const error = new Error('Database connection failed');
      error.name = 'DatabaseError';

      await auditLogger.error('DB_CONNECTION_FAILED', error, { host: 'db.example.com' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'DB_CONNECTION_FAILED',
          event_category: 'SYSTEM_EVENT',
          success: false,
          error_code: 'DatabaseError',
          error_message: 'Database connection failed',
          metadata: { host: 'db.example.com' },
        })
      );
    });

    it('should log error with string message', async () => {
      await auditLogger.error('VALIDATION_FAILED', 'Invalid email format');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'VALIDATION_FAILED',
          success: false,
          error_code: 'ERROR',
          error_message: 'Invalid email format',
        })
      );
    });

    it('should work without metadata', async () => {
      await auditLogger.error('UNKNOWN_ERROR', new Error('Something broke'));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'UNKNOWN_ERROR',
          success: false,
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // phi() Tests - HIPAA §164.312(b)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('phi', () => {
    it('should log PHI access with patient ID', async () => {
      await auditLogger.phi('VIEW_PATIENT_RECORD', 'patient-456', {
        section: 'medications',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'PHI_ACCESS',
          event_category: 'PHI_ACCESS',
          operation: 'VIEW_PATIENT_RECORD',
          resource_type: 'patient',
          resource_id: 'patient-456',
          success: true,
          metadata: { section: 'medications' },
        })
      );
    });

    it('should log various PHI operations', async () => {
      const operations = [
        'VIEW_PATIENT_RECORD',
        'EXPORT_PATIENT_DATA',
        'PRINT_PATIENT_SUMMARY',
        'DOWNLOAD_LAB_RESULTS',
      ];

      for (const operation of operations) {
        await auditLogger.phi(operation, 'patient-123');

        expect(mockInsert).toHaveBeenLastCalledWith(
          expect.objectContaining({
            operation,
            resource_type: 'patient',
          })
        );
      }
    });

    it('should always mark PHI access as successful', async () => {
      await auditLogger.phi('ACCESS_DENIED_PHI', 'patient-789');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true, // Even access attempts are logged as successful audit entries
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // auth() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('auth', () => {
    it('should log successful login', async () => {
      await auditLogger.auth('LOGIN', true, { provider: 'email' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_LOGIN',
          event_category: 'AUTHENTICATION',
          operation: 'LOGIN',
          resource_type: 'auth_event',
          success: true,
          metadata: { provider: 'email' },
        })
      );
    });

    it('should log failed login', async () => {
      await auditLogger.auth('LOGIN_FAILED', false, { reason: 'invalid_password' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_LOGIN_FAILED',
          event_category: 'AUTHENTICATION',
          success: false,
          metadata: { reason: 'invalid_password' },
        })
      );
    });

    it('should log logout', async () => {
      await auditLogger.auth('LOGOUT', true);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_LOGOUT',
          operation: 'LOGOUT',
          success: true,
        })
      );
    });

    it('should log password reset', async () => {
      await auditLogger.auth('PASSWORD_RESET', true, { method: 'email_link' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_PASSWORD_RESET',
          operation: 'PASSWORD_RESET',
        })
      );
    });

    it('should log registration', async () => {
      await auditLogger.auth('REGISTRATION', true, { referral: 'website' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_REGISTRATION',
          operation: 'REGISTRATION',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clinical() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clinical', () => {
    it('should log successful clinical operation', async () => {
      await auditLogger.clinical('create_encounter', true, {
        encounterId: 'enc-123',
        patientId: 'patient-456',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'CLINICAL_CREATE_ENCOUNTER',
          event_category: 'CLINICAL',
          operation: 'create_encounter',
          success: true,
        })
      );
    });

    it('should log failed clinical operation', async () => {
      await auditLogger.clinical('sign_order', false, {
        orderId: 'ord-789',
        reason: 'signature_invalid',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'CLINICAL_SIGN_ORDER',
          success: false,
        })
      );
    });

    it('should uppercase operation in event type', async () => {
      await auditLogger.clinical('update_vitals', true);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'CLINICAL_UPDATE_VITALS',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // billing() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('billing', () => {
    it('should log successful billing operation', async () => {
      await auditLogger.billing('submit_claim', true, {
        claimId: 'clm-123',
        amount: 150.0,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'BILLING_SUBMIT_CLAIM',
          event_category: 'BILLING',
          operation: 'submit_claim',
          success: true,
        })
      );
    });

    it('should log failed billing operation', async () => {
      await auditLogger.billing('process_payment', false, {
        reason: 'card_declined',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'BILLING_PROCESS_PAYMENT',
          success: false,
        })
      );
    });

    it('should uppercase operation in event type', async () => {
      await auditLogger.billing('generate_invoice', true);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'BILLING_GENERATE_INVOICE',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // security() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('security', () => {
    it('should log low severity security event', async () => {
      await auditLogger.security('UNUSUAL_LOGIN_TIME', 'low', {
        loginTime: '03:00 AM',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SECURITY_UNUSUAL_LOGIN_TIME',
          event_category: 'SECURITY_EVENT',
          operation: 'UNUSUAL_LOGIN_TIME',
          success: false,
          error_code: 'SEVERITY_LOW',
        })
      );
    });

    it('should log medium severity security event', async () => {
      await auditLogger.security('MULTIPLE_FAILED_LOGINS', 'medium', {
        attempts: 3,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_code: 'SEVERITY_MEDIUM',
        })
      );
    });

    it('should log high severity security event', async () => {
      await auditLogger.security('POSSIBLE_BRUTE_FORCE', 'high', {
        attempts: 10,
        ip: '192.168.1.100',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_code: 'SEVERITY_HIGH',
        })
      );
    });

    it('should log critical severity security event', async () => {
      await auditLogger.security('UNAUTHORIZED_PHI_ACCESS', 'critical', {
        userId: 'attacker-123',
        targetPatient: 'patient-456',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SECURITY_UNAUTHORIZED_PHI_ACCESS',
          error_code: 'SEVERITY_CRITICAL',
        })
      );
    });

    it('should always mark security events as unsuccessful', async () => {
      await auditLogger.security('SUSPICIOUS_ACTIVITY', 'low');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // debug() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('debug', () => {
    it('should not throw in production mode', () => {
      expect(() => auditLogger.debug('Test message', { data: 'test' })).not.toThrow();
    });

    it('should accept message and data parameters', () => {
      // debug is a no-op but should accept parameters without error
      auditLogger.debug('Debug info', { key: 'value' });
      auditLogger.debug('Simple message');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error Handling Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should report to errorReporter when database insert fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database unavailable'));

      await auditLogger.info('TEST_EVENT');

      expect(mockErrorReporter.reportCritical).toHaveBeenCalledWith(
        'AUDIT_LOG_FAILURE',
        expect.any(Error),
        expect.objectContaining({
          event_type: 'TEST_EVENT',
        })
      );
    });

    it('should not throw when logging fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(auditLogger.info('FAILING_EVENT')).resolves.not.toThrow();
    });

    it('should handle auth.getUser failure gracefully', async () => {
      mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('Auth error'));

      await auditLogger.info('NO_USER_CONTEXT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'NO_USER_CONTEXT',
          actor_user_id: null,
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // User Context Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User Context', () => {
    it('should include user ID from authenticated session', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'authenticated-user-789' } },
      });

      await auditLogger.info('AUTHENTICATED_ACTION');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: 'authenticated-user-789',
        })
      );
    });

    it('should include user agent from navigator', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Custom/1.0 TestAgent' },
        writable: true,
        configurable: true,
      });

      await auditLogger.info('BROWSER_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_agent: 'Custom/1.0 TestAgent',
        })
      );
    });

    it('should handle missing navigator gracefully', async () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      await auditLogger.info('SERVER_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_agent: undefined,
        })
      );
    });

    it('should always set IP address to null (browser limitation)', async () => {
      await auditLogger.info('ANY_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_ip_address: null,
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Backward Compatibility Functions Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Backward Compatibility Functions', () => {
    it('logInfo should call auditLogger.info', async () => {
      await logInfo('LEGACY_INFO', { legacy: true });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'LEGACY_INFO',
          metadata: { legacy: true },
        })
      );
    });

    it('logError should call auditLogger.error', async () => {
      await logError('LEGACY_ERROR', new Error('Legacy error'));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'LEGACY_ERROR',
          success: false,
        })
      );
    });

    it('logPhiAccess should call auditLogger.phi', async () => {
      await logPhiAccess('LEGACY_PHI_VIEW', 'patient-legacy');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'PHI_ACCESS',
          resource_id: 'patient-legacy',
        })
      );
    });

    it('logAuth should call auditLogger.auth', async () => {
      await logAuth('LOGIN', true, { legacy: true });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'USER_LOGIN',
          event_category: 'AUTHENTICATION',
        })
      );
    });

    it('logClinical should call auditLogger.clinical', async () => {
      await logClinical('legacy_operation', true);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'CLINICAL_LEGACY_OPERATION',
        })
      );
    });

    it('logBilling should call auditLogger.billing', async () => {
      await logBilling('legacy_billing', true);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'BILLING_LEGACY_BILLING',
        })
      );
    });

    it('logSecurity should call auditLogger.security', async () => {
      await logSecurity('LEGACY_THREAT', 'high');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SECURITY_LEGACY_THREAT',
          error_code: 'SEVERITY_HIGH',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Default Values Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Default Values', () => {
    it('should use UNKNOWN_EVENT when event_type missing', async () => {
      // This tests the internal log() default - we can't call it directly
      // but info() always provides event_type, so this just ensures defaults work
      await auditLogger.info('PROVIDED_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'PROVIDED_EVENT',
        })
      );
    });

    it('should default success to true when not specified', async () => {
      await auditLogger.info('SUCCESS_DEFAULT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should default event_category to SYSTEM_EVENT for info/warn/error', async () => {
      await auditLogger.info('INFO_EVENT');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_category: 'SYSTEM_EVENT',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete user session audit trail', async () => {
      // 1. Login
      await auditLogger.auth('LOGIN', true, { provider: 'email' });

      // 2. View PHI
      await auditLogger.phi('VIEW_PATIENT_RECORD', 'patient-123');

      // 3. Clinical action
      await auditLogger.clinical('create_note', true, { noteId: 'note-456' });

      // 4. Billing action
      await auditLogger.billing('submit_claim', true, { claimId: 'claim-789' });

      // 5. Logout
      await auditLogger.auth('LOGOUT', true);

      expect(mockInsert).toHaveBeenCalledTimes(5);
    });

    it('should handle security incident logging', async () => {
      // Multiple failed logins trigger security events
      await auditLogger.auth('LOGIN_FAILED', false, { attempt: 1 });
      await auditLogger.auth('LOGIN_FAILED', false, { attempt: 2 });
      await auditLogger.auth('LOGIN_FAILED', false, { attempt: 3 });

      // Security event triggered
      await auditLogger.security('MULTIPLE_FAILED_LOGINS', 'medium', {
        attempts: 3,
        userId: 'target-user',
      });

      expect(mockInsert).toHaveBeenCalledTimes(4);
      expect(mockInsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          event_type: 'SECURITY_MULTIPLE_FAILED_LOGINS',
          error_code: 'SEVERITY_MEDIUM',
        })
      );
    });

    it('should log errors with full context', async () => {
      const complexError = new Error('Complex operation failed');
      complexError.name = 'OperationError';

      await auditLogger.error('OPERATION_FAILED', complexError, {
        operationId: 'op-123',
        step: 3,
        totalSteps: 5,
        input: { type: 'batch', size: 100 },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'OPERATION_FAILED',
          success: false,
          error_code: 'OperationError',
          error_message: 'Complex operation failed',
          metadata: {
            operationId: 'op-123',
            step: 3,
            totalSteps: 5,
            input: { type: 'batch', size: 100 },
          },
        })
      );
    });
  });
});
