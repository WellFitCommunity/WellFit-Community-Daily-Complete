/**
 * Alert Notification Service
 *
 * Purpose: Route alerts to external notification channels
 * Features: Slack, PagerDuty, email, webhook integrations
 * Integration: Guardian alerts, security events, SLA breaches
 *
 * @module services/alertNotificationService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type NotificationChannel = 'slack' | 'pagerduty' | 'email' | 'webhook' | 'sms';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertCategory = 'security' | 'sla' | 'system' | 'clinical' | 'billing';

export interface NotificationChannelConfig {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  name: string;
  isEnabled: boolean;
  config: {
    webhookUrl?: string;
    apiKey?: string;
    routingKey?: string;
    emailAddresses?: string[];
    phoneNumbers?: string[];
  };
  filters: {
    severities: AlertSeverity[];
    categories: AlertCategory[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  tenantId: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  source?: string;
  resourceType?: string;
  resourceId?: string;
  timestamp: string;
}

export interface NotificationResult {
  channelId: string;
  channelType: NotificationChannel;
  success: boolean;
  error?: string;
  responseId?: string;
}

export interface SlackMessage {
  text: string;
  blocks?: Array<Record<string, unknown>>;
  attachments?: Array<{
    color: string;
    title: string;
    text: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
    footer?: string;
    ts?: number;
  }>;
}

export interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    source: string;
    timestamp?: string;
    component?: string;
    group?: string;
    class?: string;
    custom_details?: Record<string, unknown>;
  };
  links?: Array<{ href: string; text: string }>;
  images?: Array<{ src: string; alt?: string; href?: string }>;
}

// =============================================================================
// CHANNEL CONFIGURATION
// =============================================================================

/**
 * Create a notification channel
 */
async function createChannel(
  tenantId: string,
  channel: NotificationChannel,
  name: string,
  config: NotificationChannelConfig['config'],
  filters?: NotificationChannelConfig['filters']
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase
      .from('notification_channels')
      .insert({
        tenant_id: tenantId,
        channel_type: channel,
        name,
        is_enabled: true,
        config,
        filters: filters || { severities: ['warning', 'critical', 'emergency'], categories: [] },
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to create notification channel', error);
    }

    await auditLogger.info('NOTIFICATION_CHANNEL_CREATED', {
      tenantId,
      channelId: data.id,
      channel,
      name,
    });

    return success(data.id);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CHANNEL_CREATE_FAILED', wrappedError, { tenantId, channel });
    return failure('OPERATION_FAILED', 'Failed to create notification channel', wrappedError);
  }
}

/**
 * Get channels for a tenant
 */
async function getChannels(
  tenantId: string
): Promise<ServiceResult<NotificationChannelConfig[]>> {
  try {
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get channels', error);
    }

    const channels: NotificationChannelConfig[] = (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      channel: row.channel_type,
      name: row.name,
      isEnabled: row.is_enabled,
      config: row.config || {},
      filters: row.filters || { severities: [], categories: [] },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return success(channels);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get channels', wrappedError);
  }
}

/**
 * Update a channel
 */
async function updateChannel(
  channelId: string,
  updates: Partial<Pick<NotificationChannelConfig, 'name' | 'isEnabled' | 'config' | 'filters'>>
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('notification_channels')
      .update({
        name: updates.name,
        is_enabled: updates.isEnabled,
        config: updates.config,
        filters: updates.filters,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update channel', error);
    }

    await auditLogger.info('NOTIFICATION_CHANNEL_UPDATED', { channelId, updates });

    return success(undefined);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to update channel', wrappedError);
  }
}

/**
 * Delete a channel
 */
async function deleteChannel(
  channelId: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('notification_channels')
      .delete()
      .eq('id', channelId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to delete channel', error);
    }

    await auditLogger.info('NOTIFICATION_CHANNEL_DELETED', { channelId });

    return success(undefined);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to delete channel', wrappedError);
  }
}

/**
 * Test a channel configuration
 */
