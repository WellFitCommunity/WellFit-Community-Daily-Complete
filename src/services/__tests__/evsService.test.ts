/**
 * Tests for EVS Service
 *
 * Purpose: Housekeeping dispatch, assignments, and turnaround tracking
 * Tests: Service exports, type definitions, helper functions
 */

import { describe, it, expect } from 'vitest';
import { EVSService } from '../evsService';
import {
  getEVSPriorityLabel,
  getEVSPriorityColor,
  getEVSStatusLabel,
  getEVSStatusColor,
  getEVSRequestTypeLabel,
  determineEVSPriority,
  calculateTurnaroundMinutes,
  formatDuration,
} from '../../types/evs';

describe('EVSService', () => {
  describe('Module Exports', () => {
    it('should export EVSService object', () => {
      expect(EVSService).toBeDefined();
      expect(typeof EVSService).toBe('object');
    });

    it('should export request methods', () => {
      expect(typeof EVSService.getEVSRequests).toBe('function');
      expect(typeof EVSService.getPendingRequests).toBe('function');
      expect(typeof EVSService.getInProgressRequests).toBe('function');
      expect(typeof EVSService.createEVSRequest).toBe('function');
      expect(typeof EVSService.assignEVSRequest).toBe('function');
      expect(typeof EVSService.startEVSRequest).toBe('function');
      expect(typeof EVSService.completeEVSRequest).toBe('function');
      expect(typeof EVSService.cancelEVSRequest).toBe('function');
    });

    it('should export staff methods', () => {
      expect(typeof EVSService.getEVSStaff).toBe('function');
      expect(typeof EVSService.getAvailableStaff).toBe('function');
      expect(typeof EVSService.updateStaffStatus).toBe('function');
    });

    it('should export metrics methods', () => {
      expect(typeof EVSService.getEVSMetrics).toBe('function');
      expect(typeof EVSService.getEVSUnitSummaries).toBe('function');
    });
  });
});

describe('EVS Type Helpers', () => {
  describe('getEVSPriorityLabel', () => {
    it('should return correct labels for all priorities', () => {
      expect(getEVSPriorityLabel('routine')).toBe('Routine');
      expect(getEVSPriorityLabel('urgent')).toBe('Urgent');
      expect(getEVSPriorityLabel('stat')).toBe('STAT');
      expect(getEVSPriorityLabel('isolation')).toBe('Isolation');
    });
  });

  describe('getEVSPriorityColor', () => {
    it('should return color classes for all priorities', () => {
      expect(getEVSPriorityColor('routine')).toContain('gray');
      expect(getEVSPriorityColor('urgent')).toContain('orange');
      expect(getEVSPriorityColor('stat')).toContain('red');
      expect(getEVSPriorityColor('isolation')).toContain('purple');
    });
  });

  describe('getEVSStatusLabel', () => {
    it('should return correct labels for all statuses', () => {
      expect(getEVSStatusLabel('pending')).toBe('Pending');
      expect(getEVSStatusLabel('assigned')).toBe('Assigned');
      expect(getEVSStatusLabel('in_progress')).toBe('In Progress');
      expect(getEVSStatusLabel('completed')).toBe('Completed');
      expect(getEVSStatusLabel('cancelled')).toBe('Cancelled');
      expect(getEVSStatusLabel('on_hold')).toBe('On Hold');
    });
  });

  describe('getEVSStatusColor', () => {
    it('should return color classes for all statuses', () => {
      expect(getEVSStatusColor('pending')).toContain('yellow');
      expect(getEVSStatusColor('assigned')).toContain('blue');
      expect(getEVSStatusColor('in_progress')).toContain('indigo');
      expect(getEVSStatusColor('completed')).toContain('green');
      expect(getEVSStatusColor('cancelled')).toContain('gray');
      expect(getEVSStatusColor('on_hold')).toContain('amber');
    });
  });

  describe('getEVSRequestTypeLabel', () => {
    it('should return correct labels for request types', () => {
      expect(getEVSRequestTypeLabel('discharge')).toBe('Discharge Clean');
      expect(getEVSRequestTypeLabel('terminal')).toBe('Terminal Clean');
      expect(getEVSRequestTypeLabel('stat')).toBe('STAT Turnaround');
      expect(getEVSRequestTypeLabel('touch_up')).toBe('Touch Up');
      expect(getEVSRequestTypeLabel('spill')).toBe('Spill Cleanup');
      expect(getEVSRequestTypeLabel('other')).toBe('Other');
    });
  });

  describe('determineEVSPriority', () => {
    it('should return isolation priority for isolation rooms', () => {
      expect(determineEVSPriority('med_surg', 'discharge', false, true)).toBe('isolation');
    });

    it('should return stat priority for stat requests', () => {
      expect(determineEVSPriority('med_surg', 'stat', false, false)).toBe('stat');
    });

    it('should return urgent priority when patient is waiting', () => {
      expect(determineEVSPriority('med_surg', 'discharge', true, false)).toBe('urgent');
    });

    it('should return urgent priority for critical care units', () => {
      expect(determineEVSPriority('icu', 'discharge', false, false)).toBe('urgent');
      expect(determineEVSPriority('picu', 'discharge', false, false)).toBe('urgent');
      expect(determineEVSPriority('nicu', 'discharge', false, false)).toBe('urgent');
      expect(determineEVSPriority('or', 'discharge', false, false)).toBe('urgent');
      expect(determineEVSPriority('ed', 'discharge', false, false)).toBe('urgent');
    });

    it('should return routine priority for standard cases', () => {
      expect(determineEVSPriority('med_surg', 'discharge', false, false)).toBe('routine');
      expect(determineEVSPriority('telemetry', 'touch_up', false, false)).toBe('routine');
    });
  });

  describe('calculateTurnaroundMinutes', () => {
    it('should calculate turnaround time correctly', () => {
      const start = new Date('2026-01-19T10:00:00Z').toISOString();
      const end = new Date('2026-01-19T10:30:00Z').toISOString();
      expect(calculateTurnaroundMinutes(start, end)).toBe(30);
    });

    it('should handle longer durations', () => {
      const start = new Date('2026-01-19T10:00:00Z').toISOString();
      const end = new Date('2026-01-19T12:15:00Z').toISOString();
      expect(calculateTurnaroundMinutes(start, end)).toBe(135);
    });
  });

  describe('formatDuration', () => {
    it('should format minutes only for short durations', () => {
      expect(formatDuration(15)).toBe('15m');
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(59)).toBe('59m');
    });

    it('should format hours for longer durations', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
    });

    it('should format hours and minutes for mixed durations', () => {
      expect(formatDuration(75)).toBe('1h 15m');
      expect(formatDuration(150)).toBe('2h 30m');
    });
  });
});
