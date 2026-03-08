/**
 * MCP Helper Functions
 * Convenient wrappers for common MCP operations
 */

import { getMCPClient } from './mcpClient';
import { HAIKU_MODEL, SONNET_MODEL } from '../../constants/aiModels';

/**
 * Extract Supabase auth token from localStorage using the project ref
 * derived from VITE_SUPABASE_URL. Eliminates hardcoded project IDs.
 */
export function getSupabaseAuthToken(): string {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    // URL format: https://<project-ref>.supabase.co
    const match = supabaseUrl.match(/\/\/([^.]+)\.supabase/);
    if (!match) return '';
    const projectRef = match[1];
    const authData = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (authData) {
      const parsed = JSON.parse(authData) as Record<string, unknown>;
      return (parsed.access_token as string) || '';
    }
  } catch {
    // Ignore parse errors
  }
  return '';
}

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
      model: params.model || SONNET_MODEL
    },
    userId: params.userId
  });

  return response.content?.[0]?.text || '';
}

/**
 * Generate AI suggestions
 */
export async function generateSuggestion(params: {
  context: Record<string, unknown>;
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
      model: params.model || HAIKU_MODEL
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
      model: params.model || HAIKU_MODEL
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

const lastStats: MCPUsageStats | null = null;

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
