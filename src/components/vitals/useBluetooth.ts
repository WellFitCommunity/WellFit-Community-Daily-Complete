/**
 * useBluetooth Hook
 * Web Bluetooth API integration for vital sign devices
 * Supports: Blood Pressure (0x1810), Glucose (0x1808), Heart Rate (0x180D), Weight (0x181D)
 */

/// <reference path="./bluetooth.d.ts" />

import { useState, useCallback, useRef } from 'react';
import { auditLogger } from '../../services/auditLogger';
import {
  VitalReading,
  VitalType,
  BloodPressureReading,
  GlucoseReading,
  HeartRateReading,
  WeightReading,
  BLE_SERVICES,
  BLE_CHARACTERISTICS,
} from './types';

export interface BluetoothState {
  isConnecting: boolean;
  isConnected: boolean;
  deviceName: string | null;
  error: string | null;
  lastReading: VitalReading | null;
}

export interface UseBluetoothResult {
  state: BluetoothState;
  connect: (vitalType: VitalType) => Promise<VitalReading | null>;
  disconnect: () => void;
  isSupported: boolean;
}

// Check if Web Bluetooth is available
const hasWebBluetooth = typeof navigator !== 'undefined' &&
  !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth;

/**
 * Parse Blood Pressure Measurement characteristic (0x2A35)
 * IEEE 11073-10407 Blood Pressure Profile
 */
function parseBloodPressureMeasurement(dataView: DataView): BloodPressureReading | null {
  try {
    const flags = dataView.getUint8(0);
    const isKPa = (flags & 0x01) !== 0; // Bit 0: 0=mmHg, 1=kPa

    // Systolic (SFLOAT at offset 1)
    let systolic = parseSFLOAT(dataView, 1);
    // Diastolic (SFLOAT at offset 3)
    let diastolic = parseSFLOAT(dataView, 3);
    // MAP (SFLOAT at offset 5) - we don't use this
    // const map = parseSFLOAT(dataView, 5);

    // Convert kPa to mmHg if needed (1 kPa = 7.50062 mmHg)
    if (isKPa) {
      systolic = Math.round(systolic * 7.50062);
      diastolic = Math.round(diastolic * 7.50062);
    }

    // Check for pulse rate (bit 2)
    let pulse: number | undefined;
    if ((flags & 0x04) !== 0) {
      // Pulse rate at offset 7 or 14 depending on other flags
      const pulseOffset = ((flags & 0x02) !== 0) ? 14 : 7;
      if (dataView.byteLength > pulseOffset + 1) {
        pulse = Math.round(parseSFLOAT(dataView, pulseOffset));
      }
    }

    return {
      type: 'blood_pressure',
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      pulse,
      unit: 'mmHg',
      source: 'ble_web',
      confidence: 0.95,
    };
  } catch (err) {
    auditLogger.error('BLE_BP_PARSE_FAILED', err instanceof Error ? err : 'Unknown parse error', {
      vitalType: 'blood_pressure',
      source: 'ble_web'
    });
    return null;
  }
}

/**
 * Parse Heart Rate Measurement characteristic (0x2A37)
 */
function parseHeartRateMeasurement(dataView: DataView): HeartRateReading | null {
  try {
    const flags = dataView.getUint8(0);
    const is16Bit = (flags & 0x01) !== 0;

    const heartRate = is16Bit
      ? dataView.getUint16(1, true)
      : dataView.getUint8(1);

    return {
      type: 'heart_rate',
      value: heartRate,
      unit: 'bpm',
      source: 'ble_web',
      confidence: 0.95,
    };
  } catch (err) {
    auditLogger.error('BLE_HR_PARSE_FAILED', err instanceof Error ? err : 'Unknown parse error', {
      vitalType: 'heart_rate',
      source: 'ble_web'
    });
    return null;
  }
}

/**
 * Parse Glucose Measurement characteristic (0x2A18)
 */
