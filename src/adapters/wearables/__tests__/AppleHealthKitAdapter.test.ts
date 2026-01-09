/**
 * Apple HealthKit Adapter Tests
 *
 * Note: Apple HealthKit has no public REST API. This adapter reads
 * health data that has been synced to the WellFit backend by a
 * companion iOS app using the native HealthKit SDK.
 */

import { AppleHealthKitAdapter } from '../implementations/AppleHealthKitAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';
import { supabase } from '../../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AppleHealthKitAdapter', () => {
  let adapter: AppleHealthKitAdapter;
  let mockConfig: WearableAdapterConfig;

  const mockSupabaseQuery = (returnData: unknown, error: Error | null = null) => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: returnData, error }),
    };
    // For queries that don't use single()
    queryBuilder.order.mockResolvedValue({ data: returnData, error, count: Array.isArray(returnData) ? returnData.length : 0 });
    queryBuilder.limit.mockResolvedValue({ data: returnData, error, count: Array.isArray(returnData) ? returnData.length : 0 });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(queryBuilder);
    return queryBuilder;
  };

  beforeEach(() => {
    adapter = new AppleHealthKitAdapter();
    mockConfig = {
      authType: 'api_key', // Apple adapter doesn't use OAuth from web
      userId: 'test-user-123',
    } as WearableAdapterConfig & { userId: string };
    vi.clearAllMocks();
  });

  describe('Metadata', () => {
    it('should have correct adapter metadata', () => {
      expect(adapter.metadata.id).toBe('apple-healthkit');
      expect(adapter.metadata.vendor).toBe('Apple Inc.');
      expect(adapter.metadata.version).toBe('2.0.0');
      // OAuth is not required - data comes from iOS app sync
      expect(adapter.metadata.oauthRequired).toBe(false);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.bloodPressure).toBe(true);
      expect(adapter.metadata.capabilities.steps).toBe(true);
      expect(adapter.metadata.capabilities.sleep).toBe(true);
      expect(adapter.metadata.capabilities.fallDetection).toBe(true);
      expect(adapter.metadata.capabilities.ecg).toBe(true);
      expect(adapter.metadata.capabilities.glucoseMonitoring).toBe(true);
      // Gait analysis not yet synced from iOS
      expect(adapter.metadata.capabilities.gaitAnalysis).toBe(false);
    });

    it('should have correct device types', () => {
      expect(adapter.metadata.deviceTypes).toContain('smartwatch');
      expect(adapter.metadata.deviceTypes).toContain('smartphone');
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with userId', async () => {
      mockSupabaseQuery([], null);
      await expect(adapter.connect(mockConfig)).resolves.not.toThrow();
      expect(adapter.getConnectionStatus()).toBe('connected');
    });

    it('should throw error when userId is missing', async () => {
      const invalidConfig = { authType: 'api_key' } as WearableAdapterConfig;
      await expect(adapter.connect(invalidConfig)).rejects.toThrow(
        'Apple HealthKit adapter requires userId to read synced data'
      );
    });

    it('should disconnect successfully', async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);
      await adapter.disconnect();
      expect(adapter.getConnectionStatus()).toBe('disconnected');
    });

    it('should set error status on database error', async () => {
      mockSupabaseQuery(null, new Error('Database connection failed'));
      await expect(adapter.connect(mockConfig)).rejects.toThrow();
      expect(adapter.getConnectionStatus()).toBe('error');
    });
  });

  describe('OAuth Methods (Not Supported)', () => {
    it('should throw error for getAuthorizationUrl', () => {
      expect(() => adapter.getAuthorizationUrl(['health:read'])).toThrow(
        'Apple HealthKit authorization is handled on iOS device'
      );
    });

    it('should throw error for handleOAuthCallback', async () => {
      await expect(adapter.handleOAuthCallback('auth-code')).rejects.toThrow(
        'Apple HealthKit does not use OAuth callback flow'
      );
    });

    it('should throw error for refreshAccessToken', async () => {
      await expect(adapter.refreshAccessToken('refresh-token')).rejects.toThrow(
        'Apple HealthKit does not use refresh tokens'
      );
    });
  });

  describe('Data Fetching', () => {
    beforeEach(async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);
    });

    it('should fetch heart rate vitals from database', async () => {
      const mockVitals = [
        {
          id: '1',
          vital_type: 'heart_rate',
          value: 72,
          unit: 'bpm',
          recorded_at: new Date().toISOString(),
          device_model: 'Apple Watch Series 9',
        },
      ];

      // Re-mock for this specific test
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockVitals, error: null }),
      };
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(queryBuilder);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['heart_rate'],
      });

      expect(vitals.length).toBe(1);
      expect(vitals[0].value).toBe(72);
      expect(vitals[0].type).toBe('heart_rate');
    });

    it('should fetch activity data from database', async () => {
      const mockActivity = [
        {
          id: '1',
          date: new Date().toISOString().split('T')[0],
          steps: 9800,
          distance_meters: 7800,
          calories_burned: 480,
          active_minutes: 45,
        },
      ];
      mockSupabaseQuery(mockActivity, null);

      const activities = await adapter.fetchActivity({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].steps).toBe(9800);
      expect(activities[0].distanceMeters).toBe(7800);
    });

    it('should fetch sleep data from database', async () => {
      const mockSleep = [
        {
          id: '1',
          start_time: new Date().toISOString(),
          duration_minutes: 480,
          deep_minutes: 100,
          light_minutes: 220,
          rem_minutes: 90,
          awake_minutes: 30,
        },
      ];
      mockSupabaseQuery(mockSleep, null);

      const sleep = await adapter.fetchSleep({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(sleep).toHaveLength(1);
      expect(sleep[0].duration).toBe(480);
      expect(sleep[0].stages?.deep).toBe(100);
    });
  });

  describe('Fall Detection', () => {
    beforeEach(async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);
    });

    it('should fetch fall detection events from database', async () => {
      const mockFalls = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          severity: 'moderate',
          latitude: 37.7749,
          longitude: -122.4194,
          user_responded: true,
          emergency_contacted: false,
        },
      ];
      mockSupabaseQuery(mockFalls, null);

      const falls = await adapter.fetchFallDetection({
        userId: 'test-user',
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(falls).toBeDefined();
      expect(falls).toHaveLength(1);
      expect(falls[0].severity).toBe('moderate');
      expect(falls[0].location?.latitude).toBe(37.7749);
    });
  });

  describe('ECG Data', () => {
    beforeEach(async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);
    });

    it('should fetch ECG data from database', async () => {
      const mockECG = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          classification: 'sinus_rhythm',
          heart_rate: 68,
          duration_seconds: 30,
        },
      ];

      // Re-mock for this specific test
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockECG, error: null }),
      };
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(queryBuilder);

      const ecgData = await adapter.fetchECG({
        userId: 'test-user',
      });

      expect(ecgData).toBeDefined();
      expect(ecgData).toHaveLength(1);
      expect(ecgData[0].classification).toBe('sinus_rhythm');
      expect(ecgData[0].heartRate).toBe(68);
    });
  });

  describe('Device Management', () => {
    beforeEach(async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);
    });

    it('should list connected devices from database', async () => {
      const mockDevices = [
        {
          device_id: 'watch-123',
          device_name: 'Apple Watch Series 9',
          device_model: 'Watch9,1',
          last_sync_at: new Date().toISOString(),
          battery_level: 78,
        },
        {
          device_id: 'iphone-456',
          device_name: 'iPhone 15 Pro',
          device_model: 'iPhone16,1',
          last_sync_at: new Date().toISOString(),
          battery_level: 92,
        },
      ];
      mockSupabaseQuery(mockDevices, null);

      const devices = await adapter.listConnectedDevices('test-user');
      expect(devices).toHaveLength(2);
      expect(devices[0].name).toBe('Apple Watch Series 9');
      expect(devices[1].batteryLevel).toBe(92);
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.heartRate).toBe(true);
      expect(caps.fallDetection).toBe(true);
      expect(caps.ecg).toBe(true);
    });

    it('should check feature support correctly', () => {
      expect(adapter.supportsFeature('heartRate')).toBe(true);
      expect(adapter.supportsFeature('fallDetection')).toBe(true);
      expect(adapter.supportsFeature('glucoseMonitoring')).toBe(true);
      expect(adapter.supportsFeature('gaitAnalysis')).toBe(false);
      expect(adapter.supportsFeature('someNonExistentFeature')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);
    });

    it('should return empty array on activity fetch error', async () => {
      mockSupabaseQuery(null, new Error('Database error'));

      const activities = await adapter.fetchActivity({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      // New implementation returns empty array on error (graceful degradation)
      expect(activities).toEqual([]);
    });

    it('should return empty array when fetchVitals has database issues', async () => {
      mockSupabaseQuery(null, new Error('Database error'));

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['heart_rate'],
      });

      expect(vitals).toEqual([]);
    });

    it('should return empty array on fall detection fetch error', async () => {
      mockSupabaseQuery(null, new Error('Database error'));

      const falls = await adapter.fetchFallDetection({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(falls).toEqual([]);
    });

    it('should return empty array on ECG fetch error', async () => {
      mockSupabaseQuery(null, new Error('Database error'));

      const ecg = await adapter.fetchECG({
        userId: 'test-user',
      });

      expect(ecg).toEqual([]);
    });

    it('should return empty array on device list error', async () => {
      mockSupabaseQuery(null, new Error('Database error'));

      const devices = await adapter.listConnectedDevices('test-user');

      expect(devices).toEqual([]);
    });
  });

  describe('Test Method', () => {
    it('should return success when connected with data', async () => {
      mockSupabaseQuery([], null);
      await adapter.connect(mockConfig);

      // Mock for test() method
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ device_name: 'Watch', device_model: 'S9', last_sync_at: new Date().toISOString() }], error: null }),
      };
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(queryBuilder);

      const result = await adapter.test();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected');
    });

    it('should return failure when not connected', async () => {
      const result = await adapter.test();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not connected');
    });
  });
});
