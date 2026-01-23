/**
 * FHIR Metadata Edge Function
 *
 * Purpose: Serve FHIR R4 CapabilityStatement
 * Endpoint: GET /functions/v1/fhir-metadata
 * Standards: FHIR R4, US Core 6.1
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// US Core Profile URLs
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

// Search parameters by resource
const SEARCH_PARAMS: Record<string, Array<{ name: string; type: string }>> = {
  Patient: [
    { name: '_id', type: 'token' },
    { name: 'identifier', type: 'token' },
    { name: 'name', type: 'string' },
    { name: 'family', type: 'string' },
    { name: 'given', type: 'string' },
    { name: 'birthdate', type: 'date' },
    { name: 'gender', type: 'token' },
  ],
  AllergyIntolerance: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'clinical-status', type: 'token' },
  ],
  Condition: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'category', type: 'token' },
    { name: 'clinical-status', type: 'token' },
  ],
  MedicationRequest: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'status', type: 'token' },
    { name: 'intent', type: 'token' },
  ],
  Observation: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'category', type: 'token' },
    { name: 'code', type: 'token' },
    { name: 'date', type: 'date' },
  ],
  Immunization: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'status', type: 'token' },
    { name: 'date', type: 'date' },
  ],
  Procedure: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'status', type: 'token' },
    { name: 'date', type: 'date' },
  ],
  DiagnosticReport: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'category', type: 'token' },
    { name: 'code', type: 'token' },
    { name: 'date', type: 'date' },
  ],
  CarePlan: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'category', type: 'token' },
    { name: 'status', type: 'token' },
  ],
  CareTeam: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'status', type: 'token' },
  ],
  Goal: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'lifecycle-status', type: 'token' },
  ],
  DocumentReference: [
    { name: '_id', type: 'token' },
    { name: 'patient', type: 'reference' },
    { name: 'category', type: 'token' },
    { name: 'type', type: 'token' },
    { name: 'date', type: 'date' },
  ],
};

function generateCapabilityStatement(baseUrl: string): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];

  // Generate resource definitions
  const resources = Object.keys(US_CORE_PROFILES).map((resourceType) => {
    const searchParams = SEARCH_PARAMS[resourceType] || [];

    return {
      type: resourceType,
      profile: US_CORE_PROFILES[resourceType],
      supportedProfile: [US_CORE_PROFILES[resourceType]],
      interaction: [
        { code: 'read' },
        { code: 'search-type' },
      ],
      versioning: 'versioned',
      readHistory: false,
      updateCreate: false,
      conditionalCreate: false,
      conditionalRead: 'not-supported',
      conditionalUpdate: false,
      conditionalDelete: 'not-supported',
      referencePolicy: ['literal', 'local'],
      searchParam: searchParams.map((sp) => ({
        name: sp.name,
        type: sp.type,
      })),
    };
  });

  return {
    resourceType: 'CapabilityStatement',
    id: 'wellfit-fhir-server',
    url: `${baseUrl}/fhir/metadata`,
    version: '1.0.0',
    name: 'WellFitFHIRServer',
    title: 'WellFit Community FHIR Server',
    status: 'active',
    experimental: false,
    date: today,
    publisher: 'WellFit Community',
    contact: [
      {
        name: 'WellFit Support',
        telecom: [
          { system: 'url', value: 'https://wellfitcommunity.com' },
          { system: 'email', value: 'support@wellfitcommunity.com' },
        ],
      },
    ],
    description: 'FHIR R4 server for WellFit Community Healthcare Platform. Supports US Core 6.1 profiles, SMART on FHIR, and Bulk Data Export.',
    kind: 'instance',
    software: {
      name: 'WellFit Community Platform',
      version: '1.0.0',
      releaseDate: today,
    },
    implementation: {
      description: 'WellFit FHIR Server',
      url: baseUrl,
    },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json', 'application/json'],
    patchFormat: ['application/json-patch+json'],
    implementationGuide: [
      'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core|6.1.0',
      'http://hl7.org/fhir/smart-app-launch/ImplementationGuide/hl7.fhir.smart-app-launch|2.0.0',
    ],
    rest: [
      {
        mode: 'server',
        documentation: 'RESTful FHIR server supporting read, search, and bulk export.',
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'SMART-on-FHIR',
                  display: 'SMART on FHIR',
                },
                {
                  system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'OAuth',
                  display: 'OAuth',
                },
              ],
            },
          ],
          description: 'OAuth 2.0 with SMART on FHIR scopes. See .well-known/smart-configuration for details.',
          extension: [
            {
              url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
              extension: [
                {
                  url: 'authorize',
                  valueUri: `${baseUrl}/functions/v1/smart-authorize`,
                },
                {
                  url: 'token',
                  valueUri: `${baseUrl}/functions/v1/smart-token`,
                },
                {
                  url: 'revoke',
                  valueUri: `${baseUrl}/functions/v1/smart-revoke`,
                },
              ],
            },
          ],
        },
        resource: resources,
        interaction: [
          { code: 'search-system' },
        ],
        searchParam: [
          { name: '_id', type: 'token' },
          { name: '_lastUpdated', type: 'date' },
          { name: '_count', type: 'number' },
        ],
        operation: [
          {
            name: 'export',
            definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/export',
            documentation: 'Bulk Data Export (system-level)',
          },
          {
            name: 'export',
            definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/patient-export',
            documentation: 'Patient-level Bulk Data Export',
          },
        ],
      },
    ],
  };
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Only allow GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-supported',
              diagnostics: 'Only GET method is supported for metadata endpoint',
            },
          ],
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/fhir+json',
            'Allow': 'GET, OPTIONS',
          },
        }
      );
    }

    // Get base URL from request or environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const baseUrl = supabaseUrl || new URL(req.url).origin;

    // Generate the CapabilityStatement
    const capabilityStatement = generateCapabilityStatement(baseUrl);

    // Check Accept header for format
    const acceptHeader = req.headers.get('Accept') || '';
    const wantXml = acceptHeader.includes('application/fhir+xml') || acceptHeader.includes('application/xml');

    if (wantXml) {
      // We don't support XML - return an error
      return new Response(
        JSON.stringify({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-supported',
              diagnostics: 'XML format is not supported. Please use application/fhir+json.',
            },
          ],
        }),
        {
          status: 406,
          headers: { ...corsHeaders, 'Content-Type': 'application/fhir+json' },
        }
      );
    }

    return new Response(JSON.stringify(capabilityStatement, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/fhir+json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('FHIR metadata error:', error);

    return new Response(
      JSON.stringify({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'exception',
            diagnostics: error instanceof Error ? error.message : 'Internal server error',
          },
        ],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/fhir+json' },
      }
    );
  }
});
