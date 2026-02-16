/**
 * MedicationAdminForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MedicationAdminForm from '../MedicationAdminForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createMedicationAdministration: vi.fn(),
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

describe('MedicationAdminForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all key form fields', () => {
    render(<MedicationAdminForm {...mockProps} />);
    expect(screen.getByText('Medication Administration')).toBeInTheDocument();
    expect(screen.getByLabelText('Medication')).toBeInTheDocument();
    expect(screen.getByLabelText('Dose')).toBeInTheDocument();
    expect(screen.getByLabelText('Route')).toBeInTheDocument();
    expect(screen.getByLabelText('Indication')).toBeInTheDocument();
  });

  it('shows validation error when medication name is empty', async () => {
    const user = userEvent.setup();
    render(<MedicationAdminForm {...mockProps} />);

    await user.click(screen.getByText('Save Medication'));

    expect(screen.getByRole('alert')).toHaveTextContent('Medication name is required.');
    expect(LaborDeliveryService.createMedicationAdministration).not.toHaveBeenCalled();
  });

  it('shows validation error when dose is empty', async () => {
    const user = userEvent.setup();
    render(<MedicationAdminForm {...mockProps} />);

    await user.type(screen.getByLabelText('Medication'), 'Pitocin');
    await user.click(screen.getByText('Save Medication'));

    expect(screen.getByRole('alert')).toHaveTextContent('Dose is required.');
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createMedicationAdministration).mockResolvedValue({
      success: true,
    });

    render(<MedicationAdminForm {...mockProps} />);

    await user.type(screen.getByLabelText('Medication'), 'Pitocin (Oxytocin)');
    await user.type(screen.getByLabelText('Dose'), '20 units/1000mL');

    await user.click(screen.getByText('Save Medication'));

    await waitFor(() => {
      expect(LaborDeliveryService.createMedicationAdministration).toHaveBeenCalledTimes(1);
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service returns failure', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createMedicationAdministration).mockResolvedValue({
      success: false,
      error: 'Medication insert failed',
    });

    render(<MedicationAdminForm {...mockProps} />);

    await user.type(screen.getByLabelText('Medication'), 'Pitocin');
    await user.type(screen.getByLabelText('Dose'), '20 units');

    await user.click(screen.getByText('Save Medication'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Medication insert failed');
    });
  });

  it('has route options available', () => {
    render(<MedicationAdminForm {...mockProps} />);
    const routeSelect = screen.getByLabelText('Route') as HTMLSelectElement;
    expect(routeSelect.options.length).toBe(6);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<MedicationAdminForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
