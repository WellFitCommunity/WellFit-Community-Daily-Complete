/**
 * BLE Vital Sign Parsers
 *
 * Implements Bluetooth SIG GATT characteristic format parsing for
 * medical device vital readings. Each parser follows the specification
 * defined by the Bluetooth Special Interest Group for standard health
 * device profiles.
 *
 * References:
 * - GATT Specification Supplement (GSS) v12
 * - Health Device Profile (HDP) v1.1
 */

import type { BleVitalReading, BleVitalValue } from '../../types/ble';

// -- IEEE 11073 Numeric Utilities ---------------------------------------------

/**
 * Parse IEEE 11073 SFLOAT (16-bit) from a DataView.
 * Format: 4-bit exponent (signed) + 12-bit mantissa (signed).
 */
export function parseSfloat(dataView: DataView, offset: number): number {
  const raw = dataView.getUint16(offset, true);
  let mantissa = raw & 0x0fff;
  let exponent = (raw >> 12) & 0x0f;

  // Sign-extend mantissa (12-bit signed)
  if (mantissa >= 0x0800) {
    mantissa = mantissa - 0x1000;
  }

  // Sign-extend exponent (4-bit signed)
  if (exponent >= 0x08) {
    exponent = exponent - 0x10;
  }

  // Special values per IEEE 11073
  if (mantissa === 0x07ff) return Infinity;   // NaN
  if (mantissa === 0x0800) return NaN;        // NRes
  if (mantissa === 0x07fe) return Infinity;   // +INFINITY
  if (mantissa === -0x0800) return -Infinity; // -INFINITY

  return mantissa * Math.pow(10, exponent);
}

/**
 * Convert DataView bytes to hex string for raw data logging.
 */
export function dataViewToHex(dataView: DataView): string {
  const bytes: string[] = [];
  for (let i = 0; i < dataView.byteLength; i++) {
    bytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
  }
  return bytes.join(':');
}

// -- Blood Pressure (0x2A35) --------------------------------------------------

/**
 * Parse Blood Pressure Measurement characteristic (0x2A35)
 *
 * Per Bluetooth SIG GATT Specification:
 * - Byte 0: Flags (bit 0 = units, bit 1 = timestamp present, bit 2 = pulse rate present)
 * - Bytes 1-2: Systolic (SFLOAT, mmHg or kPa)
 * - Bytes 3-4: Diastolic (SFLOAT, mmHg or kPa)
 * - Bytes 5-6: Mean Arterial Pressure (SFLOAT)
 * - Bytes 7-13: Timestamp (optional, if flags bit 1 set)
 * - Bytes 14-15: Pulse Rate (SFLOAT, optional, if flags bit 2 set)
 */
export function parseBloodPressure(dataView: DataView): BleVitalReading {
  const flags = dataView.getUint8(0);
  const isKpa = (flags & 0x01) !== 0;
  const hasPulseRate = (flags & 0x04) !== 0;
  const hasTimestamp = (flags & 0x02) !== 0;

  const unit = isKpa ? 'kPa' : 'mmHg';

  const systolic = parseSfloat(dataView, 1);
  const diastolic = parseSfloat(dataView, 3);

  const values: BleVitalValue[] = [
    { type: 'systolic', value: systolic, unit },
    { type: 'diastolic', value: diastolic, unit },
  ];

  // Pulse rate offset depends on whether timestamp is present
  if (hasPulseRate) {
    const pulseOffset = hasTimestamp ? 14 : 7;
    if (dataView.byteLength > pulseOffset + 1) {
      const pulseRate = parseSfloat(dataView, pulseOffset);
      values.push({ type: 'pulse_rate', value: pulseRate, unit: 'bpm' });
    }
  }

  return {
    deviceType: 'blood_pressure',
    timestamp: new Date().toISOString(),
    values,
    rawData: dataViewToHex(dataView),
  };
}

// -- Glucose (0x2A18) ---------------------------------------------------------

/**
 * Parse Glucose Measurement characteristic (0x2A18)
 *
 * Per Bluetooth SIG GATT Specification:
 * - Byte 0: Flags
 * - Bytes 1-2: Sequence Number
 * - Bytes 3-9: Base Time (year, month, day, hour, minute, second)
 * - Bytes 10-11: Time Offset (optional)
 * - Bytes 12-13: Glucose Concentration (SFLOAT, kg/L or mol/L)
 * - Byte 14: Type-Sample Location (nibbles)
 */
export function parseGlucose(dataView: DataView): BleVitalReading {
  const flags = dataView.getUint8(0);
  const hasConcentration = (flags & 0x02) !== 0;
  const isMolPerL = (flags & 0x04) !== 0;
  const hasTimeOffset = (flags & 0x01) !== 0;

  const values: BleVitalValue[] = [];

  if (hasConcentration) {
    const concentrationOffset = hasTimeOffset ? 12 : 10;
    if (dataView.byteLength > concentrationOffset + 1) {
      const rawConcentration = parseSfloat(dataView, concentrationOffset);

      if (isMolPerL) {
        // Convert mol/L to mmol/L (standard display unit)
        values.push({
          type: 'glucose',
          value: Math.round(rawConcentration * 1000 * 10) / 10,
          unit: 'mmol/L',
        });
      } else {
        // kg/L to mg/dL: multiply by 100000
        values.push({
          type: 'glucose',
          value: Math.round(rawConcentration * 100000),
          unit: 'mg/dL',
        });
      }
    }
  }

  // If no concentration was parsed, provide a zero-value fallback
  if (values.length === 0) {
    values.push({ type: 'glucose', value: 0, unit: 'mg/dL' });
  }

  return {
    deviceType: 'glucose_meter',
    timestamp: new Date().toISOString(),
    values,
    rawData: dataViewToHex(dataView),
  };
}

