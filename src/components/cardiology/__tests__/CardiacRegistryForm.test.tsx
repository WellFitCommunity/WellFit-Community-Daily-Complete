/**
 * CardiacRegistryForm Tests
 * Behavioral tests for cardiac patient enrollment form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardiacRegistryForm from '../CardiacRegistryForm';

// Mock cardiologyService
const mockCreateRegistry = vi.fn();
vi.mock('../../../services/cardiology', () => ({
  CardiologyService: {
    createRegistry: (...args: unknown[]) => mockCreateRegistry(...args),
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
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('CardiacRegistryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRegistry.mockResolvedValue({ success: true, data: { id: 'reg-001' } });
  });

  it('renders all condition checkboxes', () => {
    render(<CardiacRegistryForm {...defaultProps} />);
    expect(screen.getByText('Coronary Artery Disease')).toBeInTheDocument();
    expect(screen.getByText('Heart Failure')).toBeInTheDocument();
    expect(screen.getByText('Atrial Fibrillation')).toBeInTheDocument();
    // Hypertension appears in both conditions and risk factors
    expect(screen.getAllByText('Hypertension')).toHaveLength(2);
    expect(screen.getByText('Cardiomyopathy')).toBeInTheDocument();
    expect(screen.getByText('Valvular Disease')).toBeInTheDocument();
  });

  it('renders all risk factor checkboxes', () => {
    render(<CardiacRegistryForm {...defaultProps} />);
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    expect(screen.getByText('Smoking')).toBeInTheDocument();
    expect(screen.getByText('Obesity')).toBeInTheDocument();
    expect(screen.getByText('Prior MI')).toBeInTheDocument();
  });

  it('renders NYHA class dropdown and LVEF input', () => {
    render(<CardiacRegistryForm {...defaultProps} />);
    expect(screen.getByText('NYHA Class')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 55')).toBeInTheDocument();
  });

  it('disables submit button when no conditions selected', () => {
    render(<CardiacRegistryForm {...defaultProps} />);

    const submitBtn = screen.getByText('Enroll Patient');
    expect(submitBtn).toBeDisabled();
    expect(mockCreateRegistry).not.toHaveBeenCalled();
  });

  it('submits form with selected conditions and calls service', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    // Select a condition
    await user.click(screen.getByText('Heart Failure'));
    // Select a risk factor
    await user.click(screen.getByText('Diabetes'));

    await user.click(screen.getByText('Enroll Patient'));

    await waitFor(() => {
      expect(mockCreateRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 'patient-001',
          tenant_id: 'tenant-001',
          conditions: ['heart_failure'],
          risk_factors: ['diabetes'],
        })
      );
    });
  });

  it('shows NYHA description when class is selected', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    // There is one combobox in the form — the NYHA select
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'III');

    expect(screen.getByText(/Marked limitation/)).toBeInTheDocument();
  });

  it('shows LVEF interpretation when value entered', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    const lvefInput = screen.getByPlaceholderText('e.g. 55');
    await user.type(lvefInput, '35');

    expect(screen.getByText(/Moderately reduced/)).toBeInTheDocument();
  });

  it('shows CHA2DS2-VASc calculator when AFib is selected', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    // Select Atrial Fibrillation
    await user.click(screen.getByText('Atrial Fibrillation'));

    expect(screen.getByText(/CHA2DS2-VASc Score/)).toBeInTheDocument();
    expect(screen.getByText('Patient Age')).toBeInTheDocument();
  });

  it('auto-calculates CHA2DS2-VASc score from inputs', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    // Select AFib to show calculator
    await user.click(screen.getByText('Atrial Fibrillation'));
    // Select Heart Failure (+1)
    await user.click(screen.getByText('Heart Failure'));
    // Select Hypertension condition (+1) — first one in the Conditions fieldset
    const htnCheckboxes = screen.getAllByText('Hypertension');
    await user.click(htnCheckboxes[0]);
    // Enter age 76 (+2 for >=75) — second spinbutton (after LVEF)
    const spinbuttons = screen.getAllByRole('spinbutton');
    const ageInput = spinbuttons[1]; // [0]=LVEF, [1]=age
    await user.type(ageInput, '76');

    // CHF(1) + HTN(1) + Age>=75(2) = 4
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('shows success message after enrollment', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    await user.click(screen.getByText('Heart Failure'));
    await user.click(screen.getByText('Enroll Patient'));

    await waitFor(() => {
      expect(screen.getByText('Patient enrolled in cardiac registry')).toBeInTheDocument();
    });
  });

  it('shows error when service fails', async () => {
    mockCreateRegistry.mockResolvedValue({ success: false, error: 'Database error' });
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    await user.click(screen.getByText('Heart Failure'));
    await user.click(screen.getByText('Enroll Patient'));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[0]);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('toggles conditions on and off', async () => {
    const user = userEvent.setup();
    render(<CardiacRegistryForm {...defaultProps} />);

    const hfCheckbox = screen.getByText('Heart Failure');
    await user.click(hfCheckbox); // Check — enables submit
    await user.click(hfCheckbox); // Uncheck — disables submit

    // Submit button should be disabled since no conditions selected
    expect(screen.getByText('Enroll Patient')).toBeDisabled();
  });
});
