/**
 * DeviceBatteryAlert Tests
 * Behavioral tests for device battery warning banner
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceBatteryAlert from '../DeviceBatteryAlert';
import type { CardDeviceMonitoring } from '../../../types/cardiology';

function createDevice(overrides: Partial<CardDeviceMonitoring> = {}): CardDeviceMonitoring {
  return {
    id: 'dev-001',
    patient_id: 'p-001',
    tenant_id: 't-001',
    registry_id: 'r-001',
    device_type: 'pacemaker',
    device_manufacturer: 'Medtronic',
    device_model: 'Micra AV',
    implant_date: '2024-01-15',
    check_date: '2026-02-20',
    checked_by: 'Dr. Smith',
    battery_status: 'good',
    battery_voltage: 2.85,
    battery_longevity_months: 48,
    atrial_pacing_percent: 45,
    ventricular_pacing_percent: 2,
    lead_impedance_atrial_ohms: 500,
    lead_impedance_ventricular_ohms: 450,
    sensing_atrial_mv: 2.5,
    sensing_ventricular_mv: 8.0,
    threshold_atrial_v: 0.5,
    threshold_ventricular_v: 0.75,
    shocks_delivered: 0,
    anti_tachycardia_pacing_events: 0,
    atrial_arrhythmia_burden_percent: null,
    alerts: [],
    notes: null,
    created_at: '2026-02-20T00:00:00Z',
    ...overrides,
  };
}

describe('DeviceBatteryAlert', () => {
  it('renders nothing when battery status is good', () => {
    const { container } = render(
      <DeviceBatteryAlert device={createDevice({ battery_status: 'good' })} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows warning for elective replacement', () => {
    render(
      <DeviceBatteryAlert device={createDevice({ battery_status: 'elective_replacement' })} />
    );
    expect(screen.getByText(/Elective Replacement/)).toBeInTheDocument();
    expect(screen.getByText(/Plan device replacement/)).toBeInTheDocument();
  });

  it('shows urgent alert for end of life', () => {
    render(
      <DeviceBatteryAlert device={createDevice({ battery_status: 'end_of_life' })} />
    );
    expect(screen.getByText(/End of Life/)).toBeInTheDocument();
    expect(screen.getByText(/Schedule device replacement urgently/)).toBeInTheDocument();
  });

  it('displays device info in alert', () => {
    render(
      <DeviceBatteryAlert device={createDevice({
        battery_status: 'end_of_life',
        device_type: 'icd',
        device_manufacturer: 'Boston Scientific',
        device_model: 'Emblem S-ICD',
      })} />
    );
    expect(screen.getByText(/ICD/)).toBeInTheDocument();
    expect(screen.getByText(/Boston Scientific/)).toBeInTheDocument();
    expect(screen.getByText(/Emblem S-ICD/)).toBeInTheDocument();
  });

  it('shows longevity estimate when available', () => {
    render(
      <DeviceBatteryAlert device={createDevice({
        battery_status: 'elective_replacement',
        battery_longevity_months: 6,
      })} />
    );
    expect(screen.getByText(/6 months remaining/)).toBeInTheDocument();
  });

  it('has role=alert for accessibility', () => {
    render(
      <DeviceBatteryAlert device={createDevice({ battery_status: 'end_of_life' })} />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
