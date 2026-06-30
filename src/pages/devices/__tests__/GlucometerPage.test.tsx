import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlucometerPage from '../GlucometerPage';
import { DeviceService } from '../../../services/deviceService';
import type { BleVitalReading } from '../../../types/ble';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ branding: { primaryColor: '#00857a', secondaryColor: '#5bb5ac', gradient: 'g' } }),
}));

vi.mock('../../../services/deviceService', () => ({
  DeviceService: {
    getGlucoseReadings: vi.fn(),
    saveGlucoseReading: vi.fn(),
    connectDevice: vi.fn(),
  },
}));

const bleControl = vi.hoisted(() => ({
  state: {
    isSupported: true,
    isIOS: false,
    capabilityMessage: null as string | null,
    status: 'idle' as string,
    deviceName: null as string | null,
    lastReading: null as unknown,
    error: null as string | null,
  },
  onReading: null as ((r: BleVitalReading) => void | Promise<void>) | null,
  pair: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../../../hooks/useBleCapture', () => ({
  useBleCapture: (opts: { onReading: (r: BleVitalReading) => void | Promise<void> }) => {
    bleControl.onReading = opts.onReading;
    return { ...bleControl.state, pair: bleControl.pair, disconnect: bleControl.disconnect };
  },
}));

const FRIENDLY_NAME_KEY = 'ble_friendly_name_glucose_meter';

const glucoseReading = (value: number) => ({
  id: `g-${value}`,
  user_id: 'user-1',
  device_id: 'ble',
  value,
  meal_context: 'fasting' as const,
  measured_at: '2026-06-30T08:00:00Z',
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <GlucometerPage />
    </MemoryRouter>
  );

describe('GlucometerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    bleControl.state = {
      isSupported: true,
      isIOS: false,
      capabilityMessage: null,
      status: 'idle',
      deviceName: null,
      lastReading: null,
      error: null,
    };
    bleControl.onReading = null;
    vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({ success: true, data: [] });
    vi.mocked(DeviceService.saveGlucoseReading).mockResolvedValue({ success: true, data: glucoseReading(110) });
    vi.mocked(DeviceService.connectDevice).mockResolvedValue({
      success: true,
      data: {
        id: 'conn-1',
        user_id: 'user-1',
        device_type: 'glucometer',
        device_name: 'Meter',
        connected: true,
        last_sync: null,
        created_at: '2026-06-30T00:00:00Z',
      },
    });
  });

  it('shows a Connect button on a supported device and triggers pairing', async () => {
    renderPage();
    const btn = await screen.findByRole('button', { name: /connect glucometer/i });
    fireEvent.click(btn);
    expect(bleControl.pair).toHaveBeenCalledTimes(1);
  });

  it('on iPhone shows manual-only message and no pair button', async () => {
    bleControl.state.isSupported = false;
    bleControl.state.isIOS = true;
    bleControl.state.capabilityMessage = 'Bluetooth is not supported in Safari. Please use camera or manual entry.';

    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Bluetooth isn’t available on this device/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /connect/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add reading/i })).toBeInTheDocument();
  });

  it('labels the Connect button with the remembered friendly name', async () => {
    localStorage.setItem(FRIENDLY_NAME_KEY, 'Rose Meter');
    renderPage();
    expect(await screen.findByRole('button', { name: /connect rose meter/i })).toBeInTheDocument();
  });

  it('persists a Bluetooth glucose reading and shows it', async () => {
    vi.mocked(DeviceService.getGlucoseReadings)
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValue({ success: true, data: [glucoseReading(110)] });

    renderPage();
    await screen.findByText(/no readings yet/i);

    const reading: BleVitalReading = {
      deviceType: 'glucose_meter',
      timestamp: '2026-06-30T08:00:00Z',
      values: [{ type: 'glucose', value: 110, unit: 'mg/dL' }],
    };
    await act(async () => {
      await bleControl.onReading?.(reading);
    });

    await waitFor(() =>
      expect(DeviceService.saveGlucoseReading).toHaveBeenCalledWith(
        expect.objectContaining({ value: 110, meal_context: 'fasting' })
      )
    );
    expect(await screen.findByText('110')).toBeInTheDocument();
  });

  it('shows the inline manual entry form', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /add reading/i }));
    await waitFor(() => expect(screen.getByText('Blood Glucose Reading')).toBeInTheDocument());
  });

  it('navigates back to My Health', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /back to my health/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/my-health');
  });
});
