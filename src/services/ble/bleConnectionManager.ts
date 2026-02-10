/**
 * BLE Connection Manager
 *
 * Manages Web Bluetooth API connections for medical devices. Handles
 * device discovery, GATT server connections, characteristic subscriptions,
 * and offline reading queue for rural/limited connectivity scenarios.
 *
 * Used by: RPM dashboard, My Health Hub, device pairing UI
 */

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type {
  BleDeviceType,
  BleConnectedDevice,
  BleVitalReading,
  BleManagerConfig,
} from '../../types/ble';
import {
  parseBloodPressure,
  parseGlucose,
  parsePulseOximeter,
  parseWeightScale,
  parseThermometer,
} from './bleVitalParsers';

// -- Bluetooth SIG GATT Service UUIDs (16-bit assigned numbers) ---------------

const BLE_SERVICE_UUIDS: Record<BleDeviceType, number> = {
  blood_pressure: 0x1810,
  glucose_meter: 0x1808,
  pulse_oximeter: 0x1822,
  weight_scale: 0x181d,
  thermometer: 0x1809,
};

const BLE_CHARACTERISTIC_UUIDS: Record<BleDeviceType, number> = {
  blood_pressure: 0x2a35,   // Blood Pressure Measurement
  glucose_meter: 0x2a18,    // Glucose Measurement
  pulse_oximeter: 0x2a5e,   // PLX Continuous Measurement (SpO2)
  weight_scale: 0x2a9d,     // Weight Measurement
  thermometer: 0x2a1c,      // Temperature Measurement
};

const BATTERY_SERVICE_UUID = 0x180f;
const BATTERY_LEVEL_UUID = 0x2a19;

// -- Internal State -----------------------------------------------------------

interface DeviceEntry {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer | null;
  deviceType: BleDeviceType;
  status: BleConnectedDevice['status'];
  lastReadingAt: string | null;
  batteryLevel: number | null;
}

const connectedDevices = new Map<string, DeviceEntry>();
const offlineReadingQueue: BleVitalReading[] = [];
const readingSubscriptions = new Map<string, Set<(reading: BleVitalReading) => void>>();

const DEFAULT_CONFIG: BleManagerConfig = {
  autoReconnect: true,
  reconnectAttempts: 3,
  reconnectDelay: 2000,
  readingInterval: 1000,
  offlineQueueSize: 500,
};

let config: BleManagerConfig = { ...DEFAULT_CONFIG };

// -- Parser Lookup ------------------------------------------------------------

function getParser(deviceType: BleDeviceType): (dv: DataView) => BleVitalReading {
  const parsers: Record<BleDeviceType, (dv: DataView) => BleVitalReading> = {
    blood_pressure: parseBloodPressure,
    glucose_meter: parseGlucose,
    pulse_oximeter: parsePulseOximeter,
    weight_scale: parseWeightScale,
    thermometer: parseThermometer,
  };
  return parsers[deviceType];
}

// -- Public API ---------------------------------------------------------------

/**
 * Check if the Web Bluetooth API is available in the current browser.
 */
function isBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof navigator.bluetooth?.requestDevice === 'function'
  );
}

/**
 * Prompt user to select and pair a BLE medical device.
 */
async function requestDevice(
  deviceType: BleDeviceType
): Promise<ServiceResult<BluetoothDevice>> {
  if (!isBluetoothSupported()) {
    return failure(
      'EXTERNAL_SERVICE_ERROR',
      'Web Bluetooth API is not supported in this browser. Please use Chrome, Edge, or Opera on a desktop or Android device.'
    );
  }

  const serviceUuid = BLE_SERVICE_UUIDS[deviceType];
  if (!serviceUuid) {
    return failure('VALIDATION_ERROR', `Unknown device type: ${deviceType}`);
  }

  try {
    await auditLogger.info('BLE_DEVICE_REQUEST', {
      deviceType,
      serviceUuid: `0x${serviceUuid.toString(16)}`,
    });

    const bluetooth = navigator.bluetooth;
    if (!bluetooth) {
      return failure(
        'EXTERNAL_SERVICE_ERROR',
        'Web Bluetooth API is not available in this browser.'
      );
    }

    const device = await bluetooth.requestDevice({
      filters: [{ services: [serviceUuid] }],
      optionalServices: [BATTERY_SERVICE_UUID],
    });

    await auditLogger.info('BLE_DEVICE_SELECTED', {
      deviceType,
      deviceId: device.id,
      deviceName: device.name ?? 'unnamed',
    });

    return success(device);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (error.message.includes('cancelled') || error.message.includes('canceled')) {
      return failure('OPERATION_FAILED', 'Device selection was cancelled by the user.');
    }

    await auditLogger.error('BLE_DEVICE_REQUEST_FAILED', error, { deviceType });
    return failure('EXTERNAL_SERVICE_ERROR', `Failed to request BLE device: ${error.message}`, error);
  }
}

