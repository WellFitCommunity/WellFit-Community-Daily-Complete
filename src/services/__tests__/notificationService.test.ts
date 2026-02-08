/**
 * Notification Service Tests
 *
 * Behavioral tests for the unified multi-channel notification service.
 * Tests: priority-based channel routing, in-app persistence via Supabase,
 * email/push/slack channel dispatch, error resilience, and Slack config detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mocks (must be declared before imports) ----

const mockInsertSelect = vi.fn();
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));
const mockFrom = vi.fn((_table: string) => ({
  insert: mockInsert,
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(() => ({
        is: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

const mockFunctionsInvoke = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: {
      invoke: (name: string, opts?: Record<string, unknown>) => mockFunctionsInvoke(name, opts),
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockEmailSend = vi.fn();
const mockEmailIsConfigured = vi.fn();

vi.mock('../emailService', () => ({
  getEmailService: vi.fn(() => ({
    isConfigured: mockEmailIsConfigured,
    send: mockEmailSend,
  })),
}));

// Mock global fetch for Slack webhook calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { NotificationService } from '../notificationService';
import type { NotificationOptions } from '../notificationService';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: in-app insert succeeds
    mockInsertSelect.mockResolvedValue({
      data: [{ id: 'notif-001' }],
      error: null,
    });

    // Default: push succeeds
    mockFunctionsInvoke.mockResolvedValue({ error: null });

    // Default: email configured and succeeds
    mockEmailIsConfigured.mockReturnValue(true);
    mockEmailSend.mockResolvedValue({ success: true });

    // Default: Slack webhook succeeds
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () => Promise.resolve('ok'),
    } as unknown as Response);

    service = new NotificationService();

    // Eliminate real delays
    vi.spyOn(
      service as unknown as { delay: (ms: number) => Promise<void> },
      'delay'
    ).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSlackConfigured', () => {
    it('returns false when VITE_SLACK_WEBHOOK_URL is not set', () => {
      // The default test env has no VITE_SLACK_WEBHOOK_URL, so initializeSlack
      // leaves slackConfig as null
      expect(service.isSlackConfigured()).toBe(false);
    });
  });

  describe('send — low priority defaults to in_app only', () => {
    it('only attempts in_app channel for low priority notifications', async () => {
      const options: NotificationOptions = {
        title: 'Low Priority Alert',
        body: 'Something minor happened',
        category: 'system',
        priority: 'low',
        target: { userId: 'user-123' },
      };

      const result = await service.send(options);

      // in_app should succeed
      expect(result.channelResults.in_app.success).toBe(true);
      expect(result.success).toBe(true);

      // Other channels should not be attempted (still show "Not attempted")
      expect(result.channelResults.push.error).toBe('Not attempted');
      expect(result.channelResults.email.error).toBe('Not attempted');
      expect(result.channelResults.slack.error).toBe('Not attempted');

      // Verify Supabase insert was called for in_app
      expect(mockFrom).toHaveBeenCalledWith('user_notifications');
      // Verify push was NOT called
      expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    });
  });

  describe('send — normal priority defaults to in_app + push', () => {
    it('attempts both in_app and push channels for normal priority', async () => {
      const options: NotificationOptions = {
        title: 'Normal Alert',
        body: 'Something happened',
        category: 'wellness',
        priority: 'normal',
        target: { userId: 'user-456' },
      };

      const result = await service.send(options);

      expect(result.channelResults.in_app.success).toBe(true);
      expect(result.channelResults.push.success).toBe(true);
      expect(result.success).toBe(true);

      // Verify push was called via supabase functions
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'send-push-notification',
        expect.objectContaining({
          body: expect.objectContaining({
            title: 'Normal Alert',
            user_ids: ['user-456'],
          }),
        })
      );
    });
  });

  describe('send — high priority defaults to in_app + push + email', () => {
    it('attempts in_app, push, and email channels when email target is provided', async () => {
      const options: NotificationOptions = {
        title: 'High Priority Alert',
        body: 'Action needed',
        category: 'clinical',
        priority: 'high',
        target: {
          userId: 'user-789',
          email: { email: 'doctor@hospital.com', name: 'Dr. Smith' },
        },
      };

      const result = await service.send(options);

      expect(result.channelResults.in_app.success).toBe(true);
      expect(result.channelResults.push.success).toBe(true);
      expect(result.channelResults.email.success).toBe(true);
      expect(result.success).toBe(true);

      // Verify email was sent with correct subject and HTML containing the title
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'High Priority Alert',
          to: { email: 'doctor@hospital.com', name: 'Dr. Smith' },
        })
      );
    });
  });

  describe('send — custom channels override defaults', () => {
    it('uses explicitly provided channels instead of priority defaults', async () => {
      const options: NotificationOptions = {
        title: 'Custom Channel Test',
        body: 'Only in-app please',
        category: 'system',
        priority: 'high',
        channels: ['in_app'],
        target: { userId: 'user-custom' },
      };

      const result = await service.send(options);

      expect(result.channelResults.in_app.success).toBe(true);
      // push and email should NOT be attempted despite high priority
      expect(result.channelResults.push.error).toBe('Not attempted');
      expect(result.channelResults.email.error).toBe('Not attempted');
      expect(mockFunctionsInvoke).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  describe('send — in_app creates notification in database', () => {
    it('inserts a notification record with correct fields and returns its ID', async () => {
      const options: NotificationOptions = {
        title: 'DB Insert Test',
        body: 'Check the insert call',
        category: 'alert',
        priority: 'low',
        target: { userId: 'user-db', tenantId: 'tenant-001' },
        actionUrl: '/dashboard',
        expiresAt: '2026-12-31T00:00:00Z',
      };

      const result = await service.send(options);

      expect(result.notificationId).toBe('notif-001');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: 'user-db',
          title: 'DB Insert Test',
          body: 'Check the insert call',
          category: 'alert',
          priority: 'low',
          action_url: '/dashboard',
          expires_at: '2026-12-31T00:00:00Z',
          tenant_id: 'tenant-001',
        }),
      ]);
    });
  });

  describe('send — error resilience across channels', () => {
    it('succeeds overall if at least one channel succeeds when another fails', async () => {
      // Make push fail
      mockFunctionsInvoke.mockResolvedValue({
        error: { message: 'FCM unavailable' },
      });

      const options: NotificationOptions = {
        title: 'Partial Failure Test',
        body: 'Push will fail but in_app should succeed',
        category: 'system',
        priority: 'normal',
        target: { userId: 'user-resilient' },
      };

      const result = await service.send(options);

      // Overall success because in_app succeeded
      expect(result.success).toBe(true);
      expect(result.channelResults.in_app.success).toBe(true);
      expect(result.channelResults.push.success).toBe(false);
      expect(result.channelResults.push.error).toBe('FCM unavailable');
    });
  });

  describe('send — in_app database error is reported', () => {
    it('returns in_app failure when Supabase insert fails', async () => {
      mockInsertSelect.mockResolvedValue({
        data: null,
        error: { message: 'RLS policy violation' },
      });

      const options: NotificationOptions = {
        title: 'DB Fail Test',
        body: 'Insert will fail',
        category: 'security',
        priority: 'low',
        target: { userId: 'user-rls-fail' },
      };

      const result = await service.send(options);

      expect(result.channelResults.in_app.success).toBe(false);
      expect(result.channelResults.in_app.error).toBe('RLS policy violation');
      // Overall failure since in_app was the only channel
      expect(result.success).toBe(false);
    });
  });

  describe('send — email channel reports not-configured', () => {
    it('returns email failure when email service is not configured', async () => {
      mockEmailIsConfigured.mockReturnValue(false);

      const options: NotificationOptions = {
        title: 'Email Not Configured',
        body: 'Should report email failure',
        category: 'appointment',
        priority: 'high',
        target: {
          userId: 'user-no-email',
          email: { email: 'test@test.com' },
        },
      };

      const result = await service.send(options);

      expect(result.channelResults.email.success).toBe(false);
      expect(result.channelResults.email.error).toBe(
        'Email service not configured'
      );
      // in_app and push still succeed
      expect(result.channelResults.in_app.success).toBe(true);
      expect(result.channelResults.push.success).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('send — ephemeral notification skips database insert', () => {
    it('does not insert into user_notifications when ephemeral is true', async () => {
      const options: NotificationOptions = {
        title: 'Ephemeral Test',
        body: 'No DB write',
        category: 'system',
        priority: 'low',
        target: { userId: 'user-ephemeral' },
        ephemeral: true,
      };

      const result = await service.send(options);

      expect(result.channelResults.in_app.success).toBe(true);
      // insert should NOT have been called
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('send — multiple userIds receive individual notifications', () => {
    it('inserts one notification per userId in the target', async () => {
      const options: NotificationOptions = {
        title: 'Multi-User Test',
        body: 'Goes to multiple users',
        category: 'wellness',
        priority: 'low',
        target: { userIds: ['user-a', 'user-b', 'user-c'] },
      };

      await service.send(options);

      // Insert should be called with array of 3 notification objects
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-a' }),
          expect.objectContaining({ user_id: 'user-b' }),
          expect.objectContaining({ user_id: 'user-c' }),
        ])
      );
    });
  });
});
