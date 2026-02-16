/**
 * PostpartumAssessmentForm Tests
 * Tier 1-2: Tests form rendering, validation, and service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostpartumAssessmentForm from '../PostpartumAssessmentForm';
import { LaborDeliveryService } from '../../../services/laborDelivery';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createPostpartumAssessment: vi.fn(),
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

describe('PostpartumAssessmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all key form fields', () => {
    render(<PostpartumAssessmentForm {...mockProps} />);
    expect(screen.getByText('Postpartum Assessment')).toBeInTheDocument();
    expect(screen.getByLabelText('Hours Postpartum')).toBeInTheDocument();
    expect(screen.getByLabelText('Fundal Height')).toBeInTheDocument();
    expect(screen.getByLabelText('BP Systolic')).toBeInTheDocument();
    expect(screen.getByLabelText('Breastfeeding Status')).toBeInTheDocument();
    expect(screen.getByLabelText('EPDS Score (0-30)')).toBeInTheDocument();
  });

  it('shows validation error when hours postpartum is empty', async () => {
    const user = userEvent.setup();
    render(<PostpartumAssessmentForm {...mockProps} />);

    await user.click(screen.getByText('Save Assessment'));

    expect(screen.getByRole('alert')).toHaveTextContent('Hours postpartum is required.');
    expect(LaborDeliveryService.createPostpartumAssessment).not.toHaveBeenCalled();
  });

  it('validates blood pressure fields', async () => {
    const user = userEvent.setup();
    render(<PostpartumAssessmentForm {...mockProps} />);

    await user.type(screen.getByLabelText('Hours Postpartum'), '4');
    await user.click(screen.getByText('Save Assessment'));

    expect(screen.getByRole('alert')).toHaveTextContent('Blood pressure is required.');
  });

  it('calls service with correct data on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPostpartumAssessment).mockResolvedValue({
      success: true,
    });

    render(<PostpartumAssessmentForm {...mockProps} />);

    await user.type(screen.getByLabelText('Hours Postpartum'), '4');
    await user.type(screen.getByLabelText('Fundal Height'), 'U/U');
    await user.type(screen.getByLabelText('BP Systolic'), '118');
    await user.type(screen.getByLabelText('BP Diastolic'), '72');
    await user.type(screen.getByLabelText('Heart Rate'), '78');
    await user.type(screen.getByLabelText('Temp (C)'), '36.8');
    await user.type(screen.getByLabelText('Pain Score (0-10)'), '3');

    await user.click(screen.getByText('Save Assessment'));

    await waitFor(() => {
      expect(LaborDeliveryService.createPostpartumAssessment).toHaveBeenCalledTimes(1);
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('shows error when service returns failure', async () => {
    const user = userEvent.setup();
    vi.mocked(LaborDeliveryService.createPostpartumAssessment).mockResolvedValue({
      success: false,
      error: 'DB error',
    });

    render(<PostpartumAssessmentForm {...mockProps} />);

    await user.type(screen.getByLabelText('Hours Postpartum'), '4');
    await user.type(screen.getByLabelText('Fundal Height'), 'U/U');
    await user.type(screen.getByLabelText('BP Systolic'), '118');
    await user.type(screen.getByLabelText('BP Diastolic'), '72');
    await user.type(screen.getByLabelText('Heart Rate'), '78');
    await user.type(screen.getByLabelText('Temp (C)'), '36.8');
    await user.type(screen.getByLabelText('Pain Score (0-10)'), '3');

    await user.click(screen.getByText('Save Assessment'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DB error');
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<PostpartumAssessmentForm {...mockProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
