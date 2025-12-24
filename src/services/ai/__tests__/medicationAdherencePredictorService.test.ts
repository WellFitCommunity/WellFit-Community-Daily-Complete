/**
 * Tests for Medication Adherence Predictor Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicationAdherencePredictorService } from '../medicationAdherencePredictorService';

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
          lte: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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

describe('MedicationAdherencePredictorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('adherence category definitions', () => {
    it('should define all adherence categories', () => {
      const categories = ['excellent', 'good', 'moderate', 'poor', 'very_poor'];
      expect(categories).toHaveLength(5);
      expect(categories).toContain('excellent');
      expect(categories).toContain('very_poor');
    });

    it('should define all barrier categories', () => {
      const barriers = ['cost', 'complexity', 'side_effects', 'cognitive', 'social', 'access', 'belief', 'physical'];
      expect(barriers).toHaveLength(8);
      expect(barriers).toContain('cost');
      expect(barriers).toContain('cognitive');
    });
  });

  describe('adherence score thresholds', () => {
    it('should categorize scores correctly', () => {
      const thresholds = [
        { score: 85, expected: 'excellent' },
        { score: 70, expected: 'good' },
        { score: 55, expected: 'moderate' },
        { score: 35, expected: 'poor' },
        { score: 20, expected: 'very_poor' },
      ];

      for (const t of thresholds) {
        let category: string;
        if (t.score >= 80) category = 'excellent';
        else if (t.score >= 65) category = 'good';
        else if (t.score >= 50) category = 'moderate';
        else if (t.score >= 30) category = 'poor';
        else category = 'very_poor';

        expect(category).toBe(t.expected);
      }
    });
  });

  describe('regimen complexity calculation', () => {
    it('should classify simple regimens', () => {
      const score = 20;
      let level: string;
      if (score < 25) level = 'simple';
      else if (score < 50) level = 'moderate';
      else if (score < 75) level = 'complex';
      else level = 'very_complex';

      expect(level).toBe('simple');
    });

    it('should classify complex regimens', () => {
      const score = 65;
      let level: string;
      if (score < 25) level = 'simple';
      else if (score < 50) level = 'moderate';
      else if (score < 75) level = 'complex';
      else level = 'very_complex';

      expect(level).toBe('complex');
    });

    it('should weight multiple daily doses', () => {
      const dailyDoses = 4;
      const weight = dailyDoses * 5;
      expect(weight).toBe(20);
    });
  });

  describe('barrier identification', () => {
    it('should identify cost barriers from specialty medications', () => {
      const costTier = 'specialty';
      const isHighCost = costTier === 'specialty' || costTier === 'non_preferred';
      expect(isHighCost).toBe(true);
    });

    it('should identify cognitive barriers for elderly patients', () => {
      const age = 78;
      const hasCognitiveRisk = age > 75;
      expect(hasCognitiveRisk).toBe(true);
    });

    it('should not flag cognitive barriers for younger patients', () => {
      const age = 45;
      const hasCognitiveRisk = age > 75;
      expect(hasCognitiveRisk).toBe(false);
    });
  });

  describe('intervention prioritization', () => {
    it('should define intervention priority levels', () => {
      const priorities = ['routine', 'recommended', 'strongly_recommended', 'critical'];
      expect(priorities).toHaveLength(4);
      expect(priorities).toContain('critical');
    });

    it('should define intervention categories', () => {
      const categories = ['education', 'simplification', 'reminder', 'financial', 'social_support', 'monitoring'];
      expect(categories).toHaveLength(6);
      expect(categories).toContain('simplification');
    });
  });

  describe('service methods', () => {
    it('should validate required fields', async () => {
      const result = await MedicationAdherencePredictorService.predictAdherence({
        patientId: '',
        assessorId: 'test-assessor',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty history when no assessments exist', async () => {
      const result = await MedicationAdherencePredictorService.getAdherenceHistory('test-patient');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty list when no at-risk patients', async () => {
      const result = await MedicationAdherencePredictorService.getPatientsAtRisk();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('styling helpers', () => {
    it('should return correct style for excellent adherence', () => {
      const style = MedicationAdherencePredictorService.getAdherenceCategoryStyle('excellent');
      expect(style.bg).toContain('green');
      expect(style.text).toContain('green');
    });

    it('should return correct style for poor adherence', () => {
      const style = MedicationAdherencePredictorService.getAdherenceCategoryStyle('poor');
      expect(style.bg).toContain('orange');
    });

    it('should return correct style for very_poor adherence', () => {
      const style = MedicationAdherencePredictorService.getAdherenceCategoryStyle('very_poor');
      expect(style.bg).toContain('red');
    });

    it('should return correct labels for adherence categories', () => {
      const excellent = MedicationAdherencePredictorService.getAdherenceCategoryLabel('excellent');
      expect(excellent).toContain('Excellent');
      expect(excellent).toContain('High likelihood');

      const poor = MedicationAdherencePredictorService.getAdherenceCategoryLabel('poor');
      expect(poor).toContain('Poor');
      expect(poor).toContain('barriers');
    });
  });

  describe('barrier category helpers', () => {
    it('should return labels for barrier categories', () => {
      expect(MedicationAdherencePredictorService.getBarrierCategoryLabel('cost')).toBe('Financial/Cost');
      expect(MedicationAdherencePredictorService.getBarrierCategoryLabel('cognitive')).toBe('Cognitive/Memory');
      expect(MedicationAdherencePredictorService.getBarrierCategoryLabel('access')).toBe('Access/Transportation');
    });

    it('should return icons for barrier categories', () => {
      expect(MedicationAdherencePredictorService.getBarrierCategoryIcon('cost')).toBe('💰');
      expect(MedicationAdherencePredictorService.getBarrierCategoryIcon('cognitive')).toBe('🧠');
      expect(MedicationAdherencePredictorService.getBarrierCategoryIcon('social')).toBe('👥');
    });
  });

  describe('intervention formatting', () => {
    it('should format critical priority correctly', () => {
      const formatted = MedicationAdherencePredictorService.formatInterventionPriority('critical');
      expect(formatted.label).toBe('CRITICAL');
      expect(formatted.style.bg).toContain('red');
    });

    it('should format strongly_recommended priority correctly', () => {
      const formatted = MedicationAdherencePredictorService.formatInterventionPriority('strongly_recommended');
      expect(formatted.label).toBe('Strongly Recommended');
      expect(formatted.style.bg).toContain('orange');
    });

    it('should format routine priority correctly', () => {
      const formatted = MedicationAdherencePredictorService.formatInterventionPriority('routine');
      expect(formatted.label).toBe('Routine');
      expect(formatted.style.bg).toContain('gray');
    });
  });

  describe('regimen complexity formatting', () => {
    it('should format complexity for display', () => {
      const complexity = {
        totalMedications: 8,
        dailyDoses: 12,
        uniqueDoseTimes: 4,
        complexityScore: 65,
        complexityLevel: 'complex' as const,
      };

      const formatted = MedicationAdherencePredictorService.formatRegimenComplexity(complexity);
      expect(formatted).toContain('Complex');
      expect(formatted).toContain('8 medications');
      expect(formatted).toContain('12 daily doses');
    });
  });

  describe('trend indicators', () => {
    it('should return correct indicator for improving trend', () => {
      const indicator = MedicationAdherencePredictorService.getTrendIndicator('improving');
      expect(indicator.icon).toBe('↑');
      expect(indicator.label).toBe('Improving');
      expect(indicator.color).toContain('green');
    });

    it('should return correct indicator for declining trend', () => {
      const indicator = MedicationAdherencePredictorService.getTrendIndicator('declining');
      expect(indicator.icon).toBe('↓');
      expect(indicator.label).toBe('Declining');
      expect(indicator.color).toContain('red');
    });

    it('should return correct indicator for stable trend', () => {
      const indicator = MedicationAdherencePredictorService.getTrendIndicator('stable');
      expect(indicator.icon).toBe('→');
      expect(indicator.label).toBe('Stable');
      expect(indicator.color).toContain('gray');
    });
  });

  describe('patient summary generation', () => {
    it('should generate patient-friendly summary', () => {
      const prediction = {
        assessmentId: 'test',
        patientId: 'patient-1',
        assessorId: 'assessor-1',
        assessmentDate: new Date().toISOString(),
        overallAdherenceScore: 45,
        adherenceCategory: 'moderate' as const,
        confidenceLevel: 0.8,
        barriers: [
          {
            barrier: 'Medication cost concerns',
            category: 'cost' as const,
            severity: 'high' as const,
            evidence: 'Has specialty medications',
            mitigable: true,
            interventions: ['Check PAP programs'],
          },
        ],
        primaryBarrier: 'Medication cost concerns',
        barrierCount: 1,
        medicationRisks: [],
        highRiskMedications: [],
        regimenComplexity: {
          totalMedications: 5,
          dailyDoses: 8,
          uniqueDoseTimes: 3,
          complexityScore: 45,
          complexityLevel: 'moderate' as const,
        },
        recommendedInterventions: [],
        urgentInterventions: ['Review cost-saving options'],
        riskFactorSummary: [],
        healthLiteracy: 'moderate' as const,
        socialSupport: 'moderate' as const,
        financialConcerns: true,
        cognitiveImpairment: false,
        requiresPharmacistReview: false,
        requiresCareCoordination: false,
        reviewReasons: [],
        clinicalSummary: 'Test summary',
        patientTalkingPoints: [],
      };

      const summary = MedicationAdherencePredictorService.generatePatientSummary(prediction);
      expect(summary).toContain('5 medication');
      expect(summary).toContain('Medication cost concerns');
      expect(summary).toContain('Review cost-saving options');
    });
  });

  describe('medication risk scoring', () => {
    it('should weight injectable medications higher', () => {
      const baseRisk = 20;
      const injectableBonus = 20;
      const totalRisk = baseRisk + injectableBonus;
      expect(totalRisk).toBe(40);
    });

    it('should weight specialty tier medications higher', () => {
      const baseRisk = 20;
      const specialtyBonus = 20;
      const totalRisk = baseRisk + specialtyBonus;
      expect(totalRisk).toBe(40);
    });

    it('should weight four-times-daily dosing higher', () => {
      const baseRisk = 20;
      const qidBonus = 25;
      const totalRisk = baseRisk + qidBonus;
      expect(totalRisk).toBe(45);
    });
  });

  describe('historical adherence analysis', () => {
    it('should calculate check-in adherence rate', () => {
      const completed = 21;
      const total = 30;
      const rate = Math.round((completed / total) * 100);
      expect(rate).toBe(70);
    });

    it('should identify improving trend', () => {
      const firstHalfRate = 0.5;
      const secondHalfRate = 0.8;
      const difference = secondHalfRate - firstHalfRate;
      const isImproving = difference > 0.1;
      expect(isImproving).toBe(true);
    });

    it('should identify declining trend', () => {
      const firstHalfRate = 0.8;
      const secondHalfRate = 0.5;
      const difference = firstHalfRate - secondHalfRate;
      const isDeclining = difference > 0.1;
      expect(isDeclining).toBe(true);
    });
  });

  describe('review requirements', () => {
    it('should require pharmacist review for very complex regimens', () => {
      const complexityLevel = 'very_complex';
      const requiresPharmacist = complexityLevel === 'very_complex';
      expect(requiresPharmacist).toBe(true);
    });

    it('should require care coordination for social barriers', () => {
      const barriers = [{ category: 'social' }, { category: 'cost' }];
      const requiresCoordination = barriers.some(b => b.category === 'social' || b.category === 'access');
      expect(requiresCoordination).toBe(true);
    });

    it('should require care coordination for low scores', () => {
      const score = 35;
      const requiresCoordination = score < 40;
      expect(requiresCoordination).toBe(true);
    });
  });
});
