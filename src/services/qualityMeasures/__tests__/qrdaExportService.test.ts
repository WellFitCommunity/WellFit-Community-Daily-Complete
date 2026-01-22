/**
 * QRDA Export Service Tests
 *
 * Tests for QRDA Category I and III document generation.
 * ONC Criteria: 170.315(c)(2), (c)(3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            in: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          in: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-export-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

// Mock auditLogger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  exportQRDAI,
  exportQRDAIII,
  validateQRDADocument,
  getExportHistory,
} from '../qrdaExportService';
import { supabase } from '../../../lib/supabaseClient';

describe('QRDAExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportQRDAI', () => {
    it('should generate QRDA I document for a patient', async () => {
      // Chain of mocks for the full export flow
      vi.mocked(supabase.from)
        // First call: patient lookup
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'patient-123',
                    mrn: 'MRN001',
                    first_name: 'John',
                    last_name: 'Doe',
                    date_of_birth: '1970-01-15',
                    gender: 'male',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        } as never)
        // Second call: measure results lookup
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      { measure_id: 'CMS122v12', initial_population: true, denominator: true, numerator: true },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        } as never)
        // Third call: tenant lookup
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Test Healthcare', npi: '1234567890' },
                error: null,
              }),
            }),
          }),
        } as never)
        // Fourth call: insert export record
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'export-123' },
                error: null,
              }),
            }),
          }),
        } as never);

      const result = await exportQRDAI({
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12'],
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-12-31'),
        exportType: 'QRDA_I',
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.exportType).toBe('QRDA_I');
      expect(result.data?.xml).toContain('<?xml version="1.0"');
      expect(result.data?.xml).toContain('ClinicalDocument');
    });

    it('should handle patient not found', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Patient not found' },
              }),
            }),
          }),
        }),
      } as never);

      const result = await exportQRDAI({
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12'],
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-12-31'),
        exportType: 'QRDA_I',
        patientId: 'invalid-patient',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('exportQRDAIII', () => {
    it('should generate QRDA III aggregate document', async () => {
      vi.mocked(supabase.from)
        // First call: aggregate results lookup
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      measure_id: 'CMS122v12',
                      initial_population_count: 100,
                      denominator_count: 100,
                      denominator_exclusion_count: 5,
                      numerator_count: 80,
                      performance_rate: 0.8421,
                      patient_count: 100,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        } as never)
        // Second call: tenant lookup
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Test Healthcare System', npi: '1234567890' },
                error: null,
              }),
            }),
          }),
        } as never)
        // Third call: insert export record
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'export-456' },
                error: null,
              }),
            }),
          }),
        } as never);

      const result = await exportQRDAIII({
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12'],
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-12-31'),
        exportType: 'QRDA_III',
      });

      expect(result.success).toBe(true);
      expect(result.data?.exportType).toBe('QRDA_III');
      expect(result.data?.xml).toContain('<?xml version="1.0"');
      expect(result.data?.xml).toContain('ClinicalDocument');
    });

    it('should handle no aggregate data found', async () => {
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Test Healthcare', npi: '1234567890' },
                error: null,
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'export-empty' },
                error: null,
              }),
            }),
          }),
        } as never);

      const result = await exportQRDAIII({
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12'],
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-12-31'),
        exportType: 'QRDA_III',
      });

      expect(result.success).toBe(true);
      expect(result.data?.patientCount).toBe(0);
    });
  });

  describe('validateQRDADocument', () => {
    it('should validate a complete QRDA export record', async () => {
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'export-123',
                  export_type: 'QRDA_III',
                  measure_ids: ['CMS122v12'],
                  reporting_period_start: '2026-01-01',
                  reporting_period_end: '2026-12-31',
                },
                error: null,
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as never);

      const result = await validateQRDADocument('export-123');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errors).toHaveLength(0);
    });

    it('should detect missing measures in export record', async () => {
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'export-456',
                  export_type: 'QRDA_III',
                  measure_ids: [],
                  reporting_period_start: '2026-01-01',
                  reporting_period_end: '2026-12-31',
                },
                error: null,
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as never);

      const result = await validateQRDADocument('export-456');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors.length).toBeGreaterThan(0);
    });

    it('should return not found for invalid export ID', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      } as never);

      const result = await validateQRDADocument('invalid-export');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getExportHistory', () => {
    it('should return export history for a tenant', async () => {
      const mockHistory = [
        {
          id: 'export-1',
          export_type: 'QRDA_III',
          measure_ids: ['CMS122v12'],
          created_at: '2026-01-15T10:00:00Z',
          validation_status: 'valid',
          patient_count: 100,
        },
        {
          id: 'export-2',
          export_type: 'QRDA_I',
          measure_ids: ['CMS122v12', 'CMS165v12'],
          created_at: '2026-01-14T09:00:00Z',
          validation_status: 'pending',
          patient_count: 1,
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockHistory, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getExportHistory('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].exportType).toBe('QRDA_III');
      expect(result.data?.[1].validationStatus).toBe('pending');
    });

    it('should return empty array when no history', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getExportHistory('tenant-new');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
            }),
          }),
        }),
      } as never);

      const result = await getExportHistory('tenant-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('XML Generation', () => {
    it('should include proper XML declaration and encoding', async () => {
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'patient-123',
                    mrn: 'MRN001',
                    first_name: 'Test',
                    last_name: 'Patient',
                    date_of_birth: '1980-01-01',
                    gender: 'male',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [{ measure_id: 'CMS122v12', initial_population: true, denominator: true, numerator: true }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Test Org', npi: '1234567890' },
                error: null,
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'export-xml' },
                error: null,
              }),
            }),
          }),
        } as never);

      const result = await exportQRDAI({
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12'],
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-12-31'),
        exportType: 'QRDA_I',
        patientId: 'patient-123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.xml).toMatch(/^<\?xml version="1\.0"/);
      expect(result.data?.xml).toContain('encoding="UTF-8"');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Network timeout')),
            }),
          }),
        }),
      } as never);

      const result = await exportQRDAI({
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12'],
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-12-31'),
        exportType: 'QRDA_I',
        patientId: 'patient-123',
      });

      expect(result.success).toBe(false);
    });
  });
});
