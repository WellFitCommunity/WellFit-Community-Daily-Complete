/**
 * Electronic Case Reporting (eCR) Service Tests
 *
 * ONC Criteria: 170.315(f)(3)
 * Tests for eICR CDA document generation and case reporting.
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
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          contains: vi.fn(() => ({
            contains: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
  generateEICRDocument,
  getReportableConditions,
  detectReportableCondition,
  createCaseReport,
  type ReportableCondition,
  type CaseReportTrigger,
  type PatientData,
  type EncounterData,
} from '../ecrService';
import { supabase } from '../../../lib/supabaseClient';

describe('ECRService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEICRDocument', () => {
    it('should generate valid eICR CDA document', () => {
      const condition: ReportableCondition = {
        id: 'cond-123',
        conditionCode: '27836007',
        conditionCodeSystem: 'SNOMED-CT',
        conditionName: 'Pertussis (Whooping Cough)',
        reportingJurisdiction: ['TX', 'ALL'],
        reportingTimeframe: 'immediate',
        isNationallyNotifiable: true,
        conditionCategory: 'Vaccine-Preventable',
        triggerCodes: ['27836007', 'A37.0'],
      };

      const trigger: CaseReportTrigger = {
        type: 'diagnosis',
        code: 'A37.0',
        codeSystem: 'ICD10',
        description: 'Whooping cough due to Bordetella pertussis',
        triggerDate: new Date('2026-01-22'),
        encounterId: 'enc-123',
        conditionId: 'cond-123',
      };

      const patient: PatientData = {
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
          county: 'Harris',
        },
        phone: '555-123-4567',
        occupation: 'Teacher',
        employer: 'Houston ISD',
      };

      const encounter: EncounterData = {
        encounterId: 'enc-123',
        encounterDate: new Date('2026-01-22T10:30:00Z'),
        encounterType: 'Office Visit',
        facilityName: 'Methodist Hospital',
        responsibleProvider: {
          npi: '1234567890',
          name: 'Dr. Smith',
        },
        diagnoses: [
          {
            code: 'A37.0',
            codeSystem: 'ICD10',
            description: 'Whooping cough due to Bordetella pertussis',
            diagnosisDate: new Date('2026-01-22'),
          },
        ],
        labResults: [
          {
            code: '548-8',
            codeSystem: 'LOINC',
            description: 'Bordetella pertussis DNA [Presence] by NAA',
            value: 'Detected',
            resultDate: new Date('2026-01-21'),
          },
        ],
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
        npi: '1234567890',
        oid: '2.16.840.1.113883.4.6.1234567890',
        address: {
          street: '6565 Fannin St',
          city: 'Houston',
          state: 'TX',
          zipCode: '77030',
        },
      };

      const eicrDocument = generateEICRDocument({
        trigger,
        condition,
        patient,
        encounter,
        facility,
      });

      // Verify CDA structure
      expect(eicrDocument).toContain('<?xml version="1.0"');
      expect(eicrDocument).toContain('ClinicalDocument');
      expect(eicrDocument).toContain('urn:hl7-org:v3');

      // Verify template ID
      expect(eicrDocument).toContain('2.16.840.1.113883.10.20.15.2');

      // Verify document type
      expect(eicrDocument).toContain('55751-2'); // Public Health Case Report LOINC code

      // Verify patient data
      expect(eicrDocument).toContain('John');
      expect(eicrDocument).toContain('Doe');
      expect(eicrDocument).toContain('MRN12345');

      // Verify condition
      expect(eicrDocument).toContain('Pertussis');

      // Verify diagnosis
      expect(eicrDocument).toContain('A37.0');
      expect(eicrDocument).toContain('Whooping cough');

      // Verify sections
      expect(eicrDocument).toContain('Encounters');
      expect(eicrDocument).toContain('Problems');
      expect(eicrDocument).toContain('Lab Results');
      expect(eicrDocument).toContain('Social History');
    });

    it('should handle minimal patient data', () => {
      const condition: ReportableCondition = {
        id: 'cond-123',
        conditionCode: '76902006',
        conditionCodeSystem: 'SNOMED-CT',
        conditionName: 'Tetanus',
        reportingJurisdiction: ['TX'],
        reportingTimeframe: 'immediate',
        isNationallyNotifiable: true,
        conditionCategory: 'Vaccine-Preventable',
        triggerCodes: ['76902006'],
      };

      const trigger: CaseReportTrigger = {
        type: 'diagnosis',
        code: 'A35',
        codeSystem: 'ICD10',
        description: 'Other tetanus',
        triggerDate: new Date('2026-01-22'),
        conditionId: 'cond-123',
      };

      const patient: PatientData = {
        patientId: 'patient-789',
        mrn: 'MRN99999',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1990-05-20',
        gender: 'F',
      };

      const encounter: EncounterData = {
        encounterId: 'enc-456',
        encounterDate: new Date('2026-01-22'),
        encounterType: 'Emergency',
        facilityName: 'Test Hospital',
        diagnoses: [
          {
            code: 'A35',
            codeSystem: 'ICD10',
            description: 'Other tetanus',
            diagnosisDate: new Date('2026-01-22'),
          },
        ],
      };

      const facility = {
        id: 'fac-002',
        name: 'Test Hospital',
      };

      const eicrDocument = generateEICRDocument({
        trigger,
        condition,
        patient,
        encounter,
        facility,
      });

      expect(eicrDocument).toContain('ClinicalDocument');
      expect(eicrDocument).toContain('Jane');
      expect(eicrDocument).toContain('Smith');
      expect(eicrDocument).toContain('Tetanus');
    });
  });

  describe('getReportableConditions', () => {
    it('should return active reportable conditions', async () => {
      const mockConditions = [
        {
          id: 'cond-1',
          condition_code: '27836007',
          condition_code_system: 'SNOMED-CT',
          condition_name: 'Pertussis',
          reporting_jurisdiction: ['TX', 'ALL'],
          reporting_timeframe: 'immediate',
          is_nationally_notifiable: true,
          condition_category: 'Vaccine-Preventable',
          trigger_codes: ['27836007', 'A37.0'],
          is_active: true,
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockConditions, error: null }),
          }),
        }),
      } as never);

      const result = await getReportableConditions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].conditionName).toBe('Pertussis');
    });

    it('should filter by jurisdiction', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            contains: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getReportableConditions('TX');

      expect(result.success).toBe(true);
    });
  });

  describe('detectReportableCondition', () => {
    it('should detect reportable condition from diagnosis code', async () => {
      const mockCondition = {
        id: 'cond-1',
        condition_code: '27836007',
        condition_code_system: 'SNOMED-CT',
        condition_name: 'Pertussis',
        reporting_jurisdiction: ['TX', 'ALL'],
        reporting_timeframe: 'immediate',
        is_nationally_notifiable: true,
        condition_category: 'Vaccine-Preventable',
        trigger_codes: ['27836007', 'A37.0'],
        is_active: true,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            contains: vi.fn().mockReturnValue({
              contains: vi.fn().mockResolvedValue({ data: [mockCondition], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await detectReportableCondition('A37.0', 'TX');

      expect(result.success).toBe(true);
      expect(result.data?.conditionName).toBe('Pertussis');
    });

    it('should return null when no match found', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            contains: vi.fn().mockReturnValue({
              contains: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await detectReportableCondition('Z23', 'TX');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('createCaseReport', () => {
    it('should create case report with eICR document', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'ecr-123',
                tenant_id: 'tenant-123',
                patient_id: 'patient-789',
                trigger_condition_id: 'cond-123',
                trigger_type: 'diagnosis',
                trigger_code: 'A37.0',
                trigger_description: 'Pertussis',
                trigger_date: '2026-01-22',
                report_type: 'initial',
                eicr_document_id: '2.16.840.1.113883.4.6.123456',
                eicr_version: '3.1',
                eicr_document: '<?xml...',
                destination: 'AIMS',
                status: 'pending',
              },
              error: null,
            }),
          }),
        }),
      } as never);

      const condition: ReportableCondition = {
        id: 'cond-123',
        conditionCode: '27836007',
        conditionCodeSystem: 'SNOMED-CT',
        conditionName: 'Pertussis',
        reportingJurisdiction: ['TX'],
        reportingTimeframe: 'immediate',
        isNationallyNotifiable: true,
        conditionCategory: 'Vaccine-Preventable',
        triggerCodes: ['A37.0'],
      };

      const trigger: CaseReportTrigger = {
        type: 'diagnosis',
        code: 'A37.0',
        codeSystem: 'ICD10',
        description: 'Pertussis',
        triggerDate: new Date('2026-01-22'),
        conditionId: 'cond-123',
      };

      const result = await createCaseReport(
        'tenant-123',
        trigger,
        condition,
        {
          patientId: 'patient-789',
          mrn: 'MRN123',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1985-01-01',
          gender: 'M',
        },
        {
          encounterId: 'enc-123',
          encounterDate: new Date('2026-01-22'),
          encounterType: 'Office Visit',
          facilityName: 'Test Hospital',
          diagnoses: [{ code: 'A37.0', codeSystem: 'ICD10', description: 'Pertussis', diagnosisDate: new Date() }],
        },
        { id: 'fac-1', name: 'Test Hospital' }
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('ecr-123');
      expect(result.data?.status).toBe('pending');
      expect(result.data?.destination).toBe('AIMS');
    });
  });
});
