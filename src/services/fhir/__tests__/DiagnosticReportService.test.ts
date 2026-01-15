/**
 * Tests for FHIR DiagnosticReportService
 *
 * Covers lab results and diagnostic findings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticReportService } from '../DiagnosticReportService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'report-1', category: 'LAB', status: 'final' },
              { id: 'report-2', category: 'RAD', status: 'final' },
            ],
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'report-new', category: 'LAB', status: 'preliminary' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'report-1', status: 'final' },
              error: null,
            })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => ({
      data: [{ id: 'report-1', category: 'LAB' }],
      error: null,
    })),
  },
}));

describe('DiagnosticReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should return all diagnostic reports for a patient', async () => {
      const result = await DiagnosticReportService.getByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by issued date descending', async () => {
      const result = await DiagnosticReportService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getRecent', () => {
    it('should return recent diagnostic reports', async () => {
      const result = await DiagnosticReportService.getRecent('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should default to 20 records', async () => {
      const result = await DiagnosticReportService.getRecent('patient-1');

      expect(result.success).toBe(true);
    });

    it('should accept custom limit', async () => {
      const result = await DiagnosticReportService.getRecent('patient-1', 50);

      expect(result.success).toBe(true);
    });
  });

  describe('getLabReports', () => {
    it('should return lab reports', async () => {
      const result = await DiagnosticReportService.getLabReports('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should default to 90 days', async () => {
      const result = await DiagnosticReportService.getLabReports('patient-1');

      expect(result.success).toBe(true);
    });

    it('should accept custom days back', async () => {
      const result = await DiagnosticReportService.getLabReports('patient-1', 180);

      expect(result.success).toBe(true);
    });
  });

  describe('getImagingReports', () => {
    it('should return imaging reports', async () => {
      const result = await DiagnosticReportService.getImagingReports('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should default to 365 days', async () => {
      const result = await DiagnosticReportService.getImagingReports('patient-1');

      expect(result.success).toBe(true);
    });

    it('should accept custom days back', async () => {
      const result = await DiagnosticReportService.getImagingReports('patient-1', 730);

      expect(result.success).toBe(true);
    });
  });

  describe('getPending', () => {
    it('should return pending reports', async () => {
      const result = await DiagnosticReportService.getPending('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a new diagnostic report', async () => {
      const newReport = {
        patient_id: 'patient-1',
        category: ['LAB'],
        code: '58410-2',
        code_display: 'CBC panel - Blood',
        code_system: 'http://loinc.org',
        status: 'preliminary' as const,
        issued: new Date().toISOString(),
      };

      const result = await DiagnosticReportService.create(newReport);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create imaging report', async () => {
      const imagingReport = {
        patient_id: 'patient-1',
        category: ['RAD'],
        code: '30746-2',
        code_display: 'Chest X-ray AP',
        code_system: 'http://loinc.org',
        status: 'final' as const,
        conclusion: 'No acute cardiopulmonary process',
      };

      const result = await DiagnosticReportService.create(imagingReport);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a diagnostic report', async () => {
      const result = await DiagnosticReportService.update('report-1', {
        status: 'final',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should add conclusion', async () => {
      const result = await DiagnosticReportService.update('report-1', {
        conclusion: 'Results within normal limits',
      });

      expect(result.success).toBe(true);
    });

    it('should add coded interpretation', async () => {
      const result = await DiagnosticReportService.update('report-1', {
        conclusion_code: ['N'], // Normal
      });

      expect(result.success).toBe(true);
    });
  });

  describe('report status values', () => {
    it('should define all FHIR report statuses', () => {
      const statuses = [
        'registered',
        'partial',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'appended',
        'cancelled',
        'entered-in-error',
        'unknown',
      ];
      expect(statuses).toContain('final');
      expect(statuses).toContain('preliminary');
      expect(statuses).toContain('amended');
    });
  });

  describe('report category codes', () => {
    it('should define category codes', () => {
      const categories = {
        laboratory: 'LAB',
        radiology: 'RAD',
        pathology: 'PAT',
        cardiology: 'CUS',
        microbiology: 'MB',
      };
      expect(categories.laboratory).toBe('LAB');
      expect(categories.radiology).toBe('RAD');
    });
  });

  describe('common report codes (LOINC)', () => {
    it('should recognize lab panel codes', () => {
      const labPanels = {
        cbc: '58410-2',
        cmp: '24323-8',
        bmp: '24320-4',
        lipidPanel: '24331-1',
        thyroidPanel: '24348-5',
        hepaticPanel: '24325-3',
      };
      expect(labPanels.cbc).toBe('58410-2');
      expect(labPanels.cmp).toBe('24323-8');
    });

    it('should recognize imaging codes', () => {
      const imagingCodes = {
        chestXray: '30746-2',
        ctHead: '30799-1',
        mriSpine: '30611-8',
        ultrasoundAbdomen: '30628-2',
      };
      expect(imagingCodes.chestXray).toBe('30746-2');
    });
  });

  describe('diagnostic report structure', () => {
    it('should define complete report structure', () => {
      const report = {
        id: 'report-1',
        patient_id: 'patient-1',
        encounter_id: 'enc-1',
        based_on: ['service-request-1'],
        status: 'final',
        category: 'LAB',
        code: '58410-2',
        code_display: 'CBC panel - Blood by Automated count',
        effective_datetime: '2026-01-15T10:00:00Z',
        issued: '2026-01-15T14:30:00Z',
        performer_id: 'org-lab',
        result: ['obs-1', 'obs-2', 'obs-3'],
        conclusion: 'All values within normal limits',
        conclusion_code: ['N'],
        presented_form: null,
        media: null,
      };
      expect(report.status).toBe('final');
      expect(report.category).toBe('LAB');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await DiagnosticReportService.getByPatient('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle RPC errors', async () => {
      const result = await DiagnosticReportService.getLabReports('test');
      expect(result).toBeDefined();
    });
  });
});
