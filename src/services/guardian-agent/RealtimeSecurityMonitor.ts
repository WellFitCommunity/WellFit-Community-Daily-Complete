/**
 * Realtime Security Monitor
 *
 * Listens to security_alerts and security_events tables in real-time
 * using Supabase Realtime. Triggers immediate notifications for critical issues.
 *
 * This provides the live monitoring dashboard that SOC 2 compliance requires.
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
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  title: string;
  description?: string;
  affected_user_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
  requires_investigation?: boolean;
}

/**
 * RealtimeSecurityMonitor - Live security event monitoring
 */
export class RealtimeSecurityMonitor {
  private alertsChannel: RealtimeChannel | null = null;
  private eventsChannel: RealtimeChannel | null = null;
  private alertCallbacks: SecurityAlertCallback[] = [];
  private eventCallbacks: SecurityEventCallback[] = [];
  private isMonitoring = false;

  /**
   * Start monitoring security alerts and events in real-time
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      // console.warn('[RealtimeSecurityMonitor] Already monitoring');
      return;
    }

    try {
      // Subscribe to security_alerts table
      this.alertsChannel = supabase
        .channel('security_alerts_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'security_alerts',
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
          },
          (payload) => {
            const alert = payload.new as SecurityAlert;
            this.handleAlertUpdate(alert);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // console.log('[RealtimeSecurityMonitor] ✅ Subscribed to security_alerts');
          }
        });

      // Subscribe to security_events table
      this.eventsChannel = supabase
        .channel('security_events_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'security_events',
          },
          (payload) => {
            const event = payload.new as SecurityEvent;
            this.handleNewEvent(event);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // console.log('[RealtimeSecurityMonitor] ✅ Subscribed to security_events');
          }
        });

      this.isMonitoring = true;
      // console.log('[RealtimeSecurityMonitor] 🚀 Real-time monitoring started');
    } catch (error) {
      // console.error('[RealtimeSecurityMonitor] Failed to start monitoring:', error);
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
    // console.log('[RealtimeSecurityMonitor] Monitoring stopped');
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
    // console.log(`[RealtimeSecurityMonitor] 🚨 NEW ALERT: ${alert.severity.toUpperCase()} - ${alert.title}`);

    // Log to console for visibility
    if (alert.severity === 'critical' || alert.severity === 'high') {
      // Logging removed - use audit system instead
    }

    // Notify all registered callbacks
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        // console.error('[RealtimeSecurityMonitor] Alert callback error:', error);
      }
    });
  }

  /**
   * Handle alert update
   */
  private handleAlertUpdate(alert: SecurityAlert): void {
    // console.log(`[RealtimeSecurityMonitor] 🔄 ALERT UPDATE: ${alert.title} - Status: ${alert.status}`);
  }

  /**
   * Handle new security event
   */
  private handleNewEvent(event: SecurityEvent): void {
    // Only log high-priority events to avoid noise
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL' || event.requires_investigation) {
      // Logging removed - use audit system instead
    }

    // Notify all registered callbacks
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        // console.error('[RealtimeSecurityMonitor] Event callback error:', error);
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
  } {
    return {
      isMonitoring: this.isMonitoring,
      alertCallbacksCount: this.alertCallbacks.length,
      eventCallbacksCount: this.eventCallbacks.length,
    };
  }

  /**
   * Get recent critical alerts
   */
  async getCriticalAlerts(limit: number = 10): Promise<SecurityAlert[]> {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .in('severity', ['critical', 'high'])
        .in('status', ['new', 'investigating', 'escalated'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // console.error('[RealtimeSecurityMonitor] Failed to fetch critical alerts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      // console.error('[RealtimeSecurityMonitor] Exception fetching critical alerts:', error);
      return [];
    }
  }

  /**
   * Get event statistics
   */
  async getEventStatistics(hours: number = 24): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('security_events')
        .select('event_type, severity')
        .gte('timestamp', since);

      if (error) {
        // console.error('[RealtimeSecurityMonitor] Failed to fetch statistics:', error);
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
    } catch (error) {
      // console.error('[RealtimeSecurityMonitor] Exception fetching statistics:', error);
      return { total: 0, byType: {}, bySeverity: {} };
    }
  }
}

/**
 * Global singleton instance
 */
export const realtimeSecurityMonitor = new RealtimeSecurityMonitor();

/**
 * Example usage:
 *
 * // Start monitoring
 * await realtimeSecurityMonitor.startMonitoring();
 *
 * // Register callback for critical alerts
 * realtimeSecurityMonitor.onAlert((alert) => {
 *   if (alert.severity === 'critical') {
 *     // Send email, SMS, Slack notification
 *     sendCriticalAlertNotification(alert);
 *   }
 * });
 *
 * // Get current critical alerts
 * const criticalAlerts = await realtimeSecurityMonitor.getCriticalAlerts();
 */
