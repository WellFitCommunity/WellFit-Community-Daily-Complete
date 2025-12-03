/**
 * Tests for Security Automation Service
 *
 * Tests threshold checking, automated responses, and alert processing
 * SOC2 Compliance: CC6.1, CC7.2, CC7.3
 */

// Mock the auditLogger - must be before imports
jest.mock('../auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the securityAlertNotifier - must be before imports
jest.mock('../guardian-agent/SecurityAlertNotifier', () => ({
  securityAlertNotifier: {
    notify: jest.fn(),
  },
}));

import {
  SecurityAutomationService,
  DEFAULT_SECURITY_THRESHOLDS,
  SECURITY_EVENT_TRIGGERS,
  SecurityThreshold,
} from '../securityAutomationService';
import { securityAlertNotifier } from '../guardian-agent/SecurityAlertNotifier';

// Get reference to mocked notify function
const mockNotify = securityAlertNotifier.notify as jest.Mock;

// Mock Supabase client
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSignOut = jest.fn();

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc,
  auth: {
    admin: {
      signOut: mockSignOut,
    },
  },
};

/**
 * Helper to set up standard mock for notify function
 */
function setupNotifyMock() {
  mockNotify.mockResolvedValue({
    success: true,
    results: {
      email: { success: true },
      slack: { success: true },
      pagerduty: { success: true },
      sms: { success: true },
    },
  });
}

/**
 * Helper to set up mock for security_alerts table operations
 */
function setupSecurityAlertsMock(alertId: string = 'test-alert-id') {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          contains: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: alertId },
          error: null,
        }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

