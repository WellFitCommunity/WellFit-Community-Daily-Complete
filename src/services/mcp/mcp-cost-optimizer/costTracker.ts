// MCP Cost Optimizer - Cost Tracker
// Tracks AI call costs and cache savings

import { supabase } from '../../../lib/supabaseClient';
import type { CostMetrics } from './types';

/**
 * CostTracker - Tracks AI call costs and savings
 *
 * Features:
 * - Tracks total calls, cached calls, and costs
 * - Calculates cache hit rate
 * - Persists metrics to database
 */
export class CostTracker {
  private metrics: CostMetrics = {
    totalCalls: 0,
    cachedCalls: 0,
    totalCost: 0,
    savedCost: 0,
    haikuCalls: 0,
    sonnetCalls: 0,
  };

  /**
   * Track an AI call
   */
  trackCall(model: string, cost: number, fromCache: boolean): void {
    this.metrics.totalCalls++;

    if (fromCache) {
      this.metrics.cachedCalls++;
      this.metrics.savedCost += cost; // Estimated cost saved
    } else {
      this.metrics.totalCost += cost;

      if (model.includes('haiku')) {
        this.metrics.haikuCalls++;
      } else if (model.includes('sonnet')) {
        this.metrics.sonnetCalls++;
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  /**
   * Calculate cache hit rate as percentage
   */
  getCacheHitRate(): number {
    if (this.metrics.totalCalls === 0) return 0;
    return (this.metrics.cachedCalls / this.metrics.totalCalls) * 100;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalCalls: 0,
      cachedCalls: 0,
      totalCost: 0,
      savedCost: 0,
      haikuCalls: 0,
      sonnetCalls: 0,
    };
  }

  /**
   * Persist metrics to database
   */
  async persistMetrics(userId: string): Promise<void> {
    try {
      await supabase.from('mcp_cost_metrics').insert({
        user_id: userId,
        total_calls: this.metrics.totalCalls,
        cached_calls: this.metrics.cachedCalls,
        total_cost: this.metrics.totalCost,
        saved_cost: this.metrics.savedCost,
        haiku_calls: this.metrics.haikuCalls,
        sonnet_calls: this.metrics.sonnetCalls,
        cache_hit_rate: this.getCacheHitRate(),
      });
    } catch {
      // Error handled silently - metrics are nice-to-have
    }
  }
}
