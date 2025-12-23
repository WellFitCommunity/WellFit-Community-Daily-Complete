/**
 * Contraindication Detector Service Tests
 *
 * Tests for AI-powered contraindication detection (Skill #25).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockIlike = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Configure mock chain
mockFrom.mockReturnValue({
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
});

mockInsert.mockReturnValue({
  select: mockSelect,
});

mockUpdate.mockReturnValue({
  eq: mockEq,
});

mockSelect.mockReturnValue({
  single: mockSingle,
  eq: mockEq,
  ilike: mockIlike,
});

mockEq.mockReturnValue({
  select: mockSelect,
  eq: mockEq,
  ilike: mockIlike,
  single: mockSingle,
});

mockIlike.mockReturnValue({
  data: [],
  error: null,
});

mockSingle.mockReturnValue({
  data: null,
  error: null,
});

import {
  ContraindicationDetectorService,
  type ContraindicationCheckResponse,
  type ContraindicationCheckResult,
  type ContraindicationFinding,
} from '../contraindicationDetectorService';

describe('ContraindicationDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockFinding: ContraindicationFinding = {
    type: 'disease_contraindication',
    severity: 'high',
    title: 'NSAID use with renal impairment',
    description: 'NSAIDs are contraindicated in patients with significant renal impairment.',
    clinicalReasoning:
      'Patient has eGFR of 25 mL/min/1.73m², indicating severe renal impairment. NSAIDs can further reduce renal blood flow.',
    triggerFactor: 'eGFR < 30 mL/min/1.73m²',
    recommendations: [
      'Consider acetaminophen for pain management',
      'If NSAID absolutely required, use lowest dose for shortest duration',
      'Monitor renal function closely',
    ],
    alternatives: ['Acetaminophen', 'Tramadol (with dose adjustment)', 'Topical NSAIDs'],
    confidence: 0.92,
    source: 'ai_analysis',
  };

  const mockCheckResult: ContraindicationCheckResult = {
    overallAssessment: 'warning',
    requiresClinicalReview: true,
    reviewReasons: ['High-severity finding detected', 'Renal impairment requires dose adjustment consideration'],
    findings: [mockFinding],
    findingsSummary: {
      contraindicated: 0,
      high: 1,
      moderate: 0,
      low: 0,
      total: 1,
    },
    patientContext: {
      demographics: { age: 72, sex: 'male' },
      activeConditions: [{ code: 'N18.4', display: 'Chronic kidney disease, stage 4' }],
      activeMedications: [{ name: 'Lisinopril', dosage: '10mg daily' }],
      allergies: [],
      labValues: { eGFR: 25, creatinine: 2.8 },
    },
    confidence: 0.88,
    clinicalSummary:
      'The proposed NSAID is relatively contraindicated due to significant renal impairment. Consider alternative pain management.',
  };

  const mockCheckResponse: ContraindicationCheckResponse = {
    result: mockCheckResult,
    medication: {
      rxcui: '197807',
      name: 'Ibuprofen 400mg',
      proposedDosage: '400mg TID',
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4-20250514',
      responseTimeMs: 850,
      checksPerformed: [
        'disease_contraindication',
        'allergy_cross_reactivity',
        'lab_value_check',
        'age_contraindication',
        'drug_drug_interaction',
      ],
    },
  };

  describe('checkContraindications', () => {
    it('should perform comprehensive contraindication check', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockCheckResponse, error: null });

      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: 'provider-456',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen 400mg',
        proposedDosage: '400mg TID',
      });

      expect(result.success).toBe(true);
      expect(result.data?.result.overallAssessment).toBe('warning');
      expect(result.data?.result.findings.length).toBe(1);
      expect(result.data?.result.requiresClinicalReview).toBe(true);
    });

    it('should call edge function with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockCheckResponse, error: null });

      await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: 'provider-456',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen',
        indication: 'Chronic pain',
        proposedDosage: '400mg TID',
        includeDrugInteractions: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith('ai-contraindication-detector', {
        body: {
          patientId: 'patient-123',
          providerId: 'provider-456',
          medicationRxcui: '197807',
          medicationName: 'Ibuprofen',
          indication: 'Chronic pain',
          proposedDosage: '400mg TID',
          includeDrugInteractions: true,
          tenantId: undefined,
        },
      });
    });

    it('should return validation error for missing patient ID', async () => {
      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: '',
        providerId: 'provider-456',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Patient ID');
    });

    it('should return validation error for missing provider ID', async () => {
      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: '',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Provider ID');
    });

    it('should return validation error for missing medication info', async () => {
      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: 'provider-456',
        medicationRxcui: '',
        medicationName: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Medication');
    });

    it('should return failure on edge function error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Service unavailable'),
      });

      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: 'provider-456',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONTRAINDICATION_CHECK_FAILED');
    });

    it('should apply safety guardrails for contraindicated findings', async () => {
      const contraindicatedResponse = {
        ...mockCheckResponse,
        result: {
          ...mockCheckResult,
          overallAssessment: 'contraindicated' as const,
          requiresClinicalReview: false, // AI might return false
          reviewReasons: [],
          findings: [
            {
              ...mockFinding,
              severity: 'contraindicated' as const,
            },
          ],
        },
      };
      mockInvoke.mockResolvedValueOnce({ data: contraindicatedResponse, error: null });

      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: 'provider-456',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen',
      });

      expect(result.success).toBe(true);
      // Safety guardrail should override AI response
      expect(result.data?.result.requiresClinicalReview).toBe(true);
      expect(result.data?.result.reviewReasons.length).toBeGreaterThan(0);
    });

    it('should require review for low confidence results', async () => {
      const lowConfidenceResponse = {
        ...mockCheckResponse,
        result: {
          ...mockCheckResult,
          confidence: 0.5,
          requiresClinicalReview: false,
          reviewReasons: [],
        },
      };
      mockInvoke.mockResolvedValueOnce({ data: lowConfidenceResponse, error: null });

      const result = await ContraindicationDetectorService.checkContraindications({
        patientId: 'patient-123',
        providerId: 'provider-456',
        medicationRxcui: '197807',
        medicationName: 'Ibuprofen',
      });

      expect(result.success).toBe(true);
      expect(result.data?.result.requiresClinicalReview).toBe(true);
    });
  });

  describe('quickCheck', () => {
    it('should detect allergy match', async () => {
      const mockAllergyChain = {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockResolvedValue({
              data: [{ allergen_name: 'Ibuprofen', criticality: 'high', severity: 'severe' }],
              error: null,
            }),
          }),
        }),
      };
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue(mockAllergyChain),
      });

      const result = await ContraindicationDetectorService.quickCheck('patient-123', 'Ibuprofen');

      expect(result.success).toBe(true);
      expect(result.data?.hasCriticalContraindications).toBe(true);
      expect(result.data?.summary).toContain('ALLERGY ALERT');
    });

    it('should return safe when no allergies match', async () => {
      const mockAllergyChain = {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue(mockAllergyChain),
      });

      const result = await ContraindicationDetectorService.quickCheck('patient-123', 'Acetaminophen');

      expect(result.success).toBe(true);
      expect(result.data?.hasCriticalContraindications).toBe(false);
    });
  });

  describe('saveCheckResult', () => {
    it('should save check result to database', async () => {
      const mockSavedRecord = {
        id: 'check-789',
        patient_id: 'patient-123',
        provider_id: 'provider-456',
        medication_rxcui: '197807',
        medication_name: 'Ibuprofen 400mg',
        overall_assessment: 'warning',
        requires_clinical_review: true,
        findings: [mockFinding],
        patient_context: mockCheckResult.patientContext,
        confidence: 0.88,
        clinical_summary: mockCheckResult.clinicalSummary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValueOnce({ data: mockSavedRecord, error: null });

      const result = await ContraindicationDetectorService.saveCheckResult(
        'patient-123',
        'provider-456',
        mockCheckResponse
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('check-789');
      expect(result.data?.overallAssessment).toBe('warning');
    });

    it('should return failure on database error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await ContraindicationDetectorService.saveCheckResult(
        'patient-123',
        'provider-456',
        mockCheckResponse
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONTRAINDICATION_SAVE_FAILED');
    });
  });

  describe('recordReviewDecision', () => {
    it('should record approval decision', async () => {
      const mockApprovedRecord = {
        id: 'check-789',
        patient_id: 'patient-123',
        provider_id: 'provider-456',
        medication_rxcui: '197807',
        medication_name: 'Ibuprofen 400mg',
        overall_assessment: 'warning',
        requires_clinical_review: true,
        findings: [mockFinding],
        patient_context: mockCheckResult.patientContext,
        confidence: 0.88,
        clinical_summary: mockCheckResult.clinicalSummary,
        reviewed_by: 'reviewer-001',
        reviewed_at: new Date().toISOString(),
        review_decision: 'approved',
        review_notes: 'Benefits outweigh risks for this patient',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValueOnce({ data: mockApprovedRecord, error: null });

      const result = await ContraindicationDetectorService.recordReviewDecision(
        'check-789',
        'reviewer-001',
        'approved',
        'Benefits outweigh risks for this patient'
      );

      expect(result.success).toBe(true);
      expect(result.data?.reviewDecision).toBe('approved');
      expect(result.data?.reviewedBy).toBe('reviewer-001');
    });

    it('should record rejection decision', async () => {
      const mockRejectedRecord = {
        id: 'check-789',
        patient_id: 'patient-123',
        provider_id: 'provider-456',
        medication_rxcui: '197807',
        medication_name: 'Ibuprofen 400mg',
        overall_assessment: 'contraindicated',
        requires_clinical_review: true,
        findings: [{ ...mockFinding, severity: 'contraindicated' }],
        patient_context: mockCheckResult.patientContext,
        confidence: 0.95,
        clinical_summary: 'Absolute contraindication',
        reviewed_by: 'reviewer-001',
        reviewed_at: new Date().toISOString(),
        review_decision: 'rejected',
        review_notes: 'Risk too high - using alternative',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValueOnce({ data: mockRejectedRecord, error: null });

      const result = await ContraindicationDetectorService.recordReviewDecision(
        'check-789',
        'reviewer-001',
        'rejected',
        'Risk too high - using alternative'
      );

      expect(result.success).toBe(true);
      expect(result.data?.reviewDecision).toBe('rejected');
    });
  });

  describe('getPatientCheckHistory', () => {
    it('should fetch patient check history', async () => {
      const mockHistory = [
        {
          id: 'check-1',
          patient_id: 'patient-123',
          provider_id: 'provider-456',
          medication_rxcui: '197807',
          medication_name: 'Ibuprofen',
          overall_assessment: 'warning',
          requires_clinical_review: true,
          findings: [],
          patient_context: {},
          confidence: 0.85,
          clinical_summary: 'Check 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'check-2',
          patient_id: 'patient-123',
          provider_id: 'provider-456',
          medication_rxcui: '310965',
          medication_name: 'Metformin',
          overall_assessment: 'safe',
          requires_clinical_review: false,
          findings: [],
          patient_context: {},
          confidence: 0.92,
          clinical_summary: 'Check 2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockOrderFn = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: mockHistory, error: null }),
      });
      const mockEqFn = vi.fn().mockReturnValue({
        order: mockOrderFn,
      });
      const mockSelectFn = vi.fn().mockReturnValue({
        eq: mockEqFn,
      });
      mockFrom.mockReturnValueOnce({
        select: mockSelectFn,
      });

      const result = await ContraindicationDetectorService.getPatientCheckHistory('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  describe('utility methods', () => {
    it('should return correct severity colors', () => {
      expect(ContraindicationDetectorService.getSeverityColor('contraindicated')).toBe('#DC2626');
      expect(ContraindicationDetectorService.getSeverityColor('high')).toBe('#EA580C');
      expect(ContraindicationDetectorService.getSeverityColor('moderate')).toBe('#F59E0B');
      expect(ContraindicationDetectorService.getSeverityColor('low')).toBe('#10B981');
    });

    it('should return correct severity icons', () => {
      expect(ContraindicationDetectorService.getSeverityIcon('contraindicated')).toBe('🛑');
      expect(ContraindicationDetectorService.getSeverityIcon('high')).toBe('⚠️');
      expect(ContraindicationDetectorService.getSeverityIcon('moderate')).toBe('⚡');
      expect(ContraindicationDetectorService.getSeverityIcon('low')).toBe('ℹ️');
    });
  });
});
