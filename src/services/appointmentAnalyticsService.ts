/**
 * Appointment Analytics Service
 *
 * Purpose: Provide analytics and reporting for telehealth appointments
 * Used by: AppointmentAnalyticsDashboard, admin reporting
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsSummary {
  totalAppointments: number;
  completed: number;
  noShows: number;
  cancelled: number;
  inProgress: number;
  scheduled: number;
  confirmed: number;
  completionRate: number;
  noShowRate: number;
  cancellationRate: number;
  avgAppointmentsPerDay: number;
  avgDurationMinutes: number;
  totalHoursCompleted: number;
  daysInRange: number;
  startDate: string;
  endDate: string;
}

export interface TrendDataPoint {
  periodStart: string;
  periodLabel: string;
  totalAppointments: number;
  completed: number;
  noShows: number;
  cancelled: number;
  completionRate: number;
  noShowRate: number;
}

export interface ProviderStats {
  providerId: string;
  providerName: string;
  providerEmail: string;
  totalAppointments: number;
  completed: number;
  noShows: number;
  cancelled: number;
  completionRate: number;
  noShowRate: number;
  totalHours: number;
  avgDurationMinutes: number;
}

export interface DayOfWeekPattern {
  dayOfWeek: number;
  dayName: string;
  totalAppointments: number;
  noShows: number;
  noShowRate: number;
}

export interface HourPattern {
  hour: number;
  hourLabel: string;
  totalAppointments: number;
  noShows: number;
  noShowRate: number;
}

export interface HighRiskPatient {
  patientId: string;
  patientName: string;
  totalAppointments: number;
  noShowCount: number;
  noShowRate: number;
  isRestricted: boolean;
}

export interface NoShowPatterns {
  byDayOfWeek: DayOfWeekPattern[];
  byHour: HourPattern[];
  highRiskPatients: HighRiskPatient[];
}

export interface StatusBreakdown {
  encounterType: string;
  status: string;
  count: number;
  percentage: number;
}

export interface ReschedulingByRole {
  role: string;
  count: number;
  percentage: number;
}

export interface ReschedulingReason {
  reason: string;
  count: number;
}

export interface ReschedulingOutcome {
  status: string;
  count: number;
  percentage: number;
}

export interface ReschedulingAnalytics {
  totalReschedules: number;
  byRole: ReschedulingByRole[];
  topReasons: ReschedulingReason[];
  outcomes: ReschedulingOutcome[];
}

export type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';
export type Granularity = 'day' | 'week' | 'month';

// ============================================================================
// Helper Functions
// ============================================================================

function getDateRange(timeRange: TimeRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate: Date;

  switch (timeRange) {
    case '7d':
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      startDate = new Date('2020-01-01');
      break;
    default:
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get overall appointment analytics summary
 */
