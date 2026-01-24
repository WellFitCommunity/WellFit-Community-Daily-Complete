/**
 * FHIR Capability Statement Service
 *
 * Purpose: Generate FHIR R4 CapabilityStatement for conformance
 * Standards: FHIR R4, US Core 6.1
 * Endpoint: GET /fhir/metadata
 *
 * @module services/capabilityStatementService
 */

import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export interface FhirCapabilityStatement {
  resourceType: 'CapabilityStatement';
  id: string;
  url: string;
  version: string;
  name: string;
  title: string;
  status: 'draft' | 'active' | 'retired' | 'unknown';
  experimental: boolean;
  date: string;
  publisher: string;
  contact: Array<{
    name: string;
    telecom: Array<{
      system: string;
      value: string;
    }>;
  }>;
  description: string;
  kind: 'instance' | 'capability' | 'requirements';
  software: {
    name: string;
    version: string;
    releaseDate: string;
  };
  implementation?: {
    description: string;
    url: string;
  };
  fhirVersion: string;
  format: string[];
  patchFormat?: string[];
  implementationGuide?: string[];
  rest: Array<RestDefinition>;
}

export interface RestDefinition {
  mode: 'client' | 'server';
  documentation?: string;
  security?: {
    cors: boolean;
    service: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    description?: string;
  };
  resource: ResourceDefinition[];
  interaction?: Array<{
    code: string;
    documentation?: string;
  }>;
  searchParam?: Array<{
    name: string;
    type: string;
    documentation?: string;
  }>;
  operation?: Array<{
    name: string;
    definition: string;
    documentation?: string;
  }>;
}

export interface ResourceDefinition {
  type: string;
  profile?: string;
  supportedProfile?: string[];
  documentation?: string;
  interaction: Array<{
    code: string;
    documentation?: string;
  }>;
  versioning?: 'no-version' | 'versioned' | 'versioned-update';
  readHistory?: boolean;
  updateCreate?: boolean;
  conditionalCreate?: boolean;
  conditionalRead?: 'not-supported' | 'modified-since' | 'not-match' | 'full-support';
  conditionalUpdate?: boolean;
  conditionalDelete?: 'not-supported' | 'single' | 'multiple';
  referencePolicy?: Array<'literal' | 'logical' | 'resolves' | 'enforced' | 'local'>;
  searchInclude?: string[];
  searchRevInclude?: string[];
  searchParam?: Array<{
    name: string;
    definition?: string;
    type: 'number' | 'date' | 'string' | 'token' | 'reference' | 'composite' | 'quantity' | 'uri' | 'special';
    documentation?: string;
  }>;
  operation?: Array<{
    name: string;
    definition: string;
    documentation?: string;
  }>;
}

export interface CapabilityStatementConfig {
  baseUrl: string;
  organizationName: string;
  version: string;
  releaseDate: string;
  environment: 'production' | 'staging' | 'development';
  smartEnabled: boolean;
  bulkExportEnabled: boolean;
}

// =============================================================================
// SUPPORTED RESOURCES
// =============================================================================

/**
 * US Core 6.1 Required Profiles
 */
const US_CORE_PROFILES: Record<string, string> = {
  AllergyIntolerance: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance',
  CarePlan: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan',
  CareTeam: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam',
  Condition: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-encounter-diagnosis',
  DiagnosticReport: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab',
  DocumentReference: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference',
  Encounter: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter',
  Goal: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal',
  Immunization: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization',
  Location: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-location',
  Medication: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medication',
  MedicationRequest: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest',
  Observation: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
  Organization: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-organization',
  Patient: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  Practitioner: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner',
  PractitionerRole: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitionerrole',
  Procedure: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure',
  Provenance: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance',
};

/**
 * Search parameters by resource type
 */
