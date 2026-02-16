/**
 * DeliverySummary Component Tests
 * Tier 1-2: Tests delivery summary display and print behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeliverySummary from '../DeliverySummary';
import type {
  LDPregnancy,
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDLaborEvent,
} from '../../../types/laborDelivery';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

const mockPregnancy: LDPregnancy = {
  id: 'preg-1',
  patient_id: 'p1',
  tenant_id: 't1',
  gravida: 3,
  para: 2,
  ab: 0,
  living: 2,
  edd: '2026-04-15',
  lmp: null,
  blood_type: 'A+',
  rh_factor: 'positive',
  gbs_status: 'negative',
  risk_level: 'moderate',
  risk_factors: ['advanced_maternal_age', 'previous_cesarean'],
  status: 'active',
  primary_provider_id: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockDelivery: LDDeliveryRecord = {
  id: 'del-1',
  patient_id: 'p1',
  tenant_id: 't1',
  pregnancy_id: 'preg-1',
  delivery_datetime: '2026-04-10T14:30:00Z',
  delivery_provider_id: null,
  method: 'spontaneous_vaginal',
  anesthesia: 'epidural',
  labor_duration_hours: 12,
  second_stage_duration_min: 45,
  estimated_blood_loss_ml: 350,
  complications: [],
  episiotomy: false,
  laceration_degree: 2,
  cord_clamping: 'delayed_60s',
  cord_gases_ph: 7.28,
  cord_gases_base_excess: -3.5,
  placenta_delivery_time: null,
  placenta_intact: true,
  notes: 'Uncomplicated delivery',
  created_at: new Date().toISOString(),
};

const mockNewborn: LDNewbornAssessment = {
  id: 'nb-1',
  patient_id: 'p1',
  tenant_id: 't1',
  pregnancy_id: 'preg-1',
  delivery_id: 'del-1',
  newborn_patient_id: null,
  birth_datetime: '2026-04-10T14:30:00Z',
  sex: 'female',
  weight_g: 3450,
  length_cm: 51,
  head_circumference_cm: 34,
  apgar_1_min: 8,
  apgar_5_min: 9,
  apgar_10_min: null,
  ballard_gestational_age_weeks: null,
  temperature_c: 37.0,
  heart_rate: 140,
  respiratory_rate: 42,
  disposition: 'well_newborn_nursery',
  skin_color: 'pink',
  reflexes: 'active',
  anomalies: [],
  vitamin_k_given: true,
  erythromycin_given: true,
  hepatitis_b_vaccine: true,
  notes: null,
  created_at: new Date().toISOString(),
};

const mockLaborEvents: LDLaborEvent[] = [
  {
    id: 'le-1',
    patient_id: 'p1',
    tenant_id: 't1',
    pregnancy_id: 'preg-1',
    event_time: '2026-04-10T06:00:00Z',
    stage: 'active_phase',
    dilation_cm: 5,
    effacement_percent: 80,
    station: -1,
    contraction_frequency_per_10min: 4,
    contraction_duration_seconds: 50,
    contraction_intensity: 'moderate',
    membrane_status: 'intact',
    membrane_rupture_time: null,
    fluid_color: null,
    maternal_bp_systolic: 125,
    maternal_bp_diastolic: 80,
    maternal_hr: 88,
    maternal_temp_c: 37.1,
    notes: null,
    created_at: new Date().toISOString(),
  },
];

describe('DeliverySummary', () => {
  it('displays all major sections of the delivery summary', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        newborn={mockNewborn}
        laborEvents={mockLaborEvents}
      />
    );
    expect(screen.getByText('Delivery Summary')).toBeInTheDocument();
    expect(screen.getByText('Maternal Information')).toBeInTheDocument();
    expect(screen.getByText('Delivery Details')).toBeInTheDocument();
    expect(screen.getByText('Newborn Assessment')).toBeInTheDocument();
    expect(screen.getByText('Labor Timeline')).toBeInTheDocument();
  });

  it('displays maternal gravida/para information', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={[]}
      />
    );
    expect(screen.getByText('G3 P2 Ab0')).toBeInTheDocument();
    expect(screen.getByText(/A\+/)).toBeInTheDocument();
  });

  it('displays delivery method and EBL', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={[]}
      />
    );
    expect(screen.getByText(/spontaneous vaginal/i)).toBeInTheDocument();
    expect(screen.getByText('350 mL')).toBeInTheDocument();
  });

  it('highlights high EBL in red', () => {
    const highEBL = { ...mockDelivery, estimated_blood_loss_ml: 750 };
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={highEBL}
        laborEvents={[]}
      />
    );
    const eblEl = screen.getByText('750 mL');
    expect(eblEl.className).toContain('text-red-600');
  });

  it('displays newborn APGAR scores with color coding', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        newborn={mockNewborn}
        laborEvents={[]}
      />
    );
    // APGAR 1min = 8 (green), 5min = 9 (green)
    const apgar1 = screen.getByText('8');
    const apgar5 = screen.getByText('9');
    expect(apgar1.className).toContain('text-green');
    expect(apgar5.className).toContain('text-green');
  });

  it('displays newborn weight in grams and pounds', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        newborn={mockNewborn}
        laborEvents={[]}
      />
    );
    expect(screen.getByText(/3450 g/)).toBeInTheDocument();
    expect(screen.getByText(/7\.6 lbs/)).toBeInTheDocument();
  });

  it('shows labor timeline with dilation and station', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={mockLaborEvents}
      />
    );
    expect(screen.getByText('5 cm')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('4/10min')).toBeInTheDocument();
  });

  it('omits newborn section when no assessment provided', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={[]}
      />
    );
    expect(screen.queryByText('Newborn Assessment')).not.toBeInTheDocument();
  });

  it('omits labor timeline when no events exist', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={[]}
      />
    );
    expect(screen.queryByText('Labor Timeline')).not.toBeInTheDocument();
  });

  it('calls window.print when print button clicked', async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={[]}
      />
    );
    await user.click(screen.getByText('Print Summary'));
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });

  it('displays risk factors from pregnancy record', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        laborEvents={[]}
      />
    );
    expect(screen.getByText(/advanced_maternal_age, previous_cesarean/)).toBeInTheDocument();
  });

  it('displays complications when present', () => {
    const withComplications = {
      ...mockDelivery,
      complications: ['shoulder_dystocia', 'cord_prolapse'],
    };
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={withComplications}
        laborEvents={[]}
      />
    );
    expect(screen.getByText(/shoulder_dystocia, cord_prolapse/)).toBeInTheDocument();
  });

  it('displays newborn medication administration status', () => {
    render(
      <DeliverySummary
        pregnancy={mockPregnancy}
        delivery={mockDelivery}
        newborn={mockNewborn}
        laborEvents={[]}
      />
    );
    const givenElements = screen.getAllByText('Given');
    expect(givenElements.length).toBe(3); // Vitamin K, Erythromycin, Hep B
  });
});
