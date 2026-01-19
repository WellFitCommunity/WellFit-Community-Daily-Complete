/**
 * Tests for Transfer Center Service
 *
 * Purpose: Inter-facility transfer coordination and network capacity
 * Tests: Service exports, type definitions, helper functions
 */

import { describe, it, expect } from 'vitest';
import { TransferCenterService } from '../transferCenterService';
import {
  getTransferStatusLabel,
  getTransferStatusColor,
  getUrgencyLabel,
  getUrgencyColor,
  getTransferTypeLabel,
  getTransportModeLabel,
  canCancelTransfer,
  canApproveTransfer,
  getUrgencySortOrder,
} from '../../types/transferCenter';

describe('TransferCenterService', () => {
  describe('Module Exports', () => {
    it('should export TransferCenterService object', () => {
      expect(TransferCenterService).toBeDefined();
      expect(typeof TransferCenterService).toBe('object');
    });

    it('should export transfer request methods', () => {
      expect(typeof TransferCenterService.createTransferRequest).toBe('function');
      expect(typeof TransferCenterService.getActiveTransfers).toBe('function');
      expect(typeof TransferCenterService.getTransfer).toBe('function');
      expect(typeof TransferCenterService.getPendingTransfers).toBe('function');
      expect(typeof TransferCenterService.startReview).toBe('function');
      expect(typeof TransferCenterService.approveTransfer).toBe('function');
      expect(typeof TransferCenterService.denyTransfer).toBe('function');
      expect(typeof TransferCenterService.scheduleTransfer).toBe('function');
      expect(typeof TransferCenterService.startTransfer).toBe('function');
      expect(typeof TransferCenterService.markArrived).toBe('function');
      expect(typeof TransferCenterService.completeTransfer).toBe('function');
      expect(typeof TransferCenterService.cancelTransfer).toBe('function');
    });

    it('should export facility capacity methods', () => {
      expect(typeof TransferCenterService.getFacilityCapacity).toBe('function');
      expect(typeof TransferCenterService.updateFacilityCapacity).toBe('function');
    });

    it('should export metrics methods', () => {
      expect(typeof TransferCenterService.getMetrics).toBe('function');
    });

    it('should export notes methods', () => {
      expect(typeof TransferCenterService.updateNotes).toBe('function');
    });
  });
});

