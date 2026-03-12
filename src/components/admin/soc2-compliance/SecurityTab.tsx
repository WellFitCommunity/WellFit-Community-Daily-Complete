/**
 * SOC2 Compliance Dashboard - Security Events Tab
 *
 * Displays security metrics grid and recent security events table.
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EABadge,
} from '../../envision-atlus';
import { Zap } from 'lucide-react';
import { MetricCard, SeverityBadge } from './helpers';
import type { SOC2DashboardState } from './SOC2ComplianceDashboard.types';

type SecurityTabProps = Pick<
  SOC2DashboardState,
  'securityMetrics' | 'recentEvents' | 'formatTimeAgo'
>;

export const SecurityTab: React.FC<SecurityTabProps> = ({
  securityMetrics,
  recentEvents,
  formatTimeAgo,
}) => {
  return (
    <div className="space-y-6">
      {/* Security Metrics Grid */}
      {securityMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Critical Events"
            value={securityMetrics.critical_events_24h}
            subValue="Last 24 hours"
            color="red"
            highlight={securityMetrics.critical_events_24h > 0}
          />
          <MetricCard
            label="High Severity"
            value={securityMetrics.high_events_24h}
            subValue="Last 24 hours"
            color="orange"
            highlight={securityMetrics.high_events_24h > 5}
          />
          <MetricCard
            label="Failed Logins"
            value={securityMetrics.failed_logins_24h}
            subValue={`${securityMetrics.failed_logins_1h} in last hour`}
            color="yellow"
            highlight={securityMetrics.failed_logins_1h > 10}
          />
          <MetricCard
            label="Open Investigations"
            value={securityMetrics.open_investigations}
            subValue="Requires attention"
            color="purple"
            highlight={securityMetrics.open_investigations > 0}
          />
          <MetricCard
            label="Total Security Events"
            value={securityMetrics.security_events_24h}
            subValue="Last 24 hours"
            color="blue"
          />
          <MetricCard
            label="Unauthorized Access"
            value={securityMetrics.unauthorized_access_24h}
            subValue="Access control violations"
            color="orange"
          />
          <MetricCard
            label="Auto-Blocked"
            value={securityMetrics.auto_blocked_24h}
            subValue="Threats prevented"
            color="green"
          />
          <MetricCard
            label="PHI Access"
            value={securityMetrics.phi_access_24h}
            subValue="Protected data accessed"
            color="indigo"
          />
        </div>
      )}

      {/* Recent Security Events */}
      <EACard>
        <EACardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Recent Security Events</h2>
          </div>
        </EACardHeader>
        <EACardContent>
          {recentEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No security events recorded</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {recentEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm text-white">{formatTimeAgo(event.timestamp)}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={event.severity} />
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{event.event_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-md truncate">{event.description}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">
                        {event.actor_ip_address || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {event.auto_blocked && <EABadge variant="critical">BLOCKED</EABadge>}
                        {event.investigated && <EABadge variant="normal">RESOLVED</EABadge>}
                        {event.requires_investigation && !event.investigated && (
                          <EABadge variant="elevated">INVESTIGATING</EABadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};
