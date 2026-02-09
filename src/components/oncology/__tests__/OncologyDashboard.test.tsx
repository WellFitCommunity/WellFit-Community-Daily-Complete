/**
 * OncologyDashboard Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OncologyDashboard from '../OncologyDashboard';
import OncologyAlerts from '../OncologyAlerts';
import OncologyOverview from '../OncologyOverview';
import type { OncologyDashboardSummary, OncAlert } from '../../../types/oncology';

vi.mock('../../../services/oncology', () => ({
  OncologyService: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      success: true,
      data: {
        registry: null,
        staging: null,
        treatment_plan: null,
        recent_chemo_sessions: [],
        recent_radiation_sessions: [],
        latest_labs: null,
        latest_imaging: null,
        active_side_effects: [],
        survivorship: null,
        alerts: [],
      },
    }),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
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

describe('OncologyDashboard', () => {
  it('renders dashboard header', async () => {
    render(<OncologyDashboard />);
    expect(await screen.findByText('Cancer Care')).toBeInTheDocument();
  });

  it('renders all 5 tab buttons', async () => {
    render(<OncologyDashboard />);
    await screen.findByText('Cancer Care');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Treatment')).toBeInTheDocument();
    expect(screen.getByText('Labs & Markers')).toBeInTheDocument();
    expect(screen.getByText('Imaging')).toBeInTheDocument();
    expect(screen.getByText('Survivorship')).toBeInTheDocument();
  });

  it('shows empty state when no registry data', async () => {
    render(<OncologyDashboard />);
    expect(await screen.findByText('No oncology data available')).toBeInTheDocument();
  });

  it('switches tabs', async () => {
    const user = userEvent.setup();
    render(<OncologyDashboard />);
    await screen.findByText('Cancer Care');

    await user.click(screen.getByText('Survivorship'));
    expect(await screen.findByText('No survivorship data recorded')).toBeInTheDocument();

    await user.click(screen.getByText('Treatment'));
    expect(await screen.findByText('No chemotherapy sessions recorded')).toBeInTheDocument();
  });
});

describe('OncologyAlerts', () => {
  it('shows "No active alerts" when empty', () => {
    render(<OncologyAlerts alerts={[]} />);
    expect(screen.getByText('No active alerts')).toBeInTheDocument();
  });

  it('renders critical alerts', () => {
    const alerts: OncAlert[] = [
      {
        id: 'a1',
        type: 'febrile_neutropenia',
        severity: 'critical',
        message: 'Febrile neutropenia — ANC 200',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<OncologyAlerts alerts={alerts} />);
    expect(screen.getByText('Febrile neutropenia — ANC 200')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('has proper ARIA role', () => {
    const alerts: OncAlert[] = [
      {
        id: 'a1',
        type: 'ctcae_grade_4_5',
        severity: 'critical',
        message: 'CTCAE Grade 4 — Febrile neutropenia',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<OncologyAlerts alerts={alerts} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

describe('OncologyOverview', () => {
  const emptySummary: OncologyDashboardSummary = {
    registry: null,
    staging: null,
    treatment_plan: null,
    recent_chemo_sessions: [],
    recent_radiation_sessions: [],
    latest_labs: null,
    latest_imaging: null,
    active_side_effects: [],
    survivorship: null,
    alerts: [],
  };

  it('shows empty state when no registry', () => {
    render(<OncologyOverview summary={emptySummary} />);
    expect(screen.getByText('No oncology data available')).toBeInTheDocument();
  });

  it('displays cancer registry when available', () => {
    const summary: OncologyDashboardSummary = {
      ...emptySummary,
      registry: {
        id: 'reg-1',
        patient_id: 'p1',
        tenant_id: 't1',
        primary_site: 'Right Breast',
        histology: 'Invasive Ductal Carcinoma',
        icd10_code: 'C50.911',
        diagnosis_date: '2026-01-15',
        biomarkers: { 'ER': 'Positive', 'HER2': 'Negative' },
        ecog_status: 1,
        status: 'active_treatment',
        treating_oncologist_id: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
    render(<OncologyOverview summary={summary} />);
    expect(screen.getByText('Right Breast')).toBeInTheDocument();
    expect(screen.getByText('C50.911')).toBeInTheDocument();
    expect(screen.getByText('ER: Positive')).toBeInTheDocument();
  });

  it('displays TNM staging', () => {
    const summary: OncologyDashboardSummary = {
      ...emptySummary,
      staging: {
        id: 'stg-1',
        patient_id: 'p1',
        tenant_id: 't1',
        registry_id: 'reg-1',
        staging_date: '2026-01-20',
        staging_type: 'pathological',
        t_stage: 'T2',
        n_stage: 'N1',
        m_stage: 'M0',
        overall_stage: 'IIB',
        ajcc_edition: 8,
        staging_basis: null,
        notes: null,
        created_at: new Date().toISOString(),
      },
    };
    render(<OncologyOverview summary={summary} />);
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('N1')).toBeInTheDocument();
    expect(screen.getByText('M0')).toBeInTheDocument();
    expect(screen.getByText('IIB')).toBeInTheDocument();
  });

  it('displays treatment plan with drugs', () => {
    const summary: OncologyDashboardSummary = {
      ...emptySummary,
      treatment_plan: {
        id: 'tp-1',
        patient_id: 'p1',
        tenant_id: 't1',
        registry_id: 'reg-1',
        plan_date: '2026-01-25',
        modalities: ['chemotherapy'],
        intent: 'adjuvant',
        regimen_name: 'AC-T',
        drugs: ['Doxorubicin', 'Cyclophosphamide', 'Paclitaxel'],
        cycle_count: 8,
        cycle_length_days: 21,
        planned_start_date: null,
        actual_start_date: null,
        status: 'active',
        notes: null,
        created_at: new Date().toISOString(),
      },
    };
    render(<OncologyOverview summary={summary} />);
    expect(screen.getByText('AC-T')).toBeInTheDocument();
    expect(screen.getByText('Doxorubicin')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });
});
