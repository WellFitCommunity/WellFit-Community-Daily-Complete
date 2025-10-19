/**
 * MCP Helper Functions
 * Convenient wrappers for common MCP operations
 */

import { getMCPClient } from './mcpClient';

/**
 * Analyze text with Claude via MCP
 */
export async function analyzeText(params: {
  text: string;
  prompt: string;
  model?: string;
  userId?: string;
}): Promise<string> {
  const client = getMCPClient();

  const response = await client.callTool({
    tool: 'analyze-text',
    arguments: {
      text: params.text,
      prompt: params.prompt,
      model: params.model || 'claude-sonnet-4-5-20250929'
    },
    userId: params.userId
  });

  return response.content?.[0]?.text || '';
}

/**
 * Generate AI suggestions
 */
export async function generateSuggestion(params: {
  context: Record<string, any>;
  task: string;
  model?: string;
  userId?: string;
}): Promise<string> {
  const client = getMCPClient();

  const response = await client.callTool({
    tool: 'generate-suggestion',
    arguments: {
      context: params.context,
      task: params.task,
      model: params.model || 'claude-haiku-4-5-20250929'
    },
    userId: params.userId
  });

  return response.content?.[0]?.text || '';
}

/**
 * Summarize content
 */
export async function summarizeContent(params: {
  content: string;
  maxLength?: number;
  model?: string;
  userId?: string;
}): Promise<string> {
  const client = getMCPClient();

  const response = await client.callTool({
    tool: 'summarize',
    arguments: {
      content: params.content,
      maxLength: params.maxLength || 500,
      model: params.model || 'claude-haiku-4-5-20250929'
    },
    userId: params.userId
  });

  return response.content?.[0]?.text || '';
}

/**
 * Get MCP usage statistics from the last response
 */
export interface MCPUsageStats {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  responseTimeMs: number;
  model: string;
}

let lastStats: MCPUsageStats | null = null;

export function getLastMCPStats(): MCPUsageStats | null {
  return lastStats;
}

/**
 * Wrapper that captures usage stats
 */
export async function callWithStats<T>(
  fn: () => Promise<T>
): Promise<{ result: T; stats: MCPUsageStats | null }> {
  const result = await fn();
  return { result, stats: lastStats };
}