function parseGlucoseMeasurement(dataView: DataView): GlucoseReading | null {
  try {
    const flags = dataView.getUint8(0);
    // Sequence number at offset 1-2
    // Base time at offset 3-9 (if present)

    let glucoseOffset = 3;
    if ((flags & 0x01) !== 0) {
      // Time offset present
      glucoseOffset += 7;
    }

    // Glucose concentration (SFLOAT)
    const glucoseRaw = parseSFLOAT(dataView, glucoseOffset);
    const isMolPerL = (flags & 0x04) !== 0;

    // Convert mol/L to mg/dL if needed (1 mmol/L = 18.0182 mg/dL)
    const glucose = isMolPerL
      ? Math.round(glucoseRaw * 18.0182)
      : Math.round(glucoseRaw);

    return {
      type: 'glucose',
      value: glucose,
      unit: 'mg/dL',
      source: 'ble_web',
      confidence: 0.95,
    };
  } catch (err) {
    auditLogger.error('BLE_GLUCOSE_PARSE_FAILED', err instanceof Error ? err : 'Unknown parse error', {
      vitalType: 'glucose',
      source: 'ble_web'
    });
    return null;
  }
}

/**
 * Parse Weight Measurement characteristic (0x2A9D)
 */
function parseWeightMeasurement(dataView: DataView): WeightReading | null {
  try {
    const flags = dataView.getUint8(0);
    const isImperial = (flags & 0x01) !== 0;

    // Weight is at offset 1-2, resolution 0.005 kg or 0.01 lb
    const rawWeight = dataView.getUint16(1, true);
    const weight = isImperial
      ? rawWeight * 0.01  // Resolution in lbs
      : rawWeight * 0.005 * 2.20462; // Convert kg to lbs

    return {
      type: 'weight',
      value: Math.round(weight * 10) / 10,
      unit: 'lbs',
      source: 'ble_web',
      confidence: 0.95,
    };
  } catch (err) {
    auditLogger.error('BLE_WEIGHT_PARSE_FAILED', err instanceof Error ? err : 'Unknown parse error', {
      vitalType: 'weight',
      source: 'ble_web'
    });
    return null;
  }
}

/**
 * Parse IEEE 11073 SFLOAT (16-bit floating point)
 */
function parseSFLOAT(dataView: DataView, offset: number): number {
  const raw = dataView.getInt16(offset, true);

  // Special values
  if (raw === 0x07FF) return NaN; // NaN
  if (raw === 0x0800) return NaN; // NRes
  if (raw === 0x07FE) return Infinity; // +Infinity
  if (raw === 0x0802) return -Infinity; // -Infinity

  // Extract mantissa (12 bits) and exponent (4 bits)
  let mantissa = raw & 0x0FFF;
  let exponent = (raw >> 12) & 0x0F;

  // Sign extend mantissa
  if (mantissa >= 0x0800) {
    mantissa = mantissa - 0x1000;
  }

  // Sign extend exponent
  if (exponent >= 0x08) {
    exponent = exponent - 0x10;
  }

  return mantissa * Math.pow(10, exponent);
}

/**
 * Get the service UUID for a vital type
 */
function getServiceForVitalType(vitalType: VitalType): number {
  switch (vitalType) {
    case 'blood_pressure':
      return BLE_SERVICES.BLOOD_PRESSURE;
    case 'glucose':
      return BLE_SERVICES.GLUCOSE;
    case 'heart_rate':
      return BLE_SERVICES.HEART_RATE;
    case 'weight':
      return BLE_SERVICES.WEIGHT_SCALE;
    case 'temperature':
      return BLE_SERVICES.HEALTH_THERMOMETER;
    default:
      return BLE_SERVICES.BLOOD_PRESSURE;
  }
}

/**
 * Get the measurement characteristic UUID for a vital type
 */
function getCharacteristicForVitalType(vitalType: VitalType): number {
  switch (vitalType) {
    case 'blood_pressure':
      return BLE_CHARACTERISTICS.BP_MEASUREMENT;
    case 'glucose':
      return BLE_CHARACTERISTICS.GLUCOSE_MEASUREMENT;
    case 'heart_rate':
      return BLE_CHARACTERISTICS.HEART_RATE_MEASUREMENT;
    case 'weight':
      return BLE_CHARACTERISTICS.WEIGHT_MEASUREMENT;
    case 'temperature':
      return BLE_CHARACTERISTICS.TEMPERATURE_MEASUREMENT;
    default:
      return BLE_CHARACTERISTICS.BP_MEASUREMENT;
  }
}

