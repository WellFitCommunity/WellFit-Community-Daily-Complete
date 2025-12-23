/**
 * Fall Risk Predictor Service Tests
 *
 * @module fallRiskPredictorService.test
 * @skill #30 - Fall Risk Predictor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FallRiskPredictorService,
  FallRiskAssessment,
  FallRiskAssessmentResponse,
} from '../fallRiskPredictorService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('FallRiskPredictorService', () => {
  let service: FallRiskPredictorService;

  const mockAssessment: FallRiskAssessment = {
    assessmentId: 'assessment-123',
    patientId: 'patient-456',
    assessorId: 'provider-789',
    assessmentDate: '2025-12-23T10:00:00Z',
    assessmentContext: 'admission',
    overallRiskScore: 65,
    riskCategory: 'high',
    morseScaleEstimate: 75,
    riskFactors: [
      {
        factor: 'Age 78 years',
        category: 'age',
        severity: 'high',
        weight: 0.3,
        evidence: 'Age ≥75 significantly increases fall risk',
        interventionSuggestion: 'Enhanced monitoring',
      },
      {
        factor: 'History of 2 falls in past year',
        category: 'history',
        severity: 'high',
        weight: 0.35,
        evidence: 'Previous falls are strongest predictor of future falls',
        interventionSuggestion: 'Post-fall assessment protocol',
      },
      {
        factor: 'Taking benzodiazepine and antihypertensive',
        category: 'medication',
        severity: 'moderate',
        weight: 0.2,
        evidence: 'High-risk medication combination',
        interventionSuggestion: 'Medication review with pharmacy',
      },
    ],
    protectiveFactors: [
      {
        factor: 'Cognitively intact',
        impact: 'Can follow safety instructions',
        category: 'cognitive',
      },
    ],
    patientAge: 78,
    ageRiskCategory: 'high',
    categoryScores: {
      age: 80,
      fallHistory: 75,
      medications: 50,
      conditions: 45,
      mobility: 40,
      cognitive: 10,
      sensory: 30,
      environmental: 20,
    },
    interventions: [
      {
        intervention: 'Implement fall precautions bundle',
        priority: 'urgent',
        category: 'monitoring',
        timeframe: 'Immediately upon admission',
        responsible: 'Nursing',
        estimatedRiskReduction: 0.25,
      },
      {
        intervention: 'Physical therapy consultation for gait and balance assessment',
        priority: 'high',
        category: 'therapy',
        timeframe: 'Within 24 hours',
        responsible: 'PT',
        estimatedRiskReduction: 0.15,
      },
      {
        intervention: 'Pharmacy review of high-risk medications',
        priority: 'high',
        category: 'medication',
        timeframe: 'Within 24 hours',
        responsible: 'Pharmacy',
        estimatedRiskReduction: 0.1,
      },
    ],
    precautions: [
      'Yellow fall risk wristband',
      'Non-slip footwear required',
      'Bed in lowest position',
      'Call light within reach',
      'Frequent rounding every 2 hours',
      'Toileting assistance required',
    ],
    monitoringFrequency: 'enhanced',
    confidence: 0.85,
    requiresReview: true,
    reviewReasons: ['Standard clinical review required'],
    plainLanguageExplanation:
      'Your risk of falling is higher than average. This is mainly because you are 78 years old and have fallen twice before. Some of your medicines can also make you dizzy. We will take extra steps to keep you safe.',
    generatedAt: '2025-12-23T10:00:00Z',
  };

  const mockResponse: FallRiskAssessmentResponse = {
    assessment: mockAssessment,
    metadata: {
      generated_at: '2025-12-23T10:00:00Z',
      response_time_ms: 1500,
      model: 'claude-sonnet-4-5-20250514',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FallRiskPredictorService();

    // Default mock for auth
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            aud: 'authenticated',
            created_at: '2024-01-01',
            app_metadata: {},
            user_metadata: {},
          },
        },
      },
      error: null,
    });
  });

  describe('assessRisk', () => {
    it('should assess fall risk successfully', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: 'provider-789',
        assessmentContext: 'admission',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessment.assessmentId).toBe('assessment-123');
        expect(result.data.assessment.riskCategory).toBe('high');
        expect(result.data.assessment.overallRiskScore).toBe(65);
        expect(result.data.assessment.riskFactors).toHaveLength(3);
      }
    });

    it('should fail without patient ID', async () => {
      const result = await service.assessRisk({
        patientId: '',
        assessorId: 'provider-789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should fail without assessor ID', async () => {
      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should fail without authentication', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: 'provider-789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should always require clinical review', async () => {
      const assessmentWithoutReview = {
        ...mockResponse,
        assessment: { ...mockAssessment, requiresReview: false },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: assessmentWithoutReview,
        error: null,
      });

      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: 'provider-789',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessment.requiresReview).toBe(true);
      }
    });

    it('should flag very high risk for urgent review', async () => {
      const veryHighRisk = {
        ...mockResponse,
        assessment: {
          ...mockAssessment,
          overallRiskScore: 90,
          riskCategory: 'very_high' as const,
          reviewReasons: [],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: veryHighRisk,
        error: null,
      });

      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: 'provider-789',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessment.reviewReasons).toContain(
          'Very high fall risk - urgent review required'
        );
      }
    });

    it('should flag low confidence assessments', async () => {
      const lowConfidence = {
        ...mockResponse,
        assessment: {
          ...mockAssessment,
          confidence: 0.4,
          reviewReasons: [],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: lowConfidence,
        error: null,
      });

      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: 'provider-789',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessment.reviewReasons).toContain(
          'Low confidence - requires careful review'
        );
      }
    });

    it('should handle edge function error', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await service.assessRisk({
        patientId: 'patient-456',
        assessorId: 'provider-789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FALL_RISK_ASSESSMENT_FAILED');
      }
    });
  });

  describe('screenOnAdmission', () => {
    it('should call assessRisk with admission context', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.screenOnAdmission('patient-456', 'provider-789');

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-fall-risk-predictor',
        expect.objectContaining({
          body: expect.objectContaining({
            assessmentContext: 'admission',
          }),
        })
      );
    });
  });

  describe('reassessAfterFall', () => {
    it('should call assessRisk with post_fall context and fall details', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.reassessAfterFall(
        'patient-456',
        'provider-789',
        ['Fall occurred in bathroom', 'No injury sustained']
      );

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-fall-risk-predictor',
        expect.objectContaining({
          body: expect.objectContaining({
            assessmentContext: 'post_fall',
            customFactors: ['Fall occurred in bathroom', 'No injury sustained'],
          }),
        })
      );
    });
  });

  describe('routineAssessment', () => {
    it('should call assessRisk with routine context', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.routineAssessment('patient-456', 'provider-789');

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-fall-risk-predictor',
        expect.objectContaining({
          body: expect.objectContaining({
            assessmentContext: 'routine',
          }),
        })
      );
    });
  });

  describe('saveAssessment', () => {
    it('should save assessment to database', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'db-id-123',
                assessment_id: mockAssessment.assessmentId,
                patient_id: mockAssessment.patientId,
                assessor_id: mockAssessment.assessorId,
                assessment_date: mockAssessment.assessmentDate,
                assessment_context: mockAssessment.assessmentContext,
                overall_risk_score: mockAssessment.overallRiskScore,
                risk_category: mockAssessment.riskCategory,
                morse_scale_estimate: mockAssessment.morseScaleEstimate,
                risk_factors: mockAssessment.riskFactors,
                protective_factors: mockAssessment.protectiveFactors,
                patient_age: mockAssessment.patientAge,
                age_risk_category: mockAssessment.ageRiskCategory,
                category_scores: mockAssessment.categoryScores,
                interventions: mockAssessment.interventions,
                precautions: mockAssessment.precautions,
                monitoring_frequency: mockAssessment.monitoringFrequency,
                confidence: mockAssessment.confidence,
                requires_review: mockAssessment.requiresReview,
                review_reasons: mockAssessment.reviewReasons,
                plain_language_explanation: mockAssessment.plainLanguageExplanation,
                status: 'pending_review',
                created_at: '2025-12-23T10:00:00Z',
                updated_at: '2025-12-23T10:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.saveAssessment(mockAssessment);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending_review');
        expect(result.data.id).toBe('db-id-123');
      }
    });

    it('should handle save error', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.saveAssessment(mockAssessment);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FALL_RISK_SAVE_FAILED');
      }
    });
  });

  describe('approveAssessment', () => {
    it('should approve a pending review assessment', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'db-id-123',
                    assessment_id: 'assessment-123',
                    patient_id: 'patient-456',
                    assessor_id: 'provider-789',
                    status: 'approved',
                    reviewed_by: 'reviewer-001',
                    reviewed_at: '2025-12-23T11:00:00Z',
                    review_notes: 'Approved after verification',
                    overall_risk_score: mockAssessment.overallRiskScore,
                    risk_category: mockAssessment.riskCategory,
                    morse_scale_estimate: mockAssessment.morseScaleEstimate,
                    risk_factors: mockAssessment.riskFactors,
                    protective_factors: mockAssessment.protectiveFactors,
                    patient_age: mockAssessment.patientAge,
                    age_risk_category: mockAssessment.ageRiskCategory,
                    category_scores: mockAssessment.categoryScores,
                    interventions: mockAssessment.interventions,
                    precautions: mockAssessment.precautions,
                    monitoring_frequency: mockAssessment.monitoringFrequency,
                    confidence: mockAssessment.confidence,
                    requires_review: true,
                    review_reasons: [],
                    plain_language_explanation: mockAssessment.plainLanguageExplanation,
                    assessment_date: mockAssessment.assessmentDate,
                    assessment_context: mockAssessment.assessmentContext,
                    created_at: '2025-12-23T10:00:00Z',
                    updated_at: '2025-12-23T11:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.approveAssessment(
        'assessment-123',
        'reviewer-001',
        'Approved after verification'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('approved');
        expect(result.data.reviewedBy).toBe('reviewer-001');
      }
    });
  });

  describe('getPatientAssessments', () => {
    it('should fetch patient assessment history', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'db-id-123',
                  assessment_id: 'assessment-123',
                  patient_id: 'patient-456',
                  assessor_id: 'provider-789',
                  status: 'approved',
                  overall_risk_score: mockAssessment.overallRiskScore,
                  risk_category: mockAssessment.riskCategory,
                  morse_scale_estimate: mockAssessment.morseScaleEstimate,
                  risk_factors: mockAssessment.riskFactors,
                  protective_factors: mockAssessment.protectiveFactors,
                  patient_age: mockAssessment.patientAge,
                  age_risk_category: mockAssessment.ageRiskCategory,
                  category_scores: mockAssessment.categoryScores,
                  interventions: mockAssessment.interventions,
                  precautions: mockAssessment.precautions,
                  monitoring_frequency: mockAssessment.monitoringFrequency,
                  confidence: mockAssessment.confidence,
                  requires_review: true,
                  review_reasons: [],
                  plain_language_explanation: mockAssessment.plainLanguageExplanation,
                  assessment_date: mockAssessment.assessmentDate,
                  assessment_context: mockAssessment.assessmentContext,
                  created_at: '2025-12-23T10:00:00Z',
                  updated_at: '2025-12-23T11:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.getPatientAssessments('patient-456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].assessmentId).toBe('assessment-123');
      }
    });
  });

  describe('formatForClinicalDisplay', () => {
    it('should format assessment for clinical documentation', () => {
      const formatted = service.formatForClinicalDisplay(mockAssessment);

      expect(formatted).toContain('FALL RISK ASSESSMENT');
      expect(formatted).toContain('RISK SUMMARY');
      expect(formatted).toContain('Overall Risk Score: 65/100');
      expect(formatted).toContain('Risk Category: HIGH');
      expect(formatted).toContain('Morse Scale Estimate: 75/125');
      expect(formatted).toContain('RISK FACTORS');
      expect(formatted).toContain('Age 78 years');
      expect(formatted).toContain('RECOMMENDED INTERVENTIONS');
      expect(formatted).toContain('FALL PRECAUTIONS');
      expect(formatted).toContain('Yellow fall risk wristband');
      expect(formatted).toContain('AI-GENERATED - REQUIRES CLINICAL REVIEW');
    });

    it('should include plain language explanation', () => {
      const formatted = service.formatForClinicalDisplay(mockAssessment);

      expect(formatted).toContain('PATIENT/FAMILY EXPLANATION');
      expect(formatted).toContain('risk of falling is higher than average');
    });

    it('should include category scores', () => {
      const formatted = service.formatForClinicalDisplay(mockAssessment);

      expect(formatted).toContain('CATEGORY SCORES');
      expect(formatted).toContain('Age: 80/100');
      expect(formatted).toContain('Fall History: 75/100');
    });
  });

  describe('getRiskLevelColor', () => {
    it('should return red for very high risk', () => {
      const colors = service.getRiskLevelColor('very_high');
      expect(colors.bg).toBe('bg-red-100');
      expect(colors.text).toBe('text-red-800');
    });

    it('should return orange for high risk', () => {
      const colors = service.getRiskLevelColor('high');
      expect(colors.bg).toBe('bg-orange-100');
      expect(colors.text).toBe('text-orange-800');
    });

    it('should return yellow for moderate risk', () => {
      const colors = service.getRiskLevelColor('moderate');
      expect(colors.bg).toBe('bg-yellow-100');
      expect(colors.text).toBe('text-yellow-800');
    });

    it('should return green for low risk', () => {
      const colors = service.getRiskLevelColor('low');
      expect(colors.bg).toBe('bg-green-100');
      expect(colors.text).toBe('text-green-800');
    });
  });
});
