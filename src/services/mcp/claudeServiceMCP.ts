/**
 * Claude Service (MCP Version)
 * Replaces direct Anthropic SDK calls with MCP
 * Drop-in replacement for existing claudeService.ts
 */

import { analyzeText, generateSuggestion, summarizeContent } from './mcpHelpers';

export interface ClaudeRequest {
  prompt: string;
  context?: Record<string, unknown>;
  model?: 'haiku' | 'sonnet';
  maxTokens?: number;
  userId?: string;
}

export interface ClaudeResponse {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
}

/**
 * Main Claude analysis function
 * Uses MCP under the hood for better caching and cost optimization
 */
export async function analyzeWithClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const modelMap = {
    'haiku': 'claude-haiku-4-5-20250929',
    'sonnet': 'claude-sonnet-4-5-20250929'
  };

  const model = modelMap[request.model || 'sonnet'];

  const text = await analyzeText({
    text: request.context ? JSON.stringify(request.context) : '',
    prompt: request.prompt,
    model,
    userId: request.userId
  });

  return {
    text,
    usage: {
      inputTokens: 0, // Will be populated by MCP metadata
      outputTokens: 0,
      cost: 0
    }
  };
}

/**
 * Generate medical coding suggestions
 * MCP-powered version of your billing assistant
 */
export async function generateCodingSuggestions(params: {
  encounterData: Record<string, unknown>;
  userId?: string;
}): Promise<unknown> {
  const suggestion = await generateSuggestion({
    context: params.encounterData,
    task: 'Generate CPT, HCPCS, and ICD-10 codes for this encounter. Return strict JSON format.',
    model: 'claude-sonnet-4-5-20250929',
    userId: params.userId
  });

  try {
    return JSON.parse(suggestion);
  } catch {
    return { error: 'Failed to parse coding suggestions', raw: suggestion };
  }
}

/**
 * Summarize clinical notes
 */
export async function summarizeClinicalNotes(params: {
  notes: string;
  maxLength?: number;
  userId?: string;
}): Promise<string> {
  return await summarizeContent({
    content: params.notes,
    maxLength: params.maxLength || 500,
    model: 'claude-haiku-4-5-20250929',
    userId: params.userId
  });
}

/**
 * Generate personalized dashboard recommendations
 */
export async function generateDashboardRecommendations(params: {
  userBehavior: Record<string, unknown>;
  userId?: string;
}): Promise<unknown> {
  const suggestion = await generateSuggestion({
    context: params.userBehavior,
    task: 'Analyze this admin behavior and suggest workflow improvements. Return JSON with top 3 recommendations.',
    model: 'claude-haiku-4-5-20250929',
    userId: params.userId
  });

  try {
    return JSON.parse(suggestion);
  } catch {
    return { recommendations: [], raw: suggestion };
  }
}
