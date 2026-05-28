/**
 * Tests for LabOrderForm — ONC 170.315(a)(2) CPOE for laboratory orders.
 *
 * Each test is behavioral — would fail if the component rendered an empty
 * <div /> (per CLAUDE.md deletion test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LabOrderForm } from '../index';
import { ServiceRequestService } from '../../../../../services/fhir/ServiceRequestService';

vi.mock('../../../../../services/fhir/ServiceRequestService', () => ({
  ServiceRequestService: {
    create: vi.fn(),
  },
}));

const mockedCreate = vi.mocked(ServiceRequestService.create);

const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/test or panel/i), {
    target: { value: 'Comprehensive Metabolic Panel' },
  });
  // SNOMED code for venous blood (per cpoe.ts SPECIMEN_TYPES)
  fireEvent.change(screen.getByLabelText(/specimen type/i), {
    target: { value: '122555007' },
  });
  fireEvent.change(screen.getByLabelText(/clinical indication/i), {
    target: { value: 'Type 2 diabetes monitoring (ICD-10: E11.9)' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreate.mockReset();
  mockedCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'sr-456',
      patient_id: PATIENT_ID,
      status: 'active',
      intent: 'order',
      category: ['laboratory'],
      code: 'Comprehensive Metabolic Panel',
      code_display: 'Comprehensive Metabolic Panel',
      authored_on: '2026-05-28T00:00:00.000Z',
    } as never,
  });
});

describe('LabOrderForm — ONC (a)(2) CPOE behavior', () => {
  describe('field validation', () => {
    it('blocks submit when test name is empty', async () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/test or panel name is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when specimen type is not selected', async () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/specimen type/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/specimen type is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when clinical indication is empty (required for ONC (a)(2))', async () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/clinical indication/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/clinical indication is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('submit — FHIR ServiceRequest shape', () => {
    it('persists a FHIR ServiceRequest with category=["laboratory"]', async () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));

      await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
      const arg = mockedCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      expect(arg.status).toBe('active');
      expect(arg.intent).toBe('order');
      // The category discriminator is what separates labs from imaging
      expect(arg.category).toEqual(['laboratory']);
      expect(arg.code_display).toBe('Comprehensive Metabolic Panel');
      // Default LOINC system on lab orders
      expect(arg.code_system).toBe('http://loinc.org');
      // SNOMED specimen display gets persisted
      expect(arg.specimen_type).toMatch(/venous/i);
      expect(arg.reason_code).toEqual(['Type 2 diabetes monitoring (ICD-10: E11.9)']);
      expect(arg.priority).toBe('routine');
      expect(arg.fasting_required).toBe(false);
      expect(arg.authored_on).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('passes fasting_required=true when the checkbox is checked', async () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByLabelText(/fasting required/i));
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].fasting_required).toBe(true);
    });

    it('passes encounterId through when provided', async () => {
      render(<LabOrderForm patientId={PATIENT_ID} encounterId="enc-xyz" />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].encounter_id).toBe('enc-xyz');
    });

    it('invokes onSubmitted with the new ServiceRequest id', async () => {
      const onSubmitted = vi.fn();
      render(<LabOrderForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('sr-456'));
    });
  });

  describe('error surfacing', () => {
    it('shows a warning banner when the service returns an error', async () => {
      mockedCreate.mockResolvedValueOnce({ success: false, error: 'Network failure' });
      render(<LabOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/network failure/i);
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<LabOrderForm patientId={PATIENT_ID} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalled();
    });

    it('does not render a cancel button when onCancel is not provided', () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
    });
  });

  describe('does not duplicate medication-form fields (architectural sister-form guard)', () => {
    it('has no medication-only fields (dose, route, frequency)', () => {
      render(<LabOrderForm patientId={PATIENT_ID} />);
      // The lab form should NOT carry over medication-specific inputs from
      // the MedicationOrderForm template.
      expect(screen.queryByLabelText(/^dose$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^unit$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/route of administration/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^frequency$/i)).not.toBeInTheDocument();
    });
  });
});
