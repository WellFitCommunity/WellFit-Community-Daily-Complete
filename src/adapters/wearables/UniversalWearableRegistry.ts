// src/adapters/wearables/UniversalWearableRegistry.ts
// Central registry for all wearable device adapters - "The Universal Wearable Joint"

export interface WearableAdapterMetadata {
  id: string;
  name: string;
  vendor: string;
  version: string;
  deviceTypes: string[]; // e.g., ['smartwatch', 'fitness-band', 'medical-device']
  capabilities: {
    heartRate: boolean;
    bloodPressure: boolean;
    bloodOxygen: boolean; // SpO2
    temperature: boolean;
    respiratoryRate: boolean;
    steps: boolean;
    distance: boolean;
    calories: boolean;
    sleep: boolean;
    exerciseMinutes: boolean;
    fallDetection: boolean;
    ecg: boolean; // Electrocardiogram
    gaitAnalysis: boolean;
    glucoseMonitoring: boolean;
  };
  setupGuide: string;
  oauthRequired: boolean;
  certifications?: string[]; // e.g., "FDA 510(k)", "CE Mark", "Apple HealthKit"
}

export interface WearableAdapterConfig {
  authType: 'oauth2' | 'api-key' | 'sdk';

  // OAuth2 fields
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];

  // API Key fields
  apiKey?: string;

  // SDK fields (for Apple HealthKit, Android Health Connect)
  sdkConfig?: Record<string, any>;

  // Sync configuration
  syncInterval?: number; // milliseconds
  autoSync?: boolean;

  // Data options
  dataRetentionDays?: number;
  encryptionEnabled?: boolean;

  // Custom options per vendor
  options?: Record<string, any>;
}

export interface WearableVitalData {
  type: 'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate';
  value: number | { systolic: number; diastolic: number }; // BP is an object
  unit: string;
  timestamp: Date;
  metadata?: {
    context?: string; // 'resting', 'active', 'sleeping'
    deviceModel?: string;
    confidence?: number; // 0-1
  };
}

export interface WearableActivityData {
  date: Date;
  steps?: number;
  distanceMeters?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
  sleepMinutes?: number;
  metadata?: {
    goals?: {
      steps?: number;
      activeMinutes?: number;
      sleepMinutes?: number;
    };
  };
}

export interface WearableFallEvent {
  timestamp: Date;
  severity: 'minor' | 'moderate' | 'severe' | 'unknown';
  location?: {
    latitude: number;
    longitude: number;
  };
  userResponded: boolean;
  emergencyContacted: boolean;
  metadata?: Record<string, any>;
}

export interface WearableECGData {
  timestamp: Date;
  classification: 'sinus_rhythm' | 'afib' | 'high_heart_rate' | 'low_heart_rate' | 'inconclusive';
  heartRate: number;
  waveformData?: number[]; // Raw ECG waveform samples
  duration: number; // seconds
  metadata?: Record<string, any>;
}

export interface WearableGaitData {
  timestamp: Date;
  walkingSpeed: number; // meters per second
  stepLength: number; // meters
  doubleSupport: number; // percentage of gait cycle
  asymmetry: number; // 0-1 scale
  variability: number; // coefficient of variation
  metadata?: {
    duration?: number; // seconds
    steps?: number;
  };
}

/**
 * Universal interface that all wearable adapters must implement
 */
export interface WearableAdapter {
  metadata: WearableAdapterMetadata;

  // Connection Management
  connect(config: WearableAdapterConfig): Promise<void>;
  disconnect(): Promise<void>;
  test(): Promise<{ success: boolean; message: string; details?: any }>;
  getConnectionStatus(): 'connected' | 'disconnected' | 'error';

  // OAuth Flow (for devices requiring it)
  getAuthorizationUrl?(scopes: string[]): string;
  handleOAuthCallback?(code: string): Promise<{ accessToken: string; refreshToken?: string }>;
  refreshAccessToken?(refreshToken: string): Promise<string>;

