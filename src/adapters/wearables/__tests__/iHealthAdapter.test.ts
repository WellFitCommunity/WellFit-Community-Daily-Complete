/**
 * iHealth Adapter Tests
 */

import { iHealthAdapter } from '../implementations/iHealthAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';

// Mock fetch
global.fetch = vi.fn();

describe('iHealthAdapter', () => {
  let adapter: iHealthAdapter;
  let mockConfig: WearableAdapterConfig;

  beforeEach(() => {
    adapter = new iHealthAdapter();
    mockConfig = {
      authType: 'oauth2',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['OpenApiBP', 'OpenApiWeight', 'OpenApiSpO2'],
    };

    vi.clearAllMocks();
  });

  describe('Metadata', () => {
    it('should have correct adapter metadata', () => {
      expect(adapter.metadata.id).toBe('ihealth');
      expect(adapter.metadata.vendor).toBe('iHealth Labs Inc.');
      expect(adapter.metadata.oauthRequired).toBe(true);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.bloodPressure).toBe(true);
      expect(adapter.metadata.capabilities.bloodOxygen).toBe(true);
      expect(adapter.metadata.capabilities.glucoseMonitoring).toBe(true);
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.steps).toBe(true);
      expect(adapter.metadata.capabilities.ecg).toBe(false);
    });

    it('should have correct device types', () => {
      expect(adapter.metadata.deviceTypes).toContain('blood-pressure-monitor');
      expect(adapter.metadata.deviceTypes).toContain('scale');
      expect(adapter.metadata.deviceTypes).toContain('pulse-oximeter');
      expect(adapter.metadata.deviceTypes).toContain('glucometer');
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
        'iHealth requires OAuth2 authentication'
      );
    });

    it('should throw error when credentials missing', async () => {
      const noCredConfig = { ...mockConfig, clientId: undefined, clientSecret: undefined };
      await expect(adapter.connect(noCredConfig)).rejects.toThrow(
        'iHealth OAuth2 requires clientId and clientSecret'
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
      const scopes = ['OpenApiBP', 'OpenApiWeight'];
      const authUrl = adapter.getAuthorizationUrl(scopes);

      expect(authUrl).toContain('api.ihealthlabs.com');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('APIName=OpenApiBP');
    });

    it('should handle OAuth callback successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          AccessToken: 'test-access-token',
          RefreshToken: 'test-refresh-token',
          Expires: 3600,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const result = await adapter.handleOAuthCallback('auth-code-123');

      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
    });

    it('should refresh access token', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          AccessToken: 'new-access-token',
          Expires: 3600,
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
          AccessToken: 'test-token',
          RefreshToken: 'test-refresh',
          Expires: 3600,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should fetch blood pressure vitals', async () => {
      const mockBPResponse = {
        ok: true,
        json: async () => ({
          BPDataList: [
            {
              HP: 120,
              LP: 80,
              HR: 72,
              MDate: Math.floor(Date.now() / 1000),
              DataSource: 'iHealth BP7',
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockBPResponse);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['blood_pressure'],
      });

      expect(vitals.length).toBeGreaterThanOrEqual(1);
      const bpReading = vitals.find(v => v.type === 'blood_pressure');
      expect(bpReading).toBeDefined();
      expect(bpReading?.value).toEqual({ systolic: 120, diastolic: 80 });
      expect(bpReading?.unit).toBe('mmHg');
    });

    it('should fetch SpO2 vitals', async () => {
      const mockSpO2Response = {
        ok: true,
        json: async () => ({
          SpO2DataList: [
            {
              BO: 98,
              HR: 70,
              MDate: Math.floor(Date.now() / 1000),
              DataSource: 'iHealth Air',
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSpO2Response);

      const vitals = await adapter.fetchVitals({
        userId: 'test-user',
        types: ['spo2'],
      });

      expect(vitals.length).toBeGreaterThanOrEqual(1);
      const spo2Reading = vitals.find(v => v.type === 'spo2');
      expect(spo2Reading).toBeDefined();
      expect(spo2Reading?.value).toBe(98);
      expect(spo2Reading?.unit).toBe('%');
    });

    it('should fetch activity data', async () => {
      const mockActivityResponse = {
        ok: true,
        json: async () => ({
          ARDataList: [
            {
              MDate: Math.floor(Date.now() / 1000),
              Steps: 8500,
              DistanceTraveled: 6800,
              Calories: 350,
              ActiveTime: 2400,
              StepGoal: 10000,
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockActivityResponse);

      const activities = await adapter.fetchActivity({
        userId: 'test-user',
        startDate: new Date('2024-11-04'),
        endDate: new Date('2024-11-04'),
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].steps).toBe(8500);
      expect(activities[0].caloriesBurned).toBe(350);
      expect(activities[0].activeMinutes).toBe(40);
    });

    it('should fetch sleep data', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSleepResponse = {
        ok: true,
        json: async () => ({
          SRDataList: [
            {
              StartTime: now - 28800,
              EndTime: now,
              SleepEfficiency: 85,
              DeepSleep: 120,
              LightSleep: 240,
              RemSleep: 90,
              Awake: 30,
            },
          ],
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSleepResponse);

      const sleep = await adapter.fetchSleep({
        userId: 'test-user',
        startDate: new Date('2024-11-04'),
        endDate: new Date('2024-11-04'),
      });

      expect(sleep).toHaveLength(1);
      expect(sleep[0].duration).toBe(480);
      expect(sleep[0].stages?.deep).toBe(120);
      expect(sleep[0].stages?.light).toBe(240);
    });
  });

  describe('Device Management', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);

      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          AccessToken: 'test-token',
          RefreshToken: 'test-refresh',
          Expires: 3600,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should list connected devices based on API access', async () => {
      const mockUserInfoResponse = {
        ok: true,
        json: async () => ({
          OpenApiBP: true,
          OpenApiWeight: true,
          OpenApiSpO2: true,
          OpenApiBG: false,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockUserInfoResponse);

      const devices = await adapter.listConnectedDevices('test-user');

      expect(devices.length).toBe(3);
      expect(devices.some(d => d.name.includes('Blood Pressure'))).toBe(true);
      expect(devices.some(d => d.name.includes('Scale'))).toBe(true);
      expect(devices.some(d => d.name.includes('Pulse Oximeter'))).toBe(true);
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.bloodPressure).toBe(true);
      expect(caps.glucoseMonitoring).toBe(true);
    });

    it('should check feature support correctly', () => {
      expect(adapter.supportsFeature('bloodPressure')).toBe(true);
      expect(adapter.supportsFeature('ecg')).toBe(false);
      expect(adapter.supportsFeature('fallDetection')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);

      const mockOAuthResponse = {
        ok: true,
        json: async () => ({
          AccessToken: 'test-token',
          RefreshToken: 'test-refresh',
          Expires: 3600,
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOAuthResponse);
      await adapter.handleOAuthCallback('test-code');
    });

    it('should handle API errors gracefully', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockErrorResponse);

      await expect(
        adapter.fetchActivity({
          userId: 'test-user',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

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
