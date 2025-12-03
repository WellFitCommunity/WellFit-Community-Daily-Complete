/**
 * SOC Dashboard Types
 *
 * Type definitions for the Security Operations Center dashboard
 * including alerts, messages, presence, and notifications.
 */

// ============================================================================
// Alert Types
// ============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'new' | 'investigating' | 'resolved' | 'false_positive' | 'escalated';

export interface SecurityAlert {
  id: string;
  severity: AlertSeverity;
  alert_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  status: AlertStatus;
  created_at: string;
  updated_at: string;

  // Assignment
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;

  // Escalation
  escalated: boolean;
  escalated_at: string | null;
  escalation_level: number;

  // Notification
  notification_sent: boolean;
  notification_channels: string[];
  notification_sent_at: string | null;

  // Affected user
  affected_user_id: string | null;

  // Detection
  source_ip: string | null;
  detection_method: string | null;
  confidence_score: number | null;
  threshold_value: number | null;
  actual_value: number | null;

  // Resolution
  resolution_time: string | null;
  resolution_notes: string | null;

  // Joined data (from view or query)
  affected_user_email?: string;
  assigned_user_name?: string;
  minutes_since_created?: number;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType = 'comment' | 'action' | 'system' | 'escalation';

export interface AlertMessage {
  id: string;
  alert_id: string;
  message_type: MessageType;
  content: string;
  author_id: string;
  author_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  edited: boolean;
}

export interface NewAlertMessage {
  alert_id: string;
  content: string;
  message_type?: MessageType;
}

// ============================================================================
// Presence Types
// ============================================================================

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface SOCPresence {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  status: PresenceStatus;
  last_seen_at: string;
  session_started_at: string;
  current_alert_id: string | null;
  user_agent: string | null;
}

// ============================================================================
// Notification Preferences
// ============================================================================

export interface SOCNotificationPreferences {
  id: string;
  user_id: string;

  // Sound
  sound_enabled: boolean;
  sound_critical: string;
  sound_high: string;
  sound_medium: string;
  sound_low: string;

  // Browser notifications
  browser_notifications_enabled: boolean;
  notify_on_critical: boolean;
  notify_on_high: boolean;
  notify_on_medium: boolean;
  notify_on_low: boolean;
  notify_on_escalation: boolean;
  notify_on_new_message: boolean;

  // Desktop
  desktop_notifications_enabled: boolean;

  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferences {
  sound_enabled?: boolean;
  browser_notifications_enabled?: boolean;
  desktop_notifications_enabled?: boolean;
  notify_on_critical?: boolean;
  notify_on_high?: boolean;
  notify_on_medium?: boolean;
  notify_on_low?: boolean;
  notify_on_escalation?: boolean;
  notify_on_new_message?: boolean;
}

// ============================================================================
// Dashboard Summary
// ============================================================================

export interface SOCDashboardSummary {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  unassigned_count: number;
  escalated_count: number;
  my_assigned_count: number;
  online_operators: number;
  avg_response_minutes: number | null;
}

// ============================================================================
// Realtime Event Types
// ============================================================================

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeAlertEvent {
  eventType: RealtimeEventType;
  new: SecurityAlert | null;
  old: SecurityAlert | null;
}

export interface RealtimeMessageEvent {
  eventType: RealtimeEventType;
  new: AlertMessage | null;
  old: AlertMessage | null;
}

export interface RealtimePresenceEvent {
  eventType: RealtimeEventType;
  new: SOCPresence | null;
  old: SOCPresence | null;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface AlertFilters {
  severity?: AlertSeverity[];
  status?: AlertStatus[];
  assigned_to?: string | 'unassigned' | 'me';
  escalated?: boolean;
  search?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Sound Types
// ============================================================================

export type SoundType = 'alarm' | 'alert' | 'notification' | 'soft' | 'none';

export const SOUND_FILES: Record<SoundType, string> = {
  alarm: '/sounds/alarm.mp3',
  alert: '/sounds/alert.mp3',
  notification: '/sounds/notification.mp3',
  soft: '/sounds/soft.mp3',
  none: '',
};

// ============================================================================
// Severity Config
// ============================================================================

export const SEVERITY_CONFIG: Record<AlertSeverity, {
  color: string;
  bgColor: string;
  icon: string;
  label: string;
  priority: number;
}> = {
  critical: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    icon: '🔴',
    label: 'Critical',
    priority: 1,
  },
  high: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    icon: '🟠',
    label: 'High',
    priority: 2,
  },
  medium: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    icon: '🟡',
    label: 'Medium',
    priority: 3,
  },
  low: {
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    icon: '🟢',
    label: 'Low',
    priority: 4,
  },
};

export const STATUS_CONFIG: Record<AlertStatus, {
  color: string;
  bgColor: string;
  label: string;
}> = {
  new: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'New',
  },
  investigating: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    label: 'Investigating',
  },
  resolved: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    label: 'Resolved',
  },
  false_positive: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    label: 'False Positive',
  },
  escalated: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Escalated',
  },
};
