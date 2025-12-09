/**
 * Web Vital Capture Types
 * Type definitions for the multi-modal vital capture system
 */

export type VitalSource = 'manual' | 'camera_scan' | 'camera_photo' | 'ble_web' | 'caregiver_app' | 'vendor_api' | 'import';

export type VitalType = 'blood_pressure' | 'glucose' | 'weight' | 'heart_rate' | 'temperature' | 'pulse_oximeter';

export interface VitalReading {
  type: VitalType;
  // Blood pressure specific
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  // Generic value (glucose, weight, heart rate, temp, SpO2)
  value?: number;
  unit?: string;
  // Metadata
  source: VitalSource;
  deviceLabel?: string;
  confidence?: number;
  takenAt?: string;
}

export interface BloodPressureReading extends VitalReading {
  type: 'blood_pressure';
  systolic: number;
  diastolic: number;
  pulse?: number;
  unit: 'mmHg';
}

export interface GlucoseReading extends VitalReading {
  type: 'glucose';
  value: number;
  unit: 'mg/dL';
}

export interface WeightReading extends VitalReading {
  type: 'weight';
  value: number;
  unit: 'lbs' | 'kg';
}

export interface HeartRateReading extends VitalReading {
  type: 'heart_rate';
  value: number;
  unit: 'bpm';
}

export interface TemperatureReading extends VitalReading {
  type: 'temperature';
  value: number;
  unit: '°F' | '°C';
}

export interface PulseOximeterReading extends VitalReading {
  type: 'pulse_oximeter';
  value: number;
  unit: '%';
}

export interface CaptureCapabilities {
  hasCamera: boolean;
  hasWebBluetooth: boolean;
  hasSpeechRecognition: boolean;
  isSecureContext: boolean;
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
}

export interface TempImageJob {
  id: string;
  user_id: string;
  tenant_id?: string;
  facility_id?: string;
  storage_path: string;
  status: 'pending_ocr' | 'processing' | 'processed' | 'failed';
  error?: string;
  extracted_data?: VitalReading;
  vital_type: VitalType;
  created_at: string;
  expires_at: string;
  processed_at?: string;
}

// BLE Service UUIDs (Bluetooth SIG standard)
export const BLE_SERVICES = {
  BLOOD_PRESSURE: 0x1810,
  GLUCOSE: 0x1808,
  HEART_RATE: 0x180D,
  WEIGHT_SCALE: 0x181D,
  HEALTH_THERMOMETER: 0x1809,
  BATTERY: 0x180F,
} as const;

// BLE Characteristic UUIDs
export const BLE_CHARACTERISTICS = {
  BP_MEASUREMENT: 0x2A35,
  BP_FEATURE: 0x2A49,
  GLUCOSE_MEASUREMENT: 0x2A18,
  GLUCOSE_CONTEXT: 0x2A34,
  HEART_RATE_MEASUREMENT: 0x2A37,
  WEIGHT_MEASUREMENT: 0x2A9D,
  TEMPERATURE_MEASUREMENT: 0x2A1C,
  BATTERY_LEVEL: 0x2A19,
} as const;

// Validation ranges for vitals
export const VITAL_RANGES = {
  systolic: { min: 70, max: 250, unit: 'mmHg' },
  diastolic: { min: 40, max: 150, unit: 'mmHg' },
  pulse: { min: 30, max: 220, unit: 'bpm' },
  glucose: { min: 40, max: 600, unit: 'mg/dL' },
  weight: { min: 50, max: 500, unit: 'lbs' },
  heartRate: { min: 30, max: 220, unit: 'bpm' },
  temperature: { min: 90, max: 110, unit: '°F' },
  pulseOximeter: { min: 50, max: 100, unit: '%' },
} as const;

// Critical alert thresholds
export const CRITICAL_THRESHOLDS = {
  systolicHigh: 180,
  systolicLow: 90,
  diastolicHigh: 120,
  diastolicLow: 60,
  pulseOximeterLow: 88,
  glucoseHigh: 400,
  glucoseLow: 54,
  temperatureHigh: 103,
  temperatureLow: 95,
} as const;

/**
 * Check if a reading has critical values
 */
