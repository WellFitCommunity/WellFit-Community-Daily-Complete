/**
 * Guardian Agent Client Tests
 *
 * Tests for Guardian Agent API client functions:
 * - Security scanning
 * - Audit event logging
 * - System health monitoring
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  performSecurityScan,
  logGuardianAuditEvent,
  monitorSystemHealth,
} from '../guardianAgentClient';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockGetSession = vi.fn();

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
      },
    },
  };
});

const mockSupabase = supabase as typeof supabase;
const mockGetSession = mockSupabase.auth.getSession as ReturnType<typeof vi.fn>;

// Mock fetch
const mockFetch = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();

  // Setup fetch mock
  global.fetch = mockFetch;
});

afterEach(() => {
  // Restore fetch
  global.fetch = originalFetch;
});

// Helper to create authenticated session
function createAuthenticatedSession(token: string = 'valid-access-token') {
  return {
    data: {
      session: {
        access_token: token,
        refresh_token: 'refresh-token',
        user: { id: 'user-uuid-123' },
      },
    },
    error: null,
  };
}

// Helper to create unauthenticated session
function createUnauthenticatedSession() {
  return {
    data: {
      session: null,
    },
    error: null,
  };
}

describe('guardianAgentClient', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // performSecurityScan Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('performSecurityScan', () => {
    it('should perform security scan when authenticated', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: { vulnerabilities: 0, status: 'secure' },
        }),
      });

      const result = await performSecurityScan();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ vulnerabilities: 0, status: 'secure' });
      expect(mockFetch).toHaveBeenCalled();

      // Verify URL ends with guardian-agent-api
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/functions/v1/guardian-agent-api');

      // Verify request options
      const options = mockFetch.mock.calls[0][1];
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer valid-access-token');
      expect(JSON.parse(options.body)).toEqual({
        action: 'security_scan',
        payload: {},
      });
    });

    it('should return error when not authenticated', async () => {
      mockGetSession.mockResolvedValue(createUnauthenticatedSession());

      const result = await performSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated - skipping security scan');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return error when session has no access token', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: null,
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const result = await performSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated - skipping security scan');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle fetch error gracefully', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await performSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockRejectedValue('String error');

      const result = await performSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle API error response', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: false,
          error: 'Scan failed due to timeout',
        }),
      });

      const result = await performSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Scan failed due to timeout');
    });

    it('should use correct authorization header', async () => {
      const customToken = 'custom-jwt-token-12345';
      mockGetSession.mockResolvedValue(createAuthenticatedSession(customToken));
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await performSecurityScan();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${customToken}`,
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // logGuardianAuditEvent Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('logGuardianAuditEvent', () => {
    it('should log audit event when authenticated', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: { event_id: 'evt-123' },
        }),
      });

      const event = {
        event_type: 'USER_LOGIN',
        severity: 'LOW',
        description: 'User logged in successfully',
      };

      const result = await logGuardianAuditEvent(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ event_id: 'evt-123' });
      expect(mockFetch).toHaveBeenCalled();

      // Verify URL ends with guardian-agent-api
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/functions/v1/guardian-agent-api');

      // Verify request options
      const options = mockFetch.mock.calls[0][1];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        action: 'audit_log',
        payload: event,
      });
    });

    it('should log audit event with requires_investigation flag', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const event = {
        event_type: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        description: 'Multiple failed login attempts detected',
        requires_investigation: true,
      };

      await logGuardianAuditEvent(event);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            action: 'audit_log',
            payload: event,
          }),
        })
      );
    });

    it('should log audit event without optional fields', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const event = {
        event_type: 'SYSTEM_START',
        description: 'System started',
      };

      const result = await logGuardianAuditEvent(event);

      expect(result.success).toBe(true);
    });

    it('should return error when not authenticated', async () => {
      mockGetSession.mockResolvedValue(createUnauthenticatedSession());

      const event = {
        event_type: 'TEST',
        description: 'Test event',
      };

      const result = await logGuardianAuditEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated - skipping audit log');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle fetch error gracefully', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const event = {
        event_type: 'TEST',
        description: 'Test event',
      };

      const result = await logGuardianAuditEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockRejectedValue({ code: 'TIMEOUT' });

      const event = {
        event_type: 'TEST',
        description: 'Test event',
      };

      const result = await logGuardianAuditEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle CRITICAL severity events', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const event = {
        event_type: 'SECURITY_BREACH',
        severity: 'CRITICAL',
        description: 'Unauthorized data access detected',
        requires_investigation: true,
      };

      const result = await logGuardianAuditEvent(event);

      expect(result.success).toBe(true);
    });

    it('should preserve all event fields in payload', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const event = {
        event_type: 'PHI_ACCESS',
        severity: 'MEDIUM',
        description: 'Patient record accessed',
        requires_investigation: false,
      };

      await logGuardianAuditEvent(event);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.payload).toEqual(event);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // monitorSystemHealth Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('monitorSystemHealth', () => {
    it('should monitor system health when authenticated', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: {
            status: 'healthy',
            cpu: 45,
            memory: 62,
            disk: 38,
          },
        }),
      });

      const result = await monitorSystemHealth();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        status: 'healthy',
        cpu: 45,
        memory: 62,
        disk: 38,
      });
      expect(mockFetch).toHaveBeenCalled();

      // Verify URL ends with guardian-agent-api
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/functions/v1/guardian-agent-api');

      // Verify request options
      const options = mockFetch.mock.calls[0][1];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        action: 'monitor_health',
        payload: {},
      });
    });

    it('should return error when not authenticated', async () => {
      mockGetSession.mockResolvedValue(createUnauthenticatedSession());

      const result = await monitorSystemHealth();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated - skipping health monitor');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle fetch error gracefully', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockRejectedValue(new Error('Service unavailable'));

      const result = await monitorSystemHealth();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockRejectedValue(null);

      const result = await monitorSystemHealth();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle unhealthy status response', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: {
            status: 'unhealthy',
            cpu: 95,
            memory: 88,
            disk: 92,
            alerts: ['High CPU usage', 'Disk space low'],
          },
        }),
      });

      const result = await monitorSystemHealth();

      expect(result.success).toBe(true);
      expect((result.data as { status: string })?.status).toBe('unhealthy');
    });

    it('should handle API error response', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: false,
          error: 'Health check timed out',
        }),
      });

      const result = await monitorSystemHealth();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Health check timed out');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Common Behavior Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Common Behavior', () => {
    it('should use POST method for all requests', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await performSecurityScan();
      await logGuardianAuditEvent({ event_type: 'TEST', description: 'Test' });
      await monitorSystemHealth();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      mockFetch.mock.calls.forEach((call) => {
        expect(call[1].method).toBe('POST');
      });
    });

    it('should set Content-Type header for all requests', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await performSecurityScan();
      await logGuardianAuditEvent({ event_type: 'TEST', description: 'Test' });
      await monitorSystemHealth();

      mockFetch.mock.calls.forEach((call) => {
        expect(call[1].headers['Content-Type']).toBe('application/json');
      });
    });

    it('should call getSession for each request', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await performSecurityScan();
      await logGuardianAuditEvent({ event_type: 'TEST', description: 'Test' });
      await monitorSystemHealth();

      expect(mockGetSession).toHaveBeenCalledTimes(3);
    });

    it('should handle session error gracefully', async () => {
      mockGetSession.mockRejectedValue(new Error('Session fetch failed'));

      const result = await performSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session fetch failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete security workflow', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());

      // Step 1: Perform security scan
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { vulnerabilities: 2, status: 'warning' },
        }),
      });

      const scanResult = await performSecurityScan();
      expect(scanResult.success).toBe(true);
      expect((scanResult.data as { vulnerabilities: number })?.vulnerabilities).toBe(2);

      // Step 2: Log the findings
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { event_id: 'evt-456' },
        }),
      });

      const logResult = await logGuardianAuditEvent({
        event_type: 'SECURITY_SCAN_COMPLETE',
        severity: 'MEDIUM',
        description: 'Security scan found 2 vulnerabilities',
        requires_investigation: true,
      });
      expect(logResult.success).toBe(true);

      // Step 3: Monitor health after scan
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { status: 'healthy' },
        }),
      });

      const healthResult = await monitorSystemHealth();
      expect(healthResult.success).toBe(true);
    });

    it('should handle mixed authentication states', async () => {
      // First call: authenticated
      mockGetSession.mockResolvedValueOnce(createAuthenticatedSession());
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      const result1 = await performSecurityScan();
      expect(result1.success).toBe(true);

      // Second call: session expired
      mockGetSession.mockResolvedValueOnce(createUnauthenticatedSession());

      const result2 = await logGuardianAuditEvent({
        event_type: 'TEST',
        description: 'Test',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Not authenticated');

      // Third call: re-authenticated
      mockGetSession.mockResolvedValueOnce(createAuthenticatedSession('new-token'));
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      const result3 = await monitorSystemHealth();
      expect(result3.success).toBe(true);
    });

    it('should handle network failures gracefully', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession());

      // Simulate various network errors
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
      mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'));
      mockFetch.mockRejectedValueOnce(new Error('Connection reset'));

      const result1 = await performSecurityScan();
      const result2 = await logGuardianAuditEvent({ event_type: 'TEST', description: 'Test' });
      const result3 = await monitorSystemHealth();

      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Network timeout');

      expect(result2.success).toBe(false);
      expect(result2.error).toBe('DNS resolution failed');

      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Connection reset');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Security Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Security Considerations', () => {
    it('should include Bearer token in Authorization header', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession('secure-token-xyz'));
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await performSecurityScan();

      expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Bearer secure-token-xyz');
    });

    it('should not make API calls when unauthenticated', async () => {
      mockGetSession.mockResolvedValue(createUnauthenticatedSession());

      await performSecurityScan();
      await logGuardianAuditEvent({ event_type: 'TEST', description: 'Test' });
      await monitorSystemHealth();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not expose token in error messages', async () => {
      mockGetSession.mockResolvedValue(createAuthenticatedSession('secret-token'));
      mockFetch.mockRejectedValue(new Error('Request failed'));

      const result = await performSecurityScan();

      expect(result.error).not.toContain('secret-token');
    });

    it('should validate session before each API call', async () => {
      // Ensures fresh session check for each request
      mockGetSession
        .mockResolvedValueOnce(createAuthenticatedSession('token-1'))
        .mockResolvedValueOnce(createAuthenticatedSession('token-2'));

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await performSecurityScan();
      await monitorSystemHealth();

      expect(mockGetSession).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Bearer token-1');
      expect(mockFetch.mock.calls[1][1].headers['Authorization']).toBe('Bearer token-2');
    });
  });
});