const RESOURCE_SEARCH_PARAMS: Record<string, Array<{ name: string; type: string; doc: string }>> = {
  Patient: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'identifier', type: 'token', doc: 'A patient identifier' },
    { name: 'name', type: 'string', doc: 'A portion of either family or given name' },
    { name: 'family', type: 'string', doc: 'A portion of the family name' },
    { name: 'given', type: 'string', doc: 'A portion of the given name' },
    { name: 'birthdate', type: 'date', doc: 'The patient\'s date of birth' },
    { name: 'gender', type: 'token', doc: 'Gender of the patient' },
  ],
  AllergyIntolerance: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Who the sensitivity is for' },
    { name: 'clinical-status', type: 'token', doc: 'active | inactive | resolved' },
  ],
  Condition: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Who has the condition' },
    { name: 'category', type: 'token', doc: 'Category of the condition' },
    { name: 'clinical-status', type: 'token', doc: 'Active, resolved, or inactive' },
    { name: 'onset-date', type: 'date', doc: 'Date/time when condition onset' },
  ],
  MedicationRequest: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Returns prescriptions for a specific patient' },
    { name: 'status', type: 'token', doc: 'Status of the prescription' },
    { name: 'intent', type: 'token', doc: 'Intent of the request' },
    { name: 'authoredon', type: 'date', doc: 'Return prescriptions written on this date' },
  ],
  Observation: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'The subject that the observation is about' },
    { name: 'category', type: 'token', doc: 'Category of observation' },
    { name: 'code', type: 'token', doc: 'The code of the observation type' },
    { name: 'date', type: 'date', doc: 'Observation date' },
    { name: 'status', type: 'token', doc: 'The status of the observation' },
  ],
  Immunization: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'The patient for the vaccination record' },
    { name: 'status', type: 'token', doc: 'Immunization status' },
    { name: 'date', type: 'date', doc: 'Vaccination date' },
  ],
  Procedure: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Search by subject - a patient' },
    { name: 'status', type: 'token', doc: 'Procedure status' },
    { name: 'date', type: 'date', doc: 'Date the procedure was performed' },
  ],
  DiagnosticReport: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'The subject of the report' },
    { name: 'category', type: 'token', doc: 'Which diagnostic discipline' },
    { name: 'code', type: 'token', doc: 'The code for the report' },
    { name: 'date', type: 'date', doc: 'The clinically relevant time of the report' },
    { name: 'status', type: 'token', doc: 'The status of the report' },
  ],
  CarePlan: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Who care plan is for' },
    { name: 'category', type: 'token', doc: 'Type of plan' },
    { name: 'status', type: 'token', doc: 'Status of the care plan' },
  ],
  CareTeam: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Who care team is for' },
    { name: 'status', type: 'token', doc: 'Status of the care team' },
  ],
  Goal: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Who has the goal' },
    { name: 'lifecycle-status', type: 'token', doc: 'Status of the goal' },
    { name: 'target-date', type: 'date', doc: 'Target date for the goal' },
  ],
  DocumentReference: [
    { name: '_id', type: 'token', doc: 'Logical id of this artifact' },
    { name: 'patient', type: 'reference', doc: 'Who the document is about' },
    { name: 'category', type: 'token', doc: 'Document category' },
    { name: 'type', type: 'token', doc: 'Kind of document' },
    { name: 'date', type: 'date', doc: 'When document was created' },
    { name: 'status', type: 'token', doc: 'Document status' },
  ],
};

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Generate a full FHIR CapabilityStatement
 */
function generateCapabilityStatement(
  config: CapabilityStatementConfig
): ServiceResult<FhirCapabilityStatement> {
  try {
    const capabilityStatement: FhirCapabilityStatement = {
      resourceType: 'CapabilityStatement',
      id: 'wellfit-fhir-server',
      url: `${config.baseUrl}/fhir/metadata`,
      version: config.version,
      name: 'WellFitFHIRServer',
      title: 'WellFit Community FHIR Server Capability Statement',
      status: config.environment === 'production' ? 'active' : 'draft',
      experimental: config.environment !== 'production',
      date: config.releaseDate,
      publisher: config.organizationName,
      contact: [
        {
          name: 'WellFit Support',
          telecom: [
            { system: 'url', value: 'https://wellfitcommunity.com/support' },
            { system: 'email', value: 'support@wellfitcommunity.com' },
          ],
        },
      ],
      description: 'FHIR R4 server for WellFit Community Healthcare Platform. Supports US Core 6.1 profiles, SMART on FHIR, and Bulk Data Export.',
      kind: 'instance',
      software: {
        name: 'WellFit Community Platform',
        version: config.version,
        releaseDate: config.releaseDate,
      },
      implementation: {
        description: `WellFit FHIR Server (${config.environment})`,
        url: config.baseUrl,
      },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json', 'application/json'],
      patchFormat: ['application/json-patch+json'],
      implementationGuide: [
        'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core|6.1.0',
        'http://hl7.org/fhir/smart-app-launch/ImplementationGuide/hl7.fhir.smart-app-launch|2.0.0',
      ],
      rest: [
        generateRestDefinition(config),
      ],
    };

    return success(capabilityStatement);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', `Failed to generate CapabilityStatement: ${error.message}`, err);
  }
}

/**
 * Generate the REST definition section
 */
