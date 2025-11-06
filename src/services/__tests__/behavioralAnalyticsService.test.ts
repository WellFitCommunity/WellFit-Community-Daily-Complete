/**
 * BEHAVIORAL ANALYTICS SERVICE - JEST TESTS
 *
 * Comprehensive test suite for behavioral anomaly detection
 *
 * Test Coverage:
 * - ✅ Impossible travel detection
 * - ✅ Geolocation recording
 * - ✅ Anomaly detection creation
 * - ✅ Investigation workflows
 * - ✅ Behavioral baselines
 * - ✅ Peer group statistics
 * - ✅ Risk scoring
 * - ✅ Error handling
 *
 * @module BehavioralAnalyticsServiceTests
 */

import {
  BehavioralAnalyticsService,
  RiskLevel,
  AnomalyType,
  AnomalyDetection,
  UserBehaviorProfile,
  GeolocationRecord,
  PeerGroupStats,
  DailyBehaviorSummary,
  ImpossibleTravelResult,
  AnomalyBreakdown,
} from '../behavioralAnalyticsService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// Mock dependencies
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    error: jest.fn(),
    phi: jest.fn(),
  },
}));

// Test data
const mockUserId = 'user-123-456-789';
const mockAnomalyId = 'anomaly-abc-def-ghi';
const mockInvestigatorId = 'investigator-999';

const mockGeolocationRecord: GeolocationRecord = {
  id: 'geo-123',
  user_id: mockUserId,
  latitude: 37.7749,
  longitude: -122.4194,
  city: 'San Francisco',
  country: 'USA',
  ip_address: '192.168.1.1',
  event_type: 'login',
  event_id: 'event-123',
  timestamp: new Date().toISOString(),
};

const mockAnomalyDetection: AnomalyDetection = {
  id: mockAnomalyId,
  user_id: mockUserId,
  anomaly_type: 'impossible_travel' as AnomalyType,
  aggregate_anomaly_score: 0.85,
  risk_level: 'HIGH' as RiskLevel,
  anomaly_breakdown: {
    impossible_travel_score: 0.85,
    details: {
      distance_km: 5000,
      time_diff_hours: 2,
      required_speed_kmh: 2500,
    },
  },
  context_snapshot: {
    latitude: 37.7749,
    longitude: -122.4194,
    event_type: 'login',
  },
  investigated: false,
  created_at: new Date().toISOString(),
};

