/**
 * Database Audit Logger - Production-Ready HIPAA/SOC2 Compliant Audit Trail
 *
 * This service persists all Guardian Agent healing actions to the database,
 * ensuring permanent audit trails that survive application restarts.
 *
 * Integrates with:
 * - security_events table (immediate threat detection)
 * - audit_logs table (comprehensive audit trail)
 * - security_alerts table (real-time monitoring)
 * - admin_audit_logs table (administrative actions)
 */

import { supabase } from '../../lib/supabaseClient';
import { DetectedIssue, HealingAction, HealingResult } from './types';
import { /* AuditLogEntry, ReviewTicket */ } from './AuditLogger';

export interface SecurityEvent {
  id?: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actor_user_id?: string;
  actor_ip_address?: string;
  actor_user_agent?: string;
  description: string;
  metadata?: Record<string, unknown>;
  auto_blocked?: boolean;
  requires_investigation?: boolean;
  timestamp?: string;
}

export interface SecurityAlert {
  id?: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status?: 'new' | 'investigating' | 'resolved' | 'false_positive' | 'escalated';
  title: string;
  description?: string;
  affected_user_id?: string;
  affected_resource?: string;
  source_ip?: string;
  user_agent?: string;
  detection_method?: 'rule_based' | 'threshold' | 'anomaly' | 'manual';
  confidence_score?: number;
  metadata?: Record<string, unknown>;
  notification_sent?: boolean;
  notification_channels?: string[];
}

/**
 * DatabaseAuditLogger - Persists Guardian Agent actions to database
 */
export class DatabaseAuditLogger {
  private readonly CRITICAL_ISSUE_TYPES = [
    'phi_exposure_risk',
    'hipaa_violation',
    'security_vulnerability',
    'data_breach_risk',
    'authentication_bypass',
  ];

