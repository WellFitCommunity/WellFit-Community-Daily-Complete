/**
 * Tests for Transport Service
 *
 * Purpose: Patient transport coordination, assignments, and tracking
 * Tests: Service exports, type definitions, helper functions
 */

import { describe, it, expect } from 'vitest';
import { TransportService } from '../transportService';
import {
  getTransportPriorityLabel,
  getTransportPriorityColor,
  getTransportStatusLabel,
  getTransportStatusColor,
  getTransportTypeLabel,
  getTransportReasonLabel,
  calculateWaitMinutes,
  calculateTransitMinutes,
  formatETA,
} from '../../types/transport';

describe('TransportService', () => {
  describe('Module Exports', () => {
    it('should export TransportService object', () => {
      expect(TransportService).toBeDefined();
      expect(typeof TransportService).toBe('object');
    });

    it('should export request methods', () => {
      expect(typeof TransportService.getTransportRequests).toBe('function');
      expect(typeof TransportService.getPendingRequests).toBe('function');
      expect(typeof TransportService.getInTransitRequests).toBe('function');
      expect(typeof TransportService.createTransportRequest).toBe('function');
      expect(typeof TransportService.assignTransportRequest).toBe('function');
      expect(typeof TransportService.updateTransportStatus).toBe('function');
      expect(typeof TransportService.completeTransportRequest).toBe('function');
      expect(typeof TransportService.cancelTransportRequest).toBe('function');
    });

    it('should export staff methods', () => {
      expect(typeof TransportService.getTransportStaff).toBe('function');
      expect(typeof TransportService.getAvailableStaff).toBe('function');
    });

    it('should export metrics methods', () => {
      expect(typeof TransportService.getTransportMetrics).toBe('function');
    });
  });
});

describe('Transport Type Helpers', () => {
  describe('getTransportPriorityLabel', () => {
    it('should return correct labels for all priorities', () => {
      expect(getTransportPriorityLabel('routine')).toBe('Routine');
      expect(getTransportPriorityLabel('urgent')).toBe('Urgent');
      expect(getTransportPriorityLabel('stat')).toBe('STAT');
      expect(getTransportPriorityLabel('scheduled')).toBe('Scheduled');
    });
  });

  describe('getTransportPriorityColor', () => {
    it('should return color classes for all priorities', () => {
      expect(getTransportPriorityColor('routine')).toContain('gray');
      expect(getTransportPriorityColor('urgent')).toContain('orange');
      expect(getTransportPriorityColor('stat')).toContain('red');
      expect(getTransportPriorityColor('scheduled')).toContain('blue');
    });
  });

  describe('getTransportStatusLabel', () => {
    it('should return correct labels for all statuses', () => {
      expect(getTransportStatusLabel('requested')).toBe('Requested');
      expect(getTransportStatusLabel('assigned')).toBe('Assigned');
      expect(getTransportStatusLabel('en_route')).toBe('En Route');
      expect(getTransportStatusLabel('arrived')).toBe('Arrived');
      expect(getTransportStatusLabel('in_transit')).toBe('In Transit');
      expect(getTransportStatusLabel('delivered')).toBe('Delivered');
      expect(getTransportStatusLabel('completed')).toBe('Completed');
      expect(getTransportStatusLabel('cancelled')).toBe('Cancelled');
    });
  });

  describe('getTransportStatusColor', () => {
    it('should return color classes for all statuses', () => {
      expect(getTransportStatusColor('requested')).toContain('yellow');
      expect(getTransportStatusColor('assigned')).toContain('blue');
      expect(getTransportStatusColor('en_route')).toContain('indigo');
      expect(getTransportStatusColor('arrived')).toContain('purple');
      expect(getTransportStatusColor('in_transit')).toContain('cyan');
      expect(getTransportStatusColor('delivered')).toContain('teal');
      expect(getTransportStatusColor('completed')).toContain('green');
      expect(getTransportStatusColor('cancelled')).toContain('gray');
    });
  });

  describe('getTransportTypeLabel', () => {
    it('should return correct labels for transport types', () => {
      expect(getTransportTypeLabel('wheelchair')).toBe('Wheelchair');
      expect(getTransportTypeLabel('stretcher')).toBe('Stretcher');
      expect(getTransportTypeLabel('bed')).toBe('Bed');
      expect(getTransportTypeLabel('ambulatory')).toBe('Ambulatory');
      expect(getTransportTypeLabel('bariatric')).toBe('Bariatric');
      expect(getTransportTypeLabel('isolation')).toBe('Isolation');
      expect(getTransportTypeLabel('critical')).toBe('Critical Care');
      expect(getTransportTypeLabel('other')).toBe('Other');
    });
  });

  describe('getTransportReasonLabel', () => {
    it('should return correct labels for transport reasons', () => {
      expect(getTransportReasonLabel('admission')).toBe('Admission');
      expect(getTransportReasonLabel('discharge')).toBe('Discharge');
      expect(getTransportReasonLabel('transfer')).toBe('Transfer');
      expect(getTransportReasonLabel('procedure')).toBe('Procedure');
      expect(getTransportReasonLabel('imaging')).toBe('Imaging');
      expect(getTransportReasonLabel('surgery')).toBe('Surgery');
      expect(getTransportReasonLabel('therapy')).toBe('Therapy');
      expect(getTransportReasonLabel('dialysis')).toBe('Dialysis');
      expect(getTransportReasonLabel('test')).toBe('Test/Lab');
      expect(getTransportReasonLabel('other')).toBe('Other');
    });
  });

  describe('calculateWaitMinutes', () => {
    it('should calculate wait time correctly', () => {
      const requested = new Date('2026-01-19T10:00:00Z').toISOString();
      const pickupStarted = new Date('2026-01-19T10:15:00Z').toISOString();
      expect(calculateWaitMinutes(requested, pickupStarted)).toBe(15);
    });

    it('should handle longer wait times', () => {
      const requested = new Date('2026-01-19T10:00:00Z').toISOString();
      const pickupStarted = new Date('2026-01-19T11:30:00Z').toISOString();
      expect(calculateWaitMinutes(requested, pickupStarted)).toBe(90);
    });
  });

  describe('calculateTransitMinutes', () => {
    it('should calculate transit time correctly', () => {
      const transitStarted = new Date('2026-01-19T10:00:00Z').toISOString();
      const delivered = new Date('2026-01-19T10:20:00Z').toISOString();
      expect(calculateTransitMinutes(transitStarted, delivered)).toBe(20);
    });

    it('should handle longer transit times', () => {
      const transitStarted = new Date('2026-01-19T10:00:00Z').toISOString();
      const delivered = new Date('2026-01-19T10:45:00Z').toISOString();
      expect(calculateTransitMinutes(transitStarted, delivered)).toBe(45);
    });
  });

  describe('formatETA', () => {
    it('should format arriving now', () => {
      expect(formatETA(0)).toBe('Arriving now');
    });

    it('should format minutes only for short durations', () => {
      expect(formatETA(5)).toBe('5 min');
      expect(formatETA(30)).toBe('30 min');
      expect(formatETA(59)).toBe('59 min');
    });

    it('should format hours for exact hours', () => {
      expect(formatETA(60)).toBe('1h');
      expect(formatETA(120)).toBe('2h');
    });

    it('should format hours and minutes for mixed durations', () => {
      expect(formatETA(75)).toBe('1h 15m');
      expect(formatETA(150)).toBe('2h 30m');
    });
  });
});
