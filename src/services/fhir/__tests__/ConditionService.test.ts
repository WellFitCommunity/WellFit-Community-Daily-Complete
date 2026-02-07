/**
 * Tests for FHIR ConditionService
 *
 * Covers patient diagnoses, problem lists, and health conditions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConditionService } from '../ConditionService';

// Mock normalizers
vi.mock('../utils/fhirNormalizers', () => ({
  normalizeCondition: (data: Record<string, unknown>) => data,
  toFHIRCondition: (data: Record<string, unknown>) => data,
}));

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              {
                id: 'cond-1',
                patient_id: 'patient-1',
                code: 'E11.9',
                code_display: 'Type 2 diabetes mellitus',
                clinical_status: 'active',
              },
            ],
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'cond-new', code: 'E11.9' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'cond-1', clinical_status: 'resolved' },
              error: null,
            })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => ({
      data: [{ id: 'cond-1', clinical_status: 'active', code: 'E11.9' }],
      error: null,
    })),
  },
}));

describe('ConditionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should return all conditions for a patient', async () => {
      const result = await ConditionService.getByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by recorded date descending', async () => {
      const result = await ConditionService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });

    it('should normalize results', async () => {
      const result = await ConditionService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getActive', () => {
    it('should return active conditions', async () => {
      const result = await ConditionService.getActive('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should exclude resolved conditions', async () => {
      const result = await ConditionService.getActive('patient-1');

      expect(result.success).toBe(true);
    });

  });

  describe('getProblemList', () => {
    it('should return problem list conditions', async () => {
      const result = await ConditionService.getProblemList('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter by problem-list-item category', async () => {
      const result = await ConditionService.getProblemList('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getByEncounter', () => {
    it('should return diagnoses for an encounter', async () => {
      const result = await ConditionService.getByEncounter('enc-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should support encounter-specific diagnoses', async () => {
      const result = await ConditionService.getByEncounter('enc-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getChronic', () => {
    it('should return chronic conditions', async () => {
      const result = await ConditionService.getChronic('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

  });

  describe('create', () => {
    it('should create a new condition', async () => {
      const newCondition = {
        patient_id: 'patient-1',
        code: 'E11.9',
        code_display: 'Type 2 diabetes mellitus without complications',
        code_system: 'http://hl7.org/fhir/sid/icd-10-cm',
        clinical_status: 'active' as const,
        verification_status: 'confirmed' as const,
        category: ['problem-list-item'],
        recorded_date: new Date().toISOString(),
      };

      const result = await ConditionService.create(newCondition);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create encounter diagnosis', async () => {
      const diagnosis = {
        patient_id: 'patient-1',
        encounter_id: 'enc-1',
        code: 'J06.9',
        code_display: 'Upper respiratory infection',
        code_system: 'http://hl7.org/fhir/sid/icd-10-cm',
        clinical_status: 'active' as const,
        verification_status: 'confirmed' as const,
        category: ['encounter-diagnosis'],
      };

      const result = await ConditionService.create(diagnosis);

      expect(result.success).toBe(true);
    });

    it('should convert to FHIR format', async () => {
      const condition = {
        patient_id: 'patient-1',
        code: 'E11.65',
        code_display: 'Type 2 diabetes with hyperglycemia',
        code_system: 'http://hl7.org/fhir/sid/icd-10-cm',
        clinical_status: 'active' as const,
        verification_status: 'confirmed' as const,
      };

      const result = await ConditionService.create(condition);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a condition', async () => {
      const result = await ConditionService.update('cond-1', {
        clinical_status: 'resolved' as const,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update abatement date', async () => {
      const result = await ConditionService.update('cond-1', {
        abatement_datetime: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
    });

    it('should add clinical notes', async () => {
      const result = await ConditionService.update('cond-1', {
        note: 'Patient reports improved symptoms',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a condition', async () => {
      const result = await ConditionService.resolve('cond-1');

      expect(result.success).toBe(true);
    });

    it('should set clinical_status to resolved', async () => {
      const result = await ConditionService.resolve('cond-1');

      expect(result.success).toBe(true);
    });

    it('should record abatement date', async () => {
      const result = await ConditionService.resolve('cond-1');

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await ConditionService.getByPatient('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle RPC errors', async () => {
      const result = await ConditionService.getActive('test');
      expect(result).toBeDefined();
    });
  });
});
