/**
 * Security Alert Notifier
 *
 * Sends notifications for critical security events via multiple channels:
 * - Email (via Supabase Edge Function send-email using MailerSend)
 * - SMS (via Supabase Edge Function send-sms using Twilio)
 * - In-house SOC Dashboard at /soc-dashboard (replaces Slack/PagerDuty)
 *
 * This ensures that security teams are immediately notified of threats.
 *
 * SOC2 Compliance: CC6.1, CC7.2 - Security event notification
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

export interface NotificationChannel {
  type: 'email' | 'sms' | 'soc_dashboard';
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface AlertNotification {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedResource?: string;
  timestamp: string;
  channels: string[];
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * SecurityAlertNotifier - Multi-channel alert notifications
 *
 * This class is responsible for delivering security alerts via multiple channels.
 * All notifications are logged for audit purposes.
 */
export class SecurityAlertNotifier {
  private channels: Map<string, NotificationChannel> = new Map();

  constructor() {
    this.initializeChannels();
  }

  /**
   * Initialize notification channels based on environment configuration
   */
  private initializeChannels(): void {
    // Email channel (via Supabase Edge Function send-email)
    this.channels.set('email', {
      type: 'email',
      enabled: true,
      config: {
        recipientEmails: import.meta.env.VITE_SECURITY_ALERT_EMAILS?.split(',') || [
          'info@thewellfitcommunity.org',
        ],
      },
    });

    // SMS channel (via Supabase Edge Function send-sms)
    this.channels.set('sms', {
      type: 'sms',
      enabled: !!import.meta.env.VITE_SECURITY_ALERT_PHONES,
      config: {
        recipientPhones: import.meta.env.VITE_SECURITY_ALERT_PHONES?.split(',') || [],
      },
    });

    // SOC Dashboard (in-house - replaces Slack/PagerDuty)
    // Alerts automatically appear in /soc-dashboard with real-time updates
    this.channels.set('soc_dashboard', {
      type: 'soc_dashboard',
      enabled: true, // Always enabled - it's our in-house system
      config: {
        dashboardUrl: '/soc-dashboard',
      },
    });

    auditLogger.info('SecurityAlertNotifier initialized', {
      enabledChannels: this.getEnabledChannels(),
    });
  }

