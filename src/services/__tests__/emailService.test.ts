/**
 * Email Service Tests
 *
 * Behavioral tests for the post-CRIT-2 EmailService. The service now routes
 * through the `send-email` edge function (no direct MailerSend fetch in the
 * browser). These tests cover the edge-function-invocation surface.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock audit logger before importing the service
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock supabase client — supabase.functions.invoke is the surface under test
const mockInvoke = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { EmailService, getEmailService, sendEmail } from '../emailService';
import type { EmailOptions } from '../emailService';
import { auditLogger } from '../auditLogger';

const baseEmailOptions: EmailOptions = {
  to: { email: 'user@example.com', name: 'Test User' },
  subject: 'Test Subject',
  html: '<p>Hello</p>',
};

describe('EmailService — server-side via send-email edge function', () => {
  let service: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    service = new EmailService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('always reports configured (the edge function holds the secret server-side)', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('send — happy path', () => {
    it('invokes send-email with normalized {to, subject, html} body', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message_id: 'msg-abc-123' },
        error: null,
      });

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-abc-123');
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      const [fnName, opts] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
      expect(fnName).toBe('send-email');
      expect(opts.body).toEqual({
        to: [{ email: 'user@example.com', name: 'Test User' }],
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });
    });

    it('forwards priority when provided', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, message_id: 'msg-1' }, error: null });

      await service.send({ ...baseEmailOptions, priority: 'urgent' });

      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: { priority?: string } }];
      expect(opts.body.priority).toBe('urgent');
    });

    it('normalizes a single recipient into an array with empty name when missing', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, message_id: 'm' }, error: null });

      await service.send({
        to: { email: 'nameless@example.com' },
        subject: 's',
        html: '<p>h</p>',
      });

      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: { to: { email: string; name: string }[] } }];
      expect(opts.body.to).toEqual([{ email: 'nameless@example.com', name: '' }]);
    });

    it('accepts and forwards an array of recipients', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, message_id: 'm' }, error: null });

      await service.send({
        to: [
          { email: 'a@example.com', name: 'A' },
          { email: 'b@example.com', name: 'B' },
        ],
        subject: 's',
        html: '<p>h</p>',
      });

      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: { to: unknown[] } }];
      expect(opts.body.to).toHaveLength(2);
    });
  });

  describe('send — error paths', () => {
    it('returns failure when no recipients are provided', async () => {
      const result = await service.send({
        to: [],
        subject: 's',
        html: '<p>h</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/recipients/i);
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(auditLogger.warn).toHaveBeenCalledWith(
        'EMAIL_NO_RECIPIENTS',
        expect.any(Object),
      );
    });

    it('returns failure when neither html nor text is provided', async () => {
      const result = await service.send({
        to: { email: 'x@example.com' },
        subject: 's',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/html or text/i);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('returns failure and logs audit on edge function error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'forbidden' },
      });

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('forbidden');
      expect(auditLogger.error).toHaveBeenCalledWith(
        'EMAIL_SEND_FAILED',
        'forbidden',
        expect.any(Object),
      );
    });

    it('returns failure when invoke throws', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('network down'));

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('network down');
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('returns failure when edge function responds {success: false}', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: false, error: 'rate limited' },
        error: null,
      });

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('rate limited');
    });
  });

  describe('send — text fallback', () => {
    it('wraps text in an HTML envelope when only text is provided', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, message_id: 'm' }, error: null });

      await service.send({
        to: { email: 'x@example.com' },
        subject: 's',
        text: 'Hello\n<world>',
      });

      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: { html: string } }];
      expect(opts.body.html).toContain('Hello');
      // Special chars must be escaped
      expect(opts.body.html).toContain('&lt;world&gt;');
      // Newline must be preserved as <br>
      expect(opts.body.html).toContain('<br>');
    });
  });

  describe('send — unsupported fields', () => {
    it('drops cc/bcc/attachments/replyTo/scheduledAt/tags/templateId/from and logs a warning', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, message_id: 'm' }, error: null });

      await service.send({
        to: { email: 'x@example.com', name: 'X' },
        subject: 's',
        html: '<p>h</p>',
        cc: [{ email: 'cc@example.com' }],
        bcc: [{ email: 'bcc@example.com' }],
        attachments: [{ filename: 'a.pdf', content: 'YQ==', type: 'application/pdf' }],
        replyTo: { email: 'reply@example.com' },
        scheduledAt: '2026-01-01T00:00:00Z',
        tags: ['hello'],
        templateId: 't1',
        from: { email: 'from@example.com' },
      });

      const [, opts] = mockInvoke.mock.calls[0] as [
        string,
        { body: Record<string, unknown> }
      ];
      expect(opts.body).not.toHaveProperty('cc');
      expect(opts.body).not.toHaveProperty('bcc');
      expect(opts.body).not.toHaveProperty('attachments');
      expect(opts.body).not.toHaveProperty('reply_to');
      expect(opts.body).not.toHaveProperty('replyTo');
      expect(opts.body).not.toHaveProperty('send_at');
      expect(opts.body).not.toHaveProperty('scheduledAt');
      expect(opts.body).not.toHaveProperty('tags');
      expect(opts.body).not.toHaveProperty('template_id');
      expect(opts.body).not.toHaveProperty('templateId');
      expect(opts.body).not.toHaveProperty('from');

      expect(auditLogger.warn).toHaveBeenCalledWith(
        'EMAIL_UNSUPPORTED_FIELDS_DROPPED',
        expect.objectContaining({
          fields: expect.arrayContaining(['cc', 'bcc', 'attachments', 'replyTo']),
        }),
      );
    });
  });

  describe('sendBulk', () => {
    it('returns empty array for empty input without invoking', async () => {
      const results = await service.sendBulk([]);
      expect(results).toEqual([]);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('sends each email and returns results array', async () => {
      mockInvoke.mockResolvedValue({ data: { success: true, message_id: 'm' }, error: null });

      const emails: EmailOptions[] = [
        { to: { email: 'a@example.com' }, subject: '1', html: '<p>1</p>' },
        { to: { email: 'b@example.com' }, subject: '2', html: '<p>2</p>' },
        { to: { email: 'c@example.com' }, subject: '3', html: '<p>3</p>' },
      ];

      const results = await service.sendBulk(emails);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });

  describe('audit logging', () => {
    it('logs EMAIL_SENT on success', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message_id: 'msg-99' },
        error: null,
      });

      await service.send(baseEmailOptions);

      expect(auditLogger.info).toHaveBeenCalledWith(
        'EMAIL_SENT',
        expect.objectContaining({
          to: ['user@example.com'],
          subject: 'Test Subject',
          messageId: 'msg-99',
        }),
      );
    });
  });

  describe('getEmailService singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getEmailService();
      const b = getEmailService();
      expect(a).toBe(b);
    });
  });

  describe('sendEmail convenience export', () => {
    it('forwards to the singleton', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, message_id: 'm' }, error: null });
      const result = await sendEmail(baseEmailOptions);
      expect(result.success).toBe(true);
    });
  });

  describe('alert/templated convenience helpers', () => {
    it('sendAlertNotification maps severity to priority', async () => {
      mockInvoke.mockResolvedValue({ data: { success: true, message_id: 'm' }, error: null });

      await service.sendAlertNotification(
        { email: 'on-call@example.com' },
        { title: 'Down', message: 'redis offline', severity: 'critical' },
      );

      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: { priority?: string } }];
      expect(opts.body.priority).toBe('urgent');
    });
  });
});
