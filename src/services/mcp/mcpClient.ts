/**
 * MCP Client Wrapper
 * Provides a clean TypeScript interface for MCP operations
 * Handles errors, retries, and logging
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPConfig {
  serverCommand?: string;
  serverArgs?: string[];
  serverEnv?: Record<string, string>;
  edgeFunctionUrl?: string;
}

export interface MCPCallOptions {
  tool: string;
  arguments: Record<string, any>;
  userId?: string;
  timeout?: number;
}

export interface MCPResponse<T = any> {
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
  private client: Client | null = null;
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

    try {
      // For edge function mode (recommended)
      if (this.config.edgeFunctionUrl) {
        this.initialized = true;
        return;
      }

      // For stdio mode (local development)
      if (this.config.serverCommand) {
        const transport = new StdioClientTransport({
          command: this.config.serverCommand,
          args: this.config.serverArgs || [],
          env: this.config.serverEnv || {}
        });

        this.client = new Client({
          name: 'wellfit-mcp-client',
          version: '1.0.0'
        }, {
          capabilities: {}
        });

        await this.client.connect(transport);
        this.initialized = true;
      }
    } catch (error) {
      console.error('[MCP Client] Initialization failed:', error);
      throw new Error(`MCP initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool<T = any>(options: MCPCallOptions): Promise<MCPResponse<T>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const timeout = options.timeout || 30000; // 30s default
    const startTime = Date.now();

    try {
      // Edge function mode (production)
      if (this.config.edgeFunctionUrl) {
        // Get auth token from Supabase session
        const getAuthToken = () => {
          try {
            // Try to get from localStorage (Supabase stores it here)
            const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
            if (authData) {
              const parsed = JSON.parse(authData);
              return parsed.access_token || '';
            }
          } catch (e) {
            console.warn('[MCP] Could not retrieve auth token:', e);
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

      // Stdio mode (local development)
      if (this.client) {
        const result = await this.client.callTool({
          name: options.tool,
          arguments: options.arguments
        });

        return {
          content: (result.content || []) as Array<{ type: string; text: string }>,
          metadata: {
            responseTimeMs: Date.now() - startTime
          }
        };
      }

      throw new Error('MCP client not initialized');

    } catch (error) {
      console.error('[MCP Client] Tool call failed:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (this.config.edgeFunctionUrl) {
        const response = await fetch(this.config.edgeFunctionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'tools/list' })
        });

        const data = await response.json();
        return data.tools || [];
      }

      if (this.client) {
        const result = await this.client.listTools();
        return result.tools || [];
      }

      return [] as any[];
    } catch (error) {
      console.error('[MCP Client] List tools failed:', error);
      return [];
    }
  }

  /**
   * Close the client connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.initialized = false;
    }
  }
}

/**
 * Factory function to create MCP client for Claude operations
 */
export function createClaudeMCPClient(): MCPClient {
  // Get Supabase URL from environment
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SB_URL;

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
