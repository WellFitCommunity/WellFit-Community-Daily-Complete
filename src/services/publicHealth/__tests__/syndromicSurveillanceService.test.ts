/**
 * Syndromic Surveillance Service Tests
 *
 * ONC Criteria: 170.315(f)(2)
 * Tests for HL7 ADT message generation and syndromic surveillance reporting.
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
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: null, error: null })),
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
  generateADTMessage,
  determineSurveillanceCategory,
  flagEncounterForSurveillance,
  getPendingEncounters,
  type SyndromicEncounter,
  type SyndromicPatientData,
} from '../syndromicSurveillanceService';
import { supabase } from '../../../lib/supabaseClient';

describe('SyndromicSurveillanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateADTMessage', () => {
    it('should generate valid HL7 ADT_A04 message', () => {
      const encounter: SyndromicEncounter = {
        id: 'enc-123',
        tenantId: 'tenant-123',
        encounterId: 'visit-456',
        patientId: 'patient-789',
        encounterDate: new Date('2026-01-22T10:30:00Z'),
        encounterType: 'ED',
        chiefComplaint: 'Fever and cough',
        chiefComplaintCode: 'R50.9',
        chiefComplaintCodeSystem: 'ICD10',
        diagnosisCodes: ['J06.9', 'R50.9'],
        diagnosisDescriptions: ['Acute upper respiratory infection', 'Fever'],
        dispositionCode: '01',
        dispositionDescription: 'Discharged to home',
        status: 'pending',
      };

      const patient: SyndromicPatientData = {
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
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
        npi: '1234567890',
      };

      const hl7Message = generateADTMessage({
        eventType: 'A04',
        encounter,
        patient,
        facility,
      });

      // Verify message structure
      expect(hl7Message).toContain('MSH|');
      expect(hl7Message).toContain('ADT^A04^ADT_A04');
      expect(hl7Message).toContain('EVN|A04');
      expect(hl7Message).toContain('PID|');
      expect(hl7Message).toContain('PV1|');
      expect(hl7Message).toContain('PV2|');
      expect(hl7Message).toContain('DG1|');

      // Verify patient data
      expect(hl7Message).toContain('Doe^John');
      expect(hl7Message).toContain('MRN12345');
      expect(hl7Message).toContain('19850315');

      // Verify diagnosis codes
      expect(hl7Message).toContain('J06.9');
      expect(hl7Message).toContain('R50.9');
    });

    it('should generate ADT_A01 for admits', () => {
      const encounter: SyndromicEncounter = {
        id: 'enc-123',
        tenantId: 'tenant-123',
        encounterId: 'visit-456',
        patientId: 'patient-789',
        encounterDate: new Date('2026-01-22T10:30:00Z'),
        encounterType: 'ED',
        diagnosisCodes: ['A09'],
        diagnosisDescriptions: ['Infectious gastroenteritis'],
        status: 'pending',
      };

      const patient: SyndromicPatientData = {
        patientId: 'patient-789',
        mrn: 'MRN12345',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1990-07-20',
        gender: 'F',
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
      };

      const hl7Message = generateADTMessage({
        eventType: 'A01',
        encounter,
        patient,
        facility,
      });

      expect(hl7Message).toContain('ADT^A01^ADT_A01');
      expect(hl7Message).toContain('EVN|A01');
    });

    it('should generate ADT_A03 for discharges', () => {
      const encounter: SyndromicEncounter = {
        id: 'enc-123',
        tenantId: 'tenant-123',
        encounterId: 'visit-456',
        patientId: 'patient-789',
        encounterDate: new Date('2026-01-22T10:30:00Z'),
        encounterType: 'ED',
        diagnosisCodes: ['R05.9'],
        diagnosisDescriptions: ['Cough'],
        dispositionCode: '01',
        status: 'pending',
      };

      const patient: SyndromicPatientData = {
        patientId: 'patient-789',
        mrn: 'MRN12345',
        firstName: 'Bob',
        lastName: 'Johnson',
        dateOfBirth: '1975-12-01',
        gender: 'M',
      };

      const facility = {
        id: 'fac-001',
        name: 'Methodist Hospital',
      };

      const hl7Message = generateADTMessage({
        eventType: 'A03',
        encounter,
        patient,
        facility,
      });

      expect(hl7Message).toContain('ADT^A03^ADT_A03');
    });
  });

  describe('determineSurveillanceCategory', () => {
    it('should categorize respiratory conditions', () => {
      expect(determineSurveillanceCategory(['J06.9'])).toBe('Respiratory');
      expect(determineSurveillanceCategory(['J11.1'])).toBe('Respiratory');
      expect(determineSurveillanceCategory(['R05'])).toBe('Respiratory');
    });

    it('should categorize gastrointestinal conditions', () => {
      expect(determineSurveillanceCategory(['A09'])).toBe('Gastrointestinal');
      expect(determineSurveillanceCategory(['A04.7'])).toBe('Gastrointestinal');
      expect(determineSurveillanceCategory(['R11'])).toBe('Gastrointestinal');
    });

    it('should categorize fever', () => {
      expect(determineSurveillanceCategory(['R50'])).toBe('Fever');
      expect(determineSurveillanceCategory(['R50.9'])).toBe('Fever');
    });

    it('should categorize neurological conditions', () => {
      expect(determineSurveillanceCategory(['G03.9'])).toBe('Neurological');
      expect(determineSurveillanceCategory(['R40'])).toBe('Neurological');
    });

    it('should categorize rash conditions', () => {
      expect(determineSurveillanceCategory(['R21'])).toBe('Rash');
      expect(determineSurveillanceCategory(['B05.9'])).toBe('Rash');
    });

    it('should categorize sepsis conditions', () => {
      expect(determineSurveillanceCategory(['A41.9'])).toBe('Sepsis');
      expect(determineSurveillanceCategory(['R65.2'])).toBe('Sepsis');
    });

    it('should return null for non-reportable conditions', () => {
      expect(determineSurveillanceCategory(['M54.5'])).toBeNull();
      expect(determineSurveillanceCategory(['Z23'])).toBeNull();
    });

    it('should handle multiple codes and return first match', () => {
      expect(determineSurveillanceCategory(['M54.5', 'J06.9'])).toBe('Respiratory');
    });
  });

  describe('flagEncounterForSurveillance', () => {
    it('should flag encounter and determine surveillance category', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'ss-enc-123', surveillance_category: 'Respiratory' },
              error: null,
            }),
          }),
        }),
      } as never);

      const result = await flagEncounterForSurveillance(
        'tenant-123',
        'encounter-456',
        {
          patientId: 'patient-789',
          encounterDate: new Date('2026-01-22'),
          encounterType: 'ED',
          diagnosisCodes: ['J06.9'],
          diagnosisDescriptions: ['URI'],
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('ss-enc-123');
      expect(result.data?.surveillanceCategory).toBe('Respiratory');
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

      const result = await flagEncounterForSurveillance(
        'tenant-123',
        'encounter-456',
        {
          patientId: 'patient-789',
          encounterDate: new Date('2026-01-22'),
          encounterType: 'ED',
          diagnosisCodes: ['J06.9'],
          diagnosisDescriptions: ['URI'],
        }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('getPendingEncounters', () => {
    it('should return pending reportable encounters', async () => {
      const mockEncounters = [
        {
          id: 'ss-enc-1',
          tenant_id: 'tenant-123',
          encounter_id: 'enc-1',
          patient_id: 'patient-1',
          encounter_date: '2026-01-22T10:00:00Z',
          encounter_type: 'ED',
          diagnosis_codes: ['J06.9'],
          diagnosis_descriptions: ['URI'],
          surveillance_category: 'Respiratory',
          status: 'pending',
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockEncounters, error: null }),
                }),
              }),
            }),
          }),
        }),
      } as never);

      const result = await getPendingEncounters('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].encounterId).toBe('enc-1');
    });
  });
});
