/**
 * AI-assist support for column mapping: system prompt, per-column prompt, and
 * validation/normalization of the model's structured suggestion against the
 * target schema. Extracted from MappingIntelligence to keep that class focused
 * (600-line rule) and to make the prompt/normalization logic independently
 * testable.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type { ColumnDNA, SourceDNA, AIMappingSuggestion } from './types';
import { TARGET_SCHEMA } from './targetSchema';
import { redactSampleValues } from './phiRedaction';
import type { RawAISuggestion } from './aiMappingTool';
import { auditLogger } from '../auditLogger';

/** System prompt for the AI mapping assistant (lists the target schema). */
export function buildAISystemPrompt(): string {
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

Return your answer by calling the "suggest_mapping" tool. Sample values are shown
as PHI-masked format templates (X=letter, 9=digit); infer from the format, not
from literal content.`;
}

/** Per-column prompt. Sample values are PHI-masked before inclusion. */
export function buildAIMappingPrompt(column: ColumnDNA, sourceDNA: SourceDNA): string {
  return `Analyze this source column and suggest the best mapping:

SOURCE COLUMN:
- Name: ${column.originalName}
- Normalized Name: ${column.normalizedName}
- Detected Pattern: ${column.primaryPattern}
- All Detected Patterns: ${column.detectedPatterns.join(', ')}
- Inferred Data Type: ${column.dataTypeInferred}
- Average Length: ${Math.round(column.avgLength)}
- Sample Value Formats (PHI-masked; X=letter, 9=digit, punctuation preserved): ${redactSampleValues(column.sampleValues, 3).map((v) => `"${v}"`).join(', ')}
- Unique %: ${Math.round(column.uniquePercentage * 100)}%
- Null %: ${Math.round(column.nullPercentage * 100)}%

SOURCE CONTEXT:
- Source System: ${sourceDNA.sourceSystem || 'Unknown'}
- Source Type: ${sourceDNA.sourceType}
- Total Columns: ${sourceDNA.columnCount}

Provide your mapping suggestion via the suggest_mapping tool.`;
}

/**
 * Validate + normalize a structured AI suggestion (from the forced tool call)
 * against the target schema. Input is already parsed JSON — no string parsing.
 * `maxConfidence` clamps the model's self-reported confidence.
 */
export function normalizeAISuggestion(
  parsed: RawAISuggestion,
  sourceColumn: string,
  maxConfidence: number
): AIMappingSuggestion | null {
  try {
    // Validate required fields
    if (!parsed.suggestedTable || !parsed.suggestedColumn) {
      return null;
    }

    // Validate suggested table exists
    if (!TARGET_SCHEMA[parsed.suggestedTable]) {
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
      confidence: Math.min(parsed.confidence || 0.7, maxConfidence),
      reasoning: parsed.reasoning || 'AI-suggested mapping',
      transformation: parsed.transformation,
      alternativeMappings: parsed.alternativeMappings?.filter((alt) => TARGET_SCHEMA[alt.table]),
    };
  } catch (err: unknown) {
    auditLogger.warn('DNA_MAPPER_AI_PARSE_FAILED', {
      error: err instanceof Error ? err.message : String(err),
      sourceColumn,
    });
    return null;
  }
}
