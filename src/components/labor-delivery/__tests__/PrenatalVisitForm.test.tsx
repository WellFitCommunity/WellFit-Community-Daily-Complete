/**
 * PrenatalVisitForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrenatalVisitForm from '../PrenatalVisitForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createPrenatalVisit: vi.fn(),
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

describe('PrenatalVisitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required form fields', () => {
    render(<PrenatalVisitForm {...mockProps} />);
    expect(screen.getByText('Record Prenatal Visit')).toBeInTheDocument();
    expect(screen.getByLabelText('Visit Date')).toBeInTheDocument();
    expect(screen.getByLabelText('GA Weeks')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('BP Systolic')).toBeInTheDocument();
    expect(screen.getByLabelText('BP Diastolic')).toBeInTheDocument();
    expect(screen.getByLabelText('Fetal HR (bpm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Fundal Height (cm)')).toBeInTheDocument();
  });

  it('shows validation error when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<PrenatalVisitForm {...mockProps} />);

    await user.click(screen.getByText('Save Visit'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'GA weeks, blood pressure, and weight are required.'
    );
    expect(LaborDeliveryService.createPrenatalVisit).not.toHaveBeenCalled();
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPrenatalVisit).mockResolvedValue({
      success: true,
    });

    render(<PrenatalVisitForm {...mockProps} />);

    await user.type(screen.getByLabelText('GA Weeks'), '28');
    await user.type(screen.getByLabelText('Weight (kg)'), '72.5');
    await user.type(screen.getByLabelText('BP Systolic'), '120');
    await user.type(screen.getByLabelText('BP Diastolic'), '80');

    await user.click(screen.getByText('Save Visit'));

    await waitFor(() => {
      expect(LaborDeliveryService.createPrenatalVisit).toHaveBeenCalledTimes(1);
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error message when service returns failure', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPrenatalVisit).mockResolvedValue({
      success: false,
      error: 'Database error',
    });

    render(<PrenatalVisitForm {...mockProps} />);

    await user.type(screen.getByLabelText('GA Weeks'), '28');
    await user.type(screen.getByLabelText('Weight (kg)'), '72.5');
    await user.type(screen.getByLabelText('BP Systolic'), '120');
    await user.type(screen.getByLabelText('BP Diastolic'), '80');

    await user.click(screen.getByText('Save Visit'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database error');
    });
    expect(mockProps.onSuccess).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<PrenatalVisitForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows saving state while request is in-flight', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPrenatalVisit).mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 50);
      })
    );

    render(<PrenatalVisitForm {...mockProps} />);

    await user.type(screen.getByLabelText('GA Weeks'), '28');
    await user.type(screen.getByLabelText('Weight (kg)'), '72.5');
    await user.type(screen.getByLabelText('BP Systolic'), '120');
    await user.type(screen.getByLabelText('BP Diastolic'), '80');

    await user.click(screen.getByText('Save Visit'));

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });
});
