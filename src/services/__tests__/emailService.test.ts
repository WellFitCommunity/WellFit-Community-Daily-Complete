/**
 * Email Service Tests
 *
 * Behavioral tests for the MailerSend email integration service.
 * Tests: configuration detection, send with success/error/retry scenarios,
 * bulk sending, and singleton access.
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

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { EmailService, getEmailService } from '../emailService';
import type { EmailOptions } from '../emailService';

function makeHeaders(entries: Record<string, string> = {}): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(entries)) {
    headers.set(key, value);
  }
  return headers;
}

function mockResponse(
  status: number,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 202 ? 'Accepted' : 'Error',
    headers: makeHeaders(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const baseEmailOptions: EmailOptions = {
  to: { email: 'user@example.com', name: 'Test User' },
  subject: 'Test Subject',
  html: '<p>Hello</p>',
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmailService({ apiKey: 'test-api-key' });
    // Eliminate real delays in retry logic
    vi.spyOn(
      service as unknown as { delay: (ms: number) => Promise<void> },
      'delay'
    ).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('returns true when apiKey is provided', () => {
      const configured = new EmailService({ apiKey: 'my-key' });
      expect(configured.isConfigured()).toBe(true);
    });

    it('returns false when apiKey is empty string', () => {
      const unconfigured = new EmailService({ apiKey: '' });
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe('send — success paths', () => {
    it('returns success with messageId on 200 response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { message_id: 'msg-abc-123' })
      );

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-abc-123');
      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify fetch was called with correct URL and auth header
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/email');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test-api-key'
      );
    });

    it('returns success on 202 (accepted) response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(202, { message_id: 'msg-accepted-456' })
      );

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-accepted-456');
      expect(result.statusCode).toBe(202);
    });
  });

  describe('send — not configured', () => {
    it('returns failure without calling fetch when service is not configured', async () => {
      const unconfiguredService = new EmailService({ apiKey: '' });

      const result = await unconfiguredService.send(baseEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('send — retry on 429 rate limit', () => {
    it('retries after receiving 429 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse(429, {}, { 'Retry-After': '1' }))
        .mockResolvedValueOnce(
          mockResponse(200, { message_id: 'msg-retry-ok' })
        );

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-retry-ok');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('send — retry on 5xx server error', () => {
    it('retries on 500 with exponential backoff and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockResponse(500, {
            errors: [{ field: 'server', message: 'Internal error' }],
          })
        )
        .mockResolvedValueOnce(
          mockResponse(200, { message_id: 'msg-recovered' })
        );

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-recovered');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('send — 4xx client error does not retry', () => {
    it('returns failure immediately on 400 without retrying', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(400, {
          errors: [{ field: 'to', message: 'Invalid email' }],
        })
      );

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
      expect(result.statusCode).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('send — network error with retries', () => {
    it('retries on network failure then returns failure after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network unreachable'));

      const result = await service.send(baseEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network unreachable');
      // maxRetries is 3, so fetch should be called 3 times
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('send — payload construction', () => {
    it('includes cc, bcc, replyTo, attachments, tags, and scheduledAt in the fetch body', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { message_id: 'msg-full' })
      );

      const fullOptions: EmailOptions = {
        to: [{ email: 'a@test.com' }, { email: 'b@test.com' }],
        subject: 'Full Test',
        html: '<b>hi</b>',
        text: 'hi',
        from: { email: 'sender@test.com', name: 'Sender' },
        replyTo: { email: 'reply@test.com', name: 'Reply' },
        cc: [{ email: 'cc@test.com' }],
        bcc: [{ email: 'bcc@test.com' }],
        attachments: [
          {
            filename: 'doc.pdf',
            content: 'base64data',
            type: 'application/pdf',
          },
        ],
        tags: ['tag1', 'tag2'],
        scheduledAt: '2026-03-01T10:00:00Z',
      };

      await service.send(fullOptions);

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string) as Record<
        string,
        unknown
      >;

      expect(payload.subject).toBe('Full Test');
      expect(payload.html).toBe('<b>hi</b>');
      expect(payload.text).toBe('hi');
      expect(payload.reply_to).toEqual({
        email: 'reply@test.com',
        name: 'Reply',
      });
      expect(payload.cc).toEqual([{ email: 'cc@test.com', name: undefined }]);
      expect(payload.bcc).toEqual([
        { email: 'bcc@test.com', name: undefined },
      ]);
      expect(payload.attachments).toEqual([
        {
          filename: 'doc.pdf',
          content: 'base64data',
          type: 'application/pdf',
        },
      ]);
      expect(payload.tags).toEqual(['tag1', 'tag2']);
      expect(payload.send_at).toBe('2026-03-01T10:00:00Z');
      expect(
        payload.to as Array<Record<string, unknown>>
      ).toHaveLength(2);
    });
  });

  describe('sendBulk', () => {
    it('returns empty array for empty input', async () => {
      const results = await service.sendBulk([]);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns failure for each email when not configured', async () => {
      const unconfiguredService = new EmailService({ apiKey: '' });
      const emails: EmailOptions[] = [
        { to: { email: 'a@test.com' }, subject: 'A', html: '<p>A</p>' },
        { to: { email: 'b@test.com' }, subject: 'B', html: '<p>B</p>' },
      ];

      const results = await unconfiguredService.sendBulk(emails);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(false);
      expect(results[0].error).toContain('not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends each email and returns results array', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse(200, { message_id: 'msg-1' }))
        .mockResolvedValueOnce(mockResponse(200, { message_id: 'msg-2' }));

      const emails: EmailOptions[] = [
        { to: { email: 'a@test.com' }, subject: 'A', html: '<p>A</p>' },
        { to: { email: 'b@test.com' }, subject: 'B', html: '<p>B</p>' },
      ];

      const results = await service.sendBulk(emails);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].messageId).toBe('msg-1');
      expect(results[1].success).toBe(true);
      expect(results[1].messageId).toBe('msg-2');
    });
  });

  describe('getEmailService singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const instance1 = getEmailService();
      const instance2 = getEmailService();
      expect(instance1).toBe(instance2);
    });
  });
});
