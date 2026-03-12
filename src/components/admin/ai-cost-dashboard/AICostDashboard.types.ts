/**
 * AICostDashboard Types
 *
 * Shared type definitions for the AI Cost Dashboard sub-modules.
 */

export interface CostMetrics {
  totalCalls: number;
  cachedCalls: number;
  totalCost: number;
  savedCost: number;
  haikuCalls: number;
  sonnetCalls: number;
  cacheHitRate: number;
}

export interface CostTrend {
  date: string;
  cost: number;
  savings: number;
  calls: number;
}

export interface ModelDistribution {
  model: string;
  calls: number;
  cost: number;
  percentage: number;
}

export interface OptimizationRecommendation {
  type: 'cost' | 'performance' | 'batch';
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BatchStats {
  totalRequestsProcessed: number;
  totalCostSaved: number;
  currentQueueSize: number;
  processingCount: number;
}
