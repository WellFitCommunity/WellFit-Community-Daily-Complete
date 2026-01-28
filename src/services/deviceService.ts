/**
 * Device Service
 * Handles connected health devices (Scale, BP Monitor, Glucometer, Pulse Oximeter)
 * Integrates with wearable_connections and wearable_vital_signs tables
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { getErrorMessage } from '../lib/getErrorMessage';

// =============================================================================
// TYPES
// =============================================================================

export type DeviceType = 'smart_scale' | 'bp_monitor' | 'glucometer' | 'pulse_oximeter';

export interface DeviceConnection {
  id: string;
  user_id: string;
  device_type: DeviceType;
  device_name: string;
  connected: boolean;
  last_sync: string | null;
  created_at: string;
}

export interface WeightReading {
  id: string;
  user_id: string;
  device_id: string;
  weight: number;
  unit: 'lbs' | 'kg';
  bmi?: number;
  body_fat?: number;
  muscle_mass?: number;
  measured_at: string;
}

export interface BPReading {
  id: string;
  user_id: string;
  device_id: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  measured_at: string;
}

export interface GlucoseReading {
  id: string;
  user_id: string;
  device_id: string;
  value: number;
  meal_context: 'fasting' | 'before_meal' | 'after_meal' | 'bedtime';
  measured_at: string;
}

export interface SpO2Reading {
  id: string;
  user_id: string;
  device_id: string;
  spo2: number;
  pulse_rate: number;
  measured_at: string;
}

export interface DeviceApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validation thresholds for vital signs
 * Based on physiologically possible and clinically relevant ranges
 */
const VALIDATION_THRESHOLDS = {
  weight: {
    min: 1,        // 1 lb minimum (infants)
    max: 1500,     // World record is ~1400 lbs
    unit: 'lbs',
  },
  spo2: {
    min: 0,
    max: 100,      // Percentage cannot exceed 100
  },
  pulse: {
    min: 20,       // Severe bradycardia
    max: 300,      // Extreme tachycardia
  },
  systolic: {
    min: 40,       // Severe hypotension
    max: 300,      // Hypertensive crisis
  },
  diastolic: {
    min: 20,       // Severe hypotension
    max: 200,      // Hypertensive crisis
  },
  glucose: {
    min: 10,       // Severe hypoglycemia
    max: 800,      // Severe hyperglycemia
  },
  bmi: {
    min: 5,        // Severely underweight
    max: 100,      // Extreme obesity
  },
  bodyFat: {
    min: 1,
    max: 70,       // Percentage
  },
  muscleMass: {
    min: 1,
    max: 100,      // Percentage
  },
} as const;

/**
 * Validate weight reading
 */
function validateWeightReading(reading: { weight: number; bmi?: number; body_fat?: number; muscle_mass?: number }): ValidationResult {
  const { weight, bmi, body_fat, muscle_mass } = reading;

  // Check for impossible values
  if (weight <= 0) {
    return { valid: false, error: 'Weight must be greater than 0' };
  }
  if (weight > VALIDATION_THRESHOLDS.weight.max) {
    return { valid: false, error: `Weight cannot exceed ${VALIDATION_THRESHOLDS.weight.max} lbs` };
  }

  // BMI validation if provided
  if (bmi !== undefined) {
    if (bmi < VALIDATION_THRESHOLDS.bmi.min || bmi > VALIDATION_THRESHOLDS.bmi.max) {
      return { valid: false, error: `BMI must be between ${VALIDATION_THRESHOLDS.bmi.min} and ${VALIDATION_THRESHOLDS.bmi.max}` };
    }
  }

  // Body fat validation if provided
  if (body_fat !== undefined) {
    if (body_fat < VALIDATION_THRESHOLDS.bodyFat.min || body_fat > VALIDATION_THRESHOLDS.bodyFat.max) {
      return { valid: false, error: `Body fat must be between ${VALIDATION_THRESHOLDS.bodyFat.min}% and ${VALIDATION_THRESHOLDS.bodyFat.max}%` };
    }
  }

  // Muscle mass validation if provided
  if (muscle_mass !== undefined) {
    if (muscle_mass < VALIDATION_THRESHOLDS.muscleMass.min || muscle_mass > VALIDATION_THRESHOLDS.muscleMass.max) {
      return { valid: false, error: `Muscle mass must be between ${VALIDATION_THRESHOLDS.muscleMass.min}% and ${VALIDATION_THRESHOLDS.muscleMass.max}%` };
    }
  }

  return { valid: true };
}

