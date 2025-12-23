/**
 * Care Plan AI Service Tests
 *
 * Tests for the AI-powered care plan generation service.
 * Includes safety guardrail verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CarePlanAIService, GeneratedCarePlan } from '../carePlanAIService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'plan-123' }, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('CarePlanAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCarePlan: GeneratedCarePlan = {
    title: 'Chronic Care Management Plan',
    description: 'Comprehensive plan for managing multiple chronic conditions.',
    planType: 'chronic_care',
    priority: 'high',
    goals: [
      {
        goal: 'Improve blood glucose control',
        target: 'A1c below 7.0%',
        timeframe: '3 months',
        measurementMethod: 'Quarterly lab draws',
        priority: 'high',
        evidenceBasis: 'ADA Guidelines 2024',
      },
    ],
    interventions: [
      {
        intervention: 'Monthly care coordination calls',
        frequency: 'Monthly',
        responsible: 'care_coordinator',
        duration: '12 weeks',
        rationale: 'Regular monitoring and support',
        cptCode: '99490',
        billingEligible: true,
      },
    ],
    barriers: [
      {
        barrier: 'Transportation to appointments',
        category: 'transportation',
        solution: 'Arrange medical transportation service',
        resources: ['MTM services', 'Community transport'],
        priority: 'high',
      },
    ],
    activities: [
      {
        activityType: 'appointment',
        description: 'PCP follow-up visit',
        frequency: 'Monthly',
        status: 'scheduled',
      },
    ],
    careTeam: [
      { role: 'nurse', responsibilities: ['Daily monitoring', 'Patient education'] },
      { role: 'care_coordinator', responsibilities: ['Care plan oversight'] },
    ],
    estimatedDuration: '12 weeks',
    reviewSchedule: 'Every 2 weeks',
    successCriteria: ['A1c improved', 'No hospitalizations'],
    riskFactors: ['Multiple chronic conditions'],
    icd10Codes: [{ code: 'E11.9', display: 'Type 2 diabetes' }],
    ccmEligible: true,
    tcmEligible: false,
    confidence: 0.85,
    evidenceSources: ['ADA Guidelines', 'USPSTF'],
    requiresReview: true,
    reviewReasons: ['AI-generated content requires clinician review'],
  };

  describe('generateCarePlan', () => {
    it('should successfully generate a care plan', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          carePlan: mockCarePlan,
          metadata: {
            generated_at: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514',
            response_time_ms: 2000,
            plan_type: 'chronic_care',
            context_summary: {
              conditions_count: 3,
              medications_count: 5,
              has_sdoh: true,
              utilization_risk: 'medium',
            },
          },
        },
        error: null,
      });

      const result = await CarePlanAIService.generateCarePlan({
        patientId: 'patient-123',
        planType: 'chronic_care',
      });

      expect(result.success).toBe(true);
      expect(result.data?.carePlan.title).toBe('Chronic Care Management Plan');
      expect(result.data?.carePlan.goals).toHaveLength(1);
    });

    it('should reject invalid plan types', async () => {
      const result = await CarePlanAIService.generateCarePlan({
        patientId: 'patient-123',
        planType: 'invalid_type' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should require patient ID', async () => {
      const result = await CarePlanAIService.generateCarePlan({
        patientId: '',
        planType: 'chronic_care',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await CarePlanAIService.generateCarePlan({
        patientId: 'patient-123',
        planType: 'chronic_care',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CARE_PLAN_GENERATION_FAILED');
    });
  });

  describe('Safety Guardrails', () => {
    it('should always set requiresReview to true', async () => {
      const planWithReviewFalse = {
        ...mockCarePlan,
        requiresReview: false, // AI tried to set false
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { carePlan: planWithReviewFalse, metadata: {} },
        error: null,
      });

      const result = await CarePlanAIService.generateCarePlan({
        patientId: 'patient-123',
        planType: 'chronic_care',
      });

      // SAFETY: Should be overridden to true
      expect(result.data?.carePlan.requiresReview).toBe(true);
    });

    it('should add review reason for low confidence', async () => {
      const lowConfidencePlan = {
        ...mockCarePlan,
        confidence: 0.4, // Below threshold
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { carePlan: lowConfidencePlan, metadata: {} },
        error: null,
      });

      const result = await CarePlanAIService.generateCarePlan({
        patientId: 'patient-123',
        planType: 'chronic_care',
      });

      expect(result.data?.carePlan.reviewReasons).toContain(
        'Senior clinician review recommended due to complexity'
      );
    });

    it('should limit goals to prevent overwhelming plans', async () => {
      const manyGoalsPlan = {
        ...mockCarePlan,
        goals: Array(15)
          .fill(null)
          .map((_, i) => ({
            goal: `Goal ${i + 1}`,
            target: 'Target',
            timeframe: '4 weeks',
            measurementMethod: 'Tracking',
            priority: 'medium' as const,
          })),
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { carePlan: manyGoalsPlan, metadata: {} },
        error: null,
      });

      const result = await CarePlanAIService.generateCarePlan({
        patientId: 'patient-123',
        planType: 'chronic_care',
      });

      // SAFETY: Should limit to 10 goals
      expect(result.data?.carePlan.goals.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateReadmissionPreventionPlan', () => {
    it('should use readmission_prevention plan type', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { carePlan: mockCarePlan, metadata: {} },
        error: null,
      });

      await CarePlanAIService.generateReadmissionPreventionPlan('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-care-plan-generator',
        expect.objectContaining({
          body: expect.objectContaining({
            planType: 'readmission_prevention',
            durationWeeks: 4,
          }),
        })
      );
    });
  });

  describe('generateHighUtilizerPlan', () => {
    it('should include social worker in care team', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { carePlan: mockCarePlan, metadata: {} },
        error: null,
      });

      await CarePlanAIService.generateHighUtilizerPlan('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-care-plan-generator',
        expect.objectContaining({
          body: expect.objectContaining({
            planType: 'high_utilizer',
            careTeamRoles: expect.arrayContaining(['social_worker']),
          }),
        })
      );
    });
  });

  describe('saveGeneratedPlan', () => {
    it('should save plan in draft status', async () => {
      const mockFrom = vi.mocked(supabase.from);
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'plan-123' }, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await CarePlanAIService.saveGeneratedPlan(
        'patient-123',
        mockCarePlan,
        'coordinator-456'
      );

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft', // SAFETY: Never auto-activated
        })
      );
    });

    it('should reject plans without goals', async () => {
      const planWithoutGoals = { ...mockCarePlan, goals: [] };

      const result = await CarePlanAIService.saveGeneratedPlan(
        'patient-123',
        planWithoutGoals,
        'coordinator-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject plans without interventions', async () => {
      const planWithoutInterventions = { ...mockCarePlan, interventions: [] };

      const result = await CarePlanAIService.saveGeneratedPlan(
        'patient-123',
        planWithoutInterventions,
        'coordinator-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('approvePlan', () => {
    it('should activate plan on approval', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any);

      const result = await CarePlanAIService.approvePlan('plan-123', 'clinician-456');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });
  });

  describe('rejectPlan', () => {
    it('should discontinue plan on rejection', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any);

      const result = await CarePlanAIService.rejectPlan(
        'plan-123',
        'clinician-456',
        'Plan does not address key concerns'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'discontinued',
        })
      );
    });
  });

  describe('getBillingEligibility', () => {
    it('should calculate billing eligibility correctly', () => {
      const eligibility = CarePlanAIService.getBillingEligibility(mockCarePlan);

      expect(eligibility.ccmEligible).toBe(true);
      expect(eligibility.tcmEligible).toBe(false);
      expect(eligibility.billableInterventions).toHaveLength(1);
      expect(eligibility.estimatedRevenueMonthly).toBeGreaterThan(0);
    });

    it('should identify billable interventions', () => {
      const planWithBillable = {
        ...mockCarePlan,
        interventions: [
          { ...mockCarePlan.interventions[0], billingEligible: true, cptCode: '99490' },
          { ...mockCarePlan.interventions[0], billingEligible: false },
        ],
      };

      const eligibility = CarePlanAIService.getBillingEligibility(planWithBillable);

      expect(eligibility.billableInterventions).toHaveLength(1);
    });
  });
});
