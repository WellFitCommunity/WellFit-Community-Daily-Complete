/**
 * rpmReportService — assembles the per-senior RPM / vitals report (the "Generate" link)
 *
 * Purpose: Build one structured report per enrolled senior for the automated RPM
 *   report pipeline (BLE/RPM tracker Session E). Pure assembly of existing parts —
 *   no new data sources, no invented math:
 *     • weekly averages + out-of-range + outliers per vital  → vitalsSummaryService (Session C)
 *     • 16-day transmission count + 99454 eligibility + minutes → rpmDashboardService
 * Downstream: the rendered document (reuse `pdf-health-summary`), the weekly scheduler,
 *   and per-tenant delivery are the Tier-3 second half of Session E — this service only
 *   produces the report DATA (fully testable, no schema dependency).
 *
 * Reads run under the caller's session; RLS enforces tenant + clinician access
 * (governance §B4). Never throws — every function returns a ServiceResult.
 */

import { ServiceResult, success, failure } from './_base';
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import {
  getWeeklyVitalsSummary,
  type VitalKind,
  type SummaryWindow,
  type WeeklyBucket,
} from './vitalsSummaryService';
import { rpmDashboardService } from './rpmDashboardService';
import type { RpmEnrollment } from '../types/rpm';

/** The four BLE-scope vitals a report covers (matches vitalsSummaryService). */
const REPORT_VITALS: readonly VitalKind[] = [
  'blood_pressure',
  'blood_glucose',
  'oxygen_saturation',
  'weight',
] as const;

/** One vital's contribution to a report. */
export interface RpmReportVitalSection {
  vitalType: VitalKind;
  label: string;
  unit: string;
  /** One point per ISO week over the window. */
  weeklyAverages: WeeklyBucket[];
  totalReadings: number;
  outOfRangeCount: number;
  outlierCount: number;
}

/** A complete report for one enrolled senior over one period. */
export interface RpmReport {
  enrollmentId: string;
  patientId: string;
  tenantId: string;
  patientName?: string;
  window: SummaryWindow;
  /** 30-day billing period the transmission count is measured over (yyyy-mm-dd). */
  periodStart: string;
  periodEnd: string;
  vitals: RpmReportVitalSection[];
  /** Distinct days with a transmission in the 30-day period (the CPT 99454 count). */
  transmissionDays: number;
  /** Threshold for CPT 99454 (16). */
  requiredDays: number;
  isBillable99454: boolean;
  monitoringMinutes: number;
  /** True when the senior had zero readings across all vitals in the window. */
  isEmpty: boolean;
  generatedAt: string;
}

/**
 * Build the report for a single enrolled senior.
 *
 * `window` controls the weekly-average trend depth (default 1 month, aligned to the
 * 30-day billing period). Vital sections that fail to load are recorded and skipped
 * rather than failing the whole report — a report with 3 of 4 vitals is still useful.
 */
async function buildPatientReport(
  enrollment: Pick<RpmEnrollment, 'id' | 'patient_id' | 'tenant_id' | 'patient_name'>,
  window: SummaryWindow = '1m'
): Promise<ServiceResult<RpmReport>> {
  if (!enrollment?.id || !enrollment?.patient_id) {
    return failure('INVALID_INPUT', 'An enrollment with a patient id is required.');
  }

  try {
    // Per-vital weekly summaries (in parallel).
    const summaries = await Promise.all(
      REPORT_VITALS.map((vital) => getWeeklyVitalsSummary(enrollment.patient_id, vital, window))
    );

    const vitals: RpmReportVitalSection[] = [];
    summaries.forEach((result) => {
      if (!result.success) {
        // Skip the failed vital, keep the rest. (Already audited inside the summary service.)
        return;
      }
      const s = result.data;
      vitals.push({
        vitalType: s.vitalType,
        label: s.label,
        unit: s.unit,
        weeklyAverages: s.buckets,
        totalReadings: s.totalCount,
        outOfRangeCount: s.outOfRange.length,
        outlierCount: s.outliers.length,
      });
    });

    // Transmission count + billing eligibility (the 16-day / 99454 trail).
    const billing = await rpmDashboardService.getBillingEligibility(enrollment.id);
    if (!billing.success) {
      return failure(billing.error.code, billing.error.message);
    }

    const totalReadings = vitals.reduce((sum, v) => sum + v.totalReadings, 0);

    const report: RpmReport = {
      enrollmentId: enrollment.id,
      patientId: enrollment.patient_id,
      tenantId: enrollment.tenant_id,
      patientName: enrollment.patient_name,
      window,
      periodStart: billing.data.period_start,
      periodEnd: billing.data.period_end,
      vitals,
      transmissionDays: billing.data.transmission_days,
      requiredDays: billing.data.required_days,
      isBillable99454: billing.data.is_eligible_99454,
      monitoringMinutes: billing.data.monitoring_minutes,
      isEmpty: totalReadings === 0,
      generatedAt: new Date().toISOString(),
    };

    return success(report);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_REPORT_BUILD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { enrollmentId: enrollment.id }
    );
    return failure('OPERATION_FAILED', 'Unable to build the RPM report.', err);
  }
}

