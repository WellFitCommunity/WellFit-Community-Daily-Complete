/**
 * Patient Q&A Service Tests
 *
 * Tests for the AI-powered patient Q&A bot service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatientQAService } from '../patientQAService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }),
        })),
      })),
    })),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('PatientQAService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('askQuestion', () => {
    it('should successfully get an answer to a health question', async () => {
      const mockResponse = {
        answer: 'It is important to take your blood pressure medication at the same time every day...',
        readingLevel: '6th grade',
        confidence: 0.92,
        safetyCheck: {
          isEmergency: false,
          requiresProviderConsult: false,
          blockedTopics: [],
        },
        relatedTopics: ['medication adherence', 'blood pressure management'],
        sources: ['general health knowledge'],
        disclaimers: [
          'This information is for educational purposes only.',
          'Please consult your healthcare provider for personalized advice.',
        ],
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          response_time_ms: 800,
          language: 'English',
          had_patient_context: true,
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await PatientQAService.askQuestion({
        question: 'How should I take my blood pressure medication?',
        patientId: 'patient-123',
        language: 'English',
      });

      expect(result.success).toBe(true);
      expect(result.data?.answer).toContain('blood pressure medication');
      expect(result.data?.safetyCheck.isEmergency).toBe(false);
      expect(result.data?.disclaimers).toHaveLength(2);
    });

    it('should detect emergency situations', async () => {
      const mockResponse = {
        answer: '⚠️ **EMERGENCY ALERT**\n\nBased on your message about "chest pain"...',
        readingLevel: '6th grade',
        confidence: 1.0,
        safetyCheck: {
          isEmergency: true,
          emergencyReason: 'chest pain',
          requiresProviderConsult: false,
          blockedTopics: [],
        },
        relatedTopics: [],
        sources: [],
        disclaimers: ['This is an emergency situation. Please seek immediate medical attention.'],
        suggestedFollowUp: 'Call 911 or go to the nearest emergency room immediately.',
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await PatientQAService.askQuestion({
        question: 'I am having severe chest pain',
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.safetyCheck.isEmergency).toBe(true);
      expect(result.data?.safetyCheck.emergencyReason).toBe('chest pain');
    });

    it('should reject empty questions', async () => {
      const result = await PatientQAService.askQuestion({
        question: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_QUESTION');
    });

    it('should reject questions that are too long', async () => {
      const longQuestion = 'a'.repeat(2001);
      const result = await PatientQAService.askQuestion({
        question: longQuestion,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('QUESTION_TOO_LONG');
    });

    it('should handle edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await PatientQAService.askQuestion({
        question: 'What is diabetes?',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('QA_REQUEST_FAILED');
    });
  });

  describe('askAnonymousQuestion', () => {
    it('should ask question without patient context', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { answer: 'Response', safetyCheck: {}, disclaimers: [] },
        error: null,
      });

      await PatientQAService.askAnonymousQuestion('What is high blood pressure?', 'English');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-patient-qa-bot',
        expect.objectContaining({
          body: expect.objectContaining({
            includePatientContext: false,
          }),
        })
      );
    });
  });

  describe('continueConversation', () => {
    it('should include conversation history in request', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { answer: 'Follow-up response', safetyCheck: {}, disclaimers: [] },
        error: null,
      });

      const history = [
        { role: 'user' as const, content: 'What is diabetes?' },
        { role: 'assistant' as const, content: 'Diabetes is a condition...' },
      ];

      await PatientQAService.continueConversation(
        'How do I manage it?',
        history,
        'patient-123'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-patient-qa-bot',
        expect.objectContaining({
          body: expect.objectContaining({
            conversationHistory: history,
          }),
        })
      );
    });
  });

  describe('getSuggestedTopics', () => {
    it('should return suggested topics for a patient', async () => {
      // Mock successful patient diagnoses fetch
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ diagnosis_name: 'Type 2 Diabetes' }],
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const result = await PatientQAService.getSuggestedTopics('patient-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data ?? []).length).toBeGreaterThan(0);
    });
  });

  describe('reportResponse', () => {
    it('should successfully report a problematic response', async () => {
      const result = await PatientQAService.reportResponse(
        'patient-123',
        'Original question',
        'Problematic answer',
        'Incorrect information'
      );

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBe('report-1');
    });
  });

  describe('isLikelyEmergency', () => {
    it('should detect emergency keywords', () => {
      expect(PatientQAService.isLikelyEmergency('I have chest pain')).toBe(true);
      expect(PatientQAService.isLikelyEmergency('I can\'t breathe')).toBe(true);
      expect(PatientQAService.isLikelyEmergency('I feel suicidal')).toBe(true);
      expect(PatientQAService.isLikelyEmergency('Having a heart attack')).toBe(true);
    });

    it('should not flag non-emergency questions', () => {
      expect(PatientQAService.isLikelyEmergency('How do I take my medication?')).toBe(false);
      expect(PatientQAService.isLikelyEmergency('What is diabetes?')).toBe(false);
      expect(PatientQAService.isLikelyEmergency('Can I exercise with high blood pressure?')).toBe(false);
    });
  });

  describe('getCommonFAQs', () => {
    it('should return a list of common FAQs', () => {
      const faqs = PatientQAService.getCommonFAQs();

      expect(Array.isArray(faqs)).toBe(true);
      expect(faqs.length).toBeGreaterThan(0);
      expect(faqs[0]).toHaveProperty('question');
      expect(faqs[0]).toHaveProperty('category');
    });
  });

  describe('getEmergencyInstructions', () => {
    it('should return emergency instructions in English', () => {
      const instructions = PatientQAService.getEmergencyInstructions('English');

      expect(instructions).toContain('911');
      expect(instructions).toContain('emergency');
    });

    it('should return emergency instructions in Spanish', () => {
      const instructions = PatientQAService.getEmergencyInstructions('Spanish');

      expect(instructions).toContain('911');
      expect(instructions).toContain('emergencia');
    });

    it('should default to English for unknown languages', () => {
      const instructions = PatientQAService.getEmergencyInstructions('French');

      expect(instructions).toContain('911');
      expect(instructions).toContain('emergency');
    });
  });
});
