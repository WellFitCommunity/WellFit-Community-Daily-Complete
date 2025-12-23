/**
 * Patient Education Service Tests
 *
 * Tests for AI-powered patient education content generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
const mockInvoke = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { PatientEducationService } from '../patientEducationService';

describe('PatientEducationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEducation', () => {
    it('should generate education content successfully', async () => {
      const mockResponse = {
        education: {
          title: 'Understanding Diabetes',
          content: 'Diabetes is a condition that affects blood sugar...',
          format: 'article',
          reading_level: '6th grade',
          key_points: ['Monitor blood sugar', 'Take medications'],
          action_items: ['Check levels daily'],
          warnings: ['Call doctor if levels are too high'],
          language: 'English',
        },
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-haiku-4-5-20250919',
          response_time_ms: 150,
          tokens_used: 500,
        },
      };

      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const result = await PatientEducationService.generateEducation({
        topic: 'diabetes',
        language: 'English',
      });

      expect(result.success).toBe(true);
      expect(result.data?.education.title).toBe('Understanding Diabetes');
      expect(result.data?.education.reading_level).toBe('6th grade');
      expect(mockInvoke).toHaveBeenCalledWith('ai-patient-education', expect.any(Object));
    });

    it('should fall back to template when AI fails', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('AI service unavailable'),
      });

      const result = await PatientEducationService.generateEducation({
        topic: 'diabetes_basics',
      });

      expect(result.success).toBe(true);
      expect(result.data?.education.title).toBe('Understanding Diabetes');
      expect(result.data?.metadata.model).toBe('template');
    });

    it('should return failure when no template available and AI fails', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('AI service unavailable'),
      });

      const result = await PatientEducationService.generateEducation({
        topic: 'unknown_rare_condition',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EDUCATION_GENERATION_FAILED');
    });

    it('should include warnings when requested', async () => {
      const mockResponse = {
        education: {
          title: 'Test Topic',
          content: 'Test content',
          format: 'article',
          reading_level: '6th grade',
          key_points: [],
          action_items: [],
          warnings: ['Important warning'],
          language: 'English',
        },
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-haiku-4-5-20250919',
          response_time_ms: 100,
          tokens_used: 200,
        },
      };

      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const result = await PatientEducationService.generateEducation({
        topic: 'test',
        includeWarnings: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.education.warnings).toContain('Important warning');
    });

    it('should respect maxLength parameter', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { education: {}, metadata: {} },
        error: null,
      });

      await PatientEducationService.generateEducation({
        topic: 'test',
        maxLength: 300,
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-patient-education',
        expect.objectContaining({
          body: expect.objectContaining({
            maxLength: 300,
          }),
        })
      );
    });
  });

  describe('getConditionEducation', () => {
    it('should call generateEducation with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { education: {}, metadata: {} },
        error: null,
      });

      await PatientEducationService.getConditionEducation('hypertension', 'Spanish');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-patient-education',
        expect.objectContaining({
          body: expect.objectContaining({
            topic: 'hypertension',
            condition: 'hypertension',
            language: 'Spanish',
            format: 'bullet_points',
            includeWarnings: true,
          }),
        })
      );
    });
  });

  describe('getMedicationEducation', () => {
    it('should generate medication instructions', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { education: {}, metadata: {} },
        error: null,
      });

      await PatientEducationService.getMedicationEducation('Metformin', 'patient-123');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-patient-education',
        expect.objectContaining({
          body: expect.objectContaining({
            topic: 'How to take Metformin',
            patientId: 'patient-123',
            format: 'instructions',
          }),
        })
      );
    });
  });

  describe('getPostProcedureEducation', () => {
    it('should generate post-procedure instructions', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { education: {}, metadata: {} },
        error: null,
      });

      await PatientEducationService.getPostProcedureEducation('knee replacement');

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-patient-education',
        expect.objectContaining({
          body: expect.objectContaining({
            topic: 'Care after knee replacement',
            format: 'instructions',
          }),
        })
      );
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available template topics', () => {
      const templates = PatientEducationService.getAvailableTemplates();

      expect(templates).toContain('medication_adherence');
      expect(templates).toContain('fall_prevention');
      expect(templates).toContain('diabetes_basics');
      expect(templates).toContain('heart_health');
      expect(templates.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getTemplate', () => {
    it('should return template for known topic', () => {
      const template = PatientEducationService.getTemplate('medication_adherence');

      expect(template).not.toBeNull();
      expect(template?.title).toBe('Taking Your Medications Correctly');
      expect(template?.key_points).toHaveLength(3);
    });

    it('should normalize topic to snake_case', () => {
      const template = PatientEducationService.getTemplate('Medication Adherence');

      expect(template).not.toBeNull();
      expect(template?.title).toBe('Taking Your Medications Correctly');
    });

    it('should return null for unknown topic', () => {
      const template = PatientEducationService.getTemplate('unknown_topic');

      expect(template).toBeNull();
    });
  });
});
