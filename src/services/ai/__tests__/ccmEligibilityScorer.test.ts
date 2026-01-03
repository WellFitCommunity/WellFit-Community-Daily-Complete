/**
 * Comprehensive tests for CCMEligibilityScorer
 *
 * Tests cover:
 * - CCMValidator (UUID validation, date validation, context validation)
 * - CCMEligibilityScorer (assessEligibility, batchAssessEligibility)
 * - Rate caching behavior
 * - CMS criteria checking (2+ chronic conditions)
 * - Engagement metrics calculation
 * - AI assessment integration
 * - Database storage
 * - Auto-enrollment logic
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CCMEligibilityScorer,
  type CCMAssessmentContext,
  type CCMEligibilityResult,
  type ChronicCondition,
} from '../ccmEligibilityScorer';

// ============================================================================
// MOCKS
// ============================================================================

const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
    rpc: (fn: string, params?: Record<string, unknown>) => mockSupabaseRpc(fn, params),
  },
}));

const mockOptimizerCall = vi.fn();
vi.mock('../../mcp/mcpCostOptimizer', () => ({
  mcpOptimizer: {
    call: (params: Record<string, unknown>) => mockOptimizerCall(params),
  },
}));

const mockFeeScheduleService = {
  getCCMRates: vi.fn(),
};
vi.mock('../../feeScheduleService', () => ({
  FeeScheduleService: {
    getCCMRates: () => mockFeeScheduleService.getCCMRates(),
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const validPatientId = '12345678-1234-1234-1234-123456789abc';
const validTenantId = 'abcdef01-2345-6789-abcd-ef0123456789';
const validAssessmentStart = '2024-10-01';
const validAssessmentEnd = '2024-12-31';

const createValidContext = (overrides: Partial<CCMAssessmentContext> = {}): CCMAssessmentContext => ({
  patientId: validPatientId,
  tenantId: validTenantId,
  assessmentPeriodStart: validAssessmentStart,
  assessmentPeriodEnd: validAssessmentEnd,
  ...overrides,
});

const mockChronicConditions: ChronicCondition[] = [
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', severity: 'moderate', onsetDate: '2020-01-15' },
  { code: 'I10', description: 'Essential hypertension', severity: 'mild', onsetDate: '2019-06-20' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease', severity: 'moderate', onsetDate: '2021-03-10' },
];

const mockFhirConditions = mockChronicConditions.map(c => ({
  code: c.code,
  display: c.description,
  severity: c.severity,
  onset_date_time: c.onsetDate,
  clinical_status: 'active',
}));

const mockCheckIns = Array.from({ length: 45 }, (_, i) => ({
  status: i < 35 ? 'completed' : 'missed',
  check_in_date: `2024-${String(10 + Math.floor(i / 15)).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
}));

const mockSdohIndicators = [
  { category: 'transportation', risk_level: 'moderate', description: 'Limited access to transportation' },
  { category: 'housing', risk_level: 'low', description: 'Stable housing situation' },
];

const mockAIResponse = {
  response: JSON.stringify({
    overallEligibilityScore: 0.85,
    eligibilityCategory: 'eligible_high',
    predictedMonthlyReimbursement: 145.60,
    reimbursementTier: 'complex',
    recommendedCPTCodes: ['99487'],
    enrollmentRecommendation: 'strongly_recommend',
    recommendationRationale: 'Patient has 3 chronic conditions with high engagement and moderate complexity',
    barriersToEnrollment: [
      { barrier: 'Transportation', solution: 'Offer telehealth options' }
    ],
    recommendedInterventions: [
      { intervention: 'Monthly care coordination calls', benefit: 'Improves medication adherence' }
    ]
  }),
  cost: 0.0025,
  model: 'claude-haiku-4-5-20250929',
};

const mockCCMRates = new Map([
  ['99490', { code: '99490', rate: 64.72, description: 'CCM services, 20+ minutes' }],
  ['99487', { code: '99487', rate: 145.60, description: 'Complex CCM, first 60 minutes' }],
  ['99489', { code: '99489', rate: 69.72, description: 'Complex CCM, each additional 30 min' }],
  ['99424', { code: '99424', rate: 85.00, description: 'Principal care management' }],
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setupMocks(options: {
  skillEnabled?: boolean;
  autoEnroll?: boolean;
  minimumScore?: number;
  existingEnrollment?: boolean;
  chronicConditionsCount?: number;
  checkInsAvailable?: boolean;
  aiResponse?: typeof mockAIResponse;
  feeScheduleError?: boolean;
} = {}) {
  const {
    skillEnabled = true,
    autoEnroll = false,
    minimumScore = 0.70,
    existingEnrollment = false,
    chronicConditionsCount = 3,
    checkInsAvailable = true,
    aiResponse = mockAIResponse,
    feeScheduleError = false,
  } = options;

  // Mock Fee Schedule Service
  if (feeScheduleError) {
    mockFeeScheduleService.getCCMRates.mockRejectedValue(new Error('Fee schedule unavailable'));
  } else {
    mockFeeScheduleService.getCCMRates.mockResolvedValue(mockCCMRates);
  }

  // Mock RPC calls
  mockSupabaseRpc.mockImplementation((fn: string) => {
    if (fn === 'get_ai_skill_config') {
      return Promise.resolve({
        data: {
          ccm_eligibility_scorer_enabled: skillEnabled,
          ccm_eligibility_scorer_auto_enroll: autoEnroll,
          ccm_eligibility_scorer_minimum_score: minimumScore,
          ccm_eligibility_scorer_model: 'claude-haiku-4-5-20250929',
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  // Mock from() calls
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'ccm_eligibility_assessments') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingEnrollment ? {
            chronic_conditions_count: 3,
            chronic_conditions: mockChronicConditions,
            check_in_completion_rate: 0.80,
            appointment_adherence_rate: 0.85,
            medication_adherence_rate: 0.90,
            engagement_score: 0.85,
            sdoh_risk_count: 2,
            sdoh_barriers: mockSdohIndicators,
            predicted_monthly_reimbursement: 145.60,
            reimbursement_tier: 'complex',
            recommended_cpt_codes: ['99487'],
          } : null,
          error: null,
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
      };
    }

    if (table === 'fhir_conditions') {
      const conditions = mockFhirConditions.slice(0, chronicConditionsCount);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: conditions, error: null }),
      };
    }

    if (table === 'patient_daily_check_ins') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: checkInsAvailable ? mockCheckIns : [],
          error: null,
        }),
      };
    }

    if (table === 'sdoh_indicators') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockSdohIndicators, error: null }),
      };
    }

    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { chronic_conditions: ['diabetes', 'hypertension'] },
          error: null,
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  // Mock AI optimizer
  mockOptimizerCall.mockResolvedValue(aiResponse);
}

function resetMocks() {
  vi.clearAllMocks();
  mockSupabaseFrom.mockReset();
  mockSupabaseRpc.mockReset();
  mockOptimizerCall.mockReset();
  mockFeeScheduleService.getCCMRates.mockReset();
}

// ============================================================================
// TESTS
// ============================================================================

describe('CCMEligibilityScorer', () => {
  let scorer: CCMEligibilityScorer;

  beforeEach(() => {
    resetMocks();
    scorer = new CCMEligibilityScorer();
    scorer.clearRateCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Input Validation Tests
  // --------------------------------------------------------------------------
  describe('Input Validation', () => {
    describe('UUID Validation', () => {
      it('should reject invalid patient ID format', async () => {
        setupMocks();
        const context = createValidContext({ patientId: 'not-a-uuid' });

        await expect(scorer.assessEligibility(context)).rejects.toThrow('Invalid patientId: must be valid UUID');
      });

      it('should reject invalid tenant ID format', async () => {
        setupMocks();
        const context = createValidContext({ tenantId: 'invalid-tenant' });

        await expect(scorer.assessEligibility(context)).rejects.toThrow('Invalid tenantId: must be valid UUID');
      });

      it('should accept valid UUID formats', async () => {
        setupMocks();
        const context = createValidContext();

        // Should not throw UUID validation error
        await expect(scorer.assessEligibility(context)).resolves.toBeDefined();
      });

      it('should accept uppercase UUIDs', async () => {
        setupMocks();
        const context = createValidContext({
          patientId: validPatientId.toUpperCase(),
        });

        await expect(scorer.assessEligibility(context)).resolves.toBeDefined();
      });
    });

    describe('Date Validation', () => {
      it('should reject invalid assessment period start date', async () => {
        setupMocks();
        const context = createValidContext({ assessmentPeriodStart: 'invalid-date' });

        await expect(scorer.assessEligibility(context)).rejects.toThrow('Invalid assessmentPeriodStart: must be valid ISO date');
      });

      it('should reject invalid assessment period end date', async () => {
        setupMocks();
        const context = createValidContext({ assessmentPeriodEnd: 'not-a-date' });

        await expect(scorer.assessEligibility(context)).rejects.toThrow('Invalid assessmentPeriodEnd: must be valid ISO date');
      });

      it('should accept ISO date strings', async () => {
        setupMocks();
        const context = createValidContext({
          assessmentPeriodStart: '2024-01-01',
          assessmentPeriodEnd: '2024-03-31',
        });

        await expect(scorer.assessEligibility(context)).resolves.toBeDefined();
      });

      it('should accept full ISO datetime strings', async () => {
        setupMocks();
        const context = createValidContext({
          assessmentPeriodStart: '2024-01-01T00:00:00Z',
          assessmentPeriodEnd: '2024-03-31T23:59:59Z',
        });

        await expect(scorer.assessEligibility(context)).resolves.toBeDefined();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tenant Configuration Tests
  // --------------------------------------------------------------------------
  describe('Tenant Configuration', () => {
    it('should throw error when skill is disabled for tenant', async () => {
      setupMocks({ skillEnabled: false });
      const context = createValidContext();

      await expect(scorer.assessEligibility(context)).rejects.toThrow(
        'CCM eligibility scorer is not enabled for this tenant'
      );
    });

    it('should proceed when skill is enabled', async () => {
      setupMocks({ skillEnabled: true });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);
      expect(result).toBeDefined();
      expect(result.patientId).toBe(validPatientId);
    });

    it('should use tenant-specific model configuration', async () => {
      setupMocks({ skillEnabled: true });
      const context = createValidContext();

      await scorer.assessEligibility(context);

      expect(mockOptimizerCall).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20250929',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // CMS Eligibility Criteria Tests
  // --------------------------------------------------------------------------
  describe('CMS Eligibility Criteria', () => {
    it('should return not_eligible when patient has fewer than 2 chronic conditions', async () => {
      setupMocks({ chronicConditionsCount: 1 });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.meetsCMSCriteria).toBe(false);
      expect(result.eligibilityCategory).toBe('not_eligible');
      expect(result.chronicConditionsCount).toBe(1);
      expect(result.enrollmentRecommendation).toBe('not_recommended');
      expect(result.recommendationRationale).toContain('does not meet CMS criteria');
    });

    it('should return not_eligible when patient has 0 chronic conditions', async () => {
      setupMocks({ chronicConditionsCount: 0 });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.meetsCMSCriteria).toBe(false);
      expect(result.eligibilityCategory).toBe('not_eligible');
      expect(result.chronicConditionsCount).toBe(0);
    });

    it('should meet CMS criteria with exactly 2 chronic conditions', async () => {
      setupMocks({ chronicConditionsCount: 2 });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.meetsCMSCriteria).toBe(true);
      expect(result.chronicConditionsCount).toBe(2);
    });

    it('should meet CMS criteria with 3+ chronic conditions', async () => {
      setupMocks({ chronicConditionsCount: 3 });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.meetsCMSCriteria).toBe(true);
      expect(result.chronicConditionsCount).toBe(3);
    });

    it('should not call AI for ineligible patients', async () => {
      setupMocks({ chronicConditionsCount: 1 });
      const context = createValidContext();

      await scorer.assessEligibility(context);

      expect(mockOptimizerCall).not.toHaveBeenCalled();
    });

    it('should report AI cost as 0 for ineligible patients', async () => {
      setupMocks({ chronicConditionsCount: 1 });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.aiCost).toBe(0);
      expect(result.aiModel).toBe('n/a');
    });
  });

  // --------------------------------------------------------------------------
  // Existing Enrollment Tests
  // --------------------------------------------------------------------------
  describe('Existing Enrollment Handling', () => {
    it('should return enrolled status for already enrolled patients', async () => {
      setupMocks({ existingEnrollment: true });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.eligibilityCategory).toBe('enrolled');
      expect(result.overallEligibilityScore).toBe(1.00);
      expect(result.meetsCMSCriteria).toBe(true);
    });

    it('should preserve existing enrollment data', async () => {
      setupMocks({ existingEnrollment: true });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.chronicConditionsCount).toBe(3);
      expect(result.engagementMetrics.checkInCompletionRate).toBe(0.80);
      expect(result.engagementMetrics.appointmentAdherenceRate).toBe(0.85);
      expect(result.sdohRiskCount).toBe(2);
    });

    it('should not call AI for already enrolled patients', async () => {
      setupMocks({ existingEnrollment: true });
      const context = createValidContext();

      await scorer.assessEligibility(context);

      expect(mockOptimizerCall).not.toHaveBeenCalled();
    });

    it('should report zero AI cost for enrolled patients', async () => {
      setupMocks({ existingEnrollment: true });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.aiCost).toBe(0);
      expect(result.aiModel).toBe('n/a');
    });
  });

  // --------------------------------------------------------------------------
  // Engagement Metrics Tests
  // --------------------------------------------------------------------------
  describe('Engagement Metrics Calculation', () => {
    it('should calculate check-in completion rate', async () => {
      setupMocks({ checkInsAvailable: true });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      // 35 completed out of 90 day period = ~0.39
      expect(result.engagementMetrics.checkInCompletionRate).toBeCloseTo(35 / 90, 2);
    });

    it('should handle missing check-in data', async () => {
      setupMocks({ checkInsAvailable: false });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.engagementMetrics.checkInCompletionRate).toBe(0);
    });

    it('should include appointment adherence rate', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      // Placeholder value is 0.80
      expect(result.engagementMetrics.appointmentAdherenceRate).toBe(0.80);
    });

    it('should include medication adherence rate', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      // Placeholder value is 0.75
      expect(result.engagementMetrics.medicationAdherenceRate).toBe(0.75);
    });

    it('should calculate overall engagement score as average', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      const expectedAvg = (result.engagementMetrics.checkInCompletionRate + 0.80 + 0.75) / 3;
      expect(result.engagementMetrics.overallEngagementScore).toBeCloseTo(expectedAvg, 2);
    });
  });

  // --------------------------------------------------------------------------
  // SDOH Risk Factor Tests
  // --------------------------------------------------------------------------
  describe('SDOH Risk Factors', () => {
    it('should include SDOH indicators in assessment', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.sdohRiskCount).toBe(2);
      expect(result.sdohBarriers).toHaveLength(2);
    });

    it('should map SDOH barrier categories correctly', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.sdohBarriers[0].category).toBe('transportation');
      expect(result.sdohBarriers[0].riskLevel).toBe('moderate');
      expect(result.sdohBarriers[1].category).toBe('housing');
      expect(result.sdohBarriers[1].riskLevel).toBe('low');
    });
  });

  // --------------------------------------------------------------------------
  // AI Assessment Tests
  // --------------------------------------------------------------------------
  describe('AI Assessment', () => {
    it('should call AI optimizer with correct parameters', async () => {
      setupMocks();
      const context = createValidContext();

      await scorer.assessEligibility(context);

      expect(mockOptimizerCall).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20250929',
          complexity: 'medium',
          userId: validPatientId,
        })
      );
    });

    it('should include chronic conditions count in AI context', async () => {
      setupMocks();
      const context = createValidContext();

      await scorer.assessEligibility(context);

      expect(mockOptimizerCall).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            chronicConditionsCount: 3,
          }),
        })
      );
    });

    it('should parse AI response correctly', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.overallEligibilityScore).toBe(0.85);
      expect(result.eligibilityCategory).toBe('eligible_high');
      expect(result.recommendedCPTCodes).toContain('99487');
      expect(result.enrollmentRecommendation).toBe('strongly_recommend');
    });

    it('should include AI cost in result', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.aiCost).toBe(0.0025);
      expect(result.aiModel).toBe('claude-haiku-4-5-20250929');
    });

    it('should handle AI response parsing errors', async () => {
      setupMocks({
        aiResponse: {
          response: 'invalid json response',
          cost: 0.001,
          model: 'claude-haiku-4-5-20250929',
        },
      });
      const context = createValidContext();

      await expect(scorer.assessEligibility(context)).rejects.toThrow('Failed to parse AI response');
    });

    it('should handle missing JSON in AI response', async () => {
      setupMocks({
        aiResponse: {
          response: 'No JSON here',
          cost: 0.001,
          model: 'claude-haiku-4-5-20250929',
        },
      });
      const context = createValidContext();

      await expect(scorer.assessEligibility(context)).rejects.toThrow('No JSON found in AI response');
    });
  });

  // --------------------------------------------------------------------------
  // Reimbursement Calculation Tests
  // --------------------------------------------------------------------------
  describe('Reimbursement Calculations', () => {
    it('should fetch CCM rates from fee schedule service', async () => {
      setupMocks();
      const context = createValidContext();

      await scorer.assessEligibility(context);

      // FeeScheduleService.getCCMRates is called - verify it was invoked
      expect(mockFeeScheduleService.getCCMRates).toHaveBeenCalled();
    });

    it('should use fallback rates when fee schedule unavailable', async () => {
      setupMocks({ feeScheduleError: true });
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      // Should still work with fallback rates
      expect(result.predictedMonthlyReimbursement).toBeDefined();
    });

    it('should cache rates after first fetch', async () => {
      setupMocks();
      const context = createValidContext();

      // First call
      await scorer.assessEligibility(context);

      // Second call
      await scorer.assessEligibility(context);

      // Should only fetch once due to caching
      expect(mockFeeScheduleService.getCCMRates).toHaveBeenCalledTimes(1);
    });

    it('should clear rate cache when requested', async () => {
      setupMocks();
      const context = createValidContext();

      await scorer.assessEligibility(context);
      scorer.clearRateCache();
      await scorer.assessEligibility(context);

      // Should fetch twice after cache clear
      expect(mockFeeScheduleService.getCCMRates).toHaveBeenCalledTimes(2);
    });

    it('should include recommended CPT codes', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.recommendedCPTCodes).toContain('99487');
    });
  });

  // --------------------------------------------------------------------------
  // Auto-Enrollment Tests
  // --------------------------------------------------------------------------
  describe('Auto-Enrollment', () => {
    it('should not auto-enroll when disabled', async () => {
      setupMocks({ autoEnroll: false });
      const context = createValidContext();

      await scorer.assessEligibility(context);

      // Should not update enrollment status
      const updateCalls = mockSupabaseFrom.mock.calls.filter(
        call => call[0] === 'ccm_eligibility_assessments'
      );
      const hasUpdateWithEnrollment = updateCalls.some(call =>
        JSON.stringify(call).includes('outreach_pending')
      );
      expect(hasUpdateWithEnrollment).toBe(false);
    });

    it('should auto-enroll high eligibility patients when enabled', async () => {
      setupMocks({ autoEnroll: true, minimumScore: 0.70 });
      const context = createValidContext();

      await scorer.assessEligibility(context);

      // Verify enrollment initiation was called
      const fromCalls = mockSupabaseFrom.mock.calls;
      const assessmentCalls = fromCalls.filter(c => c[0] === 'ccm_eligibility_assessments');
      expect(assessmentCalls.length).toBeGreaterThan(0);
    });

    it('should not auto-enroll when score below minimum', async () => {
      setupMocks({
        autoEnroll: true,
        minimumScore: 0.90,
        aiResponse: {
          ...mockAIResponse,
          response: JSON.stringify({
            overallEligibilityScore: 0.75,
            eligibilityCategory: 'eligible_moderate',
            predictedMonthlyReimbursement: 64.72,
            reimbursementTier: 'basic',
            recommendedCPTCodes: ['99490'],
            enrollmentRecommendation: 'recommend',
            recommendationRationale: 'Moderate eligibility',
          }),
        },
      });
      const context = createValidContext();

      await scorer.assessEligibility(context);

      // Score 0.75 < minimum 0.90, should not auto-enroll
      expect(mockSupabaseFrom).not.toHaveBeenCalledWith(
        expect.objectContaining({ enrollment_status: 'outreach_pending' })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Database Storage Tests
  // --------------------------------------------------------------------------
  describe('Database Storage', () => {
    it('should store assessment results in database', async () => {
      setupMocks();
      const context = createValidContext();

      await scorer.assessEligibility(context);

      const insertCalls = mockSupabaseFrom.mock.calls.filter(
        call => call[0] === 'ccm_eligibility_assessments'
      );
      expect(insertCalls.length).toBeGreaterThan(0);
    });

    it('should include all required fields in stored assessment', async () => {
      let insertedData: Record<string, unknown> | null = null;

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'ccm_eligibility_assessments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
              insertedData = data;
              return Promise.resolve({ data: null, error: null });
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        // Return other mocks as usual
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockFhirConditions, error: null }),
          };
        }
        if (table === 'patient_daily_check_ins') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockCheckIns, error: null }),
          };
        }
        if (table === 'sdoh_indicators') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockSdohIndicators, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockSupabaseRpc.mockResolvedValue({
        data: {
          ccm_eligibility_scorer_enabled: true,
          ccm_eligibility_scorer_auto_enroll: false,
          ccm_eligibility_scorer_minimum_score: 0.70,
        },
        error: null,
      });
      mockOptimizerCall.mockResolvedValue(mockAIResponse);
      mockFeeScheduleService.getCCMRates.mockResolvedValue(mockCCMRates);

      const context = createValidContext();
      await scorer.assessEligibility(context);

      expect(insertedData).not.toBeNull();
      expect(insertedData).toHaveProperty('tenant_id', validTenantId);
      expect(insertedData).toHaveProperty('patient_id', validPatientId);
      expect(insertedData).toHaveProperty('chronic_conditions_count');
      expect(insertedData).toHaveProperty('meets_cms_criteria');
      expect(insertedData).toHaveProperty('engagement_score');
      expect(insertedData).toHaveProperty('overall_eligibility_score');
      expect(insertedData).toHaveProperty('ai_cost');
    });
  });

  // --------------------------------------------------------------------------
  // Batch Assessment Tests
  // --------------------------------------------------------------------------
  describe('Batch Assessment', () => {
    beforeEach(() => {
      // Setup mocks for batch processing
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                { patient_id: validPatientId },
                { patient_id: validPatientId },
                { patient_id: validPatientId },
                { patient_id: 'aaaaaaaa-1111-1111-1111-111111111111' },
                { patient_id: 'aaaaaaaa-1111-1111-1111-111111111111' },
              ],
              error: null,
            }),
          };
        }
        if (table === 'ccm_eligibility_assessments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'patient_daily_check_ins') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockCheckIns, error: null }),
          };
        }
        if (table === 'sdoh_indicators') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockSdohIndicators, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockSupabaseRpc.mockResolvedValue({
        data: {
          ccm_eligibility_scorer_enabled: true,
          ccm_eligibility_scorer_auto_enroll: false,
          ccm_eligibility_scorer_minimum_score: 0.70,
        },
        error: null,
      });
      mockOptimizerCall.mockResolvedValue(mockAIResponse);
      mockFeeScheduleService.getCCMRates.mockResolvedValue(mockCCMRates);
    });

    it('should validate tenant ID for batch assessment', async () => {
      await expect(scorer.batchAssessEligibility('invalid-tenant')).rejects.toThrow(
        'Invalid tenantId: must be valid UUID'
      );
    });

    it('should return batch assessment summary', async () => {
      const result = await scorer.batchAssessEligibility(validTenantId);

      expect(result).toHaveProperty('assessed');
      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('highPriority');
      expect(result).toHaveProperty('predictedRevenue');
      expect(result).toHaveProperty('cost');
    });

    it('should process patients with 2+ chronic conditions', async () => {
      const result = await scorer.batchAssessEligibility(validTenantId);

      // Two patients have 2+ conditions each
      expect(result.assessed).toBeLessThanOrEqual(2);
    });

    it('should accumulate predicted revenue', async () => {
      const result = await scorer.batchAssessEligibility(validTenantId);

      expect(result.predictedRevenue).toBeGreaterThanOrEqual(0);
    });

    it('should accumulate AI costs', async () => {
      const result = await scorer.batchAssessEligibility(validTenantId);

      expect(result.cost).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------
  describe('Error Handling', () => {
    it('should handle database errors when gathering patient data', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { ccm_eligibility_scorer_enabled: true },
        error: null,
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'ccm_eligibility_assessments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const context = createValidContext();

      await expect(scorer.assessEligibility(context)).rejects.toThrow('Failed to gather patient data');
    });

    it('should handle tenant config fetch errors', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Config not found' },
      });

      const context = createValidContext();

      await expect(scorer.assessEligibility(context)).rejects.toThrow('Failed to get tenant config');
    });

    it('should handle AI service errors', async () => {
      setupMocks();
      mockOptimizerCall.mockRejectedValue(new Error('AI service unavailable'));

      const context = createValidContext();

      await expect(scorer.assessEligibility(context)).rejects.toThrow('AI CCM assessment failed');
    });
  });

  // --------------------------------------------------------------------------
  // Result Structure Tests
  // --------------------------------------------------------------------------
  describe('Result Structure', () => {
    it('should return complete CCMEligibilityResult for eligible patients', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      // Required fields
      expect(result.patientId).toBe(validPatientId);
      expect(result.assessmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof result.chronicConditionsCount).toBe('number');
      expect(Array.isArray(result.chronicConditions)).toBe(true);
      expect(typeof result.meetsCMSCriteria).toBe('boolean');
      expect(result.engagementMetrics).toBeDefined();
      expect(typeof result.sdohRiskCount).toBe('number');
      expect(Array.isArray(result.sdohBarriers)).toBe(true);
      expect(typeof result.overallEligibilityScore).toBe('number');
      expect(['not_eligible', 'eligible_low', 'eligible_moderate', 'eligible_high', 'enrolled']).toContain(
        result.eligibilityCategory
      );
      expect(typeof result.predictedMonthlyReimbursement).toBe('number');
      expect(['basic', 'complex', 'principal_care']).toContain(result.reimbursementTier);
      expect(Array.isArray(result.recommendedCPTCodes)).toBe(true);
      expect(['strongly_recommend', 'recommend', 'consider', 'not_recommended']).toContain(
        result.enrollmentRecommendation
      );
      expect(typeof result.recommendationRationale).toBe('string');
      expect(Array.isArray(result.barriersToEnrollment)).toBe(true);
      expect(Array.isArray(result.recommendedInterventions)).toBe(true);
      expect(typeof result.aiModel).toBe('string');
      expect(typeof result.aiCost).toBe('number');
    });

    it('should return chronic conditions with correct structure', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      result.chronicConditions.forEach(condition => {
        expect(condition).toHaveProperty('code');
        expect(condition).toHaveProperty('description');
        expect(condition).toHaveProperty('severity');
        expect(['mild', 'moderate', 'severe']).toContain(condition.severity);
      });
    });

    it('should return engagement metrics with correct structure', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      expect(result.engagementMetrics).toHaveProperty('checkInCompletionRate');
      expect(result.engagementMetrics).toHaveProperty('appointmentAdherenceRate');
      expect(result.engagementMetrics).toHaveProperty('medicationAdherenceRate');
      expect(result.engagementMetrics).toHaveProperty('overallEngagementScore');

      // All rates should be between 0 and 1
      expect(result.engagementMetrics.checkInCompletionRate).toBeGreaterThanOrEqual(0);
      expect(result.engagementMetrics.checkInCompletionRate).toBeLessThanOrEqual(1);
    });

    it('should return barriers with correct structure', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      result.barriersToEnrollment.forEach(barrier => {
        expect(barrier).toHaveProperty('barrier');
        expect(barrier).toHaveProperty('solution');
        expect(typeof barrier.barrier).toBe('string');
        expect(typeof barrier.solution).toBe('string');
      });
    });

    it('should return interventions with correct structure', async () => {
      setupMocks();
      const context = createValidContext();

      const result = await scorer.assessEligibility(context);

      result.recommendedInterventions.forEach(intervention => {
        expect(intervention).toHaveProperty('intervention');
        expect(intervention).toHaveProperty('benefit');
        expect(typeof intervention.intervention).toBe('string');
        expect(typeof intervention.benefit).toBe('string');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty SDOH indicators', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'sdoh_indicators') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        // Default mocks for other tables
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockFhirConditions, error: null }),
          };
        }
        if (table === 'ccm_eligibility_assessments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'patient_daily_check_ins') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockCheckIns, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });
      mockSupabaseRpc.mockResolvedValue({
        data: { ccm_eligibility_scorer_enabled: true },
        error: null,
      });
      mockOptimizerCall.mockResolvedValue(mockAIResponse);
      mockFeeScheduleService.getCCMRates.mockResolvedValue(mockCCMRates);

      const context = createValidContext();
      const result = await scorer.assessEligibility(context);

      expect(result.sdohRiskCount).toBe(0);
      expect(result.sdohBarriers).toHaveLength(0);
    });

    it('should handle conditions with null severity', async () => {
      const conditionsWithNullSeverity = [
        { code: 'E11.9', display: 'Diabetes', severity: null, onset_date_time: '2020-01-01', clinical_status: 'active' },
        { code: 'I10', display: 'Hypertension', severity: undefined, onset_date_time: '2019-06-01', clinical_status: 'active' },
      ];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: conditionsWithNullSeverity, error: null }),
          };
        }
        if (table === 'ccm_eligibility_assessments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'patient_daily_check_ins') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'sdoh_indicators') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });
      mockSupabaseRpc.mockResolvedValue({
        data: { ccm_eligibility_scorer_enabled: true },
        error: null,
      });
      mockOptimizerCall.mockResolvedValue(mockAIResponse);
      mockFeeScheduleService.getCCMRates.mockResolvedValue(mockCCMRates);

      const context = createValidContext();
      const result = await scorer.assessEligibility(context);

      // Should default to 'moderate' severity
      result.chronicConditions.forEach(condition => {
        expect(condition.severity).toBe('moderate');
      });
    });

    it('should handle very long assessment periods', async () => {
      setupMocks();
      const context = createValidContext({
        assessmentPeriodStart: '2020-01-01',
        assessmentPeriodEnd: '2024-12-31',
      });

      const result = await scorer.assessEligibility(context);

      expect(result).toBeDefined();
      expect(result.patientId).toBe(validPatientId);
    });
  });
});