/**
 * Build a report for every active enrollment (the batch the scheduler will run).
 * A per-patient failure is recorded and skipped so one bad enrollment cannot sink
 * the whole run.
 */
async function buildActiveEnrollmentReports(
  window: SummaryWindow = '1m'
): Promise<ServiceResult<RpmReport[]>> {
  try {
    const enrollmentsResult = await rpmDashboardService.getActiveEnrollments();
    if (!enrollmentsResult.success) {
      return failure(enrollmentsResult.error.code, enrollmentsResult.error.message);
    }

    const active = enrollmentsResult.data.filter((e) => e.status === 'active');
    const reports: RpmReport[] = [];

    for (const enrollment of active) {
      const built = await buildPatientReport(enrollment, window);
      if (built.success) {
        reports.push(built.data);
      } else {
        await auditLogger.warn('RPM_REPORT_SKIPPED', {
          enrollmentId: enrollment.id,
          reason: built.error.code,
        });
      }
    }

    return success(reports);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_REPORT_BATCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { window }
    );
    return failure('OPERATION_FAILED', 'Unable to build RPM reports.', err);
  }
}

/** A persisted, sent RPM report row (from the rpm_reports table). */
export interface StoredRpmReport {
  id: string;
  patient_id: string;
  period_start: string;
  period_end: string;
  transmission_days: number;
  is_billable_99454: boolean;
  sent_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

/**
 * Record that the current user reviewed a sent report — the CPT 99457/99458
 * billing-credit stamp. Identity is enforced server-side (auth.uid()); the first
 * reviewer wins. Read access to the report is governed by RLS (tenant admin).
 */
async function logReportReview(
  reportId: string
): Promise<ServiceResult<{ reviewedBy: string | null; reviewedAt: string | null }>> {
  if (!reportId) {
    return failure('INVALID_INPUT', 'A report id is required.');
  }
  try {
    const { data, error } = await supabase.rpc('log_rpm_report_review', { p_report_id: reportId });
    if (error) {
      await auditLogger.error('RPM_REPORT_REVIEW_FAILED', new Error(error.message), { reportId });
      return failure('DATABASE_ERROR', 'Unable to record report review.', error);
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { reviewed_by: string | null; reviewed_at: string | null }
      | undefined;
    return success({ reviewedBy: row?.reviewed_by ?? null, reviewedAt: row?.reviewed_at ?? null });
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_REPORT_REVIEW_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { reportId }
    );
    return failure('OPERATION_FAILED', 'Unable to record report review.', err);
  }
}

/** List sent reports for a patient (tenant-admin RLS scopes visibility). */
async function listPatientReports(patientId: string): Promise<ServiceResult<StoredRpmReport[]>> {
  if (!patientId) {
    return failure('INVALID_INPUT', 'A patient id is required.');
  }
  try {
    const { data, error } = await supabase
      .from('rpm_reports')
      .select('id, patient_id, period_start, period_end, transmission_days, is_billable_99454, sent_at, reviewed_by, reviewed_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      return failure('DATABASE_ERROR', 'Unable to load reports.', error);
    }
    return success((data ?? []) as StoredRpmReport[]);
  } catch (err: unknown) {
    return failure('OPERATION_FAILED', 'Unable to load reports.', err);
  }
}

export const rpmReportService = {
  buildPatientReport,
  buildActiveEnrollmentReports,
  logReportReview,
  listPatientReports,
  REPORT_VITALS,
};
