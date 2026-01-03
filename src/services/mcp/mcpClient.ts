/**
 * MCP Client Wrapper - Browser-Safe Version
 *
 * Provides a clean TypeScript interface for MCP operations via Edge Functions.
 * This version does NOT import the MCP SDK (which requires Node.js) to ensure
 * compatibility with browser bundlers.
 *
 * All AI operations are proxied through Supabase Edge Functions.
 * For local development with stdio transport, use the separate mcpClientNode.ts file.
 */

export interface MCPConfig {
  edgeFunctionUrl?: string;
}

export interface MCPCallOptions {
  tool: string;
  arguments: Record<string, unknown>;
  userId?: string;
  timeout?: number;
}

export interface MCPResponse<_T = unknown> {
  content: Array<{ type: string; text: string }>;
  metadata?: {
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    responseTimeMs?: number;
    model?: string;
  };
}

export class MCPClient {
  private config: MCPConfig;
  private initialized = false;

  constructor(config: MCPConfig) {
    this.config = config;
  }

  /**
   * Initialize the MCP client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.edgeFunctionUrl) {
      throw new Error('Edge Function URL required for browser MCP client');
    }

    this.initialized = true;
  }

  /**
   * Call an MCP tool via Edge Function
   */
  async callTool<T = unknown>(options: MCPCallOptions): Promise<MCPResponse<T>> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.config.edgeFunctionUrl) {
      throw new Error('Edge Function URL not configured');
    }

    const timeout = options.timeout || 30000; // 30s default

    // Get auth token from Supabase session
    const getAuthToken = () => {
      try {
        // Try to get from localStorage (Supabase stores it here)
        const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
        if (authData) {
          const parsed = JSON.parse(authData);
          return parsed.access_token || '';
        }
      } catch {
        // Ignore errors
      }
      return '';
    };

    const response = await fetch(this.config.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: options.tool,
          arguments: {
            ...options.arguments,
            userId: options.userId
          }
        }
      }),
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeout) : undefined
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'MCP call failed');
    }

    return await response.json();
  }

  /**
   * List available tools
   */
  async listTools(): Promise<unknown[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.config.edgeFunctionUrl) {
      return [];
    }

    try {
      const response = await fetch(this.config.edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'tools/list' })
      });

      const data = await response.json();
      return data.tools || [];
    } catch {
      return [];
    }
  }

  /**
   * Close the client connection (no-op for Edge Function mode)
   */
  async close(): Promise<void> {
    this.initialized = false;
  }
}

/**
 * Factory function to create MCP client for Claude operations
 */
export function createClaudeMCPClient(): MCPClient {
  // Get Supabase URL from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SB_URL;

  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  return new MCPClient({
    edgeFunctionUrl: `${supabaseUrl}/functions/v1/mcp-claude-server`
  });
}

/**
 * Singleton instance for easy import
 */
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = createClaudeMCPClient();
  }
  return mcpClientInstance;
}
