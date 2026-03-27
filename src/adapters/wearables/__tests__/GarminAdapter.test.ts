/**
 * Garmin Adapter Tests
 * Note: Garmin uses OAuth 1.0a, not OAuth 2.0
 */

import { GarminAdapter } from '../implementations/GarminAdapter';
import type { WearableAdapterConfig } from '../UniversalWearableRegistry';

global.fetch = vi.fn();

describe('GarminAdapter', () => {
  let adapter: GarminAdapter;
  let mockConfig: WearableAdapterConfig;

  beforeEach(() => {
    adapter = new GarminAdapter();
    mockConfig = {
      authType: 'oauth2',
      clientId: 'test-consumer-key',
      clientSecret: 'test-consumer-secret',
      redirectUri: 'http://localhost:3000/callback',
    };
    vi.clearAllMocks();
  });

  describe('Metadata', () => {
    it('should have correct adapter metadata', () => {
      expect(adapter.metadata.id).toBe('garmin');
      expect(adapter.metadata.vendor).toBe('Garmin International');
      expect(adapter.metadata.oauthRequired).toBe(true);
    });

    it('should support correct capabilities', () => {
      expect(adapter.metadata.capabilities.heartRate).toBe(true);
      expect(adapter.metadata.capabilities.steps).toBe(true);
      expect(adapter.metadata.capabilities.sleep).toBe(true);
      expect(adapter.metadata.capabilities.bloodOxygen).toBe(true);
      expect(adapter.metadata.capabilities.ecg).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid config', async () => {
      await expect(adapter.connect(mockConfig)).resolves.not.toThrow();
      expect(adapter.getConnectionStatus()).toBe('connected');
    });

    it('should throw error when credentials missing', async () => {
      const invalidConfig = { ...mockConfig, clientId: undefined, clientSecret: undefined };
      await expect(adapter.connect(invalidConfig)).rejects.toThrow();
    });

    it('should disconnect successfully', async () => {
      await adapter.connect(mockConfig);
      await adapter.disconnect();
      expect(adapter.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('OAuth 1.0a Flow', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should require initOAuthFlow before getAuthorizationUrl', () => {
      expect(() => adapter.getAuthorizationUrl(['activity'])).toThrow('initOAuthFlow');
    });

    it('should call Garmin request_token endpoint in initOAuthFlow', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => 'oauth_token=req_token_123&oauth_token_secret=req_secret_456',
      });

      const authUrl = await adapter.initOAuthFlow();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('request_token'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(authUrl).toContain('authorize');
      expect(authUrl).toContain('req_token_123');
    });

    it('should throw on failed request token response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(adapter.initOAuthFlow()).rejects.toThrow('request token failed');
    });

    it('should exchange verifier for access token', async () => {
      // Step 1: Get request token
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => 'oauth_token=req_token&oauth_token_secret=req_secret',
      });
      await adapter.initOAuthFlow();

      // Step 2: Exchange verifier
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => 'oauth_token=access_token_xyz&oauth_token_secret=access_secret_abc',
      });

      const result = await adapter.handleOAuthCallback('verifier_code');

      expect(result.accessToken).toBe('access_token_xyz');
      expect(result.refreshToken).toBe('access_secret_abc');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('access_token'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw when handleOAuthCallback called without initOAuthFlow', async () => {
      await expect(adapter.handleOAuthCallback('verifier')).rejects.toThrow('initOAuthFlow');
    });

    it('should include HMAC-SHA1 signature in OAuth header', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => 'oauth_token=req_token&oauth_token_secret=req_secret',
      });
      await adapter.initOAuthFlow();

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers as Record<string, string>;
      expect(headers.Authorization).toMatch(/^OAuth /);
      expect(headers.Authorization).toContain('oauth_signature=');
      expect(headers.Authorization).toContain('oauth_signature_method="HMAC-SHA1"');
    });

    it('should throw on refreshAccessToken (OAuth 1.0a tokens do not expire)', async () => {
      await expect(adapter.refreshAccessToken('token')).rejects.toThrow('do not expire');
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.heartRate).toBe(true);
      expect(caps.steps).toBe(true);
    });

    it('should check feature support correctly', () => {
      expect(adapter.supportsFeature('heartRate')).toBe(true);
      expect(adapter.supportsFeature('ecg')).toBe(false);
    });
  });

  describe('Test Connection', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should test connection', async () => {
      const result = await adapter.test();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Signed API Requests', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
      // Complete OAuth flow to set tokens
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => 'oauth_token=req_token&oauth_token_secret=req_secret',
      });
      await adapter.initOAuthFlow();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => 'oauth_token=access_tok&oauth_token_secret=access_sec',
      });
      await adapter.handleOAuthCallback('verifier');
      vi.clearAllMocks();
    });

    it('should sign daily summary requests with OAuth 1.0a', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { calendarDate: '2026-03-27', restingHeartRateInBeatsPerMinute: 62, totalSteps: 8500 },
        ],
      });

      const vitals = await adapter.fetchVitals({ userId: 'user-123' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dailies'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^OAuth /),
          }),
        })
      );
      expect(vitals.length).toBeGreaterThan(0);
      expect(vitals[0].type).toBe('heart_rate');
      expect(vitals[0].value).toBe(62);
    });

    it('should fetch activity data with steps and calories', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            calendarDate: '2026-03-27',
            totalSteps: 10200,
            totalDistanceInMeters: 7500,
            activeKilocalories: 420,
            moderateIntensityDurationInSeconds: 1800,
          },
        ],
      });

      const activities = await adapter.fetchActivity({
        userId: 'user-123',
        startDate: new Date('2026-03-27'),
        endDate: new Date('2026-03-27'),
      });

      expect(activities.length).toBe(1);
      expect(activities[0].steps).toBe(10200);
      expect(activities[0].caloriesBurned).toBe(420);
      expect(activities[0].activeMinutes).toBe(30);
    });

    it('should fetch sleep data with stage breakdown', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            calendarDate: '2026-03-27',
            sleepingSeconds: 28800,
            deepSleepSeconds: 7200,
            lightSleepSeconds: 14400,
            remSleepSeconds: 5400,
            awakeSleepSeconds: 1800,
          },
        ],
      });

      const sleep = await adapter.fetchSleep({
        userId: 'user-123',
        startDate: new Date('2026-03-27'),
        endDate: new Date('2026-03-27'),
      });

      expect(sleep.length).toBe(1);
      expect(sleep[0].duration).toBe(480); // 28800 / 60
      expect(sleep[0].stages?.deep).toBe(120); // 7200 / 60
      expect(sleep[0].stages?.rem).toBe(90); // 5400 / 60
    });
  });
});
