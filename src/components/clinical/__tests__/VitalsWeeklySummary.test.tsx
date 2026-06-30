/**
 * VitalsWeeklySummary tests
 *
 * Behavioral coverage for the doctor weekly-average view:
 * - renders weekly averages + the vital label/unit after load
 * - out-of-range and outlier panels are ALWAYS visible (clinical safety)
 * - "View complete list" expander reveals the full reading history
 * - changing the window re-queries with the new window
 *
 * Tracker: docs/trackers/ble-vitals-enrollment-tracker.md (Session C)
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { VitalsSummary } from '../../../services/vitalsSummaryService';

const { mockGetSummary } = vi.hoisted(() => ({ mockGetSummary: vi.fn() }));

vi.mock('../../../services/vitalsSummaryService', () => ({
  vitalsSummaryService: {
    getWeeklyVitalsSummary: mockGetSummary,
    SUPPORTED_VITALS: [
      { kind: 'blood_pressure', label: 'Blood Pressure (systolic)' },
      { kind: 'blood_glucose', label: 'Blood Glucose' },
      { kind: 'oxygen_saturation', label: 'Oxygen Saturation' },
      { kind: 'weight', label: 'Weight' },
    ],
  },
  clinicalRangeFor: () => ({ low: 90, high: 140 }),
}));

import VitalsWeeklySummary from '../VitalsWeeklySummary';

function buildSummary(overrides: Partial<VitalsSummary> = {}): VitalsSummary {
  return {
    vitalType: 'blood_pressure',
    label: 'Blood Pressure (systolic)',
    unit: 'mmHg',
    window: '3m',
    buckets: [
      { weekStart: '2026-06-22', weekLabel: 'Jun 22', avg: 125, min: 118, max: 132, count: 3, outOfRangeCount: 0 },
      { weekStart: '2026-06-29', weekLabel: 'Jun 29', avg: 150, min: 150, max: 150, count: 1, outOfRangeCount: 1 },
    ],
    readings: [
      { measuredAt: '2026-06-22T08:00:00Z', value: 118, unit: 'mmHg', outOfRange: false, isOutlier: false },
      { measuredAt: '2026-06-29T08:00:00Z', value: 150, unit: 'mmHg', outOfRange: true, isOutlier: true },
    ],
    outOfRange: [
      { measuredAt: '2026-06-29T08:00:00Z', value: 150, unit: 'mmHg', outOfRange: true, isOutlier: true },
    ],
    outliers: [
      { measuredAt: '2026-06-29T08:00:00Z', value: 150, unit: 'mmHg', outOfRange: true, isOutlier: true },
    ],
    totalCount: 2,
    ...overrides,
  };
}

function ok(data: VitalsSummary) {
  return { success: true as const, data, error: null };
}

beforeEach(() => {
  mockGetSummary.mockReset();
  mockGetSummary.mockResolvedValue(ok(buildSummary()));
});

describe('VitalsWeeklySummary', () => {
  it('renders the weekly-average header and out-of-range reading after load', async () => {
    render(<VitalsWeeklySummary patientId="patient-1" />);

    expect(await screen.findByText('Weekly Vital Averages')).toBeInTheDocument();
    // out-of-range panel shows its count and the offending reading
    expect(screen.getByText('Out of Range (1)')).toBeInTheDocument();
    expect(screen.getAllByText(/150 mmHg/).length).toBeGreaterThan(0);
  });

  it('keeps the out-of-range and outlier panels visible without expanding anything', async () => {
    render(<VitalsWeeklySummary patientId="patient-1" />);
    await screen.findByText('Weekly Vital Averages');

    // Both safety panels render by default (never hidden behind the average)
    expect(screen.getByText('Out of Range (1)')).toBeInTheDocument();
    expect(screen.getByText('Outliers (1)')).toBeInTheDocument();
  });

  it('reveals the complete reading list only after clicking the expander', async () => {
    render(<VitalsWeeklySummary patientId="patient-1" />);
    await screen.findByText('Weekly Vital Averages');

    // The in-range 118 reading lives only in the full list, not the panels
    expect(screen.queryByText(/118 mmHg/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/View complete list \(2 readings\)/));

    expect(await screen.findByText(/118 mmHg/)).toBeInTheDocument();
  });

  it('re-queries with the selected window when the doctor changes it', async () => {
    render(<VitalsWeeklySummary patientId="patient-1" />);
    await screen.findByText('Weekly Vital Averages');

    fireEvent.click(screen.getByText('6 Months'));

    await waitFor(() => {
      expect(mockGetSummary).toHaveBeenCalledWith('patient-1', 'blood_pressure', '6m');
    });
  });

  it('shows an empty-state message when there are no readings', async () => {
    mockGetSummary.mockResolvedValue(
      ok(buildSummary({ buckets: [], readings: [], outOfRange: [], outliers: [], totalCount: 0 }))
    );
    render(<VitalsWeeklySummary patientId="patient-1" />);

    expect(await screen.findByText(/No .* readings in this window/)).toBeInTheDocument();
  });
});
