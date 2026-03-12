/**
 * CostInsightsPanel - Cost optimization insights display
 *
 * Purpose: Renders actionable cost optimization insights with severity indicators
 * Used by: ClaudeBillingMonitoringDashboard
 */

import React from 'react';
import type { CostOptimizationInsight } from './ClaudeBillingMonitoringDashboard.types';

interface CostInsightsPanelProps {
  insights: CostOptimizationInsight[];
}

const CostInsightsPanel: React.FC<CostInsightsPanelProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`border-l-4 rounded-lg p-4 ${
            insight.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
            insight.type === 'info' ? 'border-blue-500 bg-blue-50' :
            'border-green-500 bg-green-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
              <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
              {insight.potentialSavings && (
                <p className="text-sm font-medium text-green-700 mb-2">
                  {'\uD83D\uDCB0'} Potential savings: ${insight.potentialSavings.toFixed(2)}
                </p>
              )}
              <ul className="text-xs text-gray-600 space-y-1">
                {insight.actionItems.map((action, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-2">{'\u2022'}</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CostInsightsPanel;
