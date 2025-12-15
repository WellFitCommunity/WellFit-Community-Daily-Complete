/**
 * Law Enforcement Types Tests
 * Tests for helper functions and type utilities
 */

// describe, it, expect from vitest globals
import {
  getMobilityStatusText,
  getUrgencyColor,
  needsWelfareCheck,
  type EmergencyResponseInfo,
  type ResponsePriority
} from '../lawEnforcement';

describe('Law Enforcement Type Helpers', () => {
  describe('getMobilityStatusText', () => {
    it('should return "Bed-bound" when bed_bound is true', () => {
      const info = {
        bedBound: true,
        wheelchairBound: false,
        walkerRequired: false,
        caneRequired: false
      } as EmergencyResponseInfo;

      expect(getMobilityStatusText(info)).toBe('Bed-bound');
    });

    it('should return "Wheelchair user" when wheelchair_bound is true', () => {
      const info = {
        bedBound: false,
        wheelchairBound: true,
        walkerRequired: false,
        caneRequired: false
      } as EmergencyResponseInfo;

      expect(getMobilityStatusText(info)).toBe('Wheelchair user');
    });

    it('should return "Walker required" when walker_required is true', () => {
      const info = {
        bedBound: false,
        wheelchairBound: false,
        walkerRequired: true,
        caneRequired: false
      } as EmergencyResponseInfo;

      expect(getMobilityStatusText(info)).toBe('Walker required');
    });

    it('should return "Cane required" when cane_required is true', () => {
      const info = {
        bedBound: false,
        wheelchairBound: false,
        walkerRequired: false,
        caneRequired: true
      } as EmergencyResponseInfo;

      expect(getMobilityStatusText(info)).toBe('Cane required');
    });

    it('should return "Ambulatory" when all mobility flags are false', () => {
      const info = {
        bedBound: false,
        wheelchairBound: false,
        walkerRequired: false,
        caneRequired: false
      } as EmergencyResponseInfo;

      expect(getMobilityStatusText(info)).toBe('Ambulatory');
    });

    it('should prioritize bed-bound over other mobility statuses', () => {
      const info = {
        bedBound: true,
        wheelchairBound: true,
        walkerRequired: true,
        caneRequired: true
      } as EmergencyResponseInfo;

      expect(getMobilityStatusText(info)).toBe('Bed-bound');
    });
  });

  describe('getUrgencyColor', () => {
    it('should return "red" for critical priority', () => {
      expect(getUrgencyColor('critical' as ResponsePriority)).toBe('red');
    });

    it('should return "orange" for high priority', () => {
      expect(getUrgencyColor('high' as ResponsePriority)).toBe('orange');
    });

    it('should return "blue" for standard priority', () => {
      expect(getUrgencyColor('standard' as ResponsePriority)).toBe('blue');
    });

    it('should return "gray" for invalid priority', () => {
      expect(getUrgencyColor('invalid' as ResponsePriority)).toBe('gray');
    });
  });

  describe('needsWelfareCheck', () => {
    it('should return true for critical priority after 2 hours', () => {
      expect(needsWelfareCheck(2.5, 6, 'critical')).toBe(true);
    });

    it('should return false for critical priority before 2 hours', () => {
      expect(needsWelfareCheck(1.5, 6, 'critical')).toBe(false);
    });

    it('should return true for high priority after 4 hours', () => {
      expect(needsWelfareCheck(4.5, 6, 'high')).toBe(true);
    });

    it('should return false for high priority before 4 hours', () => {
      expect(needsWelfareCheck(3.5, 6, 'high')).toBe(false);
    });

    it('should return true for standard priority after configured delay', () => {
      expect(needsWelfareCheck(7, 6, 'standard')).toBe(true);
    });

    it('should return false for standard priority before configured delay', () => {
      expect(needsWelfareCheck(5, 6, 'standard')).toBe(false);
    });

    it('should respect exact threshold for standard priority', () => {
      expect(needsWelfareCheck(6, 6, 'standard')).toBe(true);
      expect(needsWelfareCheck(5.99, 6, 'standard')).toBe(false);
    });

    it('should ignore configured delay for critical priority', () => {
      // Even though configured delay is 10 hours, critical always checks at 2 hours
      expect(needsWelfareCheck(2.5, 10, 'critical')).toBe(true);
      expect(needsWelfareCheck(9, 10, 'critical')).toBe(true);
    });

    it('should ignore configured delay for high priority', () => {
      // Even though configured delay is 10 hours, high always checks at 4 hours
      expect(needsWelfareCheck(4.5, 10, 'high')).toBe(true);
      expect(needsWelfareCheck(9, 10, 'high')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero hours since check-in', () => {
      expect(needsWelfareCheck(0, 6, 'standard')).toBe(false);
      expect(needsWelfareCheck(0, 6, 'high')).toBe(false);
      expect(needsWelfareCheck(0, 6, 'critical')).toBe(false);
    });

    it('should handle fractional hours correctly', () => {
      expect(needsWelfareCheck(1.99, 6, 'critical')).toBe(false);
      expect(needsWelfareCheck(2.01, 6, 'critical')).toBe(true);
      expect(needsWelfareCheck(3.99, 6, 'high')).toBe(false);
      expect(needsWelfareCheck(4.01, 6, 'high')).toBe(true);
    });

    it('should handle very large hour values', () => {
      expect(needsWelfareCheck(100, 6, 'standard')).toBe(true);
      expect(needsWelfareCheck(100, 6, 'high')).toBe(true);
      expect(needsWelfareCheck(100, 6, 'critical')).toBe(true);
    });
  });

  describe('Priority Escalation Scenarios', () => {
    it('should escalate bed-bound senior with oxygen after 2 hours (critical)', () => {
      const hoursSince = 2.5;
      const configuredDelay = 6;
      const priority: ResponsePriority = 'critical';

      expect(needsWelfareCheck(hoursSince, configuredDelay, priority)).toBe(true);
    });

    it('should escalate wheelchair user with cognitive impairment after 4 hours (high)', () => {
      const hoursSince = 4.5;
      const configuredDelay = 6;
      const priority: ResponsePriority = 'high';

      expect(needsWelfareCheck(hoursSince, configuredDelay, priority)).toBe(true);
    });

    it('should escalate ambulatory senior after configured 6 hours (standard)', () => {
      const hoursSince = 6.5;
      const configuredDelay = 6;
      const priority: ResponsePriority = 'standard';

      expect(needsWelfareCheck(hoursSince, configuredDelay, priority)).toBe(true);
    });
  });
});
