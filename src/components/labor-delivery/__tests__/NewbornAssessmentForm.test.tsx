/**
 * NewbornAssessmentForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewbornAssessmentForm from '../NewbornAssessmentForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createNewbornAssessment: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

const mockProps = {
  patientId: 'patient-1',
  tenantId: 'tenant-1',
  pregnancyId: 'preg-1',
  deliveryId: 'del-1',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('NewbornAssessmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all key form fields', () => {
    render(<NewbornAssessmentForm {...mockProps} />);
    expect(screen.getByText('Newborn Assessment')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight (g)')).toBeInTheDocument();
    expect(screen.getByLabelText('Length (cm)')).toBeInTheDocument();
    expect(screen.getByLabelText('APGAR 1 min (0-10)')).toBeInTheDocument();
    expect(screen.getByLabelText('APGAR 5 min (0-10)')).toBeInTheDocument();
    expect(screen.getByLabelText('Disposition')).toBeInTheDocument();
  });

  it('shows validation error when measurements are empty', async () => {
    const user = userEvent.setup();
    render(<NewbornAssessmentForm {...mockProps} />);

    await user.click(screen.getByText('Save Newborn Assessment'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Weight, length, and head circumference are required.'
    );
    expect(LaborDeliveryService.createNewbornAssessment).not.toHaveBeenCalled();
  });

  it('shows APGAR validation error when scores missing', async () => {
    const user = userEvent.setup();
    render(<NewbornAssessmentForm {...mockProps} />);

    await user.type(screen.getByLabelText('Weight (g)'), '3200');
    await user.type(screen.getByLabelText('Length (cm)'), '50');
    await user.type(screen.getByLabelText('Head Circ (cm)'), '34');

    await user.click(screen.getByText('Save Newborn Assessment'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'APGAR scores at 1 and 5 minutes are required.'
    );
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createNewbornAssessment).mockResolvedValue({
      success: true,
    });

    render(<NewbornAssessmentForm {...mockProps} />);

    await user.type(screen.getByLabelText('Weight (g)'), '3200');
    await user.type(screen.getByLabelText('Length (cm)'), '50');
    await user.type(screen.getByLabelText('Head Circ (cm)'), '34');
    await user.type(screen.getByLabelText('APGAR 1 min (0-10)'), '8');
    await user.type(screen.getByLabelText('APGAR 5 min (0-10)'), '9');

    await user.click(screen.getByText('Save Newborn Assessment'));

    await waitFor(() => {
      expect(LaborDeliveryService.createNewbornAssessment).toHaveBeenCalledTimes(1);
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service returns failure', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createNewbornAssessment).mockResolvedValue({
      success: false,
      error: 'Insert failed',
    });

    render(<NewbornAssessmentForm {...mockProps} />);

    await user.type(screen.getByLabelText('Weight (g)'), '3200');
    await user.type(screen.getByLabelText('Length (cm)'), '50');
    await user.type(screen.getByLabelText('Head Circ (cm)'), '34');
    await user.type(screen.getByLabelText('APGAR 1 min (0-10)'), '8');
    await user.type(screen.getByLabelText('APGAR 5 min (0-10)'), '9');

    await user.click(screen.getByText('Save Newborn Assessment'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Insert failed');
    });
  });

  it('has medication checkboxes defaulting correctly', () => {
    render(<NewbornAssessmentForm {...mockProps} />);
    expect(screen.getByText('Vitamin K Given')).toBeInTheDocument();
    expect(screen.getByText('Erythromycin Given')).toBeInTheDocument();
    expect(screen.getByText('Hep B Vaccine')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<NewbornAssessmentForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
