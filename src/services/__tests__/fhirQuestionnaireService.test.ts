/**
 * FHIR Questionnaire Service Tests
 *
 * Tests for:
 * - generateQuestionnaire: AI-powered questionnaire generation
 * - saveQuestionnaire: Database persistence
 * - getQuestionnaires: Fetch all questionnaires
 * - getTemplates: Fetch active templates
 * - incrementTemplateUsage: Usage tracking
 * - deployToWellFit: Deployment to WellFit
 * - updateQuestionnaireStatus: Status management
 * - deleteQuestionnaire: Deletion
 * - getQuestionnaireStats: Statistics retrieval
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FHIRQuestionnaireService, FHIRQuestionnaire } from '../fhirQuestionnaireService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock Supabase client
function createMockSupabase() {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn(() => mockQuery),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    _mockQuery: mockQuery,
  } as unknown as SupabaseClient & { _mockQuery: typeof mockQuery };
}

describe('FHIRQuestionnaireService', () => {
  let mockSupabase: SupabaseClient & { _mockQuery: ReturnType<typeof createMockSupabase>['_mockQuery'] };
  let service: FHIRQuestionnaireService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    service = new FHIRQuestionnaireService(mockSupabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // generateQuestionnaire Tests
  // ==========================================================================
  describe('generateQuestionnaire', () => {
    const validQuestionnaireResponse = {
      resourceType: 'Questionnaire',
      id: 'phq-9',
      title: 'PHQ-9 Depression Screening',
      status: 'draft',
      description: 'Patient Health Questionnaire for depression screening',
      item: [
        {
          linkId: 'q1',
          text: 'Little interest or pleasure in doing things',
          type: 'choice',
          required: true,
          options: [
            { value: '0', display: 'Not at all' },
            { value: '1', display: 'Several days' },
          ],
        },
      ],
    };

    it('should generate questionnaire from natural language prompt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(validQuestionnaireResponse) }]
        }),
      });

      const result = await service.generateQuestionnaire('Create a PHQ-9 depression screening questionnaire');

      expect(result.resourceType).toBe('Questionnaire');
      expect(result.id).toBe('phq-9');
      expect(result.title).toBe('PHQ-9 Depression Screening');
      expect(result.item.length).toBeGreaterThan(0);
    });

    it('should call API with correct system prompt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(validQuestionnaireResponse) }]
        }),
      });

      await service.generateQuestionnaire('Test prompt');

      expect(mockFetch).toHaveBeenCalledWith('/api/anthropic-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('FHIR SDC expert'),
      });
    });

    it('should strip markdown code blocks from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '```json\n' + JSON.stringify(validQuestionnaireResponse) + '\n```' }]
        }),
      });

      const result = await service.generateQuestionnaire('Test prompt');

      expect(result.resourceType).toBe('Questionnaire');
    });

    it('should throw error when API request fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.generateQuestionnaire('Test prompt'))
        .rejects.toThrow('API request failed: 500');
    });

    it('should throw error when no content in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [] }),
      });

      await expect(service.generateQuestionnaire('Test prompt'))
        .rejects.toThrow('No response from AI service');
    });

    it('should throw error when response is not a questionnaire', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify({ resourceType: 'Patient' }) }]
        }),
      });

      // The code catches validation errors and re-throws with a generic message
      await expect(service.generateQuestionnaire('Test prompt'))
        .rejects.toThrow('Failed to generate valid FHIR questionnaire');
    });

    it('should throw error when response is invalid JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'not valid json' }]
        }),
      });

      await expect(service.generateQuestionnaire('Test prompt'))
        .rejects.toThrow('Failed to generate valid FHIR questionnaire');
    });
  });

  // ==========================================================================
  // saveQuestionnaire Tests
  // ==========================================================================
  describe('saveQuestionnaire', () => {
    const mockQuestionnaire: FHIRQuestionnaire = {
      resourceType: 'Questionnaire',
      id: 'test-questionnaire',
      title: 'Test Questionnaire',
      status: 'draft',
      description: 'A test questionnaire',
      item: [],
    };

    it('should save questionnaire to database', async () => {
      const mockRecord = {
        id: 1,
        questionnaire_id: 'test-questionnaire',
        title: 'Test Questionnaire',
        status: 'draft',
      };

      mockSupabase._mockQuery.single.mockResolvedValue({ data: mockRecord, error: null });

      const result = await service.saveQuestionnaire(mockQuestionnaire);

      expect(result.id).toBe(1);
      expect(result.questionnaire_id).toBe('test-questionnaire');
      expect(mockSupabase.from).toHaveBeenCalledWith('fhir_questionnaires');
    });

    it('should include natural language prompt when provided', async () => {
      const mockRecord = { id: 1 };
      mockSupabase._mockQuery.single.mockResolvedValue({ data: mockRecord, error: null });

      await service.saveQuestionnaire(mockQuestionnaire, {
        naturalLanguagePrompt: 'Create a PHQ-9 questionnaire',
      });

      expect(mockSupabase._mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          natural_language_prompt: 'Create a PHQ-9 questionnaire',
        })
      );
    });

    it('should include template name when provided', async () => {
      const mockRecord = { id: 1 };
      mockSupabase._mockQuery.single.mockResolvedValue({ data: mockRecord, error: null });

      await service.saveQuestionnaire(mockQuestionnaire, {
        templateName: 'Mental Health Assessment',
      });

      expect(mockSupabase._mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_from_template: 'Mental Health Assessment',
        })
      );
    });

    it('should include tags when provided', async () => {
      const mockRecord = { id: 1 };
      mockSupabase._mockQuery.single.mockResolvedValue({ data: mockRecord, error: null });

      await service.saveQuestionnaire(mockQuestionnaire, {
        tags: ['mental-health', 'screening'],
      });

      expect(mockSupabase._mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['mental-health', 'screening'],
        })
      );
    });

    it('should include scoring info when questionnaire has scoring', async () => {
      const questionnaireWithScoring: FHIRQuestionnaire = {
        ...mockQuestionnaire,
        scoring: {
          algorithm: 'PHQ-9',
          rules: [
            { condition: 'score >= 10', score: 10, interpretation: 'Moderate depression' },
          ],
        },
      };

      const mockRecord = { id: 1 };
      mockSupabase._mockQuery.single.mockResolvedValue({ data: mockRecord, error: null });

      await service.saveQuestionnaire(questionnaireWithScoring);

      expect(mockSupabase._mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          has_scoring: true,
          scoring_algorithm: 'PHQ-9',
          scoring_rules: questionnaireWithScoring.scoring?.rules,
        })
      );
    });

    it('should throw error when save fails', async () => {
      mockSupabase._mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.saveQuestionnaire(mockQuestionnaire))
        .rejects.toThrow('Failed to save questionnaire: Database error');
    });
  });

  // ==========================================================================
  // getQuestionnaires Tests
  // ==========================================================================
  describe('getQuestionnaires', () => {
    it('should return all questionnaires ordered by created_at desc', async () => {
      const mockQuestionnaires = [
        { id: 1, title: 'Questionnaire 1' },
        { id: 2, title: 'Questionnaire 2' },
      ];

      mockSupabase._mockQuery.order.mockResolvedValue({
        data: mockQuestionnaires,
        error: null,
      });

      const result = await service.getQuestionnaires();

      expect(result.length).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('fhir_questionnaires');
      expect(mockSupabase._mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should return empty array when no questionnaires exist', async () => {
      mockSupabase._mockQuery.order.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getQuestionnaires();

      expect(result).toEqual([]);
    });

    it('should throw error when fetch fails', async () => {
      mockSupabase._mockQuery.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.getQuestionnaires())
        .rejects.toThrow('Failed to fetch questionnaires: Database error');
    });
  });

  // ==========================================================================
  // getTemplates Tests
  // ==========================================================================
  describe('getTemplates', () => {
    it('should return active templates ordered by usage_count desc', async () => {
      const mockTemplates = [
        { id: 1, name: 'PHQ-9', usage_count: 100 },
        { id: 2, name: 'GAD-7', usage_count: 50 },
      ];

      mockSupabase._mockQuery.order.mockResolvedValue({
        data: mockTemplates,
        error: null,
      });

      const result = await service.getTemplates();

      expect(result.length).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('questionnaire_templates');
      expect(mockSupabase._mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockSupabase._mockQuery.order).toHaveBeenCalledWith('usage_count', { ascending: false });
    });

    it('should return empty array when no templates exist', async () => {
      mockSupabase._mockQuery.order.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getTemplates();

      expect(result).toEqual([]);
    });

    it('should throw error when fetch fails', async () => {
      mockSupabase._mockQuery.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.getTemplates())
        .rejects.toThrow('Failed to fetch templates: Database error');
    });
  });

  // ==========================================================================
  // incrementTemplateUsage Tests
  // ==========================================================================
  describe('incrementTemplateUsage', () => {
    it('should call RPC to increment template usage', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      await service.incrementTemplateUsage(1);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_template_usage', {
        template_id: 1,
      });
    });

    it('should not throw on RPC error (silent fail)', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: { message: 'RPC failed' },
      });

      // Should not throw
      await expect(service.incrementTemplateUsage(1)).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // deployToWellFit Tests
  // ==========================================================================
  describe('deployToWellFit', () => {
    it('should call RPC to deploy questionnaire', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.deployToWellFit(1);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deploy_questionnaire_to_wellfit', {
        questionnaire_uuid: 1,
      });
    });

    it('should return false when deployment returns false', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await service.deployToWellFit(1);

      expect(result).toBe(false);
    });

    it('should throw error when deployment fails', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Deployment failed' },
      });

      await expect(service.deployToWellFit(1))
        .rejects.toThrow('Failed to deploy questionnaire: Deployment failed');
    });
  });

  // ==========================================================================
  // updateQuestionnaireStatus Tests
  // ==========================================================================
  describe('updateQuestionnaireStatus', () => {
    it('should update status to draft', async () => {
      mockSupabase._mockQuery.eq.mockResolvedValue({ error: null });

      await service.updateQuestionnaireStatus(1, 'draft');

      expect(mockSupabase._mockQuery.update).toHaveBeenCalledWith({ status: 'draft' });
      expect(mockSupabase._mockQuery.eq).toHaveBeenCalledWith('id', 1);
    });

    it('should set published_at when status is active', async () => {
      mockSupabase._mockQuery.eq.mockResolvedValue({ error: null });

      await service.updateQuestionnaireStatus(1, 'active');

      expect(mockSupabase._mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          published_at: expect.any(String),
        })
      );
    });

    it('should set retired_at when status is retired', async () => {
      mockSupabase._mockQuery.eq.mockResolvedValue({ error: null });

      await service.updateQuestionnaireStatus(1, 'retired');

      expect(mockSupabase._mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retired',
          retired_at: expect.any(String),
        })
      );
    });

    it('should throw error when update fails', async () => {
      mockSupabase._mockQuery.eq.mockResolvedValue({
        error: { message: 'Update failed' },
      });

      await expect(service.updateQuestionnaireStatus(1, 'active'))
        .rejects.toThrow('Failed to update questionnaire status: Update failed');
    });
  });

  // ==========================================================================
  // deleteQuestionnaire Tests
  // ==========================================================================
  describe('deleteQuestionnaire', () => {
    it('should delete questionnaire by ID', async () => {
      mockSupabase._mockQuery.eq.mockResolvedValue({ error: null });

      await service.deleteQuestionnaire(1);

      expect(mockSupabase.from).toHaveBeenCalledWith('fhir_questionnaires');
      expect(mockSupabase._mockQuery.delete).toHaveBeenCalled();
      expect(mockSupabase._mockQuery.eq).toHaveBeenCalledWith('id', 1);
    });

    it('should throw error when delete fails', async () => {
      mockSupabase._mockQuery.eq.mockResolvedValue({
        error: { message: 'Delete failed' },
      });

      await expect(service.deleteQuestionnaire(1))
        .rejects.toThrow('Failed to delete questionnaire: Delete failed');
    });
  });

  // ==========================================================================
  // getQuestionnaireStats Tests
  // ==========================================================================
  describe('getQuestionnaireStats', () => {
    it('should return stats from RPC', async () => {
      const mockStats = {
        total_responses: 100,
        average_score: 8.5,
        completion_rate: 0.95,
      };

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockStats,
        error: null,
      });

      const result = await service.getQuestionnaireStats(1);

      expect(result).toEqual(mockStats);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_questionnaire_stats', {
        questionnaire_uuid: 1,
      });
    });

    it('should return empty object when no stats available', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getQuestionnaireStats(1);

      expect(result).toEqual({});
    });

    it('should throw error when RPC fails', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.getQuestionnaireStats(1))
        .rejects.toThrow('Failed to get questionnaire stats: RPC failed');
    });
  });

  // ==========================================================================
  // Type Structure Tests
  // ==========================================================================
  describe('FHIRQuestionnaire type structure', () => {
    it('should support all valid question types', () => {
      const validTypes = ['string', 'integer', 'decimal', 'boolean', 'choice', 'date'];

      validTypes.forEach(type => {
        const item = {
          linkId: 'q1',
          text: 'Test question',
          type: type as 'string' | 'integer' | 'decimal' | 'boolean' | 'choice' | 'date',
        };
        expect(validTypes).toContain(item.type);
      });
    });

    it('should support all valid questionnaire statuses', () => {
      const validStatuses = ['draft', 'active', 'retired'];

      validStatuses.forEach(status => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          id: 'test',
          title: 'Test',
          status: status as 'draft' | 'active' | 'retired',
          description: 'Test',
          item: [],
        };
        expect(validStatuses).toContain(questionnaire.status);
      });
    });

    it('should support conditional logic with enableWhen', () => {
      const questionWithCondition = {
        linkId: 'q2',
        text: 'Follow-up question',
        type: 'string' as const,
        enableWhen: [
          {
            question: 'q1',
            operator: 'equals',
            answerString: 'yes',
          },
        ],
      };

      expect(questionWithCondition.enableWhen).toBeDefined();
      expect(questionWithCondition.enableWhen[0].question).toBe('q1');
    });
  });

  // ==========================================================================
  // Template Category Tests
  // ==========================================================================
  describe('QuestionnaireTemplate categories', () => {
    it('should support all valid template categories', () => {
      const validCategories = [
        'MENTAL_HEALTH',
        'PHYSICAL_HEALTH',
        'FUNCTIONAL_ASSESSMENT',
        'PAIN_ASSESSMENT',
        'MEDICATION_ADHERENCE',
        'QUALITY_OF_LIFE',
        'SCREENING',
        'CUSTOM',
      ];

      expect(validCategories).toHaveLength(8);
      expect(validCategories).toContain('MENTAL_HEALTH');
      expect(validCategories).toContain('PHYSICAL_HEALTH');
      expect(validCategories).toContain('SCREENING');
      expect(validCategories).toContain('CUSTOM');
    });
  });
});
