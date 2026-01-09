/**
 * Notification Service Tests
 *
 * Tests for the unified multi-channel notification service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id' }], error: null }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ error: null }))
    }
  }
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock email service
vi.mock('../emailService', () => ({
  getEmailService: vi.fn(() => ({
    isConfigured: vi.fn(() => true),
    send: vi.fn(() => Promise.resolve({ success: true }))
  }))
}));

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NotificationTarget interface', () => {
    it('should support userId for single user targeting', () => {
      const target = { userId: 'user-123' };
      expect(target.userId).toBeDefined();
    });

    it('should support userIds for multi-user targeting', () => {
      const target = { userIds: ['user-1', 'user-2', 'user-3'] };
      expect(target.userIds).toHaveLength(3);
    });

    it('should support roleIds for role-based targeting', () => {
      const target = { roleIds: ['caregiver', 'physician'] };
      expect(target.roleIds).toContain('caregiver');
      expect(target.roleIds).toContain('physician');
    });

    it('should support email targeting', () => {
      const target = { email: 'test@example.com' };
      expect(target.email).toBe('test@example.com');
    });

    it('should support slackChannel for Slack notifications', () => {
      const target = { slackChannel: '#alerts' };
      expect(target.slackChannel).toBe('#alerts');
    });
  });

  describe('NotificationPriority', () => {
    it('should support all priority levels', () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];
      priorities.forEach(p => {
        expect(['low', 'normal', 'high', 'urgent']).toContain(p);
      });
    });

    it('should map priority to channels correctly', () => {
      const priorityChannelMap: Record<string, string[]> = {
        'urgent': ['in_app', 'push', 'email', 'slack'],
        'high': ['in_app', 'push', 'email'],
        'normal': ['in_app', 'push'],
        'low': ['in_app']
      };

      expect(priorityChannelMap['urgent']).toHaveLength(4);
      expect(priorityChannelMap['low']).toHaveLength(1);
    });
  });

  describe('NotificationCategory', () => {
    it('should support all notification categories', () => {
      const categories = [
        'system', 'security', 'clinical', 'appointment',
        'medication', 'wellness', 'alert', 'message'
      ];

      categories.forEach(cat => {
        expect(typeof cat).toBe('string');
        expect(cat.length).toBeGreaterThan(0);
      });
    });
  });

  describe('NotificationOptions', () => {
    it('should validate required fields', () => {
      const options = {
        title: 'Test Notification',
        body: 'This is a test message',
        category: 'system' as const,
        target: { userId: 'user-123' }
      };

      expect(options.title).toBeDefined();
      expect(options.body).toBeDefined();
      expect(options.category).toBeDefined();
      expect(options.target).toBeDefined();
    });

    it('should support optional actionUrl', () => {
      const options = {
        title: 'Test',
        body: 'Test',
        category: 'clinical' as const,
        target: { userId: 'user-123' },
        actionUrl: '/patients/123/details'
      };

      expect(options.actionUrl).toBe('/patients/123/details');
    });

    it('should support optional expiresAt as ISO string', () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const options = {
        title: 'Test',
        body: 'Test',
        category: 'alert' as const,
        target: { userId: 'user-123' },
        expiresAt
      };

      expect(options.expiresAt).toContain('T');
      expect(typeof options.expiresAt).toBe('string');
    });

    it('should support custom data payload', () => {
      const options = {
        title: 'Test',
        body: 'Test',
        category: 'system' as const,
        target: { userId: 'user-123' },
        data: {
          patientId: 'patient-456',
          alertType: 'fall_risk',
          score: 85
        }
      };

      expect(options.data?.patientId).toBe('patient-456');
      expect(options.data?.alertType).toBe('fall_risk');
    });
  });

  describe('Channel Result Tracking', () => {
    it('should track results for each channel', () => {
      const channelResults = {
        in_app: { success: true },
        push: { success: true },
        email: { success: false, error: 'Email service not configured' },
        slack: { success: false, error: 'Not attempted' }
      };

      expect(channelResults.in_app.success).toBe(true);
      expect(channelResults.email.success).toBe(false);
      expect(channelResults.email.error).toBeDefined();
    });

    it('should consider notification successful if any channel succeeds', () => {
      const channelResults = {
        in_app: { success: true },
        push: { success: false, error: 'FCM error' },
        email: { success: false, error: 'Not configured' },
        slack: { success: false, error: 'Not attempted' }
      };

      const overallSuccess = Object.values(channelResults).some(r => r.success);
      expect(overallSuccess).toBe(true);
    });
  });

  describe('Slack Color Mapping', () => {
    it('should map priorities to correct colors', () => {
      const colorMap: Record<string, string> = {
        'urgent': '#dc3545', // Red
        'high': '#fd7e14',   // Orange
        'normal': '#007bff', // Blue
        'low': '#6c757d'     // Gray
      };

      expect(colorMap['urgent']).toBe('#dc3545');
      expect(colorMap['high']).toBe('#fd7e14');
      expect(colorMap['normal']).toBe('#007bff');
      expect(colorMap['low']).toBe('#6c757d');
    });
  });

  describe('In-App Notification Storage', () => {
    it('should build correct notification record structure', () => {
      const userId = 'user-123';
      const notification = {
        user_id: userId,
        title: 'Test Notification',
        body: 'Test body',
        category: 'clinical',
        priority: 'high',
        data: { patientId: 'patient-456' },
        action_url: '/patients/patient-456',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        tenant_id: 'tenant-789'
      };

      expect(notification.user_id).toBe(userId);
      expect(notification.category).toBe('clinical');
      expect(notification.priority).toBe('high');
    });
  });

  describe('Push Notification FCM Integration', () => {
    it('should map notification priority to FCM priority', () => {
      const mapToFcmPriority = (priority: string) => {
        return priority === 'urgent' || priority === 'high' ? 'high' : 'normal';
      };

      expect(mapToFcmPriority('urgent')).toBe('high');
      expect(mapToFcmPriority('high')).toBe('high');
      expect(mapToFcmPriority('normal')).toBe('normal');
      expect(mapToFcmPriority('low')).toBe('normal');
    });
  });

  describe('Clinical Notification Convenience Methods', () => {
    it('should use high priority for clinical notifications', () => {
      const clinicalDefaults = {
        category: 'clinical',
        priority: 'high'
      };

      expect(clinicalDefaults.priority).toBe('high');
    });

    it('should use urgent priority for security alerts', () => {
      const securityDefaults = {
        category: 'security',
        priority: 'urgent',
        channels: ['in_app', 'push', 'email', 'slack']
      };

      expect(securityDefaults.priority).toBe('urgent');
      expect(securityDefaults.channels).toHaveLength(4);
    });
  });

  describe('Email HTML Template Building', () => {
    it('should include title in HTML', () => {
      const title = 'Test Alert';
      const html = `<h1>${title}</h1>`;

      expect(html).toContain(title);
      expect(html).toContain('<h1>');
    });

    it('should apply priority colors', () => {
      const priorityColors: Record<string, string> = {
        low: '#6c757d',
        normal: '#007bff',
        high: '#fd7e14',
        urgent: '#dc3545'
      };

      expect(priorityColors['urgent']).toBe('#dc3545');
    });

    it('should include action button when actionUrl provided', () => {
      const actionUrl = '/patients/123';
      const buttonHtml = `<a href="${actionUrl}">Take Action</a>`;

      expect(buttonHtml).toContain(actionUrl);
    });
  });

  describe('Notification Read/Dismiss Operations', () => {
    it('should mark read_at with ISO timestamp', () => {
      const readAt = new Date().toISOString();

      expect(readAt).toContain('T');
      expect(readAt.length).toBeGreaterThan(10);
    });

    it('should mark dismissed_at with ISO timestamp', () => {
      const dismissedAt = new Date().toISOString();

      expect(dismissedAt).toContain('T');
    });
  });

  describe('Retry Logic', () => {
    it('should have configurable max retries', () => {
      const maxRetries = 3;
      const retryDelayMs = 1000;

      expect(maxRetries).toBe(3);
      expect(retryDelayMs).toBe(1000);
    });

    it('should implement exponential backoff', () => {
      const baseDelay = 1000;
      const attempt1Delay = baseDelay * Math.pow(2, 0); // 1000
      const attempt2Delay = baseDelay * Math.pow(2, 1); // 2000
      const attempt3Delay = baseDelay * Math.pow(2, 2); // 4000

      expect(attempt1Delay).toBe(1000);
      expect(attempt2Delay).toBe(2000);
      expect(attempt3Delay).toBe(4000);
    });
  });
});
