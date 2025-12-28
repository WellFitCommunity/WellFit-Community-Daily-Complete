/**
 * BEHAVIORAL ANALYTICS SERVICE
 *
 * AI-powered anomaly detection and behavioral analysis
 * Compliant with HIPAA §164.312(b) audit controls
 *
 * Features:
 * - Impossible travel detection (Haversine formula)
 * - Peer group comparison
 * - Risk scoring and aggregation
 * - Behavioral baseline tracking
 * - Automated investigation workflows
 *
 * @module BehavioralAnalyticsService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AnomalyType =
  | 'impossible_travel'
  | 'unusual_access_time'
  | 'excessive_phi_access'
  | 'peer_group_deviation'
  | 'rapid_consecutive_access'
  | 'unauthorized_location';

export interface AnomalyDetection {
  id: string;
  user_id: string;
  anomaly_type: AnomalyType;
  aggregate_anomaly_score: number;
  risk_level: RiskLevel;
  anomaly_breakdown: AnomalyBreakdown;
  context_snapshot: Record<string, unknown>;
  investigated: boolean;
  investigation_notes?: string;
  investigator_id?: string;
  investigated_at?: string;
  created_at: string;
}

export interface AnomalyBreakdown {
  impossible_travel_score?: number;
  unusual_time_score?: number;
  excessive_access_score?: number;
  peer_deviation_score?: number;
  consecutive_access_score?: number;
  location_score?: number;
  details?: Record<string, unknown>;
}

export interface UserBehaviorProfile {
  user_id: string;
  typical_login_hours: number[];
  avg_records_accessed_per_session: number;
  most_common_locations: Array<{ city?: string; country?: string; ip?: string }>;
  baseline_risk_score: number;
  profile_confidence: number;
  last_updated: string;
  created_at: string;
}

export interface GeolocationRecord {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  ip_address?: string;
  event_type: string;
  event_id?: string;
  timestamp: string;
}

export interface PeerGroupStats {
  role: string;
  metric_name: string;
  mean_value: number;
  std_dev: number;
  sample_size: number;
  last_calculated: string;
}

export interface DailyBehaviorSummary {
  user_id: string;
  summary_date: string;
  total_logins: number;
  total_phi_accesses: number;
  unique_patients_accessed: number;
  anomaly_count: number;
  avg_session_duration_minutes: number;
}

export interface ImpossibleTravelResult {
  is_impossible: boolean;
  distance_km: number;
  time_diff_hours: number;
  required_speed_kmh: number;
  previous_location?: GeolocationRecord;
}

// =====================================================
// BEHAVIORAL ANALYTICS SERVICE CLASS
// =====================================================

export class BehavioralAnalyticsService {
  /**
   * Detect impossible travel based on geolocation
   */
  async detectImpossibleTravel(
    userId: string,
    latitude: number,
    longitude: number,
    eventType: string = 'login',
    eventId?: string
  ): Promise<ImpossibleTravelResult> {
    try {
      // Call database function for impossible travel detection
      const { data, error } = await supabase.rpc('detect_impossible_travel', {
        p_user_id: userId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_timestamp: new Date().toISOString()
      });

      if (error) {
        await auditLogger.error('IMPOSSIBLE_TRAVEL_DETECTION_FAILED', error, {
          user_id: userId,
          latitude,
          longitude
        });
        throw new Error(`Impossible travel detection failed: ${error.message}`);
      }

      // Record geolocation
      await this.recordGeolocation({
        userId,
        latitude,
        longitude,
        eventType,
        eventId
      });

      const result = data && data.length > 0 ? data[0] : null;

      if (result && result.is_impossible) {
        await auditLogger.phi('IMPOSSIBLE_TRAVEL_DETECTED', userId, {
          distance_km: result.distance_km,
          time_diff_hours: result.time_diff_hours,
          required_speed_kmh: result.required_speed_kmh,
          latitude,
          longitude
        });

        // Create anomaly detection
        await this.createAnomalyDetection({
          userId,
          anomalyType: 'impossible_travel',
          aggregateScore: 0.85,
          riskLevel: 'HIGH',
          anomalyBreakdown: {
            impossible_travel_score: 0.85,
            details: {
              distance_km: result.distance_km,
              time_diff_hours: result.time_diff_hours,
              required_speed_kmh: result.required_speed_kmh
            }
          },
          contextSnapshot: {
            latitude,
            longitude,
            event_type: eventType,
            detection_time: new Date().toISOString()
          }
        });
      }

      return result || {
        is_impossible: false,
        distance_km: 0,
        time_diff_hours: 0,
        required_speed_kmh: 0
      };
    } catch (error) {
      await auditLogger.error('IMPOSSIBLE_TRAVEL_DETECTION_ERROR', error as Error, {
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Record user geolocation
   */
  async recordGeolocation(params: {
    userId: string;
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    ipAddress?: string;
    eventType: string;
    eventId?: string;
  }): Promise<GeolocationRecord> {
    try {
      const { data, error } = await supabase
        .from('user_geolocation_history')
        .insert({
          user_id: params.userId,
          latitude: params.latitude,
          longitude: params.longitude,
          city: params.city,
          country: params.country,
          ip_address: params.ipAddress,
          event_type: params.eventType,
          event_id: params.eventId,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('GEOLOCATION_RECORD_FAILED', error, {
          user_id: params.userId
        });
        throw new Error(`Failed to record geolocation: ${error.message}`);
      }

      return data as GeolocationRecord;
    } catch (error) {
      await auditLogger.error('GEOLOCATION_RECORD_ERROR', error as Error, {
        user_id: params.userId
      });
      throw error;
    }
  }

  /**
   * Get user behavioral baseline
   */
  async getUserBehaviorBaseline(userId: string): Promise<UserBehaviorProfile | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_behavior_baseline', {
        p_user_id: userId
      });

      if (error) {
        await auditLogger.error('BEHAVIOR_BASELINE_FETCH_FAILED', error, {
          user_id: userId
        });
        throw new Error(`Failed to fetch behavior baseline: ${error.message}`);
      }

      const result = data && data.length > 0 ? data[0] : null;

      await auditLogger.phi('BEHAVIOR_BASELINE_ACCESSED', userId, {
        has_baseline: !!result,
        profile_confidence: result?.profile_confidence
      });

      return result;
    } catch (error) {
      await auditLogger.error('BEHAVIOR_BASELINE_FETCH_ERROR', error as Error, {
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Create anomaly detection record
   */
  async createAnomalyDetection(params: {
    userId: string;
    anomalyType: AnomalyType;
    aggregateScore: number;
    riskLevel: RiskLevel;
    anomalyBreakdown: AnomalyBreakdown;
    contextSnapshot: Record<string, unknown>;
  }): Promise<AnomalyDetection> {
    try {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .insert({
          user_id: params.userId,
          anomaly_type: params.anomalyType,
          aggregate_anomaly_score: params.aggregateScore,
          risk_level: params.riskLevel,
          anomaly_breakdown: params.anomalyBreakdown,
          context_snapshot: params.contextSnapshot,
          investigated: false
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ANOMALY_DETECTION_CREATE_FAILED', error, {
          user_id: params.userId,
          anomaly_type: params.anomalyType
        });
        throw new Error(`Failed to create anomaly detection: ${error.message}`);
      }

      await auditLogger.phi('ANOMALY_DETECTED', params.userId, {
        anomaly_id: data.id,
        anomaly_type: params.anomalyType,
        risk_level: params.riskLevel,
        aggregate_score: params.aggregateScore
      });

      return data as AnomalyDetection;
    } catch (error) {
      await auditLogger.error('ANOMALY_DETECTION_CREATE_ERROR', error as Error, {
        user_id: params.userId
      });
      throw error;
    }
  }

  /**
   * Get uninvestigated anomalies
   */
  async getUninvestigatedAnomalies(
    minScore: number = 0.5,
    limit: number = 50
  ): Promise<AnomalyDetection[]> {
    try {
      const { data, error } = await supabase.rpc('get_uninvestigated_anomalies', {
        p_min_score: minScore,
        p_limit: limit
      });

      if (error) {
        await auditLogger.error('UNINVESTIGATED_ANOMALIES_FETCH_FAILED', error, {
          min_score: minScore,
          limit
        });
        throw new Error(`Failed to fetch uninvestigated anomalies: ${error.message}`);
      }

      await auditLogger.info('UNINVESTIGATED_ANOMALIES_RETRIEVED', {
        count: data.length,
        min_score: minScore
      });

      return data as AnomalyDetection[];
    } catch (error) {
      await auditLogger.error('UNINVESTIGATED_ANOMALIES_FETCH_ERROR', error as Error, {
        min_score: minScore
      });
      throw error;
    }
  }

  /**
   * Mark anomaly as investigated
   */
  async markAnomalyInvestigated(
    anomalyId: string,
    outcome: string,
    investigatorId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('mark_anomaly_investigated', {
        p_anomaly_id: anomalyId,
        p_outcome: outcome,
        p_investigator_id: investigatorId,
        p_notes: notes
      });

      if (error) {
        await auditLogger.error('ANOMALY_INVESTIGATION_MARK_FAILED', error, {
          anomaly_id: anomalyId,
          investigator_id: investigatorId
        });
        throw new Error(`Failed to mark anomaly as investigated: ${error.message}`);
      }

      await auditLogger.info('ANOMALY_INVESTIGATED', {
        anomaly_id: anomalyId,
        investigator_id: investigatorId,
        outcome
      });

      return data as boolean;
    } catch (error) {
      await auditLogger.error('ANOMALY_INVESTIGATION_MARK_ERROR', error as Error, {
        anomaly_id: anomalyId
      });
      throw error;
    }
  }

  /**
   * Get peer group statistics for role
   */
  async getPeerGroupStats(role: string, metricName?: string): Promise<PeerGroupStats[]> {
    try {
      let query = supabase
        .from('peer_group_statistics')
        .select('*')
        .eq('role', role);

      if (metricName) {
        query = query.eq('metric_name', metricName);
      }

      const { data, error } = await query;

      if (error) {
        await auditLogger.error('PEER_GROUP_STATS_FETCH_FAILED', error, {
          role,
          metric_name: metricName
        });
        throw new Error(`Failed to fetch peer group stats: ${error.message}`);
      }

      await auditLogger.info('PEER_GROUP_STATS_RETRIEVED', {
        role,
        metric_name: metricName,
        count: data.length
      });

      return data as PeerGroupStats[];
    } catch (error) {
      await auditLogger.error('PEER_GROUP_STATS_FETCH_ERROR', error as Error, {
        role
      });
      throw error;
    }
  }

  /**
   * Record daily behavior summary
   */
  async recordDailyBehaviorSummary(params: {
    userId: string;
    totalLogins: number;
    totalPhiAccesses: number;
    uniquePatientsAccessed: number;
    anomalyCount: number;
    avgSessionDurationMinutes: number;
  }): Promise<DailyBehaviorSummary> {
    try {
      const { data, error } = await supabase
        .from('daily_behavior_summary')
        .insert({
          user_id: params.userId,
          summary_date: new Date().toISOString().split('T')[0],
          total_logins: params.totalLogins,
          total_phi_accesses: params.totalPhiAccesses,
          unique_patients_accessed: params.uniquePatientsAccessed,
          anomaly_count: params.anomalyCount,
          avg_session_duration_minutes: params.avgSessionDurationMinutes
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('DAILY_BEHAVIOR_SUMMARY_FAILED', error, {
          user_id: params.userId
        });
        throw new Error(`Failed to record daily behavior summary: ${error.message}`);
      }

      await auditLogger.info('DAILY_BEHAVIOR_SUMMARY_RECORDED', {
        user_id: params.userId,
        total_logins: params.totalLogins,
        anomaly_count: params.anomalyCount
      });

      return data as DailyBehaviorSummary;
    } catch (error) {
      await auditLogger.error('DAILY_BEHAVIOR_SUMMARY_ERROR', error as Error, {
        user_id: params.userId
      });
      throw error;
    }
  }

  /**
   * Get anomalies for user
   */
  async getUserAnomalies(
    userId: string,
    limit: number = 50
  ): Promise<AnomalyDetection[]> {
    try {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        await auditLogger.error('USER_ANOMALIES_FETCH_FAILED', error, {
          user_id: userId
        });
        throw new Error(`Failed to fetch user anomalies: ${error.message}`);
      }

      await auditLogger.phi('USER_ANOMALIES_ACCESSED', userId, {
        count: data.length
      });

      return data as AnomalyDetection[];
    } catch (error) {
      await auditLogger.error('USER_ANOMALIES_FETCH_ERROR', error as Error, {
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Calculate aggregate risk score for user
   */
  calculateAggregateRiskScore(anomalyBreakdown: AnomalyBreakdown): {
    score: number;
    riskLevel: RiskLevel;
  } {
    const {
      impossible_travel_score = 0,
      unusual_time_score = 0,
      excessive_access_score = 0,
      peer_deviation_score = 0,
      consecutive_access_score = 0,
      location_score = 0
    } = anomalyBreakdown;

    // Weighted average
    const weights = {
      impossible_travel: 0.3,
      unusual_time: 0.1,
      excessive_access: 0.2,
      peer_deviation: 0.2,
      consecutive_access: 0.1,
      location: 0.1
    };

    const score =
      impossible_travel_score * weights.impossible_travel +
      unusual_time_score * weights.unusual_time +
      excessive_access_score * weights.excessive_access +
      peer_deviation_score * weights.peer_deviation +
      consecutive_access_score * weights.consecutive_access +
      location_score * weights.location;

    let riskLevel: RiskLevel;
    if (score >= 0.8) riskLevel = 'CRITICAL';
    else if (score >= 0.6) riskLevel = 'HIGH';
    else if (score >= 0.4) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    return { score, riskLevel };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const behavioralAnalyticsService = new BehavioralAnalyticsService();
