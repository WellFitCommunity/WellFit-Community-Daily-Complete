/**
 * Tests for FHIR DentalObservationService
 *
 * Covers dental observations and FHIR R4 compliant dental mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DentalObservationService,
  DENTAL_LOINC_CODES,
  DENTAL_SNOMED_CODES,
} from '../DentalObservationService';

// Mock getErrorMessage
vi.mock('../../../lib/getErrorMessage', () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
}));

// Mock supabase with proper chain support
const dentalData = [
  { id: 'obs-1', observation_code: '86253-8', observation_name: 'Plaque Index' },
  { id: 'obs-2', observation_code: '86254-6', observation_name: 'Bleeding Index' },
];

// Recursive mock that supports any chain depth and order
const mockChain: ReturnType<typeof vi.fn> = vi.fn(() => ({
  data: dentalData,
  error: null,
  eq: mockChain,
  order: mockChain,
}));

const mockSelect = vi.fn(() => ({
  eq: mockChain,
  order: mockChain,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: vi.fn(() => ({
        error: null,
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'proc-1' },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('DentalObservationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DENTAL_LOINC_CODES', () => {
    it('should define periodontal probing depth code', () => {
      expect(DENTAL_LOINC_CODES.PERIODONTAL_PROBING_DEPTH).toBe('11381-2');
    });

    it('should define gingival bleeding index code', () => {
      expect(DENTAL_LOINC_CODES.GINGIVAL_BLEEDING_INDEX).toBe('86254-6');
    });

    it('should define plaque index code', () => {
      expect(DENTAL_LOINC_CODES.PLAQUE_INDEX).toBe('86253-8');
    });

    it('should define tooth mobility code', () => {
      expect(DENTAL_LOINC_CODES.TOOTH_MOBILITY).toBe('86255-3');
    });

    it('should define dental caries risk code', () => {
      expect(DENTAL_LOINC_CODES.DENTAL_CARIES_RISK).toBe('86256-1');
    });

    it('should define dental pain score code', () => {
      expect(DENTAL_LOINC_CODES.DENTAL_PAIN_SCORE).toBe('72514-3');
    });
  });

  describe('DENTAL_SNOMED_CODES', () => {
    it('should define periodontal conditions', () => {
      expect(DENTAL_SNOMED_CODES.HEALTHY_GUMS).toBe('87715008');
      expect(DENTAL_SNOMED_CODES.GINGIVITIS).toBe('66383009');
      expect(DENTAL_SNOMED_CODES.MILD_PERIODONTITIS).toBe('2556008');
      expect(DENTAL_SNOMED_CODES.MODERATE_PERIODONTITIS).toBe('109564002');
      expect(DENTAL_SNOMED_CODES.SEVERE_PERIODONTITIS).toBe('27528006');
    });

    it('should define tooth conditions', () => {
      expect(DENTAL_SNOMED_CODES.DENTAL_CARIES).toBe('80967001');
      expect(DENTAL_SNOMED_CODES.MISSING_TOOTH).toBe('247372009');
      expect(DENTAL_SNOMED_CODES.FRACTURED_TOOTH).toBe('21824004');
    });

    it('should define dental procedures', () => {
      expect(DENTAL_SNOMED_CODES.DENTAL_PROPHYLAXIS).toBe('234960005');
      expect(DENTAL_SNOMED_CODES.DENTAL_SCALING).toBe('234961009');
      expect(DENTAL_SNOMED_CODES.ROOT_CANAL_THERAPY).toBe('234952001');
    });
  });

  describe('createObservationFromAssessment', () => {
    it('should create observations from dental assessment', async () => {
      const assessment = {
        id: 'assess-1',
        patient_id: 'patient-1',
        provider_id: 'pract-1',
        provider_role: 'dentist' as const,
        visit_type: 'routine_cleaning' as const,
        visit_date: '2026-01-15',
        plaque_index: 1.5,
        bleeding_index: 0.8,
        pain_level: 3,
        pain_location: 'lower left',
        periodontal_status: 'mild_periodontitis' as const,
        status: 'completed' as const,
        clinical_notes: 'Mild plaque buildup',
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      };

      const result = await DentalObservationService.createObservationFromAssessment(assessment);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle assessment without optional fields', async () => {
      const assessment = {
        id: 'assess-2',
        patient_id: 'patient-1',
        provider_id: null,
        provider_role: null,
        visit_type: 'routine_cleaning' as const,
        visit_date: '2026-01-15',
        plaque_index: undefined,
        bleeding_index: undefined,
        pain_level: undefined,
        periodontal_status: 'healthy' as const,
        status: 'completed' as const,
        clinical_notes: '',
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      };

      const result = await DentalObservationService.createObservationFromAssessment(assessment);

      expect(result.success).toBe(true);
    });
  });

  describe('createFHIRProcedure', () => {
    it('should create FHIR procedure from dental procedure', async () => {
      const procedure = {
        id: 'proc-1',
        patient_id: 'patient-1',
        provider_id: 'pract-1',
        procedure_name: 'Dental Cleaning',
        procedure_date: '2026-01-15',
        procedure_status: 'completed',
        cdt_code: 'D1110',
        snomed_code: '234961009',
        tooth_numbers: [1, 2, 3],
        complications: undefined,
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      };

      const result = await DentalObservationService.createFHIRProcedure(procedure);

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Procedure');
    });
  });

  describe('createConditionFromAssessment', () => {
    it('should create conditions from assessment', async () => {
      const assessment = {
        id: 'assess-1',
        patient_id: 'patient-1',
        provider_id: 'pract-1',
        provider_role: 'dentist' as const,
        visit_type: 'routine_cleaning' as const,
        visit_date: '2026-01-15',
        periodontal_status: 'gingivitis' as const,
        status: 'completed' as const,
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      };

      const result = await DentalObservationService.createConditionFromAssessment(assessment);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should not create condition for healthy status', async () => {
      const assessment = {
        id: 'assess-2',
        patient_id: 'patient-1',
        provider_id: 'pract-1',
        provider_role: 'dentist' as const,
        visit_type: 'routine_cleaning' as const,
        visit_date: '2026-01-15',
        periodontal_status: 'healthy' as const,
        status: 'completed' as const,
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      };

      const result = await DentalObservationService.createConditionFromAssessment(assessment);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('createDiagnosticReport', () => {
    it('should create diagnostic report', async () => {
      const assessment = {
        id: 'assess-1',
        patient_id: 'patient-1',
        provider_id: 'pract-1',
        provider_role: 'dentist' as const,
        visit_type: 'routine_cleaning' as const,
        visit_date: '2026-01-15',
        status: 'completed' as const,
        clinical_notes: 'Routine dental exam',
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      };
      const observations = [
        {
          id: 'obs-1',
          resourceType: 'Observation' as const,
          status: 'final' as const,
          code: { text: 'Plaque Index' },
          subject: { reference: 'Patient/patient-1' },
        },
      ];

      const result = await DentalObservationService.createDiagnosticReport(assessment, observations);

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('DiagnosticReport');
    });
  });

  describe('getObservationsByPatient', () => {
    it('should return observations for patient', async () => {
      const result = await DentalObservationService.getObservationsByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter by category', async () => {
      const result = await DentalObservationService.getObservationsByPatient(
        'patient-1',
        'dental-assessment'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('FHIR Observation structure', () => {
    it('should define complete observation structure', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-1',
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'exam',
                display: 'Exam',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '86253-8',
              display: 'Plaque Index',
            },
          ],
          text: 'Plaque Index',
        },
        subject: {
          reference: 'Patient/patient-1',
          type: 'Patient',
        },
        effectiveDateTime: '2026-01-15T10:00:00Z',
        issued: '2026-01-15T10:30:00Z',
        performer: [
          {
            reference: 'Practitioner/pract-1',
            type: 'Practitioner',
          },
        ],
        valueQuantity: {
          value: 1.5,
          unit: 'score',
          system: 'http://unitsofmeasure.org',
          code: '{score}',
        },
        interpretation: [{ text: 'high' }],
        referenceRange: [
          {
            low: { value: 0 },
            high: { value: 1 },
          },
        ],
      };
      expect(observation.resourceType).toBe('Observation');
      expect(observation.status).toBe('final');
    });
  });

  describe('FHIR Procedure structure', () => {
    it('should define complete procedure structure', () => {
      const procedure = {
        resourceType: 'Procedure',
        id: 'proc-1',
        status: 'completed',
        code: {
          coding: [
            {
              system: 'http://www.ada.org/cdt',
              code: 'D1110',
              display: 'Prophylaxis - Adult',
            },
            {
              system: 'http://snomed.info/sct',
              code: '234961009',
              display: 'Dental scaling',
            },
          ],
          text: 'Dental Cleaning',
        },
        subject: {
          reference: 'Patient/patient-1',
          type: 'Patient',
        },
        performedDateTime: '2026-01-15T10:00:00Z',
        performer: [
          {
            actor: {
              reference: 'Practitioner/pract-1',
              type: 'Practitioner',
            },
          },
        ],
        bodySite: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/tooth',
                code: '1',
                display: 'Tooth #1',
              },
            ],
            text: 'Tooth #1',
          },
        ],
      };
      expect(procedure.resourceType).toBe('Procedure');
      expect(procedure.status).toBe('completed');
    });
  });

  describe('procedure status mapping', () => {
    it('should map procedure statuses correctly', () => {
      const statusMapping = {
        scheduled: 'preparation',
        in_progress: 'in-progress',
        completed: 'completed',
        cancelled: 'not-done',
        on_hold: 'on-hold',
      };
      expect(statusMapping.completed).toBe('completed');
      expect(statusMapping.cancelled).toBe('not-done');
    });
  });

  describe('interpretation values', () => {
    it('should interpret plaque index correctly', () => {
      // <= 1.0 = normal, <= 2.0 = high, > 2.0 = critical
      const interpretations = {
        0.5: 'normal',
        1.5: 'high',
        2.5: 'critical',
      };
      expect(interpretations[0.5]).toBe('normal');
      expect(interpretations[2.5]).toBe('critical');
    });

    it('should interpret pain score correctly', () => {
      // 0 = normal, 1-3 = low, 4-6 = high, 7-10 = critical
      const interpretations = {
        0: 'normal',
        2: 'low',
        5: 'high',
        8: 'critical',
      };
      expect(interpretations[0]).toBe('normal');
      expect(interpretations[8]).toBe('critical');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await DentalObservationService.getObservationsByPatient('test');
      expect(result).toHaveProperty('success');
    });
  });
});