describe('Transfer Center Type Helpers', () => {
  describe('getTransferStatusLabel', () => {
    it('should return correct labels for all statuses', () => {
      expect(getTransferStatusLabel('pending')).toBe('Pending Review');
      expect(getTransferStatusLabel('reviewing')).toBe('Under Review');
      expect(getTransferStatusLabel('approved')).toBe('Approved');
      expect(getTransferStatusLabel('denied')).toBe('Denied');
      expect(getTransferStatusLabel('scheduled')).toBe('Scheduled');
      expect(getTransferStatusLabel('in_transit')).toBe('In Transit');
      expect(getTransferStatusLabel('arrived')).toBe('Arrived');
      expect(getTransferStatusLabel('completed')).toBe('Completed');
      expect(getTransferStatusLabel('cancelled')).toBe('Cancelled');
    });
  });

  describe('getTransferStatusColor', () => {
    it('should return color classes for all statuses', () => {
      expect(getTransferStatusColor('pending')).toContain('yellow');
      expect(getTransferStatusColor('reviewing')).toContain('blue');
      expect(getTransferStatusColor('approved')).toContain('green');
      expect(getTransferStatusColor('denied')).toContain('red');
      expect(getTransferStatusColor('scheduled')).toContain('indigo');
      expect(getTransferStatusColor('in_transit')).toContain('purple');
      expect(getTransferStatusColor('arrived')).toContain('teal');
      expect(getTransferStatusColor('completed')).toContain('gray');
      expect(getTransferStatusColor('cancelled')).toContain('gray');
    });
  });

  describe('getUrgencyLabel', () => {
    it('should return correct labels for all urgency levels', () => {
      expect(getUrgencyLabel('routine')).toBe('Routine');
      expect(getUrgencyLabel('urgent')).toBe('Urgent');
      expect(getUrgencyLabel('emergent')).toBe('Emergent');
      expect(getUrgencyLabel('stat')).toBe('STAT');
    });
  });

  describe('getUrgencyColor', () => {
    it('should return color classes for all urgency levels', () => {
      expect(getUrgencyColor('routine')).toContain('gray');
      expect(getUrgencyColor('urgent')).toContain('yellow');
      expect(getUrgencyColor('emergent')).toContain('orange');
      expect(getUrgencyColor('stat')).toContain('red');
    });
  });

  describe('getTransferTypeLabel', () => {
    it('should return correct labels for all transfer types', () => {
      expect(getTransferTypeLabel('step_up')).toBe('Step Up');
      expect(getTransferTypeLabel('step_down')).toBe('Step Down');
      expect(getTransferTypeLabel('lateral')).toBe('Lateral Transfer');
      expect(getTransferTypeLabel('specialty')).toBe('Specialty Service');
      expect(getTransferTypeLabel('repatriation')).toBe('Repatriation');
    });
  });

  describe('getTransportModeLabel', () => {
    it('should return correct labels for all transport modes', () => {
      expect(getTransportModeLabel('ground_ambulance')).toBe('Ground Ambulance');
      expect(getTransportModeLabel('air_ambulance')).toBe('Air Ambulance');
      expect(getTransportModeLabel('critical_care_transport')).toBe('Critical Care Transport');
      expect(getTransportModeLabel('wheelchair_van')).toBe('Wheelchair Van');
      expect(getTransportModeLabel('private_vehicle')).toBe('Private Vehicle');
      expect(getTransportModeLabel('walk_in')).toBe('Walk-in');
    });
  });

  describe('canCancelTransfer', () => {
    it('should return true for cancellable statuses', () => {
      expect(canCancelTransfer('pending')).toBe(true);
      expect(canCancelTransfer('reviewing')).toBe(true);
      expect(canCancelTransfer('approved')).toBe(true);
      expect(canCancelTransfer('scheduled')).toBe(true);
    });

    it('should return false for non-cancellable statuses', () => {
      expect(canCancelTransfer('in_transit')).toBe(false);
      expect(canCancelTransfer('arrived')).toBe(false);
      expect(canCancelTransfer('completed')).toBe(false);
      expect(canCancelTransfer('cancelled')).toBe(false);
      expect(canCancelTransfer('denied')).toBe(false);
    });
  });

  describe('canApproveTransfer', () => {
    it('should return true for approvable statuses', () => {
      expect(canApproveTransfer('pending')).toBe(true);
      expect(canApproveTransfer('reviewing')).toBe(true);
    });

    it('should return false for non-approvable statuses', () => {
      expect(canApproveTransfer('approved')).toBe(false);
      expect(canApproveTransfer('denied')).toBe(false);
      expect(canApproveTransfer('scheduled')).toBe(false);
      expect(canApproveTransfer('in_transit')).toBe(false);
      expect(canApproveTransfer('completed')).toBe(false);
      expect(canApproveTransfer('cancelled')).toBe(false);
    });
  });

  describe('getUrgencySortOrder', () => {
    it('should return correct sort order (higher = more urgent)', () => {
      expect(getUrgencySortOrder('stat')).toBe(4);
      expect(getUrgencySortOrder('emergent')).toBe(3);
      expect(getUrgencySortOrder('urgent')).toBe(2);
      expect(getUrgencySortOrder('routine')).toBe(1);
    });

    it('should sort urgencies correctly', () => {
      const urgencies = ['routine', 'emergent', 'stat', 'urgent'] as const;
      const sorted = [...urgencies].sort(
        (a, b) => getUrgencySortOrder(b) - getUrgencySortOrder(a)
      );
      expect(sorted).toEqual(['stat', 'emergent', 'urgent', 'routine']);
    });
  });
});
