/**
 * EchoResultForm Tests
 * Behavioral tests for echocardiogram data entry form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EchoResultForm from '../EchoResultForm';

// Mock cardiologyService
const mockCreateEchoResult = vi.fn();
vi.mock('../../../services/cardiology', () => ({
  CardiologyService: {
    createEchoResult: (...args: unknown[]) => mockCreateEchoResult(...args),
  },
}));

// Mock FHIR observation service
const mockCreateObservationFromEcho = vi.fn();
vi.mock('../../../services/fhir/cardiology', () => ({
  CardiologyObservationService: {
    createObservationFromEcho: (...args: unknown[]) => mockCreateObservationFromEcho(...args),
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

describe('EchoResultForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEchoResult.mockResolvedValue({
      success: true,
      data: { id: 'echo-001', lvef_percent: 55 },
    });
    mockCreateObservationFromEcho.mockResolvedValue(undefined);
  });

  it('renders LVEF input and RV function dropdown', () => {
    render(<EchoResultForm {...defaultProps} />);
    expect(screen.getByText('Record Echocardiogram')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 55')).toBeInTheDocument();
    expect(screen.getByText('RV Function')).toBeInTheDocument();
  });

  it('renders LV dimension inputs', () => {
    render(<EchoResultForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('35-56')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('20-40')).toBeInTheDocument();
  });

  it('renders valve assessment for all four valves', () => {
    render(<EchoResultForm {...defaultProps} />);
    expect(screen.getByText('Valve Assessment')).toBeInTheDocument();
    expect(screen.getByText('mitral')).toBeInTheDocument();
    expect(screen.getByText('aortic')).toBeInTheDocument();
    expect(screen.getByText('tricuspid')).toBeInTheDocument();
    expect(screen.getByText('pulmonic')).toBeInTheDocument();
  });

  it('renders wall motion abnormality checkboxes', () => {
    render(<EchoResultForm {...defaultProps} />);
    expect(screen.getByText('Wall Motion Abnormalities')).toBeInTheDocument();
    expect(screen.getByText('anterior')).toBeInTheDocument();
    expect(screen.getByText('septal')).toBeInTheDocument();
    expect(screen.getByText('inferior')).toBeInTheDocument();
    expect(screen.getByText('apical')).toBeInTheDocument();
  });

  it('disables submit button when LVEF is empty', () => {
    render(<EchoResultForm {...defaultProps} />);
    // Button disabled because !lvefPercent is true
    expect(screen.getByText('Save Echo Result')).toBeDisabled();
    expect(mockCreateEchoResult).not.toHaveBeenCalled();
  });

  it('shows LVEF interpretation when value entered', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '30');

    expect(screen.getByText(/Severely reduced/i)).toBeInTheDocument();
  });

  it('submits form with LVEF and calls service', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '55');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(mockCreateEchoResult).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 'patient-001',
          tenant_id: 'tenant-001',
          registry_id: 'reg-001',
          lvef_percent: 55,
          rv_function: 'normal',
        })
      );
    });
  });

  it('generates FHIR Observation after successful save', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '55');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(mockCreateObservationFromEcho).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'echo-001' })
      );
    });
  });

  it('shows success message after recording', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '55');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(screen.getByText('Echocardiogram result recorded')).toBeInTheDocument();
    });
  });

  it('shows reduced LVEF warning on success when LVEF < 40', async () => {
    mockCreateEchoResult.mockResolvedValue({
      success: true,
      data: { id: 'echo-002', lvef_percent: 25 },
    });

    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '25');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(screen.getByText(/LVEF 25%/)).toBeInTheDocument();
    });
  });

  it('shows error when service fails', async () => {
    mockCreateEchoResult.mockResolvedValue({ success: false, error: 'Save failed' });
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '55');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[0]);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('toggles wall motion abnormalities', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    // Select wall motion regions
    await user.click(screen.getByText('anterior'));
    await user.click(screen.getByText('septal'));

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '40');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(mockCreateEchoResult).toHaveBeenCalledWith(
        expect.objectContaining({
          wall_motion_abnormalities: ['anterior', 'septal'],
        })
      );
    });
  });

  it('includes pericardial effusion when checked', async () => {
    const user = userEvent.setup();
    render(<EchoResultForm {...defaultProps} />);

    await user.click(screen.getByText('Pericardial Effusion'));

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '50');

    await user.click(screen.getByText('Save Echo Result'));

    await waitFor(() => {
      expect(mockCreateEchoResult).toHaveBeenCalledWith(
        expect.objectContaining({
          pericardial_effusion: true,
        })
      );
    });
  });
});
