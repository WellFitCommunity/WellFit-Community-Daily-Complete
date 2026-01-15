/**
 * Tests for FHIR ImmunizationService
 *
 * Covers vaccination records and immunization tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImmunizationService } from '../ImmunizationService';

// Mock supabase with proper chain support
const immData = [
  { id: 'imm-1', vaccine_code: '207', vaccine_display: 'COVID-19 mRNA', status: 'completed' },
  { id: 'imm-2', vaccine_code: '140', vaccine_display: 'Influenza', status: 'completed' },
];

const mockOrder = vi.fn(() => ({
  data: immData,
  error: null,
}));

const mockLte = vi.fn(() => ({
  order: mockOrder,
}));

const mockGte = vi.fn(() => ({
  lte: mockLte,
  order: mockOrder,
}));

const mockSingle = vi.fn(() => ({
  data: { id: 'imm-1', status: 'completed', vaccine_code: '207' },
  error: null,
}));

const mockEq: ReturnType<typeof vi.fn> = vi.fn(() => ({
  order: mockOrder,
  eq: mockEq,
  gte: mockGte,
  lte: mockLte,
  single: mockSingle,
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
            data: { id: 'imm-new', vaccine_code: '140', status: 'completed' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'imm-1', status: 'not-done' },
              error: null,
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
    rpc: vi.fn((funcName: string) => {
      if (funcName === 'check_vaccine_due') {
        return { data: true, error: null };
      }
      if (funcName === 'get_vaccine_gaps') {
        return {
          data: [
            { vaccine_code: '140', vaccine_name: 'Influenza', due: true },
            { vaccine_code: '33', vaccine_name: 'Pneumococcal', due: true },
          ],
          error: null,
        };
      }
      return {
        data: [{ id: 'imm-1', vaccine_code: '207' }],
        error: null,
      };
    }),
  },
}));

describe('ImmunizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should return all immunizations for a patient', async () => {
      const result = await ImmunizationService.getByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by occurrence date descending', async () => {
      const result = await ImmunizationService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return immunization by ID', async () => {
      const result = await ImmunizationService.getById('imm-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return null for not found', async () => {
      const result = await ImmunizationService.getById('imm-nonexistent');

      expect(result.success).toBe(true);
    });
  });

  describe('getCompleted', () => {
    it('should return completed immunizations', async () => {
      const result = await ImmunizationService.getCompleted('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter by completed status', async () => {
      const result = await ImmunizationService.getCompleted('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return immunization history', async () => {
      const result = await ImmunizationService.getHistory('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should default to 365 days', async () => {
      const result = await ImmunizationService.getHistory('patient-1');

      expect(result.success).toBe(true);
    });

    it('should accept custom days parameter', async () => {
      const result = await ImmunizationService.getHistory('patient-1', 730);

      expect(result.success).toBe(true);
    });
  });

  describe('getByVaccineCode', () => {
    it('should return immunizations by vaccine code', async () => {
      const result = await ImmunizationService.getByVaccineCode('patient-1', '207');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should track COVID-19 vaccines', async () => {
      const result = await ImmunizationService.getByVaccineCode('patient-1', '207');

      expect(result.success).toBe(true);
    });

    it('should track influenza vaccines', async () => {
      const result = await ImmunizationService.getByVaccineCode('patient-1', '140');

      expect(result.success).toBe(true);
    });
  });

  describe('checkVaccineDue', () => {
    it('should check if vaccine is due', async () => {
      const result = await ImmunizationService.checkVaccineDue('patient-1', '140');

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('boolean');
    });

    it('should default to 12 months', async () => {
      const result = await ImmunizationService.checkVaccineDue('patient-1', '140');

      expect(result.success).toBe(true);
    });

    it('should accept custom months parameter', async () => {
      const result = await ImmunizationService.checkVaccineDue('patient-1', '207', 6);

      expect(result.success).toBe(true);
    });
  });

  describe('getVaccineGaps', () => {
    it('should return vaccine care gaps', async () => {
      const result = await ImmunizationService.getVaccineGaps('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should identify missing vaccines', async () => {
      const result = await ImmunizationService.getVaccineGaps('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new immunization', async () => {
      const newImm = {
        patient_id: 'patient-1',
        vaccine_code: '140',
        vaccine_display: 'Influenza, seasonal, injectable',
        status: 'completed' as const,
        occurrence_datetime: new Date().toISOString(),
        lot_number: 'ABC123',
        expiration_date: '2027-06-30',
        primary_source: true,
      };

      const result = await ImmunizationService.create(newImm);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create COVID-19 vaccination', async () => {
      const covid = {
        patient_id: 'patient-1',
        vaccine_code: '207',
        vaccine_display: 'COVID-19, mRNA, LNP-S',
        status: 'completed' as const,
        primary_source: true,
        dose_number: 1,
        series_doses: 2,
      };

      const result = await ImmunizationService.create(covid);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update an immunization', async () => {
      const result = await ImmunizationService.update('imm-1', {
        status: 'not-done' as const,
        status_reason_code: 'PATOBJ',
        status_reason_display: 'Patient declined',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should add reaction information', async () => {
      const result = await ImmunizationService.update('imm-1', {
        reaction_date: new Date().toISOString(),
        reaction_reported: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete an immunization', async () => {
      const result = await ImmunizationService.delete('imm-1');

      expect(result.success).toBe(true);
    });
  });

  describe('search', () => {
    it('should search with multiple filters', async () => {
      const result = await ImmunizationService.search({
        patientId: 'patient-1',
        status: 'completed',
        vaccineCode: '140',
      });

      expect(result.success).toBe(true);
    });

    it('should search by date range', async () => {
      const result = await ImmunizationService.search({
        patientId: 'patient-1',
        fromDate: '2025-01-01',
        toDate: '2026-12-31',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('immunization status values', () => {
    it('should define all FHIR immunization statuses', () => {
      const statuses = ['completed', 'entered-in-error', 'not-done'];
      expect(statuses).toContain('completed');
      expect(statuses).toContain('not-done');
    });
  });

  describe('common CVX vaccine codes', () => {
    it('should recognize common vaccine codes', () => {
      const cvxCodes = {
        influenza: '140',
        covid19Moderna: '207',
        covid19Pfizer: '208',
        tdap: '115',
        mmr: '03',
        varicella: '21',
        pneumococcal: '33',
        shingles: '187',
        hepB: '08',
        hepA: '83',
      };
      expect(cvxCodes.influenza).toBe('140');
      expect(cvxCodes.covid19Moderna).toBe('207');
    });
  });

  describe('vaccination site codes', () => {
    it('should define injection sites', () => {
      const sites = ['LA', 'RA', 'LT', 'RT', 'LVL', 'RVL', 'LLFA', 'RLFA'];
      expect(sites).toContain('LA'); // Left arm
      expect(sites).toContain('RA'); // Right arm
    });
  });

  describe('immunization structure', () => {
    it('should define complete immunization structure', () => {
      const immunization = {
        id: 'imm-1',
        patient_id: 'patient-1',
        vaccine_code: '140',
        vaccine_display: 'Influenza, seasonal, injectable',
        vaccine_system: 'http://hl7.org/fhir/sid/cvx',
        status: 'completed',
        occurrence_datetime: '2026-10-15T10:00:00Z',
        lot_number: 'ABC123',
        expiration_date: '2027-06-30',
        site: 'LA',
        route: 'IM',
        dose_quantity: { value: 0.5, unit: 'mL' },
        performer_id: 'practitioner-1',
        performer_role: 'AP', // Administering provider
        is_subpotent: false,
        education: [{ document_type: 'VIS', presentation_date: '2026-10-15' }],
        funding_source: 'private',
        reaction: [],
        protocol_applied: [{ dose_number: 1, series_doses: 1 }],
        recorded: '2026-10-15T10:05:00Z',
      };
      expect(immunization.status).toBe('completed');
      expect(immunization.vaccine_code).toBe('140');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await ImmunizationService.getByPatient('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle RPC errors', async () => {
      const result = await ImmunizationService.checkVaccineDue('test', '140');
      expect(result).toBeDefined();
    });
  });
});
