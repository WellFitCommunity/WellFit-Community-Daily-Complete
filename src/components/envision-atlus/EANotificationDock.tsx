/**
 * EANotificationDock - Collapsible Side Panel for Notifications
 * =============================================================================
 * Consolidates all floating notification elements into a single, organized dock.
 * Prevents overlapping UI elements in the bottom-right corner.
 *
 * Features:
 * - Collapsed: Small floating button showing notification count
 * - Expanded: Vertical side panel with all notifications stacked
 * - Smooth slide-in/out animation
 * - Persists open/closed state
 */

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Activity,
  Zap,
  X,
  ExternalLink,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeAlerts, RealtimeAlert, AlertSeverity } from '../../hooks/useRealtimeAlerts';

// ============================================================================
// DOCK CONTEXT - For child components to register themselves
// ============================================================================

interface DockItem {
  id: string;
  priority: number; // Lower = higher priority (shown first)
  component: React.ReactNode;
}

interface DockContextValue {
  isExpanded: boolean;
  toggleDock: () => void;
  registerItem: (item: DockItem) => void;
  unregisterItem: (id: string) => void;
}

const DockContext = createContext<DockContextValue | null>(null);

export const useDock = () => {
  const ctx = useContext(DockContext);
  if (!ctx) {
    throw new Error('useDock must be used within EANotificationDock');
  }
  return ctx;
};

// ============================================================================
// DOCK ITEM COMPONENTS
// ============================================================================

interface AlertToastProps {
  alert: RealtimeAlert;
  onDismiss: () => void;
  onNavigate: () => void;
  compact?: boolean;
}

const AlertToast: React.FC<AlertToastProps> = ({ alert, onDismiss, onNavigate, compact }) => {
  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'emergency':
        return 'bg-red-600 border-red-400';
      case 'critical':
        return 'bg-red-500 border-red-300';
      case 'warning':
        return 'bg-yellow-500 border-yellow-300';
      default:
        return 'bg-blue-500 border-blue-300';
    }
  };

  return (
    <div
      className={`
        w-full rounded-lg shadow-lg border-l-4 p-3
        ${getSeverityStyles(alert.severity)}
      `}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase text-white/80">
              {alert.severity}
            </span>
            <button
              onClick={onDismiss}
              className="text-white/70 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="font-medium text-white text-sm mt-1 truncate">
            {alert.title}
          </p>
          {!compact && alert.patient_name && (
            <p className="text-white/80 text-xs mt-0.5 truncate">
              {alert.patient_name}
            </p>
          )}
          <button
            onClick={onNavigate}
            className="mt-1 text-xs text-white/90 underline flex items-center gap-1"
          >
            View <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DOCK COMPONENT
// ============================================================================

interface EANotificationDockProps {
  children?: React.ReactNode;
}

const EANotificationDockInner: React.FC<EANotificationDockProps> = ({ children }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [toasts, setToasts] = useState<RealtimeAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [items, setItems] = useState<DockItem[]>([]);

  // Handle new alert
  const handleNewAlert = useCallback((alert: RealtimeAlert) => {
    if (alert.severity !== 'critical' && alert.severity !== 'emergency') {
      return;
    }

    setToasts(prev => {
      const updated = [alert, ...prev.filter(t => t.id !== alert.id)];
      return updated.slice(0, 5);
    });

    // Auto-expand on emergency
    if (alert.severity === 'emergency') {
      setIsExpanded(true);
    }

    // Auto-dismiss
    const dismissTime = alert.severity === 'emergency' ? 30000 : 15000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== alert.id));
    }, dismissTime);
  }, []);

  // Use realtime alerts hook
  const { unreadCount, isConnected, markAsRead } = useRealtimeAlerts({
    onNewAlert: handleNewAlert,
    severityFilter: ['critical', 'emergency'],
    enableSound: soundEnabled,
    componentName: 'NotificationDock',
  });

  // Toggle dock
  const toggleDock = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Register/unregister items
  const registerItem = useCallback((item: DockItem) => {
    setItems(prev => [...prev.filter(i => i.id !== item.id), item].sort((a, b) => a.priority - b.priority));
  }, []);

  const unregisterItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((alertId: string) => {
    setToasts(prev => prev.filter(t => t.id !== alertId));
  }, []);

  // Navigate to alert
  const navigateToAlert = useCallback((alert: RealtimeAlert) => {
    markAsRead(alert.id).catch(() => {});
    dismissToast(alert.id);
    navigate('/clinical-alerts');
  }, [navigate, markAsRead, dismissToast]);

  // Total notification count
  const totalCount = unreadCount + toasts.length;

  // Context value
  const contextValue: DockContextValue = {
    isExpanded,
    toggleDock,
    registerItem,
    unregisterItem,
  };

  return (
    <DockContext.Provider value={contextValue}>
      {/* Collapsed Button */}
      <button
        onClick={toggleDock}
        className={`
          fixed bottom-4 right-4 z-50
          flex items-center justify-center
          w-14 h-14 rounded-full shadow-lg
          transition-all duration-300 ease-in-out
          ${isExpanded ? 'opacity-0 pointer-events-none translate-x-4' : 'opacity-100'}
          ${totalCount > 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-700 hover:bg-slate-600'}
        `}
        aria-label={`${isExpanded ? 'Close' : 'Open'} notification dock. ${totalCount} notifications`}
      >
        <Bell className="w-6 h-6 text-white" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-red-600 text-xs font-bold rounded-full flex items-center justify-center shadow">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
        {/* Connection indicator dot */}
        <span
          className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-slate-700 ${
            isConnected ? 'bg-emerald-400' : 'bg-red-400'
          }`}
        />
      </button>

      {/* Expanded Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 z-50
          bg-slate-900 border-l border-slate-700 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isExpanded ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#00857a]" />
            <h2 className="font-semibold text-white">Notifications</h2>
            {totalCount > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                {totalCount}
              </span>
            )}
          </div>
          <button
            onClick={toggleDock}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close notification dock"
          >
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-xs font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`p-1.5 rounded-lg transition-colors ${
              soundEnabled ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Active Alerts */}
          {toasts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Alerts
              </h3>
              {toasts.map(alert => (
                <AlertToast
                  key={alert.id}
                  alert={alert}
                  onDismiss={() => dismissToast(alert.id)}
                  onNavigate={() => navigateToAlert(alert)}
                />
              ))}
            </div>
          )}

          {/* Registered Items from children */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Quick Actions
              </h3>
              {items.map(item => (
                <div key={item.id}>{item.component}</div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Navigation
            </h3>

            <button
              onClick={() => { navigate('/clinical-alerts'); toggleDock(); }}
              className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Clinical Alerts</p>
                <p className="text-xs text-slate-400">View all alerts</p>
              </div>
              {unreadCount > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { navigate('/dashboard'); toggleDock(); }}
              className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Activity className="w-5 h-5 text-[#00857a]" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Dashboard</p>
                <p className="text-xs text-slate-400">Return to main view</p>
              </div>
            </button>
          </div>

          {/* Empty State */}
          {toasts.length === 0 && unreadCount === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No pending notifications</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Esc</kbd> to close
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={toggleDock}
          aria-hidden="true"
        />
      )}

      {/* Render children (other dock items) */}
      {children}
    </DockContext.Provider>
  );
};

// Wrapper with auth check
export const EANotificationDock: React.FC<EANotificationDockProps> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <EANotificationDockInner>{children}</EANotificationDockInner>;
};

export default EANotificationDock;
