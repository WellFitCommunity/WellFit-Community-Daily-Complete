/**
 * DrillComplianceCard - Recovery drill compliance status and history
 *
 * Purpose: Display drill compliance metrics, issues, and drill history table
 * Used by: DisasterRecoveryDashboard
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
} from '../../envision-atlus';
import { getStatusConfig, getDrillTypeLabel, getScenarioLabel } from './statusHelpers';
import type { DrillComplianceStatus, Drill } from './DisasterRecoveryDashboard.types';

interface DrillComplianceCardProps {
  drillStatus: DrillComplianceStatus | null;
  recentDrills: Drill[];
}

export const DrillComplianceCard: React.FC<DrillComplianceCardProps> = ({
  drillStatus,
  recentDrills,
}) => {
  const [showDrillHistory, setShowDrillHistory] = useState(false);

  return (
    <EACard>
      <EACardHeader className="bg-purple-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-purple-900 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Recovery Drills
          </h3>
          {drillStatus && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusConfig(drillStatus.compliance_status).color}`}>
              {getStatusConfig(drillStatus.compliance_status).label}
            </span>
          )}
        </div>
      </EACardHeader>
      <EACardContent className="p-4 space-y-4">
        {drillStatus ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">Pass Rate (30d)</div>
                <div className="text-xl font-bold text-gray-900">
                  {drillStatus.pass_rate}%
                </div>
                <div className="text-xs text-gray-400">
                  Target: {drillStatus.targets.pass_rate_target}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">Avg Score</div>
                <div className="text-xl font-bold text-gray-900">
                  {drillStatus.avg_score ?? 'N/A'}
                </div>
                <div className="text-xs text-gray-400">
                  Target: {drillStatus.targets.avg_score_target}
                </div>
              </div>
            </div>

            {/* Last Drill Times */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Weekly:</span>
                <span className={`font-medium ${
                  !drillStatus.last_weekly_drill ? 'text-red-600' : ''
                }`}>
                  {drillStatus.last_weekly_drill
                    ? new Date(drillStatus.last_weekly_drill).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Monthly:</span>
                <span className={`font-medium ${
                  !drillStatus.last_monthly_drill ? 'text-red-600' : ''
                }`}>
                  {drillStatus.last_monthly_drill
                    ? new Date(drillStatus.last_monthly_drill).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Quarterly:</span>
                <span className={`font-medium ${
                  !drillStatus.last_quarterly_drill ? 'text-red-600' : ''
                }`}>
                  {drillStatus.last_quarterly_drill
                    ? new Date(drillStatus.last_quarterly_drill).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>

            {/* Issues */}
            {drillStatus.issues.length > 0 && (
              <div className="bg-yellow-50 p-3 rounded">
                <div className="text-sm font-medium text-yellow-800 mb-1">Issues:</div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {drillStatus.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <EAButton variant="primary">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Drill
              </EAButton>
              <EAButton variant="secondary">
                <FileText className="w-4 h-4 mr-2" />
                View Reports
              </EAButton>
            </div>

            {/* History Toggle */}
            <button
              onClick={() => setShowDrillHistory(!showDrillHistory)}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800"
            >
              {showDrillHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showDrillHistory ? 'Hide' : 'Show'} Recent Drills
            </button>

            {/* Drill History Table */}
            {showDrillHistory && recentDrills.length > 0 && (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Scenario</th>
                      <th className="px-3 py-2 text-left">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDrills.map((drill) => (
                      <tr key={drill.id} className="border-t">
                        <td className="px-3 py-2">{new Date(drill.scheduled_start).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{getDrillTypeLabel(drill.drill_type)}</td>
                        <td className="px-3 py-2">{getScenarioLabel(drill.drill_scenario)}</td>
                        <td className="px-3 py-2">
                          {drill.status === 'completed' ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              drill.drill_passed
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {drill.drill_passed ? 'Passed' : 'Failed'}
                              {drill.overall_score !== null && ` (${drill.overall_score}%)`}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 capitalize">
                              {drill.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 py-4">
            No drill data available
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};
