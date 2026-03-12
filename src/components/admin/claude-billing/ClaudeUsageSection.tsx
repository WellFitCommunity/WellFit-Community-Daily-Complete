/**
 * ClaudeUsageSection - Claude AI usage metrics display
 *
 * Purpose: Shows AI request metrics, cost breakdown by model
 * Used by: ClaudeBillingMonitoringDashboard
 */

import React from 'react';
import type { ClaudeUsageMetrics } from './ClaudeBillingMonitoringDashboard.types';
import MetricCard from './MetricCard';

interface ClaudeUsageSectionProps {
  claudeMetrics: ClaudeUsageMetrics | null;
}

const ClaudeUsageSection: React.FC<ClaudeUsageSectionProps> = ({ claudeMetrics }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Claude AI Usage</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Requests"
          value={claudeMetrics?.totalRequests || 0}
          icon={'\uD83D\uDCCA'}
          trend={undefined}
        />
        <MetricCard
          title="Success Rate"
          value={`${(claudeMetrics?.successRate || 0).toFixed(1)}%`}
          icon={'\u2705'}
          trend={undefined}
        />
        <MetricCard
          title="Total Cost"
          value={`$${(claudeMetrics?.totalCost || 0).toFixed(2)}`}
          icon={'\uD83D\uDCB0'}
          trend={undefined}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${(claudeMetrics?.avgResponseTime || 0).toFixed(0)}ms`}
          icon={'\u26A1'}
          trend={undefined}
        />
      </div>

      {/* Cost by Model */}
      {claudeMetrics && Object.keys(claudeMetrics.costByModel).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-3">Cost by Model</h4>
          <div className="space-y-2">
            {Object.entries(claudeMetrics.costByModel).map(([model, cost]) => (
              <div key={model} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{model}</span>
                <span className="text-sm font-medium text-gray-900">${cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaudeUsageSection;