const mockUserBehaviorProfile: UserBehaviorProfile = {
  user_id: mockUserId,
  typical_login_hours: [8, 9, 10, 17, 18],
  avg_records_accessed_per_session: 15.5,
  most_common_locations: [
    { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco' },
  ],
  baseline_risk_score: 0.2,
  profile_confidence: 0.95,
  last_updated: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const mockPeerGroupStats: PeerGroupStats = {
  role: 'admin',
  metric_name: 'avg_records_accessed_per_session',
  mean_value: 20.0,
  std_dev: 5.0,
  sample_size: 50,
  last_calculated: new Date().toISOString(),
};

describe('BehavioralAnalyticsService', () => {
  let service: BehavioralAnalyticsService;

  beforeEach(() => {
    service = new BehavioralAnalyticsService();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // IMPOSSIBLE TRAVEL DETECTION TESTS
  // ==========================================================================

  describe('detectImpossibleTravel', () => {
    it('should detect impossible travel', async () => {
      const mockRpcResult = [
        {
          is_impossible: true,
          distance_km: 5000,
          time_diff_hours: 2,
          required_speed_kmh: 2500,
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      // Mock geolocation insert
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockGeolocationRecord,
              error: null,
            }),
          }),
        }),
      });

      // Mock anomaly detection insert
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAnomalyDetection,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.detectImpossibleTravel(
        mockUserId,
        37.7749,
        -122.4194,
        'login',
        'event-123'
      );

      expect(result.is_impossible).toBe(true);
      expect(result.distance_km).toBe(5000);
      expect(result.required_speed_kmh).toBe(2500);
      expect(supabase.rpc).toHaveBeenCalledWith('detect_impossible_travel', {
        p_user_id: mockUserId,
        p_latitude: 37.7749,
        p_longitude: -122.4194,
        p_timestamp: expect.any(String),
      });
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'IMPOSSIBLE_TRAVEL_DETECTED',
        mockUserId,
        expect.objectContaining({
          distance_km: 5000,
          required_speed_kmh: 2500,
        })
      );
    });

    it('should return safe result when no impossible travel detected', async () => {
      const mockRpcResult = [
        {
          is_impossible: false,
          distance_km: 10,
          time_diff_hours: 1,
          required_speed_kmh: 10,
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      // Mock geolocation insert
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockGeolocationRecord,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.detectImpossibleTravel(
        mockUserId,
        37.7749,
        -122.4194
      );

      expect(result.is_impossible).toBe(false);
      expect(result.distance_km).toBe(10);
      expect(auditLogger.phi).not.toHaveBeenCalledWith(
        'IMPOSSIBLE_TRAVEL_DETECTED',
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle impossible travel detection errors', async () => {
      const mockError = new Error('RPC function failed');

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        service.detectImpossibleTravel(mockUserId, 37.7749, -122.4194)
      ).rejects.toThrow('Impossible travel detection failed');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'IMPOSSIBLE_TRAVEL_DETECTION_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // GEOLOCATION RECORDING TESTS
  // ==========================================================================

  describe('recordGeolocation', () => {
    it('should record geolocation successfully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockGeolocationRecord,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.recordGeolocation({
        userId: mockUserId,
        latitude: 37.7749,
        longitude: -122.4194,
        city: 'San Francisco',
        country: 'USA',
        ipAddress: '192.168.1.1',
        eventType: 'login',
        eventId: 'event-123',
      });

      expect(result).toEqual(mockGeolocationRecord);
      expect(supabase.from).toHaveBeenCalledWith('user_geolocation_history');
    });

    it('should handle geolocation recording errors', async () => {
      const mockError = new Error('Insert failed');

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(
        service.recordGeolocation({
          userId: mockUserId,
          latitude: 37.7749,
          longitude: -122.4194,
          eventType: 'login',
        })
      ).rejects.toThrow('Failed to record geolocation');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'GEOLOCATION_RECORD_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // BEHAVIORAL BASELINE TESTS
  // ==========================================================================

  describe('getUserBehaviorBaseline', () => {
    it('should fetch user behavior baseline', async () => {
      const mockRpcResult = [mockUserBehaviorProfile];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      const result = await service.getUserBehaviorBaseline(mockUserId);

      expect(result).toEqual(mockUserBehaviorProfile);
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_behavior_baseline', {
        p_user_id: mockUserId,
      });
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'BEHAVIOR_BASELINE_ACCESSED',
        mockUserId,
        expect.objectContaining({
          has_baseline: true,
          profile_confidence: 0.95,
        })
      );
    });

    it('should return null when no baseline exists', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.getUserBehaviorBaseline(mockUserId);

      expect(result).toBeNull();
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'BEHAVIOR_BASELINE_ACCESSED',
        mockUserId,
        expect.objectContaining({
          has_baseline: false,
        })
      );
    });

    it('should handle baseline fetch errors', async () => {
      const mockError = new Error('RPC failed');

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(service.getUserBehaviorBaseline(mockUserId)).rejects.toThrow(
        'Failed to fetch behavior baseline'
      );

      expect(auditLogger.error).toHaveBeenCalledWith(
        'BEHAVIOR_BASELINE_FETCH_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // ANOMALY DETECTION TESTS
  // ==========================================================================

  describe('createAnomalyDetection', () => {
    it('should create anomaly detection record', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAnomalyDetection,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.createAnomalyDetection({
        userId: mockUserId,
        anomalyType: 'impossible_travel',
        aggregateScore: 0.85,
        riskLevel: 'HIGH',
        anomalyBreakdown: {
          impossible_travel_score: 0.85,
          details: {
            distance_km: 5000,
            time_diff_hours: 2,
            required_speed_kmh: 2500,
          },
        },
        contextSnapshot: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      });

      expect(result).toEqual(mockAnomalyDetection);
      expect(supabase.from).toHaveBeenCalledWith('anomaly_detections');
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'ANOMALY_DETECTED',
        mockUserId,
        expect.objectContaining({
          anomaly_id: mockAnomalyId,
          anomaly_type: 'impossible_travel',
          risk_level: 'HIGH',
          aggregate_score: 0.85,
        })
      );
    });

    it('should handle anomaly creation errors', async () => {
      const mockError = new Error('Insert failed');

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(
        service.createAnomalyDetection({
          userId: mockUserId,
          anomalyType: 'impossible_travel',
          aggregateScore: 0.85,
          riskLevel: 'HIGH',
          anomalyBreakdown: {},
          contextSnapshot: {},
        })
      ).rejects.toThrow('Failed to create anomaly detection');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'ANOMALY_DETECTION_CREATE_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // INVESTIGATION WORKFLOW TESTS
  // ==========================================================================

  describe('getUninvestigatedAnomalies', () => {
    it('should fetch uninvestigated anomalies', async () => {
      const mockAnomalies = [mockAnomalyDetection];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockAnomalies,
        error: null,
      });

      const result = await service.getUninvestigatedAnomalies(0.5, 50);

      expect(result).toEqual(mockAnomalies);
      expect(supabase.rpc).toHaveBeenCalledWith('get_uninvestigated_anomalies', {
        p_min_score: 0.5,
        p_limit: 50,
      });
      expect(auditLogger.info).toHaveBeenCalledWith(
        'UNINVESTIGATED_ANOMALIES_RETRIEVED',
        expect.objectContaining({
          count: 1,
          min_score: 0.5,
        })
      );
    });

    it('should use default parameters', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getUninvestigatedAnomalies();

      expect(supabase.rpc).toHaveBeenCalledWith('get_uninvestigated_anomalies', {
        p_min_score: 0.5,
        p_limit: 50,
      });
    });

    it('should handle fetch errors', async () => {
      const mockError = new Error('RPC failed');

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(service.getUninvestigatedAnomalies()).rejects.toThrow(
        'Failed to fetch uninvestigated anomalies'
      );

      expect(auditLogger.error).toHaveBeenCalledWith(
        'UNINVESTIGATED_ANOMALIES_FETCH_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  describe('markAnomalyInvestigated', () => {
    it('should mark anomaly as investigated', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.markAnomalyInvestigated(
        mockAnomalyId,
        'false_positive',
        mockInvestigatorId,
        'User was actually traveling for work'
      );

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('mark_anomaly_investigated', {
        p_anomaly_id: mockAnomalyId,
        p_outcome: 'false_positive',
        p_investigator_id: mockInvestigatorId,
        p_notes: 'User was actually traveling for work',
      });
      expect(auditLogger.info).toHaveBeenCalledWith(
        'ANOMALY_INVESTIGATED',
        expect.objectContaining({
          anomaly_id: mockAnomalyId,
          investigator_id: mockInvestigatorId,
          outcome: 'false_positive',
        })
      );
    });

    it('should handle investigation errors', async () => {
      const mockError = new Error('RPC failed');

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        service.markAnomalyInvestigated(
          mockAnomalyId,
          'confirmed',
          mockInvestigatorId
        )
      ).rejects.toThrow('Failed to mark anomaly as investigated');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'ANOMALY_INVESTIGATION_MARK_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // PEER GROUP STATISTICS TESTS
  // ==========================================================================

  describe('getPeerGroupStats', () => {
    it('should fetch peer group statistics for role', async () => {
      const mockStats = [mockPeerGroupStats];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockStats,
            error: null,
          }),
        }),
      });

      const result = await service.getPeerGroupStats('admin');

      expect(result).toEqual(mockStats);
      expect(supabase.from).toHaveBeenCalledWith('peer_group_statistics');
      expect(auditLogger.info).toHaveBeenCalledWith(
        'PEER_GROUP_STATS_RETRIEVED',
        expect.objectContaining({
          role: 'admin',
          count: 1,
        })
      );
    });

    it('should filter by metric name', async () => {
      const mockStats = [mockPeerGroupStats];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockStats,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getPeerGroupStats(
        'admin',
        'avg_records_accessed_per_session'
      );

      expect(result).toEqual(mockStats);
    });

    it('should handle peer group stats errors', async () => {
      const mockError = new Error('Query failed');

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: mockError,
          }),
        }),
      });

      await expect(service.getPeerGroupStats('admin')).rejects.toThrow(
        'Failed to fetch peer group stats'
      );

      expect(auditLogger.error).toHaveBeenCalledWith(
        'PEER_GROUP_STATS_FETCH_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // DAILY BEHAVIOR SUMMARY TESTS
  // ==========================================================================

  describe('recordDailyBehaviorSummary', () => {
    it('should record daily behavior summary', async () => {
      const mockSummary: DailyBehaviorSummary = {
        user_id: mockUserId,
        summary_date: new Date().toISOString().split('T')[0],
        total_logins: 5,
        total_phi_accesses: 100,
        unique_patients_accessed: 20,
        anomaly_count: 1,
        avg_session_duration_minutes: 45,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSummary,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.recordDailyBehaviorSummary({
        userId: mockUserId,
        totalLogins: 5,
        totalPhiAccesses: 100,
        uniquePatientsAccessed: 20,
        anomalyCount: 1,
        avgSessionDurationMinutes: 45,
      });

      expect(result).toEqual(mockSummary);
      expect(supabase.from).toHaveBeenCalledWith('daily_behavior_summary');
      expect(auditLogger.info).toHaveBeenCalledWith(
        'DAILY_BEHAVIOR_SUMMARY_RECORDED',
        expect.objectContaining({
          user_id: mockUserId,
          total_logins: 5,
          anomaly_count: 1,
        })
      );
    });

    it('should handle summary recording errors', async () => {
      const mockError = new Error('Insert failed');

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(
        service.recordDailyBehaviorSummary({
          userId: mockUserId,
          totalLogins: 5,
          totalPhiAccesses: 100,
          uniquePatientsAccessed: 20,
          anomalyCount: 1,
          avgSessionDurationMinutes: 45,
        })
      ).rejects.toThrow('Failed to record daily behavior summary');

      expect(auditLogger.error).toHaveBeenCalledWith(
        'DAILY_BEHAVIOR_SUMMARY_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // USER ANOMALIES TESTS
  // ==========================================================================

  describe('getUserAnomalies', () => {
    it('should fetch user anomalies', async () => {
      const mockAnomalies = [mockAnomalyDetection];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockAnomalies,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.getUserAnomalies(mockUserId, 50);

      expect(result).toEqual(mockAnomalies);
      expect(supabase.from).toHaveBeenCalledWith('anomaly_detections');
      expect(auditLogger.phi).toHaveBeenCalledWith(
        'USER_ANOMALIES_ACCESSED',
        mockUserId,
        expect.objectContaining({
          count: 1,
        })
      );
    });

    it('should use default limit', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      await service.getUserAnomalies(mockUserId);

      // Verify limit was called (default is 50)
      expect(supabase.from).toHaveBeenCalledWith('anomaly_detections');
    });

    it('should handle user anomalies fetch errors', async () => {
      const mockError = new Error('Query failed');

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      await expect(service.getUserAnomalies(mockUserId)).rejects.toThrow(
        'Failed to fetch user anomalies'
      );

      expect(auditLogger.error).toHaveBeenCalledWith(
        'USER_ANOMALIES_FETCH_FAILED',
        mockError,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // RISK SCORING TESTS
  // ==========================================================================

  describe('calculateAggregateRiskScore', () => {
    it('should calculate CRITICAL risk level', () => {
      const anomalyBreakdown: AnomalyBreakdown = {
        impossible_travel_score: 0.9,
        excessive_access_score: 0.9,
        peer_deviation_score: 0.8,
        unusual_time_score: 0.7,
        consecutive_access_score: 0.8,
        location_score: 0.8,
      };

      const result = service.calculateAggregateRiskScore(anomalyBreakdown);

      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should calculate HIGH risk level', () => {
      const anomalyBreakdown: AnomalyBreakdown = {
        impossible_travel_score: 0.8,
        excessive_access_score: 0.7,
        peer_deviation_score: 0.8,
        unusual_time_score: 0.6,
        consecutive_access_score: 0.6,
        location_score: 0.6,
      };

      const result = service.calculateAggregateRiskScore(anomalyBreakdown);

      expect(result.score).toBeGreaterThanOrEqual(0.6);
      expect(result.score).toBeLessThan(0.8);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should calculate MEDIUM risk level', () => {
      const anomalyBreakdown: AnomalyBreakdown = {
        impossible_travel_score: 0.6,
        excessive_access_score: 0.5,
        peer_deviation_score: 0.6,
        unusual_time_score: 0.4,
        consecutive_access_score: 0.4,
        location_score: 0.4,
      };

      const result = service.calculateAggregateRiskScore(anomalyBreakdown);

      expect(result.score).toBeGreaterThanOrEqual(0.4);
      expect(result.score).toBeLessThan(0.6);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('should calculate LOW risk level', () => {
      const anomalyBreakdown: AnomalyBreakdown = {
        impossible_travel_score: 0.1,
        excessive_access_score: 0.2,
        unusual_time_score: 0.1,
      };

      const result = service.calculateAggregateRiskScore(anomalyBreakdown);

      expect(result.score).toBeLessThan(0.4);
      expect(result.riskLevel).toBe('LOW');
    });

    it('should handle empty anomaly breakdown', () => {
      const anomalyBreakdown: AnomalyBreakdown = {};

      const result = service.calculateAggregateRiskScore(anomalyBreakdown);

      expect(result.score).toBe(0);
      expect(result.riskLevel).toBe('LOW');
    });

    it('should use correct weighted average', () => {
      const anomalyBreakdown: AnomalyBreakdown = {
        impossible_travel_score: 1.0, // 30% weight
        excessive_access_score: 1.0, // 20% weight
        peer_deviation_score: 0, // 20% weight
        unusual_time_score: 0, // 10% weight
        consecutive_access_score: 0, // 10% weight
        location_score: 0, // 10% weight
      };

      const result = service.calculateAggregateRiskScore(anomalyBreakdown);

      // Expected: 1.0 * 0.3 + 1.0 * 0.2 = 0.5
      expect(result.score).toBeCloseTo(0.5, 2);
      expect(result.riskLevel).toBe('MEDIUM');
    });
  });
});