  // Vital Signs
  fetchVitals(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate'>;
  }): Promise<WearableVitalData[]>;

  // Activity Data
  fetchActivity(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableActivityData[]>;

  // Sleep Data
  fetchSleep(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    date: Date;
    duration: number; // minutes
    stages?: {
      deep: number;
      light: number;
      rem: number;
      awake: number;
    };
  }[]>;

  // Advanced Features (optional)
  fetchFallDetection?(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableFallEvent[]>;

  fetchECG?(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WearableECGData[]>;

  fetchGaitAnalysis?(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableGaitData[]>;

  // Realtime subscriptions (if supported)
  subscribeToVitals?(
    userId: string,
    callback: (data: WearableVitalData) => void
  ): Promise<() => void>; // Returns unsubscribe function

  // Device Management
  listConnectedDevices(userId: string): Promise<{
    deviceId: string;
    name: string;
    model: string;
    lastSyncDate: Date;
    batteryLevel?: number;
  }[]>;

  // Metadata
  getCapabilities(): WearableAdapterMetadata['capabilities'];
  supportsFeature(feature: string): boolean;
}

/**
 * Universal Wearable Registry - Manages all wearable device adapters
 */
export class UniversalWearableRegistry {
  private static instance: UniversalWearableRegistry;
  private adapters: Map<string, new () => WearableAdapter> = new Map();
  private activeConnections: Map<string, WearableAdapter> = new Map();

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): UniversalWearableRegistry {
    if (!UniversalWearableRegistry.instance) {
      UniversalWearableRegistry.instance = new UniversalWearableRegistry();
    }
    return UniversalWearableRegistry.instance;
  }

  /**
   * Register a new wearable adapter
   */
  registerAdapter(metadata: WearableAdapterMetadata, AdapterClass: new () => WearableAdapter) {
    this.adapters.set(metadata.id, AdapterClass);
    // Wearable adapter registered successfully
  }

  /**
   * List all registered adapters
   */
  listAdapters(): WearableAdapterMetadata[] {
    const adapters: WearableAdapterMetadata[] = [];
    this.adapters.forEach((AdapterClass) => {
      const instance = new AdapterClass();
      adapters.push(instance.metadata);
    });
    return adapters;
  }

  /**
   * Get adapter by ID
   */
  getAdapter(id: string): WearableAdapter | null {
    const AdapterClass = this.adapters.get(id);
    if (!AdapterClass) {
      // Adapter not found
      return null;
    }
    return new AdapterClass();
  }

  /**
   * Connect to a wearable device platform
   */
  async connect(
    adapterId: string,
    config: WearableAdapterConfig,
    connectionId?: string
  ): Promise<{ success: boolean; connection?: WearableAdapter; error?: string }> {
    try {
      const adapter = this.getAdapter(adapterId);
      if (!adapter) {
        return { success: false, error: `Adapter not found: ${adapterId}` };
      }

      // Connecting to adapter
      await adapter.connect(config);

      const testResult = await adapter.test();
      if (!testResult.success) {
        // Connection test failed
        return { success: false, error: testResult.message };
      }

      const connId = connectionId || `${adapterId}-${Date.now()}`;
      this.activeConnections.set(connId, adapter);

      // Successfully connected to adapter
      return { success: true, connection: adapter };
    } catch (error: any) {
      // Failed to connect to adapter
      return { success: false, error: error.message };
    }
  }

  /**
   * Get an active connection
   */
  getConnection(connectionId: string): WearableAdapter | null {
    return this.activeConnections.get(connectionId) || null;
  }

  /**
   * Disconnect from a wearable platform
   */
  async disconnect(connectionId: string): Promise<void> {
    const adapter = this.activeConnections.get(connectionId);
    if (adapter) {
      await adapter.disconnect();
      this.activeConnections.delete(connectionId);
      // Disconnected from adapter
    }
  }

  /**
   * Disconnect all active connections
   */
  async disconnectAll(): Promise<void> {
    // Disconnecting all active connections
    const promises = Array.from(this.activeConnections.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(promises);
  }

  /**
   * Test an adapter connection without persisting it
   */
  async testAdapter(
    adapterId: string,
    config: WearableAdapterConfig
  ): Promise<{ success: boolean; error?: string; capabilities?: string[] }> {
    try {
      const AdapterClass = this.adapters.get(adapterId);
      if (!AdapterClass) {
        return {
          success: false,
          error: `Adapter not found: ${adapterId}`
        };
      }

      // Create temporary adapter instance
      const adapter = new AdapterClass();

      // Try to connect
      await adapter.connect(config);

      // Run test
      const testResult = await adapter.test();

      // Get capabilities
      const capabilities = Object.entries(adapter.metadata.capabilities)
        .filter(([_, enabled]) => enabled)
        .map(([cap]) => cap);

      // Disconnect
      await adapter.disconnect();

      return {
        success: testResult.success,
        error: testResult.success ? undefined : testResult.message,
        capabilities
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }
  }

  /**
   * Get all active connection IDs
   */
  getActiveConnections(): string[] {
    return Array.from(this.activeConnections.keys());
  }
}

// Export singleton instance
export const wearableRegistry = UniversalWearableRegistry.getInstance();

// Helper function to quickly test a wearable adapter
export async function testWearableAdapter(
  adapterId: string,
  config: WearableAdapterConfig
): Promise<void> {
  

  const result = await wearableRegistry.connect(adapterId, config, 'test-connection');

  if (!result.success) {
    
    return;
  }

  const adapter = result.connection;
  if (!adapter) {
    return;
  }

  
  Object.entries(adapter.metadata.capabilities).forEach(([key, value]) => {
    
  });

  await wearableRegistry.disconnect('test-connection');
  
}
