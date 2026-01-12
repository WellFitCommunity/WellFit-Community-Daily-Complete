/**
 * NoShowDetectionService Tests
 *
 * Tests for the appointment no-show detection and management service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoShowDetectionService } from '../noShowDetectionService';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        gt: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ count: 0, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      upsert: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NoShowDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNoShowPolicy', () => {
    it('should return default policy when no tenant-specific policy exists', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      const result = await NoShowDetectionService.getNoShowPolicy();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.gracePeriodMinutes).toBe(15);
      expect(result.data?.autoDetectEnabled).toBe(true);
      expect(result.data?.warningThreshold).toBe(2);
      expect(result.data?.restrictionThreshold).toBe(3);
    });

    it('should return tenant-specific policy when available', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            grace_period_minutes: 20,
            auto_detect_enabled: true,
            followup_enabled: true,
            followup_delay_hours: 48,
            followup_message_template: 'Custom message',
            warning_threshold: 3,
            restriction_threshold: 5,
            restriction_days: 60,
            notify_provider: true,
            notify_care_team: true,
            notify_patient: false,
          },
        ],
        error: null,
      } as never);

      const result = await NoShowDetectionService.getNoShowPolicy('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.gracePeriodMinutes).toBe(20);
      expect(result.data?.warningThreshold).toBe(3);
      expect(result.data?.restrictionThreshold).toBe(5);
      expect(result.data?.notifyCareTeam).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'ERROR' },
      } as never);

      const result = await NoShowDetectionService.getNoShowPolicy();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('detectExpiredAppointments', () => {
    it('should return empty array when no expired appointments', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      const result = await NoShowDetectionService.detectExpiredAppointments();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return expired appointments with correct mapping', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            appointment_id: 'apt-1',
            patient_id: 'patient-1',
            patient_name: 'John Doe',
            provider_id: 'provider-1',
            provider_name: 'Dr. Smith',
            appointment_time: '2026-01-12T10:00:00Z',
            duration_minutes: 30,
            grace_period_minutes: 15,
            minutes_overdue: 25,
            patient_no_show_count: 2,
            patient_phone: '+15551234567',
            patient_email: 'john@example.com',
            tenant_id: 'tenant-1',
          },
        ],
        error: null,
      } as never);

      const result = await NoShowDetectionService.detectExpiredAppointments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].appointmentId).toBe('apt-1');
      expect(result.data?.[0].patientName).toBe('John Doe');
      expect(result.data?.[0].minutesOverdue).toBe(25);
      expect(result.data?.[0].patientNoShowCount).toBe(2);
    });

    it('should respect batch size parameter', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      await NoShowDetectionService.detectExpiredAppointments(undefined, 50);

      expect(supabase.rpc).toHaveBeenCalledWith('detect_expired_appointments', {
        p_tenant_id: null,
        p_batch_size: 50,
      });
    });
  });

  describe('markAppointmentNoShow', () => {
    it('should successfully mark appointment as no-show', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          appointment_id: 'apt-1',
          patient_id: 'patient-1',
          new_no_show_count: 3,
          consecutive_no_shows: 2,
          is_restricted: false,
          should_notify_provider: true,
          should_notify_patient: true,
          should_notify_care_team: false,
          followup_enabled: true,
        },
        error: null,
      } as never);

      const result = await NoShowDetectionService.markAppointmentNoShow(
        'apt-1',
        'manual_provider',
        'Patient did not show up'
      );

      expect(result.success).toBe(true);
      expect(result.data?.newNoShowCount).toBe(3);
      expect(result.data?.consecutiveNoShows).toBe(2);
      expect(result.data?.shouldNotifyProvider).toBe(true);
    });

    it('should handle already marked appointments', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Appointment already marked as no-show',
        },
        error: null,
      } as never);

      const result = await NoShowDetectionService.markAppointmentNoShow('apt-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already marked');
    });

    it('should handle database errors', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection failed', code: 'ERROR' },
      } as never);

      const result = await NoShowDetectionService.markAppointmentNoShow('apt-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('getPatientNoShowStats', () => {
    it('should return null for patients with no history', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      const result = await NoShowDetectionService.getPatientNoShowStats('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should return patient statistics with correct mapping', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            patient_id: 'patient-1',
            total_appointments: 10,
            completed_appointments: 7,
            no_show_count: 3,
            cancelled_by_patient: 0,
            late_cancellations: 0,
            no_show_rate: '30.00',
            consecutive_no_shows: 1,
            last_no_show_date: '2026-01-10T10:00:00Z',
            last_completed_date: '2026-01-11T10:00:00Z',
            is_restricted: false,
            restriction_end_date: null,
            restriction_reason: null,
            risk_level: 'medium',
          },
        ],
        error: null,
      } as never);

      const result = await NoShowDetectionService.getPatientNoShowStats('patient-1');

      expect(result.success).toBe(true);
      expect(result.data?.totalAppointments).toBe(10);
      expect(result.data?.noShowCount).toBe(3);
      expect(result.data?.noShowRate).toBe(30);
      expect(result.data?.riskLevel).toBe('medium');
    });
  });

  describe('recordPatientAttendance', () => {
    it('should successfully record patient attendance', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          appointment_id: 'apt-1',
          patient_attended: true,
          joined_at: '2026-01-12T10:00:00Z',
        },
        error: null,
      } as never);

      const result = await NoShowDetectionService.recordPatientAttendance(
        'apt-1',
        new Date(),
        'daily-session-123'
      );

      expect(result.success).toBe(true);
    });

    it('should handle non-existent appointments', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Appointment not found',
        },
        error: null,
      } as never);

      const result = await NoShowDetectionService.recordPatientAttendance('invalid-apt');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('checkPatientRestriction', () => {
    it('should return clean status for unrestricted patients', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            is_restricted: false,
            restriction_end_date: null,
            restriction_reason: null,
            no_show_count: 1,
            warning_level: 'good',
          },
        ],
        error: null,
      } as never);

      const result = await NoShowDetectionService.checkPatientRestriction('patient-1');

      expect(result.success).toBe(true);
      expect(result.data?.isRestricted).toBe(false);
      expect(result.data?.warningLevel).toBe('good');
    });

    it('should return restriction details for restricted patients', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            is_restricted: true,
            restriction_end_date: '2026-02-12T00:00:00Z',
            restriction_reason: 'Exceeded no-show threshold',
            no_show_count: 5,
            warning_level: 'restricted',
          },
        ],
        error: null,
      } as never);

      const result = await NoShowDetectionService.checkPatientRestriction('patient-1');

      expect(result.success).toBe(true);
      expect(result.data?.isRestricted).toBe(true);
      expect(result.data?.restrictionReason).toBe('Exceeded no-show threshold');
      expect(result.data?.warningLevel).toBe('restricted');
    });

    it('should return default status for new patients', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      const result = await NoShowDetectionService.checkPatientRestriction('new-patient');

      expect(result.success).toBe(true);
      expect(result.data?.isRestricted).toBe(false);
      expect(result.data?.noShowCount).toBe(0);
      expect(result.data?.warningLevel).toBe('good');
    });
  });

  describe('getPatientNoShowHistory', () => {
    it('should return empty array for patients with no history', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await NoShowDetectionService.getPatientNoShowHistory('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return history entries with correct mapping', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    appointment_id: 'apt-1',
                    scheduled_time: '2026-01-10T10:00:00Z',
                    detected_at: '2026-01-10T10:45:00Z',
                    detection_method: 'automatic',
                    grace_period_minutes: 15,
                    notes: 'Auto-detected',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      } as never);

      const result = await NoShowDetectionService.getPatientNoShowHistory('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].appointmentId).toBe('apt-1');
      expect(result.data?.[0].detectionMethod).toBe('automatic');
    });
  });

  describe('liftPatientRestriction', () => {
    it('should successfully lift restriction', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      } as never);

      const result = await NoShowDetectionService.liftPatientRestriction(
        'patient-1',
        'tenant-1',
        'Admin override'
      );

      expect(result.success).toBe(true);
    });

    it('should handle database errors', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'Update failed', code: 'ERROR' },
            }),
          }),
        }),
      } as never);

      const result = await NoShowDetectionService.liftPatientRestriction('patient-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('Service exports', () => {
    it('should export all required methods', () => {
      expect(NoShowDetectionService.getNoShowPolicy).toBeDefined();
      expect(NoShowDetectionService.updateNoShowPolicy).toBeDefined();
      expect(NoShowDetectionService.detectExpiredAppointments).toBeDefined();
      expect(NoShowDetectionService.markAppointmentNoShow).toBeDefined();
      expect(NoShowDetectionService.getPatientNoShowStats).toBeDefined();
      expect(NoShowDetectionService.getPatientNoShowHistory).toBeDefined();
      expect(NoShowDetectionService.recordPatientAttendance).toBeDefined();
      expect(NoShowDetectionService.getAppointmentAttendance).toBeDefined();
      expect(NoShowDetectionService.checkPatientRestriction).toBeDefined();
      expect(NoShowDetectionService.liftPatientRestriction).toBeDefined();
      expect(NoShowDetectionService.getNoShowSummaryStats).toBeDefined();
    });
  });
});
