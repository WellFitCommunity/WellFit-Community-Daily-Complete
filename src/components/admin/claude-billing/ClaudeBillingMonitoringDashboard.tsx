/**
 * Claude & Billing Monitoring Dashboard
 *
 * Enterprise-grade monitoring dashboard for:
 * - Claude AI usage and costs
 * - Billing workflow metrics
 * - Performance monitoring
 * - Cost optimization insights
 *
 * HIPAA & SOC2 Compliant:
 * - No PHI displayed in monitoring data
 * - Audit logging for all administrative actions
 * - Role-based access control
 * - Data retention policies enforced
 *
 * @module ClaudeBillingMonitoringDashboard
 */

import React from 'react';
import { useClaudeBillingData } from './useClaudeBillingData';
import ServiceStatusPanel from './ServiceStatusPanel';
import CostInsightsPanel from './CostInsightsPanel';
import ClaudeUsageSection from './ClaudeUsageSection';
import BillingWorkflowSection from './BillingWorkflowSection';
import type { DateRange } from './ClaudeBillingMonitoringDashboard.types';

const ClaudeBillingMonitoringDashboard: React.FC = () => {
  const {
    loading,
    dateRange,
    setDateRange,
    claudeMetrics,
    billingMetrics,
    insights,
    serviceStatus,
    spendingSummary,
    refresh,
  } = useClaudeBillingData();

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-sm"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Claude & Billing Monitoring</h2>
          <p className="text-sm text-gray-600 mt-1">Real-time monitoring of AI usage and billing workflows</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={refresh}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <ServiceStatusPanel serviceStatus={serviceStatus} spendingSummary={spendingSummary} />
      <CostInsightsPanel insights={insights} />
      <ClaudeUsageSection claudeMetrics={claudeMetrics} />
      <BillingWorkflowSection billingMetrics={billingMetrics} />
    </div>
  );
};

export default ClaudeBillingMonitoringDashboard;
