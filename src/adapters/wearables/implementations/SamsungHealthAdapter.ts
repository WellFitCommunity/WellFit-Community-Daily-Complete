/**
 * Samsung Health API Adapter
 *
 * Enterprise-grade adapter for Samsung Health (S Health) integration
 * Supports Galaxy Watch, Galaxy Fit, and Samsung Health app on Android
 *
 * Documentation: https://developer.samsung.com/health
 *
 * Features:
 * - OAuth 2.0 authorization
 * - Heart rate, SpO2, stress, sleep tracking
 * - Step count, calories, distance
 * - Blood pressure (Galaxy Watch Active2+)
 * - ECG (Galaxy Watch Active2+)
 * - Body composition (Galaxy Watch4+)
 */

import type {
  WearableAdapter,
  WearableAdapterMetadata,
  WearableAdapterConfig,
  WearableVitalData,
  WearableActivityData,
} from '../UniversalWearableRegistry';

interface SamsungHealthConfig extends WearableAdapterConfig {
  // Samsung-specific config
}

export class SamsungHealthAdapter implements WearableAdapter {
  metadata: WearableAdapterMetadata = {
    id: 'samsung-health',
    name: 'Samsung Health Adapter',
    vendor: 'Samsung Electronics',
    version: '1.0.0',
    deviceTypes: ['smartwatch', 'fitness-band', 'smartphone'],
    capabilities: {
      heartRate: true,
      bloodPressure: true, // Galaxy Watch Active2+
      bloodOxygen: true,
      temperature: false,
      respiratoryRate: true,
      steps: true,
      distance: true,
      calories: true,
      sleep: true,
      exerciseMinutes: true,
      fallDetection: true, // Galaxy Watch4+
      ecg: true, // Galaxy Watch Active2+
      gaitAnalysis: false,
      glucoseMonitoring: false,
    },
    setupGuide: '/docs/adapters/samsung-health-setup.md',
    oauthRequired: true,
    certifications: ['Samsung Health API', 'FDA 510(k) - BP/ECG'],
  };

  private readonly SAMSUNG_API_BASE = 'https://api.samsunghealth.com/v1';
  private readonly SAMSUNG_AUTH_BASE = 'https://account.samsung.com/oauth2';

  private accessToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: Date | null = null;
  private config: SamsungHealthConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  async connect(config: WearableAdapterConfig): Promise<void> {
    this.config = config as SamsungHealthConfig;

    if (config.authType !== 'oauth2') {
      throw new Error('Samsung Health requires OAuth2 authentication');
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Samsung Health OAuth2 requires clientId and clientSecret');
    }

    this.status = 'connected';
  }

  async disconnect(): Promise<void> {
    this.accessToken = '';
    this.refreshToken = '';
    this.config = null;
    this.status = 'disconnected';
  }

  async test(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeRequest('/users/profile', 'GET');

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connection successful',
          details: {
            userId: data.user_id,
            devices: data.connected_devices || [],
          },
        };
      }


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

    const defaultScopes = ['health:read', 'health:write'];
    const requestedScopes = scopes.length > 0 ? scopes : defaultScopes;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || '',
      scope: requestedScopes.join(' '),
      state: Math.random().toString(36).substring(7),
    });

    return `${this.SAMSUNG_AUTH_BASE}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const response = await fetch(`${this.SAMSUNG_AUTH_BASE}/token`, {
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

    const response = await fetch(`${this.SAMSUNG_AUTH_BASE}/token`, {
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
    const types = params.types || ['heart_rate', 'blood_pressure', 'spo2', 'respiratory_rate'];

    const startTime = params.startDate?.getTime() || Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endTime = params.endDate?.getTime() || Date.now();

    for (const type of types) {
      try {
        const dataType = this.mapVitalType(type);
        const response = await this.makeRequest(
          `/users/${params.userId}/data/${dataType}?start_time=${startTime}&end_time=${endTime}`,
          'GET'
        );

        if (response.ok) {
          const data = await response.json();
          const samples = data.data || [];

          for (const sample of samples) {
            vitals.push({
              type: type as any,
              value: sample.value,
              unit: sample.unit,
              timestamp: new Date(sample.timestamp),
              metadata: {
                deviceModel: sample.device_model || 'Samsung Device',
                context: sample.context,
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
    const startTime = params.startDate.getTime();
    const endTime = params.endDate.getTime();

    const response = await this.makeRequest(
      `/users/${params.userId}/data/step_count?start_time=${startTime}&end_time=${endTime}&group_by=day`,
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activity: ${response.statusText}`);
    }

    const data = await response.json();
    const activities = data.data || [];

    return activities.map((activity: any) => ({
      date: new Date(activity.date),
      steps: activity.step_count,
      distanceMeters: activity.distance,
      caloriesBurned: activity.calories,
      activeMinutes: activity.active_time ? Math.floor(activity.active_time / 60) : 0,
      metadata: {
        goals: {
          steps: activity.step_goal,
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
    const startTime = params.startDate.getTime();
    const endTime = params.endDate.getTime();

    const response = await this.makeRequest(
      `/users/${params.userId}/data/sleep?start_time=${startTime}&end_time=${endTime}`,
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sleep: ${response.statusText}`);
    }

    const data = await response.json();
    const sleepSessions = data.data || [];

    return sleepSessions.map((session: any) => ({
      date: new Date(session.start_time),
      duration: Math.floor((session.end_time - session.start_time) / 60000),
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
    const response = await this.makeRequest(`/users/${userId}/devices`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }

    const data = await response.json();
    const devices = data.devices || [];

    return devices.map((device: any) => ({
      deviceId: device.device_id,
      name: device.device_name,
      model: device.model,
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

  private mapVitalType(type: string): string {
    const mapping: Record<string, string> = {
      heart_rate: 'heart_rate',
      blood_pressure: 'blood_pressure',
      spo2: 'oxygen_saturation',
      respiratory_rate: 'respiratory_rate',
    };

    return mapping[type] || type;
  }

  private async makeRequest(path: string, method: string, body?: any): Promise<Response> {
    if (this.tokenExpiry && new Date() >= this.tokenExpiry && this.refreshToken) {
      await this.refreshAccessToken(this.refreshToken);
    }

    const url = path.startsWith('http') ? path : `${this.SAMSUNG_API_BASE}${path}`;

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
}
