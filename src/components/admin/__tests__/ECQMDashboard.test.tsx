/**
 * eCQM Dashboard Tests
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 * Tests for Electronic Clinical Quality Measures dashboard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the services
vi.mock('../../../services/qualityMeasures/ecqmCalculationService', () => ({
  getMeasureDefinitions: vi.fn(),
  getAggregateResults: vi.fn(),
  calculateMeasures: vi.fn(),
  getCalculationJobStatus: vi.fn(),
}));

vi.mock('../../../services/qualityMeasures/qrdaExportService', () => ({
  exportQRDAI: vi.fn(),
  exportQRDAIII: vi.fn(),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import ECQMDashboard from '../ECQMDashboard';
import {
  getMeasureDefinitions,
  getAggregateResults,
  calculateMeasures,
  getCalculationJobStatus,
} from '../../../services/qualityMeasures/ecqmCalculationService';
import { exportQRDAI, exportQRDAIII } from '../../../services/qualityMeasures/qrdaExportService';

describe('ECQMDashboard', () => {
  const mockMeasures = [
    {
      id: 'measure-1',
      measure_id: 'CMS122v12',
      cms_id: 'CMS122v12',
      version: '12',
      title: 'Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)',
      description: 'Percentage of patients with diabetes who had HbA1c > 9%',
      measure_type: 'process',
      measure_scoring: 'proportion',
      initial_population_description: 'Patients 18-75 with diabetes',
      denominator_description: 'Initial population with diabetes diagnosis',
      numerator_description: 'Patients with HbA1c > 9% or no HbA1c test',
      reporting_year: 2026,
      applicable_settings: ['ambulatory'],
      clinical_focus: 'Diabetes',
      is_active: true,
    },
    {
      id: 'measure-2',
      measure_id: 'CMS165v12',
      cms_id: 'CMS165v12',
      version: '12',
      title: 'Controlling High Blood Pressure',
      description: 'Percentage of patients with hypertension with adequate BP control',
      measure_type: 'outcome',
      measure_scoring: 'proportion',
      initial_population_description: 'Patients 18-85 with hypertension',
      denominator_description: 'Initial population with hypertension diagnosis',
      numerator_description: 'Patients with BP < 140/90',
      reporting_year: 2026,
      applicable_settings: ['ambulatory'],
      clinical_focus: 'Hypertension',
      is_active: true,
    },
  ];

  const mockAggregates = [
    {
      measureId: 'CMS122v12',
      initialPopulationCount: 150,
      denominatorCount: 150,
      denominatorExclusionCount: 10,
      denominatorExceptionCount: 5,
      numeratorCount: 20,
      numeratorExclusionCount: 0,
      performanceRate: 0.148,
      patientCount: 150,
    },
    {
      measureId: 'CMS165v12',
      initialPopulationCount: 200,
      denominatorCount: 200,
      denominatorExclusionCount: 15,
      denominatorExceptionCount: 5,
      numeratorCount: 160,
      numeratorExclusionCount: 0,
      performanceRate: 0.889,
      patientCount: 200,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(getMeasureDefinitions).mockResolvedValue({
      success: true,
      data: mockMeasures,
      error: null,
    });

    vi.mocked(getAggregateResults).mockResolvedValue({
      success: true,
      data: mockAggregates,
      error: null,
    });

    vi.mocked(calculateMeasures).mockResolvedValue({
      success: true,
      data: { jobId: 'job-123' },
      error: null,
    });

    vi.mocked(getCalculationJobStatus).mockResolvedValue({
      success: true,
      data: {
        id: 'job-123',
        tenantId: 'tenant-123',
        measureIds: ['CMS122v12', 'CMS165v12'],
        status: 'completed',
        progressPercentage: 100,
        patientsProcessed: 350,
        patientsTotal: 350,
      },
      error: null,
    });

    vi.mocked(exportQRDAI).mockResolvedValue({
      success: true,
      data: {
        exportId: 'export-1',
        xml: '<?xml version="1.0"?>',
        measureIds: ['CMS122v12'],
        exportType: 'QRDA_I',
        validationStatus: 'valid',
      },
      error: null,
    });

    vi.mocked(exportQRDAIII).mockResolvedValue({
      success: true,
      data: {
        exportId: 'export-2',
        xml: '<?xml version="1.0"?>',
        measureIds: ['CMS122v12', 'CMS165v12'],
        exportType: 'QRDA_III',
        patientCount: 350,
        validationStatus: 'valid',
      },
      error: null,
    });
  });

  it('should render dashboard title', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('eCQM Dashboard')).toBeInTheDocument();
    });
  });

  it('should load and display measures', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)')).toBeInTheDocument();
      expect(screen.getByText('Controlling High Blood Pressure')).toBeInTheDocument();
    });
  });

  it('should display CMS IDs', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('CMS122v12')).toBeInTheDocument();
      expect(screen.getByText('CMS165v12')).toBeInTheDocument();
    });
  });

  it('should display performance rates', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      // CMS122 is 14.8%, CMS165 is 88.9%
      expect(screen.getByText('14.8%')).toBeInTheDocument();
      expect(screen.getByText('88.9%')).toBeInTheDocument();
    });
  });

  it('should display summary statistics', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('Total Measures')).toBeInTheDocument();
      expect(screen.getByText('Avg Performance')).toBeInTheDocument();
      expect(screen.getByText('Patients Evaluated')).toBeInTheDocument();
      expect(screen.getByText('Meeting Goal')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    vi.mocked(getMeasureDefinitions).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ECQMDashboard tenantId="tenant-123" />);

    expect(screen.getByText('Loading eCQM Dashboard...')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    vi.mocked(getMeasureDefinitions).mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Database connection failed' },
    });

    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
    });
  });

  it('should have period selector', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('should have recalculate button', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recalculate/i })).toBeInTheDocument();
    });
  });

  it('should have QRDA export buttons', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Export QRDA III/i)).toBeInTheDocument();
      expect(screen.getByText(/Export QRDA I \(Patient/i)).toBeInTheDocument();
    });
  });

  it('should expand measure details on click', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)')).toBeInTheDocument();
    });

    // Click on the measure row
    const measureRow = screen.getByText('Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)').closest('tr');
    if (measureRow) {
      fireEvent.click(measureRow);
    }

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Population Criteria')).toBeInTheDocument();
      expect(screen.getByText('Results Breakdown')).toBeInTheDocument();
    });
  });

  it('should trigger calculation on recalculate click', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recalculate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Recalculate/i }));

    await waitFor(() => {
      expect(calculateMeasures).toHaveBeenCalled();
    });
  });

  it('should display performance legend', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('Performance Legend')).toBeInTheDocument();
      expect(screen.getByText(/Excellent \(≥90%\)/)).toBeInTheDocument();
      expect(screen.getByText(/Good \(75-89%\)/)).toBeInTheDocument();
      expect(screen.getByText(/Fair \(50-74%\)/)).toBeInTheDocument();
      expect(screen.getByText(/Needs Improvement \(25-49%\)/)).toBeInTheDocument();
      expect(screen.getByText(/Poor \(<25%\)/)).toBeInTheDocument();
    });
  });

  it('should show inverse measure indicator for CMS122', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      // CMS122 is an inverse measure (poor control - lower is better)
      expect(screen.getByText(/Lower is better/i)).toBeInTheDocument();
    });
  });

  it('should display no measures message when empty', async () => {
    vi.mocked(getMeasureDefinitions).mockResolvedValue({
      success: true,
      data: [],
      error: null,
    });

    vi.mocked(getAggregateResults).mockResolvedValue({
      success: true,
      data: [],
      error: null,
    });

    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('No measures configured')).toBeInTheDocument();
    });
  });

  it('should handle QRDA III export', async () => {
    // Mock URL APIs for blob download
    const originalCreateObjectURL = global.URL.createObjectURL;
    const originalRevokeObjectURL = global.URL.revokeObjectURL;
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Export QRDA III/i)).toBeInTheDocument();
    });

    const exportButton = screen.getByText(/Export QRDA III/i).closest('button');
    if (exportButton) fireEvent.click(exportButton);

    await waitFor(() => {
      expect(exportQRDAIII).toHaveBeenCalled();
    });

    // Restore mocks
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('should change reporting period when selector changes', async () => {
    render(<ECQMDashboard tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const selector = screen.getByRole('combobox');
    fireEvent.change(selector, { target: { value: '2025 Full Year' } });

    // Should trigger a re-fetch with new period
    await waitFor(() => {
      expect(getAggregateResults).toHaveBeenCalledTimes(2);
    });
  });
});
