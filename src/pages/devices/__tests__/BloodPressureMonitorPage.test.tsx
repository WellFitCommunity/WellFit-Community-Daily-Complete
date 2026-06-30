import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BloodPressureMonitorPage from '../BloodPressureMonitorPage';
import { DeviceService } from '../../../services/deviceService';
import type { BleVitalReading } from '../../../types/ble';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      secondaryColor: '#5bb5ac',
      gradient: 'linear-gradient(135deg, #00857a 0%, #5bb5ac 100%)',
    },
  }),
}));

vi.mock('../../../services/deviceService', () => ({
  DeviceService: {
    getBPReadings: vi.fn(),
    saveBPReading: vi.fn(),
    connectDevice: vi.fn(),
  },
}));

// Controllable mock of the BLE capture hook. `state` is read on each render;
// `onReading` captures the page's handler so a test can deliver a reading.
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

const FRIENDLY_NAME_KEY = 'ble_friendly_name_blood_pressure';

const bpReading = (systolic: number, diastolic: number, pulse: number) => ({
  id: `${systolic}-${diastolic}`,
  user_id: 'user-1',
  device_id: 'ble',
  systolic,
  diastolic,
  pulse,
  measured_at: '2026-06-30T08:00:00Z',
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <BloodPressureMonitorPage />
    </MemoryRouter>
  );

describe('BloodPressureMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset the BLE hook to a supported, idle Android-style default.
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
    // Default service implementations (clearAllMocks does not reset these).
    vi.mocked(DeviceService.getBPReadings).mockResolvedValue({ success: true, data: [] });
    vi.mocked(DeviceService.saveBPReading).mockResolvedValue({ success: true, data: bpReading(120, 80, 72) });
    vi.mocked(DeviceService.connectDevice).mockResolvedValue({
      success: true,
      data: {
        id: 'conn-1',
        user_id: 'user-1',
        device_type: 'bp_monitor',
        device_name: 'BP Cuff',
        connected: true,
        last_sync: null,
        created_at: '2026-06-30T00:00:00Z',
      },
    });
  });

  describe('Rendering', () => {
    it('renders the header and BP guide', async () => {
      renderPage();
      expect(screen.getByText('Blood Pressure Monitor')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Blood Pressure Guide')).toBeInTheDocument());
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Elevated')).toBeInTheDocument();
    });
  });

  describe('Bluetooth capability gating', () => {
    it('on a supported (Android) device, shows a Connect button that triggers pairing', async () => {
      renderPage();
      const connectBtn = await screen.findByRole('button', { name: /connect blood pressure cuff/i });
      expect(connectBtn).toBeInTheDocument();
      fireEvent.click(connectBtn);
      expect(bleControl.pair).toHaveBeenCalledTimes(1);
    });

    it('on iPhone/iPad (no Web Bluetooth), shows manual-only message and NO pair button', async () => {
      bleControl.state.isSupported = false;
      bleControl.state.isIOS = true;
      bleControl.state.capabilityMessage =
        'Bluetooth is not supported in Safari. Please use camera or manual entry.';

      renderPage();

      await waitFor(() =>
        expect(screen.getByText(/Bluetooth isn’t available on this device/i)).toBeInTheDocument()
      );
      expect(screen.getByText(/not supported in Safari/i)).toBeInTheDocument();
      // No pairing affordance on iPhone — manual entry only.
      expect(screen.queryByRole('button', { name: /connect/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add reading/i })).toBeInTheDocument();
    });
  });

  describe('Device-name memory', () => {
    it('labels the Connect button with the remembered friendly name', async () => {
      localStorage.setItem(FRIENDLY_NAME_KEY, 'Rose’s Cuff');
      renderPage();
      expect(await screen.findByRole('button', { name: /connect rose’s cuff/i })).toBeInTheDocument();
    });
  });

  describe('Connected state', () => {
    it('shows the connected device name and a Disconnect button that disconnects', async () => {
      bleControl.state.status = 'connected';
      bleControl.state.deviceName = 'Rose’s Cuff';

      renderPage();

      await waitFor(() => expect(screen.getByText(/Connected: Rose’s Cuff/i)).toBeInTheDocument());
      const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectBtn);
      await waitFor(() => expect(bleControl.disconnect).toHaveBeenCalledTimes(1));
    });
  });

  describe('Reading capture', () => {
    it('persists a Bluetooth reading and shows it in the list', async () => {
      vi.mocked(DeviceService.getBPReadings)
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValue({ success: true, data: [bpReading(120, 80, 72)] });

      renderPage();
      await screen.findByText(/no readings yet/i);

      // Simulate the cuff sending a reading over Bluetooth.
      const reading: BleVitalReading = {
        deviceType: 'blood_pressure',
        timestamp: '2026-06-30T08:00:00Z',
        values: [
          { type: 'systolic', value: 120, unit: 'mmHg' },
          { type: 'diastolic', value: 80, unit: 'mmHg' },
          { type: 'pulse_rate', value: 72, unit: 'bpm' },
        ],
      };
      await act(async () => {
        await bleControl.onReading?.(reading);
      });

      await waitFor(() =>
        expect(DeviceService.saveBPReading).toHaveBeenCalledWith(
          expect.objectContaining({ systolic: 120, diastolic: 80, pulse: 72 })
        )
      );
      expect(await screen.findByText('120/80')).toBeInTheDocument();
    });

    it('does not save an incomplete reading and warns the user', async () => {
      renderPage();
      await screen.findByText(/no readings yet/i);

      const incomplete: BleVitalReading = {
        deviceType: 'blood_pressure',
        timestamp: '2026-06-30T08:00:00Z',
        values: [{ type: 'systolic', value: 120, unit: 'mmHg' }], // missing diastolic
      };
      await act(async () => {
        await bleControl.onReading?.(incomplete);
      });

      expect(DeviceService.saveBPReading).not.toHaveBeenCalled();
      expect(await screen.findByText(/came through incomplete/i)).toBeInTheDocument();
    });
  });

  describe('Manual entry & navigation', () => {
    it('shows the inline manual entry form when Add Reading is clicked', async () => {
      renderPage();
      const addBtn = await screen.findByRole('button', { name: /add reading/i });
      fireEvent.click(addBtn);
      await waitFor(() => {
        expect(screen.getByText('Blood Pressure Reading')).toBeInTheDocument();
        expect(screen.getByLabelText(/Systolic/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Diastolic/)).toBeInTheDocument();
      });
    });

    it('navigates back to My Health', async () => {
      renderPage();
      const backBtn = await screen.findByRole('button', { name: /back to my health/i });
      fireEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/my-health');
    });
  });
});
