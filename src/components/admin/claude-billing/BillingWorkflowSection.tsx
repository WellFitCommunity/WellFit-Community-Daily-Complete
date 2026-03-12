/**
 * BillingWorkflowSection - Billing workflow performance metrics
 *
 * Purpose: Shows billing workflow KPIs, financial summary, and top errors
 * Used by: ClaudeBillingMonitoringDashboard
 */

import React from 'react';
import type { BillingWorkflowMetrics } from './ClaudeBillingMonitoringDashboard.types';
import MetricCard from './MetricCard';

interface BillingWorkflowSectionProps {
  billingMetrics: BillingWorkflowMetrics | null;
}

const BillingWorkflowSection: React.FC<BillingWorkflowSectionProps> = ({ billingMetrics }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Workflow Performance</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Workflows"
          value={billingMetrics?.totalWorkflows || 0}
          icon={'\uD83D\uDD04'}
          trend={undefined}
        />
        <MetricCard
          title="Success Rate"
          value={`${(billingMetrics?.successRate || 0).toFixed(1)}%`}
          icon={'\u2713'}
          trend={undefined}
        />
        <MetricCard
          title="Manual Review Rate"
          value={`${(billingMetrics?.manualReviewRate || 0).toFixed(1)}%`}
          icon={'\uD83D\uDC41\uFE0F'}
          trend={undefined}
        />
        <MetricCard
          title="Avg Processing Time"
          value={`${((billingMetrics?.averageProcessingTime || 0) / 1000).toFixed(1)}s`}
          icon={'\u23F1\uFE0F'}
          trend={undefined}
        />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Charges</p>
          <p className="text-2xl font-bold text-gray-900">
            ${(billingMetrics?.totalCharges || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Estimated Reimbursement</p>
          <p className="text-2xl font-bold text-green-600">
            ${(billingMetrics?.estimatedReimbursement || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Reimbursement Rate</p>
          <p className="text-2xl font-bold text-blue-600">
            {(billingMetrics?.reimbursementRate || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Top Errors */}
      {billingMetrics && billingMetrics.topErrors.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Top Billing Errors</h4>
          <div className="space-y-2">
            {billingMetrics.topErrors.map((error, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{error.code}</span>
                  {error.message && (
                    <p className="text-xs text-gray-600 mt-0.5">{error.message}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-red-600">{error.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingWorkflowSection;
