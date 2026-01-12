/**
 * Appointment Analytics Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppointmentAnalyticsService } from '../appointmentAnalyticsService';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
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

// Helper to create success response
function mockSuccess<T>(data: T) {
  return {
    data,
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  };
}

// Helper to create error response
function mockError(message: string, code = '500') {
  return {
    data: null,
    error: {
      message,
      code,
      details: '',
      hint: '',
      name: 'PostgrestError',
    },
    count: null,
    status: 500,
    statusText: 'Internal Server Error',
  };
}

describe('AppointmentAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAnalyticsSummary', () => {
    it('should return analytics summary successfully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockSummary = {
        totalAppointments: 100,
        completed: 80,
        noShows: 10,
        cancelled: 5,
        inProgress: 2,
        scheduled: 3,
        confirmed: 0,
        completionRate: 80.0,
        noShowRate: 10.0,
        cancellationRate: 5.0,
        avgAppointmentsPerDay: 3.3,
        avgDurationMinutes: 30,
        totalHoursCompleted: 40.0,
        daysInRange: 30,
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
      };

      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess(mockSummary));

      const result = await AppointmentAnalyticsService.getAnalyticsSummary('30d');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.totalAppointments).toBe(100);
      expect(result.data?.completionRate).toBe(80.0);
      expect(result.data?.noShowRate).toBe(10.0);
      expect(result.error).toBeNull();
    });

    it('should handle database errors', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockError('Database error'));

      const result = await AppointmentAnalyticsService.getAnalyticsSummary('30d');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
      expect(result.data).toBeNull();
    });

    it('should accept optional tenant and provider filters', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess({ totalAppointments: 50 }));

      await AppointmentAnalyticsService.getAnalyticsSummary('7d', 'tenant-1', 'provider-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_appointment_analytics_summary',
        expect.objectContaining({
          p_tenant_id: 'tenant-1',
          p_provider_id: 'provider-1',
        })
      );
    });
  });

  describe('getAppointmentTrends', () => {
    it('should return trend data successfully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockTrends = [
        {
          period_start: '2026-01-01',
          period_label: 'Jan 01',
          total_appointments: 10,
          completed: 8,
          no_shows: 1,
          cancelled: 1,
          completion_rate: 80.0,
          no_show_rate: 10.0,
        },
        {
          period_start: '2026-01-02',
          period_label: 'Jan 02',
          total_appointments: 12,
          completed: 10,
          no_shows: 1,
          cancelled: 1,
          completion_rate: 83.3,
          no_show_rate: 8.3,
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess(mockTrends));

      const result = await AppointmentAnalyticsService.getAppointmentTrends('7d', 'day');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].periodLabel).toBe('Jan 01');
      expect(result.data?.[0].totalAppointments).toBe(10);
      expect(result.error).toBeNull();
    });

    it('should support different granularities', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess([]));

      await AppointmentAnalyticsService.getAppointmentTrends('30d', 'week');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_appointment_trends',
        expect.objectContaining({
          p_granularity: 'week',
        })
      );
    });

    it('should handle empty results', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess([]));

      const result = await AppointmentAnalyticsService.getAppointmentTrends('7d', 'day');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('getProviderStats', () => {
    it('should return provider statistics successfully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockStats = [
        {
          provider_id: 'provider-1',
          provider_name: 'Dr. Smith',
          provider_email: 'dr.smith@example.com',
          total_appointments: 50,
          completed: 45,
          no_shows: 3,
          cancelled: 2,
          completion_rate: 90.0,
          no_show_rate: 6.0,
          total_hours: 22.5,
          avg_duration_minutes: 30,
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess(mockStats));

      const result = await AppointmentAnalyticsService.getProviderStats('30d');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].providerName).toBe('Dr. Smith');
      expect(result.data?.[0].completionRate).toBe(90.0);
      expect(result.error).toBeNull();
    });

    it('should handle database errors', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockError('Connection failed', '503'));

      const result = await AppointmentAnalyticsService.getProviderStats('30d');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
      expect(result.data).toBeNull();
    });
  });

  describe('getNoShowPatterns', () => {
    it('should return no-show patterns successfully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockPatterns = {
        byDayOfWeek: [
          { dayOfWeek: 0, dayName: 'Sunday', totalAppointments: 5, noShows: 1, noShowRate: 20.0 },
          { dayOfWeek: 1, dayName: 'Monday', totalAppointments: 20, noShows: 2, noShowRate: 10.0 },
        ],
        byHour: [
          { hour: 9, hourLabel: '09 AM', totalAppointments: 15, noShows: 1, noShowRate: 6.7 },
          { hour: 14, hourLabel: '02 PM', totalAppointments: 12, noShows: 2, noShowRate: 16.7 },
        ],
        highRiskPatients: [
          {
            patientId: 'patient-1',
            patientName: 'John Doe',
            totalAppointments: 10,
            noShowCount: 4,
            noShowRate: 40.0,
            isRestricted: true,
          },
        ],
      };

      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess(mockPatterns));

      const result = await AppointmentAnalyticsService.getNoShowPatterns('90d');

      expect(result.success).toBe(true);
      expect(result.data?.byDayOfWeek).toHaveLength(2);
      expect(result.data?.byHour).toHaveLength(2);
      expect(result.data?.highRiskPatients).toHaveLength(1);
      expect(result.data?.highRiskPatients[0].patientName).toBe('John Doe');
      expect(result.error).toBeNull();
    });

    it('should handle empty patterns', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(
        mockSuccess({
          byDayOfWeek: [],
          byHour: [],
          highRiskPatients: [],
        })
      );

      const result = await AppointmentAnalyticsService.getNoShowPatterns('90d');

      expect(result.success).toBe(true);
      expect(result.data?.byDayOfWeek).toEqual([]);
      expect(result.data?.highRiskPatients).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('getStatusBreakdown', () => {
    it('should return status breakdown successfully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockBreakdown = [
        { encounter_type: 'outpatient', status: 'completed', count: 50, percentage: 50.0 },
        { encounter_type: 'outpatient', status: 'no-show', count: 10, percentage: 10.0 },
        { encounter_type: 'urgent-care', status: 'completed', count: 30, percentage: 30.0 },
      ];

      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess(mockBreakdown));

      const result = await AppointmentAnalyticsService.getStatusBreakdown('30d');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0].encounterType).toBe('outpatient');
      expect(result.error).toBeNull();
    });
  });

  describe('getReschedulingAnalytics', () => {
    it('should return rescheduling analytics successfully', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockData = {
        totalReschedules: 25,
        byRole: [
          { role: 'patient', count: 15, percentage: 60.0 },
          { role: 'provider', count: 10, percentage: 40.0 },
        ],
        topReasons: [
          { reason: 'Schedule conflict', count: 10 },
          { reason: 'Feeling better', count: 5 },
        ],
        outcomes: [
          { status: 'completed', count: 18, percentage: 72.0 },
          { status: 'no-show', count: 4, percentage: 16.0 },
        ],
      };

      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess(mockData));

      const result = await AppointmentAnalyticsService.getReschedulingAnalytics('30d');

      expect(result.success).toBe(true);
      expect(result.data?.totalReschedules).toBe(25);
      expect(result.data?.byRole).toHaveLength(2);
      expect(result.data?.topReasons).toHaveLength(2);
      expect(result.data?.outcomes).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should handle empty rescheduling data', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(
        mockSuccess({
          totalReschedules: 0,
          byRole: [],
          topReasons: [],
          outcomes: [],
        })
      );

      const result = await AppointmentAnalyticsService.getReschedulingAnalytics('30d');

      expect(result.success).toBe(true);
      expect(result.data?.totalReschedules).toBe(0);
      expect(result.error).toBeNull();
    });
  });

  describe('Time Range Handling', () => {
    it('should handle 7d time range', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess({ totalAppointments: 10 }));

      await AppointmentAnalyticsService.getAnalyticsSummary('7d');

      expect(supabase.rpc).toHaveBeenCalled();
      const call = vi.mocked(supabase.rpc).mock.calls[0];
      const params = call[1] as { p_start_date: string; p_end_date: string };
      const startDate = new Date(params.p_start_date);
      const endDate = new Date(params.p_end_date);
      const daysDiff = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it('should handle 1y time range', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      vi.mocked(supabase.rpc).mockResolvedValue(mockSuccess({ totalAppointments: 100 }));

      await AppointmentAnalyticsService.getAnalyticsSummary('1y');

      expect(supabase.rpc).toHaveBeenCalled();
      const call = vi.mocked(supabase.rpc).mock.calls[0];
      const params = call[1] as { p_start_date: string; p_end_date: string };
      const startDate = new Date(params.p_start_date);
      const endDate = new Date(params.p_end_date);
      const daysDiff = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeCloseTo(365, 1);
    });
  });
});
