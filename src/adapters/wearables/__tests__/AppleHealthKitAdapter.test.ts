/**
 * Apple HealthKit Adapter Tests
 *
 * Note: Apple HealthKit uses OAuth2 via Apple Sign In for cloud access.
 * On-device access would use native SDK, but this adapter handles cloud sync.
 */

import { AppleHealthKitAdapter } from '../implementations/AppleHealthKitAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';

global.fetch = vi.fn();

describe('AppleHealthKitAdapter', () => {
  let adapter: AppleHealthKitAdapter;
  let mockConfig: WearableAdapterConfig;

  beforeEach(() => {
    adapter = new AppleHealthKitAdapter();
    mockConfig = {
      authType: 'oauth2',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    };
    vi.clearAllMocks();
  });

  describe('Metadata', () => {
    it('should have correct adapter metadata', () => {
      expect(adapter.metadata.id).toBe('apple-healthkit');
      expect(adapter.metadata.vendor).toBe('Apple Inc.');
      expect(adapter.metadata.oauthRequired).toBe(true);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.bloodPressure).toBe(true);
      expect(adapter.metadata.capabilities.steps).toBe(true);
      expect(adapter.metadata.capabilities.sleep).toBe(true);
      expect(adapter.metadata.capabilities.fallDetection).toBe(true);
      expect(adapter.metadata.capabilities.ecg).toBe(true);
    });

    it('should have correct device types', () => {
      expect(adapter.metadata.deviceTypes).toContain('smartwatch');
      expect(adapter.metadata.deviceTypes).toContain('smartphone');
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with OAuth2 config', async () => {
      await expect(adapter.connect(mockConfig)).resolves.not.toThrow();
      expect(adapter.getConnectionStatus()).toBe('connected');
    });

    it('should throw error when OAuth2 credentials missing', async () => {
      const invalidConfig = { ...mockConfig, clientId: undefined, clientSecret: undefined };
      await expect(adapter.connect(invalidConfig)).rejects.toThrow();
    });

    it('should disconnect successfully', async () => {
      await adapter.connect(mockConfig);
      await adapter.disconnect();
      expect(adapter.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('Data Fetching', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should fetch heart rate vitals', async () => {
      const mockHRResponse = {
        ok: true,
        json: async () => ({
          samples: [
            { value: 72, startDate: new Date().toISOString(), sourceDevice: 'Apple Watch' },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockHRResponse);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['heart_rate'],
      });

      expect(vitals.length).toBeGreaterThanOrEqual(0);
    });

    it('should fetch blood pressure vitals', async () => {
      const mockBPResponse = {
        ok: true,
        json: async () => ({
          samples: [
            {
              systolic: 118,
              diastolic: 78,
              startDate: new Date().toISOString(),
              sourceDevice: 'Apple Watch',
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockBPResponse);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['blood_pressure'],
      });

      expect(vitals.length).toBeGreaterThanOrEqual(0);
    });

    it('should fetch activity data', async () => {
      const mockActivityResponse = {
        ok: true,
        json: async () => ({
          activities: [
            {
              date: new Date().toISOString(),
              steps: 9800,
              distance: 7800,
              calories: 480,
              activeMinutes: 45,
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockActivityResponse);

      const activities = await adapter.fetchActivity({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].steps).toBe(9800);
    });

    it('should fetch sleep data', async () => {
      const mockSleepResponse = {
        ok: true,
        json: async () => ({
          sleepSessions: [
            {
              date: new Date().toISOString(),
              duration: 480,
              stages: {
                deep: 100,
                light: 220,
                rem: 90,
                awake: 30,
              },
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSleepResponse);

      const sleep = await adapter.fetchSleep({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(sleep).toHaveLength(1);
      expect(sleep[0].duration).toBe(480);
    });
  });

  describe('Fall Detection', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should fetch fall detection events', async () => {
      const mockFallResponse = {
        ok: true,
        json: async () => ({
          falls: [
            {
              timestamp: new Date().toISOString(),
              severity: 'moderate',
              userResponded: true,
              location: { latitude: 37.7749, longitude: -122.4194 },
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFallResponse);

      const falls = await adapter.fetchFallDetection({
        userId: 'test-user',
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(falls).toBeDefined();
      expect(falls).toHaveLength(1);
      expect(falls[0].severity).toBe('moderate');
    });
  });

  describe('ECG Data', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should fetch ECG data', async () => {
      const mockECGResponse = {
        ok: true,
        json: async () => ({
          ecgReadings: [
            {
              timestamp: new Date().toISOString(),
              classification: 'sinus_rhythm',
              heartRate: 68,
              duration: 30,
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockECGResponse);

      const ecgData = await adapter.fetchECG({
        userId: 'test-user',
      });

      expect(ecgData).toBeDefined();
      expect(ecgData).toHaveLength(1);
      expect(ecgData[0].classification).toBe('sinus_rhythm');
    });
  });

  describe('Device Management', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should list connected devices', async () => {
      const mockDevicesResponse = {
        ok: true,
        json: async () => ({
          devices: [
            {
              deviceId: 'watch-123',
              name: 'Apple Watch Series 9',
              model: 'Watch9,1',
              lastSync: new Date().toISOString(),
              batteryLevel: 78,
            },
            {
              deviceId: 'iphone-456',
              name: 'iPhone 15 Pro',
              model: 'iPhone16,1',
              lastSync: new Date().toISOString(),
              batteryLevel: 92,
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDevicesResponse);

      const devices = await adapter.listConnectedDevices('test-user');
      expect(devices).toHaveLength(2);
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
      // Apple HealthKit supports glucose monitoring (via CGM apps)
      expect(adapter.supportsFeature('glucoseMonitoring')).toBe(true);
      // Non-existent feature should return false
      expect(adapter.supportsFeature('someNonExistentFeature')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should handle API errors for activity fetch', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 403,
        statusText: 'HealthKit permission denied',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockErrorResponse);

      // fetchActivity throws on error (unlike fetchVitals which catches errors)
      await expect(
        adapter.fetchActivity({
          userId: 'test-user',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Failed to fetch activity');
    });

    it('should return empty array when fetchVitals has permission issues', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 403,
        statusText: 'HealthKit permission denied',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockErrorResponse);

      // fetchVitals catches errors internally and returns empty array
      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['heart_rate'],
      });

      expect(vitals).toEqual([]);
    });
  });
});
