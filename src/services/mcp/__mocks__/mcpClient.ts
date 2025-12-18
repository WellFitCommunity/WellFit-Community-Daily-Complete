/**
 * Mock MCP Client for Jest tests
 * Prevents module resolution errors with @modelcontextprotocol/sdk
 */

export interface MCPConfig {
  serverCommand?: string;
  serverArgs?: string[];
  serverEnv?: Record<string, string>;
  edgeFunctionUrl?: string;
}

export interface MCPCallOptions {
  tool: string;
  arguments: Record<string, unknown>;
  userId?: string;
  timeout?: number;
}

export interface MCPResponse<T = unknown> {
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

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async callTool<T = unknown>(options: MCPCallOptions): Promise<MCPResponse<T>> {
    return {
      content: [{ type: 'text', text: 'mock response' }],
      metadata: {
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        responseTimeMs: 100,
        model: 'mock-model'
      }
    };
  }

  async close(): Promise<void> {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
