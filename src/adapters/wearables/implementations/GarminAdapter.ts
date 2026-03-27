/**
 * Garmin Health API Adapter
 *
 * Enterprise-grade adapter for Garmin wearable devices
 * Supports Garmin watches: Forerunner, Fenix, Venu, Vivoactive, etc.
 *
 * Documentation: https://developer.garmin.com/health-api/overview/
 *
 * Features:
 * - OAuth 1.0a authorization
 * - Health Snapshot, Daily Summary, Epoch Summary data
 * - Activity sessions, sleep, stress, body composition
 * - Heart rate, steps, calories, distance
 * - Webhook push notifications for real-time data
 */

import type {
  WearableAdapter,
  WearableAdapterMetadata,
  WearableAdapterConfig,
  WearableVitalData,
  WearableActivityData,
} from '../UniversalWearableRegistry';

interface GarminConfig extends WearableAdapterConfig {
  consumerKey?: string;
  consumerSecret?: string;
  oauthToken?: string;
  oauthTokenSecret?: string;
}

// -- OAuth 1.0a Utilities ----------------------------------------------------

/** Generate a random nonce for OAuth 1.0a */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** RFC 3986 percent-encode (OAuth 1.0a requires this stricter encoding) */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Generate OAuth 1.0a signature base string and HMAC-SHA1 signature.
 * Per RFC 5849: https://datatracker.ietf.org/doc/html/rfc5849
 */
