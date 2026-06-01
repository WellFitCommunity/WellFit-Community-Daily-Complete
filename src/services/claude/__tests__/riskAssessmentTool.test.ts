/**
 * RF-8: structured risk-assessment tool — validation/normalization tests.
 *
 * Deletion Test: each case fails if parseStructuredRiskAssessment were reduced
 * to `return input as RiskAssessmentResult` (no validation) or `return null`.
 */

import { describe, it, expect } from 'vitest';
import {
  RISK_ASSESSMENT_TOOL,
  parseStructuredRiskAssessment,
} from '../riskAssessmentTool';

describe('RISK_ASSESSMENT_TOOL schema', () => {
  it('forces the four required clinical fields', () => {
    expect(RISK_ASSESSMENT_TOOL.name).toBe('report_risk_assessment');
    const schema = RISK_ASSESSMENT_TOOL.input_schema as {
      required: string[];
      properties: Record<string, { enum?: string[] }>;
    };
    expect(schema.required).toEqual(
      expect.arrayContaining(['risk_level', 'risk_factors', 'recommendations', 'clinical_notes'])
    );
    expect(schema.properties.risk_level.enum).toEqual(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']);
  });
});

describe('parseStructuredRiskAssessment', () => {
  it('parses a valid structured payload', () => {
    const res = parseStructuredRiskAssessment({
      risk_level: 'HIGH',
      risk_factors: ['fall history', 'polypharmacy'],
      recommendations: ['PT referral'],
      clinical_notes: 'Elevated fall risk.',
    });
    expect(res).toEqual({
      suggestedRiskLevel: 'HIGH',
      riskFactors: ['fall history', 'polypharmacy'],
      recommendations: ['PT referral'],
      clinicalNotes: 'Elevated fall risk.',
    });
  });

  it('normalizes a lowercase risk level', () => {
    expect(parseStructuredRiskAssessment({
      risk_level: 'critical',
      risk_factors: [],
      recommendations: [],
      clinical_notes: '',
    })?.suggestedRiskLevel).toBe('CRITICAL');
  });

  it('caps arrays at 5 and clinical notes at 500 chars', () => {
    const res = parseStructuredRiskAssessment({
      risk_level: 'LOW',
      risk_factors: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      recommendations: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'],
      clinical_notes: 'x'.repeat(900),
    });
    expect(res?.riskFactors).toHaveLength(5);
    expect(res?.recommendations).toHaveLength(5);
    expect(res?.clinicalNotes).toHaveLength(500);
  });

  it('returns null for an out-of-enum risk level (no silent default)', () => {
    expect(parseStructuredRiskAssessment({
      risk_level: 'SEVERE',
      risk_factors: [],
      recommendations: [],
      clinical_notes: '',
    })).toBeNull();
  });

  it('returns null when required fields are missing or wrong-typed', () => {
    expect(parseStructuredRiskAssessment({ risk_level: 'HIGH' })).toBeNull();
    expect(parseStructuredRiskAssessment({
      risk_level: 'HIGH',
      risk_factors: 'not-an-array',
      recommendations: [],
      clinical_notes: '',
    })).toBeNull();
    expect(parseStructuredRiskAssessment(null)).toBeNull();
    expect(parseStructuredRiskAssessment('LOW risk')).toBeNull();
  });
});
