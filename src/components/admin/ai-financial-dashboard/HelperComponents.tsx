/**
 * HelperComponents - Shared presentational components for AI Financial Dashboard
 *
 * Purpose: MetricCard, ProgressBar, and RecommendationCard used across tabs
 * Used by: CostManagementTab, MCPSavingsTab
 */

import React from 'react';
import type { OptimizationRecommendation } from './AIFinancialDashboard.types';

export const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPositive?: boolean;
}> = ({ label, value, subValue, trend, trendPositive }) => {
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

export const ProgressBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color?: string;
}> = ({ label, value, max, color = 'bg-teal-500' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

export const RecommendationCard: React.FC<{
  recommendation: OptimizationRecommendation;
}> = ({ recommendation }) => {
  const priorityColors = {
    high: 'border-red-500 bg-red-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-blue-500 bg-blue-500/10',
  };

  const typeIcons = {
    cost: '\uD83D\uDCB0',
    performance: '\u26A1',
    batch: '\uD83D\uDCE6',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[recommendation.priority]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeIcons[recommendation.type]}</span>
        <div className="flex-1">
          <div className="font-medium text-white">{recommendation.title}</div>
          <div className="text-sm text-slate-400 mt-1">
            {recommendation.description}
          </div>
          {recommendation.potentialSavings > 0 && (
            <div className="text-sm text-green-400 mt-2">
              Potential savings: ${recommendation.potentialSavings.toFixed(2)}/month
            </div>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          recommendation.priority === 'high' ? 'bg-red-500/20 text-red-400' :
          recommendation.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {recommendation.priority}
        </span>
      </div>
    </div>
  );
};
