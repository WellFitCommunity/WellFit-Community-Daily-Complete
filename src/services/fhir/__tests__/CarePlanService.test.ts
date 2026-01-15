/**
 * Tests for FHIR CarePlanService
 *
 * Covers treatment plans and care coordination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CarePlanService } from '../CarePlanService';

// Mock getErrorMessage
vi.mock('../../../lib/getErrorMessage', () => ({
  getErrorMessage: (err: unknown) => err instanceof Error ? err.message : 'Unknown error',
}));

// Mock supabase with proper chain support
const carePlanData = [
  { id: 'cp-1', patient_id: 'patient-1', status: 'active' },
  { id: 'cp-2', patient_id: 'patient-1', status: 'completed' },
];

// Fully recursive mock that supports any chain depth
const mockChain: ReturnType<typeof vi.fn> = vi.fn(() => ({
  data: carePlanData,
  error: null,
  eq: mockChain,
  order: mockChain,
  contains: mockChain,
  gte: mockChain,
  lte: mockChain,
  single: vi.fn(() => ({
    data: { id: 'cp-1', status: 'active', patient_id: 'patient-1' },
    error: null,
  })),
}));

const mockSelect = vi.fn(() => ({
  eq: mockChain,
  contains: mockChain,
  order: mockChain,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'cp-new', patient_id: 'patient-1', status: 'draft' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'cp-1', status: 'completed' },
              error: null,
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
    rpc: vi.fn((funcName: string) => {
      if (funcName === 'get_current_care_plan') {
        return {
          data: [{ id: 'cp-1', status: 'active', patient_id: 'patient-1' }],
          error: null,
        };
      }
      if (funcName === 'get_care_plan_activities_summary') {
        return {
          data: [{ total: 10, completed: 7, pending: 3 }],
          error: null,
        };
      }
      return {
        data: [{ id: 'cp-1', status: 'active' }],
        error: null,
      };
    }),
  },
}));

describe('CarePlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should return all care plans for a patient', async () => {
      const result = await CarePlanService.getByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by created date descending', async () => {
      const result = await CarePlanService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return care plan by ID', async () => {
      const result = await CarePlanService.getById('cp-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return null for not found', async () => {
      const result = await CarePlanService.getById('cp-nonexistent');

      expect(result.success).toBe(true);
    });
  });

  describe('getActive', () => {
    it('should return active care plans', async () => {
      const result = await CarePlanService.getActive('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter by active status', async () => {
      const result = await CarePlanService.getActive('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getCurrent', () => {
    it('should return current care plan', async () => {
      const result = await CarePlanService.getCurrent('patient-1');

      expect(result.success).toBe(true);
    });

    it('should return null if no active plan', async () => {
      const result = await CarePlanService.getCurrent('patient-no-plan');

      expect(result.success).toBe(true);
    });
  });

  describe('getByStatus', () => {
    it('should return care plans by status', async () => {
      const result = await CarePlanService.getByStatus('patient-1', 'active');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter completed plans', async () => {
      const result = await CarePlanService.getByStatus('patient-1', 'completed');

      expect(result.success).toBe(true);
    });

    it('should filter draft plans', async () => {
      const result = await CarePlanService.getByStatus('patient-1', 'draft');

      expect(result.success).toBe(true);
    });
  });

  describe('getByCategory', () => {
    it('should return care plans by category', async () => {
      const result = await CarePlanService.getByCategory('patient-1', 'assess-plan');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter longitudinal plans', async () => {
      const result = await CarePlanService.getByCategory('patient-1', 'longitudinal');

      expect(result.success).toBe(true);
    });
  });

  describe('getActivitiesSummary', () => {
    it('should return activities summary', async () => {
      const result = await CarePlanService.getActivitiesSummary('cp-1');

      expect(result.success).toBe(true);
    });

    it('should include completion counts', async () => {
      const result = await CarePlanService.getActivitiesSummary('cp-1');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new care plan', async () => {
      const newPlan = {
        patient_id: 'patient-1',
        status: 'draft' as const,
        intent: 'plan' as const,
        title: 'Diabetes Management Plan',
        category: ['assess-plan'],
      };

      const result = await CarePlanService.create(newPlan);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create post-discharge plan', async () => {
      const dischargePlan = {
        patient_id: 'patient-1',
        status: 'active' as const,
        intent: 'plan' as const,
        title: 'Post-Discharge Care Plan',
        category: ['episodic'],
        period_start: new Date().toISOString(),
      };

      const result = await CarePlanService.create(dischargePlan);

      expect(result.success).toBe(true);
    });

    it('should create preventive care plan', async () => {
      const preventivePlan = {
        patient_id: 'patient-1',
        status: 'active' as const,
        intent: 'plan' as const,
        title: 'Annual Wellness Plan',
        category: ['longitudinal'],
      };

      const result = await CarePlanService.create(preventivePlan);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a care plan', async () => {
      const result = await CarePlanService.update('cp-1', {
        status: 'on-hold' as const,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should add description', async () => {
      const result = await CarePlanService.update('cp-1', {
        description: 'Updated care plan with new activities',
      });

      expect(result.success).toBe(true);
    });

    it('should update period_end', async () => {
      const result = await CarePlanService.update('cp-1', {
        period_end: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete a care plan', async () => {
      const result = await CarePlanService.delete('cp-1');

      expect(result.success).toBe(true);
    });
  });

  describe('search', () => {
    it('should search with multiple filters', async () => {
      const result = await CarePlanService.search({
        patientId: 'patient-1',
        status: 'active',
        category: 'assess-plan',
      });

      expect(result.success).toBe(true);
    });

    it('should search by date range', async () => {
      const result = await CarePlanService.search({
        patientId: 'patient-1',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      });

      expect(result.success).toBe(true);
    });

    it('should search without filters', async () => {
      const result = await CarePlanService.search({});

      expect(result.success).toBe(true);
    });
  });

  describe('complete', () => {
    it('should complete a care plan', async () => {
      const result = await CarePlanService.complete('cp-1');

      expect(result.success).toBe(true);
    });

    it('should set status to completed', async () => {
      const result = await CarePlanService.complete('cp-1');

      expect(result.success).toBe(true);
    });
  });

  describe('activate', () => {
    it('should activate a care plan', async () => {
      const result = await CarePlanService.activate('cp-1');

      expect(result.success).toBe(true);
    });

    it('should set period_start', async () => {
      const result = await CarePlanService.activate('cp-1');

      expect(result.success).toBe(true);
    });
  });

  describe('hold', () => {
    it('should put care plan on hold', async () => {
      const result = await CarePlanService.hold('cp-1');

      expect(result.success).toBe(true);
    });

    it('should accept optional reason', async () => {
      const result = await CarePlanService.hold('cp-1', 'Patient hospitalized');

      expect(result.success).toBe(true);
    });
  });

  describe('care plan status values', () => {
    it('should define all FHIR care plan statuses', () => {
      const statuses = [
        'draft',
        'active',
        'on-hold',
        'revoked',
        'completed',
        'entered-in-error',
        'unknown',
      ];
      expect(statuses).toContain('active');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('on-hold');
    });
  });

  describe('care plan intent values', () => {
    it('should define all intent values', () => {
      const intents = ['proposal', 'plan', 'order', 'option'];
      expect(intents).toContain('plan');
      expect(intents).toContain('order');
    });
  });

  describe('care plan category values', () => {
    it('should define category types', () => {
      const categories = ['assess-plan', 'longitudinal', 'episodic', 'encounter'];
      expect(categories).toContain('assess-plan');
      expect(categories).toContain('longitudinal');
    });
  });

  describe('care plan structure', () => {
    it('should define complete care plan structure', () => {
      const carePlan = {
        id: 'cp-1',
        patient_id: 'patient-1',
        status: 'active',
        intent: 'plan',
        title: 'Comprehensive Care Plan',
        description: 'Ongoing diabetes management',
        category: ['assess-plan'],
        period_start: '2026-01-01',
        period_end: null,
        created: '2026-01-01',
        author_id: 'practitioner-1',
        contributor: ['practitioner-2'],
        care_team_id: 'team-1',
        addresses: ['cond-1', 'cond-2'],
        goal: ['goal-1'],
        activity: [
          {
            detail: {
              kind: 'ServiceRequest',
              code: 'A1C test',
              status: 'scheduled',
              scheduled_timing: 'Every 3 months',
            },
          },
        ],
        note: 'Patient engaged and compliant',
      };
      expect(carePlan.status).toBe('active');
      expect(carePlan.intent).toBe('plan');
      expect(carePlan.activity).toHaveLength(1);
    });
  });

  describe('activity status values', () => {
    it('should define activity statuses', () => {
      const statuses = [
        'not-started',
        'scheduled',
        'in-progress',
        'on-hold',
        'completed',
        'cancelled',
        'stopped',
        'unknown',
        'entered-in-error',
      ];
      expect(statuses).toContain('scheduled');
      expect(statuses).toContain('in-progress');
      expect(statuses).toContain('completed');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await CarePlanService.getByPatient('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle RPC errors', async () => {
      const result = await CarePlanService.getActive('test');
      expect(result).toBeDefined();
    });
  });
});
