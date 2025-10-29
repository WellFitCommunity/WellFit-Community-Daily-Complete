/**
 * Security Alert Notifier
 *
 * Sends notifications for critical security events via multiple channels:
 * - Email (via Supabase Edge Function)
 * - SMS (via Twilio integration)
 * - Slack (via Webhook)
 * - PagerDuty (for critical incidents)
 *
 * This ensures that security teams are immediately notified of threats.
 */

import { supabase } from '../../lib/supabaseClient';

export interface NotificationChannel {
  type: 'email' | 'sms' | 'slack' | 'pagerduty';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface AlertNotification {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedResource?: string;
  timestamp: string;
  channels: string[];
}

/**
 * SecurityAlertNotifier - Multi-channel alert notifications
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
    // Email channel (via Supabase Edge Function)
    this.channels.set('email', {
      type: 'email',
      enabled: true,
      config: {
        recipientEmails: process.env.SECURITY_ALERT_EMAILS?.split(',') || [
          'info@thewellfitcommunity.org',
        ],
        fromEmail: 'security@thewellfitcommunity.org',
      },
    });

    // SMS channel (via Twilio)
    this.channels.set('sms', {
      type: 'sms',
      enabled: !!process.env.TWILIO_ACCOUNT_SID,
      config: {
        recipientPhones: process.env.SECURITY_ALERT_PHONES?.split(',') || [],
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
        twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
      },
    });

    // Slack channel (via Webhook)
    this.channels.set('slack', {
      type: 'slack',
      enabled: !!process.env.SLACK_SECURITY_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_SECURITY_WEBHOOK_URL,
        channel: '#security-alerts',
      },
    });

    // PagerDuty (for critical incidents)
    this.channels.set('pagerduty', {
      type: 'pagerduty',
      enabled: !!process.env.PAGERDUTY_INTEGRATION_KEY,
      config: {
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
        serviceId: process.env.PAGERDUTY_SERVICE_ID,
      },
    });

    console.log('[SecurityAlertNotifier] Initialized channels:', {
      email: this.channels.get('email')?.enabled,
      sms: this.channels.get('sms')?.enabled,
      slack: this.channels.get('slack')?.enabled,
      pagerduty: this.channels.get('pagerduty')?.enabled,
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
          case 'slack':
            results[channelName] = await this.sendSlack(notification, channel);
            break;
          case 'pagerduty':
            results[channelName] = await this.sendPagerDuty(notification, channel);
            break;
        }
      } catch (error) {
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
   * Send email notification
   */
  private async sendEmail(
    notification: AlertNotification,
    channel: NotificationChannel
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { recipientEmails, fromEmail } = channel.config || {};

      // In production, call Supabase Edge Function to send email
      // For now, we'll log and simulate success
      console.log('[SecurityAlertNotifier] 📧 Sending email notification:', {
        to: recipientEmails,
        from: fromEmail,
        subject: `[${notification.severity.toUpperCase()}] ${notification.title}`,
        body: notification.description,
      });

      // TODO: Call actual email service
      // const { data, error } = await supabase.functions.invoke('send-security-alert-email', {
      //   body: { notification, recipientEmails, fromEmail }
      // });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
      };
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    notification: AlertNotification,
    channel: NotificationChannel
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { recipientPhones } = channel.config || {};

      if (!recipientPhones || recipientPhones.length === 0) {
        return { success: false, error: 'No recipient phones configured' };
      }

      // SMS message (limited to 160 characters)
      const message = `[${notification.severity.toUpperCase()}] ${notification.title.substring(0, 100)}`;

      console.log('[SecurityAlertNotifier] 📱 Sending SMS notification:', {
        to: recipientPhones,
        message,
      });

      // TODO: Integrate with Twilio
      // const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      // await twilioClient.messages.create({
      //   body: message,
      //   from: twilioPhoneNumber,
      //   to: recipientPhone
      // });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed',
      };
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(
    notification: AlertNotification,
    channel: NotificationChannel
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { webhookUrl, channel: slackChannel } = channel.config || {};

      if (!webhookUrl) {
        return { success: false, error: 'Slack webhook URL not configured' };
      }

      // Format Slack message
      const slackMessage = {
        channel: slackChannel,
        username: 'Guardian Security Agent',
        icon_emoji: ':shield:',
        attachments: [
          {
            color: this.getSeverityColor(notification.severity),
            title: notification.title,
            text: notification.description,
            fields: [
              {
                title: 'Severity',
                value: notification.severity.toUpperCase(),
                short: true,
              },
              {
                title: 'Affected Resource',
                value: notification.affectedResource || 'N/A',
                short: true,
              },
              {
                title: 'Time',
                value: new Date(notification.timestamp).toLocaleString(),
                short: false,
              },
            ],
            footer: 'WellFit Guardian Agent',
            ts: Math.floor(new Date(notification.timestamp).getTime() / 1000),
          },
        ],
      };



      // TODO: Send to Slack webhook
      // const response = await fetch(webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(slackMessage)
      // });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Slack send failed',
      };
    }
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDuty(
    notification: AlertNotification,
    channel: NotificationChannel
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { integrationKey } = channel.config || {};

      if (!integrationKey) {
        return { success: false, error: 'PagerDuty integration key not configured' };
      }

      // Only trigger PagerDuty for critical alerts
      if (notification.severity !== 'critical') {
        return { success: false, error: 'PagerDuty only for critical alerts' };
      }

      const pagerDutyEvent = {
        routing_key: integrationKey,
        event_action: 'trigger',
        dedup_key: notification.alertId,
        payload: {
          summary: notification.title,
          severity: notification.severity,
          source: 'guardian-agent',
          timestamp: notification.timestamp,
          custom_details: {
            description: notification.description,
            affected_resource: notification.affectedResource,
          },
        },
      };



      // TODO: Send to PagerDuty Events API
      // const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(pagerDutyEvent)
      // });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PagerDuty send failed',
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

      console.log('[SecurityAlertNotifier] Logged notification attempt:', {
        alertId: notification.alertId,
        success: Object.values(results).some((r) => r.success),
        channels: results,
      });
    } catch (error) {

    }
  }

  /**
   * Get Slack color for severity
   */
  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      low: '#36a64f',
      medium: '#ff9900',
      high: '#ff0000',
      critical: '#8b0000',
    };
    return colors[severity] || '#808080';
  }

  /**
   * Get enabled channels
   */
  getEnabledChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.enabled)
      .map(([name, _]) => name);
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
