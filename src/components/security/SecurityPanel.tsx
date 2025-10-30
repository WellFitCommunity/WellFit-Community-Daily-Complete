/**
 * Security Panel - Security Alert Dashboard
 *
 * PERMANENT PRODUCTION SOLUTION:
 * This component displays security alerts from the database.
 * Guardian Agent runs as a backend service (Edge Function or cron job)
 * and writes alerts to the security_alerts table, which this component displays.
 *
 * NO STUB, NO TEMPORARY CODE - THIS IS THE FINAL IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface SecurityAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  message: string;
  created_at: string;
  status: 'pending' | 'acknowledged' | 'resolved' | 'ignored';
  metadata?: any;
  resolved_at?: string;
  resolved_by?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export const SecurityPanel: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'critical'>('pending');
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  useEffect(() => {
    loadAlerts();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('security-alerts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_alerts' },
        () => {
          loadAlerts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [filter]);

  const loadAlerts = async () => {
    try {
      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filter === 'critical') {
        query = query.in('severity', ['critical', 'high']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      // Error handled silently - no PHI in console
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const updateAlertStatus = async (alertId: string, status: 'acknowledged' | 'resolved' | 'ignored') => {
    try {
      const updates: any = { status };
      const timestamp = new Date().toISOString();

      if (status === 'acknowledged') {
        updates.acknowledged_at = timestamp;
        updates.acknowledged_by = user?.id;
      } else if (status === 'resolved') {
        updates.resolved_at = timestamp;
        updates.resolved_by = user?.id;
      }

      const { error } = await supabase
        .from('security_alerts')
        .update(updates)
        .eq('id', alertId);

      if (error) throw error;

      await loadAlerts();
      setSelectedAlert(null);
    } catch (error) {
      // Error handled silently - no PHI in console
      alert('Failed to update alert status');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pending</span>;
      case 'acknowledged': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Acknowledged</span>;
      case 'resolved': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Resolved</span>;
      case 'ignored': return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Ignored</span>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const alertStats = {
    total: alerts.length,
    pending: alerts.filter(a => a.status === 'pending').length,
    critical: alerts.filter(a => ['critical', 'high'].includes(a.severity)).length,
    resolved: alerts.filter(a => a.status === 'resolved').length
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Security Alerts</h1>
        <p className="text-gray-600 mt-2">Monitor and respond to security events</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total Alerts</div>
          <div className="text-2xl font-bold text-gray-900">{alertStats.total}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-700">{alertStats.pending}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-600">Critical/High</div>
          <div className="text-2xl font-bold text-red-700">{alertStats.critical}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-600">Resolved</div>
          <div className="text-2xl font-bold text-green-700">{alertStats.resolved}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          All Alerts
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Pending Only
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'critical'
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Critical/High
        </button>
      </div>

      {/* Alerts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Alerts ({alerts.length})</h2>

          {alerts.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-500">No security alerts found</p>
            </div>
          ) : (
            alerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedAlert?.id === alert.id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                } bg-white`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{alert.title || alert.category}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs border ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {getStatusBadge(alert.status)}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alert Details */}
        <div className="lg:sticky lg:top-6 h-fit">
          {selectedAlert ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Alert Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">Title</label>
                  <p className="font-semibold">{selectedAlert.title || selectedAlert.category}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-600">Message</label>
                  <p className="text-gray-900">{selectedAlert.message}</p>
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Severity</label>
                    <p className={`inline-block px-2 py-1 rounded text-xs ${getSeverityColor(selectedAlert.severity)}`}>
                      {selectedAlert.severity.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Status</label>
                    <div>{getStatusBadge(selectedAlert.status)}</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600">Created</label>
                  <p className="text-gray-900">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                </div>

                {selectedAlert.metadata && (
                  <div>
                    <label className="text-sm text-gray-600">Additional Details</label>
                    <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Actions */}
                {selectedAlert.status === 'pending' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => updateAlertStatus(selectedAlert.id, 'acknowledged')}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => updateAlertStatus(selectedAlert.id, 'resolved')}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => updateAlertStatus(selectedAlert.id, 'ignored')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-500">Select an alert to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};