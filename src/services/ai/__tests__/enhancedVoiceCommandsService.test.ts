/**
 * Tests for Enhanced Voice Commands Service
 *
 * Covers NLU intent recognition, entity extraction, and contextual suggestions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EnhancedVoiceCommandsService,
  VoiceCommandRequest,
  VoiceCommandResponse,
} from '../enhancedVoiceCommandsService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockVoiceRequest(overrides?: Partial<VoiceCommandRequest>): VoiceCommandRequest {
  return {
    transcription: 'Go to patient dashboard',
    context: {
      currentPage: '/home',
      userRole: 'nurse',
    },
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockVoiceResponse(): VoiceCommandResponse {
  return {
    result: {
      transcription: 'Go to patient dashboard',
      intents: [
        {
          intent: 'navigate_to_dashboard',
          category: 'navigation',
          confidence: 0.95,
          parameters: { destination: 'patient_dashboard' },
          requiredParameters: ['destination'],
          missingParameters: [],
        },
      ],
      primaryIntent: {
        intent: 'navigate_to_dashboard',
        category: 'navigation',
        confidence: 0.95,
        parameters: { destination: 'patient_dashboard' },
        requiredParameters: ['destination'],
        missingParameters: [],
      },
      entities: [],
      suggestedActions: [
        {
          actionType: 'navigate',
          target: '/patient-dashboard',
          parameters: {},
        },
      ],
      clarificationNeeded: false,
      responseText: 'Navigating to patient dashboard',
      shouldSpeak: true,
      context: {},
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-haiku-4.5',
      responseTimeMs: 200,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('EnhancedVoiceCommandsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processCommand', () => {
    it('should return failure when transcription is empty', async () => {
      const request = createMockVoiceRequest({ transcription: '' });
      const result = await EnhancedVoiceCommandsService.processCommand(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when transcription is whitespace only', async () => {
      const request = createMockVoiceRequest({ transcription: '   ' });
      const result = await EnhancedVoiceCommandsService.processCommand(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockVoiceRequest();
      const result = await EnhancedVoiceCommandsService.processCommand(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROCESSING_FAILED');
    });

    it('should successfully process voice command', async () => {
      const mockResponse = createMockVoiceResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockVoiceRequest();
      const result = await EnhancedVoiceCommandsService.processCommand(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.primaryIntent.category).toBe('navigation');
      expect(result.data?.result.primaryIntent.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('quickIntentDetect', () => {
    it('should detect navigation intent for "go to"', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('go to patient list');
      expect(result.category).toBe('navigation');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect navigation intent for "open"', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('open the dashboard');
      expect(result.category).toBe('navigation');
    });

    it('should detect patient lookup intent', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('find patient John Smith');
      expect(result.category).toBe('patient_lookup');
    });

    it('should detect schedule intent', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('show my appointments');
      expect(result.category).toBe('schedule');
    });

    it('should detect medication intent', () => {
      // Use a phrase that only matches medication patterns
      const result = EnhancedVoiceCommandsService.quickIntentDetect('check my prescription');
      expect(result.category).toBe('medication');
    });

    it('should detect report request intent', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('generate weekly report');
      expect(result.category).toBe('report_request');
    });

    it('should detect help intent', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('help me with this');
      expect(result.category).toBe('help');
    });

    it('should detect communication intent', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('send a message to Dr. Smith');
      expect(result.category).toBe('communication');
    });

    it('should return unknown for unrecognized commands', () => {
      const result = EnhancedVoiceCommandsService.quickIntentDetect('blah blah blah');
      expect(result.category).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('extractEntities', () => {
    it('should extract date entities', () => {
      const entities = EnhancedVoiceCommandsService.extractEntities('Schedule for tomorrow');
      const dateEntity = entities.find(e => e.type === 'date');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.value.toLowerCase()).toBe('tomorrow');
    });

    it('should extract time entities', () => {
      const entities = EnhancedVoiceCommandsService.extractEntities('Meeting at 3pm');
      const timeEntity = entities.find(e => e.type === 'time');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.value).toBe('3pm');
    });

    it('should extract number entities', () => {
      const entities = EnhancedVoiceCommandsService.extractEntities('Give 500 mg of medication');
      const numberEntity = entities.find(e => e.type === 'number');
      expect(numberEntity).toBeDefined();
      expect(numberEntity?.value).toBe('500');
    });

    it('should extract day of week entities', () => {
      const entities = EnhancedVoiceCommandsService.extractEntities('Schedule for Monday');
      const dateEntity = entities.find(e => e.type === 'date');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.value).toBe('Monday');
    });
  });

  // Note: getContextualSuggestions tests removed - method was removed during service refactor

  describe('generateSpokenResponse', () => {
    it('should return clarification prompt when needed', () => {
      const result = createMockVoiceResponse().result;
      result.clarificationNeeded = true;
      result.clarificationPrompt = 'Which patient do you mean?';

      const spoken = EnhancedVoiceCommandsService.generateSpokenResponse(result);
      expect(spoken).toBe('Which patient do you mean?');
    });

    it('should return help message for unknown intent', () => {
      const result = createMockVoiceResponse().result;
      result.primaryIntent.category = 'unknown';

      const spoken = EnhancedVoiceCommandsService.generateSpokenResponse(result);
      expect(spoken).toMatch(/didn.t understand/);
    });

    it('should return response text for recognized commands', () => {
      const result = createMockVoiceResponse().result;
      const spoken = EnhancedVoiceCommandsService.generateSpokenResponse(result);
      expect(spoken).toBe('Navigating to patient dashboard');
    });
  });

  // Note: logCommand tests removed - method was removed during service refactor
});
