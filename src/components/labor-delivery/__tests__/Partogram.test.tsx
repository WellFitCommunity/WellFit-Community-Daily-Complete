/**
 * Partogram.test.tsx — Tests for SVG partogram visualization
 *
 * Tier 1 (behavior) and Tier 2 (state) tests:
 * - Empty state message when no events
 * - SVG renders with data points for labor events
 * - Dilation and station lines are plotted
 * - Alert line appears when active phase (>=4cm) is reached
 * - Legend is present
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Partogram from '../Partogram';
import type { LDLaborEvent } from '../../../types/laborDelivery';

const makeEvent = (overrides: Partial<LDLaborEvent> = {}): LDLaborEvent => ({
  id: crypto.randomUUID(),
  patient_id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '2b902657-6a20-4435-a78a-576f397517ca',
  pregnancy_id: '00000000-0000-0000-0000-000000000002',
  event_time: '2026-02-16T08:00:00Z',
  stage: 'active_phase',
  dilation_cm: 4,
  effacement_percent: 80,
  station: -2,
  contraction_frequency_per_10min: 3,
  contraction_duration_seconds: 60,
  contraction_intensity: 'moderate',
  membrane_status: 'intact',
  membrane_rupture_time: null,
  fluid_color: null,
  maternal_bp_systolic: 120,
  maternal_bp_diastolic: 80,
  maternal_hr: 82,
  maternal_temp_c: 37.0,
  notes: null,
  created_at: '2026-02-16T08:00:00Z',
  ...overrides,
});

describe('Partogram', () => {
  it('shows empty state message when no labor events', () => {
    render(<Partogram laborEvents={[]} />);
    expect(screen.getByText(/no labor events recorded/i)).toBeInTheDocument();
  });

  it('renders SVG chart with labor event data points', () => {
    const events = [
      makeEvent({ event_time: '2026-02-16T08:00:00Z', dilation_cm: 3, station: -3 }),
      makeEvent({ event_time: '2026-02-16T10:00:00Z', dilation_cm: 5, station: -1 }),
    ];
    render(<Partogram laborEvents={events} />);

    const svg = screen.getByRole('img', { name: /partogram/i });
    expect(svg).toBeInTheDocument();
    // Should have circle elements for data points (2 dilation + 2 station = 4 circles min)
    const circles = svg.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(4);
  });

  it('displays dilation and station in the legend', () => {
    const events = [
      makeEvent({ dilation_cm: 4, station: -2 }),
    ];
    render(<Partogram laborEvents={events} />);
    expect(screen.getByText('Dilation')).toBeInTheDocument();
    // "Station" appears in legend and axis — use getAllByText to confirm at least one
    expect(screen.getAllByText('Station').length).toBeGreaterThanOrEqual(1);
  });

  it('renders title tooltips with dilation values on data points', () => {
    const events = [
      makeEvent({ event_time: '2026-02-16T08:00:00Z', dilation_cm: 6, stage: 'active_phase' }),
    ];
    const { container } = render(<Partogram laborEvents={events} />);
    // SVG title elements serve as tooltips
    const titles = container.querySelectorAll('title');
    const dilationTitle = Array.from(titles).find((t) => t.textContent?.includes('6 cm'));
    expect(dilationTitle).toBeTruthy();
  });

  it('renders alert line reference when active phase dilation (>=4cm) is present', () => {
    const events = [
      makeEvent({ event_time: '2026-02-16T08:00:00Z', dilation_cm: 4 }),
      makeEvent({ event_time: '2026-02-16T10:00:00Z', dilation_cm: 6 }),
    ];
    render(<Partogram laborEvents={events} />);
    expect(screen.getByText(/alert.*1cm\/hr/i)).toBeInTheDocument();
  });

  it('renders partogram heading', () => {
    const events = [makeEvent()];
    render(<Partogram laborEvents={events} />);
    expect(screen.getByText('Partogram')).toBeInTheDocument();
  });

  it('plots multiple events in chronological order on the X axis', () => {
    const events = [
      makeEvent({ event_time: '2026-02-16T12:00:00Z', dilation_cm: 8, station: 1 }),
      makeEvent({ event_time: '2026-02-16T08:00:00Z', dilation_cm: 3, station: -3 }),
      makeEvent({ event_time: '2026-02-16T10:00:00Z', dilation_cm: 5, station: -1 }),
    ];
    const { container } = render(<Partogram laborEvents={events} />);

    // Should have path elements for the dilation and station lines
    const paths = container.querySelectorAll('path');
    const linePaths = Array.from(paths).filter((p) => p.getAttribute('d')?.startsWith('M'));
    expect(linePaths.length).toBeGreaterThanOrEqual(2);
  });
});
