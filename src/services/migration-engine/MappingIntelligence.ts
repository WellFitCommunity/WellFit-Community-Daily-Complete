/**
 * Mapping Intelligence - The "Learning Brain"
 *
 * Provides intelligent field mapping suggestions using pattern matching,
 * learned mappings from past migrations, and AI assistance for complex cases.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ColumnDNA,
  SourceDNA,
  LearnedMapping,
  MappingSuggestion,
  MigrationResult,
  AIAssistConfig,
  AIMappingSuggestion,
  DataPattern,
} from './types';
import { TARGET_SCHEMA, COLUMN_SYNONYMS } from './targetSchema';
import { DataDNAGenerator } from './DataDNAGenerator';
import { auditLogger } from '../auditLogger';
import {
  DEFAULT_MAPPING_INTELLIGENCE_CONFIG,
  DEFAULT_AI_CONFIG,
  type MappingIntelligenceConfig,
} from './config';

/**
 * MappingIntelligence class for intelligent field mapping
 */
export class MappingIntelligence {
  private supabase: SupabaseClient;
  private organizationId?: string;
  private config: MappingIntelligenceConfig;
  private aiConfig: AIAssistConfig;
  private aiCache: Map<string, AIMappingSuggestion> = new Map();
  private dnaGenerator: DataDNAGenerator;