export function isCriticalReading(reading: VitalReading): boolean {
  if (reading.type === 'blood_pressure') {
    const bp = reading as BloodPressureReading;
    if (bp.systolic >= CRITICAL_THRESHOLDS.systolicHigh) return true;
    if (bp.systolic <= CRITICAL_THRESHOLDS.systolicLow) return true;
    if (bp.diastolic >= CRITICAL_THRESHOLDS.diastolicHigh) return true;
    if (bp.diastolic <= CRITICAL_THRESHOLDS.diastolicLow) return true;
  }

  if (reading.type === 'pulse_oximeter' && reading.value) {
    if (reading.value <= CRITICAL_THRESHOLDS.pulseOximeterLow) return true;
  }

  if (reading.type === 'glucose' && reading.value) {
    if (reading.value >= CRITICAL_THRESHOLDS.glucoseHigh) return true;
    if (reading.value <= CRITICAL_THRESHOLDS.glucoseLow) return true;
  }

  if (reading.type === 'temperature' && reading.value) {
    if (reading.value >= CRITICAL_THRESHOLDS.temperatureHigh) return true;
    if (reading.value <= CRITICAL_THRESHOLDS.temperatureLow) return true;
  }

  return false;
}

/**
 * Validate a vital reading against acceptable ranges
 */
export function validateReading(reading: VitalReading): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (reading.type === 'blood_pressure') {
    const bp = reading as BloodPressureReading;
    if (bp.systolic < VITAL_RANGES.systolic.min || bp.systolic > VITAL_RANGES.systolic.max) {
      errors.push(`Systolic should be between ${VITAL_RANGES.systolic.min}-${VITAL_RANGES.systolic.max} ${VITAL_RANGES.systolic.unit}`);
    }
    if (bp.diastolic < VITAL_RANGES.diastolic.min || bp.diastolic > VITAL_RANGES.diastolic.max) {
      errors.push(`Diastolic should be between ${VITAL_RANGES.diastolic.min}-${VITAL_RANGES.diastolic.max} ${VITAL_RANGES.diastolic.unit}`);
    }
    if (bp.pulse && (bp.pulse < VITAL_RANGES.pulse.min || bp.pulse > VITAL_RANGES.pulse.max)) {
      errors.push(`Pulse should be between ${VITAL_RANGES.pulse.min}-${VITAL_RANGES.pulse.max} ${VITAL_RANGES.pulse.unit}`);
    }
    if (bp.systolic <= bp.diastolic) {
      errors.push('Systolic must be higher than diastolic');
    }
  }

  if (reading.type === 'glucose' && reading.value) {
    if (reading.value < VITAL_RANGES.glucose.min || reading.value > VITAL_RANGES.glucose.max) {
      errors.push(`Glucose should be between ${VITAL_RANGES.glucose.min}-${VITAL_RANGES.glucose.max} ${VITAL_RANGES.glucose.unit}`);
    }
  }

  if (reading.type === 'weight' && reading.value) {
    if (reading.value < VITAL_RANGES.weight.min || reading.value > VITAL_RANGES.weight.max) {
      errors.push(`Weight should be between ${VITAL_RANGES.weight.min}-${VITAL_RANGES.weight.max} ${VITAL_RANGES.weight.unit}`);
    }
  }

  if (reading.type === 'heart_rate' && reading.value) {
    if (reading.value < VITAL_RANGES.heartRate.min || reading.value > VITAL_RANGES.heartRate.max) {
      errors.push(`Heart rate should be between ${VITAL_RANGES.heartRate.min}-${VITAL_RANGES.heartRate.max} ${VITAL_RANGES.heartRate.unit}`);
    }
  }

  if (reading.type === 'temperature' && reading.value) {
    if (reading.value < VITAL_RANGES.temperature.min || reading.value > VITAL_RANGES.temperature.max) {
      errors.push(`Temperature should be between ${VITAL_RANGES.temperature.min}-${VITAL_RANGES.temperature.max} ${VITAL_RANGES.temperature.unit}`);
    }
  }

  if (reading.type === 'pulse_oximeter' && reading.value) {
    if (reading.value < VITAL_RANGES.pulseOximeter.min || reading.value > VITAL_RANGES.pulseOximeter.max) {
      errors.push(`Oxygen saturation should be between ${VITAL_RANGES.pulseOximeter.min}-${VITAL_RANGES.pulseOximeter.max}${VITAL_RANGES.pulseOximeter.unit}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
