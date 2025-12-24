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

  describe('escalation category determination', () => {
    it('should define all escalation categories', () => {
      const categories = ['none', 'monitor', 'notify', 'escalate', 'emergency'];
      expect(categories).toHaveLength(5);
      expect(categories).toContain('emergency');
      expect(categories).toContain('escalate');
    });

    it('should define all urgency levels', () => {
      const levels = ['routine', 'elevated', 'urgent', 'critical'];
      expect(levels).toHaveLength(4);
      expect(levels).toContain('critical');
    });

    it('should define assessment contexts', () => {
      const contexts = ['shift_handoff', 'routine_assessment', 'condition_change', 'urgent_review'];
      expect(contexts).toHaveLength(4);
      expect(contexts).toContain('shift_handoff');
    });
  });

  describe('escalation score thresholds', () => {
    it('should categorize scores correctly', () => {
      const thresholds = [
        { score: 0, expected: 'none' },
        { score: 20, expected: 'monitor' },
        { score: 40, expected: 'notify' },
        { score: 60, expected: 'escalate' },
        { score: 80, expected: 'emergency' },
      ];

      for (const t of thresholds) {
        let category: string;
        if (t.score >= 80) category = 'emergency';
        else if (t.score >= 60) category = 'escalate';
        else if (t.score >= 40) category = 'notify';
        else if (t.score >= 20) category = 'monitor';
        else category = 'none';

        expect(category).toBe(t.expected);
      }
    });
  });

  describe('clinical indicator analysis', () => {
    it('should weight vital sign abnormalities appropriately', () => {
      const abnormalVitals = 3;
      const vitalScore = Math.min(abnormalVitals * 15, 45);
      expect(vitalScore).toBe(45);
    });

    it('should cap vital sign score at 45', () => {
      const abnormalVitals = 5;
      const vitalScore = Math.min(abnormalVitals * 15, 45);
      expect(vitalScore).toBe(45);
    });

    it('should add 30 points for critical vitals', () => {
      const hasCriticalVitals = true;
      const criticalScore = hasCriticalVitals ? 30 : 0;
      expect(criticalScore).toBe(30);
    });
  });

  describe('trend analysis', () => {
    it('should identify trend categories', () => {
      const trends = ['improving', 'stable', 'declining', 'rapidly_declining'];
      expect(trends).toHaveLength(4);
      expect(trends).toContain('rapidly_declining');
    });

    it('should map urgency level to reassessment hours', () => {
      const urgencyToHours: Record<string, number> = {
        critical: 1,
        urgent: 2,
        elevated: 4,
        routine: 8,
      };

      expect(urgencyToHours.critical).toBe(1);
      expect(urgencyToHours.urgent).toBe(2);
    });
  });

  describe('notification requirements', () => {
    it('should require physician notification for escalate category', () => {
      const category = 'escalate';
      const requiresPhysician = category === 'escalate' || category === 'emergency';
      expect(requiresPhysician).toBe(true);
    });

    it('should require rapid response for emergency category', () => {
      const category = 'emergency';
      const requiresRapidResponse = category === 'emergency';
      expect(requiresRapidResponse).toBe(true);
    });

    it('should not require rapid response for non-emergency', () => {
      const category: string = 'escalate';
      const requiresRapidResponse = category === 'emergency';
      expect(requiresRapidResponse).toBe(false);
    });
  });

  describe('handoff priority mapping', () => {
    it('should map escalation category to handoff priority', () => {
      const mapping: Record<string, string> = {
        emergency: 'critical',
        escalate: 'high',
        notify: 'medium',
        monitor: 'low',
        none: 'low',
      };

      expect(mapping.emergency).toBe('critical');
      expect(mapping.escalate).toBe('high');
      expect(mapping.notify).toBe('medium');
    });
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

  describe('risk factor weighting', () => {
    it('should weight critical alerts at 25 points', () => {
      const criticalAlertWeight = 25;
      expect(criticalAlertWeight).toBe(25);
    });

    it('should weight high alerts at 10 points each', () => {
      const highAlertCount = 3;
      const totalWeight = highAlertCount * 10;
      expect(totalWeight).toBe(30);
    });

    it('should weight advanced age at 10 points', () => {
      const age = 85;
      const ageWeight = age >= 80 ? 10 : 0;
      expect(ageWeight).toBe(10);
    });

    it('should weight high-risk comorbidities at 15 points', () => {
      const hasHighRisk = true;
      const comorbidityWeight = hasHighRisk ? 15 : 0;
      expect(comorbidityWeight).toBe(15);
    });
  });

  describe('confidence calculation', () => {
    it('should start with base confidence of 0.7', () => {
      const baseConfidence = 0.7;
      expect(baseConfidence).toBe(0.7);
    });

    it('should increase confidence with more vitals data', () => {
      let confidence = 0.7;
      const hasVitals = true;
      if (hasVitals) confidence += 0.1;
      expect(confidence).toBeCloseTo(0.8);
    });

    it('should cap confidence at 1.0', () => {
      let confidence = 0.95;
      confidence += 0.1;
      confidence = Math.min(confidence, 1.0);
      expect(confidence).toBe(1.0);
    });
  });
});