// -- Pulse Oximeter (0x2A5E) --------------------------------------------------

/**
 * Parse PLX Continuous Measurement characteristic (0x2A5E) - Pulse Oximeter
 *
 * Per Bluetooth SIG GATT Specification:
 * - Byte 0: Flags
 * - Bytes 1-2: SpO2 Normal (SFLOAT, %)
 * - Bytes 3-4: PR Normal (SFLOAT, bpm)
 */
export function parsePulseOximeter(dataView: DataView): BleVitalReading {
  const spo2 = parseSfloat(dataView, 1);
  const pulseRate = parseSfloat(dataView, 3);

  const values: BleVitalValue[] = [
    { type: 'spo2', value: Math.round(spo2 * 10) / 10, unit: '%' },
    { type: 'pulse_rate', value: Math.round(pulseRate), unit: 'bpm' },
  ];

  return {
    deviceType: 'pulse_oximeter',
    timestamp: new Date().toISOString(),
    values,
    rawData: dataViewToHex(dataView),
  };
}

// -- Weight Scale (0x2A9D) ----------------------------------------------------

/**
 * Parse Weight Measurement characteristic (0x2A9D)
 *
 * Per Bluetooth SIG GATT Specification:
 * - Byte 0: Flags (bit 0 = imperial, bit 1 = timestamp, bit 2 = user ID, bit 3 = BMI+height)
 * - Bytes 1-2: Weight (uint16, resolution 0.005 kg or 0.01 lb)
 * - Bytes 3-9: Timestamp (optional)
 * - Byte 10: User ID (optional)
 * - Bytes 11-12: BMI (uint16, resolution 0.1 kg/m^2, optional)
 * - Bytes 13-14: Height (uint16, resolution 0.001 m or 0.1 in, optional)
 */
export function parseWeightScale(dataView: DataView): BleVitalReading {
  const flags = dataView.getUint8(0);
  const isImperial = (flags & 0x01) !== 0;
  const hasBmiHeight = (flags & 0x08) !== 0;
  const hasTimestamp = (flags & 0x02) !== 0;
  const hasUserId = (flags & 0x04) !== 0;

  const rawWeight = dataView.getUint16(1, true);
  const weight = isImperial
    ? rawWeight * 0.01   // resolution 0.01 lb
    : rawWeight * 0.005; // resolution 0.005 kg

  const unit = isImperial ? 'lb' : 'kg';

  const values: BleVitalValue[] = [
    { type: 'weight', value: Math.round(weight * 100) / 100, unit },
  ];

  if (hasBmiHeight) {
    let bmiOffset = 3;
    if (hasTimestamp) bmiOffset += 7;
    if (hasUserId) bmiOffset += 1;

    if (dataView.byteLength > bmiOffset + 3) {
      const rawBmi = dataView.getUint16(bmiOffset, true);
      const bmi = rawBmi * 0.1; // resolution 0.1 kg/m^2
      values.push({ type: 'bmi', value: Math.round(bmi * 10) / 10, unit: 'kg/m2' });
    }
  }

  return {
    deviceType: 'weight_scale',
    timestamp: new Date().toISOString(),
    values,
    rawData: dataViewToHex(dataView),
  };
}

// -- Thermometer (0x2A1C) -----------------------------------------------------

/**
 * Parse Temperature Measurement characteristic (0x2A1C)
 *
 * Per Bluetooth SIG GATT Specification:
 * - Byte 0: Flags (bit 0 = Fahrenheit)
 * - Bytes 1-4: Temperature (IEEE 11073 FLOAT, 32-bit)
 */
export function parseThermometer(dataView: DataView): BleVitalReading {
  const flags = dataView.getUint8(0);
  const isFahrenheit = (flags & 0x01) !== 0;

  // IEEE 11073 32-bit FLOAT: mantissa (24-bit signed) + exponent (8-bit signed)
  const tempRaw = dataView.getUint32(1, true);
  const mantissa = tempRaw & 0x00ffffff;
  const exponent = (tempRaw >> 24) & 0xff;
  const signedMantissa = mantissa >= 0x800000 ? mantissa - 0x1000000 : mantissa;
  const signedExponent = exponent >= 0x80 ? exponent - 0x100 : exponent;
  const temperature = signedMantissa * Math.pow(10, signedExponent);

  const unit = isFahrenheit ? 'degF' : 'degC';

  return {
    deviceType: 'thermometer',
    timestamp: new Date().toISOString(),
    values: [
      { type: 'temperature', value: Math.round(temperature * 100) / 100, unit },
    ],
    rawData: dataViewToHex(dataView),
  };
}
