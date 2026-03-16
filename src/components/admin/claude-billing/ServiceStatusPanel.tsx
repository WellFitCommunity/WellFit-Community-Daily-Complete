/**
 * ServiceStatusPanel - Real-time service health and spending display
 *
 * Purpose: Shows Claude AI service health and real-time spending summary
 * Used by: ClaudeBillingMonitoringDashboard
 */

import React from 'react';
import type { ServiceStatus, SpendingSummary } from './ClaudeBillingMonitoringDashboard.types';

interface ServiceStatusPanelProps {
  serviceStatus: ServiceStatus | null;
  spendingSummary: SpendingSummary | null;
}

const ServiceStatusPanel: React.FC<ServiceStatusPanelProps> = ({ serviceStatus, spendingSummary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Service Status" aria-live="polite">
      {/* Service Health */}
      <div className={`border rounded-lg p-4 ${
        serviceStatus?.isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Claude AI Service</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            serviceStatus?.isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {serviceStatus?.isHealthy ? '\u2713 Healthy' : '\u26A0 Unhealthy'}
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Circuit Breaker: <span className="font-medium">{serviceStatus?.circuitBreakerState || 'Unknown'}</span></p>
          <p>Last Check: <span className="font-medium">
            {serviceStatus?.lastHealthCheck ? new Date(serviceStatus.lastHealthCheck).toLocaleTimeString() : 'N/A'}
          </span></p>
        </div>
      </div>

      {/* Real-Time Spending */}
      <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Real-Time Spending</h3>
          <span className="text-2xl">{'\uD83D\uDCB5'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-600">Today</p>
            <p className="text-lg font-bold text-gray-900">${(spendingSummary?.totalDaily ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">This Month</p>
            <p className="text-lg font-bold text-gray-900">${(spendingSummary?.totalMonthly ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Active Users</p>
            <p className="text-lg font-bold text-gray-900">{spendingSummary?.userCount ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceStatusPanel;
