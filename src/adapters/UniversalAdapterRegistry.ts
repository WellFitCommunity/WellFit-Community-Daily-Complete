// src/adapters/UniversalAdapterRegistry.ts
// Central registry for all EHR/EMR adapters - "The Universal Joint"

export interface AdapterMetadata {
  id: string;
  name: string;
  vendor: string;
  version: string;
  protocols: ('fhir-r4' | 'fhir-r5' | 'hl7v2' | 'hl7v3' | 'cda' | 'custom')[];
  capabilities: {
    patients: boolean;
    encounters: boolean;
    observations: boolean;
    medications: boolean;
    allergies: boolean;
    immunizations: boolean;
    conditions: boolean;
    procedures: boolean;
    carePlans: boolean;
    documentReference: boolean;
  };
  setupGuide: string;
  certifications?: string[];  // e.g., "Epic App Orchard", "Cerner Code"
}

export interface AdapterConfig {
  endpoint: string;
  authType?: 'oauth2' | 'api-key' | 'basic' | 'saml' | 'custom';
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  syncSchedule?: string;  // Cron expression
  dataMapping?: Record<string, string>;
  options?: Record<string, any>;
}

export interface EHRAdapter {
  metadata: AdapterMetadata;

  // Connection Management
  connect(config: AdapterConfig): Promise<void>;
  test(): Promise<{ success: boolean; message: string; details?: any }>;
  disconnect(): Promise<void>;
  getConnectionStatus(): 'connected' | 'disconnected' | 'error';

  // Patient Data
  fetchPatients(params?: {
    ids?: string[];
    lastModified?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;  // Returns FHIR Patient resources

  fetchPatient(id: string): Promise<any>;  // Single patient

  // Clinical Data
  fetchEncounters(patientId: string, params?: { since?: Date }): Promise<any[]>;
  fetchObservations(patientId: string, params?: { category?: string; since?: Date }): Promise<any[]>;
  fetchMedications(patientId: string): Promise<any[]>;
  fetchConditions(patientId: string): Promise<any[]>;
  fetchAllergies(patientId: string): Promise<any[]>;
  fetchImmunizations(patientId: string): Promise<any[]>;
  fetchProcedures(patientId: string): Promise<any[]>;
  fetchCarePlans(patientId: string): Promise<any[]>;

  // Write Operations (if supported)
  createEncounter?(encounter: any): Promise<string>;  // Returns created ID
  updatePatient?(id: string, patient: any): Promise<void>;
  createObservation?(observation: any): Promise<string>;

  // Metadata
  getCapabilities(): Promise<any>;  // FHIR CapabilityStatement
  supportsFeature(feature: string): boolean;
}

export class UniversalAdapterRegistry {
  private static instance: UniversalAdapterRegistry;
  private adapters: Map<string, new () => EHRAdapter> = new Map();
  private activeConnections: Map<string, EHRAdapter> = new Map();

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): UniversalAdapterRegistry {
    if (!UniversalAdapterRegistry.instance) {
      UniversalAdapterRegistry.instance = new UniversalAdapterRegistry();
    }
    return UniversalAdapterRegistry.instance;
  }

  /**
   * Register a new adapter implementation
   */
  registerAdapter(metadata: AdapterMetadata, AdapterClass: new () => EHRAdapter) {
    this.adapters.set(metadata.id, AdapterClass);
  }

  /**
   * List all registered adapters
   */
  listAdapters(): AdapterMetadata[] {
    const adapters: AdapterMetadata[] = [];
    this.adapters.forEach((AdapterClass) => {
      const instance = new AdapterClass();
      adapters.push(instance.metadata);
    });
    return adapters;
  }

  /**
   * Get adapter by ID
   */
  getAdapter(id: string): EHRAdapter | null {
    const AdapterClass = this.adapters.get(id);
    if (!AdapterClass) {

      return null;
    }
    return new AdapterClass();
  }

  /**
   * Auto-detect which adapter to use based on endpoint
   */
  async detectAdapter(endpoint: string): Promise<AdapterMetadata | null> {


    // Try FHIR capability statement first
    try {
      const response = await fetch(`${endpoint}/metadata`, {
        headers: { 'Accept': 'application/fhir+json' },
      });

      if (response.ok) {
        const capability = await response.json();
        const software = capability.software?.name?.toLowerCase() || '';

        // Detect based on software name
        if (software.includes('epic')) {

          return this.getAdapter('epic-fhir')?.metadata || null;
        } else if (software.includes('cerner')) {

          return this.getAdapter('cerner-fhir')?.metadata || null;
        } else if (software.includes('athena')) {

          return this.getAdapter('athena-fhir')?.metadata || null;
        } else {

          return this.getAdapter('generic-fhir')?.metadata || null;
        }
      }
    } catch (error) {

    }

    // Check for HL7 v2 interface
    // (Would need actual HL7 connection test here)


    return null;
  }

  /**
   * Connect to an EHR system
   */
  async connect(
    adapterId: string,
    config: AdapterConfig,
    connectionId?: string
  ): Promise<{ success: boolean; connection?: EHRAdapter; error?: string }> {
    try {
      const adapter = this.getAdapter(adapterId);
      if (!adapter) {
        return { success: false, error: `Adapter not found: ${adapterId}` };
      }


      await adapter.connect(config);

      const testResult = await adapter.test();
      if (!testResult.success) {
        return { success: false, error: testResult.message };
      }

      const connId = connectionId || `${adapterId}-${Date.now()}`;
      this.activeConnections.set(connId, adapter);


      return { success: true, connection: adapter };
    } catch (error: any) {

      return { success: false, error: error.message };
    }
  }

  /**
   * Get an active connection
   */
  getConnection(connectionId: string): EHRAdapter | null {
    return this.activeConnections.get(connectionId) || null;
  }

  /**
   * Disconnect from an EHR system
   */
  async disconnect(connectionId: string): Promise<void> {
    const adapter = this.activeConnections.get(connectionId);
    if (adapter) {
      await adapter.disconnect();
      this.activeConnections.delete(connectionId);

    }
  }

  /**
   * Disconnect all active connections
   */
  async disconnectAll(): Promise<void> {

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
    config: AdapterConfig
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
}

// Export singleton instance
export const adapterRegistry = UniversalAdapterRegistry.getInstance();

// Helper function to quickly test an adapter
export async function testAdapter(adapterId: string, config: AdapterConfig): Promise<void> {


  const result = await adapterRegistry.connect(adapterId, config, 'test-connection');

  if (!result.success) {

    return;
  }

  const adapter = result.connection;

  if (!adapter) {
    return;
  }

  Object.entries(adapter.metadata.capabilities).forEach(([key, value]) => {

  });

  // Try fetching a sample patient
  try {
    const patients = await adapter.fetchPatients({ limit: 1 });
  } catch (error: any) {

  }

  await adapterRegistry.disconnect('test-connection');

}
