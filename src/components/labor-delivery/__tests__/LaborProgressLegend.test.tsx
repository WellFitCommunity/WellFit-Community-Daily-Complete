/**
 * LaborProgressLegend.test.tsx — Tests for labor progress text readout
 *
 * Tier 1 (behavior) and Tier 2 (state):
 * - Shows empty state when no labor events
 * - Displays dilation value with phase label
 * - Displays station with +/- sign
 * - Shows contraction status badge when active
 * - Shows "None recorded" when no contractions
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LaborProgressLegend from '../LaborProgressLegend';
import type { LDLaborEvent } from '../../../types/laborDelivery';

const makeEvent = (overrides: Partial<LDLaborEvent> = {}): LDLaborEvent => ({
  id: crypto.randomUUID(),
  patient_id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '2b902657-6a20-4435-a78a-576f397517ca',
  pregnancy_id: '00000000-0000-0000-0000-000000000002',
  event_time: '2026-02-18T08:00:00Z',
  stage: 'active_phase',
  dilation_cm: 5,
  effacement_percent: 80,
  station: -1,
  contraction_frequency_per_10min: 4,
  contraction_duration_seconds: 60,
  contraction_intensity: 'moderate',
  membrane_status: 'intact',
  membrane_rupture_time: null,
  fluid_color: null,
  maternal_bp_systolic: 120,
  maternal_bp_diastolic: 78,
  maternal_hr: 84,
  maternal_temp_c: 37.0,
  notes: null,
  created_at: '2026-02-18T08:00:00Z',
  ...overrides,
});

describe('LaborProgressLegend', () => {
  it('shows empty state when no labor events', () => {
    render(<LaborProgressLegend laborEvents={[]} />);
    expect(screen.getByTestId('labor-legend-empty')).toBeInTheDocument();
    expect(screen.getByText(/no active labor data/i)).toBeInTheDocument();
  });

  it('displays dilation value and phase label', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({ dilation_cm: 5 })]} />);
    expect(screen.getByText(/5cm \(Active\)/)).toBeInTheDocument();
  });

  it('shows Latent phase for dilation < 4cm', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({ dilation_cm: 2 })]} />);
    expect(screen.getByText(/2cm \(Latent\)/)).toBeInTheDocument();
  });

  it('shows Transition phase for dilation 8-9cm', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({ dilation_cm: 9 })]} />);
    expect(screen.getByText(/9cm \(Transition\)/)).toBeInTheDocument();
  });

  it('shows Complete for 10cm dilation', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({ dilation_cm: 10 })]} />);
    expect(screen.getByText(/10cm \(Complete\)/)).toBeInTheDocument();
  });

  it('displays station with correct sign', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({ station: -3 })]} />);
    expect(screen.getByText('-3')).toBeInTheDocument();
  });

  it('displays positive station with + prefix', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({ station: 2 })]} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('shows contraction info when intensity is present', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({
      contraction_intensity: 'strong',
      contraction_frequency_per_10min: 5,
      contraction_duration_seconds: 70,
    })]} />);
    expect(screen.getByText(/Strong 5\/10min x 70s/)).toBeInTheDocument();
  });

  it('shows "None recorded" when no contraction intensity', () => {
    render(<LaborProgressLegend laborEvents={[makeEvent({
      contraction_intensity: null,
    })]} />);
    expect(screen.getByText(/None recorded/)).toBeInTheDocument();
  });
});
