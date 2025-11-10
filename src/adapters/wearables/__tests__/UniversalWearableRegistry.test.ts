/**
 * Universal Wearable Registry Tests
 */

import { UniversalWearableRegistry, wearableRegistry } from '../UniversalWearableRegistry';
import { FitbitAdapter } from '../implementations/FitbitAdapter';
import { AppleHealthKitAdapter } from '../implementations/AppleHealthKitAdapter';

describe.skip('UniversalWearableRegistry - TODO: Fix connection logic', () => {
  let registry: UniversalWearableRegistry;

  beforeEach(() => {
    registry = UniversalWearableRegistry.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = UniversalWearableRegistry.getInstance();
    const instance2 = UniversalWearableRegistry.getInstance();

    expect(instance1).toBe(instance2);
  });

  describe('Adapter Registration', () => {
    it('should register a new adapter', () => {
      const fitbitAdapter = new FitbitAdapter();

      registry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);

      const adapters = registry.listAdapters();
      const fitbit = adapters.find(a => a.id === 'fitbit');

      expect(fitbit).toBeDefined();
      expect(fitbit?.name).toBe('Fitbit Adapter');
    });

    it('should register multiple adapters', () => {
      const fitbitAdapter = new FitbitAdapter();
      const appleAdapter = new AppleHealthKitAdapter();

      registry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);
      registry.registerAdapter(appleAdapter.metadata, AppleHealthKitAdapter);

      const adapters = registry.listAdapters();

      expect(adapters.length).toBeGreaterThanOrEqual(2);
      expect(adapters.some(a => a.id === 'fitbit')).toBe(true);
      expect(adapters.some(a => a.id === 'apple-healthkit')).toBe(true);
    });
  });

  describe('Adapter Retrieval', () => {
    beforeEach(() => {
      const fitbitAdapter = new FitbitAdapter();
      registry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);
    });

    it('should get adapter by ID', () => {
      const adapter = registry.getAdapter('fitbit');

      expect(adapter).toBeDefined();
      expect(adapter?.metadata.id).toBe('fitbit');
    });

    it('should return null for non-existent adapter', () => {
      const adapter = registry.getAdapter('non-existent');

      expect(adapter).toBeNull();
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      const fitbitAdapter = new FitbitAdapter();
      registry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);

      // Mock fetch for OAuth
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          user_id: 'test-user',
          expires_in: 3600,
        }),
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should connect to an adapter', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      const result = await registry.connect('fitbit', config, 'test-connection');

      expect(result.success).toBe(true);
      expect(result.connection).toBeDefined();
    });

    it('should return error for non-existent adapter', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      const result = await registry.connect('non-existent', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Adapter not found');
    });

    it('should retrieve active connection', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      await registry.connect('fitbit', config, 'test-connection');

      const connection = registry.getConnection('test-connection');

      expect(connection).toBeDefined();
      expect(connection?.metadata.id).toBe('fitbit');
    });

    it('should disconnect from adapter', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      await registry.connect('fitbit', config, 'test-connection');
      await registry.disconnect('test-connection');

      const connection = registry.getConnection('test-connection');

      expect(connection).toBeNull();
    });

    it('should disconnect all adapters', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      await registry.connect('fitbit', config, 'connection-1');
      await registry.connect('fitbit', config, 'connection-2');

      await registry.disconnectAll();

      const activeConnections = registry.getActiveConnections();

      expect(activeConnections).toHaveLength(0);
    });
  });

  describe('Test Adapter', () => {
    beforeEach(() => {
      const fitbitAdapter = new FitbitAdapter();
      registry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);

      // Mock successful test
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { encodedId: 'test-user', displayName: 'Test User' },
        }),
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should test adapter connection without persisting', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      const result = await registry.testAdapter('fitbit', config);

      // Should not persist connection
      const activeConnections = registry.getActiveConnections();
      expect(activeConnections).toHaveLength(0);
    });

    it('should return capabilities for successful test', async () => {
      const config = {
        authType: 'oauth2' as const,
        clientId: 'test-id',
        clientSecret: 'test-secret',
      };

      const result = await registry.testAdapter('fitbit', config);

      expect(result.capabilities).toBeDefined();
      expect(result.capabilities).toContain('heartRate');
      expect(result.capabilities).toContain('steps');
    });
  });

  describe('Export Singleton', () => {
    it('should export singleton instance', () => {
      expect(wearableRegistry).toBeInstanceOf(UniversalWearableRegistry);
      expect(wearableRegistry).toBe(UniversalWearableRegistry.getInstance());
    });
  });
});
