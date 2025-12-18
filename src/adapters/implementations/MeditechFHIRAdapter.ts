/**
 * Meditech FHIR R4 Adapter
 *
 * Enterprise adapter for Meditech EHR systems (Expanse platform)
 * Supports Meditech Greenfield API integration
 *
 * Meditech Documentation: https://home.meditech.com/en-us/community/greenfield
 * Expanse Platform: FHIR R4 support since Meditech Expanse 8.0+
 *
 * Features:
 * - Meditech Expanse FHIR API support
 * - Greenfield integration framework
 * - OAuth 2.0 with custom Meditech authentication
 * - Meditech-specific resource extensions
 * - Legacy MAGIC/Client Server bridge support (limited)
 * - Community hospital optimizations
 */

import type { EHRAdapter, AdapterMetadata, AdapterConfig } from '../UniversalAdapterRegistry';

// FHIR R4 Type Definitions
interface FHIRBundle {
  resourceType: 'Bundle';
  entry?: Array<{
    resource: FHIRResource;
  }>;
  [key: string]: unknown;
}

interface FHIRResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

interface FHIRCapabilityStatement extends FHIRResource {
  resourceType: 'CapabilityStatement';
  software?: {
    name?: string;
    version?: string;
  };
  fhirVersion?: string;
  publisher?: string;
  implementation?: {
    description?: string;
  };
  [key: string]: unknown;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface FHIROperationOutcome extends FHIRResource {
  resourceType: 'OperationOutcome';
  issue?: Array<{
    diagnostics?: string;
    details?: {
      text?: string;
    };
  }>;
}

interface MeditechConfig extends AdapterConfig {
  // Meditech-specific configuration
  platform: 'expanse' | 'magic' | 'client-server'; // Meditech platform version
  environment: 'production' | 'test' | 'training'; // Meditech environment
  facilityId?: string; // Meditech facility identifier
  enableLegacyBridge?: boolean; // Enable legacy system bridge
  expandseVersion?: string; // Expanse version (e.g., "8.0", "8.2")
}

export class MeditechFHIRAdapter implements EHRAdapter {
  metadata: AdapterMetadata = {
    id: 'meditech-fhir',
    name: 'Meditech Expanse FHIR R4 Adapter',
    vendor: 'Meditech Inc.',
    version: '2.0.0',
    protocols: ['fhir-r4'],
    capabilities: {
      patients: true,
      encounters: true,
      observations: true,
      medications: true,
      allergies: true,
      immunizations: true,
      conditions: true,
      procedures: true,
      carePlans: true,
      documentReference: true,
    },
    setupGuide: '/docs/adapters/meditech-setup.md',
    certifications: ['Meditech Greenfield Partner'],
  };

  private baseUrl: string = '';
  private authUrl: string = '';
  private authToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: Date | null = null;
  private config: MeditechConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  // Rate limiting (Meditech: typically 500-1000/hour depending on facility)
  private requestCount: number = 0;
  private requestWindowStart: Date = new Date();
  private readonly MAX_REQUESTS_PER_HOUR = 500; // Conservative default

  async connect(config: AdapterConfig): Promise<void> {
    this.config = config as MeditechConfig;

    // Validate platform
    if (!this.config.platform) {
      throw new Error('Meditech platform must be specified (expanse, magic, or client-server)');
    }

    // FHIR is only fully supported on Expanse 8.0+
    if (this.config.platform !== 'expanse') {

    }

    this.baseUrl = config.endpoint?.replace(/\/$/, '') || '';
    if (!this.baseUrl) {
      throw new Error('Meditech FHIR endpoint URL is required');
    }

    // Meditech auth endpoint is typically <base>/oauth2
    this.authUrl = `${this.baseUrl}/oauth2`;

    // Authenticate
    await this.authenticate(this.config);

    this.status = 'connected';

  }

