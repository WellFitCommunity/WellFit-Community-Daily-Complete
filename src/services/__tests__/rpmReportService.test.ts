/**
 * rpmReportService Tests
 * Tier 2-3: verifies the report assembles weekly averages + out-of-range flags +
 * the 16-day transmission / 99454 billing trail, skips failed parts gracefully,
 * and flags empty (zero-reading) seniors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetWeeklyVitalsSummary = vi.fn();
const mockGetBillingEligibility = vi.fn();
const mockGetActiveEnrollments = vi.fn();

vi.mock('../vitalsSummaryService', () => ({
  getWeeklyVitalsSummary: (...args: unknown[]) => mockGetWeeklyVitalsSummary(...args),
}));

vi.mock('../rpmDashboardService', () => ({
  rpmDashboardService: {
    getBillingEligibility: (...args: unknown[]) => mockGetBillingEligibility(...args),
    getActiveEnrollments: (...args: unknown[]) => mockGetActiveEnrollments(...args),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { rpmReportService } from '../rpmReportService';

const enrollment = {
  id: 'enr-1',
  patient_id: 'pat-1',
  tenant_id: 'ten-1',
  patient_name: 'Test Senior Alpha',
  status: 'active' as const,
};

function summaryOk(vitalType: string, opts: { total: number; outOfRange: number; outliers: number }) {
  return {
    success: true as const,
    data: {
      vitalType,
      label: `${vitalType} label`,
      unit: 'u',
      window: '1m',
      buckets: [{ weekStart: '2026-06-22', weekLabel: 'Jun 22', avg: 120, min: 110, max: 130, count: opts.total, outOfRangeCount: opts.outOfRange }],
      readings: [],
      outOfRange: Array.from({ length: opts.outOfRange }, () => ({ measuredAt: '', value: 0, unit: 'u', outOfRange: true, isOutlier: false })),
      outliers: Array.from({ length: opts.outliers }, () => ({ measuredAt: '', value: 0, unit: 'u', outOfRange: false, isOutlier: true })),
      totalCount: opts.total,
    },
  };
}

const billingOk = {
  success: true as const,
  data: {
    enrollment_id: 'enr-1',
    patient_id: 'pat-1',
    period_start: '2026-06-04',
    period_end: '2026-07-04',
    transmission_days: 18,
    required_days: 16,
    is_eligible_99454: true,
    is_eligible_99457: true,
    is_eligible_99458: false,
    monitoring_minutes: 25,
    additional_20min_units: 0,
    transmission_dates: [],
  },
};

describe('rpmReportService.buildPatientReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWeeklyVitalsSummary.mockImplementation((_p: string, vital: string) =>
      Promise.resolve(summaryOk(vital, { total: 5, outOfRange: 1, outliers: 0 }))
    );
    mockGetBillingEligibility.mockResolvedValue(billingOk);
  });

  it('composes weekly averages, out-of-range counts, and the 99454 transmission trail', async () => {
    const result = await rpmReportService.buildPatientReport(enrollment);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const report = result.data;

    // one section per BLE vital
    expect(report.vitals).toHaveLength(4);
    expect(report.vitals[0].weeklyAverages).toHaveLength(1);
    expect(report.vitals[0].outOfRangeCount).toBe(1);

    // billing trail carried through
    expect(report.transmissionDays).toBe(18);
    expect(report.requiredDays).toBe(16);
    expect(report.isBillable99454).toBe(true);
    expect(report.monitoringMinutes).toBe(25);
    expect(report.isEmpty).toBe(false);
    expect(report.patientName).toBe('Test Senior Alpha');
  });

  it('skips a vital that fails to load but keeps the rest', async () => {
    mockGetWeeklyVitalsSummary.mockImplementation((_p: string, vital: string) => {
      if (vital === 'weight') {
        return Promise.resolve({ success: false, error: { code: 'DATABASE_ERROR', message: 'boom' } });
      }
      return Promise.resolve(summaryOk(vital, { total: 3, outOfRange: 0, outliers: 0 }));
    });

    const result = await rpmReportService.buildPatientReport(enrollment);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.vitals).toHaveLength(3);
    expect(result.data.vitals.some((v) => v.vitalType === 'weight')).toBe(false);
  });

  it('marks the report empty when the senior has zero readings across all vitals', async () => {
    mockGetWeeklyVitalsSummary.mockImplementation((_p: string, vital: string) =>
      Promise.resolve(summaryOk(vital, { total: 0, outOfRange: 0, outliers: 0 }))
    );

    const result = await rpmReportService.buildPatientReport(enrollment);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.isEmpty).toBe(true);
  });

  it('fails the report when the billing/transmission lookup fails', async () => {
    mockGetBillingEligibility.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'no enrollment' },
    });

    const result = await rpmReportService.buildPatientReport(enrollment);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('DATABASE_ERROR');
  });

  it('rejects an enrollment without a patient id', async () => {
    const result = await rpmReportService.buildPatientReport({
      id: 'enr-x',
      patient_id: '',
      tenant_id: 'ten-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('rpmReportService.buildActiveEnrollmentReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWeeklyVitalsSummary.mockImplementation((_p: string, vital: string) =>
      Promise.resolve(summaryOk(vital, { total: 2, outOfRange: 0, outliers: 0 }))
    );
    mockGetBillingEligibility.mockResolvedValue(billingOk);
  });

  it('builds one report per ACTIVE enrollment and skips non-active ones', async () => {
    mockGetActiveEnrollments.mockResolvedValue({
      success: true,
      data: [
        { ...enrollment, id: 'enr-1', status: 'active' },
        { ...enrollment, id: 'enr-2', status: 'paused' },
      ],
    });

    const result = await rpmReportService.buildActiveEnrollmentReports();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].enrollmentId).toBe('enr-1');
  });

  it('skips a senior whose report fails without sinking the batch', async () => {
    mockGetActiveEnrollments.mockResolvedValue({
      success: true,
      data: [
        { ...enrollment, id: 'enr-1', status: 'active' },
        { ...enrollment, id: 'enr-2', patient_id: 'pat-2', status: 'active' },
      ],
    });
    mockGetBillingEligibility.mockImplementation((id: string) =>
      id === 'enr-2'
        ? Promise.resolve({ success: false, error: { code: 'DATABASE_ERROR', message: 'boom' } })
        : Promise.resolve(billingOk)
    );

    const result = await rpmReportService.buildActiveEnrollmentReports();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].enrollmentId).toBe('enr-1');
  });
});
