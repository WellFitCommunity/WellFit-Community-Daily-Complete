/**
 * Structured-output tool for clinical risk assessment (RF-8).
 *
 * Replaces the previous approach of regex-scraping the risk level / factors /
 * recommendations out of free-text LLM prose (`parseRiskAnalysis`). Claude is
 * forced to call this tool (tool_choice), so it returns a typed JSON object
 * validated against this schema instead of prose we have to scrape.
 */

import type { ClaudeTool } from './transport';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface RiskAssessmentResult {
  suggestedRiskLevel: RiskLevel;
  riskFactors: string[];
  recommendations: string[];
  clinicalNotes: string;
}

const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

/**
 * The forced tool definition handed to Claude. `input_schema` is a JSON Schema
 * (Anthropic tool-use format).
 */
export const RISK_ASSESSMENT_TOOL: ClaudeTool = {
  name: 'report_risk_assessment',
  description:
    'Report the structured clinical risk assessment for a senior patient. Always call this tool with the assessed risk level, the specific risk factors identified, clinical recommendations, and brief clinical notes. Be conservative in risk stratification.',
  input_schema: {
    type: 'object',
    properties: {
      risk_level: {
        type: 'string',
        enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
        description: 'Overall risk stratification.',
      },
      risk_factors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific risk factors identified (up to 5).',
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Clinical recommendations (up to 5).',
      },
      clinical_notes: {
        type: 'string',
        description: 'Brief clinical assessment notes.',
      },
    },
    required: ['risk_level', 'risk_factors', 'recommendations', 'clinical_notes'],
  },
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Validate + normalize the tool_use input Claude returned. Returns null when the
 * payload doesn't satisfy the schema — callers MUST treat null as "could not
 * stratify" (surface low-confidence / manual review), NOT silently assume a
 * default risk level. That silent-default behavior is exactly what RF-8 removes.
 */
export function parseStructuredRiskAssessment(input: unknown): RiskAssessmentResult | null {
  if (typeof input !== 'object' || input === null) return null;
  const obj = input as Record<string, unknown>;

  const level = obj.risk_level;
  if (typeof level !== 'string') return null;
  const upper = level.toUpperCase();
  if (!RISK_LEVELS.includes(upper as RiskLevel)) return null;

  if (!isStringArray(obj.risk_factors) || !isStringArray(obj.recommendations)) return null;
  if (typeof obj.clinical_notes !== 'string') return null;

  return {
    suggestedRiskLevel: upper as RiskLevel,
    riskFactors: obj.risk_factors.slice(0, 5),
    recommendations: obj.recommendations.slice(0, 5),
    clinicalNotes: obj.clinical_notes.slice(0, 500),
  };
}