export async function getAnalyticsSummary(
  timeRange: TimeRange = '30d',
  tenantId?: string,
  providerId?: string
): Promise<ServiceResult<AnalyticsSummary>> {
  try {
    const { startDate, endDate } = getDateRange(timeRange);

    const { data, error } = await supabase.rpc('get_appointment_analytics_summary', {
      p_tenant_id: tenantId || null,
      p_provider_id: providerId || null,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      await auditLogger.error(
        'ANALYTICS_SUMMARY_FAILED',
        new Error(error.message),
        { timeRange, tenantId }
      );
      return failure('DATABASE_ERROR', error.message, error);
    }

    const result = data as Record<string, unknown>;
    return success({
      totalAppointments: (result.totalAppointments as number) || 0,
      completed: (result.completed as number) || 0,
      noShows: (result.noShows as number) || 0,
      cancelled: (result.cancelled as number) || 0,
      inProgress: (result.inProgress as number) || 0,
      scheduled: (result.scheduled as number) || 0,
      confirmed: (result.confirmed as number) || 0,
      completionRate: (result.completionRate as number) || 0,
      noShowRate: (result.noShowRate as number) || 0,
      cancellationRate: (result.cancellationRate as number) || 0,
      avgAppointmentsPerDay: (result.avgAppointmentsPerDay as number) || 0,
      avgDurationMinutes: (result.avgDurationMinutes as number) || 0,
      totalHoursCompleted: (result.totalHoursCompleted as number) || 0,
      daysInRange: (result.daysInRange as number) || 0,
      startDate: (result.startDate as string) || startDate.toISOString(),
      endDate: (result.endDate as string) || endDate.toISOString(),
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANALYTICS_SUMMARY_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { timeRange, tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get analytics summary');
  }
}

/**
 * Get appointment trends over time
 */
export async function getAppointmentTrends(
  timeRange: TimeRange = '30d',
  granularity: Granularity = 'day',
  tenantId?: string,
  providerId?: string
): Promise<ServiceResult<TrendDataPoint[]>> {
  try {
    const { startDate, endDate } = getDateRange(timeRange);

    const { data, error } = await supabase.rpc('get_appointment_trends', {
      p_tenant_id: tenantId || null,
      p_provider_id: providerId || null,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_granularity: granularity,
    });

    if (error) {
      await auditLogger.error(
        'ANALYTICS_TRENDS_FAILED',
        new Error(error.message),
        { timeRange, granularity, tenantId }
      );
      return failure('DATABASE_ERROR', error.message, error);
    }

    const trends = ((data as Record<string, unknown>[]) || []).map(
      (row: Record<string, unknown>) => ({
        periodStart: row.period_start as string,
        periodLabel: row.period_label as string,
        totalAppointments: (row.total_appointments as number) || 0,
        completed: (row.completed as number) || 0,
        noShows: (row.no_shows as number) || 0,
        cancelled: (row.cancelled as number) || 0,
        completionRate: (row.completion_rate as number) || 0,
        noShowRate: (row.no_show_rate as number) || 0,
      })
    );

    return success(trends);
  } catch (err: unknown) {
    await auditLogger.error(
      'ANALYTICS_TRENDS_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { timeRange, granularity, tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get appointment trends');
  }
}

/**
 * Get provider appointment statistics
 */
export async function getProviderStats(
  timeRange: TimeRange = '30d',
  tenantId?: string
): Promise<ServiceResult<ProviderStats[]>> {
  try {
    const { startDate, endDate } = getDateRange(timeRange);

    const { data, error } = await supabase.rpc('get_provider_appointment_stats', {
      p_tenant_id: tenantId || null,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      await auditLogger.error(
        'ANALYTICS_PROVIDER_STATS_FAILED',
        new Error(error.message),
        { timeRange, tenantId }
      );
      return failure('DATABASE_ERROR', error.message, error);
    }

    const stats = ((data as Record<string, unknown>[]) || []).map(
      (row: Record<string, unknown>) => ({
        providerId: row.provider_id as string,
        providerName: row.provider_name as string,
        providerEmail: row.provider_email as string,
        totalAppointments: (row.total_appointments as number) || 0,
        completed: (row.completed as number) || 0,
        noShows: (row.no_shows as number) || 0,
        cancelled: (row.cancelled as number) || 0,
        completionRate: (row.completion_rate as number) || 0,
        noShowRate: (row.no_show_rate as number) || 0,
        totalHours: (row.total_hours as number) || 0,
        avgDurationMinutes: (row.avg_duration_minutes as number) || 30,
      })
    );

    return success(stats);
  } catch (err: unknown) {
    await auditLogger.error(
      'ANALYTICS_PROVIDER_STATS_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { timeRange, tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get provider statistics');
  }
}

/**
 * Get no-show patterns analysis
 */
export async function getNoShowPatterns(
  timeRange: TimeRange = '90d',
  tenantId?: string
): Promise<ServiceResult<NoShowPatterns>> {
  try {
    const { startDate, endDate } = getDateRange(timeRange);

    const { data, error } = await supabase.rpc('get_no_show_patterns', {
      p_tenant_id: tenantId || null,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      await auditLogger.error(
        'ANALYTICS_NO_SHOW_PATTERNS_FAILED',
        new Error(error.message),
        { timeRange, tenantId }
      );
      return failure('DATABASE_ERROR', error.message, error);
    }

    const result = data as Record<string, unknown>;
    const byDayOfWeek = ((result.byDayOfWeek as Record<string, unknown>[]) || []).map(
      (d: Record<string, unknown>) => ({
        dayOfWeek: d.dayOfWeek as number,
        dayName: (d.dayName as string).trim(),
        totalAppointments: (d.totalAppointments as number) || 0,
        noShows: (d.noShows as number) || 0,
        noShowRate: (d.noShowRate as number) || 0,
      })
    );

    const byHour = ((result.byHour as Record<string, unknown>[]) || []).map(
      (h: Record<string, unknown>) => ({
        hour: h.hour as number,
        hourLabel: (h.hourLabel as string).trim(),
        totalAppointments: (h.totalAppointments as number) || 0,
        noShows: (h.noShows as number) || 0,
        noShowRate: (h.noShowRate as number) || 0,
      })
    );

    const highRiskPatients = ((result.highRiskPatients as Record<string, unknown>[]) || []).map(
      (p: Record<string, unknown>) => ({
        patientId: p.patientId as string,
        patientName: p.patientName as string,
        totalAppointments: (p.totalAppointments as number) || 0,
        noShowCount: (p.noShowCount as number) || 0,
        noShowRate: (p.noShowRate as number) || 0,
        isRestricted: (p.isRestricted as boolean) || false,
      })
    );

    return success({
      byDayOfWeek,
      byHour,
      highRiskPatients,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANALYTICS_NO_SHOW_PATTERNS_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { timeRange, tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get no-show patterns');
  }
}

/**
 * Get appointment status breakdown by encounter type
 */
export async function getStatusBreakdown(
  timeRange: TimeRange = '30d',
  tenantId?: string
): Promise<ServiceResult<StatusBreakdown[]>> {
  try {
    const { startDate, endDate } = getDateRange(timeRange);

    const { data, error } = await supabase.rpc('get_appointment_status_breakdown', {
      p_tenant_id: tenantId || null,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      await auditLogger.error(
        'ANALYTICS_STATUS_BREAKDOWN_FAILED',
        new Error(error.message),
        { timeRange, tenantId }
      );
      return failure('DATABASE_ERROR', error.message, error);
    }

    const breakdown = ((data as Record<string, unknown>[]) || []).map(
      (row: Record<string, unknown>) => ({
        encounterType: row.encounter_type as string,
        status: row.status as string,
        count: (row.count as number) || 0,
        percentage: (row.percentage as number) || 0,
      })
    );

    return success(breakdown);
  } catch (err: unknown) {
    await auditLogger.error(
      'ANALYTICS_STATUS_BREAKDOWN_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { timeRange, tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get status breakdown');
  }
}

/**
 * Get rescheduling analytics
 */
export async function getReschedulingAnalytics(
  timeRange: TimeRange = '30d',
  tenantId?: string
): Promise<ServiceResult<ReschedulingAnalytics>> {
  try {
    const { startDate, endDate } = getDateRange(timeRange);

    const { data, error } = await supabase.rpc('get_rescheduling_analytics', {
      p_tenant_id: tenantId || null,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      await auditLogger.error(
        'ANALYTICS_RESCHEDULING_FAILED',
        new Error(error.message),
        { timeRange, tenantId }
      );
      return failure('DATABASE_ERROR', error.message, error);
    }

    const result = data as Record<string, unknown>;
    return success({
      totalReschedules: (result.totalReschedules as number) || 0,
      byRole: ((result.byRole as Record<string, unknown>[]) || []).map(
        (r: Record<string, unknown>) => ({
          role: r.role as string,
          count: (r.count as number) || 0,
          percentage: (r.percentage as number) || 0,
        })
      ),
      topReasons: ((result.topReasons as Record<string, unknown>[]) || []).map(
        (r: Record<string, unknown>) => ({
          reason: r.reason as string,
          count: (r.count as number) || 0,
        })
      ),
      outcomes: ((result.outcomes as Record<string, unknown>[]) || []).map(
        (o: Record<string, unknown>) => ({
          status: o.status as string,
          count: (o.count as number) || 0,
          percentage: (o.percentage as number) || 0,
        })
      ),
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ANALYTICS_RESCHEDULING_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { timeRange, tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get rescheduling analytics');
  }
}

// ============================================================================
// Export Service Object
// ============================================================================

export const AppointmentAnalyticsService = {
  getAnalyticsSummary,
  getAppointmentTrends,
  getProviderStats,
  getNoShowPatterns,
  getStatusBreakdown,
  getReschedulingAnalytics,
};

export default AppointmentAnalyticsService;
