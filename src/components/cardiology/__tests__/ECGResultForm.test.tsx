/**
 * ECGResultForm Tests
 * Behavioral tests for ECG data entry form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ECGResultForm from '../ECGResultForm';

// Mock cardiologyService
const mockCreateEcgResult = vi.fn();
vi.mock('../../../services/cardiology', () => ({
  CardiologyService: {
    createEcgResult: (...args: unknown[]) => mockCreateEcgResult(...args),
  },
}));

// Mock FHIR observation service
const mockCreateObservationsFromEcg = vi.fn();
vi.mock('../../../services/fhir/cardiology', () => ({
  CardiologyObservationService: {
    createObservationsFromEcg: (...args: unknown[]) => mockCreateObservationsFromEcg(...args),
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

describe('ECGResultForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEcgResult.mockResolvedValue({
      success: true,
      data: { id: 'ecg-001', rhythm: 'normal_sinus', heart_rate: 72 },
    });
    mockCreateObservationsFromEcg.mockResolvedValue(undefined);
  });

  it('renders rhythm dropdown with all options', () => {
    render(<ECGResultForm {...defaultProps} />);
    expect(screen.getByText('Record ECG Result')).toBeInTheDocument();
    expect(screen.getByText('Select rhythm...')).toBeInTheDocument();
    expect(screen.getByText(/Heart Rate/)).toBeInTheDocument();
  });

  it('renders interval inputs (PR, QRS, QTc, Axis)', () => {
    render(<ECGResultForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('120-200')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('80-120')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('350-450')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('-30 to 90')).toBeInTheDocument();
  });

  it('renders ST changes dropdown and STEMI checkbox', () => {
    render(<ECGResultForm {...defaultProps} />);
    expect(screen.getByText('ST Changes')).toBeInTheDocument();
    expect(screen.getByText('STEMI Detected')).toBeInTheDocument();
    expect(screen.getByText('Normal ECG')).toBeInTheDocument();
  });

  it('disables submit when rhythm is not selected', () => {
    render(<ECGResultForm {...defaultProps} />);
    // Button disabled because !rhythm is true
    expect(screen.getByText('Save ECG Result')).toBeDisabled();
    expect(mockCreateEcgResult).not.toHaveBeenCalled();
  });

  it('disables submit when heart rate is missing', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    // Select rhythm via first combobox (rhythm select)
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'normal_sinus');

    // Button still disabled because !heartRate is true
    expect(screen.getByText('Save ECG Result')).toBeDisabled();
    expect(mockCreateEcgResult).not.toHaveBeenCalled();
  });

  it('submits form with rhythm and heart rate and calls service', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    // First combobox = rhythm
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'normal_sinus');

    const hrInput = screen.getByPlaceholderText('e.g. 72');
    await user.type(hrInput, '72');

    await user.click(screen.getByText('Save ECG Result'));

    await waitFor(() => {
      expect(mockCreateEcgResult).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 'patient-001',
          tenant_id: 'tenant-001',
          registry_id: 'reg-001',
          rhythm: 'normal_sinus',
          heart_rate: 72,
        })
      );
    });
  });

  it('generates FHIR Observations after successful save', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'normal_sinus');
    const hrInput = screen.getByPlaceholderText('e.g. 72');
    await user.type(hrInput, '72');

    await user.click(screen.getByText('Save ECG Result'));

    await waitFor(() => {
      expect(mockCreateObservationsFromEcg).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ecg-001' })
      );
    });
  });

  it('shows success message after recording', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'normal_sinus');
    const hrInput = screen.getByPlaceholderText('e.g. 72');
    await user.type(hrInput, '72');

    await user.click(screen.getByText('Save ECG Result'));

    await waitFor(() => {
      expect(screen.getByText('ECG result recorded')).toBeInTheDocument();
    });
  });

  it('shows STEMI alert on success when STEMI is checked', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'normal_sinus');
    const hrInput = screen.getByPlaceholderText('e.g. 72');
    await user.type(hrInput, '72');

    // Check STEMI
    await user.click(screen.getByText('STEMI Detected'));

    await user.click(screen.getByText('Save ECG Result'));

    await waitFor(() => {
      expect(screen.getByText(/STEMI DETECTED/)).toBeInTheDocument();
      expect(screen.getByText(/Activate cath lab protocol/)).toBeInTheDocument();
    });
  });

  it('shows error when service fails', async () => {
    mockCreateEcgResult.mockResolvedValue({ success: false, error: 'Database error' });
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'normal_sinus');
    const hrInput = screen.getByPlaceholderText('e.g. 72');
    await user.type(hrInput, '72');

    await user.click(screen.getByText('Save ECG Result'));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[0]);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('includes interval values in service call when provided', async () => {
    const user = userEvent.setup();
    render(<ECGResultForm {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'sinus_bradycardia');

    const hrInput = screen.getByPlaceholderText('e.g. 72');
    await user.type(hrInput, '55');

    const prInput = screen.getByPlaceholderText('120-200');
    await user.type(prInput, '180');

    const qrsInput = screen.getByPlaceholderText('80-120');
    await user.type(qrsInput, '100');

    await user.click(screen.getByText('Save ECG Result'));

    await waitFor(() => {
      expect(mockCreateEcgResult).toHaveBeenCalledWith(
        expect.objectContaining({
          rhythm: 'sinus_bradycardia',
          heart_rate: 55,
          pr_interval_ms: 180,
          qrs_duration_ms: 100,
        })
      );
    });
  });
});
