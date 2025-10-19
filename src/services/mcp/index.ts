/**
 * MCP Service - Main Export
 * Import from here for clean, simple imports
 */

// Helper functions (most common use)
export {
  analyzeText,
  generateSuggestion,
  summarizeContent,
  getLastMCPStats,
  callWithStats,
  type MCPUsageStats
} from './mcpHelpers';

// Drop-in replacements for existing Claude service
export {
  analyzeWithClaude,
  generateCodingSuggestions,
  summarizeClinicalNotes,
  generateDashboardRecommendations,
  type ClaudeRequest,
  type ClaudeResponse
} from './claudeServiceMCP';

// Advanced: Direct client access (if needed)
export {
  getMCPClient,
  createClaudeMCPClient,
  MCPClient,
  type MCPConfig,
  type MCPCallOptions,
  type MCPResponse
} from './mcpClient';
