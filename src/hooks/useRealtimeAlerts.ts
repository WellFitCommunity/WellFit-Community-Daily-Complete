/**
 * Real-Time Clinical Alerts Hook
 * =================================================================================================
 * ATLUS: Leading (Innovation) - Push-based alerts instead of polling
 * =================================================================================================
 *
 * PROBLEM SOLVED:
 * - Legacy systems poll every 5 minutes for alerts
 * - Critical alerts can be delayed up to 5 minutes
 * - Healthcare workers miss time-sensitive notifications
 *
 * SOLUTION:
 * - Supabase Realtime subscription to guardian_alerts table
 * - Instant push when critical/emergency alerts are created
 * - Toast notifications for immediate visibility
 * - Sound alerts for emergency severity
 *
 * USAGE:
 * ```tsx
 * const { recentAlerts, unreadCount, markAsRead, playAlertSound } = useRealtimeAlerts({
 *   onNewAlert: (alert) => showToast(alert),
 *   severityFilter: ['critical', 'emergency'],
 * });
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { useSupabaseClient } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface RealtimeAlert {
  id: string;
  created_at: string;
  severity: AlertSeverity;
  category: string;
  title: string;
  description: string;
  status: 'pending' | 'acknowledged' | 'reviewing' | 'resolved' | 'dismissed';
  patient_id?: string;
  patient_name?: string;
  room_number?: string;
  affected_component?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

export interface UseRealtimeAlertsOptions {
  /** Callback when a new alert arrives */
  onNewAlert?: (alert: RealtimeAlert) => void;

  /** Filter by severity (default: all) */
  severityFilter?: AlertSeverity[];

  /** Filter by category */
  categoryFilter?: string[];

  /** Maximum alerts to keep in memory (default: 50) */
  maxAlerts?: number;

  /** Enable sound for emergency alerts (default: true) */
  enableSound?: boolean;

  /** Component name for logging */
  componentName?: string;
}

export interface UseRealtimeAlertsResult {
  /** Recent alerts (newest first) */
  recentAlerts: RealtimeAlert[];

  /** Count of unread/pending alerts */
  unreadCount: number;

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: Error | null;

  /** Mark an alert as read/acknowledged */
  markAsRead: (alertId: string) => Promise<void>;

  /** Mark all alerts as read */
  markAllAsRead: () => Promise<void>;

  /** Play alert sound manually */
  playAlertSound: (severity: AlertSeverity) => void;

  /** Is realtime connected */
  isConnected: boolean;

  /** Manually refresh alerts */
  refresh: () => Promise<void>;
}

// ============================================================================
// SOUND UTILITIES
// ============================================================================

const ALERT_SOUNDS = {
  emergency: '/sounds/emergency-alert.mp3',
  critical: '/sounds/critical-alert.mp3',
  warning: '/sounds/warning-alert.mp3',
  info: '/sounds/info-alert.mp3',
};

// Simple beep fallback using Web Audio API
const playBeep = (frequency: number, duration: number, volume: number = 0.5) => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = volume;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, duration);
  } catch (err) {
    // Audio not supported - silent fail
    auditLogger.debug('ALERT_SOUND_FAILED', { error: String(err) });
  }
};

const playAlertSoundBySeverity = (severity: AlertSeverity) => {
  // Try to play audio file first
  const audio = new Audio(ALERT_SOUNDS[severity]);
  audio.volume = severity === 'emergency' ? 0.8 : severity === 'critical' ? 0.6 : 0.4;

  audio.play().catch(() => {
    // Fallback to beep
    switch (severity) {
      case 'emergency':
        // Triple high-pitched beep
        playBeep(880, 200, 0.8);
        setTimeout(() => playBeep(880, 200, 0.8), 250);
        setTimeout(() => playBeep(880, 200, 0.8), 500);
        break;
      case 'critical':
        // Double beep
        playBeep(660, 150, 0.6);
        setTimeout(() => playBeep(660, 150, 0.6), 200);
        break;
      case 'warning':
        // Single beep
        playBeep(440, 100, 0.4);
        break;
      case 'info':
        // Soft beep
        playBeep(330, 80, 0.3);
        break;
    }
  });
};

// ============================================================================
// HOOK
// ============================================================================

