/**
 * Amazfit (Zepp) API Adapter
 *
 * Adapter for Amazfit smartwatches (owned by Zepp Health, formerly Huami)
 * Popular TikTok budget Apple Watch alternative
 * Supports: GTR, GTS, Bip, T-Rex series
 *
 * Documentation: https://developer.zepp.com/
 *
 * Features:
 * - OAuth 2.0 via Zepp Platform
 * - Heart rate, SpO2, PAI (Personal Activity Intelligence)
 * - Sleep tracking with REM detection
 * - Stress monitoring
 * - Step count, distance, calories
 * - Affordable devices with good health tracking
 */

import type {
  WearableAdapter,
  WearableAdapterMetadata,
  WearableAdapterConfig,
  WearableVitalData,
  WearableActivityData,
} from '../UniversalWearableRegistry';

interface AmazfitConfig extends WearableAdapterConfig {
  // Amazfit/Zepp specific config
  region?: 'global' | 'china'; // Different API endpoints
}

export class AmazfitAdapter implements WearableAdapter {
  metadata: WearableAdapterMetadata = {
    id: 'amazfit',
    name: 'Amazfit (Zepp) Adapter',
    vendor: 'Zepp Health (Huami)',
    version: '1.0.0',
    deviceTypes: ['smartwatch', 'fitness-band'],
    capabilities: {
      heartRate: true,
      bloodPressure: false,
      bloodOxygen: true, // SpO2
      temperature: false,
      respiratoryRate: true,
      steps: true,
      distance: true,
      calories: true,
      sleep: true,
      exerciseMinutes: true,
      fallDetection: false,
      ecg: false,
      gaitAnalysis: false,
      glucoseMonitoring: false,
    },
    setupGuide: '/docs/adapters/amazfit-setup.md',
    oauthRequired: true,
    certifications: ['Zepp API'],
  };

  private readonly ZEPP_API_BASE = 'https://api-mifit.zepp.com/v1';
  private readonly ZEPP_AUTH_BASE = 'https://account.zepp.com/oauth2';

  private accessToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: Date | null = null;
  private config: AmazfitConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  async connect(config: WearableAdapterConfig): Promise<void> {
    this.config = config as AmazfitConfig;

    if (config.authType !== 'oauth2') {
      throw new Error('Amazfit requires OAuth2 authentication');
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Amazfit OAuth2 requires clientId and clientSecret');
    }

    this.status = 'connected';
    console.log('✅ Amazfit/Zepp adapter: Connection initialized (OAuth2)');
  }

  async disconnect(): Promise<void> {
    this.accessToken = '';
    this.refreshToken = '';
    this.config = null;
    this.status = 'disconnected';
    console.log('🔌 Amazfit/Zepp adapter: Disconnected');
  }

  async test(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 Amazfit/Zepp adapter: Testing connection...');
      const response = await this.makeRequest('/user/profile', 'GET');

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Amazfit/Zepp adapter: Connection test successful');
        return {
          success: true,
          message: 'Connection successful',
          details: {
            userId: data.user_id,
            devices: data.devices || [],
          },
        };
      }

      console.error(`❌ Amazfit/Zepp adapter: Connection test failed (${response.status})`);

