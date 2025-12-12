/**
 * Real-Time Alert Notifications Component
 * =================================================================================================
 * ATLUS: Leading (Innovation) - Push-based instant alert notifications
 * =================================================================================================
 *
 * PURPOSE:
 * - Shows toast notifications when critical/emergency alerts arrive
 * - Provides global visibility for time-sensitive alerts
 * - Reduces response time from 5-minute polling to instant push
 *
 * USAGE:
 * Place in App.tsx after authentication:
 * ```tsx
 * <EARealtimeAlertNotifications />
 * ```
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, X, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { useRealtimeAlerts, RealtimeAlert, AlertSeverity } from '../../hooks/useRealtimeAlerts';

// ============================================================================
// TOAST COMPONENT
// ============================================================================

interface AlertToastProps {
  alert: RealtimeAlert;
  onDismiss: () => void;
  onNavigate: () => void;
}

const AlertToast: React.FC<AlertToastProps> = ({ alert, onDismiss, onNavigate }) => {
  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'emergency':
        return 'bg-red-600 border-red-400 animate-pulse';
      case 'critical':
        return 'bg-red-500 border-red-300';
      case 'warning':
        return 'bg-yellow-500 border-yellow-300';
      default:
        return 'bg-blue-500 border-blue-300';
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    if (severity === 'emergency' || severity === 'critical') {
      return <AlertTriangle className="w-5 h-5 text-white" />;
    }
    return <Bell className="w-5 h-5 text-white" />;
  };

  return (
    <div
      className={`
        max-w-sm w-full rounded-lg shadow-lg border-l-4 p-4
        ${getSeverityStyles(alert.severity)}
        transform transition-all duration-300 ease-in-out
      `}
      role="alert"
      aria-live={alert.severity === 'emergency' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {getSeverityIcon(alert.severity)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-white/80">
              {alert.severity}
            </span>
            <button
              onClick={onDismiss}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-semibold text-white text-sm mt-1">
            {alert.title}
          </p>
          {alert.patient_name && (
            <p className="text-white/90 text-xs mt-0.5">
              Patient: {alert.patient_name}
              {alert.room_number && ` (Room ${alert.room_number})`}
            </p>
          )}
          <p className="text-white/80 text-xs mt-1 line-clamp-2">
            {alert.description}
          </p>
          <button
            onClick={onNavigate}
            className="mt-2 text-xs font-medium text-white underline flex items-center gap-1 hover:text-white/80"
          >
            View Details <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EARealtimeAlertNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<RealtimeAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showBadge, setShowBadge] = useState(false);

  // Handle new alert
  const handleNewAlert = useCallback((alert: RealtimeAlert) => {
    // Only show toasts for critical/emergency
    if (alert.severity !== 'critical' && alert.severity !== 'emergency') {
      return;
    }

    setToasts(prev => {
      // Limit to 3 toasts at a time
      const updated = [alert, ...prev.filter(t => t.id !== alert.id)];
      return updated.slice(0, 3);
    });

    // Show badge indicator
    setShowBadge(true);

    // Auto-dismiss after 10 seconds for critical, 15 for emergency
    const dismissTime = alert.severity === 'emergency' ? 15000 : 10000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== alert.id));
    }, dismissTime);
  }, []);

  // Use realtime alerts hook
  const {
    unreadCount,
    isConnected,
    markAsRead,
  } = useRealtimeAlerts({
    onNewAlert: handleNewAlert,
    severityFilter: ['critical', 'emergency'],
    enableSound: soundEnabled,
    componentName: 'GlobalAlertNotifications',
  });

  // Update badge when unread count changes
  useEffect(() => {
    if (unreadCount > 0) {
      setShowBadge(true);
    }
  }, [unreadCount]);

  // Dismiss toast
  const dismissToast = useCallback((alertId: string) => {
    setToasts(prev => prev.filter(t => t.id !== alertId));
  }, []);

  // Navigate to alerts dashboard
  const navigateToAlert = useCallback((alert: RealtimeAlert) => {
    markAsRead(alert.id).catch(() => {});
    dismissToast(alert.id);
    navigate('/clinical-alerts');
  }, [navigate, markAsRead, dismissToast]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  return (
    <>
      {/* Toast Container - Fixed position top-right */}
      <div
        className="fixed top-20 right-4 z-50 flex flex-col gap-3"
        aria-label="Alert notifications"
      >
        {toasts.map(alert => (
          <AlertToast
            key={alert.id}
            alert={alert}
            onDismiss={() => dismissToast(alert.id)}
            onNavigate={() => navigateToAlert(alert)}
          />
        ))}
      </div>

      {/* Connection Status & Sound Toggle - Small indicator */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        {/* Connection indicator */}
        <div
          className={`
            flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
            ${isConnected
              ? 'bg-emerald-900/80 text-emerald-400 border border-emerald-700'
              : 'bg-red-900/80 text-red-400 border border-red-700'
            }
          `}
          title={isConnected ? 'Real-time alerts connected' : 'Real-time alerts disconnected'}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {isConnected ? 'Live' : 'Offline'}
        </div>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className={`
            p-2 rounded-full transition-colors
            ${soundEnabled
              ? 'bg-slate-700 text-white hover:bg-slate-600'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }
          `}
          title={soundEnabled ? 'Alert sounds enabled' : 'Alert sounds muted'}
          aria-label={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Unread badge */}
        {showBadge && unreadCount > 0 && (
          <button
            onClick={() => navigate('/clinical-alerts')}
            className="relative p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors"
            title={`${unreadCount} unread critical alerts`}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-600 text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </button>
        )}
      </div>
    </>
  );
};

export default EARealtimeAlertNotifications;
