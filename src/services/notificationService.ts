/**
 * Notification Service - Unified Multi-Channel Notifications
 *
 * Provides a centralized notification system supporting:
 * - In-app notifications (database-backed)
 * - Push notifications (via FCM edge function)
 * - Slack webhooks (for external team notifications)
 * - Email (via emailService)
 *
 * Features:
 * - Multi-channel delivery with fallbacks
 * - Priority-based routing
 * - Audit logging for all notifications
 * - Retry logic with exponential backoff
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { getEmailService, type EmailRecipient } from './emailService';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification channel types
 */
export type NotificationChannel = 'in_app' | 'push' | 'email' | 'slack';

/**
 * Notification category for routing and display
 */
export type NotificationCategory =
  | 'system'
  | 'security'
  | 'clinical'
  | 'appointment'
  | 'medication'
  | 'wellness'
  | 'alert'
  | 'message';

/**
 * Notification target
 */
export interface NotificationTarget {
  userId?: string;
  userIds?: string[];
  roleIds?: string[];
  tenantId?: string;
  slackChannel?: string;
  email?: EmailRecipient | EmailRecipient[];
}

/**
 * Notification options
 */
export interface NotificationOptions {
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  target: NotificationTarget;
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: string;
  /** Do not persist to database */
  ephemeral?: boolean;
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  channelResults: Record<NotificationChannel, { success: boolean; error?: string }>;
}

/**
 * In-app notification record
 */
export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  data?: Record<string, unknown>;
  action_url?: string;
  read_at?: string | null;
  dismissed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

/**
 * Slack webhook configuration
 */
interface SlackConfig {
  webhookUrl: string;
  defaultChannel?: string;
  username?: string;
  iconEmoji?: string;
}

/**
 * Notification Service - Multi-channel notification delivery
 */
export class NotificationService {
  private slackConfig: SlackConfig | null = null;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor() {
    this.initializeSlack();
  }

