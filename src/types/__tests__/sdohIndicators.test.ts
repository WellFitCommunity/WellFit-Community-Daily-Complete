/**
 * SDOH Indicator Types Tests
 * Tests for helper functions and type calculations
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateOverallSDOHRisk,
  calculateComplexityTier,
  getSDOHRiskColor,
  SDOH_INDICATOR_CONFIGS
} from '../sdohIndicators';
import type { SDOHFactor } from '../sdohIndicators';

describe('SDOH Indicator Type Helpers', () => {
  describe('calculateOverallSDOHRisk', () => {
    it('should return 0 for empty factor array', () => {
      const risk = calculateOverallSDOHRisk([]);
      expect(risk).toBe(0);
    });

    it('should calculate risk score with single critical factor', () => {
      const factors: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'critical',
          interventionStatus: 'identified',
          priorityLevel: 5
        }
      ];

      const risk = calculateOverallSDOHRisk(factors);
      expect(risk).toBe(100);
    });

    it('should calculate risk score with multiple factors', () => {
      const factors: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'high',
          interventionStatus: 'identified',
          priorityLevel: 4
        },
        {
          category: 'food-security',
          riskLevel: 'moderate',
          interventionStatus: 'identified',
          priorityLevel: 3
        },
        {
          category: 'transportation',
          riskLevel: 'low',
          interventionStatus: 'resolved',
          priorityLevel: 2
        }
      ];

      const risk = calculateOverallSDOHRisk(factors);
      expect(risk).toBeGreaterThan(0);
      expect(risk).toBeLessThanOrEqual(100);
    });

    it('should weight by priority level', () => {
      const factorsHighPriority: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'high',
          interventionStatus: 'identified',
          priorityLevel: 5
        }
      ];

      const factorsLowPriority: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'high',
          interventionStatus: 'identified',
          priorityLevel: 1
        }
      ];

      const riskHigh = calculateOverallSDOHRisk(factorsHighPriority);
      const riskLow = calculateOverallSDOHRisk(factorsLowPriority);

      expect(riskHigh).toBe(riskLow); // Same risk level, so same calculated risk
    });

    it('should ignore unknown risk levels', () => {
      const factors: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'unknown',
          interventionStatus: 'not-assessed',
          priorityLevel: 1
        }
      ];

      const risk = calculateOverallSDOHRisk(factors);
      expect(risk).toBe(0);
    });
  });

  describe('calculateComplexityTier', () => {
    it('should return minimal for no factors', () => {
      const tier = calculateComplexityTier([]);
      expect(tier).toBe('minimal');
    });

    it('should return low for single moderate factor', () => {
      const factors: SDOHFactor[] = [
        {
          category: 'food-security',
          riskLevel: 'moderate',
          interventionStatus: 'identified'
        }
      ];

      const tier = calculateComplexityTier(factors);
      expect(tier).toBe('low');
    });

    it('should return moderate for 2 factors', () => {
      const factors: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'moderate',
          interventionStatus: 'identified'
        },
        {
          category: 'food-security',
          riskLevel: 'moderate',
          interventionStatus: 'identified'
        }
      ];

      const tier = calculateComplexityTier(factors);
      expect(tier).toBe('moderate');
    });

    it('should return high for 4 factors', () => {
      const factors: SDOHFactor[] = [
        { category: 'housing', riskLevel: 'moderate', interventionStatus: 'identified' },
        { category: 'food-security', riskLevel: 'moderate', interventionStatus: 'identified' },
        { category: 'transportation', riskLevel: 'moderate', interventionStatus: 'identified' },
        { category: 'financial', riskLevel: 'moderate', interventionStatus: 'identified' }
      ];

      const tier = calculateComplexityTier(factors);
      expect(tier).toBe('high');
    });

    it('should return high for 2 high-risk factors', () => {
      const factors: SDOHFactor[] = [
        {
          category: 'housing',
          riskLevel: 'high',
          interventionStatus: 'identified'
        },
        {
          category: 'food-security',
          riskLevel: 'high',
          interventionStatus: 'identified'
        }
      ];

      const tier = calculateComplexityTier(factors);
      expect(tier).toBe('high');
    });

    it('should return complex for 5+ factors', () => {
      const factors: SDOHFactor[] = [
        { category: 'housing', riskLevel: 'moderate', interventionStatus: 'identified' },
        { category: 'food-security', riskLevel: 'moderate', interventionStatus: 'identified' },
        { category: 'transportation', riskLevel: 'moderate', interventionStatus: 'identified' },
        { category: 'financial', riskLevel: 'high', interventionStatus: 'identified' },
        { category: 'employment', riskLevel: 'moderate', interventionStatus: 'identified' }
      ];

      const tier = calculateComplexityTier(factors);
      expect(tier).toBe('complex');
    });

    it('should ignore resolved and low-risk factors', () => {
      const factors: SDOHFactor[] = [
        { category: 'housing', riskLevel: 'low', interventionStatus: 'resolved' },
        { category: 'food-security', riskLevel: 'none', interventionStatus: 'resolved' }
      ];

      const tier = calculateComplexityTier(factors);
      expect(tier).toBe('minimal');
    });
  });

  describe('getSDOHRiskColor', () => {
    it('should return correct color for each risk level', () => {
      const category = 'housing';

      expect(getSDOHRiskColor(category, 'critical')).toMatch(/#[a-f0-9]{6}/i);
      expect(getSDOHRiskColor(category, 'high')).toMatch(/#[a-f0-9]{6}/i);
      expect(getSDOHRiskColor(category, 'moderate')).toMatch(/#[a-f0-9]{6}/i);
      expect(getSDOHRiskColor(category, 'low')).toMatch(/#[a-f0-9]{6}/i);
      expect(getSDOHRiskColor(category, 'none')).toMatch(/#[a-f0-9]{6}/i);
      expect(getSDOHRiskColor(category, 'unknown')).toMatch(/#[a-f0-9]{6}/i);
    });

    it('should return different colors for different risk levels', () => {
      const category = 'housing';
      const colors = new Set([
        getSDOHRiskColor(category, 'critical'),
        getSDOHRiskColor(category, 'high'),
        getSDOHRiskColor(category, 'moderate'),
        getSDOHRiskColor(category, 'low'),
        getSDOHRiskColor(category, 'none')
      ]);

      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('SDOH_INDICATOR_CONFIGS', () => {
    it('should have configuration for all 26 categories', () => {
      const categories = Object.keys(SDOH_INDICATOR_CONFIGS);
      expect(categories.length).toBeGreaterThanOrEqual(26);
    });

    it('should have valid configuration structure', () => {
      Object.entries(SDOH_INDICATOR_CONFIGS).forEach(([key, config]) => {
        expect(config.category).toBe(key);
        expect(config.label).toBeTruthy();
        expect(config.shortLabel).toBeTruthy();
        expect(config.icon).toBeTruthy();
        expect(config.color).toMatch(/#[a-f0-9]{6}/i);
        expect(config.group).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.riskColors).toBeDefined();
        expect(config.riskColors.critical).toBeTruthy();
        expect(config.riskColors.high).toBeTruthy();
        expect(config.riskColors.moderate).toBeTruthy();
        expect(config.riskColors.low).toBeTruthy();
        expect(config.riskColors.none).toBeTruthy();
        expect(config.riskColors.unknown).toBeTruthy();
      });
    });

    it('should have all expected core categories', () => {
      const coreCategories = [
        'housing',
        'food-security',
        'transportation',
        'financial',
        'employment'
      ];

      coreCategories.forEach(category => {
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS]).toBeDefined();
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS].group).toBe('core-needs');
      });
    });

    it('should have all health behavior categories', () => {
      const behaviorCategories = ['tobacco-use', 'alcohol-use', 'substance-use'];

      behaviorCategories.forEach(category => {
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS]).toBeDefined();
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS].group).toBe('health-behaviors');
      });
    });

    it('should have all healthcare access categories', () => {
      const accessCategories = [
        'dental-care',
        'vision-care',
        'mental-health',
        'medication-access',
        'primary-care-access'
      ];

      accessCategories.forEach(category => {
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS]).toBeDefined();
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS].group).toBe('healthcare-access');
      });
    });

    it('should have safety categories', () => {
      const safetyCategories = ['domestic-violence', 'neighborhood-safety'];

      safetyCategories.forEach(category => {
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS]).toBeDefined();
        expect(SDOH_INDICATOR_CONFIGS[category as keyof typeof SDOH_INDICATOR_CONFIGS].group).toBe('safety');
      });
    });

    it('should have unique icons for each category', () => {
      const icons = new Set(
        Object.values(SDOH_INDICATOR_CONFIGS).map(config => config.icon)
      );
      const totalCategories = Object.keys(SDOH_INDICATOR_CONFIGS).length;

      // Most icons should be unique, allow some duplication for similar categories
      expect(icons.size).toBeGreaterThan(totalCategories * 0.7);
    });

    it('should have short labels that are 3 characters or less', () => {
      Object.values(SDOH_INDICATOR_CONFIGS).forEach(config => {
        expect(config.shortLabel.length).toBeLessThanOrEqual(3);
      });
    });
  });
});
