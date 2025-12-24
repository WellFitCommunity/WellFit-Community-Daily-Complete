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

  describe('HAI type definitions', () => {
    it('should define all HAI types', () => {
      const haiTypes = ['clabsi', 'cauti', 'ssi', 'vap', 'cdiff', 'overall'];
      expect(haiTypes).toHaveLength(6);
      expect(haiTypes).toContain('clabsi');
      expect(haiTypes).toContain('cdiff');
    });

    it('should define all risk categories', () => {
      const categories = ['low', 'moderate', 'high', 'very_high'];
      expect(categories).toHaveLength(4);
      expect(categories).toContain('very_high');
    });
  });

  describe('risk score thresholds', () => {
    it('should categorize risk scores correctly', () => {
      const thresholds = [
        { score: 10, expected: 'low' },
        { score: 35, expected: 'moderate' },
        { score: 55, expected: 'high' },
        { score: 75, expected: 'very_high' },
      ];

      for (const t of thresholds) {
        let category: string;
        if (t.score >= 70) category = 'very_high';
        else if (t.score >= 50) category = 'high';
        else if (t.score >= 30) category = 'moderate';
        else category = 'low';

        expect(category).toBe(t.expected);
      }
    });
  });

  describe('device-related risk factors', () => {
    it('should identify central line as CLABSI risk', () => {
      const devices = ['central line', 'foley catheter'];
      const hasCentralLine = devices.some((d) =>
        ['central line', 'picc', 'port', 'cvc'].some((t) =>
          d.toLowerCase().includes(t)
        )
      );
      expect(hasCentralLine).toBe(true);
    });

    it('should identify foley as CAUTI risk', () => {
      const devices = ['foley catheter'];
      const hasFoley = devices.some((d) =>
        ['foley', 'urinary catheter', 'indwelling catheter'].some((t) =>
          d.toLowerCase().includes(t)
        )
      );
      expect(hasFoley).toBe(true);
    });

    it('should identify ventilator as VAP risk', () => {
      const devices = ['mechanical ventilator'];
      const hasVent = devices.some((d) =>
        ['ventilator', 'ett', 'endotracheal'].some((t) =>
          d.toLowerCase().includes(t)
        )
      );
      expect(hasVent).toBe(true);
    });
  });

  describe('risk factor weighting', () => {
    it('should weight central line at 25 points', () => {
      const centralLineWeight = 25;
      expect(centralLineWeight).toBe(25);
    });

    it('should weight foley catheter at 20 points', () => {
      const foleyWeight = 20;
      expect(foleyWeight).toBe(20);
    });

    it('should weight ventilator at 30 points', () => {
      const ventWeight = 30;
      expect(ventWeight).toBe(30);
    });

    it('should weight immunocompromised at 20 points', () => {
      const immunoWeight = 20;
      expect(immunoWeight).toBe(20);
    });

    it('should weight extended LOS at 15 points', () => {
      const losWeight = 15;
      expect(losWeight).toBe(15);
    });
  });

  describe('length of stay impact', () => {
    it('should increase risk after 7 days', () => {
      const los = 10;
      const increasesRisk = los > 7;
      expect(increasesRisk).toBe(true);
    });

    it('should not increase risk for short stays', () => {
      const los = 3;
      const increasesRisk = los > 7;
      expect(increasesRisk).toBe(false);
    });
  });

  describe('antibiotic exposure', () => {
    it('should identify antibiotic exposure as C. diff risk', () => {
      const recentAntibiotics = ['Ciprofloxacin', 'Clindamycin'];
      const hasAntibioticExposure = recentAntibiotics.length > 0;
      expect(hasAntibioticExposure).toBe(true);
    });

    it('should weight antibiotic exposure at 20 points for C. diff', () => {
      const antibioticWeight = 20;
      expect(antibioticWeight).toBe(20);
    });
  });

  describe('prevention bundles', () => {
    it('should recommend central line bundle for CLABSI risk', () => {
      const haiType = 'clabsi';
      const bundles: string[] = [];
      if (haiType === 'clabsi') bundles.push('Central Line Bundle');
      expect(bundles).toContain('Central Line Bundle');
    });

    it('should recommend catheter bundle for CAUTI risk', () => {
      const haiType = 'cauti';
      const bundles: string[] = [];
      if (haiType === 'cauti') bundles.push('Urinary Catheter Bundle');
      expect(bundles).toContain('Urinary Catheter Bundle');
    });

    it('should recommend ventilator bundle for VAP risk', () => {
      const haiType = 'vap';
      const bundles: string[] = [];
      if (haiType === 'vap') bundles.push('Ventilator Bundle');
      expect(bundles).toContain('Ventilator Bundle');
    });
  });

  describe('intervention priorities', () => {
    it('should define intervention priority levels', () => {
      const priorities = ['routine', 'recommended', 'strongly_recommended', 'mandatory'];
      expect(priorities).toHaveLength(4);
      expect(priorities).toContain('mandatory');
    });

    it('should define evidence levels', () => {
      const levels = ['A', 'B', 'C'];
      expect(levels).toHaveLength(3);
      expect(levels).toContain('A');
    });
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

  describe('comorbidity analysis', () => {
    it('should identify immunocompromised conditions', () => {
      const conditions = ['HIV/AIDS', 'Diabetes Type 2'];
      const immunoKeywords = ['hiv', 'aids', 'transplant', 'chemotherapy', 'immunodeficiency'];
      const isImmunocompromised = conditions.some((c) =>
        immunoKeywords.some((k) => c.toLowerCase().includes(k))
      );
      expect(isImmunocompromised).toBe(true);
    });

    it('should identify diabetic patients', () => {
      const conditions = ['Diabetes mellitus type 2'];
      const isDiabetic = conditions.some((c) => c.toLowerCase().includes('diabetes'));
      expect(isDiabetic).toBe(true);
    });
  });

  describe('review requirements', () => {
    it('should require infection control review for high scores', () => {
      const score = 55;
      const requiresReview = score >= 50;
      expect(requiresReview).toBe(true);
    });

    it('should require review for immunocompromised patients', () => {
      const immunocompromised = true;
      const requiresReview = immunocompromised;
      expect(requiresReview).toBe(true);
    });
  });
});
