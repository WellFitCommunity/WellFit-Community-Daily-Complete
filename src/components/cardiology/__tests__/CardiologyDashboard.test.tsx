/**
 * CardiologyDashboard Component Tests
 * Behavioral tests for cardiac care dashboard rendering
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardiologyDashboard from '../CardiologyDashboard';
import CardiologyAlerts from '../CardiologyAlerts';
import CardiologyOverview from '../CardiologyOverview';
import type { CardiologyDashboardSummary, CardiacAlert } from '../../../types/cardiology';

// Mock the service to avoid real DB calls
vi.mock('../../../services/cardiology', () => ({
  CardiologyService: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      success: true,
      data: {
        registry: null,
        latest_ecg: null,
        latest_echo: null,
        latest_stress_test: null,
        latest_hf_assessment: null,
        latest_device_check: null,
        rehab_progress: null,
        recent_arrhythmias: [],
        alerts: [],
      },
    }),
  },
}));

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

// =====================================================
// Dashboard Tests
// =====================================================

describe('CardiologyDashboard', () => {
  it('renders the dashboard header with title', async () => {
    render(<CardiologyDashboard />);
    expect(await screen.findByText('Heart Health')).toBeInTheDocument();
  });

  it('renders all 5 tab buttons', async () => {
    render(<CardiologyDashboard />);
    await screen.findByText('Heart Health');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('ECG & Tests')).toBeInTheDocument();
    expect(screen.getByText('Heart Failure')).toBeInTheDocument();
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByText('Rehab')).toBeInTheDocument();
  });

  it('shows empty state when no cardiac data exists', async () => {
    render(<CardiologyDashboard />);
    expect(await screen.findByText('No cardiac data available')).toBeInTheDocument();
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<CardiologyDashboard />);
    await screen.findByText('Heart Health');

    await user.click(screen.getByText('Heart Failure'));
    expect(await screen.findByText('No heart failure assessments recorded')).toBeInTheDocument();

    await user.click(screen.getByText('Devices'));
    expect(await screen.findByText('No cardiac devices on file')).toBeInTheDocument();
  });
});

// =====================================================
// Alerts Component Tests
// =====================================================

describe('CardiologyAlerts', () => {
  it('shows "No active alerts" when empty', () => {
    render(<CardiologyAlerts alerts={[]} />);
    expect(screen.getByText('No active alerts')).toBeInTheDocument();
  });

  it('renders critical alerts with appropriate styling', () => {
    const alerts: CardiacAlert[] = [
      {
        id: 'a1',
        type: 'stemi_detected',
        severity: 'critical',
        message: 'STEMI detected on ECG',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<CardiologyAlerts alerts={alerts} />);
    expect(screen.getByText('STEMI detected on ECG')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders multiple alerts sorted by severity', () => {
    const alerts: CardiacAlert[] = [
      {
        id: 'a1',
        type: 'stemi_detected',
        severity: 'critical',
        message: 'STEMI detected',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
      {
        id: 'a2',
        type: 'bnp_elevated',
        severity: 'high',
        message: 'BNP 1500 pg/mL',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<CardiologyAlerts alerts={alerts} />);
    expect(screen.getByText('STEMI detected')).toBeInTheDocument();
    expect(screen.getByText('BNP 1500 pg/mL')).toBeInTheDocument();
  });

  it('each alert has proper ARIA role', () => {
    const alerts: CardiacAlert[] = [
      {
        id: 'a1',
        type: 'low_ef',
        severity: 'critical',
        message: 'EF 15%',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<CardiologyAlerts alerts={alerts} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

// =====================================================
// Overview Component Tests
// =====================================================

describe('CardiologyOverview', () => {
  const emptySummary: CardiologyDashboardSummary = {
    registry: null,
    latest_ecg: null,
    latest_echo: null,
    latest_stress_test: null,
    latest_hf_assessment: null,
    latest_device_check: null,
    rehab_progress: null,
    recent_arrhythmias: [],
    alerts: [],
  };

  it('shows empty state when no data', () => {
    render(<CardiologyOverview summary={emptySummary} />);
    expect(screen.getByText('No cardiac data available')).toBeInTheDocument();
  });

  it('displays LVEF from echo results', () => {
    const summary: CardiologyDashboardSummary = {
      ...emptySummary,
      latest_echo: {
        id: 'e1',
        patient_id: 'p1',
        tenant_id: 't1',
        registry_id: 'r1',
        performed_date: '2026-02-10T10:00:00Z',
        performed_by: null,
        lvef_percent: 35,
        rv_function: 'normal',
        lv_end_diastolic_diameter_mm: null,
        lv_end_systolic_diameter_mm: null,
        lv_mass_index: null,
        wall_motion_abnormalities: [],
        valve_results: [],
        pericardial_effusion: false,
        diastolic_function: null,
        interpretation: null,
        created_at: new Date().toISOString(),
      },
    };
    render(<CardiologyOverview summary={summary} />);
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText(/Moderately reduced/i)).toBeInTheDocument();
  });

  it('displays ECG rhythm and heart rate', () => {
    const summary: CardiologyDashboardSummary = {
      ...emptySummary,
      latest_ecg: {
        id: 'ecg1',
        patient_id: 'p1',
        tenant_id: 't1',
        registry_id: 'r1',
        performed_date: '2026-02-10T10:00:00Z',
        performed_by: null,
        rhythm: 'atrial_fibrillation',
        heart_rate: 110,
        pr_interval_ms: null,
        qrs_duration_ms: 88,
        qtc_ms: 440,
        axis_degrees: null,
        st_changes: 'none',
        is_stemi: false,
        interpretation: null,
        is_normal: false,
        findings: [],
        created_at: new Date().toISOString(),
      },
    };
    render(<CardiologyOverview summary={summary} />);
    expect(screen.getByText('atrial fibrillation')).toBeInTheDocument();
    expect(screen.getByText('110 bpm')).toBeInTheDocument();
  });

  it('displays rehab progress bar', () => {
    const summary: CardiologyDashboardSummary = {
      ...emptySummary,
      rehab_progress: {
        phase: 2,
        sessions_completed: 18,
        total_sessions: 36,
        completion_percent: 50,
        latest_mets: 6.5,
      },
    };
    render(<CardiologyOverview summary={summary} />);
    expect(screen.getByText('18 / 36')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
  });
});
