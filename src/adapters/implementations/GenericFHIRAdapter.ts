// src/adapters/implementations/GenericFHIRAdapter.ts
// Universal FHIR adapter - works with ANY FHIR R4 compliant system
// Epic, Cerner, Allscripts, Athena, etc.

import type { EHRAdapter, AdapterMetadata, AdapterConfig } from '../UniversalAdapterRegistry';

export class GenericFHIRAdapter implements EHRAdapter {
  metadata: AdapterMetadata = {
    id: 'generic-fhir',
    name: 'Generic FHIR R4 Adapter',
    vendor: 'Universal',
    version: '1.0.0',
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
    setupGuide: '/docs/adapters/generic-fhir.md',
  };

  private baseUrl: string = '';
  private authToken: string = '';
  private config: AdapterConfig | null = null;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  async connect(config: AdapterConfig): Promise<void> {
    this.config = config;
    this.baseUrl = config.endpoint.replace(/\/$/, ''); // Remove trailing slash

    // Authenticate
    await this.authenticate(config);

    this.status = 'connected';

  }

  async test(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Test with capability statement
      const response = await this.fetchFHIR('/metadata');

      if (response.resourceType === 'CapabilityStatement') {
        return {
          success: true,
          message: 'Connection successful',
          details: {
            software: response.software,
            fhirVersion: response.fhirVersion,
          },
        };
      }

      return { success: false, message: 'Invalid FHIR response' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';

  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  // FHIR SEARCH OPERATIONS

  async fetchPatients(params?: {
    ids?: string[];
    lastModified?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const searchParams = new URLSearchParams();

    if (params?.ids?.length) {
      searchParams.set('_id', params.ids.join(','));
    }
    if (params?.lastModified) {
      searchParams.set('_lastUpdated', `gt${params.lastModified.toISOString()}`);
    }
    if (params?.limit) {
      searchParams.set('_count', params.limit.toString());
    }

    const bundle = await this.fetchFHIR(`/Patient?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchPatient(id: string): Promise<any> {
    return await this.fetchFHIR(`/Patient/${id}`);
  }

  async fetchEncounters(patientId: string, params?: { since?: Date }): Promise<any[]> {
    const searchParams = new URLSearchParams({ patient: patientId });
    if (params?.since) {
      searchParams.set('date', `gt${params.since.toISOString()}`);
    }

    const bundle = await this.fetchFHIR(`/Encounter?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchObservations(
    patientId: string,
    params?: { category?: string; since?: Date }
  ): Promise<any[]> {
    const searchParams = new URLSearchParams({ patient: patientId });
    if (params?.category) {
      searchParams.set('category', params.category);
    }
    if (params?.since) {
      searchParams.set('date', `gt${params.since.toISOString()}`);
    }

    const bundle = await this.fetchFHIR(`/Observation?${searchParams}`);
    return this.extractResources(bundle);
  }

  async fetchMedications(patientId: string): Promise<any[]> {
    const bundle = await this.fetchFHIR(`/MedicationRequest?patient=${patientId}`);
    return this.extractResources(bundle);
  }

  async fetchConditions(patientId: string): Promise<any[]> {
    const bundle = await this.fetchFHIR(`/Condition?patient=${patientId}`);
    return this.extractResources(bundle);
  }

  async fetchAllergies(patientId: string): Promise<any[]> {
    const bundle = await this.fetchFHIR(`/AllergyIntolerance?patient=${patientId}`);
    return this.extractResources(bundle);
  }

  async fetchImmunizations(patientId: string): Promise<any[]> {
    const bundle = await this.fetchFHIR(`/Immunization?patient=${patientId}`);
    return this.extractResources(bundle);
  }

  async fetchProcedures(patientId: string): Promise<any[]> {
    const bundle = await this.fetchFHIR(`/Procedure?patient=${patientId}`);
    return this.extractResources(bundle);
  }

  async fetchCarePlans(patientId: string): Promise<any[]> {
    const bundle = await this.fetchFHIR(`/CarePlan?patient=${patientId}`);
    return this.extractResources(bundle);
  }

  async getCapabilities(): Promise<any> {
    return await this.fetchFHIR('/metadata');
  }

  supportsFeature(feature: string): boolean {
    // Check capability statement or metadata
    return this.metadata.capabilities[feature as keyof typeof this.metadata.capabilities] || false;
  }

  // HELPER METHODS

  private async authenticate(config: AdapterConfig): Promise<void> {
    const authType = config.authType || 'api-key';

    switch (authType) {
      case 'oauth2':
        if (!config.clientId || !config.clientSecret) {
          throw new Error('OAuth2 requires clientId and clientSecret');
        }
        this.authToken = await this.oauth2Flow({
          clientId: config.clientId,
          clientSecret: config.clientSecret
        });
        break;

      case 'api-key':
        if (!config.apiKey) {
          throw new Error('API Key authentication requires apiKey');
        }
        this.authToken = config.apiKey;
        break;

      case 'basic':
        if (!config.username || !config.password) {
          throw new Error('Basic auth requires username and password');
        }
        const encoded = btoa(`${config.username}:${config.password}`);
        this.authToken = `Basic ${encoded}`;
        break;

      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }
  }

  private async oauth2Flow(credentials: Record<string, string>): Promise<string> {
    // Simplified OAuth2 - customize per system
    const tokenUrl = credentials.tokenUrl || `${this.baseUrl}/oauth2/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 failed: ${response.statusText}`);
    }

    const data = await response.json();
    return `Bearer ${data.access_token}`;
  }

  private async fetchFHIR(path: string): Promise<any> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/fhir+json',
        'Authorization': this.authToken,
      },
    });

    if (!response.ok) {
      throw new Error(`FHIR request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private extractResources(bundle: any): any[] {
    if (bundle.resourceType !== 'Bundle') {
      return [bundle]; // Single resource
    }

    return (bundle.entry || []).map((entry: any) => entry.resource);
  }
}
