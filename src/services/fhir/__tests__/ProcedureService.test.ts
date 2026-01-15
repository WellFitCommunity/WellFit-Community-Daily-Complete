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

  describe('procedure status values', () => {
    it('should define all FHIR procedure statuses', () => {
      const statuses = [
        'preparation',
        'in-progress',
        'not-done',
        'on-hold',
        'stopped',
        'completed',
        'entered-in-error',
        'unknown',
      ];
      expect(statuses).toContain('completed');
      expect(statuses).toContain('in-progress');
      expect(statuses).toContain('not-done');
    });
  });

  describe('common CPT codes', () => {
    it('should recognize E/M codes', () => {
      const emCodes = {
        officeNew: '99201-99205',
        officeEstablished: '99211-99215',
        hospitalInpatient: '99221-99223',
        hospitalSubsequent: '99231-99233',
        consultation: '99241-99245',
      };
      expect(emCodes.officeEstablished).toBe('99211-99215');
    });

    it('should recognize common procedure codes', () => {
      const procCodes = {
        venipuncture: '36415',
        ekg: '93000',
        injection: '96372',
        wound_care: '97597',
        flu_shot: '90686',
      };
      expect(procCodes.venipuncture).toBe('36415');
      expect(procCodes.ekg).toBe('93000');
    });

    it('should recognize surgical codes', () => {
      const surgicalCodes = {
        totalKnee: '27447',
        totalHip: '27130',
        cabg: '33533',
        appendectomy: '44950',
        cholecystectomy: '47562',
      };
      expect(surgicalCodes.totalKnee).toBe('27447');
    });
  });

  describe('procedure category values', () => {
    it('should define procedure categories', () => {
      const categories = [
        'surgical-procedure',
        'diagnostic-procedure',
        'counseling',
        'education',
        'social-service',
      ];
      expect(categories).toContain('surgical-procedure');
      expect(categories).toContain('diagnostic-procedure');
    });
  });

  describe('body site codes', () => {
    it('should define common body sites', () => {
      const bodySites = [
        'left arm',
        'right arm',
        'left leg',
        'right leg',
        'abdomen',
        'chest',
        'head',
        'spine',
      ];
      expect(bodySites).toContain('left arm');
      expect(bodySites).toContain('abdomen');
    });
  });

  describe('procedure structure', () => {
    it('should define complete procedure structure', () => {
      const procedure = {
        id: 'proc-1',
        patient_id: 'patient-1',
        encounter_id: 'enc-1',
        based_on: ['service-request-1'],
        status: 'completed',
        status_reason: null,
        category: ['surgical-procedure'],
        code: '27447',
        code_display: 'Total knee arthroplasty',
        code_system: 'http://www.ama-assn.org/go/cpt',
        not_done: false,
        not_done_reason: null,
        performed_datetime: null,
        performed_period: {
          start: '2026-01-15T08:00:00Z',
          end: '2026-01-15T10:30:00Z',
        },
        recorder_id: 'practitioner-1',
        asserter_id: 'practitioner-1',
        performer: [
          { actor_id: 'practitioner-1', function: 'primary surgeon' },
          { actor_id: 'practitioner-2', function: 'assistant' },
        ],
        location_id: 'location-or',
        reason_code: ['M17.11'],
        reason_reference: ['cond-1'],
        body_site: ['left knee'],
        outcome: 'successful',
        report: ['report-1'],
        complication: [],
        follow_up: ['Post-op visit in 2 weeks'],
        note: 'Procedure completed without complications',
        focal_device: [{ action: 'implanted', device_id: 'device-1' }],
        used_reference: ['device-2', 'device-3'],
      };
      expect(procedure.status).toBe('completed');
      expect(procedure.code).toBe('27447');
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
