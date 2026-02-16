/**
 * DeliveryRecordForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeliveryRecordForm from '../DeliveryRecordForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createDeliveryRecord: vi.fn(),
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

describe('DeliveryRecordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required form fields', () => {
    render(<DeliveryRecordForm {...mockProps} />);
    expect(screen.getByText('Record Delivery')).toBeInTheDocument();
    expect(screen.getByLabelText('Delivery Date/Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Delivery Method')).toBeInTheDocument();
    expect(screen.getByLabelText('Anesthesia')).toBeInTheDocument();
    expect(screen.getByLabelText('Est. Blood Loss (mL)')).toBeInTheDocument();
    expect(screen.getByLabelText('Cord Clamping')).toBeInTheDocument();
  });

  it('renders delivery method options', () => {
    render(<DeliveryRecordForm {...mockProps} />);
    const methodSelect = screen.getByLabelText('Delivery Method');
    expect(methodSelect).toBeInTheDocument();
    expect(screen.getByText('Spontaneous Vaginal')).toBeInTheDocument();
    expect(screen.getByText('Cesarean (Emergent)')).toBeInTheDocument();
    expect(screen.getByText('VBAC')).toBeInTheDocument();
  });

  it('shows validation error when EBL is empty', async () => {
    const user = userEvent.setup();
    render(<DeliveryRecordForm {...mockProps} />);

    await user.click(screen.getByText('Save Delivery Record'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Estimated blood loss is required.'
    );
    expect(LaborDeliveryService.createDeliveryRecord).not.toHaveBeenCalled();
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createDeliveryRecord).mockResolvedValue({
      success: true,
    });

    render(<DeliveryRecordForm {...mockProps} />);

    await user.type(screen.getByLabelText('Est. Blood Loss (mL)'), '300');
    await user.selectOptions(screen.getByLabelText('Delivery Method'), 'cesarean_planned');
    await user.selectOptions(screen.getByLabelText('Anesthesia'), 'spinal');

    await user.click(screen.getByText('Save Delivery Record'));

    await waitFor(() => {
      expect(LaborDeliveryService.createDeliveryRecord).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(LaborDeliveryService.createDeliveryRecord).mock.calls[0][0];
    expect(callArgs.estimated_blood_loss_ml).toBe(300);
    expect(callArgs.method).toBe('cesarean_planned');
    expect(callArgs.anesthesia).toBe('spinal');
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service fails', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createDeliveryRecord).mockResolvedValue({
      success: false,
      error: 'Delivery insert failed',
    });

    render(<DeliveryRecordForm {...mockProps} />);

    await user.type(screen.getByLabelText('Est. Blood Loss (mL)'), '300');

    await user.click(screen.getByText('Save Delivery Record'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Delivery insert failed');
    });
  });

  it('includes episiotomy and placenta checkboxes', () => {
    render(<DeliveryRecordForm {...mockProps} />);
    expect(screen.getByText('Episiotomy')).toBeInTheDocument();
    expect(screen.getByText('Placenta Intact')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeliveryRecordForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
