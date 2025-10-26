// Claude Edge Function Service - Secure server-side Claude API calls
// This replaces the insecure client-side claudeService for production use

import { supabase } from '../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeChatRequest {
  messages: ClaudeMessage[];
  model?: string;
  max_tokens?: number;
  system?: string;
}

export interface ClaudeChatResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeEdgeService {
  private static instance: ClaudeEdgeService | null = null;
  private supabase: SupabaseClient;

  private constructor() {
    // Use the singleton Supabase client - DO NOT create a new client
    this.supabase = supabase;
  }

  public static getInstance(): ClaudeEdgeService {
    if (!ClaudeEdgeService.instance) {
      ClaudeEdgeService.instance = new ClaudeEdgeService();
    }
    return ClaudeEdgeService.instance;
  }

  /**
   * Send a chat request to Claude via secure Edge Function
   */
  async chat(request: ClaudeChatRequest): Promise<ClaudeChatResponse> {
    try {
      const { data, error } = await this.supabase.functions.invoke('claude-chat', {
        body: request,
      });

      if (error) {
        console.error('[Claude Edge] Error:', error);
        throw new Error(`Claude API error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No response from Claude API');
      }

      return data as ClaudeChatResponse;
    } catch (error) {
      console.error('[Claude Edge] Request failed:', error);
      throw error;
    }
  }

  /**
   * Simple text completion helper
   */
  async complete(
    prompt: string,
    options?: {
      model?: string;
      max_tokens?: number;
      system?: string;
    }
  ): Promise<string> {
    const response = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      model: options?.model || 'claude-haiku-4-5-20250919', // Default to Haiku 4.5 for speed
      max_tokens: options?.max_tokens || 4000,
      system: options?.system,
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.text || '';
  }

  /**
   * Test the Edge Function connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.complete('Hello, please respond with "OK"', {
        max_tokens: 10,
      });

      return {
        success: true,
        message: `Claude Edge Function is working. Response: ${response}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Claude Edge Function failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; mode: string } {
    return {
      initialized: true,
      mode: 'edge-function', // Secure server-side mode
    };
  }
}

// Export singleton instance
export const claudeEdgeService = ClaudeEdgeService.getInstance();
export default claudeEdgeService;
