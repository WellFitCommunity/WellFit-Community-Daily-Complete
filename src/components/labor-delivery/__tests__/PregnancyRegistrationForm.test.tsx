/**
 * PregnancyRegistrationForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PregnancyRegistrationForm from '../PregnancyRegistrationForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createPregnancy: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

const mockProps = {
  patientId: 'patient-1',
  tenantId: 'tenant-1',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('PregnancyRegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all key form fields', () => {
    render(<PregnancyRegistrationForm {...mockProps} />);
    expect(screen.getByRole('heading', { name: 'Register Pregnancy' })).toBeInTheDocument();
    expect(screen.getByLabelText('Estimated Due Date (EDD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Gravida (G)')).toBeInTheDocument();
    expect(screen.getByLabelText('Para (P)')).toBeInTheDocument();
    expect(screen.getByLabelText('Blood Type')).toBeInTheDocument();
    expect(screen.getByLabelText('GBS Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
  });

  it('shows validation error when EDD is empty', async () => {
    const user = userEvent.setup();
    render(<PregnancyRegistrationForm {...mockProps} />);

    await user.click(screen.getByRole('button', { name: 'Register Pregnancy' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Estimated due date is required.');
    expect(LaborDeliveryService.createPregnancy).not.toHaveBeenCalled();
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPregnancy).mockResolvedValue({
      success: true,
    });

    render(<PregnancyRegistrationForm {...mockProps} />);

    await user.type(screen.getByLabelText('Estimated Due Date (EDD)'), '2026-08-15');

    await user.click(screen.getByRole('button', { name: 'Register Pregnancy' }));

    await waitFor(() => {
      expect(LaborDeliveryService.createPregnancy).toHaveBeenCalledTimes(1);
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service returns failure', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPregnancy).mockResolvedValue({
      success: false,
      error: 'Patient already has active pregnancy',
    });

    render(<PregnancyRegistrationForm {...mockProps} />);

    await user.type(screen.getByLabelText('Estimated Due Date (EDD)'), '2026-08-15');

    await user.click(screen.getByRole('button', { name: 'Register Pregnancy' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Patient already has active pregnancy');
    });
  });

  it('displays risk factor checkboxes', () => {
    render(<PregnancyRegistrationForm {...mockProps} />);
    expect(screen.getByText('Gestational diabetes')).toBeInTheDocument();
    expect(screen.getByText('Preeclampsia')).toBeInTheDocument();
    expect(screen.getByText('Prior cesarean')).toBeInTheDocument();
  });

  it('allows toggling risk factors', async () => {
    const user = userEvent.setup();
    render(<PregnancyRegistrationForm {...mockProps} />);

    const gdCheckbox = screen.getByText('Gestational diabetes').previousElementSibling as HTMLInputElement;
    expect(gdCheckbox.checked).toBe(false);

    await user.click(gdCheckbox);
    expect(gdCheckbox.checked).toBe(true);

    await user.click(gdCheckbox);
    expect(gdCheckbox.checked).toBe(false);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<PregnancyRegistrationForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
