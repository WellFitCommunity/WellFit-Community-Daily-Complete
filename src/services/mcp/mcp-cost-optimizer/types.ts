// MCP Cost Optimizer - Type Definitions

/**
 * Configuration for cost optimization behavior
 */
export interface CostOptimizationConfig {
  enableCaching: boolean;
  cacheSystemPrompts: boolean;
  cacheDuration: number; // seconds
  preferHaikuForSimpleTasks: boolean;
  trackCosts: boolean;
}

/**
 * Cache entry for storing prompt responses
 */
export interface CacheEntry {
  response: string;
  timestamp: number;
  cost: number;
  model: string;
}

/**
 * Metrics for tracking AI call costs
 */
export interface CostMetrics {
  totalCalls: number;
  cachedCalls: number;
  totalCost: number;
  savedCost: number;
  haikuCalls: number;
  sonnetCalls: number;
}

/**
 * Options for making an optimized AI call
 */
export interface MCPCallOptions {
  prompt: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  model?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  userId?: string;
  forceFresh?: boolean;
}

/**
 * Result from an optimized AI call
 */
export interface MCPCallResult {
  response: string;
  fromCache: boolean;
  cost: number;
  model: string;
}

/**
 * Cost report structure
 */
export interface CostReport {
  daily_cost: number;
  monthly_cost: number;
  cache_savings: number;
  efficiency_score: number;
}
