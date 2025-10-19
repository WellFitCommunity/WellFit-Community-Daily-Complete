/**
 * MCP Helper Functions Tests
 * Ensures MCP integration remains stable and functional
 */

import { analyzeText, generateSuggestion, summarizeContent } from '../mcpHelpers';
import { getMCPClient } from '../mcpClient';

// Mock the MCP client
jest.mock('../mcpClient', () => ({
  getMCPClient: jest.fn()
}));

describe('MCP Helper Functions', () => {
  let mockClient: any;

  beforeEach(() => {
    // Create a fresh mock client for each test
    mockClient = {
      callTool: jest.fn(),
      initialize: jest.fn(),
      listTools: jest.fn(),
      close: jest.fn()
    };

    (getMCPClient as jest.Mock).mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeText', () => {
    it('should call MCP with correct parameters', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Analysis result' }],
        metadata: {
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.005,
          responseTimeMs: 1200
        }
      });

      const result = await analyzeText({
        text: 'Patient has chest pain',
        prompt: 'Extract symptoms',
        userId: 'user123'
      });

      expect(result).toBe('Analysis result');
      expect(mockClient.callTool).toHaveBeenCalledWith({
        tool: 'analyze-text',
        arguments: {
          text: 'Patient has chest pain',
          prompt: 'Extract symptoms',
          model: 'claude-sonnet-4-5-20250929'
        },
        userId: 'user123'
      });
    });

    it('should use custom model when provided', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Result' }]
      });

      await analyzeText({
        text: 'Test',
        prompt: 'Test prompt',
        model: 'claude-haiku-4-5-20250929'
      });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            model: 'claude-haiku-4-5-20250929'
          })
        })
      );
    });

    it('should handle empty response gracefully', async () => {
      mockClient.callTool.mockResolvedValue({
        content: []
      });

      const result = await analyzeText({
        text: 'Test',
        prompt: 'Test'
      });

      expect(result).toBe('');
    });

    it('should throw error when MCP call fails', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Network error'));

      await expect(
        analyzeText({
          text: 'Test',
          prompt: 'Test'
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('generateSuggestion', () => {
    it('should generate suggestions with context', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Suggested action' }]
      });

      const result = await generateSuggestion({
        context: { encounterType: 'urgent care' },
        task: 'Suggest billing codes',
        userId: 'doc456'
      });

      expect(result).toBe('Suggested action');
      expect(mockClient.callTool).toHaveBeenCalledWith({
        tool: 'generate-suggestion',
        arguments: {
          context: { encounterType: 'urgent care' },
          task: 'Suggest billing codes',
          model: 'claude-haiku-4-5-20250929'
        },
        userId: 'doc456'
      });
    });

    it('should use Haiku model by default for cost efficiency', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Result' }]
      });

      await generateSuggestion({
        context: {},
        task: 'Generate codes'
      });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            model: 'claude-haiku-4-5-20250929'
          })
        })
      );
    });
  });

  describe('summarizeContent', () => {
    it('should summarize with default max length', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Summary' }]
      });

      const result = await summarizeContent({
        content: 'Long patient history...',
        userId: 'nurse789'
      });

      expect(result).toBe('Summary');
      expect(mockClient.callTool).toHaveBeenCalledWith({
        tool: 'summarize',
        arguments: {
          content: 'Long patient history...',
          maxLength: 500,
          model: 'claude-haiku-4-5-20250929'
        },
        userId: 'nurse789'
      });
    });

    it('should respect custom max length', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Brief summary' }]
      });

      await summarizeContent({
        content: 'Content',
        maxLength: 200
      });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            maxLength: 200
          })
        })
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle medical coding workflow', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            cpt: ['99213'],
            icd10: ['I10'],
            hcpcs: []
          })
        }],
        metadata: {
          cost: 0.003,
          responseTimeMs: 800
        }
      });

      const result = await generateSuggestion({
        context: {
          chiefComplaint: 'Chest pain',
          diagnosis: 'Hypertension'
        },
        task: 'Generate billing codes'
      });

      const codes = JSON.parse(result);
      expect(codes).toHaveProperty('cpt');
      expect(codes).toHaveProperty('icd10');
      expect(codes.cpt).toContain('99213');
    });

    it('should handle nurse handoff summary workflow', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Patient stable, vitals normal, continue current medications'
        }]
      });

      const summary = await summarizeContent({
        content: 'Patient admitted with chest pain. ECG normal. Cardiac enzymes negative...',
        maxLength: 100,
        userId: 'nurse1'
      });

      expect(summary).toContain('stable');
      expect(summary.length).toBeLessThan(200); // Reasonable summary length
    });
  });

  describe('Error handling', () => {
    it('should handle network timeouts', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Request timeout'));

      await expect(
        analyzeText({ text: 'Test', prompt: 'Test' })
      ).rejects.toThrow('Request timeout');
    });

    it('should handle malformed responses', async () => {
      mockClient.callTool.mockResolvedValue({
        content: null
      });

      const result = await analyzeText({
        text: 'Test',
        prompt: 'Test'
      });

      expect(result).toBe('');
    });

    it('should handle API errors', async () => {
      mockClient.callTool.mockRejectedValue(
        new Error('Anthropic API rate limit exceeded')
      );

      await expect(
        generateSuggestion({ context: {}, task: 'Test' })
      ).rejects.toThrow('rate limit');
    });
  });

  describe('De-identification compliance', () => {
    it('should pass PHI to MCP which handles de-identification', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Analysis without PHI' }]
      });

      // We pass PHI - MCP server handles de-identification
      await analyzeText({
        text: 'John Doe, SSN: 123-45-6789, email: john@example.com',
        prompt: 'Analyze patient record'
      });

      // MCP should have been called (de-identification happens server-side)
      expect(mockClient.callTool).toHaveBeenCalled();
    });
  });
});
