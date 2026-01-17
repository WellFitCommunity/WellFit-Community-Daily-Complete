/**
 * Data DNA Generator - Creates unique fingerprints
 *
 * Generates DNA fingerprints for source datasets to enable
 * similarity matching and intelligent mapping suggestions.
 */

import type { SourceDNA, ColumnDNA, DataPattern } from './types';
import { PatternDetector } from './PatternDetector';
import {
  DEFAULT_DNA_GENERATOR_CONFIG,
  type DataDNAGeneratorConfig,
} from './config';

/** Pattern types for signature vector generation */
const PATTERN_TYPES: DataPattern[] = [
  // Clinical FHIR codes
  'SNOMED_CT',
  'LOINC',
  'RXNORM',
  'ICD10',
  'CPT',
  'NDC',
  'FHIR_RESOURCE_TYPE',
  'FHIR_REFERENCE',
  // Standard patterns
  'NPI',
  'SSN',
  'PHONE',
  'EMAIL',
  'DATE',
  'DATE_ISO',
  'NAME_FULL',
  'NAME_FIRST',
  'NAME_LAST',
  'STATE_CODE',
  'ZIP',
  'CURRENCY',
  'PERCENTAGE',
  'BOOLEAN',
  'ID_NUMERIC',
  'ID_UUID',
  'ID_ALPHANUMERIC',
  'CODE',
  'TEXT_SHORT',
  'TEXT_LONG',
  'UNKNOWN',
];

/**
 * DataDNAGenerator class for creating and comparing DNA fingerprints
 */
export class DataDNAGenerator {
  private config: DataDNAGeneratorConfig;
  private patternDetector: PatternDetector;

  constructor(config?: Partial<DataDNAGeneratorConfig>) {
    this.config = {
      ...DEFAULT_DNA_GENERATOR_CONFIG,
      ...config,
    };
    this.patternDetector = new PatternDetector();
  }

  /**
   * Generate DNA fingerprint for a source dataset
   */
  generateDNA(
    sourceType: SourceDNA['sourceType'],
    columns: string[],
    data: Record<string, unknown>[],
    sourceSystem?: string
  ): SourceDNA {
    const columnDNAs: ColumnDNA[] = columns.map((col) => {
      const values = data.map((row) => {
        const value = row[col];
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value === null ||
          value === undefined
        ) {
          return value;
        }
        return String(value);
      }) as (string | number | boolean | null | undefined)[];
      return this.patternDetector.analyzeColumn(col, values);
    });

    // Create structure hash (column names + primary patterns)
    const structureString = columnDNAs
      .map((c) => `${c.normalizedName}:${c.primaryPattern}`)
      .sort()
      .join('|');
    const structureHash = this.hashString(structureString);

    // Create signature vector for similarity matching
    const signatureVector = this.createSignatureVector(columnDNAs);

    // Generate unique DNA ID
    const dnaId = this.hashString(
      `${sourceType}-${structureHash}-${Date.now()}`
    ).substring(0, 16);

    return {
      dnaId,
      sourceType,
      sourceSystem: sourceSystem || this.detectSourceSystem(columnDNAs),
      columnCount: columns.length,
      rowCount: data.length,
      columns: columnDNAs,
      structureHash,
      signatureVector,
      detectedAt: new Date(),
    };
  }

  /**
   * Create numeric vector for similarity comparisons
   */
  private createSignatureVector(columns: ColumnDNA[]): number[] {
    const vector: number[] = new Array(PATTERN_TYPES.length).fill(0);

    for (const col of columns) {
      const idx = PATTERN_TYPES.indexOf(col.primaryPattern);
      if (idx >= 0) {
        vector[idx] += col.patternConfidence;
      }
    }

    // Normalize
    const magnitude =
      Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }

  /**
   * Detect source system from column naming patterns
   */
  private detectSourceSystem(columns: ColumnDNA[]): string | undefined {
    const names = columns.map((c) => c.originalName.toLowerCase());

    // Epic patterns
    if (
      names.some(
        (n) => n.includes('epic') || n.includes('myc') || n.includes('ser_')
      )
    ) {
      return 'EPIC';
    }

    // Cerner patterns
    if (
      names.some(
        (n) =>
          n.includes('cerner') ||
          n.includes('millennium') ||
          n.includes('prsnl_')
      )
    ) {
      return 'CERNER';
    }

    // Meditech patterns
    if (
      names.some(
        (n) =>
          n.includes('meditech') || n.includes('mt_') || n.includes('mtweb')
      )
    ) {
      return 'MEDITECH';
    }

    // Athena patterns
    if (names.some((n) => n.includes('athena') || n.includes('ath_'))) {
      return 'ATHENAHEALTH';
    }

    // Allscripts patterns
    if (names.some((n) => n.includes('allscripts') || n.includes('touchworks'))) {
      return 'ALLSCRIPTS';
    }

    return undefined;
  }

  /**
   * Simple hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Calculate similarity between two DNA fingerprints (0-1)
   */
  calculateSimilarity(dna1: SourceDNA, dna2: SourceDNA): number {
    // Cosine similarity of signature vectors
    const v1 = dna1.signatureVector;
    const v2 = dna2.signatureVector;

    if (v1.length !== v2.length) return 0;

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Get the configuration
   */
  getConfig(): DataDNAGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<DataDNAGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get similarity threshold from config
   */
  getSimilarityThreshold(): number {
    return this.config.similarityThreshold;
  }

  /**
   * Get max similar migrations from config
   */
  getMaxSimilarMigrations(): number {
    return this.config.maxSimilarMigrations;
  }
}

// Export static methods for backward compatibility
export const DataDNAGeneratorStatic = {
  generateDNA(
    sourceType: SourceDNA['sourceType'],
    columns: string[],
    data: Record<string, unknown>[],
    sourceSystem?: string
  ): SourceDNA {
    const generator = new DataDNAGenerator();
    return generator.generateDNA(sourceType, columns, data, sourceSystem);
  },

  calculateSimilarity(dna1: SourceDNA, dna2: SourceDNA): number {
    const generator = new DataDNAGenerator();
    return generator.calculateSimilarity(dna1, dna2);
  },
};
