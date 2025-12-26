/**
 * Amazfit Adapter Tests
 */

import { AmazfitAdapter } from '../implementations/AmazfitAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';

global.fetch = vi.fn();

describe('AmazfitAdapter', () => {
  let adapter: AmazfitAdapter;
  let mockConfig: WearableAdapterConfig;

  beforeEach(() => {
    adapter = new AmazfitAdapter();
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
      expect(adapter.metadata.id).toBe('amazfit');
      expect(adapter.metadata.vendor).toBe('Zepp Health (Huami)');
      expect(adapter.metadata.oauthRequired).toBe(true);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.steps).toBe(true);
      expect(adapter.metadata.capabilities.sleep).toBe(true);
      expect(adapter.metadata.capabilities.bloodOxygen).toBe(true);
      expect(adapter.metadata.capabilities.bloodPressure).toBe(false);
      expect(adapter.metadata.capabilities.ecg).toBe(false);
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
        'Amazfit requires OAuth2 authentication'
      );
    });

    it('should throw error when credentials missing', async () => {
      const noCredConfig = { ...mockConfig, clientId: undefined, clientSecret: undefined };
      await expect(adapter.connect(noCredConfig)).rejects.toThrow();
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
      const scopes = ['data:read'];
      const authUrl = adapter.getAuthorizationUrl(scopes);
      expect(authUrl).toContain('zepp');
      expect(authUrl).toContain('client_id=test-client-id');
    });

    it('should handle OAuth callback successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);
      const result = await adapter.handleOAuthCallback('auth-code-123');
      expect(result.accessToken).toBe('test-access-token');
    });

    it('should refresh access token', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const newToken = await adapter.refreshAccessToken('old-refresh-token');
      expect(newToken).toBe('new-access-token');
    });
  });

  describe('Data Fetching', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should fetch heart rate vitals', async () => {
      const mockHRResponse = {
        ok: true,
        json: async () => ({
          data: [
            { value: 68, timestamp: Date.now(), device: 'Amazfit GTR 4' },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockHRResponse);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['heart_rate'],
      });

      expect(Array.isArray(vitals)).toBe(true);
    });

    it('should fetch activity data', async () => {
      const mockActivityResponse = {
        ok: true,
        json: async () => ({
          data: [
            {
              date: '2024-11-04',
              steps: 11000,
              distance: 8800,
              calories: 520,
              activeMinutes: 65,
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
      expect(activities[0].steps).toBe(11000);
    });

    it('should fetch sleep data', async () => {
      const mockSleepResponse = {
        ok: true,
        json: async () => ({
          data: [
            {
              date: '2024-11-04',
              duration: 450,
              deepSleep: 110,
              lightSleep: 220,
              remSleep: 85,
              awake: 35,
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
      expect(sleep[0].duration).toBe(450);
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
          expires_in: 3600,
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should list connected devices', async () => {
      const mockDevicesResponse = {
        ok: true,
        json: async () => ({
          devices: [
            {
              device_id: 'device-123',
              device_name: 'Amazfit GTR 4',
              model_name: 'A2166',
              last_sync_time: new Date().toISOString(),
              battery_level: 85,
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDevicesResponse);

      const devices = await adapter.listConnectedDevices('test-user');
      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('Amazfit GTR 4');
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.heartRate).toBe(true);
      expect(caps.bloodOxygen).toBe(true);
    });

    it('should check feature support correctly', () => {
      expect(adapter.supportsFeature('heartRate')).toBe(true);
      expect(adapter.supportsFeature('ecg')).toBe(false);
    });
  });
});
