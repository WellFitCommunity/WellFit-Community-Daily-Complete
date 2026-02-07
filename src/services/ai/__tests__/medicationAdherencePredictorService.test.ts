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

});
