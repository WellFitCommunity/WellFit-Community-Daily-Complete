/**
 * Antimicrobial Surveillance Service Tests
 *
 * ONC Criteria: 170.315(f)(4)
 * Tests for NHSN CDA document generation and antimicrobial use/resistance reporting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
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
  generateAUDocument,
  generateARDocument,
  classifyAntimicrobial,
  recordAntimicrobialUsage,
  recordResistance,
  getMDROTypes,
  getAntimicrobialClasses,
  type AntimicrobialUsageRecord,
  type AntimicrobialResistanceRecord,
} from '../antimicrobialSurveillanceService';
import { supabase } from '../../../lib/supabaseClient';

describe('AntimicrobialSurveillanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAUDocument', () => {
    it('should generate valid NHSN AU CDA document', () => {
      const usageRecords: AntimicrobialUsageRecord[] = [
        {
          id: 'usage-1',
          tenantId: 'tenant-123',
          patientId: 'patient-789',
          medicationCode: '311989',
          medicationCodeSystem: 'RxNorm',
          medicationName: 'Amoxicillin 500 MG',
          antimicrobialClass: 'Penicillins',
          route: 'PO',
          frequency: 'TID',
          durationDays: 10,
          prescriberNpi: '1234567890',
          prescribedDate: new Date('2026-01-15'),
          therapyType: 'empiric',
          includedInNhsnReport: false,
        },
        {
          id: 'usage-2',
          tenantId: 'tenant-123',
          patientId: 'patient-790',
          medicationCode: '197511',
          medicationCodeSystem: 'RxNorm',
          medicationName: 'Ceftriaxone 1 GM',
          antimicrobialClass: 'Cephalosporins - 3rd Gen',
          route: 'IV',
          durationDays: 5,
          prescribedDate: new Date('2026-01-16'),
          therapyType: 'targeted',
          includedInNhsnReport: false,
        },
      ];

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
        npi: '1234567890',
        nhsnOrgId: 'NHSN-ORG-123',
        nhsnFacilityId: 'NHSN-FAC-456',
      };

      const document = generateAUDocument({
        usageRecords,
        facility,
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-01-31'),
      });

      // Verify CDA structure
      expect(document).toContain('<?xml version="1.0"');
      expect(document).toContain('ClinicalDocument');

      // Verify NHSN template
      expect(document).toContain('2.16.840.1.113883.10.20.5.6.260');

      // Verify document type
      expect(document).toContain('51897-7'); // HAI Report LOINC

      // Verify facility
      expect(document).toContain('Methodist Hospital');
      expect(document).toContain('NHSN-ORG-123');

      // Verify usage data
      expect(document).toContain('Amoxicillin');
      expect(document).toContain('Ceftriaxone');
      expect(document).toContain('Penicillins');
      expect(document).toContain('Cephalosporins');

      // Verify summary sections
      expect(document).toContain('Antimicrobial Use Summary');
      expect(document).toContain('Summary by Antimicrobial Class');
    });
  });

  describe('generateARDocument', () => {
    it('should generate valid NHSN AR CDA document', () => {
      const resistanceRecords: AntimicrobialResistanceRecord[] = [
        {
          id: 'res-1',
          tenantId: 'tenant-123',
          patientId: 'patient-789',
          specimenType: 'Blood',
          specimenCollectionDate: new Date('2026-01-20'),
          organismCode: '3092008',
          organismCodeSystem: 'SNOMED-CT',
          organismName: 'Staphylococcus aureus',
          antimicrobialTested: 'Oxacillin',
          interpretation: 'R',
          isMdro: true,
          mdroType: 'MRSA',
          labName: 'Methodist Lab',
          includedInNhsnReport: false,
        },
        {
          id: 'res-2',
          tenantId: 'tenant-123',
          patientId: 'patient-790',
          specimenType: 'Urine',
          specimenCollectionDate: new Date('2026-01-21'),
          organismCode: '112283007',
          organismCodeSystem: 'SNOMED-CT',
          organismName: 'Escherichia coli',
          antimicrobialTested: 'Ciprofloxacin',
          interpretation: 'S',
          micValue: 0.25,
          micUnit: 'mcg/mL',
          isMdro: false,
          includedInNhsnReport: false,
        },
      ];

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
        npi: '1234567890',
        nhsnOrgId: 'NHSN-ORG-123',
      };

      const document = generateARDocument({
        resistanceRecords,
        facility,
        reportingPeriodStart: new Date('2026-01-01'),
        reportingPeriodEnd: new Date('2026-01-31'),
      });

      // Verify CDA structure
      expect(document).toContain('<?xml version="1.0"');
      expect(document).toContain('ClinicalDocument');

      // Verify NHSN AR template
      expect(document).toContain('2.16.840.1.113883.10.20.5.6.261');

      // Verify organisms
      expect(document).toContain('Staphylococcus aureus');
      expect(document).toContain('Escherichia coli');

      // Verify MDRO section
      expect(document).toContain('Multi-Drug Resistant Organisms');
      expect(document).toContain('MRSA');

      // Verify interpretation codes
      expect(document).toContain('>R<'); // Resistant
      expect(document).toContain('>S<'); // Susceptible
    });
  });

  describe('classifyAntimicrobial', () => {
    it('should classify penicillins', () => {
      expect(classifyAntimicrobial('Amoxicillin 500mg')).toBe('Penicillins');
      expect(classifyAntimicrobial('Piperacillin-Tazobactam')).toBe('Penicillins');
    });

    it('should classify cephalosporins', () => {
      expect(classifyAntimicrobial('Cefazolin 1g')).toBe('Cephalosporins - 1st Gen');
      expect(classifyAntimicrobial('Ceftriaxone 2g')).toBe('Cephalosporins - 3rd Gen');
      expect(classifyAntimicrobial('Cefepime 1g')).toBe('Cephalosporins - 4th Gen');
    });

    it('should classify carbapenems', () => {
      expect(classifyAntimicrobial('Meropenem 500mg')).toBe('Carbapenems');
      expect(classifyAntimicrobial('Imipenem-Cilastatin')).toBe('Carbapenems');
    });

    it('should classify fluoroquinolones', () => {
      expect(classifyAntimicrobial('Ciprofloxacin 500mg')).toBe('Fluoroquinolones');
      expect(classifyAntimicrobial('Levofloxacin 750mg')).toBe('Fluoroquinolones');
    });

    it('should classify glycopeptides', () => {
      expect(classifyAntimicrobial('Vancomycin 1g')).toBe('Glycopeptides');
    });

    it('should classify macrolides', () => {
      expect(classifyAntimicrobial('Azithromycin 250mg')).toBe('Macrolides');
    });

    it('should classify tetracyclines', () => {
      expect(classifyAntimicrobial('Doxycycline 100mg')).toBe('Tetracyclines');
    });

    it('should return null for non-antimicrobials', () => {
      expect(classifyAntimicrobial('Lisinopril 10mg')).toBeNull();
      expect(classifyAntimicrobial('Metformin 500mg')).toBeNull();
    });
  });

  describe('getMDROTypes', () => {
    it('should return all MDRO types', () => {
      const types = getMDROTypes();

      expect(types['MRSA']).toBe('Methicillin-resistant Staphylococcus aureus');
      expect(types['VRE']).toBe('Vancomycin-resistant Enterococcus');
      expect(types['CRE']).toBe('Carbapenem-resistant Enterobacteriaceae');
      expect(types['ESBL']).toBe('Extended-Spectrum Beta-Lactamase Producer');
      expect(types['C.diff']).toBe('Clostridioides difficile');
    });
  });

  describe('getAntimicrobialClasses', () => {
    it('should return all antimicrobial classes', () => {
      const classes = getAntimicrobialClasses();

      expect(classes['Penicillins']).toContain('Amoxicillin');
      expect(classes['Carbapenems']).toContain('Meropenem');
      expect(classes['Fluoroquinolones']).toContain('Ciprofloxacin');
      expect(classes['Glycopeptides']).toContain('Vancomycin');
    });
  });

  describe('recordAntimicrobialUsage', () => {
    it('should record antimicrobial usage with auto-classification', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'usage-123' },
              error: null,
            }),
          }),
        }),
      } as never);

      const result = await recordAntimicrobialUsage('tenant-123', {
        patientId: 'patient-789',
        medicationCode: '311989',
        medicationCodeSystem: 'RxNorm',
        medicationName: 'Amoxicillin 500 MG',
        antimicrobialClass: '', // Empty - should auto-classify
        route: 'PO',
        prescribedDate: new Date('2026-01-15'),
        therapyType: 'empiric',
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('usage-123');
    });

    it('should handle database errors', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as never);

      const result = await recordAntimicrobialUsage('tenant-123', {
        patientId: 'patient-789',
        medicationCode: '311989',
        medicationCodeSystem: 'RxNorm',
        medicationName: 'Amoxicillin',
        antimicrobialClass: 'Penicillins',
        route: 'PO',
        prescribedDate: new Date('2026-01-15'),
        therapyType: 'empiric',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('recordResistance', () => {
    it('should record antimicrobial resistance result', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'res-123' },
              error: null,
            }),
          }),
        }),
      } as never);

      const result = await recordResistance('tenant-123', {
        patientId: 'patient-789',
        specimenType: 'Blood',
        specimenCollectionDate: new Date('2026-01-20'),
        organismCode: '3092008',
        organismCodeSystem: 'SNOMED-CT',
        organismName: 'Staphylococcus aureus',
        antimicrobialTested: 'Oxacillin',
        interpretation: 'R',
        isMdro: true,
        mdroType: 'MRSA',
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('res-123');
    });

    it('should handle MDRO detection', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'res-124' },
              error: null,
            }),
          }),
        }),
      } as never);

      const result = await recordResistance('tenant-123', {
        patientId: 'patient-790',
        specimenType: 'Urine',
        specimenCollectionDate: new Date('2026-01-21'),
        organismCode: '112283007',
        organismCodeSystem: 'SNOMED-CT',
        organismName: 'Klebsiella pneumoniae',
        antimicrobialTested: 'Meropenem',
        interpretation: 'R',
        micValue: 8,
        micUnit: 'mcg/mL',
        isMdro: true,
        mdroType: 'CRE',
      });

      expect(result.success).toBe(true);
    });
  });
});