async function testChannel(
  channelId: string
): Promise<ServiceResult<{ success: boolean; message: string }>> {
  try {
    const { data: channel, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (error || !channel) {
      return failure('NOT_FOUND', 'Channel not found');
    }

    const testAlert: Alert = {
      id: `test-${Date.now()}`,
      tenantId: channel.tenant_id,
      severity: 'info',
      category: 'system',
      title: 'Test Notification',
      message: 'This is a test notification from WellFit to verify your integration is working correctly.',
      details: { test: true },
      source: 'notification_test',
      timestamp: new Date().toISOString(),
    };

    const result = await sendToChannel(channel, testAlert);

    return success({
      success: result.success,
      message: result.success ? 'Test notification sent successfully' : (result.error || 'Failed to send test'),
    });
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to test channel', wrappedError);
  }
}

// =============================================================================
// NOTIFICATION SENDING
// =============================================================================

/**
 * Send an alert to all applicable channels
 */
async function sendAlert(
  alert: Alert
): Promise<ServiceResult<NotificationResult[]>> {
  try {
    // Get enabled channels for this tenant that match the alert
    const { data: channels, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('tenant_id', alert.tenantId)
      .eq('is_enabled', true);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get notification channels', error);
    }

    const results: NotificationResult[] = [];

    for (const channel of channels || []) {
      // Check if channel filters match
      const filters = channel.filters || { severities: [], categories: [] };
      const severities = filters.severities || [];
      const categories = filters.categories || [];

      // Skip if severity doesn't match (empty means all)
      if (severities.length > 0 && !severities.includes(alert.severity)) {
        continue;
      }

      // Skip if category doesn't match (empty means all)
      if (categories.length > 0 && !categories.includes(alert.category)) {
        continue;
      }

      // Send to channel
      const result = await sendToChannel(channel, alert);
      results.push(result);

      // Log the notification
      await supabase.from('notification_log').insert({
        tenant_id: alert.tenantId,
        channel_id: channel.id,
        alert_id: alert.id,
        channel_type: channel.channel_type,
        success: result.success,
        error_message: result.error,
        response_id: result.responseId,
      });
    }

    await auditLogger.info('ALERT_NOTIFICATIONS_SENT', {
      alertId: alert.id,
      tenantId: alert.tenantId,
      channelCount: results.length,
      successCount: results.filter((r) => r.success).length,
    });

    return success(results);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ALERT_SEND_FAILED', wrappedError, { alertId: alert.id });
    return failure('OPERATION_FAILED', 'Failed to send alert', wrappedError);
  }
}

/**
 * Send to a specific channel
 */
async function sendToChannel(
  channel: Record<string, unknown>,
  alert: Alert
): Promise<NotificationResult> {
  const channelType = channel.channel_type as NotificationChannel;
  const config = channel.config as NotificationChannelConfig['config'];

  try {
    switch (channelType) {
      case 'slack':
        if (!config.webhookUrl) {
          return { channelId: channel.id as string, channelType, success: false, error: 'Slack webhook URL not configured' };
        }
        return await sendToSlack(channel.id as string, config.webhookUrl, alert);

      case 'pagerduty':
        if (!config.routingKey) {
          return { channelId: channel.id as string, channelType, success: false, error: 'PagerDuty routing key not configured' };
        }
        return await sendToPagerDuty(
          channel.id as string,
          config.routingKey,
          alert
        );

      case 'webhook':
        if (!config.webhookUrl) {
          return { channelId: channel.id as string, channelType, success: false, error: 'Webhook URL not configured' };
        }
        return await sendToWebhook(channel.id as string, config.webhookUrl, alert);

      case 'email':
        return await sendEmail(channel.id as string, config.emailAddresses || [], alert);

      default:
        return {
          channelId: channel.id as string,
          channelType,
          success: false,
          error: `Unsupported channel type: ${channelType}`,
        };
    }
  } catch (err) {
    return {
      channelId: channel.id as string,
      channelType,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// =============================================================================
// CHANNEL-SPECIFIC IMPLEMENTATIONS
// =============================================================================

/**
 * Send to Slack webhook
 */
async function sendToSlack(
  channelId: string,
  webhookUrl: string,
  alert: Alert
): Promise<NotificationResult> {
  const severityColors: Record<AlertSeverity, string> = {
    info: '#36a64f',
    warning: '#ffcc00',
    critical: '#ff6600',
    emergency: '#ff0000',
  };

  const slackMessage: SlackMessage = {
    text: `[${alert.severity.toUpperCase()}] ${alert.title}`,
    attachments: [
      {
        color: severityColors[alert.severity],
        title: alert.title,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Category', value: alert.category, short: true },
          ...(alert.source ? [{ title: 'Source', value: alert.source, short: true }] : []),
          ...(alert.resourceType ? [{ title: 'Resource', value: `${alert.resourceType}/${alert.resourceId}`, short: true }] : []),
        ],
        footer: 'WellFit Alert System',
        ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackMessage),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      channelId,
      channelType: 'slack',
      success: false,
      error: `Slack error: ${response.status} - ${text}`,
    };
  }

  return {
    channelId,
    channelType: 'slack',
    success: true,
  };
}

/**
 * Send to PagerDuty Events API v2
 */
async function sendToPagerDuty(
  channelId: string,
  routingKey: string,
  alert: Alert
): Promise<NotificationResult> {
  const severityMap: Record<AlertSeverity, PagerDutyEvent['payload']['severity']> = {
    info: 'info',
    warning: 'warning',
    critical: 'error',
    emergency: 'critical',
  };

  const event: PagerDutyEvent = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: alert.id,
    payload: {
      summary: `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`,
      severity: severityMap[alert.severity],
      source: alert.source || 'wellfit',
      timestamp: alert.timestamp,
      component: alert.category,
      group: alert.resourceType,
      custom_details: {
        alert_id: alert.id,
        category: alert.category,
        resource_type: alert.resourceType,
        resource_id: alert.resourceId,
        ...alert.details,
      },
    },
  };

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      channelId,
      channelType: 'pagerduty',
      success: false,
      error: `PagerDuty error: ${response.status} - ${text}`,
    };
  }

  const result = await response.json();

  return {
    channelId,
    channelType: 'pagerduty',
    success: true,
    responseId: result.dedup_key,
  };
}