      return {
        success: false,
        message: `Connection test failed: ${response.status} ${response.statusText}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection test failed',
      };
    }
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  getAuthorizationUrl(scopes: string[]): string {
    if (!this.config?.clientId) {
      throw new Error('Client ID not configured');
    }

    const defaultScopes = ['data:read_all'];
    const requestedScopes = scopes.length > 0 ? scopes : defaultScopes;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || '',
      scope: requestedScopes.join(' '),
      state: Math.random().toString(36).substring(7),
    });

    return `${this.ZEPP_AUTH_BASE}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const response = await fetch(`${this.ZEPP_AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

    

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const response = await fetch(`${this.ZEPP_AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

    

    return data.access_token;
  }

  async fetchVitals(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate'>;
  }): Promise<WearableVitalData[]> {
    const vitals: WearableVitalData[] = [];
    const types = params.types || ['heart_rate', 'spo2', 'respiratory_rate'];

    const startDate = params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate || new Date();

    // Fetch heart rate
    if (types.includes('heart_rate')) {
      try {
        const response = await this.makeRequest(
          `/data/heart_rate?start_date=${this.formatDate(startDate)}&end_date=${this.formatDate(endDate)}`,
          'GET'
        );

        if (response.ok) {
          const data = await response.json();
          const samples = data.data || [];

          for (const sample of samples) {
            vitals.push({
              type: 'heart_rate',
              value: sample.value,
              unit: 'bpm',
              timestamp: new Date(sample.timestamp),
              metadata: {
                deviceModel: 'Amazfit',
                context: sample.context,
              },
            });
          }
        }
      } catch (error) {
        
      }
    }

    // Fetch SpO2
    if (types.includes('spo2')) {
      try {
        const response = await this.makeRequest(
          `/data/spo2?start_date=${this.formatDate(startDate)}&end_date=${this.formatDate(endDate)}`,
          'GET'
        );

        if (response.ok) {
          const data = await response.json();
          const samples = data.data || [];

          for (const sample of samples) {
            vitals.push({
              type: 'spo2',
              value: sample.value,
              unit: '%',
              timestamp: new Date(sample.timestamp),
              metadata: {
                deviceModel: 'Amazfit',
              },
            });
          }
        }
      } catch (error) {
        
      }
    }

    return vitals;
  }

  async fetchActivity(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableActivityData[]> {
    const response = await this.makeRequest(
      `/data/activity?start_date=${this.formatDate(params.startDate)}&end_date=${this.formatDate(params.endDate)}`,
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activity: ${response.statusText}`);
    }

    const data = await response.json();
    const activities = data.data || [];

    return activities.map((activity: any) => ({
      date: new Date(activity.date),
      steps: activity.steps,
      distanceMeters: activity.distance,
      caloriesBurned: activity.calories,
      activeMinutes: activity.active_time ? Math.floor(activity.active_time / 60) : 0,
      metadata: {
        goals: {
          steps: activity.step_goal || 10000,
        },
      },
    }));
  }

  async fetchSleep(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    date: Date;
    duration: number;
    stages?: {
      deep: number;
      light: number;
      rem: number;
      awake: number;
    };
  }[]> {
    const response = await this.makeRequest(
      `/data/sleep?start_date=${this.formatDate(params.startDate)}&end_date=${this.formatDate(params.endDate)}`,
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sleep: ${response.statusText}`);
    }

    const data = await response.json();
    const sleepSessions = data.data || [];

    return sleepSessions.map((session: any) => ({
      date: new Date(session.start_time),
      duration: session.duration,
      stages: session.stages ? {
        deep: session.stages.deep || 0,
        light: session.stages.light || 0,
        rem: session.stages.rem || 0,
        awake: session.stages.awake || 0,
      } : undefined,
    }));
  }

  async listConnectedDevices(userId: string): Promise<{
    deviceId: string;
    name: string;
    model: string;
    lastSyncDate: Date;
    batteryLevel?: number;
  }[]> {
    const response = await this.makeRequest('/devices', 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }

    const data = await response.json();
    const devices = data.devices || [];

    return devices.map((device: any) => ({
      deviceId: device.device_id,
      name: device.device_name,
      model: device.model_name,
      lastSyncDate: new Date(device.last_sync_time),
      batteryLevel: device.battery_level,
    }));
  }

  getCapabilities(): WearableAdapterMetadata['capabilities'] {
    return this.metadata.capabilities;
  }

  supportsFeature(feature: string): boolean {
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  private async makeRequest(path: string, method: string, body?: any): Promise<Response> {
    if (this.tokenExpiry && new Date() >= this.tokenExpiry && this.refreshToken) {
      await this.refreshAccessToken(this.refreshToken);
    }

    const url = path.startsWith('http') ? path : `${this.ZEPP_API_BASE}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    return await fetch(url, options);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
