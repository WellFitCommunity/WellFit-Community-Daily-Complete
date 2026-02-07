/**
 * ReadmissionAlertsTab - Clinical alerts tab for the readmission dashboard.
 *
 * Displays active alerts sorted by severity (critical first) with action buttons.
 */

import React from 'react';
import { Bell } from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EABadge,
} from '../../envision-atlus';
import type { CommunityAlert, AlertCardProps } from './CommunityReadmission.types';

// ============================================================================
// AlertCard - Individual alert display
// ============================================================================

const severityColors: Record<string, string> = {
  critical: 'border-red-500 bg-red-500/10',
  high: 'border-orange-500 bg-orange-500/10',
  medium: 'border-yellow-500 bg-yellow-500/10',
  low: 'border-blue-500 bg-blue-500/10',
};

const AlertCard: React.FC<AlertCardProps> = ({ alert }) => (
  <div className={`p-4 rounded-lg border-l-4 ${severityColors[alert.severity] || severityColors.low}`}>
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white">{alert.member_name}</span>
          <EABadge variant={alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'info'}>
            {alert.severity}
          </EABadge>
          <EABadge variant={alert.status === 'active' ? 'info' : 'neutral'}>
            {alert.status}
          </EABadge>
        </div>
        <h4 className="font-medium text-white">{alert.title}</h4>
        <p className="text-sm text-slate-400 mt-1">{alert.description}</p>
        {alert.recommended_action && (
          <div className="mt-2 p-2 bg-slate-800/50 rounded-sm text-sm">
            <span className="text-slate-400">Recommended: </span>
            <span className="text-white">{alert.recommended_action}</span>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">
          {new Date(alert.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex gap-2 ml-4">
        <button className="px-3 py-1.5 bg-[#00857a] hover:bg-[#006d64] text-white rounded-sm text-sm">
          Take Action
        </button>
        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-sm text-sm">
          Dismiss
        </button>
      </div>
    </div>
  </div>
);

// ============================================================================
// ReadmissionAlertsTab - Main export
// ============================================================================

interface ReadmissionAlertsTabProps {
  alerts: CommunityAlert[];
}

export const ReadmissionAlertsTab: React.FC<ReadmissionAlertsTabProps> = ({ alerts }) => (
  <EACard>
    <EACardHeader icon={<Bell className="text-red-400" />}>
      <h3 className="font-semibold text-white">Active Alerts</h3>
      <p className="text-sm text-slate-400">{alerts.length} alerts requiring attention</p>
    </EACardHeader>
    <EACardContent>
      {alerts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Bell size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No active alerts</p>
          <p className="text-sm mt-1">All community members are stable.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.alert_id} alert={alert} />
          ))}
        </div>
      )}
    </EACardContent>
  </EACard>
);

export default ReadmissionAlertsTab;
