/**
 * SOAP Note AI Service Tests
 *
 * Tests for the AI-powered SOAP note generation service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SOAPNoteAIService } from '../soapNoteAIService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: [{ id: 'note-1' }], error: null }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          ilike: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
      })),
    })),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('SOAPNoteAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSOAPNote', () => {
    it('should successfully generate a SOAP note', async () => {
      const mockResponse = {
        soapNote: {
          subjective: { content: 'Patient reports...', confidence: 0.95, sources: ['chief_complaint'] },
          objective: { content: 'Vitals: BP 120/80...', confidence: 0.98, sources: ['vitals'] },
          assessment: { content: '1. Hypertension (I10)...', confidence: 0.90, sources: ['diagnoses'] },
          plan: { content: 'Continue medications...', confidence: 0.92, sources: ['medications'] },
          icd10Suggestions: [{ code: 'I10', display: 'Essential hypertension', confidence: 0.95 }],
          cptSuggestions: [{ code: '99214', display: 'Office visit', confidence: 0.90 }],
          requiresReview: false,
          reviewReasons: [],
        },
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          response_time_ms: 1500,
          template_style: 'standard',
          context_sources: {
            vitals_count: 5,
            diagnoses_count: 3,
            medications_count: 4,
            lab_results_count: 2,
            has_transcript: true,
          },
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await SOAPNoteAIService.generateSOAPNote({
        encounterId: 'enc-123',
        patientId: 'patient-456',
        templateStyle: 'standard',
      });

      expect(result.success).toBe(true);
      expect(result.data?.soapNote.subjective.content).toBe('Patient reports...');
      expect(result.data?.soapNote.icd10Suggestions).toHaveLength(1);
      expect(result.data?.metadata.model).toBe('claude-sonnet-4-20250514');
    });

    it('should handle edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Function timeout' },
      });

      const result = await SOAPNoteAIService.generateSOAPNote({
        encounterId: 'enc-123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SOAP_NOTE_GENERATION_FAILED');
    });

    it('should use correct template style', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { soapNote: {}, metadata: {} },
        error: null,
      });

      await SOAPNoteAIService.generateSOAPNote({
        encounterId: 'enc-123',
        templateStyle: 'comprehensive',
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-soap-note-generator',
        expect.objectContaining({
          body: expect.objectContaining({
            templateStyle: 'comprehensive',
          }),
        })
      );
    });
  });

  describe('generateBriefSOAPNote', () => {
    it('should call generateSOAPNote with brief template', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { soapNote: {}, metadata: {} },
        error: null,
      });

      await SOAPNoteAIService.generateBriefSOAPNote('enc-123', 'patient-456');

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-soap-note-generator',
        expect.objectContaining({
          body: expect.objectContaining({
            templateStyle: 'brief',
            includeTranscript: false,
          }),
        })
      );
    });
  });

  describe('generateComprehensiveSOAPNote', () => {
    it('should call generateSOAPNote with comprehensive template', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { soapNote: {}, metadata: {} },
        error: null,
      });

      await SOAPNoteAIService.generateComprehensiveSOAPNote(
        'enc-123',
        'patient-456',
        'Additional notes from provider'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-soap-note-generator',
        expect.objectContaining({
          body: expect.objectContaining({
            templateStyle: 'comprehensive',
            includeTranscript: true,
            providerNotes: 'Additional notes from provider',
          }),
        })
      );
    });
  });

  describe('saveGeneratedNote', () => {
    it('should save SOAP note sections to database', async () => {
      const mockSoapNote = {
        subjective: { content: 'Subjective content', confidence: 0.95, sources: [] },
        objective: { content: 'Objective content', confidence: 0.98, sources: [] },
        assessment: { content: 'Assessment content', confidence: 0.90, sources: [] },
        plan: { content: 'Plan content', confidence: 0.92, sources: [] },
        hpi: { content: 'HPI content', confidence: 0.85, sources: [] },
        icd10Suggestions: [],
        cptSuggestions: [],
        requiresReview: false,
        reviewReasons: [],
      };

      const result = await SOAPNoteAIService.saveGeneratedNote(
        'enc-123',
        'author-456',
        mockSoapNote
      );

      expect(result.success).toBe(true);
      expect(result.data?.noteIds).toHaveLength(1);
    });
  });

  describe('getGenerationHistory', () => {
    it('should fetch generation history for an encounter', async () => {
      const result = await SOAPNoteAIService.getGenerationHistory('enc-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});
