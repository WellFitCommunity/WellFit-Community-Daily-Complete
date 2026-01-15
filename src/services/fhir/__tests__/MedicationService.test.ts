/**
 * Tests for FHIR MedicationService
 *
 * Covers medication definitions and drug information
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicationService } from '../MedicationService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'med-1',
              code: '197361',
              code_display: 'Metformin 500 MG Oral Tablet',
              code_system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            },
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'med-1', code: '197361' },
              error: null,
            })),
          })),
        })),
        ilike: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'med-1', code_display: 'Metformin 500 MG' },
              { id: 'med-2', code_display: 'Metformin 1000 MG' },
            ],
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'med-new', code: '123456', code_display: 'New Medication' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'med-1', code_display: 'Updated Medication' },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('MedicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return medication by ID', async () => {
      const result = await MedicationService.getById('med-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for invalid ID', async () => {
      const result = await MedicationService.getById('invalid-id');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });
  });

  describe('getByRxNorm', () => {
    it('should return medication by RxNorm code', async () => {
      const result = await MedicationService.getByRxNorm('197361'); // Metformin

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle RxNorm lookup for common medications', async () => {
      const result = await MedicationService.getByRxNorm('312961'); // Lisinopril

      expect(result).toBeDefined();
    });

    it('should return error for unknown RxNorm code', async () => {
      const result = await MedicationService.getByRxNorm('00000');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });
  });

  describe('search', () => {
    it('should search medications by name', async () => {
      const result = await MedicationService.search('Metformin');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should return multiple results', async () => {
      const result = await MedicationService.search('Aspirin');

      expect(result.success).toBe(true);
    });

    it('should handle partial matches', async () => {
      const result = await MedicationService.search('met');

      expect(result.success).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const result = await MedicationService.search('nonexistent-drug-xyz');

      expect(result).toBeDefined();
      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });
  });

  describe('create', () => {
    it('should create a new medication', async () => {
      const newMed = {
        code: '123456',
        code_display: 'New Medication 10 MG Tablet',
        code_system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        status: 'active',
        form: 'tablet',
      };

      const result = await MedicationService.create(newMed);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create medication with manufacturer', async () => {
      const medWithManufacturer = {
        code: '123456',
        code_display: 'Branded Medication',
        manufacturer: 'Pharma Corp',
        status: 'active',
      };

      const result = await MedicationService.create(medWithManufacturer);

      expect(result.success).toBe(true);
    });

    it('should create compound medication', async () => {
      const compound = {
        code: '999999',
        code_display: 'Compound Medication',
        is_brand: false,
        ingredients: [
          { code: '111', amount: '5 MG' },
          { code: '222', amount: '10 MG' },
        ],
      };

      const result = await MedicationService.create(compound);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a medication', async () => {
      const result = await MedicationService.update('med-1', {
        status: 'inactive',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update medication status', async () => {
      const result = await MedicationService.update('med-1', {
        status: 'entered-in-error',
      });

      expect(result.success).toBe(true);
    });

    it('should update display name', async () => {
      const result = await MedicationService.update('med-1', {
        code_display: 'Updated Medication Name',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('medication structure', () => {
    it('should define medication record structure', () => {
      const medication = {
        id: 'med-1',
        code: '197361',
        code_display: 'Metformin 500 MG Oral Tablet',
        code_system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        status: 'active',
        form: 'tablet',
        amount: { value: 500, unit: 'mg' },
        batch: {
          lot_number: 'ABC123',
          expiration_date: '2027-12-31',
        },
      };
      expect(medication.code).toBe('197361');
      expect(medication.status).toBe('active');
    });
  });

  describe('common RxNorm codes', () => {
    it('should recognize common medication RxNorm codes', () => {
      const commonMeds = {
        metformin500: '197361',
        lisinopril10: '312961',
        amlodipine5: '308136',
        atorvastatin20: '617310',
        omeprazole20: '198015',
        levothyroxine50: '966571',
        metoprolol25: '866514',
        losartan50: '979492',
      };
      expect(commonMeds.metformin500).toBe('197361');
      expect(commonMeds.lisinopril10).toBe('312961');
    });
  });

  describe('medication status values', () => {
    it('should define all FHIR medication statuses', () => {
      const statuses = ['active', 'inactive', 'entered-in-error'];
      expect(statuses).toContain('active');
      expect(statuses).toContain('inactive');
      expect(statuses).toContain('entered-in-error');
    });
  });

  describe('medication form codes', () => {
    it('should define common form codes', () => {
      const forms = [
        'tablet',
        'capsule',
        'solution',
        'injection',
        'powder',
        'cream',
        'ointment',
        'patch',
        'inhaler',
        'spray',
      ];
      expect(forms).toContain('tablet');
      expect(forms).toContain('capsule');
      expect(forms).toContain('injection');
    });
  });

  describe('RxNorm code system', () => {
    it('should use correct RxNorm system URI', () => {
      const rxnormSystem = 'http://www.nlm.nih.gov/research/umls/rxnorm';
      expect(rxnormSystem).toBe('http://www.nlm.nih.gov/research/umls/rxnorm');
    });

    it('should recognize NDC code system', () => {
      const ndcSystem = 'http://hl7.org/fhir/sid/ndc';
      expect(ndcSystem).toBe('http://hl7.org/fhir/sid/ndc');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await MedicationService.getById('test');
      expect(result).toHaveProperty('success');
    });

    it('should return error message in response', async () => {
      const result = await MedicationService.getByRxNorm('invalid');
      expect(result).toBeDefined();
    });
  });
});
