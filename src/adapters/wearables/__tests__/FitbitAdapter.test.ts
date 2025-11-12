/**
 * Fitbit Adapter Tests
 */

import { FitbitAdapter } from '../implementations/FitbitAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';

// Mock fetch
global.fetch = jest.fn();

describe('FitbitAdapter', () => {
  let adapter: FitbitAdapter;
  let mockConfig: WearableAdapterConfig;

  beforeEach(() => {
    adapter = new FitbitAdapter();
    mockConfig = {
      authType: 'oauth2',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['activity', 'heartrate', 'sleep'],
    };

    jest.clearAllMocks();
  });

  describe('Metadata', () => {
    it('should have correct adapter metadata', () => {
      expect(adapter.metadata.id).toBe('fitbit');
      expect(adapter.metadata.vendor).toBe('Fitbit (Google)');
      expect(adapter.metadata.oauthRequired).toBe(true);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.steps).toBe(true);
      expect(adapter.metadata.capabilities.sleep).toBe(true);
      expect(adapter.metadata.capabilities.bloodPressure).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid config', async () => {
      await expect(adapter.connect(mockConfig)).resolves.not.toThrow();
      expect(adapter.getConnectionStatus()).toBe('connected');
    });

    it('should throw error when OAuth2 not configured', async () => {
      const invalidConfig = { ...mockConfig, authType: 'api-key' as const };
      await expect(adapter.connect(invalidConfig)).rejects.toThrow(
        'Fitbit requires OAuth2 authentication'
      );
    });

    it('should disconnect successfully', async () => {
      await adapter.connect(mockConfig);
      await adapter.disconnect();
      expect(adapter.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('OAuth Flow', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should generate correct authorization URL', () => {
      const scopes = ['activity', 'heartrate', 'sleep'];
      const authUrl = adapter.getAuthorizationUrl(scopes);

      expect(authUrl).toContain('https://www.fitbit.com/oauth2/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('scope=activity+heartrate+sleep');
    });

    it('should handle OAuth callback successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          user_id: 'fitbit-user-123',
          expires_in: 3600,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await adapter.handleOAuthCallback('auth-code-123');

      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
    });

    it('should refresh access token', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const newToken = await adapter.refreshAccessToken('old-refresh-token');

      expect(newToken).toBe('new-access-token');
    });
  });

  describe('Data Fetching', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);

      // Mock OAuth callback
      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          user_id: 'test-user',
          expires_in: 3600,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should fetch heart rate vitals', async () => {
      const mockHeartRateResponse = {
        ok: true,
        json: async () => ({
          'activities-heart': [
            {
              dateTime: '2024-11-04',
              value: {
                restingHeartRate: 65,
              },
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockHeartRateResponse);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['heart_rate'],
      });

      expect(vitals).toHaveLength(1);
      expect(vitals[0].type).toBe('heart_rate');
      expect(vitals[0].value).toBe(65);
      expect(vitals[0].unit).toBe('bpm');
    });

    it('should fetch activity data', async () => {
      const mockActivityResponse = {
        ok: true,
        json: async () => ({
          summary: {
            steps: 10000,
            distances: [{ activity: 'total', distance: 8.5 }],
            caloriesOut: 2500,
            fairlyActiveMinutes: 30,
            veryActiveMinutes: 20,
            goals: {
              steps: 10000,
              activeMinutes: 30,
            },
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockActivityResponse);

      const activities = await adapter.fetchActivity({
        userId: 'test-user',
        startDate: new Date('2024-11-04'),
        endDate: new Date('2024-11-04'),
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].steps).toBe(10000);
      expect(activities[0].caloriesBurned).toBe(2500);
      expect(activities[0].activeMinutes).toBe(50); // 30 + 20
    });

    it('should fetch sleep data', async () => {
      const mockSleepResponse = {
        ok: true,
        json: async () => ({
          sleep: [
            {
              dateOfSleep: '2024-11-04',
              duration: 28800000, // 8 hours in milliseconds (8 * 60 * 60 * 1000)
              levels: {
                summary: {
                  deep: { minutes: 120 },
                  light: { minutes: 240 },
                  rem: { minutes: 90 },
                  wake: { minutes: 30 },
                },
              },
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSleepResponse);

      const sleep = await adapter.fetchSleep({
        userId: 'test-user',
        startDate: new Date('2024-11-04'),
        endDate: new Date('2024-11-04'),
      });

      expect(sleep).toHaveLength(1);
      expect(sleep[0].duration).toBe(480); // minutes
      expect(sleep[0].stages?.deep).toBe(120);
      expect(sleep[0].stages?.light).toBe(240);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);

      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          user_id: 'test-user',
          expires_in: 3600,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should enforce rate limiting (150 requests/hour)', async () => {
      // Mock 150 successful requests
      const mockResponse = {
        ok: true,
        json: async () => ({ summary: { steps: 100 } }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Make 150 requests - should succeed
      for (let i = 0; i < 150; i++) {
        await adapter.fetchActivity({
          userId: 'test-user',
          startDate: new Date(),
          endDate: new Date(),
        });
      }

      // 151st request should fail
      await expect(
        adapter.fetchActivity({
          userId: 'test-user',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Device Management', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);

      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          user_id: 'test-user',
          expires_in: 3600,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should list connected devices', async () => {
      const mockDevicesResponse = {
        ok: true,
        json: async () => [
          {
            id: 'device-123',
            deviceVersion: 'Charge 5',
            lastSyncTime: '2024-11-04T10:00:00.000Z',
            batteryLevel: 'High',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockDevicesResponse);

      const devices = await adapter.listConnectedDevices('test-user');

      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('Charge 5');
      expect(devices[0].batteryLevel).toBe(80); // High = 80%
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);

      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          user_id: 'test-user',
          expires_in: 3600,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should handle API errors gracefully', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await expect(
        adapter.fetchVitals({
          userId: 'test-user',
          types: ['heart_rate'],
        })
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        adapter.fetchActivity({
          userId: 'test-user',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Network error');
    });
  });
});
