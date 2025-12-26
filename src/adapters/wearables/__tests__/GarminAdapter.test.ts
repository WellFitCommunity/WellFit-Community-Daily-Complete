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

  describe('OAuth 1.0a Flow (Stub)', () => {
    beforeEach(async () => {
      await adapter.connect(mockConfig);
    });

    it('should throw OAuth 1.0a required error for getAuthorizationUrl', () => {
      expect(() => adapter.getAuthorizationUrl(['activity'])).toThrow('OAuth 1.0a');
    });

    it('should throw OAuth 1.0a error for handleOAuthCallback', async () => {
      await expect(adapter.handleOAuthCallback('code')).rejects.toThrow('OAuth 1.0a');
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
});
