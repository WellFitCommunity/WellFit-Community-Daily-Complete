/**
 * MCP Client Tests
 * Tests the low-level MCP client functionality
 */

// Mock the MCP SDK before importing
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn()
}));
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn()
}));

import { MCPClient, createClaudeMCPClient } from '../mcpClient';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
(global as any).localStorage = mockLocalStorage;

describe('MCPClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, REACT_APP_SUPABASE_URL: 'https://test.supabase.co' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should create client with edge function URL', () => {
      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server'
      });

      expect(client).toBeInstanceOf(MCPClient);
    });

    it('should create client from factory function', () => {
      const client = createClaudeMCPClient();
      expect(client).toBeInstanceOf(MCPClient);
    });

    it('should throw error if Supabase URL not configured', () => {
      const savedEnv = process.env.REACT_APP_SUPABASE_URL;
      delete (process.env as any).REACT_APP_SUPABASE_URL;
      delete (process.env as any).REACT_APP_SB_URL;

      expect(() => createClaudeMCPClient()).toThrow('Supabase URL not configured');

      // Restore
      if (savedEnv) process.env.REACT_APP_SUPABASE_URL = savedEnv;
    });
  });

  describe('callTool', () => {
    it('should make HTTP request to edge function', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }],
          metadata: { cost: 0.001 }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ access_token: 'test-token' })
      );

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server'
      });

      const result = await client.callTool({
        tool: 'analyze-text',
        arguments: { text: 'Test', prompt: 'Test' },
        userId: 'user123'
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('Result');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/mcp-claude-server',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: { message: 'Server error' }
        })
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server'
      });

      await expect(
        client.callTool({
          tool: 'analyze-text',
          arguments: { text: 'Test', prompt: 'Test' }
        })
      ).rejects.toThrow('Server error');
    });

    it('should handle missing auth token gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Result' }]
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server'
      });

      await client.callTool({
        tool: 'analyze-text',
        arguments: { text: 'Test', prompt: 'Test' }
      });

      // Should still make the call with empty auth
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer '
          })
        })
      );
    });
  });

  describe('listTools', () => {
    it('should fetch available tools', async () => {
      const mockTools = [
        { name: 'analyze-text', description: 'Analyze text' },
        { name: 'summarize', description: 'Summarize content' }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ tools: mockTools })
      });

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server'
      });

      const tools = await client.listTools();

      expect(tools).toEqual(mockTools);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ method: 'tools/list' })
        })
      );
    });

    it('should return empty array on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const client = new MCPClient({
        edgeFunctionUrl: 'https://test.supabase.co/functions/v1/mcp-claude-server'
      });

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });
  });
});
