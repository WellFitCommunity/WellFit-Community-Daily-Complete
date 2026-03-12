/**
 * MetricCard - Reusable metric display card
 *
 * Purpose: Displays a single KPI with optional trend indicator
 * Used by: ClaudeBillingMonitoringDashboard
 */

import React from 'react';
import type { MetricCardProps } from './ClaudeBillingMonitoringDashboard.types';

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <span className={`text-xs font-medium ${
            trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.direction === 'up' ? '\u2191' : '\u2193'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
