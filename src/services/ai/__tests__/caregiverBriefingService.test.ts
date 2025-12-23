/**
 * Caregiver Briefing Service Tests
 *
 * Tests for AI-powered caregiver briefing generation.
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

import { CaregiverBriefingService } from '../caregiverBriefingService';

describe('CaregiverBriefingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBriefingResponse = {
    briefing: {
      greeting: 'Good morning, Sarah!',
      summary: 'Your mother had a good day today.',
      health_highlights: [
        'Blood pressure normal',
        'Completed morning exercises',
      ],
      check_in_summary: {
        total: 3,
        completed: 2,
        average_wellness: 7.5,
        concerns: [],
      },
      care_plan_progress: 'On track with medication schedule',
      upcoming_items: ['Doctor appointment Friday'],
      action_items: ['Remind about physical therapy'],
      encouragement: "Keep up the great care you're providing!",
    },
    metadata: {
      generated_at: new Date().toISOString(),
      briefing_type: 'daily',
      language: 'English',
      response_time_ms: 200,
    },
  };

  describe('generateBriefing', () => {
    it('should generate daily briefing successfully', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBriefingResponse, error: null });

      const result = await CaregiverBriefingService.generateBriefing({
        patientId: 'patient-123',
        caregiverId: 'caregiver-456',
        caregiverName: 'Sarah',
        briefingType: 'daily',
      });

      expect(result.success).toBe(true);
      expect(result.data?.briefing.greeting).toContain('Sarah');
      expect(result.data?.metadata.briefing_type).toBe('daily');
    });

    it('should call edge function with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBriefingResponse, error: null });

      await CaregiverBriefingService.generateBriefing({
        patientId: 'patient-123',
        caregiverId: 'caregiver-456',
        caregiverName: 'John',
        briefingType: 'weekly',
        language: 'Spanish',
      });

      expect(mockInvoke).toHaveBeenCalledWith('ai-caregiver-briefing', {
        body: {
          patientId: 'patient-123',
          caregiverId: 'caregiver-456',
          caregiverName: 'John',
          briefingType: 'weekly',
          language: 'Spanish',
        },
      });
    });

    it('should use default values for optional parameters', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBriefingResponse, error: null });

      await CaregiverBriefingService.generateBriefing({
        patientId: 'patient-123',
        caregiverId: 'caregiver-456',
      });

      expect(mockInvoke).toHaveBeenCalledWith('ai-caregiver-briefing', {
        body: {
          patientId: 'patient-123',
          caregiverId: 'caregiver-456',
          caregiverName: 'Caregiver',
          briefingType: 'daily',
          language: 'English',
        },
      });
    });

    it('should return failure on error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Service unavailable'),
      });

      const result = await CaregiverBriefingService.generateBriefing({
        patientId: 'patient-123',
        caregiverId: 'caregiver-456',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BRIEFING_GENERATION_FAILED');
    });
  });

  describe('generateDailyBriefing', () => {
    it('should call generateBriefing with daily type', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBriefingResponse, error: null });

      await CaregiverBriefingService.generateDailyBriefing(
        'patient-123',
        'caregiver-456',
        'Sarah'
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-caregiver-briefing',
        expect.objectContaining({
          body: expect.objectContaining({
            briefingType: 'daily',
          }),
        })
      );
    });
  });

  describe('generateWeeklySummary', () => {
    it('should call generateBriefing with weekly type', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBriefingResponse, error: null });

      await CaregiverBriefingService.generateWeeklySummary(
        'patient-123',
        'caregiver-456'
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-caregiver-briefing',
        expect.objectContaining({
          body: expect.objectContaining({
            briefingType: 'weekly',
          }),
        })
      );
    });
  });

  describe('generateUrgentUpdate', () => {
    it('should call generateBriefing with urgent type', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockBriefingResponse, error: null });

      await CaregiverBriefingService.generateUrgentUpdate(
        'patient-123',
        'caregiver-456',
        'Family Member'
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-caregiver-briefing',
        expect.objectContaining({
          body: expect.objectContaining({
            briefingType: 'urgent',
            caregiverName: 'Family Member',
          }),
        })
      );
    });
  });

  describe('formatForSMS', () => {
    it('should format briefing for SMS delivery', () => {
      const sms = CaregiverBriefingService.formatForSMS(mockBriefingResponse.briefing);

      expect(sms).toContain('Good morning, Sarah!');
      expect(sms).toContain('Your mother had a good day today.');
      expect(sms).toContain('Upcoming:');
      expect(sms).toContain('Doctor appointment Friday');
      expect(sms).toContain("Keep up the great care");
    });

    it('should truncate to SMS length limit', () => {
      const longBriefing = {
        ...mockBriefingResponse.briefing,
        summary: 'A'.repeat(500),
      };

      const sms = CaregiverBriefingService.formatForSMS(longBriefing);

      expect(sms.length).toBeLessThanOrEqual(480);
    });

    it('should handle empty upcoming items', () => {
      const briefingNoUpcoming = {
        ...mockBriefingResponse.briefing,
        upcoming_items: [],
      };

      const sms = CaregiverBriefingService.formatForSMS(briefingNoUpcoming);

      expect(sms).not.toContain('Upcoming:');
    });
  });

  describe('formatForEmail', () => {
    it('should format briefing for email delivery', () => {
      const email = CaregiverBriefingService.formatForEmail(mockBriefingResponse.briefing);

      expect(email.subject).toContain('Daily Update');
      expect(email.body).toContain('Good morning, Sarah!');
      expect(email.body).toContain('Health Highlights:');
      expect(email.body).toContain('Blood pressure normal');
      expect(email.body).toContain('Check-In Summary:');
      expect(email.body).toContain('2 of 3 check-ins completed');
      expect(email.body).toContain('Care Plan Progress:');
      expect(email.body).toContain('What You Can Do:');
      expect(email.body).toContain('WellFit care team');
    });

    it('should include average wellness score when available', () => {
      const email = CaregiverBriefingService.formatForEmail(mockBriefingResponse.briefing);

      expect(email.body).toContain('Average wellness score: 7.5/10');
    });

    it('should handle null wellness score', () => {
      const briefingNoWellness = {
        ...mockBriefingResponse.briefing,
        check_in_summary: {
          ...mockBriefingResponse.briefing.check_in_summary,
          average_wellness: null,
        },
      };

      const email = CaregiverBriefingService.formatForEmail(briefingNoWellness);

      expect(email.body).not.toContain('Average wellness score:');
    });

    it('should extract subject from first sentence', () => {
      const briefing = {
        ...mockBriefingResponse.briefing,
        summary: 'Mom had a great day. She completed all exercises.',
      };

      const email = CaregiverBriefingService.formatForEmail(briefing);

      expect(email.subject).toBe('Daily Update: Mom had a great day');
    });
  });
});