/**
 * Validate blood pressure reading
 */
function validateBPReading(reading: { systolic: number; diastolic: number; pulse: number }): ValidationResult {
  const { systolic, diastolic, pulse } = reading;

  // Systolic validation
  if (systolic < VALIDATION_THRESHOLDS.systolic.min) {
    return { valid: false, error: `Systolic pressure cannot be below ${VALIDATION_THRESHOLDS.systolic.min} mmHg` };
  }
  if (systolic > VALIDATION_THRESHOLDS.systolic.max) {
    return { valid: false, error: `Systolic pressure cannot exceed ${VALIDATION_THRESHOLDS.systolic.max} mmHg` };
  }

  // Diastolic validation
  if (diastolic < VALIDATION_THRESHOLDS.diastolic.min) {
    return { valid: false, error: `Diastolic pressure cannot be below ${VALIDATION_THRESHOLDS.diastolic.min} mmHg` };
  }
  if (diastolic > VALIDATION_THRESHOLDS.diastolic.max) {
    return { valid: false, error: `Diastolic pressure cannot exceed ${VALIDATION_THRESHOLDS.diastolic.max} mmHg` };
  }

  // Systolic must be greater than diastolic
  if (systolic <= diastolic) {
    return { valid: false, error: 'Systolic pressure must be greater than diastolic pressure' };
  }

  // Pulse validation
  if (pulse < VALIDATION_THRESHOLDS.pulse.min) {
    return { valid: false, error: `Pulse cannot be below ${VALIDATION_THRESHOLDS.pulse.min} bpm` };
  }
  if (pulse > VALIDATION_THRESHOLDS.pulse.max) {
    return { valid: false, error: `Pulse cannot exceed ${VALIDATION_THRESHOLDS.pulse.max} bpm` };
  }

  return { valid: true };
}

/**
 * Validate glucose reading
 */
function validateGlucoseReading(reading: { value: number }): ValidationResult {
  const { value } = reading;

  if (value < VALIDATION_THRESHOLDS.glucose.min) {
    return { valid: false, error: `Glucose cannot be below ${VALIDATION_THRESHOLDS.glucose.min} mg/dL` };
  }
  if (value > VALIDATION_THRESHOLDS.glucose.max) {
    return { valid: false, error: `Glucose cannot exceed ${VALIDATION_THRESHOLDS.glucose.max} mg/dL` };
  }

  return { valid: true };
}

/**
 * Validate SpO2 reading
 */
function validateSpO2Reading(reading: { spo2: number; pulse_rate: number }): ValidationResult {
  const { spo2, pulse_rate } = reading;

  // SpO2 validation
  if (spo2 < VALIDATION_THRESHOLDS.spo2.min) {
    return { valid: false, error: 'SpO2 cannot be negative' };
  }
  if (spo2 > VALIDATION_THRESHOLDS.spo2.max) {
    return { valid: false, error: 'SpO2 cannot exceed 100%' };
  }

  // Pulse rate validation
  if (pulse_rate < VALIDATION_THRESHOLDS.pulse.min) {
    return { valid: false, error: `Pulse rate cannot be below ${VALIDATION_THRESHOLDS.pulse.min} bpm` };
  }
  if (pulse_rate > VALIDATION_THRESHOLDS.pulse.max) {
    return { valid: false, error: `Pulse rate cannot exceed ${VALIDATION_THRESHOLDS.pulse.max} bpm` };
  }

  return { valid: true };
}

// =============================================================================
// DEVICE SERVICE
// =============================================================================

export class DeviceService {
  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Connect a device for the current user
   */
  static async connectDevice(
    deviceType: DeviceType,
    deviceName: string
  ): Promise<DeviceApiResponse<DeviceConnection>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if device already exists
      const { data: existing } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_type', deviceType)
        .maybeSingle();

