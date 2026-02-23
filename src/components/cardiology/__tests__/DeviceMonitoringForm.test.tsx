/**
 * DeviceMonitoringForm Tests
 * Behavioral tests for cardiac device interrogation form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeviceMonitoringForm from '../DeviceMonitoringForm';

const mockCreateDeviceCheck = vi.fn();
vi.mock('../../../services/cardiology', () => ({
  CardiologyService: {
    createDeviceCheck: (...args: unknown[]) => mockCreateDeviceCheck(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {},
}));

const defaultProps = {
  patientId: 'patient-001',
  tenantId: 'tenant-001',
  registryId: 'reg-001',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('DeviceMonitoringForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDeviceCheck.mockResolvedValue({
      success: true,
      data: { id: 'dev-001', device_type: 'pacemaker', battery_status: 'good' },
    });
  });

  it('renders device type dropdown and battery status', () => {
    render(<DeviceMonitoringForm {...defaultProps} />);
    expect(screen.getByText('Device Interrogation')).toBeInTheDocument();
    expect(screen.getByText('Device Information')).toBeInTheDocument();
    expect(screen.getByText('Battery Status')).toBeInTheDocument();
  });

  it('renders manufacturer dropdown with common options', () => {
    render(<DeviceMonitoringForm {...defaultProps} />);
    expect(screen.getByText('Select manufacturer...')).toBeInTheDocument();
  });

  it('renders lead parameter inputs', () => {
    render(<DeviceMonitoringForm {...defaultProps} />);
    expect(screen.getByText('Lead Parameters')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 2.5')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 8.0')).toBeInTheDocument();
  });

  it('renders events section with shocks and ATP', () => {
    render(<DeviceMonitoringForm {...defaultProps} />);
    expect(screen.getByText('Shocks Delivered')).toBeInTheDocument();
    expect(screen.getByText('ATP Events')).toBeInTheDocument();
    expect(screen.getByText('AF Burden (%)')).toBeInTheDocument();
  });

  it('submits form with default values', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    await user.click(screen.getByText('Save Device Check'));

    await waitFor(() => {
      expect(mockCreateDeviceCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 'patient-001',
          tenant_id: 'tenant-001',
          registry_id: 'reg-001',
          device_type: 'pacemaker',
          battery_status: 'good',
          shocks_delivered: 0,
          anti_tachycardia_pacing_events: 0,
        })
      );
    });
  });

  it('submits with selected device type and manufacturer', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    // Select ICD device type (first combobox)
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'icd');

    // Select manufacturer (second combobox)
    await user.selectOptions(selects[1], 'Medtronic');

    await user.click(screen.getByText('Save Device Check'));

    await waitFor(() => {
      expect(mockCreateDeviceCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          device_type: 'icd',
          device_manufacturer: 'Medtronic',
        })
      );
    });
  });

  it('highlights battery status select when not good', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    // Battery status is the 3rd combobox (after device type, manufacturer)
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[2], 'end_of_life');

    // The select should have red styling
    expect(selects[2]).toHaveClass('border-red-500');
  });

  it('highlights shocks input when value > 0', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    // Both shocks and ATP default to "0" — shocks is the first one
    const zeroInputs = screen.getAllByDisplayValue('0');
    const shocksInput = zeroInputs[0];
    await user.clear(shocksInput);
    await user.type(shocksInput, '3');

    expect(shocksInput).toHaveClass('border-red-500');
  });

  it('shows success message after recording', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    await user.click(screen.getByText('Save Device Check'));

    await waitFor(() => {
      expect(screen.getByText('Device interrogation recorded')).toBeInTheDocument();
    });
  });

  it('shows battery warning on success when EOL', async () => {
    mockCreateDeviceCheck.mockResolvedValue({
      success: true,
      data: { id: 'dev-002', device_type: 'icd', battery_status: 'end_of_life' },
    });

    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[2], 'end_of_life');

    await user.click(screen.getByText('Save Device Check'));

    await waitFor(() => {
      expect(screen.getByText(/END OF LIFE/)).toBeInTheDocument();
      expect(screen.getByText(/Schedule replacement/)).toBeInTheDocument();
    });
  });

  it('shows shock warning on success when shocks > 0', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    const zeroInputs = screen.getAllByDisplayValue('0');
    await user.clear(zeroInputs[0]);
    await user.type(zeroInputs[0], '2');

    await user.click(screen.getByText('Save Device Check'));

    await waitFor(() => {
      expect(screen.getByText(/shock\(s\) delivered/)).toBeInTheDocument();
    });
  });

  it('shows error when service fails', async () => {
    mockCreateDeviceCheck.mockResolvedValue({ success: false, error: 'Insert failed' });
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    await user.click(screen.getByText('Save Device Check'));

    await waitFor(() => {
      expect(screen.getByText('Insert failed')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<DeviceMonitoringForm {...defaultProps} />);

    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[0]);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
