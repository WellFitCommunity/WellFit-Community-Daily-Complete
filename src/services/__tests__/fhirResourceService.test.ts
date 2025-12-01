/**
 * FHIR Resource Service Tests
 * Comprehensive unit tests for MedicationRequest, Condition, DiagnosticReport, and Procedure services
 */
/* eslint-disable testing-library/no-await-sync-query */

// Jest test imports are global
import {
  MedicationRequestService,
  ConditionService,
  DiagnosticReportService,
  ProcedureService,
  ObservationService,
  FHIRService,
} from '../fhirResourceService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('MedicationRequestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should fetch all medication requests for a patient', async () => {
      const mockData = [
        {
          id: '1',
          patient_id: 'patient-123',
          medication_code: '123456',
          medication_display: 'Lisinopril 10mg',
          status: 'active',
          authored_on: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          patient_id: 'patient-123',
          medication_code: '789012',
          medication_display: 'Metformin 500mg',
          status: 'active',
          authored_on: '2025-01-14T09:00:00Z',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith('fhir_medication_requests');
      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.order).toHaveBeenCalledWith('authored_on', { ascending: false });
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.getByPatient('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should return empty array when no data found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getActive', () => {
    it('should fetch active medication requests', async () => {
      const mockData = [
        {
          id: '1',
          patient_id: 'patient-123',
          medication_display: 'Lisinopril 10mg',
          status: 'active',
        },
      ];

      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await MedicationRequestService.getActive('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_active_medication_requests', {
        patient_id_param: 'patient-123',
      });
    });

    it('should handle RPC errors', async () => {
      const mockError = new Error('RPC function not found');
      (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

      const result = await MedicationRequestService.getActive('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC function not found');
    });
  });

  describe('create', () => {
    it('should create a new medication request when no allergies detected', async () => {
      const newRequest = {
        patient_id: 'patient-123',
        medication_code: '123456',
        medication_display: 'Lisinopril 10mg',
        status: 'active' as const,
        intent: 'order' as const,
        authored_on: '2025-01-15T10:00:00Z',
      };

      const mockCreatedData = { ...newRequest, id: 'med-req-1' };

      // Mock allergy check (no allergies)
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      // Mock insert
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCreatedData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.create(newRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedData);
      expect(supabase.rpc).toHaveBeenCalledWith('check_medication_allergy_from_request', {
        patient_id_param: 'patient-123',
        medication_display_param: 'Lisinopril 10mg',
      });
    });

    it('should reject medication request when allergy detected', async () => {
      const newRequest = {
        patient_id: 'patient-123',
        medication_code: '999999',
        medication_display: 'Penicillin',
        status: 'active' as const,
        intent: 'order' as const,
        authored_on: '2025-01-15T10:00:00Z',
      };

      // Mock allergy found
      const allergyData = [
        {
          allergen_name: 'Penicillin',
          severity: 'severe',
          reaction_description: 'Anaphylaxis',
        },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: allergyData, error: null });

      const result = await MedicationRequestService.create(newRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ALLERGY ALERT');
      expect(result.error).toContain('Penicillin');
      expect(result.error).toContain('severe');
      expect(result.error).toContain('Anaphylaxis');
    });

    it('should handle insertion errors', async () => {
      const newRequest = {
        patient_id: 'patient-123',
        medication_code: '123456',
        medication_display: 'Lisinopril 10mg',
        status: 'active' as const,
        intent: 'order' as const,
        authored_on: '2025-01-15T10:00:00Z',
      };

      // No allergies
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      // Insert error
      const insertError = new Error('Constraint violation');
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: insertError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.create(newRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Constraint violation');
    });
  });

  describe('update', () => {
    it('should update a medication request', async () => {
      const updates = { status: 'completed' as const, note: 'Treatment completed' };
      const mockUpdatedData = { id: 'med-req-1', ...updates };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdatedData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.update('med-req-1', updates);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedData);
      expect(mockQuery.update).toHaveBeenCalledWith(updates);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'med-req-1');
    });

    it('should handle update errors', async () => {
      const mockError = new Error('Record not found');
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.update('med-req-1', { status: 'completed' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record not found');
    });
  });

  describe('cancel', () => {
    it('should cancel a medication request with reason', async () => {
      const mockUpdatedData = {
        id: 'med-req-1',
        status: 'cancelled',
        note: 'Cancelled: Patient discontinued',
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdatedData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.cancel('med-req-1', 'Patient discontinued');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('cancelled');
      expect(result.data?.note).toBe('Cancelled: Patient discontinued');
    });

    it('should cancel without reason', async () => {
      const mockUpdatedData = {
        id: 'med-req-1',
        status: 'cancelled',
        note: 'Cancelled',
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdatedData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await MedicationRequestService.cancel('med-req-1');

      expect(result.success).toBe(true);
      expect(result.data?.note).toBe('Cancelled');
    });
  });

  describe('getHistory', () => {
    it('should fetch medication history with default limit', async () => {
      const mockData = [{ id: '1' }, { id: '2' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await MedicationRequestService.getHistory('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_medication_history', {
        patient_id_param: 'patient-123',
        limit_param: 50,
      });
    });

    it('should fetch medication history with custom limit', async () => {
      const mockData = [{ id: '1' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await MedicationRequestService.getHistory('patient-123', 10);

      expect(supabase.rpc).toHaveBeenCalledWith('get_medication_history', {
        patient_id_param: 'patient-123',
        limit_param: 10,
      });
    });
  });
});

describe('ConditionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should fetch all conditions for a patient', async () => {
      const mockData = [
        {
          id: 'cond-1',
          patient_id: 'patient-123',
          code: 'I10',
          code_display: 'Essential hypertension',
          clinical_status: 'active',
          recorded_date: '2025-01-15',
          category: ['problem-list-item'],
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ConditionService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      // Verify normalized data has both FHIR and backwards-compat fields
      expect(result.data).toBeDefined();
      expect(result.data![0]).toMatchObject({
        id: 'cond-1',
        code: 'I10',
        code_code: 'I10', // Backwards compat
        category: ['problem-list-item'],
        category_code: 'problem-list-item', // Backwards compat
      });
      expect(supabase.from).toHaveBeenCalledWith('fhir_conditions');
    });
  });

  describe('getActive', () => {
    it('should fetch active conditions', async () => {
      const mockData = [{ id: 'cond-1', clinical_status: 'active' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ConditionService.getActive('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_active_conditions', {
        patient_id_param: 'patient-123',
      });
    });
  });

  describe('getProblemList', () => {
    it('should fetch problem list', async () => {
      const mockData = [
        { id: 'cond-1', category: ['problem-list-item'] },
        { id: 'cond-2', category: ['problem-list-item'] },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ConditionService.getProblemList('patient-123');

      expect(result.success).toBe(true);
      // Verify normalized data has both FHIR and backwards-compat fields
      expect(result.data).toBeDefined();
      expect(result.data![0]).toMatchObject({
        id: 'cond-1',
        category: ['problem-list-item'],
        category_code: 'problem-list-item', // Backwards compat
      });
    });
  });

  describe('getByEncounter', () => {
    it('should fetch encounter diagnoses', async () => {
      const mockData = [{ id: 'cond-1', encounter_id: 'enc-123' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ConditionService.getByEncounter('enc-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_encounter_diagnoses', {
        encounter_id_param: 'enc-123',
      });
    });
  });

  describe('create', () => {
    it('should create a new condition', async () => {
      const newCondition = {
        patient_id: 'patient-123',
        code_system: 'http://hl7.org/fhir/sid/icd-10-cm',
        code: 'E11.9',
        code_code: 'E11.9',
        code_display: 'Type 2 diabetes mellitus',
        clinical_status: 'active' as const,
        verification_status: 'confirmed' as const,
        recorded_date: '2025-01-15',
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...newCondition, id: 'cond-1' }, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ConditionService.create(newCondition);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('cond-1');
    });
  });

  describe('update', () => {
    it('should update a condition', async () => {
      const updates = { clinical_status: 'resolved' as const };
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'cond-1', ...updates }, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ConditionService.update('cond-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.clinical_status).toBe('resolved');
    });
  });

  describe('resolve', () => {
    it('should resolve a condition', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'cond-1',
            clinical_status: 'resolved',
            abatement_datetime: expect.any(String),
          },
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ConditionService.resolve('cond-1');

      expect(result.success).toBe(true);
      expect(result.data?.clinical_status).toBe('resolved');
    });
  });

  describe('getChronic', () => {
    it('should fetch chronic conditions', async () => {
      const mockData = [{ id: 'cond-1', category_code: 'chronic' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ConditionService.getChronic('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_chronic_conditions', {
        patient_id_param: 'patient-123',
      });
    });
  });
});

describe('DiagnosticReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should fetch all diagnostic reports', async () => {
      const mockData = [
        {
          id: 'report-1',
          patient_id: 'patient-123',
          category_code: 'LAB',
          status: 'final',
          issued: '2025-01-15T10:00:00Z',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await DiagnosticReportService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith('fhir_diagnostic_reports');
    });
  });

  describe('getRecent', () => {
    it('should fetch recent reports with default limit', async () => {
      const mockData = [{ id: 'report-1' }, { id: 'report-2' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await DiagnosticReportService.getRecent('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_recent_diagnostic_reports', {
        patient_id_param: 'patient-123',
        limit_param: 20,
      });
    });

    it('should fetch recent reports with custom limit', async () => {
      const mockData = [{ id: 'report-1' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await DiagnosticReportService.getRecent('patient-123', 5);

      expect(supabase.rpc).toHaveBeenCalledWith('get_recent_diagnostic_reports', {
        patient_id_param: 'patient-123',
        limit_param: 5,
      });
    });
  });

  describe('getLabReports', () => {
    it('should fetch lab reports with default days back', async () => {
      const mockData = [{ id: 'report-1', category_code: 'LAB' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await DiagnosticReportService.getLabReports('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_lab_reports', {
        patient_id_param: 'patient-123',
        days_back: 90,
      });
    });

    it('should fetch lab reports with custom days back', async () => {
      const mockData = [{ id: 'report-1', category_code: 'LAB' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await DiagnosticReportService.getLabReports('patient-123', 30);

      expect(supabase.rpc).toHaveBeenCalledWith('get_lab_reports', {
        patient_id_param: 'patient-123',
        days_back: 30,
      });
    });
  });

  describe('getImagingReports', () => {
    it('should fetch imaging reports', async () => {
      const mockData = [{ id: 'report-1', category_code: 'RAD' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await DiagnosticReportService.getImagingReports('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_imaging_reports', {
        patient_id_param: 'patient-123',
        days_back: 365,
      });
    });
  });

  describe('create', () => {
    it('should create a new diagnostic report', async () => {
      const newReport = {
        patient_id: 'patient-123',
        code_system: 'http://loinc.org',
        code: '58410-2',
        code_display: 'Complete blood count (hemogram) panel',
        category: ['LAB'],
        category_code: 'LAB',
        category_display: 'Laboratory',
        status: 'final' as const,
        issued: '2025-01-15T10:00:00Z',
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...newReport, id: 'report-1' }, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await DiagnosticReportService.create(newReport);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('report-1');
    });
  });

  describe('update', () => {
    it('should update a diagnostic report', async () => {
      const updates = { status: 'final' as const };
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'report-1', ...updates }, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await DiagnosticReportService.update('report-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('final');
    });
  });

  describe('getPending', () => {
    it('should fetch pending reports', async () => {
      const mockData = [{ id: 'report-1', status: 'registered' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await DiagnosticReportService.getPending('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_pending_reports', {
        patient_id_param: 'patient-123',
      });
    });
  });
});

describe('ProcedureService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should fetch all procedures for a patient', async () => {
      const mockData = [
        {
          id: 'proc-1',
          patient_id: 'patient-123',
          code_code: '99213',
          code_display: 'Office visit',
          status: 'completed',
          performed_datetime: '2025-01-15T10:00:00Z',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ProcedureService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith('fhir_procedures');
    });
  });

  describe('getRecent', () => {
    it('should fetch recent procedures', async () => {
      const mockData = [{ id: 'proc-1' }, { id: 'proc-2' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ProcedureService.getRecent('patient-123', 10);

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_recent_procedures', {
        patient_id_param: 'patient-123',
        limit_param: 10,
      });
    });
  });

  describe('getByEncounter', () => {
    it('should fetch procedures by encounter', async () => {
      const mockData = [{ id: 'proc-1', encounter_id: 'enc-123' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ProcedureService.getByEncounter('enc-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_procedures_by_encounter', {
        encounter_id_param: 'enc-123',
      });
    });
  });

  describe('create', () => {
    it('should create a new procedure', async () => {
      const newProcedure = {
        patient_id: 'patient-123',
        code_system: 'http://www.ama-assn.org/go/cpt',
        code: '99213',
        code_code: '99213',
        code_display: 'Office visit',
        status: 'completed' as const,
        performed_datetime: '2025-01-15T10:00:00Z',
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...newProcedure, id: 'proc-1' }, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ProcedureService.create(newProcedure);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('proc-1');
    });
  });

  describe('update', () => {
    it('should update a procedure', async () => {
      const updates = { status: 'completed' as const };
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'proc-1', ...updates }, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ProcedureService.update('proc-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
    });
  });

  describe('getBillable', () => {
    it('should fetch billable procedures for patient', async () => {
      const mockData = [{ id: 'proc-1', code_code: '99213' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ProcedureService.getBillable('patient-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_billable_procedures', {
        patient_id_param: 'patient-123',
        encounter_id_param: null,
      });
    });

    it('should fetch billable procedures for encounter', async () => {
      const mockData = [{ id: 'proc-1', encounter_id: 'enc-123' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ProcedureService.getBillable('patient-123', 'enc-123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_billable_procedures', {
        patient_id_param: 'patient-123',
        encounter_id_param: 'enc-123',
      });
    });
  });
});

describe('ObservationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should fetch all observations for a patient', async () => {
      const mockData = [
        {
          id: 'obs-1',
          patient_id: 'patient-123',
          code: '8867-4',
          code_display: 'Heart rate',
          category: ['vital-signs'],
          status: 'final',
          effective_datetime: '2025-01-15T10:00:00Z',
          value_quantity: 72,
          value_unit: 'beats/minute',
        },
        {
          id: 'obs-2',
          patient_id: 'patient-123',
          code: '8480-6',
          code_display: 'Systolic blood pressure',
          category: ['vital-signs'],
          status: 'final',
          effective_datetime: '2025-01-14T10:00:00Z',
          value_quantity: 120,
          value_unit: 'mmHg',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith('fhir_observations');
      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.order).toHaveBeenCalledWith('effective_datetime', { ascending: false });
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.getByPatient('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should return empty array when no data found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.getByPatient('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getVitalSigns', () => {
    it('should fetch vital signs with default days', async () => {
      const mockData = [
        { id: 'obs-1', category: ['vital-signs'], code: '8867-4' },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getVitalSigns('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_patient_vital_signs', {
        patient_id_param: 'patient-123',
        days_param: 30,
      });
    });

    it('should fetch vital signs with custom days', async () => {
      const mockData = [{ id: 'obs-1', category: ['vital-signs'] }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getVitalSigns('patient-123', 7);

      expect(supabase.rpc).toHaveBeenCalledWith('get_patient_vital_signs', {
        patient_id_param: 'patient-123',
        days_param: 7,
      });
    });

    it('should handle RPC errors', async () => {
      const mockError = new Error('RPC function not found');
      (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

      const result = await ObservationService.getVitalSigns('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC function not found');
    });
  });

  describe('getLabResults', () => {
    it('should fetch lab results with default days', async () => {
      const mockData = [
        { id: 'obs-1', category: ['laboratory'], code: '2339-0' },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getLabResults('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_patient_lab_results', {
        patient_id_param: 'patient-123',
        days_param: 90,
      });
    });

    it('should fetch lab results with custom days', async () => {
      const mockData = [{ id: 'obs-1', category: ['laboratory'] }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getLabResults('patient-123', 30);

      expect(supabase.rpc).toHaveBeenCalledWith('get_patient_lab_results', {
        patient_id_param: 'patient-123',
        days_param: 30,
      });
    });
  });

  describe('getSocialHistory', () => {
    it('should fetch social history observations', async () => {
      const mockData = [
        { id: 'obs-1', category: ['social-history'], code: '72166-2' },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getSocialHistory('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_patient_social_history', {
        patient_id_param: 'patient-123',
      });
    });
  });

  describe('getByCode', () => {
    it('should fetch observations by code with default days', async () => {
      const mockData = [
        { id: 'obs-1', code: '8867-4', code_display: 'Heart rate' },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getByCode('patient-123', '8867-4');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_observations_by_code', {
        patient_id_param: 'patient-123',
        code_param: '8867-4',
        days_param: 365,
      });
    });

    it('should fetch observations by code with custom days', async () => {
      const mockData = [{ id: 'obs-1', code: '8867-4' }];
      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await ObservationService.getByCode('patient-123', '8867-4', 90);

      expect(supabase.rpc).toHaveBeenCalledWith('get_observations_by_code', {
        patient_id_param: 'patient-123',
        code_param: '8867-4',
        days_param: 90,
      });
    });
  });

  describe('getByCategory', () => {
    it('should fetch observations by category without days filter', async () => {
      const mockData = [
        { id: 'obs-1', category: ['vital-signs'], status: 'final' },
        { id: 'obs-2', category: ['vital-signs'], status: 'amended' },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.getByCategory('patient-123', 'vital-signs');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.contains).toHaveBeenCalledWith('category', ['vital-signs']);
      expect(mockQuery.in).toHaveBeenCalledWith('status', ['final', 'amended', 'corrected']);
    });

    it('should fetch observations by category with days filter', async () => {
      const mockData = [{ id: 'obs-1', category: ['laboratory'] }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.getByCategory('patient-123', 'laboratory', 30);

      expect(result.success).toBe(true);
      expect(mockQuery.gte).toHaveBeenCalledWith('effective_datetime', expect.any(String));
    });

    it('should handle errors', async () => {
      const mockError = new Error('Query failed');
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.getByCategory('patient-123', 'vital-signs');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  describe('create', () => {
    it('should create a new observation', async () => {
      const newObservation = {
        patient_id: 'patient-123',
        code: '8867-4',
        code_display: 'Heart rate',
        category: ['vital-signs'],
        status: 'final' as const,
        effective_datetime: '2025-01-15T10:00:00Z',
        value_quantity: 72,
        value_unit: 'beats/minute',
      };

      const mockCreatedData = { ...newObservation, id: 'obs-1' };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCreatedData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.create(newObservation);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedData);
      expect(mockQuery.insert).toHaveBeenCalledWith([newObservation]);
    });

    it('should handle insertion errors', async () => {
      const newObservation = {
        patient_id: 'patient-123',
        code: '8867-4',
        code_display: 'Heart rate',
        category: ['vital-signs'],
        status: 'final' as const,
        effective_datetime: '2025-01-15T10:00:00Z',
        value_quantity: 72,
        value_unit: 'beats/minute',
      };

      const insertError = new Error('Constraint violation');
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: insertError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.create(newObservation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Constraint violation');
    });
  });

  describe('update', () => {
    it('should update an observation', async () => {
      const updates = { status: 'amended' as const, note: 'Value corrected' };
      const mockUpdatedData = { id: 'obs-1', ...updates };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdatedData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.update('obs-1', updates);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedData);
      expect(mockQuery.update).toHaveBeenCalledWith(updates);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'obs-1');
    });

    it('should handle update errors', async () => {
      const mockError = new Error('Record not found');
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.update('obs-1', { status: 'amended' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete an observation', async () => {
      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.delete('obs-1');

      expect(result.success).toBe(true);
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'obs-1');
    });

    it('should handle deletion errors', async () => {
      const mockError = new Error('Record not found');
      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: mockError }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await ObservationService.delete('obs-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record not found');
    });
  });
});

// ============================================================================
// CARE PLAN SERVICE TESTS
// ============================================================================

describe('CarePlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should fetch all care plans for a patient', async () => {
      const mockData = [
        {
          id: 'cp-1',
          patient_id: 'patient-123',
          status: 'active',
          intent: 'plan',
          category: ['assess-plan'],
          title: 'Diabetes Management Plan',
          description: 'Comprehensive care plan for Type 2 Diabetes',
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-12-31T23:59:59Z',
          created: '2025-01-01T10:00:00Z',
        },
        {
          id: 'cp-2',
          patient_id: 'patient-123',
          status: 'completed',
          intent: 'plan',
          category: ['assess-plan'],
          title: 'Post-Surgery Recovery Plan',
          created: '2024-12-01T10:00:00Z',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await FHIRService.CarePlan.getByPatient('patient-123');

      expect(result).toEqual({ success: true, data: mockData });
      expect(supabase.from).toHaveBeenCalledWith('fhir_care_plans');
      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.order).toHaveBeenCalledWith('created', { ascending: false });
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error');
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await FHIRService.CarePlan.getByPatient('patient-123');
      expect(result).toEqual({ success: false, error: 'Database error' });
    });
  });

  describe('getActive', () => {
    it('should fetch active care plans using RPC', async () => {
      const mockData = [
        {
          id: 'cp-1',
          title: 'Active Plan 1',
          status: 'active',
          created: '2025-01-15T10:00:00Z',
        },
      ];

      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await FHIRService.CarePlan.getActive('patient-123');

      expect(result).toEqual({ success: true, data: mockData });
      expect(supabase.rpc).toHaveBeenCalledWith('get_active_care_plans', {
        p_patient_id: 'patient-123',
      });
    });

    it('should handle RPC errors', async () => {
      const mockError = new Error('RPC failed');
      (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

      const result = await FHIRService.CarePlan.getActive('patient-123');
      expect(result).toEqual({ success: false, error: 'RPC failed' });
    });
  });

  describe('getCurrent', () => {
    it('should fetch the current active care plan', async () => {
      const mockData = [
        {
          id: 'cp-current',
          title: 'Current Active Plan',
          status: 'active',
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-12-31T23:59:59Z',
        },
      ];

      (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

      const result = await FHIRService.CarePlan.getCurrent('patient-123');

      expect(result).toEqual({ success: true, data: mockData[0] });
      expect(supabase.rpc).toHaveBeenCalledWith('get_current_care_plan', {
        p_patient_id: 'patient-123',
      });
    });

    it('should return null when no current plan exists', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      const result = await FHIRService.CarePlan.getCurrent('patient-123');

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe('create', () => {
    it('should create a new care plan', async () => {
      const newCarePlan = {
        patient_id: 'patient-123',
        status: 'active' as const,
        intent: 'plan' as const,
        category: ['assess-plan'],
        title: 'New Care Plan',
        description: 'Test care plan',
        period_start: '2025-01-01',
      };

      const mockData = { ...newCarePlan, id: 'cp-new', created: '2025-01-15T10:00:00Z' };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await FHIRService.CarePlan.create(newCarePlan);

      expect(result).toEqual({ success: true, data: mockData });
      expect(mockQuery.insert).toHaveBeenCalledWith([newCarePlan]);
    });

    it('should handle creation errors', async () => {
      const mockError = new Error('Insert failed');
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await FHIRService.CarePlan.create({
        patient_id: 'patient-123',
        status: 'active',
        intent: 'plan',
        category: ['assess-plan'],
      });
      expect(result).toEqual({ success: false, error: 'Insert failed' });
    });
  });

  describe('update', () => {
    it('should update an existing care plan', async () => {
      const updates = {
        status: 'completed' as const,
        period_end: '2025-06-30',
      };

      const mockData = { id: 'cp-1', ...updates };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await FHIRService.CarePlan.update('cp-1', updates);

      expect(result).toEqual({ success: true, data: mockData });
      expect(mockQuery.update).toHaveBeenCalledWith(updates);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'cp-1');
    });
  });

  describe('search', () => {
    it('should search care plans with multiple filters', async () => {
      const mockData = [
        {
          id: 'cp-1',
          status: 'active',
          category: ['assess-plan'],
          period_start: '2025-01-01',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await FHIRService.CarePlan.search({
        patientId: 'patient-123',
        status: 'active',
        category: 'assess-plan',
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
      });

      expect(result).toEqual({ success: true, data: mockData });
      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockQuery.contains).toHaveBeenCalledWith('category', ['assess-plan']);
      expect(mockQuery.gte).toHaveBeenCalledWith('period_start', '2025-01-01');
      expect(mockQuery.lte).toHaveBeenCalledWith('period_end', '2025-12-31');
    });
  });
});
