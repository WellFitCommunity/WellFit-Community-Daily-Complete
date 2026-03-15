/**
 * Escalation Override Service Tests
 *
 * P5-5: Behavioral tests for override justification and appeal analysis.
 *
 * Covers:
 * - Override with valid reason → justification generated
 * - Override without adequate reason → blocked
 * - High-risk override → flagged for supervisor review
 * - Appeal with evidence → re-evaluated
 * - Appeal without evidence → blocked
 * - MCP call verification
 * - MCP failure handling
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P5-5)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceResult } from '../../_base';
import { EscalationOverrideService } from '../escalationOverrideService';
import type { OverrideJustification, AppealAnalysis } from '../escalationOverrideService';

// ============================================================================
// Mocks
// ============================================================================

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
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

// ============================================================================
// Test Helpers
// ============================================================================

function assertSuccess<T>(result: ServiceResult<T>): asserts result is { success: true; data: T; error: null } {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(`Expected success but got failure: ${result.error?.message}`);
}

function assertFailure(result: ServiceResult<unknown>): asserts result is { success: false; data: null; error: { code: string; message: string } } {
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure but got success');
}

function createMcpResponse(result: unknown) {
  return {
    data: {
      result: {
        content: [{ text: JSON.stringify(result) }],
      },
    },
    error: null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('EscalationOverrideService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  describe('generateJustification', () => {
    it('generates structured justification for a valid override', async () => {
      const justification: OverrideJustification = {
        is_justified: true,
        rationale: 'Patient has documented history of anxiety-related vital sign spikes. Current vitals consistent with anxiety episode, not clinical decline.',
        risk_assessment: 'low',
        risk_if_wrong: 'If not anxiety, missed early signs of cardiac event. Mitigated by continuous monitoring.',
        monitoring_recommendations: ['Q1H vital signs for next 4 hours', 'PRN anxiolytic per standing order'],
        reassess_in: '4 hours',
        clarifying_questions: [],
        requires_supervisor_review: false,
      };

      mockInvoke.mockResolvedValue(createMcpResponse(justification));

      const result = await EscalationOverrideService.generateJustification({
        patient_id: 'patient-test-001',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-001',
        skill_key: 'ai-care-escalation-scorer',
        original_level: 'escalate',
        override_level: 'monitor',
        clinician_reason: 'Patient has known anxiety episodes that mimic cardiac symptoms. Vitals are within their baseline range.',
      });

      assertSuccess(result);
      expect(result.data.is_justified).toBe(true);
      expect(result.data.risk_assessment).toBe('low');
      expect(result.data.requires_supervisor_review).toBe(false);
      expect(result.data.monitoring_recommendations).toHaveLength(2);
    });

    it('blocks override with insufficient reason (less than 10 chars)', async () => {
      const result = await EscalationOverrideService.generateJustification({
        patient_id: 'patient-test-002',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-001',
        skill_key: 'ai-care-escalation-scorer',
        original_level: 'emergency',
        override_level: 'none',
        clinician_reason: 'OK',
      });

      assertFailure(result);
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('flags high-risk override for supervisor review', async () => {
      const justification: OverrideJustification = {
        is_justified: false,
        rationale: 'Downgrading from emergency to none removes all monitoring. No documented clinical basis for this degree of change.',
        risk_assessment: 'high',
        risk_if_wrong: 'Patient could deteriorate without detection. Emergency-level indicators suggest immediate intervention needed.',
        monitoring_recommendations: ['Do not proceed without supervisor approval'],
        reassess_in: 'immediately',
        clarifying_questions: [
          'Has the patient been examined in the last 30 minutes?',
          'Are there any confounding factors (anxiety, post-procedure)?',
          'Has a provider assessed and documented clearance?',
        ],
        requires_supervisor_review: true,
      };

      mockInvoke.mockResolvedValue(createMcpResponse(justification));

      const result = await EscalationOverrideService.generateJustification({
        patient_id: 'patient-test-003',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-001',
        skill_key: 'ai-care-escalation-scorer',
        original_level: 'emergency',
        override_level: 'none',
        clinician_reason: 'Patient seems fine, vitals are acceptable in my clinical judgment',
      });

      assertSuccess(result);
      expect(result.data.is_justified).toBe(false);
      expect(result.data.risk_assessment).toBe('high');
      expect(result.data.requires_supervisor_review).toBe(true);
      expect(result.data.clarifying_questions.length).toBeGreaterThan(0);
    });

    it('returns failure when MCP call fails', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Service unavailable' } });

      const result = await EscalationOverrideService.generateJustification({
        patient_id: 'patient-test-004',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-001',
        skill_key: 'ai-fall-risk-predictor',
        original_level: 'escalate',
        override_level: 'monitor',
        clinician_reason: 'Patient demonstrates good balance and mobility today',
      });

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_FAILED');
    });
  });

  describe('analyzeAppeal', () => {
    it('supports appeal with strong clinical evidence', async () => {
      const analysis: AppealAnalysis = {
        appeal_supported: true,
        recommended_level: 'escalate',
        confidence: 0.88,
        reasoning: 'Clinician identified deteriorating trend over 72 hours that the AI missed due to point-in-time scoring.',
        supporting_factors: [
          'Three consecutive days of declining SpO2',
          'New onset confusion not captured in check-in data',
          'Family reported increased falls at home',
        ],
        counter_factors: [
          'Most recent vitals are within normal ranges',
        ],
        ai_blind_spots: [
          'Point-in-time scoring missed the downward trend over 72 hours',
          'Check-in questions did not capture cognitive changes',
        ],
        systematic_issue: true,
      };

      mockInvoke.mockResolvedValue(createMcpResponse(analysis));

      const result = await EscalationOverrideService.analyzeAppeal({
        patient_id: 'patient-test-005',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-002',
        skill_key: 'ai-care-escalation-scorer',
        current_level: 'monitor',
        requested_level: 'escalate',
        appeal_reason: 'AI shows monitor but patient is clearly declining over the past 3 days',
        clinical_evidence: [
          'SpO2: 96% → 93% → 91% over 3 days',
          'New onset confusion reported by family',
          '2 falls at home this week (not captured in check-ins)',
        ],
      });

      assertSuccess(result);
      expect(result.data.appeal_supported).toBe(true);
      expect(result.data.recommended_level).toBe('escalate');
      expect(result.data.ai_blind_spots).toHaveLength(2);
      expect(result.data.systematic_issue).toBe(true);
    });

    it('blocks appeal without clinical evidence', async () => {
      const result = await EscalationOverrideService.analyzeAppeal({
        patient_id: 'patient-test-006',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-002',
        skill_key: 'ai-fall-risk-predictor',
        current_level: 'none',
        requested_level: 'escalate',
        appeal_reason: 'I think the AI is wrong',
        clinical_evidence: [],
      });

      assertFailure(result);
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('identifies AI blind spots for model improvement', async () => {
      const analysis: AppealAnalysis = {
        appeal_supported: true,
        recommended_level: 'notify',
        confidence: 0.75,
        reasoning: 'Cultural factors not weighted in fall risk model',
        supporting_factors: ['Patient uses traditional remedies that affect balance'],
        counter_factors: ['Standard fall risk factors are low'],
        ai_blind_spots: ['Fall risk model does not account for herbal supplement interactions'],
        systematic_issue: true,
      };

      mockInvoke.mockResolvedValue(createMcpResponse(analysis));

      const result = await EscalationOverrideService.analyzeAppeal({
        patient_id: 'patient-test-007',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-003',
        skill_key: 'ai-fall-risk-predictor',
        current_level: 'none',
        requested_level: 'notify',
        appeal_reason: 'Patient takes herbal supplements that cause dizziness',
        clinical_evidence: ['Patient reports daily ginkgo biloba and valerian root use'],
      });

      assertSuccess(result);
      expect(result.data.systematic_issue).toBe(true);
      expect(result.data.ai_blind_spots).toContain('Fall risk model does not account for herbal supplement interactions');
    });

    it('returns failure when MCP call fails', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Timeout' } });

      const result = await EscalationOverrideService.analyzeAppeal({
        patient_id: 'patient-test-008',
        tenant_id: 'tenant-test-001',
        clinician_id: 'clinician-test-001',
        skill_key: 'ai-readmission-predictor',
        current_level: 'monitor',
        requested_level: 'emergency',
        appeal_reason: 'Patient condition has acutely worsened',
        clinical_evidence: ['BP 80/40, altered mental status'],
      });

      assertFailure(result);
      expect(result.error.code).toBe('META_TRIAGE_FAILED');
    });
  });
});
