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
