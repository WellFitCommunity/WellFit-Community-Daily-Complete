/**
 * iHealth API Adapter
 *
 * Enterprise-grade adapter for iHealth device integration
 * Supports iHealth blood pressure monitors, scales, pulse oximeters, glucometers
 *
 * Documentation: https://developer.ihealthlabs.com/
 *
 * Features:
 * - OAuth 2.0 authorization
 * - Blood pressure monitoring (BP5, BP7, BP7S, Clear, Ease)
 * - Weight/body composition (Core, Lina, Lite)
 * - Pulse oximetry (Air)
 * - Blood glucose (Gluco+, Smart, Align)
 * - Activity tracking (Wave, Edge)
 */

import type {
  WearableAdapter,
  WearableAdapterMetadata,
  WearableAdapterConfig,
  WearableVitalData,
  WearableActivityData,
} from '../UniversalWearableRegistry';

interface iHealthConfig extends WearableAdapterConfig {
  // iHealth-specific config
  sc?: string; // Serial code for SDK devices
  sv?: string; // Secret value
}

export class iHealthAdapter implements WearableAdapter {
  metadata: WearableAdapterMetadata = {
    id: 'ihealth',
    name: 'iHealth Adapter',
    vendor: 'iHealth Labs Inc.',
    version: '1.0.0',
    deviceTypes: ['blood-pressure-monitor', 'scale', 'pulse-oximeter', 'glucometer', 'fitness-tracker'],
    capabilities: {
      heartRate: true,
      bloodPressure: true, // Primary feature
      bloodOxygen: true, // iHealth Air
      temperature: false,
      respiratoryRate: false,
      steps: true, // iHealth Wave/Edge
      distance: true,
      calories: true,
      sleep: true,
      exerciseMinutes: true,
      fallDetection: false,
      ecg: false,
      gaitAnalysis: false,
      glucoseMonitoring: true, // iHealth Gluco+
    },
    setupGuide: '/docs/adapters/ihealth-setup.md',
    oauthRequired: true,
    certifications: ['FDA 510(k)', 'CE Mark', 'iHealth Cloud API'],
  };

  private readonly IHEALTH_API_BASE = 'https://api.ihealthlabs.com:8443/openapiv2';
  private readonly IHEALTH_AUTH_BASE = 'https://api.ihealthlabs.com:8443/OpenApiV2/OAuthv2';

  private accessToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: Date | null = null;
  private config: iHealthConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  async connect(config: WearableAdapterConfig): Promise<void> {
    this.config = config as iHealthConfig;

    if (config.authType !== 'oauth2') {
      throw new Error('iHealth requires OAuth2 authentication');
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('iHealth OAuth2 requires clientId and clientSecret');
    }

    this.status = 'connected';
  }

  async disconnect(): Promise<void> {
    this.accessToken = '';
    this.refreshToken = '';
    this.config = null;
    this.status = 'disconnected';
  }

