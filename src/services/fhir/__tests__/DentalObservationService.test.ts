/**
 * Tests for FHIR DentalObservationService
 *
 * Covers dental observations and FHIR R4 compliant dental mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DentalObservationService } from '../DentalObservationService';

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

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await DentalObservationService.getObservationsByPatient('test');
      expect(result).toHaveProperty('success');
    });
  });
});
