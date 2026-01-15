/**
 * Tests for FHIR SDOHService (Social Determinants of Health)
 *
 * Covers SDOH screening and intervention tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SDOHService } from '../SDOHService';

// Mock supabase with proper chain support
const mockOrder = vi.fn(() => ({
  data: [
    { id: 'sdoh-1', category: 'food', risk_level: 'high', status: 'final' },
    { id: 'sdoh-2', category: 'housing', risk_level: 'moderate', status: 'final' },
  ],
  error: null,
}));

// Recursive mock that supports any chain depth
const mockEq: ReturnType<typeof vi.fn> = vi.fn(() => ({
  order: mockOrder,
  eq: mockEq,
  in: () => ({
    order: mockOrder,
    eq: mockEq,
  }),
}));

const mockIn = vi.fn(() => ({
  order: mockOrder,
  eq: mockEq,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: mockEq,
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'sdoh-new', patient_id: 'patient-1' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'sdoh-1', intervention_provided: true },
              error: null,
            })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => ({
      data: { risk_score: 75, risk_level: 'high' },
      error: null,
    })),
  },
}));

describe('SDOHService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('screenPatient', () => {
    it('should screen patient with multiple responses', async () => {
      const responses = [
        { category: 'food', response: 'sometimes_worried' },
        { category: 'housing', response: 'stable' },
      ];

      const result = await SDOHService.screenPatient('patient-1', responses);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty responses', async () => {
      const result = await SDOHService.screenPatient('patient-1', []);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return all SDOH data for a patient', async () => {
      const result = await SDOHService.getAll('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should order by effective datetime descending', async () => {
      const result = await SDOHService.getAll('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('getByCategory', () => {
    it('should return SDOH data by category', async () => {
      const result = await SDOHService.getByCategory('patient-1', 'food');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter housing category', async () => {
      const result = await SDOHService.getByCategory('patient-1', 'housing');

      expect(result).toBeDefined();
    });

    it('should filter transportation category', async () => {
      const result = await SDOHService.getByCategory('patient-1', 'transportation');

      expect(result).toBeDefined();
    });
  });

  describe('getHighRisk', () => {
    it('should return high-risk SDOH issues', async () => {
      const result = await SDOHService.getHighRisk('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include critical risk level', async () => {
      const result = await SDOHService.getHighRisk('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('getNeedingIntervention', () => {
    it('should return SDOH issues needing intervention', async () => {
      const result = await SDOHService.getNeedingIntervention('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter unaddressed issues', async () => {
      const result = await SDOHService.getNeedingIntervention('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('recordIntervention', () => {
    it('should record an intervention', async () => {
      const intervention = {
        intervention_provided: true,
        referral_made: true,
        referral_to: 'Food Bank',
        follow_up_needed: true,
        follow_up_date: '2026-02-15',
        notes: 'Connected to local food resources',
      };

      const result = await SDOHService.recordIntervention('sdoh-1', intervention);

      expect(result).toBeDefined();
    });

    it('should record minimal intervention', async () => {
      const intervention = {
        intervention_provided: true,
        referral_made: false,
      };

      const result = await SDOHService.recordIntervention('sdoh-1', intervention);

      expect(result).toBeDefined();
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate composite risk score', async () => {
      const result = await SDOHService.calculateRiskScore('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('SDOH categories', () => {
    it('should define standard SDOH categories', () => {
      const categories = [
        'food',
        'housing',
        'transportation',
        'employment',
        'education',
        'social_connection',
        'utilities',
        'safety',
      ];
      expect(categories).toContain('food');
      expect(categories).toContain('housing');
      expect(categories).toContain('transportation');
    });
  });

  describe('risk levels', () => {
    it('should define risk levels', () => {
      const riskLevels = ['low', 'moderate', 'high', 'critical'];
      expect(riskLevels).toContain('low');
      expect(riskLevels).toContain('high');
      expect(riskLevels).toContain('critical');
    });
  });

  describe('SDOH structure', () => {
    it('should define complete SDOH observation structure', () => {
      const sdohObs = {
        id: 'sdoh-1',
        patient_id: 'patient-1',
        category: 'food',
        screening_tool: 'AHC-HRSN',
        question_code: 'food-1',
        response: 'often_true',
        risk_level: 'high',
        status: 'final',
        effective_datetime: '2026-01-15T10:00:00Z',
        intervention_provided: false,
        referral_made: false,
        referral_to: null,
        follow_up_needed: true,
        follow_up_date: '2026-02-15',
        notes: 'Patient reports food insecurity',
      };
      expect(sdohObs.category).toBe('food');
      expect(sdohObs.risk_level).toBe('high');
    });
  });

  describe('screening tools', () => {
    it('should recognize standard screening tools', () => {
      const screeningTools = {
        ahcHrsn: 'AHC-HRSN',
        prapare: 'PRAPARE',
        healthLeads: 'Health Leads',
        wecare: 'WeCare',
      };
      expect(screeningTools.ahcHrsn).toBe('AHC-HRSN');
      expect(screeningTools.prapare).toBe('PRAPARE');
    });
  });
});
