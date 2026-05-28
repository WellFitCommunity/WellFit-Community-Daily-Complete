/**
 * Tests for the MedicationOrderForm (ONC 170.315(a)(1)).
 *
 * Each test is behavioral — would fail if the component rendered an empty
 * <div /> (per CLAUDE.md deletion test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MedicationOrderForm } from '../index';
import { MedicationRequestService } from '../../../../../services/fhir/MedicationRequestService';
import { useOrderingProvider } from '../../../../../hooks/useOrderingProvider';

vi.mock('../../../../../services/fhir/MedicationRequestService', () => ({
  MedicationRequestService: {
    create: vi.fn(),
  },
}));

vi.mock('../../../../../hooks/useOrderingProvider', () => ({
  useOrderingProvider: vi.fn(),
}));

const mockedCreate = vi.mocked(MedicationRequestService.create);
const mockedProvider = vi.mocked(useOrderingProvider);

const TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';
const REQUESTER_USER_ID = '11111111-1111-1111-1111-111111111111';
const PRACTITIONER_ID = '22222222-2222-2222-2222-222222222222';

function setProviderReady() {
  mockedProvider.mockReturnValue({
    loading: false,
    error: null,
    tenant_id: TENANT_ID,
    user_id: REQUESTER_USER_ID,
    display_name: 'Dr. Test Provider',
    practitioner_id: PRACTITIONER_ID,
  });
}

const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^medication$/i), {
    target: { value: 'Lisinopril 10 mg tablet' },
  });
  fireEvent.change(screen.getByLabelText(/^dose$/i), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText(/^unit$/i), { target: { value: 'mg' } });
  fireEvent.change(screen.getByLabelText(/route of administration/i), {
    target: { value: '26643006' },
  });
  fireEvent.change(screen.getByLabelText(/^frequency$/i), {
    target: { value: 'Once daily' },
  });
  fireEvent.change(screen.getByLabelText(/clinical indication/i), {
    target: { value: 'Hypertension (ICD-10: I10)' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreate.mockReset();
  setProviderReady();
  mockedCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'mr-123',
      patient_id: PATIENT_ID,
      status: 'active',
      intent: 'order',
      medication_code: 'Lisinopril 10 mg tablet',
      medication_display: 'Lisinopril 10 mg tablet',
      authored_on: '2026-05-28T00:00:00.000Z',
    } as never,
  });
});

describe('MedicationOrderForm — ONC (a)(1) CPOE behavior', () => {
  describe('field validation', () => {
    it('blocks submit when medication name is empty and surfaces the field error', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/medication is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when dose is zero or negative (must be positive)', async () => {
      // Note: input[type=number] silently rejects non-numeric strings like 'abc'
      // (the DOM sets value to '' instead). Use 0 to exercise the positive-number
      // branch of the validator without fighting the browser's input filtering.
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/^dose$/i), { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/dose must be a positive number/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when route is not selected', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/route of administration/i), {
        target: { value: '' },
      });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/route of administration is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when frequency is not selected', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/^frequency$/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/frequency is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when clinical indication is empty (required for ONC (a)(1))', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/clinical indication/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/clinical indication is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('submit — successful FHIR shape', () => {
    it('calls MedicationRequestService.create with a FHIR-compliant payload', async () => {
      const onSubmitted = vi.fn();
      render(<MedicationOrderForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));

      await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
      const arg = mockedCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      expect(arg.status).toBe('active');
      expect(arg.intent).toBe('order');
      expect(arg.medication_display).toBe('Lisinopril 10 mg tablet');
      expect(arg.dosage_dose_quantity).toBe(10);
      expect(arg.dosage_dose_unit).toBe('mg');
      // SNOMED CT code for oral route
      expect(arg.dosage_route_code).toBe('26643006');
      expect(arg.dosage_timing_frequency).toBe(1);
      expect(arg.dosage_timing_period).toBe(1);
      expect(arg.dosage_timing_period_unit).toBe('d');
      expect(arg.reason_code).toEqual(['Hypertension (ICD-10: I10)']);
      expect(arg.priority).toBe('routine');
      expect(arg.authored_on).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('passes tenant_id and requester identity from useOrderingProvider — RLS + audit hard requirement', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      const arg = mockedCreate.mock.calls[0][0];
      // Without tenant_id the INSERT RLS policy on fhir_medication_requests rejects.
      expect(arg.tenant_id).toBe(TENANT_ID);
      // Requester identity preserves provider attribution on the order.
      expect(arg.requester_id).toBe(REQUESTER_USER_ID);
      expect(arg.requester_display).toBe('Dr. Test Provider');
      expect(arg.requester_practitioner_id).toBe(PRACTITIONER_ID);
    });

    it('passes encounterId through to the request when provided', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} encounterId="enc-abc" />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].encounter_id).toBe('enc-abc');
    });

    it('invokes onSubmitted with the new MedicationRequest id', async () => {
      const onSubmitted = vi.fn();
      render(<MedicationOrderForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('mr-123'));
    });
  });

  describe('ordering-provider gating', () => {
    it('disables submit and shows status banner while the provider is loading', () => {
      mockedProvider.mockReturnValue({
        loading: true,
        error: null,
        tenant_id: null,
        user_id: null,
        display_name: null,
        practitioner_id: null,
      });
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      const submit = screen.getByRole('button', { name: /loading/i });
      expect(submit).toBeDisabled();
    });

    it('blocks submit + shows the provider error when tenant resolution fails', async () => {
      mockedProvider.mockReturnValue({
        loading: false,
        error: 'Your profile is not assigned to a tenant. Contact your administrator.',
        tenant_id: null,
        user_id: REQUESTER_USER_ID,
        display_name: null,
        practitioner_id: null,
      });
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      expect(
        screen.getByText(/profile is not assigned to a tenant/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit order/i })).toBeDisabled();
      // Even if user somehow forced submit, the service must not be called.
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('safety — allergy block', () => {
    it('surfaces an allergy alert from the service and does NOT call onSubmitted', async () => {
      mockedCreate.mockResolvedValueOnce({
        success: false,
        error:
          'ALLERGY ALERT: Patient is allergic to lisinopril. Severity: severe. Anaphylaxis.',
      });
      const onSubmitted = vi.fn();
      render(<MedicationOrderForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/allergy alert/i);
      expect(alert).toHaveTextContent(/lisinopril/i);
      expect(onSubmitted).not.toHaveBeenCalled();
    });

    it('shows a less-severe banner when the service returns a non-allergy error', async () => {
      mockedCreate.mockResolvedValueOnce({
        success: false,
        error: 'Network failure',
      });
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/network failure/i);
      expect(alert).not.toHaveTextContent(/this order was blocked/i);
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<MedicationOrderForm patientId={PATIENT_ID} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalled();
    });

    it('does not render a cancel button when onCancel is not provided', () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
    });
  });

  describe('priority radio group', () => {
    it('defaults to routine', () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      const routine = screen.getByRole('radio', { name: /routine.*normal priority/i });
      expect(routine).toBeChecked();
    });

    it('allows selecting STAT', async () => {
      render(<MedicationOrderForm patientId={PATIENT_ID} />);
      const stat = screen.getByRole('radio', { name: /stat.*emergency/i });
      fireEvent.click(stat);
      expect(stat).toBeChecked();
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].priority).toBe('stat');
    });
  });
});
