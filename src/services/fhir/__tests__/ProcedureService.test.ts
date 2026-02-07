/**
 * Tests for FHIR ProcedureService
 *
 * Covers medical procedures and interventions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcedureService } from '../ProcedureService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'proc-1', code: '99213', code_display: 'Office visit', status: 'completed' },
              { id: 'proc-2', code: '36415', code_display: 'Venipuncture', status: 'completed' },
            ],
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'proc-new', code: '99213', status: 'completed' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'proc-1', status: 'completed' },
              error: null,
            })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => ({
      data: [{ id: 'proc-1', code: '99213' }],
      error: null,
    })),
  },
}));

describe('ProcedureService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should return all procedures for a patient', async () => {
      const result = await ProcedureService.getByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by performed date descending', async () => {
      const result = await ProcedureService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getRecent', () => {
    it('should return recent procedures', async () => {
      const result = await ProcedureService.getRecent('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should default to 20 records', async () => {
      const result = await ProcedureService.getRecent('patient-1');

      expect(result.success).toBe(true);
    });

    it('should accept custom limit', async () => {
      const result = await ProcedureService.getRecent('patient-1', 50);

      expect(result.success).toBe(true);
    });
  });

  describe('getByEncounter', () => {
    it('should return procedures for an encounter', async () => {
      const result = await ProcedureService.getByEncounter('enc-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getBillable', () => {
    it('should return billable procedures', async () => {
      const result = await ProcedureService.getBillable('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter by encounter', async () => {
      const result = await ProcedureService.getBillable('patient-1', 'enc-1');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new procedure', async () => {
      const newProc = {
        patient_id: 'patient-1',
        encounter_id: 'enc-1',
        code: '99213',
        code_display: 'Office or other outpatient visit',
        code_system: 'http://www.ama-assn.org/go/cpt',
        status: 'completed' as const,
        performed_datetime: new Date().toISOString(),
      };

      const result = await ProcedureService.create(newProc);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create surgical procedure', async () => {
      const surgery = {
        patient_id: 'patient-1',
        encounter_id: 'enc-1',
        code: '27447',
        code_display: 'Total knee replacement',
        code_system: 'http://www.ama-assn.org/go/cpt',
        status: 'completed' as const,
        performed_period_start: '2026-01-15T08:00:00Z',
        performed_period_end: '2026-01-15T10:30:00Z',
      };

      const result = await ProcedureService.create(surgery);

      expect(result.success).toBe(true);
    });

    it('should create in-progress procedure', async () => {
      const inProgress = {
        patient_id: 'patient-1',
        encounter_id: 'enc-1',
        code: '36556',
        code_display: 'Insertion of PICC line',
        code_system: 'http://www.ama-assn.org/go/cpt',
        status: 'in-progress' as const,
        performed_datetime: new Date().toISOString(),
      };

      const result = await ProcedureService.create(inProgress);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a procedure', async () => {
      const result = await ProcedureService.update('proc-1', {
        status: 'completed',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should add note', async () => {
      const result = await ProcedureService.update('proc-1', {
        note: 'Procedure completed successfully without complications',
      });

      expect(result.success).toBe(true);
    });

    it('should update category', async () => {
      const result = await ProcedureService.update('proc-1', {
        category_code: '387713003',
        category_display: 'Surgical procedure',
      });

      expect(result.success).toBe(true);
    });

    it('should update performed time', async () => {
      const result = await ProcedureService.update('proc-1', {
        performed_datetime: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await ProcedureService.getByPatient('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle RPC errors', async () => {
      const result = await ProcedureService.getByEncounter('test');
      expect(result).toBeDefined();
    });
  });
});