      if (existing) {
        // Update existing connection
        const { data, error } = await supabase
          .from('wearable_connections')
          .update({
            connected: true,
            device_model: deviceName,
            last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw new Error(error.message);

        await auditLogger.info('DEVICE_RECONNECTED', {
          deviceType,
          deviceId: existing.id,
        });

        return { success: true, data: this.mapConnection(data) };
      }

      // Create new connection
      const { data, error } = await supabase
        .from('wearable_connections')
        .insert({
          user_id: user.id,
          device_type: deviceType,
          device_model: deviceName,
          connected: true,
          last_sync: new Date().toISOString(),
          sync_frequency_minutes: 15,
          permissions_granted: this.getPermissions(deviceType),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await auditLogger.info('DEVICE_CONNECTED', {
        deviceType,
        deviceId: data.id,
      });

      return { success: true, data: this.mapConnection(data) };
    } catch (err: unknown) {
      await auditLogger.error('DEVICE_CONNECT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { deviceType }
      );
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Disconnect a device
   */
  static async disconnectDevice(deviceType: DeviceType): Promise<DeviceApiResponse<void>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('wearable_connections')
        .update({
          connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('device_type', deviceType);

      if (error) throw new Error(error.message);

      await auditLogger.info('DEVICE_DISCONNECTED', { deviceType });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get connection status for a device type
   */
  static async getConnectionStatus(deviceType: DeviceType): Promise<DeviceApiResponse<DeviceConnection | null>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_type', deviceType)
        .maybeSingle();

      if (error) throw new Error(error.message);

      return { success: true, data: data ? this.mapConnection(data) : null };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get all connected devices for current user
   */
  static async getAllConnections(): Promise<DeviceApiResponse<DeviceConnection[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('connected', true);

      if (error) throw new Error(error.message);

      return { success: true, data: (data || []).map(d => this.mapConnection(d)) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ===========================================================================
  // WEIGHT/SCALE READINGS
  // ===========================================================================

  static async saveWeightReading(reading: Omit<WeightReading, 'id' | 'user_id'>): Promise<DeviceApiResponse<WeightReading>> {
    try {
      // Validate reading
      const validation = validateWeightReading(reading);
      if (!validation.valid) {
        await auditLogger.warn('WEIGHT_READING_REJECTED', { reason: validation.error, reading });
        return { success: false, error: validation.error };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .insert({
          user_id: user.id,
          device_id: reading.device_id,
          vital_type: 'weight',
          value: reading.weight,
          unit: reading.unit,
          measured_at: reading.measured_at,
          metadata: {
            bmi: reading.bmi,
            body_fat: reading.body_fat,
            muscle_mass: reading.muscle_mass,
          },
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await auditLogger.info('WEIGHT_READING_SAVED', { readingId: data.id });

      return { success: true, data: this.mapWeightReading(data) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  static async getWeightReadings(limit = 10): Promise<DeviceApiResponse<WeightReading[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .select('*')
        .eq('user_id', user.id)
        .eq('vital_type', 'weight')
        .order('measured_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return { success: true, data: (data || []).map(d => this.mapWeightReading(d)) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ===========================================================================
  // BLOOD PRESSURE READINGS
  // ===========================================================================

  static async saveBPReading(reading: Omit<BPReading, 'id' | 'user_id'>): Promise<DeviceApiResponse<BPReading>> {
    try {
      // Validate reading
      const validation = validateBPReading(reading);
      if (!validation.valid) {
        await auditLogger.warn('BP_READING_REJECTED', { reason: validation.error, reading });
        return { success: false, error: validation.error };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .insert({
          user_id: user.id,
          device_id: reading.device_id,
          vital_type: 'blood_pressure',
          value: reading.systolic, // Primary value
          unit: 'mmHg',
          measured_at: reading.measured_at,
          metadata: {
            systolic: reading.systolic,
            diastolic: reading.diastolic,
            pulse: reading.pulse,
          },
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await auditLogger.info('BP_READING_SAVED', { readingId: data.id });

      return { success: true, data: this.mapBPReading(data) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  static async getBPReadings(limit = 10): Promise<DeviceApiResponse<BPReading[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .select('*')
        .eq('user_id', user.id)
        .eq('vital_type', 'blood_pressure')
        .order('measured_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return { success: true, data: (data || []).map(d => this.mapBPReading(d)) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ===========================================================================
  // GLUCOSE READINGS
  // ===========================================================================

  static async saveGlucoseReading(reading: Omit<GlucoseReading, 'id' | 'user_id'>): Promise<DeviceApiResponse<GlucoseReading>> {
    try {
      // Validate reading
      const validation = validateGlucoseReading(reading);
      if (!validation.valid) {
        await auditLogger.warn('GLUCOSE_READING_REJECTED', { reason: validation.error, reading });
        return { success: false, error: validation.error };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .insert({
          user_id: user.id,
          device_id: reading.device_id,
          vital_type: 'glucose',
          value: reading.value,
          unit: 'mg/dL',
          measured_at: reading.measured_at,
          metadata: {
            meal_context: reading.meal_context,
          },
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await auditLogger.info('GLUCOSE_READING_SAVED', { readingId: data.id });

      return { success: true, data: this.mapGlucoseReading(data) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  static async getGlucoseReadings(limit = 10): Promise<DeviceApiResponse<GlucoseReading[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .select('*')
        .eq('user_id', user.id)
        .eq('vital_type', 'glucose')
        .order('measured_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return { success: true, data: (data || []).map(d => this.mapGlucoseReading(d)) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ===========================================================================
  // SPO2 / PULSE OXIMETER READINGS
  // ===========================================================================

  static async saveSpO2Reading(reading: Omit<SpO2Reading, 'id' | 'user_id'>): Promise<DeviceApiResponse<SpO2Reading>> {
    try {
      // Validate reading
      const validation = validateSpO2Reading(reading);
      if (!validation.valid) {
        await auditLogger.warn('SPO2_READING_REJECTED', { reason: validation.error, reading });
        return { success: false, error: validation.error };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .insert({
          user_id: user.id,
          device_id: reading.device_id,
          vital_type: 'oxygen_saturation',
          value: reading.spo2,
          unit: '%',
          measured_at: reading.measured_at,
          metadata: {
            pulse_rate: reading.pulse_rate,
          },
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await auditLogger.info('SPO2_READING_SAVED', { readingId: data.id });

      return { success: true, data: this.mapSpO2Reading(data) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  static async getSpO2Readings(limit = 10): Promise<DeviceApiResponse<SpO2Reading[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .select('*')
        .eq('user_id', user.id)
        .eq('vital_type', 'oxygen_saturation')
        .order('measured_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return { success: true, data: (data || []).map(d => this.mapSpO2Reading(d)) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private static getPermissions(deviceType: DeviceType): string[] {
    const permissions: Record<DeviceType, string[]> = {
      smart_scale: ['weight', 'bmi', 'body_composition'],
      bp_monitor: ['blood_pressure', 'pulse'],
      glucometer: ['glucose'],
      pulse_oximeter: ['oxygen_saturation', 'pulse'],
    };
    return permissions[deviceType] || [];
  }

  private static mapConnection(data: Record<string, unknown>): DeviceConnection {
    return {
      id: String(data.id),
      user_id: String(data.user_id),
      device_type: data.device_type as DeviceType,
      device_name: String(data.device_model || ''),
      connected: Boolean(data.connected),
      last_sync: data.last_sync as string | null,
      created_at: String(data.created_at),
    };
  }

  private static mapWeightReading(data: Record<string, unknown>): WeightReading {
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    return {
      id: String(data.id),
      user_id: String(data.user_id),
      device_id: String(data.device_id),
      weight: Number(data.value),
      unit: (String(data.unit) || 'lbs') as 'lbs' | 'kg',
      bmi: metadata.bmi as number | undefined,
      body_fat: metadata.body_fat as number | undefined,
      muscle_mass: metadata.muscle_mass as number | undefined,
      measured_at: String(data.measured_at),
    };
  }

  private static mapBPReading(data: Record<string, unknown>): BPReading {
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    return {
      id: String(data.id),
      user_id: String(data.user_id),
      device_id: String(data.device_id),
      systolic: Number(metadata.systolic || data.value),
      diastolic: Number(metadata.diastolic || 0),
      pulse: Number(metadata.pulse || 0),
      measured_at: String(data.measured_at),
    };
  }

  private static mapGlucoseReading(data: Record<string, unknown>): GlucoseReading {
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    return {
      id: String(data.id),
      user_id: String(data.user_id),
      device_id: String(data.device_id),
      value: Number(data.value),
      meal_context: (metadata.meal_context as GlucoseReading['meal_context']) || 'fasting',
      measured_at: String(data.measured_at),
    };
  }

  private static mapSpO2Reading(data: Record<string, unknown>): SpO2Reading {
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    return {
      id: String(data.id),
      user_id: String(data.user_id),
      device_id: String(data.device_id),
      spo2: Number(data.value),
      pulse_rate: Number(metadata.pulse_rate || 0),
      measured_at: String(data.measured_at),
    };
  }
}

export default DeviceService;
