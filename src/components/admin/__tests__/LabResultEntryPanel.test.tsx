/**
 * LabResultEntryPanel behavioral tests (L-1)
 * Deletion test: every assertion fails if the panel's logic is removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const saveLabResultMock = vi.fn();
vi.mock('../../../services/labResultEntryService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/labResultEntryService')>(
    '../../../services/labResultEntryService'
  );
  return {
    ...actual,
    labResultEntryService: {
      saveLabResult: (...args: unknown[]) => saveLabResultMock(...args),
    },
  };
});

const profilesSearchMock = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          limit: (...args: unknown[]) => profilesSearchMock(...args),
        })),
      })),
    })),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import LabResultEntryPanel from '../LabResultEntryPanel';

describe('LabResultEntryPanel', () => {
  beforeEach(() => {
    saveLabResultMock.mockReset();
    profilesSearchMock.mockReset();
    profilesSearchMock.mockResolvedValue({
      data: [{ user_id: 'patient-test-alpha-id', first_name: 'Test', last_name: 'Patient Alpha' }],
      error: null,
    });
    saveLabResultMock.mockResolvedValue({
      success: true,
      data: {
        labResultId: 'lab-1', observationId: 'obs-1', diagnosticReportId: 'dr-1',
        escalations: [], criticalAlertFired: false,
      },
    });
  });

  async function pickPatient() {
    fireEvent.change(screen.getByLabelText('Patient'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Search'));
    const option = await screen.findByText(/Test Patient Alpha/);
    fireEvent.click(option);
  }

  it('searches and selects a patient, then saves a result with the normalized test key', async () => {
    render(<LabResultEntryPanel />);
    await pickPatient();

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '4.2' } });
    fireEvent.click(screen.getByText('Save Result'));

    await waitFor(() => expect(saveLabResultMock).toHaveBeenCalledTimes(1));
    const payload = saveLabResultMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.patientId).toBe('patient-test-alpha-id');
    expect(payload.testKey).toBe('potassium');
    expect(payload.valueNumeric).toBe(4.2);
    expect(payload.unit).toBe('mmol/L');
    expect(payload.abnormalFlag).toBe('normal');

    await screen.findByText('Result saved');
  });

  it('shows the critical care-team banner when the outcome fired an alert', async () => {
    saveLabResultMock.mockResolvedValue({
      success: true,
      data: {
        labResultId: 'lab-1', observationId: 'obs-1', diagnosticReportId: 'dr-1',
        escalations: [{ id: 'r1', severity: 'critical', route_to_specialty: 'cardiology' }],
        criticalAlertFired: true,
      },
    });
    render(<LabResultEntryPanel />);
    await pickPatient();

    fireEvent.change(screen.getByLabelText('Result flag'), { target: { value: 'critical_high' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '6.2' } });
    fireEvent.click(screen.getByText('Save Result'));

    await screen.findByText('Critical result saved — care team alerted');
    expect(screen.getByText(/cardiology/)).toBeInTheDocument();
  });

  it('disables save until a patient and numeric value are present', async () => {
    render(<LabResultEntryPanel />);
    expect(screen.getByText('Save Result').closest('button')).toBeDisabled();

    await pickPatient();
    expect(screen.getByText('Save Result').closest('button')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'not-a-number' } });
    expect(screen.getByText('Save Result').closest('button')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '4.2' } });
    expect(screen.getByText('Save Result').closest('button')).not.toBeDisabled();
  });

  it('surfaces a save failure instead of swallowing it', async () => {
    saveLabResultMock.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Failed to save the lab result.' },
    });
    render(<LabResultEntryPanel />);
    await pickPatient();
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '4.2' } });
    fireEvent.click(screen.getByText('Save Result'));

    await screen.findByText('Failed to save the lab result.');
  });

  it('prefills unit and reference range when the test changes', async () => {
    render(<LabResultEntryPanel />);
    fireEvent.change(screen.getByLabelText('Test'), { target: { value: 'hemoglobin' } });
    expect((screen.getByLabelText('Unit') as HTMLInputElement).value).toBe('g/dL');
    expect((screen.getByLabelText('Reference range') as HTMLInputElement).value).toBe('12.0-17.5');
  });
});
