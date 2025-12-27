/**
 * Wearable Service
 * Enterprise service layer for Apple Watch, Fitbit, Garmin integration
 *
 * Clinical Use Cases: Fall detection, vital signs monitoring, activity tracking
 * Compliance: HIPAA, Apple HealthKit, Fitbit API, Garmin Health API
 */

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess } from './phiAccessLogger';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import { wearableRegistry } from '../adapters/wearables';
import { getErrorMessage } from '../lib/getErrorMessage';
import type {
  WearableConnection,
  WearableVitalSign,
  WearableActivityData,
  WearableFallDetection,
  WearableGaitAnalysis,
  WearableDeviceType,
  ConnectWearableRequest,
  WearableDataSyncRequest,
} from '../types/neuroSuite';

/**
 * API Response wrapper for consistent error handling
 */
export interface WearableApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Wearable Service - Device Integration API
 */
export class WearableService {
  // ============================================================================
  // DEVICE CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Connect wearable device (OAuth flow)
   * NOTE: This stores connection metadata. Actual OAuth handled by device-specific flows.
   */
  static async connectDevice(
    request: ConnectWearableRequest
  ): Promise<WearableApiResponse<WearableConnection>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if device already connected
      const { data: existing, error: existingError } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', request.user_id)
        .eq('device_type', request.device_type)
        .maybeSingle();

      if (existingError) throw new Error(existingError.message);

