/**
 * Dental Health Service Tests
 * Comprehensive test suite for dental professional functions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DentalHealthService } from '../dentalHealthService';
import type {
  DentalAssessment,
  CreateDentalAssessmentRequest,
  UpdateDentalAssessmentRequest,
  CreateToothChartEntryRequest,
  CreateDentalProcedureRequest,
  CreateTreatmentPlanRequest,
  CreatePatientTrackingRequest,
  DentalProcedure,
  ToothChartEntry,
  DentalTreatmentPlan,
  PatientDentalHealthTracking,
  CDTCode,
} from '../../types/dentalHealth';

// Mock Supabase client
jest.mock('../../lib/supabaseClient');
jest.mock('../auditLogger');
jest.mock('../fhir/DentalObservationService');

// Setup mocks outside describe block for proper scope
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockAuditLogger = {
  error: jest.fn(),
};

const mockDentalObservationService = {
  createObservationFromAssessment: jest.fn(),
  createConditionFromAssessment: jest.fn(),
  createFHIRProcedure: jest.fn(),
};

describe('DentalHealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mocks to default behavior
    (mockSupabaseClient.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'provider-123' } },
      error: null,
    });

    (require('../../lib/supabaseClient') as any).supabase = mockSupabaseClient;
    (require('../auditLogger') as any).auditLogger = mockAuditLogger;
    (require('../fhir/DentalObservationService') as any).DentalObservationService = mockDentalObservationService;
  });

  // =====================================================
  // DENTAL ASSESSMENTS TESTS
  // =====================================================

  describe('createAssessment', () => {
    it('should create a new dental assessment', async () => {
      const request: CreateDentalAssessmentRequest = {
        patient_id: 'patient-123',
        visit_type: 'routine_cleaning',
        chief_complaint: 'Regular checkup',
        pain_level: 0,
        clinical_notes: 'No issues observed',
      };

      const mockAssessment: DentalAssessment = {
        id: 'assessment-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'routine_cleaning',
        visit_date: '2025-01-15T10:00:00Z',
        status: 'draft',
        chief_complaint: 'Regular checkup',
        pain_level: 0,
        clinical_notes: 'No issues observed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
        created_by: 'provider-123',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockAssessment, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.createAssessment(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.patient_id).toBe('patient-123');
      expect(result.data?.status).toBe('draft');
    });

    it('should handle errors when creating assessment fails', async () => {
      const request: CreateDentalAssessmentRequest = {
        patient_id: 'patient-123',
        visit_type: 'routine_cleaning',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({ data: null, error: { message: 'Database error' } })
            ),
          })),
        })),
      }));

      const result = await DentalHealthService.createAssessment(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser = jest.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      );

      const request: CreateDentalAssessmentRequest = {
        patient_id: 'patient-123',
        visit_type: 'routine_cleaning',
      };

      const result = await DentalHealthService.createAssessment(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  describe('updateAssessment', () => {
    it('should update an existing assessment', async () => {
      const request: UpdateDentalAssessmentRequest = {
        id: 'assessment-123',
        status: 'completed',
        clinical_notes: 'Cleaning completed successfully',
      };

      const mockUpdatedAssessment: DentalAssessment = {
        id: 'assessment-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'routine_cleaning',
        visit_date: '2025-01-15T10:00:00Z',
        status: 'completed',
        clinical_notes: 'Cleaning completed successfully',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T11:00:00Z',
        updated_by: 'provider-123',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({ data: mockUpdatedAssessment, error: null })
              ),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.updateAssessment(request);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
    });

    it('should create FHIR observations when marking assessment as completed', async () => {
      const { DentalObservationService } = require('../fhir/DentalObservationService');

      const request: UpdateDentalAssessmentRequest = {
        id: 'assessment-123',
        status: 'completed',
      };

      const mockAssessment: DentalAssessment = {
        id: 'assessment-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'routine_cleaning',
        visit_date: '2025-01-15T10:00:00Z',
        status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T11:00:00Z',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockAssessment, error: null })),
            })),
          })),
        })),
      }));

      await DentalHealthService.updateAssessment(request);

      expect(DentalObservationService.createObservationFromAssessment).toHaveBeenCalledWith(
        mockAssessment
      );
      expect(DentalObservationService.createConditionFromAssessment).toHaveBeenCalledWith(
        mockAssessment
      );
    });
  });

  describe('getAssessmentById', () => {
    it('should retrieve an assessment by ID', async () => {
      const mockAssessment: DentalAssessment = {
        id: 'assessment-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'comprehensive_exam',
        visit_date: '2025-01-15T10:00:00Z',
        status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockAssessment, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.getAssessmentById('assessment-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('assessment-123');
    });
  });

  describe('getAssessmentsByPatient', () => {
    it('should retrieve all assessments for a patient', async () => {
      const mockAssessments: DentalAssessment[] = [
        {
          id: 'assessment-1',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          provider_role: 'dentist',
          visit_type: 'routine_cleaning',
          visit_date: '2025-01-15T10:00:00Z',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'assessment-2',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          provider_role: 'dentist',
          visit_type: 'comprehensive_exam',
          visit_date: '2024-07-10T09:00:00Z',
          status: 'completed',
          created_at: '2024-07-10T09:00:00Z',
          updated_at: '2024-07-10T09:00:00Z',
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: mockAssessments, error: null })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getAssessmentsByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getLatestAssessment', () => {
    it('should retrieve the latest assessment for a patient', async () => {
      const mockAssessment: DentalAssessment = {
        id: 'assessment-latest',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'routine_cleaning',
        visit_date: '2025-01-15T10:00:00Z',
        status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: mockAssessment, error: null })
                ),
              })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getLatestAssessment('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('assessment-latest');
    });

    it('should return null when patient has no assessments', async () => {
      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getLatestAssessment('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  // =====================================================
  // TOOTH CHART TESTS
  // =====================================================

  describe('createToothChartEntry', () => {
    it('should create a tooth chart entry with probing depths', async () => {
      const request: CreateToothChartEntryRequest = {
        assessment_id: 'assessment-123',
        patient_id: 'patient-123',
        tooth_number: 14,
        condition: 'healthy',
        probing_depths: {
          mb: 2,
          b: 3,
          db: 2,
          ml: 2,
          l: 3,
          dl: 2,
        },
        notes: 'Healthy molar',
      };

      const mockEntry: ToothChartEntry = {
        id: 'tooth-entry-123',
        assessment_id: 'assessment-123',
        patient_id: 'patient-123',
        tooth_number: 14,
        condition: 'healthy',
        probing_depth_mb: 2,
        probing_depth_b: 3,
        probing_depth_db: 2,
        probing_depth_ml: 2,
        probing_depth_l: 3,
        probing_depth_dl: 2,
        notes: 'Healthy molar',
        recorded_date: '2025-01-15',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockEntry, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.createToothChartEntry(request);

      expect(result.success).toBe(true);
      expect(result.data?.tooth_number).toBe(14);
      expect(result.data?.condition).toBe('healthy');
    });
  });

  describe('getToothChartByAssessment', () => {
    it('should retrieve all tooth chart entries for an assessment', async () => {
      const mockEntries: ToothChartEntry[] = [
        {
          id: 'entry-1',
          assessment_id: 'assessment-123',
          patient_id: 'patient-123',
          tooth_number: 1,
          condition: 'healthy',
          recorded_date: '2025-01-15',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'entry-2',
          assessment_id: 'assessment-123',
          patient_id: 'patient-123',
          tooth_number: 2,
          condition: 'cavity',
          recorded_date: '2025-01-15',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: mockEntries, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.getToothChartByAssessment('assessment-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getToothChartSummary', () => {
    it('should calculate tooth chart statistics correctly', async () => {
      const mockAssessment: DentalAssessment = {
        id: 'assessment-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'comprehensive_exam',
        visit_date: '2025-01-15T10:00:00Z',
        status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      };

      const mockTeeth: ToothChartEntry[] = [
        {
          id: 'entry-1',
          assessment_id: 'assessment-123',
          patient_id: 'patient-123',
          tooth_number: 1,
          condition: 'healthy',
          probing_depth_mb: 2,
          probing_depth_b: 2,
          probing_depth_db: 2,
          probing_depth_ml: 2,
          probing_depth_l: 2,
          probing_depth_dl: 2,
          bleeding_on_probing: false,
          recorded_date: '2025-01-15',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'entry-2',
          assessment_id: 'assessment-123',
          patient_id: 'patient-123',
          tooth_number: 2,
          condition: 'cavity',
          probing_depth_mb: 3,
          probing_depth_b: 3,
          probing_depth_db: 3,
          probing_depth_ml: 3,
          probing_depth_l: 3,
          probing_depth_dl: 3,
          bleeding_on_probing: true,
          recorded_date: '2025-01-15',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'entry-3',
          assessment_id: 'assessment-123',
          patient_id: 'patient-123',
          tooth_number: 3,
          condition: 'filling',
          recorded_date: '2025-01-15',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'entry-4',
          assessment_id: 'assessment-123',
          patient_id: 'patient-123',
          tooth_number: 4,
          condition: 'missing',
          recorded_date: '2025-01-15',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
      ];

      // Mock getToothChartByAssessment
      (mockSupabaseClient.from as any) = jest.fn((table: string) => {
        if (table === 'dental_tooth_chart') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: mockTeeth, error: null })),
              })),
            })),
          };
        } else if (table === 'dental_assessments') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockAssessment, error: null })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await DentalHealthService.getToothChartSummary('assessment-123');

      expect(result.success).toBe(true);
      expect(result.data?.total_healthy_teeth).toBe(1);
      expect(result.data?.total_cavities).toBe(1);
      expect(result.data?.total_missing).toBe(1);
      expect(result.data?.total_restored).toBe(1);
      expect(result.data?.bleeding_points_count).toBe(1);
      expect(result.data?.average_probing_depth).toBeCloseTo(2.5, 1);
    });
  });

  // =====================================================
  // DENTAL PROCEDURES TESTS
  // =====================================================

  describe('createProcedure', () => {
    it('should create a dental procedure', async () => {
      const request: CreateDentalProcedureRequest = {
        patient_id: 'patient-123',
        assessment_id: 'assessment-123',
        procedure_name: 'Crown Placement',
        cdt_code: 'D2740',
        tooth_numbers: [14],
        estimated_cost: 1200,
        priority: 'routine',
      };

      const mockProcedure: DentalProcedure = {
        id: 'procedure-123',
        patient_id: 'patient-123',
        assessment_id: 'assessment-123',
        provider_id: 'provider-123',
        procedure_name: 'Crown Placement',
        cdt_code: 'D2740',
        procedure_date: '2025-01-15T10:00:00Z',
        tooth_numbers: [14],
        estimated_cost: 1200,
        priority: 'routine',
        procedure_status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
        created_by: 'provider-123',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockProcedure, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.createProcedure(request);

      expect(result.success).toBe(true);
      expect(result.data?.procedure_name).toBe('Crown Placement');
      expect(result.data?.cdt_code).toBe('D2740');
    });

    it('should create FHIR procedure when successful', async () => {
      const { DentalObservationService } = require('../fhir/DentalObservationService');

      const request: CreateDentalProcedureRequest = {
        patient_id: 'patient-123',
        procedure_name: 'Cleaning',
        cdt_code: 'D1110',
      };

      const mockProcedure: DentalProcedure = {
        id: 'procedure-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        procedure_name: 'Cleaning',
        cdt_code: 'D1110',
        procedure_date: '2025-01-15T10:00:00Z',
        procedure_status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockProcedure, error: null })),
          })),
        })),
      }));

      await DentalHealthService.createProcedure(request);

      expect(DentalObservationService.createFHIRProcedure).toHaveBeenCalledWith(mockProcedure);
    });
  });

  describe('getProceduresByPatient', () => {
    it('should retrieve all procedures for a patient', async () => {
      const mockProcedures: DentalProcedure[] = [
        {
          id: 'proc-1',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          procedure_name: 'Cleaning',
          cdt_code: 'D1110',
          procedure_date: '2025-01-15T10:00:00Z',
          procedure_status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: mockProcedures, error: null })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getProceduresByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getProcedureHistorySummary', () => {
    it('should calculate procedure history statistics', async () => {
      const currentYear = new Date().getFullYear();
      const mockProcedures: DentalProcedure[] = [
        {
          id: 'proc-1',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          procedure_name: 'Cleaning',
          cdt_code: 'D1110',
          procedure_date: `${currentYear}-01-15T10:00:00Z`,
          procedure_status: 'completed',
          estimated_cost: 100,
          created_at: `${currentYear}-01-15T10:00:00Z`,
          updated_at: `${currentYear}-01-15T10:00:00Z`,
        },
        {
          id: 'proc-2',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          procedure_name: 'Exam',
          cdt_code: 'D0120',
          procedure_date: `${currentYear}-01-15T10:00:00Z`,
          procedure_status: 'completed',
          estimated_cost: 50,
          created_at: `${currentYear}-01-15T10:00:00Z`,
          updated_at: `${currentYear}-01-15T10:00:00Z`,
        },
        {
          id: 'proc-3',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          procedure_name: 'Extraction',
          cdt_code: 'D7140',
          procedure_date: `${currentYear}-02-10T10:00:00Z`,
          procedure_status: 'scheduled',
          estimated_cost: 200,
          created_at: `${currentYear}-02-10T10:00:00Z`,
          updated_at: `${currentYear}-02-10T10:00:00Z`,
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: mockProcedures, error: null })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getProcedureHistorySummary('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.total_procedures).toBe(3);
      expect(result.data?.preventive_procedures).toBe(2);
      expect(result.data?.surgical_procedures).toBe(1);
      expect(result.data?.upcoming_scheduled_count).toBe(1);
      expect(result.data?.total_cost_ytd).toBe(350);
    });
  });

  // =====================================================
  // TREATMENT PLAN TESTS
  // =====================================================

  describe('createTreatmentPlan', () => {
    it('should create a treatment plan', async () => {
      const request: CreateTreatmentPlanRequest = {
        patient_id: 'patient-123',
        assessment_id: 'assessment-123',
        plan_name: 'Comprehensive Restoration',
        treatment_goals: ['Restore function', 'Improve aesthetics'],
        total_estimated_cost: 5000,
      };

      const mockPlan: DentalTreatmentPlan = {
        id: 'plan-123',
        patient_id: 'patient-123',
        assessment_id: 'assessment-123',
        provider_id: 'provider-123',
        plan_name: 'Comprehensive Restoration',
        plan_date: '2025-01-15',
        status: 'proposed',
        treatment_goals: ['Restore function', 'Improve aesthetics'],
        total_estimated_cost: 5000,
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
        created_by: 'provider-123',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockPlan, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.createTreatmentPlan(request);

      expect(result.success).toBe(true);
      expect(result.data?.plan_name).toBe('Comprehensive Restoration');
      expect(result.data?.status).toBe('proposed');
    });
  });

  describe('getTreatmentPlansByPatient', () => {
    it('should retrieve all treatment plans for a patient', async () => {
      const mockPlans: DentalTreatmentPlan[] = [
        {
          id: 'plan-1',
          patient_id: 'patient-123',
          provider_id: 'provider-123',
          plan_name: 'Orthodontic Treatment',
          plan_date: '2025-01-15',
          status: 'approved',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: mockPlans, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.getTreatmentPlansByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // =====================================================
  // PATIENT TRACKING TESTS
  // =====================================================

  describe('createPatientTracking', () => {
    it('should create a patient self-tracking entry', async () => {
      const request: CreatePatientTrackingRequest = {
        tooth_pain: true,
        tooth_pain_severity: 5,
        gum_bleeding: false,
        brushed_today: true,
        flossed_today: true,
      };

      const mockTracking: PatientDentalHealthTracking = {
        id: 'tracking-123',
        patient_id: 'provider-123',
        report_date: '2025-01-15',
        tooth_pain: true,
        tooth_pain_severity: 5,
        gum_bleeding: false,
        brushed_today: true,
        flossed_today: true,
        created_at: '2025-01-15T10:00:00Z',
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockTracking, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.createPatientTracking(request);

      expect(result.success).toBe(true);
      expect(result.data?.tooth_pain).toBe(true);
      expect(result.data?.tooth_pain_severity).toBe(5);
    });
  });

  describe('getPatientTrackingHistory', () => {
    it('should retrieve patient tracking history for specified days', async () => {
      const mockTracking: PatientDentalHealthTracking[] = [
        {
          id: 'tracking-1',
          patient_id: 'patient-123',
          report_date: '2025-01-15',
          tooth_pain: false,
          brushed_today: true,
          flossed_today: true,
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'tracking-2',
          patient_id: 'patient-123',
          report_date: '2025-01-14',
          tooth_pain: true,
          tooth_pain_severity: 3,
          brushed_today: true,
          flossed_today: false,
          created_at: '2025-01-14T10:00:00Z',
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockTracking, error: null })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getPatientTrackingHistory('patient-123', 7);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  // =====================================================
  // CDT CODE TESTS
  // =====================================================

  describe('searchCDTCodes', () => {
    it('should search CDT codes by term', async () => {
      const mockCodes: CDTCode[] = [
        {
          code: 'D1110',
          category: 'Preventive',
          description: 'Prophylaxis - adult',
          preventive: true,
          active: true,
        },
        {
          code: 'D1120',
          category: 'Preventive',
          description: 'Prophylaxis - child',
          preventive: true,
          active: true,
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          or: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ data: mockCodes, error: null })),
              })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.searchCDTCodes('cleaning');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getCDTCode', () => {
    it('should retrieve a specific CDT code', async () => {
      const mockCode: CDTCode = {
        code: 'D2740',
        category: 'Restorative',
        description: 'Crown - porcelain/ceramic',
        active: true,
      };

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockCode, error: null })),
          })),
        })),
      }));

      const result = await DentalHealthService.getCDTCode('D2740');

      expect(result.success).toBe(true);
      expect(result.data?.code).toBe('D2740');
      expect(result.data?.description).toBe('Crown - porcelain/ceramic');
    });
  });

  describe('getPreventiveCDTCodes', () => {
    it('should retrieve all preventive CDT codes', async () => {
      const mockCodes: CDTCode[] = [
        {
          code: 'D1110',
          category: 'Preventive',
          description: 'Prophylaxis - adult',
          preventive: true,
          active: true,
        },
        {
          code: 'D1206',
          category: 'Preventive',
          description: 'Topical fluoride varnish',
          preventive: true,
          active: true,
        },
      ];

      (mockSupabaseClient.from as any) = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockCodes, error: null })),
            })),
          })),
        })),
      }));

      const result = await DentalHealthService.getPreventiveCDTCodes();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.every((code) => code.preventive)).toBe(true);
    });
  });

  // =====================================================
  // DASHBOARD TESTS
  // =====================================================

  describe('getDashboardSummary', () => {
    it('should compile comprehensive dashboard data', async () => {
      const mockProfile = { full_name: 'John Doe' };
      const mockAssessment: DentalAssessment = {
        id: 'assessment-123',
        patient_id: 'patient-123',
        provider_id: 'provider-123',
        provider_role: 'dentist',
        visit_type: 'comprehensive_exam',
        visit_date: '2025-01-10T10:00:00Z',
        status: 'completed',
        overall_oral_health_rating: 4,
        periodontal_status: 'healthy',
        next_appointment_recommended_in_months: 6,
        created_at: '2025-01-10T10:00:00Z',
        updated_at: '2025-01-10T10:00:00Z',
      };

      // Mock multiple supabase calls
      let callCount = 0;
      (mockSupabaseClient.from as any) = jest.fn((table: string) => {
        callCount++;

        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockProfile, error: null })),
              })),
            })),
          };
        }

        if (table === 'dental_assessments') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn(() =>
                      Promise.resolve({ data: mockAssessment, error: null })
                    ),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === 'dental_treatment_plans') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          };
        }

        if (table === 'dental_procedures') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          };
        }

        if (table === 'dental_referrals') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          };
        }

        if (table === 'patient_dental_health_tracking') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          };
        }

        if (table === 'dental_tooth_chart') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          };
        }

        return {};
      });

      const result = await DentalHealthService.getDashboardSummary('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.patient_name).toBe('John Doe');
      expect(result.data?.overall_oral_health_rating).toBe(4);
      expect(result.data?.periodontal_status).toBe('healthy');
    });
  });
});