  async test(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const response = await this.fetchFHIR('/metadata') as FHIRCapabilityStatement;

      if (response.resourceType === 'CapabilityStatement') {
        // Validate it's Meditech
        const isMeditech = response.software?.name?.toLowerCase().includes('meditech') ||
                          response.publisher?.toLowerCase().includes('meditech') ||
                          response.implementation?.description?.toLowerCase().includes('meditech');

        if (!isMeditech) {
          return {
            success: false,
            message: 'Connected server does not appear to be Meditech FHIR',
          };
        }

        return {
          success: true,
          message: 'Meditech connection successful',
          details: {
            software: response.software,
            fhirVersion: response.fhirVersion,
            publisher: response.publisher,
            platform: this.detectPlatform(response),
            expanseVersion: this.config?.expandseVersion || 'Unknown',
          },
        };
      }

      return { success: false, message: 'Invalid FHIR response' };
    } catch (error: unknown) {
      this.status = 'error';
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, message };
    }
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    this.authToken = '';
    this.refreshToken = '';
    this.tokenExpiry = null;

  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  // ========================================================================
  // FHIR READ OPERATIONS (Meditech-optimized)
  // ========================================================================

  async fetchPatients(params?: {
    ids?: string[];
    lastModified?: Date;
    limit?: number;
    offset?: number;
  }): Promise<FHIRResource[]> {
    const searchParams = new URLSearchParams();

    if (params?.ids?.length) {
      searchParams.set('_id', params.ids.join(','));
    }
    if (params?.lastModified) {
      // Meditech Expanse supports _lastUpdated
      searchParams.set('_lastUpdated', `gt${params.lastModified.toISOString()}`);
    }
    if (params?.limit) {
      // Meditech typically limits to 20-50 per page
      searchParams.set('_count', Math.min(params.limit, 20).toString());
    }

    // Meditech-specific: Include facility identifier if configured
    if (this.config?.facilityId) {
      searchParams.set('_facility', this.config.facilityId);
    }

    const bundle = await this.fetchFHIR(`/Patient?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchPatient(id: string): Promise<FHIRResource> {
    return await this.fetchFHIR(`/Patient/${id}`);
  }

  async fetchEncounters(patientId: string, params?: { since?: Date }): Promise<FHIRResource[]> {
    const searchParams = new URLSearchParams({
      patient: patientId,
      _sort: '-date',
      _count: '20',
    });

    if (params?.since) {
      searchParams.set('date', `ge${params.since.toISOString()}`);
    }

    const bundle = await this.fetchFHIR(`/Encounter?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchObservations(
    patientId: string,
    params?: { category?: string; since?: Date }
  ): Promise<FHIRResource[]> {
    const searchParams = new URLSearchParams({
      patient: patientId,
      _sort: '-date',
      _count: '20',
    });

    if (params?.category) {
      // Meditech supports: vital-signs, laboratory, social-history
      searchParams.set('category', params.category);
    }
    if (params?.since) {
      searchParams.set('date', `ge${params.since.toISOString()}`);
    }

    const bundle = await this.fetchFHIR(`/Observation?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchMedications(patientId: string): Promise<FHIRResource[]> {
    // Meditech Expanse uses MedicationRequest
    const bundle = await this.fetchFHIR(
      `/MedicationRequest?patient=${patientId}&status=active&_count=20`
    );
    return this.extractResources(bundle);
  }

  async fetchConditions(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/Condition?patient=${patientId}&clinical-status=active&_count=20`
    );
    return this.extractResources(bundle);
  }

  async fetchAllergies(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/AllergyIntolerance?patient=${patientId}&clinical-status=active`
    );
    return this.extractResources(bundle);
  }

  async fetchImmunizations(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/Immunization?patient=${patientId}&_count=20&_sort=-date`
    );
    return this.extractResources(bundle);
  }

  async fetchProcedures(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/Procedure?patient=${patientId}&_count=20&_sort=-date`
    );
    return this.extractResources(bundle);
  }

  async fetchCarePlans(patientId: string): Promise<FHIRResource[]> {
    // Meditech CarePlan support varies by version
    try {
      const bundle = await this.fetchFHIR(
        `/CarePlan?patient=${patientId}&status=active&_count=20`
      );
      return this.extractResources(bundle);
    } catch {
      // CarePlan not supported in this version
      return [];
    }
  }

  /**
   * Meditech-specific: Fetch lab results (DiagnosticReport)
   */
  async fetchLabResults(patientId: string, params?: { since?: Date }): Promise<FHIRResource[]> {
    const searchParams = new URLSearchParams({
      patient: patientId,
      category: 'LAB',
      _count: '20',
    });

    if (params?.since) {
      searchParams.set('date', `ge${params.since.toISOString()}`);
    }

    try {
      const bundle = await this.fetchFHIR(`/DiagnosticReport?${searchParams}`);
      return this.extractResources(bundle);
    } catch {
      // DiagnosticReport not supported
      return [];
    }
  }

  async getCapabilities(): Promise<FHIRCapabilityStatement> {
    return await this.fetchFHIR('/metadata') as FHIRCapabilityStatement;
  }

  supportsFeature(feature: string): boolean {
    // Meditech FHIR support varies by platform version
    if (this.config?.platform !== 'expanse') {
      // Limited support on legacy platforms
      const limitedFeatures = ['patients', 'encounters', 'observations', 'medications'];
      return limitedFeatures.includes(feature);
    }

    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  // ========================================================================
  // AUTHENTICATION (Meditech OAuth 2.0)
  // ========================================================================

  private async authenticate(config: MeditechConfig): Promise<void> {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Meditech requires OAuth2 with clientId and clientSecret');
    }

    // Meditech token endpoint
    const tokenUrl = `${this.authUrl}/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId || '',
        client_secret: config.clientSecret || '',
        scope: 'patient/*.read user/*.read', // Meditech SMART scopes
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meditech authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as OAuthTokenResponse;
    this.authToken = `Bearer ${data.access_token}`;
    this.refreshToken = data.refresh_token || '';

    if (data.expires_in) {
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
    }


  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.config) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = `${this.authUrl}/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json() as OAuthTokenResponse;
    this.authToken = `Bearer ${data.access_token}`;

    if (data.expires_in) {
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
    }


  }

  // ========================================================================
  // HELPER METHODS (Meditech-specific)
  // ========================================================================

  private async fetchFHIR(path: string, options?: RequestInit): Promise<FHIRResource> {
    // Check token expiry
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {

      await this.refreshAccessToken();
    }

    // Rate limiting
    await this.checkRateLimit();

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/fhir+json',
        'Authorization': this.authToken,
        ...options?.headers,
      },
    });

    this.requestCount++;

    if (!response.ok) {
      await this.handleMeditechError(response);
    }

    return await response.json();
  }

  /**
   * Meditech-specific error handling
   */
  private async handleMeditechError(response: Response): Promise<never> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/fhir+json')) {
      const outcome = await response.json() as FHIROperationOutcome;
      const issue = outcome.issue?.[0];
      throw new Error(
        `Meditech FHIR Error [${response.status}]: ${issue?.diagnostics || issue?.details?.text || response.statusText}`
      );
    }

    const text = await response.text();
    throw new Error(`Meditech API Error [${response.status}]: ${text || response.statusText}`);
  }

  /**
   * Rate limiting (Meditech: typically 500/hour for community hospitals)
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (this.requestWindowStart < hourAgo) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
      const resetTime = new Date(this.requestWindowStart.getTime() + 60 * 60 * 1000);
      const waitMs = resetTime.getTime() - now.getTime();

      await new Promise(resolve => setTimeout(resolve, waitMs));

      this.requestCount = 0;
      this.requestWindowStart = new Date();
    }
  }

  /**
   * Detect Meditech platform from capability statement
   */
  private detectPlatform(capability: FHIRCapabilityStatement): string {
    const impl = capability.implementation?.description || '';
    const software = capability.software?.name || '';

    if (impl.toLowerCase().includes('expanse') || software.toLowerCase().includes('expanse')) {
      return 'Expanse';
    } else if (impl.toLowerCase().includes('magic')) {
      return 'MAGIC';
    } else if (impl.toLowerCase().includes('client')) {
      return 'Client/Server';
    }

    return this.config?.platform.toUpperCase() || 'Unknown';
  }

  private extractResources(bundle: FHIRResource): FHIRResource[] {
    if (bundle.resourceType !== 'Bundle') {
      return [bundle];
    }

    const bundleData = bundle as FHIRBundle;
    return (bundleData.entry || []).map((entry) => entry.resource);
  }
}
