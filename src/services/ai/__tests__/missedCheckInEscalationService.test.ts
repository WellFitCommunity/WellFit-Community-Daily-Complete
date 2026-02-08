/**
 * Tests for Missed Check-In Escalation Service
 *
 * Behavioral tests covering:
 * - Input validation (patientId required)
 * - Successful escalation with edge function response
 * - Edge function error handling
 * - Overdue check-in processing (empty + populated)
 * - Escalation history retrieval
 * - Manual escalation workflow
 * - Notification cascade (Day 1 fix: immediate notification)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissedCheckInEscalationService } from '../missedCheckInEscalationService';

// Access mocked supabase for per-test configuration
const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock audit logger
const mockAuditInfo = vi.fn();
const mockAuditWarn = vi.fn();
const mockAuditError = vi.fn();

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: (...args: unknown[]) => mockAuditInfo(...args),
    warn: (...args: unknown[]) => mockAuditWarn(...args),
    error: (...args: unknown[]) => mockAuditError(...args),
  },
}));

// Mock notification service
const mockNotifySend = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../notificationService', () => ({
  getNotificationService: () => ({
    send: (...args: unknown[]) => mockNotifySend(...args),
  }),
}));

// Helper to set up default supabase chain mocks
function setupDefaultFromMock() {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        gte: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
}

describe('MissedCheckInEscalationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultFromMock();
  });

  describe('analyzeAndEscalate', () => {
    it('should return VALIDATION_ERROR when patient ID is empty', async () => {
      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: '',
        triggerType: 'single_missed',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Patient ID');
      // Edge function should NOT be called
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should call edge function with correct parameters', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          escalation: {
            escalationLevel: 'low',
            notifyTenant: false,
            notifyCaregiver: false,
            notifyEmergencyContact: false,
            callForWelfareCheck: false,
            message: { subject: 'Test', body: 'Test body', urgency: 'routine' },
            reasoning: 'Low risk',
            recommendedActions: [],
            riskFactors: [],
            protectiveFactors: [],
          },
          context: { riskLevel: 'low', consecutiveMissed: 1, hasCaregiver: false },
          metadata: { processed_at: '2026-01-01', trigger_type: 'single_missed', response_time_ms: 100 },
        },
        error: null,
      });

      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: 'patient-123',
        checkInId: 'checkin-456',
        triggerType: 'single_missed',
        consecutiveMissedCount: 1,
      });

      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('ai-missed-checkin-escalation', {
        body: {
          patientId: 'patient-123',
          checkInId: 'checkin-456',
          triggerType: 'single_missed',
          consecutiveMissedCount: 1,
        },
      });
    });

    it('should return failure when edge function returns error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: 'patient-123',
        triggerType: 'single_missed',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_SERVICE_ERROR');
      expect(mockAuditError).toHaveBeenCalledWith(
        'MISSED_CHECKIN_ESCALATION_FAILED',
        expect.objectContaining({ message: 'Service unavailable' }),
        expect.objectContaining({ patientId: 'patient-123' })
      );
    });

    it('should send notifications when escalation requires caregiver notification', async () => {
      // Mock edge function returning escalation with notifyCaregiver=true
      mockInvoke.mockResolvedValue({
        data: {
          escalation: {
            escalationLevel: 'high',
            notifyTenant: true,
            notifyCaregiver: true,
            notifyEmergencyContact: false,
            callForWelfareCheck: false,
            message: { subject: 'Missed Check-In', body: 'Patient missed check-in', urgency: 'important' },
            reasoning: 'Two consecutive missed',
            recommendedActions: ['Call patient', 'Contact caregiver'],
            riskFactors: ['Lives alone'],
            protectiveFactors: [],
          },
          context: { riskLevel: 'high', consecutiveMissed: 2, hasCaregiver: true },
          metadata: { processed_at: '2026-01-01', trigger_type: 'consecutive_missed', response_time_ms: 150 },
        },
        error: null,
      });

      // Mock profile query with caregiver email
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                full_name: 'John Doe',
                first_name: 'John',
                last_name: 'Doe',
                caregiver_email: 'caregiver@example.com',
                emergency_contact_email: null,
              },
              error: null,
            }),
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: 'patient-123',
        triggerType: 'consecutive_missed',
        consecutiveMissedCount: 2,
      });

      expect(result.success).toBe(true);
      // Notification service should have been called (in-app + caregiver email)
      expect(mockNotifySend).toHaveBeenCalled();
      expect(mockAuditInfo).toHaveBeenCalledWith(
        'MISSED_CHECKIN_NOTIFICATIONS_SENT',
        expect.objectContaining({ escalationLevel: 'high' })
      );
    });

    it('should not fail escalation if notification sending throws', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          escalation: {
            escalationLevel: 'medium',
            notifyTenant: true,
            notifyCaregiver: true,
            notifyEmergencyContact: false,
            callForWelfareCheck: false,
            message: { subject: 'Alert', body: 'Alert body', urgency: 'important' },
            reasoning: 'Medium risk',
            recommendedActions: [],
            riskFactors: [],
            protectiveFactors: [],
          },
          context: { riskLevel: 'medium', consecutiveMissed: 1, hasCaregiver: true },
          metadata: { processed_at: '2026-01-01', trigger_type: 'single_missed', response_time_ms: 100 },
        },
        error: null,
      });

      // Make profile query succeed but notification send throw
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { full_name: 'Jane Smith', caregiver_email: 'cg@test.com', emergency_contact_email: null },
              error: null,
            }),
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockNotifySend.mockRejectedValueOnce(new Error('Notification service down'));

      // Escalation should STILL succeed even though notification failed
      const result = await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: 'patient-456',
        triggerType: 'single_missed',
      });

      expect(result.success).toBe(true);
      expect(mockAuditError).toHaveBeenCalledWith(
        'MISSED_CHECKIN_NOTIFICATION_FAILED',
        expect.any(Error),
        expect.objectContaining({ escalationLevel: 'medium' })
      );
    });

    it('should default consecutiveMissedCount to 1 when not provided', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          escalation: {
            escalationLevel: 'none',
            notifyTenant: false,
            notifyCaregiver: false,
            notifyEmergencyContact: false,
            callForWelfareCheck: false,
            message: { subject: '', body: '', urgency: 'none' },
            reasoning: 'No concern',
            recommendedActions: [],
            riskFactors: [],
            protectiveFactors: [],
          },
          context: { riskLevel: 'none', consecutiveMissed: 1, hasCaregiver: false },
          metadata: { processed_at: '2026-01-01', trigger_type: 'single_missed', response_time_ms: 50 },
        },
        error: null,
      });

      await MissedCheckInEscalationService.analyzeAndEscalate({
        patientId: 'patient-789',
        triggerType: 'single_missed',
        // consecutiveMissedCount intentionally omitted
      });

      expect(mockInvoke).toHaveBeenCalledWith('ai-missed-checkin-escalation', {
        body: expect.objectContaining({
          consecutiveMissedCount: 1,
        }),
      });
    });
  });

  describe('processOverdueCheckIns', () => {
    it('should return empty array when no overdue check-ins found', async () => {
      const result = await MissedCheckInEscalationService.processOverdueCheckIns(12);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return failure when database query fails', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB connection lost' } }),
            }),
          }),
        }),
      });

      const result = await MissedCheckInEscalationService.processOverdueCheckIns(12);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
      expect(result.error?.message).toContain('DB connection lost');
    });
  });

  describe('getEscalationHistory', () => {
    it('should return empty array when no check-ins exist for patient', async () => {
      const result = await MissedCheckInEscalationService.getEscalationHistory('test-patient', 30);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return failure on database error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Table not found' } }),
            }),
          }),
        }),
      });

      const result = await MissedCheckInEscalationService.getEscalationHistory('patient-123', 7);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('manualEscalation', () => {
    it('should call analyzeAndEscalate with scheduled_check trigger type', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          escalation: {
            escalationLevel: 'low',
            notifyTenant: false,
            notifyCaregiver: false,
            notifyEmergencyContact: false,
            callForWelfareCheck: false,
            message: { subject: '', body: '', urgency: 'routine' },
            reasoning: 'Manual check',
            recommendedActions: [],
            riskFactors: [],
            protectiveFactors: [],
          },
          context: { riskLevel: 'low', consecutiveMissed: 1, hasCaregiver: false },
          metadata: { processed_at: '2026-01-01', trigger_type: 'scheduled_check', response_time_ms: 80 },
        },
        error: null,
      });

      const result = await MissedCheckInEscalationService.manualEscalation(
        'patient-manual-123',
        'Care coordinator noticed unusual pattern'
      );

      expect(result.success).toBe(true);
      // Should invoke edge function with scheduled_check trigger type
      expect(mockInvoke).toHaveBeenCalledWith('ai-missed-checkin-escalation', {
        body: expect.objectContaining({
          triggerType: 'scheduled_check',
          consecutiveMissedCount: 1,
        }),
      });
      // Should log the manual escalation with the reason
      expect(mockAuditWarn).toHaveBeenCalledWith(
        'MANUAL_ESCALATION_TRIGGERED',
        expect.objectContaining({
          patientId: 'patient-manual-123',
          reason: 'Care coordinator noticed unusual pattern',
        })
      );
    });
  });
});
