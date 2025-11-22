/**
 * Mock MCP Cost Optimizer for Jest tests
 */

export interface AICallOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  cacheKey?: string;
}

export interface AIResponse {
  response: string;
  cost: number;
  model: string;
  fromCache: boolean;
  inputTokens?: number;
  outputTokens?: number;
  responseTimeMs?: number;
}

export class MCPCostOptimizer {
  async call(options: AICallOptions): Promise<AIResponse> {
    return {
      response: 'mock AI response',
      cost: 0.001,
      model: 'claude-haiku-4-5-20250929',
      fromCache: false,
      inputTokens: 100,
      outputTokens: 50,
      responseTimeMs: 100
    };
  }

  async clearCache(userId?: string): Promise<void> {
    // Mock implementation
  }

  async getCacheStats(userId?: string): Promise<{
    totalCalls: number;
    cachedCalls: number;
    totalCost: number;
    savedCost: number;
  }> {
    return {
      totalCalls: 0,
      cachedCalls: 0,
      totalCost: 0,
      savedCost: 0
    };
  }
}
