import { ParkinsonsService } from '../parkinsonsService';

// Mock supabase
const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('../../lib/supabaseClient', () => ({
  supabase: mockSupabaseClient,
}));

// Mock PHI access logger
jest.mock('../phiAccessLogger', () => ({
  logPhiAccess: jest.fn().mockResolvedValue(undefined),
}));

describe('ParkinsonsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enrollPatient', () => {
    it('should enroll a new Parkinson\'s patient', async () => {
      const mockPatient = {
        id: 'pd-123',
        user_id: 'user-456',
        diagnosis_date: '2025-01-15',
        parkinsons_type: 'idiopathic',
        hoehn_yahr_stage: '2',
        primary_symptoms: ['tremor', 'rigidity'],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'provider-789' } },
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPatient,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.enrollPatient({
        user_id: 'user-456',
        diagnosis_date: '2025-01-15',
        parkinsons_type: 'idiopathic',
        hoehn_yahr_stage: '2',
        primary_symptoms: ['tremor', 'rigidity'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPatient);
    });

    it('should fail if user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const result = await ParkinsonsService.enrollPatient({
        user_id: 'user-456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  describe('getPatient', () => {
    it('should get Parkinson\'s patient by user ID', async () => {
      const mockPatient = {
        id: 'pd-123',
        user_id: 'user-456',
        hoehn_yahr_stage: '2',
        profile: {
          first_name: 'John',
          last_name: 'Doe',
          phone: '555-1234',
        },
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockPatient,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.getPatient('user-456');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPatient);
    });

    it('should return null if patient not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.getPatient('nonexistent-user');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('addMedication', () => {
    it('should add a medication to patient\'s regimen', async () => {
      const mockMedication = {
        id: 'med-123',
        patient_id: 'pd-456',
        medication_name: 'Carbidopa-Levodopa',
        medication_class: 'levodopa',
        dosage: '25/100mg',
        frequency: '3x daily',
        is_active: true,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMedication,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.addMedication({
        patient_id: 'pd-456',
        medication_name: 'Carbidopa-Levodopa',
        medication_class: 'levodopa',
        dosage: '25/100mg',
        frequency: '3x daily',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMedication);
    });
  });

  describe('getActiveMedications', () => {
    it('should get active medications for patient', async () => {
      const mockMedications = [
        {
          id: 'med-1',
          medication_name: 'Carbidopa-Levodopa',
          medication_class: 'levodopa',
          is_active: true,
        },
        {
          id: 'med-2',
          medication_name: 'Pramipexole',
          medication_class: 'dopamine_agonist',
          is_active: true,
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockMedications,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.getActiveMedications('pd-456');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('recordUPDRSAssessment', () => {
    it('should record UPDRS assessment with total score calculation', async () => {
      const mockAssessment = {
        id: 'updrs-123',
        patient_id: 'pd-456',
        part_i_score: 10,
        part_ii_score: 15,
        part_iii_score: 25,
        part_iv_score: 5,
        total_score: 55,
        medication_state: 'ON',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'assessor-789' } },
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAssessment,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.recordUPDRSAssessment({
        patient_id: 'pd-456',
        part_i_score: 10,
        part_ii_score: 15,
        part_iii_score: 25,
        part_iv_score: 5,
        medication_state: 'ON',
      });

      expect(result.success).toBe(true);
      expect(result.data?.total_score).toBe(55);
    });
  });

  describe('recordSymptomDiary', () => {
    it('should record symptom diary entry', async () => {
      const mockEntry = {
        id: 'diary-123',
        patient_id: 'pd-456',
        tremor_severity: 4,
        rigidity_severity: 3,
        bradykinesia_severity: 5,
        dyskinesia_present: true,
        on_time_hours: 12,
        off_time_hours: 4,
        mood_rating: 6,
        sleep_quality: 7,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockEntry,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.recordSymptomDiary({
        patient_id: 'pd-456',
        tremor_severity: 4,
        rigidity_severity: 3,
        bradykinesia_severity: 5,
        dyskinesia_present: true,
        on_time_hours: 12,
        off_time_hours: 4,
        mood_rating: 6,
        sleep_quality: 7,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntry);
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { id: 'p1', hoehn_yahr_stage: '2', dbs_implant: false },
              { id: 'p2', hoehn_yahr_stage: '3', dbs_implant: true },
              { id: 'p3', hoehn_yahr_stage: '4', dbs_implant: true },
            ],
            count: 3,
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              data: [{ total_score: 30 }, { total_score: 40 }],
              error: null,
            }),
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lt: jest.fn().mockResolvedValue({
            count: 1,
            error: null,
          }),
        }),
      });

      const result = await ParkinsonsService.getDashboardMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('logMedicationDose', () => {
    it('should log medication dose', async () => {
      const mockLog = {
        id: 'log-123',
        medication_id: 'med-456',
        taken_at: '2025-12-02T10:00:00Z',
        was_on_time: true,
        symptom_state_30min: 'ON',
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockLog,
              error: null,
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.logMedicationDose({
        medication_id: 'med-456',
        taken_at: '2025-12-02T10:00:00Z',
        was_on_time: true,
        symptom_state_30min: 'ON',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLog);
    });
  });

  describe('updateHoehnYahrStage', () => {
    it('should update Hoehn & Yahr stage', async () => {
      const mockPatient = {
        id: 'pd-123',
        hoehn_yahr_stage: '3',
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.updateHoehnYahrStage('pd-123', '3');

      expect(result.success).toBe(true);
      expect(result.data?.hoehn_yahr_stage).toBe('3');
    });
  });

  describe('discontinueMedication', () => {
    it('should discontinue medication', async () => {
      const mockMedication = {
        id: 'med-123',
        is_active: false,
        end_date: '2025-12-02',
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMedication,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await ParkinsonsService.discontinueMedication('med-123');

      expect(result.success).toBe(true);
      expect(result.data?.is_active).toBe(false);
    });
  });
});
