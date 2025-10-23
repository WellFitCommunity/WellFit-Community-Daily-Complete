/**
 * Specialist Workflow Engine - Test Suite
 * Comprehensive tests for the workflow execution engine
 */

import { SpecialistWorkflowEngine } from '../SpecialistWorkflowEngine';
import { chwWorkflow } from '../templates/chwTemplate';

// Mock Supabase
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: { id: 'test-visit-id' }, error: null }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

// Mock PHI logger
jest.mock('../../phiAccessLogger', () => ({
  logPhiAccess: jest.fn()
}));

describe('SpecialistWorkflowEngine', () => {
  let engine: SpecialistWorkflowEngine;

  beforeEach(() => {
    engine = new SpecialistWorkflowEngine(chwWorkflow);
  });

  describe('Initialization', () => {
    it('should initialize with a workflow template', () => {
      expect(engine).toBeDefined();
      expect(engine.getAllSteps()).toHaveLength(chwWorkflow.visitWorkflow.length);
    });
  });

  describe('Workflow Navigation', () => {
    it('should get current step', () => {
      const step = engine.getCurrentStep(1);
      expect(step).toBeDefined();
      expect(step?.name).toBe('Check-In');
    });

    it('should get all steps', () => {
      const steps = engine.getAllSteps();
      expect(steps).toHaveLength(8); // CHW has 8 steps
    });

    it('should return undefined for invalid step', () => {
      const step = engine.getCurrentStep(999);
      expect(step).toBeUndefined();
    });
  });

  describe('Step Validation', () => {
    it('should validate required step completion', () => {
      const result = engine.canCompleteStep(2, {
        vitals: {
          systolic: 120,
          diastolic: 80
        }
      });

      expect(result.canComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should identify missing required fields', () => {
      const result = engine.canCompleteStep(2, {});

      expect(result.canComplete).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });

    it('should allow optional steps to be skipped', () => {
      const result = engine.canCompleteStep(4, {}); // SDOH is optional

      // Optional steps can be completed even without data
      expect(result.canComplete).toBe(true);
    });
  });

  describe('Alert Rule Evaluation', () => {
    it('should evaluate simple greater-than conditions', () => {
      const evaluation = (engine as any).evaluateCondition(
        'vitals.systolic > 180',
        { vitals: { systolic: 190 } }
      );

      expect(evaluation.result).toBe(true);
      expect(evaluation.value).toBe(190);
    });

    it('should evaluate simple less-than conditions', () => {
      const evaluation = (engine as any).evaluateCondition(
        'vitals.oxygen_saturation < 88',
        { vitals: { oxygen_saturation: 85 } }
      );

      expect(evaluation.result).toBe(true);
      expect(evaluation.value).toBe(85);
    });

    it('should evaluate equality conditions', () => {
      const evaluation = (engine as any).evaluateCondition(
        'medications.count == 0',
        { medications: { count: 0 } }
      );

      expect(evaluation.result).toBe(true);
    });

    it('should handle nested property paths', () => {
      const evaluation = (engine as any).evaluateCondition(
        'sdoh_prapare.food_insecurity == true',
        { sdoh_prapare: { food_insecurity: true } }
      );

      expect(evaluation.result).toBe(true);
    });

    it('should return false for missing values', () => {
      const evaluation = (engine as any).evaluateCondition(
        'vitals.systolic > 180',
        {}
      );

      expect(evaluation.result).toBe(false);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate 0% for no completed steps', () => {
      const progress = engine.getProgress([]);
      expect(progress).toBe(0);
    });

    it('should calculate 50% for half completed', () => {
      const totalSteps = chwWorkflow.visitWorkflow.length;
      const halfSteps = Array.from({ length: Math.floor(totalSteps / 2) }, (_, i) => i + 1);
      const progress = engine.getProgress(halfSteps);
      expect(progress).toBe(50);
    });

    it('should calculate 100% for all completed', () => {
      const allSteps = chwWorkflow.visitWorkflow.map(s => s.step);
      const progress = engine.getProgress(allSteps);
      expect(progress).toBe(100);
    });
  });
});

describe('Workflow Templates', () => {
  it('CHW template should have valid structure', () => {
    expect(chwWorkflow.id).toBe('chw-rural-v1');
    expect(chwWorkflow.specialistType).toBe('CHW');
    expect(chwWorkflow.assessmentFields).toBeInstanceOf(Array);
    expect(chwWorkflow.visitWorkflow).toBeInstanceOf(Array);
    expect(chwWorkflow.alertRules).toBeInstanceOf(Array);
    expect(chwWorkflow.integrations).toBeDefined();
  });

  it('All alert rules should have required fields', () => {
    for (const rule of chwWorkflow.alertRules) {
      expect(rule.id).toBeDefined();
      expect(rule.condition).toBeDefined();
      expect(rule.severity).toMatch(/critical|high|medium|low|info/);
      expect(rule.notifyRole).toBeDefined();
      expect(rule.within).toBeDefined();
      expect(rule.message).toBeDefined();
    }
  });

  it('All workflow steps should be numbered sequentially', () => {
    const steps = chwWorkflow.visitWorkflow;
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].step).toBe(i + 1);
    }
  });

  it('Required steps should not have skip conditions', () => {
    const requiredSteps = chwWorkflow.visitWorkflow.filter(s => s.required);
    for (const step of requiredSteps) {
      expect(step.validation?.canSkipIf).toBeUndefined();
    }
  });
});
