/**
 * WellFit Community - Intelligent Migration Engine
 *
 * Features:
 * - Data DNA Fingerprinting: Creates unique signatures for source data structures
 * - Adaptive Field Mapping: Learns from each migration, improves suggestions
 * - Pattern Recognition: Detects NPI, phone, dates, emails automatically
 * - Confidence Scoring: Ranks mapping suggestions by likelihood
 * - Institutional Memory: Remembers what worked for similar sources
 * - AI-Assisted Hybrid Mapping: Falls back to Claude AI for complex/ambiguous mappings
 *
 * The more migrations you run, the smarter it gets.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';

// =============================================================================
// TYPES
// =============================================================================

/** Recognized data patterns */
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
  confidenceThreshold: number;   // Below this, use AI (default: 0.6)
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

// =============================================================================
// PATTERN DETECTION - The "Genetic Sequencer"
// =============================================================================

export class PatternDetector {

  private static patterns: Record<DataPattern, RegExp[]> = {
    NPI: [/^\d{10}$/],
    SSN: [/^\d{3}-?\d{2}-?\d{4}$/, /^XXX-XX-\d{4}$/],
    PHONE: [
      /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
      /^\+?1?[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/
    ],
    EMAIL: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    DATE_ISO: [/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/],
    DATE: [
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      /^\d{1,2}-\d{1,2}-\d{2,4}$/,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i
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
    ID_UUID: [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i],
    ID_ALPHANUMERIC: [/^[A-Z0-9]{4,20}$/i],
    CODE: [/^[A-Z_]{2,20}$/],
    TEXT_SHORT: [/.{1,50}/],
    TEXT_LONG: [/.{51,}/],
    // Clinical FHIR code system patterns
    SNOMED_CT: [
      /^\d{6,18}$/,  // SNOMED CT codes are 6-18 digit numbers
      /^http:\/\/snomed\.info\/sct\|\d+$/  // FHIR URI format
    ],
    LOINC: [
      /^\d{1,5}-\d$/,  // LOINC format: 12345-6
      /^LP\d{5,7}-\d$/,  // LOINC panel codes
      /^http:\/\/loinc\.org\|\d+-\d$/  // FHIR URI format
    ],
    RXNORM: [
      /^\d{5,7}$/,  // RxNorm CUIs are typically 5-7 digits
      /^http:\/\/www\.nlm\.nih\.gov\/research\/umls\/rxnorm\|\d+$/  // FHIR URI
    ],
    ICD10: [
      /^[A-TV-Z]\d{2}(\.\d{1,4})?$/,  // ICD-10-CM: A00-T88, V00-Y99, Z00-Z99
      /^[A-Z]\d{2}\.\d{1,2}$/,  // ICD-10 with decimal
      /^http:\/\/hl7\.org\/fhir\/sid\/icd-10(-cm)?\|[A-Z]\d{2}/  // FHIR URI
    ],
    CPT: [
      /^\d{5}$/,  // CPT codes are 5 digits
      /^99\d{3}$/,  // E/M codes (99201-99499)
      /^http:\/\/www\.ama-assn\.org\/go\/cpt\|\d{5}$/  // FHIR URI
    ],
    NDC: [
      /^\d{4}-\d{4}-\d{2}$/,  // 4-4-2 format
      /^\d{5}-\d{3}-\d{2}$/,  // 5-3-2 format
      /^\d{5}-\d{4}-\d{1}$/,  // 5-4-1 format
      /^\d{11}$/  // 11-digit format (no dashes)
    ],
    FHIR_RESOURCE_TYPE: [
      /^(Patient|Observation|Condition|MedicationRequest|Procedure|AllergyIntolerance|Immunization|DiagnosticReport|Encounter|CarePlan|Practitioner|Organization|Location|Device|Specimen|ServiceRequest|ClinicalImpression|Goal|RiskAssessment|FamilyMemberHistory)$/
    ],
    FHIR_REFERENCE: [
      /^(Patient|Practitioner|Organization|Location|Encounter|Observation|Condition|Procedure)\/[a-zA-Z0-9-]+$/,  // Resource/id
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i  // URN format
    ],
    UNKNOWN: [/.*/]
  };

  /** Detect pattern of a single value */
  static detectValuePattern(value: string): DataPattern[] {
    if (!value || value.trim() === '') return ['UNKNOWN'];

    const detected: DataPattern[] = [];
    const trimmed = value.trim();

    // Check patterns in priority order (clinical codes first for healthcare data)
    const priorityOrder: DataPattern[] = [
      // Clinical FHIR codes (high priority for healthcare migration)
      'LOINC', 'ICD10', 'CPT', 'NDC', 'SNOMED_CT', 'RXNORM',
      'FHIR_REFERENCE', 'FHIR_RESOURCE_TYPE',
      // Standard healthcare identifiers
      'NPI', 'SSN', 'EMAIL', 'PHONE', 'DATE_ISO', 'DATE',
      'STATE_CODE', 'ZIP', 'ID_UUID', 'CURRENCY', 'PERCENTAGE',
      'BOOLEAN', 'NAME_FULL', 'ID_NUMERIC', 'ID_ALPHANUMERIC',
      'CODE', 'NAME_FIRST', 'NAME_LAST', 'TEXT_SHORT', 'TEXT_LONG'
    ];

    for (const pattern of priorityOrder) {
      const regexes = this.patterns[pattern];
      if (regexes.some(rx => rx.test(trimmed))) {
        detected.push(pattern);
      }
    }

    return detected.length > 0 ? detected : ['UNKNOWN'];
  }

  /** NPI Luhn validation */
  static validateNPI(npi: string): boolean {
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

  /** Analyze a column of values to determine its DNA */
  static analyzeColumn(columnName: string, values: (string | number | boolean | null | undefined)[]): ColumnDNA {
    const nonNullValues = values.filter(v => v != null && String(v).trim() !== '');
    const stringValues = nonNullValues.map(v => String(v).trim());

    // Count patterns across all values
    const patternCounts: Partial<Record<DataPattern, number>> = {};

    for (const value of stringValues.slice(0, 100)) { // Sample first 100
      const patterns = this.detectValuePattern(value);
      for (const p of patterns) {
        patternCounts[p] = (patternCounts[p] || 0) + 1;
      }
    }

    // Find primary pattern
    let primaryPattern: DataPattern = 'UNKNOWN';
    let maxCount = 0;
    for (const [pattern, count] of Object.entries(patternCounts)) {
      if (count && count > maxCount && pattern !== 'TEXT_SHORT' && pattern !== 'TEXT_LONG') {
        maxCount = count;
        primaryPattern = pattern as DataPattern;
      }
    }

    // If no specific pattern, use text length
    if (primaryPattern === 'UNKNOWN' && stringValues.length > 0) {
      const avgLen = stringValues.reduce((sum, v) => sum + v.length, 0) / stringValues.length;
      primaryPattern = avgLen > 50 ? 'TEXT_LONG' : 'TEXT_SHORT';
    }

    // Calculate unique percentage
    const uniqueValues = new Set(stringValues);
    const uniquePercentage = stringValues.length > 0
      ? uniqueValues.size / stringValues.length
      : 0;

    // Infer data type
    let dataTypeInferred: ColumnDNA['dataTypeInferred'] = 'string';
    if (['ID_NUMERIC', 'CURRENCY', 'PERCENTAGE'].includes(primaryPattern)) {
      dataTypeInferred = 'number';
    } else if (primaryPattern === 'BOOLEAN') {
      dataTypeInferred = 'boolean';
    } else if (['DATE', 'DATE_ISO'].includes(primaryPattern)) {
      dataTypeInferred = 'date';
    }

    return {
      originalName: columnName,
      normalizedName: this.normalizeColumnName(columnName),
      detectedPatterns: Object.keys(patternCounts) as DataPattern[],
      primaryPattern,
      patternConfidence: stringValues.length > 0 ? maxCount / Math.min(stringValues.length, 100) : 0,
      sampleValues: stringValues.slice(0, 5),
      nullPercentage: values.length > 0 ? (values.length - nonNullValues.length) / values.length : 0,
      uniquePercentage,
      avgLength: stringValues.length > 0
        ? stringValues.reduce((sum, v) => sum + v.length, 0) / stringValues.length
        : 0,
      dataTypeInferred
    };
  }

  /** Normalize column name for matching */
  static normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

// =============================================================================
// DATA DNA GENERATOR - Creates unique fingerprints
// =============================================================================

export class DataDNAGenerator {

  /** Generate DNA fingerprint for a source dataset */
  static generateDNA(
    sourceType: SourceDNA['sourceType'],
    columns: string[],
    data: Record<string, unknown>[],
    sourceSystem?: string
  ): SourceDNA {

    const columnDNAs: ColumnDNA[] = columns.map(col => {
      const values = data.map(row => {
        const value = row[col];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
          return value;
        }
        return String(value);
      }) as (string | number | boolean | null | undefined)[];
      return PatternDetector.analyzeColumn(col, values);
    });

    // Create structure hash (column names + primary patterns)
    const structureString = columnDNAs
      .map(c => `${c.normalizedName}:${c.primaryPattern}`)
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
      detectedAt: new Date()
    };
  }

  /** Create numeric vector for similarity comparisons */
  private static createSignatureVector(columns: ColumnDNA[]): number[] {
    // Pattern frequency vector (one slot per pattern type)
    const patternTypes: DataPattern[] = [
      // Clinical FHIR codes
      'SNOMED_CT', 'LOINC', 'RXNORM', 'ICD10', 'CPT', 'NDC',
      'FHIR_RESOURCE_TYPE', 'FHIR_REFERENCE',
      // Standard patterns
      'NPI', 'SSN', 'PHONE', 'EMAIL', 'DATE', 'DATE_ISO',
      'NAME_FULL', 'NAME_FIRST', 'NAME_LAST', 'STATE_CODE', 'ZIP',
      'CURRENCY', 'PERCENTAGE', 'BOOLEAN', 'ID_NUMERIC', 'ID_UUID',
      'ID_ALPHANUMERIC', 'CODE', 'TEXT_SHORT', 'TEXT_LONG', 'UNKNOWN'
    ];

    const vector: number[] = new Array(patternTypes.length).fill(0);

    for (const col of columns) {
      const idx = patternTypes.indexOf(col.primaryPattern);
      if (idx >= 0) {
        vector[idx] += col.patternConfidence;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => v / magnitude);
  }

  /** Detect source system from column naming patterns */
  private static detectSourceSystem(columns: ColumnDNA[]): string | undefined {
    const names = columns.map(c => c.originalName.toLowerCase());

    // Epic patterns
    if (names.some(n => n.includes('epic') || n.includes('myc') || n.includes('ser_'))) {
      return 'EPIC';
    }

    // Cerner patterns
    if (names.some(n => n.includes('cerner') || n.includes('millennium') || n.includes('prsnl_'))) {
      return 'CERNER';
    }

    // Meditech patterns
    if (names.some(n => n.includes('meditech') || n.includes('mt_') || n.includes('mtweb'))) {
      return 'MEDITECH';
    }

    // Athena patterns
    if (names.some(n => n.includes('athena') || n.includes('ath_'))) {
      return 'ATHENAHEALTH';
    }

    // Allscripts patterns
    if (names.some(n => n.includes('allscripts') || n.includes('touchworks'))) {
      return 'ALLSCRIPTS';
    }

    return undefined;
  }

  /** Simple hash function */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /** Calculate similarity between two DNA fingerprints (0-1) */
  static calculateSimilarity(dna1: SourceDNA, dna2: SourceDNA): number {
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
}

// =============================================================================
// MAPPING INTELLIGENCE - The "Learning Brain"
// =============================================================================

export class MappingIntelligence {
  private supabase: SupabaseClient;
  private organizationId?: string;

  // Target schema knowledge - Updated to match actual hc_* tables
  private static targetSchema: Record<string, Record<string, DataPattern[]>> = {
    hc_staff: {
      staff_id: ['ID_UUID'],
      employee_id: ['ID_NUMERIC', 'ID_ALPHANUMERIC'],
      first_name: ['NAME_FIRST', 'TEXT_SHORT'],
      middle_name: ['NAME_FIRST', 'TEXT_SHORT'],
      last_name: ['NAME_LAST', 'TEXT_SHORT'],
      suffix: ['CODE', 'TEXT_SHORT'],
      preferred_name: ['NAME_FIRST', 'TEXT_SHORT'],
      email: ['EMAIL'],
      phone_work: ['PHONE'],
      phone_mobile: ['PHONE'],
      phone_home: ['PHONE'],
      npi: ['NPI'],
      dea_number: ['ID_ALPHANUMERIC'],
      upin: ['ID_ALPHANUMERIC'],
      medicare_ptan: ['ID_ALPHANUMERIC'],
      medicaid_id: ['ID_ALPHANUMERIC'],
      hire_date: ['DATE', 'DATE_ISO'],
      termination_date: ['DATE', 'DATE_ISO'],
      date_of_birth: ['DATE', 'DATE_ISO'],
      gender: ['CODE', 'TEXT_SHORT'],
      employment_status: ['CODE'],
      employment_type: ['CODE'],
      address_line1: ['TEXT_SHORT'],
      address_line2: ['TEXT_SHORT'],
      city: ['TEXT_SHORT'],
      state: ['STATE_CODE'],
      zip: ['ZIP'],
      source_system: ['CODE', 'TEXT_SHORT'],
      source_id: ['ID_ALPHANUMERIC', 'ID_NUMERIC']
    },
    hc_staff_license: {
      license_number: ['ID_ALPHANUMERIC'],
      state: ['STATE_CODE'],
      issued_date: ['DATE', 'DATE_ISO'],
      expiration_date: ['DATE', 'DATE_ISO'],
      verification_status: ['CODE']
    },
    hc_staff_credential: {
      credential_number: ['ID_ALPHANUMERIC'],
      issued_date: ['DATE', 'DATE_ISO'],
      expiration_date: ['DATE', 'DATE_ISO'],
      issuing_institution: ['TEXT_SHORT'],
      verification_status: ['CODE']
    },
    hc_department: {
      department_code: ['CODE', 'ID_ALPHANUMERIC'],
      department_name: ['TEXT_SHORT'],
      department_type: ['CODE'],
      cost_center: ['ID_ALPHANUMERIC'],
      location: ['TEXT_SHORT']
    },
    hc_facility: {
      facility_code: ['CODE', 'ID_ALPHANUMERIC'],
      facility_name: ['TEXT_SHORT'],
      facility_type: ['CODE'],
      address_line1: ['TEXT_SHORT'],
      address_line2: ['TEXT_SHORT'],
      city: ['TEXT_SHORT'],
      state: ['STATE_CODE'],
      zip: ['ZIP'],
      phone: ['PHONE'],
      fax: ['PHONE']
    },
    hc_organization: {
      organization_name: ['TEXT_SHORT'],
      organization_type: ['CODE'],
      npi: ['NPI'],
      tax_id: ['ID_ALPHANUMERIC'],
      address_line1: ['TEXT_SHORT'],
      city: ['TEXT_SHORT'],
      state: ['STATE_CODE'],
      zip: ['ZIP'],
      phone: ['PHONE'],
      cms_certification_number: ['ID_ALPHANUMERIC']
    },

    // =========================================================================
    // FHIR R4 Clinical Resources - Maps to standard FHIR resource structures
    // =========================================================================

    fhir_patient: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      identifier_mrn: ['ID_ALPHANUMERIC', 'ID_NUMERIC'],
      identifier_ssn: ['SSN'],
      name_given: ['NAME_FIRST', 'TEXT_SHORT'],
      name_family: ['NAME_LAST', 'TEXT_SHORT'],
      name_prefix: ['CODE', 'TEXT_SHORT'],
      name_suffix: ['CODE', 'TEXT_SHORT'],
      birth_date: ['DATE', 'DATE_ISO'],
      gender: ['CODE'],
      deceased_boolean: ['BOOLEAN'],
      deceased_datetime: ['DATE_ISO'],
      address_line: ['TEXT_SHORT'],
      address_city: ['TEXT_SHORT'],
      address_state: ['STATE_CODE'],
      address_postal_code: ['ZIP'],
      address_country: ['CODE', 'TEXT_SHORT'],
      telecom_phone: ['PHONE'],
      telecom_email: ['EMAIL'],
      marital_status: ['CODE'],
      multiple_birth_boolean: ['BOOLEAN'],
      communication_language: ['CODE'],
      general_practitioner: ['FHIR_REFERENCE'],
      managing_organization: ['FHIR_REFERENCE']
    },

    fhir_observation: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      category_code: ['LOINC', 'SNOMED_CT', 'CODE'],
      code_loinc: ['LOINC'],
      code_snomed: ['SNOMED_CT'],
      code_display: ['TEXT_SHORT'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      effective_datetime: ['DATE_ISO'],
      effective_period_start: ['DATE_ISO'],
      effective_period_end: ['DATE_ISO'],
      issued: ['DATE_ISO'],
      performer: ['FHIR_REFERENCE'],
      value_quantity: ['CURRENCY', 'PERCENTAGE', 'ID_NUMERIC'],
      value_quantity_unit: ['CODE', 'TEXT_SHORT'],
      value_string: ['TEXT_SHORT', 'TEXT_LONG'],
      value_boolean: ['BOOLEAN'],
      value_codeable_concept: ['SNOMED_CT', 'LOINC', 'CODE'],
      interpretation: ['CODE'],
      note: ['TEXT_LONG'],
      body_site: ['SNOMED_CT', 'CODE'],
      method: ['SNOMED_CT', 'CODE'],
      specimen: ['FHIR_REFERENCE'],
      device: ['FHIR_REFERENCE'],
      reference_range_low: ['ID_NUMERIC'],
      reference_range_high: ['ID_NUMERIC']
    },

    fhir_condition: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      clinical_status: ['CODE'],
      verification_status: ['CODE'],
      category: ['CODE'],
      severity: ['SNOMED_CT', 'CODE'],
      code_icd10: ['ICD10'],
      code_snomed: ['SNOMED_CT'],
      code_display: ['TEXT_SHORT'],
      body_site: ['SNOMED_CT', 'CODE'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      onset_datetime: ['DATE_ISO'],
      onset_age: ['ID_NUMERIC'],
      onset_period_start: ['DATE_ISO'],
      onset_period_end: ['DATE_ISO'],
      onset_string: ['TEXT_SHORT'],
      abatement_datetime: ['DATE_ISO'],
      abatement_age: ['ID_NUMERIC'],
      abatement_string: ['TEXT_SHORT'],
      recorded_date: ['DATE_ISO'],
      recorder: ['FHIR_REFERENCE'],
      asserter: ['FHIR_REFERENCE'],
      stage_summary: ['SNOMED_CT', 'CODE'],
      evidence_code: ['SNOMED_CT', 'ICD10', 'CODE'],
      note: ['TEXT_LONG']
    },

    fhir_medication_request: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      status_reason: ['CODE'],
      intent: ['CODE'],
      category: ['CODE'],
      priority: ['CODE'],
      do_not_perform: ['BOOLEAN'],
      medication_rxnorm: ['RXNORM'],
      medication_ndc: ['NDC'],
      medication_display: ['TEXT_SHORT'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      authored_on: ['DATE_ISO'],
      requester: ['FHIR_REFERENCE'],
      performer: ['FHIR_REFERENCE'],
      reason_code: ['SNOMED_CT', 'ICD10', 'CODE'],
      reason_reference: ['FHIR_REFERENCE'],
      dosage_text: ['TEXT_SHORT', 'TEXT_LONG'],
      dosage_timing: ['TEXT_SHORT'],
      dosage_route: ['SNOMED_CT', 'CODE'],
      dosage_method: ['SNOMED_CT', 'CODE'],
      dosage_dose_quantity: ['ID_NUMERIC'],
      dosage_dose_unit: ['CODE', 'TEXT_SHORT'],
      dispense_quantity: ['ID_NUMERIC'],
      dispense_unit: ['CODE', 'TEXT_SHORT'],
      days_supply: ['ID_NUMERIC'],
      number_of_refills: ['ID_NUMERIC'],
      substitution_allowed: ['BOOLEAN'],
      note: ['TEXT_LONG']
    },

    fhir_procedure: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      status_reason: ['CODE'],
      category: ['SNOMED_CT', 'CODE'],
      code_cpt: ['CPT'],
      code_snomed: ['SNOMED_CT'],
      code_display: ['TEXT_SHORT'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      performed_datetime: ['DATE_ISO'],
      performed_period_start: ['DATE_ISO'],
      performed_period_end: ['DATE_ISO'],
      recorder: ['FHIR_REFERENCE'],
      asserter: ['FHIR_REFERENCE'],
      performer: ['FHIR_REFERENCE'],
      performer_role: ['CODE'],
      location: ['FHIR_REFERENCE'],
      reason_code: ['SNOMED_CT', 'ICD10', 'CODE'],
      reason_reference: ['FHIR_REFERENCE'],
      body_site: ['SNOMED_CT', 'CODE'],
      outcome: ['SNOMED_CT', 'CODE'],
      complication: ['SNOMED_CT', 'ICD10', 'CODE'],
      follow_up: ['SNOMED_CT', 'CODE'],
      note: ['TEXT_LONG'],
      used_reference: ['FHIR_REFERENCE']
    },

    fhir_encounter: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      status_history: ['CODE'],
      class_code: ['CODE'],
      type: ['SNOMED_CT', 'CPT', 'CODE'],
      service_type: ['SNOMED_CT', 'CODE'],
      priority: ['SNOMED_CT', 'CODE'],
      subject: ['FHIR_REFERENCE'],
      participant: ['FHIR_REFERENCE'],
      participant_type: ['CODE'],
      period_start: ['DATE_ISO'],
      period_end: ['DATE_ISO'],
      length_value: ['ID_NUMERIC'],
      length_unit: ['CODE'],
      reason_code: ['SNOMED_CT', 'ICD10', 'CODE'],
      reason_reference: ['FHIR_REFERENCE'],
      diagnosis: ['FHIR_REFERENCE'],
      diagnosis_use: ['CODE'],
      diagnosis_rank: ['ID_NUMERIC'],
      account: ['FHIR_REFERENCE'],
      hospitalization_admit_source: ['CODE'],
      hospitalization_discharge_disposition: ['CODE'],
      location: ['FHIR_REFERENCE'],
      service_provider: ['FHIR_REFERENCE'],
      part_of: ['FHIR_REFERENCE']
    },

    fhir_diagnostic_report: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      category: ['LOINC', 'SNOMED_CT', 'CODE'],
      code_loinc: ['LOINC'],
      code_snomed: ['SNOMED_CT'],
      code_display: ['TEXT_SHORT'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      effective_datetime: ['DATE_ISO'],
      effective_period_start: ['DATE_ISO'],
      effective_period_end: ['DATE_ISO'],
      issued: ['DATE_ISO'],
      performer: ['FHIR_REFERENCE'],
      results_interpreter: ['FHIR_REFERENCE'],
      specimen: ['FHIR_REFERENCE'],
      result: ['FHIR_REFERENCE'],
      imaging_study: ['FHIR_REFERENCE'],
      conclusion: ['TEXT_LONG'],
      conclusion_code: ['SNOMED_CT', 'ICD10', 'CODE'],
      presented_form: ['TEXT_SHORT']
    },

    fhir_allergy_intolerance: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      clinical_status: ['CODE'],
      verification_status: ['CODE'],
      type: ['CODE'],
      category: ['CODE'],
      criticality: ['CODE'],
      code_rxnorm: ['RXNORM'],
      code_snomed: ['SNOMED_CT'],
      code_ndc: ['NDC'],
      code_display: ['TEXT_SHORT'],
      patient: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      onset_datetime: ['DATE_ISO'],
      onset_age: ['ID_NUMERIC'],
      onset_string: ['TEXT_SHORT'],
      recorded_date: ['DATE_ISO'],
      recorder: ['FHIR_REFERENCE'],
      asserter: ['FHIR_REFERENCE'],
      last_occurrence: ['DATE_ISO'],
      note: ['TEXT_LONG'],
      reaction_substance: ['RXNORM', 'SNOMED_CT', 'CODE'],
      reaction_manifestation: ['SNOMED_CT', 'CODE'],
      reaction_severity: ['CODE'],
      reaction_onset: ['DATE_ISO'],
      reaction_note: ['TEXT_LONG']
    },

    fhir_immunization: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      status_reason: ['CODE'],
      vaccine_code_cvx: ['CODE', 'ID_NUMERIC'],
      vaccine_code_snomed: ['SNOMED_CT'],
      vaccine_code_display: ['TEXT_SHORT'],
      patient: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      occurrence_datetime: ['DATE_ISO'],
      occurrence_string: ['TEXT_SHORT'],
      recorded: ['DATE_ISO'],
      primary_source: ['BOOLEAN'],
      report_origin: ['CODE'],
      location: ['FHIR_REFERENCE'],
      manufacturer: ['TEXT_SHORT', 'FHIR_REFERENCE'],
      lot_number: ['ID_ALPHANUMERIC'],
      expiration_date: ['DATE', 'DATE_ISO'],
      site: ['SNOMED_CT', 'CODE'],
      route: ['SNOMED_CT', 'CODE'],
      dose_quantity: ['ID_NUMERIC'],
      dose_unit: ['CODE'],
      performer: ['FHIR_REFERENCE'],
      performer_function: ['CODE'],
      note: ['TEXT_LONG'],
      reason_code: ['SNOMED_CT', 'CODE'],
      is_subpotent: ['BOOLEAN'],
      subpotent_reason: ['CODE']
    },

    fhir_care_plan: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      intent: ['CODE'],
      category: ['SNOMED_CT', 'CODE'],
      title: ['TEXT_SHORT'],
      description: ['TEXT_LONG'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      period_start: ['DATE_ISO'],
      period_end: ['DATE_ISO'],
      created: ['DATE_ISO'],
      author: ['FHIR_REFERENCE'],
      contributor: ['FHIR_REFERENCE'],
      care_team: ['FHIR_REFERENCE'],
      addresses: ['FHIR_REFERENCE'],
      supporting_info: ['FHIR_REFERENCE'],
      goal: ['FHIR_REFERENCE'],
      activity_detail_status: ['CODE'],
      activity_detail_code: ['SNOMED_CT', 'CPT', 'CODE'],
      activity_detail_description: ['TEXT_LONG'],
      activity_detail_scheduled: ['DATE_ISO', 'TEXT_SHORT'],
      activity_detail_performer: ['FHIR_REFERENCE'],
      note: ['TEXT_LONG']
    },

    fhir_risk_assessment: {
      resource_id: ['ID_UUID', 'FHIR_REFERENCE'],
      resource_type: ['FHIR_RESOURCE_TYPE'],
      status: ['CODE'],
      method: ['SNOMED_CT', 'CODE'],
      code: ['SNOMED_CT', 'LOINC', 'CODE'],
      subject: ['FHIR_REFERENCE'],
      encounter: ['FHIR_REFERENCE'],
      occurrence_datetime: ['DATE_ISO'],
      occurrence_period_start: ['DATE_ISO'],
      occurrence_period_end: ['DATE_ISO'],
      condition: ['FHIR_REFERENCE'],
      performer: ['FHIR_REFERENCE'],
      reason_code: ['SNOMED_CT', 'ICD10', 'CODE'],
      reason_reference: ['FHIR_REFERENCE'],
      basis: ['FHIR_REFERENCE'],
      prediction_outcome: ['CODE', 'SNOMED_CT'],
      prediction_probability: ['PERCENTAGE', 'ID_NUMERIC'],
      prediction_qualitative_risk: ['CODE'],
      prediction_when: ['DATE_ISO', 'TEXT_SHORT'],
      prediction_rationale: ['TEXT_LONG'],
      mitigation: ['TEXT_LONG'],
      note: ['TEXT_LONG']
    }
  };

