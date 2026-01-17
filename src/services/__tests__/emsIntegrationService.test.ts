/**
 * EMS Integration Service Tests
 * Tests for EMS handoff integration into healthcare platform
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  integrateEMSHandoff,
  getHandoffIntegrationStatus
} from '../emsIntegrationService';
import { supabase } from '../../lib/supabaseClient';
import type { PrehospitalHandoff } from '../emsService';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      admin: {
        createUser: vi.fn()
      }
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

const mockSupabase = supabase as unknown as {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    admin: { createUser: ReturnType<typeof vi.fn> };
  };
  from: ReturnType<typeof vi.fn>;
};

describe('EMSIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock data combining PrehospitalHandoff fields with DB metadata
  const mockHandoff = {
    id: 'handoff-123',
    unit_number: 'M-42',
    ems_agency: 'Metro EMS',
    paramedic_name: 'John Smith',
    chief_complaint: 'Chest pain, shortness of breath',
    scene_location: '123 Main St',
    patient_age: 65,
    patient_gender: 'M' as const,
    mechanism_of_injury: undefined,
    eta_hospital: '14:45',
    receiving_hospital_name: 'Methodist Hospital',
    treatments_given: [
      { treatment: 'Aspirin 325mg', time: '14:15' },
      { treatment: 'Nitroglycerin 0.4mg SL', time: '14:20' }
    ],
    stroke_alert: false,
    stemi_alert: true,
    trauma_alert: false,
    sepsis_alert: false,
    cardiac_arrest: false,
    vitals: {
      blood_pressure_systolic: 160,
      blood_pressure_diastolic: 95,
      heart_rate: 110,
      respiratory_rate: 22,
      oxygen_saturation: 94,
      temperature: 98.6,
      glucose: 145,
      gcs_score: 15
    },
    status: 'en_route' as const,
    created_at: '2026-01-16T14:30:00Z'
  };

  describe('integrateEMSHandoff', () => {
    it('should successfully integrate EMS handoff', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'provider-123' } },
        error: null
      } as any);

      // Mock admin user creation for temp patient
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'temp-patient-456' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_id: 'temp-patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'obs-1' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'prehospital_handoffs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateEMSHandoff('handoff-123', mockHandoff);

      expect(result.success).toBe(true);
      expect(result.patientId).toBe('temp-patient-456');
      expect(result.encounterId).toBe('encounter-789');
      expect(result.billingCodes).toBeDefined();
    });

    it('should return error when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      } as any);

      const result = await integrateEMSHandoff('handoff-123', mockHandoff);

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticated');
    });

    it('should generate high severity billing code for STEMI alert', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'provider-123' } },
        error: null
      } as any);

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'temp-patient-456' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_id: 'temp-patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'obs-1' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'prehospital_handoffs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateEMSHandoff('handoff-123', mockHandoff);

      expect(result.success).toBe(true);
      // STEMI should trigger moderate-to-high severity (99284)
      expect(result.billingCodes?.some(bc => bc.code === '99284')).toBe(true);
    });

    it('should generate critical care code for cardiac arrest', async () => {
      const cardiacArrestHandoff: PrehospitalHandoff = {
        ...mockHandoff,
        cardiac_arrest: true,
        stemi_alert: false
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'provider-123' } },
        error: null
      } as any);

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'temp-patient-456' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_id: 'temp-patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'obs-1' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'prehospital_handoffs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateEMSHandoff('handoff-123', cardiacArrestHandoff);

      expect(result.success).toBe(true);
      // Cardiac arrest should trigger highest severity (99285) and critical care (99291)
      expect(result.billingCodes?.some(bc => bc.code === '99285')).toBe(true);
      expect(result.billingCodes?.some(bc => bc.code === '99291')).toBe(true);
    });
  });

  describe('getHandoffIntegrationStatus', () => {
    it('should return integrated status when handoff is linked', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'prehospital_handoffs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    patient_id: 'patient-123',
                    encounter_id: 'encounter-456',
                    integrated_at: '2026-01-16T15:00:00Z'
                  },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: 8,
                error: null
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await getHandoffIntegrationStatus('handoff-123');

      expect(result.isIntegrated).toBe(true);
      expect(result.patientId).toBe('patient-123');
      expect(result.encounterId).toBe('encounter-456');
      expect(result.observationCount).toBe(8);
    });

    it('should return not integrated when handoff not linked', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'prehospital_handoffs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    patient_id: null,
                    encounter_id: null,
                    integrated_at: null
                  },
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await getHandoffIntegrationStatus('handoff-123');

      expect(result.isIntegrated).toBe(false);
    });

    it('should return not integrated when handoff not found', async () => {
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

      const result = await getHandoffIntegrationStatus('handoff-123');

      expect(result.isIntegrated).toBe(false);
    });
  });

  describe('urgency determination', () => {
    it('should determine critical urgency for cardiac arrest', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'provider-123' } },
        error: null
      } as any);

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'temp-patient-456' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_id: 'temp-patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          let encounterInserted: any = null;
          return {
            insert: vi.fn((data: any) => {
              encounterInserted = data;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'encounter-789', ...encounterInserted },
                    error: null
                  })
                })
              };
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'obs-1' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'prehospital_handoffs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const cardiacArrestHandoff: PrehospitalHandoff = {
        ...mockHandoff,
        cardiac_arrest: true
      };

      const result = await integrateEMSHandoff('handoff-123', cardiacArrestHandoff);

      expect(result.success).toBe(true);
    });
  });
});
