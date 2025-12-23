/**
 * Tests for Clinical Guideline Matcher Service
 *
 * Skill #24: Smart guideline recommendations
 * Tests the frontend service that matches patient data against clinical guidelines.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ClinicalGuidelineMatcherService,
  type GuidelineMatchResult,
  type GuidelineRecommendation,
  type AdherenceGap,
  type PreventiveScreening,
  type ClinicalGuideline,
} from '../clinicalGuidelineMatcherService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
        })),
      })),
    })),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('ClinicalGuidelineMatcherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================================================
  // MOCK DATA
  // =====================================================

  const mockGuideline: ClinicalGuideline = {
    guidelineId: 'ada-2024',
    guidelineName: 'ADA Standards of Care in Diabetes',
    organization: 'American Diabetes Association',
    year: 2024,
    condition: 'Diabetes Mellitus',
    conditionCode: 'E11',
  };

  const mockRecommendation: GuidelineRecommendation = {
    recommendationId: 'rec-001',
    guideline: mockGuideline,
    category: 'monitoring',
    recommendation: 'HbA1c testing every 3 months',
    rationale: 'ADA 2024 recommends quarterly HbA1c for patients not at goal',
    evidenceLevel: 'A',
    urgency: 'routine',
    targetValue: '< 7.0%',
    currentValue: '8.2%',
    gap: 'Above target by 1.2%',
    actionItems: ['Order HbA1c', 'Review current diabetes medications'],
  };

  const mockGap: AdherenceGap = {
    gapId: 'gap-001',
    guideline: mockGuideline,
    gapType: 'missing_medication',
    description: 'Patient not on SGLT2 inhibitor with CKD',
    expectedCare: 'SGLT2 inhibitor for cardio/renal protection',
    currentState: 'Not on SGLT2 inhibitor',
    recommendation: 'Consider adding empagliflozin or dapagliflozin',
    priority: 'high',
  };

  const mockScreening: PreventiveScreening = {
    screeningId: 'screen-001',
    screeningName: 'Colorectal Cancer Screening',
    guidelineSource: 'USPSTF 2021',
    applicableFor: 'Ages 45-75',
    frequency: 'every 10 years',
    lastPerformed: '2020-03-15',
    nextDue: '2030-03-15',
    status: 'current',
    recommendation: 'Next colonoscopy due around 2030-03-15.',
  };

  const mockMatchResult: GuidelineMatchResult = {
    patientId: 'patient-123',
    matchedGuidelines: [mockGuideline],
    recommendations: [mockRecommendation],
    adherenceGaps: [mockGap],
    preventiveScreenings: [mockScreening],
    summary: {
      totalGuidelines: 1,
      totalRecommendations: 1,
      criticalGaps: 0,
      highPriorityGaps: 1,
      overdueScreenings: 0,
    },
    confidence: 0.85,
    requiresReview: true,
    reviewReasons: ['All AI-generated guideline recommendations require clinician review'],
    disclaimer: 'These recommendations are for clinical decision support only.',
  };

  // =====================================================
  // matchGuidelines TESTS
  // =====================================================

  describe('matchGuidelines', () => {
    it('should match guidelines for a patient', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          result: mockMatchResult,
          metadata: {
            generated_at: '2024-01-01T12:00:00Z',
            model: 'claude-sonnet-4-20250514',
            response_time_ms: 1500,
            patient_context: {
              age: 65,
              conditions_count: 3,
              medications_count: 5,
            },
          },
        },
        error: null,
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.matchedGuidelines).toHaveLength(1);
        expect(result.data.result.recommendations).toHaveLength(1);
        expect(result.data.result.adherenceGaps).toHaveLength(1);
        expect(result.data.result.requiresReview).toBe(true);
      }
    });

    it('should fail without patient ID', async () => {
      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('Patient ID');
      }
    });

    it('should handle edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: new Error('Edge function failed'),
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GUIDELINE_MATCH_FAILED');
      }
    });

    it('should include focus conditions in request', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: mockMatchResult, metadata: {} },
        error: null,
      });

      await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
        focusConditions: ['diabetes', 'hypertension'],
        includePreventiveCare: false,
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-clinical-guideline-matcher',
        expect.objectContaining({
          body: expect.objectContaining({
            focusConditions: ['diabetes', 'hypertension'],
            includePreventiveCare: false,
          }),
        })
      );
    });
  });

  // =====================================================
  // CONDITION-SPECIFIC MATCHING TESTS
  // =====================================================

  describe('condition-specific matching', () => {
    beforeEach(() => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: mockMatchResult, metadata: {} },
        error: null,
      });
    });

    it('should match for specific condition', async () => {
      await ClinicalGuidelineMatcherService.matchForCondition(
        'patient-123',
        'diabetes'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-clinical-guideline-matcher',
        expect.objectContaining({
          body: expect.objectContaining({
            focusConditions: ['diabetes'],
            includePreventiveCare: false,
          }),
        })
      );
    });

    it('should get preventive care recommendations', async () => {
      await ClinicalGuidelineMatcherService.getPreventiveCareRecommendations('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-clinical-guideline-matcher',
        expect.objectContaining({
          body: expect.objectContaining({
            focusConditions: [],
            includePreventiveCare: true,
          }),
        })
      );
    });

    it('should match diabetes guidelines', async () => {
      await ClinicalGuidelineMatcherService.matchDiabetesGuidelines('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-clinical-guideline-matcher',
        expect.objectContaining({
          body: expect.objectContaining({
            focusConditions: ['diabetes'],
          }),
        })
      );
    });

    it('should match cardiovascular guidelines', async () => {
      await ClinicalGuidelineMatcherService.matchCardiovascularGuidelines('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-clinical-guideline-matcher',
        expect.objectContaining({
          body: expect.objectContaining({
            focusConditions: expect.arrayContaining(['hypertension', 'heart_failure']),
          }),
        })
      );
    });

    it('should match respiratory guidelines', async () => {
      await ClinicalGuidelineMatcherService.matchRespiratoryGuidelines('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-clinical-guideline-matcher',
        expect.objectContaining({
          body: expect.objectContaining({
            focusConditions: ['copd', 'asthma'],
          }),
        })
      );
    });
  });

  // =====================================================
  // SAFETY GUARDRAILS TESTS
  // =====================================================

  describe('safety guardrails', () => {
    it('should always set requiresReview to true', async () => {
      const resultWithoutReview = {
        ...mockMatchResult,
        requiresReview: false as boolean,
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: resultWithoutReview, metadata: {} },
        error: null,
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.requiresReview).toBe(true);
      }
    });

    it('should add review reason for low confidence', async () => {
      const lowConfidenceResult = {
        ...mockMatchResult,
        confidence: 0.4,
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: lowConfidenceResult, metadata: {} },
        error: null,
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.reviewReasons).toContain(
          'Low confidence score - requires careful clinician review'
        );
        expect(result.data.result.reviewReasons).toContain(
          'Specialist review recommended due to complexity'
        );
      }
    });

    it('should flag critical gaps prominently', async () => {
      const criticalGapResult = {
        ...mockMatchResult,
        summary: {
          ...mockMatchResult.summary,
          criticalGaps: 2,
        },
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: criticalGapResult, metadata: {} },
        error: null,
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.reviewReasons[0]).toContain('CRITICAL');
        expect(result.data.result.reviewReasons[0]).toContain('2 critical');
      }
    });

    it('should limit excessive recommendations', async () => {
      const manyRecommendations = Array(20).fill(mockRecommendation);
      const excessiveResult = {
        ...mockMatchResult,
        recommendations: manyRecommendations,
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: excessiveResult, metadata: {} },
        error: null,
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.recommendations.length).toBeLessThanOrEqual(15);
      }
    });

    it('should add disclaimer if missing', async () => {
      const noDisclaimerResult = {
        ...mockMatchResult,
        disclaimer: '',
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { result: noDisclaimerResult, metadata: {} },
        error: null,
      });

      const result = await ClinicalGuidelineMatcherService.matchGuidelines({
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.disclaimer.length).toBeGreaterThan(50);
        expect(result.data.result.disclaimer).toContain('clinical decision support');
      }
    });
  });

  // =====================================================
  // STATIC METHODS TESTS
  // =====================================================

  describe('static utility methods', () => {
    it('should return available guideline categories', () => {
      const categories = ClinicalGuidelineMatcherService.getAvailableCategories();

      expect(categories).toContain('diabetes');
      expect(categories).toContain('hypertension');
      expect(categories).toContain('heart_failure');
      expect(categories).toContain('copd');
      expect(categories.length).toBeGreaterThan(5);
    });

    it('should return guidelines for diabetes', () => {
      const guidelines = ClinicalGuidelineMatcherService.getGuidelinesForCondition('diabetes');

      expect(guidelines.length).toBeGreaterThan(0);
      expect(guidelines[0].organization).toContain('Diabetes');
    });

    it('should return empty array for unknown condition', () => {
      const guidelines = ClinicalGuidelineMatcherService.getGuidelinesForCondition('unknown');

      expect(guidelines).toEqual([]);
    });

    it('should return correct urgency colors', () => {
      expect(ClinicalGuidelineMatcherService.getUrgencyColor('emergent')).toBe('red');
      expect(ClinicalGuidelineMatcherService.getUrgencyColor('urgent')).toBe('orange');
      expect(ClinicalGuidelineMatcherService.getUrgencyColor('soon')).toBe('yellow');
      expect(ClinicalGuidelineMatcherService.getUrgencyColor('routine')).toBe('green');
    });

    it('should return correct priority colors', () => {
      expect(ClinicalGuidelineMatcherService.getPriorityColor('critical')).toBe('red');
      expect(ClinicalGuidelineMatcherService.getPriorityColor('high')).toBe('orange');
      expect(ClinicalGuidelineMatcherService.getPriorityColor('medium')).toBe('yellow');
      expect(ClinicalGuidelineMatcherService.getPriorityColor('low')).toBe('green');
    });

    it('should return correct screening status colors', () => {
      expect(ClinicalGuidelineMatcherService.getScreeningStatusColor('overdue')).toBe('red');
      expect(ClinicalGuidelineMatcherService.getScreeningStatusColor('never_done')).toBe('orange');
      expect(ClinicalGuidelineMatcherService.getScreeningStatusColor('current')).toBe('green');
      expect(ClinicalGuidelineMatcherService.getScreeningStatusColor('not_applicable')).toBe('gray');
    });
  });

  // =====================================================
  // SAVE AND REVIEW TESTS
  // =====================================================

  describe('save and review operations', () => {
    it('should save match result', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'match-123' }, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'ai_guideline_matches') {
          return { insert: mockInsert } as any;
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      });

      const result = await ClinicalGuidelineMatcherService.saveMatchResult(
        'patient-123',
        mockMatchResult,
        'clinician-456'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matchId).toBe('match-123');
      }
    });

    it('should mark match as reviewed', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'ai_guideline_matches') {
          return { update: mockUpdate } as any;
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      });

      const result = await ClinicalGuidelineMatcherService.markAsReviewed(
        'match-123',
        'clinician-456',
        'Reviewed and approved for implementation'
      );

      expect(result.success).toBe(true);
    });
  });

  // =====================================================
  // TYPE SAFETY TESTS
  // =====================================================

  describe('type safety', () => {
    it('should have correct guideline structure', () => {
      const guideline: ClinicalGuideline = {
        guidelineId: 'test-id',
        guidelineName: 'Test Guideline',
        organization: 'Test Org',
        year: 2024,
        condition: 'Test Condition',
      };

      expect(guideline.guidelineId).toBeDefined();
      expect(guideline.guidelineName).toBeDefined();
      expect(typeof guideline.year).toBe('number');
    });

    it('should have correct recommendation structure', () => {
      const rec: GuidelineRecommendation = {
        recommendationId: 'rec-1',
        guideline: mockGuideline,
        category: 'treatment',
        recommendation: 'Test recommendation',
        rationale: 'Test rationale',
        evidenceLevel: 'A',
        urgency: 'routine',
        actionItems: ['Action 1'],
      };

      expect(rec.category).toMatch(/^(treatment|monitoring|screening|lifestyle|referral|diagnostic)$/);
      expect(rec.evidenceLevel).toMatch(/^(A|B|C|D|expert_consensus)$/);
      expect(rec.urgency).toMatch(/^(routine|soon|urgent|emergent)$/);
    });

    it('should have correct gap structure', () => {
      const gap: AdherenceGap = {
        gapId: 'gap-1',
        guideline: mockGuideline,
        gapType: 'missing_medication',
        description: 'Test description',
        expectedCare: 'Expected care',
        currentState: 'Current state',
        recommendation: 'Recommendation',
        priority: 'high',
      };

      expect(gap.gapType).toMatch(
        /^(missing_medication|missing_test|suboptimal_control|missing_referral|missing_screening|lifestyle)$/
      );
      expect(gap.priority).toMatch(/^(low|medium|high|critical)$/);
    });

    it('should have correct screening structure', () => {
      const screening: PreventiveScreening = {
        screeningId: 'screen-1',
        screeningName: 'Test Screening',
        guidelineSource: 'USPSTF 2024',
        applicableFor: 'Ages 45+',
        frequency: 'every 5 years',
        status: 'current',
        recommendation: 'Test recommendation',
      };

      expect(screening.status).toMatch(/^(current|overdue|never_done|not_applicable)$/);
    });
  });
});
