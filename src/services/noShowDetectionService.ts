/**
 * No-Show Detection Service
 *
 * Purpose: Detect and manage patient appointment no-shows
 * Used by: Provider dashboards, care coordination, automated cron jobs
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================
// Types
// =============================================

export interface NoShowPolicy {
  gracePeriodMinutes: number;
  autoDetectEnabled: boolean;
  followupEnabled: boolean;
  followupDelayHours: number;
  followupMessageTemplate: string;
  warningThreshold: number;
  restrictionThreshold: number;
  restrictionDays: number;
  notifyProvider: boolean;
  notifyCareTeam: boolean;
  notifyPatient: boolean;
}

export interface PatientNoShowStats {
  patientId: string;
  totalAppointments: number;
  completedAppointments: number;
  noShowCount: number;
  cancelledByPatient: number;
  lateCancellations: number;
  noShowRate: number;
  consecutiveNoShows: number;
  lastNoShowDate: string | null;
  lastCompletedDate: string | null;
  isRestricted: boolean;
  restrictionEndDate: string | null;
  restrictionReason: string | null;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface ExpiredAppointment {
  appointmentId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  appointmentTime: string;
  durationMinutes: number;
  gracePeriodMinutes: number;
  minutesOverdue: number;
  patientNoShowCount: number;
  patientPhone: string | null;
  patientEmail: string | null;
  tenantId: string | null;
}

export interface NoShowMarkResult {
  success: boolean;
  appointmentId: string;
  patientId: string;
  newNoShowCount: number;
  consecutiveNoShows: number;
  isRestricted: boolean;
  shouldNotifyProvider: boolean;
  shouldNotifyPatient: boolean;
  shouldNotifyCareTeam: boolean;
  followupEnabled: boolean;
}

export interface AttendanceRecord {
  appointmentId: string;
  patientId: string;
  patientJoinedAt: string | null;
  providerJoinedAt: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
  patientAttended: boolean;
  providerAttended: boolean;
  connectionQuality: string | null;
  noShowDetectedAt: string | null;
  autoDetected: boolean;
}

export interface RestrictionStatus {
  isRestricted: boolean;
  restrictionEndDate: string | null;
  restrictionReason: string | null;
  noShowCount: number;
  warningLevel: 'good' | 'warning' | 'critical' | 'restricted';
}

export type DetectionMethod = 'automatic' | 'manual_provider' | 'manual_admin';

// =============================================
// Service Methods
// =============================================

/**
 * Get the no-show policy for a tenant (or global default)
 */
