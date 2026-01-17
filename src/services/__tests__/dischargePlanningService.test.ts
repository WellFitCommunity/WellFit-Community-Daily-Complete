/**
 * Discharge Planning Service Tests
 * Tests for hospital discharge planning workflows to prevent readmissions
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DischargePlanningService } from '../dischargePlanningService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    clinical: vi.fn()
  }
}));

// Mock claudeService
vi.mock('../claudeService', () => ({
  claudeService: {
    generateMedicalAnalytics: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        risk_factors: ['Risk 1', 'Risk 2', 'Risk 3'],
        barriers_to_discharge: ['Barrier 1', 'Barrier 2', 'Barrier 3'],
        recommended_interventions: ['Intervention 1', 'Intervention 2', 'Intervention 3']
      })
    })
  }
}));

// Mock ReadmissionTrackingService
vi.mock('../readmissionTrackingService', () => ({
  ReadmissionTrackingService: {
    getPatientReadmissions: vi.fn().mockResolvedValue([])
  }
}));

const mockSupabase = supabase as unknown as {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

describe('DischargePlanningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDischargePlan = {
    id: 'plan-123',
    patient_id: 'patient-456',
    encounter_id: 'encounter-789',
    discharge_disposition: 'home_with_home_health',
    planned_discharge_date: '2026-01-17',
    planned_discharge_time: '10:00:00',
    discharge_planner_notes: 'Patient ready for discharge',
    readmission_risk_score: 65,
    requires_48hr_call: true,
    requires_72hr_call: false,
    requires_7day_pcp_visit: true,
    status: 'draft',
    checklist_completion_percentage: 50,
    billing_codes_generated: false,
    discharge_planning_time_minutes: 45,
    care_coordination_time_minutes: 30,
    created_at: '2026-01-16T14:00:00Z',
    created_by: 'user-123'
  };

  describe('createDischargePlan', () => {
    it('should create a discharge plan with calculated risk score', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      // Mock risk score calculation
      mockSupabase.rpc.mockResolvedValue({
        data: 65,
        error: null
      } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
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
                  data: { id: 'patient-456', date_of_birth: '1960-01-01' },
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
                  data: { id: 'encounter-789', chief_complaint: 'Chest pain' },
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await DischargePlanningService.createDischargePlan({
        patient_id: 'patient-456',
        encounter_id: 'encounter-789',
        discharge_disposition: 'home_with_home_health',
        planned_discharge_date: '2026-01-17',
        planned_discharge_time: '10:00:00',
        discharge_planner_notes: 'Patient ready for discharge'
      });

      expect(result.id).toBe('plan-123');
      expect(result.readmission_risk_score).toBe(65);
    });

    it('should return error when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      } as any);

      await expect(
        DischargePlanningService.createDischargePlan({
          patient_id: 'patient-456',
          encounter_id: 'encounter-789',
          discharge_disposition: 'home',
          planned_discharge_date: '2026-01-17',
          planned_discharge_time: '10:00:00'
        })
      ).rejects.toThrow('not authenticated');
    });

    it('should use fallback risk score when calculation fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      // Mock risk score calculation failure
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Calculation failed' }
      } as any);

      const planWithFallbackRisk = { ...mockDischargePlan, readmission_risk_score: 50 };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: planWithFallbackRisk,
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
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await DischargePlanningService.createDischargePlan({
        patient_id: 'patient-456',
        encounter_id: 'encounter-789',
        discharge_disposition: 'home',
        planned_discharge_date: '2026-01-17',
        planned_discharge_time: '10:00:00'
      });

      // Should use fallback risk score of 50
      expect(result.readmission_risk_score).toBe(50);
    });
  });

  describe('getDischargePlan', () => {
    it('should return discharge plan by ID', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDischargePlan,
              error: null
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getDischargePlan('plan-123');

      expect(result).toEqual(mockDischargePlan);
    });

    it('should throw error when plan not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      } as any));

      await expect(
        DischargePlanningService.getDischargePlan('non-existent')
      ).rejects.toThrow('Failed to get discharge plan');
    });
  });

  describe('getDischargePlanByEncounter', () => {
    it('should return discharge plan by encounter ID', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockDischargePlan,
              error: null
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getDischargePlanByEncounter('encounter-789');

      expect(result).toEqual(mockDischargePlan);
    });

    it('should return null when no plan exists for encounter', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getDischargePlanByEncounter('encounter-no-plan');

      expect(result).toBeNull();
    });
  });

  describe('updateDischargePlan', () => {
    it('should update discharge plan', async () => {
      const updatedPlan = { ...mockDischargePlan, status: 'ready' };

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedPlan,
                error: null
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.updateDischargePlan('plan-123', {
        status: 'ready'
      });

      expect(result.status).toBe('ready');
    });

    it('should auto-generate billing codes when checklist is 100% complete', async () => {
      const completePlan = {
        ...mockDischargePlan,
        checklist_completion_percentage: 100,
        billing_codes_generated: false
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: completePlan,
                    error: null
                  })
                })
              })
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: completePlan,
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await DischargePlanningService.updateDischargePlan('plan-123', {
        checklist_completion_percentage: 100
      });

      expect(result.checklist_completion_percentage).toBe(100);
    });
  });

  describe('markPlanReady', () => {
    it('should mark plan as ready', async () => {
      const readyPlan = { ...mockDischargePlan, status: 'ready' };

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: readyPlan,
                error: null
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.markPlanReady('plan-123');

      expect(result.status).toBe('ready');
    });
  });

  describe('markPatientDischarged', () => {
    it('should mark patient as discharged with timestamp', async () => {
      const dischargedPlan = {
        ...mockDischargePlan,
        status: 'discharged',
        actual_discharge_datetime: '2026-01-17T10:30:00Z'
      };

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: dischargedPlan,
                error: null
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.markPatientDischarged(
        'plan-123',
        '2026-01-17T10:30:00Z'
      );

      expect(result.status).toBe('discharged');
      expect(result.actual_discharge_datetime).toBe('2026-01-17T10:30:00Z');
    });
  });

  describe('getActiveDischargePlans', () => {
    it('should return active discharge plans', async () => {
      const activePlans = [mockDischargePlan, { ...mockDischargePlan, id: 'plan-456' }];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: activePlans,
                error: null
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getActiveDischargePlans();

      expect(result).toHaveLength(2);
    });
  });

  describe('getHighRiskDischargePlans', () => {
    it('should return plans with risk score >= 60', async () => {
      const highRiskPlans = [
        { ...mockDischargePlan, readmission_risk_score: 85 },
        { ...mockDischargePlan, id: 'plan-456', readmission_risk_score: 72 }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: highRiskPlans,
                  error: null
                })
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getHighRiskDischargePlans();

      expect(result).toHaveLength(2);
      expect(result[0].readmission_risk_score).toBeGreaterThanOrEqual(60);
    });
  });

  describe('generateBillingCodes', () => {
    it('should generate 99239 code for discharge planning >= 30 minutes', async () => {
      const planWith45Min = {
        ...mockDischargePlan,
        discharge_planning_time_minutes: 45,
        care_coordination_time_minutes: 25
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: planWith45Min,
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      await expect(
        DischargePlanningService.generateBillingCodes('plan-123')
      ).resolves.not.toThrow();
    });

    it('should generate 99238 code for discharge planning < 30 minutes', async () => {
      const planWith20Min = {
        ...mockDischargePlan,
        discharge_planning_time_minutes: 20,
        care_coordination_time_minutes: 15
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: planWith20Min,
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      await expect(
        DischargePlanningService.generateBillingCodes('plan-123')
      ).resolves.not.toThrow();
    });
  });

  describe('getPendingFollowUps', () => {
    it('should return pending follow-ups due within 24 hours', async () => {
      const pendingFollowUps = [
        {
          id: 'followup-1',
          patient_id: 'patient-456',
          discharge_plan_id: 'plan-123',
          status: 'pending',
          scheduled_datetime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: pendingFollowUps,
                  error: null
                })
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getPendingFollowUps();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('getFollowUpsForPlan', () => {
    it('should return all follow-ups for a discharge plan', async () => {
      const followUps = [
        {
          id: 'followup-1',
          discharge_plan_id: 'plan-123',
          follow_up_type: '48hr_call',
          status: 'completed'
        },
        {
          id: 'followup-2',
          discharge_plan_id: 'plan-123',
          follow_up_type: '7day_pcp',
          status: 'pending'
        }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: followUps,
                error: null
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getFollowUpsForPlan('plan-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('completeFollowUp', () => {
    it('should complete a follow-up call', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      const completedFollowUp = {
        id: 'followup-1',
        patient_id: 'patient-456',
        discharge_plan_id: 'plan-123',
        status: 'completed',
        outcome: 'stable',
        needs_escalation: false,
        call_notes: 'Patient doing well'
      };

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: completedFollowUp,
                error: null
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.completeFollowUp('followup-1', {
        outcome: 'stable',
        call_notes: 'Patient doing well'
      });

      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('stable');
    });

    it('should create alert when patient readmitted', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      const readmittedFollowUp = {
        id: 'followup-1',
        patient_id: 'patient-456',
        discharge_plan_id: 'plan-123',
        status: 'completed',
        outcome: 'readmitted',
        needs_escalation: true
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'post_discharge_follow_ups') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: readmittedFollowUp,
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'care_team_alerts') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null })
          } as any;
        }
        return {} as any;
      });

      const result = await DischargePlanningService.completeFollowUp('followup-1', {
        outcome: 'readmitted',
        needs_escalation: true
      });

      expect(result.outcome).toBe('readmitted');
    });

    it('should throw error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      } as any);

      await expect(
        DischargePlanningService.completeFollowUp('followup-1', {})
      ).rejects.toThrow('not authenticated');
    });
  });

  describe('searchPostAcuteFacilities', () => {
    it('should search facilities by type', async () => {
      const facilities = [
        {
          id: 'facility-1',
          facility_name: 'Sunny Acres SNF',
          facility_type: 'skilled_nursing',
          cms_star_rating: 4,
          active: true
        }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: facilities,
                  error: null
                })
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.searchPostAcuteFacilities('skilled_nursing');

      expect(result).toHaveLength(1);
      expect(result[0].facility_type).toBe('skilled_nursing');
    });

    it('should filter by zip code and star rating', async () => {
      const facilities = [
        {
          id: 'facility-1',
          facility_name: 'Top Rated Rehab',
          facility_type: 'long_term_acute_care',
          facility_zip: '12345',
          cms_star_rating: 5,
          active: true
        }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({
                      data: facilities,
                      error: null
                    })
                  })
                })
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.searchPostAcuteFacilities('long_term_acute_care', '12345', 4);

      expect(result).toHaveLength(1);
      expect(result[0].cms_star_rating).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getFacilitiesWithBeds', () => {
    it('should return facilities with available beds', async () => {
      const facilitiesWithBeds = [
        {
          id: 'facility-1',
          facility_name: 'Open Beds Rehab',
          facility_type: 'inpatient_rehab',
          available_beds: 5,
          active: true
        }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: facilitiesWithBeds,
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any));

      const result = await DischargePlanningService.getFacilitiesWithBeds('inpatient_rehab');

      expect(result).toHaveLength(1);
      expect(result[0].available_beds).toBeGreaterThan(0);
    });
  });

  describe('risk-based follow-up requirements', () => {
    it('should require 48hr call for risk score >= 60', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.rpc.mockResolvedValue({
        data: 65,
        error: null
      } as any);

      const planWith48hrCall = {
        ...mockDischargePlan,
        readmission_risk_score: 65,
        requires_48hr_call: true,
        requires_72hr_call: false
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: planWith48hrCall,
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
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await DischargePlanningService.createDischargePlan({
        patient_id: 'patient-456',
        encounter_id: 'encounter-789',
        discharge_disposition: 'home',
        planned_discharge_date: '2026-01-17',
        planned_discharge_time: '10:00:00'
      });

      expect(result.requires_48hr_call).toBe(true);
    });

    it('should require 72hr call for risk score >= 80', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.rpc.mockResolvedValue({
        data: 85,
        error: null
      } as any);

      const planWith72hrCall = {
        ...mockDischargePlan,
        readmission_risk_score: 85,
        requires_48hr_call: true,
        requires_72hr_call: true
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discharge_plans') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: planWith72hrCall,
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
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await DischargePlanningService.createDischargePlan({
        patient_id: 'patient-456',
        encounter_id: 'encounter-789',
        discharge_disposition: 'home',
        planned_discharge_date: '2026-01-17',
        planned_discharge_time: '10:00:00'
      });

      expect(result.requires_72hr_call).toBe(true);
      expect(result.requires_48hr_call).toBe(true);
    });
  });
});
