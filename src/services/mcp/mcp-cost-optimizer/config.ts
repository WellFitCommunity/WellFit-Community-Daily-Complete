// MCP Cost Optimizer - Default Configuration

import type { CostOptimizationConfig } from './types';

/**
 * Default configuration for cost optimization
 */
export const DEFAULT_CONFIG: CostOptimizationConfig = {
  enableCaching: true,
  cacheSystemPrompts: true,
  cacheDuration: 300, // 5 minutes
  preferHaikuForSimpleTasks: true,
  trackCosts: true,
};
