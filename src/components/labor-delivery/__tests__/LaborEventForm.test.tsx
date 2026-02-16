/**
 * LaborEventForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaborEventForm from '../LaborEventForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createLaborEvent: vi.fn(),
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

describe('LaborEventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required form fields', () => {
    render(<LaborEventForm {...mockProps} />);
    expect(screen.getByText('Record Labor Event')).toBeInTheDocument();
    expect(screen.getByLabelText('Event Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Labor Stage')).toBeInTheDocument();
    expect(screen.getByLabelText('Dilation (cm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Effacement (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Station (-5 to +5)')).toBeInTheDocument();
    expect(screen.getByLabelText('Membranes')).toBeInTheDocument();
  });

  it('renders contraction and maternal vital fields', () => {
    render(<LaborEventForm {...mockProps} />);
    expect(screen.getByLabelText('Contractions / 10 min')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration (sec)')).toBeInTheDocument();
    expect(screen.getByLabelText('Intensity')).toBeInTheDocument();
    expect(screen.getByLabelText('Maternal BP Sys')).toBeInTheDocument();
    expect(screen.getByLabelText('Maternal HR')).toBeInTheDocument();
  });

  it('shows validation error when cervical exam fields are empty', async () => {
    const user = userEvent.setup();
    render(<LaborEventForm {...mockProps} />);

    await user.click(screen.getByText('Save Event'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dilation, effacement, and station are required.'
    );
    expect(LaborDeliveryService.createLaborEvent).not.toHaveBeenCalled();
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createLaborEvent).mockResolvedValue({
      success: true,
    });

    render(<LaborEventForm {...mockProps} />);

    await user.type(screen.getByLabelText('Dilation (cm)'), '5');
    await user.type(screen.getByLabelText('Effacement (%)'), '80');
    await user.clear(screen.getByLabelText('Station (-5 to +5)'));
    await user.type(screen.getByLabelText('Station (-5 to +5)'), '-1');

    await user.click(screen.getByText('Save Event'));

    await waitFor(() => {
      expect(LaborDeliveryService.createLaborEvent).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(LaborDeliveryService.createLaborEvent).mock.calls[0][0];
    expect(callArgs.dilation_cm).toBe(5);
    expect(callArgs.effacement_percent).toBe(80);
    expect(callArgs.station).toBe(-1);
    expect(callArgs.stage).toBe('latent_phase');
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service fails', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createLaborEvent).mockResolvedValue({
      success: false,
      error: 'Insert failed',
    });

    render(<LaborEventForm {...mockProps} />);

    await user.type(screen.getByLabelText('Dilation (cm)'), '5');
    await user.type(screen.getByLabelText('Effacement (%)'), '80');

    await user.click(screen.getByText('Save Event'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Insert failed');
    });
  });

  it('allows selecting labor stage', async () => {
    const user = userEvent.setup();
    render(<LaborEventForm {...mockProps} />);

    const stageSelect = screen.getByLabelText('Labor Stage');
    await user.selectOptions(stageSelect, 'active_phase');

    expect(stageSelect).toHaveValue('active_phase');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<LaborEventForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
