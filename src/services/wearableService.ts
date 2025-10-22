/**
 * Wearable Service
 * Enterprise service layer for Apple Watch, Fitbit, Garmin integration
 *
 * Clinical Use Cases: Fall detection, vital signs monitoring, activity tracking
 * Compliance: HIPAA, Apple HealthKit, Fitbit API, Garmin Health API
 */

import { supabase } from '../lib/supabaseClient';
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
      const { data: existing } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', request.user_id)
        .eq('device_type', request.device_type)
        .maybeSingle();

      if (existing) {
        // Update existing connection
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

        if (error) throw error;
        return { success: true, data };
      }

      // Create new connection
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

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.connectDevice error:', error);
      return { success: false, error: error.message };
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
      samsung_health: ['heart_rate', 'steps', 'activity'],
      withings: ['heart_rate', 'blood_pressure', 'weight'],
      empatica: ['heart_rate', 'seizure_detection'],
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

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.disconnectDevice error:', error);
      return { success: false, error: error.message };
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

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('WearableService.getConnectedDevices error:', error);
      return { success: false, error: error.message };
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
    vitalType: 'heart_rate' | 'blood_pressure' | 'oxygen_saturation' | 'temperature' | 'respiratory_rate',
    value: number,
    unit: string,
    measuredAt: string,
    activityState?: 'resting' | 'active' | 'sleeping'
  ): Promise<WearableApiResponse<WearableVitalSign>> {
    try {
      // Detect abnormal values and trigger alerts
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

      if (error) throw error;

      // If alert triggered, notify care team
      if (alertInfo.alert) {
        await this.sendVitalAlert(userId, vitalType, value, alertInfo.alertType);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.storeVitalSign error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect abnormal vital signs
   */
  static detectAbnormalVital(
    vitalType: string,
    value: number
  ): { alert: boolean; alertType?: 'high' | 'low' | 'irregular' } {
    // Clinical thresholds for alerts
    const thresholds: Record<string, { low?: number; high?: number }> = {
      heart_rate: { low: 50, high: 120 }, // Resting HR
      blood_pressure: { low: 90, high: 140 }, // Systolic BP
      oxygen_saturation: { low: 90 }, // SpO2 %
      temperature: { low: 95, high: 100.4 }, // Fahrenheit
      respiratory_rate: { low: 12, high: 20 },
    };

    const threshold = thresholds[vitalType];
    if (!threshold) return { alert: false };

    if (threshold.low && value < threshold.low) {
      return { alert: true, alertType: 'low' };
    }
    if (threshold.high && value > threshold.high) {
      return { alert: true, alertType: 'high' };
    }

    return { alert: false };
  }

  /**
   * Send vital sign alert to care team
   */
  static async sendVitalAlert(
    userId: string,
    vitalType: string,
    value: number,
    alertType?: 'high' | 'low' | 'irregular'
  ): Promise<void> {
    // TODO: Integrate with notification system
    console.log(`VITAL ALERT: User ${userId} - ${vitalType} ${alertType}: ${value}`);
    // In production, this would:
    // 1. Send push notification to care team
    // 2. Create alert in dashboard
    // 3. If critical, call emergency contacts
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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('wearable_vital_signs')
        .select('*')
        .eq('user_id', userId)
        .eq('vital_type', vitalType)
        .gte('measured_at', startDate.toISOString())
        .order('measured_at', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('WearableService.getVitalsTrend error:', error);
      return { success: false, error: error.message };
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

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.storeActivityData error:', error);
      return { success: false, error: error.message };
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
      const { data, error } = await supabase
        .from('wearable_activity_data')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('WearableService.getActivitySummary error:', error);
      return { success: false, error: error.message };
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

      if (error) throw error;

      // Immediately send fall alert
      await this.sendFallAlert(userId, data.id, fallData);

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.processFallDetection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send fall alert to emergency contacts
   */
  static async sendFallAlert(
    userId: string,
    fallId: string,
    fallData: {
      detectedAt: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<void> {
    // TODO: Integrate with emergency notification system
    console.log(`FALL ALERT: User ${userId} fell at ${fallData.detectedAt}`);
    if (fallData.latitude && fallData.longitude) {
      console.log(`Location: ${fallData.latitude}, ${fallData.longitude}`);
    }

    // In production, this would:
    // 1. Send push notification to emergency contacts
    // 2. Call emergency contacts if no response in 60 seconds
    // 3. Dispatch EMS if severe fall and no response
    // 4. Create incident report in system
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

      const { data, error } = await supabase
        .from('wearable_fall_detections')
        .select('*')
        .eq('user_id', userId)
        .gte('detected_at', startDate.toISOString())
        .order('detected_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('WearableService.getFallDetectionHistory error:', error);
      return { success: false, error: error.message };
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

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.updateFallResponse error:', error);
      return { success: false, error: error.message };
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

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('WearableService.getFallHistory error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // GAIT ANALYSIS (Advanced - Parkinson's monitoring)
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

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('WearableService.storeGaitAnalysis error:', error);
      return { success: false, error: error.message };
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
      // This is a placeholder for actual device API integration
      // In production, this would:
      // 1. Call device-specific API (Apple HealthKit, Fitbit API, etc.)
      // 2. Fetch data for date range
      // 3. Store in wearable_vital_signs, wearable_activity_data tables
      // 4. Update last_sync timestamp

      console.log(`Syncing data for device ${request.device_id} from ${request.start_date} to ${request.end_date}`);

      return {
        success: true,
        data: { synced: 0, failed: 0 },
      };
    } catch (error: any) {
      console.error('WearableService.syncWearableData error:', error);
      return { success: false, error: error.message };
    }
  }
}