/**
 * Establish a GATT connection to a paired Bluetooth device.
 */
async function connectDevice(
  device: BluetoothDevice,
  deviceType: BleDeviceType
): Promise<ServiceResult<BleConnectedDevice>> {
  if (!device.gatt) {
    return failure('EXTERNAL_SERVICE_ERROR', 'Device does not support GATT connections.');
  }

  try {
    await auditLogger.info('BLE_CONNECTING', {
      deviceId: device.id,
      deviceName: device.name ?? 'unnamed',
      deviceType,
    });

    const server = await device.gatt.connect();

    const entry: DeviceEntry = {
      device,
      server,
      deviceType,
      status: 'connected',
      lastReadingAt: null,
      batteryLevel: null,
    };

    // Attempt to read battery level (non-critical)
    try {
      const batteryService = await server.getPrimaryService(BATTERY_SERVICE_UUID);
      const batteryChar = await batteryService.getCharacteristic(BATTERY_LEVEL_UUID);
      const batteryValue = await batteryChar.readValue();
      entry.batteryLevel = batteryValue.getUint8(0);
    } catch {
      // Battery service not available on this device
    }

    connectedDevices.set(device.id, entry);

    device.addEventListener('gattserverdisconnected', () => {
      handleDisconnect(device.id);
    });

    await auditLogger.info('BLE_CONNECTED', {
      deviceId: device.id,
      deviceName: device.name ?? 'unnamed',
      deviceType,
      batteryLevel: entry.batteryLevel,
    });

    return success(toConnectedDevice(device.id, entry));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BLE_CONNECTION_FAILED', error, {
      deviceId: device.id,
      deviceType,
    });
    return failure('EXTERNAL_SERVICE_ERROR', `Failed to connect to device: ${error.message}`, error);
  }
}

/**
 * Disconnect a connected BLE device by ID.
 */
async function disconnectDevice(deviceId: string): Promise<ServiceResult<void>> {
  const entry = connectedDevices.get(deviceId);
  if (!entry) {
    return failure('NOT_FOUND', `Device ${deviceId} is not connected.`);
  }

  try {
    if (entry.server?.connected) {
      entry.server.disconnect();
    }

    connectedDevices.delete(deviceId);
    readingSubscriptions.delete(deviceId);

    await auditLogger.info('BLE_DISCONNECTED', {
      deviceId,
      deviceType: entry.deviceType,
    });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BLE_DISCONNECT_FAILED', error, { deviceId });
    return failure('OPERATION_FAILED', `Failed to disconnect device: ${error.message}`, error);
  }
}

/**
 * Get the list of currently connected devices.
 */
function getConnectedDevices(): BleConnectedDevice[] {
  const devices: BleConnectedDevice[] = [];
  connectedDevices.forEach((entry, id) => {
    devices.push(toConnectedDevice(id, entry));
  });
  return devices;
}

/**
 * Subscribe to vital reading notifications from a connected device.
 * Returns an unsubscribe function.
 */
async function subscribeToReadings(
  deviceId: string,
  callback: (reading: BleVitalReading) => void
): Promise<ServiceResult<() => void>> {
  const entry = connectedDevices.get(deviceId);
  if (!entry) {
    return failure('NOT_FOUND', `Device ${deviceId} is not connected.`);
  }

  if (!entry.server?.connected) {
    return failure('EXTERNAL_SERVICE_ERROR', 'Device GATT server is not connected.');
  }

  try {
    const serviceUuid = BLE_SERVICE_UUIDS[entry.deviceType];
    const charUuid = BLE_CHARACTERISTIC_UUIDS[entry.deviceType];

    const service = await entry.server.getPrimaryService(serviceUuid);
    const characteristic = await service.getCharacteristic(charUuid);

    if (!readingSubscriptions.has(deviceId)) {
      readingSubscriptions.set(deviceId, new Set());
    }
    readingSubscriptions.get(deviceId)?.add(callback);

    const parser = getParser(entry.deviceType);

    const handleNotification = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      if (!target.value) return;

      try {
        const reading = parser(target.value);
        entry.lastReadingAt = reading.timestamp;

        const subscribers = readingSubscriptions.get(deviceId);
        if (subscribers) {
          subscribers.forEach((cb) => cb(reading));
        }
      } catch (parseErr: unknown) {
        const parseError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
        auditLogger.error('BLE_PARSE_ERROR', parseError, {
          deviceId,
          deviceType: entry.deviceType,
        });
      }
    };

    characteristic.addEventListener('characteristicvaluechanged', handleNotification);
    await characteristic.startNotifications();

    await auditLogger.info('BLE_SUBSCRIBED', {
      deviceId,
      deviceType: entry.deviceType,
    });

    const unsubscribe = () => {
      characteristic.removeEventListener('characteristicvaluechanged', handleNotification);
      readingSubscriptions.get(deviceId)?.delete(callback);
      characteristic.stopNotifications().catch(() => {
        // Device may already be disconnected
      });
    };

    return success(unsubscribe);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BLE_SUBSCRIBE_FAILED', error, {
      deviceId,
      deviceType: entry.deviceType,
    });
    return failure('EXTERNAL_SERVICE_ERROR', `Failed to subscribe to readings: ${error.message}`, error);
  }
}