async function getNoShowPolicy(
  tenantId?: string
): Promise<ServiceResult<NoShowPolicy>> {
  try {
    const { data, error } = await supabase.rpc('get_no_show_policy', {
      p_tenant_id: tenantId || null,
    });

    if (error) {
      await auditLogger.error('GET_NO_SHOW_POLICY_FAILED', error, { tenantId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data || data.length === 0) {
      // Return defaults
      return success({
        gracePeriodMinutes: 15,
        autoDetectEnabled: true,
        followupEnabled: true,
        followupDelayHours: 24,
        followupMessageTemplate:
          'We missed you at your appointment. Please call to reschedule.',
        warningThreshold: 2,
        restrictionThreshold: 3,
        restrictionDays: 30,
        notifyProvider: true,
        notifyCareTeam: false,
        notifyPatient: true,
      });
    }

    const policy = data[0];
    return success({
      gracePeriodMinutes: policy.grace_period_minutes,
      autoDetectEnabled: policy.auto_detect_enabled,
      followupEnabled: policy.followup_enabled,
      followupDelayHours: policy.followup_delay_hours,
      followupMessageTemplate: policy.followup_message_template,
      warningThreshold: policy.warning_threshold,
      restrictionThreshold: policy.restriction_threshold,
      restrictionDays: policy.restriction_days,
      notifyProvider: policy.notify_provider,
      notifyCareTeam: policy.notify_care_team,
      notifyPatient: policy.notify_patient,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_NO_SHOW_POLICY_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get no-show policy');
  }
}

/**
 * Update the no-show policy for a tenant
 */
async function updateNoShowPolicy(
  tenantId: string | null,
  updates: Partial<NoShowPolicy>
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('no_show_policies')
      .upsert({
        tenant_id: tenantId,
        grace_period_minutes: updates.gracePeriodMinutes,
        auto_detect_enabled: updates.autoDetectEnabled,
        followup_enabled: updates.followupEnabled,
        followup_delay_hours: updates.followupDelayHours,
        followup_message_template: updates.followupMessageTemplate,
        warning_threshold: updates.warningThreshold,
        restriction_threshold: updates.restrictionThreshold,
        restriction_days: updates.restrictionDays,
        notify_provider: updates.notifyProvider,
        notify_care_team: updates.notifyCareTeam,
        notify_patient: updates.notifyPatient,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (error) {
      await auditLogger.error('UPDATE_NO_SHOW_POLICY_FAILED', error, {
        tenantId,
        updates,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.info('NO_SHOW_POLICY_UPDATED', { tenantId, updates });
    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'UPDATE_NO_SHOW_POLICY_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to update no-show policy');
  }
}

/**
 * Detect appointments that have expired (past grace period without attendance)
 */
async function detectExpiredAppointments(
  tenantId?: string,
  batchSize: number = 100
): Promise<ServiceResult<ExpiredAppointment[]>> {
  try {
    const { data, error } = await supabase.rpc('detect_expired_appointments', {
      p_tenant_id: tenantId || null,
      p_batch_size: batchSize,
    });

    if (error) {
      await auditLogger.error('DETECT_EXPIRED_APPOINTMENTS_FAILED', error, {
        tenantId,
        batchSize,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    const appointments: ExpiredAppointment[] = (data || []).map(
      (apt: Record<string, unknown>) => ({
        appointmentId: apt.appointment_id as string,
        patientId: apt.patient_id as string,
        patientName: apt.patient_name as string,
        providerId: apt.provider_id as string,
        providerName: apt.provider_name as string,
        appointmentTime: apt.appointment_time as string,
        durationMinutes: apt.duration_minutes as number,
        gracePeriodMinutes: apt.grace_period_minutes as number,
        minutesOverdue: apt.minutes_overdue as number,
        patientNoShowCount: apt.patient_no_show_count as number,
        patientPhone: apt.patient_phone as string | null,
        patientEmail: apt.patient_email as string | null,
        tenantId: apt.tenant_id as string | null,
      })
    );

    await auditLogger.info('EXPIRED_APPOINTMENTS_DETECTED', {
      tenantId,
      count: appointments.length,
    });

    return success(appointments);
  } catch (err: unknown) {
    await auditLogger.error(
      'DETECT_EXPIRED_APPOINTMENTS_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to detect expired appointments');
  }
}

/**
 * Mark an appointment as no-show
 */
async function markAppointmentNoShow(
  appointmentId: string,
  detectionMethod: DetectionMethod = 'automatic',
  notes?: string,
  markedBy?: string
): Promise<ServiceResult<NoShowMarkResult>> {
  try {
    const { data, error } = await supabase.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
      p_detection_method: detectionMethod,
      p_notes: notes || null,
      p_marked_by: markedBy || null,
    });

    if (error) {
      await auditLogger.error('MARK_NO_SHOW_FAILED', error, {
        appointmentId,
        detectionMethod,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data?.success) {
      return failure('VALIDATION_ERROR', data?.error || 'Failed to mark no-show');
    }

    const result: NoShowMarkResult = {
      success: true,
      appointmentId: data.appointment_id,
      patientId: data.patient_id,
      newNoShowCount: data.new_no_show_count,
      consecutiveNoShows: data.consecutive_no_shows,
      isRestricted: data.is_restricted,
      shouldNotifyProvider: data.should_notify_provider,
      shouldNotifyPatient: data.should_notify_patient,
      shouldNotifyCareTeam: data.should_notify_care_team,
      followupEnabled: data.followup_enabled,
    };

    await auditLogger.warn('APPOINTMENT_MARKED_NO_SHOW', {
      appointmentId,
      patientId: result.patientId,
      detectionMethod,
      noShowCount: result.newNoShowCount,
      isRestricted: result.isRestricted,
    });

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'MARK_NO_SHOW_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to mark appointment as no-show');
  }
}

/**
 * Get patient no-show statistics
 */
async function getPatientNoShowStats(
  patientId: string,
  tenantId?: string
): Promise<ServiceResult<PatientNoShowStats | null>> {
  try {
    const { data, error } = await supabase.rpc('get_patient_no_show_stats', {
      p_patient_id: patientId,
      p_tenant_id: tenantId || null,
    });

    if (error) {
      await auditLogger.error('GET_PATIENT_NO_SHOW_STATS_FAILED', error, {
        patientId,
        tenantId,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data || data.length === 0) {
      return success(null);
    }

    const stats = data[0];
    return success({
      patientId: stats.patient_id,
      totalAppointments: stats.total_appointments,
      completedAppointments: stats.completed_appointments,
      noShowCount: stats.no_show_count,
      cancelledByPatient: stats.cancelled_by_patient,
      lateCancellations: stats.late_cancellations,
      noShowRate: parseFloat(stats.no_show_rate),
      consecutiveNoShows: stats.consecutive_no_shows,
      lastNoShowDate: stats.last_no_show_date,
      lastCompletedDate: stats.last_completed_date,
      isRestricted: stats.is_restricted,
      restrictionEndDate: stats.restriction_end_date,
      restrictionReason: stats.restriction_reason,
      riskLevel: stats.risk_level as 'none' | 'low' | 'medium' | 'high',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_PATIENT_NO_SHOW_STATS_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get patient no-show statistics');
  }
}

/**
 * Record patient attendance when they join a session
 */
async function recordPatientAttendance(
  appointmentId: string,
  joinedAt?: Date,
  dailySessionId?: string
): Promise<ServiceResult<void>> {
  try {
    const { data, error } = await supabase.rpc('record_patient_attendance', {
      p_appointment_id: appointmentId,
      p_joined_at: (joinedAt || new Date()).toISOString(),
      p_daily_session_id: dailySessionId || null,
    });

    if (error) {
      await auditLogger.error('RECORD_ATTENDANCE_FAILED', error, {
        appointmentId,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data?.success) {
      return failure('VALIDATION_ERROR', data?.error || 'Failed to record attendance');
    }

    await auditLogger.info('PATIENT_ATTENDANCE_RECORDED', {
      appointmentId,
      joinedAt: data.joined_at,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'RECORD_ATTENDANCE_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to record patient attendance');
  }
}

/**
 * Check if a patient is restricted from scheduling
 */
async function checkPatientRestriction(
  patientId: string,
  tenantId?: string
): Promise<ServiceResult<RestrictionStatus>> {
  try {
    const { data, error } = await supabase.rpc('check_patient_restriction', {
      p_patient_id: patientId,
      p_tenant_id: tenantId || null,
    });

    if (error) {
      await auditLogger.error('CHECK_RESTRICTION_FAILED', error, { patientId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data || data.length === 0) {
      return success({
        isRestricted: false,
        restrictionEndDate: null,
        restrictionReason: null,
        noShowCount: 0,
        warningLevel: 'good',
      });
    }

    const status = data[0];
    return success({
      isRestricted: status.is_restricted,
      restrictionEndDate: status.restriction_end_date,
      restrictionReason: status.restriction_reason,
      noShowCount: status.no_show_count,
      warningLevel: status.warning_level as
        | 'good'
        | 'warning'
        | 'critical'
        | 'restricted',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'CHECK_RESTRICTION_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to check patient restriction');
  }
}

/**
 * Get attendance record for an appointment
 */
async function getAppointmentAttendance(
  appointmentId: string
): Promise<ServiceResult<AttendanceRecord | null>> {
  try {
    const { data, error } = await supabase
      .from('appointment_attendance')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      await auditLogger.error('GET_ATTENDANCE_FAILED', error, { appointmentId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data) {
      return success(null);
    }

    return success({
      appointmentId: data.appointment_id,
      patientId: data.patient_id,
      patientJoinedAt: data.patient_joined_at,
      providerJoinedAt: data.provider_joined_at,
      actualStartTime: data.actual_start_time,
      actualEndTime: data.actual_end_time,
      actualDurationMinutes: data.actual_duration_minutes,
      patientAttended: data.patient_attended,
      providerAttended: data.provider_attended,
      connectionQuality: data.connection_quality,
      noShowDetectedAt: data.no_show_detected_at,
      autoDetected: data.auto_detected,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_ATTENDANCE_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { appointmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get attendance record');
  }
}

/**
 * Get no-show history for a patient
 */
async function getPatientNoShowHistory(
  patientId: string,
  limit: number = 10
): Promise<
  ServiceResult<
    Array<{
      appointmentId: string;
      scheduledTime: string;
      detectedAt: string;
      detectionMethod: DetectionMethod;
      gracePeriodMinutes: number;
      notes: string | null;
    }>
  >
> {
  try {
    const { data, error } = await supabase
      .from('no_show_log')
      .select('*')
      .eq('patient_id', patientId)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      await auditLogger.error('GET_NO_SHOW_HISTORY_FAILED', error, { patientId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    const history = (data || []).map((entry: Record<string, unknown>) => ({
      appointmentId: entry.appointment_id as string,
      scheduledTime: entry.scheduled_time as string,
      detectedAt: entry.detected_at as string,
      detectionMethod: entry.detection_method as DetectionMethod,
      gracePeriodMinutes: entry.grace_period_minutes as number,
      notes: entry.notes as string | null,
    }));

    return success(history);
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_NO_SHOW_HISTORY_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get no-show history');
  }
}

/**
 * Manually lift a patient restriction (admin action)
 */
async function liftPatientRestriction(
  patientId: string,
  tenantId?: string,
  reason?: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('patient_no_show_stats')
      .update({
        is_restricted: false,
        restriction_end_date: null,
        restriction_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId || null);

    if (error) {
      await auditLogger.error('LIFT_RESTRICTION_FAILED', error, { patientId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.warn('PATIENT_RESTRICTION_LIFTED', {
      patientId,
      tenantId,
      reason,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'LIFT_RESTRICTION_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to lift patient restriction');
  }
}

/**
 * Get summary statistics for no-shows (for admin dashboard)
 */
async function getNoShowSummaryStats(
  tenantId?: string,
  dateRange?: { start: Date; end: Date }
): Promise<
  ServiceResult<{
    totalNoShows: number;
    totalAppointments: number;
    noShowRate: number;
    restrictedPatients: number;
    topNoShowPatients: Array<{
      patientId: string;
      patientName: string;
      noShowCount: number;
    }>;
  }>
> {
  try {
    // Get total no-shows in date range
    let noShowQuery = supabase.from('no_show_log').select('*', { count: 'exact' });

    if (tenantId) {
      noShowQuery = noShowQuery.eq('tenant_id', tenantId);
    }
    if (dateRange) {
      noShowQuery = noShowQuery
        .gte('detected_at', dateRange.start.toISOString())
        .lte('detected_at', dateRange.end.toISOString());
    }

    const { count: noShowCount, error: noShowError } = await noShowQuery;

    if (noShowError) {
      throw noShowError;
    }

    // Get total appointments in date range
    let aptQuery = supabase
      .from('telehealth_appointments')
      .select('*', { count: 'exact' });

    if (tenantId) {
      aptQuery = aptQuery.eq('tenant_id', tenantId);
    }
    if (dateRange) {
      aptQuery = aptQuery
        .gte('appointment_time', dateRange.start.toISOString())
        .lte('appointment_time', dateRange.end.toISOString());
    }

    const { count: aptCount, error: aptError } = await aptQuery;

    if (aptError) {
      throw aptError;
    }

    // Get restricted patient count
    let restrictedQuery = supabase
      .from('patient_no_show_stats')
      .select('*', { count: 'exact' })
      .eq('is_restricted', true);

    if (tenantId) {
      restrictedQuery = restrictedQuery.eq('tenant_id', tenantId);
    }

    const { count: restrictedCount, error: restrictedError } = await restrictedQuery;

    if (restrictedError) {
      throw restrictedError;
    }

    // Get top no-show patients
    let topPatientsQuery = supabase
      .from('patient_no_show_stats')
      .select(
        `
        patient_id,
        no_show_count,
        profiles!patient_no_show_stats_patient_id_fkey(full_name)
      `
      )
      .gt('no_show_count', 0)
      .order('no_show_count', { ascending: false })
      .limit(10);

    if (tenantId) {
      topPatientsQuery = topPatientsQuery.eq('tenant_id', tenantId);
    }

    const { data: topPatients, error: topError } = await topPatientsQuery;

    if (topError) {
      throw topError;
    }

    const totalNoShows = noShowCount || 0;
    const totalAppointments = aptCount || 0;
    const noShowRate =
      totalAppointments > 0 ? (totalNoShows / totalAppointments) * 100 : 0;

    return success({
      totalNoShows,
      totalAppointments,
      noShowRate: Math.round(noShowRate * 100) / 100,
      restrictedPatients: restrictedCount || 0,
      topNoShowPatients: (topPatients || []).map(
        (p: Record<string, unknown>) => ({
          patientId: p.patient_id as string,
          patientName:
            Array.isArray(p.profiles) && p.profiles.length > 0
              ? ((p.profiles[0] as { full_name?: string })?.full_name || 'Unknown')
              : 'Unknown',
          noShowCount: p.no_show_count as number,
        })
      ),
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'GET_NO_SHOW_SUMMARY_EXCEPTION',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get no-show summary statistics');
  }
}

// =============================================
// Export Service
// =============================================

export const NoShowDetectionService = {
  // Policy management
  getNoShowPolicy,
  updateNoShowPolicy,

  // Detection
  detectExpiredAppointments,
  markAppointmentNoShow,

  // Patient stats
  getPatientNoShowStats,
  getPatientNoShowHistory,

  // Attendance tracking
  recordPatientAttendance,
  getAppointmentAttendance,

  // Restrictions
  checkPatientRestriction,
  liftPatientRestriction,

  // Analytics
  getNoShowSummaryStats,
};

export default NoShowDetectionService;
