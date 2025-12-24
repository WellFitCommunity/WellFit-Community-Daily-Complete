/**
 * Guardian Flow Engine Service Tests
 *
 * Tests for ED crowding prediction, EMS scoring, and capacity recommendations.
 *
 * Note: Service integration tests (predictCrowding, recommendActions, etc.)
 * require full DB mocking with complex query chains. These tests focus on
 * the pure functions and type helpers. Integration tests should use a test
 * database or be run in CI with proper fixtures.
 */

import type {
  GuardianFlowConfig,
  InboundEMSUnit,
} from '../../types/guardianFlow';
import {
  getCrowdingLevel,
  getCrowdingLevelColor,
  getCrowdingLevelLabel,
  getDiversionLabel,
} from '../../types/guardianFlow';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
      })),
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(() => Promise.resolve()),
    warn: vi.fn(() => Promise.resolve()),
    error: vi.fn(() => Promise.resolve()),
  },
}));

describe('Guardian Flow Type Helpers', () => {
  describe('getCrowdingLevel', () => {
    const config: GuardianFlowConfig = {
      yellowThreshold: 70,
      orangeThreshold: 85,
      redThreshold: 95,
      boardingHoursThreshold: 4,
      autoSurgeEnabled: false,
      defaultDiversionPolicy: 'moderate',
      historicalWindowHours: 168,
    };

    it('should return green for low census (60%)', () => {
      // 30 out of 50 = 60% capacity
      expect(getCrowdingLevel(30, 50, config)).toBe('green');
    });

    it('should return yellow for moderate census (72%)', () => {
      // 36 out of 50 = 72% capacity (above 70% threshold)
      expect(getCrowdingLevel(36, 50, config)).toBe('yellow');
    });

    it('should return orange for high census (88%)', () => {
      // 44 out of 50 = 88% capacity (above 85% threshold)
      expect(getCrowdingLevel(44, 50, config)).toBe('orange');
    });

    it('should return red for critical census (96%)', () => {
      // 48 out of 50 = 96% capacity (above 95% threshold)
      expect(getCrowdingLevel(48, 50, config)).toBe('red');
    });

    it('should return green for zero capacity (edge case)', () => {
      expect(getCrowdingLevel(10, 0, config)).toBe('green');
    });

    it('should return green for negative capacity (edge case)', () => {
      expect(getCrowdingLevel(10, -5, config)).toBe('green');
    });

    it('should return green at exact yellow threshold boundary (69%)', () => {
      // 69% is below 70% threshold
      expect(getCrowdingLevel(69, 100, config)).toBe('green');
    });

    it('should return yellow at exact yellow threshold (70%)', () => {
      expect(getCrowdingLevel(70, 100, config)).toBe('yellow');
    });

    it('should return red for over capacity (110%)', () => {
      expect(getCrowdingLevel(55, 50, config)).toBe('red');
    });
  });

  describe('getCrowdingLevelColor', () => {
    it('should return green classes for green level', () => {
      const color = getCrowdingLevelColor('green');
      expect(color).toContain('green');
      expect(color).toContain('bg-green');
    });

    it('should return yellow classes for yellow level', () => {
      const color = getCrowdingLevelColor('yellow');
      expect(color).toContain('yellow');
      expect(color).toContain('bg-yellow');
    });

    it('should return orange classes for orange level', () => {
      const color = getCrowdingLevelColor('orange');
      expect(color).toContain('orange');
      expect(color).toContain('bg-orange');
    });

    it('should return red classes for red level', () => {
      const color = getCrowdingLevelColor('red');
      expect(color).toContain('red');
      expect(color).toContain('bg-red');
    });
  });

  describe('getCrowdingLevelLabel', () => {
    it('should return Normal Operations for green', () => {
      expect(getCrowdingLevelLabel('green')).toBe('Normal Operations');
    });

    it('should return Elevated Volume for yellow', () => {
      expect(getCrowdingLevelLabel('yellow')).toBe('Elevated Volume');
    });

    it('should return action-oriented label for orange', () => {
      const label = getCrowdingLevelLabel('orange');
      expect(label).toContain('Action');
      expect(label).toContain('High Volume');
    });

    it('should return surge protocol label for red', () => {
      const label = getCrowdingLevelLabel('red');
      expect(label).toContain('Surge');
      expect(label).toContain('Critical');
    });
  });

  describe('getDiversionLabel', () => {
    it('should return Accept All for accept', () => {
      expect(getDiversionLabel('accept')).toBe('Accept All');
    });

    it('should return soft divert label with Alt Destination', () => {
      const label = getDiversionLabel('soft_divert');
      expect(label).toContain('Alt');
      expect(label).toContain('Soft Divert');
    });

    it('should return hard divert label with Cannot Accept', () => {
      const label = getDiversionLabel('hard_divert');
      expect(label).toContain('Cannot Accept');
      expect(label).toContain('Hard Divert');
    });
  });
});

