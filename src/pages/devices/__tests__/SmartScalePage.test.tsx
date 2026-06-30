import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SmartScalePage from '../SmartScalePage';
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
    getWeightReadings: vi.fn(),
    saveWeightReading: vi.fn(),
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

const FRIENDLY_NAME_KEY = 'ble_friendly_name_weight_scale';

const weightReading = (weight: number) => ({
  id: `w-${weight}`,
  user_id: 'user-1',
  device_id: 'ble',
  weight,
  unit: 'lbs' as const,
  measured_at: '2026-06-30T08:00:00Z',
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SmartScalePage />
    </MemoryRouter>
  );

describe('SmartScalePage', () => {
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
    vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({ success: true, data: [] });
    vi.mocked(DeviceService.saveWeightReading).mockResolvedValue({ success: true, data: weightReading(165) });
    vi.mocked(DeviceService.connectDevice).mockResolvedValue({
      success: true,
      data: {
        id: 'conn-1',
        user_id: 'user-1',
        device_type: 'smart_scale',
        device_name: 'Scale',
        connected: true,
        last_sync: null,
        created_at: '2026-06-30T00:00:00Z',
      },
    });
  });

  it('shows a Connect button on a supported device and triggers pairing', async () => {
    renderPage();
    const btn = await screen.findByRole('button', { name: /connect scale/i });
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
    localStorage.setItem(FRIENDLY_NAME_KEY, 'Bathroom Scale');
    renderPage();
    expect(await screen.findByRole('button', { name: /connect bathroom scale/i })).toBeInTheDocument();
  });

  it('persists a Bluetooth weight reading (mapping lb → lbs) and shows it', async () => {
    vi.mocked(DeviceService.getWeightReadings)
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValue({ success: true, data: [weightReading(165)] });

    renderPage();
    await screen.findByText(/no readings yet/i);

    const reading: BleVitalReading = {
      deviceType: 'weight_scale',
      timestamp: '2026-06-30T08:00:00Z',
      values: [{ type: 'weight', value: 165, unit: 'lb' }],
    };
    await act(async () => {
      await bleControl.onReading?.(reading);
    });

    await waitFor(() =>
      expect(DeviceService.saveWeightReading).toHaveBeenCalledWith(
        expect.objectContaining({ weight: 165, unit: 'lbs' })
      )
    );
    expect(await screen.findByText(/165 lbs/i)).toBeInTheDocument();
  });

  it('shows the inline manual entry form', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /add reading/i }));
    await waitFor(() => expect(screen.getByText('Weight Measurement')).toBeInTheDocument());
  });

  it('navigates back to My Health', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /back to my health/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/my-health');
  });
});
