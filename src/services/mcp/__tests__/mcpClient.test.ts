/**
 * MCP Client Tests
 * Tests the browser-safe MCP client functionality
 */

import { describe, test, expect, beforeEach, vi, type Mock as _Mock } from 'vitest';
import { MCPClient, createClaudeMCPClient } from '../mcpClient';

// Mock import.meta.env
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

// Mock localStorage
const mockLocalStorage: { [key: string]: string } = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  }),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('MCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  describe('initialization', () => {
    test('should create client with edge function URL', () => {
      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      expect(client).toBeInstanceOf(MCPClient);
    });

    test('should initialize successfully with valid config', async () => {
      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await expect(client.initialize()).resolves.toBeUndefined();
    });

    test('should throw error if edge function URL not configured', async () => {
      const client = new MCPClient({});

      await expect(client.initialize()).rejects.toThrow('Edge Function URL required');
    });
  });

  describe('createClaudeMCPClient factory', () => {
    test('should create client from factory function', () => {
      const client = createClaudeMCPClient();
      expect(client).toBeInstanceOf(MCPClient);
    });

    test('should throw error if Supabase URL not configured', () => {
      // Temporarily remove env var
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SB_URL', '');

      expect(() => createClaudeMCPClient()).toThrow('Supabase URL not configured');

      // Restore
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    });
  });

  describe('callTool', () => {
    test('should make HTTP request to edge function', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Result' }],
        metadata: { cost: 0.001 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      // Setup localStorage with auth token
      mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'] = JSON.stringify({
        access_token: 'test-token',
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      const result = await client.callTool({
        tool: 'analyze-text',
        arguments: { text: 'Test', prompt: 'Test' },
        userId: 'user123',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('Result');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/mcp-claude-server',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    test('should include auth token in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }],
        }),
      });

      mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'] = JSON.stringify({
        access_token: 'my-auth-token',
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await client.callTool({
        tool: 'test-tool',
        arguments: { input: 'test' },
      });

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer my-auth-token');
    });

    test('should handle fetch errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: { message: 'Server error' },
        }),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await expect(
        client.callTool({
          tool: 'analyze-text',
          arguments: { text: 'Test', prompt: 'Test' },
        })
      ).rejects.toThrow('Server error');
    });

    test('should handle generic error without message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await expect(
        client.callTool({
          tool: 'analyze-text',
          arguments: { text: 'Test' },
        })
      ).rejects.toThrow('MCP call failed');
    });

    test('should handle missing auth token gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }],
        }),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await client.callTool({
        tool: 'analyze-text',
        arguments: { text: 'Test', prompt: 'Test' },
      });

      // Should still make the call with empty auth
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer ');
    });

    test('should include userId in arguments when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }],
        }),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await client.callTool({
        tool: 'test-tool',
        arguments: { input: 'test' },
        userId: 'user-456',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.params.arguments.userId).toBe('user-456');
    });

    test('should send correct method and params structure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }],
        }),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await client.callTool({
        tool: 'my-custom-tool',
        arguments: { foo: 'bar', baz: 123 },
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.method).toBe('tools/call');
      expect(body.params.name).toBe('my-custom-tool');
      expect(body.params.arguments.foo).toBe('bar');
      expect(body.params.arguments.baz).toBe(123);
    });
  });

  describe('listTools', () => {
    test('should fetch available tools', async () => {
      const mockTools = [
        { name: 'analyze-text', description: 'Analyze text' },
        { name: 'summarize', description: 'Summarize content' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ tools: mockTools }),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      const tools = await client.listTools();

      expect(tools).toEqual(mockTools);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/mcp-claude-server',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ method: 'tools/list' }),
        })
      );
    });

    test('should return empty array on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });

    test('should return empty array when no edge function URL', async () => {
      const client = new MCPClient({});

      // Force initialized state to skip URL check
      (client as unknown as { initialized: boolean }).initialized = true;

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });

    test('should return empty array when response has no tools', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });
  });

  describe('close', () => {
    test('should reset initialized state', async () => {
      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      await client.initialize();
      await client.close();

      // Client should re-initialize on next call
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }],
        }),
      });

      await client.callTool({
        tool: 'test',
        arguments: {},
      });

      // Should work without error
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('MCPResponse type', () => {
    test('should handle response with full metadata', async () => {
      const fullResponse = {
        content: [{ type: 'text', text: 'Analysis result' }],
        metadata: {
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.002,
          responseTimeMs: 1500,
          model: 'claude-3-sonnet',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(fullResponse),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      const result = await client.callTool({
        tool: 'analyze',
        arguments: { text: 'test' },
      });

      expect(result.metadata?.inputTokens).toBe(100);
      expect(result.metadata?.outputTokens).toBe(50);
      expect(result.metadata?.cost).toBe(0.002);
      expect(result.metadata?.model).toBe('claude-3-sonnet');
    });

    test('should handle response without metadata', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Simple result' }],
        }),
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server',
      });

      const result = await client.callTool({
        tool: 'simple-tool',
        arguments: {},
      });

      expect(result.content[0].text).toBe('Simple result');
      expect(result.metadata).toBeUndefined();
    });
  });
});
