/**
 * Apple HealthKit Adapter
 *
 * IMPORTANT: Apple HealthKit has NO public REST API.
 * This adapter reads HealthKit data that has been synced to the WellFit backend
 * by a companion iOS app using the native HealthKit SDK.
 *
 * Architecture:
 * 1. iOS companion app (Swift) reads HealthKit data on-device
 * 2. iOS app syncs data to WellFit backend via /api/wearables/apple/sync endpoint
 * 3. This adapter reads the synced data from the wearable_data table
 *
 * For iOS app implementation, see: /docs/adapters/apple-healthkit-ios-setup.md
 *
 * Supported data (when synced from iOS):
 * - Heart rate, SpO2, blood pressure, temperature
 * - Steps, distance, calories, exercise minutes
 * - Sleep analysis with stages
 * - Fall detection events (Apple Watch Series 4+)
 * - ECG readings (Apple Watch Series 4+)
 * - Blood oxygen (Apple Watch Series 6+)
 */

import type {
  WearableAdapter,
  WearableAdapterMetadata,
  WearableAdapterConfig,
  WearableVitalData,
  WearableActivityData,
  WearableFallEvent,
  WearableECGData,
} from '../UniversalWearableRegistry';
import { auditLogger } from '../../../services/auditLogger';
import { supabase } from '../../../lib/supabaseClient';

interface AppleHealthKitConfig extends WearableAdapterConfig {
  /** User ID in WellFit system */
  userId: string;
  /** Tenant ID for data isolation */
  tenantId?: string;
}

/** Database row types for synced Apple Health data */
interface AppleHealthSyncedVital {
  id: string;
  user_id: string;
  vital_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  device_model?: string;
  source_app?: string;
  metadata?: Record<string, unknown>;
}

interface AppleHealthSyncedActivity {
  id: string;
  user_id: string;
  date: string;
  steps: number;
  distance_meters: number;
  calories_burned: number;
  active_minutes: number;
  sleep_minutes?: number;
  metadata?: Record<string, unknown>;
}

interface AppleHealthSyncedSleep {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  deep_minutes?: number;
  light_minutes?: number;
  rem_minutes?: number;
  awake_minutes?: number;
}

interface AppleHealthSyncedFall {
  id: string;
  user_id: string;
  timestamp: string;
  severity: 'minor' | 'moderate' | 'severe' | 'unknown';
  latitude?: number;
  longitude?: number;
  user_responded: boolean;
  emergency_contacted: boolean;
}

interface AppleHealthSyncedECG {
  id: string;
  user_id: string;
  timestamp: string;
  classification: 'sinus_rhythm' | 'afib' | 'high_heart_rate' | 'low_heart_rate' | 'inconclusive';
  heart_rate: number;
  duration_seconds: number;
  waveform_data?: number[];
}

interface AppleHealthDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  device_model: string;
  last_sync_at: string;
  battery_level?: number;
}

export class AppleHealthKitAdapter implements WearableAdapter {
  metadata: WearableAdapterMetadata = {
    id: 'apple-healthkit',
    name: 'Apple HealthKit Adapter',
    vendor: 'Apple Inc.',
    version: '2.0.0',
    deviceTypes: ['smartwatch', 'smartphone'],
    capabilities: {
      heartRate: true,
      bloodPressure: true,
      bloodOxygen: true,
      temperature: true,
      respiratoryRate: true,
      steps: true,
      distance: true,
      calories: true,
      sleep: true,
      exerciseMinutes: true,
      fallDetection: true,
      ecg: true,
      gaitAnalysis: false, // Not yet synced from iOS
      glucoseMonitoring: true,
    },
    setupGuide: '/docs/adapters/apple-healthkit-setup.md',
    oauthRequired: false, // Data comes from iOS app, not OAuth
    certifications: ['Apple HealthKit'],
  };

