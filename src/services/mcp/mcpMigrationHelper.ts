// =====================================================
// MCP MIGRATION HELPER
// Purpose: Drop-in replacement for claudeService.ts
// Provides backward compatibility while using MCP under the hood
// =====================================================

import { mcpOptimizer } from './mcpCostOptimizer';

/**
 * Drop-in replacement for existing claudeService
 * Usage: Just change import from './claudeService' to './mcp/mcpMigrationHelper'
 */
export const claudeService = {
  /**
   * Analyze text with Claude (MCP-optimized)
   */
  async analyze(options: {
    prompt: string;
    context?: Record<string, unknown>;
    userId?: string;
    model?: 'haiku' | 'sonnet';
  }): Promise<string> {
    const modelMap = {
      haiku: 'claude-haiku-4-5-20250929',
      sonnet: 'claude-sonnet-4-5-20250929',
    };

    const result = await mcpOptimizer.call({
      prompt: options.prompt,
      context: options.context,
      model: options.model ? modelMap[options.model] : undefined,
      userId: options.userId,
    });

    return result.response;
  },

  /**
   * Generate suggestions (MCP-optimized with caching)
   */
  async generateSuggestion(options: {
    task: string;
    context: Record<string, unknown>;
    userId?: string;
  }): Promise<string> {
    const result = await mcpOptimizer.call({
      prompt: options.task,
      context: options.context,
      complexity: 'medium',
      userId: options.userId,
    });

    return result.response;
  },

  /**
   * Summarize content (MCP-optimized, uses Haiku for cost savings)
   */
  async summarize(options: {
    content: string;
    maxLength?: number;
    userId?: string;
  }): Promise<string> {
    const result = await mcpOptimizer.call({
      prompt: `Summarize the following content in ${options.maxLength || 500} words or less.`,
      context: { content: options.content },
      complexity: 'simple',
      model: 'claude-haiku-4-5-20250929',
      userId: options.userId,
    });

    return result.response;
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; model: string }> {
    try {
      const result = await mcpOptimizer.call({
        prompt: 'Say "OK" if you are working.',
        complexity: 'simple',
        model: 'claude-haiku-4-5-20250929',
      });

      return {
        status: result.response.includes('OK') ? 'healthy' : 'unhealthy',
        model: result.model,
      };
    } catch {
      return {
        status: 'unhealthy',
        model: 'unknown',
      };
    }
  },

  /**
   * Get cost metrics
   */
  getMetrics() {
    return mcpOptimizer.getMetrics();
  },

  /**
   * Get cache hit rate
   */
  getCacheHitRate() {
    return mcpOptimizer.getCacheHitRate();
  },
};

/**
 * Specialized MCP-optimized services for high-volume tasks
 */
export const mcpServices = {
  /**
   * Billing code generation - Optimized for caching
   */
  async generateBillingCodes(encounterData: Record<string, unknown>, userId?: string) {
    return mcpOptimizer.generateBillingCodes(encounterData, userId);
  },

  /**
   * SOAP note generation - Optimized for caching
   */
  async generateSOAPNote(transcription: string, userId?: string) {
    return mcpOptimizer.generateSOAPNote(transcription, userId);
  },

  /**
   * Dashboard recommendations - Uses Haiku for cost savings
   */
  async getDashboardRecommendations(userBehavior: Record<string, unknown>, userId?: string) {
    return mcpOptimizer.getDashboardRecommendations(userBehavior, userId);
  },

  /**
   * Medication extraction - Medium complexity
   */
  async extractMedications(imageText: string, userId?: string) {
    return mcpOptimizer.extractMedications(imageText, userId);
  },

  /**
   * Get cost savings report
   */
  async getCostReport(userId: string) {
    return mcpOptimizer.generateCostReport(userId);
  },
};
