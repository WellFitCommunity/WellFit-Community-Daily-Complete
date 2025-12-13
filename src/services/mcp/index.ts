/**
 * MCP Service - Main Export
 * Import from here for clean, simple imports
 *
 * Available MCP Servers:
 * 1. Claude MCP - AI operations with cost optimization
 * 2. PostgreSQL MCP - Safe database queries
 * 3. Edge Functions MCP - Workflow orchestration
 * 4. Medical Codes MCP - CPT/ICD-10/HCPCS lookups
 */

// =====================================================
// CLAUDE MCP (AI Operations)
// =====================================================

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

// Advanced: Direct Claude client access
export {
  getMCPClient,
  createClaudeMCPClient,
  MCPClient,
  type MCPConfig,
  type MCPCallOptions,
  type MCPResponse
} from './mcpClient';

// Cost optimizer
export { MCPCostOptimizer, mcpOptimizer } from './mcpCostOptimizer';

// =====================================================
// POSTGRESQL MCP (Database Queries)
// =====================================================

export {
  // Convenience functions
  getDashboardMetrics,
  getPatientRiskDistribution,
  getReadmissionRiskSummary,
  getEncounterSummary,
  getSDOHFlagsSummary,
  getMedicationAdherenceStats,
  getClaimsStatusSummary,
  getBillingRevenueSummary,
  getCarePlanSummary,
  getTaskCompletionRate,
  getReferralSummary,
  getBedAvailability,
  getShiftHandoffSummary,
  getQualityMetrics,
  // Client class
  postgresMCP,
  PostgresMCPClient,
  // Types
  type PostgresQueryResult,
  type QueryDefinition,
  type WhitelistedQueryName
} from './mcpPostgresClient';

// =====================================================
// EDGE FUNCTIONS MCP (Workflow Orchestration)
// =====================================================

export {
  // Analytics functions
  getWelfarePriorities,
  calculateReadmissionRisk,
  runSDOHDetection,
  // Report functions
  generateEngagementReport,
  generateQualityReport,
  // Integration functions
  exportPatientFHIR,
  generate837PClaim,
  // Workflow functions
  processShiftHandoff,
  createCareAlert,
  // Utility functions
  sendSMS,
  // Client class
  edgeFunctionsMCP,
  EdgeFunctionsMCPClient,
  // Types
  type FunctionCategory,
  type FunctionDefinition,
  type FunctionInvocationResult,
  type BatchInvocationResult,
  type AllowedFunctionName
} from './mcpEdgeFunctionsClient';

// =====================================================
// MEDICAL CODES MCP (CPT/ICD-10/HCPCS)
// =====================================================

export {
  // Search functions
  searchCPTCodes,
  searchICD10Codes,
  searchHCPCSCodes,
  getCodeModifiers,
  // Validation functions
  validateBillingCodes,
  checkCodeBundling,
  getCodeInfo,
  suggestCodesForDescription,
  // SDOH codes
  getSDOHZCodes,
  // Quick references
  EM_CODES,
  COMMON_MODIFIERS,
  // Client class
  medicalCodesMCP,
  MedicalCodesMCPClient,
  // Types
  type CPTCode,
  type ICD10Code,
  type HCPCSCode,
  type Modifier,
  type BundlingIssue,
  type CodeValidationResult,
  type SDOHCode,
  type SDOHCategory,
  type MedicalCodeResult
} from './mcpMedicalCodesClient';
