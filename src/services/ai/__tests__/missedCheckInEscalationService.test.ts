/**
 * Tests for Missed Check-In Escalation Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissedCheckInEscalationService } from '../missedCheckInEscalationService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MissedCheckInEscalationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('service methods', () => {
    it('should validate patient ID is required', async () => {
      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: '',
        triggerType: 'single_missed',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should handle empty overdue check-ins list', async () => {
      const result = await MissedCheckInEscalationService.processOverdueCheckIns(12);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty history when no check-ins exist', async () => {
      const result = await MissedCheckInEscalationService.getEscalationHistory('test-patient', 30);

      expect(result.success).toBe(true);
    });
  });
});