  /**
   * Send notification for security alert
   */
  async notify(notification: AlertNotification): Promise<{
    success: boolean;
    results: Record<string, { success: boolean; error?: string }>;
  }> {
    const results: Record<string, { success: boolean; error?: string }> = {};

    // Send to requested channels
    for (const channelName of notification.channels) {
      const channel = this.channels.get(channelName);

      if (!channel) {
        results[channelName] = {
          success: false,
          error: 'Channel not found',
        };
        continue;
      }

      if (!channel.enabled) {
        results[channelName] = {
          success: false,
          error: 'Channel not enabled',
        };
        continue;
      }

      try {
        switch (channel.type) {
          case 'email':
            results[channelName] = await this.sendEmail(notification, channel);
            break;
          case 'sms':
            results[channelName] = await this.sendSMS(notification, channel);
            break;
          case 'soc_dashboard':
            // SOC Dashboard gets alerts automatically via database insert
            // No additional action needed - realtime subscriptions handle it
            results[channelName] = { success: true };
            break;
        }
      } catch (error: unknown) {
        results[channelName] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Log notification attempt
    await this.logNotificationAttempt(notification, results);

    const success = Object.values(results).some((r) => r.success);
    return { success, results };
  }

  /**
   * Send email notification via send-email edge function
   */
  private async sendEmail(
    notification: AlertNotification,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    try {
      const { recipientEmails } = channel.config || {};

      if (!recipientEmails || (recipientEmails as string[]).length === 0) {
        return { success: false, error: 'No recipient emails configured' };
      }

      // Build HTML email content
      const htmlContent = this.buildEmailHtml(notification);

      // Call send-email edge function
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: (recipientEmails as string[]).map((email) => ({
            email,
            name: 'Security Team',
          })),
          subject: `[${notification.severity.toUpperCase()}] Security Alert: ${notification.title}`,
          html: htmlContent,
          priority: notification.severity === 'critical' ? 'urgent' : 'high',
        },
      });

      if (error) {
        auditLogger.error('Email notification failed', error.message, {
          alertId: notification.alertId,
        });
        return { success: false, error: error.message };
      }

      auditLogger.info('Email notification sent', {
        alertId: notification.alertId,
        recipients: (recipientEmails as string[]).length,
      });

      return { success: true, messageId: (data as { messageId?: string } | null)?.messageId };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Email send failed';
      auditLogger.error('Email notification exception', errorMsg, {
        alertId: notification.alertId,
      });
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Build HTML email content for security alert
   */
  private buildEmailHtml(notification: AlertNotification): string {
    const severityColors: Record<string, string> = {
      low: '#36a64f',
      medium: '#ff9900',
      high: '#ff0000',
      critical: '#8b0000',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: ${severityColors[notification.severity]}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #666; }
          .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .badge { display: inline-block; padding: 5px 15px; border-radius: 3px; background: ${severityColors[notification.severity]}; color: white; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Security Alert</h1>
          <span class="badge">${notification.severity.toUpperCase()}</span>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Alert Title</div>
            <div>${notification.title}</div>
          </div>
          <div class="field">
            <div class="label">Description</div>
            <div>${notification.description}</div>
          </div>
          ${
            notification.affectedResource
              ? `
          <div class="field">
            <div class="label">Affected Resource</div>
            <div>${notification.affectedResource}</div>
          </div>
          `
              : ''
          }
          <div class="field">
            <div class="label">Timestamp</div>
            <div>${new Date(notification.timestamp).toLocaleString()}</div>
          </div>
          <div class="field">
            <div class="label">Alert ID</div>
            <div>${notification.alertId}</div>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated security alert from WellFit Guardian Agent.</p>
          <p>Please investigate this alert in the SOC2 Security Dashboard.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send SMS notification via send-sms edge function
   */
  private async sendSMS(
    notification: AlertNotification,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    try {
      const { recipientPhones } = channel.config || {};

      if (!recipientPhones || (recipientPhones as string[]).length === 0) {
        return { success: false, error: 'No recipient phones configured' };
      }

      // SMS message (limited to 160 characters for single segment)
      const smsMessage = `[${notification.severity.toUpperCase()}] ${notification.title.substring(
        0,
        100
      )}. Alert ID: ${notification.alertId.substring(0, 8)}`;

      // Call send-sms edge function
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: recipientPhones,
          message: smsMessage,
          priority: notification.severity === 'critical' ? 'urgent' : 'high',
        },
      });

      if (error) {
        auditLogger.error('SMS notification failed', error.message, {
          alertId: notification.alertId,
        });
        return { success: false, error: error.message };
      }

      auditLogger.info('SMS notification sent', {
        alertId: notification.alertId,
        recipients: (recipientPhones as string[]).length,
      });

      const messageId =
        (data as { results?: Array<{ sid?: string }> } | null)?.results?.[0]?.sid;

      return { success: true, messageId };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'SMS send failed';
      auditLogger.error('SMS notification exception', errorMsg, {
        alertId: notification.alertId,
      });
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Log notification attempt to database
   */
  private async logNotificationAttempt(
    notification: AlertNotification,
    results: Record<string, { success: boolean; error?: string }>
  ): Promise<void> {
    try {
      // Update security_alerts table with notification status
      await supabase
        .from('security_alerts')
        .update({
          notification_sent: Object.values(results).some((r) => r.success),
          notification_channels: Object.keys(results).filter((k) => results[k].success),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.alertId);
    } catch (_error: unknown) {
      // Don't throw from notifier logging, but DO leave an audit trail
      auditLogger.error(
        'Failed to log security alert notification attempt',
        _error instanceof Error ? _error.message : String(_error),
        { alertId: notification.alertId }
      );
    }
  }

  /**
   * Get enabled channels
   */
  getEnabledChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([_name, channel]) => channel.enabled)
      .map(([name]) => name);
  }

  /**
   * Test notification to verify configuration
   */
  async testNotification(channel: string): Promise<{ success: boolean; error?: string }> {
    const testNotification: AlertNotification = {
      alertId: 'test-' + Date.now(),
      severity: 'low',
      title: 'Test Security Alert',
      description: 'This is a test notification from Guardian Agent',
      timestamp: new Date().toISOString(),
      channels: [channel],
    };

    const result = await this.notify(testNotification);
    return result.results[channel] || { success: false, error: 'Channel not found' };
  }
}

/**
 * Global singleton instance
 */
export const securityAlertNotifier = new SecurityAlertNotifier();
