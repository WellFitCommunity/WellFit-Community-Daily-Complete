/**
 * Tests for Care Escalation Scorer Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CareEscalationScorerService } from '../careEscalationScorerService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        gte: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CareEscalationScorerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('service methods', () => {
    it('should validate required fields', async () => {
      const result = await CareEscalationScorerService.scorePatient({
        patientId: '',
        assessorId: 'test-assessor',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty history when no assessments exist', async () => {
      const result = await CareEscalationScorerService.getEscalationHistory('test-patient');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty list when no patients require escalation', async () => {
      const result = await CareEscalationScorerService.getPatientsRequiringEscalation();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('styling helpers', () => {
    it('should return correct style for emergency category', () => {
      const style = CareEscalationScorerService.getEscalationCategoryStyle('emergency');
      expect(style.bg).toContain('red');
      expect(style.text).toContain('red');
    });

    it('should return correct style for escalate category', () => {
      const style = CareEscalationScorerService.getEscalationCategoryStyle('escalate');
      expect(style.bg).toContain('orange');
    });

    it('should return correct style for none category', () => {
      const style = CareEscalationScorerService.getEscalationCategoryStyle('none');
      expect(style.bg).toContain('green');
    });

    it('should return correct label for emergency category', () => {
      const label = CareEscalationScorerService.getEscalationCategoryLabel('emergency');
      expect(label).toContain('Emergency');
      expect(label).toContain('Immediate');
    });

    it('should return correct label for escalate category', () => {
      const label = CareEscalationScorerService.getEscalationCategoryLabel('escalate');
      expect(label).toContain('Escalate');
      expect(label).toContain('Physician');
    });
  });
});
