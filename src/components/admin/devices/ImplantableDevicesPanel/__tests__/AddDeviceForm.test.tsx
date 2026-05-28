/**
 * Tests for AddDeviceForm — ONC 170.315(a)(14) Implantable Device capture.
 *
 * Each test is behavioral — would fail if the component rendered an empty
 * <div /> (per CLAUDE.md deletion test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddDeviceForm } from '../AddDeviceForm';
import { DeviceService } from '../../../../../services/fhir/DeviceService';
import { DeviceUseStatementService } from '../../../../../services/fhir/DeviceUseStatementService';
import { useOrderingProvider } from '../../../../../hooks/useOrderingProvider';

vi.mock('../../../../../services/fhir/DeviceService', () => ({
  DeviceService: { create: vi.fn() },
}));
vi.mock('../../../../../services/fhir/DeviceUseStatementService', () => ({
  DeviceUseStatementService: { create: vi.fn() },
}));
vi.mock('../../../../../hooks/useOrderingProvider', () => ({
  useOrderingProvider: vi.fn(),
}));

const mockedDeviceCreate = vi.mocked(DeviceService.create);
const mockedDusCreate = vi.mocked(DeviceUseStatementService.create);
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
  fireEvent.change(screen.getByLabelText(/^device type$/i), {
    target: { value: 'Coronary artery stent' },
  });
  // SNOMED Chest (per cpoe.ts BODY_SITES)
  fireEvent.change(screen.getByLabelText(/^body site$/i), {
    target: { value: '51185008' },
  });
  fireEvent.change(screen.getByLabelText(/implant date/i), {
    target: { value: '2026-05-28' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedDeviceCreate.mockReset();
  mockedDusCreate.mockReset();
  setProviderReady();
  mockedDeviceCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'dev-123',
      patient_id: PATIENT_ID,
      status: 'active',
      device_type_display: 'Coronary artery stent',
    } as never,
  });
  mockedDusCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'dus-456',
      patient_id: PATIENT_ID,
      device_id: 'dev-123',
      status: 'active',
      recorded_on: '2026-05-28T00:00:00.000Z',
    } as never,
  });
});

describe('AddDeviceForm — ONC (a)(14) capture behavior', () => {
  describe('field validation', () => {
    it('blocks submit when device type is empty', async () => {
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));
      expect(await screen.findByText(/device type is required/i)).toBeInTheDocument();
      expect(mockedDeviceCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when body site is not selected', async () => {
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/^body site$/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));
      expect(await screen.findByText(/body site is required/i)).toBeInTheDocument();
      expect(mockedDeviceCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when implant date is missing', async () => {
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/implant date/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));
      expect(await screen.findByText(/implant date is required/i)).toBeInTheDocument();
      expect(mockedDeviceCreate).not.toHaveBeenCalled();
    });
  });

  describe('submit — FHIR Device + DeviceUseStatement shape', () => {
    it('persists a Device with tenant + identity fields', async () => {
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));

      await waitFor(() => expect(mockedDeviceCreate).toHaveBeenCalledTimes(1));
      const arg = mockedDeviceCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      expect(arg.status).toBe('active');
      expect(arg.device_type_display).toBe('Coronary artery stent');
      // Without tenant_id the INSERT RLS policy on fhir_devices rejects.
      expect(arg.tenant_id).toBe(TENANT_ID);
      // fhir_id is auto-generated per resource
      expect(arg.fhir_id).toMatch(/^device-/);
    });

    it('persists a DeviceUseStatement linking back to the new Device with implant context', async () => {
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByLabelText(/^left$/i));
      fireEvent.change(screen.getByLabelText(/indication for implant/i), {
        target: { value: 'Coronary artery disease (ICD-10: I25.10)' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));

      await waitFor(() => expect(mockedDusCreate).toHaveBeenCalledTimes(1));
      const arg = mockedDusCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      // The DUS references the newly created Device
      expect(arg.device_id).toBe('dev-123');
      expect(arg.status).toBe('active');
      // Implant context
      expect(arg.body_site_display).toMatch(/chest/i);
      expect(arg.body_site_code).toBe('51185008');
      expect(arg.body_site_system).toBe('http://snomed.info/sct');
      expect(arg.reason_code).toEqual(['Coronary artery disease (ICD-10: I25.10)']);
      expect(arg.note).toMatch(/laterality: left/i);
      // Identity
      expect(arg.tenant_id).toBe(TENANT_ID);
      expect(arg.source_user_id).toBe(REQUESTER_USER_ID);
      expect(arg.source_practitioner_id).toBe(PRACTITIONER_ID);
      expect(arg.source_display).toBe('Dr. Test Provider');
      // Implant date converts to ISO
      expect(arg.timing_datetime).toMatch(/^2026-05-28T/);
    });

    it('passes UDI fields through when scanned', async () => {
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/udi.*human-readable/i), {
        target: { value: '(01)00643169007009(17)241231(10)A12345' },
      });
      fireEvent.change(screen.getByLabelText(/device identifier.*catalog/i), {
        target: { value: '00643169007009' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));

      await waitFor(() => expect(mockedDeviceCreate).toHaveBeenCalled());
      const arg = mockedDeviceCreate.mock.calls[0][0];
      expect(arg.udi_carrier_hrf).toMatch(/00643169007009/);
      expect(arg.udi_device_identifier).toBe('00643169007009');
    });

    it('invokes onSubmitted with the new Device id when both resources persist', async () => {
      const onSubmitted = vi.fn();
      render(<AddDeviceForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('dev-123'));
    });

    it('surfaces a partial-success warning if the DeviceUseStatement insert fails', async () => {
      mockedDusCreate.mockResolvedValueOnce({ success: false, error: 'DUS RLS rejected' });
      const onSubmitted = vi.fn();
      render(<AddDeviceForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/dus rls rejected/i);
      expect(alert).toHaveTextContent(/device record was saved/i);
      // Don't fire onSubmitted on partial — the record set is incomplete
      expect(onSubmitted).not.toHaveBeenCalled();
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
      render(<AddDeviceForm patientId={PATIENT_ID} />);
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
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      expect(
        screen.getByText(/profile is not assigned to a tenant/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save device/i })).toBeDisabled();
      expect(mockedDeviceCreate).not.toHaveBeenCalled();
    });
  });

  describe('error surfacing', () => {
    it('shows a warning banner when the Device create returns an error and does NOT create a DUS', async () => {
      mockedDeviceCreate.mockResolvedValueOnce({ success: false, error: 'Network failure' });
      render(<AddDeviceForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save device/i }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/network failure/i);
      expect(mockedDusCreate).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<AddDeviceForm patientId={PATIENT_ID} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
