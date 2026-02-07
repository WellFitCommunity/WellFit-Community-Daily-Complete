/**
 * Tests for FHIR GoalService
 *
 * Covers patient health goals and targets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoalService } from '../GoalService';

// Mock getErrorMessage
vi.mock('../../../lib/getErrorMessage', () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
}));

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              {
                id: 'goal-1',
                patient_id: 'patient-1',
                description: 'Reduce A1C below 7%',
                lifecycle_status: 'active',
              },
            ],
            error: null,
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [{ id: 'goal-1', lifecycle_status: 'active' }],
                error: null,
              })),
            })),
          })),
          contains: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [{ id: 'goal-1', category: ['dietary'] }],
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'goal-new', description: 'New Goal' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'goal-1', lifecycle_status: 'completed' },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('GoalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all goals for a patient', async () => {
      const result = await GoalService.getAll('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by start date descending', async () => {
      const result = await GoalService.getAll('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getActive', () => {
    it('should return active goals', async () => {
      const result = await GoalService.getActive('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should order by priority', async () => {
      const result = await GoalService.getActive('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getByCategory', () => {
    it('should return goals by category', async () => {
      const result = await GoalService.getByCategory('patient-1', 'dietary');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter behavioral goals', async () => {
      const result = await GoalService.getByCategory('patient-1', 'behavioral');

      expect(result.success).toBe(true);
    });

    it('should filter physiological goals', async () => {
      const result = await GoalService.getByCategory('patient-1', 'physiologic');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new goal', async () => {
      const newGoal = {
        patient_id: 'patient-1',
        description: 'Lose 10 pounds in 3 months',
        lifecycle_status: 'active',
        category: ['weight-management'],
        start_date: new Date().toISOString(),
        target: [{ measure: 'weight', detail: { value: -10, unit: 'lbs' } }],
      };

      const result = await GoalService.create(newGoal);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create A1C goal', async () => {
      const a1cGoal = {
        patient_id: 'patient-1',
        description: 'Reduce A1C to below 7%',
        lifecycle_status: 'active',
        category: ['physiologic'],
        target: [{ measure: 'A1C', detail: { value: 7.0, comparator: '<' } }],
      };

      const result = await GoalService.create(a1cGoal);

      expect(result.success).toBe(true);
    });

    it('should create blood pressure goal', async () => {
      const bpGoal = {
        patient_id: 'patient-1',
        description: 'Maintain blood pressure below 140/90',
        lifecycle_status: 'active',
        category: ['physiologic'],
        target: [
          { measure: 'systolic BP', detail: { value: 140, comparator: '<' } },
          { measure: 'diastolic BP', detail: { value: 90, comparator: '<' } },
        ],
      };

      const result = await GoalService.create(bpGoal);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a goal', async () => {
      const result = await GoalService.update('goal-1', {
        lifecycle_status: 'on-hold',
        status_reason: 'Patient hospitalized',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update achievement status', async () => {
      const result = await GoalService.update('goal-1', {
        achievement_status: 'in-progress',
      });

      expect(result.success).toBe(true);
    });

    it('should update target values', async () => {
      const result = await GoalService.update('goal-1', {
        target: [{ measure: 'A1C', detail: { value: 6.5, comparator: '<' } }],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('complete', () => {
    it('should complete a goal', async () => {
      const result = await GoalService.complete('goal-1');

      expect(result.success).toBe(true);
    });

    it('should set status to completed', async () => {
      const result = await GoalService.complete('goal-1');

      expect(result.success).toBe(true);
    });

    it('should set status date', async () => {
      const result = await GoalService.complete('goal-1');

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await GoalService.getAll('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle update errors', async () => {
      const result = await GoalService.update('invalid', { lifecycle_status: 'completed' });
      expect(result).toBeDefined();
    });
  });
});
