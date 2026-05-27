/**
 * Email Service — server-side via `send-email` edge function.
 *
 * Previously this service called the MailerSend API directly with
 * VITE_MAILERSEND_API_KEY exposed in the browser bundle (CRIT-2).
 * The API key has been rotated; this client now routes through the
 * existing `send-email` edge function which holds the secret server-side
 * and enforces JWT + role auth + rate limiting.
 *
 * The rich EmailOptions interface (attachments, cc/bcc, templateId,
 * scheduledAt) is preserved for type compatibility, but the underlying
 * edge function only supports `{to, subject, html, priority}`. Unsupported
 * fields log a warning and are dropped. Callers needing advanced features
 * should extend the edge function rather than reach into MailerSend directly.
 */

import { auditLogger } from './auditLogger';
import { supabase } from '../lib/supabaseClient';

/**
 * Email recipient
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  type: string; // MIME type
}

/**
 * Email template variables
 */
export type TemplateVariables = Record<string, string | number | boolean>;

/**
 * Email options
 */
export interface EmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateVariables?: TemplateVariables;
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  attachments?: EmailAttachment[];
  tags?: string[];
  /** Send at specific time (ISO 8601) */
  scheduledAt?: string;
  /** Priority forwarded to send-email edge function */
  priority?: 'normal' | 'high' | 'urgent';
}

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Body shape accepted by the `send-email` edge function.
 * Defined here so the client and server stay in sync.
 */
interface SendEmailEdgeBody {
  to: { email: string; name: string }[];
  subject: string;
  html: string;
  priority?: 'normal' | 'high' | 'urgent';
}

interface SendEmailEdgeResponse {
  success?: boolean;
  message_id?: string;
  error?: string;
}

/**
 * Email Service — routes all sends through the `send-email` edge function.
 */
