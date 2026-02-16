/**
 * L&D Tab Component Tests
 * Tier 2: Tests data display and form toggle behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrenatalTab from '../PrenatalTab';
import LaborTab from '../LaborTab';
import NewbornTab from '../NewbornTab';
import PostpartumTab from '../PostpartumTab';
import type { LDDashboardSummary } from '../../../types/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createPrenatalVisit: vi.fn(),
    createLaborEvent: vi.fn(),
    createDeliveryRecord: vi.fn(),
  },
}));

vi.mock('../../../services/laborDelivery/laborDeliveryBilling', () => ({
  suggestBillingCodes: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

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

const mockPregnancy = {
  id: 'preg-1',
  patient_id: 'p1',
  tenant_id: 't1',
  gravida: 2,
  para: 1,
  ab: 0,
  living: 1,
  edd: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
  lmp: null,
  blood_type: 'O+' as const,
  rh_factor: 'positive' as const,
  gbs_status: 'negative' as const,
  risk_level: 'low' as const,
  risk_factors: [],
  status: 'active' as const,
  primary_provider_id: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const onDataChange = vi.fn();

describe('PrenatalTab', () => {
  it('shows empty state when no visits exist', () => {
    render(<PrenatalTab summary={emptySummary} onDataChange={onDataChange} />);
    expect(screen.getByText('No prenatal visits recorded')).toBeInTheDocument();
  });

  it('shows "Record Visit" button when pregnancy exists', () => {
    const summary = { ...emptySummary, pregnancy: mockPregnancy };
    render(<PrenatalTab summary={summary} onDataChange={onDataChange} />);
    expect(screen.getByText('Record Visit')).toBeInTheDocument();
  });

  it('toggles form visibility on button click', async () => {
    const user = userEvent.setup();
    const summary = { ...emptySummary, pregnancy: mockPregnancy };
    render(<PrenatalTab summary={summary} onDataChange={onDataChange} />);

    await user.click(screen.getByText('Record Visit'));
    expect(screen.getByText('Record Prenatal Visit')).toBeInTheDocument();

    await user.click(screen.getByText('Close Form'));
    expect(screen.queryByText('Record Prenatal Visit')).not.toBeInTheDocument();
  });

  it('displays visit data in table', () => {
    const summary: LDDashboardSummary = {
      ...emptySummary,
      pregnancy: mockPregnancy,
      recent_prenatal_visits: [{
        id: 'v1',
        patient_id: 'p1',
        tenant_id: 't1',
        pregnancy_id: 'preg-1',
        visit_date: '2026-02-10',
        provider_id: null,
        gestational_age_weeks: 28,
        gestational_age_days: 3,
        fundal_height_cm: 28,
        fetal_heart_rate: 145,
        fetal_presentation: null,
        weight_kg: 72.5,
        bp_systolic: 120,
        bp_diastolic: 78,
        urine_protein: null,
        urine_glucose: null,
        cervical_dilation_cm: null,
        cervical_effacement_percent: null,
        cervical_station: null,
        edema: false,
        complaints: [],
        notes: null,
        created_at: new Date().toISOString(),
      }],
    };
    render(<PrenatalTab summary={summary} onDataChange={onDataChange} />);
    expect(screen.getByText('28w3d')).toBeInTheDocument();
    expect(screen.getByText('120/78')).toBeInTheDocument();
    expect(screen.getByText('72.5 kg')).toBeInTheDocument();
  });
});

describe('LaborTab', () => {
  it('shows empty state when no events exist', () => {
    render(<LaborTab summary={emptySummary} onDataChange={onDataChange} />);
    expect(screen.getByText('No labor events recorded')).toBeInTheDocument();
  });

  it('shows action buttons when pregnancy exists', () => {
    const summary = { ...emptySummary, pregnancy: mockPregnancy };
    render(<LaborTab summary={summary} onDataChange={onDataChange} />);
    expect(screen.getByText('Record Labor Event')).toBeInTheDocument();
    expect(screen.getByText('Record Delivery')).toBeInTheDocument();
  });

  it('hides delivery button when delivery already recorded', () => {
    const summary: LDDashboardSummary = {
      ...emptySummary,
      pregnancy: mockPregnancy,
      delivery_record: {
        id: 'del-1',
        patient_id: 'p1',
        tenant_id: 't1',
        pregnancy_id: 'preg-1',
        delivery_datetime: new Date().toISOString(),
        delivery_provider_id: null,
        method: 'spontaneous_vaginal',
        anesthesia: 'epidural',
        labor_duration_hours: 12,
        second_stage_duration_min: 45,
        estimated_blood_loss_ml: 350,
        complications: [],
        episiotomy: false,
        laceration_degree: null,
        cord_clamping: 'delayed_60s',
        cord_gases_ph: null,
        cord_gases_base_excess: null,
        placenta_delivery_time: null,
        placenta_intact: true,
        notes: null,
        created_at: new Date().toISOString(),
      },
    };
    render(<LaborTab summary={summary} onDataChange={onDataChange} />);
    expect(screen.queryByText('Record Delivery')).not.toBeInTheDocument();
    expect(screen.getByText('350 mL')).toBeInTheDocument();
  });
});

describe('NewbornTab', () => {
  it('shows empty state when no assessment recorded', () => {
    render(<NewbornTab summary={emptySummary} onDataChange={vi.fn()} />);
    expect(screen.getByText('Delivery must be recorded first')).toBeInTheDocument();
  });
});

describe('PostpartumTab', () => {
  it('shows empty state when no assessment recorded', () => {
    render(<PostpartumTab summary={emptySummary} onDataChange={vi.fn()} />);
    expect(screen.getByText('Delivery must be recorded first')).toBeInTheDocument();
  });
});
