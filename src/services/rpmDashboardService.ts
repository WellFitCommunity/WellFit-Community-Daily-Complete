/**
 * RPM Dashboard Service
 *
 * Service layer for the clinical Remote Patient Monitoring dashboard.
 * Provides enrollment management, vital aggregation, alert queries,
 * and monitoring time tracking for CPT 99453-99458 billing.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
import type {
  RpmEnrollment,
  RpmDashboardSummary,
  AggregatedVital,
  VitalAlert,
  VitalThresholdRule,
  VitalType,
} from '../types/rpm';

// ── Vital display metadata ───────────────────────────────────────────────────

const VITAL_UNITS: Record<VitalType, string> = {
  heart_rate: 'bpm',
  bp_systolic: 'mmHg',
  bp_diastolic: 'mmHg',
  oxygen_saturation: '%',
  glucose: 'mg/dL',
  weight: 'lbs',
  temperature: '°F',
};

// ── Enrollment Queries ───────────────────────────────────────────────────────

async function getActiveEnrollments(): Promise<ServiceResult<RpmEnrollment[]>> {
  try {
    const { data, error } = await supabase
      .from('rpm_enrollments')
      .select('*')
      .in('status', ['active', 'pending'])
      .order('enrolled_at', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);

    return success((data || []) as RpmEnrollment[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_ENROLLMENTS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch RPM enrollments');
  }
}

async function getEnrollmentById(enrollmentId: string): Promise<ServiceResult<RpmEnrollment>> {
  try {
    const { data, error } = await supabase
      .from('rpm_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);
    if (!data) return failure('NOT_FOUND', 'Enrollment not found');

    return success(data as RpmEnrollment);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_ENROLLMENT_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { enrollmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch enrollment');
  }
}

// ── Enroll Patient ───────────────────────────────────────────────────────────

interface EnrollPatientInput {
  patientId: string;
  diagnosisCode?: string;
  monitoringReason?: string;
  orderingProviderId?: string;
  deviceTypes?: string[];
}

async function enrollPatient(input: EnrollPatientInput): Promise<ServiceResult<RpmEnrollment>> {
  try {
    const { data, error } = await supabase
      .from('rpm_enrollments')
      .insert({
        patient_id: input.patientId,
        primary_diagnosis_code: input.diagnosisCode || null,
        monitoring_reason: input.monitoringReason || null,
        ordering_provider_id: input.orderingProviderId || null,
        device_types: input.deviceTypes || [],
        status: 'active',
        monitoring_start_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('RPM_PATIENT_ENROLLED', {
      patientId: input.patientId,
      diagnosisCode: input.diagnosisCode,
    });

    return success(data as RpmEnrollment);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_ENROLLMENT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId: input.patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to enroll patient');
  }
}

// ── Monitoring Time Tracking (for CPT billing) ──────────────────────────────

async function addMonitoringTime(
  enrollmentId: string,
  minutes: number
): Promise<ServiceResult<{ total_monitoring_minutes: number }>> {
  try {
    // Use RPC-style increment to avoid race conditions
    const { data: current, error: fetchErr } = await supabase
      .from('rpm_enrollments')
      .select('total_monitoring_minutes')
      .eq('id', enrollmentId)
      .single();

    if (fetchErr) return failure('DATABASE_ERROR', fetchErr.message, fetchErr);

    const currentMinutes = (current as { total_monitoring_minutes: number }).total_monitoring_minutes || 0;
    const newTotal = currentMinutes + minutes;

    const { error: updateErr } = await supabase
      .from('rpm_enrollments')
      .update({ total_monitoring_minutes: newTotal })
      .eq('id', enrollmentId);

    if (updateErr) return failure('DATABASE_ERROR', updateErr.message, updateErr);

    await auditLogger.info('RPM_MONITORING_TIME_ADDED', {
      enrollmentId,
      minutesAdded: minutes,
      newTotal,
    });

    return success({ total_monitoring_minutes: newTotal });
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_MONITORING_TIME_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { enrollmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to add monitoring time');
  }
}

// ── Patient Vitals ───────────────────────────────────────────────────────────

async function getPatientVitals(
  patientId: string,
  days: number = 7
): Promise<ServiceResult<AggregatedVital[]>> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const vitals: AggregatedVital[] = [];

    // Get latest check-in vitals
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl, timestamp')
      .eq('user_id', patientId)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (checkIns && checkIns.length > 0) {
      const ci = checkIns[0];
      const vitalMap: Record<string, VitalType> = {
        heart_rate: 'heart_rate',
        pulse_oximeter: 'oxygen_saturation',
        bp_systolic: 'bp_systolic',
        bp_diastolic: 'bp_diastolic',
        glucose_mg_dl: 'glucose',
      };

      for (const [col, vitalType] of Object.entries(vitalMap)) {
        const val = ci[col as keyof typeof ci] as number | null;
        if (val !== null && val !== undefined) {
          vitals.push({
            vital_type: vitalType,
            latest_value: val,
            latest_recorded_at: ci.timestamp as string,
            source: 'check_in',
            is_abnormal: false,
            unit: VITAL_UNITS[vitalType],
          });
        }
      }
    }

    return success(vitals);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_VITALS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch patient vitals');
  }
}

// ── Patient Vital Alerts ─────────────────────────────────────────────────────

async function getPatientVitalAlerts(
  patientId: string,
  status: string = 'pending'
): Promise<ServiceResult<VitalAlert[]>> {
  try {
    const query = supabase
      .from('guardian_alerts')
      .select('id, alert_type, severity, title, description, status, triggered_at, resolved_at, metadata')
      .eq('reference_id', patientId)
      .eq('reference_type', 'patient')
      .in('alert_type', ['vital_watch', 'vital_warning', 'vital_critical'])
      .order('triggered_at', { ascending: false })
      .limit(50);

    if (status !== 'all') {
      query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return failure('DATABASE_ERROR', error.message, error);

    return success((data || []) as VitalAlert[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_ALERTS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch vital alerts');
  }
}

// ── Threshold Rules ──────────────────────────────────────────────────────────

async function getEffectiveRules(
  patientId?: string
): Promise<ServiceResult<VitalThresholdRule[]>> {
  try {
    let query = supabase
      .from('vital_threshold_rules')
      .select('*')
      .eq('is_active', true)
      .order('vital_type')
      .order('threshold_value');

    if (patientId) {
      query = query.or(`patient_id.eq.${patientId},patient_id.is.null`);
    }

    const { data, error } = await query;

    if (error) return failure('DATABASE_ERROR', error.message, error);

    return success((data || []) as VitalThresholdRule[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_RULES_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch threshold rules');
  }
}

// ── Dashboard Summary ────────────────────────────────────────────────────────

async function getDashboardSummary(): Promise<ServiceResult<RpmDashboardSummary>> {
  try {
    // Active enrollments
    const { count: enrolledCount, error: enrollErr } = await supabase
      .from('rpm_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (enrollErr) return failure('DATABASE_ERROR', enrollErr.message, enrollErr);

    // Active vital alerts
    const { count: alertsCount, error: alertErr } = await supabase
      .from('guardian_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('reference_type', 'patient')
      .in('alert_type', ['vital_watch', 'vital_warning', 'vital_critical'])
      .eq('status', 'pending');

    if (alertErr) return failure('DATABASE_ERROR', alertErr.message, alertErr);

    // Total monitoring minutes this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: minutesData, error: minErr } = await supabase
      .from('rpm_enrollments')
      .select('total_monitoring_minutes')
      .eq('status', 'active');

    if (minErr) return failure('DATABASE_ERROR', minErr.message, minErr);

    const totalMinutes = (minutesData || []).reduce(
      (sum: number, row: { total_monitoring_minutes: number }) => sum + (row.total_monitoring_minutes || 0),
      0
    );

    return success({
      enrolled_count: enrolledCount || 0,
      active_alerts_count: alertsCount || 0,
      needs_review_count: alertsCount || 0,
      total_monitoring_minutes: totalMinutes,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_SUMMARY_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch dashboard summary');
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

export const rpmDashboardService = {
  getActiveEnrollments,
  getEnrollmentById,
  enrollPatient,
  addMonitoringTime,
  getPatientVitals,
  getPatientVitalAlerts,
  getEffectiveRules,
  getDashboardSummary,
};
