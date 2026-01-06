/**
 * FHIR Encounter Wrapper Tests
 *
 * Tests for:
 * - toFHIR: Billing encounter to FHIR conversion
 * - getFHIREncounter: Get single encounter by ID
 * - getPatientEncounters: Get all encounters for a patient
 * - searchEncounters: Search with FHIR parameters
 * - getEncounterBundle: Create FHIR Bundle with related resources
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FHIREncounterWrapper, FHIREncounter } from '../fhirEncounterWrapper';
import type { Encounter as BillingEncounter } from '../../types/billing';

// Mock EncounterService
vi.mock('../encounterService', () => ({
  EncounterService: {
    getEncounter: vi.fn(),
    getEncountersByPatient: vi.fn(),
    searchEncounters: vi.fn(),
    getEncounterForBilling: vi.fn(),
  },
}));

import { EncounterService } from '../encounterService';

describe('FHIREncounterWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // toFHIR Tests
  // ==========================================================================
  describe('toFHIR', () => {
    it('should convert billing encounter to FHIR Encounter resource', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.resourceType).toBe('Encounter');
      expect(fhirEncounter.id).toBe('enc-123');
      expect(fhirEncounter.status).toBe('finished');
      expect(fhirEncounter.subject.reference).toBe('Patient/patient-456');
      expect(fhirEncounter.period?.start).toBe('2024-01-15');
    });

    it('should set correct class for ambulatory encounters', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.class.system).toBe('http://terminology.hl7.org/CodeSystem/v3-ActCode');
      expect(fhirEncounter.class.code).toBe('AMB');
      expect(fhirEncounter.class.display).toBe('ambulatory');
    });

    it('should include patient display name when available', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        patient: {
          first_name: 'John',
          last_name: 'Doe',
        },
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.subject.display).toBe('John Doe');
    });

    it('should not include patient display when patient info is missing', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.subject.display).toBeUndefined();
    });

    it('should add provider as participant when available', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        provider: {
          id: 'prov-789',
          organization_name: 'WellFit Clinic',
        },
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.participant).toBeDefined();
      expect(fhirEncounter.participant?.length).toBe(1);
      expect(fhirEncounter.participant?.[0].individual?.reference).toBe('Practitioner/prov-789');
      expect(fhirEncounter.participant?.[0].individual?.display).toBe('WellFit Clinic');
      expect(fhirEncounter.participant?.[0].type?.[0].coding[0].code).toBe('ATND');
    });

    it('should not include participant when provider is missing', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.participant).toBeUndefined();
    });

    it('should map diagnoses to FHIR diagnosis array', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        diagnoses: [
          { code: 'E11.9', sequence: 1 },
          { code: 'I10', sequence: 2 },
        ],
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.diagnosis).toBeDefined();
      expect(fhirEncounter.diagnosis?.length).toBe(2);

      // First diagnosis should be Admission diagnosis
      expect(fhirEncounter.diagnosis?.[0].condition.reference).toBe('Condition/E11.9');
      expect(fhirEncounter.diagnosis?.[0].use?.coding[0].code).toBe('AD');
      expect(fhirEncounter.diagnosis?.[0].rank).toBe(1);

      // Second diagnosis should be Discharge diagnosis
      expect(fhirEncounter.diagnosis?.[1].condition.reference).toBe('Condition/I10');
      expect(fhirEncounter.diagnosis?.[1].use?.coding[0].code).toBe('DD');
      expect(fhirEncounter.diagnosis?.[1].rank).toBe(2);
    });

    it('should handle diagnoses without sequence numbers', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        diagnoses: [
          { code: 'E11.9' },
          { code: 'I10' },
        ],
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.diagnosis?.[0].rank).toBe(1);
      expect(fhirEncounter.diagnosis?.[1].rank).toBe(2);
    });

    it('should not include diagnosis array when no diagnoses present', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        diagnoses: [],
      } as unknown as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(fhirEncounter.diagnosis).toBeUndefined();
    });
  });

  // ==========================================================================
  // getFHIREncounter Tests
  // ==========================================================================
  describe('getFHIREncounter', () => {
    it('should return FHIR encounter for valid encounter ID', async () => {
      const mockBillingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      vi.mocked(EncounterService.getEncounter).mockResolvedValue(mockBillingEncounter);

      const result = await FHIREncounterWrapper.getFHIREncounter('enc-123');

      expect(result).not.toBeNull();
      expect(result?.resourceType).toBe('Encounter');
      expect(result?.id).toBe('enc-123');
      expect(EncounterService.getEncounter).toHaveBeenCalledWith('enc-123');
    });

    it('should return null when encounter not found', async () => {
      vi.mocked(EncounterService.getEncounter).mockRejectedValue(new Error('Not found'));

      const result = await FHIREncounterWrapper.getFHIREncounter('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on service error', async () => {
      vi.mocked(EncounterService.getEncounter).mockRejectedValue(new Error('Database error'));

      const result = await FHIREncounterWrapper.getFHIREncounter('enc-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getPatientEncounters Tests
  // ==========================================================================
  describe('getPatientEncounters', () => {
    it('should return array of FHIR encounters for patient', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
        { id: 'enc-2', patient_id: 'patient-456', date_of_service: '2024-02-20' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.getEncountersByPatient).mockResolvedValue(mockEncounters);

      const result = await FHIREncounterWrapper.getPatientEncounters('patient-456');

      expect(result.length).toBe(2);
      expect(result[0].resourceType).toBe('Encounter');
      expect(result[0].id).toBe('enc-1');
      expect(result[1].id).toBe('enc-2');
      expect(EncounterService.getEncountersByPatient).toHaveBeenCalledWith('patient-456');
    });

    it('should return empty array when patient has no encounters', async () => {
      vi.mocked(EncounterService.getEncountersByPatient).mockResolvedValue([]);

      const result = await FHIREncounterWrapper.getPatientEncounters('patient-456');

      expect(result).toEqual([]);
    });

    it('should return empty array on service error', async () => {
      vi.mocked(EncounterService.getEncountersByPatient).mockRejectedValue(new Error('Database error'));

      const result = await FHIREncounterWrapper.getPatientEncounters('patient-456');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // searchEncounters Tests
  // ==========================================================================
  describe('searchEncounters', () => {
    it('should search encounters by patient ID', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.searchEncounters).mockResolvedValue(mockEncounters);

      const result = await FHIREncounterWrapper.searchEncounters({ patient: 'patient-456' });

      expect(result.length).toBe(1);
      expect(EncounterService.searchEncounters).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: 'patient-456' })
      );
    });

    it('should search encounters by date', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.searchEncounters).mockResolvedValue(mockEncounters);

      const result = await FHIREncounterWrapper.searchEncounters({ date: '2024-01-15' });

      expect(result.length).toBe(1);
      expect(EncounterService.searchEncounters).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: '2024-01-15', dateTo: '2024-01-15' })
      );
    });

    it('should search encounters by status', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.searchEncounters).mockResolvedValue(mockEncounters);

      const result = await FHIREncounterWrapper.searchEncounters({ status: 'finished' });

      expect(result.length).toBe(1);
      expect(EncounterService.searchEncounters).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'finished' })
      );
    });

    it('should filter by class code after retrieval', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
        { id: 'enc-2', patient_id: 'patient-789', date_of_service: '2024-01-16' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.searchEncounters).mockResolvedValue(mockEncounters);

      const result = await FHIREncounterWrapper.searchEncounters({ class: 'AMB' });

      // Both should match since default class is AMB
      expect(result.length).toBe(2);
      expect(result.every(e => e.class.code === 'AMB')).toBe(true);
    });

    it('should filter out encounters that do not match class', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.searchEncounters).mockResolvedValue(mockEncounters);

      // IMP (inpatient) won't match default AMB (ambulatory)
      const result = await FHIREncounterWrapper.searchEncounters({ class: 'IMP' });

      expect(result.length).toBe(0);
    });

    it('should combine multiple search parameters', async () => {
      const mockEncounters = [
        { id: 'enc-1', patient_id: 'patient-456', date_of_service: '2024-01-15' },
      ] as BillingEncounter[];

      vi.mocked(EncounterService.searchEncounters).mockResolvedValue(mockEncounters);

      const result = await FHIREncounterWrapper.searchEncounters({
        patient: 'patient-456',
        date: '2024-01-15',
        status: 'finished',
      });

      expect(result.length).toBe(1);
      expect(EncounterService.searchEncounters).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient-456',
          dateFrom: '2024-01-15',
          dateTo: '2024-01-15',
          status: 'finished',
        })
      );
    });

    it('should return empty array on service error', async () => {
      vi.mocked(EncounterService.searchEncounters).mockRejectedValue(new Error('Database error'));

      const result = await FHIREncounterWrapper.searchEncounters({ patient: 'patient-456' });

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getEncounterBundle Tests
  // ==========================================================================
  describe('getEncounterBundle', () => {
    it('should return FHIR Bundle with encounter', async () => {
      const mockBillingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      // Mock billing data - using type assertion at boundary for test mock
      const mockBillingData = {
        id: 'enc-123',
        diagnoses: [],
        procedures: [],
      } as unknown as Awaited<ReturnType<typeof EncounterService.getEncounterForBilling>>;

      vi.mocked(EncounterService.getEncounter).mockResolvedValue(mockBillingEncounter);
      vi.mocked(EncounterService.getEncounterForBilling).mockResolvedValue(mockBillingData);

      const result = await FHIREncounterWrapper.getEncounterBundle('enc-123');

      expect(result).not.toBeNull();
      expect(result?.resourceType).toBe('Bundle');
      expect(result?.type).toBe('searchset');
      expect(result?.total).toBe(1);
      expect(result?.entry.length).toBe(1);
    });

    it('should include diagnoses count in bundle total', async () => {
      const mockBillingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      // Mock billing data - using type assertion at boundary for test mock
      const mockBillingData = {
        id: 'enc-123',
        diagnoses: [{ code: 'E11.9' }, { code: 'I10' }],
        procedures: [],
      } as unknown as Awaited<ReturnType<typeof EncounterService.getEncounterForBilling>>;

      vi.mocked(EncounterService.getEncounter).mockResolvedValue(mockBillingEncounter);
      vi.mocked(EncounterService.getEncounterForBilling).mockResolvedValue(mockBillingData);

      const result = await FHIREncounterWrapper.getEncounterBundle('enc-123');

      expect(result?.total).toBe(3); // 1 encounter + 2 diagnoses
    });

    it('should include procedures count in bundle total', async () => {
      const mockBillingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      // Mock billing data - using type assertion at boundary for test mock
      const mockBillingData = {
        id: 'enc-123',
        diagnoses: [],
        procedures: [{ code: '99213' }, { code: '99214' }, { code: '90471' }],
      } as unknown as Awaited<ReturnType<typeof EncounterService.getEncounterForBilling>>;

      vi.mocked(EncounterService.getEncounter).mockResolvedValue(mockBillingEncounter);
      vi.mocked(EncounterService.getEncounterForBilling).mockResolvedValue(mockBillingData);

      const result = await FHIREncounterWrapper.getEncounterBundle('enc-123');

      expect(result?.total).toBe(4); // 1 encounter + 3 procedures
    });

    it('should return null when encounter not found', async () => {
      vi.mocked(EncounterService.getEncounter).mockRejectedValue(new Error('Not found'));

      const result = await FHIREncounterWrapper.getEncounterBundle('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on service error', async () => {
      const mockBillingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      vi.mocked(EncounterService.getEncounter).mockResolvedValue(mockBillingEncounter);
      vi.mocked(EncounterService.getEncounterForBilling).mockRejectedValue(new Error('Database error'));

      const result = await FHIREncounterWrapper.getEncounterBundle('enc-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Type Structure Tests
  // ==========================================================================
  describe('FHIREncounter type structure', () => {
    it('should produce valid FHIR Encounter structure', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        patient: { first_name: 'John', last_name: 'Doe' },
        provider: { id: 'prov-789', organization_name: 'WellFit Clinic' },
        diagnoses: [
          { code: 'E11.9', sequence: 1 },
        ],
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      // Validate required FHIR fields
      expect(fhirEncounter.resourceType).toBe('Encounter');
      expect(fhirEncounter.id).toBeTruthy();
      expect(fhirEncounter.status).toBeTruthy();
      expect(fhirEncounter.class).toBeDefined();
      expect(fhirEncounter.class.system).toBeTruthy();
      expect(fhirEncounter.class.code).toBeTruthy();
      expect(fhirEncounter.subject).toBeDefined();
      expect(fhirEncounter.subject.reference).toMatch(/^Patient\//);

      // Validate optional but present fields
      expect(fhirEncounter.participant?.[0].type?.[0].coding[0].system).toBeTruthy();
      expect(fhirEncounter.diagnosis?.[0].use?.coding[0].system).toBeTruthy();
    });

    it('should use correct FHIR terminology systems', () => {
      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
        provider: { id: 'prov-789', organization_name: 'Test' },
        diagnoses: [{ code: 'E11.9', sequence: 1 }],
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      // Verify terminology systems
      expect(fhirEncounter.class.system).toBe('http://terminology.hl7.org/CodeSystem/v3-ActCode');
      expect(fhirEncounter.participant?.[0].type?.[0].coding[0].system)
        .toBe('http://terminology.hl7.org/CodeSystem/v3-ParticipationType');
      expect(fhirEncounter.diagnosis?.[0].use?.coding[0].system)
        .toBe('http://terminology.hl7.org/CodeSystem/diagnosis-role');
    });

    it('should use valid FHIR encounter status values', () => {
      const validStatuses = [
        'planned', 'arrived', 'triaged', 'in-progress',
        'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'
      ];

      const billingEncounter = {
        id: 'enc-123',
        patient_id: 'patient-456',
        date_of_service: '2024-01-15',
      } as BillingEncounter;

      const fhirEncounter = FHIREncounterWrapper.toFHIR(billingEncounter);

      expect(validStatuses).toContain(fhirEncounter.status);
    });
  });
});
