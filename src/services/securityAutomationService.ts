/**
 * Security Automation Service
 *
 * Provides automated responses to security events:
 * - Alert threshold monitoring
 * - Automatic account lockout notifications
 * - Anomaly-based automatic responses
 * - Escalation workflow management
 *
 * SOC2 Compliance: CC6.1, CC7.2, CC7.3 - Automated security response
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { securityAlertNotifier, AlertNotification } from './guardian-agent/SecurityAlertNotifier';
import { auditLogger } from './auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface SecurityThreshold {
  name: string;
  metric: string;
  threshold: number;
  timeWindowMinutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResponse?: AutomatedResponse;
}

export interface AutomatedResponse {
  type: 'notify' | 'lockout' | 'revoke_tokens' | 'require_mfa' | 'disable_account';
  channels: string[];
  escalateAfterMinutes?: number;
}

export interface SecurityEventTrigger {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notifyChannels: string[];
  autoResponse?: AutomatedResponse;
}

export interface ThresholdCheckResult {
  thresholdName: string;
  exceeded: boolean;
  currentValue: number;
  threshold: number;
  alertCreated?: string;
}

// ============================================================================
// Default Thresholds
// ============================================================================

export const DEFAULT_SECURITY_THRESHOLDS: SecurityThreshold[] = [
  {
    name: 'failed_logins_threshold',
    metric: 'failed_logins',
    threshold: 5,
    timeWindowMinutes: 15,
    severity: 'high',
    autoResponse: {
      type: 'lockout',
      channels: ['email'],
    },
  },
  {
    name: 'critical_events_threshold',
    metric: 'critical_events',
    threshold: 1,
    timeWindowMinutes: 60,
    severity: 'critical',
    autoResponse: {
      type: 'notify',
      channels: ['email', 'slack', 'pagerduty'],
    },
  },
  {
    name: 'unauthorized_access_threshold',
    metric: 'unauthorized_access',
    threshold: 3,
    timeWindowMinutes: 30,
    severity: 'high',
    autoResponse: {
      type: 'notify',
      channels: ['email', 'slack'],
    },
  },
  {
    name: 'phi_access_anomaly_threshold',
    metric: 'phi_access_anomaly',
    threshold: 10,
    timeWindowMinutes: 60,
    severity: 'high',
    autoResponse: {
      type: 'notify',
      channels: ['email', 'slack'],
      escalateAfterMinutes: 15,
    },
  },
  {
    name: 'impossible_travel_threshold',
    metric: 'impossible_travel',
    threshold: 1,
    timeWindowMinutes: 60,
    severity: 'critical',
    autoResponse: {
      type: 'revoke_tokens',
      channels: ['email', 'slack', 'pagerduty'],
    },
  },
];

// ============================================================================
// Event Type Triggers
// ============================================================================

export const SECURITY_EVENT_TRIGGERS: SecurityEventTrigger[] = [
  {
    eventType: 'BRUTE_FORCE_DETECTED',
    severity: 'critical',
    notifyChannels: ['email', 'slack', 'pagerduty'],
    autoResponse: { type: 'lockout', channels: ['email'] },
  },
  {
    eventType: 'IMPOSSIBLE_TRAVEL',
    severity: 'critical',
    notifyChannels: ['email', 'slack', 'pagerduty'],
    autoResponse: { type: 'revoke_tokens', channels: ['email', 'sms'] },
  },
  {
    eventType: 'PHI_MASS_ACCESS',
    severity: 'critical',
    notifyChannels: ['email', 'slack', 'pagerduty'],
    autoResponse: { type: 'disable_account', channels: ['email'] },
  },
  {
    eventType: 'UNAUTHORIZED_ADMIN_ACCESS',
    severity: 'high',
    notifyChannels: ['email', 'slack'],
  },
  {
    eventType: 'SESSION_HIJACK_SUSPECTED',
    severity: 'critical',
    notifyChannels: ['email', 'slack', 'pagerduty'],
    autoResponse: { type: 'revoke_tokens', channels: ['email', 'sms'] },
  },
  {
    eventType: 'MFA_BYPASS_ATTEMPT',
    severity: 'high',
    notifyChannels: ['email', 'slack'],
  },
  {
    eventType: 'API_ABUSE_DETECTED',
    severity: 'high',
    notifyChannels: ['email', 'slack'],
    autoResponse: { type: 'lockout', channels: ['email'] },
  },
];

// ============================================================================
// Service Class
// ============================================================================

export class SecurityAutomationService {
  private thresholds: SecurityThreshold[];
  private eventTriggers: SecurityEventTrigger[];

  constructor(
    private supabase: SupabaseClient,
    thresholds?: SecurityThreshold[],
    eventTriggers?: SecurityEventTrigger[]
  ) {
    this.thresholds = thresholds || DEFAULT_SECURITY_THRESHOLDS;
    this.eventTriggers = eventTriggers || SECURITY_EVENT_TRIGGERS;
  }

  /**
   * Check all security thresholds and create alerts if exceeded
   */
  async checkAllThresholds(): Promise<ThresholdCheckResult[]> {
    const results: ThresholdCheckResult[] = [];

    for (const threshold of this.thresholds) {
      try {
        const result = await this.checkThreshold(threshold);
        results.push(result);

        if (result.exceeded && result.alertCreated) {
          auditLogger.warn('Security threshold exceeded', {
            threshold: threshold.name,
            currentValue: result.currentValue,
            thresholdValue: threshold.threshold,
            alertId: result.alertCreated,
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        auditLogger.error('Threshold check failed', errorMsg, {
          threshold: threshold.name,
        });
      }
    }

    return results;
  }

  /**
   * Check a single security threshold
   */
  async checkThreshold(threshold: SecurityThreshold): Promise<ThresholdCheckResult> {
    const currentValue = await this.getMetricValue(
      threshold.metric,
      threshold.timeWindowMinutes
    );

    const exceeded = currentValue >= threshold.threshold;
    let alertCreated: string | undefined;

    if (exceeded) {
      // Check if we already have an active alert for this threshold
      const existingAlert = await this.getExistingAlert(threshold.name);

      if (!existingAlert) {
        // Create new alert
        alertCreated = await this.createSecurityAlert({
          severity: threshold.severity,
          category: 'threshold_breach',
          title: `Security Threshold Exceeded: ${threshold.name}`,
          message: `${threshold.metric} reached ${currentValue} (threshold: ${threshold.threshold}) in the last ${threshold.timeWindowMinutes} minutes`,
          metadata: {
            threshold_name: threshold.name,
            metric: threshold.metric,
            current_value: currentValue,
            threshold_value: threshold.threshold,
            time_window_minutes: threshold.timeWindowMinutes,
          },
        });

        // Execute automated response if configured
        if (threshold.autoResponse && alertCreated) {
          await this.executeAutomatedResponse(threshold.autoResponse, alertCreated, threshold);
        }
      }
    }

    return {
      thresholdName: threshold.name,
      exceeded,
      currentValue,
      threshold: threshold.threshold,
      alertCreated,
    };
  }

  /**
   * Process a security event and trigger appropriate responses
   */
  async processSecurityEvent(
    eventType: string,
    userId: string | null,
    metadata: Record<string, unknown>
  ): Promise<{ alertCreated: boolean; alertId?: string; notificationsSent: string[] }> {
    const trigger = this.eventTriggers.find((t) => t.eventType === eventType);

    if (!trigger) {
      // No specific trigger, but still log the event
      return { alertCreated: false, notificationsSent: [] };
    }

    // Create security alert
    const alertId = await this.createSecurityAlert({
      severity: trigger.severity,
      category: 'security_event',
      title: `Security Event: ${eventType}`,
      message: `Security event ${eventType} detected${userId ? ` for user ${userId}` : ''}`,
      metadata: {
        event_type: eventType,
        user_id: userId,
        ...metadata,
      },
    });

    const notificationsSent: string[] = [];

    if (alertId) {
      // Send notifications
      const notification: AlertNotification = {
        alertId,
        severity: trigger.severity,
        title: `Security Event: ${eventType}`,
        description: `A ${trigger.severity} severity security event was detected.`,
        affectedResource: userId || undefined,
        timestamp: new Date().toISOString(),
        channels: trigger.notifyChannels,
        metadata,
      };

      const result = await securityAlertNotifier.notify(notification);

      for (const [channel, channelResult] of Object.entries(result.results)) {
        if (channelResult.success) {
          notificationsSent.push(channel);
        }
      }

      // Execute automated response if configured
      if (trigger.autoResponse) {
        await this.executeAutomatedResponse(
          trigger.autoResponse,
          alertId,
          { name: eventType, severity: trigger.severity } as SecurityThreshold,
          userId || undefined
        );
      }
    }

    return {
      alertCreated: !!alertId,
      alertId,
      notificationsSent,
    };
  }

  /**
   * Get metric value for threshold checking
   */
  private async getMetricValue(metric: string, timeWindowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();

    switch (metric) {
      case 'failed_logins': {
        const { count } = await this.supabase
          .from('login_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('success', false)
          .gte('created_at', since);
        return count || 0;
      }

      case 'critical_events': {
        const { count } = await this.supabase
          .from('security_events')
          .select('*', { count: 'exact', head: true })
          .eq('severity', 'CRITICAL')
          .gte('timestamp', since);
        return count || 0;
      }

      case 'unauthorized_access': {
        const { count } = await this.supabase
          .from('security_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_type', 'UNAUTHORIZED_ACCESS')
          .gte('timestamp', since);
        return count || 0;
      }

      case 'phi_access_anomaly': {
        const { count } = await this.supabase
          .from('anomaly_detections')
          .select('*', { count: 'exact', head: true })
          .eq('anomaly_type', 'phi_access')
          .gte('detected_at', since);
        return count || 0;
      }

      case 'impossible_travel': {
        const { count } = await this.supabase
          .from('anomaly_detections')
          .select('*', { count: 'exact', head: true })
          .eq('anomaly_type', 'impossible_travel')
          .gte('detected_at', since);
        return count || 0;
      }

      default:
        auditLogger.warn('Unknown metric requested', { metric });
        return 0;
    }
  }

  /**
   * Check for existing active alert for a threshold
   */
  private async getExistingAlert(thresholdName: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('security_alerts')
      .select('id')
      .eq('category', 'threshold_breach')
      .eq('status', 'pending')
      .contains('metadata', { threshold_name: thresholdName })
      .single();

    return !!data;
  }

  /**
   * Create a security alert in the database
   */
  private async createSecurityAlert(alert: {
    severity: string;
    category: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | undefined> {
    try {
      const { data, error } = await this.supabase
        .from('security_alerts')
        .insert({
          severity: alert.severity,
          category: alert.category,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata || {},
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        auditLogger.error('Failed to create security alert', error.message, {
          alert: alert.title,
        });
        return undefined;
      }

      return data.id;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      auditLogger.error('Exception creating security alert', errorMsg);
      return undefined;
    }
  }

  /**
   * Execute automated response action
   */
  private async executeAutomatedResponse(
    response: AutomatedResponse,
    alertId: string,
    threshold: { name: string; severity?: string },
    userId?: string
  ): Promise<void> {
    try {
      switch (response.type) {
        case 'notify':
          await this.sendAlertNotifications(alertId, response.channels, threshold);
          break;

        case 'lockout':
          if (userId) {
            await this.lockoutUser(userId, alertId);
          }
          await this.sendAlertNotifications(alertId, response.channels, threshold);
          break;

        case 'revoke_tokens':
          if (userId) {
            await this.revokeUserTokens(userId, alertId);
          }
          await this.sendAlertNotifications(alertId, response.channels, threshold);
          break;

        case 'require_mfa':
          if (userId) {
            await this.requireMFA(userId, alertId);
          }
          await this.sendAlertNotifications(alertId, response.channels, threshold);
          break;

        case 'disable_account':
          if (userId) {
            await this.disableAccount(userId, alertId);
          }
          await this.sendAlertNotifications(alertId, response.channels, threshold);
          break;
      }

      auditLogger.info('Automated response executed', {
        responseType: response.type,
        alertId,
        userId,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      auditLogger.error('Automated response failed', errorMsg, {
        responseType: response.type,
        alertId,
      });
    }
  }

  /**
   * Send alert notifications to specified channels
   */
  private async sendAlertNotifications(
    alertId: string,
    channels: string[],
    threshold: { name: string; severity?: string }
  ): Promise<void> {
    const notification: AlertNotification = {
      alertId,
      severity: (threshold.severity as AlertNotification['severity']) || 'high',
      title: `Security Alert: ${threshold.name}`,
      description: `Automated security alert triggered for ${threshold.name}`,
      timestamp: new Date().toISOString(),
      channels,
    };

    await securityAlertNotifier.notify(notification);
  }

  /**
   * Lock out a user account
   */
  private async lockoutUser(userId: string, alertId: string): Promise<void> {
    const lockoutDuration = 30; // minutes

    await this.supabase.from('account_lockouts').insert({
      identifier: userId,
      locked_until: new Date(Date.now() + lockoutDuration * 60 * 1000).toISOString(),
      reason: 'security_automation',
      metadata: {
        alert_id: alertId,
        automated: true,
      },
    });

    auditLogger.warn('User account locked by automation', {
      userId,
      alertId,
      lockoutDuration,
    });
  }

  /**
   * Revoke all user tokens/sessions
   */
  private async revokeUserTokens(userId: string, alertId: string): Promise<void> {
    // Sign out user from all sessions
    await this.supabase.auth.admin.signOut(userId, 'global');

    auditLogger.warn('User tokens revoked by automation', {
      userId,
      alertId,
    });
  }

  /**
   * Require MFA for user on next login
   */
  private async requireMFA(userId: string, alertId: string): Promise<void> {
    await this.supabase
      .from('profiles')
      .update({
        mfa_required: true,
        mfa_required_reason: `Security alert ${alertId}`,
      })
      .eq('user_id', userId);

    auditLogger.warn('MFA required by automation', {
      userId,
      alertId,
    });
  }

  /**
   * Disable user account
   */
  private async disableAccount(userId: string, alertId: string): Promise<void> {
    // First revoke all sessions
    await this.revokeUserTokens(userId, alertId);

    // Update profile to disabled
    await this.supabase
      .from('profiles')
      .update({
        account_disabled: true,
        account_disabled_reason: `Security alert ${alertId}`,
        account_disabled_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    auditLogger.warn('User account disabled by automation', {
      userId,
      alertId,
    });
  }

  /**
   * Get alert escalation status
   */
  async checkEscalations(): Promise<void> {
    // Find alerts that need escalation
    const { data: alertsToEscalate } = await this.supabase
      .from('security_alerts')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (alertsToEscalate && alertsToEscalate.length > 0) {
      for (const alert of alertsToEscalate) {
        // Send escalation notification
        const notification: AlertNotification = {
          alertId: alert.id,
          severity: alert.severity,
          title: `[ESCALATION] ${alert.title}`,
          description: `Alert has been pending for more than 15 minutes without acknowledgment.`,
          timestamp: new Date().toISOString(),
          channels: ['email', 'slack', 'pagerduty'],
          metadata: { escalated: true, original_created_at: alert.created_at },
        };

        await securityAlertNotifier.notify(notification);

        // Update alert to mark as escalated
        await this.supabase
          .from('security_alerts')
          .update({
            metadata: {
              ...alert.metadata,
              escalated: true,
              escalated_at: new Date().toISOString(),
            },
          })
          .eq('id', alert.id);

        auditLogger.warn('Alert escalated', {
          alertId: alert.id,
          originalCreatedAt: alert.created_at,
        });
      }
    }
  }
}

/**
 * Factory function to create SecurityAutomationService
 */
export function createSecurityAutomationService(
  supabase: SupabaseClient
): SecurityAutomationService {
  return new SecurityAutomationService(supabase);
}
