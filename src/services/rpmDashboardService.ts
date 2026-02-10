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
  RpmBillingEligibility,
  RpmTransmissionDay,
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

// ── CPT Billing Eligibility (99454 / 99457 / 99458) ─────────────────────────

/** Minimum transmission days required for CPT 99454 in a 30-day period */
const CPT_99454_REQUIRED_DAYS = 16;

/** Minimum clinical monitoring minutes for CPT 99457 */
const CPT_99457_REQUIRED_MINUTES = 20;

/** Additional minutes per unit for CPT 99458 (each additional 20 min) */
const CPT_99458_MINUTES_PER_UNIT = 20;

interface CheckInRow {
  timestamp: string;
}

interface WearableRow {
  recorded_at: string;
}

/**
 * Get distinct transmission days for a patient within a rolling period.
 *
 * Counts unique dates where the patient transmitted health data via
 * check-ins or wearable vital signs. Used for CPT 99454 eligibility.
 */
async function getTransmissionDays(
  patientId: string,
  periodDays: number = 30
): Promise<ServiceResult<RpmTransmissionDay[]>> {
  try {
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    // Query check-in timestamps
    const { data: checkInData, error: ciErr } = await supabase
      .from('check_ins')
      .select('timestamp')
      .eq('user_id', patientId)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: true });

    if (ciErr) return failure('DATABASE_ERROR', ciErr.message, ciErr);

    // Query wearable vital sign timestamps
    const { data: wearableData, error: wErr } = await supabase
      .from('wearable_vital_signs')
      .select('recorded_at')
      .eq('user_id', patientId)
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: true });

    if (wErr) return failure('DATABASE_ERROR', wErr.message, wErr);

    // Aggregate by distinct date
    const dateMap = new Map<string, { source: RpmTransmissionDay['source']; count: number }>();

    for (const row of (checkInData || []) as CheckInRow[]) {
      const dateStr = row.timestamp.split('T')[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.count += 1;
      } else {
        dateMap.set(dateStr, { source: 'check_in', count: 1 });
      }
    }

    for (const row of (wearableData || []) as WearableRow[]) {
      const dateStr = row.recorded_at.split('T')[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.count += 1;
        // If we already have check_in data, keep that source; otherwise set wearable
        if (existing.source !== 'check_in') {
          existing.source = 'wearable';
        }
      } else {
        dateMap.set(dateStr, { source: 'wearable', count: 1 });
      }
    }

    const transmissionDays: RpmTransmissionDay[] = Array.from(dateMap.entries()).map(
      ([date, info]) => ({
        date,
        has_transmission: true,
        source: info.source,
        vital_count: info.count,
      })
    );

    return success(transmissionDays);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_TRANSMISSION_DAYS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId, periodDays }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch transmission days');
  }
}

/**
 * Check CPT billing eligibility for a single RPM enrollment.
 *
 * - CPT 99454: Patient transmitted data on >= 16 of last 30 days
 * - CPT 99457: >= 20 minutes of clinical monitoring time
 * - CPT 99458: Each additional 20-minute block beyond 99457
 */
async function getBillingEligibility(
  enrollmentId: string
): Promise<ServiceResult<RpmBillingEligibility>> {
  try {
    // Fetch enrollment details
    const { data: enrollment, error: enrollErr } = await supabase
      .from('rpm_enrollments')
      .select('id, patient_id, total_monitoring_minutes, monitoring_start_date')
      .eq('id', enrollmentId)
      .single();

    if (enrollErr) return failure('DATABASE_ERROR', enrollErr.message, enrollErr);
    if (!enrollment) return failure('NOT_FOUND', 'Enrollment not found');

    const typedEnrollment = enrollment as {
      id: string;
      patient_id: string;
      total_monitoring_minutes: number;
      monitoring_start_date: string | null;
    };

    // Calculate 30-day period
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get transmission days
    const transmissionResult = await getTransmissionDays(typedEnrollment.patient_id, 30);
    if (!transmissionResult.success) {
      return failure(
        transmissionResult.error.code,
        transmissionResult.error.message
      );
    }

    const transmissionDays = transmissionResult.data;
    const transmissionCount = transmissionDays.length;
    const monitoringMinutes = typedEnrollment.total_monitoring_minutes || 0;

    // CPT 99454: >= 16 transmission days in 30-day period
    const isEligible99454 = transmissionCount >= CPT_99454_REQUIRED_DAYS;

    // CPT 99457: >= 20 minutes of clinical monitoring
    const isEligible99457 = monitoringMinutes >= CPT_99457_REQUIRED_MINUTES;

    // CPT 99458: each additional 20-minute block after the initial 20
    const additionalMinutes = Math.max(0, monitoringMinutes - CPT_99457_REQUIRED_MINUTES);
    const additional20minUnits = Math.floor(additionalMinutes / CPT_99458_MINUTES_PER_UNIT);
    const isEligible99458 = additional20minUnits > 0;

    const eligibility: RpmBillingEligibility = {
      enrollment_id: typedEnrollment.id,
      patient_id: typedEnrollment.patient_id,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      transmission_days: transmissionCount,
      required_days: CPT_99454_REQUIRED_DAYS,
      is_eligible_99454: isEligible99454,
      is_eligible_99457: isEligible99457,
      is_eligible_99458: isEligible99458,
      monitoring_minutes: monitoringMinutes,
      additional_20min_units: additional20minUnits,
      transmission_dates: transmissionDays.map((d) => d.date),
    };

    await auditLogger.info('RPM_BILLING_ELIGIBILITY_CHECKED', {
      enrollmentId,
      patientId: typedEnrollment.patient_id,
      transmissionDays: transmissionCount,
      isEligible99454,
      isEligible99457,
      isEligible99458,
    });

    return success(eligibility);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_BILLING_ELIGIBILITY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { enrollmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to check billing eligibility');
  }
}

interface ActiveEnrollmentRow {
  id: string;
}

/**
 * Get billing eligibility for all active RPM enrollments.
 *
 * Useful for monthly billing review dashboards.
 */
async function getBulkBillingEligibility(): Promise<ServiceResult<RpmBillingEligibility[]>> {
  try {
    const { data: enrollments, error: fetchErr } = await supabase
      .from('rpm_enrollments')
      .select('id')
      .eq('status', 'active');

    if (fetchErr) return failure('DATABASE_ERROR', fetchErr.message, fetchErr);

    const results: RpmBillingEligibility[] = [];
    for (const row of (enrollments || []) as ActiveEnrollmentRow[]) {
      const result = await getBillingEligibility(row.id);
      if (result.success) {
        results.push(result.data);
      }
      // Skip enrollments that fail (e.g., missing patient data) rather than
      // failing the entire batch — log already happened in getBillingEligibility
    }

    await auditLogger.info('RPM_BULK_BILLING_CHECK_COMPLETE', {
      totalEnrollments: (enrollments || []).length,
      eligibleCount: results.filter((r) => r.is_eligible_99454).length,
    });

    return success(results);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_BULK_BILLING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return failure('UNKNOWN_ERROR', 'Failed to check bulk billing eligibility');
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
  getTransmissionDays,
  getBillingEligibility,
  getBulkBillingEligibility,
};
