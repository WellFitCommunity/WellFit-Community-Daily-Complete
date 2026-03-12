/**
 * CostTrendsSection - Bar chart and summary for AI cost trends
 *
 * Purpose: Visualize cost trends over time with period totals
 * Used by: AICostDashboard (center column)
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import type { CostTrend } from './AICostDashboard.types';

interface CostTrendsSectionProps {
  costTrends: CostTrend[];
}

export const CostTrendsSection: React.FC<CostTrendsSectionProps> = ({ costTrends }) => {
  return (
    <EACard>
      <EACardHeader>
        <h2 className="text-lg font-semibold text-white">Cost Trends</h2>
      </EACardHeader>
      <EACardContent>
        {costTrends.length > 0 ? (
          <div className="h-48">
            {/* Simple bar chart representation */}
            <div className="flex items-end justify-between h-full gap-1">
              {costTrends.slice(-14).map((trend, idx) => {
                const maxCost = Math.max(...costTrends.map((t) => t.cost)) || 1;
                const height = (trend.cost / maxCost) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-teal-500 rounded-t transition-all duration-300"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${trend.date}: $${trend.cost.toFixed(2)}`}
                    />
                    <div className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                      {trend.date.split('/').slice(0, 2).join('/')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500">
            No cost data available for this period
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-white">
                ${costTrends.reduce((sum, t) => sum + t.cost, 0).toFixed(2)}
              </div>
              <div className="text-sm text-slate-400">Period Total</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-400">
                ${costTrends.reduce((sum, t) => sum + t.savings, 0).toFixed(2)}
              </div>
              <div className="text-sm text-slate-400">Period Savings</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                {costTrends.reduce((sum, t) => sum + t.calls, 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Total Calls</div>
            </div>
          </div>
        </div>
      </EACardContent>
    </EACard>
  );
};
