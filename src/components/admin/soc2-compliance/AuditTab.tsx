/**
 * SOC2 Compliance Dashboard - Audit & Compliance Tab
 *
 * Displays compliance score, SOC2 control status, audit event summary,
 * and PHI access audit trail.
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import {
  CheckCircle2,
  Activity,
  Lock,
} from 'lucide-react';
import { StatusBadge, SeverityBadge } from './helpers';
import type { SOC2DashboardState } from './SOC2ComplianceDashboard.types';
import type { FilterRiskLevel } from './SOC2ComplianceDashboard.types';

type AuditTabProps = Pick<
  SOC2DashboardState,
  | 'complianceScore'
  | 'compliantControls'
  | 'totalControls'
  | 'complianceStatus'
  | 'auditStats'
  | 'filteredPHIAccess'
  | 'filterRiskLevel'
  | 'setFilterRiskLevel'
  | 'formatTimestamp'
  | 'formatTimeAgo'
>;

export const AuditTab: React.FC<AuditTabProps> = ({
  complianceScore,
  compliantControls,
  totalControls,
  complianceStatus,
  auditStats,
  filteredPHIAccess,
  filterRiskLevel,
  setFilterRiskLevel,
  formatTimestamp,
  formatTimeAgo,
}) => {
  return (
    <div className="space-y-6" aria-label="SOC2 Audit and Compliance">
      {/* Compliance Score */}
      <EACard className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border-blue-500/30">
        <EACardContent className="py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-slate-300 mb-2">SOC2 Compliance Score</h2>
              <div className="text-6xl font-bold text-blue-400">{complianceScore}%</div>
              <p className="text-sm text-slate-400 mt-2">
                {compliantControls} of {totalControls} controls compliant
              </p>
            </div>
            <div className="text-right">
              <div className="text-6xl">
                {complianceScore === 100 ? '\uD83C\uDFAF' : complianceScore >= 80 ? '\u2705' : '\u26A0\uFE0F'}
              </div>
              <p className="text-sm text-slate-400 mt-2">
                {complianceScore === 100
                  ? 'Fully Compliant'
                  : complianceScore >= 80
                    ? 'Good Standing'
                    : 'Needs Attention'}
              </p>
            </div>
          </div>
        </EACardContent>
      </EACard>

      {/* SOC2 Control Status */}
      <EACard>
        <EACardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[var(--ea-primary)]" />
            <h2 className="text-lg font-semibold text-white">SOC2 Control Status</h2>
          </div>
        </EACardHeader>
        <EACardContent>
          {complianceStatus.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No compliance data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full" aria-label="SOC2 control status">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Control Area
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Criterion
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Test Result
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {complianceStatus.map((control, index) => (
                    <tr key={index} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-white">{control.control_area}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">{control.soc2_criterion}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs">
                        {control.control_description}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={control.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={control.test_result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Audit Event Summary */}
      <EACard>
        <EACardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--ea-primary)]" />
            <h2 className="text-lg font-semibold text-white">Audit Event Summary (Last 30 Days)</h2>
          </div>
        </EACardHeader>
        <EACardContent>
          {auditStats.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No audit statistics available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full" aria-label="Audit event summary">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                      Total Events
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                      Success Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                      Unique Users
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Latest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {auditStats.slice(0, 20).map((stat, index) => (
                    <tr key={index} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-white">{stat.event_category}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{stat.event_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-right text-white font-semibold">
                        {stat.total_events.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`font-semibold ${
                            stat.success_rate_percent >= 95
                              ? 'text-green-400'
                              : stat.success_rate_percent >= 80
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                        >
                          {stat.success_rate_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-400">{stat.unique_users}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{formatTimeAgo(stat.latest_event)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* PHI Access Audit Trail */}
      <EACard>
        <EACardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[var(--ea-primary)]" />
              <h2 className="text-lg font-semibold text-white">PHI Access Audit Trail</h2>
            </div>
            <div className="flex gap-2">
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as FilterRiskLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterRiskLevel(level)}
                  className={`px-3 py-1 text-xs rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${
                    filterRiskLevel === level ? 'bg-[var(--ea-primary)] text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {level === 'ALL' ? 'All' : level}
                </button>
              ))}
            </div>
          </div>
        </EACardHeader>
        <EACardContent>
          {filteredPHIAccess.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No PHI access events recorded</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full" aria-label="PHI access audit trail">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Access Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Risk Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredPHIAccess.slice(0, 50).map((access) => (
                    <tr key={access.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm text-white">{formatTimestamp(access.timestamp)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{access.actor_email}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{access.actor_role || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-white">{access.access_type}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{access.patient_name}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={access.risk_level} />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">
                        {access.actor_ip_address || 'N/A'}
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
