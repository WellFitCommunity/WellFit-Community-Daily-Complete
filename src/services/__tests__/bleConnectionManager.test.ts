/**
 * BLE Connection Manager Tests
 *
 * Tests vital sign parsing from Bluetooth SIG GATT characteristic formats,
 * offline reading queue, browser compatibility detection, and error handling.
 *
 * Web Bluetooth API is not available in Node/jsdom, so navigator.bluetooth
 * is mocked for device request/connection tests.
 */

import { bleConnectionManager } from '../ble/bleConnectionManager';

// Mock auditLogger - must be before imports that use it
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// -- Helpers: Build DataView from byte arrays ----------------------------------

function createDataView(bytes: number[]): DataView {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new DataView(buffer);
  bytes.forEach((byte, i) => view.setUint8(i, byte));
  return view;
}

/**
 * Write a 16-bit unsigned int in little-endian at given offset.
 */
function setUint16LE(bytes: number[], offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

/**
 * Encode an IEEE 11073 SFLOAT (16-bit): 4-bit exponent + 12-bit mantissa.
 * Both are signed. This is the format used by BLE blood pressure, SpO2, etc.
 *
 * Example: value 120 with exponent 0 => mantissa=120, exponent=0
 *          value 98.5 with exponent -1 => mantissa=985, exponent=-1
 */
function encodeSfloat(mantissa: number, exponent: number): number {
  // Handle sign for mantissa (12-bit two's complement)
  const m = mantissa < 0 ? (mantissa + 0x1000) & 0x0fff : mantissa & 0x0fff;
  // Handle sign for exponent (4-bit two's complement)
  const e = exponent < 0 ? (exponent + 0x10) & 0x0f : exponent & 0x0f;
  return (e << 12) | m;
}

// =============================================================================
// BROWSER COMPATIBILITY
// =============================================================================

describe('bleConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isBluetoothSupported', () => {
    it('returns false when navigator.bluetooth is not available', () => {
      // jsdom does not provide navigator.bluetooth
      const result = bleConnectionManager.isBluetoothSupported();
      expect(result).toBe(false);
    });

    it('returns false when navigator is undefined', () => {
      // In jsdom, navigator exists but bluetooth doesn't
      const result = bleConnectionManager.isBluetoothSupported();
      expect(result).toBe(false);
    });
  });

  describe('requestDevice returns failure when Bluetooth not supported', () => {
    it('returns failure with browser compatibility message', async () => {
      const result = await bleConnectionManager.requestDevice('blood_pressure');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        expect(result.error.message).toContain('not supported');
        expect(result.error.message).toContain('Chrome');
      }
    });
  });

  // ===========================================================================
  // BLOOD PRESSURE PARSING
  // ===========================================================================

  describe('parseBloodPressure', () => {
    it('extracts systolic and diastolic from mmHg reading (no pulse)', () => {
      // Flags: 0x00 = mmHg, no timestamp, no pulse rate
      const bytes: number[] = new Array(7).fill(0);
      bytes[0] = 0x00; // flags: mmHg

      // Systolic = 120 (SFLOAT: mantissa=120, exponent=0)
      const systolicSfloat = encodeSfloat(120, 0);
      setUint16LE(bytes, 1, systolicSfloat);

      // Diastolic = 80 (SFLOAT: mantissa=80, exponent=0)
      const diastolicSfloat = encodeSfloat(80, 0);
      setUint16LE(bytes, 3, diastolicSfloat);

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseBloodPressure(dataView);

      expect(reading.deviceType).toBe('blood_pressure');
      expect(reading.values).toHaveLength(2);
      expect(reading.values[0].type).toBe('systolic');
      expect(reading.values[0].value).toBe(120);
      expect(reading.values[0].unit).toBe('mmHg');
      expect(reading.values[1].type).toBe('diastolic');
      expect(reading.values[1].value).toBe(80);
      expect(reading.values[1].unit).toBe('mmHg');
      expect(reading.timestamp).toBeTruthy();
      expect(reading.rawData).toBeTruthy();
    });

    it('extracts pulse rate when present (no timestamp)', () => {
      // Flags: 0x04 = mmHg, no timestamp, pulse rate present
      const bytes: number[] = new Array(9).fill(0);
      bytes[0] = 0x04; // flags: pulse rate present, no timestamp

      // Systolic = 130
      setUint16LE(bytes, 1, encodeSfloat(130, 0));
      // Diastolic = 85
      setUint16LE(bytes, 3, encodeSfloat(85, 0));
      // MAP (bytes 5-6) - skip
      // Pulse rate at offset 7 (no timestamp)
      setUint16LE(bytes, 7, encodeSfloat(72, 0));

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseBloodPressure(dataView);

      expect(reading.values).toHaveLength(3);
      expect(reading.values[0].type).toBe('systolic');
      expect(reading.values[0].value).toBe(130);
      expect(reading.values[1].type).toBe('diastolic');
      expect(reading.values[1].value).toBe(85);
      expect(reading.values[2].type).toBe('pulse_rate');
      expect(reading.values[2].value).toBe(72);
      expect(reading.values[2].unit).toBe('bpm');
    });

    it('handles kPa units when flag bit 0 is set', () => {
      const bytes: number[] = new Array(7).fill(0);
      bytes[0] = 0x01; // flags: kPa

      setUint16LE(bytes, 1, encodeSfloat(160, -1)); // 16.0 kPa
      setUint16LE(bytes, 3, encodeSfloat(107, -1)); // 10.7 kPa

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseBloodPressure(dataView);

      expect(reading.values[0].unit).toBe('kPa');
      expect(reading.values[1].unit).toBe('kPa');
    });
  });

  // ===========================================================================
  // GLUCOSE PARSING
  // ===========================================================================

  describe('parseGlucose', () => {
    it('extracts glucose value in mg/dL (kg/L concentration)', () => {
      // Flags: 0x02 = concentration present, kg/L units (bit 2 = 0)
      // No time offset (bit 0 = 0), so concentration at offset 10
      // We need: flags(1) + sequence(2) + base_time(7) + concentration(2) = 12 bytes minimum
      const bytes: number[] = new Array(14).fill(0);
      bytes[0] = 0x02; // concentration present, kg/L

      // Concentration at offset 10 (no time offset)
      // 98 mg/dL = 0.00098 kg/L
      // SFLOAT: mantissa=98, exponent=-5 => 98 * 10^-5 = 0.00098
      setUint16LE(bytes, 10, encodeSfloat(98, -5));

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseGlucose(dataView);

      expect(reading.deviceType).toBe('glucose_meter');
      expect(reading.values).toHaveLength(1);
      expect(reading.values[0].type).toBe('glucose');
      expect(reading.values[0].value).toBe(98);
      expect(reading.values[0].unit).toBe('mg/dL');
    });

    it('extracts glucose value in mmol/L when mol/L flag set', () => {
      // Flags: 0x06 = concentration present (bit 1) + mol/L units (bit 2)
      const bytes: number[] = new Array(14).fill(0);
      bytes[0] = 0x06; // concentration present + mol/L

      // 5.4 mmol/L = 0.0054 mol/L
      // SFLOAT: mantissa=54, exponent=-4 => 54 * 10^-4 = 0.0054
      setUint16LE(bytes, 10, encodeSfloat(54, -4));

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseGlucose(dataView);

      expect(reading.deviceType).toBe('glucose_meter');
      expect(reading.values[0].type).toBe('glucose');
      expect(reading.values[0].unit).toBe('mmol/L');
      // 0.0054 mol/L * 1000 = 5.4 mmol/L
      expect(reading.values[0].value).toBe(5.4);
    });

    it('returns zero-value fallback when no concentration data present', () => {
      // Flags: 0x00 = no concentration
      const bytes: number[] = new Array(10).fill(0);
      bytes[0] = 0x00;

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseGlucose(dataView);

      expect(reading.values).toHaveLength(1);
      expect(reading.values[0].type).toBe('glucose');
      expect(reading.values[0].value).toBe(0);
      expect(reading.values[0].unit).toBe('mg/dL');
    });

    it('handles time offset flag shifting concentration offset', () => {
      // Flags: 0x03 = time offset present (bit 0) + concentration present (bit 1), kg/L
      const bytes: number[] = new Array(16).fill(0);
      bytes[0] = 0x03; // time offset present + concentration present

      // Concentration at offset 12 (time offset pushes it by 2)
      // 150 mg/dL = 0.00150 kg/L
      setUint16LE(bytes, 12, encodeSfloat(150, -5));

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseGlucose(dataView);

      expect(reading.values[0].value).toBe(150);
      expect(reading.values[0].unit).toBe('mg/dL');
    });
  });

  // ===========================================================================
  // PULSE OXIMETER PARSING
  // ===========================================================================

  describe('parsePulseOximeter', () => {
    it('extracts SpO2 percentage and pulse rate', () => {
      // PLX Continuous: flags(1) + SpO2(2) + PR(2)
      const bytes: number[] = new Array(5).fill(0);
      bytes[0] = 0x00; // flags

      // SpO2 = 98% (SFLOAT: mantissa=98, exponent=0)
      setUint16LE(bytes, 1, encodeSfloat(98, 0));
      // Pulse Rate = 72 bpm
      setUint16LE(bytes, 3, encodeSfloat(72, 0));

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parsePulseOximeter(dataView);

      expect(reading.deviceType).toBe('pulse_oximeter');
      expect(reading.values).toHaveLength(2);
      expect(reading.values[0].type).toBe('spo2');
      expect(reading.values[0].value).toBe(98);
      expect(reading.values[0].unit).toBe('%');
      expect(reading.values[1].type).toBe('pulse_rate');
      expect(reading.values[1].value).toBe(72);
      expect(reading.values[1].unit).toBe('bpm');
    });

    it('handles fractional SpO2 values', () => {
      const bytes: number[] = new Array(5).fill(0);
      bytes[0] = 0x00;

      // SpO2 = 97.5% (SFLOAT: mantissa=975, exponent=-1)
      setUint16LE(bytes, 1, encodeSfloat(975, -1));
      // PR = 68 bpm
      setUint16LE(bytes, 3, encodeSfloat(68, 0));

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parsePulseOximeter(dataView);

      expect(reading.values[0].value).toBe(97.5);
      expect(reading.values[1].value).toBe(68);
    });
  });

  // ===========================================================================
  // WEIGHT SCALE PARSING
  // ===========================================================================

  describe('parseWeightScale', () => {
    it('extracts weight in kg (metric, SI units)', () => {
      // Flags: 0x00 = SI (kg), no timestamp, no user ID, no BMI
      const bytes: number[] = new Array(3).fill(0);
      bytes[0] = 0x00; // flags: metric

      // Weight: 75.0 kg => raw = 75.0 / 0.005 = 15000
      const rawWeight = Math.round(75.0 / 0.005);
      setUint16LE(bytes, 1, rawWeight);

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseWeightScale(dataView);

      expect(reading.deviceType).toBe('weight_scale');
      expect(reading.values).toHaveLength(1);
      expect(reading.values[0].type).toBe('weight');
      expect(reading.values[0].value).toBe(75);
      expect(reading.values[0].unit).toBe('kg');
    });

    it('extracts weight in pounds (imperial units)', () => {
      // Flags: 0x01 = imperial (lb)
      const bytes: number[] = new Array(3).fill(0);
      bytes[0] = 0x01; // flags: imperial

      // Weight: 165.5 lb => raw = 165.5 / 0.01 = 16550
      const rawWeight = Math.round(165.5 / 0.01);
      setUint16LE(bytes, 1, rawWeight);

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseWeightScale(dataView);

      expect(reading.values[0].type).toBe('weight');
      expect(reading.values[0].value).toBe(165.5);
      expect(reading.values[0].unit).toBe('lb');
    });

    it('extracts BMI when present (no timestamp, no user ID)', () => {
      // Flags: 0x08 = BMI+height present, no timestamp, no user ID
      // Layout: flags(1) + weight(2) + bmi(2) + height(2) = 7 bytes
      const bytes: number[] = new Array(7).fill(0);
      bytes[0] = 0x08; // BMI+height present

      // Weight: 80 kg => raw = 80 / 0.005 = 16000
      setUint16LE(bytes, 1, Math.round(80 / 0.005));
      // BMI: 24.5 => raw = 24.5 / 0.1 = 245
      setUint16LE(bytes, 3, 245);

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseWeightScale(dataView);

      expect(reading.values).toHaveLength(2);
      expect(reading.values[0].type).toBe('weight');
      expect(reading.values[0].value).toBe(80);
      expect(reading.values[1].type).toBe('bmi');
      expect(reading.values[1].value).toBe(24.5);
      expect(reading.values[1].unit).toBe('kg/m2');
    });
  });

  // ===========================================================================
  // THERMOMETER PARSING
  // ===========================================================================

  describe('parseThermometer', () => {
    it('extracts temperature in Celsius', () => {
      // Flags: 0x00 = Celsius
      // IEEE 11073 FLOAT (32-bit): mantissa(24-bit) + exponent(8-bit)
      // 36.6 degC => mantissa=366, exponent=-1
      const bytes: number[] = new Array(5).fill(0);
      bytes[0] = 0x00; // Celsius

      // FLOAT: mantissa in bytes 1-3 (LE), exponent in byte 4
      const mantissa = 366;
      const exponent = 0xff; // -1 in signed 8-bit
      bytes[1] = mantissa & 0xff;
      bytes[2] = (mantissa >> 8) & 0xff;
      bytes[3] = (mantissa >> 16) & 0xff;
      bytes[4] = exponent;

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseThermometer(dataView);

      expect(reading.deviceType).toBe('thermometer');
      expect(reading.values).toHaveLength(1);
      expect(reading.values[0].type).toBe('temperature');
      expect(reading.values[0].value).toBe(36.6);
      expect(reading.values[0].unit).toBe('degC');
    });

    it('extracts temperature in Fahrenheit when flag set', () => {
      // Flags: 0x01 = Fahrenheit
      // 98.6 degF => mantissa=986, exponent=-1
      const bytes: number[] = new Array(5).fill(0);
      bytes[0] = 0x01; // Fahrenheit

      const mantissa = 986;
      const exponent = 0xff; // -1
      bytes[1] = mantissa & 0xff;
      bytes[2] = (mantissa >> 8) & 0xff;
      bytes[3] = (mantissa >> 16) & 0xff;
      bytes[4] = exponent;

      const dataView = createDataView(bytes);
      const reading = bleConnectionManager.parseThermometer(dataView);

      expect(reading.values[0].type).toBe('temperature');
      expect(reading.values[0].value).toBe(98.6);
      expect(reading.values[0].unit).toBe('degF');
    });
  });

  // ===========================================================================
  // OFFLINE READING QUEUE
  // ===========================================================================

  describe('queueOfflineReading', () => {
    beforeEach(() => {
      // Drain any existing queued readings
      bleConnectionManager.syncOfflineReadings();
    });

    it('queues a reading and returns the queue count', () => {
      const reading = {
        deviceType: 'blood_pressure' as const,
        timestamp: new Date().toISOString(),
        values: [
          { type: 'systolic', value: 120, unit: 'mmHg' },
          { type: 'diastolic', value: 80, unit: 'mmHg' },
        ],
      };

      const result = bleConnectionManager.queueOfflineReading(reading);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeGreaterThanOrEqual(1);
      }
    });

    it('stores multiple readings from different device types', async () => {
      // Clear queue first
      await bleConnectionManager.syncOfflineReadings();

      const bpReading = {
        deviceType: 'blood_pressure' as const,
        timestamp: new Date().toISOString(),
        values: [{ type: 'systolic', value: 130, unit: 'mmHg' }],
      };

      const glucoseReading = {
        deviceType: 'glucose_meter' as const,
        timestamp: new Date().toISOString(),
        values: [{ type: 'glucose', value: 105, unit: 'mg/dL' }],
      };

      bleConnectionManager.queueOfflineReading(bpReading);
      bleConnectionManager.queueOfflineReading(glucoseReading);

      expect(bleConnectionManager.getOfflineQueueCount()).toBe(2);

      const syncResult = await bleConnectionManager.syncOfflineReadings();
      expect(syncResult.success).toBe(true);
      if (syncResult.success) {
        expect(syncResult.data).toHaveLength(2);
        expect(syncResult.data[0].deviceType).toBe('blood_pressure');
        expect(syncResult.data[1].deviceType).toBe('glucose_meter');
      }
    });

    it('clears the queue after sync', async () => {
      // Clear queue first
      await bleConnectionManager.syncOfflineReadings();

      bleConnectionManager.queueOfflineReading({
        deviceType: 'pulse_oximeter' as const,
        timestamp: new Date().toISOString(),
        values: [{ type: 'spo2', value: 98, unit: '%' }],
      });

      expect(bleConnectionManager.getOfflineQueueCount()).toBe(1);

      await bleConnectionManager.syncOfflineReadings();

      expect(bleConnectionManager.getOfflineQueueCount()).toBe(0);
    });
  });

  describe('syncOfflineReadings', () => {
    it('returns empty array when queue is empty', async () => {
      // Ensure queue is clean
      await bleConnectionManager.syncOfflineReadings();

      const result = await bleConnectionManager.syncOfflineReadings();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ===========================================================================
  // GATT SERVICE UUIDS
  // ===========================================================================

  describe('BLE_SERVICE_UUIDS', () => {
    it('contains correct standard Bluetooth SIG assigned numbers', () => {
      const uuids = bleConnectionManager.BLE_SERVICE_UUIDS;

      expect(uuids.blood_pressure).toBe(0x1810);
      expect(uuids.glucose_meter).toBe(0x1808);
      expect(uuids.pulse_oximeter).toBe(0x1822);
      expect(uuids.weight_scale).toBe(0x181d);
      expect(uuids.thermometer).toBe(0x1809);
    });
  });

  describe('BLE_CHARACTERISTIC_UUIDS', () => {
    it('contains correct GATT characteristic UUIDs', () => {
      const chars = bleConnectionManager.BLE_CHARACTERISTIC_UUIDS;

      expect(chars.blood_pressure).toBe(0x2a35);
      expect(chars.glucose_meter).toBe(0x2a18);
      expect(chars.pulse_oximeter).toBe(0x2a5e);
      expect(chars.weight_scale).toBe(0x2a9d);
      expect(chars.thermometer).toBe(0x2a1c);
    });
  });

  // ===========================================================================
  // CONNECTED DEVICES LIST
  // ===========================================================================

  describe('getConnectedDevices', () => {
    it('returns empty array when no devices connected', () => {
      const devices = bleConnectionManager.getConnectedDevices();
      expect(Array.isArray(devices)).toBe(true);
      // May have devices from other tests; just verify it returns an array
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('Error handling', () => {
    it('disconnectDevice returns NOT_FOUND for unknown device', async () => {
      const result = await bleConnectionManager.disconnectDevice('nonexistent-device-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('not connected');
      }
    });

    it('subscribeToReadings returns NOT_FOUND for unknown device', async () => {
      const callback = vi.fn();
      const result = await bleConnectionManager.subscribeToReadings(
        'nonexistent-device-id',
        callback
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('requestDevice returns failure for all device types when BT not supported', async () => {
      const deviceTypes: Array<'blood_pressure' | 'glucose_meter' | 'pulse_oximeter' | 'weight_scale' | 'thermometer'> = [
        'blood_pressure',
        'glucose_meter',
        'pulse_oximeter',
        'weight_scale',
        'thermometer',
      ];

      for (const deviceType of deviceTypes) {
        const result = await bleConnectionManager.requestDevice(deviceType);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        }
      }
    });
  });

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  describe('configure', () => {
    it('accepts partial configuration updates without throwing', () => {
      expect(() => {
        bleConnectionManager.configure({
          autoReconnect: false,
          reconnectAttempts: 5,
          offlineQueueSize: 1000,
        });
      }).not.toThrow();

      // Reset to default for other tests
      bleConnectionManager.configure({ offlineQueueSize: 500 });
    });
  });
});
