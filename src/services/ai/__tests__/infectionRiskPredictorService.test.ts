/**
 * Tests for Infection Risk Predictor (HAI) Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfectionRiskPredictorService } from '../infectionRiskPredictorService';

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
          })),
        })),
        gte: vi.fn(() => ({
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

describe('InfectionRiskPredictorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('service methods', () => {
    it('should validate required fields', async () => {
      const result = await InfectionRiskPredictorService.predictRisk({
        patientId: '',
        assessorId: 'test-assessor',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty history when no assessments exist', async () => {
      const result = await InfectionRiskPredictorService.getInfectionRiskHistory('test-patient');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('styling helpers', () => {
    it('should return correct style for very_high risk', () => {
      const style = InfectionRiskPredictorService.getRiskCategoryStyle('very_high');
      expect(style.bg).toContain('red');
      expect(style.text).toContain('red');
    });

    it('should return correct style for high risk', () => {
      const style = InfectionRiskPredictorService.getRiskCategoryStyle('high');
      expect(style.bg).toContain('orange');
    });

    it('should return correct style for low risk', () => {
      const style = InfectionRiskPredictorService.getRiskCategoryStyle('low');
      expect(style.bg).toContain('green');
    });
  });

  describe('HAI type labels', () => {
    it('should return full label for CLABSI', () => {
      const label = InfectionRiskPredictorService.getHAITypeLabel('clabsi');
      expect(label).toContain('Central Line');
      expect(label).toContain('Bloodstream');
    });

    it('should return full label for CAUTI', () => {
      const label = InfectionRiskPredictorService.getHAITypeLabel('cauti');
      expect(label).toContain('Catheter');
      expect(label).toContain('Urinary');
    });

    it('should return full label for VAP', () => {
      const label = InfectionRiskPredictorService.getHAITypeLabel('vap');
      expect(label).toContain('Ventilator');
      expect(label).toContain('Pneumonia');
    });

    it('should return short labels correctly', () => {
      expect(InfectionRiskPredictorService.getHAITypeShortLabel('clabsi')).toBe('CLABSI');
      expect(InfectionRiskPredictorService.getHAITypeShortLabel('cauti')).toBe('CAUTI');
      expect(InfectionRiskPredictorService.getHAITypeShortLabel('vap')).toBe('VAP');
      expect(InfectionRiskPredictorService.getHAITypeShortLabel('ssi')).toBe('SSI');
      expect(InfectionRiskPredictorService.getHAITypeShortLabel('cdiff')).toBe('C. diff');
    });
  });

  describe('prevention bundle formatting', () => {
    it('should sort interventions by priority', () => {
      const interventions = [
        { intervention: 'Routine check', priority: 'routine' as const, category: 'monitoring' as const, frequency: 'Daily', responsible: 'Nurse', evidenceLevel: 'B' as const, estimatedRiskReduction: 10 },
        { intervention: 'Mandatory action', priority: 'mandatory' as const, category: 'bundle_element' as const, frequency: 'Daily', responsible: 'Nurse', evidenceLevel: 'A' as const, estimatedRiskReduction: 30 },
      ];

      const formatted = InfectionRiskPredictorService.formatPreventionBundle(interventions);
      expect(formatted[0]).toContain('[MANDATORY]');
    });
  });

});
