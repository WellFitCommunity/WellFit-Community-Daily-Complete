/**
 * Treatment Pathway AI Service Tests
 *
 * Tests for the AI-powered treatment pathway recommender service.
 * Includes safety guardrail verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TreatmentPathwayService, TreatmentPathway } from '../treatmentPathwayService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'recommendation-123' }, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: [],
            error: null,
          })),
          single: vi.fn().mockResolvedValue({ data: { content: {} }, error: null }),
        })),
      })),
    })),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('TreatmentPathwayService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPathway: TreatmentPathway = {
    condition: 'Type 2 Diabetes Mellitus',
    conditionCode: 'E11.9',
    pathwayTitle: 'Treatment Pathway for Type 2 Diabetes Mellitus',
    summary: 'Evidence-based treatment approach focusing on glycemic control and cardiovascular risk reduction.',
    severity: 'moderate',
    treatmentGoal: 'Achieve HbA1c < 7.0% while minimizing hypoglycemia risk',
    steps: [
      {
        stepNumber: 1,
        phase: 'first_line',
        intervention: 'Lifestyle modifications and metformin',
        interventionType: 'medication',
        rationale: 'First-line therapy per ADA guidelines',
        expectedOutcome: 'HbA1c reduction of 1-1.5%',
        timeframe: '3 months',
        guidelineSource: 'ADA Standards of Care 2024',
        evidenceLevel: 'A',
        considerations: ['Renal function monitoring'],
        contraindications: ['eGFR < 30'],
        monitoringRequired: ['HbA1c every 3 months', 'Renal function annually'],
      },
    ],
    medications: [
      {
        medicationClass: 'Biguanide',
        examples: ['Metformin'],
        startingApproach: 'Start 500mg daily, titrate to 2000mg',
        targetOutcome: 'Glycemic control',
        commonSideEffects: ['GI upset', 'B12 deficiency'],
        monitoringParameters: ['eGFR', 'B12 levels'],
        contraindicatedIn: ['Severe renal impairment'],
        guidelineSource: 'ADA 2024',
        requiresReview: true,
      },
    ],
    lifestyle: [
      {
        category: 'diet',
        recommendation: 'Carbohydrate-controlled diet',
        specificGuidance: 'Limit carbohydrates to 45-60g per meal',
        expectedBenefit: 'Improved glycemic control',
        timeframe: 'Ongoing',
        resources: ['Diabetes educator referral'],
      },
    ],
    referrals: [
      { specialty: 'Diabetes Educator', reason: 'Self-management education', urgency: 'routine' },
    ],
    monitoringPlan: [
      { parameter: 'HbA1c', frequency: 'Every 3 months', target: '< 7.0%' },
      { parameter: 'eGFR', frequency: 'Annually', target: '> 60' },
    ],
    followUpSchedule: 'Follow up in 3 months',
    redFlags: ['Severe hyperglycemia', 'DKA symptoms', 'Hypoglycemia'],
    patientEducation: ['Blood glucose monitoring', 'Hypoglycemia recognition'],
    guidelinesSummary: [
      { guideline: 'ADA Standards of Care', year: 2024, recommendation: 'Metformin first-line' },
    ],
    contraindications: [],
    allergyConflicts: [],
    confidence: 0.85,
    requiresReview: true,
    reviewReasons: ['All AI-generated recommendations require clinician review'],
    disclaimer: 'These recommendations are for clinical decision support only and require verification by a licensed healthcare provider.',
  };

  describe('generatePathway', () => {
    it('should successfully generate a treatment pathway', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          pathway: mockPathway,
          metadata: {
            generated_at: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514',
            response_time_ms: 2500,
            condition: 'Type 2 Diabetes Mellitus',
            severity: 'moderate',
            patient_context: {
              conditions_count: 3,
              medications_count: 5,
              allergies_count: 2,
              has_contraindications: false,
            },
          },
        },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Type 2 Diabetes Mellitus',
        conditionCode: 'E11.9',
      });

      expect(result.success).toBe(true);
      expect(result.data?.pathway.condition).toBe('Type 2 Diabetes Mellitus');
      expect(result.data?.pathway.steps).toHaveLength(1);
    });

    it('should reject empty patient ID', async () => {
      const result = await TreatmentPathwayService.generatePathway({
        patientId: '',
        condition: 'Diabetes',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Patient ID');
    });

    it('should reject empty condition', async () => {
      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Condition');
    });

    it('should reject invalid severity', async () => {
      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
        severity: 'invalid' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('severity');
    });

    it('should handle edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TREATMENT_PATHWAY_GENERATION_FAILED');
    });
  });

  describe('Safety Guardrails', () => {
    it('should always set requiresReview to true', async () => {
      const pathwayWithReviewFalse = {
        ...mockPathway,
        requiresReview: false, // AI tried to set false
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: pathwayWithReviewFalse, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      // SAFETY: Should be overridden to true
      expect(result.data?.pathway.requiresReview).toBe(true);
    });

    it('should add review reason for low confidence', async () => {
      const lowConfidencePathway = {
        ...mockPathway,
        confidence: 0.4, // Below threshold
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: lowConfidencePathway, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      expect(result.data?.pathway.reviewReasons).toContain(
        'Specialist review recommended due to complexity'
      );
    });

    it('should flag allergy conflicts prominently', async () => {
      const pathwayWithAllergies = {
        ...mockPathway,
        allergyConflicts: ['Penicillin allergy - avoid penicillin-class antibiotics'],
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: pathwayWithAllergies, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Infection',
      });

      // SAFETY: Allergy conflicts should be first in review reasons
      expect(result.data?.pathway.reviewReasons[0]).toContain('CRITICAL: Allergy conflicts');
    });

    it('should add review reason for contraindications', async () => {
      const pathwayWithContraindications = {
        ...mockPathway,
        contraindications: ['Renal impairment'],
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: pathwayWithContraindications, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      expect(result.data?.pathway.reviewReasons).toContain(
        'Contraindications present - verify appropriateness'
      );
    });

    it('should limit treatment steps to prevent overly complex pathways', async () => {
      const manyStepsPathway = {
        ...mockPathway,
        steps: Array(12)
          .fill(null)
          .map((_, i) => ({
            stepNumber: i + 1,
            phase: 'first_line' as const,
            intervention: `Step ${i + 1}`,
            interventionType: 'medication' as const,
            rationale: 'Rationale',
            expectedOutcome: 'Outcome',
            timeframe: '4 weeks',
            guidelineSource: 'Guidelines',
            evidenceLevel: 'C' as const,
            considerations: [],
            contraindications: [],
            monitoringRequired: [],
          })),
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: manyStepsPathway, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      // SAFETY: Should limit to 8 steps
      expect(result.data?.pathway.steps.length).toBeLessThanOrEqual(8);
    });

    it('should ensure all medication recommendations require review', async () => {
      const pathwayWithMeds = {
        ...mockPathway,
        medications: [
          { ...mockPathway.medications[0], requiresReview: false },
          { ...mockPathway.medications[0], requiresReview: false },
        ],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: pathwayWithMeds, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      // SAFETY: All medications should require review
      result.data?.pathway.medications.forEach((med) => {
        expect(med.requiresReview).toBe(true);
      });
    });

    it('should ensure disclaimer is present', async () => {
      const pathwayNoDisclaimer = {
        ...mockPathway,
        disclaimer: '',
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: pathwayNoDisclaimer, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      // SAFETY: Should add default disclaimer
      expect(result.data?.pathway.disclaimer.length).toBeGreaterThan(20);
      expect(result.data?.pathway.disclaimer).toContain('clinical decision support');
    });

    it('should ensure red flags are present', async () => {
      const pathwayNoRedFlags = {
        ...mockPathway,
        redFlags: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: pathwayNoRedFlags, metadata: {} },
        error: null,
      });

      const result = await TreatmentPathwayService.generatePathway({
        patientId: 'patient-123',
        condition: 'Diabetes',
      });

      // SAFETY: Should add default red flag
      expect(result.data?.pathway.redFlags.length).toBeGreaterThan(0);
    });
  });

  describe('Condition-Specific Pathways', () => {
    it('should generate diabetes pathway with correct parameters', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: mockPathway, metadata: {} },
        error: null,
      });

      await TreatmentPathwayService.generateDiabetesPathway('patient-123', 'moderate', true);

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-treatment-pathway',
        expect.objectContaining({
          body: expect.objectContaining({
            condition: 'Type 2 Diabetes Mellitus',
            conditionCode: 'E11.9',
            isNewDiagnosis: true,
          }),
        })
      );
    });

    it('should generate hypertension pathway with correct parameters', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: mockPathway, metadata: {} },
        error: null,
      });

      await TreatmentPathwayService.generateHypertensionPathway('patient-123', 'severe');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-treatment-pathway',
        expect.objectContaining({
          body: expect.objectContaining({
            condition: 'Essential Hypertension',
            conditionCode: 'I10',
            severity: 'severe',
          }),
        })
      );
    });

    it('should generate heart failure pathway with correct parameters', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: mockPathway, metadata: {} },
        error: null,
      });

      await TreatmentPathwayService.generateHeartFailurePathway('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-treatment-pathway',
        expect.objectContaining({
          body: expect.objectContaining({
            condition: 'Heart Failure',
            conditionCode: 'I50.9',
          }),
        })
      );
    });

    it('should generate COPD pathway with correct parameters', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: mockPathway, metadata: {} },
        error: null,
      });

      await TreatmentPathwayService.generateCOPDPathway('patient-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-treatment-pathway',
        expect.objectContaining({
          body: expect.objectContaining({
            condition: 'Chronic Obstructive Pulmonary Disease',
            conditionCode: 'J44.9',
          }),
        })
      );
    });

    it('should generate depression pathway with correct parameters', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { pathway: mockPathway, metadata: {} },
        error: null,
      });

      await TreatmentPathwayService.generateDepressionPathway('patient-123', 'severe');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-treatment-pathway',
        expect.objectContaining({
          body: expect.objectContaining({
            condition: 'Major Depressive Disorder',
            conditionCode: 'F32.9',
            severity: 'severe',
          }),
        })
      );
    });
  });

  describe('savePathwayRecommendation', () => {
    it('should save pathway with pending_review status', async () => {
      const mockFrom = vi.mocked(supabase.from);
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'recommendation-123' }, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await TreatmentPathwayService.savePathwayRecommendation(
        'patient-123',
        mockPathway,
        'clinician-456'
      );

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending_review', // SAFETY: Never auto-approved
          ai_generated: true,
        })
      );
    });

    it('should reject pathways without steps', async () => {
      const pathwayWithoutSteps = { ...mockPathway, steps: [] };

      const result = await TreatmentPathwayService.savePathwayRecommendation(
        'patient-123',
        pathwayWithoutSteps,
        'clinician-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('treatment step');
    });

    it('should reject pathways without condition', async () => {
      const pathwayWithoutCondition = { ...mockPathway, condition: '' };

      const result = await TreatmentPathwayService.savePathwayRecommendation(
        'patient-123',
        pathwayWithoutCondition,
        'clinician-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject pathways without disclaimer', async () => {
      const pathwayWithoutDisclaimer = { ...mockPathway, disclaimer: 'too short' };

      const result = await TreatmentPathwayService.savePathwayRecommendation(
        'patient-123',
        pathwayWithoutDisclaimer,
        'clinician-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('disclaimer');
    });
  });

  describe('approvePathway', () => {
    it('should approve pathway successfully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { content: {} }, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any);

      const result = await TreatmentPathwayService.approvePathway('recommendation-123', 'clinician-456');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
        })
      );
    });
  });

  describe('rejectPathway', () => {
    it('should reject pathway successfully', async () => {
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

      const result = await TreatmentPathwayService.rejectPathway(
        'recommendation-123',
        'clinician-456',
        'Not appropriate for this patient'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          rejection_reason: 'Not appropriate for this patient',
        })
      );
    });
  });

  describe('getGuidelinesForCondition', () => {
    it('should return ADA guidelines for diabetes', () => {
      const guidelines = TreatmentPathwayService.getGuidelinesForCondition('Type 2 Diabetes');
      expect(guidelines).toContain('ADA Standards of Care 2024');
    });

    it('should return ACC/AHA guidelines for hypertension', () => {
      const guidelines = TreatmentPathwayService.getGuidelinesForCondition('Essential Hypertension');
      expect(guidelines).toContain('ACC/AHA Hypertension Guidelines 2017');
    });

    it('should return GOLD guidelines for COPD', () => {
      const guidelines = TreatmentPathwayService.getGuidelinesForCondition('COPD');
      expect(guidelines).toContain('GOLD Guidelines 2024');
    });

    it('should return default for unknown conditions', () => {
      const guidelines = TreatmentPathwayService.getGuidelinesForCondition('Unknown Condition');
      expect(guidelines).toContain('Consult relevant clinical guidelines');
    });
  });

  describe('checkContraindications', () => {
    it('should identify renal impairment contraindications', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ code: { coding: [{ display: 'Chronic Kidney Disease' }] } }],
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await TreatmentPathwayService.checkContraindications('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.contraindications.some((c) => c.toLowerCase().includes('renal'))).toBe(true);
    });
  });
});
