/**
 * Intelligent Migration Service - The Main Interface
 *
 * Orchestrates the migration process using DNA fingerprinting,
 * intelligent field mapping, and learning from results.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SourceDNA,
  MappingSuggestion,
  MigrationResult,
  AIAssistConfig,
  MigrationOptions,
  MigrationExecutionResult,
  SourceAnalysisResult,
  ValidationResult,
  TableMigrationResult,
  ColumnDNA,
} from './types';
import { DataDNAGenerator } from './DataDNAGenerator';
import { MappingIntelligence } from './MappingIntelligence';
import { PatternDetector } from './PatternDetector';
import {
  DEFAULT_MIGRATION_SERVICE_CONFIG,
  REQUIRED_COLUMNS,
  DATE_COLUMNS,
  type MigrationServiceConfig,
  type MigrationEngineConfig,
  type DeepPartial,
} from './config';

/** US State name to code mapping */
const STATE_CODES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

/**
 * IntelligentMigrationService class for orchestrating migrations
 */
export class IntelligentMigrationService {
  private supabase: SupabaseClient;
  private organizationId: string;
  private config: MigrationServiceConfig;
  private intelligence: MappingIntelligence;
  private dnaGenerator: DataDNAGenerator;
  private patternDetector: PatternDetector;

  constructor(
    supabase: SupabaseClient,
    organizationId: string,
    config?: DeepPartial<MigrationEngineConfig>
  ) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.config = {
      ...DEFAULT_MIGRATION_SERVICE_CONFIG,
      ...config?.migrationService,
    };
    this.intelligence = new MappingIntelligence(
      supabase,
      organizationId,
      config?.mappingIntelligence,
      config?.ai
    );
    this.dnaGenerator = new DataDNAGenerator(config?.dnaGenerator);
    this.patternDetector = new PatternDetector(config?.patternDetector);
  }

  /**
   * Update AI configuration for hybrid mapping
   */
  setAIConfig(config: Partial<AIAssistConfig>): void {
    this.intelligence.setAIConfig(config);
  }

  /**
   * Clear AI suggestion cache
   */
  clearAICache(): void {
    this.intelligence.clearAICache();
  }

  /**
   * Get current configuration
   */
  getConfig(): MigrationServiceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MigrationServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Analyze source data and generate intelligent mapping suggestions
   */
  async analyzeSource(
    sourceType: SourceDNA['sourceType'],
    data: Record<string, unknown>[],
    sourceSystem?: string
  ): Promise<SourceAnalysisResult> {
    if (!data || data.length === 0) {
      throw new Error('No data provided for analysis');
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);

    // Generate DNA fingerprint
    const dna = this.dnaGenerator.generateDNA(
      sourceType,
      columns,
      data,
      sourceSystem
    );

    // Find similar past migrations
    const similarPastMigrations =
      await this.intelligence.findSimilarMigrations(dna);

    // Generate mapping suggestions
    const suggestions = await this.intelligence.suggestMappings(dna);

    // Estimate accuracy based on confidence scores and past similar migrations
    const avgConfidence =
      suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    const pastSuccessBonus =
      similarPastMigrations.length > 0
        ? similarPastMigrations[0].similarity * this.config.pastSuccessBonus
        : 0;
    const estimatedAccuracy = Math.min(
      avgConfidence + pastSuccessBonus,
      this.config.maxEstimatedAccuracy
    );

    return {
      dna,
      suggestions,
      similarPastMigrations,
      estimatedAccuracy,
    };
  }

  /**
   * Execute migration with the provided mappings
   */
  async executeMigration(
    dna: SourceDNA,
    data: Record<string, unknown>[],
    mappings: MappingSuggestion[],
    options: MigrationOptions = {}
  ): Promise<MigrationExecutionResult> {
    const batchSize = options.batchSize || this.config.defaultBatchSize;
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
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const batchRecord = batch as Record<string, unknown> | null;
    const batchId =
      (batchRecord?.batch_id as string) || crypto.randomUUID();

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
        completed_at: new Date().toISOString(),
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
      results,
    };
  }

  /**
   * Group mappings by target table
   */
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

  /**
   * Process migration for a single table
   */
  private async processTableMigration(
    table: string,
    mappings: MappingSuggestion[],
    data: Record<string, unknown>[],
    dna: SourceDNA,
    batchId: string,
    options: {
      dryRun?: boolean;
      validateOnly?: boolean;
      batchSize: number;
    }
  ): Promise<TableMigrationResult> {
    const errors: Array<{ row: number; field: string; error: string }> = [];
    const results: MigrationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Transform data according to mappings
    const transformedRows: Record<string, unknown>[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const idValue = row['id'] || row['employee_id'];
      const sourceId =
        typeof idValue === 'string' || typeof idValue === 'number'
          ? String(idValue)
          : String(i);

      const transformed: Record<string, unknown> = {
        organization_id: this.organizationId,
        source_system: dna.sourceSystem || dna.sourceType,
        source_id: sourceId,
        migration_batch_id: batchId,
        migration_status: 'IMPORTED',
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
              error: validation.error || 'Validation failed',
            });
            rowHasError = true;
          } else {
            transformed[mapping.targetColumn] = transformedValue;
          }
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';
          errors.push({
            row: i + 1,
            field: mapping.sourceColumn,
            error: errorMessage,
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
    if (
      !options.dryRun &&
      !options.validateOnly &&
      transformedRows.length > 0
    ) {
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
            error: insertError.message,
          });
        }
      }
    }

    // Create result records for learning
    for (const mapping of mappings) {
      const errorSet = new Set(errors.map((e) => e.error));
      results.push({
        mappingId: `${batchId}-${mapping.sourceColumn}`,
        sourceColumn: mapping.sourceColumn,
        targetTable: table,
        targetColumn: mapping.targetColumn,
        recordsAttempted: data.length,
        recordsSucceeded: successCount,
        recordsFailed: errorCount,
        errorTypes: Array.from(errorSet),
        userAccepted: true, // Will be updated if user makes corrections
      });
    }

    return { successCount, errorCount, errors, results };
  }

  /**
   * Transform value based on required transformation
   */
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

  /**
   * Parse date to ISO format
   */
  private parseDate(value: string): string | null {
    try {
      // Try various formats
      const formats = [
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
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

  /**
   * Convert state name to code
   */
  private stateToCode(state: string): string {
    const lower = state.toLowerCase();
    if (STATE_CODES[lower]) return STATE_CODES[lower];
    if (state.length === 2) return state.toUpperCase();
    return state;
  }

  /**
   * Validate a value for a target column
   */
  private validateValue(
    value: unknown,
    column: string,
    _table: string
  ): ValidationResult {
    if (value === null) {
      // Check if column is required
      if (REQUIRED_COLUMNS.includes(column as typeof REQUIRED_COLUMNS[number])) {
        return { valid: false, error: `${column} is required` };
      }
      return { valid: true };
    }

    const strValue = String(value);

    // NPI validation
    if (column === 'npi' && strValue) {
      if (!this.patternDetector.validateNPI(strValue)) {
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
    if (DATE_COLUMNS.includes(column as typeof DATE_COLUMNS[number])) {
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
          user_corrected_column: correctedMapping.column,
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
      p_organization_id: this.organizationId,
    });
  }

  /**
   * Get the DNA generator for direct access
   */
  getDNAGenerator(): DataDNAGenerator {
    return this.dnaGenerator;
  }

  /**
   * Get the pattern detector for direct access
   */
  getPatternDetector(): PatternDetector {
    return this.patternDetector;
  }

  /**
   * Get the mapping intelligence for direct access
   */
  getMappingIntelligence(): MappingIntelligence {
    return this.intelligence;
  }
}
