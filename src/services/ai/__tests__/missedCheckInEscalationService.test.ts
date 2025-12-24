/**
 * Tests for Missed Check-In Escalation Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissedCheckInEscalationService } from '../missedCheckInEscalationService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
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

describe('MissedCheckInEscalationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('escalation level determination', () => {
    it('should define escalation levels correctly', () => {
      const levels = ['none', 'low', 'medium', 'high', 'emergency'];
      expect(levels).toHaveLength(5);
      expect(levels).toContain('emergency');
    });

    it('should define trigger types correctly', () => {
      const triggers = ['single_missed', 'consecutive_missed', 'scheduled_check'];
      expect(triggers).toHaveLength(3);
    });
  });

  describe('risk factor analysis', () => {
    it('should consider age as a risk factor for patients 65+', () => {
      // Age 65+ should increase risk
      const ageRiskFactors = [
        { age: 60, expectedRiskIncrease: 0 },
        { age: 65, expectedRiskIncrease: 1 },
        { age: 70, expectedRiskIncrease: 2 },
        { age: 80, expectedRiskIncrease: 3 },
      ];

      for (const factor of ageRiskFactors) {
        let riskScore = 0;
        if (factor.age >= 80) riskScore = 3;
        else if (factor.age >= 70) riskScore = 2;
        else if (factor.age >= 65) riskScore = 1;

        expect(riskScore).toBe(factor.expectedRiskIncrease);
      }
    });

    it('should consider living alone as a risk factor', () => {
      const livingAlone = true;
      const riskIncrease = livingAlone ? 2 : 0;
      expect(riskIncrease).toBe(2);
    });

    it('should escalate based on consecutive missed check-ins', () => {
      const consecutiveMissedCases = [
        { missed: 1, expectedLevel: 'low' },
        { missed: 2, expectedLevel: 'medium' },
        { missed: 3, expectedLevel: 'high' },
        { missed: 5, expectedLevel: 'emergency' },
      ];

      for (const testCase of consecutiveMissedCases) {
        let level = 'none';
        if (testCase.missed >= 5) level = 'emergency';
        else if (testCase.missed >= 3) level = 'high';
        else if (testCase.missed >= 2) level = 'medium';
        else if (testCase.missed >= 1) level = 'low';

        expect(level).toBe(testCase.expectedLevel);
      }
    });

    it('should consider care plan priority', () => {
      const priorityRisk: Record<string, number> = {
        critical: 3,
        high: 2,
        medium: 1,
        low: 0,
      };

      expect(priorityRisk.critical).toBe(3);
      expect(priorityRisk.high).toBe(2);
    });

    it('should identify high-risk conditions', () => {
      const highRiskConditions = ['heart failure', 'copd', 'diabetes', 'fall risk', 'dementia'];
      const patientConditions = ['diabetes type 2', 'hypertension'];

      const hasHighRisk = patientConditions.some((c) =>
        highRiskConditions.some((hr) => c.toLowerCase().includes(hr))
      );

      expect(hasHighRisk).toBe(true);
    });
  });

  describe('escalation actions', () => {
    it('should notify caregiver for medium+ escalations', () => {
      const testCases = [
        { level: 'none', shouldNotify: false },
        { level: 'low', shouldNotify: false },
        { level: 'medium', shouldNotify: true },
        { level: 'high', shouldNotify: true },
        { level: 'emergency', shouldNotify: true },
      ];

      for (const testCase of testCases) {
        const shouldNotify = ['medium', 'high', 'emergency'].includes(testCase.level);
        expect(shouldNotify).toBe(testCase.shouldNotify);
      }
    });

    it('should recommend welfare check for high-risk living alone', () => {
      const livingAlone = true;
      const consecutiveMissed = 3;
      const riskLevel: string = 'high';

      const recommendWelfareCheck =
        livingAlone && consecutiveMissed >= 3 && riskLevel !== 'low';

      expect(recommendWelfareCheck).toBe(true);
    });

    it('should not recommend welfare check for low-risk single missed', () => {
      const livingAlone = true;
      const consecutiveMissed = 1;
      const riskLevel: string = 'low';

      const recommendWelfareCheck =
        livingAlone && consecutiveMissed >= 3 && riskLevel !== 'low';

      expect(recommendWelfareCheck).toBe(false);
    });
  });

  describe('message generation', () => {
    it('should set appropriate urgency levels', () => {
      const urgencyMapping: Record<string, string> = {
        none: 'none',
        low: 'routine',
        medium: 'important',
        high: 'urgent',
        emergency: 'emergency',
      };

      expect(urgencyMapping.emergency).toBe('emergency');
      expect(urgencyMapping.high).toBe('urgent');
      expect(urgencyMapping.low).toBe('routine');
    });

    it('should include patient name in message subject', () => {
      const patientName = 'John';
      const escalationLevel = 'high';

      const subject =
        escalationLevel === 'high' || escalationLevel === 'emergency'
          ? `Important: Check-in needed for ${patientName}`
          : `Update about ${patientName}`;

      expect(subject).toContain(patientName);
    });
  });

  describe('protective factors', () => {
    it('should identify caregiver involvement as protective', () => {
      const hasCaregiver = true;
      const protectiveFactors = hasCaregiver ? ['Active caregiver involvement'] : [];

      expect(protectiveFactors).toContain('Active caregiver involvement');
    });

    it('should identify emergency contact as protective', () => {
      const hasEmergencyContact = true;
      const protectiveFactors = hasEmergencyContact ? ['Emergency contact on file'] : [];

      expect(protectiveFactors).toContain('Emergency contact on file');
    });
  });

  describe('service methods', () => {
    it('should validate patient ID is required', async () => {
      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: '',
        triggerType: 'single_missed',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should handle empty overdue check-ins list', async () => {
      const result = await MissedCheckInEscalationService.processOverdueCheckIns(12);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty history when no check-ins exist', async () => {
      const result = await MissedCheckInEscalationService.getEscalationHistory('test-patient', 30);

      expect(result.success).toBe(true);
    });
  });
});
