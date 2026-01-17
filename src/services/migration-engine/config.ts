/**
 * Migration Engine Configuration
 *
 * All configurable thresholds and settings for the Intelligent Migration Engine.
 * These can be overridden at runtime via the config parameter.
 */

import type { AIAssistConfig } from './types';

/** Pattern detection configuration */
export interface PatternDetectorConfig {
  /** Number of sample values to analyze for pattern detection (default: 100) */
  sampleSize: number;
  /** Number of sample values to store in ColumnDNA (default: 5) */
  storedSampleCount: number;
  /** Threshold for text length to distinguish TEXT_SHORT vs TEXT_LONG (default: 50) */
  textLengthThreshold: number;
}

/** DNA generation configuration */
export interface DataDNAGeneratorConfig {
  /** Minimum similarity score for finding similar migrations (default: 0.7) */
  similarityThreshold: number;
  /** Maximum similar migrations to return (default: 5) */
  maxSimilarMigrations: number;
}

/** Mapping intelligence configuration */
export interface MappingIntelligenceConfig {
  /** Minimum score for a candidate mapping to be considered (default: 0.2) */
  minimumCandidateScore: number;
  /** Weight for pattern match in scoring (default: 0.3) */
  patternMatchWeight: number;
  /** Weight for name similarity in scoring (default: 0.4) */
  nameSimilarityWeight: number;
  /** Minimum name similarity to contribute to score (default: 0.5) */
  nameSimilarityThreshold: number;
  /** Weight for synonym match in scoring (default: 0.25) */
  synonymMatchWeight: number;
  /** Weight for name contains target in scoring (default: 0.1) */
  nameContainsWeight: number;
  /** Base confidence for learned mappings (default: 0.5) */
  learnedMappingBaseConfidence: number;
  /** Maximum confidence from learned mapping confidence (default: 0.5) */
  learnedMappingMaxBonus: number;
  /** Maximum number of alternative mappings to return (default: 3) */
  maxAlternativeMappings: number;
  /** Maximum AI confidence cap (default: 0.95) */
  maxAIConfidence: number;
}

/** Migration service configuration */
export interface MigrationServiceConfig {
  /** Default batch size for inserts (default: 100) */
  defaultBatchSize: number;
  /** Bonus to estimated accuracy from similar past migrations (default: 0.1) */
  pastSuccessBonus: number;
  /** Maximum estimated accuracy cap (default: 0.99) */
  maxEstimatedAccuracy: number;
}

/** Complete migration engine configuration */
export interface MigrationEngineConfig {
  patternDetector: PatternDetectorConfig;
  dnaGenerator: DataDNAGeneratorConfig;
  mappingIntelligence: MappingIntelligenceConfig;
  migrationService: MigrationServiceConfig;
  ai: AIAssistConfig;
}

/** Deep partial type for nested configuration objects */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Default pattern detector configuration */
export const DEFAULT_PATTERN_DETECTOR_CONFIG: PatternDetectorConfig = {
  sampleSize: 100,
  storedSampleCount: 5,
  textLengthThreshold: 50,
};

/** Default DNA generator configuration */
export const DEFAULT_DNA_GENERATOR_CONFIG: DataDNAGeneratorConfig = {
  similarityThreshold: 0.7,
  maxSimilarMigrations: 5,
};

/** Default mapping intelligence configuration */
export const DEFAULT_MAPPING_INTELLIGENCE_CONFIG: MappingIntelligenceConfig = {
  minimumCandidateScore: 0.2,
  patternMatchWeight: 0.3,
  nameSimilarityWeight: 0.4,
  nameSimilarityThreshold: 0.5,
  synonymMatchWeight: 0.25,
  nameContainsWeight: 0.1,
  learnedMappingBaseConfidence: 0.5,
  learnedMappingMaxBonus: 0.5,
  maxAlternativeMappings: 3,
  maxAIConfidence: 0.95,
};

/** Default migration service configuration */
export const DEFAULT_MIGRATION_SERVICE_CONFIG: MigrationServiceConfig = {
  defaultBatchSize: 100,
  pastSuccessBonus: 0.1,
  maxEstimatedAccuracy: 0.99,
};

/** Default AI configuration */
export const DEFAULT_AI_CONFIG: AIAssistConfig = {
  enabled: true,
  confidenceThreshold: 0.6,
  apiEndpoint: '/api/anthropic-chats',
  maxTokens: 2000,
  cacheResponses: true,
};

/** Default complete configuration */
export const DEFAULT_CONFIG: MigrationEngineConfig = {
  patternDetector: DEFAULT_PATTERN_DETECTOR_CONFIG,
  dnaGenerator: DEFAULT_DNA_GENERATOR_CONFIG,
  mappingIntelligence: DEFAULT_MAPPING_INTELLIGENCE_CONFIG,
  migrationService: DEFAULT_MIGRATION_SERVICE_CONFIG,
  ai: DEFAULT_AI_CONFIG,
};

/**
 * Create a configuration by merging partial config with defaults
 */
export function createConfig(
  partial?: Partial<MigrationEngineConfig>
): MigrationEngineConfig {
  if (!partial) return { ...DEFAULT_CONFIG };

  return {
    patternDetector: {
      ...DEFAULT_PATTERN_DETECTOR_CONFIG,
      ...partial.patternDetector,
    },
    dnaGenerator: {
      ...DEFAULT_DNA_GENERATOR_CONFIG,
      ...partial.dnaGenerator,
    },
    mappingIntelligence: {
      ...DEFAULT_MAPPING_INTELLIGENCE_CONFIG,
      ...partial.mappingIntelligence,
    },
    migrationService: {
      ...DEFAULT_MIGRATION_SERVICE_CONFIG,
      ...partial.migrationService,
    },
    ai: {
      ...DEFAULT_AI_CONFIG,
      ...partial.ai,
    },
  };
}

/**
 * Required columns that cannot be null during validation
 */
export const REQUIRED_COLUMNS = [
  'first_name',
  'last_name',
  'organization_id',
] as const;

/**
 * Date columns that require ISO format validation
 */
export const DATE_COLUMNS = [
  'hire_date',
  'termination_date',
  'expiration_date',
  'date_of_birth',
  'issued_date',
] as const;