/**
 * Queue a vital reading for later sync (offline/rural connectivity support).
 */
function queueOfflineReading(reading: BleVitalReading): ServiceResult<number> {
  if (offlineReadingQueue.length >= config.offlineQueueSize) {
    offlineReadingQueue.shift();
  }

  offlineReadingQueue.push(reading);
  return success(offlineReadingQueue.length);
}

/**
 * Get the current count of queued offline readings.
 */
function getOfflineQueueCount(): number {
  return offlineReadingQueue.length;
}

/**
 * Flush all queued offline readings and return them for sync.
 */
async function syncOfflineReadings(): Promise<ServiceResult<BleVitalReading[]>> {
  if (offlineReadingQueue.length === 0) {
    return success([]);
  }

  try {
    const readings = [...offlineReadingQueue];
    offlineReadingQueue.length = 0;

    await auditLogger.info('BLE_OFFLINE_SYNC', {
      readingCount: readings.length,
      deviceTypes: [...new Set(readings.map((r) => r.deviceType))],
    });

    return success(readings);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BLE_OFFLINE_SYNC_FAILED', error);
    return failure('OPERATION_FAILED', `Failed to sync offline readings: ${error.message}`, error);
  }
}

/**
 * Update the BLE manager configuration.
 */
function configure(updates: Partial<BleManagerConfig>): void {
  config = { ...config, ...updates };
}

// -- Internal Helpers ---------------------------------------------------------

function handleDisconnect(deviceId: string): void {
  const entry = connectedDevices.get(deviceId);
  if (!entry) return;

  entry.status = 'disconnected';
  entry.server = null;

  auditLogger.info('BLE_GATT_DISCONNECTED', {
    deviceId,
    deviceType: entry.deviceType,
    autoReconnect: config.autoReconnect,
  });

  if (config.autoReconnect) {
    entry.status = 'reconnecting';
    attemptReconnect(deviceId, 0);
  } else {
    connectedDevices.delete(deviceId);
    readingSubscriptions.delete(deviceId);
  }
}

function attemptReconnect(deviceId: string, attempt: number): void {
  if (attempt >= config.reconnectAttempts) {
    const entry = connectedDevices.get(deviceId);
    if (entry) {
      entry.status = 'error';
    }
    auditLogger.warn('BLE_RECONNECT_EXHAUSTED', {
      deviceId,
      attempts: attempt,
    });
    return;
  }

  setTimeout(async () => {
    const entry = connectedDevices.get(deviceId);
    if (!entry || entry.status === 'connected') return;

    try {
      if (entry.device.gatt) {
        const server = await entry.device.gatt.connect();
        entry.server = server;
        entry.status = 'connected';

        await auditLogger.info('BLE_RECONNECTED', {
          deviceId,
          deviceType: entry.deviceType,
          attempt: attempt + 1,
        });
      }
    } catch {
      attemptReconnect(deviceId, attempt + 1);
    }
  }, config.reconnectDelay);
}

function toConnectedDevice(id: string, entry: DeviceEntry): BleConnectedDevice {
  return {
    id,
    name: entry.device.name ?? 'Unknown Device',
    deviceType: entry.deviceType,
    status: entry.status,
    lastReadingAt: entry.lastReadingAt,
    batteryLevel: entry.batteryLevel,
    rssi: null, // RSSI not available through Web Bluetooth API post-connection
  };
}

// -- Exported Service Object --------------------------------------------------

export const bleConnectionManager = {
  isBluetoothSupported,
  requestDevice,
  connectDevice,
  disconnectDevice,
  getConnectedDevices,
  subscribeToReadings,
  queueOfflineReading,
  getOfflineQueueCount,
  syncOfflineReadings,
  configure,

  // Expose parsers for direct use (e.g., testing, custom integrations)
  parseBloodPressure,
  parseGlucose,
  parsePulseOximeter,
  parseWeightScale,
  parseThermometer,

  // Expose constants for reference
  BLE_SERVICE_UUIDS,
  BLE_CHARACTERISTIC_UUIDS,
};
