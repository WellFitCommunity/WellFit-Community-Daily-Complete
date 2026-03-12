/**
 * MetricCard - Displays a single metric with optional trend indicator
 *
 * Purpose: Key metric display in the AI Cost Dashboard header
 * Used by: AICostDashboard
 */

import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPositive?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subValue, trend, trendPositive }) => {
  const trendIcon = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '';
  const trendColor = trend
    ? trendPositive
      ? 'text-green-400'
      : 'text-red-400'
    : '';

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white flex items-center gap-2">
        {value}
        {trend && (
          <span className={`text-sm ${trendColor}`}>
            {trendIcon}
          </span>
        )}
      </div>
      {subValue && (
        <div className="text-sm text-slate-500 mt-1">{subValue}</div>
      )}
    </div>
  );
};
