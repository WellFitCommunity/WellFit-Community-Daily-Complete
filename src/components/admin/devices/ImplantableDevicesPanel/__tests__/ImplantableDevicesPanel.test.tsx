/**
 * Tests for ImplantableDevicesPanel orchestrator.
 *
 * Covers the list/load/refresh lifecycle and the join between Devices
 * and their latest DeviceUseStatement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImplantableDevicesPanel } from '../index';
import { DeviceService } from '../../../../../services/fhir/DeviceService';
import { DeviceUseStatementService } from '../../../../../services/fhir/DeviceUseStatementService';
import { useOrderingProvider } from '../../../../../hooks/useOrderingProvider';

vi.mock('../../../../../services/fhir/DeviceService', () => ({
  DeviceService: { getByPatient: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../../../services/fhir/DeviceUseStatementService', () => ({
  DeviceUseStatementService: { getByPatient: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../../../hooks/useOrderingProvider', () => ({
  useOrderingProvider: vi.fn(),
}));

const mockedGetDevices = vi.mocked(DeviceService.getByPatient);
const mockedGetStatements = vi.mocked(DeviceUseStatementService.getByPatient);
const mockedProvider = vi.mocked(useOrderingProvider);

const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDevices.mockReset();
  mockedGetStatements.mockReset();
  mockedProvider.mockReturnValue({
    loading: false,
    error: null,
    tenant_id: 'tenant-x',
    user_id: 'user-x',
    display_name: 'Dr. X',
    practitioner_id: null,
  });
});

describe('ImplantableDevicesPanel — list + refresh behavior', () => {
  it('renders empty-state copy when the patient has no devices', async () => {
    mockedGetDevices.mockResolvedValueOnce({ success: true, data: [] });
    mockedGetStatements.mockResolvedValueOnce({ success: true, data: [] });

    render(<ImplantableDevicesPanel patientId={PATIENT_ID} />);

    expect(
      await screen.findByText(/no implanted devices on file/i)
    ).toBeInTheDocument();
    expect(mockedGetDevices).toHaveBeenCalledWith(PATIENT_ID);
    expect(mockedGetStatements).toHaveBeenCalledWith(PATIENT_ID);
  });

  it('renders each device with its latest DeviceUseStatement metadata joined in', async () => {
    mockedGetDevices.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'dev-1',
          patient_id: PATIENT_ID,
          status: 'active',
          device_type_display: 'Coronary artery stent',
          manufacturer: 'Acme Stent Co',
          model_number: 'CS-200',
          serial_number: 'SN-001',
        },
      ] as never,
    });
    mockedGetStatements.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'dus-1',
          patient_id: PATIENT_ID,
          device_id: 'dev-1',
          status: 'active',
          recorded_on: '2026-05-20T00:00:00.000Z',
          timing_datetime: '2026-05-15T00:00:00.000Z',
          body_site_display: 'Chest',
        },
        // Older statement on the same device — should be ignored in favor of the newer one
        {
          id: 'dus-0',
          patient_id: PATIENT_ID,
          device_id: 'dev-1',
          status: 'intended',
          recorded_on: '2026-01-01T00:00:00.000Z',
          timing_datetime: '2025-12-15T00:00:00.000Z',
          body_site_display: 'Abdomen',
        },
      ] as never,
    });

    render(<ImplantableDevicesPanel patientId={PATIENT_ID} />);

    expect(await screen.findByText(/coronary artery stent/i)).toBeInTheDocument();
    expect(screen.getByText(/acme stent co/i)).toBeInTheDocument();
    expect(screen.getByText('SN-001')).toBeInTheDocument();
    // The LATEST statement's body site is shown, not the old one
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.queryByText('Abdomen')).not.toBeInTheDocument();
  });

  it('surfaces a load error from DeviceService.getByPatient and does not crash on a statements-only failure', async () => {
    mockedGetDevices.mockResolvedValueOnce({ success: false, error: 'RLS bounced' });
    mockedGetStatements.mockResolvedValueOnce({ success: true, data: [] });

    render(<ImplantableDevicesPanel patientId={PATIENT_ID} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/rls bounced/i);
  });

  it('opens the AddDeviceForm when "Add device" is clicked, and closes it on cancel', async () => {
    mockedGetDevices.mockResolvedValueOnce({ success: true, data: [] });
    mockedGetStatements.mockResolvedValueOnce({ success: true, data: [] });

    render(<ImplantableDevicesPanel patientId={PATIENT_ID} />);

    await waitFor(() => expect(mockedGetDevices).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add device/i }));
    expect(await screen.findByRole('form', { name: /add device/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('form', { name: /add device/i })).not.toBeInTheDocument();
    });
  });
});