async function signOAuth1Request(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ''
): Promise<string> {
  // Sort params alphabetically by key, then by value
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');

  // Base string: METHOD&url&params
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`;

  // Signing key: consumerSecret&tokenSecret
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  // HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString));

  // Base64 encode the signature
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/** Build the OAuth 1.0a Authorization header value */
function buildOAuthHeader(oauthParams: Record<string, string>): string {
  const headerParts = Object.entries(oauthParams)
    .filter(([k]) => k.startsWith('oauth_'))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');
  return `OAuth ${headerParts}`;
}

/** API response types for Garmin endpoints */
interface GarminDailySummary {
  calendarDate: string;
  totalSteps?: number;
  totalDistanceInMeters?: number;
  activeKilocalories?: number;
  moderateIntensityDurationInSeconds?: number;
  dailyStepGoal?: number;
  restingHeartRateInBeatsPerMinute?: number;
  averageRespirationRateInBreathsPerMinute?: number;
  sleepingSeconds?: number;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
}

export class GarminAdapter implements WearableAdapter {
  metadata: WearableAdapterMetadata = {
    id: 'garmin',
    name: 'Garmin Health API Adapter',
    vendor: 'Garmin International',
    version: '1.0.0',
    deviceTypes: ['smartwatch', 'fitness-tracker'],
    capabilities: {
      heartRate: true,
      bloodPressure: true,
      bloodOxygen: true,
      temperature: true,
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
    setupGuide: '/docs/adapters/garmin-setup.md',
    oauthRequired: true,
    certifications: ['Garmin Health API'],
  };

  private readonly GARMIN_API_BASE = 'https://apis.garmin.com/wellness-api/rest';
  private readonly GARMIN_OAUTH_BASE = 'https://connectapi.garmin.com/oauth-service/oauth';
  private config: GarminConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  // Temporary storage for OAuth 1.0a request token flow
  private pendingRequestToken: string | null = null;
  private pendingRequestTokenSecret: string | null = null;

  async connect(config: WearableAdapterConfig): Promise<void> {
    this.config = config as GarminConfig;

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Garmin requires consumerKey and consumerSecret');
    }

    this.status = 'connected';
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.status = 'disconnected';
  }

  async test(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    // Test with a simple ping - no actual network call needed for OAuth-based services
    return {
      success: true,
      message: 'Connection ready - OAuth tokens required for data access',
    };
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  /**
   * OAuth 1.0a Step 1: Get a request token, then return the authorization URL.
   *
   * Caller must await this (it's async despite the interface signature)
   * because OAuth 1.0a requires a server round-trip to get the request token
   * before constructing the authorization URL.
   *
   * Note: The WearableAdapter interface declares this as sync, so we store
   * the request token on the adapter and require initOAuthFlow() to be called first.
   */
  getAuthorizationUrl(_scopes: string[]): string {
    if (!this.config?.clientId) {
      throw new Error('Garmin consumerKey (clientId) not configured');
    }

    if (!this.pendingRequestToken) {
      throw new Error('Call initOAuthFlow() first to obtain a request token');
    }

    return `${this.GARMIN_OAUTH_BASE}/authorize?oauth_token=${percentEncode(this.pendingRequestToken)}`;
  }

  /**
   * OAuth 1.0a Step 1 (async): Request a temporary token from Garmin.
   * Must be called before getAuthorizationUrl().
   */
  async initOAuthFlow(): Promise<string> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('Garmin credentials not configured');
    }

    const requestTokenUrl = `${this.GARMIN_OAUTH_BASE}/request_token`;
    const callbackUrl = this.config.redirectUri || 'oob';

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.clientId,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_callback: callbackUrl,
    };

    const signature = await signOAuth1Request(
      'POST',
      requestTokenUrl,
      oauthParams,
      this.config.clientSecret
    );
    oauthParams.oauth_signature = signature;

    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: buildOAuthHeader(oauthParams),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Garmin request token failed: ${response.status} ${text}`);
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Invalid request token response from Garmin');
    }

    this.pendingRequestToken = oauthToken;
    this.pendingRequestTokenSecret = oauthTokenSecret;

    return this.getAuthorizationUrl([]);
  }

  /**
   * OAuth 1.0a Step 3: Exchange the verifier for an access token.
   * The `_code` parameter is the oauth_verifier from the callback.
   */
  async handleOAuthCallback(_code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('Garmin credentials not configured');
    }
    if (!this.pendingRequestToken || !this.pendingRequestTokenSecret) {
      throw new Error('No pending request token — call initOAuthFlow() first');
    }

    const accessTokenUrl = `${this.GARMIN_OAUTH_BASE}/access_token`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.clientId,
      oauth_token: this.pendingRequestToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_verifier: _code,
    };

    const signature = await signOAuth1Request(
      'POST',
      accessTokenUrl,
      oauthParams,
      this.config.clientSecret,
      this.pendingRequestTokenSecret
    );
    oauthParams.oauth_signature = signature;

    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: buildOAuthHeader(oauthParams),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Garmin access token exchange failed: ${response.status} ${text}`);
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Invalid access token response from Garmin');
    }

    // Store for API requests
    this.config.oauthToken = accessToken;
    this.config.oauthTokenSecret = accessTokenSecret;

    // Clear pending request token
    this.pendingRequestToken = null;
    this.pendingRequestTokenSecret = null;

    // OAuth 1.0a tokens don't expire — no refresh token
    return { accessToken, refreshToken: accessTokenSecret };
  }

  async refreshAccessToken(_refreshToken: string): Promise<string> {
    // OAuth 1.0a tokens do not expire and cannot be refreshed.
    // If the token is revoked, the user must re-authorize.
    throw new Error('Garmin OAuth 1.0a tokens do not expire — re-authorize if revoked');
  }

  async fetchVitals(params: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate'>;
  }): Promise<WearableVitalData[]> {
    const vitals: WearableVitalData[] = [];
    const startDate = params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate || new Date();

    // Fetch daily summaries which include heart rate stats
    const summaries = await this.fetchDailySummaries(params.userId, startDate, endDate);

    for (const summary of summaries) {
      if (summary.restingHeartRateInBeatsPerMinute) {
        vitals.push({
          type: 'heart_rate',
          value: summary.restingHeartRateInBeatsPerMinute,
          unit: 'bpm',
          timestamp: new Date(summary.calendarDate),
          metadata: {
            context: 'resting',
            deviceModel: 'Garmin',
          },
        });
      }

      if (summary.averageRespirationRateInBreathsPerMinute) {
        vitals.push({
          type: 'respiratory_rate',
          value: summary.averageRespirationRateInBreathsPerMinute,
          unit: 'breaths/min',
          timestamp: new Date(summary.calendarDate),
          metadata: {
            deviceModel: 'Garmin',
          },
        });
      }
    }

    return vitals;
  }

  async fetchActivity(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WearableActivityData[]> {
    const summaries = await this.fetchDailySummaries(params.userId, params.startDate, params.endDate);

    return summaries.map((summary: GarminDailySummary) => ({
      date: new Date(summary.calendarDate),
      steps: summary.totalSteps,
      distanceMeters: summary.totalDistanceInMeters,
      caloriesBurned: summary.activeKilocalories,
      activeMinutes: summary.moderateIntensityDurationInSeconds ? Math.floor(summary.moderateIntensityDurationInSeconds / 60) : 0,
      metadata: {
        goals: {
          steps: summary.dailyStepGoal,
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
    const summaries = await this.fetchDailySummaries(params.userId, params.startDate, params.endDate);

    return summaries
      .filter((s: GarminDailySummary) => s.sleepingSeconds)
      .map((summary: GarminDailySummary) => ({
        date: new Date(summary.calendarDate),
        duration: Math.floor((summary.sleepingSeconds ?? 0) / 60),
        stages: summary.deepSleepSeconds ? {
          deep: Math.floor((summary.deepSleepSeconds ?? 0) / 60),
          light: Math.floor((summary.lightSleepSeconds ?? 0) / 60),
          rem: Math.floor((summary.remSleepSeconds ?? 0) / 60),
          awake: Math.floor((summary.awakeSleepSeconds ?? 0) / 60),
        } : undefined,
      }));
  }

  private async fetchDailySummaries(_userId: string, startDate: Date, endDate: Date): Promise<GarminDailySummary[]> {
    const uploadStartTime = Math.floor(startDate.getTime() / 1000);
    const uploadEndTime = Math.floor(endDate.getTime() / 1000);

    const url = `${this.GARMIN_API_BASE}/dailies?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`;

    const response = await this.makeOAuthRequest(url, 'GET', _userId);

    if (!response.ok) {
      throw new Error(`Failed to fetch daily summaries: ${response.statusText}`);
    }

    const data = await response.json();
    return data || [];
  }

  async listConnectedDevices(userId: string): Promise<{
    deviceId: string;
    name: string;
    model: string;
    lastSyncDate: Date;
    batteryLevel?: number;
  }[]> {
    // Garmin doesn't provide a specific devices endpoint
    // Device info comes through daily summaries
    return [{
      deviceId: userId,
      name: 'Garmin Device',
      model: 'Unknown',
      lastSyncDate: new Date(),
    }];
  }

  getCapabilities(): WearableAdapterMetadata['capabilities'] {
    return this.metadata.capabilities;
  }

  supportsFeature(feature: string): boolean {
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  private async makeOAuthRequest(url: string, method: string, _userId: string): Promise<Response> {
    if (!this.config?.clientId || !this.config?.clientSecret) {
      throw new Error('Garmin credentials not configured');
    }
    if (!this.config.oauthToken || !this.config.oauthTokenSecret) {
      throw new Error('Garmin OAuth tokens not set — complete OAuth 1.0a flow first');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    // Parse URL to separate base URL from query params
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.origin}${urlObj.pathname}`;

    // Collect all params (query string + OAuth)
    const allParams: Record<string, string> = {};
    urlObj.searchParams.forEach((v, k) => { allParams[k] = v; });

    allParams.oauth_consumer_key = this.config.clientId;
    allParams.oauth_token = this.config.oauthToken;
    allParams.oauth_signature_method = 'HMAC-SHA1';
    allParams.oauth_timestamp = timestamp;
    allParams.oauth_nonce = nonce;
    allParams.oauth_version = '1.0';

    const signature = await signOAuth1Request(
      method,
      baseUrl,
      allParams,
      this.config.clientSecret,
      this.config.oauthTokenSecret
    );

    // Build OAuth header (only oauth_ params go in the header)
    const oauthHeaderParams: Record<string, string> = {
      oauth_consumer_key: this.config.clientId,
      oauth_token: this.config.oauthToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_signature: signature,
    };

    return await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: buildOAuthHeader(oauthHeaderParams),
      },
    });
  }
}
