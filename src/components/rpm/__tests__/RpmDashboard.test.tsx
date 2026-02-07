/**
 * RpmDashboard Tests
 *
 * Tests meaningful behavior: summary display, enrollment list rendering,
 * patient selection navigation, and empty state handling.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../services/rpmDashboardService', () => ({
  rpmDashboardService: {
    getDashboardSummary: vi.fn(),
    getActiveEnrollments: vi.fn(),
    getPatientVitals: vi.fn(),
    getPatientVitalAlerts: vi.fn(),
    getEnrollmentById: vi.fn(),
    getEffectiveRules: vi.fn(),
    enrollPatient: vi.fn(),
    addMonitoringTime: vi.fn(),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('../../envision-atlus', () => ({
  EACard: ({ children }: { children: React.ReactNode }) => <div data-testid="ea-card">{children}</div>,
  EACardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="ea-card-header">{children}</div>,
  EACardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="ea-card-content">{children}</div>,
}));

vi.mock('../../devices/VitalTrendChart', () => ({
  default: ({ title }: { title: string }) => <div data-testid={`vital-chart-${title}`}>{title}</div>,
}));

import RpmDashboard from '../RpmDashboard';
import { rpmDashboardService } from '../../../services/rpmDashboardService';

const mockService = vi.mocked(rpmDashboardService);

describe('RpmDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockService.getDashboardSummary.mockResolvedValue({
      success: true,
      data: {
        enrolled_count: 5,
        active_alerts_count: 2,
        needs_review_count: 2,
        total_monitoring_minutes: 340,
      },
      error: null,
    });

    mockService.getActiveEnrollments.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'enroll-1',
          tenant_id: 'tenant-1',
          patient_id: 'patient-abc',
          status: 'active',
          enrolled_at: '2026-01-15T00:00:00Z',
          enrolled_by: null,
          primary_diagnosis_code: 'I10',
          monitoring_reason: 'Hypertension monitoring',
          ordering_provider_id: null,
          device_types: ['blood_pressure_cuff'],
          setup_completed_at: null,
          total_monitoring_minutes: 120,
          monitoring_start_date: '2026-01-15',
          monitoring_end_date: null,
          patient_name: 'Jane Smith',
        },
      ],
      error: null,
    });

    mockService.getPatientVitals.mockResolvedValue({
      success: true,
      data: [
        {
          vital_type: 'bp_systolic',
          latest_value: 145,
          latest_recorded_at: '2026-02-07T10:00:00Z',
          source: 'check_in',
          is_abnormal: true,
          unit: 'mmHg',
        },
      ],
      error: null,
    });
  });

  it('displays dashboard summary cards with correct data', async () => {
    render(<RpmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    // "Enrolled Patients" appears in both summary card and table header
    expect(screen.getAllByText('Enrolled Patients').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
  });

  it('renders enrolled patient rows with vitals and status', async () => {
    render(<RpmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('I10')).toBeInTheDocument();
    expect(screen.getByText('145 mmHg')).toBeInTheDocument();
  });

  it('shows empty state when no patients are enrolled', async () => {
    mockService.getActiveEnrollments.mockResolvedValue({
      success: true,
      data: [],
      error: null,
    });

    render(<RpmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No patients enrolled in RPM')).toBeInTheDocument();
    });
  });

  it('navigates to patient detail view when a row is clicked', async () => {
    render(<RpmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Mock the detail view dependencies
    mockService.getEnrollmentById.mockResolvedValue({
      success: true,
      data: {
        id: 'enroll-1',
        tenant_id: 'tenant-1',
        patient_id: 'patient-abc',
        status: 'active',
        enrolled_at: '2026-01-15T00:00:00Z',
        enrolled_by: null,
        primary_diagnosis_code: 'I10',
        monitoring_reason: null,
        ordering_provider_id: null,
        device_types: ['blood_pressure_cuff'],
        setup_completed_at: null,
        total_monitoring_minutes: 120,
        monitoring_start_date: '2026-01-15',
        monitoring_end_date: null,
      },
      error: null,
    });
    mockService.getPatientVitalAlerts.mockResolvedValue({ success: true, data: [], error: null });
    mockService.getEffectiveRules.mockResolvedValue({ success: true, data: [], error: null });

    const user = userEvent.setup();
    await user.click(screen.getByText('Jane Smith'));

    await waitFor(() => {
      expect(screen.getByText('Back to List')).toBeInTheDocument();
    });
  });

  it('shows enrollment form when Enroll Patient button is clicked', async () => {
    render(<RpmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Enroll Patient')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Enroll Patient'));

    await waitFor(() => {
      expect(screen.getByText('Enroll Patient in RPM')).toBeInTheDocument();
    });
  });
});