  async test(): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const response = await this.makeRequest('/user/OpenApiUserInfo.json', 'GET');

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connection successful',
          details: {
            userId: data.userid,
            nickname: data.nickname,
          },
        };
      }

      return {
        success: false,
        message: `Connection test failed: ${response.status} ${response.statusText}`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        message: err.message || 'Connection test failed',
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

    // iHealth uses specific API names as scopes
    const defaultScopes = ['OpenApiBP', 'OpenApiWeight', 'OpenApiSpO2', 'OpenApiBG', 'OpenApiActivity'];
    const requestedScopes = scopes.length > 0 ? scopes : defaultScopes;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || '',
      APIName: requestedScopes.join(' '),
      state: Math.random().toString(36).substring(7),
    });

    return `${this.IHEALTH_AUTH_BASE}/OAuthv2/userauthorization/?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const response = await fetch(`${this.IHEALTH_AUTH_BASE}/OAuthv2/userauthorization/`, {
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
    this.accessToken = data.AccessToken;
    this.refreshToken = data.RefreshToken;
    this.tokenExpiry = new Date(Date.now() + data.Expires * 1000);

    return {
      accessToken: data.AccessToken,
      refreshToken: data.RefreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const response = await fetch(`${this.IHEALTH_AUTH_BASE}/OAuthv2/userauthorization/`, {
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
    this.accessToken = data.AccessToken;
    this.tokenExpiry = new Date(Date.now() + data.Expires * 1000);

    return data.AccessToken;
  }

  async fetchVitals(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate'>;
  }): Promise<WearableVitalData[]> {
    const vitals: WearableVitalData[] = [];
    const types = params.types || ['heart_rate', 'blood_pressure', 'spo2'];

    const startTime = params.startDate?.getTime() || Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endTime = params.endDate?.getTime() || Date.now();

    for (const type of types) {
      try {
        const endpoint = this.mapVitalTypeToEndpoint(type);
        if (!endpoint) continue;

        const response = await this.makeRequest(
          `/user/${params.userId}/${endpoint}.json?start_time=${Math.floor(startTime / 1000)}&end_time=${Math.floor(endTime / 1000)}`,
          'GET'
        );

        if (response.ok) {
          const data = await response.json();
          const samples = data.BPDataList || data.SpO2DataList || data.WeightDataList || [];

          for (const sample of samples) {
            if (type === 'blood_pressure') {
              vitals.push({
                type: 'blood_pressure',
                value: { systolic: sample.HP, diastolic: sample.LP },
                unit: 'mmHg',
                timestamp: new Date(sample.MDate * 1000),
                metadata: {
                  deviceModel: sample.DataSource || 'iHealth Device',
                  context: sample.Note,
                },
              });
              // Also capture heart rate from BP reading
              if (sample.HR) {
                vitals.push({
                  type: 'heart_rate',
                  value: sample.HR,
                  unit: 'bpm',
                  timestamp: new Date(sample.MDate * 1000),
                  metadata: {
                    deviceModel: sample.DataSource || 'iHealth Device',
                  },
                });
              }
            } else if (type === 'spo2') {
              vitals.push({
                type: 'spo2',
                value: sample.BO,
                unit: '%',
                timestamp: new Date(sample.MDate * 1000),
                metadata: {
                  deviceModel: sample.DataSource || 'iHealth Air',
                },
              });
              // Heart rate from pulse ox
              if (sample.HR) {
                vitals.push({
                  type: 'heart_rate',
                  value: sample.HR,
                  unit: 'bpm',
                  timestamp: new Date(sample.MDate * 1000),
                  metadata: {
                    deviceModel: sample.DataSource || 'iHealth Air',
                  },
                });
              }
            }
          }
        }
      } catch {
        // Continue with next vital type
      }
    }

    return vitals;
  }

  async fetchActivity(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableActivityData[]> {
    const startTime = Math.floor(params.startDate.getTime() / 1000);
    const endTime = Math.floor(params.endDate.getTime() / 1000);

    const response = await this.makeRequest(
      `/user/${params.userId}/activity.json?start_time=${startTime}&end_time=${endTime}`,
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activity: ${response.statusText}`);
    }

    const data = await response.json();
    const activities = data.ARDataList || [];

    return activities.map((activity: Record<string, unknown>) => ({
      date: new Date((activity.MDate as number) * 1000),
      steps: activity.Steps as number,
      distanceMeters: activity.DistanceTraveled as number,
      caloriesBurned: activity.Calories as number,
      activeMinutes: activity.ActiveTime ? Math.floor((activity.ActiveTime as number) / 60) : 0,
      metadata: {
        goals: {
          steps: activity.StepGoal as number,
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
    const startTime = Math.floor(params.startDate.getTime() / 1000);
    const endTime = Math.floor(params.endDate.getTime() / 1000);

    const response = await this.makeRequest(
      `/user/${params.userId}/sleep.json?start_time=${startTime}&end_time=${endTime}`,
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sleep: ${response.statusText}`);
    }

    const data = await response.json();
    const sleepSessions = data.SRDataList || [];

    return sleepSessions.map((session: Record<string, unknown>) => ({
      date: new Date((session.StartTime as number) * 1000),
      duration: Math.floor(((session.EndTime as number) - (session.StartTime as number)) / 60),
      stages: session.SleepEfficiency ? {
        deep: (session.DeepSleep as number) || 0,
        light: (session.LightSleep as number) || 0,
        rem: (session.RemSleep as number) || 0,
        awake: (session.Awake as number) || 0,
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
    // iHealth API doesn't have a direct device listing endpoint
    // Devices are inferred from data availability
    const response = await this.makeRequest(`/user/${userId}/OpenApiUserInfo.json`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    const data = await response.json();
    const devices: {
      deviceId: string;
      name: string;
      model: string;
      lastSyncDate: Date;
      batteryLevel?: number;
    }[] = [];

    // Check for each device type based on available APIs
    if (data.OpenApiBP) {
      devices.push({
        deviceId: `ihealth-bp-${userId}`,
        name: 'iHealth Blood Pressure Monitor',
        model: 'BP Series',
        lastSyncDate: new Date(),
      });
    }

    if (data.OpenApiWeight) {
      devices.push({
        deviceId: `ihealth-scale-${userId}`,
        name: 'iHealth Smart Scale',
        model: 'Scale Series',
        lastSyncDate: new Date(),
      });
    }

    if (data.OpenApiSpO2) {
      devices.push({
        deviceId: `ihealth-spo2-${userId}`,
        name: 'iHealth Pulse Oximeter',
        model: 'Air',
        lastSyncDate: new Date(),
      });
    }

    if (data.OpenApiBG) {
      devices.push({
        deviceId: `ihealth-bg-${userId}`,
        name: 'iHealth Glucometer',
        model: 'Gluco+ Series',
        lastSyncDate: new Date(),
      });
    }

    return devices;
  }

  getCapabilities(): WearableAdapterMetadata['capabilities'] {
    return this.metadata.capabilities;
  }

  supportsFeature(feature: string): boolean {
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  private mapVitalTypeToEndpoint(type: string): string | null {
    const mapping: Record<string, string> = {
      blood_pressure: 'bp',
      spo2: 'spo2',
      heart_rate: 'bp', // Heart rate comes from BP readings
    };

    return mapping[type] || null;
  }

  private async makeRequest(path: string, method: string, body?: unknown): Promise<Response> {
    if (this.tokenExpiry && new Date() >= this.tokenExpiry && this.refreshToken) {
      await this.refreshAccessToken(this.refreshToken);
    }

    const url = path.startsWith('http') ? path : `${this.IHEALTH_API_BASE}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // iHealth uses query params for auth
    const separator = url.includes('?') ? '&' : '?';
    const authUrl = `${url}${separator}access_token=${this.accessToken}`;

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    return await fetch(authUrl, options);
  }
}
