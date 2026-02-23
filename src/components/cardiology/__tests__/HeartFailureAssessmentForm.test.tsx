/**
 * HeartFailureAssessmentForm Tests
 * Behavioral tests for HF clinical assessment form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeartFailureAssessmentForm from '../HeartFailureAssessmentForm';

const mockCreateHF = vi.fn();
vi.mock('../../../services/cardiology', () => ({
  CardiologyService: {
    createHeartFailureAssessment: (...args: unknown[]) => mockCreateHF(...args),
  },
}));

const mockCreateObservationFromHF = vi.fn();
vi.mock('../../../services/fhir/cardiology', () => ({
  CardiologyObservationService: {
    createObservationFromHF: (...args: unknown[]) => mockCreateObservationFromHF(...args),
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

describe('HeartFailureAssessmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateHF.mockResolvedValue({
      success: true,
      data: { id: 'hf-001', nyha_class: 'II', daily_weight_kg: 80 },
    });
    mockCreateObservationFromHF.mockResolvedValue(undefined);
  });

  it('renders NYHA class selection buttons', () => {
    render(<HeartFailureAssessmentForm {...defaultProps} />);
    expect(screen.getByText('Heart Failure Assessment')).toBeInTheDocument();
    // All 4 NYHA buttons rendered (use getAllByText since descriptions also contain "Class")
    const classButtons = screen.getAllByText(/^Class [IV]+$/);
    expect(classButtons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders BNP and weight inputs', () => {
    render(<HeartFailureAssessmentForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('e.g. 250')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 80.5')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 79.0')).toBeInTheDocument();
  });

  it('renders clinical signs checkboxes', () => {
    render(<HeartFailureAssessmentForm {...defaultProps} />);
    expect(screen.getByText('Dyspnea at Rest')).toBeInTheDocument();
    expect(screen.getByText('Orthopnea')).toBeInTheDocument();
    expect(screen.getByText(/PND/)).toBeInTheDocument();
    expect(screen.getByText(/JVD/)).toBeInTheDocument();
    expect(screen.getByText('Crackles')).toBeInTheDocument();
    expect(screen.getByText('S3 Gallop')).toBeInTheDocument();
  });

  it('disables submit when daily weight is empty', () => {
    render(<HeartFailureAssessmentForm {...defaultProps} />);
    expect(screen.getByText('Save HF Assessment')).toBeDisabled();
  });

  it('shows BNP interpretation when value entered', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    const bnpInput = screen.getByPlaceholderText('e.g. 250');
    await user.type(bnpInput, '500');

    expect(screen.getByText(/Elevated/)).toBeInTheDocument();
  });

  it('shows weight change alert when both weights entered', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    const dailyWeight = screen.getByPlaceholderText('e.g. 80.5');
    const previousWeight = screen.getByPlaceholderText('e.g. 79.0');

    await user.type(previousWeight, '78');
    await user.type(dailyWeight, '80');

    // +2.0 kg = ~4.4 lbs = high alert
    expect(screen.getByText(/Significant fluid retention/)).toBeInTheDocument();
  });

  it('submits form with weight and clinical signs', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    const dailyWeight = screen.getByPlaceholderText('e.g. 80.5');
    await user.type(dailyWeight, '80');

    // Check some clinical signs
    await user.click(screen.getByText('Orthopnea'));
    await user.click(screen.getByText('Crackles'));

    await user.click(screen.getByText('Save HF Assessment'));

    await waitFor(() => {
      expect(mockCreateHF).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 'patient-001',
          tenant_id: 'tenant-001',
          registry_id: 'reg-001',
          nyha_class: 'II',
          daily_weight_kg: 80,
          orthopnea: true,
          crackles: true,
          dyspnea_at_rest: false,
        })
      );
    });
  });

  it('generates FHIR Observation after successful save', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('e.g. 80.5'), '80');
    await user.click(screen.getByText('Save HF Assessment'));

    await waitFor(() => {
      expect(mockCreateObservationFromHF).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hf-001' })
      );
    });
  });

  it('shows success message after recording', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('e.g. 80.5'), '80');
    await user.click(screen.getByText('Save HF Assessment'));

    await waitFor(() => {
      expect(screen.getByText('Heart failure assessment recorded')).toBeInTheDocument();
    });
  });

  it('shows error when service fails', async () => {
    mockCreateHF.mockResolvedValue({ success: false, error: 'Database error' });
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('e.g. 80.5'), '80');
    await user.click(screen.getByText('Save HF Assessment'));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[0]);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('allows selecting NYHA class', async () => {
    const user = userEvent.setup();
    render(<HeartFailureAssessmentForm {...defaultProps} />);

    // Click Class III button
    await user.click(screen.getByText(/Class III/));
    await user.type(screen.getByPlaceholderText('e.g. 80.5'), '75');
    await user.click(screen.getByText('Save HF Assessment'));

    await waitFor(() => {
      expect(mockCreateHF).toHaveBeenCalledWith(
        expect.objectContaining({ nyha_class: 'III' })
      );
    });
  });
});
