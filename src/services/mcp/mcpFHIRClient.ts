/**
 * MCP FHIR Client - Browser-Safe Version
 *
 * Provides standardized FHIR R4 resource access and operations.
 * Features: Bundle export, resource CRUD, validation, patient summaries, EHR sync.
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// FHIR Types
// =====================================================

export type FHIRResourceType =
  | 'Patient'
  | 'MedicationRequest'
  | 'Condition'
  | 'DiagnosticReport'
  | 'Procedure'
  | 'Observation'
  | 'Immunization'
  | 'CarePlan'
  | 'CareTeam'
  | 'Practitioner'
  | 'PractitionerRole'
  | 'Encounter'
  | 'DocumentReference'
  | 'AllergyIntolerance'
  | 'Goal'
  | 'Location'
  | 'Organization'
  | 'Medication';

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'searchset' | 'collection' | 'document';
  timestamp: string;
  total: number;
  entry: Array<{
    fullUrl: string;
    resource: any;
  }>;
}

export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier?: Array<{ system: string; value: string }>;
  name: Array<{
    use: string;
    family: string;
    given: string[];
  }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system: string; value: string }>;
  address?: Array<{
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
}

export interface PatientSummary {
  patient_id: string;
  generated_at: string;
  sections: {
    demographics?: {
      name: string;
      date_of_birth: string;
      gender: string;
      phone: string;
      address: string;
    };
    conditions?: Array<{
      code: string;
      display: string;
      onset: string;
      status: string;
    }>;
    medications?: Array<{
      name: string;
      dosage: string;
      status: string;
      prescriber: string;
    }>;
    allergies?: Array<{
      allergen: string;
      reaction: string;
      severity: string;
    }>;
    immunizations?: Array<{
      vaccine: string;
      date: string;
      status: string;
    }>;
    vitals?: Array<{
      type: string;
      value: number;
      unit: string;
      date: string;
    }>;
    procedures?: Array<{
      name: string;
      date: string;
      status: string;
    }>;
    goals?: Array<{
      description: string;
      status: string;
      target_date: string;
    }>;
    careplans?: Array<{
      title: string;
      category: string;
      status: string;
    }>;
  };
}

export interface MedicationListResult {
  patient_id: string;
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    route: string;
    status: string;
    prescriber: string;
    start_date: string;
    end_date?: string;
  }>;
  total: number;
}

export interface ConditionListResult {
  patient_id: string;
  conditions: Array<{
    id: string;
    code: string;
    display: string;
    system: string;
    clinical_status: string;
    verification_status: string;
    severity?: string;
    onset_date?: string;
    recorded_date: string;
  }>;
  total: number;
}

export interface SDOHAssessmentResult {
  patient_id: string;
  assessments: Array<{
    id: string;
    code: string;
    display: string;
    value: any;
    date: string;
  }>;
  active_flags: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    detected_date: string;
  }>;
  total_assessments: number;
  total_flags: number;
}

export interface CareTeamResult {
  patient_id: string;
  care_teams: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    members: Array<{
      role: string;
      name: string;
      specialty?: string;
      phone?: string;
      email?: string;
    }>;
  }>;
}

export interface EHRConnection {
  id: string;
  name: string;
  ehr_type: string;
  base_url: string;
  status: string;
  sync_mode: string;
  sync_frequency: string;
  last_sync?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FHIRResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tool: string;
    executionTimeMs: number;
  };
}

// =====================================================
// FHIR MCP Client
// =====================================================

class FHIRMCPClient {
  private static instance: FHIRMCPClient;
  private edgeFunctionUrl: string;

  private constructor() {
    this.edgeFunctionUrl = `${SB_URL}/functions/v1/mcp-fhir-server`;
  }

  static getInstance(): FHIRMCPClient {
    if (!FHIRMCPClient.instance) {
      FHIRMCPClient.instance = new FHIRMCPClient();
    }
    return FHIRMCPClient.instance;
  }

  private getAuthToken(): string {
    try {
      const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.access_token || '';
      }
    } catch {
      // Ignore errors
    }
    return '';
  }

  private async callTool<T>(toolName: string, args: Record<string, any>): Promise<FHIRResult<T>> {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'FHIR operation failed'
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result.content?.[0]?.data,
        metadata: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // =====================================================
  // Bundle Operations
  // =====================================================

  /**
   * Export a complete FHIR Bundle for a patient
   */
  async exportPatientBundle(
    patientId: string,
    options?: {
      resources?: FHIRResourceType[];
      startDate?: string;
      endDate?: string;
      includeAIAssessments?: boolean;
    }
  ): Promise<FHIRResult<FHIRBundle>> {
    return this.callTool('export_patient_bundle', {
      patient_id: patientId,
      resources: options?.resources,
      start_date: options?.startDate,
      end_date: options?.endDate,
      include_ai_assessments: options?.includeAIAssessments
    });
  }

  // =====================================================
  // Resource Operations
  // =====================================================

  /**
   * Get a specific FHIR resource by ID
   */
  async getResource<T = any>(
    resourceType: FHIRResourceType,
    resourceId: string
  ): Promise<FHIRResult<T>> {
    return this.callTool('get_resource', {
      resource_type: resourceType,
      resource_id: resourceId
    });
  }

  /**
   * Search FHIR resources with filters
   */
  async searchResources(
    resourceType: FHIRResourceType,
    filters?: {
      patientId?: string;
      status?: string;
      category?: string;
      code?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    }
  ): Promise<FHIRResult<FHIRBundle>> {
    return this.callTool('search_resources', {
      resource_type: resourceType,
      patient_id: filters?.patientId,
      status: filters?.status,
      category: filters?.category,
      code: filters?.code,
      date_from: filters?.dateFrom,
      date_to: filters?.dateTo,
      limit: filters?.limit
    });
  }

  /**
   * Create a new FHIR resource
   */
  async createResource<T = any>(
    resourceType: FHIRResourceType,
    data: Record<string, any>,
    patientId?: string
  ): Promise<FHIRResult<T>> {
    return this.callTool('create_resource', {
      resource_type: resourceType,
      data,
      patient_id: patientId
    });
  }

  /**
   * Update an existing FHIR resource
   */
  async updateResource<T = any>(
    resourceType: FHIRResourceType,
    resourceId: string,
    data: Record<string, any>
  ): Promise<FHIRResult<T>> {
    return this.callTool('update_resource', {
      resource_type: resourceType,
      resource_id: resourceId,
      data
    });
  }

  /**
   * Validate a FHIR resource against schema
   */
  async validateResource(
    resourceType: FHIRResourceType,
    data: Record<string, any>
  ): Promise<FHIRResult<ValidationResult>> {
    return this.callTool('validate_resource', {
      resource_type: resourceType,
      data
    });
  }

  // =====================================================
  // Patient-Centric Operations
  // =====================================================

  /**
   * Get a clinical summary for a patient (CCD-style)
   */
  async getPatientSummary(
    patientId: string,
    sections?: Array<'demographics' | 'conditions' | 'medications' | 'allergies' | 'immunizations' | 'vitals' | 'procedures' | 'goals' | 'careplans'>
  ): Promise<FHIRResult<PatientSummary>> {
    return this.callTool('get_patient_summary', {
      patient_id: patientId,
      include_sections: sections
    });
  }

  /**
   * Get observations/vitals for a patient
   */
  async getObservations(
    patientId: string,
    options?: {
      category?: 'vital-signs' | 'laboratory' | 'survey' | 'activity';
      code?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    }
  ): Promise<FHIRResult<FHIRBundle>> {
    return this.callTool('get_observations', {
      patient_id: patientId,
      category: options?.category,
      code: options?.code,
      date_from: options?.dateFrom,
      date_to: options?.dateTo,
      limit: options?.limit
    });
  }

  /**
   * Get active medications for a patient
   */
  async getMedicationList(
    patientId: string,
    options?: {
      status?: 'active' | 'completed' | 'stopped' | 'cancelled' | 'all';
      includeHistory?: boolean;
    }
  ): Promise<FHIRResult<MedicationListResult>> {
    return this.callTool('get_medication_list', {
      patient_id: patientId,
      status: options?.status,
      include_history: options?.includeHistory
    });
  }

  /**
   * Get diagnoses/conditions for a patient
   */
  async getConditionList(
    patientId: string,
    options?: {
      clinicalStatus?: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
      category?: string;
    }
  ): Promise<FHIRResult<ConditionListResult>> {
    return this.callTool('get_condition_list', {
      patient_id: patientId,
      clinical_status: options?.clinicalStatus,
      category: options?.category
    });
  }

  /**
   * Get SDOH assessments for a patient
   */
  async getSDOHAssessments(
    patientId: string,
    domain?: 'food-insecurity' | 'housing-instability' | 'transportation' | 'financial-strain' | 'social-isolation' | 'all'
  ): Promise<FHIRResult<SDOHAssessmentResult>> {
    return this.callTool('get_sdoh_assessments', {
      patient_id: patientId,
      domain
    });
  }

  /**
   * Get care team for a patient
   */
  async getCareTeam(
    patientId: string,
    includeContactInfo?: boolean
  ): Promise<FHIRResult<CareTeamResult>> {
    return this.callTool('get_care_team', {
      patient_id: patientId,
      include_contact_info: includeContactInfo
    });
  }

  // =====================================================
  // EHR Integration Operations
  // =====================================================

  /**
   * List configured EHR/FHIR connections
   */
  async listEHRConnections(
    tenantId?: string,
    status?: 'active' | 'inactive' | 'error'
  ): Promise<FHIRResult<{ connections: EHRConnection[]; total: number }>> {
    return this.callTool('list_ehr_connections', {
      tenant_id: tenantId,
      status
    });
  }

  /**
   * Trigger synchronization with external EHR
   */
  async triggerEHRSync(
    connectionId: string,
    options?: {
      patientId?: string;
      direction?: 'pull' | 'push' | 'bidirectional';
      resources?: string[];
    }
  ): Promise<FHIRResult<{ sync_id: string; status: string; message: string }>> {
    return this.callTool('trigger_ehr_sync', {
      connection_id: connectionId,
      patient_id: options?.patientId,
      direction: options?.direction,
      resources: options?.resources
    });
  }
}

