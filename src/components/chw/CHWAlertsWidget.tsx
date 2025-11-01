/**
 * CHW Alerts Widget
 * Displays critical alerts from Community Health Worker field visits
 * Used by Physician, Nurse, and Case Manager panels
 */

import React, { useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import useRealtimeSubscription from '../../hooks/useRealtimeSubscription';

interface SpecialistAlert {
  id: string;
  visit_id: string;
  alert_rule_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  triggered_by: any;
  triggered_at: string;
  notify_role: string;
  message: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
  patient_name?: string;
  chw_name?: string;
}

interface CHWAlertsWidgetProps {
  userRole: string;
  userId: string;
  maxAlerts?: number;
}

export const CHWAlertsWidget: React.FC<CHWAlertsWidgetProps> = ({
  userRole,
  userId,
  maxAlerts = 10
}) => {
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');

  const getRoleMapping = (role: string): string => {
    const roleMap: Record<string, string> = {
      'physician': 'physician',
      'doctor': 'physician',
      'nurse': 'nurse',
      'case_manager': 'case_manager',
      'social_worker': 'case_manager'
    };
    return roleMap[role] || 'physician';
  };

  // Enterprise-grade subscription with automatic cleanup
  const { data: allAlerts, loading, refresh } = useRealtimeSubscription<any>({
    table: 'specialist_alerts',
    event: '*',
    schema: 'public',
    componentName: 'CHWAlertsWidget',
    initialFetch: async () => {
      let query = supabase
        .from('specialist_alerts')
        .select(`
          *,
          field_visits!inner(
            patient_id,
            specialist_id,
            profiles!field_visits_patient_id_fkey(first_name, last_name)
          )
        `)
        .eq('notify_role', getRoleMapping(userRole))
        .eq('resolved', false)
        .order('triggered_at', { ascending: false })
        .limit(maxAlerts);

      if (filter === 'unacknowledged') {
        query = query.eq('acknowledged', false);
      } else if (filter === 'critical') {
        query = query.eq('severity', 'critical');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Flatten patient info
      return (data || []).map((alert: any) => ({
        ...alert,
        patient_name: alert.field_visits?.profiles
          ? `${alert.field_visits.profiles.first_name} ${alert.field_visits.profiles.last_name}`
          : 'Unknown Patient'
      }));
    }
  });

  const alerts: SpecialistAlert[] = allAlerts || [];

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('specialist_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId
        })
        .eq('id', alertId);

      if (error) throw error;

      await refresh();
    } catch (error) {
      // Silent fail - user can retry
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('specialist_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      await refresh();
    } catch (error) {
      // Silent fail - user can retry
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 border-red-500 text-red-900',
      high: 'bg-orange-100 border-orange-500 text-orange-900',
      medium: 'bg-yellow-100 border-yellow-500 text-yellow-900',
      low: 'bg-blue-100 border-blue-500 text-blue-900',
      info: 'bg-gray-100 border-gray-500 text-gray-900'
    };
    return colors[severity as keyof typeof colors] || colors.info;
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="w-5 h-5 text-red-600" />;
    if (severity === 'high') return <Bell className="w-5 h-5 text-orange-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Bell className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold">CHW Field Alerts</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold">CHW Field Alerts</h2>
            {alerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unacknowledged')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'unacknowledged'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unacknowledged
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Critical Only
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>No {filter !== 'all' ? filter : ''} alerts at this time</p>
            <p className="text-sm">CHW field visits are being monitored</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-l-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {alert.patient_name}
                      </span>
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded uppercase font-medium">
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeAgo(alert.triggered_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mb-2">{alert.message}</p>
                    <div className="flex items-center space-x-2">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
                {alert.acknowledged && (
                  <div className="text-right">
                    <CheckCircle className="w-4 h-4 text-green-600 inline-block" />
                    <span className="text-xs text-gray-500 block">Acknowledged</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CHWAlertsWidget;
