/**
 * SOC Dashboard Service
 *
 * Service for the Security Operations Center dashboard providing:
 * - Real-time alert management
 * - Team collaboration (messages)
 * - Presence tracking
 * - Notification preferences
 *
 * SOC2 Compliance: CC6.1, CC7.2, CC7.3
 */

import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';
import {
  SecurityAlert,
  AlertMessage,
  SOCPresence,
  SOCNotificationPreferences,
  SOCDashboardSummary,
  AlertFilters,
  UpdateNotificationPreferences,
  AlertSeverity,
} from '../types/socDashboard';

// ============================================================================
// Service Class
// ============================================================================

export class SOCDashboardService {
  private supabase: SupabaseClient;
  private alertChannel: RealtimeChannel | null = null;
  private messageChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ==========================================================================
  // Dashboard Summary
  // ==========================================================================

  async getDashboardSummary(): Promise<SOCDashboardSummary | null> {
    try {
      const { data, error } = await this.supabase.rpc('soc_get_dashboard_summary');

      if (error) {
        auditLogger.error('SOC_DASHBOARD_SUMMARY_ERROR', error.message, {});
        return null;
      }

      return data?.[0] || null;
    } catch (err) {
      auditLogger.error('SOC_DASHBOARD_SUMMARY_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
      return null;
    }
  }

  // ==========================================================================
  // Alerts
  // ==========================================================================

  async getAlerts(filters?: AlertFilters): Promise<SecurityAlert[]> {
    try {
      let query = this.supabase
        .from('security_alerts')
        .select(`
          *,
          assigned_user:profiles!security_alerts_assigned_to_fkey(first_name, last_name, email),
          affected_user:profiles!security_alerts_affected_user_id_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.severity?.length) {
        query = query.in('severity', filters.severity);
      }

      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      } else {
        // Default: show active alerts
        query = query.in('status', ['new', 'investigating', 'escalated']);
      }

      if (filters?.escalated !== undefined) {
        query = query.eq('escalated', filters.escalated);
      }

      if (filters?.assigned_to === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filters?.assigned_to === 'me') {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
          query = query.eq('assigned_to', user.id);
        }
      } else if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      if (filters?.date_range) {
        query = query
          .gte('created_at', filters.date_range.start)
          .lte('created_at', filters.date_range.end);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        auditLogger.error('SOC_GET_ALERTS_ERROR', error.message, {});
        return [];
      }

      return data || [];
    } catch (err) {
      auditLogger.error('SOC_GET_ALERTS_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
      return [];
    }
  }

  async getAlertById(alertId: string): Promise<SecurityAlert | null> {
    try {
      const { data, error } = await this.supabase
        .from('security_alerts')
        .select(`
          *,
          assigned_user:profiles!security_alerts_assigned_to_fkey(first_name, last_name, email),
          affected_user:profiles!security_alerts_affected_user_id_fkey(first_name, last_name, email)
        `)
        .eq('id', alertId)
        .single();

      if (error) {
        auditLogger.error('SOC_GET_ALERT_ERROR', error.message, { alertId });
        return null;
      }

      return data;
    } catch (err) {
      auditLogger.error('SOC_GET_ALERT_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return null;
    }
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('acknowledge_security_alert', {
        p_alert_id: alertId,
      });

      if (error) {
        auditLogger.error('SOC_ACKNOWLEDGE_ALERT_ERROR', error.message, { alertId });
        return false;
      }

      return data === true;
    } catch (err) {
      auditLogger.error('SOC_ACKNOWLEDGE_ALERT_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return false;
    }
  }

  async resolveAlert(alertId: string, resolution: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('resolve_security_alert', {
        p_alert_id: alertId,
        p_resolution: resolution,
      });

      if (error) {
        auditLogger.error('SOC_RESOLVE_ALERT_ERROR', error.message, { alertId });
        return false;
      }

      return data === true;
    } catch (err) {
      auditLogger.error('SOC_RESOLVE_ALERT_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return false;
    }
  }

  async assignAlert(alertId: string, assigneeId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('soc_assign_alert', {
        p_alert_id: alertId,
        p_assignee_id: assigneeId,
      });

      if (error) {
        auditLogger.error('SOC_ASSIGN_ALERT_ERROR', error.message, { alertId, assigneeId });
        return false;
      }

      return data === true;
    } catch (err) {
      auditLogger.error('SOC_ASSIGN_ALERT_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return false;
    }
  }

  async markAsFalsePositive(alertId: string, reason: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('security_alerts')
        .update({
          status: 'false_positive',
          resolution_notes: reason,
          resolution_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        auditLogger.error('SOC_FALSE_POSITIVE_ERROR', error.message, { alertId });
        return false;
      }

      // Add system message
      await this.addMessage(alertId, `Marked as false positive: ${reason}`, 'action');

      return true;
    } catch (err) {
      auditLogger.error('SOC_FALSE_POSITIVE_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return false;
    }
  }

  // ==========================================================================
  // Messages
  // ==========================================================================

  async getAlertMessages(alertId: string): Promise<AlertMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('soc_alert_messages')
        .select('*')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: true });

      if (error) {
        auditLogger.error('SOC_GET_MESSAGES_ERROR', error.message, { alertId });
        return [];
      }

      return data || [];
    } catch (err) {
      auditLogger.error('SOC_GET_MESSAGES_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return [];
    }
  }

  async addMessage(alertId: string, content: string, messageType: string = 'comment'): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc('soc_add_alert_message', {
        p_alert_id: alertId,
        p_content: content,
        p_message_type: messageType,
      });

      if (error) {
        auditLogger.error('SOC_ADD_MESSAGE_ERROR', error.message, { alertId });
        return null;
      }

      return data;
    } catch (err) {
      auditLogger.error('SOC_ADD_MESSAGE_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', { alertId });
      return null;
    }
  }

  // ==========================================================================
  // Presence
  // ==========================================================================

  async getOnlineOperators(): Promise<SOCPresence[]> {
    try {
      const { data, error } = await this.supabase
        .from('soc_presence')
        .select('*')
        .neq('status', 'offline')
        .gte('last_seen_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_seen_at', { ascending: false });

      if (error) {
        auditLogger.error('SOC_GET_PRESENCE_ERROR', error.message, {});
        return [];
      }

      return data || [];
    } catch (err) {
      auditLogger.error('SOC_GET_PRESENCE_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
      return [];
    }
  }

  async updatePresence(status: string = 'online', currentAlertId?: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('soc_heartbeat', {
        p_status: status,
        p_current_alert_id: currentAlertId || null,
      });

      if (error) {
        auditLogger.error('SOC_HEARTBEAT_ERROR', error.message, {});
      }
    } catch (err) {
      auditLogger.error('SOC_HEARTBEAT_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
    }
  }

  async goOffline(): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('soc_go_offline');

      if (error) {
        auditLogger.error('SOC_GO_OFFLINE_ERROR', error.message, {});
      }
    } catch (err) {
      auditLogger.error('SOC_GO_OFFLINE_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
    }
  }

  startHeartbeat(currentAlertId?: string): void {
    // Send initial heartbeat
    this.updatePresence('online', currentAlertId);

    // Set up interval (every 30 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.updatePresence('online', currentAlertId);
    }, 30000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.goOffline();
  }

  // ==========================================================================
  // Notification Preferences
  // ==========================================================================

  async getNotificationPreferences(): Promise<SOCNotificationPreferences | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await this.supabase
        .from('soc_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        auditLogger.error('SOC_GET_PREFS_ERROR', error.message, {});
        return null;
      }

      // Return defaults if no preferences exist
      if (!data) {
        return {
          id: '',
          user_id: user.id,
          sound_enabled: true,
          sound_critical: 'alarm',
          sound_high: 'alert',
          sound_medium: 'notification',
          sound_low: 'soft',
          browser_notifications_enabled: true,
          notify_on_critical: true,
          notify_on_high: true,
          notify_on_medium: false,
          notify_on_low: false,
          notify_on_escalation: true,
          notify_on_new_message: true,
          desktop_notifications_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return data;
    } catch (err) {
      auditLogger.error('SOC_GET_PREFS_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
      return null;
    }
  }

  async updateNotificationPreferences(prefs: UpdateNotificationPreferences): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return false;

      const { error } = await this.supabase
        .from('soc_notification_preferences')
        .upsert({
          user_id: user.id,
          ...prefs,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        auditLogger.error('SOC_UPDATE_PREFS_ERROR', error.message, {});
        return false;
      }

      return true;
    } catch (err) {
      auditLogger.error('SOC_UPDATE_PREFS_EXCEPTION', err instanceof Error ? err.message : 'Unknown error', {});
      return false;
    }
  }

  // ==========================================================================
  // Realtime Subscriptions
  // ==========================================================================

  subscribeToAlerts(
    onInsert: (alert: SecurityAlert) => void,
    onUpdate: (alert: SecurityAlert) => void
  ): void {
    this.alertChannel = this.supabase
      .channel('soc-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alerts',
        },
        (payload) => {
          onInsert(payload.new as SecurityAlert);
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
          onUpdate(payload.new as SecurityAlert);
        }
      )
      .subscribe();
  }

  subscribeToMessages(
    alertId: string,
    onMessage: (message: AlertMessage) => void
  ): void {
    this.messageChannel = this.supabase
      .channel(`soc-messages-${alertId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'soc_alert_messages',
          filter: `alert_id=eq.${alertId}`,
        },
        (payload) => {
          onMessage(payload.new as AlertMessage);
        }
      )
      .subscribe();
  }

  subscribeToPresence(
    onPresenceChange: (presence: SOCPresence[]) => void
  ): void {
    this.presenceChannel = this.supabase
      .channel('soc-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'soc_presence',
        },
        async () => {
          // Refresh presence list on any change
          const operators = await this.getOnlineOperators();
          onPresenceChange(operators);
        }
      )
      .subscribe();
  }

  unsubscribeFromAlerts(): void {
    if (this.alertChannel) {
      this.supabase.removeChannel(this.alertChannel);
      this.alertChannel = null;
    }
  }

  unsubscribeFromMessages(): void {
    if (this.messageChannel) {
      this.supabase.removeChannel(this.messageChannel);
      this.messageChannel = null;
    }
  }

  unsubscribeFromPresence(): void {
    if (this.presenceChannel) {
      this.supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
  }

  unsubscribeAll(): void {
    this.unsubscribeFromAlerts();
    this.unsubscribeFromMessages();
    this.unsubscribeFromPresence();
    this.stopHeartbeat();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  shouldNotify(severity: AlertSeverity, prefs: SOCNotificationPreferences): boolean {
    switch (severity) {
      case 'critical':
        return prefs.notify_on_critical;
      case 'high':
        return prefs.notify_on_high;
      case 'medium':
        return prefs.notify_on_medium;
      case 'low':
        return prefs.notify_on_low;
      default:
        return false;
    }
  }

  getSoundForSeverity(severity: AlertSeverity, prefs: SOCNotificationPreferences): string {
    if (!prefs.sound_enabled) return '';

    switch (severity) {
      case 'critical':
        return prefs.sound_critical;
      case 'high':
        return prefs.sound_high;
      case 'medium':
        return prefs.sound_medium;
      case 'low':
        return prefs.sound_low;
      default:
        return 'notification';
    }
  }
}

// ============================================================================
// Singleton Instance Creator
// ============================================================================

let socDashboardServiceInstance: SOCDashboardService | null = null;

export function getSOCDashboardService(supabase: SupabaseClient): SOCDashboardService {
  if (!socDashboardServiceInstance) {
    socDashboardServiceInstance = new SOCDashboardService(supabase);
  }
  return socDashboardServiceInstance;
}

export function resetSOCDashboardService(): void {
  if (socDashboardServiceInstance) {
    socDashboardServiceInstance.unsubscribeAll();
  }
  socDashboardServiceInstance = null;
}
