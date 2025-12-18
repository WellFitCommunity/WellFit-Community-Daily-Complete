/**
 * Cerner (Oracle Health) FHIR R4 Adapter
 *
 * Enterprise-grade adapter for Cerner EHR systems (now Oracle Health)
 * Supports Cerner Code Console certification requirements
 *
 * Cerner Documentation: https://fhir.cerner.com/
 * Code Console: https://code.cerner.com/
 *
 * Features:
 * - Cerner-specific FHIR extensions
 * - Millennium platform integration
 * - OAuth 2.0 with SMART on FHIR
 * - Cerner-specific search parameters
 * - Proprietary resource extensions
 * - Optimized for Cerner PowerChart workflows
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
  rest?: Array<{
    resource?: Array<{
      extension?: Array<{
        url?: string;
      }>;
    }>;
  }>;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface SMARTConfiguration {
  token_endpoint?: string;
  [key: string]: unknown;
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

interface CernerConfig extends AdapterConfig {
  // Cerner-specific configuration
  tenantId?: string; // Cerner Millennium tenant ID
  accountAlias?: string; // Cerner account alias
  cernerSandbox?: boolean; // Use Cerner sandbox environment
  millenniumVersion?: string; // Millennium platform version
  enableProprietary?: boolean; // Enable Cerner proprietary extensions
}

export class CernerFHIRAdapter implements EHRAdapter {
  metadata: AdapterMetadata = {
    id: 'cerner-fhir',
    name: 'Cerner (Oracle Health) FHIR R4 Adapter',
    vendor: 'Oracle Health (Cerner Corporation)',
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
    setupGuide: '/docs/adapters/cerner-setup.md',
    certifications: ['Cerner Code Console', 'Oracle Health Partner'],
  };

  // Cerner sandbox and production endpoints
  private readonly CERNER_SANDBOX_BASE = 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';
  private readonly CERNER_AUTH_SANDBOX = 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d';

  private baseUrl: string = '';
  private authUrl: string = '';
  private authToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: Date | null = null;
  private config: CernerConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  // Rate limiting (Cerner varies by account - typically 2000/hour)
  private requestCount: number = 0;
  private requestWindowStart: Date = new Date();
  private readonly MAX_REQUESTS_PER_HOUR = 2000;

  async connect(config: AdapterConfig): Promise<void> {
    this.config = config as CernerConfig;

    // Use sandbox or production endpoint
    if (this.config.cernerSandbox) {
      this.baseUrl = this.CERNER_SANDBOX_BASE;
      this.authUrl = this.CERNER_AUTH_SANDBOX;
    } else {
      // Production endpoint requires tenant ID
      if (!this.config.tenantId) {
        throw new Error('Production Cerner connection requires tenantId');
      }
      this.baseUrl = config.endpoint || `https://fhir-ehr.cerner.com/r4/${this.config.tenantId}`;
      this.authUrl = `https://authorization.cerner.com/tenants/${this.config.tenantId}`;
    }

    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    // Authenticate using Cerner OAuth 2.0
    await this.authenticate(this.config);

    this.status = 'connected';


  }

  async test(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const response = await this.fetchFHIR('/metadata') as FHIRCapabilityStatement;

      if (response.resourceType === 'CapabilityStatement') {
        // Validate it's Cerner
        const isCerner = response.software?.name?.toLowerCase().includes('cerner') ||
                        response.publisher?.toLowerCase().includes('cerner') ||
                        response.publisher?.toLowerCase().includes('oracle health');

        if (!isCerner) {
          return {
            success: false,
            message: 'Connected server does not appear to be Cerner FHIR',
          };
        }

        return {
          success: true,
          message: 'Cerner connection successful',
          details: {
            software: response.software,
            fhirVersion: response.fhirVersion,
            publisher: response.publisher,
            millenniumVersion: this.extractMillenniumVersion(response),
            extensions: this.detectCernerExtensions(response),
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
  // FHIR READ OPERATIONS (Cerner-optimized)
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
      // Cerner supports _lastUpdated
      searchParams.set('_lastUpdated', `gt${params.lastModified.toISOString()}`);
    }
    if (params?.limit) {
      // Cerner max is 50 per page
      searchParams.set('_count', Math.min(params.limit, 50).toString());
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
    });

    if (params?.since) {
      searchParams.set('date', `ge${params.since.toISOString()}`);
    }

    // Cerner-specific: Include encounter status
    searchParams.set('status', 'finished,in-progress,arrived');

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
    });

    if (params?.category) {
      // Cerner supports: vital-signs, laboratory, social-history, survey
      searchParams.set('category', params.category);
    }
    if (params?.since) {
      searchParams.set('date', `ge${params.since.toISOString()}`);
    }

    // Cerner pagination
    searchParams.set('_count', '50');

    const bundle = await this.fetchFHIR(`/Observation?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchMedications(patientId: string): Promise<FHIRResource[]> {
    // Cerner recommends MedicationRequest for active medications
    const bundle = await this.fetchFHIR(
      `/MedicationRequest?patient=${patientId}&status=active,completed&_count=50`
    );
    return this.extractResources(bundle);
  }

  async fetchConditions(patientId: string): Promise<FHIRResource[]> {
    // Cerner-specific: Use clinical-status parameter
    const bundle = await this.fetchFHIR(
      `/Condition?patient=${patientId}&clinical-status=active,recurrence,remission&_count=50`
    );
    return this.extractResources(bundle);
  }

  async fetchAllergies(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/AllergyIntolerance?patient=${patientId}&clinical-status=active,resolved`
    );
    return this.extractResources(bundle);
  }

  async fetchImmunizations(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/Immunization?patient=${patientId}&_count=50&_sort=-date`
    );
    return this.extractResources(bundle);
  }

  async fetchProcedures(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/Procedure?patient=${patientId}&_count=50&_sort=-date`
    );
    return this.extractResources(bundle);
  }

  async fetchCarePlans(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/CarePlan?patient=${patientId}&status=active,completed&_count=50`
    );
    return this.extractResources(bundle);
  }

  /**
   * Cerner-specific: Fetch diagnostic reports
   */
  async fetchDiagnosticReports(patientId: string, params?: { category?: string }): Promise<FHIRResource[]> {
    const searchParams = new URLSearchParams({
      patient: patientId,
      _count: '50',
    });

    if (params?.category) {
      searchParams.set('category', params.category);
    }

    const bundle = await this.fetchFHIR(`/DiagnosticReport?${searchParams}`);
    return this.extractResources(bundle);
  }

  /**
   * Cerner-specific: Fetch clinical documents (DocumentReference)
   */
  async fetchDocuments(patientId: string): Promise<FHIRResource[]> {
    const bundle = await this.fetchFHIR(
      `/DocumentReference?patient=${patientId}&_count=50&_sort=-date`
    );
    return this.extractResources(bundle);
  }

  async getCapabilities(): Promise<FHIRCapabilityStatement> {
    return await this.fetchFHIR('/metadata') as FHIRCapabilityStatement;
  }

  supportsFeature(feature: string): boolean {
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  // ========================================================================
  // AUTHENTICATION (Cerner OAuth 2.0)
  // ========================================================================

  private async authenticate(config: CernerConfig): Promise<void> {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Cerner requires OAuth2 with clientId and clientSecret');
    }

    // Discover token endpoint
    const tokenEndpoint = await this.discoverTokenEndpoint();

    // Request access token
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId || '',
        client_secret: config.clientSecret || '',
        scope: 'system/Patient.read system/Observation.read system/Encounter.read system/Condition.read system/Medication*.read system/Procedure.read system/Immunization.read system/AllergyIntolerance.read system/CarePlan.read',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cerner authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as OAuthTokenResponse;
    this.authToken = `Bearer ${data.access_token}`;
    this.refreshToken = data.refresh_token || '';

    if (data.expires_in) {
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
    }


  }

  /**
   * Discover Cerner token endpoint via SMART configuration
   */
  private async discoverTokenEndpoint(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/.well-known/smart-configuration`);
      if (!response.ok) {
        throw new Error('SMART configuration not found');
      }

      const config = await response.json() as SMARTConfiguration;
      if (!config.token_endpoint) {
        throw new Error('Token endpoint not found in SMART configuration');
      }

      return config.token_endpoint;
    } catch {
      // Fallback to Cerner's authorization server

      return `${this.authUrl}/protocol/openid-connect/token`;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.config) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = await this.discoverTokenEndpoint();

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
  // HELPER METHODS (Cerner-specific)
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
      await this.handleCernerError(response);
    }

    return await response.json();
  }

  /**
   * Cerner-specific error handling
   */
  private async handleCernerError(response: Response): Promise<never> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/fhir+json')) {
      const outcome = await response.json() as FHIROperationOutcome;
      const issue = outcome.issue?.[0];
      throw new Error(
        `Cerner FHIR Error [${response.status}]: ${issue?.diagnostics || issue?.details?.text || response.statusText}`
      );
    }

    const text = await response.text();
    throw new Error(`Cerner API Error [${response.status}]: ${text || response.statusText}`);
  }

  /**
   * Rate limiting (Cerner: typically 2000 req/hour)
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
   * Extract Millennium version from capability statement
   */
  private extractMillenniumVersion(capability: FHIRCapabilityStatement): string {
    // Cerner includes Millennium version in implementation description
    const impl = capability.implementation;
    if (impl?.description) {
      const match = impl.description.match(/Millennium (\d+\.\d+)/i);
      return match ? match[1] : 'Unknown';
    }
    return 'Unknown';
  }

  /**
   * Detect Cerner proprietary extensions
   */
  private detectCernerExtensions(capability: FHIRCapabilityStatement): string[] {
    const extensions: string[] = [];

    // Check for Cerner-specific extensions in supported resources
    const resources = capability.rest?.[0]?.resource || [];

    resources.forEach((resource) => {
      if (resource.extension) {
        resource.extension.forEach((ext) => {
          if (ext.url?.includes('cerner')) {
            extensions.push(ext.url);
          }
        });
      }
    });

    return [...new Set(extensions)]; // Deduplicate
  }

  private extractResources(bundle: FHIRResource): FHIRResource[] {
    if (bundle.resourceType !== 'Bundle') {
      return [bundle];
    }

    const bundleData = bundle as FHIRBundle;
    return (bundleData.entry || []).map((entry) => entry.resource);
  }
}