/**
 * Send to generic webhook
 */
async function sendToWebhook(
  channelId: string,
  webhookUrl: string,
  alert: Alert
): Promise<NotificationResult> {
  const payload = {
    event_type: 'wellfit.alert',
    timestamp: alert.timestamp,
    alert: {
      id: alert.id,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      details: alert.details,
      source: alert.source,
      resource_type: alert.resourceType,
      resource_id: alert.resourceId,
    },
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      channelId,
      channelType: 'webhook',
      success: false,
      error: `Webhook error: ${response.status} - ${text}`,
    };
  }

  return {
    channelId,
    channelType: 'webhook',
    success: true,
  };
}

/**
 * Send email notification (via edge function)
 */
async function sendEmail(
  channelId: string,
  emailAddresses: string[],
  alert: Alert
): Promise<NotificationResult> {
  // This would typically call an edge function or email service
  // For now, we log it and return success (email would be sent async)

  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      to: emailAddresses,
      subject: `[WellFit Alert] [${alert.severity.toUpperCase()}] ${alert.title}`,
      html: `
        <h2>${alert.title}</h2>
        <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
        <p><strong>Category:</strong> ${alert.category}</p>
        <p>${alert.message}</p>
        ${alert.details ? `<pre>${JSON.stringify(alert.details, null, 2)}</pre>` : ''}
        <hr>
        <p><small>WellFit Alert System</small></p>
      `,
    },
  });

  if (error) {
    return {
      channelId,
      channelType: 'email',
      success: false,
      error: error.message,
    };
  }

  return {
    channelId,
    channelType: 'email',
    success: true,
  };
}

// =============================================================================
// PAGERDUTY ACTIONS
// =============================================================================

/**
 * Acknowledge a PagerDuty incident
 */
async function acknowledgePagerDutyIncident(
  routingKey: string,
  dedupKey: string
): Promise<ServiceResult<void>> {
  try {
    const event: PagerDutyEvent = {
      routing_key: routingKey,
      event_action: 'acknowledge',
      dedup_key: dedupKey,
      payload: {
        summary: 'Incident acknowledged',
        severity: 'info',
        source: 'wellfit',
      },
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      return failure('OPERATION_FAILED', 'Failed to acknowledge PagerDuty incident');
    }

    return success(undefined);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to acknowledge PagerDuty incident', wrappedError);
  }
}

/**
 * Resolve a PagerDuty incident
 */
async function resolvePagerDutyIncident(
  routingKey: string,
  dedupKey: string
): Promise<ServiceResult<void>> {
  try {
    const event: PagerDutyEvent = {
      routing_key: routingKey,
      event_action: 'resolve',
      dedup_key: dedupKey,
      payload: {
        summary: 'Incident resolved',
        severity: 'info',
        source: 'wellfit',
      },
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      return failure('OPERATION_FAILED', 'Failed to resolve PagerDuty incident');
    }

    return success(undefined);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to resolve PagerDuty incident', wrappedError);
  }
}

// =============================================================================
// NOTIFICATION LOG
// =============================================================================

/**
 * Get notification history for an alert
 */
async function getAlertNotificationHistory(
  alertId: string
): Promise<ServiceResult<Array<{
  channelId: string;
  channelType: NotificationChannel;
  success: boolean;
  errorMessage: string | null;
  sentAt: string;
}>>> {
  try {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get notification history', error);
    }

    const history = (data || []).map((row) => ({
      channelId: row.channel_id,
      channelType: row.channel_type,
      success: row.success,
      errorMessage: row.error_message,
      sentAt: row.created_at,
    }));

    return success(history);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get notification history', wrappedError);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const alertNotificationService = {
  // Channel management
  createChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  testChannel,

  // Sending
  sendAlert,

  // PagerDuty actions
  acknowledgePagerDutyIncident,
  resolvePagerDutyIncident,

  // History
  getAlertNotificationHistory,
};

export default alertNotificationService;
