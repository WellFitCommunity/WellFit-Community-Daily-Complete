/**
 * SecurityAlertsPanel — Displays security alerts with acknowledge/resolve actions
 *
 * Purpose: Real alert management from security_alerts table (replaces audit_logs read-only view)
 * Used by: TenantSecurityDashboard
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Shield, RefreshCw, Filter } from 'lucide-react';
import { EABadge } from '../../envision-atlus';
import type { SecurityAlertsPanelProps, SecurityAlertRow } from './types';

type StatusFilter = 'active' | 'resolved' | 'all';

const SEVERITY_BADGE_MAP: Record<SecurityAlertRow['severity'], 'critical' | 'high' | 'elevated' | 'info'> = {
  critical: 'critical',
  high: 'high',
  medium: 'elevated',
  low: 'info',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  new: 'New',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  resolved: 'Resolved',
  ignored: 'Ignored',
  false_positive: 'False Positive',
  escalated: 'Escalated',
};

const formatTimestamp = (ts: string): string => {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return ts;
  }
};

export const SecurityAlertsPanel: React.FC<SecurityAlertsPanelProps> = ({
  alerts,
  loading,
  onAcknowledge,
  onResolve,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const filteredAlerts = alerts.filter(a => {
    if (statusFilter === 'active') {
      return ['pending', 'new', 'acknowledged', 'investigating', 'escalated'].includes(a.status);
    }
    if (statusFilter === 'resolved') {
      return ['resolved', 'ignored', 'false_positive'].includes(a.status);
    }
    return true;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-base font-semibold text-gray-900">Security Alerts</h3>
          {filteredAlerts.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {filteredAlerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm">
              {statusFilter === 'active' ? 'No active security alerts' : 'No alerts found'}
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div key={alert.id} className={`p-3 ${
              alert.severity === 'critical' ? 'bg-red-50/50' :
              alert.severity === 'high' ? 'bg-orange-50/50' : ''
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <EABadge variant={SEVERITY_BADGE_MAP[alert.severity]} size="sm">
                      {alert.severity.toUpperCase()}
                    </EABadge>
                    <span className="text-xs text-gray-500">
                      {STATUS_LABELS[alert.status] || alert.status}
                    </span>
                    {alert.category && (
                      <span className="text-xs text-gray-400">{alert.category}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                  {alert.message && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{alert.message}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{formatTimestamp(alert.created_at)}</span>
                    {alert.source_ip && <span>IP: {alert.source_ip}</span>}
                  </div>
                </div>

                {/* Actions */}
                {['pending', 'new'].includes(alert.status) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                      title="Acknowledge alert"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => onResolve(alert.id)}
                      className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
                      title="Resolve alert"
                    >
                      Resolve
                    </button>
                  </div>
                )}
                {alert.status === 'acknowledged' && (
                  <button
                    onClick={() => onResolve(alert.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100 shrink-0"
                    title="Resolve alert"
                  >
                    <CheckCircle className="w-3 h-3" /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