describe('SecurityAutomationService', () => {
  let service: SecurityAutomationService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset mock implementations
    setupNotifyMock();
    mockSignOut.mockResolvedValue({ error: null });

    // Create fresh service instance
    service = new SecurityAutomationService(mockSupabaseClient as any);
  });

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      expect(service).toBeDefined();
    });

    it('should accept custom thresholds', () => {
      const customThresholds: SecurityThreshold[] = [
        {
          name: 'custom_threshold',
          metric: 'custom_metric',
          threshold: 10,
          timeWindowMinutes: 30,
          severity: 'high',
        },
      ];
      const customService = new SecurityAutomationService(
        mockSupabaseClient as any,
        customThresholds
      );
      expect(customService).toBeDefined();
    });
  });

  describe('checkThreshold', () => {
    it('should return exceeded=false when metric is below threshold', async () => {
      // Mock the from().select() chain for metric query
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 2 }),
          }),
        }),
      });

      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'failed_logins_threshold'
      )!;

      const result = await service.checkThreshold(threshold);

      expect(result.exceeded).toBe(false);
      expect(result.currentValue).toBe(2);
      expect(result.threshold).toBe(5);
    });

    it('should return exceeded=true when metric exceeds threshold', async () => {
      // Mock metric query returning value above threshold
      mockFrom.mockImplementation((table: string) => {
        if (table === 'login_attempts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({ count: 10 }),
              }),
            }),
          };
        }
        if (table === 'security_alerts') {
          return setupSecurityAlertsMock();
        }
        return { select: jest.fn() };
      });

      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'failed_logins_threshold'
      )!;

      const result = await service.checkThreshold(threshold);

      expect(result.exceeded).toBe(true);
      expect(result.currentValue).toBe(10);
    });

    it('should create alert when threshold is exceeded', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'login_attempts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({ count: 10 }),
              }),
            }),
          };
        }
        if (table === 'security_alerts') {
          return setupSecurityAlertsMock('created-alert-123');
        }
        return { select: jest.fn() };
      });

      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'failed_logins_threshold'
      )!;

      const result = await service.checkThreshold(threshold);

      expect(result.exceeded).toBe(true);
      expect(result.alertCreated).toBe('created-alert-123');
    });
  });

  describe('processSecurityEvent', () => {
    beforeEach(() => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'security_alerts') {
          return setupSecurityAlertsMock('event-alert-id');
        }
        if (table === 'account_lockouts') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return { select: jest.fn() };
      });
    });

    it('should create alert for known security event type', async () => {
      const result = await service.processSecurityEvent(
        'BRUTE_FORCE_DETECTED',
        'user-123',
        { ip_address: '1.2.3.4' }
      );

      expect(result.alertCreated).toBe(true);
      expect(result.alertId).toBe('event-alert-id');
    });

    it('should send notifications for security event', async () => {
      const result = await service.processSecurityEvent(
        'BRUTE_FORCE_DETECTED',
        'user-123',
        {}
      );

      expect(result.notificationsSent).toContain('email');
      expect(result.notificationsSent).toContain('slack');
      expect(result.notificationsSent).toContain('pagerduty');
      expect(mockNotify).toHaveBeenCalled();
    });

    it('should return alertCreated=false for unknown event type', async () => {
      const result = await service.processSecurityEvent(
        'UNKNOWN_EVENT_TYPE',
        'user-123',
        {}
      );

      expect(result.alertCreated).toBe(false);
      expect(result.notificationsSent).toHaveLength(0);
    });

    it('should trigger automated lockout response for BRUTE_FORCE_DETECTED', async () => {
      await service.processSecurityEvent(
        'BRUTE_FORCE_DETECTED',
        'user-123',
        {}
      );

      // Verify account_lockouts was called for lockout response
      expect(mockFrom).toHaveBeenCalledWith('account_lockouts');
    });

    it('should trigger token revocation for IMPOSSIBLE_TRAVEL', async () => {
      await service.processSecurityEvent(
        'IMPOSSIBLE_TRAVEL',
        'user-123',
        {}
      );

      // Verify signOut was called for token revocation
      expect(mockSignOut).toHaveBeenCalledWith('user-123', 'global');
    });
  });

  describe('DEFAULT_SECURITY_THRESHOLDS', () => {
    it('should have failed_logins_threshold configured', () => {
      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'failed_logins_threshold'
      );
      expect(threshold).toBeDefined();
      expect(threshold?.threshold).toBe(5);
      expect(threshold?.timeWindowMinutes).toBe(15);
      expect(threshold?.severity).toBe('high');
    });

    it('should have critical_events_threshold configured', () => {
      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'critical_events_threshold'
      );
      expect(threshold).toBeDefined();
      expect(threshold?.threshold).toBe(1);
      expect(threshold?.severity).toBe('critical');
    });

    it('should have impossible_travel_threshold configured', () => {
      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'impossible_travel_threshold'
      );
      expect(threshold).toBeDefined();
      expect(threshold?.severity).toBe('critical');
      expect(threshold?.autoResponse?.type).toBe('revoke_tokens');
    });

    it('should have phi_access_anomaly_threshold configured', () => {
      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'phi_access_anomaly_threshold'
      );
      expect(threshold).toBeDefined();
      expect(threshold?.severity).toBe('high');
      expect(threshold?.autoResponse?.escalateAfterMinutes).toBe(15);
    });

    it('should have unauthorized_access_threshold configured', () => {
      const threshold = DEFAULT_SECURITY_THRESHOLDS.find(
        (t) => t.name === 'unauthorized_access_threshold'
      );
      expect(threshold).toBeDefined();
      expect(threshold?.threshold).toBe(3);
      expect(threshold?.timeWindowMinutes).toBe(30);
    });
  });

  describe('SECURITY_EVENT_TRIGGERS', () => {
    it('should have BRUTE_FORCE_DETECTED trigger configured', () => {
      const trigger = SECURITY_EVENT_TRIGGERS.find(
        (t) => t.eventType === 'BRUTE_FORCE_DETECTED'
      );
      expect(trigger).toBeDefined();
      expect(trigger?.severity).toBe('critical');
      expect(trigger?.autoResponse?.type).toBe('lockout');
    });

    it('should have IMPOSSIBLE_TRAVEL trigger configured', () => {
      const trigger = SECURITY_EVENT_TRIGGERS.find(
        (t) => t.eventType === 'IMPOSSIBLE_TRAVEL'
      );
      expect(trigger).toBeDefined();
      expect(trigger?.severity).toBe('critical');
      expect(trigger?.autoResponse?.type).toBe('revoke_tokens');
    });

    it('should have PHI_MASS_ACCESS trigger configured', () => {
      const trigger = SECURITY_EVENT_TRIGGERS.find(
        (t) => t.eventType === 'PHI_MASS_ACCESS'
      );
      expect(trigger).toBeDefined();
      expect(trigger?.autoResponse?.type).toBe('disable_account');
    });

    it('should have SESSION_HIJACK_SUSPECTED trigger configured', () => {
      const trigger = SECURITY_EVENT_TRIGGERS.find(
        (t) => t.eventType === 'SESSION_HIJACK_SUSPECTED'
      );
      expect(trigger).toBeDefined();
      expect(trigger?.severity).toBe('critical');
      expect(trigger?.autoResponse?.type).toBe('revoke_tokens');
    });

    it('should notify via pagerduty for critical events', () => {
      const criticalTriggers = SECURITY_EVENT_TRIGGERS.filter(
        (t) => t.severity === 'critical'
      );

      expect(criticalTriggers.length).toBeGreaterThan(0);
      criticalTriggers.forEach((trigger) => {
        expect(trigger.notifyChannels).toContain('pagerduty');
      });
    });

    it('should notify via slack for high severity events', () => {
      const highTriggers = SECURITY_EVENT_TRIGGERS.filter(
        (t) => t.severity === 'high'
      );

      expect(highTriggers.length).toBeGreaterThan(0);
      highTriggers.forEach((trigger) => {
        expect(trigger.notifyChannels).toContain('slack');
      });
    });
  });

  describe('checkAllThresholds', () => {
    it('should check all configured thresholds', async () => {
      // Mock all metric queries to return 0
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      });

      const results = await service.checkAllThresholds();

      // Should have results for each default threshold
      expect(results.length).toBe(DEFAULT_SECURITY_THRESHOLDS.length);
    });

    it('should return all thresholds as not exceeded when metrics are zero', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      });

      const results = await service.checkAllThresholds();

      results.forEach((result) => {
        expect(result.exceeded).toBe(false);
        expect(result.currentValue).toBe(0);
      });
    });
  });

  describe('checkEscalations', () => {
    it('should be a callable method', () => {
      expect(typeof service.checkEscalations).toBe('function');
    });

    it('should handle empty escalation results gracefully', async () => {
      // Set up mock chain for escalation query: select() → eq() → lt()
      const mockLt = jest.fn().mockResolvedValue({ data: [] });
      const mockStatusEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockStatusEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null }),
        }),
      });

      // Should complete without throwing
      await service.checkEscalations();

      // Verify no notifications were sent (no escalated alerts)
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it('should send notifications for escalated alerts', async () => {
      const mockAlert = {
        id: 'escalated-alert-1',
        severity: 'high',
        title: 'Test Alert',
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        escalation_level: 0,
        metadata: {},
      };

      // Set up mock chain for escalation query: select() → eq() → lt()
      const mockLt = jest.fn().mockResolvedValue({ data: [mockAlert] });
      const mockStatusEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockStatusEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null }),
        }),
      });

      await service.checkEscalations();

      // Verify notification was sent for escalated alert
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          alertId: 'escalated-alert-1',
          title: expect.stringContaining('ESCALATION'),
        })
      );
    });
  });
});

describe('SecurityAlertNotifier mock verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupNotifyMock();
  });

  it('should be importable as mock', () => {
    expect(securityAlertNotifier).toBeDefined();
    expect(securityAlertNotifier.notify).toBeDefined();
  });

  it('should have notify as a mock function', () => {
    expect(jest.isMockFunction(securityAlertNotifier.notify)).toBe(true);
  });

  it('should return expected structure from notify', async () => {
    const result = await securityAlertNotifier.notify({
      alertId: 'test-123',
      severity: 'high',
      title: 'Test Alert',
      description: 'Test description',
      timestamp: new Date().toISOString(),
      channels: ['email', 'slack'],
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results).toBeDefined();
    expect(result.results.email.success).toBe(true);
    expect(result.results.slack.success).toBe(true);
  });
});