  // Column name synonyms for matching
  private static synonyms: Record<string, string[]> = {
    // Staff/Person identifiers
    first_name: ['fname', 'firstname', 'first', 'given_name', 'givenname', 'forename'],
    last_name: ['lname', 'lastname', 'last', 'surname', 'family_name', 'familyname'],
    middle_name: ['mname', 'middlename', 'middle', 'mi', 'middle_initial'],
    email: ['email_address', 'emailaddress', 'e_mail', 'mail', 'work_email'],
    phone_work: ['work_phone', 'workphone', 'office_phone', 'business_phone', 'phone', 'telephone'],
    phone_mobile: ['mobile', 'cell', 'cellphone', 'cell_phone', 'mobile_phone', 'personal_phone'],
    phone_home: ['home_phone', 'homephone'],
    npi: ['npi_number', 'national_provider_id', 'provider_npi', 'npi_id'],
    dea_number: ['dea', 'dea_num', 'dea_id', 'dea_license'],
    employee_id: ['emp_id', 'empid', 'employee_number', 'emp_num', 'staff_id', 'badge', 'badge_id', 'personnel_id'],
    hire_date: ['start_date', 'startdate', 'date_hired', 'employment_date', 'hire_dt', 'employed_since'],
    termination_date: ['end_date', 'enddate', 'term_date', 'separation_date', 'term_dt', 'last_day'],
    date_of_birth: ['dob', 'birthdate', 'birth_date', 'birthday', 'birth_dt'],
    address_line1: ['address', 'street', 'street_address', 'addr1', 'address1', 'addr'],
    address_line2: ['address2', 'addr2', 'suite', 'apt', 'unit', 'apartment'],
    city: ['city_name', 'town'],
    state: ['state_code', 'st', 'province', 'state_abbr'],
    zip: ['zipcode', 'zip_code', 'postal', 'postal_code', 'postalcode'],
    department_name: ['dept', 'department', 'dept_name', 'division'],
    department_code: ['dept_code', 'dept_id', 'department_id', 'dept_num'],
    license_number: ['lic_num', 'license_num', 'license_no', 'lic_no', 'license_id'],
    expiration_date: ['exp_date', 'expires', 'expiry', 'expiration', 'exp_dt', 'valid_until'],
    issued_date: ['issue_date', 'issue_dt', 'granted_date', 'effective_date'],
    facility_name: ['location', 'site', 'site_name', 'building', 'campus'],
    facility_code: ['location_code', 'site_code', 'site_id', 'building_code'],
    employment_status: ['status', 'emp_status', 'active_status', 'employee_status'],
    employment_type: ['emp_type', 'job_type', 'position_type', 'work_type'],
    gender: ['sex', 'gender_code'],
    preferred_name: ['nickname', 'goes_by', 'known_as', 'alias'],

    // =========================================================================
    // FHIR Clinical Synonyms - Common variations in healthcare data
    // =========================================================================

    // Patient identifiers
    identifier_mrn: ['mrn', 'medical_record_number', 'med_rec_num', 'patient_id', 'patient_number', 'chart_number', 'account_number'],
    identifier_ssn: ['ssn', 'social_security', 'social_security_number', 'ssn_last_4'],
    name_given: ['first_name', 'given', 'fname', 'patient_first_name', 'pt_first'],
    name_family: ['last_name', 'family', 'lname', 'patient_last_name', 'pt_last', 'surname'],
    birth_date: ['dob', 'date_of_birth', 'birthdate', 'birthday', 'patient_dob', 'pt_dob'],
    telecom_phone: ['phone', 'telephone', 'contact_phone', 'patient_phone', 'pt_phone'],
    telecom_email: ['email', 'patient_email', 'contact_email', 'pt_email'],
    address_line: ['address', 'street_address', 'patient_address', 'home_address', 'addr1'],
    address_postal_code: ['zip', 'zipcode', 'zip_code', 'postal_code', 'patient_zip'],
    address_city: ['city', 'patient_city', 'home_city'],
    address_state: ['state', 'patient_state', 'home_state', 'state_code'],
    marital_status: ['marital', 'marital_code', 'marriage_status'],

    // Observation/Vital signs
    code_loinc: ['loinc', 'loinc_code', 'loinc_num', 'observation_code', 'test_code', 'lab_code'],
    code_snomed: ['snomed', 'snomed_code', 'snomed_ct', 'clinical_code', 'diagnosis_code'],
    value_quantity: ['result', 'value', 'result_value', 'test_result', 'lab_value', 'numeric_result'],
    value_quantity_unit: ['unit', 'units', 'uom', 'result_unit', 'measurement_unit'],
    value_string: ['result_text', 'text_result', 'string_result', 'narrative_result'],
    effective_datetime: ['observation_date', 'result_date', 'test_date', 'collected_date', 'specimen_date'],
    reference_range_low: ['low_range', 'ref_low', 'normal_low', 'range_low'],
    reference_range_high: ['high_range', 'ref_high', 'normal_high', 'range_high'],
    interpretation: ['abnormal_flag', 'result_flag', 'interp', 'interpretation_code'],

    // Condition/Diagnosis
    code_icd10: ['icd10', 'icd_10', 'icd10_code', 'diagnosis_code', 'dx_code', 'icd_code'],
    clinical_status: ['status', 'condition_status', 'dx_status', 'active_inactive'],
    verification_status: ['verified', 'confirmed', 'verification', 'dx_verification'],
    onset_datetime: ['onset', 'onset_date', 'diagnosis_date', 'dx_date', 'start_date', 'diagnosed_on'],
    abatement_datetime: ['resolved', 'resolved_date', 'end_date', 'resolution_date'],
    recorded_date: ['entry_date', 'documented_date', 'record_date', 'charted_date'],
    severity: ['acuity', 'condition_severity', 'dx_severity', 'priority'],
    body_site: ['location', 'anatomical_site', 'site', 'body_part', 'laterality'],

    // Medication
    medication_rxnorm: ['rxnorm', 'rxnorm_code', 'rx_code', 'drug_code', 'ndc_rxnorm'],
    medication_ndc: ['ndc', 'ndc_code', 'national_drug_code', 'drug_ndc'],
    medication_display: ['medication', 'drug_name', 'med_name', 'prescription', 'rx_name'],
    dosage_text: ['dosage', 'dose', 'sig', 'instructions', 'dosing_instructions', 'directions'],
    dosage_route: ['route', 'admin_route', 'route_of_administration', 'delivery_route'],
    dosage_dose_quantity: ['dose_amount', 'quantity', 'dose_qty', 'amount'],
    dosage_dose_unit: ['dose_unit', 'strength_unit', 'dosage_unit'],
    dispense_quantity: ['quantity_dispensed', 'qty', 'amount_dispensed', 'fill_qty'],
    number_of_refills: ['refills', 'refill_count', 'refills_remaining', 'refill_number'],
    days_supply: ['supply_days', 'day_supply', 'days'],
    authored_on: ['prescription_date', 'rx_date', 'order_date', 'written_date'],

    // Procedure
    code_cpt: ['cpt', 'cpt_code', 'procedure_code', 'service_code', 'billing_code'],
    performed_datetime: ['procedure_date', 'service_date', 'performed_date', 'surgery_date'],
    performer: ['provider', 'performing_provider', 'surgeon', 'physician', 'practitioner'],
    outcome: ['result', 'procedure_outcome', 'surgery_outcome'],

    // Encounter/Visit
    class_code: ['encounter_type', 'visit_type', 'patient_class', 'service_type'],
    period_start: ['admit_date', 'admission_date', 'visit_date', 'start_date', 'arrival_date'],
    period_end: ['discharge_date', 'end_date', 'departure_date', 'checkout_date'],
    hospitalization_admit_source: ['admit_source', 'referral_source', 'admission_source'],
    hospitalization_discharge_disposition: ['discharge_disposition', 'discharge_status', 'discharge_type'],
    reason_code: ['chief_complaint', 'reason_for_visit', 'presenting_problem', 'visit_reason'],
    service_provider: ['facility', 'hospital', 'clinic', 'organization'],

    // Diagnostic Report
    conclusion: ['impression', 'findings', 'result_summary', 'report_conclusion', 'interpretation'],
    conclusion_code: ['finding_code', 'impression_code', 'result_code'],
    results_interpreter: ['radiologist', 'pathologist', 'interpreting_physician', 'reading_physician'],

    // Allergy
    criticality: ['severity', 'allergy_severity', 'reaction_severity', 'risk_level'],
    code_rxnorm: ['allergen_rxnorm', 'substance_code', 'drug_allergen'],
    reaction_manifestation: ['reaction', 'symptom', 'adverse_reaction', 'reaction_type'],
    last_occurrence: ['last_reaction', 'most_recent_reaction', 'last_episode'],

    // Immunization/Vaccine
    vaccine_code_cvx: ['cvx', 'cvx_code', 'vaccine_code', 'immunization_code'],
    lot_number: ['lot', 'batch_number', 'lot_num', 'vaccine_lot'],
    site: ['injection_site', 'admin_site', 'body_site'],
    route: ['admin_route', 'administration_route', 'injection_route'],

    // Care Plan
    title: ['plan_name', 'care_plan_name', 'plan_title'],
    description: ['plan_description', 'care_plan_description', 'summary'],
    goal: ['treatment_goal', 'care_goal', 'objective'],
    activity_detail_code: ['intervention', 'activity_code', 'treatment_code'],

    // Risk Assessment
    prediction_probability: ['risk_score', 'probability', 'likelihood', 'risk_percentage', 'risk_level'],
    prediction_outcome: ['predicted_outcome', 'risk_outcome', 'projected_outcome'],
    mitigation: ['intervention', 'prevention', 'risk_mitigation', 'action_plan'],

    // Common FHIR references
    subject: ['patient', 'patient_reference', 'subject_reference', 'pt_ref'],
    encounter: ['visit', 'encounter_reference', 'visit_reference', 'admission'],
    requester: ['ordering_provider', 'prescriber', 'ordered_by', 'requesting_physician'],
    recorder: ['documenter', 'entered_by', 'documented_by', 'charted_by'],
    asserter: ['reported_by', 'informant', 'source', 'information_source']
  };

