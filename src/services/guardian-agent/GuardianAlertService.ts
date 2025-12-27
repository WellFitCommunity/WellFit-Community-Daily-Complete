/**
 * Guardian Alert Service
 *
 * Sends notifications to the Security Panel when Guardian Agent detects issues
 * or generates healing fixes that need human review.
 *
 * Features:
 * - Real-time alerts to Security Panel
 * - Links to Guardian Eyes session recordings
 * - Healing fix previews
 * - Severity-based routing
 * - HIPAA audit logging
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { getEmailService } from '../emailService';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertCategory =
  | 'security_vulnerability'
  | 'phi_exposure'
  | 'memory_leak'
  | 'api_failure'
  | 'healing_generated'
  | 'system_health'
  | 'approval_required';

export interface GuardianAlert {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;

  // Guardian Eyes session link
  session_recording_id?: string;
  session_recording_url?: string;
  video_timestamp?: number; // Timestamp in recording when issue occurred

  // Healing information
  healing_operation_id?: string;
  generated_fix?: {
    original_code?: string;
    fixed_code?: string;
    file_path?: string;
    line_number?: number;
  };

  // Context
  affected_component?: string;
  affected_users?: string[];
  error_stack?: string;

  // Review status
  status: 'pending' | 'acknowledged' | 'reviewing' | 'resolved' | 'dismissed';
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolution_notes?: string;

  // Actions available
  actions: AlertAction[];

  // Metadata
  metadata: {
    error_count?: number;
    users_impacted?: number;
    auto_healable?: boolean;
    requires_immediate_action?: boolean;
    estimated_impact?: string;
    pr_url?: string;
    pr_number?: number;
  };
}

export interface AlertAction {
  id: string;
  label: string;
  type: 'view_recording' | 'review_fix' | 'approve_fix' | 'dismiss' | 'escalate' | 'apply_fix';
  url?: string;
  confirmation_required?: boolean;
  danger?: boolean;
}

export class GuardianAlertService {
  /**
   * Send alert to Security Panel
   */
  static async sendAlert(alert: Omit<GuardianAlert, 'id' | 'timestamp' | 'status'>): Promise<GuardianAlert> {
    const fullAlert: GuardianAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
      ...alert,
    };

    try {
      // Save to database
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, error } = await supabase
        .from('guardian_alerts')
        .insert({
          id: fullAlert.id,
          severity: fullAlert.severity,
          category: fullAlert.category,
          title: fullAlert.title,
          description: fullAlert.description,
          session_recording_id: fullAlert.session_recording_id,
          session_recording_url: fullAlert.session_recording_url,
          video_timestamp: fullAlert.video_timestamp,
          healing_operation_id: fullAlert.healing_operation_id,
          generated_fix: fullAlert.generated_fix,
          affected_component: fullAlert.affected_component,
          affected_users: fullAlert.affected_users,
          error_stack: fullAlert.error_stack,
          status: fullAlert.status,
          actions: fullAlert.actions,
          metadata: fullAlert.metadata,
          created_at: fullAlert.timestamp,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      const auditSeverity = fullAlert.severity === 'emergency' ? 'critical' :
                           fullAlert.severity === 'critical' ? 'critical' :
                           fullAlert.severity === 'warning' ? 'medium' : 'low';
      await auditLogger.security('GUARDIAN_ALERT_CREATED', auditSeverity, {
        alertId: fullAlert.id,
        severity: fullAlert.severity,
        category: fullAlert.category,
        title: fullAlert.title,
      });

      // Send real-time notification to Security Panel
      await this.notifySecurityPanel(fullAlert);

      // Send email for critical/emergency alerts
      if (fullAlert.severity === 'critical' || fullAlert.severity === 'emergency') {
        await this.sendEmailNotification(fullAlert);
      }

      return fullAlert;
    } catch (error) {
      await auditLogger.error('GUARDIAN_ALERT_FAILED', error instanceof Error ? error : new Error(String(error)), {
        alert: fullAlert.title,
      });
      throw error;
    }
  }

  /**
   * Send real-time notification to Security Panel
   */
  private static async notifySecurityPanel(alert: GuardianAlert): Promise<void> {
    try {
      // Use Supabase Realtime to notify connected Security Panel clients
      const channel = supabase.channel('guardian-alerts');

      await channel.send({
        type: 'broadcast',
        event: 'new_alert',
        payload: {
          alert,
          notification: {
            title: `${this.getSeverityEmoji(alert.severity)} ${alert.title}`,
            message: alert.description,
            url: alert.session_recording_url,
            timestamp: alert.timestamp,
          },
        },
      });

      // Also insert into notifications table for persistent inbox
      await supabase.from('security_notifications').insert({
        type: 'guardian_alert',
        severity: alert.severity,
        title: alert.title,
        message: alert.description,
        link: alert.session_recording_url || `/security/alerts/${alert.id}`,
        metadata: {
          alert_id: alert.id,
          category: alert.category,
          actions: alert.actions,
        },
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch (error) {

    }
  }

  /**
   * Send email notification for critical alerts
   */
  private static async sendEmailNotification(alert: GuardianAlert): Promise<void> {
    try {
      // Get security team emails
      const { data: securityTeam } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('role_code', 'SECURITY_ADMIN')
        .eq('is_active', true);

      if (!securityTeam || securityTeam.length === 0) return;

      const emailService = getEmailService();
      const baseUrl = import.meta.env.VITE_BASE_URL || 'https://app.wellfitcommunity.com';

      const severityColors: Record<string, string> = {
        info: '#17a2b8',
        warning: '#ffc107',
        critical: '#dc3545',
        emergency: '#721c24',
      };

      await emailService.send({
        to: securityTeam.map((u) => ({
          email: u.email,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Security Admin',
        })),
        subject: `[${alert.severity.toUpperCase()}] Guardian Alert: ${alert.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${severityColors[alert.severity]}; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">Security Alert</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">${alert.severity.toUpperCase()}</p>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
              <h2 style="color: #333; margin-top: 0;">${alert.title}</h2>
              <p><strong>Category:</strong> ${alert.category}</p>
              <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
              <p style="background: white; padding: 15px; border-left: 4px solid ${severityColors[alert.severity]};">
                ${alert.description}
              </p>
              ${alert.session_recording_url ? `<p><a href="${alert.session_recording_url}" style="color: #007bff;">View Session Recording</a></p>` : ''}
              ${alert.generated_fix ? '<p style="color: #28a745;"><strong>A fix has been generated - Review in Security Panel</strong></p>' : ''}
              <p style="text-align: center; margin-top: 20px;">
                <a href="${baseUrl}/security/alerts/${alert.id}" style="background: ${severityColors[alert.severity]}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                  View Alert Details
                </a>
              </p>
            </div>
            <div style="padding: 15px; text-align: center; font-size: 12px; color: #666;">
              <p>This is an automated alert from the WellFit Guardian Agent.</p>
            </div>
          </div>
        `,
        tags: ['guardian', 'security', alert.severity],
      });

      await auditLogger.info('GUARDIAN_EMAIL_SENT', {
        alertId: alert.id,
        recipients: securityTeam.length,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await auditLogger.error('GUARDIAN_EMAIL_FAILED', errorMessage, {
        alertId: alert.id,
      });
    }
  }

  /**
   * Create alert for security vulnerability
   */
  static async alertSecurityVulnerability(params: {
    vulnerability_type: 'xss' | 'sql_injection' | 'phi_exposure' | 'insecure_storage';
    file_path: string;
    line_number: number;
    code_snippet: string;
    session_recording_id?: string;
    generated_fix?: string;
  }): Promise<GuardianAlert> {
    const descriptions = {
      xss: 'Cross-site scripting (XSS) vulnerability detected',
      sql_injection: 'SQL injection vulnerability detected',
      phi_exposure: 'Protected Health Information (PHI) exposure detected',
      insecure_storage: 'Insecure data storage detected',
    };

    return this.sendAlert({
      severity: params.vulnerability_type === 'phi_exposure' ? 'critical' : 'warning',
      category: 'security_vulnerability',
      title: descriptions[params.vulnerability_type],
      description: `Security vulnerability found in ${params.file_path}:${params.line_number}`,
      session_recording_id: params.session_recording_id,
      session_recording_url: params.session_recording_id
        ? `/security/recordings/${params.session_recording_id}`
        : undefined,
      generated_fix: params.generated_fix ? {
        original_code: params.code_snippet,
        fixed_code: params.generated_fix,
        file_path: params.file_path,
        line_number: params.line_number,
      } : undefined,
      affected_component: params.file_path,
      actions: [
        {
          id: 'view_code',
          label: 'View Code',
          type: 'view_recording',
          url: `/security/code-review/${params.file_path}#L${params.line_number}`,
        },
        ...(params.generated_fix ? [
          {
            id: 'review_fix',
            label: 'Review Generated Fix',
            type: 'review_fix' as const,
            url: `/security/healing/${params.session_recording_id}`,
          },
          {
            id: 'approve_fix',
            label: 'Approve & Apply Fix',
            type: 'approve_fix' as const,
            confirmation_required: true,
            danger: false,
          },
        ] : []),
        {
          id: 'dismiss',
          label: 'Dismiss (False Positive)',
          type: 'dismiss',
          confirmation_required: true,
        },
      ],
      metadata: {
        auto_healable: !!params.generated_fix,
        requires_immediate_action: params.vulnerability_type === 'phi_exposure',
        estimated_impact: params.vulnerability_type === 'phi_exposure'
          ? 'HIPAA violation risk - immediate action required'
          : 'Security risk - review and fix recommended',
      },
    });
  }

  /**
   * Create alert for PHI exposure
   */
  static async alertPHIExposure(params: {
    location: 'console_log' | 'error_message' | 'local_storage' | 'network_request';
    phi_type: 'ssn' | 'mrn' | 'patient_name' | 'dob' | 'diagnosis';
    component: string;
    session_recording_id?: string;
    video_timestamp?: number;
    user_id?: string;
  }): Promise<GuardianAlert> {
    return this.sendAlert({
      severity: 'critical',
      category: 'phi_exposure',
      title: `PHI Exposure: ${params.phi_type.toUpperCase()} in ${params.location}`,
      description: `Protected Health Information (${params.phi_type}) detected in ${params.location} within ${params.component}. Guardian Eyes recorded the incident for review.`,
      session_recording_id: params.session_recording_id,
      session_recording_url: params.session_recording_id && params.video_timestamp
        ? `/security/recordings/${params.session_recording_id}?t=${params.video_timestamp}`
        : undefined,
      video_timestamp: params.video_timestamp,
      affected_component: params.component,
      affected_users: params.user_id ? [params.user_id] : [],
      actions: [
        {
          id: 'view_recording',
          label: 'Watch Guardian Eyes Recording',
          type: 'view_recording',
          url: `/security/recordings/${params.session_recording_id}?t=${params.video_timestamp}`,
        },
        {
          id: 'escalate',
          label: 'Escalate to Compliance Officer',
          type: 'escalate',
          danger: true,
        },
        {
          id: 'resolve',
          label: 'Mark Resolved',
          type: 'dismiss',
          confirmation_required: true,
        },
      ],
      metadata: {
        requires_immediate_action: true,
        estimated_impact: 'HIPAA §164.530 violation - potential breach notification required',
        users_impacted: params.user_id ? 1 : 0,
      },
    });
  }

  /**
   * Create alert for generated healing fix
   */
  static async alertHealingGenerated(params: {
    issue_type: string;
    file_path: string;
    line_number: number;
    original_code: string;
    fixed_code: string;
    session_recording_id?: string;
    healing_operation_id: string;
  }): Promise<GuardianAlert> {
    return this.sendAlert({
      severity: 'info',
      category: 'healing_generated',
      title: `Guardian Generated Fix: ${params.issue_type}`,
      description: `Guardian Agent detected ${params.issue_type} in ${params.file_path}:${params.line_number} and generated a healing fix for review.`,
      session_recording_id: params.session_recording_id,
      session_recording_url: params.session_recording_id
        ? `/security/recordings/${params.session_recording_id}`
        : undefined,
      healing_operation_id: params.healing_operation_id,
      generated_fix: {
        original_code: params.original_code,
        fixed_code: params.fixed_code,
        file_path: params.file_path,
        line_number: params.line_number,
      },
      affected_component: params.file_path,
      actions: [
        {
          id: 'review_fix',
          label: 'Review Code Diff',
          type: 'review_fix',
          url: `/security/healing/${params.healing_operation_id}`,
        },
        {
          id: 'approve_fix',
          label: 'Approve & Apply',
          type: 'approve_fix',
          confirmation_required: true,
        },
        {
          id: 'dismiss',
          label: 'Reject Fix',
          type: 'dismiss',
          confirmation_required: true,
        },
      ],
      metadata: {
        auto_healable: true,
        requires_immediate_action: false,
        estimated_impact: 'Code quality improvement - review recommended',
      },
    });
  }

  /**
   * Create alert for memory leak
   */
  static async alertMemoryLeak(params: {
    component: string;
    memory_usage_mb: number;
    leak_type: 'event_listener' | 'interval' | 'subscription';
    session_recording_id?: string;
    generated_fix?: string;
  }): Promise<GuardianAlert> {
    return this.sendAlert({
      severity: 'warning',
      category: 'memory_leak',
      title: `Memory Leak Detected: ${params.component}`,
      description: `Memory leak (${params.leak_type}) detected in ${params.component}. Current memory usage: ${params.memory_usage_mb}MB`,
      session_recording_id: params.session_recording_id,
      session_recording_url: params.session_recording_id
        ? `/security/recordings/${params.session_recording_id}`
        : undefined,
      generated_fix: params.generated_fix ? {
        fixed_code: params.generated_fix,
      } : undefined,
      affected_component: params.component,
      actions: [
        {
          id: 'view_recording',
          label: 'View Memory Profile',
          type: 'view_recording',
          url: `/security/recordings/${params.session_recording_id}`,
        },
        ...(params.generated_fix ? [
          {
            id: 'review_fix',
            label: 'Review Cleanup Code',
            type: 'review_fix' as const,
          },
        ] : []),
      ],
      metadata: {
        auto_healable: !!params.generated_fix,
        estimated_impact: `Memory usage ${params.memory_usage_mb}MB - performance degradation possible`,
      },
    });
  }

  /**
   * Get all pending alerts for Security Panel
   */
  static async getPendingAlerts(): Promise<GuardianAlert[]> {
    const { data, error } = await supabase
      .from('guardian_alerts')
      .select('*')
      .in('status', ['pending', 'acknowledged'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Acknowledge alert
   */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await supabase
      .from('guardian_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    await auditLogger.security('GUARDIAN_ALERT_ACKNOWLEDGED', 'low', {
      alertId,
      userId,
    });
  }

  /**
   * Resolve alert
   */
  static async resolveAlert(alertId: string, userId: string, notes: string): Promise<void> {
    await supabase
      .from('guardian_alerts')
      .update({
        status: 'resolved',
        resolution_notes: notes,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    await auditLogger.security('GUARDIAN_ALERT_RESOLVED', 'low', {
      alertId,
      userId,
      notes,
    });
  }

  /**
   * Approve fix and create pull request
   */
  static async approveAndCreatePR(alertId: string, userId: string, reviewers?: string[]): Promise<{
    success: boolean;
    prUrl?: string;
    prNumber?: number;
    message: string;
    error?: string;
  }> {
    try {
      // Import GitService dynamically to avoid circular dependencies
      const { GitService } = await import('./GitService');

      // Get alert details
      const { data: alert, error: fetchError } = await supabase
        .from('guardian_alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      if (fetchError || !alert) {
        throw new Error('Alert not found');
      }

      // Verify alert has generated fix
      if (!alert.generated_fix) {
        throw new Error('No generated fix available for this alert');
      }

      // Check if GitHub CLI is available
      const hasGitHubCLI = await GitService.checkGitHubCLI();
      if (!hasGitHubCLI) {
        throw new Error('GitHub CLI (gh) is not installed or not authenticated. Please run: gh auth login');
      }

      // Audit log the approval
      await auditLogger.security('GUARDIAN_FIX_APPROVED', 'medium', {
        alertId,
        userId,
        filePath: alert.generated_fix.file_path,
        category: alert.category,
      });

      // Create PR using GitService
      const result = await GitService.createFixPullRequest({
        issue: {
          id: alert.id,
          category: alert.category,
          severity: alert.severity,
          description: alert.description,
          affectedResources: [alert.generated_fix.file_path],
        },
        action: {
          id: `fix-${alert.id}`,
          strategy: 'auto_fix',
          description: `Guardian Agent auto-fix for ${alert.category}`,
        },
        changes: [
          {
            filePath: alert.generated_fix.file_path,
            oldContent: alert.generated_fix.original_code,
            newContent: alert.generated_fix.fixed_code,
            operation: 'update',
          },
        ],
        reviewers,
      });

      if (!result.success) {
        await auditLogger.error('GUARDIAN_PR_CREATION_FAILED', new Error(result.error || 'Unknown error'), {
          alertId,
          userId,
        });

        return {
          success: false,
          message: result.message,
          error: result.error,
        };
      }

      // Update alert status to reflect PR was created
      await supabase
        .from('guardian_alerts')
        .update({
          status: 'reviewing',
          resolution_notes: `Pull request created: ${result.prUrl}`,
          acknowledged_by: userId,
          acknowledged_at: new Date().toISOString(),
          metadata: {
            pr_url: result.prUrl,
            pr_number: result.prNumber,
            pr_created_at: new Date().toISOString(),
            pr_created_by: userId,
          },
        })
        .eq('id', alertId);

      await auditLogger.security('GUARDIAN_PR_CREATED', 'medium', {
        alertId,
        userId,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        branchName: result.branchName,
        commitSha: result.commitSha,
      });

      return {
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        message: `Pull request created successfully: ${result.prUrl}`,
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_APPROVE_FIX_FAILED', error instanceof Error ? error : new Error(String(error)), {
        alertId,
        userId,
      });

      return {
        success: false,
        message: 'Failed to create pull request',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get severity emoji
   */
  private static getSeverityEmoji(severity: AlertSeverity): string {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
      emergency: '🆘',
    };
    return emojis[severity];
  }

  /**
   * Subscribe to real-time alerts
   */
  static subscribeToAlerts(callback: (alert: GuardianAlert) => void): () => void {
    const channel = supabase
      .channel('guardian-alerts')
      .on('broadcast', { event: 'new_alert' }, (payload) => {
        callback(payload.payload.alert);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }
}
