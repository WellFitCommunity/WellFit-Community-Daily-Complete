/**
 * FetalMonitoringForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FetalMonitoringForm from '../FetalMonitoringForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createFetalMonitoring: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

const mockProps = {
  patientId: 'patient-1',
  tenantId: 'tenant-1',
  pregnancyId: 'preg-1',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('FetalMonitoringForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all key form fields', () => {
    render(<FetalMonitoringForm {...mockProps} />);
    expect(screen.getByText('Fetal Heart Rate Monitoring')).toBeInTheDocument();
    expect(screen.getByLabelText('FHR Baseline (bpm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Variability')).toBeInTheDocument();
    expect(screen.getByLabelText('Decelerations')).toBeInTheDocument();
    expect(screen.getByLabelText('FHR Category')).toBeInTheDocument();
  });

  it('shows validation error when FHR baseline is empty', async () => {
    const user = userEvent.setup();
    render(<FetalMonitoringForm {...mockProps} />);

    await user.click(screen.getByText('Save Monitoring'));

    expect(screen.getByRole('alert')).toHaveTextContent('FHR baseline is required.');
    expect(LaborDeliveryService.createFetalMonitoring).not.toHaveBeenCalled();
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createFetalMonitoring).mockResolvedValue({
      success: true,
    });

    render(<FetalMonitoringForm {...mockProps} />);

    await user.type(screen.getByLabelText('FHR Baseline (bpm)'), '145');

    await user.click(screen.getByText('Save Monitoring'));

    await waitFor(() => {
      expect(LaborDeliveryService.createFetalMonitoring).toHaveBeenCalledTimes(1);
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service returns failure', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createFetalMonitoring).mockResolvedValue({
      success: false,
      error: 'Database error',
    });

    render(<FetalMonitoringForm {...mockProps} />);
    await user.type(screen.getByLabelText('FHR Baseline (bpm)'), '145');
    await user.click(screen.getByText('Save Monitoring'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database error');
    });
    expect(mockProps.onSuccess).not.toHaveBeenCalled();
  });

  it('allows selecting FHR category III', async () => {
    const user = userEvent.setup();
    render(<FetalMonitoringForm {...mockProps} />);

    await user.selectOptions(screen.getByLabelText('FHR Category'), 'III');

    expect((screen.getByLabelText('FHR Category') as HTMLSelectElement).value).toBe('III');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<FetalMonitoringForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