function generateRestDefinition(config: CapabilityStatementConfig): RestDefinition {
  const rest: RestDefinition = {
    mode: 'server',
    documentation: 'RESTful FHIR server supporting read, search, and bulk export operations.',
    security: {
      cors: true,
      service: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
              code: 'OAuth',
              display: 'OAuth',
            },
          ],
        },
      ],
      description: 'OAuth 2.0 authentication with SMART on FHIR scopes. Bearer token required for all requests.',
    },
    resource: generateResourceDefinitions(config),
    interaction: [
      { code: 'search-system', documentation: 'Search across all resource types' },
    ],
    searchParam: [
      { name: '_id', type: 'token', documentation: 'Resource id' },
      { name: '_lastUpdated', type: 'date', documentation: 'When the resource was last updated' },
      { name: '_count', type: 'number', documentation: 'Number of results per page' },
    ],
    operation: [],
  };

  // Add SMART capabilities
  if (config.smartEnabled && rest.security) {
    rest.security.service.push({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
          code: 'SMART-on-FHIR',
          display: 'SMART on FHIR',
        },
      ],
    });
    rest.security.description += ' Supports SMART on FHIR authorization including launch sequences and standalone apps.';
  }

  // Add Bulk Export operation
  if (config.bulkExportEnabled && rest.operation) {
    rest.operation.push({
      name: 'export',
      definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/export',
      documentation: 'Bulk Data Export (system-level). Supports async pattern with polling.',
    });
    rest.operation.push({
      name: 'export',
      definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/patient-export',
      documentation: 'Patient-level Bulk Data Export.',
    });
    rest.operation.push({
      name: 'export',
      definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/group-export',
      documentation: 'Group-level Bulk Data Export.',
    });
  }

  return rest;
}

/**
 * Generate resource definitions for each supported type
 */
function generateResourceDefinitions(_config: CapabilityStatementConfig): ResourceDefinition[] {
  const supportedResources = Object.keys(US_CORE_PROFILES);

  return supportedResources.map((resourceType) => {
    const searchParams = RESOURCE_SEARCH_PARAMS[resourceType] || [];

    const resourceDef: ResourceDefinition = {
      type: resourceType,
      profile: US_CORE_PROFILES[resourceType],
      supportedProfile: [US_CORE_PROFILES[resourceType]],
      documentation: `${resourceType} resource with US Core 6.1 profile support`,
      interaction: [
        { code: 'read', documentation: `Read ${resourceType} by ID` },
        { code: 'search-type', documentation: `Search for ${resourceType} resources` },
      ],
      versioning: 'versioned',
      readHistory: false,
      updateCreate: false,
      conditionalCreate: false,
      conditionalRead: 'not-supported',
      conditionalUpdate: false,
      conditionalDelete: 'not-supported',
      referencePolicy: ['literal', 'local'],
      searchInclude: resourceType === 'Patient' ? [] : [`${resourceType}:patient`],
      searchRevInclude: resourceType === 'Patient' ? [
        'AllergyIntolerance:patient',
        'Condition:patient',
        'Observation:patient',
        'MedicationRequest:patient',
      ] : [],
      searchParam: searchParams.map((sp) => ({
        name: sp.name,
        type: sp.type as NonNullable<ResourceDefinition['searchParam']>[number]['type'],
        documentation: sp.doc,
      })),
    };

    return resourceDef;
  });
}

/**
 * Get a minimal CapabilityStatement for quick responses
 */
function getMinimalCapabilityStatement(
  baseUrl: string
): ServiceResult<FhirCapabilityStatement> {
  return generateCapabilityStatement({
    baseUrl,
    organizationName: 'WellFit Community',
    version: '1.0.0',
    releaseDate: new Date().toISOString().split('T')[0],
    environment: 'production',
    smartEnabled: true,
    bulkExportEnabled: true,
  });
}

/**
 * Get the list of supported resource types
 */
function getSupportedResourceTypes(): string[] {
  return Object.keys(US_CORE_PROFILES);
}

/**
 * Get the US Core profile URL for a resource type
 */
function getProfileUrl(resourceType: string): string | null {
  return US_CORE_PROFILES[resourceType] || null;
}

/**
 * Check if a resource type is supported
 */
function isResourceTypeSupported(resourceType: string): boolean {
  return resourceType in US_CORE_PROFILES;
}

/**
 * Get search parameters for a resource type
 */
function getSearchParameters(resourceType: string): Array<{
  name: string;
  type: string;
  documentation: string;
}> {
  const params = RESOURCE_SEARCH_PARAMS[resourceType] || [];
  return params.map((p) => ({
    name: p.name,
    type: p.type,
    documentation: p.doc,
  }));
}

/**
 * Validate that a search parameter is valid for a resource type
 */
function isValidSearchParam(resourceType: string, paramName: string): boolean {
  const params = RESOURCE_SEARCH_PARAMS[resourceType] || [];
  // Also allow common params
  const commonParams = ['_id', '_lastUpdated', '_count', '_include', '_revinclude', '_sort'];
  return params.some((p) => p.name === paramName) || commonParams.includes(paramName);
}

// =============================================================================
// EXPORT
// =============================================================================

export const capabilityStatementService = {
  // Generation
  generateCapabilityStatement,
  getMinimalCapabilityStatement,

  // Resource info
  getSupportedResourceTypes,
  getProfileUrl,
  isResourceTypeSupported,

  // Search parameters
  getSearchParameters,
  isValidSearchParam,
};

export default capabilityStatementService;