      if (existing) {
        const { data, error } = await supabase
          .from('wearable_connections')
          .update({
            connected: true,
            last_sync: new Date().toISOString(),
            api_token: request.auth_code, // Should be encrypted in production
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return { success: true, data };
      }

      const { data, error } = await supabase
        .from('wearable_connections')
        .insert({
          user_id: request.user_id,
          device_type: request.device_type,
          device_model: this.getDeviceModel(request.device_type),
          connected: true,
          last_sync: new Date().toISOString(),
          sync_frequency_minutes: 15, // Default to 15-minute sync
          permissions_granted: this.getDefaultPermissions(request.device_type),
          api_token: request.auth_code, // Should be encrypted in production
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get device model based on type
   */
  static getDeviceModel(deviceType: WearableDeviceType): string {
    const models: Record<WearableDeviceType, string> = {
      apple_watch: 'Apple Watch',
      fitbit: 'Fitbit',
      garmin: 'Garmin',
      samsung_health: 'Samsung Health',
      withings: 'Withings',
      empatica: 'Empatica',
      ihealth: 'iHealth',
      amazfit: 'Amazfit',
      other: 'Other',
    };
    return models[deviceType] || 'Unknown';
  }

  /**
   * Get default permissions for device type
   */
  static getDefaultPermissions(deviceType: WearableDeviceType): string[] {
    const permissions: Record<WearableDeviceType, string[]> = {
      apple_watch: ['heart_rate', 'steps', 'fall_detection', 'sleep', 'activity'],
      fitbit: ['heart_rate', 'steps', 'fall_detection', 'sleep', 'activity'],
      garmin: ['heart_rate', 'steps', 'activity', 'sleep'],
      samsung_health: ['heart_rate', 'steps', 'activity', 'blood_pressure', 'ecg'],
      withings: ['heart_rate', 'blood_pressure', 'weight', 'sleep'],
      empatica: ['heart_rate', 'seizure_detection'],
      ihealth: ['blood_pressure', 'weight', 'glucose', 'spo2', 'activity'],
      amazfit: ['heart_rate', 'steps', 'activity', 'sleep', 'spo2'],
      other: ['heart_rate', 'activity'],
    };
    return permissions[deviceType] || ['heart_rate'];
  }

  /**
   * Disconnect device
   */
  static async disconnectDevice(
    connectionId: string
  ): Promise<WearableApiResponse<WearableConnection>> {
    try {
      const { data, error } = await supabase
        .from('wearable_connections')
        .update({
          connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get user's connected devices
   */
  static async getConnectedDevices(
    userId: string
  ): Promise<WearableApiResponse<WearableConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('connected', true);

      if (error) throw new Error(error.message);

      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // VITAL SIGNS DATA
  // ============================================================================

  /**
   * Store vital sign reading from wearable
   */
  static async storeVitalSign(
    userId: string,
    deviceId: string,
    vitalType:
      | 'heart_rate'
      | 'blood_pressure'
      | 'oxygen_saturation'
      | 'temperature'
      | 'respiratory_rate',
    value: number,
    unit: string,
    measuredAt: string,
    activityState?: 'resting' | 'active' | 'sleeping'
  ): Promise<WearableApiResponse<WearableVitalSign>> {
    try {
      const alertInfo = this.detectAbnormalVital(vitalType, value);

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .insert({
          user_id: userId,
          device_id: deviceId,
          vital_type: vitalType,
          value,
          unit,
          measured_at: measuredAt,
          activity_state: activityState,
          quality_indicator: 'good',
          alert_triggered: alertInfo.alert,
          alert_type: alertInfo.alertType,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (alertInfo.alert) {
        await this.sendVitalAlert(userId, vitalType, value, alertInfo.alertType);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Detect abnormal vital signs
   */
  static detectAbnormalVital(
    vitalType: string,
    value: number
  ): { alert: boolean; alertType?: 'high' | 'low' | 'irregular' } {
    const thresholds: Record<string, { low?: number; high?: number }> = {
      heart_rate: { low: 50, high: 120 },
      blood_pressure: { low: 90, high: 140 },
      oxygen_saturation: { low: 90 },
      temperature: { low: 95, high: 100.4 },
      respiratory_rate: { low: 12, high: 20 },
    };

    const threshold = thresholds[vitalType];
    if (!threshold) return { alert: false };

    if (typeof threshold.low === 'number' && value < threshold.low) {
      return { alert: true, alertType: 'low' };
    }
    if (typeof threshold.high === 'number' && value > threshold.high) {
      return { alert: true, alertType: 'high' };
    }

    return { alert: false };
  }

  /**
   * Send vital sign alert to care team
   */
  static async sendVitalAlert(
    _userId: string,
    _vitalType: string,
    _value: number,
    _alertType?: 'high' | 'low' | 'irregular'
  ): Promise<void> {
    // TODO: Integrate with notification system
  }

  /**
   * Get vital signs trend for patient
   */
  static async getVitalsTrend(
    userId: string,
    vitalType: string,
    days: number = 7
  ): Promise<WearableApiResponse<WearableVitalSign[]>> {
    try {
      await logPhiAccess({
        phiType: 'wearable_data',
        phiResourceId: `vitals_${userId}_${vitalType}`,
        patientId: userId,
        accessType: 'view',
        accessMethod: 'API',
        purpose: 'treatment',
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = supabase
        .from('wearable_vital_signs')
        .select('*')
        .eq('user_id', userId)
        .eq('vital_type', vitalType)
        .gte('measured_at', startDate.toISOString())
        .order('measured_at', { ascending: true });

      const data = await applyLimit<WearableVitalSign>(
        query,
        PAGINATION_LIMITS.WEARABLE_VITALS
      );

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // ACTIVITY DATA
  // ============================================================================

  /**
   * Store daily activity summary from wearable
   */
  static async storeActivityData(
    userId: string,
    deviceId: string,
    date: string,
    activityData: {
      steps?: number;
      distance_meters?: number;
      active_minutes?: number;
      calories_burned?: number;
      floors_climbed?: number;
      sleep_minutes?: number;
      deep_sleep_minutes?: number;
      rem_sleep_minutes?: number;
      sleep_quality_score?: number;
      sedentary_minutes?: number;
    }
  ): Promise<WearableApiResponse<WearableActivityData>> {
    try {
      const { data, error } = await supabase
        .from('wearable_activity_data')
        .upsert({
          user_id: userId,
          device_id: deviceId,
          date,
          ...activityData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get activity summary for date range
   */
  static async getActivitySummary(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<WearableApiResponse<WearableActivityData[]>> {
    try {
      const query = supabase
        .from('wearable_activity_data')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      const data = await applyLimit<WearableActivityData>(
        query,
        PAGINATION_LIMITS.WEARABLE_ACTIVITIES
      );

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // FALL DETECTION
  // ============================================================================

  /**
   * Process fall detection event
   */
  static async processFallDetection(
    userId: string,
    deviceId: string,
    fallData: {
      detectedAt: string;
      fallSeverity?: 'low' | 'medium' | 'high';
      latitude?: number;
      longitude?: number;
      locationAccuracyMeters?: number;
    }
  ): Promise<WearableApiResponse<WearableFallDetection>> {
    try {
      const { data, error } = await supabase
        .from('wearable_fall_detections')
        .insert({
          user_id: userId,
          device_id: deviceId,
          detected_at: fallData.detectedAt,
          fall_severity: fallData.fallSeverity || 'medium',
          latitude: fallData.latitude,
          longitude: fallData.longitude,
          location_accuracy_meters: fallData.locationAccuracyMeters,
          user_responded: false,
          emergency_contact_notified: false,
          ems_dispatched: false,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await this.sendFallAlert(userId, data.id, fallData);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Send fall alert to emergency contacts
   */
  static async sendFallAlert(
    _userId: string,
    _fallId: string,
    _fallData: {
      detectedAt: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<void> {
    // TODO: Integrate with emergency notification system
  }

  /**
   * Get fall detection history for user
   */
  static async getFallDetectionHistory(
    userId: string,
    days: number = 30
  ): Promise<WearableApiResponse<WearableFallDetection[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = supabase
        .from('wearable_fall_detections')
        .select('*')
        .eq('user_id', userId)
        .gte('detected_at', startDate.toISOString())
        .order('detected_at', { ascending: false });

      const data = await applyLimit<WearableFallDetection>(query, 100);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Update fall event with user response
   */
  static async updateFallResponse(
    fallId: string,
    userOk: boolean,
    responseTimeSeconds: number
  ): Promise<WearableApiResponse<WearableFallDetection>> {
    try {
      const { data, error } = await supabase
        .from('wearable_fall_detections')
        .update({
          user_responded: true,
          user_response_time_seconds: responseTimeSeconds,
          injury_reported: !userOk,
        })
        .eq('id', fallId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get fall detection history
   */
  static async getFallHistory(
    userId: string,
    days: number = 30
  ): Promise<WearableApiResponse<WearableFallDetection[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('wearable_fall_detections')
        .select('*')
        .eq('user_id', userId)
        .gte('detected_at', startDate.toISOString())
        .order('detected_at', { ascending: false });

      if (error) throw new Error(error.message);

      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // GAIT ANALYSIS
  // ============================================================================

  /**
   * Store gait analysis data
   */
  static async storeGaitAnalysis(
    userId: string,
    deviceId: string,
    gaitData: {
      recordedAt: string;
      durationSeconds: number;
      stepCount?: number;
      cadence?: number;
      strideLengthCm?: number;
      gaitSpeedMPerS?: number;
      doubleSupportTimePercent?: number;
      gaitVariabilityScore?: number;
      posturalSwayMm?: number;
      tremorDetected?: boolean;
      tremorFrequencyHz?: number;
      freezingOfGaitEpisodes?: number;
    }
  ): Promise<WearableApiResponse<WearableGaitAnalysis>> {
    try {
      const { data, error } = await supabase
        .from('wearable_gait_analysis')
        .insert({
          user_id: userId,
          device_id: deviceId,
          recorded_at: gaitData.recordedAt,
          duration_seconds: gaitData.durationSeconds,
          step_count: gaitData.stepCount,
          cadence: gaitData.cadence,
          stride_length_cm: gaitData.strideLengthCm,
          gait_speed_m_per_s: gaitData.gaitSpeedMPerS,
          double_support_time_percent: gaitData.doubleSupportTimePercent,
          gait_variability_score: gaitData.gaitVariabilityScore,
          postural_sway_mm: gaitData.posturalSwayMm,
          tremor_detected: gaitData.tremorDetected,
          tremor_frequency_hz: gaitData.tremorFrequencyHz,
          freezing_of_gait_episodes: gaitData.freezingOfGaitEpisodes,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  // ============================================================================
  // DATA SYNC
  // ============================================================================

  /**
   * Sync wearable data (called by background job or manual trigger)
   */
  static async syncWearableData(
    request: WearableDataSyncRequest
  ): Promise<WearableApiResponse<{ synced: number; failed: number }>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: connection, error: connError } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_type', request.deviceType)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        throw new Error(`Device not connected: ${request.deviceType}`);
      }

      const adapter = wearableRegistry.getConnection(connection.connection_id);

      if (!adapter) {
        throw new Error(`No active adapter for ${request.deviceType}`);
      }

      let syncedCount = 0;
      let failedCount = 0;

      if (request.dataTypes?.includes('vitals')) {
        try {
          const vitals = await adapter.fetchVitals({
            userId: user.id,
            startDate: request.startDate,
            endDate: request.endDate,
          });

          for (const vital of vitals) {
            try {
              await this.storeVitalSign(
                user.id,
                connection.connection_id,
                vital.type as
                  | 'heart_rate'
                  | 'blood_pressure'
                  | 'oxygen_saturation'
                  | 'temperature'
                  | 'respiratory_rate',
                typeof vital.value === 'object' ? vital.value.systolic : vital.value,
                vital.unit,
                vital.timestamp.toISOString(),
                vital.metadata?.context as
                  | 'resting'
                  | 'active'
                  | 'sleeping'
                  | undefined
              );
              syncedCount++;
            } catch {
              failedCount++;
            }
          }
        } catch {
          failedCount++;
        }
      }

      if (request.dataTypes?.includes('activity')) {
        try {
          const activities = await adapter.fetchActivity({
            userId: user.id,
            startDate:
              request.startDate ||
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: request.endDate || new Date(),
          });

          for (const activity of activities) {
            try {
              await this.storeActivityData(
                user.id,
                connection.connection_id,
                activity.date.toISOString().split('T')[0],
                {
                  steps: activity.steps,
                  distance_meters: activity.distanceMeters,
                  calories_burned: activity.caloriesBurned,
                  active_minutes: activity.activeMinutes,
                }
              );
              syncedCount++;
            } catch {
              failedCount++;
            }
          }
        } catch {
          failedCount++;
        }
      }

      await supabase
        .from('wearable_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('connection_id', connection.connection_id);

      await logPhiAccess({
        phiType: 'wearable_data',
        phiResourceId: connection.connection_id,
        patientId: user.id,
        accessType: 'create',
        accessMethod: 'API',
        purpose: 'operations',
      });

      return { success: true, data: { synced: syncedCount, failed: failedCount } };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Map device type to adapter ID
   */
  private static mapDeviceTypeToAdapter(deviceType: WearableDeviceType): string {
    const mapping: Record<string, string> = {
      apple_watch: 'apple-healthkit',
      fitbit: 'fitbit',
      garmin: 'garmin',
      withings: 'withings',
    };

    return mapping[deviceType] || 'generic';
  }
}