  // AI-assisted mapping configuration
  private aiConfig: AIAssistConfig;
  private aiCache: Map<string, AIMappingSuggestion> = new Map();

  constructor(supabase: SupabaseClient, organizationId?: string, aiConfig?: Partial<AIAssistConfig>) {
    this.supabase = supabase;
    this.organizationId = organizationId;

    // Default AI configuration - hybrid mode enabled
    this.aiConfig = {
      enabled: aiConfig?.enabled ?? true,
      confidenceThreshold: aiConfig?.confidenceThreshold ?? 0.6,
      apiEndpoint: aiConfig?.apiEndpoint ?? '/api/anthropic-chats',
      maxTokens: aiConfig?.maxTokens ?? 2000,
      model: aiConfig?.model,
      cacheResponses: aiConfig?.cacheResponses ?? true
    };
  }

  /** Update AI configuration */
  setAIConfig(config: Partial<AIAssistConfig>): void {
    this.aiConfig = { ...this.aiConfig, ...config };
  }

  /** Generate mapping suggestions for a source DNA (hybrid: pattern + AI) */
  async suggestMappings(sourceDNA: SourceDNA): Promise<MappingSuggestion[]> {
    const suggestions: MappingSuggestion[] = [];

    for (const column of sourceDNA.columns) {
      const suggestion = await this.suggestMappingForColumn(column, sourceDNA);
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /** Suggest mapping for a single column */
  private async suggestMappingForColumn(
    column: ColumnDNA,
    sourceDNA: SourceDNA
  ): Promise<MappingSuggestion> {
    const candidates: Array<{
      table: string;
      column: string;
      score: number;
      reasons: string[];
    }> = [];

    // 1. Check learned mappings first (highest priority)
    const learnedMatch = await this.findLearnedMapping(column, sourceDNA);
    if (learnedMatch) {
      candidates.push({
        table: learnedMatch.targetTable,
        column: learnedMatch.targetColumn,
        score: 0.5 + (learnedMatch.confidence * 0.5), // 0.5 - 1.0 based on confidence
        reasons: [`Previously learned mapping (${Math.round(learnedMatch.confidence * 100)}% confidence)`]
      });
    }

    // 2. Pattern matching against target schema
    for (const [table, columns] of Object.entries(MappingIntelligence.targetSchema)) {
      for (const [targetCol, acceptablePatterns] of Object.entries(columns)) {
        let score = 0;
        const reasons: string[] = [];

        // Pattern match
        if (acceptablePatterns.includes(column.primaryPattern)) {
          score += 0.3;
          reasons.push(`Pattern match: ${column.primaryPattern}`);
        }

        // Name similarity
        const nameSimilarity = this.calculateNameSimilarity(column.normalizedName, targetCol);
        if (nameSimilarity > 0.5) {
          score += nameSimilarity * 0.4;
          reasons.push(`Name similarity: ${Math.round(nameSimilarity * 100)}%`);
        }

        // Synonym match
        const synonyms = MappingIntelligence.synonyms[targetCol] || [];
        if (synonyms.includes(column.normalizedName)) {
          score += 0.25;
          reasons.push('Synonym match');
        }

        // Original name contains target
        if (column.originalName.toLowerCase().includes(targetCol.replace(/_/g, ''))) {
          score += 0.1;
          reasons.push('Name contains target');
        }

        if (score > 0.2) {
          candidates.push({ table, column: targetCol, score, reasons });
        }
      }
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    // Build suggestion from pattern matching
    const best = candidates[0];
    const alternatives = candidates.slice(1, 4);
    const patternConfidence = best?.score || 0;

    // HYBRID: If pattern confidence is below threshold, use AI assistance
    if (this.aiConfig.enabled && patternConfidence < this.aiConfig.confidenceThreshold) {
      const aiSuggestion = await this.getAIMappingSuggestion(column, sourceDNA);

      if (aiSuggestion && aiSuggestion.confidence > patternConfidence) {
        // AI suggestion is better - use it
        return {
          sourceColumn: column.originalName,
          targetTable: aiSuggestion.suggestedTable,
          targetColumn: aiSuggestion.suggestedColumn,
          confidence: aiSuggestion.confidence,
          reasons: [`AI-assisted mapping: ${aiSuggestion.reasoning}`],
          transformRequired: aiSuggestion.transformation || this.determineTransform(column, aiSuggestion.suggestedColumn),
          alternativeMappings: aiSuggestion.alternativeMappings?.map(a => ({
            targetTable: a.table,
            targetColumn: a.column,
            confidence: a.confidence
          })) || alternatives.map(a => ({
            targetTable: a.table,
            targetColumn: a.column,
            confidence: a.score
          }))
        };
      }
    }

    // Use pattern-based suggestion (or fallback if AI also low confidence)
    return {
      sourceColumn: column.originalName,
      targetTable: best?.table || 'UNMAPPED',
      targetColumn: best?.column || 'UNMAPPED',
      confidence: best?.score || 0,
      reasons: best?.reasons || ['No match found'],
      transformRequired: this.determineTransform(column, best?.column),
      alternativeMappings: alternatives.map(a => ({
        targetTable: a.table,
        targetColumn: a.column,
        confidence: a.score
      }))
    };
  }

  // ===========================================================================
  // AI-ASSISTED MAPPING - Claude Integration for Complex Cases
  // ===========================================================================

  /** Get AI-assisted mapping suggestion for a column */
  private async getAIMappingSuggestion(
    column: ColumnDNA,
    sourceDNA: SourceDNA
  ): Promise<AIMappingSuggestion | null> {
    // Check cache first
    const cacheKey = `${sourceDNA.sourceSystem || 'unknown'}_${column.normalizedName}_${column.primaryPattern}`;
    if (this.aiConfig.cacheResponses && this.aiCache.has(cacheKey)) {
      return this.aiCache.get(cacheKey)!;
    }

    try {
      await auditLogger.info('DNA_MAPPER_AI_ASSIST_START', {
        column: column.originalName,
        pattern: column.primaryPattern,
        sourceSystem: sourceDNA.sourceSystem
      });

      const response = await fetch(this.aiConfig.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: this.getAISystemPrompt()
            },
            {
              role: 'user',
              content: this.buildAIPrompt(column, sourceDNA)
            }
          ],
          max_tokens: this.aiConfig.maxTokens
        })
      });

