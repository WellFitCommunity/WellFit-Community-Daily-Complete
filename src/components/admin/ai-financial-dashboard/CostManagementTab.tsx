/**
 * CostManagementTab - Cost Management tab content for AI Financial Dashboard
 *
 * Purpose: Displays API call metrics, model usage, batch queue, cost trends, and optimization recommendations
 * Used by: AIFinancialDashboard
 */

import React from 'react';
import type { QueueStats } from '../../../services/ai/batchInference';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EATabsContent,
} from '../../envision-atlus';
import type {
  CostMetrics,
  CostTrend,
  ModelDistribution,
  OptimizationRecommendation,
} from './AIFinancialDashboard.types';
import { MetricCard, ProgressBar, RecommendationCard } from './HelperComponents';

interface CostManagementTabProps {
  costMetrics: CostMetrics | null;
  totalSavings: number;
  savingsPercentage: number;
  modelDistribution: ModelDistribution[];
  queueStats: QueueStats | null;
  batchStats: {
    totalRequestsProcessed: number;
    totalCostSaved: number;
    currentQueueSize: number;
    processingCount: number;
  } | null;
  costTrends: CostTrend[];
  recommendations: OptimizationRecommendation[];
}

const CostManagementTab: React.FC<CostManagementTabProps> = ({
  costMetrics,
  totalSavings,
  savingsPercentage,
  modelDistribution,
  queueStats,
  batchStats,
  costTrends,
  recommendations,
}) => {
  return (
    <EATabsContent value="costs" className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4" aria-label="Cost Management Key Metrics">
        <MetricCard
          label="Total API Calls"
          value={(costMetrics?.totalCalls ?? 0).toLocaleString()}
          subValue={`${costMetrics?.cachedCalls ?? 0} from cache`}
        />
        <MetricCard
          label="Total Cost"
          value={`$${(costMetrics?.totalCost ?? 0).toFixed(2)}`}
          subValue="This period"
        />
        <MetricCard
          label="Total Savings"
          value={`$${totalSavings.toFixed(2)}`}
          subValue={`${savingsPercentage.toFixed(0)}% saved`}
          trend="up"
          trendPositive
        />
        <MetricCard
          label="Cache Hit Rate"
          value={`${(costMetrics?.cacheHitRate ?? 0).toFixed(1)}%`}
          subValue="Higher is better"
          trend={(costMetrics?.cacheHitRate ?? 0) > 50 ? 'up' : 'down'}
          trendPositive={(costMetrics?.cacheHitRate ?? 0) > 50}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Model Usage & Queue */}
        <div className="space-y-6">
          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Model Usage</h2>
            </EACardHeader>
            <EACardContent>
              {modelDistribution.map((model) => (
                <div key={model.model} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{model.model}</span>
                    <span className="text-slate-400">{model.calls.toLocaleString()} calls</span>
                  </div>
                  <ProgressBar
                    label=""
                    value={model.percentage}
                    max={100}
                    color={model.model.includes('Haiku') ? 'bg-green-500' : 'bg-blue-500'}
                  />
                  <div className="text-sm text-slate-500">Est. cost: ${model.cost.toFixed(2)}</div>
                </div>
              ))}
            </EACardContent>
          </EACard>

          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Batch Queue</h2>
            </EACardHeader>
            <EACardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{queueStats?.totalQueued ?? 0}</div>
                  <div className="text-sm text-slate-400">Queued</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[var(--ea-primary)]">{batchStats?.processingCount ?? 0}</div>
                  <div className="text-sm text-slate-400">Processing</div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Batch Savings</span>
                  <span className="text-green-400">${(batchStats?.totalCostSaved ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </EACardContent>
          </EACard>
        </div>

        {/* Center/Right - Trends & Recommendations */}
        <div className="col-span-2 space-y-6">
          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Cost Trends</h2>
            </EACardHeader>
            <EACardContent>
              {costTrends.length > 0 ? (
                <div className="h-48">
                  <div className="flex items-end justify-between h-full gap-1">
                    {costTrends.slice(-14).map((trend, idx) => {
                      const maxCost = Math.max(...costTrends.map((t) => t.cost)) || 1;
                      const height = (trend.cost / maxCost) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-[var(--ea-primary)] rounded-t transition-all duration-300"
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
            </EACardContent>
          </EACard>

          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Optimization Recommendations</h2>
            </EACardHeader>
            <EACardContent>
              {recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <RecommendationCard key={idx} recommendation={rec} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <span className="text-4xl">{'\u2705'}</span>
                  <p className="mt-2">AI costs are well optimized!</p>
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>
      </div>
    </EATabsContent>
  );
};

export default CostManagementTab;
