/**
 * Tests for Medication Reconciliation AI Service
 * Skill #26 - AI-enhanced medication reconciliation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicationReconciliationAIService } from '../medicationReconciliationAIService';
import type {
  MedicationReconciliationRequest,
  MedicationReconciliationResponse,
  MedicationReconciliationAIResult,
  MedicationSource,
  SavedReconciliation,
} from '../medicationReconciliationAIService';

// Mock supabase client
const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('MedicationReconciliationAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test Data
  // ─────────────────────────────────────────────────────────────────────────

  const mockMedications: MedicationSource = {
    admission: [
      { name: 'Metformin', dosage: '500mg', frequency: 'BID', indication: 'Type 2 Diabetes' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Daily', indication: 'Hypertension' },
    ],
    prescribed: [
      { name: 'Metformin', dosage: '1000mg', frequency: 'BID', indication: 'Type 2 Diabetes' },
    ],
    current: [
      { name: 'Metformin', dosage: '500mg', frequency: 'BID' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Daily' },
      { name: 'Aspirin', dosage: '81mg', frequency: 'Daily' },
    ],
    discharge: [
      { name: 'Metformin', dosage: '1000mg', frequency: 'BID' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Daily' },
    ],
  };

  const mockRequest: MedicationReconciliationRequest = {
    patientId: 'patient-uuid-123',
    providerId: 'provider-uuid-456',
    medications: mockMedications,
    allergies: ['Penicillin', 'Sulfa'],
    activeConditions: [
      { code: 'E11.9', display: 'Type 2 Diabetes' },
      { code: 'I10', display: 'Essential Hypertension' },
    ],
    labValues: {
      creatinine: 1.2,
      eGFR: 65,
    },
    patientAge: 68,
    encounterType: 'discharge',
    tenantId: 'tenant-uuid-789',
  };

  const mockAIResult: MedicationReconciliationAIResult = {
    reconciliationSummary: {
      continued: [{ name: 'Lisinopril', dosage: '10mg', frequency: 'Daily' }],
      new: [],
      changed: [{ medication: 'Metformin', changeType: 'dose_change', from: '500mg', to: '1000mg' }],
      discontinued: [{ name: 'Aspirin', dosage: '81mg' }],
      allergiesConsidered: ['Penicillin', 'Sulfa'],
      interactionsIdentified: [],
    },
    discrepancyAnalysis: [
      {
        medication: 'Metformin',
        discrepancyType: 'dose_change',
        likelyReason: 'Inadequate glycemic control requiring dose escalation',
        clinicalSignificance: 'medium',
        recommendation: 'Verify patient understands new dosing',
        requiresPharmacistReview: false,
        confidence: 0.85,
      },
      {
        medication: 'Aspirin',
        discrepancyType: 'discontinued',
        likelyReason: 'Patient reports GI intolerance',
        clinicalSignificance: 'low',
        recommendation: 'Document reason in chart',
        requiresPharmacistReview: false,
        confidence: 0.75,
      },
    ],
    deprescribingCandidates: [],
    patientCounseling: [
      {
        topic: 'Metformin Dose Increase',
        keyPoints: ['Take with meals to reduce GI upset', 'Monitor blood glucose levels'],
        relatedMedications: ['Metformin'],
        warningSignsToWatch: ['Nausea', 'Diarrhea', 'Hypoglycemia symptoms'],
      },
    ],
    pharmacyChecklist: [
      'Verify Metformin dose change from 500mg to 1000mg BID',
      'Confirm Aspirin discontinuation documented',
    ],
    actionItems: [
      {
        priority: 'high',
        action: 'Educate patient on Metformin dose increase',
        rationale: 'Ensure adherence and understanding of change',
      },
    ],
    statistics: {
      totalMedicationsReviewed: 4,
      continued: 1,
      new: 0,
      changed: 1,
      discontinued: 1,
      discrepanciesFound: 2,
      deprescribingOpportunities: 0,
    },
    confidence: 0.82,
    requiresReview: true,
    reviewReasons: ['All medication reconciliations require clinician review'],
    pharmacistReviewRequired: false,
    narrativeSummary:
      'Medication reconciliation for discharge encounter. Metformin increased from 500mg to 1000mg BID for improved glycemic control. Aspirin discontinued due to patient-reported GI intolerance. No drug interactions identified.',
  };

  const mockResponse: MedicationReconciliationResponse = {
    result: mockAIResult,
    metadata: {
      generatedAt: '2025-12-23T19:00:00.000Z',
      model: 'claude-sonnet-4-20250514',
      responseTimeMs: 2500,
      encounterType: 'discharge',
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // performReconciliation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('performReconciliation', () => {
    it('should successfully perform medication reconciliation', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const result = await MedicationReconciliationAIService.performReconciliation(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.reconciliationSummary.changed.length).toBe(1);
        expect(result.data.result.discrepancyAnalysis.length).toBe(2);
        expect(result.data.result.requiresReview).toBe(true);
      }

      expect(mockInvoke).toHaveBeenCalledWith('ai-medication-reconciliation', {
        body: expect.objectContaining({
          patientId: 'patient-uuid-123',
          providerId: 'provider-uuid-456',
          encounterType: 'discharge',
        }),
      });
    });

    it('should fail when patientId is missing', async () => {
      const invalidRequest = { ...mockRequest, patientId: '' };

      const result = await MedicationReconciliationAIService.performReconciliation(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Patient ID is required');
      }
    });

    it('should fail when providerId is missing', async () => {
      const invalidRequest = { ...mockRequest, providerId: '' };

      const result = await MedicationReconciliationAIService.performReconciliation(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Provider ID is required');
      }
    });

    it('should fail when medications are missing', async () => {
      const invalidRequest = { ...mockRequest, medications: undefined as unknown as MedicationSource };

      const result = await MedicationReconciliationAIService.performReconciliation(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Medication sources are required');
      }
    });

    it('should fail when all medication lists are empty', async () => {
      const emptyMeds: MedicationSource = {
        admission: [],
        prescribed: [],
        current: [],
      };
      const invalidRequest = { ...mockRequest, medications: emptyMeds };

      const result = await MedicationReconciliationAIService.performReconciliation(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('At least one medication list is required');
      }
    });

    it('should handle edge function errors gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Service unavailable') });

      const result = await MedicationReconciliationAIService.performReconciliation(mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MEDICATION_RECONCILIATION_FAILED');
      }
    });

    it('should apply safety guardrails for multiple discrepancies', async () => {
      const manyDiscrepancies: MedicationReconciliationAIResult = {
        ...mockAIResult,
        discrepancyAnalysis: [
          { ...mockAIResult.discrepancyAnalysis[0] },
          { ...mockAIResult.discrepancyAnalysis[1] },
          {
            medication: 'NewMed',
            discrepancyType: 'new',
            likelyReason: 'Reason',
            clinicalSignificance: 'medium',
            recommendation: 'Review',
            requiresPharmacistReview: false,
            confidence: 0.8,
          },
        ],
        pharmacistReviewRequired: false,
      };

      mockInvoke.mockResolvedValueOnce({
        data: { result: manyDiscrepancies, metadata: mockResponse.metadata },
        error: null,
      });

      const result = await MedicationReconciliationAIService.performReconciliation(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        // Safety guardrails should set pharmacistReviewRequired for 3+ discrepancies
        expect(result.data.result.pharmacistReviewRequired).toBe(true);
        expect(result.data.result.reviewReasons).toContain(
          'Multiple discrepancies require pharmacist review'
        );
      }
    });

    it('should apply safety guardrails for critical discrepancies', async () => {
      const criticalDiscrepancy: MedicationReconciliationAIResult = {
        ...mockAIResult,
        discrepancyAnalysis: [
          {
            medication: 'Warfarin',
            discrepancyType: 'missing',
            likelyReason: 'Not transferred from previous record',
            clinicalSignificance: 'critical',
            recommendation: 'Immediate verification required',
            requiresPharmacistReview: true,
            confidence: 0.9,
          },
        ],
        pharmacistReviewRequired: false,
      };

      mockInvoke.mockResolvedValueOnce({
        data: { result: criticalDiscrepancy, metadata: mockResponse.metadata },
        error: null,
      });

      const result = await MedicationReconciliationAIService.performReconciliation(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.pharmacistReviewRequired).toBe(true);
        expect(result.data.result.reviewReasons).toContain(
          'Critical discrepancy detected - immediate review required'
        );
      }
    });

    it('should apply safety guardrails for deprescribing opportunities', async () => {
      const withDeprescribing: MedicationReconciliationAIResult = {
        ...mockAIResult,
        deprescribingCandidates: [
          {
            medication: 'Omeprazole',
            reason: 'Long-term PPI use without clear indication',
            evidence: 'AGA Guidelines recommend periodic reassessment',
            riskIfContinued: 'Increased fracture risk, C. diff infection',
            suggestedApproach: 'Gradual taper over 4 weeks',
            priority: 'medium',
          },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: { result: withDeprescribing, metadata: mockResponse.metadata },
        error: null,
      });

      const result = await MedicationReconciliationAIService.performReconciliation(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.reviewReasons).toContain(
          'Deprescribing opportunities identified - physician review required'
        );
      }
    });

    it('should apply safety guardrails for low confidence results', async () => {
      const lowConfidence: MedicationReconciliationAIResult = {
        ...mockAIResult,
        confidence: 0.5,
      };

      mockInvoke.mockResolvedValueOnce({
        data: { result: lowConfidence, metadata: mockResponse.metadata },
        error: null,
      });

      const result = await MedicationReconciliationAIService.performReconciliation(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.reviewReasons).toContain(
          'Low confidence - careful clinical review recommended'
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // saveReconciliation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('saveReconciliation', () => {
    const mockSavedRecord = {
      id: 'saved-uuid-123',
      reconciliation_id: 'reconciliation-uuid-456',
      patient_id: 'patient-uuid-123',
      provider_id: 'provider-uuid-456',
      encounter_type: 'discharge',
      medication_sources: mockMedications,
      result: mockAIResult,
      status: 'pending_review',
      created_at: '2025-12-23T19:00:00.000Z',
      updated_at: '2025-12-23T19:00:00.000Z',
    };

    it('should successfully save a reconciliation', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSavedRecord, error: null }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert: mockInsert });

      const result = await MedicationReconciliationAIService.saveReconciliation(
        mockRequest,
        mockResponse
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('saved-uuid-123');
        expect(result.data.status).toBe('pending_review');
      }
    });

    it('should handle save errors gracefully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert: mockInsert });

      const result = await MedicationReconciliationAIService.saveReconciliation(
        mockRequest,
        mockResponse
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RECONCILIATION_SAVE_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // recordReviewDecision Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('recordReviewDecision', () => {
    const mockUpdatedRecord = {
      id: 'saved-uuid-123',
      reconciliation_id: 'reconciliation-uuid-456',
      patient_id: 'patient-uuid-123',
      provider_id: 'provider-uuid-456',
      encounter_type: 'discharge',
      medication_sources: mockMedications,
      result: mockAIResult,
      status: 'approved',
      reviewed_by: 'reviewer-uuid-789',
      reviewed_at: '2025-12-23T20:00:00.000Z',
      review_notes: 'Verified changes are appropriate',
      created_at: '2025-12-23T19:00:00.000Z',
      updated_at: '2025-12-23T20:00:00.000Z',
    };

    it('should successfully record an approval decision', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedRecord, error: null }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await MedicationReconciliationAIService.recordReviewDecision(
        'saved-uuid-123',
        'reviewer-uuid-789',
        'approved',
        'Verified changes are appropriate'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('approved');
        expect(result.data.reviewedBy).toBe('reviewer-uuid-789');
      }
    });

    it('should successfully record a rejection decision', async () => {
      const rejectedRecord = { ...mockUpdatedRecord, status: 'rejected' };
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: rejectedRecord, error: null }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await MedicationReconciliationAIService.recordReviewDecision(
        'saved-uuid-123',
        'reviewer-uuid-789',
        'rejected',
        'Needs manual review'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('rejected');
      }
    });

    it('should handle review errors gracefully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Record not found'),
            }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await MedicationReconciliationAIService.recordReviewDecision(
        'invalid-uuid',
        'reviewer-uuid-789',
        'approved'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RECONCILIATION_REVIEW_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPatientHistory Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPatientHistory', () => {
    const mockHistoryRecords = [
      {
        id: 'record-1',
        reconciliation_id: 'recon-1',
        patient_id: 'patient-uuid-123',
        provider_id: 'provider-uuid-456',
        encounter_type: 'discharge',
        medication_sources: mockMedications,
        result: mockAIResult,
        status: 'approved',
        created_at: '2025-12-23T19:00:00.000Z',
        updated_at: '2025-12-23T20:00:00.000Z',
      },
      {
        id: 'record-2',
        reconciliation_id: 'recon-2',
        patient_id: 'patient-uuid-123',
        provider_id: 'provider-uuid-456',
        encounter_type: 'admission',
        medication_sources: mockMedications,
        result: mockAIResult,
        status: 'pending_review',
        created_at: '2025-12-22T10:00:00.000Z',
        updated_at: '2025-12-22T10:00:00.000Z',
      },
    ];

    it('should successfully fetch patient reconciliation history', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({ data: mockHistoryRecords, error: null });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await MedicationReconciliationAIService.getPatientHistory('patient-uuid-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].id).toBe('record-1');
        expect(result.data[1].encounterType).toBe('admission');
      }
    });

    it('should respect the limit parameter', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({ data: [mockHistoryRecords[0]], error: null });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await MedicationReconciliationAIService.getPatientHistory(
        'patient-uuid-123',
        1
      );

      expect(result.success).toBe(true);
      expect(mockLimitFn).toHaveBeenCalledWith(1);
    });

    it('should handle empty history gracefully', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await MedicationReconciliationAIService.getPatientHistory('patient-uuid-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });

    it('should handle fetch errors gracefully', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await MedicationReconciliationAIService.getPatientHistory('patient-uuid-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('HISTORY_FETCH_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // formatForPrint Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatForPrint', () => {
    it('should format reconciliation result for printing', () => {
      const output = MedicationReconciliationAIService.formatForPrint(mockAIResult, 'John Doe');

      expect(output).toContain('MEDICATION RECONCILIATION SUMMARY');
      expect(output).toContain('Patient: John Doe');
      expect(output).toContain('CONTINUED (1)');
      expect(output).toContain('Lisinopril');
      expect(output).toContain('CHANGED (1)');
      expect(output).toContain('Metformin');
      expect(output).toContain('500mg → 1000mg');
      expect(output).toContain('DISCONTINUED (1)');
      expect(output).toContain('Aspirin');
      expect(output).toContain('DISCREPANCIES REQUIRING ATTENTION');
      expect(output).toContain('ACTION ITEMS');
      expect(output).toContain('requires clinician review');
    });

    it('should include deprescribing opportunities when present', () => {
      const withDeprescribing: MedicationReconciliationAIResult = {
        ...mockAIResult,
        deprescribingCandidates: [
          {
            medication: 'Omeprazole',
            reason: 'Long-term use without clear indication',
            evidence: 'AGA Guidelines',
            riskIfContinued: 'Increased fracture risk',
            suggestedApproach: 'Gradual taper',
            priority: 'medium',
          },
        ],
      };

      const output = MedicationReconciliationAIService.formatForPrint(withDeprescribing, 'Jane Doe');

      expect(output).toContain('DEPRESCRIBING OPPORTUNITIES');
      expect(output).toContain('Omeprazole');
      expect(output).toContain('Long-term use without clear indication');
    });

    it('should handle empty medication lists gracefully', () => {
      const emptyResult: MedicationReconciliationAIResult = {
        ...mockAIResult,
        reconciliationSummary: {
          continued: [],
          new: [],
          changed: [],
          discontinued: [],
          allergiesConsidered: [],
          interactionsIdentified: [],
        },
        discrepancyAnalysis: [],
        deprescribingCandidates: [],
        actionItems: [],
      };

      const output = MedicationReconciliationAIService.formatForPrint(emptyResult, 'Empty Patient');

      expect(output).toContain('CONTINUED (0)');
      expect(output).toContain('NEW (0)');
      expect(output).toContain('CHANGED (0)');
      expect(output).toContain('DISCONTINUED (0)');
      expect(output).not.toContain('DISCREPANCIES REQUIRING ATTENTION');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle whitespace-only patient ID', async () => {
      const result = await MedicationReconciliationAIService.performReconciliation({
        ...mockRequest,
        patientId: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should handle whitespace-only provider ID', async () => {
      const result = await MedicationReconciliationAIService.performReconciliation({
        ...mockRequest,
        providerId: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should use default encounter type when not provided', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const requestWithoutEncounterType = {
        patientId: 'patient-uuid',
        providerId: 'provider-uuid',
        medications: mockMedications,
      };

      await MedicationReconciliationAIService.performReconciliation(requestWithoutEncounterType);

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-medication-reconciliation',
        expect.objectContaining({
          body: expect.objectContaining({
            encounterType: 'ambulatory',
          }),
        })
      );
    });

    it('should handle missing optional fields gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const minimalRequest: MedicationReconciliationRequest = {
        patientId: 'patient-uuid',
        providerId: 'provider-uuid',
        medications: {
          admission: [{ name: 'TestMed' }],
          prescribed: [],
          current: [],
        },
      };

      const result = await MedicationReconciliationAIService.performReconciliation(minimalRequest);

      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-medication-reconciliation',
        expect.objectContaining({
          body: expect.objectContaining({
            allergies: [],
            activeConditions: [],
          }),
        })
      );
    });
  });
});
