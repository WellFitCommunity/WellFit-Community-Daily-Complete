/**
 * Tests for ImagingOrderForm — ONC 170.315(a)(3) CPOE for imaging orders.
 *
 * Each test is behavioral — would fail if the component rendered an empty
 * <div /> (per CLAUDE.md deletion test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImagingOrderForm } from '../index';
import { ServiceRequestService } from '../../../../../services/fhir/ServiceRequestService';
import { useOrderingProvider } from '../../../../../hooks/useOrderingProvider';

vi.mock('../../../../../services/fhir/ServiceRequestService', () => ({
  ServiceRequestService: {
    create: vi.fn(),
  },
}));

vi.mock('../../../../../hooks/useOrderingProvider', () => ({
  useOrderingProvider: vi.fn(),
}));

const mockedCreate = vi.mocked(ServiceRequestService.create);
const mockedProvider = vi.mocked(useOrderingProvider);

const TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';
const REQUESTER_USER_ID = '11111111-1111-1111-1111-111111111111';
const PRACTITIONER_ID = '22222222-2222-2222-2222-222222222222';
const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

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

function fillRequiredFields() {
  // DICOM CT (per cpoe.ts IMAGING_MODALITIES)
  fireEvent.change(screen.getByLabelText(/modality/i), {
    target: { value: 'CT' },
  });
  fireEvent.change(screen.getByLabelText(/study description/i), {
    target: { value: 'Chest with IV contrast' },
  });
  // SNOMED Chest (per cpoe.ts BODY_SITES)
  fireEvent.change(screen.getByLabelText(/body site/i), {
    target: { value: '51185008' },
  });
  fireEvent.change(screen.getByLabelText(/clinical indication/i), {
    target: { value: 'Rule out pulmonary embolism (ICD-10: I26.99)' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreate.mockReset();
  setProviderReady();
  mockedCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'sr-789',
      patient_id: PATIENT_ID,
      status: 'active',
      intent: 'order',
      category: ['imaging'],
      code: 'CT',
      code_display: 'Computed Tomography: Chest with IV contrast',
      authored_on: '2026-05-28T00:00:00.000Z',
    } as never,
  });
});

describe('ImagingOrderForm — ONC (a)(3) CPOE behavior', () => {
  describe('field validation', () => {
    it('blocks submit when modality is not selected', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/modality is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when study description is empty', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/study description/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/study description is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when body site is not selected', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/body site/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/body site is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when clinical indication is empty (required for ONC (a)(3))', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/clinical indication/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      expect(await screen.findByText(/clinical indication is required/i)).toBeInTheDocument();
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('submit — FHIR ServiceRequest shape', () => {
    it('persists a FHIR ServiceRequest with category=["imaging"]', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));

      await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
      const arg = mockedCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      expect(arg.status).toBe('active');
      expect(arg.intent).toBe('order');
      // The category discriminator is what separates imaging from labs
      expect(arg.category).toEqual(['imaging']);
      // Modality+description combine into the human-readable display
      expect(arg.code_display).toBe('Computed Tomography: Chest with IV contrast');
      // No CPT provided — falls back to DICOM modality code
      expect(arg.code).toBe('CT');
      expect(arg.code_system).toBe('http://dicom.nema.org/resources/ontology/DCM');
      // SNOMED body site display gets persisted
      expect(arg.body_site).toMatch(/chest/i);
      expect(arg.reason_code).toEqual(['Rule out pulmonary embolism (ICD-10: I26.99)']);
      expect(arg.priority).toBe('routine');
      // Defaults: contrast unchecked, laterality N/A → undefined
      expect(arg.contrast_required).toBe(false);
      expect(arg.body_site_laterality).toBeUndefined();
      expect(arg.authored_on).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('prefers CPT code when provider supplies one', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      // The optional CPT field lives inside a collapsed <details> — same as
      // the lab form's LOINC field. The summary holds the visible label;
      // query the input directly by its placeholder.
      fireEvent.change(screen.getByPlaceholderText('e.g., 71260'), {
        target: { value: '71260' },
      });
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      const arg = mockedCreate.mock.calls[0][0];
      expect(arg.code).toBe('71260');
      expect(arg.code_system).toBe('http://www.ama-assn.org/go/cpt');
    });

    it('passes contrast_required=true when the checkbox is checked', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByLabelText(/contrast required/i));
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].contrast_required).toBe(true);
    });

    it('passes body_site_laterality when laterality is set (FHIR R4 — left/right/bilateral only)', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByLabelText(/^left$/i));
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].body_site_laterality).toBe('left');
    });

    it('passes tenant_id and requester identity from useOrderingProvider — RLS + audit hard requirement', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      const arg = mockedCreate.mock.calls[0][0];
      // Without tenant_id the INSERT RLS policy on fhir_service_requests rejects.
      expect(arg.tenant_id).toBe(TENANT_ID);
      // Requester identity preserves provider attribution on the order.
      expect(arg.requester_id).toBe(REQUESTER_USER_ID);
      expect(arg.requester_display).toBe('Dr. Test Provider');
      expect(arg.requester_practitioner_id).toBe(PRACTITIONER_ID);
    });

    it('passes encounterId through when provided', async () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} encounterId="enc-xyz" />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
      expect(mockedCreate.mock.calls[0][0].encounter_id).toBe('enc-xyz');
    });

    it('invokes onSubmitted with the new ServiceRequest id', async () => {
      const onSubmitted = vi.fn();
      render(<ImagingOrderForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('sr-789'));
    });
  });

  describe('ordering-provider gating', () => {
    it('disables submit while provider is loading', () => {
      mockedProvider.mockReturnValue({
        loading: true,
        error: null,
        tenant_id: null,
        user_id: null,
        display_name: null,
        practitioner_id: null,
      });
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    });

    it('blocks submit + surfaces the error when tenant resolution fails', async () => {
      mockedProvider.mockReturnValue({
        loading: false,
        error: 'Your profile is not assigned to a tenant. Contact your administrator.',
        tenant_id: null,
        user_id: REQUESTER_USER_ID,
        display_name: null,
        practitioner_id: null,
      });
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      expect(
        screen.getByText(/profile is not assigned to a tenant/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit order/i })).toBeDisabled();
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('error surfacing', () => {
    it('shows a warning banner when the service returns an error', async () => {
      mockedCreate.mockResolvedValueOnce({ success: false, error: 'Network failure' });
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /submit order/i }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/network failure/i);
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<ImagingOrderForm patientId={PATIENT_ID} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalled();
    });

    it('does not render a cancel button when onCancel is not provided', () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
    });
  });

  describe('does not duplicate lab-form fields (architectural sister-form guard)', () => {
    it('has no lab-only fields (specimen, fasting)', () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      // The imaging form should NOT carry over lab-specific inputs from
      // the LabOrderForm template.
      expect(screen.queryByLabelText(/specimen type/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/fasting required/i)).not.toBeInTheDocument();
    });

    it('has no medication-only fields (dose, route, frequency)', () => {
      render(<ImagingOrderForm patientId={PATIENT_ID} />);
      expect(screen.queryByLabelText(/^dose$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/route of administration/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^frequency$/i)).not.toBeInTheDocument();
    });
  });
});