// =====================================================
// Convenience Functions
// =====================================================

const client = FHIRMCPClient.getInstance();

/**
 * Export a patient's complete FHIR bundle
 */
export async function exportPatientFHIRBundle(
  patientId: string,
  options?: {
    resources?: FHIRResourceType[];
    startDate?: string;
    endDate?: string;
    includeAI?: boolean;
  }
) {
  return client.exportPatientBundle(patientId, {
    resources: options?.resources,
    startDate: options?.startDate,
    endDate: options?.endDate,
    includeAIAssessments: options?.includeAI
  });
}

/**
 * Get a patient's clinical summary
 */
export async function getPatientClinicalSummary(patientId: string) {
  return client.getPatientSummary(patientId);
}

/**
 * Get patient's active medications
 */
export async function getPatientMedications(patientId: string, includeHistory = false) {
  return client.getMedicationList(patientId, {
    status: includeHistory ? 'all' : 'active',
    includeHistory
  });
}

/**
 * Get patient's conditions/diagnoses
 */
export async function getPatientConditions(patientId: string, activeOnly = true) {
  return client.getConditionList(patientId, {
    clinicalStatus: activeOnly ? 'active' : undefined
  });
}

/**
 * Get patient's recent vitals
 */
export async function getPatientVitals(patientId: string, limit = 20) {
  return client.getObservations(patientId, {
    category: 'vital-signs',
    limit
  });
}

