/**
 * HEDIS Dashboard Tab Tests
 *
 * Tests domain display, measure rendering, benchmarks, and empty state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../../services/qualityMeasures/hedis/hedisService', () => ({
  getHedisSummary: vi.fn(),
  getHedisMeasures: vi.fn(),
}));

import { HedisDashboardTab } from '../quality-measures/HedisDashboardTab';
import { getHedisSummary } from '../../../services/qualityMeasures/hedis/hedisService';

describe('HedisDashboardTab', () => {
  const mockSummary = {
    totalMeasures: 2,
    measuresWithData: 2,
    averagePerformance: 0.65,
    reportingYear: 2026,
    domains: [
      {
        domain: 'Effectiveness of Care',
        measureCount: 2,
        averagePerformance: 0.65,
        measures: [
          {
            measure: {
              id: 'm1', measure_id: 'CMS122v12', cms_id: 'CMS122',
              title: 'HbA1c Poor Control', hedis_measure_id: 'CDC',
              hedis_subdomain: 'Effectiveness of Care', is_inverse_measure: true,
              data_source: 'clinical', program_types: ['hedis'],
              version: 'v12', description: '', measure_type: 'process',
              measure_scoring: 'proportion', reporting_year: 2026,
              applicable_settings: [], clinical_focus: 'Diabetes', is_active: true,
              initial_population_description: '', denominator_description: '',
              numerator_description: '',
            },
            results: { measureId: 'CMS122v12', initialPopulationCount: 100, denominatorCount: 100, denominatorExclusionCount: 5, denominatorExceptionCount: 3, numeratorCount: 12, numeratorExclusionCount: 0, performanceRate: 0.13, patientCount: 100 },
            benchmark: 0.15,
            gap: 0.02,
          },
          {
            measure: {
              id: 'm2', measure_id: 'CMS165v12', cms_id: 'CMS165',
              title: 'Controlling High Blood Pressure', hedis_measure_id: 'CBP',
              hedis_subdomain: 'Effectiveness of Care', is_inverse_measure: false,
              data_source: 'clinical', program_types: ['hedis'],
              version: 'v12', description: '', measure_type: 'outcome',
              measure_scoring: 'proportion', reporting_year: 2026,
              applicable_settings: [], clinical_focus: 'Hypertension', is_active: true,
              initial_population_description: '', denominator_description: '',
              numerator_description: '',
            },
            results: { measureId: 'CMS165v12', initialPopulationCount: 200, denominatorCount: 200, denominatorExclusionCount: 10, denominatorExceptionCount: 5, numeratorCount: 160, numeratorExclusionCount: 0, performanceRate: 0.865, patientCount: 200 },
            benchmark: 0.82,
            gap: 0.045,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHedisSummary).mockResolvedValue({
      success: true,
      data: mockSummary,
      error: null,
    });
  });

  it('should display domain group header', async () => {
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('Effectiveness of Care')).toBeInTheDocument();
    });
  });

  it('should display measure titles within domains', async () => {
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('HbA1c Poor Control')).toBeInTheDocument();
      expect(screen.getByText('Controlling High Blood Pressure')).toBeInTheDocument();
    });
  });

  it('should display HEDIS measure IDs', async () => {
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('CDC')).toBeInTheDocument();
      expect(screen.getByText('CBP')).toBeInTheDocument();
    });
  });

  it('should display summary card counts', async () => {
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('HEDIS Measures')).toBeInTheDocument();
      expect(screen.getByText('With Data')).toBeInTheDocument();
      expect(screen.getByText('Avg Performance')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    vi.mocked(getHedisSummary).mockImplementation(() => new Promise(() => {}));
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    expect(screen.getByText('Loading HEDIS data...')).toBeInTheDocument();
  });

  it('should show empty state when no measures configured', async () => {
    vi.mocked(getHedisSummary).mockResolvedValue({
      success: true,
      data: { totalMeasures: 0, measuresWithData: 0, averagePerformance: null, domains: [], reportingYear: 2026 },
      error: null,
    });
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('No HEDIS measures configured')).toBeInTheDocument();
    });
  });

  it('should show error state on failure', async () => {
    vi.mocked(getHedisSummary).mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'DB connection lost' },
    });
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText(/DB connection lost|Failed to load HEDIS data/)).toBeInTheDocument();
    });
  });

  it('should display inverse measure indicator', async () => {
    render(<HedisDashboardTab tenantId="t-1" reportingPeriodStart={new Date('2026-01-01')} reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('(Lower is better)')).toBeInTheDocument();
    });
  });
});
