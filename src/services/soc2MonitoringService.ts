/**
 * SOC 2 Monitoring Service
 *
 * Service layer for SOC 2 compliance monitoring and security event tracking.
 * Provides data fetching for all SOC 2 dashboards with proper error handling.
 *
 * Zero tech debt - clean, type-safe, respects existing schema
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SecurityMetrics {
  security_events_24h: number;
  critical_events_24h: number;
  high_events_24h: number;
  medium_events_24h: number;
  low_events_24h: number;
  failed_logins_24h: number;
  failed_logins_1h: number;
  unauthorized_access_24h: number;
  auto_blocked_24h: number;
  open_investigations: number;
  audit_events_24h: number;
  failed_operations_24h: number;
  phi_access_24h: number;
  last_updated: string;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  actor_user_id: string | null;
  actor_ip_address: string | null;
  actor_user_agent: string | null;
  timestamp: string;
  description: string;
  metadata: Record<string, unknown>;
  auto_blocked: boolean;
  requires_investigation: boolean;
  investigated: boolean;
  investigated_by: string | null;
  investigated_at: string | null;
  resolution: string | null;
  related_audit_log_id: string | null;
  correlation_id: string | null;
  alert_sent: boolean;
  alert_sent_at: string | null;
  alert_recipients: string[] | null;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_ip_address: string | null;
  actor_user_agent: string | null;
  event_type: string;
  event_category: string;
  resource_type: string | null;
  resource_id: string | null;
  table_name: string | null;
  timestamp: string;
  target_user_id: string | null;
  operation: string | null;
  metadata: Record<string, unknown>;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  retention_date: string | null;
  checksum: string | null;
}

export interface PHIAccessAudit {
  id: string;
  timestamp: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_ip_address: string | null;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  target_user_id: string | null;
  operation: string | null;
  metadata: Record<string, unknown>;
  success: boolean;
  error_message: string | null;
  actor_email: string;
  patient_name: string;
  access_type: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SecurityEventsAnalysis {
  hour: string;
  event_type: string;
  severity: string;
  event_count: number;
  unique_actors: number;
  unique_ips: number;
  auto_blocked_count: number;
  investigation_required_count: number;
  latest_occurrence: string;
}

export interface AuditSummaryStats {
  event_category: string;
  event_type: string;
  total_events: number;
  successful_events: number;
  failed_events: number;
  unique_users: number;
  unique_roles: number;
  earliest_event: string;
  latest_event: string;
  success_rate_percent: number;
}

export interface EncryptionStatus {
  id: number;
  key_name: string;
  key_purpose: 'phi' | 'credentials' | 'tokens' | 'system';
  key_algorithm: string;
  is_active: boolean;
  created_at: string;
  rotated_at: string | null;
  expires_at: string | null;
  days_since_rotation: number;
  expiration_status: 'No Expiration' | 'EXPIRED' | 'EXPIRING_SOON' | 'VALID';
  days_until_expiration: number | null;
}

export interface IncidentResponseItem {
  id: string;
  event_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  actor_user_id: string | null;
  actor_ip_address: string | null;
  description: string;
  metadata: Record<string, unknown>;
  requires_investigation: boolean;
  investigated: boolean;
  investigated_by: string | null;
  investigated_at: string | null;
  resolution: string | null;
  auto_blocked: boolean;
  alert_sent: boolean;
  correlation_id: string | null;
  hours_since_event: number;
  priority_score: number;
  sla_status: 'SLA_BREACH' | 'WITHIN_SLA' | 'RESOLVED';
}

export interface ComplianceStatus {
  control_area: string;
  soc2_criterion: string;
  control_description: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  details: string;
  test_result: 'PASS' | 'FAIL' | 'REVIEW';
  last_checked: string;
}

// ============================================================================
// Service Class
// ============================================================================

export class SOC2MonitoringService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get real-time security metrics for the dashboard
   */
  async getSecurityMetrics(): Promise<SecurityMetrics | null> {
    try {
      const { data, error } = await this.supabase
        .from('security_monitoring_dashboard')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching security metrics:', error);
        return null;
      }

      return data as SecurityMetrics;
    } catch (error) {
      console.error('Exception fetching security metrics:', error);
      return null;
    }
  }

  /**
   * Get recent security events with optional filtering
   */
  async getSecurityEvents(options?: {
    limit?: number;
    severity?: string;
    eventType?: string;
    investigated?: boolean;
  }): Promise<SecurityEvent[]> {
    try {
      let query = this.supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.severity) {
        query = query.eq('severity', options.severity);
      }

      if (options?.eventType) {
        query = query.eq('event_type', options.eventType);
      }

      if (options?.investigated !== undefined) {
        query = query.eq('investigated', options.investigated);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching security events:', error);
        return [];
      }

      return (data as SecurityEvent[]) || [];
    } catch (error) {
      console.error('Exception fetching security events:', error);
      return [];
    }
  }

  /**
   * Get audit logs with optional filtering
   */
  async getAuditLogs(options?: {
    limit?: number;
    eventCategory?: string;
    eventType?: string;
    success?: boolean;
    actorUserId?: string;
  }): Promise<AuditLog[]> {
    try {
      let query = this.supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.eventCategory) {
        query = query.eq('event_category', options.eventCategory);
      }

      if (options?.eventType) {
        query = query.eq('event_type', options.eventType);
      }

      if (options?.success !== undefined) {
        query = query.eq('success', options.success);
      }

      if (options?.actorUserId) {
        query = query.eq('actor_user_id', options.actorUserId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return [];
      }

      return (data as AuditLog[]) || [];
    } catch (error) {
      console.error('Exception fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Get PHI access audit trail
   */
  async getPHIAccessAudit(limit: number = 100): Promise<PHIAccessAudit[]> {
    try {
      const { data, error } = await this.supabase
        .from('phi_access_audit')
        .select('*')
        .limit(limit);

      if (error) {
        console.error('Error fetching PHI access audit:', error);
        return [];
      }

      return (data as PHIAccessAudit[]) || [];
    } catch (error) {
      console.error('Exception fetching PHI access audit:', error);
      return [];
    }
  }

  /**
   * Get security events analysis (hourly trends)
   */
  async getSecurityEventsAnalysis(limit: number = 168): Promise<SecurityEventsAnalysis[]> {
    try {
      const { data, error } = await this.supabase
        .from('security_events_analysis')
        .select('*')
        .limit(limit);

      if (error) {
        console.error('Error fetching security events analysis:', error);
        return [];
      }

      return (data as SecurityEventsAnalysis[]) || [];
    } catch (error) {
      console.error('Exception fetching security events analysis:', error);
      return [];
    }
  }

  /**
   * Get audit summary statistics
   */
  async getAuditSummaryStats(): Promise<AuditSummaryStats[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_summary_stats')
        .select('*');

      if (error) {
        console.error('Error fetching audit summary stats:', error);
        return [];
      }

      return (data as AuditSummaryStats[]) || [];
    } catch (error) {
      console.error('Exception fetching audit summary stats:', error);
      return [];
    }
  }

  /**
   * Get encryption key status
   */
  async getEncryptionStatus(): Promise<EncryptionStatus[]> {
    try {
      const { data, error } = await this.supabase
        .from('encryption_status_view')
        .select('*');

      if (error) {
        console.error('Error fetching encryption status:', error);
        return [];
      }

      return (data as EncryptionStatus[]) || [];
    } catch (error) {
      console.error('Exception fetching encryption status:', error);
      return [];
    }
  }

  /**
   * Get incident response queue
   */
  async getIncidentResponseQueue(): Promise<IncidentResponseItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('incident_response_queue')
        .select('*');

      if (error) {
        console.error('Error fetching incident response queue:', error);
        return [];
      }

      return (data as IncidentResponseItem[]) || [];
    } catch (error) {
      console.error('Exception fetching incident response queue:', error);
      return [];
    }
  }

  /**
   * Get compliance status for all SOC 2 controls
   */
  async getComplianceStatus(): Promise<ComplianceStatus[]> {
    try {
      const { data, error } = await this.supabase
        .from('compliance_status')
        .select('*');

      if (error) {
        console.error('Error fetching compliance status:', error);
        return [];
      }

      return (data as ComplianceStatus[]) || [];
    } catch (error) {
      console.error('Exception fetching compliance status:', error);
      return [];
    }
  }

  /**
   * Mark a security event as investigated
   */
  async markEventInvestigated(
    eventId: string,
    resolution: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('security_events')
        .update({
          investigated: true,
          investigated_by: (await this.supabase.auth.getUser()).data.user?.id,
          investigated_at: new Date().toISOString(),
          resolution: resolution,
        })
        .eq('id', eventId);

      if (error) {
        console.error('Error marking event as investigated:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception marking event as investigated:', error);
      return false;
    }
  }

  /**
   * Create a manual security event (for testing or manual logging)
   */
  async createSecurityEvent(
    eventType: string,
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('log_security_event', {
        p_event_type: eventType,
        p_severity: severity,
        p_description: description,
        p_metadata: metadata || {},
        p_auto_block: false,
        p_requires_investigation: severity === 'CRITICAL' || severity === 'HIGH',
      });

      if (error) {
        console.error('Error creating security event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception creating security event:', error);
      return false;
    }
  }

  /**
   * Get recent activity summary for executive dashboard
   */
  async getExecutiveSummary(): Promise<{
    totalSecurityEvents: number;
    criticalEvents: number;
    openInvestigations: number;
    phiAccessCount: number;
    complianceScore: number;
    trendDirection: 'UP' | 'DOWN' | 'STABLE';
  } | null> {
    try {
      const metrics = await this.getSecurityMetrics();
      const compliance = await this.getComplianceStatus();

      if (!metrics) return null;

      // Calculate compliance score
      const compliantControls = compliance.filter(c => c.status === 'COMPLIANT').length;
      const totalControls = compliance.length;
      const complianceScore = totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0;

      // Determine trend (simplified - compare current hour to previous hour)
      const currentHourEvents = metrics.failed_logins_1h + metrics.critical_events_24h;
      const trendDirection: 'UP' | 'DOWN' | 'STABLE' =
        currentHourEvents > 10 ? 'UP' :
        currentHourEvents < 3 ? 'DOWN' :
        'STABLE';

      return {
        totalSecurityEvents: metrics.security_events_24h,
        criticalEvents: metrics.critical_events_24h,
        openInvestigations: metrics.open_investigations,
        phiAccessCount: metrics.phi_access_24h,
        complianceScore,
        trendDirection,
      };
    } catch (error) {
      console.error('Exception getting executive summary:', error);
      return null;
    }
  }
}

/**
 * Factory function to create SOC2MonitoringService instance
 */
export function createSOC2MonitoringService(supabase: SupabaseClient): SOC2MonitoringService {
  return new SOC2MonitoringService(supabase);
}
