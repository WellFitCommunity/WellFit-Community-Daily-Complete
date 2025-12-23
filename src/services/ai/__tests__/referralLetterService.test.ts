/**
 * Referral Letter Generator Service Tests
 *
 * Tests for AI-powered referral letter generation (Skill #22).
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
const mockLimit = vi.fn();
const mockOrder = vi.fn();

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
  order: mockOrder,
  limit: mockLimit,
});

mockEq.mockReturnValue({
  select: mockSelect,
  eq: mockEq,
});

mockOrder.mockReturnValue({
  limit: mockLimit,
});

mockLimit.mockReturnValue({
  data: [],
  error: null,
});

mockSingle.mockReturnValue({
  data: null,
  error: null,
});

import { ReferralLetterService } from '../referralLetterService';
import type { ReferralLetterResponse, ReferralLetter } from '../referralLetterService';

describe('ReferralLetterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReferralLetter: ReferralLetter = {
    letterDate: '2025-12-23',
    referringProvider: {
      name: 'Dr. Jane Smith',
      credentials: 'MD, FACP',
      npi: '1234567890',
    },
    recipientProvider: {
      specialty: 'Cardiology',
    },
    patientName: 'John',
    patientDOB: '1955-03-15',
    mrn: 'MRN-12345',
    chiefComplaint: 'chest pain with exertion',
    relevantHistory: 'Hypertension for 10 years, hyperlipidemia, former smoker',
    currentMedications: ['Lisinopril 10mg daily', 'Atorvastatin 20mg daily'],
    allergies: ['Penicillin (rash)'],
    clinicalReason:
      'Patient reports new onset chest pain with moderate exertion over past 2 weeks. Would like evaluation for possible coronary artery disease.',
    specificQuestions: [
      'Would you recommend stress testing?',
      'Would coronary angiography be indicated?',
    ],
    expectedTimeline: 'Routine evaluation at patient convenience',
    contactInfo: 'Please contact our office at 555-123-4567',
    closingStatements:
      'Thank you for your consultation. Please do not hesitate to contact our office with any questions.',
    confidence: 0.85,
    requiresReview: true,
    reviewReasons: ['All referral letters require physician review before sending'],
  };

  const mockLetterResponse: ReferralLetterResponse = {
    letter: mockReferralLetter,
    formattedLetter: 'Date: 2025-12-23\n\nRE: John\nDOB: 1955-03-15\n...',
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-haiku-4-5-20250919',
      responseTimeMs: 350,
      specialty: 'Cardiology',
      patientContext: {
        conditionsCount: 2,
        medicationsCount: 2,
        allergiesCount: 1,
      },
    },
  };

  describe('generateReferralLetter', () => {
    it('should generate referral letter successfully', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockLetterResponse, error: null });

      const result = await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: 'provider-456',
        specialistSpecialty: 'Cardiology',
        clinicalReason: 'Chest pain evaluation',
      });

      expect(result.success).toBe(true);
      expect(result.data?.letter.recipientProvider.specialty).toBe('Cardiology');
      expect(result.data?.letter.requiresReview).toBe(true);
    });

    it('should call edge function with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockLetterResponse, error: null });

      await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: 'provider-456',
        specialistSpecialty: 'Orthopedics',
        clinicalReason: 'Knee pain evaluation',
        diagnoses: ['M17.11', 'M25.561'],
        medications: ['Ibuprofen 400mg TID'],
        allergies: ['Sulfa'],
        urgency: 'urgent',
      });

      expect(mockInvoke).toHaveBeenCalledWith('ai-referral-letter', {
        body: {
          patientId: 'patient-123',
          referringProviderId: 'provider-456',
          specialistSpecialty: 'Orthopedics',
          specialistProviderId: undefined,
          clinicalReason: 'Knee pain evaluation',
          clinicalNotes: undefined,
          diagnoses: ['M17.11', 'M25.561'],
          medications: ['Ibuprofen 400mg TID'],
          allergies: ['Sulfa'],
          insurancePayer: undefined,
          urgency: 'urgent',
          tenantId: undefined,
        },
      });
    });

    it('should return validation error for missing patient ID', async () => {
      const result = await ReferralLetterService.generateReferralLetter({
        patientId: '',
        referringProviderId: 'provider-456',
        specialistSpecialty: 'Cardiology',
        clinicalReason: 'Chest pain evaluation',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Patient ID');
    });

    it('should return validation error for missing provider ID', async () => {
      const result = await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: '',
        specialistSpecialty: 'Cardiology',
        clinicalReason: 'Chest pain evaluation',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('provider ID');
    });

    it('should return validation error for missing specialty', async () => {
      const result = await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: 'provider-456',
        specialistSpecialty: '',
        clinicalReason: 'Chest pain evaluation',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('specialty');
    });

    it('should return validation error for missing clinical reason', async () => {
      const result = await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: 'provider-456',
        specialistSpecialty: 'Cardiology',
        clinicalReason: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Clinical reason');
    });

    it('should return failure on edge function error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Service unavailable'),
      });

      const result = await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: 'provider-456',
        specialistSpecialty: 'Cardiology',
        clinicalReason: 'Chest pain evaluation',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REFERRAL_LETTER_GENERATION_FAILED');
    });

    it('should always require review (safety guardrail)', async () => {
      const letterWithLowConfidence = {
        ...mockLetterResponse,
        letter: {
          ...mockReferralLetter,
          confidence: 0.4,
          requiresReview: false, // AI might return false
          reviewReasons: [],
        },
      };
      mockInvoke.mockResolvedValueOnce({ data: letterWithLowConfidence, error: null });

      const result = await ReferralLetterService.generateReferralLetter({
        patientId: 'patient-123',
        referringProviderId: 'provider-456',
        specialistSpecialty: 'Cardiology',
        clinicalReason: 'Chest pain evaluation',
      });

      expect(result.success).toBe(true);
      // Safety guardrail should override AI response
      expect(result.data?.letter.requiresReview).toBe(true);
      expect(result.data?.letter.reviewReasons.length).toBeGreaterThan(0);
    });
  });

  describe('generateUrgentReferral', () => {
    it('should generate urgent referral with emergent urgency', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockLetterResponse, error: null });

      await ReferralLetterService.generateUrgentReferral(
        'patient-123',
        'provider-456',
        'Emergency Medicine',
        'Acute chest pain'
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-referral-letter',
        expect.objectContaining({
          body: expect.objectContaining({
            urgency: 'emergent',
            specialistSpecialty: 'Emergency Medicine',
          }),
        })
      );
    });
  });

  describe('saveReferralLetter', () => {
    it('should save generated letter to database', async () => {
      const mockSavedRecord = {
        id: 'letter-789',
        patient_id: 'patient-123',
        from_provider_id: 'provider-456',
        to_specialty: 'Cardiology',
        clinical_reason: mockReferralLetter.clinicalReason,
        generated_letter: mockReferralLetter,
        formatted_letter: mockLetterResponse.formattedLetter,
        status: 'draft',
        model_used: 'claude-haiku-4-5-20250919',
        confidence_score: 0.85,
        requires_review: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValueOnce({ data: mockSavedRecord, error: null });

      const result = await ReferralLetterService.saveReferralLetter(
        'patient-123',
        'provider-456',
        mockLetterResponse
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('letter-789');
      expect(result.data?.status).toBe('draft');
    });

    it('should return failure on database error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await ReferralLetterService.saveReferralLetter(
        'patient-123',
        'provider-456',
        mockLetterResponse
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REFERRAL_LETTER_SAVE_FAILED');
    });
  });

  describe('approveReferralLetter', () => {
    it('should approve letter and update status', async () => {
      const mockApprovedRecord = {
        id: 'letter-789',
        patient_id: 'patient-123',
        from_provider_id: 'provider-456',
        to_specialty: 'Cardiology',
        clinical_reason: mockReferralLetter.clinicalReason,
        generated_letter: mockReferralLetter,
        formatted_letter: mockLetterResponse.formattedLetter,
        status: 'approved',
        approved_by: 'approver-001',
        approved_at: new Date().toISOString(),
        model_used: 'claude-haiku-4-5-20250919',
        confidence_score: 0.85,
        requires_review: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValueOnce({ data: mockApprovedRecord, error: null });

      const result = await ReferralLetterService.approveReferralLetter(
        'letter-789',
        'approver-001'
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('approved');
      expect(result.data?.approvedBy).toBe('approver-001');
    });
  });

  describe('markAsSent', () => {
    it('should mark approved letter as sent', async () => {
      const mockSentRecord = {
        id: 'letter-789',
        patient_id: 'patient-123',
        from_provider_id: 'provider-456',
        to_specialty: 'Cardiology',
        clinical_reason: mockReferralLetter.clinicalReason,
        generated_letter: mockReferralLetter,
        formatted_letter: mockLetterResponse.formattedLetter,
        status: 'sent',
        sent_at: new Date().toISOString(),
        model_used: 'claude-haiku-4-5-20250919',
        confidence_score: 0.85,
        requires_review: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValueOnce({ data: mockSentRecord, error: null });

      const result = await ReferralLetterService.markAsSent('letter-789');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('sent');
    });
  });

  describe('getPatientReferralLetters', () => {
    it('should fetch patient referral letter history', async () => {
      const mockLetters = [
        {
          id: 'letter-1',
          patient_id: 'patient-123',
          from_provider_id: 'provider-456',
          to_specialty: 'Cardiology',
          clinical_reason: 'Chest pain',
          generated_letter: mockReferralLetter,
          formatted_letter: 'Letter 1',
          status: 'sent',
          model_used: 'claude-haiku-4-5-20250919',
          confidence_score: 0.85,
          requires_review: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'letter-2',
          patient_id: 'patient-123',
          from_provider_id: 'provider-456',
          to_specialty: 'Pulmonology',
          clinical_reason: 'Shortness of breath',
          generated_letter: mockReferralLetter,
          formatted_letter: 'Letter 2',
          status: 'draft',
          model_used: 'claude-haiku-4-5-20250919',
          confidence_score: 0.75,
          requires_review: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Setup full mock chain for this specific test
      const mockOrderFn = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: mockLetters, error: null }),
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

      const result = await ReferralLetterService.getPatientReferralLetters('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].toSpecialty).toBe('Cardiology');
    });

    it('should return empty array when no letters found', async () => {
      // Setup full mock chain for this specific test
      const mockOrderFn = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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

      const result = await ReferralLetterService.getPatientReferralLetters('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(0);
    });
  });

  describe('formatForPDF', () => {
    it('should format letter for PDF output', () => {
      const formatted = ReferralLetterService.formatForPDF(mockLetterResponse);

      expect(formatted).toContain('Dr. Jane Smith');
      expect(formatted).toContain('MD, FACP');
      expect(formatted).toContain('Date: 2025-12-23');
      expect(formatted).toContain('RE: John');
      expect(formatted).toContain('DOB: 1955-03-15');
      expect(formatted).toContain('Dear Colleague:');
      expect(formatted).toContain('chest pain with exertion');
      expect(formatted).toContain('CLINICAL REASON FOR REFERRAL:');
      expect(formatted).toContain('RELEVANT HISTORY:');
      expect(formatted).toContain('CURRENT MEDICATIONS:');
      expect(formatted).toContain('Lisinopril 10mg daily');
      expect(formatted).toContain('ALLERGIES:');
      expect(formatted).toContain('Penicillin (rash)');
      expect(formatted).toContain('SPECIFIC QUESTIONS');
      expect(formatted).toContain('Sincerely,');
    });

    it('should include specific questions numbered', () => {
      const formatted = ReferralLetterService.formatForPDF(mockLetterResponse);

      expect(formatted).toContain('1. Would you recommend stress testing?');
      expect(formatted).toContain('2. Would coronary angiography be indicated?');
    });

    it('should handle empty medications list', () => {
      const letterNoMeds = {
        ...mockLetterResponse,
        letter: {
          ...mockReferralLetter,
          currentMedications: [],
        },
      };

      const formatted = ReferralLetterService.formatForPDF(letterNoMeds);

      expect(formatted).not.toContain('CURRENT MEDICATIONS:');
    });

    it('should handle empty allergies list', () => {
      const letterNoAllergies = {
        ...mockLetterResponse,
        letter: {
          ...mockReferralLetter,
          allergies: [],
        },
      };

      const formatted = ReferralLetterService.formatForPDF(letterNoAllergies);

      expect(formatted).not.toContain('ALLERGIES:');
    });
  });
});