  /**
   * Initialize Slack configuration from environment
   */
  private initializeSlack(): void {
    const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      this.slackConfig = {
        webhookUrl,
        defaultChannel: import.meta.env.VITE_SLACK_DEFAULT_CHANNEL || '#notifications',
        username: import.meta.env.VITE_SLACK_BOT_NAME || 'WellFit Bot',
        iconEmoji: import.meta.env.VITE_SLACK_BOT_EMOJI || ':hospital:',
      };
    }
  }

  /**
   * Check if Slack is configured
   */
  isSlackConfigured(): boolean {
    return !!this.slackConfig;
  }

  /**
   * Send notification through configured channels
   */
  async send(options: NotificationOptions): Promise<NotificationResult> {
    const {
      title,
      body,
      category,
      priority = 'normal',
      channels = this.getDefaultChannels(priority),
      target,
      data,
      actionUrl,
      expiresAt,
      ephemeral = false,
    } = options;

    const channelResults: Record<NotificationChannel, { success: boolean; error?: string }> = {
      in_app: { success: false, error: 'Not attempted' },
      push: { success: false, error: 'Not attempted' },
      email: { success: false, error: 'Not attempted' },
      slack: { success: false, error: 'Not attempted' },
    };

    let notificationId: string | undefined;

    // In-app notifications (primary channel for user-targeted notifications)
    if (channels.includes('in_app') && (target.userId || target.userIds?.length)) {
      const result = await this.sendInApp({
        title,
        body,
        category,
        priority,
        target,
        data,
        actionUrl,
        expiresAt,
        ephemeral,
      });
      channelResults.in_app = result;
      if (result.notificationId) {
        notificationId = result.notificationId;
      }
    }

    // Push notifications
    if (channels.includes('push') && (target.userId || target.userIds?.length)) {
      channelResults.push = await this.sendPush({
        title,
        body,
        userIds: target.userId ? [target.userId] : target.userIds,
        data: { ...data, category, actionUrl },
        priority,
      });
    }

    // Email notifications
    if (channels.includes('email') && target.email) {
      channelResults.email = await this.sendEmail({
        title,
        body,
        category,
        priority,
        recipients: target.email,
        actionUrl,
      });
    }

    // Slack notifications
    if (channels.includes('slack')) {
      channelResults.slack = await this.sendSlack({
        title,
        body,
        category,
        priority,
        channel: target.slackChannel,
        data,
        actionUrl,
      });
    }

    const success = Object.values(channelResults).some((r) => r.success);

    await auditLogger.info('NOTIFICATION_SENT', {
      title,
      category,
      priority,
      channels,
      channelResults,
      success,
    });

    return { success, notificationId, channelResults };
  }

  /**
   * Send in-app notification (database-backed)
   */
  private async sendInApp(options: {
    title: string;
    body: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    target: NotificationTarget;
    data?: Record<string, unknown>;
    actionUrl?: string;
    expiresAt?: string;
    ephemeral?: boolean;
  }): Promise<{ success: boolean; error?: string; notificationId?: string }> {
    if (options.ephemeral) {
      return { success: true };
    }

    try {
      const userIds = options.target.userIds || (options.target.userId ? [options.target.userId] : []);

      if (userIds.length === 0) {
        return { success: false, error: 'No user IDs provided' };
      }

      // Insert notifications for each user
      const notifications = userIds.map((userId) => ({
        user_id: userId,
        title: options.title,
        body: options.body,
        category: options.category,
        priority: options.priority,
        data: options.data,
        action_url: options.actionUrl,
        expires_at: options.expiresAt,
        tenant_id: options.target.tenantId,
      }));

      const { data, error } = await supabase
        .from('user_notifications')
        .insert(notifications)
        .select('id');

      if (error) {
        await auditLogger.error('IN_APP_NOTIFICATION_FAILED', error.message, {
          userIds,
          title: options.title,
        });
        return { success: false, error: error.message };
      }

      return {
        success: true,
        notificationId: data?.[0]?.id,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await auditLogger.error('IN_APP_NOTIFICATION_ERROR', errorMessage, {
        title: options.title,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send push notification via FCM edge function
   */
  private async sendPush(options: {
    title: string;
    body: string;
    userIds?: string[];
    data?: Record<string, unknown>;
    priority: NotificationPriority;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const fcmPriority = options.priority === 'urgent' || options.priority === 'high' ? 'high' : 'normal';

      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title: options.title,
          body: options.body,
          user_ids: options.userIds,
          data: options.data as Record<string, string> | undefined,
          priority: fcmPriority,
        },
      });

      if (error) {
        await auditLogger.warn('PUSH_NOTIFICATION_FAILED', {
          error: error.message,
          title: options.title,
        });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send email notification via EmailService
   */
  private async sendEmail(options: {
    title: string;
    body: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    recipients: EmailRecipient | EmailRecipient[];
    actionUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const emailService = getEmailService();

      if (!emailService.isConfigured()) {
        return { success: false, error: 'Email service not configured' };
      }

      const result = await emailService.send({
        to: options.recipients,
        subject: options.title,
        html: this.buildEmailHtml(options),
        tags: ['notification', options.category, options.priority],
      });

      return { success: result.success, error: result.error };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(options: {
    title: string;
    body: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    channel?: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.slackConfig) {
      return { success: false, error: 'Slack not configured' };
    }

    const priorityEmoji: Record<NotificationPriority, string> = {
      low: ':information_source:',
      normal: ':bell:',
      high: ':warning:',
      urgent: ':rotating_light:',
    };

    const categoryEmoji: Record<NotificationCategory, string> = {
      system: ':gear:',
      security: ':lock:',
      clinical: ':stethoscope:',
      appointment: ':calendar:',
      medication: ':pill:',
      wellness: ':heart:',
      alert: ':exclamation:',
      message: ':envelope:',
    };

    const payload = {
      channel: options.channel || this.slackConfig.defaultChannel,
      username: this.slackConfig.username,
      icon_emoji: this.slackConfig.iconEmoji,
      attachments: [
        {
          fallback: `${options.title}: ${options.body}`,
          color: this.getSlackColor(options.priority),
          pretext: `${priorityEmoji[options.priority]} ${categoryEmoji[options.category]} *${options.title}*`,
          text: options.body,
          fields: options.data
            ? Object.entries(options.data).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              }))
            : undefined,
          actions: options.actionUrl
            ? [
                {
                  type: 'button',
                  text: 'View Details',
                  url: options.actionUrl,
                },
              ]
            : undefined,
          footer: 'WellFit Notification Service',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.slackConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return { success: true };
        }

        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          if (attempt < this.maxRetries) {
            await this.delay(retryAfter * 1000);
            continue;
          }
        }

        const errorText = await response.text();
        return { success: false, error: `Slack error: ${response.status} ${errorText}` };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt - 1));
          continue;
        }
        return { success: false, error: errorMessage };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Get default channels based on priority
   */
  private getDefaultChannels(priority: NotificationPriority): NotificationChannel[] {
    switch (priority) {
      case 'urgent':
        return ['in_app', 'push', 'email', 'slack'];
      case 'high':
        return ['in_app', 'push', 'email'];
      case 'normal':
        return ['in_app', 'push'];
      case 'low':
        return ['in_app'];
    }
  }

  /**
   * Get Slack attachment color based on priority
   */
  private getSlackColor(priority: NotificationPriority): string {
    switch (priority) {
      case 'urgent':
        return '#dc3545'; // Red
      case 'high':
        return '#fd7e14'; // Orange
      case 'normal':
        return '#007bff'; // Blue
      case 'low':
        return '#6c757d'; // Gray
    }
  }

  /**
   * Build HTML email content
   */
  private buildEmailHtml(options: {
    title: string;
    body: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    actionUrl?: string;
  }): string {
    const priorityColors: Record<NotificationPriority, string> = {
      low: '#6c757d',
      normal: '#007bff',
      high: '#fd7e14',
      urgent: '#dc3545',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${priorityColors[options.priority]}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
          .button { background: ${priorityColors[options.priority]}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${options.title}</h1>
            <span style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 3px;">
              ${options.category.toUpperCase()} - ${options.priority.toUpperCase()}
            </span>
          </div>
          <div class="content">
            <p>${options.body}</p>
            ${
              options.actionUrl
                ? `
            <p style="text-align: center;">
              <a href="${options.actionUrl}" class="button">View Details</a>
            </p>
            `
                : ''
            }
          </div>
          <div class="footer">
            <p>WellFit Community - Notification Service</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Convenience methods for common notification types

  /**
   * Send a system notification
   */
  async sendSystemNotification(
    target: NotificationTarget,
    title: string,
    body: string,
    options?: Partial<NotificationOptions>
  ): Promise<NotificationResult> {
    return this.send({
      title,
      body,
      category: 'system',
      target,
      priority: 'normal',
      ...options,
    });
  }

  /**
   * Send a security alert notification
   */
  async sendSecurityAlert(
    target: NotificationTarget,
    title: string,
    body: string,
    options?: Partial<NotificationOptions>
  ): Promise<NotificationResult> {
    return this.send({
      title,
      body,
      category: 'security',
      target,
      priority: 'urgent',
      channels: ['in_app', 'push', 'email', 'slack'],
      ...options,
    });
  }

  /**
   * Send a clinical notification
   */
  async sendClinicalNotification(
    target: NotificationTarget,
    title: string,
    body: string,
    options?: Partial<NotificationOptions>
  ): Promise<NotificationResult> {
    return this.send({
      title,
      body,
      category: 'clinical',
      target,
      priority: 'high',
      ...options,
    });
  }

  /**
   * Send an appointment reminder
   */
  async sendAppointmentReminder(
    target: NotificationTarget,
    appointmentDetails: {
      patientName: string;
      appointmentDate: string;
      appointmentTime: string;
      providerName: string;
      location: string;
    }
  ): Promise<NotificationResult> {
    return this.send({
      title: `Appointment Reminder - ${appointmentDetails.appointmentDate}`,
      body: `Your appointment with ${appointmentDetails.providerName} is scheduled for ${appointmentDetails.appointmentTime} at ${appointmentDetails.location}.`,
      category: 'appointment',
      target,
      priority: 'normal',
      data: appointmentDetails,
    });
  }

  /**
   * Send a medication reminder
   */
  async sendMedicationReminder(
    target: NotificationTarget,
    medicationDetails: {
      medicationName: string;
      dosage: string;
      scheduledTime: string;
      instructions?: string;
    }
  ): Promise<NotificationResult> {
    return this.send({
      title: `Medication Reminder: ${medicationDetails.medicationName}`,
      body: `Time to take ${medicationDetails.dosage} of ${medicationDetails.medicationName}. ${medicationDetails.instructions || ''}`,
      category: 'medication',
      target,
      priority: 'high',
      data: medicationDetails,
    });
  }

  /**
   * Send a wellness check notification
   */
  async sendWellnessCheck(
    target: NotificationTarget,
    checkType: string,
    body: string
  ): Promise<NotificationResult> {
    return this.send({
      title: `Wellness Check: ${checkType}`,
      body,
      category: 'wellness',
      target,
      priority: 'normal',
    });
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: string): Promise<InAppNotification[]> {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .is('read_at', null)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      await auditLogger.error('GET_NOTIFICATIONS_FAILED', error.message, { userId });
      return [];
    }

    return data || [];
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      await auditLogger.error('MARK_READ_FAILED', error.message, { notificationId, userId });
      return false;
    }

    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      await auditLogger.error('MARK_ALL_READ_FAILED', error.message, { userId });
      return false;
    }

    return true;
  }

  /**
   * Dismiss a notification
   */
  async dismiss(notificationId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      await auditLogger.error('DISMISS_NOTIFICATION_FAILED', error.message, { notificationId, userId });
      return false;
    }

    return true;
  }

  /**
   * Get notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('dismissed_at', null);

    if (error) {
      return 0;
    }

    return count || 0;
  }
}

/**
 * Global notification service instance
 */
let globalNotificationService: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!globalNotificationService) {
    globalNotificationService = new NotificationService();
  }
  return globalNotificationService;
}

/**
 * Convenience function for sending notifications
 */
export async function sendNotification(options: NotificationOptions): Promise<NotificationResult> {
  return getNotificationService().send(options);
}
