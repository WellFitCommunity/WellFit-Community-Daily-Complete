/**
 * Post-Acute Transfer Service Tests
 * Tests for Hospital → SNF/Rehab/LTAC/Hospice transfers
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PostAcuteTransferService } from '../postAcuteTransferService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
    info: vi.fn(),
    clinical: vi.fn()
  }
}));

// Mock HandoffService
vi.mock('../handoffService', () => ({
  HandoffService: {
    createPacket: vi.fn().mockResolvedValue({
      packet: { id: 'packet-123' },
      access_url: 'https://app.wellfit.health/handoff/abc123'
    }),
    sendPacket: vi.fn().mockResolvedValue({ success: true })
  }
}));

const mockSupabase = supabase as unknown as {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

describe('PostAcuteTransferService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDischargePlan = {
    id: 'plan-123',
    patient_id: 'patient-456',
    encounter_id: 'encounter-789',
    discharge_disposition: 'snf',
    readmission_risk_score: 65,
    readmission_risk_category: 'high',
    requires_48hr_call: true,
    dme_needed: true,
    dme_items: ['Walker', 'Bedside commode'],
    home_health_needed: true,
    caregiver_identified: true,
    caregiver_name: 'Jane Doe',
    caregiver_phone: '555-1234',
    follow_up_appointment_scheduled: true,
    follow_up_appointment_date: '2026-01-23',
    follow_up_appointment_provider: 'Dr. Smith',
    patient_education_topics: ['Fall prevention', 'Medication management'],
    risk_factors: ['Multiple chronic conditions', 'Lives alone'],
    barriers_to_discharge: ['Transportation', 'Medication affordability']
  };

  const mockPatient = {
    id: 'patient-456',
    full_name: 'Robert Johnson',
    date_of_birth: '1945-06-15',
    mrn: 'MRN-98765',
    gender: 'M'
  };

  const mockEncounter = {
    id: 'encounter-789',
    patient_id: 'patient-456',
    chief_complaint: 'Hip fracture s/p ORIF',
    status: 'in-progress'
  };

  describe('createPostAcuteTransfer', () => {
    it('should successfully create a post-acute transfer packet', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'discharge@hospital.com' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockDischargePlan,
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockPatient,
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockEncounter,
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'patient_medications') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { medication_name: 'Lisinopril', dose: '10mg', frequency: 'daily' }
                  ],
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'patient_allergies') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate' }],
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [], error: null })
                    })
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'encounter_diagnoses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ diagnosis_code: 'S72.001A', diagnosis_description: 'Hip fracture' }],
                error: null
              })
            })
          } as any;
        }
        if (table === 'functional_assessments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'handoff_packets') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await PostAcuteTransferService.createPostAcuteTransfer({
        discharge_plan_id: 'plan-123',
        patient_id: 'patient-456',
        encounter_id: 'encounter-789',
        receiving_facility_name: 'Sunrise Skilled Nursing',
        receiving_facility_phone: '555-9876',
        receiving_facility_contact_name: 'Mary Smith',
        receiving_facility_contact_email: 'admissions@sunrisesnf.com',
        post_acute_facility_type: 'skilled_nursing',
        urgency_level: 'routine',
        expected_transfer_date: '2026-01-18',
        clinical_summary: 'Patient recovering from hip fracture. Requires PT/OT and wound care.'
      });

      expect(result.success).toBe(true);
      expect(result.handoff_packet_id).toBe('packet-123');
      expect(result.access_url).toContain('wellfit.health');
    });

    it('should return error when discharge plan not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' }
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await PostAcuteTransferService.createPostAcuteTransfer({
        discharge_plan_id: 'nonexistent',
        patient_id: 'patient-456',
        encounter_id: 'encounter-789',
        receiving_facility_name: 'SNF',
        receiving_facility_phone: '555-1234',
        post_acute_facility_type: 'skilled_nursing',
        urgency_level: 'routine',
        expected_transfer_date: '2026-01-18',
        clinical_summary: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Discharge plan not found');
    });

    it('should return error when patient not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockDischargePlan,
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' }
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await PostAcuteTransferService.createPostAcuteTransfer({
        discharge_plan_id: 'plan-123',
        patient_id: 'nonexistent',
        encounter_id: 'encounter-789',
        receiving_facility_name: 'SNF',
        receiving_facility_phone: '555-1234',
        post_acute_facility_type: 'skilled_nursing',
        urgency_level: 'routine',
        expected_transfer_date: '2026-01-18',
        clinical_summary: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Patient profile not found');
    });
  });

  describe('sendPostAcuteTransfer', () => {
    it('should successfully send transfer packet', async () => {
      const result = await PostAcuteTransferService.sendPostAcuteTransfer('packet-123', true);

      expect(result.success).toBe(true);
      expect(result.handoff_packet_id).toBe('packet-123');
    });
  });

  describe('getPatientPostAcuteTransfers', () => {
    it('should return all post-acute transfers for patient', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'packet-1', receiving_facility: 'SNF A', created_at: '2026-01-15' },
                  { id: 'packet-2', receiving_facility: 'Rehab B', created_at: '2025-12-01' }
                ],
                error: null
              })
            })
          })
        })
      } as any));

      const result = await PostAcuteTransferService.getPatientPostAcuteTransfers('patient-456');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('packet-1');
    });

    it('should return empty array when no transfers exist', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      } as any));

      const result = await PostAcuteTransferService.getPatientPostAcuteTransfers('patient-456');

      expect(result).toEqual([]);
    });
  });

  describe('getTransferByDischargePlan', () => {
    it('should return transfer packet for discharge plan', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { post_acute_handoff_packet_id: 'packet-123' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'handoff_packets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'packet-123',
                    receiving_facility: 'SNF',
                    status: 'sent'
                  },
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await PostAcuteTransferService.getTransferByDischargePlan('plan-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('packet-123');
    });

    it('should return null when no transfer exists', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { post_acute_handoff_packet_id: null },
              error: null
            })
          })
        })
      } as any));

      const result = await PostAcuteTransferService.getTransferByDischargePlan('plan-123');

      expect(result).toBeNull();
    });
  });

  describe('generateTransferSummary', () => {
    it('should generate formatted transfer summary', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'packet-123',
                patient_mrn: 'MRN-98765',
                sending_facility: 'General Hospital',
                receiving_facility: 'Sunrise SNF',
                post_acute_facility_type: 'skilled_nursing',
                urgency_level: 'routine',
                reason_for_transfer: 'Post-Acute Transfer - SNF',
                status: 'acknowledged',
                created_at: '2026-01-16T10:00:00Z',
                sent_at: '2026-01-16T11:00:00Z',
                acknowledged_at: '2026-01-16T12:00:00Z',
                sender_provider_name: 'Dr. Smith',
                sender_callback_number: '555-1234',
                sender_notes: 'Requires PT/OT daily',
                clinical_data: {
                  medications: [{ name: 'Lisinopril' }],
                  allergies: [{ allergen: 'Penicillin' }],
                  discharge_needs: {
                    readmission_risk_category: 'high',
                    readmission_risk_score: 65,
                    dme_needed: true,
                    dme_items: ['Walker'],
                    home_health_needed: true,
                    caregiver_identified: true,
                    caregiver_name: 'Jane',
                    follow_up_appointment_scheduled: true,
                    follow_up_appointment_date: '2026-01-23',
                    follow_up_appointment_provider: 'Dr. Jones'
                  }
                }
              },
              error: null
            })
          })
        })
      } as any));

      const summary = await PostAcuteTransferService.generateTransferSummary('packet-123');

      expect(summary).toContain('POST-ACUTE TRANSFER SUMMARY');
      expect(summary).toContain('General Hospital');
      expect(summary).toContain('Sunrise SNF');
      expect(summary).toContain('Skilled Nursing Facility');
      expect(summary).toContain('Readmission Risk: high');
    });

    it('should return error message when packet not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      } as any));

      const summary = await PostAcuteTransferService.generateTransferSummary('nonexistent');

      expect(summary).toBe('Transfer packet not found');
    });
  });

  describe('facility type descriptions', () => {
    it('should return correct description for skilled nursing', () => {
      // Access private method via class prototype
      const description = (PostAcuteTransferService as any).getFacilityTypeDescription('skilled_nursing');
      expect(description).toBe('Skilled Nursing Facility (SNF)');
    });

    it('should return correct description for inpatient rehab', () => {
      const description = (PostAcuteTransferService as any).getFacilityTypeDescription('inpatient_rehab');
      expect(description).toBe('Inpatient Rehabilitation Facility');
    });

    it('should return correct description for LTAC', () => {
      const description = (PostAcuteTransferService as any).getFacilityTypeDescription('long_term_acute_care');
      expect(description).toBe('Long-Term Acute Care (LTAC)');
    });

    it('should return correct description for hospice', () => {
      const description = (PostAcuteTransferService as any).getFacilityTypeDescription('hospice');
      expect(description).toBe('Hospice Care');
    });
  });
});