export function useRealtimeAlerts(
  options: UseRealtimeAlertsOptions = {}
): UseRealtimeAlertsResult {
  const {
    onNewAlert,
    severityFilter,
    categoryFilter,
    maxAlerts = 50,
    enableSound = true,
    componentName = 'RealtimeAlerts',
  } = options;

  const supabase = useSupabaseClient();
  const [recentAlerts, setRecentAlerts] = useState<RealtimeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const processedIds = useRef<Set<string>>(new Set());

  // Build filter for subscription
  const buildFilter = useCallback(() => {
    const filters: string[] = [];

    if (severityFilter && severityFilter.length > 0) {
      filters.push(`severity=in.(${severityFilter.join(',')})`);
    }

    if (categoryFilter && categoryFilter.length > 0) {
      filters.push(`category=in.(${categoryFilter.join(',')})`);
    }

    return filters.length > 0 ? filters.join(',') : undefined;
  }, [severityFilter, categoryFilter]);

  // Initial fetch function
  const fetchAlerts = useCallback(async (): Promise<RealtimeAlert[]> => {
    try {
      let query = supabase
        .from('guardian_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxAlerts);

      if (severityFilter && severityFilter.length > 0) {
        query = query.in('severity', severityFilter);
      }

      if (categoryFilter && categoryFilter.length > 0) {
        query = query.in('category', categoryFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      return (data || []) as RealtimeAlert[];
    } catch (err) {
      auditLogger.error('REALTIME_ALERTS_FETCH_FAILED', err as Error, {
        component: componentName,
      });
      throw err;
    }
  }, [supabase, severityFilter, categoryFilter, maxAlerts, componentName]);

  // Handle new alert from realtime subscription
  const handleNewAlert = useCallback((payload: any) => {
    const newAlert = payload.new as RealtimeAlert;

    // Prevent duplicate processing
    if (processedIds.current.has(newAlert.id)) {
      return;
    }
    processedIds.current.add(newAlert.id);

    // Keep set from growing indefinitely
    if (processedIds.current.size > maxAlerts * 2) {
      const idsArray = Array.from(processedIds.current);
      processedIds.current = new Set(idsArray.slice(-maxAlerts));
    }

    // Check if alert passes filters
    if (severityFilter && severityFilter.length > 0 && !severityFilter.includes(newAlert.severity)) {
      return;
    }
    if (categoryFilter && categoryFilter.length > 0 && !categoryFilter.includes(newAlert.category)) {
      return;
    }

    // Add to recent alerts
    setRecentAlerts(prev => {
      const updated = [newAlert, ...prev.filter(a => a.id !== newAlert.id)];
      return updated.slice(0, maxAlerts);
    });

    // Play sound for critical/emergency
    if (enableSound && (newAlert.severity === 'critical' || newAlert.severity === 'emergency')) {
      playAlertSoundBySeverity(newAlert.severity);
    }

    // Call user callback
    if (onNewAlert) {
      onNewAlert(newAlert);
    }

    // Log alert received
    auditLogger.info('REALTIME_ALERT_RECEIVED', {
      alertId: newAlert.id,
      severity: newAlert.severity,
      category: newAlert.category,
      title: newAlert.title,
    });
  }, [severityFilter, categoryFilter, maxAlerts, enableSound, onNewAlert]);

  // Handle alert update
  const handleAlertUpdate = useCallback((payload: any) => {
    const updatedAlert = payload.new as RealtimeAlert;

    setRecentAlerts(prev =>
      prev.map(a => a.id === updatedAlert.id ? updatedAlert : a)
    );
  }, []);

  // Handle alert delete
  const handleAlertDelete = useCallback((payload: any) => {
    const deletedId = payload.old?.id;
    if (deletedId) {
      setRecentAlerts(prev => prev.filter(a => a.id !== deletedId));
    }
  }, []);

  // Use the realtime subscription hook
  const {
    data,
    loading: subLoading,
    error: subError,
    isSubscribed,
    refresh: subRefresh,
  } = useRealtimeSubscription<RealtimeAlert>({
    table: 'guardian_alerts',
    event: '*',
    filter: buildFilter(),
    componentName,
    initialFetch: fetchAlerts,
    onChange: (payload) => {
      switch (payload.eventType) {
        case 'INSERT':
          handleNewAlert(payload);
          break;
        case 'UPDATE':
          handleAlertUpdate(payload);
          break;
        case 'DELETE':
          handleAlertDelete(payload);
          break;
      }
    },
  });

  // Sync data from subscription
  useEffect(() => {
    if (data) {
      setRecentAlerts(data);
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    setLoading(subLoading);
  }, [subLoading]);

  useEffect(() => {
    setError(subError);
  }, [subError]);

  // Mark alert as read
  const markAsRead = useCallback(async (alertId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('guardian_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (updateError) throw updateError;

      setRecentAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, status: 'acknowledged' as const } : a)
      );

      auditLogger.clinical('ALERT_MARKED_READ', true, { alertId });
    } catch (err) {
      auditLogger.error('ALERT_MARK_READ_FAILED', err as Error, { alertId });
      throw err;
    }
  }, [supabase]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const pendingIds = recentAlerts
      .filter(a => a.status === 'pending')
      .map(a => a.id);

    if (pendingIds.length === 0) return;

    try {
      const { error: updateError } = await supabase
        .from('guardian_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .in('id', pendingIds);

      if (updateError) throw updateError;

      setRecentAlerts(prev =>
        prev.map(a => pendingIds.includes(a.id) ? { ...a, status: 'acknowledged' as const } : a)
      );

      auditLogger.clinical('ALERTS_MARKED_ALL_READ', true, { count: pendingIds.length });
    } catch (err) {
      auditLogger.error('ALERTS_MARK_ALL_READ_FAILED', err as Error);
      throw err;
    }
  }, [supabase, recentAlerts]);

  // Play alert sound
  const playAlertSound = useCallback((severity: AlertSeverity) => {
    playAlertSoundBySeverity(severity);
  }, []);

  // Refresh function
  const refresh = useCallback(async () => {
    await subRefresh();
  }, [subRefresh]);

  // Calculate unread count
  const unreadCount = recentAlerts.filter(a => a.status === 'pending').length;

  return {
    recentAlerts,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    playAlertSound,
    isConnected: isSubscribed,
    refresh,
  };
}

export default useRealtimeAlerts;
