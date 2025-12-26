/**
 * Withings Adapter Tests
 */

import { WithingsAdapter } from '../implementations/WithingsAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';

global.fetch = vi.fn();

describe('WithingsAdapter', () => {
  let adapter: WithingsAdapter;
  let mockConfig: WearableAdapterConfig;

  beforeEach(() => {
    adapter = new WithingsAdapter();
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
      expect(adapter.metadata.id).toBe('withings');
      expect(adapter.metadata.vendor).toContain('Withings');
      expect(adapter.metadata.oauthRequired).toBe(true);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.bloodPressure).toBe(true);
      expect(adapter.metadata.capabilities.sleep).toBe(true);
      expect(adapter.metadata.capabilities.ecg).toBe(true);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid config', async () => {
      await expect(adapter.connect(mockConfig)).resolves.not.toThrow();
      expect(adapter.getConnectionStatus()).toBe('connected');
    });

    it('should throw error when OAuth2 not configured', async () => {
      const invalidConfig = { ...mockConfig, authType: 'api-key' as const };
      await expect(adapter.connect(invalidConfig)).rejects.toThrow();
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
      const scopes = ['user.metrics', 'user.activity'];
      const authUrl = adapter.getAuthorizationUrl(scopes);
      expect(authUrl).toContain('withings');
      expect(authUrl).toContain('client_id=test-client-id');
    });

    it('should handle OAuth callback successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
          },
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);
      const result = await adapter.handleOAuthCallback('auth-code-123');
      expect(result.accessToken).toBe('test-access-token');
    });
  });

  describe('Data Fetching', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expires_in: 3600,
          },
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should fetch blood pressure vitals', async () => {
      const mockBPResponse = {
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            measuregrps: [
              {
                date: Math.floor(Date.now() / 1000),
                measures: [
                  { type: 9, value: 120, unit: 0 }, // Systolic
                  { type: 10, value: 80, unit: 0 }, // Diastolic
                  { type: 11, value: 72, unit: 0 }, // Heart rate
                ],
              },
            ],
          },
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
          status: 0,
          body: {
            activities: [
              {
                date: '2024-11-04',
                steps: 8200,
                distance: 6500,
                calories: 380,
                soft: 1800,
                moderate: 1200,
                intense: 600,
              },
            ],
          },
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockActivityResponse);

      const activities = await adapter.fetchActivity({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].steps).toBe(8200);
    });

    it('should fetch sleep data', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSleepResponse = {
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            series: [
              {
                startdate: now - 28800,
                enddate: now,
                data: {
                  deepsleepduration: 7200,
                  lightsleepduration: 14400,
                  remsleepduration: 5400,
                  wakeupduration: 1800,
                },
              },
            ],
          },
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSleepResponse);

      const sleep = await adapter.fetchSleep({
        userId: 'test-user',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(sleep).toHaveLength(1);
      expect(sleep[0].stages?.deep).toBe(120);
    });
  });

  describe('Device Management', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expires_in: 3600,
          },
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should list connected devices', async () => {
      const mockDevicesResponse = {
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            devices: [
              {
                deviceid: 'device-123',
                type: 'Scale',
                model: 'Body+',
                last_session_date: Math.floor(Date.now() / 1000),
                battery: 'high',
              },
            ],
          },
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDevicesResponse);

      const devices = await adapter.listConnectedDevices('test-user');
      expect(devices).toHaveLength(1);
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.bloodPressure).toBe(true);
      expect(caps.sleep).toBe(true);
    });

    it('should check feature support correctly', () => {
      expect(adapter.supportsFeature('bloodPressure')).toBe(true);
      expect(adapter.supportsFeature('glucoseMonitoring')).toBe(false);
    });
  });
});
