/**
 * Fitbit Adapter
 *
 * Enterprise-grade adapter for Fitbit wearable devices
 * Supports all Fitbit devices: Charge, Versa, Sense, Inspire, etc.
 *
 * Documentation: https://dev.fitbit.com/build/reference/web-api/
 * OAuth2 Guide: https://dev.fitbit.com/build/reference/web-api/authorization/
 *
 * Features:
 * - OAuth 2.0 authorization
 * - Real-time data sync via Fitbit API
 * - Heart rate zones and variability
 * - Sleep stages (light, deep, REM, awake)
 * - Activity tracking and goals
 * - Intraday time series data
 * - Rate limiting compliance (150 req/hour per user)
 */

import type {
  WearableAdapter,
  WearableAdapterMetadata,
  WearableAdapterConfig,
  WearableVitalData,
  WearableActivityData,
} from '../UniversalWearableRegistry';

interface FitbitConfig extends WearableAdapterConfig {
  // Fitbit-specific configuration
  intradayEnabled?: boolean; // Requires special Fitbit approval
  subscriptionsEnabled?: boolean; // Webhook subscriptions
}

/** API response types for Fitbit endpoints */
interface FitbitDistanceRecord {
  activity: string;
  distance: number;
}

interface FitbitDevice {
  id: string;
  deviceVersion: string;
  lastSyncTime: string;
  batteryLevel: 'High' | 'Medium' | 'Low' | string;
}

export class FitbitAdapter implements WearableAdapter {
  metadata: WearableAdapterMetadata = {
    id: 'fitbit',
    name: 'Fitbit Adapter',
    vendor: 'Fitbit (Google)',
    version: '1.0.0',
    deviceTypes: ['smartwatch', 'fitness-band'],
    capabilities: {
      heartRate: true,
      bloodPressure: false, // Fitbit doesn't track BP natively
      bloodOxygen: true, // Fitbit Sense, Versa 3+
      temperature: true, // Fitbit Sense
      respiratoryRate: true, // Estimated from heart rate variability
      steps: true,
      distance: true,
      calories: true,
      sleep: true,
      exerciseMinutes: true,
      fallDetection: false,
      ecg: true, // Fitbit Sense
      gaitAnalysis: false,
      glucoseMonitoring: false,
    },
    setupGuide: '/docs/adapters/fitbit-setup.md',
    oauthRequired: true,
    certifications: ['Fitbit Web API'],
  };

  // Fitbit API endpoints
  private readonly FITBIT_API_BASE = 'https://api.fitbit.com';
  private readonly FITBIT_AUTH_BASE = 'https://www.fitbit.com/oauth2';

  private accessToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: Date | null = null;
  private config: FitbitConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  private userId: string = ''; // Fitbit user ID

  // Rate limiting (150 requests per hour per user)
  private requestCount: number = 0;
  private requestWindowStart: Date = new Date();
  private readonly MAX_REQUESTS_PER_HOUR = 150;

  async connect(config: WearableAdapterConfig): Promise<void> {
    this.config = config as FitbitConfig;

    if (config.authType !== 'oauth2') {
      throw new Error('Fitbit requires OAuth2 authentication');
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Fitbit OAuth2 requires clientId and clientSecret');
    }

    this.status = 'connected';
  }