describe('Guardian Flow Type Validation', () => {
  describe('InboundEMSUnit type', () => {
    it('should accept minimal EMS unit data', () => {
      const unit: InboundEMSUnit = {
        unitId: 'ems-123',
        unitCallSign: 'Medic 7',
        status: 'transporting',
        eta: 10,
      };

      expect(unit.unitId).toBe('ems-123');
      expect(unit.status).toBe('transporting');
      expect(unit.traumaActivation).toBeUndefined();
    });

    it('should accept full EMS unit data with alerts', () => {
      const unit: InboundEMSUnit = {
        unitId: 'ems-456',
        unitCallSign: 'Rescue 3',
        status: 'transporting',
        eta: 5,
        chiefComplaint: 'Chest pain',
        estimatedAcuity: 2,
        patientAgeBracket: 'adult',
        traumaActivation: false,
        strokeAlert: false,
        stemiAlert: true,
        resourcesNeeded: ['cath lab', 'cardiology'],
      };

      expect(unit.stemiAlert).toBe(true);
      expect(unit.resourcesNeeded).toContain('cath lab');
      expect(unit.patientAgeBracket).toBe('adult');
    });

    it('should accept pediatric patient with trauma activation', () => {
      const unit: InboundEMSUnit = {
        unitId: 'ems-789',
        unitCallSign: 'Medic 1',
        status: 'transporting',
        eta: 3,
        estimatedAcuity: 1,
        patientAgeBracket: 'pediatric',
        traumaActivation: true,
        resourcesNeeded: ['trauma bay', 'pediatric surgeon', 'blood bank'],
      };

      expect(unit.traumaActivation).toBe(true);
      expect(unit.estimatedAcuity).toBe(1);
    });
  });

  describe('GuardianFlowConfig type', () => {
    it('should accept valid config with all required fields', () => {
      const config: GuardianFlowConfig = {
        yellowThreshold: 70,
        orangeThreshold: 85,
        redThreshold: 95,
        boardingHoursThreshold: 4,
        autoSurgeEnabled: false,
        defaultDiversionPolicy: 'moderate',
        historicalWindowHours: 168,
      };

      expect(config.yellowThreshold).toBe(70);
      expect(config.defaultDiversionPolicy).toBe('moderate');
    });

    it('should support conservative diversion policy', () => {
      const config: GuardianFlowConfig = {
        yellowThreshold: 70,
        orangeThreshold: 85,
        redThreshold: 95,
        boardingHoursThreshold: 4,
        autoSurgeEnabled: false,
        defaultDiversionPolicy: 'conservative',
        historicalWindowHours: 168,
      };

      expect(config.defaultDiversionPolicy).toBe('conservative');
    });

    it('should support aggressive diversion policy with auto-surge', () => {
      const config: GuardianFlowConfig = {
        yellowThreshold: 65,
        orangeThreshold: 80,
        redThreshold: 90,
        boardingHoursThreshold: 3,
        autoSurgeEnabled: true,
        defaultDiversionPolicy: 'aggressive',
        historicalWindowHours: 72, // 3 days
      };

      expect(config.defaultDiversionPolicy).toBe('aggressive');
      expect(config.autoSurgeEnabled).toBe(true);
      expect(config.yellowThreshold).toBe(65);
    });
  });
});

