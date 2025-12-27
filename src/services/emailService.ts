/**
 * Email Service - MailerSend Integration
 * Centralized email sending for the application
 *
 * Features:
 * - MailerSend API integration
 * - Template support
 * - Bulk email support
 * - Retry logic with exponential backoff
 * - Audit logging for all emails
 */

import { auditLogger } from './auditLogger';

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
 * MailerSend API response
 */
interface MailerSendResponse {
  message_id?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Email Service Configuration
 */
interface EmailServiceConfig {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName: string;
  baseUrl?: string;
}

/**
 * Email Service - MailerSend Implementation
 */
export class EmailService {
  private config: EmailServiceConfig;
  private readonly baseUrl: string;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(config?: Partial<EmailServiceConfig>) {
    this.config = {
      apiKey: config?.apiKey || import.meta.env.VITE_MAILERSEND_API_KEY || '',
      defaultFromEmail: config?.defaultFromEmail || import.meta.env.VITE_MAILERSEND_FROM_EMAIL || 'noreply@wellfit.community',
      defaultFromName: config?.defaultFromName || import.meta.env.VITE_MAILERSEND_FROM_NAME || 'WellFit Community',
      baseUrl: config?.baseUrl,
    };
    this.baseUrl = this.config.baseUrl || 'https://api.mailersend.com/v1';
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Send a single email
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.isConfigured()) {
      await auditLogger.warn('EMAIL_NOT_CONFIGURED', {
        to: this.getRecipientEmails(options.to),
        subject: options.subject,
      });
      return {
        success: false,
        error: 'Email service not configured. Set VITE_MAILERSEND_API_KEY.',
      };
    }

    const payload = this.buildPayload(options);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok || response.status === 202) {
          const data = await response.json().catch(() => ({})) as MailerSendResponse;

          await auditLogger.info('EMAIL_SENT', {
            to: this.getRecipientEmails(options.to),
            subject: options.subject,
            messageId: data.message_id,
            templateId: options.templateId,
          });

          return {
            success: true,
            messageId: data.message_id,
            statusCode: response.status,
          };
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          await auditLogger.warn('EMAIL_RATE_LIMITED', {
            retryAfter,
            attempt,
          });

          if (attempt < this.maxRetries) {
            await this.delay(retryAfter * 1000);
            continue;
          }
        }

        // Handle other errors
        const errorData = await response.json().catch(() => ({})) as MailerSendResponse;
        const errorMessage = errorData.errors?.map(e => e.message).join(', ') || response.statusText;

        await auditLogger.error('EMAIL_SEND_FAILED', `Failed to send email: ${errorMessage}`, {
          to: this.getRecipientEmails(options.to),
          subject: options.subject,
          statusCode: response.status,
          attempt,
        });

        if (attempt < this.maxRetries && response.status >= 500) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt - 1));
          continue;
        }

        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        await auditLogger.error('EMAIL_SEND_ERROR', errorMessage, {
          to: this.getRecipientEmails(options.to),
          subject: options.subject,
          attempt,
        });

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt - 1));
          continue;
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded',
    };
  }

  /**
   * Send bulk emails (up to 500 per request)
   */
  async sendBulk(emails: EmailOptions[]): Promise<EmailResult[]> {
    if (!this.isConfigured()) {
      return emails.map(() => ({
        success: false,
        error: 'Email service not configured',
      }));
    }

    // MailerSend bulk endpoint accepts up to 500 emails
    const results: EmailResult[] = [];
    const batchSize = 500;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(email => this.send(email)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Send email using a template
   */
  async sendTemplate(
    templateId: string,
    to: EmailRecipient | EmailRecipient[],
    variables: TemplateVariables,
    options?: Partial<EmailOptions>
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: options?.subject || '', // Subject can be in template
      templateId,
      templateVariables: variables,
      ...options,
    });
  }

  /**
   * Common email templates
   */
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
    });
  }

  // Private helper methods

  private buildPayload(options: EmailOptions): Record<string, unknown> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const payload: Record<string, unknown> = {
      from: {
        email: options.from?.email || this.config.defaultFromEmail,
        name: options.from?.name || this.config.defaultFromName,
      },
      to: recipients.map(r => ({
        email: r.email,
        name: r.name,
      })),
      subject: options.subject,
    };

    if (options.html) {
      payload.html = options.html;
    }

    if (options.text) {
      payload.text = options.text;
    }

    if (options.templateId) {
      payload.template_id = options.templateId;
      if (options.templateVariables) {
        payload.personalization = recipients.map(r => ({
          email: r.email,
          data: options.templateVariables,
        }));
      }
    }

    if (options.replyTo) {
      payload.reply_to = {
        email: options.replyTo.email,
        name: options.replyTo.name,
      };
    }

    if (options.cc?.length) {
      payload.cc = options.cc.map(r => ({ email: r.email, name: r.name }));
    }

    if (options.bcc?.length) {
      payload.bcc = options.bcc.map(r => ({ email: r.email, name: r.name }));
    }

    if (options.attachments?.length) {
      payload.attachments = options.attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        type: a.type,
      }));
    }

    if (options.tags?.length) {
      payload.tags = options.tags;
    }

    if (options.scheduledAt) {
      payload.send_at = options.scheduledAt;
    }

    return payload;
  }

  private getRecipientEmails(to: EmailRecipient | EmailRecipient[]): string[] {
    const recipients = Array.isArray(to) ? to : [to];
    return recipients.map(r => r.email);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
