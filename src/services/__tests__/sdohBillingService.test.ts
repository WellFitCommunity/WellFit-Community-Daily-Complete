// SDOH Billing Service Tests
// Tests for critical fixes: empty data handling, fee schedule integration

import { SDOHBillingService } from '../sdohBillingService';
import { FeeScheduleService } from '../feeScheduleService';

// Mock Supabase
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn()
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }
}));

// Mock Fee Schedule Service
jest.mock('../feeScheduleService');

describe('SDOHBillingService', () => {
  describe('Empty Data Handling - Critical Fix', () => {
    it('should handle empty check-ins array without crashing', () => {
      const checkIns: any[] = [];

      // This should not throw an error
      expect(() => {
        // @ts-ignore - accessing private method for testing
        SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);
      }).not.toThrow();
    });

    it('should return empty SDOH factors for empty check-ins', () => {
      const checkIns: any[] = [];

      // @ts-ignore - accessing private method for testing
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors).toBeDefined();
      expect(factors.housing).toBeNull();
      expect(factors.nutrition).toBeNull();
      expect(factors.transportation).toBeNull();
      expect(factors.social).toBeNull();
      expect(factors.financial).toBeNull();
    });

    it('should handle null check-ins gracefully', () => {
      const checkIns = null;

      // @ts-ignore - accessing private method for testing
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors).toBeDefined();
      expect(Object.values(factors).every(f => f === null)).toBe(true);
    });

    it('should skip null entries in check-ins array', () => {
      const checkIns = [
        null,
        { housing_situation: 'homeless' },
        null
      ];

      // @ts-ignore - accessing private method for testing
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.housing).toBeDefined();
      expect(factors.housing?.zCode).toBe('Z59.0');
    });

    it('should handle missing properties in check-in data', () => {
      const checkIns = [
        {
          // Missing all SDOH properties
          created_at: '2025-01-01'
        }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      // Should not crash and return null factors
      expect(factors).toBeDefined();
      expect(Object.values(factors).every(f => f === null)).toBe(true);
    });

    it('should handle null values for numeric fields', () => {
      const checkIns = [
        {
          meals_missed: null,
          social_isolation_score: null
        }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      // Should not crash
      expect(factors.nutrition).toBeNull();
      expect(factors.social).toBeNull();
    });

    it('should handle undefined values for numeric fields', () => {
      const checkIns = [
        {
          meals_missed: undefined,
          social_isolation_score: undefined
        }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.nutrition).toBeNull();
      expect(factors.social).toBeNull();
    });
  });

  describe('SDOH Factor Detection', () => {
    it('should detect housing instability', () => {
      const checkIns = [
        { housing_situation: 'homeless' }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.housing).toBeDefined();
      expect(factors.housing?.zCode).toBe('Z59.0');
      expect(factors.housing?.description).toBe('Homelessness');
      expect(factors.housing?.severity).toBe('severe');
    });

    it('should detect food insecurity from meals_missed', () => {
      const checkIns = [
        { meals_missed: 3 }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.nutrition).toBeDefined();
      expect(factors.nutrition?.zCode).toBe('Z59.3');
      expect(factors.nutrition?.severity).toBe('severe'); // > 2 meals
    });

    it('should detect food insecurity from food_security flag', () => {
      const checkIns = [
        { food_security: 'insecure' }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.nutrition).toBeDefined();
      expect(factors.nutrition?.zCode).toBe('Z59.3');
    });

    it('should detect transportation barriers', () => {
      const checkIns = [
        { transportation_barriers: true }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.transportation).toBeDefined();
      expect(factors.transportation?.zCode).toBe('Z59.8');
    });

    it('should detect social isolation', () => {
      const checkIns = [
        { social_isolation_score: 10 }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.social).toBeDefined();
      expect(factors.social?.zCode).toBe('Z60.2');
      expect(factors.social?.severity).toBe('moderate'); // 7-12 range
    });

    it('should detect severe social isolation', () => {
      const checkIns = [
        { social_isolation_score: 15 }
      ];

      // @ts-ignore
      const factors = SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      expect(factors.social?.severity).toBe('severe'); // > 12
    });
  });

  describe('Complexity Score Calculation', () => {
    it('should calculate complexity score for single factor', () => {
      const factors = {
        housing: {
          zCode: 'Z59.0',
          description: 'Homelessness',
          severity: 'severe' as const,
          impact: 'high' as const,
          documented: true,
          source: 'test'
        },
        nutrition: null,
        transportation: null,
        social: null,
        financial: null,
        education: null,
        employment: null
      };

      // @ts-ignore
      const score = SDOHBillingService['calculateComplexityScore'](factors);

      // Z59.0 weight = 3, severe multiplier = 2, total = 6
      expect(score).toBe(6);
    });

    it('should calculate complexity score for multiple factors', () => {
      const factors = {
        housing: {
          zCode: 'Z59.0',
          description: 'Homelessness',
          severity: 'severe' as const,
          impact: 'high' as const,
          documented: true,
          source: 'test'
        },
        nutrition: {
          zCode: 'Z59.3',
          description: 'Food insecurity',
          severity: 'moderate' as const,
          impact: 'high' as const,
          documented: true,
          source: 'test'
        },
        transportation: null,
        social: null,
        financial: null,
        education: null,
        employment: null
      };

      // @ts-ignore
      const score = SDOHBillingService['calculateComplexityScore'](factors);

      // Z59.0: 3 * 2 = 6, Z59.3: 2 * 1.5 = 3, total = 9
      expect(score).toBe(9);
    });

    it('should return 0 for empty factors', () => {
      const factors = {
        housing: null,
        nutrition: null,
        transportation: null,
        social: null,
        financial: null,
        education: null,
        employment: null
      };

      // @ts-ignore
      const score = SDOHBillingService['calculateComplexityScore'](factors);

      expect(score).toBe(0);
    });
  });

  describe('CCM Eligibility Assessment', () => {
    it('should mark as complex tier for high complexity with SDOH factors', () => {
      const complexityScore = 7;
      const factors = {
        housing: {
          zCode: 'Z59.0',
          description: 'Homelessness',
          severity: 'severe' as const,
          impact: 'high' as const,
          documented: true,
          source: 'test'
        },
        nutrition: null,
        transportation: null,
        social: null,
        financial: null,
        education: null,
        employment: null
      };

      // @ts-ignore
      const result = SDOHBillingService['assessCCMEligibility'](complexityScore, factors);

      expect(result.eligible).toBe(true);
      expect(result.tier).toBe('complex');
    });

    it('should mark as standard tier for moderate complexity', () => {
      const complexityScore = 3;
      const factors = {
        housing: null,
        nutrition: {
          zCode: 'Z59.3',
          description: 'Food insecurity',
          severity: 'mild' as const,
          impact: 'medium' as const,
          documented: true,
          source: 'test'
        },
        transportation: null,
        social: null,
        financial: null,
        education: null,
        employment: null
      };

      // @ts-ignore
      const result = SDOHBillingService['assessCCMEligibility'](complexityScore, factors);

      expect(result.eligible).toBe(true);
      expect(result.tier).toBe('standard');
    });

    it('should mark as non-eligible for low complexity', () => {
      const complexityScore = 1;
      const factors = {
        housing: null,
        nutrition: null,
        transportation: null,
        social: null,
        financial: null,
        education: null,
        employment: null
      };

      // @ts-ignore
      const result = SDOHBillingService['assessCCMEligibility'](complexityScore, factors);

      expect(result.eligible).toBe(false);
      expect(result.tier).toBe('non-eligible');
    });
  });

  describe('Fee Schedule Integration - Critical Fix', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use database fee schedule when available', async () => {
      const mockCalculate = jest.spyOn(FeeScheduleService, 'calculateExpectedReimbursement')
        .mockResolvedValue({
          total: 145.60,
          breakdown: [{ code: '99487', rate: 145.60, units: 1, subtotal: 145.60 }]
        });

      const codes = [{ code: '99487' }];

      // @ts-ignore
      const reimbursement = await SDOHBillingService['calculateExpectedReimbursement'](codes);

      expect(mockCalculate).toHaveBeenCalledWith(
        expect.arrayContaining([{ code: '99487', units: 1 }]),
        'cpt',
        'medicare'
      );
      expect(reimbursement).toBe(145.60);
    });

    it('should fallback to hardcoded rates when database unavailable', async () => {
      const mockCalculate = jest.spyOn(FeeScheduleService, 'calculateExpectedReimbursement')
        .mockResolvedValue({ total: 0, breakdown: [] }); // Database returns 0

      const codes = [{ code: '99487' }];

      // @ts-ignore
      const reimbursement = await SDOHBillingService['calculateExpectedReimbursement'](codes);

      // Should fall back to hardcoded CCM_CODES
      expect(reimbursement).toBeGreaterThan(0);
      expect(reimbursement).toBe(145.60); // From CCM_CODES
    });

    it('should handle multiple codes in reimbursement calculation', async () => {
      const mockCalculate = jest.spyOn(FeeScheduleService, 'calculateExpectedReimbursement')
        .mockResolvedValue({
          total: 215.32,
          breakdown: [
            { code: '99487', rate: 145.60, units: 1, subtotal: 145.60 },
            { code: '99489', rate: 69.72, units: 1, subtotal: 69.72 }
          ]
        });

      const codes = [{ code: '99487' }, { code: '99489' }];

      // @ts-ignore
      const reimbursement = await SDOHBillingService['calculateExpectedReimbursement'](codes);

      expect(reimbursement).toBe(215.32);
    });
  });

  describe('CCM Code Generation', () => {
    it('should generate complex CCM code for complex tier', () => {
      const assessment = {
        ccmEligible: true,
        ccmTier: 'complex' as const,
        overallComplexityScore: 7,
        patientId: 'test-patient',
        assessmentDate: '2025-01-01',
        housingInstability: null,
        foodInsecurity: null,
        transportationBarriers: null,
        socialIsolation: null,
        financialInsecurity: null,
        educationBarriers: null,
        employmentConcerns: null
      };

      // @ts-ignore
      const codes = SDOHBillingService['generateCCMCodes'](assessment);

      expect(codes).toHaveLength(1);
      expect(codes[0].code).toBe('99487');
      expect(codes[0].timeRequired).toBe(60);
      expect(codes[0].rationale).toContain('Complex CCM');
      expect(codes[0].rationale).toContain('7');
    });

    it('should generate standard CCM code for standard tier', () => {
      const assessment = {
        ccmEligible: true,
        ccmTier: 'standard' as const,
        overallComplexityScore: 3,
        patientId: 'test-patient',
        assessmentDate: '2025-01-01',
        housingInstability: null,
        foodInsecurity: null,
        transportationBarriers: null,
        socialIsolation: null,
        financialInsecurity: null,
        educationBarriers: null,
        employmentConcerns: null
      };

      // @ts-ignore
      const codes = SDOHBillingService['generateCCMCodes'](assessment);

      expect(codes).toHaveLength(1);
      expect(codes[0].code).toBe('99490');
      expect(codes[0].timeRequired).toBe(20);
    });

    it('should not generate codes for non-eligible patients', () => {
      const assessment = {
        ccmEligible: false,
        ccmTier: 'non-eligible' as const,
        overallComplexityScore: 0,
        patientId: 'test-patient',
        assessmentDate: '2025-01-01',
        housingInstability: null,
        foodInsecurity: null,
        transportationBarriers: null,
        socialIsolation: null,
        financialInsecurity: null,
        educationBarriers: null,
        employmentConcerns: null
      };

      // @ts-ignore
      const codes = SDOHBillingService['generateCCMCodes'](assessment);

      expect(codes).toHaveLength(0);
    });
  });

  describe('HIPAA Compliance', () => {
    it('should not log PHI in console warnings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const checkIns: any[] = [];
      // @ts-ignore
      SDOHBillingService['analyzeCheckInsForSDOH'](checkIns);

      // Verify no console warnings are logged (HIPAA compliance - no PHI logging)
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