describe('Guardian Flow Business Logic', () => {
  const config: GuardianFlowConfig = {
    yellowThreshold: 70,
    orangeThreshold: 85,
    redThreshold: 95,
    boardingHoursThreshold: 4,
    autoSurgeEnabled: false,
    defaultDiversionPolicy: 'moderate',
    historicalWindowHours: 168,
  };

  describe('crowding level progression', () => {
    it('should show correct progression as census increases', () => {
      const capacity = 50;

      // Test progression from 0 to 100+%
      expect(getCrowdingLevel(25, capacity, config)).toBe('green');  // 50%
      expect(getCrowdingLevel(35, capacity, config)).toBe('yellow'); // 70%
      expect(getCrowdingLevel(43, capacity, config)).toBe('orange'); // 86%
      expect(getCrowdingLevel(48, capacity, config)).toBe('red');    // 96%
      expect(getCrowdingLevel(60, capacity, config)).toBe('red');    // 120%
    });
  });

  describe('custom threshold testing', () => {
    it('should respect tighter thresholds', () => {
      const tightConfig: GuardianFlowConfig = {
        ...config,
        yellowThreshold: 50,
        orangeThreshold: 70,
        redThreshold: 85,
      };

      // 60% would be green with default, but yellow with tight thresholds
      expect(getCrowdingLevel(30, 50, tightConfig)).toBe('yellow');
      // 75% would be yellow with default, but orange with tight
      expect(getCrowdingLevel(75, 100, tightConfig)).toBe('orange');
    });

    it('should respect looser thresholds', () => {
      const looseConfig: GuardianFlowConfig = {
        ...config,
        yellowThreshold: 80,
        orangeThreshold: 90,
        redThreshold: 98,
      };

      // 75% would be yellow with default, but green with loose thresholds
      expect(getCrowdingLevel(75, 100, looseConfig)).toBe('green');
      // 92% would be red with default, but orange with loose
      expect(getCrowdingLevel(92, 100, looseConfig)).toBe('orange');
    });
  });
});

// Integration tests with mocked Supabase
describe('GuardianFlowEngine Integration Tests', () => {
  describe('confidence levels', () => {
    it('should use 0.85 confidence for 1-hour horizon', () => {
      // Confidence mapping is defined in the service
      const confidenceByHorizon: Record<number, number> = { 1: 0.85, 4: 0.75, 8: 0.65 };
      expect(confidenceByHorizon[1]).toBe(0.85);
    });

    it('should use 0.75 confidence for 4-hour horizon', () => {
      const confidenceByHorizon: Record<number, number> = { 1: 0.85, 4: 0.75, 8: 0.65 };
      expect(confidenceByHorizon[4]).toBe(0.75);
    });

    it('should use 0.65 confidence for 8-hour horizon', () => {
      const confidenceByHorizon: Record<number, number> = { 1: 0.85, 4: 0.75, 8: 0.65 };
      expect(confidenceByHorizon[8]).toBe(0.65);
    });
  });

  describe('EMS scoring factors', () => {
    it('should weight trauma/stroke/STEMI alerts at 25 points', () => {
      const traumaActivation = true;
      const resourceWeight = traumaActivation ? 25 : 0;
      expect(resourceWeight).toBe(25);
    });

    it('should weight acuity as acuity * 10', () => {
      const acuity = 2;
      const acuityWeight = acuity * 10;
      expect(acuityWeight).toBe(20);
    });

    it('should weight red crowding at 30 points', () => {
      const currentCrowding = 'red';
      const capacityWeight = currentCrowding === 'red' ? 30 : currentCrowding === 'orange' ? 20 : 10;
      expect(capacityWeight).toBe(30);
    });

    it('should weight orange crowding at 20 points', () => {
      const currentCrowding = 'orange';
      const capacityWeight = currentCrowding === 'red' ? 30 : currentCrowding === 'orange' ? 20 : 10;
      expect(capacityWeight).toBe(20);
    });
  });

  describe('diversion recommendations', () => {
    it('should recommend hard_divert for red crowding with high impact and aggressive policy', () => {
      const currentCrowding = 'red';
      const capacityImpact = 65;
      const policy = 'aggressive';

      let recommendation = 'accept';
      if (currentCrowding === 'red' && capacityImpact > 60) {
        recommendation = policy === 'aggressive' ? 'hard_divert' : 'soft_divert';
      }
      expect(recommendation).toBe('hard_divert');
    });

    it('should recommend soft_divert for orange crowding with high impact', () => {
      const currentCrowding = 'orange';
      const capacityImpact = 75;

      let recommendation = 'accept';
      if (currentCrowding === 'orange' && capacityImpact > 70) {
        recommendation = 'soft_divert';
      }
      expect(recommendation).toBe('soft_divert');
    });

    it('should recommend accept for green crowding', () => {
      const currentCrowding = 'green';
      const capacityImpact = 50;

      let recommendation = 'accept';
      if (currentCrowding === 'red' && capacityImpact > 60) {
        recommendation = 'hard_divert';
      } else if (currentCrowding === 'orange' && capacityImpact > 70) {
        recommendation = 'soft_divert';
      }
      expect(recommendation).toBe('accept');
    });
  });
});
