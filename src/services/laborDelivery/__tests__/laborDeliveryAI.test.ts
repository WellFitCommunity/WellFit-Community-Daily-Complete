/**
 * L&D AI Service Tests
 * Tier 2-3: Tests AI service function behavior, error handling, and type safety
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  requestEscalationScore,
  generateLaborProgressNote,
  checkLDDrugInteraction,
  generateDischargeSummary,
} from '../laborDeliveryAI';

describe('laborDeliveryAI service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestEscalationScore', () => {
    it('calls ai-care-escalation-scorer edge function with correct params', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          assessment: {
            assessmentId: 'esc-1',
            overallEscalationScore: 45,
            confidenceLevel: 0.9,
            escalationCategory: 'monitor',
            urgencyLevel: 'elevated',
            recommendations: [],
            requiredNotifications: [],
            requiresPhysicianReview: false,
            requiresRapidResponse: false,
            clinicalSummary: 'Stable monitoring',
            hoursToReassess: 4,
          },
        },
        error: null,
      });

      const result = await requestEscalationScore('p1', 'a1', 'FHR Category II');
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('ai-care-escalation-scorer', {
        body: {
          patientId: 'p1',
          assessorId: 'a1',
          context: 'condition_change',
          triggerReason: 'FHR Category II',
        },
      });
      if (result.success) {
        expect(result.data.overallEscalationScore).toBe(45);
        expect(result.data.escalationCategory).toBe('monitor');
      }
    });

    it('returns failure on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Function timeout' },
      });

      const result = await requestEscalationScore('p1', 'a1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_SERVICE_ERROR');
      }
    });

    it('returns failure when no assessment is returned', async () => {
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      const result = await requestEscalationScore('p1', 'a1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('No assessment returned');
      }
    });
  });

  describe('generateLaborProgressNote', () => {
    it('calls ai-progress-note-synthesizer with L&D focus areas', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          note: {
            subjective: 'Patient contracting',
            objective: 'Cervix 5cm',
            assessment: 'Active labor',
            plan: 'Continue monitoring',
          },
          metadata: { model: 'claude-haiku-4-5' },
        },
        error: null,
      });

      const result = await generateLaborProgressNote('p1', 'dr1');
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('ai-progress-note-synthesizer', {
        body: expect.objectContaining({
          patientId: 'p1',
          providerId: 'dr1',
          focusAreas: expect.arrayContaining(['labor progress', 'fetal monitoring']),
        }),
      });
      if (result.success) {
        expect(result.data.subjective).toBe('Patient contracting');
        expect(result.data.objective).toBe('Cervix 5cm');
      }
    });

    it('returns failure on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Model unavailable' },
      });

      const result = await generateLaborProgressNote('p1', 'dr1');
      expect(result.success).toBe(false);
    });
  });

  describe('checkLDDrugInteraction', () => {
    it('calls check-drug-interactions with pregnancy context', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          has_interactions: false,
          interactions: [],
          checked_against: ['Pitocin'],
        },
        error: null,
      });

      const result = await checkLDDrugInteraction('Fentanyl', 'p1');
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('check-drug-interactions', {
        body: expect.objectContaining({
          patient_id: 'p1',
          medication_name: 'Fentanyl',
          patientConditions: ['pregnancy', 'labor'],
          suggestAlternatives: true,
        }),
      });
    });

    it('includes RxCUI code for known L&D medications', async () => {
      mockInvoke.mockResolvedValue({
        data: { has_interactions: false, interactions: [], checked_against: [] },
        error: null,
      });

      await checkLDDrugInteraction('Magnesium Sulfate', 'p1');
      expect(mockInvoke).toHaveBeenCalledWith('check-drug-interactions', {
        body: expect.objectContaining({
          medication_rxcui: '6585',
        }),
      });
    });

    it('handles unknown medication names with empty RxCUI', async () => {
      mockInvoke.mockResolvedValue({
        data: { has_interactions: false, interactions: [], checked_against: [] },
        error: null,
      });

      await checkLDDrugInteraction('Some Unknown Med', 'p1');
      expect(mockInvoke).toHaveBeenCalledWith('check-drug-interactions', {
        body: expect.objectContaining({
          medication_rxcui: '',
        }),
      });
    });
  });

  describe('generateDischargeSummary', () => {
    it('calls ai-discharge-summary with patient instructions enabled', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          summary: {
            hospitalCourse: 'Routine delivery',
            diagnoses: [],
            procedures: [],
            medications: [],
            followUpInstructions: [],
            warningSignsMother: [],
            warningSignsNewborn: [],
            patientEducation: [],
          },
          metadata: { confidence: 0.92 },
        },
        error: null,
      });

      const result = await generateDischargeSummary('p1', 't1');
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('ai-discharge-summary', {
        body: expect.objectContaining({
          patientId: 'p1',
          tenantId: 't1',
          includePatientInstructions: true,
        }),
      });
      if (result.success) {
        expect(result.data.confidenceScore).toBe(0.92);
        expect(result.data.requiresReview).toBe(true);
      }
    });

    it('returns failure when no summary data returned', async () => {
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      const result = await generateDischargeSummary('p1', 't1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('No discharge summary returned');
      }
    });
  });
});
