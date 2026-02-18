/**
 * LaborAvatarPanel.test.tsx — Tests for composite labor avatar panel
 *
 * Tier 1 (behavior) and Tier 2 (state):
 * - Returns null when no pregnancy
 * - Renders panel with header and OB info
 * - Renders avatar with overlay when labor events exist
 * - Shows empty legend when no labor events
 * - Displays risk level badge
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LaborAvatarPanel from '../LaborAvatarPanel';
import type { LDDashboardSummary, LDPregnancy, LDLaborEvent } from '../../../types/laborDelivery';

const makePregnancy = (overrides: Partial<LDPregnancy> = {}): LDPregnancy => ({
  id: '00000000-0000-0000-0000-000000000010',
  patient_id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '2b902657-6a20-4435-a78a-576f397517ca',
  gravida: 2,
  para: 1,
  ab: 0,
  living: 1,
  edd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  lmp: null,
  blood_type: 'O+',
  rh_factor: 'positive',
  gbs_status: 'negative',
  risk_level: 'moderate',
  risk_factors: ['Prior cesarean'],
  status: 'active',
  primary_provider_id: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-18T00:00:00Z',
  ...overrides,
});

const makeEvent = (overrides: Partial<LDLaborEvent> = {}): LDLaborEvent => ({
  id: crypto.randomUUID(),
  patient_id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '2b902657-6a20-4435-a78a-576f397517ca',
  pregnancy_id: '00000000-0000-0000-0000-000000000010',
  event_time: '2026-02-18T08:00:00Z',
  stage: 'active_phase',
  dilation_cm: 6,
  effacement_percent: 90,
  station: 0,
  contraction_frequency_per_10min: 4,
  contraction_duration_seconds: 55,
  contraction_intensity: 'moderate',
  membrane_status: 'srom',
  membrane_rupture_time: '2026-02-18T06:00:00Z',
  fluid_color: 'clear',
  maternal_bp_systolic: 118,
  maternal_bp_diastolic: 76,
  maternal_hr: 88,
  maternal_temp_c: 37.1,
  notes: null,
  created_at: '2026-02-18T08:00:00Z',
  ...overrides,
});

const makeSummary = (overrides: Partial<LDDashboardSummary> = {}): LDDashboardSummary => ({
  pregnancy: makePregnancy(),
  recent_prenatal_visits: [],
  labor_events: [],
  latest_fetal_monitoring: null,
  delivery_record: null,
  newborn_assessment: null,
  latest_postpartum: null,
  medications: [],
  latest_risk_assessment: null,
  alerts: [],
  ...overrides,
});

describe('LaborAvatarPanel', () => {
  it('returns null when pregnancy is null', () => {
    const { container } = render(
      <LaborAvatarPanel summary={makeSummary({ pregnancy: null })} />
    );
    expect(container.querySelector('[data-testid="labor-avatar-panel"]')).toBeNull();
  });

  it('renders panel with header showing "Labor Progress Avatar"', () => {
    render(<LaborAvatarPanel summary={makeSummary()} />);
    expect(screen.getByText('Labor Progress Avatar')).toBeInTheDocument();
  });

  it('displays risk level badge', () => {
    render(<LaborAvatarPanel summary={makeSummary()} />);
    expect(screen.getByText('MODERATE')).toBeInTheDocument();
  });

  it('shows OB info (G/P, EDD, Blood, GBS)', () => {
    render(<LaborAvatarPanel summary={makeSummary()} />);
    expect(screen.getByText('G2P1')).toBeInTheDocument();
    expect(screen.getByText('O+ positive')).toBeInTheDocument();
    expect(screen.getByText('negative')).toBeInTheDocument();
  });

  it('renders the pregnancy avatar body', () => {
    render(<LaborAvatarPanel summary={makeSummary()} />);
    const svg = screen.getByRole('img', { name: /pregnant patient avatar/i });
    expect(svg).toBeInTheDocument();
  });

  it('renders labor overlay when labor events exist', () => {
    const { container } = render(
      <LaborAvatarPanel summary={makeSummary({ labor_events: [makeEvent()] })} />
    );
    expect(container.querySelector('[data-testid="labor-progress-overlay"]')).not.toBeNull();
  });

  it('shows empty legend when no labor events', () => {
    render(<LaborAvatarPanel summary={makeSummary({ labor_events: [] })} />);
    expect(screen.getByTestId('labor-legend-empty')).toBeInTheDocument();
  });

  it('shows labor legend with dilation when events present', () => {
    render(
      <LaborAvatarPanel summary={makeSummary({ labor_events: [makeEvent({ dilation_cm: 6 })] })} />
    );
    expect(screen.getByText(/6cm \(Active\)/)).toBeInTheDocument();
  });
});
