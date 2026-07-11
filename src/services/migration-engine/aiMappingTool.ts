/**
 * Structured-output tool definition for AI-assisted column mapping.
 *
 * The engine forces the model to call this tool (`tool_choice`), so the response
 * comes back as an already-parsed JSON object (`content[].type === 'tool_use'`,
 * `.input`). That removes the need to regex-strip ```json fences from a
 * free-text reply — the fragile, forbidden pattern (CLAUDE.md #16, structured
 * AI output required).
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

/** The raw, model-supplied mapping shape (validated/normalized by the caller). */
export interface RawAISuggestion {
  suggestedTable?: string;
  suggestedColumn?: string;
  fhirResource?: string;
  fhirPath?: string;
  confidence?: number;
  reasoning?: string;
  transformation?: string;
  alternativeMappings?: Array<{ table: string; column: string; confidence: number }>;
}

/** Anthropic tool schema forcing a structured mapping suggestion. */
export const SUGGEST_MAPPING_TOOL = {
  name: 'suggest_mapping',
  description:
    'Return the best target table/column mapping for the analyzed source column, with confidence and any transformation.',
  input_schema: {
    type: 'object',
    properties: {
      suggestedTable: { type: 'string', description: 'Target table name' },
      suggestedColumn: { type: 'string', description: 'Target column name' },
      fhirResource: {
        type: 'string',
        description: 'FHIR resource if applicable (Patient, Observation, etc.)',
      },
      fhirPath: { type: 'string', description: 'FHIR path if applicable' },
      confidence: { type: 'number', description: 'Confidence from 0 to 1' },
      reasoning: { type: 'string', description: 'Brief explanation of the mapping' },
      transformation: {
        type: 'string',
        description: 'Transformation needed, if any (e.g. NORMALIZE_PHONE, CONVERT_DATE_TO_ISO)',
      },
      alternativeMappings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            table: { type: 'string' },
            column: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['table', 'column', 'confidence'],
        },
      },
    },
    required: ['suggestedTable', 'suggestedColumn', 'confidence'],
  },
} as const;

/** tool_choice that forces the model to emit a `suggest_mapping` tool call. */
export const SUGGEST_MAPPING_TOOL_CHOICE = { type: 'tool', name: SUGGEST_MAPPING_TOOL.name } as const;

/**
 * Pull the structured tool input out of an Anthropic Messages response.
 * Returns null if the model did not produce the forced tool call.
 */
export function extractToolUseInput(
  content: Array<{ type?: string; name?: string; input?: unknown }> | undefined,
): RawAISuggestion | null {
  const toolUse = content?.find(
    (block) => block.type === 'tool_use' && block.name === SUGGEST_MAPPING_TOOL.name,
  );
  return toolUse?.input ? (toolUse.input as RawAISuggestion) : null;
}
