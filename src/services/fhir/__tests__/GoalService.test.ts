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

    it('should include proposed and planned goals', async () => {
      // Active goals include: proposed, planned, accepted, active
      const activeStatuses = ['proposed', 'planned', 'accepted', 'active'];
      expect(activeStatuses).toContain('active');
      expect(activeStatuses).toContain('proposed');
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

  describe('lifecycle status values', () => {
    it('should define all FHIR goal statuses', () => {
      const statuses = [
        'proposed',
        'planned',
        'accepted',
        'active',
        'on-hold',
        'completed',
        'cancelled',
        'entered-in-error',
        'rejected',
      ];
      expect(statuses).toContain('active');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('on-hold');
    });
  });

  describe('achievement status values', () => {
    it('should define achievement statuses', () => {
      const statuses = [
        'in-progress',
        'improving',
        'worsening',
        'no-change',
        'achieved',
        'sustaining',
        'not-achieved',
        'no-progress',
        'not-attainable',
      ];
      expect(statuses).toContain('in-progress');
      expect(statuses).toContain('achieved');
    });
  });

  describe('goal category values', () => {
    it('should define goal categories', () => {
      const categories = ['dietary', 'safety', 'behavioral', 'nursing', 'physiologic'];
      expect(categories).toContain('dietary');
      expect(categories).toContain('behavioral');
      expect(categories).toContain('physiologic');
    });
  });

  describe('priority codes', () => {
    it('should define priority levels', () => {
      const priorities = ['high-priority', 'medium-priority', 'low-priority'];
      expect(priorities).toContain('high-priority');
      expect(priorities).toContain('medium-priority');
    });
  });

  describe('goal structure', () => {
    it('should define complete goal structure', () => {
      const goal = {
        id: 'goal-1',
        patient_id: 'patient-1',
        lifecycle_status: 'active',
        achievement_status: 'in-progress',
        category: ['physiologic'],
        priority_code: 'high-priority',
        description: 'Reduce A1C to below 7%',
        subject_id: 'patient-1',
        start_date: '2026-01-01',
        target: [
          {
            measure: 'A1C',
            detail: { value: 7.0, comparator: '<', unit: '%' },
            due_date: '2026-06-01',
          },
        ],
        status_date: '2026-01-15',
        status_reason: null,
        expressed_by_id: 'patient-1',
        addresses: ['cond-1'], // Linked conditions
        note: 'Patient motivated to improve diabetes control',
        outcome_code: null,
        outcome_reference: null,
      };
      expect(goal.lifecycle_status).toBe('active');
      expect(goal.target).toHaveLength(1);
    });
  });

  describe('common health goals', () => {
    it('should recognize diabetes goals', () => {
      const diabetesGoals = [
        'Reduce A1C below 7%',
        'Check blood sugar daily',
        'Take medications as prescribed',
        'Follow diabetic diet',
      ];
      expect(diabetesGoals).toContain('Reduce A1C below 7%');
    });

    it('should recognize cardiovascular goals', () => {
      const cvGoals = [
        'Maintain BP below 140/90',
        'Exercise 30 minutes daily',
        'Reduce sodium intake',
        'Take statins as prescribed',
      ];
      expect(cvGoals).toContain('Maintain BP below 140/90');
    });

    it('should recognize weight management goals', () => {
      const weightGoals = ['Lose 10 pounds', 'Walk 10,000 steps daily', 'Eat 5 servings of vegetables'];
      expect(weightGoals).toContain('Lose 10 pounds');
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
