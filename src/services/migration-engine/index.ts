/**
 * Intelligent Migration Engine
 *
 * A comprehensive data migration system with:
 * - Data DNA Fingerprinting: Creates unique signatures for source data structures
 * - Adaptive Field Mapping: Learns from each migration, improves suggestions
 * - Pattern Recognition: Detects NPI, phone, dates, emails, clinical codes automatically
 * - Confidence Scoring: Ranks mapping suggestions by likelihood
 * - Institutional Memory: Remembers what worked for similar sources
 * - AI-Assisted Hybrid Mapping: Falls back to Claude AI for complex/ambiguous mappings
 *
 * The more migrations you run, the smarter it gets.
 */

// Types
export type {
  DataPattern,
  ColumnDNA,
  SourceDNA,
  LearnedMapping,
  MappingSuggestion,
  MigrationResult,
  AIAssistConfig,
  AIMappingSuggestion,
  MigrationOptions,
  MigrationExecutionResult,
  SourceAnalysisResult,
  ValidationResult,
  TableMigrationResult,
} from './types';

// Configuration
export {
  DEFAULT_CONFIG,
  DEFAULT_PATTERN_DETECTOR_CONFIG,
  DEFAULT_DNA_GENERATOR_CONFIG,
  DEFAULT_MAPPING_INTELLIGENCE_CONFIG,
  DEFAULT_MIGRATION_SERVICE_CONFIG,
  DEFAULT_AI_CONFIG,
  REQUIRED_COLUMNS,
  DATE_COLUMNS,
  createConfig,
} from './config';

export type {
  MigrationEngineConfig,
  PatternDetectorConfig,
  DataDNAGeneratorConfig,
  MappingIntelligenceConfig,
  MigrationServiceConfig,
  DeepPartial,
} from './config';

// Core classes
export { PatternDetector, PatternDetectorStatic } from './PatternDetector';
export { DataDNAGenerator, DataDNAGeneratorStatic } from './DataDNAGenerator';
export { MappingIntelligence } from './MappingIntelligence';
export { IntelligentMigrationService } from './IntelligentMigrationService';

// Schema and synonyms
export { TARGET_SCHEMA, COLUMN_SYNONYMS } from './targetSchema';
