/**
 * Claude edge-function transport (server-side Anthropic API proxy)
 *
 * Extracted from claudeService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 * The Anthropic API key is stored in Supabase secrets, never exposed to the browser.
 */

import { supabase } from '../../lib/supabaseClient';
import { ClaudeServiceError } from './errors';

// Response shape from the claude-chat edge function (proxied Anthropic API response)
export interface EdgeFunctionResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Call the claude-chat edge function (server-side Anthropic API proxy).
 * The API key is stored in Supabase secrets, never exposed to the browser.
 */
export async function callEdgeFunction(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string,
  maxTokens: number,
  system?: string
): Promise<EdgeFunctionResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SB_PUBLISHABLE_API_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new ClaudeServiceError(
      'Supabase configuration missing for edge function proxy',
      'CONFIG_ERROR',
      500
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ClaudeServiceError(
      'User not authenticated — cannot call Claude API proxy',
      'AUTH_ERROR',
      401
    );
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/claude-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({
      messages,
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as Record<string, unknown>;
    const errorMsg = (errorData.error as string) || `Edge function returned ${response.status}`;
    throw new ClaudeServiceError(
      errorMsg,
      'EDGE_FUNCTION_ERROR',
      response.status
    );
  }

  return await response.json() as EdgeFunctionResponse;
}