/**
 * Get patient's lab results
 */
export async function getPatientLabResults(patientId: string, limit = 50) {
  return client.getObservations(patientId, {
    category: 'laboratory',
    limit
  });
}

/**
 * Get patient's allergies
 */
export async function getPatientAllergies(patientId: string) {
  return client.searchResources('AllergyIntolerance', {
    patientId,
    limit: 50
  });
}

/**
 * Get patient's immunizations
 */
export async function getPatientImmunizations(patientId: string) {
  return client.searchResources('Immunization', {
    patientId,
    limit: 50
  });
}

/**
 * Get patient's care plans
 */
export async function getPatientCarePlans(patientId: string, activeOnly = true) {
  return client.searchResources('CarePlan', {
    patientId,
    status: activeOnly ? 'active' : undefined,
    limit: 20
  });
}

/**
 * Get patient's care team
 */
export async function getPatientCareTeam(patientId: string, includeContact = false) {
  return client.getCareTeam(patientId, includeContact);
}

/**
 * Get patient's SDOH risk factors
 */
export async function getPatientSDOHRisks(patientId: string) {
  return client.getSDOHAssessments(patientId, 'all');
}

/**
 * Validate a FHIR resource before saving
 */
export async function validateFHIRResource(resourceType: FHIRResourceType, data: Record<string, any>) {
  return client.validateResource(resourceType, data);
}

