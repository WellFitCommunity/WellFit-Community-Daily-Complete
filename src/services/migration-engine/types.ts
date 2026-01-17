/**
 * Migration Engine Types
 *
 * Type definitions for the Intelligent Migration Engine
 * Extracted for modularity and reusability
 */

/** Recognized data patterns for healthcare and general data */
export type DataPattern =
  | 'NPI'           // 10-digit NPI
  | 'SSN'           // Social Security (masked)
  | 'PHONE'         // Phone number
  | 'EMAIL'         // Email address
  | 'DATE'          // Date in various formats
  | 'DATE_ISO'      // ISO 8601 date
  | 'NAME_FULL'     // "Last, First" or "First Last"
  | 'NAME_FIRST'    // First name only
  | 'NAME_LAST'     // Last name only
  | 'STATE_CODE'    // 2-letter state
  | 'ZIP'           // ZIP code
  | 'CURRENCY'      // Dollar amounts
  | 'PERCENTAGE'    // Percentage values
  | 'BOOLEAN'       // Yes/No, True/False, 1/0
  | 'ID_NUMERIC'    // Numeric ID
  | 'ID_UUID'       // UUID format
  | 'ID_ALPHANUMERIC' // Mixed ID
  | 'CODE'          // Short codes (role codes, dept codes)
  | 'TEXT_SHORT'    // Short text < 50 chars
  | 'TEXT_LONG'     // Long text > 50 chars
  // Clinical FHIR code systems
  | 'SNOMED_CT'     // SNOMED CT clinical codes (6-18 digits)
  | 'LOINC'         // LOINC observation codes (e.g., 12345-6)
  | 'RXNORM'        // RxNorm medication codes
  | 'ICD10'         // ICD-10 diagnosis codes
  | 'CPT'           // CPT procedure codes
  | 'NDC'           // National Drug Code
  | 'FHIR_RESOURCE_TYPE' // FHIR resource type names
  | 'FHIR_REFERENCE' // FHIR reference (e.g., Patient/123)
  | 'UNKNOWN';

/** Column fingerprint - the "DNA" of a single column */
export interface ColumnDNA {
  originalName: string;
  normalizedName: string;        // Lowercase, no special chars
  detectedPatterns: DataPattern[];
  primaryPattern: DataPattern;
  patternConfidence: number;     // 0-1
  sampleValues: string[];        // First 5 non-null values
  nullPercentage: number;
  uniquePercentage: number;
  avgLength: number;
  dataTypeInferred: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
}

/** Source file fingerprint - the "DNA" of the entire file */
export interface SourceDNA {
  dnaId: string;                 // Unique hash of structure
  sourceType: 'EXCEL' | 'CSV' | 'HL7' | 'FHIR' | 'DATABASE';
  sourceSystem?: string;         // EPIC, CERNER, etc. if detected
  columnCount: number;
  rowCount: number;
  columns: ColumnDNA[];
  structureHash: string;         // Hash of column names + types
  signatureVector: number[];     // Numeric vector for similarity matching
  detectedAt: Date;
}

/** A learned mapping from source to target */
export interface LearnedMapping {
  mappingId: string;
  sourceColumnNormalized: string;
  sourcePatterns: DataPattern[];
  targetTable: string;
  targetColumn: string;
  transformFunction?: string;    // Optional transformation
  successCount: number;          // Times this mapping succeeded
  failureCount: number;          // Times this mapping failed
  lastUsed: Date;
  confidence: number;            // Calculated from success rate
  createdBy?: string;            // User who first created
  organizationId?: string;       // Org-specific learnings
}

/** Mapping suggestion with confidence */
export interface MappingSuggestion {
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
  reasons: string[];
  transformRequired?: string;
  alternativeMappings: Array<{
    targetTable: string;
    targetColumn: string;
    confidence: number;
  }>;
}

/** Migration result for learning */
export interface MigrationResult {
  mappingId: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  recordsAttempted: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errorTypes: string[];
  userAccepted: boolean;         // Did user accept this mapping?
  userCorrectedTo?: {
    targetTable: string;
    targetColumn: string;
  };
}

/** AI-assisted mapping configuration */
export interface AIAssistConfig {
  enabled: boolean;
  confidenceThreshold: number;   // Below this, use AI
  apiEndpoint: string;           // Claude API endpoint
  maxTokens: number;             // Max tokens for AI response
  model?: string;                // Claude model to use
  cacheResponses: boolean;       // Cache AI suggestions
}

/** AI mapping suggestion from Claude */
export interface AIMappingSuggestion {
  sourceColumn: string;
  suggestedTable: string;
  suggestedColumn: string;
  fhirResource?: string;
  fhirPath?: string;
  confidence: number;
  reasoning: string;
  transformation?: string;
  alternativeMappings?: Array<{
    table: string;
    column: string;
    confidence: number;
  }>;
}

/** Migration execution options */
export interface MigrationOptions {
  dryRun?: boolean;
  validateOnly?: boolean;
  stopOnError?: boolean;
  batchSize?: number;
}

/** Migration execution result */
export interface MigrationExecutionResult {
  batchId: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; error: string }>;
  results: MigrationResult[];
}

/** Analysis result from source data */
export interface SourceAnalysisResult {
  dna: SourceDNA;
  suggestions: MappingSuggestion[];
  similarPastMigrations: Array<{
    dnaId: string;
    similarity: number;
    sourceSystem?: string;
    successRate: number;
  }>;
  estimatedAccuracy: number;
}

/** Validation result for a single value */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Table migration result */
export interface TableMigrationResult {
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; error: string }>;
  results: MigrationResult[];
}
