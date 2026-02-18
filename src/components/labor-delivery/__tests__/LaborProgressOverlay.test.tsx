/**
 * LaborProgressOverlay.test.tsx — Tests for SVG labor progress overlay
 *
 * Tier 1 (behavior) and Tier 2 (state):
 * - Renders nothing when no labor events
 * - Dilation ring radius scales with cm value
 * - Station y-position maps correctly from -5→y=75 to +5→y=100
 * - Contraction overlay appears only when intensity is present
 * - Dilation color shifts by phase (green/yellow/red)
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LaborProgressOverlay from '../LaborProgressOverlay';
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

/** Helper: render overlay inside an SVG wrapper */
function renderOverlay(events: LDLaborEvent[]) {
  return render(
    <svg viewBox="0 0 100 160">
      <LaborProgressOverlay laborEvents={events} />
    </svg>
  );
}

describe('LaborProgressOverlay', () => {
  it('renders nothing when no labor events provided', () => {
    const { container } = renderOverlay([]);
    expect(container.querySelector('[data-testid="labor-progress-overlay"]')).toBeNull();
  });

  it('renders dilation ring with radius scaled to dilation_cm', () => {
    const { container } = renderOverlay([makeEvent({ dilation_cm: 6 })]);
    const ring = container.querySelector('[data-testid="dilation-ring"]');
    expect(ring).not.toBeNull();
    // radius = dilation_cm * 0.6 = 3.6
    expect(ring?.getAttribute('r')).toBe('3.6');
  });

  it('does not render dilation ring when dilation is 0', () => {
    const { container } = renderOverlay([makeEvent({ dilation_cm: 0 })]);
    expect(container.querySelector('[data-testid="dilation-ring"]')).toBeNull();
  });

  it('maps station -5 to y=75 (high)', () => {
    const { container } = renderOverlay([makeEvent({ station: -5 })]);
    const indicator = container.querySelector('[data-testid="station-indicator"]');
    expect(indicator).not.toBeNull();
    // transform should be translate(50, 75)
    expect(indicator?.getAttribute('transform')).toBe('translate(50, 75)');
  });

  it('maps station 0 to y=87.5 (ischial spines)', () => {
    const { container } = renderOverlay([makeEvent({ station: 0 })]);
    const indicator = container.querySelector('[data-testid="station-indicator"]');
    expect(indicator?.getAttribute('transform')).toBe('translate(50, 87.5)');
  });

  it('maps station +5 to y=100 (crowning)', () => {
    const { container } = renderOverlay([makeEvent({ station: 5 })]);
    const indicator = container.querySelector('[data-testid="station-indicator"]');
    expect(indicator?.getAttribute('transform')).toBe('translate(50, 100)');
  });

  it('shows contraction overlay when intensity is present', () => {
    const { container } = renderOverlay([
      makeEvent({ contraction_intensity: 'strong' }),
    ]);
    expect(container.querySelector('[data-testid="contraction-overlay"]')).not.toBeNull();
  });

  it('hides contraction overlay when intensity is null', () => {
    const { container } = renderOverlay([
      makeEvent({ contraction_intensity: null }),
    ]);
    expect(container.querySelector('[data-testid="contraction-overlay"]')).toBeNull();
  });

  it('uses the latest event when multiple events provided', () => {
    const events = [
      makeEvent({ event_time: '2026-02-18T06:00:00Z', dilation_cm: 3, station: -3 }),
      makeEvent({ event_time: '2026-02-18T10:00:00Z', dilation_cm: 7, station: 0 }),
      makeEvent({ event_time: '2026-02-18T08:00:00Z', dilation_cm: 5, station: -1 }),
    ];
    const { container } = renderOverlay(events);
    const ring = container.querySelector('[data-testid="dilation-ring"]');
    // Latest is 10:00 with dilation 7 -> radius = 4.2
    expect(ring?.getAttribute('r')).toBe('4.2');
  });

  it('uses green stroke for latent phase (<4cm)', () => {
    const { container } = renderOverlay([makeEvent({ dilation_cm: 2 })]);
    const ring = container.querySelector('[data-testid="dilation-ring"]');
    expect(ring?.getAttribute('stroke')).toBe('#22c55e');
  });

  it('uses yellow stroke for active phase (4-7cm)', () => {
    const { container } = renderOverlay([makeEvent({ dilation_cm: 5 })]);
    const ring = container.querySelector('[data-testid="dilation-ring"]');
    expect(ring?.getAttribute('stroke')).toBe('#eab308');
  });

  it('uses red stroke for transition phase (8-10cm)', () => {
    const { container } = renderOverlay([makeEvent({ dilation_cm: 9 })]);
    const ring = container.querySelector('[data-testid="dilation-ring"]');
    expect(ring?.getAttribute('stroke')).toBe('#ef4444');
  });
});