  private config: AppleHealthKitConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  /**
   * Connect to synced Apple Health data for a user.
   * Note: Actual HealthKit connection happens on iOS device.
   */
  async connect(config: WearableAdapterConfig): Promise<void> {
    this.config = config as AppleHealthKitConfig;

    if (!this.config.userId) {
      throw new Error('Apple HealthKit adapter requires userId to read synced data');
    }

    // Verify user has synced data
    const { count, error } = await supabase
      .from('wearable_apple_health_vitals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', this.config.userId)
      .limit(1);

    if (error) {
      await auditLogger.error('APPLE_HEALTH_CONNECT_FAILED', error, {
        userId: this.config.userId,
      });
      this.status = 'error';
      throw new Error(`Failed to verify Apple Health data: ${error.message}`);
    }

    if (count === 0) {
      await auditLogger.warn('APPLE_HEALTH_NO_DATA', {
        userId: this.config.userId,
        message: 'No synced Apple Health data found. Ensure iOS companion app is set up.',
      });
    }

    this.status = 'connected';
    await auditLogger.info('APPLE_HEALTH_CONNECTED', {
      userId: this.config.userId,
      recordCount: count,
    });
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.status = 'disconnected';
  }

  async test(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    if (!this.config?.userId) {
      return {
        success: false,
        message: 'Not connected. Call connect() first with userId.',
      };
    }

    try {
      const { count, error } = await supabase
        .from('wearable_apple_health_vitals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', this.config.userId);

      if (error) throw error;

      const { data: devices } = await supabase
        .from('wearable_apple_health_devices')
        .select('device_name, device_model, last_sync_at')
        .eq('user_id', this.config.userId)
        .order('last_sync_at', { ascending: false })
        .limit(5);

      return {
        success: true,
        message: `Connected. Found ${count || 0} synced vital records.`,
        details: {
          vitalRecords: count || 0,
          devices: devices || [],
          lastSync: devices?.[0]?.last_sync_at || 'Never',
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      await auditLogger.error(
        'APPLE_HEALTH_TEST_FAILED',
        err instanceof Error ? err : new Error(message),
        { userId: this.config.userId }
      );
      return { success: false, message };
    }
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  /**
   * Apple HealthKit does not use OAuth from web.
   * Authorization happens on iOS device via HealthKit permission prompts.
   */
  getAuthorizationUrl(_scopes: string[]): string {
    throw new Error(
      'Apple HealthKit authorization is handled on iOS device, not via web OAuth. ' +
      'Install the WellFit iOS companion app to authorize HealthKit access.'
    );
  }

  async handleOAuthCallback(_code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    throw new Error(
      'Apple HealthKit does not use OAuth callback flow. ' +
      'Data is synced from iOS companion app.'
    );
  }

  async refreshAccessToken(_refreshToken: string): Promise<string> {
    throw new Error('Apple HealthKit does not use refresh tokens.');
  }

  async fetchVitals(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate'>;
  }): Promise<WearableVitalData[]> {
    const types = params.types || ['heart_rate', 'blood_pressure', 'spo2', 'temperature', 'respiratory_rate'];
    const vitals: WearableVitalData[] = [];

    for (const type of types) {
      try {
        let query = supabase
          .from('wearable_apple_health_vitals')
          .select('id, vital_type, value, unit, recorded_at, device_model, metadata')
          .eq('user_id', params.userId)
          .eq('vital_type', type)
          .order('recorded_at', { ascending: false })
          .limit(100);

        if (params.startDate) {
          query = query.gte('recorded_at', params.startDate.toISOString());
        }
        if (params.endDate) {
          query = query.lte('recorded_at', params.endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        for (const row of (data || []) as AppleHealthSyncedVital[]) {
          vitals.push({
            type: row.vital_type as 'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate',
            value: row.value,
            unit: row.unit,
            timestamp: new Date(row.recorded_at),
            metadata: {
              deviceModel: row.device_model || 'Apple Watch',
              context: row.metadata?.context as string | undefined,
            },
          });
        }
      } catch (err: unknown) {
        await auditLogger.error(
          'APPLE_HEALTH_VITAL_FETCH_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { vitalType: type, userId: params.userId }
        );
      }
    }

    return vitals;
  }

  async fetchActivity(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableActivityData[]> {
    try {
      const { data, error } = await supabase
        .from('wearable_apple_health_activity')
        .select('id, date, steps, distance_meters, calories_burned, active_minutes, sleep_minutes, metadata')
        .eq('user_id', params.userId)
        .gte('date', params.startDate.toISOString().split('T')[0])
        .lte('date', params.endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      return ((data || []) as AppleHealthSyncedActivity[]).map((row) => ({
        date: new Date(row.date),
        steps: row.steps,
        distanceMeters: row.distance_meters,
        caloriesBurned: row.calories_burned,
        activeMinutes: row.active_minutes,
        sleepMinutes: row.sleep_minutes,
        metadata: row.metadata,
      }));
    } catch (err: unknown) {
      await auditLogger.error(
        'APPLE_HEALTH_ACTIVITY_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId: params.userId }
      );
      return [];
    }
  }

  async fetchSleep(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    date: Date;
    duration: number;
    stages?: { deep: number; light: number; rem: number; awake: number };
  }[]> {
    try {
      const { data, error } = await supabase
        .from('wearable_apple_health_sleep')
        .select('id, start_time, duration_minutes, deep_minutes, light_minutes, rem_minutes, awake_minutes')
        .eq('user_id', params.userId)
        .gte('start_time', params.startDate.toISOString())
        .lte('start_time', params.endDate.toISOString())
        .order('start_time', { ascending: false });

      if (error) throw error;

      return ((data || []) as AppleHealthSyncedSleep[]).map((row) => ({
        date: new Date(row.start_time),
        duration: row.duration_minutes,
        stages: row.deep_minutes !== undefined ? {
          deep: row.deep_minutes || 0,
          light: row.light_minutes || 0,
          rem: row.rem_minutes || 0,
          awake: row.awake_minutes || 0,
        } : undefined,
      }));
    } catch (err: unknown) {
      await auditLogger.error(
        'APPLE_HEALTH_SLEEP_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId: params.userId }
      );
      return [];
    }
  }

  async fetchFallDetection(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableFallEvent[]> {
    try {
      const { data, error } = await supabase
        .from('wearable_apple_health_falls')
        .select('id, timestamp, severity, latitude, longitude, user_responded, emergency_contacted')
        .eq('user_id', params.userId)
        .gte('timestamp', params.startDate.toISOString())
        .lte('timestamp', params.endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return ((data || []) as AppleHealthSyncedFall[]).map((row) => ({
        timestamp: new Date(row.timestamp),
        severity: row.severity,
        location: row.latitude && row.longitude
          ? { latitude: row.latitude, longitude: row.longitude }
          : undefined,
        userResponded: row.user_responded,
        emergencyContacted: row.emergency_contacted,
      }));
    } catch (err: unknown) {
      await auditLogger.error(
        'APPLE_HEALTH_FALL_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId: params.userId }
      );
      return [];
    }
  }

  async fetchECG(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WearableECGData[]> {
    try {
      let query = supabase
        .from('wearable_apple_health_ecg')
        .select('id, timestamp, classification, heart_rate, duration_seconds, waveform_data')
        .eq('user_id', params.userId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (params.startDate) {
        query = query.gte('timestamp', params.startDate.toISOString());
      }
      if (params.endDate) {
        query = query.lte('timestamp', params.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return ((data || []) as AppleHealthSyncedECG[]).map((row) => ({
        timestamp: new Date(row.timestamp),
        classification: row.classification,
        heartRate: row.heart_rate,
        duration: row.duration_seconds,
        waveformData: row.waveform_data,
      }));
    } catch (err: unknown) {
      await auditLogger.error(
        'APPLE_HEALTH_ECG_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId: params.userId }
      );
      return [];
    }
  }

  async listConnectedDevices(userId: string): Promise<{
    deviceId: string;
    name: string;
    model: string;
    lastSyncDate: Date;
    batteryLevel?: number;
  }[]> {
    try {
      const { data, error } = await supabase
        .from('wearable_apple_health_devices')
        .select('device_id, device_name, device_model, last_sync_at, battery_level')
        .eq('user_id', userId)
        .order('last_sync_at', { ascending: false });

      if (error) throw error;

      return ((data || []) as AppleHealthDevice[]).map((row) => ({
        deviceId: row.device_id,
        name: row.device_name,
        model: row.device_model,
        lastSyncDate: new Date(row.last_sync_at),
        batteryLevel: row.battery_level,
      }));
    } catch (err: unknown) {
      await auditLogger.error(
        'APPLE_HEALTH_DEVICES_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId }
      );
      return [];
    }
  }

  getCapabilities(): WearableAdapterMetadata['capabilities'] {
    return this.metadata.capabilities;
  }

  supportsFeature(feature: string): boolean {
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }
}