      if (!response.ok) {
        await auditLogger.warn('DNA_MAPPER_AI_ASSIST_FAILED', {
          column: column.originalName,
          status: response.status,
          error: response.statusText
        });
        return null;
      }

      const data = await response.json() as { content?: Array<{ text?: string }> };

      if (!data.content || !data.content[0]?.text) {
        return null;
      }

      // Parse AI response
      const suggestion = this.parseAIResponse(data.content[0].text, column.originalName);

      if (suggestion) {
        // Cache successful response
        if (this.aiConfig.cacheResponses) {
          this.aiCache.set(cacheKey, suggestion);
        }

        await auditLogger.info('DNA_MAPPER_AI_ASSIST_SUCCESS', {
          column: column.originalName,
          suggestedTable: suggestion.suggestedTable,
          suggestedColumn: suggestion.suggestedColumn,
          confidence: suggestion.confidence
        });
      }

      return suggestion;
    } catch (err: unknown) {
      await auditLogger.error('DNA_MAPPER_AI_ASSIST_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { column: column.originalName }
      );
      return null;
    }
  }

  /** System prompt for AI mapping assistant */
  private getAISystemPrompt(): string {
    // Get list of available target tables and their columns
    const availableTables = Object.entries(MappingIntelligence.targetSchema)
      .map(([table, cols]) => `${table}: ${Object.keys(cols).join(', ')}`)
      .join('\n');

    return `You are an expert healthcare data migration specialist with deep knowledge of FHIR R4, HL7, and clinical data standards.

Your task is to analyze a source column and suggest the best target table and column mapping.

AVAILABLE TARGET TABLES AND COLUMNS:
${availableTables}

CLINICAL CODE SYSTEMS TO RECOGNIZE:
- LOINC: Lab/observation codes (format: 12345-6)
- SNOMED CT: Clinical codes (6-18 digit numbers)
- ICD-10: Diagnosis codes (format: A00.1)
- CPT: Procedure codes (5 digits)
- RxNorm: Medication codes (5-7 digits)
- NDC: Drug codes (4-4-2, 5-3-2, or 5-4-1 format)
- NPI: Provider identifiers (10 digits with Luhn check)

RESPOND WITH JSON ONLY - NO MARKDOWN:
{
  "suggestedTable": "table_name",
  "suggestedColumn": "column_name",
  "fhirResource": "FHIR resource if applicable (Patient, Observation, etc.)",
  "fhirPath": "FHIR path if applicable",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this mapping is suggested",
  "transformation": "Transformation needed, if any (e.g., NORMALIZE_PHONE, CONVERT_DATE_TO_ISO)",
  "alternativeMappings": [
    {"table": "alt_table", "column": "alt_column", "confidence": 0.6}
  ]
}`;
  }

  /** Build the AI prompt for a specific column */
  private buildAIPrompt(column: ColumnDNA, sourceDNA: SourceDNA): string {
    return `Analyze this source column and suggest the best mapping:

SOURCE COLUMN:
- Name: ${column.originalName}
- Normalized Name: ${column.normalizedName}
- Detected Pattern: ${column.primaryPattern}
- All Detected Patterns: ${column.detectedPatterns.join(', ')}
- Inferred Data Type: ${column.dataTypeInferred}
- Average Length: ${Math.round(column.avgLength)}
- Sample Values: ${column.sampleValues.slice(0, 3).map(v => `"${v}"`).join(', ')}
- Unique %: ${Math.round(column.uniquePercentage * 100)}%
- Null %: ${Math.round(column.nullPercentage * 100)}%

SOURCE CONTEXT:
- Source System: ${sourceDNA.sourceSystem || 'Unknown'}
- Source Type: ${sourceDNA.sourceType}
- Total Columns: ${sourceDNA.columnCount}

Provide your mapping suggestion as JSON.`;
  }

  /** Parse AI response into structured suggestion */
  private parseAIResponse(responseText: string, sourceColumn: string): AIMappingSuggestion | null {
    try {
      // Clean up response (remove markdown if present)
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(jsonText) as {
        suggestedTable?: string;
        suggestedColumn?: string;
        fhirResource?: string;
        fhirPath?: string;
        confidence?: number;
        reasoning?: string;
        transformation?: string;
        alternativeMappings?: Array<{ table: string; column: string; confidence: number }>;
      };

      // Validate required fields
      if (!parsed.suggestedTable || !parsed.suggestedColumn) {
        return null;
      }

      // Validate suggested table exists
      if (!MappingIntelligence.targetSchema[parsed.suggestedTable]) {
        // Try to find a close match
        const availableTables = Object.keys(MappingIntelligence.targetSchema);
        const matchingTable = availableTables.find(t =>
          t.toLowerCase().includes(parsed.suggestedTable?.toLowerCase() || '') ||
          (parsed.suggestedTable?.toLowerCase() || '').includes(t.toLowerCase())
        );
        if (matchingTable) {
          parsed.suggestedTable = matchingTable;
        } else {
          return null;
        }
      }

      // Validate suggested column exists in table
      const tableSchema = MappingIntelligence.targetSchema[parsed.suggestedTable];
      if (!tableSchema[parsed.suggestedColumn]) {
        // Try to find a close match
        const availableColumns = Object.keys(tableSchema);
        const matchingColumn = availableColumns.find(c =>
          c.toLowerCase().includes(parsed.suggestedColumn?.toLowerCase() || '') ||
          (parsed.suggestedColumn?.toLowerCase() || '').includes(c.toLowerCase())
        );
        if (matchingColumn) {
          parsed.suggestedColumn = matchingColumn;
        }
        // Allow unmapped columns for FHIR resources
      }

      return {
        sourceColumn,
        suggestedTable: parsed.suggestedTable,
        suggestedColumn: parsed.suggestedColumn,
        fhirResource: parsed.fhirResource,
        fhirPath: parsed.fhirPath,
        confidence: Math.min(parsed.confidence || 0.7, 0.95), // Cap AI confidence at 95%
        reasoning: parsed.reasoning || 'AI-suggested mapping',
        transformation: parsed.transformation,
        alternativeMappings: parsed.alternativeMappings?.filter(alt =>
          MappingIntelligence.targetSchema[alt.table]
        )
      };
    } catch (err: unknown) {
      auditLogger.warn('DNA_MAPPER_AI_PARSE_FAILED', {
        error: err instanceof Error ? err.message : String(err),
        sourceColumn
      });
      return null;
    }
  }

  /** Clear AI suggestion cache */
  clearAICache(): void {
    this.aiCache.clear();
  }

  /** Find previously learned mapping */
  private async findLearnedMapping(
    column: ColumnDNA,
    sourceDNA: SourceDNA
  ): Promise<LearnedMapping | null> {
    try {
      // Query learned mappings table
      let query = this.supabase
        .from('migration_learned_mappings')
        .select('*')
        .eq('source_column_normalized', column.normalizedName)
        .order('confidence', { ascending: false })
        .limit(1);

      // Prefer org-specific learnings
      if (this.organizationId) {
        query = query.or(`organization_id.eq.${this.organizationId},organization_id.is.null`);
      }

      // Also match on source system if known
      if (sourceDNA.sourceSystem) {
        query = query.or(`source_system.eq.${sourceDNA.sourceSystem},source_system.is.null`);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0] as Record<string, unknown>;
      return {
        mappingId: row.mapping_id as string,
        sourceColumnNormalized: row.source_column_normalized as string,
        sourcePatterns: row.source_patterns as DataPattern[],
        targetTable: row.target_table as string,
        targetColumn: row.target_column as string,
        transformFunction: row.transform_function as string | undefined,
        successCount: row.success_count as number,
        failureCount: row.failure_count as number,
        lastUsed: new Date(row.last_used as string),
        confidence: row.confidence as number,
        organizationId: row.organization_id as string | undefined
      };
    } catch {
      return null;
    }
  }

  /** Calculate name similarity using Levenshtein distance */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const s1 = name1.toLowerCase().replace(/_/g, '');
    const s2 = name2.toLowerCase().replace(/_/g, '');

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i-1] === s2[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  /** Determine if transformation is needed */
  private determineTransform(source: ColumnDNA, targetColumn?: string): string | undefined {
    if (!targetColumn) return undefined;

    // Phone normalization
    if (targetColumn.includes('phone') && source.primaryPattern === 'PHONE') {
      return 'NORMALIZE_PHONE';
    }

    // Date format conversion
    if (['hire_date', 'termination_date', 'expiration_date', 'date_of_birth', 'issued_date'].includes(targetColumn)) {
      if (source.primaryPattern === 'DATE') {
        return 'CONVERT_DATE_TO_ISO';
      }
    }

    // Name parsing
    if (source.primaryPattern === 'NAME_FULL') {
      if (targetColumn === 'first_name') return 'PARSE_NAME_FIRST';
      if (targetColumn === 'last_name') return 'PARSE_NAME_LAST';
    }

    // State code normalization
    if (targetColumn === 'state' && source.avgLength > 2) {
      return 'CONVERT_STATE_TO_CODE';
    }

    return undefined;
  }

  /** Learn from migration results (call after migration completes) */
  async learnFromResults(
    sourceDNA: SourceDNA,
    results: MigrationResult[]
  ): Promise<void> {
    for (const result of results) {
      const sourceColumn = sourceDNA.columns.find(
        c => c.originalName === result.sourceColumn
      );
      if (!sourceColumn) continue;

      // Determine final mapping (user correction or original)
      const finalTable = result.userCorrectedTo?.targetTable || result.targetTable;
      const finalColumn = result.userCorrectedTo?.targetColumn || result.targetColumn;

      // Update or create learned mapping
      await this.supabase.rpc('upsert_learned_mapping', {
        p_source_column: sourceColumn.normalizedName,
        p_source_patterns: sourceColumn.detectedPatterns,
        p_source_system: sourceDNA.sourceSystem,
        p_target_table: finalTable,
        p_target_column: finalColumn,
        p_success_count: result.recordsSucceeded,
        p_failure_count: result.recordsFailed,
        p_user_accepted: result.userAccepted,
        p_organization_id: this.organizationId
      });

      // If user corrected, also learn the correction
      if (result.userCorrectedTo && !result.userAccepted) {
        // Decrease confidence in original mapping
        await this.supabase.rpc('decrease_mapping_confidence', {
          p_source_column: sourceColumn.normalizedName,
          p_target_table: result.targetTable,
          p_target_column: result.targetColumn
        });
      }
    }

    // Store this DNA pattern for future similarity matching
    await this.storeDNAPattern(sourceDNA);
  }

  /** Store DNA pattern for future matching */
  private async storeDNAPattern(dna: SourceDNA): Promise<void> {
    await this.supabase
      .from('migration_source_dna')
      .upsert({
        dna_id: dna.dnaId,
        source_type: dna.sourceType,
        source_system: dna.sourceSystem,
        structure_hash: dna.structureHash,
        signature_vector: dna.signatureVector,
        column_count: dna.columnCount,
        columns: dna.columns,
        organization_id: this.organizationId,
        last_seen: new Date().toISOString()
      });
  }

  /** Find similar past migrations */
  async findSimilarMigrations(dna: SourceDNA): Promise<Array<{
    dnaId: string;
    similarity: number;
    sourceSystem?: string;
    successRate: number;
  }>> {
    const { data: pastDNAs } = await this.supabase
      .from('migration_source_dna')
      .select('*')
      .neq('dna_id', dna.dnaId)
      .limit(100);

    if (!pastDNAs) return [];

    return pastDNAs
      .map((past: Record<string, unknown>) => ({
        dnaId: past.dna_id as string,
        similarity: DataDNAGenerator.calculateSimilarity(dna, {
          dnaId: past.dna_id as string,
          sourceType: past.source_type as SourceDNA['sourceType'],
          sourceSystem: past.source_system as string | undefined,
          columnCount: past.column_count as number,
          rowCount: past.row_count as number,
          columns: past.columns as ColumnDNA[],
          structureHash: past.structure_hash as string,
          signatureVector: past.signature_vector as number[],
          detectedAt: new Date(past.detected_at as string)
        }),
        sourceSystem: past.source_system as string | undefined,
        successRate: (past.success_rate as number | undefined) || 0
      }))
      .filter(m => m.similarity > 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }
}

// =============================================================================
// MIGRATION SERVICE - The Main Interface
// =============================================================================

export class IntelligentMigrationService {
  private supabase: SupabaseClient;
  private organizationId: string;
  private intelligence: MappingIntelligence;

  constructor(
    supabase: SupabaseClient,
    organizationId: string,
    aiConfig?: Partial<AIAssistConfig>
  ) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.intelligence = new MappingIntelligence(supabase, organizationId, aiConfig);
  }

  /** Update AI configuration for hybrid mapping */
  setAIConfig(config: Partial<AIAssistConfig>): void {
    this.intelligence.setAIConfig(config);
  }

  /** Clear AI suggestion cache */
  clearAICache(): void {
    this.intelligence.clearAICache();
  }

  /**
   * Analyze source data and generate intelligent mapping suggestions
   */
  async analyzeSource(
    sourceType: SourceDNA['sourceType'],
    data: Record<string, unknown>[],
    sourceSystem?: string
  ): Promise<{
    dna: SourceDNA;
    suggestions: MappingSuggestion[];
    similarPastMigrations: Array<{ dnaId: string; similarity: number; sourceSystem?: string }>;
    estimatedAccuracy: number;
  }> {
    if (!data || data.length === 0) {
      throw new Error('No data provided for analysis');
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);

    // Generate DNA fingerprint
    const dna = DataDNAGenerator.generateDNA(sourceType, columns, data, sourceSystem);

    // Find similar past migrations
    const similarPastMigrations = await this.intelligence.findSimilarMigrations(dna);

    // Generate mapping suggestions
    const suggestions = await this.intelligence.suggestMappings(dna);

    // Estimate accuracy based on confidence scores and past similar migrations
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    const pastSuccessBonus = similarPastMigrations.length > 0
      ? similarPastMigrations[0].similarity * 0.1
      : 0;
    const estimatedAccuracy = Math.min(avgConfidence + pastSuccessBonus, 0.99);

    return {
      dna,
      suggestions,
      similarPastMigrations,
      estimatedAccuracy
    };
  }

  /**
   * Execute migration with the provided mappings
   */
  async executeMigration(
    dna: SourceDNA,
    data: Record<string, unknown>[],
    mappings: MappingSuggestion[],
    options: {
      dryRun?: boolean;
      validateOnly?: boolean;
      stopOnError?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<{
    batchId: string;
    totalRecords: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; field: string; error: string }>;
    results: MigrationResult[];
  }> {
    const batchSize = options.batchSize || 100;
    const errors: Array<{ row: number; field: string; error: string }> = [];
    const results: MigrationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Create migration batch record
    const { data: batch } = await this.supabase
      .from('migration_batch')
      .insert({
        organization_id: this.organizationId,
        source_system: dna.sourceSystem || dna.sourceType,
        record_count: data.length,
        status: options.dryRun ? 'DRY_RUN' : 'PROCESSING',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    const batchRecord = batch as Record<string, unknown> | null;
    const batchId = (batchRecord?.batch_id as string) || crypto.randomUUID();

    // Group mappings by target table
    const tableGroups = this.groupMappingsByTable(mappings);

    // Process each table
    for (const [table, tableMappings] of Object.entries(tableGroups)) {
      const tableResults = await this.processTableMigration(
        table,
        tableMappings,
        data,
        dna,
        batchId,
        { ...options, batchSize }
      );

      successCount += tableResults.successCount;
      errorCount += tableResults.errorCount;
      errors.push(...tableResults.errors);
      results.push(...tableResults.results);

      if (options.stopOnError && tableResults.errorCount > 0) {
        break;
      }
    }

    // Update batch status
    await this.supabase
      .from('migration_batch')
      .update({
        status: errorCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS',
        success_count: successCount,
        error_count: errorCount,
        completed_at: new Date().toISOString()
      })
      .eq('batch_id', batchId);

    // Learn from results
    if (!options.dryRun && !options.validateOnly) {
      await this.intelligence.learnFromResults(dna, results);
    }

    return {
      batchId,
      totalRecords: data.length,
      successCount,
      errorCount,
      errors,
      results
    };
  }

  /** Group mappings by target table */
  private groupMappingsByTable(
    mappings: MappingSuggestion[]
  ): Record<string, MappingSuggestion[]> {
    const groups: Record<string, MappingSuggestion[]> = {};

    for (const mapping of mappings) {
      if (mapping.targetTable !== 'UNMAPPED') {
        if (!groups[mapping.targetTable]) {
          groups[mapping.targetTable] = [];
        }
        groups[mapping.targetTable].push(mapping);
      }
    }

    return groups;
  }

  /** Process migration for a single table */
  private async processTableMigration(
    table: string,
    mappings: MappingSuggestion[],
    data: Record<string, unknown>[],
    dna: SourceDNA,
    batchId: string,
    options: { dryRun?: boolean; validateOnly?: boolean; batchSize: number }
  ): Promise<{
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; field: string; error: string }>;
    results: MigrationResult[];
  }> {
    const errors: Array<{ row: number; field: string; error: string }> = [];
    const results: MigrationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Transform data according to mappings
    const transformedRows: Record<string, unknown>[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const idValue = row['id'] || row['employee_id'];
      const sourceId = typeof idValue === 'string' || typeof idValue === 'number'
        ? String(idValue)
        : String(i);

      const transformed: Record<string, unknown> = {
        organization_id: this.organizationId,
        source_system: dna.sourceSystem || dna.sourceType,
        source_id: sourceId,
        migration_batch_id: batchId,
        migration_status: 'IMPORTED'
      };

      let rowHasError = false;

      for (const mapping of mappings) {
        try {
          const sourceValue = row[mapping.sourceColumn];
          if (sourceValue === undefined) {
            // Column doesn't exist in source data
            continue;
          }

          const transformedValue = this.transformValue(
            sourceValue,
            mapping.transformRequired
          );

          // Validate
          const validation = this.validateValue(
            transformedValue,
            mapping.targetColumn,
            table
          );

          if (!validation.valid) {
            errors.push({
              row: i + 1,
              field: mapping.sourceColumn,
              error: validation.error || 'Validation failed'
            });
            rowHasError = true;
          } else {
            transformed[mapping.targetColumn] = transformedValue;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push({
            row: i + 1,
            field: mapping.sourceColumn,
            error: errorMessage
          });
          rowHasError = true;
        }
      }

      if (!rowHasError) {
        transformedRows.push(transformed);
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Insert if not dry run
    if (!options.dryRun && !options.validateOnly && transformedRows.length > 0) {
      // Batch insert
      for (let i = 0; i < transformedRows.length; i += options.batchSize) {
        const batch = transformedRows.slice(i, i + options.batchSize);
        const { error: insertError } = await this.supabase
          .from(table)
          .insert(batch);

        if (insertError) {
          // Handle insert errors
          errors.push({
            row: i + 1,
            field: 'INSERT',
            error: insertError.message
          });
        }
      }
    }

    // Create result records for learning
    for (const mapping of mappings) {
      const errorSet = new Set(errors.map(e => e.error));
      results.push({
        mappingId: `${batchId}-${mapping.sourceColumn}`,
        sourceColumn: mapping.sourceColumn,
        targetTable: table,
        targetColumn: mapping.targetColumn,
        recordsAttempted: data.length,
        recordsSucceeded: successCount,
        recordsFailed: errorCount,
        errorTypes: Array.from(errorSet),
        userAccepted: true // Will be updated if user makes corrections
      });
    }

    return { successCount, errorCount, errors, results };
  }

  /** Transform value based on required transformation */
  private transformValue(value: unknown, transform?: string): unknown {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const strValue = String(value).trim();

    switch (transform) {
      case 'NORMALIZE_PHONE':
        return strValue.replace(/\D/g, '').slice(-10);

      case 'CONVERT_DATE_TO_ISO':
        return this.parseDate(strValue);

      case 'PARSE_NAME_FIRST':
        if (strValue.includes(',')) {
          return strValue.split(',')[1]?.trim();
        }
        return strValue.split(' ')[0];

      case 'PARSE_NAME_LAST':
        if (strValue.includes(',')) {
          return strValue.split(',')[0]?.trim();
        }
        const parts = strValue.split(' ');
        return parts[parts.length - 1];

      case 'CONVERT_STATE_TO_CODE':
        return this.stateToCode(strValue);

      default:
        return strValue;
    }
  }

  /** Parse date to ISO format */
  private parseDate(value: string): string | null {
    try {
      // Try various formats
      const formats = [
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // MM/DD/YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,    // MM-DD-YYYY
        /^(\d{4})-(\d{2})-(\d{2})$/          // YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = value.match(format);
        if (match) {
          if (format === formats[2]) {
            return `${match[1]}-${match[2]}-${match[3]}`;
          } else {
            const month = match[1].padStart(2, '0');
            const day = match[2].padStart(2, '0');
            const year = match[3];
            return `${year}-${month}-${day}`;
          }
        }
      }

      // Try native parse
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  /** Convert state name to code */
  private stateToCode(state: string): string {
    const states: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const lower = state.toLowerCase();
    if (states[lower]) return states[lower];
    if (state.length === 2) return state.toUpperCase();
    return state;
  }

  /** Validate a value for a target column */
  private validateValue(
    value: unknown,
    column: string,
    _table: string
  ): { valid: boolean; error?: string } {
    if (value === null) {
      // Check if column is required
      const required = ['first_name', 'last_name', 'organization_id'];
      if (required.includes(column)) {
        return { valid: false, error: `${column} is required` };
      }
      return { valid: true };
    }

    const strValue = String(value);

    // NPI validation
    if (column === 'npi' && strValue) {
      if (!PatternDetector.validateNPI(strValue)) {
        return { valid: false, error: 'Invalid NPI (failed Luhn check)' };
      }
    }

    // Email validation
    if (column === 'email' && strValue) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
        return { valid: false, error: 'Invalid email format' };
      }
    }

    // State code validation
    if (column === 'state' && strValue) {
      if (!/^[A-Z]{2}$/.test(strValue)) {
        return { valid: false, error: 'State must be 2-letter code' };
      }
    }

    // Date validation
    if (['hire_date', 'termination_date', 'expiration_date', 'date_of_birth', 'issued_date'].includes(column)) {
      if (strValue && !/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        return { valid: false, error: 'Date must be YYYY-MM-DD format' };
      }
    }

    return { valid: true };
  }

  /**
   * Record user corrections for learning
   */
  async recordCorrection(
    batchId: string,
    sourceColumn: string,
    originalMapping: { table: string; column: string },
    correctedMapping: { table: string; column: string }
  ): Promise<void> {
    // Find the result and update it
    const { data: existing } = await this.supabase
      .from('migration_results')
      .select('*')
      .eq('batch_id', batchId)
      .eq('source_column', sourceColumn)
      .single();

    if (existing) {
      const existingRecord = existing as Record<string, unknown>;
      await this.supabase
        .from('migration_results')
        .update({
          user_accepted: false,
          user_corrected_table: correctedMapping.table,
          user_corrected_column: correctedMapping.column
        })
        .eq('result_id', existingRecord.result_id);
    }

    // Immediately learn from correction
    await this.supabase.rpc('learn_from_correction', {
      p_source_column: sourceColumn,
      p_wrong_table: originalMapping.table,
      p_wrong_column: originalMapping.column,
      p_correct_table: correctedMapping.table,
      p_correct_column: correctedMapping.column,
      p_organization_id: this.organizationId
    });
  }
}

// Classes are already exported inline with 'export class'