export class EmailService {
  /**
   * Email is configured at the edge layer. The browser does not see the
   * MailerSend secret. If the edge function is misconfigured, calls will
   * fail at send time (audit-logged).
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Send a single email.
   * Calls the `send-email` edge function which enforces auth, role, rate
   * limit, and holds the MailerSend secret server-side.
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    const recipients = this.normalizeRecipients(options.to);
    if (recipients.length === 0) {
      await auditLogger.warn('EMAIL_NO_RECIPIENTS', { subject: options.subject });
      return { success: false, error: 'No recipients' };
    }

    // The edge function only supports html — render a minimal wrapper if
    // only `text` was provided so we don't silently drop the message.
    const html = options.html ?? (options.text ? this.textToHtml(options.text) : undefined);
    if (!html) {
      return { success: false, error: 'Either html or text is required' };
    }

    // Warn (do not fail) on advanced options the edge function does not yet
    // support. Callers who need these features should extend send-email.
    const unsupported = this.collectUnsupportedFields(options);
    if (unsupported.length > 0) {
      await auditLogger.warn('EMAIL_UNSUPPORTED_FIELDS_DROPPED', {
        subject: options.subject,
        fields: unsupported,
      });
    }

    const body: SendEmailEdgeBody = {
      to: recipients,
      subject: options.subject,
      html,
      ...(options.priority ? { priority: options.priority } : {}),
    };

    try {
      const { data, error } = await supabase.functions.invoke<SendEmailEdgeResponse>(
        'send-email',
        { body }
      );

      if (error) {
        await auditLogger.error('EMAIL_SEND_FAILED', error.message, {
          to: recipients.map(r => r.email),
          subject: options.subject,
        });
        return { success: false, error: error.message };
      }

      if (data?.success === false) {
        await auditLogger.error('EMAIL_SEND_REJECTED', data.error ?? 'unknown', {
          to: recipients.map(r => r.email),
          subject: options.subject,
        });
        return { success: false, error: data.error };
      }

      await auditLogger.info('EMAIL_SENT', {
        to: recipients.map(r => r.email),
        subject: options.subject,
        messageId: data?.message_id,
      });

      return { success: true, messageId: data?.message_id };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await auditLogger.error(
        'EMAIL_SEND_ERROR',
        err instanceof Error ? err : new Error(errorMessage),
        { to: recipients.map(r => r.email), subject: options.subject }
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send bulk emails. Calls send() in parallel batches; the edge function's
   * rate limiter (30 emails per 10 minutes per user) is the upper bound.
   */
  async sendBulk(emails: EmailOptions[]): Promise<EmailResult[]> {
    const batchSize = 25;
    const results: EmailResult[] = [];
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(email => this.send(email)));
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * Send email using a template. The edge function does not natively support
   * MailerSend template IDs yet — the templateId is forwarded as metadata in
   * the warning log; the actual body must be provided as html/text.
   */
  async sendTemplate(
    templateId: string,
    to: EmailRecipient | EmailRecipient[],
    variables: TemplateVariables,
    options?: Partial<EmailOptions>
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: options?.subject || '',
      templateId,
      templateVariables: variables,
      ...options,
    });
  }

  async sendWelcomeEmail(to: EmailRecipient, userName: string): Promise<EmailResult> {
    return this.send({
      to,
      subject: 'Welcome to WellFit Community!',
      html: `
        <h1>Welcome, ${userName}!</h1>
        <p>Thank you for joining WellFit Community. We're excited to have you on board.</p>
        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p>Best regards,<br>The WellFit Team</p>
      `,
      tags: ['welcome', 'onboarding'],
    });
  }

  async sendPasswordReset(to: EmailRecipient, resetLink: string): Promise<EmailResult> {
    return this.send({
      to,
      subject: 'Password Reset Request - WellFit Community',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      tags: ['security', 'password-reset'],
    });
  }

  async sendAppointmentReminder(
    to: EmailRecipient,
    appointmentDetails: {
      patientName: string;
      appointmentDate: string;
      appointmentTime: string;
      providerName: string;
      location: string;
    }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: `Appointment Reminder - ${appointmentDetails.appointmentDate}`,
      html: `
        <h1>Appointment Reminder</h1>
        <p>Hello ${appointmentDetails.patientName},</p>
        <p>This is a reminder about your upcoming appointment:</p>
        <ul>
          <li><strong>Date:</strong> ${appointmentDetails.appointmentDate}</li>
          <li><strong>Time:</strong> ${appointmentDetails.appointmentTime}</li>
          <li><strong>Provider:</strong> ${appointmentDetails.providerName}</li>
          <li><strong>Location:</strong> ${appointmentDetails.location}</li>
        </ul>
        <p>Please arrive 15 minutes early to complete any necessary paperwork.</p>
      `,
      tags: ['appointment', 'reminder'],
    });
  }

  async sendAlertNotification(
    to: EmailRecipient,
    alert: {
      title: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      actionUrl?: string;
    }
  ): Promise<EmailResult> {
    const severityColors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545',
    };

    return this.send({
      to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: `
        <div style="border-left: 4px solid ${severityColors[alert.severity]}; padding-left: 16px;">
          <h1 style="color: ${severityColors[alert.severity]}">${alert.title}</h1>
          <p>${alert.message}</p>
          ${alert.actionUrl ? `<p><a href="${alert.actionUrl}" style="background: ${severityColors[alert.severity]}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Take Action</a></p>` : ''}
        </div>
      `,
      tags: ['alert', alert.severity],
      priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'normal',
    });
  }

  // ── Private helpers ────────────────────────────────────────────────

  private normalizeRecipients(to: EmailRecipient | EmailRecipient[]): { email: string; name: string }[] {
    const list = Array.isArray(to) ? to : [to];
    return list
      .filter(r => !!r?.email)
      .map(r => ({ email: r.email, name: r.name ?? '' }));
  }

  private textToHtml(text: string): string {
    // Escape HTML special chars + convert newlines to <br>
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
    return `<div style="font-family:sans-serif;white-space:pre-wrap">${escaped}</div>`;
  }

  private collectUnsupportedFields(options: EmailOptions): string[] {
    const dropped: string[] = [];
    if (options.attachments?.length) dropped.push('attachments');
    if (options.cc?.length) dropped.push('cc');
    if (options.bcc?.length) dropped.push('bcc');
    if (options.replyTo) dropped.push('replyTo');
    if (options.scheduledAt) dropped.push('scheduledAt');
    if (options.tags?.length) dropped.push('tags');
    if (options.templateId) dropped.push('templateId');
    if (options.from) dropped.push('from'); // edge fn uses MAILERSEND_FROM_EMAIL
    return dropped;
  }
}

/**
 * Global email service instance
 */
let globalEmailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!globalEmailService) {
    globalEmailService = new EmailService();
  }
  return globalEmailService;
}

/**
 * Convenience function for sending emails
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  return getEmailService().send(options);
}