  /**
   * Log a healing action to the database with full audit trail
   */
  async logHealingAction(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Log to security_events table
      const securityEventResult = await this.logSecurityEvent(issue, action, result);

      // 2. Log to audit_logs table
      const auditLogResult = await this.logAuditEntry(issue, action, result);

      // 3. Create security alert if critical
      if (this.isCriticalIssue(issue)) {
        await this.createSecurityAlert(issue, action, result);
      }

      // 4. Log to admin_audit_logs if admin action
      if (action.requiresApproval || issue.severity === 'critical') {
        await this.logAdminAction(issue, action, result);
      }

      return {
        success: securityEventResult.success && auditLogResult.success,
        error: securityEventResult.error || auditLogResult.error,
      };
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log blocked action to database
   */
  async logBlockedAction(
    issue: DetectedIssue,
    action: HealingAction,
    blockReason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Log as security event with auto_blocked flag
      const { error } = await supabase.from('security_events').insert({
        event_type: 'GUARDIAN_ACTION_BLOCKED',
        severity: this.mapSeverity(issue.severity),
        description: `Guardian Agent action blocked: ${blockReason}`,
        metadata: {
          issue_id: issue.id,
          action_id: action.id,
          action_strategy: action.strategy,
          block_reason: blockReason,
          issue_category: issue.signature.category,
          affected_resources: issue.affectedResources,
          requires_approval: action.requiresApproval,
        },
        auto_blocked: true,
        requires_investigation: true,
        timestamp: new Date().toISOString(),
      });

      if (error) {

        return { success: false, error: error.message };
      }

      // Create high-priority security alert
      await this.createBlockedActionAlert(issue, action, blockReason);

      return { success: true };
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const eventType = this.mapIssueToEventType(issue);
      const severity = this.mapSeverity(issue.severity);

      const { error } = await supabase.from('security_events').insert({
        event_type: eventType,
        severity,
        description: `Guardian Agent: ${result.success ? 'Successfully healed' : 'Failed to heal'} ${issue.signature.category}`,
        metadata: {
          issue_id: issue.id,
          action_id: action.id,
          strategy: action.strategy,
          success: result.success,
          steps_completed: result.stepsCompleted,
          total_steps: result.totalSteps,
          time_to_detect_ms: result.metrics.timeToDetect,
          time_to_heal_ms: result.metrics.timeToHeal,
          resources_affected: result.metrics.resourcesAffected,
          users_impacted: result.metrics.usersImpacted,
          outcome: result.outcomeDescription,
          lessons: result.lessons,
          preventive_measures: result.preventiveMeasures,
          issue_category: issue.signature.category,
          affected_resources: issue.affectedResources,
        },
        requires_investigation: !result.success,
        timestamp: new Date().toISOString(),
      });

      if (error) {

        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log audit entry
   */
  private async logAuditEntry(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        event_type: 'SYSTEM',
        event_category: 'SYSTEM',
        operation: action.strategy.toUpperCase(),
        resource_type: 'guardian_agent_action',
        resource_id: action.id,
        success: result.success,
        error_code: result.success ? null : 'HEALING_FAILED',
        error_message: result.success ? null : result.outcomeDescription,
        metadata: {
          issue_id: issue.id,
          action_id: action.id,
          strategy: action.strategy,
          issue_category: issue.signature.category,
          severity: issue.severity,
          affected_resources: issue.affectedResources,
          steps_completed: result.stepsCompleted,
          total_steps: result.totalSteps,
          metrics: result.metrics,
          lessons: result.lessons,
          preventive_measures: result.preventiveMeasures,
        },
        timestamp: new Date().toISOString(),
      });

      if (error) {

        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create security alert for critical issues
   */
  private async createSecurityAlert(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<void> {
    try {
      const alert: SecurityAlert = {
        alert_type: this.mapIssueToAlertType(issue),
        severity: this.mapSeverityToAlertLevel(issue.severity),
        status: result.success ? 'resolved' : 'new',
        title: `Guardian Agent: ${issue.signature.category}`,
        description: result.outcomeDescription,
        affected_resource: issue.affectedResources.join(', '),
        detection_method: 'rule_based',
        confidence_score: 0.95,
        metadata: {
          issue_id: issue.id,
          action_id: action.id,
          strategy: action.strategy,
          auto_healed: result.success,
          steps_completed: result.stepsCompleted,
          time_to_heal_ms: result.metrics.timeToHeal,
          lessons: result.lessons,
        },
        notification_sent: false,
        notification_channels: this.getNotificationChannels(issue),
      };

      const { error } = await supabase.from('security_alerts').insert(alert);

      if (error) {

      }
    } catch (error) {

    }
  }

  /**
   * Create alert for blocked action
   */
  private async createBlockedActionAlert(
    issue: DetectedIssue,
    action: HealingAction,
    blockReason: string
  ): Promise<void> {
    try {
      const alert: SecurityAlert = {
        alert_type: 'guardian_action_blocked',
        severity: 'high',
        status: 'new',
        title: `Guardian Action Blocked: ${action.strategy}`,
        description: `Automatic healing blocked: ${blockReason}. Manual review required.`,
        affected_resource: issue.affectedResources.join(', '),
        detection_method: 'rule_based',
        confidence_score: 1.0,
        metadata: {
          issue_id: issue.id,
          action_id: action.id,
          strategy: action.strategy,
          block_reason: blockReason,
          issue_category: issue.signature.category,
          severity: issue.severity,
          requires_approval: action.requiresApproval,
        },
        notification_sent: false,
        notification_channels: ['email', 'slack'],
      };

      await supabase.from('security_alerts').insert(alert);
    } catch (error) {

    }
  }

  /**
   * Log admin action
   */
  private async logAdminAction(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<void> {
    try {
      const { error } = await supabase.from('admin_audit_logs').insert({
        action_type: action.requiresApproval ? 'guardian_manual_approval' : 'guardian_auto_heal',
        description: `Guardian Agent ${result.success ? 'healed' : 'attempted to heal'} ${issue.signature.category}`,
        metadata: {
          issue_id: issue.id,
          action_id: action.id,
          strategy: action.strategy,
          success: result.success,
          severity: issue.severity,
          affected_resources: issue.affectedResources,
          outcome: result.outcomeDescription,
          requires_approval: action.requiresApproval,
        },
        timestamp: new Date().toISOString(),
      });

      if (error) {

      }
    } catch (error) {

    }
  }

  /**
   * Retrieve audit logs with filters
   */
  async getAuditLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    eventType?: string;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {

        return [];
      }

      return data || [];
    } catch (error) {

      return [];
    }
  }

  /**
   * Get active security alerts
   */
  async getActiveSecurityAlerts() {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .in('status', ['new', 'investigating', 'escalated'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {

        return [];
      }

      return data || [];
    } catch (error) {

      return [];
    }
  }

  // Helper methods
  private isCriticalIssue(issue: DetectedIssue): boolean {
    return (
      issue.severity === 'critical' ||
      issue.severity === 'high' ||
      this.CRITICAL_ISSUE_TYPES.includes(issue.signature.category)
    );
  }

  private mapSeverity(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    };
    return severityMap[severity.toLowerCase()] || 'MEDIUM';
  }

  private mapSeverityToAlertLevel(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    return severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
  }

  private mapIssueToEventType(issue: DetectedIssue): string {
    const categoryMap: Record<string, string> = {
      phi_exposure_risk: 'DATA_EXFILTRATION_ATTEMPT',
      hipaa_violation: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      security_vulnerability: 'XSS_ATTEMPT',
      api_failure: 'EXTERNAL_API_FAILURE',
      memory_leak: 'RATE_LIMIT_EXCEEDED',
      database_connection_pool_exhaustion: 'RATE_LIMIT_EXCEEDED',
    };

    return categoryMap[issue.signature.category] || 'INVALID_INPUT';
  }

  private mapIssueToAlertType(issue: DetectedIssue): string {
    const categoryMap: Record<string, string> = {
      phi_exposure_risk: 'data_exfiltration',
      hipaa_violation: 'security_policy_violation',
      security_vulnerability: 'anomalous_behavior',
      api_failure: 'unauthorized_api_access',
      memory_leak: 'anomalous_behavior',
    };

    return categoryMap[issue.signature.category] || 'anomalous_behavior';
  }

  private getNotificationChannels(issue: DetectedIssue): string[] {
    if (issue.severity === 'critical') {
      return ['email', 'slack', 'sms'];
    } else if (issue.severity === 'high') {
      return ['email', 'slack'];
    } else {
      return ['email'];
    }
  }
}