/**
 * Create a new condition/diagnosis
 */
export async function createCondition(patientId: string, condition: {
  code: string;
  codeSystem?: string;
  display: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  onsetDate?: string;
}) {
  return client.createResource('Condition', {
    code: condition.code,
    code_system: condition.codeSystem || 'http://hl7.org/fhir/sid/icd-10-cm',
    code_display: condition.display,
    clinical_status: condition.clinicalStatus || 'active',
    verification_status: condition.verificationStatus || 'confirmed',
    onset_date: condition.onsetDate
  }, patientId);
}

/**
 * Create a new medication request
 */
export async function createMedicationRequest(patientId: string, medication: {
  name: string;
  dosage: string;
  frequency?: string;
  route?: string;
  requesterId?: string;
  requesterDisplay?: string;
}) {
  return client.createResource('MedicationRequest', {
    medication_name: medication.name,
    dosage_instructions: medication.dosage,
    frequency: medication.frequency,
    route: medication.route,
    requester_id: medication.requesterId,
    requester_display: medication.requesterDisplay,
    status: 'active'
  }, patientId);
}

/**
 * Create a new observation/vital sign
 */
export async function createObservation(patientId: string, observation: {
  code: string;
  codeDisplay: string;
  value: number;
  unit: string;
  category?: 'vital-signs' | 'laboratory' | 'survey' | 'activity';
  effectiveDate?: string;
}) {
  return client.createResource('Observation', {
    code: observation.code,
    code_display: observation.codeDisplay,
    value_quantity: {
      value: observation.value,
      unit: observation.unit
    },
    category: observation.category || 'vital-signs',
    effective_date: observation.effectiveDate || new Date().toISOString(),
    status: 'final'
  }, patientId);
}

/**
 * List available EHR connections
 */
export async function listEHRConnections(tenantId?: string) {
  return client.listEHRConnections(tenantId, 'active');
}

/**
 * Sync patient data with external EHR
 */
export async function syncPatientWithEHR(connectionId: string, patientId: string, direction: 'pull' | 'push' | 'bidirectional' = 'pull') {
  return client.triggerEHRSync(connectionId, {
    patientId,
    direction
  });
}

// =====================================================
// LOINC Code Constants for Common Observations
// =====================================================

export const LOINC_CODES = {
  // Vitals
  BLOOD_PRESSURE_SYSTOLIC: '8480-6',
  BLOOD_PRESSURE_DIASTOLIC: '8462-4',
  HEART_RATE: '8867-4',
  RESPIRATORY_RATE: '9279-1',
  BODY_TEMPERATURE: '8310-5',
  OXYGEN_SATURATION: '2708-6',
  BODY_WEIGHT: '29463-7',
  BODY_HEIGHT: '8302-2',
  BMI: '39156-5',

  // Labs
  GLUCOSE: '2345-7',
  HBA1C: '4548-4',
  CHOLESTEROL_TOTAL: '2093-3',
  HDL: '2085-9',
  LDL: '2089-1',
  TRIGLYCERIDES: '2571-8',
  CREATININE: '2160-0',
  EGFR: '33914-3',

  // SDOH
  FOOD_INSECURITY: '88122-7',
  HOUSING_INSTABILITY: '71802-3',
  TRANSPORTATION_INSECURITY: '93030-5',
  FINANCIAL_STRAIN: '76513-1',
  SOCIAL_ISOLATION: '93159-2'
} as const;

// Export client for advanced usage
export const fhirMCP = client;
export { FHIRMCPClient };