/**
 * Parse measurement data based on vital type
 */
function parseMeasurement(vitalType: VitalType, dataView: DataView): VitalReading | null {
  switch (vitalType) {
    case 'blood_pressure':
      return parseBloodPressureMeasurement(dataView);
    case 'heart_rate':
      return parseHeartRateMeasurement(dataView);
    case 'glucose':
      return parseGlucoseMeasurement(dataView);
    case 'weight':
      return parseWeightMeasurement(dataView);
    default:
      return null;
  }
}

/**
 * Hook for Web Bluetooth vital sign device connection
 */
export function useBluetooth(): UseBluetoothResult {
  const [state, setState] = useState<BluetoothState>({
    isConnecting: false,
    isConnected: false,
    deviceName: null,
    error: null,
    lastReading: null,
  });

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);

  const disconnect = useCallback(() => {
    if (serverRef.current?.connected) {
      serverRef.current.disconnect();
    }
    deviceRef.current = null;
    serverRef.current = null;
    setState(prev => ({
      ...prev,
      isConnected: false,
      deviceName: null,
    }));
  }, []);

  const connect = useCallback(async (vitalType: VitalType): Promise<VitalReading | null> => {
    if (!hasWebBluetooth) {
      setState(prev => ({
        ...prev,
        error: 'Web Bluetooth is not supported in this browser',
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    try {
      const bluetooth = (navigator as Navigator & { bluetooth: Bluetooth }).bluetooth;
      const serviceUUID = getServiceForVitalType(vitalType);

      // Request device with the appropriate service
      const device = await bluetooth.requestDevice({
        filters: [{ services: [serviceUUID] }],
        optionalServices: [BLE_SERVICES.BATTERY],
      });

      deviceRef.current = device;
      const deviceName = device.name || 'Unknown Device';

      setState(prev => ({
        ...prev,
        deviceName,
      }));

      // Connect to GATT server
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to device');
      }
      serverRef.current = server;

      // Get the service
      const service = await server.getPrimaryService(serviceUUID);

      // Get the measurement characteristic
      const characteristicUUID = getCharacteristicForVitalType(vitalType);
      const characteristic = await service.getCharacteristic(characteristicUUID);

      // For BP and glucose, we use indications (INDICATE property)
      // For heart rate, we use notifications (NOTIFY property)
      const properties = characteristic.properties;

      let reading: VitalReading | null = null;

      if (properties.indicate || properties.notify) {
        // Set up notification/indication listener
        reading = await new Promise<VitalReading | null>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for measurement'));
          }, 30000); // 30 second timeout

          const handleValue = (event: Event) => {
            clearTimeout(timeout);
            const target = event.target as BluetoothRemoteGATTCharacteristic;
            if (target.value) {
              const parsed = parseMeasurement(vitalType, target.value);
              if (parsed) {
                parsed.deviceLabel = deviceName;
              }
              resolve(parsed);
            } else {
              resolve(null);
            }
            characteristic.removeEventListener('characteristicvaluechanged', handleValue);
          };

          characteristic.addEventListener('characteristicvaluechanged', handleValue);

          // Start notifications/indications
          characteristic.startNotifications().catch((err: Error) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      } else if (properties.read) {
        // Some devices support direct read
        const value = await characteristic.readValue();
        reading = parseMeasurement(vitalType, value);
        if (reading) {
          reading.deviceLabel = deviceName;
        }
      }

      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: true,
        lastReading: reading,
        error: null,
      }));

      return reading;

    } catch (err: unknown) {
      const error = err as Error;
      let errorMessage = error.message || 'Failed to connect to device';

      // User-friendly error messages
      if (errorMessage.includes('User cancelled')) {
        errorMessage = 'Device selection was cancelled';
      } else if (errorMessage.includes('not found')) {
        errorMessage = 'No compatible devices found. Make sure your device is on and in pairing mode.';
      } else if (errorMessage.includes('Timeout')) {
        errorMessage = 'Waiting for measurement timed out. Please take a reading on your device.';
      }

      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: errorMessage,
      }));

      return null;
    }
  }, []);

  return {
    state,
    connect,
    disconnect,
    isSupported: hasWebBluetooth,
  };
}

export default useBluetooth;
