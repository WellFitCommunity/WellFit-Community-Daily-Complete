/**
 * Confidence Calibration Service Tests
 *
 * P3-5: Behavioral tests for population-aware confidence calibration.
 *
 * Covers:
 * - SDOH-heavy patient → adjusted score
 * - Well-represented population → minimal adjustment
 * - Missing demographic data → wider confidence interval
 * - Population context fetch failure → calibration still proceeds
 * - MCP tool call verification
 * - MCP failure handling
 * - Convenience wrappers (readmission, fall risk)
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P3-5)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceResult } from '../../_base';
import { ConfidenceCalibrationService } from '../confidenceCalibrationService';
import type { CalibrationResult, RiskFactor } from '../confidenceCalibrationService';

// ============================================================================
// Mocks
// ============================================================================

const { mockInvoke, mockPopulationFetcher } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockPopulationFetcher: {
    getCalibrationContext: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../populationContextFetcher', () => ({
  PopulationContextFetcher: mockPopulationFetcher,
}));

// ============================================================================
// Test Helpers
// ============================================================================

function assertSuccess<T>(result: ServiceResult<T>): asserts result is { success: true; data: T; error: null } {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected success but got failure');
}

function assertFailure(result: ServiceResult<unknown>): asserts result is { success: false; data: null; error: { code: string; message: string } } {
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure but got success');
}

function createMockFactors(): RiskFactor[] {
  return [
    { name: 'hypertension', original_weight: 0.3, category: 'clinical', data_source: 'ehr', data_freshness: '2026-03-15' },
    { name: 'lives_alone', original_weight: 0.2, category: 'sdoh', data_source: 'self_report', data_freshness: '2026-03-10' },
    { name: 'missed_checkins', original_weight: 0.15, category: 'behavioral', data_source: 'check_in_log', data_freshness: '2026-03-14' },
  ];
}

function createMcpCalibrationResponse(result: CalibrationResult) {
  return {
    data: {
      result: {
        content: [{ text: JSON.stringify(result) }],
      },
    },
    error: null,
  };
}

function createCalibrationResult(overrides: Partial<CalibrationResult> = {}): CalibrationResult {
  return {
    calibrated_score: overrides.calibrated_score ?? 85,
    calibrated_confidence: overrides.calibrated_confidence ?? 0.75,
    adjustment_direction: overrides.adjustment_direction ?? 'decreased',
    score_delta: overrides.score_delta ?? -7,
    adjustment_reasoning: overrides.adjustment_reasoning ?? 'SDOH factors underweighted in original model',
    factor_reliability: overrides.factor_reliability ?? [
      { factor_name: 'hypertension', reliability: 'high', adjusted_weight: 0.3, adjustment_reasoning: 'Well-validated clinical factor' },
      { factor_name: 'lives_alone', reliability: 'moderate', adjusted_weight: 0.15, adjustment_reasoning: 'Self-report may not capture partial isolation' },
    ],
    recommended_action: overrides.recommended_action ?? 'Proceed with adjusted score',
    needs_additional_data: overrides.needs_additional_data ?? false,
    additional_data_suggestions: overrides.additional_data_suggestions ?? [],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ConfidenceCalibrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    mockPopulationFetcher.getCalibrationContext.mockReset();
  });

  describe('calibrateScore', () => {
    it('calibrates score with population context from SDOH-heavy patient', async () => {
      // Patient has cultural context + SDOH indicators
      mockPopulationFetcher.getCalibrationContext.mockResolvedValue({
        success: true,
        data: {
          population_context: {
            primary_language: 'Spanish',
            community_group: 'latino',
            setting: undefined,
          },
          sdoh_summary: {
            total_detections: 4,
            high_risk_count: 2,
            categories: ['housing_instability', 'food_insecurity'],
            top_indicators: [],
          },
          demographic_completeness: 0.67,
          cultural_factors_available: true,
        },
        error: null,
      });

      const calibrated = createCalibrationResult({
        calibrated_score: 78,
        score_delta: -14,
        adjustment_direction: 'decreased',
        adjustment_reasoning: 'SDOH factors suggest systemic barriers, not clinical decline',
        needs_additional_data: true,
        additional_data_suggestions: ['Family/caregiver interview for housing status'],
      });
      mockInvoke.mockResolvedValue(createMcpCalibrationResponse(calibrated));

      const result = await ConfidenceCalibrationService.calibrateScore({
        patient_id: 'patient-test-001',
        tenant_id: 'tenant-test-001',
        skill_key: 'ai-readmission-predictor',
        original_score: 92,
        original_confidence: 0.85,
        factors: createMockFactors(),
      });

      assertSuccess(result);
      expect(result.data.calibrated_score).toBe(78);
      expect(result.data.score_delta).toBe(-14);
      expect(result.data.needs_additional_data).toBe(true);

      // Verify MCP was called with population context
      const invokeArgs = mockInvoke.mock.calls[0][1].body.params.arguments;
      expect(invokeArgs.population_context).toEqual({
        primary_language: 'Spanish',
        community_group: 'latino',
        setting: undefined,
      });
    });

    it('proceeds with reduced context when population data unavailable', async () => {
      mockPopulationFetcher.getCalibrationContext.mockResolvedValue({
        success: false,
        data: null,
        error: { code: 'FETCH_FAILED', message: 'Database timeout' },
      });

      const calibrated = createCalibrationResult({
        calibrated_score: 90,
        score_delta: -2,
        adjustment_direction: 'decreased',
        calibrated_confidence: 0.6,
        adjustment_reasoning: 'Insufficient demographic data for population-level adjustment',
      });
      mockInvoke.mockResolvedValue(createMcpCalibrationResponse(calibrated));

      const result = await ConfidenceCalibrationService.calibrateScore({
        patient_id: 'patient-test-002',
        tenant_id: 'tenant-test-001',
        skill_key: 'ai-readmission-predictor',
        original_score: 92,
        original_confidence: 0.85,
        factors: createMockFactors(),
      });

      assertSuccess(result);
      // Score should have minimal adjustment due to missing context
      expect(result.data.calibrated_score).toBe(90);
      // Confidence should be lower due to missing data
      expect(result.data.calibrated_confidence).toBe(0.6);

      // Verify MCP was called without population context
      const invokeArgs = mockInvoke.mock.calls[0][1].body.params.arguments;
      expect(invokeArgs.population_context).toBeUndefined();
    });

    it('returns failure when MCP call fails', async () => {
      mockPopulationFetcher.getCalibrationContext.mockResolvedValue({
        success: true,
        data: {
          population_context: {},
          sdoh_summary: { total_detections: 0, high_risk_count: 0, categories: [], top_indicators: [] },
          demographic_completeness: 0,
          cultural_factors_available: false,
        },
        error: null,
      });

      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Service unavailable' } });

      const result = await ConfidenceCalibrationService.calibrateScore({
        patient_id: 'patient-test-003',
        tenant_id: 'tenant-test-001',
        skill_key: 'ai-fall-risk-predictor',
        original_score: 65,
        original_confidence: 0.7,
        factors: createMockFactors(),
      });

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_FAILED');
    });

    it('returns failure when MCP returns empty response', async () => {
      mockPopulationFetcher.getCalibrationContext.mockResolvedValue({
        success: true,
        data: {
          population_context: {},
          sdoh_summary: { total_detections: 0, high_risk_count: 0, categories: [], top_indicators: [] },
          demographic_completeness: 0,
          cultural_factors_available: false,
        },
        error: null,
      });

      mockInvoke.mockResolvedValue({ data: { result: { content: [] } }, error: null });

      const result = await ConfidenceCalibrationService.calibrateScore({
        patient_id: 'patient-test-004',
        tenant_id: 'tenant-test-001',
        skill_key: 'ai-readmission-predictor',
        original_score: 50,
        original_confidence: 0.8,
        factors: [],
      });

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_EMPTY');
    });

    it('passes correct skill_key to MCP tool', async () => {
      mockPopulationFetcher.getCalibrationContext.mockResolvedValue({
        success: true,
        data: {
          population_context: {},
          sdoh_summary: { total_detections: 0, high_risk_count: 0, categories: [], top_indicators: [] },
          demographic_completeness: 0,
          cultural_factors_available: false,
        },
        error: null,
      });

      mockInvoke.mockResolvedValue(createMcpCalibrationResponse(createCalibrationResult()));

      await ConfidenceCalibrationService.calibrateScore({
        patient_id: 'patient-test-005',
        tenant_id: 'tenant-test-001',
        skill_key: 'ai-fall-risk-predictor',
        original_score: 40,
        original_confidence: 0.9,
        factors: createMockFactors(),
      });

      const invokeArgs = mockInvoke.mock.calls[0][1].body.params.arguments;
      expect(invokeArgs.skill_key).toBe('ai-fall-risk-predictor');
      expect(invokeArgs.original_score).toBe(40);
    });
  });

  describe('convenience wrappers', () => {
    beforeEach(() => {
      mockPopulationFetcher.getCalibrationContext.mockResolvedValue({
        success: true,
        data: {
          population_context: {},
          sdoh_summary: { total_detections: 0, high_risk_count: 0, categories: [], top_indicators: [] },
          demographic_completeness: 0,
          cultural_factors_available: false,
        },
        error: null,
      });
      mockInvoke.mockResolvedValue(createMcpCalibrationResponse(createCalibrationResult()));
    });

    it('calibrateReadmissionRisk uses readmission predictor skill key', async () => {
      await ConfidenceCalibrationService.calibrateReadmissionRisk(
        'patient-test-006', 'tenant-test-001', 88, 0.82, createMockFactors()
      );

      const invokeArgs = mockInvoke.mock.calls[0][1].body.params.arguments;
      expect(invokeArgs.skill_key).toBe('ai-readmission-predictor');
    });

    it('calibrateFallRisk uses fall risk predictor skill key', async () => {
      await ConfidenceCalibrationService.calibrateFallRisk(
        'patient-test-007', 'tenant-test-001', 55, 0.75, createMockFactors()
      );

      const invokeArgs = mockInvoke.mock.calls[0][1].body.params.arguments;
      expect(invokeArgs.skill_key).toBe('ai-fall-risk-predictor');
    });
  });
});
