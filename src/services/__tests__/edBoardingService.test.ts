/**
 * Tests for ED Boarding Service
 *
 * Purpose: ED boarding management, escalations, and bed assignments
 * Tests: Service exports, type definitions, helper functions
 */

import { describe, it, expect } from 'vitest';
import { EDBooardingService } from '../edBoardingService';
import {
  calculateEscalationLevel,
  getEscalationLabel,
  getEscalationColor,
  getBoarderStatusLabel,
  getBoarderStatusColor,
  formatBoardingTime,
  getEscalationThresholdMinutes,
} from '../../types/edBoarding';

describe('EDBooardingService', () => {
  describe('Module Exports', () => {
    it('should export EDBooardingService object', () => {
      expect(EDBooardingService).toBeDefined();
      expect(typeof EDBooardingService).toBe('object');
    });

    it('should export boarder methods', () => {
      expect(typeof EDBooardingService.createBoarder).toBe('function');
      expect(typeof EDBooardingService.getActiveBoarders).toBe('function');
      expect(typeof EDBooardingService.getBoarder).toBe('function');
      expect(typeof EDBooardingService.assignBed).toBe('function');
      expect(typeof EDBooardingService.placeBoarder).toBe('function');
      expect(typeof EDBooardingService.cancelBoarder).toBe('function');
    });

    it('should export escalation methods', () => {
      expect(typeof EDBooardingService.acknowledgeEscalation).toBe('function');
      expect(typeof EDBooardingService.updateBarriers).toBe('function');
      expect(typeof EDBooardingService.getUnacknowledgedEscalations).toBe('function');
    });

    it('should export metrics methods', () => {
      expect(typeof EDBooardingService.getMetrics).toBe('function');
      expect(typeof EDBooardingService.getBoardingByUnit).toBe('function');
    });

    it('should export transport methods', () => {
      expect(typeof EDBooardingService.startTransport).toBe('function');
    });

    it('should export notes methods', () => {
      expect(typeof EDBooardingService.updateNotes).toBe('function');
    });
  });
});

describe('ED Boarding Type Helpers', () => {
  describe('calculateEscalationLevel', () => {
    it('should return green for <2 hours', () => {
      expect(calculateEscalationLevel(0)).toBe('green');
      expect(calculateEscalationLevel(60)).toBe('green');
      expect(calculateEscalationLevel(119)).toBe('green');
    });

    it('should return yellow for 2-4 hours', () => {
      expect(calculateEscalationLevel(120)).toBe('yellow');
      expect(calculateEscalationLevel(180)).toBe('yellow');
      expect(calculateEscalationLevel(239)).toBe('yellow');
    });

    it('should return orange for 4-8 hours', () => {
      expect(calculateEscalationLevel(240)).toBe('orange');
      expect(calculateEscalationLevel(360)).toBe('orange');
      expect(calculateEscalationLevel(479)).toBe('orange');
    });

    it('should return red for 8-12 hours', () => {
      expect(calculateEscalationLevel(480)).toBe('red');
      expect(calculateEscalationLevel(600)).toBe('red');
      expect(calculateEscalationLevel(719)).toBe('red');
    });

    it('should return critical for >12 hours', () => {
      expect(calculateEscalationLevel(720)).toBe('critical');
      expect(calculateEscalationLevel(900)).toBe('critical');
      expect(calculateEscalationLevel(1440)).toBe('critical');
    });
  });

  describe('getEscalationLabel', () => {
    it('should return correct labels for all escalation levels', () => {
      expect(getEscalationLabel('green')).toBe('Normal');
      expect(getEscalationLabel('yellow')).toBe('Monitor');
      expect(getEscalationLabel('orange')).toBe('Escalate');
      expect(getEscalationLabel('red')).toBe('Urgent');
      expect(getEscalationLabel('critical')).toBe('Critical');
    });
  });

  describe('getEscalationColor', () => {
    it('should return color classes for all escalation levels', () => {
      expect(getEscalationColor('green')).toContain('green');
      expect(getEscalationColor('yellow')).toContain('yellow');
      expect(getEscalationColor('orange')).toContain('orange');
      expect(getEscalationColor('red')).toContain('red');
      expect(getEscalationColor('critical')).toContain('red');
    });
  });

  describe('getBoarderStatusLabel', () => {
    it('should return correct labels for all statuses', () => {
      expect(getBoarderStatusLabel('awaiting_bed')).toBe('Awaiting Bed');
      expect(getBoarderStatusLabel('bed_assigned')).toBe('Bed Assigned');
      expect(getBoarderStatusLabel('in_transport')).toBe('In Transport');
      expect(getBoarderStatusLabel('placed')).toBe('Placed');
      expect(getBoarderStatusLabel('cancelled')).toBe('Cancelled');
    });
  });

  describe('getBoarderStatusColor', () => {
    it('should return color classes for all statuses', () => {
      expect(getBoarderStatusColor('awaiting_bed')).toContain('yellow');
      expect(getBoarderStatusColor('bed_assigned')).toContain('blue');
      expect(getBoarderStatusColor('in_transport')).toContain('indigo');
      expect(getBoarderStatusColor('placed')).toContain('green');
      expect(getBoarderStatusColor('cancelled')).toContain('gray');
    });
  });

  describe('formatBoardingTime', () => {
    it('should format minutes only for short durations', () => {
      expect(formatBoardingTime(15)).toBe('15m');
      expect(formatBoardingTime(45)).toBe('45m');
      expect(formatBoardingTime(59)).toBe('59m');
    });

    it('should format hours for exact hours', () => {
      expect(formatBoardingTime(60)).toBe('1h');
      expect(formatBoardingTime(120)).toBe('2h');
    });

    it('should format hours and minutes for mixed durations', () => {
      expect(formatBoardingTime(75)).toBe('1h 15m');
      expect(formatBoardingTime(150)).toBe('2h 30m');
      expect(formatBoardingTime(495)).toBe('8h 15m');
    });
  });

  describe('getEscalationThresholdMinutes', () => {
    it('should return correct thresholds for all levels', () => {
      expect(getEscalationThresholdMinutes('green')).toBe(0);
      expect(getEscalationThresholdMinutes('yellow')).toBe(120);
      expect(getEscalationThresholdMinutes('orange')).toBe(240);
      expect(getEscalationThresholdMinutes('red')).toBe(480);
      expect(getEscalationThresholdMinutes('critical')).toBe(720);
    });
  });
});
