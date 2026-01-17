/**
 * Pattern Detector - The "Genetic Sequencer"
 *
 * Detects data patterns in column values for healthcare data migration.
 * Recognizes clinical codes (LOINC, SNOMED, ICD-10, etc.) and standard patterns.
 */

import type { DataPattern, ColumnDNA } from './types';
import {
  DEFAULT_PATTERN_DETECTOR_CONFIG,
  type PatternDetectorConfig,
} from './config';

/** Pattern definitions with regex patterns */
const PATTERN_DEFINITIONS: Record<DataPattern, RegExp[]> = {
  NPI: [/^\d{10}$/],
  SSN: [/^\d{3}-?\d{2}-?\d{4}$/, /^XXX-XX-\d{4}$/],
  PHONE: [
    /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
    /^\+?1?[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
  ],
  EMAIL: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/],
  DATE_ISO: [/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/],
  DATE: [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i,
  ],
  NAME_FULL: [/^[A-Z][a-z]+,\s*[A-Z][a-z]+/, /^[A-Z][a-z]+\s+[A-Z][a-z]+$/],
  NAME_FIRST: [/^[A-Z][a-z]{1,20}$/],
  NAME_LAST: [/^[A-Z][a-zA-Z'-]{1,30}$/],
  STATE_CODE: [/^[A-Z]{2}$/],
  ZIP: [/^\d{5}(-\d{4})?$/],
  CURRENCY: [/^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/, /^\d+\.\d{2}$/],
  PERCENTAGE: [/^\d{1,3}(\.\d+)?%?$/],
  BOOLEAN: [/^(yes|no|true|false|1|0|y|n|t|f)$/i],
  ID_NUMERIC: [/^\d+$/],
  ID_UUID: [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ],
  ID_ALPHANUMERIC: [/^[A-Z0-9]{4,20}$/i],
  CODE: [/^[A-Z_]{2,20}$/],
  TEXT_SHORT: [/.{1,50}/],
  TEXT_LONG: [/.{51,}/],
  // Clinical FHIR code system patterns
  SNOMED_CT: [
    /^\d{6,18}$/, // SNOMED CT codes are 6-18 digit numbers
    /^http:\/\/snomed\.info\/sct\|\d+$/, // FHIR URI format
  ],
  LOINC: [
    /^\d{1,5}-\d$/, // LOINC format: 12345-6
    /^LP\d{5,7}-\d$/, // LOINC panel codes
    /^http:\/\/loinc\.org\|\d+-\d$/, // FHIR URI format
  ],
  RXNORM: [
    /^\d{5,7}$/, // RxNorm CUIs are typically 5-7 digits
    /^http:\/\/www\.nlm\.nih\.gov\/research\/umls\/rxnorm\|\d+$/, // FHIR URI
  ],
  ICD10: [
    /^[A-TV-Z]\d{2}(\.\d{1,4})?$/, // ICD-10-CM: A00-T88, V00-Y99, Z00-Z99
    /^[A-Z]\d{2}\.\d{1,2}$/, // ICD-10 with decimal
    /^http:\/\/hl7\.org\/fhir\/sid\/icd-10(-cm)?\|[A-Z]\d{2}/, // FHIR URI
  ],
  CPT: [
    /^\d{5}$/, // CPT codes are 5 digits
    /^99\d{3}$/, // E/M codes (99201-99499)
    /^http:\/\/www\.ama-assn\.org\/go\/cpt\|\d{5}$/, // FHIR URI
  ],
  NDC: [
    /^\d{4}-\d{4}-\d{2}$/, // 4-4-2 format
    /^\d{5}-\d{3}-\d{2}$/, // 5-3-2 format
    /^\d{5}-\d{4}-\d{1}$/, // 5-4-1 format
    /^\d{11}$/, // 11-digit format (no dashes)
  ],
  FHIR_RESOURCE_TYPE: [
    /^(Patient|Observation|Condition|MedicationRequest|Procedure|AllergyIntolerance|Immunization|DiagnosticReport|Encounter|CarePlan|Practitioner|Organization|Location|Device|Specimen|ServiceRequest|ClinicalImpression|Goal|RiskAssessment|FamilyMemberHistory)$/,
  ],
  FHIR_REFERENCE: [
    /^(Patient|Practitioner|Organization|Location|Encounter|Observation|Condition|Procedure)\/[a-zA-Z0-9-]+$/, // Resource/id
    /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // URN format
  ],
  UNKNOWN: [/.*/],
};

/** Priority order for pattern detection (clinical codes first for healthcare data) */
const PATTERN_PRIORITY: DataPattern[] = [
  // Clinical FHIR codes (high priority for healthcare migration)
  'LOINC',
  'ICD10',
  'CPT',
  'NDC',
  'SNOMED_CT',
  'RXNORM',
  'FHIR_REFERENCE',
  'FHIR_RESOURCE_TYPE',
  // Standard healthcare identifiers
  'NPI',
  'SSN',
  'EMAIL',
  'PHONE',
  'DATE_ISO',
  'DATE',
  'STATE_CODE',
  'ZIP',
  'ID_UUID',
  'CURRENCY',
  'PERCENTAGE',
  'BOOLEAN',
  'NAME_FULL',
  'ID_NUMERIC',
  'ID_ALPHANUMERIC',
  'CODE',
  'NAME_FIRST',
  'NAME_LAST',
  'TEXT_SHORT',
  'TEXT_LONG',
];

/**
 * PatternDetector class for analyzing data patterns
 */
export class PatternDetector {
  private config: PatternDetectorConfig;

  constructor(config?: Partial<PatternDetectorConfig>) {
    this.config = {
      ...DEFAULT_PATTERN_DETECTOR_CONFIG,
      ...config,
    };
  }

  /**
   * Detect pattern of a single value
   */
  detectValuePattern(value: string): DataPattern[] {
    if (!value || value.trim() === '') return ['UNKNOWN'];

    const detected: DataPattern[] = [];
    const trimmed = value.trim();

    // Check patterns in priority order
    for (const pattern of PATTERN_PRIORITY) {
      const regexes = PATTERN_DEFINITIONS[pattern];
      if (regexes.some((rx) => rx.test(trimmed))) {
        detected.push(pattern);
      }
    }

    return detected.length > 0 ? detected : ['UNKNOWN'];
  }

  /**
   * NPI Luhn validation
   */
  validateNPI(npi: string): boolean {
    if (!npi || npi.length !== 10 || !/^\d{10}$/.test(npi)) return false;

    const withPrefix = '80840' + npi;
    let sum = 0;

    for (let i = withPrefix.length - 1; i >= 0; i--) {
      let digit = parseInt(withPrefix[i]);
      if ((withPrefix.length - 1 - i) % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    return sum % 10 === 0;
  }

  /**
   * Analyze a column of values to determine its DNA
   */
  analyzeColumn(
    columnName: string,
    values: (string | number | boolean | null | undefined)[]
  ): ColumnDNA {
    const nonNullValues = values.filter(
      (v) => v != null && String(v).trim() !== ''
    );
    const stringValues = nonNullValues.map((v) => String(v).trim());

    // Count patterns across all values
    const patternCounts: Partial<Record<DataPattern, number>> = {};

    // Sample first N values based on config
    for (const value of stringValues.slice(0, this.config.sampleSize)) {
      const patterns = this.detectValuePattern(value);
      for (const p of patterns) {
        patternCounts[p] = (patternCounts[p] || 0) + 1;
      }
    }

    // Find primary pattern
    let primaryPattern: DataPattern = 'UNKNOWN';
    let maxCount = 0;
    for (const [pattern, count] of Object.entries(patternCounts)) {
      if (
        count &&
        count > maxCount &&
        pattern !== 'TEXT_SHORT' &&
        pattern !== 'TEXT_LONG'
      ) {
        maxCount = count;
        primaryPattern = pattern as DataPattern;
      }
    }

    // If no specific pattern, use text length
    if (primaryPattern === 'UNKNOWN' && stringValues.length > 0) {
      const avgLen =
        stringValues.reduce((sum, v) => sum + v.length, 0) / stringValues.length;
      primaryPattern =
        avgLen > this.config.textLengthThreshold ? 'TEXT_LONG' : 'TEXT_SHORT';
    }

    // Calculate unique percentage
    const uniqueValues = new Set(stringValues);
    const uniquePercentage =
      stringValues.length > 0 ? uniqueValues.size / stringValues.length : 0;

    // Infer data type
    let dataTypeInferred: ColumnDNA['dataTypeInferred'] = 'string';
    if (['ID_NUMERIC', 'CURRENCY', 'PERCENTAGE'].includes(primaryPattern)) {
      dataTypeInferred = 'number';
    } else if (primaryPattern === 'BOOLEAN') {
      dataTypeInferred = 'boolean';
    } else if (['DATE', 'DATE_ISO'].includes(primaryPattern)) {
      dataTypeInferred = 'date';
    }

    const sampledCount = Math.min(stringValues.length, this.config.sampleSize);

    return {
      originalName: columnName,
      normalizedName: this.normalizeColumnName(columnName),
      detectedPatterns: Object.keys(patternCounts) as DataPattern[],
      primaryPattern,
      patternConfidence:
        stringValues.length > 0 ? maxCount / sampledCount : 0,
      sampleValues: stringValues.slice(0, this.config.storedSampleCount),
      nullPercentage:
        values.length > 0
          ? (values.length - nonNullValues.length) / values.length
          : 0,
      uniquePercentage,
      avgLength:
        stringValues.length > 0
          ? stringValues.reduce((sum, v) => sum + v.length, 0) /
            stringValues.length
          : 0,
      dataTypeInferred,
    };
  }

  /**
   * Normalize column name for matching
   */
  normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Get the configuration
   */
  getConfig(): PatternDetectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PatternDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export static methods for backward compatibility
export const PatternDetectorStatic = {
  detectValuePattern(value: string): DataPattern[] {
    const detector = new PatternDetector();
    return detector.detectValuePattern(value);
  },

  validateNPI(npi: string): boolean {
    const detector = new PatternDetector();
    return detector.validateNPI(npi);
  },

  analyzeColumn(
    columnName: string,
    values: (string | number | boolean | null | undefined)[]
  ): ColumnDNA {
    const detector = new PatternDetector();
    return detector.analyzeColumn(columnName, values);
  },

  normalizeColumnName(name: string): string {
    const detector = new PatternDetector();
    return detector.normalizeColumnName(name);
  },
};