  async disconnect(): Promise<void> {
    // Revoke tokens
    if (this.accessToken && this.config?.clientId && this.config?.clientSecret) {
      try {
        const authHeader = 'Basic ' + btoa(`${this.config.clientId}:${this.config.clientSecret}`);

        await fetch(`${this.FITBIT_AUTH_BASE}/revoke`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: this.accessToken,
          }),
        });
      } catch (error) {
        // Token revocation failed - connection will still be terminated
      }
    }

    this.accessToken = '';
    this.refreshToken = '';
    this.userId = '';
    this.config = null;
    this.status = 'disconnected';
  }

  async test(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      // Test by fetching user profile
      const response = await this.makeRequest('/1/user/-/profile.json', 'GET');

      if (response.ok) {
        const data = await response.json() as { user: { encodedId: string; displayName?: string; memberSince?: string; devices?: unknown[] } };
        this.userId = data.user.encodedId;

        return {
          success: true,
          message: 'Connection successful',
          details: {
            userId: data.user.encodedId,
            displayName: data.user.displayName,
            memberSince: data.user.memberSince,
            devices: data.user.devices || [],
          },
        };
      }

      return {
        success: false,
        message: `Connection test failed: ${response.status} ${response.statusText}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return {
        success: false,
        message,
      };
    }
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  // OAuth2 Implementation
  getAuthorizationUrl(scopes: string[]): string {
    if (!this.config?.clientId) {
      throw new Error('Client ID not configured');
    }

    const defaultScopes = ['activity', 'heartrate', 'sleep', 'profile', 'oxygen_saturation', 'temperature', 'respiratory_rate'];
    const requestedScopes = scopes.length > 0 ? scopes : defaultScopes;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri || '',
      scope: requestedScopes.join(' '),
      expires_in: '31536000', // 1 year
    });

    return `${this.FITBIT_AUTH_BASE}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const authHeader = 'Basic ' + btoa(`${this.config.clientId}:${this.config.clientSecret}`);

    const response = await fetch(`${this.FITBIT_AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri || '',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.userId = data.user_id;

    // Fitbit tokens expire in seconds
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

    const authHeader = 'Basic ' + btoa(`${this.config.clientId}:${this.config.clientSecret}`);

    const response = await fetch(`${this.FITBIT_AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

    

    return data.access_token;
  }

  // Data Fetching Methods
  async fetchVitals(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate'>;
  }): Promise<WearableVitalData[]> {
    const vitals: WearableVitalData[] = [];
    const types = params.types || ['heart_rate', 'spo2', 'temperature', 'respiratory_rate'];

    const startDate = params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate || new Date();

    for (const type of types) {
      if (type === 'heart_rate') {
        const data = await this.fetchHeartRate(startDate, endDate);
        vitals.push(...data);
      } else if (type === 'spo2') {
        const data = await this.fetchSpO2(startDate, endDate);
        vitals.push(...data);
      } else if (type === 'temperature') {
        const data = await this.fetchTemperature(startDate, endDate);
        vitals.push(...data);
      } else if (type === 'respiratory_rate') {
        const data = await this.fetchRespiratoryRate(startDate, endDate);
        vitals.push(...data);
      }
    }

    return vitals;
  }

  private async fetchHeartRate(startDate: Date, endDate: Date): Promise<WearableVitalData[]> {
    const dateString = this.formatDate(endDate);
    const response = await this.makeRequest(`/1/user/-/activities/heart/date/${dateString}/1d.json`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch heart rate: ${response.statusText}`);
    }

    const data = await response.json();
    const vitals: WearableVitalData[] = [];

    // Resting heart rate
    if (data['activities-heart']?.[0]?.value?.restingHeartRate) {
      vitals.push({
        type: 'heart_rate',
        value: data['activities-heart'][0].value.restingHeartRate,
        unit: 'bpm',
        timestamp: new Date(data['activities-heart'][0].dateTime),
        metadata: {
          context: 'resting',
          deviceModel: 'Fitbit',
        },
      });
    }

    return vitals;
  }

  private async fetchSpO2(startDate: Date, endDate: Date): Promise<WearableVitalData[]> {
    const dateString = this.formatDate(endDate);
    const response = await this.makeRequest(`/1/user/-/spo2/date/${dateString}.json`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch SpO2: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.value) {
      return [{
        type: 'spo2',
        value: data.value.avg,
        unit: '%',
        timestamp: new Date(data.dateTime),
        metadata: {
          deviceModel: 'Fitbit',
        },
      }];
    }

    return [];
  }

  private async fetchTemperature(startDate: Date, endDate: Date): Promise<WearableVitalData[]> {
    const dateString = this.formatDate(endDate);
    const response = await this.makeRequest(`/1/user/-/temp/core/date/${dateString}.json`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch temperature: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.tempCore?.[0]?.value?.nightlyRelative) {
      return [{
        type: 'temperature',
        value: data.tempCore[0].value.nightlyRelative,
        unit: 'F',
        timestamp: new Date(data.tempCore[0].dateTime),
        metadata: {
          context: 'sleeping',
          deviceModel: 'Fitbit',
        },
      }];
    }

    return [];
  }

  private async fetchRespiratoryRate(startDate: Date, endDate: Date): Promise<WearableVitalData[]> {
    const dateString = this.formatDate(endDate);
    const response = await this.makeRequest(`/1/user/-/br/date/${dateString}.json`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch respiratory rate: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.br?.[0]?.value?.breathingRate) {
      return [{
        type: 'respiratory_rate',
        value: data.br[0].value.breathingRate,
        unit: 'breaths/min',
        timestamp: new Date(data.br[0].dateTime),
        metadata: {
          deviceModel: 'Fitbit',
        },
      }];
    }

    return [];
  }

  async fetchActivity(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableActivityData[]> {
    const activities: WearableActivityData[] = [];

    const currentDate = new Date(params.startDate);
    while (currentDate <= params.endDate) {
      const dateString = this.formatDate(currentDate);
      const response = await this.makeRequest(`/1/user/-/activities/date/${dateString}.json`, 'GET');

      if (response.ok) {
        const data = await response.json();
        const summary = data.summary;

        activities.push({
          date: new Date(currentDate),
          steps: summary.steps,
          distanceMeters: ((summary.distances as FitbitDistanceRecord[] | undefined)?.find((d: FitbitDistanceRecord) => d.activity === 'total')?.distance ?? 0) * 1000,
          caloriesBurned: summary.caloriesOut,
          activeMinutes: summary.fairlyActiveMinutes + summary.veryActiveMinutes,
          metadata: {
            goals: {
              steps: summary.goals?.steps,
              activeMinutes: summary.goals?.activeMinutes,
            },
          },
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return activities;
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
    const sleepData: { date: Date; duration: number; stages?: { deep: number; light: number; rem: number; awake: number } }[] = [];

    const dateString = this.formatDate(params.endDate);
    const response = await this.makeRequest(`/1.2/user/-/sleep/date/${dateString}.json`, 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch sleep: ${response.statusText}`);
    }

    const data = await response.json();

    for (const sleep of data.sleep || []) {
      const stages = sleep.levels?.summary;

      sleepData.push({
        date: new Date(sleep.dateOfSleep),
        duration: sleep.duration / 60000, // Convert ms to minutes
        stages: stages ? {
          deep: stages.deep?.minutes || 0,
          light: stages.light?.minutes || 0,
          rem: stages.rem?.minutes || 0,
          awake: stages.wake?.minutes || 0,
        } : undefined,
      });
    }

    return sleepData;
  }

  async listConnectedDevices(_userId: string): Promise<{
    deviceId: string;
    name: string;
    model: string;
    lastSyncDate: Date;
    batteryLevel?: number;
  }[]> {
    const response = await this.makeRequest('/1/user/-/devices.json', 'GET');

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }

    const data = await response.json() as FitbitDevice[];

    return data.map((device: FitbitDevice) => ({
      deviceId: device.id,
      name: device.deviceVersion,
      model: device.deviceVersion,
      lastSyncDate: new Date(device.lastSyncTime),
      batteryLevel: device.batteryLevel === 'High' ? 80 : device.batteryLevel === 'Medium' ? 50 : 20,
    }));
  }

  getCapabilities(): WearableAdapterMetadata['capabilities'] {
    return this.metadata.capabilities;
  }

  supportsFeature(feature: string): boolean {
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  // Helper Methods
  private async makeRequest(path: string, method: string, body?: Record<string, unknown>): Promise<Response> {
    // Rate limiting check
    this.checkRateLimit();

    // Check if token needs refresh
    if (this.tokenExpiry && new Date() >= this.tokenExpiry && this.refreshToken) {
      await this.refreshAccessToken(this.refreshToken);
    }

    const url = path.startsWith('http') ? path : `${this.FITBIT_API_BASE}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    this.requestCount++;
    return await fetch(url, options);
  }

  private checkRateLimit(): void {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (this.requestWindowStart < hourAgo) {
      // Reset window
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
      throw new Error(`Rate limit exceeded: ${this.MAX_REQUESTS_PER_HOUR} requests per hour`);
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
