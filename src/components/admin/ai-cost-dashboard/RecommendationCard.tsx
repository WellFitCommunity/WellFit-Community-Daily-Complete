/**
 * RecommendationCard - Displays a single optimization recommendation
 *
 * Purpose: Show actionable AI cost optimization suggestions
 * Used by: AICostDashboard (Optimization Recommendations section)
 */

import React from 'react';
import type { OptimizationRecommendation } from './AICostDashboard.types';

const priorityColors: Record<OptimizationRecommendation['priority'], string> = {
  high: 'border-red-500 bg-red-500/10',
  medium: 'border-yellow-500 bg-yellow-500/10',
  low: 'border-blue-500 bg-blue-500/10',
};

const typeIcons: Record<OptimizationRecommendation['type'], string> = {
  cost: '\uD83D\uDCB0',
  performance: '\u26A1',
  batch: '\uD83D\uDCE6',
};

interface RecommendationCardProps {
  recommendation: OptimizationRecommendation;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
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
