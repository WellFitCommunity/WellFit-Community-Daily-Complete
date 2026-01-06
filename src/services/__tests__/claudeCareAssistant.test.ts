/**
 * claudeCareAssistant.test.ts - Comprehensive test suite for Claude Care Assistant Service
 *
 * Tests: Translation engine, admin task automation, voice input processing,
 * cross-role collaboration, caching, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mocks that are used inside vi.mock factories
const { mockFunctionsInvoke } = vi.hoisted(() => ({
  mockFunctionsInvoke: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}));

vi.mock('../claudeService', () => ({
  claudeService: {
    chatWithHealthAssistant: vi.fn().mockResolvedValue('Mock translation response'),
  },
}));

vi.mock('../voiceLearningService', () => ({
  VoiceLearningService: {
    loadVoiceProfile: vi.fn().mockResolvedValue(null),
    applyCorrections: vi.fn().mockReturnValue({
      corrected: 'test transcription',
      appliedCount: 0,
      appliedCorrections: [],
    }),
  },
}));

import { supabase } from '../../lib/supabaseClient';
import { claudeService } from '../claudeService';
import { VoiceLearningService } from '../voiceLearningService';
import {
  ClaudeCareAssistant,
  ClaudeCareError,
} from '../claudeCareAssistant';
import { SupportedLanguage } from '../../types/claudeCareAssistant';

// ===========================================================================
// TEST SETUP
// ===========================================================================

describe('ClaudeCareAssistant', () => {
  const mockSupabase = vi.mocked(supabase);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // ERROR CLASS TESTS
  // ===========================================================================

  describe('ClaudeCareError', () => {
    it('should create error with all properties', () => {
      const error = new ClaudeCareError(
        'Test error message',
        'TEST_CODE',
        new Error('Original error')
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.originalError).toBeDefined();
      expect(error.name).toBe('ClaudeCareError');
    });

    it('should work without original error', () => {
      const error = new ClaudeCareError('Simple error', 'SIMPLE_CODE');

      expect(error.message).toBe('Simple error');
      expect(error.code).toBe('SIMPLE_CODE');
      expect(error.originalError).toBeUndefined();
    });
  });

  // ===========================================================================
  // TRANSLATION ENGINE TESTS
  // ===========================================================================

  describe('Translation Engine', () => {
    describe('translate', () => {
      it('should return same text when source and target language are equal', async () => {
        const result = await ClaudeCareAssistant.translate({
          sourceLanguage: 'en' as SupportedLanguage,
          targetLanguage: 'en' as SupportedLanguage,
          sourceText: 'Hello, how are you?',
        });

        expect(result.translatedText).toBe('Hello, how are you?');
        expect(result.confidence).toBe(1.0);
        expect(result.cached).toBe(false);
        expect(result.culturalNotes).toEqual([]);
      });

      it('should throw error for empty source text', async () => {
        await expect(
          ClaudeCareAssistant.translate({
            sourceLanguage: 'en' as SupportedLanguage,
            targetLanguage: 'es' as SupportedLanguage,
            sourceText: '',
          })
        ).rejects.toThrow('Translation failed');
      });

      it('should throw error for whitespace-only source text', async () => {
        await expect(
          ClaudeCareAssistant.translate({
            sourceLanguage: 'en' as SupportedLanguage,
            targetLanguage: 'es' as SupportedLanguage,
            sourceText: '   ',
          })
        ).rejects.toThrow('Translation failed');
      });

      it('should throw error for text exceeding maximum length', async () => {
        const longText = 'a'.repeat(5001);

        await expect(
          ClaudeCareAssistant.translate({
            sourceLanguage: 'en' as SupportedLanguage,
            targetLanguage: 'es' as SupportedLanguage,
            sourceText: longText,
          })
        ).rejects.toThrow('Translation failed');
      });

      it('should check cache before calling AI', async () => {
        // Create a proper chain mock that returns cached data
        const mockSingle = vi.fn().mockResolvedValue({
          data: {
            id: 'cache-123',
            translated_text: 'Hola, ¿cómo estás?',
            cultural_notes: ['Formal greeting'],
            translation_confidence: 0.95,
            usage_count: 5,
          },
          error: null,
        });

        const mockUpdate = vi.fn().mockResolvedValue({ data: null, error: null });

        const mockChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: mockSingle,
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };

        vi.mocked(supabase.from).mockReturnValue(mockChain as never);

        const result = await ClaudeCareAssistant.translate({
          sourceLanguage: 'en' as SupportedLanguage,
          targetLanguage: 'es' as SupportedLanguage,
          sourceText: 'Hello, how are you?',
        });

        expect(result.cached).toBe(true);
        expect(result.translatedText).toBe('Hola, ¿cómo estás?');
        expect(result.confidence).toBe(0.95);
      });

      it('should call Claude AI on cache miss', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'claude_translation_cache') {
            return {
              ...mockQuery,
              insert: mockInsertQuery.insert,
            } as never;
          }
          return mockQuery as never;
        });

        vi.mocked(claudeService.chatWithHealthAssistant).mockResolvedValue(
          'TRANSLATION:\nHola\n\nCULTURAL NOTES:\n- Spanish greeting\n\nCONFIDENCE: 0.9'
        );

        const result = await ClaudeCareAssistant.translate({
          sourceLanguage: 'en' as SupportedLanguage,
          targetLanguage: 'es' as SupportedLanguage,
          sourceText: 'Hello',
        });

        expect(result.cached).toBe(false);
        expect(claudeService.chatWithHealthAssistant).toHaveBeenCalled();
      });

      it('should include patient context in translation prompt', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        vi.mocked(claudeService.chatWithHealthAssistant).mockResolvedValue(
          'TRANSLATION:\nHola\n\nCONFIDENCE: 0.85'
        );

        await ClaudeCareAssistant.translate({
          sourceLanguage: 'en' as SupportedLanguage,
          targetLanguage: 'es' as SupportedLanguage,
          sourceText: 'Take your medication',
          contextType: 'medical',
          patientContext: {
            primaryLanguage: 'es' as SupportedLanguage,
            healthLiteracyLevel: 'low',
            preferredCommunicationStyle: 'formal',
            religiousCulturalConsiderations: ['Catholic', 'Family-oriented'],
          },
        });

        const callArgs = vi.mocked(claudeService.chatWithHealthAssistant).mock.calls[0][0];
        // The contextType 'medical' is included in the prompt
        expect(callArgs).toContain('medical');
        expect(callArgs).toContain('Cultural considerations');
      });
    });

    describe('parseTranslationResponse', () => {
      it('should parse formatted response correctly', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        vi.mocked(claudeService.chatWithHealthAssistant).mockResolvedValue(
          `TRANSLATION:
Buenos días, ¿cómo se siente hoy?

CULTURAL NOTES:
- More formal greeting appropriate for healthcare
- Use of "usted" form shows respect

CONFIDENCE: 0.92`
        );

        const result = await ClaudeCareAssistant.translate({
          sourceLanguage: 'en' as SupportedLanguage,
          targetLanguage: 'es' as SupportedLanguage,
          sourceText: 'Good morning, how are you feeling today?',
        });

        expect(result.translatedText).toBe('Buenos días, ¿cómo se siente hoy?');
        expect(result.culturalNotes?.length).toBe(2);
        expect(result.confidence).toBe(0.92);
      });

      it('should handle unformatted response as fallback', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        vi.mocked(claudeService.chatWithHealthAssistant).mockResolvedValue(
          'Just a plain translation without format'
        );

        const result = await ClaudeCareAssistant.translate({
          sourceLanguage: 'en' as SupportedLanguage,
          targetLanguage: 'fr' as SupportedLanguage,
          sourceText: 'Hello',
        });

        expect(result.translatedText).toBe('Just a plain translation without format');
        expect(result.confidence).toBe(0.85); // Default confidence
      });
    });
  });

  // ===========================================================================
  // ADMIN TASK AUTOMATION TESTS
  // ===========================================================================

  describe('Admin Task Automation', () => {
    describe('executeAdminTask', () => {
      it('should throw error for missing required fields', async () => {
        await expect(
          ClaudeCareAssistant.executeAdminTask({
            userId: '',
            role: 'nurse',
            templateId: 'template-123',
            taskType: 'note_generation',
            inputData: {},
          })
        ).rejects.toThrow('Failed to execute admin task');
      });

      it('should throw error when template not found', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        await expect(
          ClaudeCareAssistant.executeAdminTask({
            userId: 'user-123',
            role: 'nurse',
            templateId: 'nonexistent-template',
            taskType: 'note_generation',
            inputData: { patientName: 'John Doe' },
          })
        ).rejects.toThrow('Failed to execute admin task');
      });

      it('should throw error for role mismatch', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'template-123',
              role: 'physician',
              task_type: 'note_generation',
              template_name: 'Progress Note',
              prompt_template: 'Generate a note for {patientName}',
              output_format: 'structured',
              is_active: true,
            },
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        await expect(
          ClaudeCareAssistant.executeAdminTask({
            userId: 'user-123',
            role: 'nurse', // Mismatch with template role
            templateId: 'template-123',
            taskType: 'note_generation',
            inputData: { patientName: 'John Doe' },
          })
        ).rejects.toThrow('Failed to execute admin task');
      });

      it('should execute task successfully with matching role', async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'template-123',
              role: 'nurse',
              task_type: 'note_generation',
              template_name: 'Nursing Note',
              prompt_template: 'Generate a nursing note for {patientName}',
              output_format: 'structured',
              preferred_model: 'haiku-3.5',
              is_active: true,
            },
            error: null,
          }),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'history-123' },
            error: null,
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'claude_admin_task_history') {
            return mockInsertQuery as never;
          }
          return mockSelectQuery as never;
        });

        vi.mocked(claudeService.chatWithHealthAssistant).mockResolvedValue(
          'Generated nursing note for patient John Doe'
        );

        const result = await ClaudeCareAssistant.executeAdminTask({
          userId: 'user-123',
          role: 'nurse',
          templateId: 'template-123',
          taskType: 'note_generation',
          inputData: { patientName: 'John Doe' },
        });

        expect(result).toHaveProperty('taskId');
        expect(result).toHaveProperty('generatedContent');
        expect(result).toHaveProperty('tokensUsed');
        expect(result).toHaveProperty('executionTimeMs');
        expect(result.generatedContent).toContain('John Doe');
      });

      it('should throw error for oversized input data', async () => {
        const largeInputData = {
          data: 'x'.repeat(15000),
        };

        await expect(
          ClaudeCareAssistant.executeAdminTask({
            userId: 'user-123',
            role: 'nurse',
            templateId: 'template-123',
            taskType: 'note_generation',
            inputData: largeInputData,
          })
        ).rejects.toThrow('Failed to execute admin task');
      });
    });

    describe('getTemplatesForRole', () => {
      it('should return templates for specified role', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'template-1',
                role: 'nurse',
                task_type: 'note_generation',
                template_name: 'Nursing Note',
                description: 'Generate nursing notes',
                prompt_template: 'Template content',
                output_format: 'structured',
                estimated_tokens: 500,
                preferred_model: 'haiku-3.5',
                is_active: true,
              },
              {
                id: 'template-2',
                role: 'nurse',
                task_type: 'shift_report',
                template_name: 'Shift Report',
                description: 'Generate shift handoff reports',
                prompt_template: 'Report template',
                output_format: 'narrative',
                estimated_tokens: 800,
                preferred_model: 'sonnet-4.5',
                is_active: true,
              },
            ],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const templates = await ClaudeCareAssistant.getTemplatesForRole('nurse');

        expect(templates.length).toBe(2);
        expect(templates[0].taskType).toBe('note_generation');
        expect(templates[1].taskType).toBe('shift_report');
      });

      it('should return empty array when no templates found', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const templates = await ClaudeCareAssistant.getTemplatesForRole('unknown_role');

        expect(templates).toEqual([]);
      });

      it('should return empty array on database error', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const templates = await ClaudeCareAssistant.getTemplatesForRole('nurse');

        expect(templates).toEqual([]);
      });
    });

    describe('getUserTaskHistory', () => {
      it('should return user task history', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'history-1',
                user_id: 'user-123',
                role: 'nurse',
                task_type: 'note_generation',
                template_id: 'template-1',
                input_data: { patientName: 'John' },
                output_data: { generatedContent: 'Note content' },
                tokens_used: 150,
                execution_time_ms: 500,
                ai_corrections_count: 0,
                user_satisfaction: 5,
                user_feedback: 'Great!',
                created_at: '2024-01-15T10:00:00Z',
              },
            ],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const history = await ClaudeCareAssistant.getUserTaskHistory('user-123');

        expect(history.length).toBe(1);
        expect(history[0].userId).toBe('user-123');
        expect(history[0].tokensUsed).toBe(150);
      });

      it('should respect limit parameter', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        await ClaudeCareAssistant.getUserTaskHistory('user-123', 5);

        expect(mockQuery.limit).toHaveBeenCalledWith(5);
      });

      it('should use default limit of 20', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        await ClaudeCareAssistant.getUserTaskHistory('user-123');

        expect(mockQuery.limit).toHaveBeenCalledWith(20);
      });
    });
  });

  // ===========================================================================
  // VOICE INPUT TESTS
  // ===========================================================================

  describe('Voice Input Processing', () => {
    describe('processVoiceInput', () => {
      it('should process voice input and return transcription', async () => {
        const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });

        mockFunctionsInvoke.mockResolvedValue({
          data: {
            transcription: 'Generate a nursing note for patient Smith',
            confidence: 0.9,
          },
          error: null,
        });

        const mockInsertQuery = {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'template-1',
                role: 'nurse',
                task_type: 'note_generation',
                description: 'Generate nursing notes',
              },
            ],
            error: null,
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'claude_voice_input_sessions') {
            return mockInsertQuery as never;
          }
          return mockSelectQuery as never;
        });

        vi.mocked(VoiceLearningService.loadVoiceProfile).mockResolvedValue(null);
        vi.mocked(VoiceLearningService.applyCorrections).mockReturnValue({
          corrected: 'Generate a nursing note for patient Smith',
          appliedCount: 0,
          appliedCorrections: [],
        });

        const result = await ClaudeCareAssistant.processVoiceInput(
          'user-123',
          'nurse',
          mockAudioBlob
        );

        expect(result).toHaveProperty('transcription');
        expect(result).toHaveProperty('confidence');
        expect(result.transcription).toContain('nursing note');
      });

      it('should apply voice learning corrections', async () => {
        const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });

        mockFunctionsInvoke.mockResolvedValue({
          data: {
            transcription: 'Generate a note for Mr. Smith',
            confidence: 0.85,
          },
          error: null,
        });

        const mockQuery = {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        vi.mocked(VoiceLearningService.loadVoiceProfile).mockResolvedValue({
          corrections: [{ wrong: 'Mr. Smith', correct: 'Mr. Smith (John)' }],
        } as never);

        vi.mocked(VoiceLearningService.applyCorrections).mockReturnValue({
          corrected: 'Generate a note for Mr. Smith (John)',
          appliedCount: 1,
          appliedCorrections: ['Mr. Smith -> Mr. Smith (John)'],
        });

        const result = await ClaudeCareAssistant.processVoiceInput(
          'user-123',
          'nurse',
          mockAudioBlob
        );

        expect(VoiceLearningService.applyCorrections).toHaveBeenCalled();
        expect(result.transcription).toContain('John');
      });

      it('should throw error when transcription fails', async () => {
        const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });

        mockFunctionsInvoke.mockResolvedValue({
          data: null,
          error: new Error('Transcription service unavailable'),
        });

        await expect(
          ClaudeCareAssistant.processVoiceInput('user-123', 'nurse', mockAudioBlob)
        ).rejects.toThrow('Failed to process voice input');
      });

      it('should suggest template based on transcription content', async () => {
        const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });

        mockFunctionsInvoke.mockResolvedValue({
          data: {
            transcription: 'I need to create a discharge summary',
            confidence: 0.92,
          },
          error: null,
        });

        const mockQuery = {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'template-discharge',
                role: 'nurse',
                task_type: 'discharge_summary',
                description: 'Generate discharge summary for patient',
              },
            ],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        vi.mocked(VoiceLearningService.loadVoiceProfile).mockResolvedValue(null);
        vi.mocked(VoiceLearningService.applyCorrections).mockReturnValue({
          corrected: 'I need to create a discharge summary',
          appliedCount: 0,
          appliedCorrections: [],
        });

        const result = await ClaudeCareAssistant.processVoiceInput(
          'user-123',
          'nurse',
          mockAudioBlob
        );

        expect(result.suggestedTemplate).toBe('template-discharge');
      });
    });
  });

  // ===========================================================================
  // CROSS-ROLE COLLABORATION TESTS
  // ===========================================================================

  describe('Cross-Role Collaboration', () => {
    describe('shareCareContext', () => {
      it('should share care context successfully', async () => {
        const mockQuery = {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        await expect(
          ClaudeCareAssistant.shareCareContext({
            patientId: 'patient-123',
            contextType: 'administrative',
            contributedByRole: 'nurse',
            contributedByUser: 'user-456',
            contextData: { dischargeDate: '2024-01-20' },
            contextSummary: 'Patient ready for discharge',
            validUntil: '2024-01-25',
            isActive: true,
          })
        ).resolves.not.toThrow();

        expect(mockQuery.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            patient_id: 'patient-123',
            context_type: 'administrative',
            contributed_by_role: 'nurse',
          })
        );
      });

      it('should throw error on database failure', async () => {
        const mockQuery = {
          insert: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Insert failed'),
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        await expect(
          ClaudeCareAssistant.shareCareContext({
            patientId: 'patient-123',
            contextType: 'clinical',
            contributedByRole: 'case_manager',
            contributedByUser: 'user-789',
            contextData: {},
            contextSummary: 'Test context',
            isActive: true,
          })
        ).rejects.toThrow('Failed to share care context');
      });
    });

    describe('getCareContext', () => {
      it('should retrieve care context for patient', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'context-1',
                patient_id: 'patient-123',
                context_type: 'medication_change',
                contributed_by_role: 'physician',
                contributed_by_user: 'dr-123',
                context_data: { medication: 'Aspirin', change: 'increased' },
                context_summary: 'Aspirin dosage increased',
                valid_until: '2024-02-01',
                is_active: true,
                created_at: '2024-01-15T10:00:00Z',
              },
              {
                id: 'context-2',
                patient_id: 'patient-123',
                context_type: 'fall_risk',
                contributed_by_role: 'nurse',
                contributed_by_user: 'nurse-456',
                context_data: { riskLevel: 'high' },
                context_summary: 'High fall risk identified',
                is_active: true,
                created_at: '2024-01-14T10:00:00Z',
              },
            ],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const contexts = await ClaudeCareAssistant.getCareContext('patient-123');

        expect(contexts.length).toBe(2);
        expect(contexts[0].contextType).toBe('medication_change');
        expect(contexts[1].contextType).toBe('fall_risk');
      });

      it('should return empty array for patient with no context', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const contexts = await ClaudeCareAssistant.getCareContext('new-patient');

        expect(contexts).toEqual([]);
      });

      it('should return empty array on database error', async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Query failed'),
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery as never);

        const contexts = await ClaudeCareAssistant.getCareContext('patient-123');

        expect(contexts).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // EXPORT TESTS
  // ===========================================================================

  describe('Module Exports', () => {
    it('should export ClaudeCareAssistant class', async () => {
      const module = await import('../claudeCareAssistant');

      expect(module.ClaudeCareAssistant).toBeDefined();
      expect(typeof module.ClaudeCareAssistant.translate).toBe('function');
      expect(typeof module.ClaudeCareAssistant.executeAdminTask).toBe('function');
    });

    it('should export claudeCareAssistant as alias', async () => {
      const module = await import('../claudeCareAssistant');

      expect(module.claudeCareAssistant).toBe(module.ClaudeCareAssistant);
    });

    it('should export ClaudeCareError', async () => {
      const module = await import('../claudeCareAssistant');

      expect(module.ClaudeCareError).toBeDefined();
    });

    it('should have default export', async () => {
      const module = await import('../claudeCareAssistant');

      expect(module.default).toBe(module.ClaudeCareAssistant);
    });
  });
});
