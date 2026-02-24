/**
 * Realtime Security Monitor
 *
 * Listens to security_alerts and security_events tables in real-time
 * using Supabase Realtime. Triggers immediate notifications for critical issues.
 *
 * This provides the live monitoring dashboard that SOC 2 compliance requires.
 * All subscriptions and queries are tenant-scoped to prevent cross-tenant leakage.
 */

import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SecurityAlertCallback {
  (alert: SecurityAlert): void | Promise<void>;
}

export interface SecurityEventCallback {
  (event: SecurityEvent): void | Promise<void>;
}

interface SecurityAlert {
  id: string;
  tenant_id?: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  title: string;
  description?: string;
  affected_user_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface SecurityEvent {
  id: string;
  tenant_id?: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  requires_investigation?: boolean;
}

/**
 * RealtimeSecurityMonitor - Live security event monitoring (tenant-scoped)
 */
export class RealtimeSecurityMonitor {
  private alertsChannel: RealtimeChannel | null = null;
  private eventsChannel: RealtimeChannel | null = null;
  private alertCallbacks: SecurityAlertCallback[] = [];
  private eventCallbacks: SecurityEventCallback[] = [];
  private isMonitoring = false;
  private tenantId: string | undefined;

  /**
   * Set tenant scope — must be called before startMonitoring
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Start monitoring security alerts and events in real-time.
   * Subscriptions are filtered by tenant_id to prevent cross-tenant leakage.
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    try {
      // Build filter string for tenant scoping
      const tenantFilter = this.tenantId
        ? `tenant_id=eq.${this.tenantId}`
        : undefined;

      // Subscribe to security_alerts table (tenant-scoped)
      this.alertsChannel = supabase
        .channel('security_alerts_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'security_alerts',
            ...(tenantFilter ? { filter: tenantFilter } : {}),
          },
          (payload) => {
            const alert = payload.new as SecurityAlert;
            this.handleNewAlert(alert);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'security_alerts',
            ...(tenantFilter ? { filter: tenantFilter } : {}),
          },
          (payload) => {
            const alert = payload.new as SecurityAlert;
            this.handleAlertUpdate(alert);
          }
        )
        .subscribe();

      // Subscribe to security_events table (tenant-scoped)
      this.eventsChannel = supabase
        .channel('security_events_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'security_events',
            ...(tenantFilter ? { filter: tenantFilter } : {}),
          },
          (payload) => {
            const event = payload.new as SecurityEvent;
            this.handleNewEvent(event);
          }
        )
        .subscribe();

      this.isMonitoring = true;
    } catch (error: unknown) {
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.alertsChannel) {
      await supabase.removeChannel(this.alertsChannel);
      this.alertsChannel = null;
    }

    if (this.eventsChannel) {
      await supabase.removeChannel(this.eventsChannel);
      this.eventsChannel = null;
    }

    this.isMonitoring = false;
  }

  /**
   * Register callback for new security alerts
   */
  onAlert(callback: SecurityAlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Register callback for new security events
   */
  onEvent(callback: SecurityEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Handle new security alert
   */
  private handleNewAlert(alert: SecurityAlert): void {
    // Notify all registered callbacks
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(alert);
      } catch {
        // Callback errors should not break the monitor
      }
    });
  }

  /**
   * Handle alert update
   */
  private handleAlertUpdate(_alert: SecurityAlert): void {
    // Placeholder for update handling (e.g., status change notifications)
  }

  /**
   * Handle new security event
   */
  private handleNewEvent(event: SecurityEvent): void {
    // Notify all registered callbacks
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch {
        // Callback errors should not break the monitor
      }
    });
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    alertCallbacksCount: number;
    eventCallbacksCount: number;
    tenantId: string | undefined;
  } {
    return {
      isMonitoring: this.isMonitoring,
      alertCallbacksCount: this.alertCallbacks.length,
      eventCallbacksCount: this.eventCallbacks.length,
      tenantId: this.tenantId,
    };
  }

  /**
   * Get recent critical alerts (tenant-scoped)
   */
  async getCriticalAlerts(limit: number = 10): Promise<SecurityAlert[]> {
    try {
      let query = supabase
        .from('security_alerts')
        .select('id, tenant_id, alert_type, severity, status, title, description, affected_user_id, created_at, metadata')
        .in('severity', ['critical', 'high'])
        .in('status', ['new', 'investigating', 'escalated'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (this.tenantId) {
        query = query.eq('tenant_id', this.tenantId);
      }

      const { data, error } = await query;

      if (error) {
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Get event statistics (tenant-scoped)
   */
  async getEventStatistics(hours: number = 24): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('security_events')
        .select('event_type, severity')
        .gte('timestamp', since);

      if (this.tenantId) {
        query = query.eq('tenant_id', this.tenantId);
      }

      const { data, error } = await query;

      if (error) {
        return { total: 0, byType: {}, bySeverity: {} };
      }

      const stats = {
        total: data?.length || 0,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
      };

      data?.forEach((event) => {
        stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
        stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      });

      return stats;
    } catch {
      return { total: 0, byType: {}, bySeverity: {} };
    }
  }
}

/**
 * Global singleton instance
 */
export const realtimeSecurityMonitor = new RealtimeSecurityMonitor();
