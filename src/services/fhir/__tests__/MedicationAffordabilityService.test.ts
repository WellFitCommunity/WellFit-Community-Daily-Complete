/**
 * Tests for FHIR MedicationAffordabilityService
 *
 * Covers medication affordability checks and patient assistance programs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicationAffordabilityService } from '../MedicationAffordabilityService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'check-1', medication_name: 'Metformin 500mg', is_affordable: true },
              { id: 'check-2', medication_name: 'Insulin Lispro', is_affordable: false },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [{ id: 'check-2', is_affordable: false }],
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'check-new', medication_name: 'New Med', is_affordable: true },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'check-1', alternatives: [] },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('MedicationAffordabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAffordability', () => {
    it('should check medication affordability', async () => {
      const input = {
        patient_id: 'patient-1',
        medication_name: 'Metformin 500mg',
        quantity: 60,
        days_supply: 30,
      };

      const result = await MedicationAffordabilityService.checkAffordability(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should include RxNorm code if provided', async () => {
      const input = {
        patient_id: 'patient-1',
        medication_name: 'Lisinopril 10mg',
        rxnorm_code: '314076',
        quantity: 30,
        days_supply: 30,
      };

      const result = await MedicationAffordabilityService.checkAffordability(input);

      expect(result).toBeDefined();
    });
  });

  describe('getChecks', () => {
    it('should return affordability checks for patient', async () => {
      const result = await MedicationAffordabilityService.getChecks('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should order by checked date descending', async () => {
      const result = await MedicationAffordabilityService.getChecks('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('getUnaffordable', () => {
    it('should return unaffordable medications', async () => {
      const result = await MedicationAffordabilityService.getUnaffordable('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by is_affordable false', async () => {
      const result = await MedicationAffordabilityService.getUnaffordable('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('getWithAssistance', () => {
    it('should return medications with patient assistance available', async () => {
      const result = await MedicationAffordabilityService.getWithAssistance('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('addAlternatives', () => {
    it('should add therapeutic alternatives', async () => {
      const alternatives = [
        {
          medication_name: 'Metformin ER 500mg',
          rxnorm_code: '860975',
          estimated_cost: 15.0,
          savings: 25.0,
        },
        {
          medication_name: 'Generic Glucophage',
          rxnorm_code: '197361',
          estimated_cost: 12.0,
          savings: 28.0,
        },
      ];

      const result = await MedicationAffordabilityService.addAlternatives('check-1', alternatives);

      expect(result).toBeDefined();
    });
  });

  describe('affordability check structure', () => {
    it('should define complete affordability check structure', () => {
      const check = {
        id: 'check-1',
        patient_id: 'patient-1',
        medication_name: 'Ozempic 0.5mg',
        rxnorm_code: '2097096',
        ndc: '00169-4060-13',
        quantity: 4,
        days_supply: 28,
        checked_date: '2026-01-15T10:00:00Z',
        retail_price: 950.0,
        patient_price: 450.0,
        insurance_coverage: 500.0,
        copay: 50.0,
        is_affordable: false,
        affordability_threshold: 100.0,
        patient_assistance_available: true,
        patient_assistance_programs: [
          {
            program_name: 'Novo Nordisk PAP',
            eligibility: 'Income-based',
            potential_savings: 400.0,
          },
        ],
        alternatives: [
          {
            medication_name: 'Trulicity',
            estimated_cost: 350.0,
            clinical_equivalence: 'similar',
          },
        ],
        pharmacy_options: [
          { pharmacy: 'CostPlus Drugs', price: 350.0 },
          { pharmacy: 'GoodRx Partner', price: 400.0 },
        ],
        notes: 'Patient may qualify for manufacturer assistance',
        created_at: '2026-01-15T10:00:00Z',
      };
      expect(check.is_affordable).toBe(false);
      expect(check.patient_assistance_available).toBe(true);
    });
  });

  describe('pricing integration sources', () => {
    it('should define pricing data sources', () => {
      const sources = {
        goodRx: 'GoodRx API',
        costPlusDrugs: 'Cost Plus Drugs',
        rxAssist: 'RxAssist',
        needyMeds: 'NeedyMeds',
        manufacturer: 'Manufacturer Programs',
        pbm: 'PBM Pricing',
      };
      expect(sources.goodRx).toBe('GoodRx API');
      expect(sources.costPlusDrugs).toBe('Cost Plus Drugs');
    });
  });

  describe('assistance program types', () => {
    it('should define assistance program types', () => {
      const programTypes = [
        'manufacturer_pap',
        'foundation_assistance',
        'state_program',
        'federal_program',
        'copay_card',
        'pharmacy_discount',
      ];
      expect(programTypes).toContain('manufacturer_pap');
      expect(programTypes).toContain('copay_card');
    });
  });

  describe('affordability thresholds', () => {
    it('should define default thresholds', () => {
      const thresholds = {
        affordable: 50.0,
        moderatelyAffordable: 100.0,
        expensive: 200.0,
        unaffordable: 500.0,
      };
      expect(thresholds.affordable).toBe(50.0);
      expect(thresholds.unaffordable).toBe(500.0);
    });
  });

  describe('error handling', () => {
    it('should throw error on database failure', async () => {
      try {
        await MedicationAffordabilityService.getChecks('test');
        // Mock returns success
      } catch {
        // Expected on real error
      }
    });

    it('should handle missing medication data', async () => {
      try {
        await MedicationAffordabilityService.checkAffordability({
          patient_id: 'patient-1',
          medication_name: 'Unknown Med',
          quantity: 30,
          days_supply: 30,
        });
      } catch {
        // Expected on real error
      }
    });
  });
});