  constructor(
    supabase: SupabaseClient,
    organizationId?: string,
    config?: Partial<MappingIntelligenceConfig>,
    aiConfig?: Partial<AIAssistConfig>
  ) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.config = {
      ...DEFAULT_MAPPING_INTELLIGENCE_CONFIG,
      ...config,
    };
    this.aiConfig = {
      ...DEFAULT_AI_CONFIG,
      ...aiConfig,
    };
    this.dnaGenerator = new DataDNAGenerator();
  }

  /**
   * Update AI configuration
   */
  setAIConfig(config: Partial<AIAssistConfig>): void {
    this.aiConfig = { ...this.aiConfig, ...config };
  }

  /**
   * Update mapping intelligence configuration
   */
  setConfig(config: Partial<MappingIntelligenceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MappingIntelligenceConfig {
    return { ...this.config };
  }

  /**
   * Get AI configuration
   */
  getAIConfig(): AIAssistConfig {
    return { ...this.aiConfig };
  }

  /**
   * Clear AI suggestion cache
   */
  clearAICache(): void {
    this.aiCache.clear();
  }

  /**
   * Generate mapping suggestions for a source DNA (hybrid: pattern + AI)
   */
  async suggestMappings(sourceDNA: SourceDNA): Promise<MappingSuggestion[]> {
    const suggestions: MappingSuggestion[] = [];

    for (const column of sourceDNA.columns) {
      const suggestion = await this.suggestMappingForColumn(column, sourceDNA);
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Suggest mapping for a single column
   */
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
        score:
          this.config.learnedMappingBaseConfidence +
          learnedMatch.confidence * this.config.learnedMappingMaxBonus,
        reasons: [
          `Previously learned mapping (${Math.round(learnedMatch.confidence * 100)}% confidence)`,
        ],
      });
    }

    // 2. Pattern matching against target schema
    for (const [table, columns] of Object.entries(TARGET_SCHEMA)) {
      for (const [targetCol, acceptablePatterns] of Object.entries(columns)) {
        let score = 0;
        const reasons: string[] = [];

        // Pattern match
        if (acceptablePatterns.includes(column.primaryPattern)) {
          score += this.config.patternMatchWeight;
          reasons.push(`Pattern match: ${column.primaryPattern}`);
        }

        // Name similarity
        const nameSimilarity = this.calculateNameSimilarity(
          column.normalizedName,
          targetCol
        );
        if (nameSimilarity > this.config.nameSimilarityThreshold) {
          score += nameSimilarity * this.config.nameSimilarityWeight;
          reasons.push(`Name similarity: ${Math.round(nameSimilarity * 100)}%`);
        }

        // Synonym match
        const synonyms = COLUMN_SYNONYMS[targetCol] || [];
        if (synonyms.includes(column.normalizedName)) {
          score += this.config.synonymMatchWeight;
          reasons.push('Synonym match');
        }

        // Original name contains target
        if (
          column.originalName
            .toLowerCase()
            .includes(targetCol.replace(/_/g, ''))
        ) {
          score += this.config.nameContainsWeight;
          reasons.push('Name contains target');
        }

        if (score > this.config.minimumCandidateScore) {
          candidates.push({ table, column: targetCol, score, reasons });
        }
      }
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    // Build suggestion from pattern matching
    const best = candidates[0];
    const alternatives = candidates.slice(
      1,
      this.config.maxAlternativeMappings + 1
    );
    const patternConfidence = best?.score || 0;

    // HYBRID: If pattern confidence is below threshold, use AI assistance
    if (
      this.aiConfig.enabled &&
      patternConfidence < this.aiConfig.confidenceThreshold
    ) {
      const aiSuggestion = await this.getAIMappingSuggestion(column, sourceDNA);

      if (aiSuggestion && aiSuggestion.confidence > patternConfidence) {
        // AI suggestion is better - use it
        return {
          sourceColumn: column.originalName,
          targetTable: aiSuggestion.suggestedTable,
          targetColumn: aiSuggestion.suggestedColumn,
          confidence: aiSuggestion.confidence,
          reasons: [`AI-assisted mapping: ${aiSuggestion.reasoning}`],
          transformRequired:
            aiSuggestion.transformation ||
            this.determineTransform(column, aiSuggestion.suggestedColumn),
          alternativeMappings:
            aiSuggestion.alternativeMappings?.map((a) => ({
              targetTable: a.table,
              targetColumn: a.column,
              confidence: a.confidence,
            })) ||
            alternatives.map((a) => ({
              targetTable: a.table,
              targetColumn: a.column,
              confidence: a.score,
            })),
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
      alternativeMappings: alternatives.map((a) => ({
        targetTable: a.table,
        targetColumn: a.column,
        confidence: a.score,
      })),
    };
  }

  /**
   * Get AI-assisted mapping suggestion for a column
   */
  private async getAIMappingSuggestion(
    column: ColumnDNA,
    sourceDNA: SourceDNA
  ): Promise<AIMappingSuggestion | null> {
    // Check cache first
    const cacheKey = `${sourceDNA.sourceSystem || 'unknown'}_${column.normalizedName}_${column.primaryPattern}`;
    if (this.aiConfig.cacheResponses && this.aiCache.has(cacheKey)) {
      const cached = this.aiCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    try {
      await auditLogger.info('DNA_MAPPER_AI_ASSIST_START', {
        column: column.originalName,
        pattern: column.primaryPattern,
        sourceSystem: sourceDNA.sourceSystem,
      });

      const response = await fetch(this.aiConfig.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: this.getAISystemPrompt(),
            },
            {
              role: 'user',
              content: this.buildAIPrompt(column, sourceDNA),
            },
          ],
          max_tokens: this.aiConfig.maxTokens,
        }),
      });

      if (!response.ok) {
        await auditLogger.warn('DNA_MAPPER_AI_ASSIST_FAILED', {
          column: column.originalName,
          status: response.status,
          error: response.statusText,
        });
        return null;
      }

      const data = (await response.json()) as {
        content?: Array<{ text?: string }>;
      };

      if (!data.content || !data.content[0]?.text) {
        return null;
      }

      // Parse AI response
      const suggestion = this.parseAIResponse(
        data.content[0].text,
        column.originalName
      );

      if (suggestion) {
        // Cache successful response
        if (this.aiConfig.cacheResponses) {
          this.aiCache.set(cacheKey, suggestion);
        }

        await auditLogger.info('DNA_MAPPER_AI_ASSIST_SUCCESS', {
          column: column.originalName,
          suggestedTable: suggestion.suggestedTable,
          suggestedColumn: suggestion.suggestedColumn,
          confidence: suggestion.confidence,
        });
      }

      return suggestion;
    } catch (err: unknown) {
      await auditLogger.error(
        'DNA_MAPPER_AI_ASSIST_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { column: column.originalName }
      );
      return null;
    }
  }

  /**
   * System prompt for AI mapping assistant
   */
  private getAISystemPrompt(): string {
    const availableTables = Object.entries(TARGET_SCHEMA)
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

  /**
   * Build the AI prompt for a specific column
   */
  private buildAIPrompt(column: ColumnDNA, sourceDNA: SourceDNA): string {
    return `Analyze this source column and suggest the best mapping:

SOURCE COLUMN:
- Name: ${column.originalName}
- Normalized Name: ${column.normalizedName}
- Detected Pattern: ${column.primaryPattern}
- All Detected Patterns: ${column.detectedPatterns.join(', ')}
- Inferred Data Type: ${column.dataTypeInferred}
- Average Length: ${Math.round(column.avgLength)}
- Sample Values: ${column.sampleValues.slice(0, 3).map((v) => `"${v}"`).join(', ')}
- Unique %: ${Math.round(column.uniquePercentage * 100)}%
- Null %: ${Math.round(column.nullPercentage * 100)}%

SOURCE CONTEXT:
- Source System: ${sourceDNA.sourceSystem || 'Unknown'}
- Source Type: ${sourceDNA.sourceType}
- Total Columns: ${sourceDNA.columnCount}

Provide your mapping suggestion as JSON.`;
  }

  /**
   * Parse AI response into structured suggestion
   */
  private parseAIResponse(
    responseText: string,
    sourceColumn: string
  ): AIMappingSuggestion | null {
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
        alternativeMappings?: Array<{
          table: string;
          column: string;
          confidence: number;
        }>;
      };

      // Validate required fields
      if (!parsed.suggestedTable || !parsed.suggestedColumn) {
        return null;
      }

      // Validate suggested table exists
      if (!TARGET_SCHEMA[parsed.suggestedTable]) {
        // Try to find a close match
        const availableTables = Object.keys(TARGET_SCHEMA);
        const matchingTable = availableTables.find(
          (t) =>
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
      const tableSchema = TARGET_SCHEMA[parsed.suggestedTable];
      if (!tableSchema[parsed.suggestedColumn]) {
        // Try to find a close match
        const availableColumns = Object.keys(tableSchema);
        const matchingColumn = availableColumns.find(
          (c) =>
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
        confidence: Math.min(
          parsed.confidence || 0.7,
          this.config.maxAIConfidence
        ),
        reasoning: parsed.reasoning || 'AI-suggested mapping',
        transformation: parsed.transformation,
        alternativeMappings: parsed.alternativeMappings?.filter(
          (alt) => TARGET_SCHEMA[alt.table]
        ),
      };
    } catch (err: unknown) {
      auditLogger.warn('DNA_MAPPER_AI_PARSE_FAILED', {
        error: err instanceof Error ? err.message : String(err),
        sourceColumn,
      });
      return null;
    }
  }

  /**
   * Find previously learned mapping
   */
  private async findLearnedMapping(
    column: ColumnDNA,
    sourceDNA: SourceDNA
  ): Promise<LearnedMapping | null> {
    try {
      let query = this.supabase
        .from('migration_learned_mappings')
        .select('*')
        .eq('source_column_normalized', column.normalizedName)
        .order('confidence', { ascending: false })
        .limit(1);

      // Prefer org-specific learnings
      if (this.organizationId) {
        query = query.or(
          `organization_id.eq.${this.organizationId},organization_id.is.null`
        );
      }

      // Also match on source system if known
      if (sourceDNA.sourceSystem) {
        query = query.or(
          `source_system.eq.${sourceDNA.sourceSystem},source_system.is.null`
        );
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
        organizationId: row.organization_id as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
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
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength > 0 ? 1 - distance / maxLength : 0;
  }

  /**
   * Determine if transformation is needed
   */
  private determineTransform(
    source: ColumnDNA,
    targetColumn?: string
  ): string | undefined {
    if (!targetColumn) return undefined;

    // Phone normalization
    if (targetColumn.includes('phone') && source.primaryPattern === 'PHONE') {
      return 'NORMALIZE_PHONE';
    }

    // Date format conversion
    if (
      [
        'hire_date',
        'termination_date',
        'expiration_date',
        'date_of_birth',
        'issued_date',
      ].includes(targetColumn)
    ) {
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

  /**
   * Learn from migration results (call after migration completes)
   */
  async learnFromResults(
    sourceDNA: SourceDNA,
    results: MigrationResult[]
  ): Promise<void> {
    for (const result of results) {
      const sourceColumn = sourceDNA.columns.find(
        (c) => c.originalName === result.sourceColumn
      );
      if (!sourceColumn) continue;

      // Determine final mapping (user correction or original)
      const finalTable =
        result.userCorrectedTo?.targetTable || result.targetTable;
      const finalColumn =
        result.userCorrectedTo?.targetColumn || result.targetColumn;

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
        p_organization_id: this.organizationId,
      });

      // If user corrected, also learn the correction
      if (result.userCorrectedTo && !result.userAccepted) {
        // Decrease confidence in original mapping
        await this.supabase.rpc('decrease_mapping_confidence', {
          p_source_column: sourceColumn.normalizedName,
          p_target_table: result.targetTable,
          p_target_column: result.targetColumn,
        });
      }
    }

    // Store this DNA pattern for future similarity matching
    await this.storeDNAPattern(sourceDNA);
  }

  /**
   * Store DNA pattern for future matching
   */
  private async storeDNAPattern(dna: SourceDNA): Promise<void> {
    await this.supabase.from('migration_source_dna').upsert({
      dna_id: dna.dnaId,
      source_type: dna.sourceType,
      source_system: dna.sourceSystem,
      structure_hash: dna.structureHash,
      signature_vector: dna.signatureVector,
      column_count: dna.columnCount,
      columns: dna.columns,
      organization_id: this.organizationId,
      last_seen: new Date().toISOString(),
    });
  }

  /**
   * Find similar past migrations
   */
  async findSimilarMigrations(
    dna: SourceDNA
  ): Promise<
    Array<{
      dnaId: string;
      similarity: number;
      sourceSystem?: string;
      successRate: number;
    }>
  > {
    const { data: pastDNAs } = await this.supabase
      .from('migration_source_dna')
      .select('*')
      .neq('dna_id', dna.dnaId)
      .limit(100);

    if (!pastDNAs) return [];

    const config = this.dnaGenerator.getConfig();

    return pastDNAs
      .map((past: Record<string, unknown>) => ({
        dnaId: past.dna_id as string,
        similarity: this.dnaGenerator.calculateSimilarity(dna, {
          dnaId: past.dna_id as string,
          sourceType: past.source_type as SourceDNA['sourceType'],
          sourceSystem: past.source_system as string | undefined,
          columnCount: past.column_count as number,
          rowCount: past.row_count as number,
          columns: past.columns as ColumnDNA[],
          structureHash: past.structure_hash as string,
          signatureVector: past.signature_vector as number[],
          detectedAt: new Date(past.detected_at as string),
        }),
        sourceSystem: past.source_system as string | undefined,
        successRate: (past.success_rate as number | undefined) || 0,
      }))
      .filter((m) => m.similarity > config.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.dnaGenerator.getMaxSimilarMigrations());
  }
}
