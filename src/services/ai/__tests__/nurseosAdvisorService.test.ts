/**
 * Tests for NurseOS Advisor Service
 *
 * P4-1 through P4-4: Behavioral tests for burnout advisor, module recommendations,
 * stress narrative, and triage signal building.
 *
 * Tracker: docs/trackers/nurseos-completion-tracker.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NurseOSAdvisorService } from '../nurseosAdvisorService';
import type { ServiceResult } from '../../_base';

// ============================================================================
// Mocks
// ============================================================================

const mockInvoke = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function assertSuccess<T>(result: ServiceResult<T>): T {
  expect(result.success).toBe(true);
  if (!result.success || result.data === null || result.data === undefined) {
    throw new Error('Expected success result with data');
  }
  return result.data;
}

function assertFailure<T>(result: ServiceResult<T>): void {
  expect(result.success).toBe(false);
}

// ============================================================================
// Test Data — Synthetic (CLAUDE.md Rule #15)
// ============================================================================

const mockBurnoutAdvisorResponse = {
  success: true,
  data: {
    risk_summary: 'Test Provider Alpha shows elevated emotional exhaustion with moderate depersonalization.',
    risk_level: 'high' as const,
    primary_concern: 'Emotional exhaustion is at clinical threshold',
    intervention_recommendations: [
      {
        type: 'immediate' as const,
        action: 'Schedule peer support session within 48 hours',
        rationale: 'EE score of 32/54 indicates high exhaustion',
        priority: 'high' as const,
      },
      {
        type: 'short_term' as const,
        action: 'Begin box breathing exercises before shifts',
        rationale: 'Stress level averaging 7.2/10 over past week',
        priority: 'medium' as const,
      },
    ],
    self_care_suggestions: [
      'Take a 10-minute walk between patients',
      'Practice the 4-7-8 breathing technique',
      'Connect with a trusted colleague daily',
    ],
    escalation_needed: false,
    escalation_reason: null,
    confidence: 0.85,
  },
  metadata: {
    model: 'claude-sonnet-4-5-20250929',
    skill_key: 'nurseos_burnout_advisor',
    input_tokens: 500,
    output_tokens: 300,
    cost_usd: 0.006,
  },
};

const mockModuleRecsResponse = {
  success: true,
  data: {
    recommendations: [
      {
        module_category: 'Stress Management',
        module_name: 'Box Breathing',
        reason: 'High emotional exhaustion — immediate stress relief technique',
        priority: 'high' as const,
        estimated_minutes: 5,
      },
      {
        module_category: 'Emotional Resilience',
        module_name: 'Compassion Fatigue Recovery',
        reason: 'Depersonalization score indicates compassion fatigue risk',
        priority: 'medium' as const,
        estimated_minutes: 20,
      },
    ],
    overall_focus: 'Stress management and emotional recovery',
    encouragement: 'You are doing important work — taking care of yourself is part of taking care of others.',
    confidence: 0.8,
  },
  metadata: {
    model: 'claude-haiku-4-5-20250929',
    skill_key: 'nurseos_module_recommendations',
    input_tokens: 300,
    output_tokens: 200,
    cost_usd: 0.001,
  },
};

const mockStressNarrativeResponse = {
  success: true,
  data: {
    narrative: 'Your stress levels have been climbing over the past week, peaking at 8/10 on days with high patient census. Your energy is lowest on night shifts.',
    trend: 'worsening' as const,
    key_insights: [
      'Stress peaks correlate with patient census above 12',
      'Night shifts consistently show lower mood ratings',
    ],
    contributing_factors: [
      {
        factor: 'Patient census',
        correlation: 'strong' as const,
        description: 'Days with census >12 show stress 2+ points higher',
      },
    ],
    positive_patterns: ['You maintained energy above 5/10 on days with team support'],
    action_items: ['Request schedule adjustment to reduce consecutive night shifts'],
    confidence: 0.75,
  },
  metadata: {
    model: 'claude-haiku-4-5-20250929',
    skill_key: 'nurseos_stress_narrative',
    period: '7d',
    checkin_count: 6,
    input_tokens: 400,
    output_tokens: 250,
    cost_usd: 0.001,
  },
};

// ============================================================================
// Tests: analyzeBurnout (P4-1)
// ============================================================================

describe('NurseOSAdvisorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  describe('analyzeBurnout', () => {
    it('returns burnout analysis with intervention recommendations', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBurnoutAdvisorResponse, error: null });

      const result = await NurseOSAdvisorService.analyzeBurnout('provider-001');
      const data = assertSuccess(result);

      expect(data.risk_level).toBe('high');
      expect(data.intervention_recommendations).toHaveLength(2);
      expect(data.intervention_recommendations[0].type).toBe('immediate');
      expect(data.self_care_suggestions.length).toBeGreaterThanOrEqual(3);
      expect(data.confidence).toBeGreaterThan(0);
    });

    it('passes assessmentId when provided', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBurnoutAdvisorResponse, error: null });

      await NurseOSAdvisorService.analyzeBurnout('provider-001', 'assessment-abc');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-nurseos-burnout-advisor',
        { body: { providerId: 'provider-001', assessmentId: 'assessment-abc' } }
      );
    });

    it('returns failure when edge function errors', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Function timeout' },
      });

      const result = await NurseOSAdvisorService.analyzeBurnout('provider-001');
      assertFailure(result);
    });

    it('returns failure when response has no data', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: false, data: null },
        error: null,
      });

      const result = await NurseOSAdvisorService.analyzeBurnout('provider-001');
      assertFailure(result);
    });

    it('handles unexpected errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network failure'));

      const result = await NurseOSAdvisorService.analyzeBurnout('provider-001');
      assertFailure(result);
    });
  });

  // ============================================================================
  // Tests: getModuleRecommendations (P4-2)
  // ============================================================================

  describe('getModuleRecommendations', () => {
    it('returns personalized module recommendations', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockModuleRecsResponse, error: null });

      const result = await NurseOSAdvisorService.getModuleRecommendations('provider-001', 'shield');
      const data = assertSuccess(result);

      expect(data.recommendations).toHaveLength(2);
      expect(data.recommendations[0].module_category).toBe('Stress Management');
      expect(data.overall_focus).toBeTruthy();
      expect(data.encouragement).toBeTruthy();
    });

    it('passes productLine parameter to edge function', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockModuleRecsResponse, error: null });

      await NurseOSAdvisorService.getModuleRecommendations('provider-001', 'clarity');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-nurseos-module-recommendations',
        { body: { providerId: 'provider-001', productLine: 'clarity' } }
      );
    });

    it('returns failure on edge function error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await NurseOSAdvisorService.getModuleRecommendations('provider-001');
      assertFailure(result);
    });
  });

  // ============================================================================
  // Tests: getStressNarrative (P4-3)
  // ============================================================================

  describe('getStressNarrative', () => {
    it('returns stress narrative with trend analysis', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockStressNarrativeResponse, error: null });

      const result = await NurseOSAdvisorService.getStressNarrative('provider-001', '7d');
      const data = assertSuccess(result);

      expect(data.narrative).toContain('stress');
      expect(data.trend).toBe('worsening');
      expect(data.key_insights.length).toBeGreaterThanOrEqual(1);
      expect(data.contributing_factors.length).toBeGreaterThanOrEqual(1);
      expect(data.contributing_factors[0].correlation).toBe('strong');
    });

    it('defaults to 7-day period', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockStressNarrativeResponse, error: null });

      await NurseOSAdvisorService.getStressNarrative('provider-001');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-nurseos-stress-narrative',
        { body: { providerId: 'provider-001', period: '7d' } }
      );
    });

    it('supports 30-day period', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockStressNarrativeResponse, error: null });

      await NurseOSAdvisorService.getStressNarrative('provider-001', '30d');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-nurseos-stress-narrative',
        { body: { providerId: 'provider-001', period: '30d' } }
      );
    });

    it('returns failure on edge function error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Timeout' },
      });

      const result = await NurseOSAdvisorService.getStressNarrative('provider-001');
      assertFailure(result);
    });
  });

  // ============================================================================
  // Tests: buildBurnoutSignal (P4-4 — triage integration)
  // ============================================================================

  describe('buildBurnoutSignal', () => {
    it('maps critical burnout to emergency escalation', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'critical',
        composite_score: 82,
        emotional_exhaustion_score: 45,
        depersonalization_score: 22,
        personal_accomplishment_score: 12,
      });

      expect(signal.skill_key).toBe('nurseos_burnout_advisor');
      expect(signal.recommended_level).toBe('emergency');
      expect(signal.data_source).toBe('provider_wellness_assessment');
      expect(signal.factors).toContain('High emotional exhaustion (45/54)');
      expect(signal.factors).toContain('High depersonalization (22/30)');
      expect(signal.factors).toContain('Low personal accomplishment (12/48)');
    });

    it('maps high burnout to escalate level', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'high',
        composite_score: 58,
        emotional_exhaustion_score: 30,
        depersonalization_score: 15,
        personal_accomplishment_score: 25,
      });

      expect(signal.recommended_level).toBe('escalate');
    });

    it('maps moderate burnout to notify level', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'moderate',
        composite_score: 40,
        emotional_exhaustion_score: 20,
        depersonalization_score: 10,
        personal_accomplishment_score: 30,
      });

      expect(signal.recommended_level).toBe('notify');
    });

    it('maps low burnout to none level', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'low',
        composite_score: 15,
        emotional_exhaustion_score: 10,
        depersonalization_score: 5,
        personal_accomplishment_score: 40,
      });

      expect(signal.recommended_level).toBe('none');
    });

    it('upgrades moderate to monitor when stress trend is increasing', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'moderate',
        composite_score: 40,
        emotional_exhaustion_score: 20,
        depersonalization_score: 10,
        personal_accomplishment_score: 30,
        stress_trend: 'increasing',
      });

      expect(signal.recommended_level).toBe('monitor');
      expect(signal.factors).toContain('Stress trend worsening');
    });

    it('upgrades to monitor when 5+ consecutive high stress days', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'low',
        composite_score: 15,
        emotional_exhaustion_score: 10,
        depersonalization_score: 5,
        personal_accomplishment_score: 40,
        consecutive_high_stress_days: 5,
      });

      expect(signal.recommended_level).toBe('monitor');
      expect(signal.factors).toContain('5 consecutive high-stress days');
    });

    it('includes composite score when no dimension thresholds breached', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'low',
        composite_score: 15,
        emotional_exhaustion_score: 10,
        depersonalization_score: 5,
        personal_accomplishment_score: 40,
      });

      expect(signal.factors).toContain('Composite burnout score: 15/100');
    });

    it('has higher confidence with stress trend data', () => {
      const withTrend = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'moderate',
        composite_score: 40,
        emotional_exhaustion_score: 20,
        depersonalization_score: 10,
        personal_accomplishment_score: 30,
        stress_trend: 'stable',
      });

      const withoutTrend = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'moderate',
        composite_score: 40,
        emotional_exhaustion_score: 20,
        depersonalization_score: 10,
        personal_accomplishment_score: 30,
      });

      expect(withTrend.confidence).toBe(0.8);
      expect(withoutTrend.confidence).toBe(0.6);
    });

    it('generates valid ISO timestamp', () => {
      const signal = NurseOSAdvisorService.buildBurnoutSignal({
        risk_level: 'low',
        composite_score: 15,
        emotional_exhaustion_score: 10,
        depersonalization_score: 5,
        personal_accomplishment_score: 40,
      });

      expect(() => new Date(signal.generated_at)).not.toThrow();
      expect(new Date(signal.generated_at).getTime()).not.toBeNaN();
    });
  });
});
