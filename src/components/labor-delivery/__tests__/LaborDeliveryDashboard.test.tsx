/**
 * LaborDeliveryDashboard Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaborDeliveryDashboard from '../LaborDeliveryDashboard';
import LDAlerts from '../LDAlerts';
import LDOverview from '../LDOverview';
import type { LDDashboardSummary, LDAlert } from '../../../types/laborDelivery';

// Mock PatientContext — provides selected patient
const mockPatientContext = {
  selectedPatient: { id: 'patient-123', firstName: 'Jane', lastName: 'Doe' },
  hasPatient: true,
  getPatientDisplayName: () => 'Doe, Jane',
  selectPatient: vi.fn(),
  clearPatient: vi.fn(),
  recentPatients: [],
  selectFromHistory: vi.fn(),
  clearHistory: vi.fn(),
  pendingPatientId: null,
  pendingHistoryIds: [],
  markPendingLoaded: vi.fn(),
};

vi.mock('../../../contexts/PatientContext', () => ({
  usePatientContext: () => mockPatientContext,
}));

// Mock AuthContext — provides user and supabase client
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'user-abc' }),
  useSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { tenant_id: 'tenant-xyz' }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      success: true,
      data: {
        pregnancy: null,
        recent_prenatal_visits: [],
        labor_events: [],
        latest_fetal_monitoring: null,
        delivery_record: null,
        newborn_assessment: null,
        latest_postpartum: null,
        medications: [],
        latest_risk_assessment: null,
        alerts: [],
      },
    }),
  },
  LDMetricsService: {
    getUnitMetrics: vi.fn().mockResolvedValue({
      success: true,
      data: {
        active_pregnancies: 0,
        deliveries_today: 0,
        active_labors_today: 0,
        active_alerts: 0,
      },
    }),
  },
  LDAlertService: {
    acknowledgeAlert: vi.fn().mockResolvedValue({ success: true }),
    resolveAlert: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
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

describe('LaborDeliveryDashboard', () => {
  it('renders dashboard header', async () => {
    render(<LaborDeliveryDashboard />);
    expect(await screen.findByText('Pregnancy Care')).toBeInTheDocument();
  });

  it('renders all 5 tab buttons', async () => {
    render(<LaborDeliveryDashboard />);
    await screen.findByText('Pregnancy Care');
    expect(screen.getByText('Pregnancy Overview')).toBeInTheDocument();
    expect(screen.getByText('Prenatal Visits')).toBeInTheDocument();
    expect(screen.getByText('Labor & Delivery')).toBeInTheDocument();
    expect(screen.getByText('Newborn')).toBeInTheDocument();
    expect(screen.getByText('Postpartum')).toBeInTheDocument();
  });

  it('shows empty state when no pregnancy data', async () => {
    render(<LaborDeliveryDashboard />);
    expect(await screen.findByText('No pregnancy data available')).toBeInTheDocument();
  });

  it('switches tabs', async () => {
    const user = userEvent.setup();
    render(<LaborDeliveryDashboard />);
    await screen.findByText('Pregnancy Care');

    await user.click(screen.getByText('Newborn'));
    expect(await screen.findByText('Delivery must be recorded first')).toBeInTheDocument();

    await user.click(screen.getByText('Postpartum'));
    expect(await screen.findByText('Delivery must be recorded first')).toBeInTheDocument();
  });

  it('shows no-patient-selected state when patient context is empty', async () => {
    // Temporarily override patient context
    mockPatientContext.hasPatient = false;
    mockPatientContext.selectedPatient = null as ReturnType<typeof mockPatientContext.getPatientDisplayName> extends string ? never : null;

    render(<LaborDeliveryDashboard />);
    expect(await screen.findByText('No patient selected')).toBeInTheDocument();
    expect(screen.getByText(/Select a patient/)).toBeInTheDocument();

    // Restore for other tests
    mockPatientContext.hasPatient = true;
    mockPatientContext.selectedPatient = { id: 'patient-123', firstName: 'Jane', lastName: 'Doe' };
  });

  it('displays patient name in subtitle when patient is selected', async () => {
    render(<LaborDeliveryDashboard />);
    expect(await screen.findByText(/Doe, Jane/)).toBeInTheDocument();
  });
});

describe('LDAlerts', () => {
  it('shows "No active alerts" when empty', () => {
    render(<LDAlerts alerts={[]} />);
    expect(screen.getByText('No active alerts')).toBeInTheDocument();
  });

  it('renders critical alerts', () => {
    const alerts: LDAlert[] = [
      {
        id: 'a1',
        type: 'fetal_bradycardia',
        severity: 'critical',
        message: 'Fetal bradycardia — FHR 90 bpm',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<LDAlerts alerts={alerts} />);
    expect(screen.getByText('Fetal bradycardia — FHR 90 bpm')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('has proper ARIA role', () => {
    const alerts: LDAlert[] = [
      {
        id: 'a1',
        type: 'severe_preeclampsia',
        severity: 'critical',
        message: 'Severe preeclampsia',
        timestamp: new Date().toISOString(),
        source_record_id: null,
        acknowledged: false,
      },
    ];
    render(<LDAlerts alerts={alerts} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

describe('LDOverview', () => {
  const emptySummary: LDDashboardSummary = {
    pregnancy: null,
    recent_prenatal_visits: [],
    labor_events: [],
    latest_fetal_monitoring: null,
    delivery_record: null,
    newborn_assessment: null,
    latest_postpartum: null,
    medications: [],
    latest_risk_assessment: null,
    alerts: [],
  };

  it('shows empty state when no pregnancy', () => {
    render(<LDOverview onDataChange={vi.fn()} summary={emptySummary} />);
    expect(screen.getByText('No pregnancy data available')).toBeInTheDocument();
  });

  it('displays pregnancy info when available', () => {
    const summary: LDDashboardSummary = {
      ...emptySummary,
      pregnancy: {
        id: 'preg-1',
        patient_id: 'p1',
        tenant_id: 't1',
        gravida: 2,
        para: 1,
        ab: 0,
        living: 1,
        edd: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
        lmp: null,
        blood_type: 'O+',
        rh_factor: 'positive',
        gbs_status: 'negative',
        risk_level: 'moderate',
        risk_factors: ['Gestational diabetes'],
        status: 'active',
        primary_provider_id: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
    render(<LDOverview onDataChange={vi.fn()} summary={summary} />);
    // G2P1 appears in both PregnancyAvatarPanel quick-info and pregnancy summary
    expect(screen.getAllByText('G2P1').length).toBeGreaterThanOrEqual(1);
    // O+ appears in both panel and summary
    expect(screen.getAllByText('O+').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MODERATE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Gestational diabetes').length).toBeGreaterThanOrEqual(1);
  });

  it('displays newborn APGAR scores', () => {
    const summary: LDDashboardSummary = {
      ...emptySummary,
      pregnancy: {
        id: 'preg-1',
        patient_id: 'p1',
        tenant_id: 't1',
        gravida: 1,
        para: 1,
        ab: 0,
        living: 1,
        edd: new Date().toISOString(),
        lmp: null,
        blood_type: 'A+',
        rh_factor: 'positive',
        gbs_status: 'negative',
        risk_level: 'low',
        risk_factors: [],
        status: 'delivered',
        primary_provider_id: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      newborn_assessment: {
        id: 'nb-1',
        patient_id: 'p1',
        tenant_id: 't1',
        pregnancy_id: 'preg-1',
        delivery_id: 'del-1',
        newborn_patient_id: null,
        birth_datetime: new Date().toISOString(),
        sex: 'female',
        weight_g: 3400,
        length_cm: 51,
        head_circumference_cm: 34.5,
        apgar_1_min: 8,
        apgar_5_min: 9,
        apgar_10_min: null,
        ballard_gestational_age_weeks: null,
        temperature_c: null,
        heart_rate: null,
        respiratory_rate: null,
        disposition: 'rooming_in',
        skin_color: null,
        reflexes: null,
        anomalies: [],
        vitamin_k_given: true,
        erythromycin_given: true,
        hepatitis_b_vaccine: false,
        notes: null,
        created_at: new Date().toISOString(),
      },
    };
    render(<LDOverview onDataChange={vi.fn()} summary={summary} />);
    expect(screen.getByText('8/9')).toBeInTheDocument();
    expect(screen.getByText('3400g')).toBeInTheDocument();
  });
});
