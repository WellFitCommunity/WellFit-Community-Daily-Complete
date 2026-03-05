/**
 * MCP Service - Main Export
 * Import from here for clean, simple imports
 *
 * Available MCP Servers:
 * 1. Claude MCP - AI operations with cost optimization
 * 2. PostgreSQL MCP - Safe database queries
 * 3. Edge Functions MCP - Workflow orchestration
 * 4. Medical Codes MCP - CPT/ICD-10/HCPCS lookups
 * 5. FHIR MCP - Healthcare interoperability (FHIR R4)
 * 6. HL7/X12 MCP - Healthcare message transformation
 * 7. Clearinghouse MCP - Claims submission and eligibility
 * 8. Medical Coding MCP - Revenue cycle, DRG grouping, charge aggregation
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
export { MCPCostOptimizer, mcpOptimizer } from './mcp-cost-optimizer';

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

// =====================================================
// FHIR MCP (Healthcare Interoperability)
// =====================================================

export {
  // Bundle operations
  exportPatientFHIRBundle,
  // Patient-centric operations
  getPatientClinicalSummary,
  getPatientMedications,
  getPatientConditions,
  getPatientVitals,
  getPatientLabResults,
  getPatientAllergies,
  getPatientImmunizations,
  getPatientCarePlans,
  getPatientCareTeam,
  getPatientSDOHRisks,
  // Resource operations
  validateFHIRResource,
  createCondition,
  createMedicationRequest,
  createObservation,
  // EHR integration
  listEHRConnections,
  syncPatientWithEHR,
  // LOINC codes reference
  LOINC_CODES,
  // Client class
  fhirMCP,
  FHIRMCPClient,
  // Types
  type FHIRResourceType,
  type FHIRBundle,
  type FHIRPatient,
  type PatientSummary,
  type MedicationListResult,
  type ConditionListResult,
  type SDOHAssessmentResult,
  type CareTeamResult,
  type EHRConnection,
  type ValidationResult,
  type FHIRResult
} from './mcpFHIRClient';

// =====================================================
// HL7/X12 MCP (Healthcare Message Transformation)
// =====================================================

export {
  // HL7 operations
  parseHL7Message,
  convertHL7ToFHIR,
  validateHL7Message,
  generateACK,
  // X12 operations
  generate837PClaim as generateX12Claim,
  parseX12Claim,
  validateX12Claim,
  convertX12ToFHIR,
  // Utility
  getSupportedMessageTypes,
  // Templates and helpers
  HL7_TEMPLATES,
  X12_HELPERS,
  // Client class
  hl7x12MCP,
  HL7X12MCPClient,
  // Types
  type HL7MessageType,
  type HL7Segment,
  type HL7ParsedMessage,
  type HL7ValidationResult,
  type HL7ACK,
  type X12ClaimData,
  type X12GeneratedClaim,
  type X12ParsedClaim,
  type X12ValidationResult,
  type FHIRBundle as HL7FHIRBundle,
  type FHIRClaim,
  type MessageTypeInfo,
  type HL7X12Result
} from './mcpHL7X12Client';

// =====================================================
// CLEARINGHOUSE MCP (Claims & Eligibility)
// =====================================================

export {
  // Claim operations
  submitClaim,
  checkClaimStatus,
  // Eligibility operations
  verifyPatientEligibility,
  // Remittance operations
  processRemittanceAdvice,
  // Prior authorization
  submitPriorAuthorization,
  // Configuration
  testClearinghouseConnection,
  searchPayers,
  getBillingStats,
  // Rejection guidance
  lookupRejectionReason,
  getRejectionsByCategory,
  // Reference data
  SERVICE_TYPE_CODES,
  RELATIONSHIP_CODES,
  ADJUSTMENT_REASON_CODES,
  // Client class
  clearinghouseMCP,
  ClearinghouseMCPClient,
  // Types
  type ClearinghouseProvider,
  type ClaimType,
  type ClaimStatus,
  type PriorAuthUrgency,
  type PayerType,
  type RejectionCategory,
  type ClaimSubmissionData,
  type ClaimSubmissionResult,
  type ClaimStatusRequest,
  type ClaimStatusResponse,
  type EligibilityRequest,
  type EligibilityResponse,
  type RemittanceClaim,
  type RemittanceResult,
  type PriorAuthRequest,
  type PriorAuthResult,
  type ConnectionTestResult,
  type PayerInfo,
  type SubmissionStats,
  type RejectionReason,
  type RejectionGuidance,
  type ClearinghouseResult
} from './mcpClearinghouseClient';

// =====================================================
// NPI REGISTRY MCP (Provider Validation)
// =====================================================

export {
  // Validation functions
  validateNPI,
  bulkValidateNPIs,
  checkNPIDeactivation,
  isValidNPIFormat,
  // Lookup functions
  lookupProviderByNPI,
  getProviderIdentifiers,
  // Search functions
  searchProvidersByName,
  searchOrganizationsByName,
  searchProvidersBySpecialty,
  getTaxonomyCodesForSpecialty,
  // Reference data
  COMMON_TAXONOMY_CODES,
  // Client class
  NPIRegistryMCPClient,
  // Types
  type NPIValidation,
  type ProviderDetails,
  type ProviderTaxonomy,
  type ProviderAddress,
  type ProviderIdentifier,
  type ProviderSearchResult,
  type TaxonomyCode,
  type BulkValidationResult,
  type EnumerationType,
  type NPIRegistryResult
} from './mcpNPIRegistryClient';

// =====================================================
// NPI-to-FHIR MAPPER (Cross-Server Chain)
// =====================================================

export {
  mapNPIToFHIRPractitioner,
  type FHIRPractitionerResource
} from './npiToFHIRMapper';

// =====================================================
// CMS COVERAGE MCP (Medicare Coverage Lookups)
// =====================================================

export {
  // Search functions
  searchLCDs,
  searchNCDs,
  getCoverageRequirements,
  checkPriorAuthRequired as checkCMSPriorAuthRequired,
  // Detail functions
  getLCDDetails,
  getNCDDetails,
  getCoverageArticles,
  getMACContractorInfo,
  // Reference data
  COMMON_PRIOR_AUTH_CODES,
  // Client class
  CMSCoverageMCPClient,
  // Types
  type LCD,
  type NCD,
  type CoverageRequirements,
  type PriorAuthCheck,
  type MACContractorInfo,
  type CoverageArticle,
  type CMSCoverageResult
} from './mcpCMSCoverageClient';

// =====================================================
// PRIOR AUTH MCP (Authorization Lifecycle)
// =====================================================

export {
  // Client class
  priorAuthMCP,
  // Types
  type PriorAuthRequest as PriorAuthMCPRequest,
  type PriorAuthRecord,
  type PriorAuthDecision,
  type PriorAuthAppeal as PriorAuthMCPAppeal,
  type PriorAuthAppealRecord,
  type PriorAuthRequiredCheck,
  type PriorAuthStatistics,
  type FHIRClaimResource,
  type PriorAuthResult as PriorAuthMCPResult
} from './mcpPriorAuthClient';

// =====================================================
// PUBMED MCP (Biomedical Literature Search)
// =====================================================

export {
  // Search functions
  searchPubMed,
  searchClinicalTrials,
  // Article detail functions
  getArticleSummaries,
  getArticleAbstract,
  getArticleCitations,
  // Vocabulary
  getMeSHTerms,
  // Client class
  PubMedMCPClient,
  // Types
  type PubMedArticle,
  type PubMedSearchResult,
  type ArticleSummary,
  type ArticleAbstract,
  type MeSHTerm,
  type PubMedResult
} from './mcpPubMedClient';

// =====================================================
// MEDICAL CODING MCP (Revenue Cycle & DRG Grouping)
// =====================================================

export {
  // Payer rules
  getPayerRules,
  upsertPayerRule,
  // Charge aggregation
  aggregateDailyCharges,
  getDailySnapshot,
  saveDailySnapshot,
  // DRG grouper
  runDRGGrouper,
  getDRGResult,
  // Revenue optimization
  optimizeDailyRevenue,
  validateChargeCompleteness,
  // Revenue projection
  getRevenueProjection,
  // Client class
  MedicalCodingMCPClient,
  // Types
  type PayerType as MedicalCodingPayerType,
  type RuleType,
  type AcuityTier,
  type SnapshotStatus,
  type PayerRule,
  type ChargeCategory,
  type DailyChargeSnapshot,
  type DRGResult,
  type RevenueOptimization,
  type ChargeValidation,
  type RevenueProjection,
  type MedicalCodingResult
} from './mcpMedicalCodingClient';

// =====================================================
// CULTURAL COMPETENCY MCP (Population-Specific Care)
// =====================================================

export {
  // Context functions
  getCulturalContext,
  getClinicalConsiderations,
  getCommunicationGuidance,
  getBarriersToCare,
  getTrustBuildingGuidance,
  checkDrugInteractionCultural,
  getSdohCodes as getCulturalSdohCodes,
  seedCulturalProfiles,
  // Reference data
  VALID_POPULATIONS,
  VALID_CONTEXTS,
  // Client class
  CulturalCompetencyMCPClient,
  // Types
  type PopulationKey,
  type CommunicationContext,
  type CulturalProfile,
  type CommunicationGuidance as CulturalCommunicationGuidance,
  type ClinicalConsideration,
  type BarrierToCare,
  type CulturalHealthPractice,
  type TrustFactor,
  type SupportSystem,
  type SDOHCode as CulturalSDOHCode,
  type CulturalRemedy,
  type DrugInteractionCultural,
  type CulturalCompetencyResult
} from './mcpCulturalCompetencyClient';

// =====================================================
// CHAIN ORCHESTRATION (Multi-Server Pipelines)
// =====================================================

export { chainOrchestrationService } from './chainOrchestrationService';

export type {
  ChainDefinition as ChainOrchestrationDefinition,
  ChainRun as ChainOrchestrationRun,
  ChainStepDefinition as ChainOrchestrationStepDefinition,
  ChainStepResult as ChainOrchestrationStepResult,
  ChainStatusResponse as ChainOrchestrationStatusResponse,
  ChainRunStatus as ChainOrchestrationRunStatus,
  ChainStepStatus as ChainOrchestrationStepStatus,
  ChainRunFilters as ChainOrchestrationRunFilters,
} from './chainOrchestration.types';
