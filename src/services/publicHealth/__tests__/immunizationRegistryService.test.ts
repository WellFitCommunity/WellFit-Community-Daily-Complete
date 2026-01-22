/**
 * Immunization Registry Service Tests
 *
 * ONC Criteria: 170.315(f)(1)
 * Tests for HL7 VXU message generation and immunization registry reporting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
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
  generateVXUMessage,
  submitImmunization,
  getCVXVaccineName,
  getMVXManufacturerName,
  type ImmunizationRecord,
  type ImmunizationPatientData,
} from '../immunizationRegistryService';
import { supabase } from '../../../lib/supabaseClient';

describe('ImmunizationRegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVXUMessage', () => {
    it('should generate valid HL7 VXU_V04 message', () => {
      const immunization: ImmunizationRecord = {
        id: 'imm-123',
        patientId: 'patient-789',
        vaccineCvxCode: '208',
        vaccineName: 'COVID-19 Pfizer',
        administrationDate: new Date('2026-01-15'),
        lotNumber: 'EK9788',
        expirationDate: new Date('2026-06-30'),
        manufacturerMvxCode: 'PFR',
        administeredByNpi: '1234567890',
        administeredByName: 'Dr. Smith',
        administrationSite: 'LD',
        administrationRoute: 'IM',
        doseNumber: 1,
        seriesName: 'COVID-19 Primary Series',
        fundingSource: 'Private',
        informationSource: '00',
      };

      const patient: ImmunizationPatientData = {
        patientId: 'patient-789',
        mrn: 'MRN12345',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-03-15',
        gender: 'M',
        address: {
          street: '123 Main St',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001',
        },
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
        npi: '1234567890',
        immtracPinNumber: 'PIN12345',
      };

      const hl7Message = generateVXUMessage({
        immunization,
        patient,
        facility,
      });

      // Verify message structure
      expect(hl7Message).toContain('MSH|');
      expect(hl7Message).toContain('VXU^V04^VXU_V04');
      expect(hl7Message).toContain('PID|');
      expect(hl7Message).toContain('ORC|');
      expect(hl7Message).toContain('RXA|');
      expect(hl7Message).toContain('RXR|');
      expect(hl7Message).toContain('OBX|');

      // Verify patient data
      expect(hl7Message).toContain('Doe^John');
      expect(hl7Message).toContain('MRN12345');

      // Verify vaccine data
      expect(hl7Message).toContain('208');  // CVX code
      expect(hl7Message).toContain('EK9788'); // Lot number
      expect(hl7Message).toContain('PFR');  // Manufacturer MVX
    });

    it('should include guardian info for pediatric patients', () => {
      const immunization: ImmunizationRecord = {
        id: 'imm-124',
        patientId: 'patient-child',
        vaccineCvxCode: '20',
        vaccineName: 'DTaP',
        administrationDate: new Date('2026-01-10'),
        administrationRoute: 'IM',
        doseNumber: 1,
      };

      const patient: ImmunizationPatientData = {
        patientId: 'patient-child',
        mrn: 'MRN-CHILD',
        firstName: 'Emma',
        lastName: 'Johnson',
        dateOfBirth: '2024-06-01',
        gender: 'F',
        guardianName: 'Sarah Johnson',
        guardianRelationship: 'MTH',
      };

      const facility = {
        id: 'fac-001',
        name: 'Pediatric Clinic',
      };

      const hl7Message = generateVXUMessage({
        immunization,
        patient,
        facility,
      });

      expect(hl7Message).toContain('PD1|');
      expect(hl7Message).toContain('NK1|');
      expect(hl7Message).toContain('Sarah Johnson');
      expect(hl7Message).toContain('MTH');
    });

    it('should handle historical immunization records', () => {
      const immunization: ImmunizationRecord = {
        id: 'imm-hist',
        patientId: 'patient-789',
        vaccineCvxCode: '03',
        vaccineName: 'MMR',
        administrationDate: new Date('2020-05-15'),
        informationSource: '01', // Historical
      };

      const patient: ImmunizationPatientData = {
        patientId: 'patient-789',
        mrn: 'MRN12345',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-03-15',
        gender: 'M',
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
      };

      const hl7Message = generateVXUMessage({
        immunization,
        patient,
        facility,
      });

      expect(hl7Message).toContain('VXU^V04');
      expect(hl7Message).toContain('03'); // CVX for MMR
    });
  });

  describe('getCVXVaccineName', () => {
    it('should return correct vaccine name for known CVX codes', () => {
      expect(getCVXVaccineName('208')).toBe('COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL');
      expect(getCVXVaccineName('03')).toBe('MMR');
      expect(getCVXVaccineName('115')).toBe('Tdap');
      expect(getCVXVaccineName('140')).toBe('Influenza, seasonal, injectable');
      expect(getCVXVaccineName('187')).toBe('Zoster, recombinant');
    });

    it('should return null for unknown CVX codes', () => {
      expect(getCVXVaccineName('999')).toBeNull();
      expect(getCVXVaccineName('XYZ')).toBeNull();
    });
  });

  describe('getMVXManufacturerName', () => {
    it('should return correct manufacturer name for known MVX codes', () => {
      expect(getMVXManufacturerName('PFR')).toBe('Pfizer');
      expect(getMVXManufacturerName('MOD')).toBe('Moderna');
      expect(getMVXManufacturerName('GSK')).toBe('GlaxoSmithKline');
      expect(getMVXManufacturerName('MSD')).toBe('Merck & Co');
    });

    it('should return null for unknown MVX codes', () => {
      expect(getMVXManufacturerName('XXX')).toBeNull();
    });
  });

  describe('submitImmunization', () => {
    it('should create immunization submission record', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sub-123',
                tenant_id: 'tenant-123',
                patient_id: 'patient-789',
                immunization_id: 'imm-123',
                vaccine_cvx_code: '208',
                vaccine_name: 'COVID-19 Pfizer',
                administration_date: '2026-01-15',
                registry_name: 'TX_IMMTRAC2',
                message_control_id: 'WF123ABC',
                hl7_message: 'MSH|...',
                status: 'pending',
              },
              error: null,
            }),
          }),
        }),
      } as never);

      const immunization: ImmunizationRecord = {
        id: 'imm-123',
        patientId: 'patient-789',
        vaccineCvxCode: '208',
        vaccineName: 'COVID-19 Pfizer',
        administrationDate: new Date('2026-01-15'),
        administrationRoute: 'IM',
      };

      const patient: ImmunizationPatientData = {
        patientId: 'patient-789',
        mrn: 'MRN12345',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-03-15',
        gender: 'M',
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
      };

      const result = await submitImmunization('tenant-123', immunization, patient, facility);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('sub-123');
      expect(result.data?.vaccineCvxCode).toBe('208');
      expect(result.data?.status).toBe('pending');
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

      const immunization: ImmunizationRecord = {
        id: 'imm-123',
        patientId: 'patient-789',
        vaccineCvxCode: '208',
        vaccineName: 'COVID-19',
        administrationDate: new Date('2026-01-15'),
      };

      const patient: ImmunizationPatientData = {
        patientId: 'patient-789',
        mrn: 'MRN12345',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-03-15',
        gender: 'M',
      };

      const result = await submitImmunization('tenant-123', immunization, patient, { id: 'fac', name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });
});
