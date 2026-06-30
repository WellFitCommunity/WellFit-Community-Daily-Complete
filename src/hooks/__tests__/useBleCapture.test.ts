import { renderHook, act, waitFor } from '@testing-library/react';
import { useBleCapture } from '../useBleCapture';
import { bleConnectionManager } from '../../services/ble/bleConnectionManager';
import type { BleVitalReading } from '../../types/ble';

interface MockCapabilities {
  hasCamera: boolean;
  hasWebBluetooth: boolean;
  hasSpeechRecognition: boolean;
  isSecureContext: boolean;
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
}

let mockCapabilities: MockCapabilities;

vi.mock('../../components/vitals/useCapabilities', () => ({
  useCapabilities: () => mockCapabilities,
  getCapabilityMessage: () => 'Bluetooth is not supported in this browser.',
}));

vi.mock('../../services/ble/bleConnectionManager', () => ({
  bleConnectionManager: {
    requestDevice: vi.fn(),
    connectDevice: vi.fn(),
    subscribeToReadings: vi.fn(),
    disconnectDevice: vi.fn(),
  },
}));

const ok = <T,>(data: T) => ({ success: true as const, data, error: null });
const fail = (message: string) => ({
  success: false as const,
  data: null,
  error: { code: 'EXTERNAL_SERVICE_ERROR' as const, message },
});

const SUPPORTED: MockCapabilities = {
  hasCamera: true,
  hasWebBluetooth: true,
  hasSpeechRecognition: false,
  isSecureContext: true,
  isMobile: true,
  isAndroid: true,
  isIOS: false,
};

const connectedDevice = {
  id: 'dev-1',
  name: 'Rose Cuff',
  deviceType: 'blood_pressure' as const,
  status: 'connected' as const,
  lastReadingAt: null,
  batteryLevel: null,
  rssi: null,
};

describe('useBleCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCapabilities = { ...SUPPORTED };
    vi.mocked(bleConnectionManager.requestDevice).mockResolvedValue(
      ok({ id: 'dev-1', name: 'Rose Cuff' } as unknown as BluetoothDevice)
    );
    vi.mocked(bleConnectionManager.connectDevice).mockResolvedValue(ok(connectedDevice));
    vi.mocked(bleConnectionManager.subscribeToReadings).mockResolvedValue(ok(() => {}));
    vi.mocked(bleConnectionManager.disconnectDevice).mockResolvedValue(ok(undefined));
  });

  it('reports unsupported and refuses to pair on a device without Web Bluetooth (e.g. iPhone)', async () => {
    mockCapabilities = { ...SUPPORTED, hasWebBluetooth: false, isAndroid: false, isIOS: true };

    const { result } = renderHook(() => useBleCapture({ deviceType: 'blood_pressure', onReading: vi.fn() }));

    await waitFor(() => expect(result.current.status).toBe('unsupported'));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.capabilityMessage).toBeTruthy();

    await act(async () => {
      await result.current.pair();
    });
    expect(bleConnectionManager.requestDevice).not.toHaveBeenCalled();
  });

  it('pairs, connects, subscribes, and forwards readings to onReading', async () => {
    let capturedCb: ((r: BleVitalReading) => void) | null = null;
    vi.mocked(bleConnectionManager.subscribeToReadings).mockImplementation(async (_id, cb) => {
      capturedCb = cb;
      return ok(() => {});
    });
    const onReading = vi.fn();

    const { result } = renderHook(() => useBleCapture({ deviceType: 'blood_pressure', onReading }));

    await act(async () => {
      await result.current.pair();
    });

    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.deviceName).toBe('Rose Cuff');
    expect(bleConnectionManager.requestDevice).toHaveBeenCalledWith('blood_pressure');
    expect(bleConnectionManager.subscribeToReadings).toHaveBeenCalled();

    const reading: BleVitalReading = {
      deviceType: 'blood_pressure',
      timestamp: '2026-06-30T08:00:00Z',
      values: [{ type: 'systolic', value: 120, unit: 'mmHg' }],
    };
    act(() => {
      capturedCb?.(reading);
    });
    expect(onReading).toHaveBeenCalledWith(reading);
    expect(result.current.lastReading).toEqual(reading);
  });

  it('surfaces an error when pairing fails', async () => {
    vi.mocked(bleConnectionManager.requestDevice).mockResolvedValue(fail('Device selection was cancelled by the user.'));

    const { result } = renderHook(() => useBleCapture({ deviceType: 'blood_pressure', onReading: vi.fn() }));

    await act(async () => {
      await result.current.pair();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/cancelled/i);
    expect(bleConnectionManager.connectDevice).not.toHaveBeenCalled();
  });
});
