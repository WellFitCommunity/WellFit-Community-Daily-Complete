/**
 * MedicationAlertOverrideModal Test Suite
 *
 * Tests: reason dropdown, 20-char validation, signature required,
 * weekly count warning, submit flow.
 * Deletion Test: All tests fail if modal logic is removed.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MedicationAlertOverrideModal } from '../MedicationAlertOverrideModal';

// Mock medicationOverrideService
const mockRecordOverride = vi.fn();
const mockGetWeeklyCount = vi.fn();

vi.mock('../../../services/medicationOverrideService', () => ({
  medicationOverrideService: {
    recordOverride: (...args: unknown[]) => mockRecordOverride(...args),
    getProviderWeeklyCount: (...args: unknown[]) => mockGetWeeklyCount(...args),
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'test-provider-id', email: 'dr.test@hospital.com' }),
}));

const defaultProps = {
  onClose: vi.fn(),
  onOverrideComplete: vi.fn(),
  alertType: 'contraindication' as const,
  alertSeverity: 'high' as const,
  alertDescription: 'Drug X is contraindicated with Condition Y due to increased bleeding risk',
  alertRecommendations: ['Consider Drug Z as alternative', 'Monitor INR closely'],
  medicationName: 'Drug X',
  patientId: 'patient-123',
};

describe('MedicationAlertOverrideModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWeeklyCount.mockResolvedValue({ success: true, data: 1 });
    mockRecordOverride.mockResolvedValue({ success: true, data: { id: 'override-1' } });
  });

  it('displays severity-colored warning header with medication name', () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    expect(screen.getByText(/HIGH SEVERITY: Drug X/)).toBeInTheDocument();
  });

  it('displays alert description', () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    expect(screen.getByText(/Drug X is contraindicated with Condition Y/)).toBeInTheDocument();
  });

  it('displays clinical recommendations', () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    expect(screen.getByText(/Consider Drug Z as alternative/)).toBeInTheDocument();
    expect(screen.getByText(/Monitor INR closely/)).toBeInTheDocument();
  });

  it('renders reason dropdown with all 7 options', () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Check that all reason options are present
    expect(screen.getByText(/Clinical Judgment/)).toBeInTheDocument();
    expect(screen.getByText(/Patient-Specific Exception/)).toBeInTheDocument();
    expect(screen.getByText(/Documented Tolerance/)).toBeInTheDocument();
    expect(screen.getByText(/Informed Consent/)).toBeInTheDocument();
    expect(screen.getByText(/Palliative/)).toBeInTheDocument();
    expect(screen.getByText(/Monitoring Plan/)).toBeInTheDocument();
    expect(screen.getByText(/Other/)).toBeInTheDocument();
  });

  it('shows error when explanation is under 20 characters', async () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    const explanation = screen.getByPlaceholderText(/clinical justification/i);
    fireEvent.change(explanation, { target: { value: 'short' } });

    const signatureInput = screen.getByPlaceholderText(/type your full name/i);
    fireEvent.change(signatureInput, { target: { value: 'Dr. Test' } });

    const submitButton = screen.getByRole('button', { name: /override and proceed/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
    });

    expect(mockRecordOverride).not.toHaveBeenCalled();
  });

  it('shows error when signature is whitespace-only', async () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    // Provide valid explanation
    const explanation = screen.getByPlaceholderText(/clinical justification/i);
    fireEvent.change(explanation, { target: { value: 'This is a valid clinical justification for the override' } });

    // Fill signature with whitespace (passes HTML required, fails trim check)
    const signatureInput = screen.getByPlaceholderText(/type your full name/i);
    fireEvent.change(signatureInput, { target: { value: '   ' } });

    const submitButton = screen.getByRole('button', { name: /override and proceed/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/signature is required/i)).toBeInTheDocument();
    });

    expect(mockRecordOverride).not.toHaveBeenCalled();
  });

  it('displays weekly override count', async () => {
    mockGetWeeklyCount.mockResolvedValue({ success: true, data: 1 });
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Override #2 of 3 this week/i)).toBeInTheDocument();
    });
  });

  it('shows escalation warning when threshold reached', async () => {
    mockGetWeeklyCount.mockResolvedValue({ success: true, data: 3 });
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/MANAGER WILL BE NOTIFIED/)).toBeInTheDocument();
    });
  });

  it('submits successfully with valid data', async () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    const explanation = screen.getByPlaceholderText(/clinical justification/i);
    fireEvent.change(explanation, { target: { value: 'Patient has tolerated this drug for 5 years. Benefits outweigh risks.' } });

    const signatureInput = screen.getByPlaceholderText(/type your full name/i);
    fireEvent.change(signatureInput, { target: { value: 'Dr. Test Provider' } });

    const submitButton = screen.getByRole('button', { name: /override and proceed/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRecordOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_type: 'contraindication',
          alert_severity: 'high',
          medication_name: 'Drug X',
          patient_id: 'patient-123',
          provider_signature: 'Dr. Test Provider',
        })
      );
    });

    expect(defaultProps.onOverrideComplete).toHaveBeenCalled();
  });

  it('calls onClose when cancel button clicked', () => {
    render(<MedicationAlertOverrideModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows error on service failure', async () => {
    mockRecordOverride.mockResolvedValue({ success: false, error: { message: 'Service unavailable', code: 'MEDICATION_OVERRIDE_FAILED' } });

    render(<MedicationAlertOverrideModal {...defaultProps} />);

    const explanation = screen.getByPlaceholderText(/clinical justification/i);
    fireEvent.change(explanation, { target: { value: 'This is a valid clinical justification for the override' } });

    const signatureInput = screen.getByPlaceholderText(/type your full name/i);
    fireEvent.change(signatureInput, { target: { value: 'Dr. Test' } });

    const submitButton = screen.getByRole('button', { name: /override and proceed/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Service unavailable/)).toBeInTheDocument();
    });

    expect(defaultProps.onOverrideComplete).not.toHaveBeenCalled();
  });

  it('displays contraindicated severity header correctly', () => {
    render(
      <MedicationAlertOverrideModal
        {...defaultProps}
        alertSeverity="contraindicated"
      />
    );

    expect(screen.getByText(/CONTRAINDICATED: Drug X/)).toBeInTheDocument();
  });
});
