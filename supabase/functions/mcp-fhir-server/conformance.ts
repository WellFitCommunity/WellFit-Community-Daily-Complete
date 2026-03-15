// =====================================================
// MCP FHIR Server - FHIR R4 CapabilityStatement
// Purpose: Generates conformance/metadata resource per FHIR R4 spec
// =====================================================

import { SUPPORTED_RESOURCES } from "./tools.ts";

/**
 * Search parameter definition for a FHIR resource in the CapabilityStatement.
 */
interface SearchParamEntry {
  name: string;
  type: string;
  documentation: string;
}

/**
 * Interaction entry for a FHIR resource in the CapabilityStatement.
 */
interface InteractionEntry {
  code: string;
}

/**
 * Resource entry in the CapabilityStatement rest array.
 */
interface ResourceEntry {
  type: string;
  interaction: InteractionEntry[];
  searchParam: SearchParamEntry[];
}

// =====================================================
// Common search parameters shared across resource types
// =====================================================

const COMMON_SEARCH_PARAMS: Record<string, SearchParamEntry> = {
  _id: { name: "_id", type: "token", documentation: "Resource ID" },
  patient: { name: "patient", type: "reference", documentation: "Patient reference" },
  status: { name: "status", type: "token", documentation: "Resource status" },
  category: { name: "category", type: "token", documentation: "Category" },
  code: { name: "code", type: "token", documentation: "Code (FHIR format: system|code)" },
  date: { name: "date", type: "date", documentation: "Date range" },
};

// =====================================================
// Standard interactions supported by all resources
// =====================================================

const STANDARD_INTERACTIONS: InteractionEntry[] = [
  { code: "read" },
  { code: "search-type" },
  { code: "create" },
  { code: "update" },
];

// =====================================================
// Per-resource search parameter configuration
// =====================================================

const RESOURCE_SEARCH_PARAMS: Record<string, string[]> = {
  Patient: ["_id"],
  MedicationRequest: ["_id", "patient", "status", "code", "date"],
  Condition: ["_id", "patient", "status", "category", "code", "date"],
  DiagnosticReport: ["_id", "patient", "status", "category", "code", "date"],
  Procedure: ["_id", "patient", "status", "category", "code", "date"],
  Observation: ["_id", "patient", "status", "category", "code", "date"],
  Immunization: ["_id", "patient", "status", "date"],
  CarePlan: ["_id", "patient", "status", "category", "date"],
  CareTeam: ["_id", "patient", "status", "category"],
  Practitioner: ["_id"],
  PractitionerRole: ["_id"],
  Encounter: ["_id", "patient", "status", "date"],
  DocumentReference: ["_id", "patient", "status", "category", "date"],
  AllergyIntolerance: ["_id", "patient", "status", "category", "code"],
  Goal: ["_id", "patient", "status", "category", "date"],
  Location: ["_id", "status"],
  Organization: ["_id"],
  Medication: ["_id", "status", "code"],
};

/**
 * Build the resource entries array for the CapabilityStatement rest element.
 * Each supported FHIR resource type gets an entry with interactions and
 * applicable search parameters.
 */
function buildResourceEntries(): ResourceEntry[] {
  return SUPPORTED_RESOURCES.map((resourceType) => {
    const paramKeys = RESOURCE_SEARCH_PARAMS[resourceType] || ["_id"];
    const searchParams = paramKeys
      .map((key) => COMMON_SEARCH_PARAMS[key])
      .filter((param): param is SearchParamEntry => param !== undefined);

    return {
      type: resourceType,
      interaction: STANDARD_INTERACTIONS,
      searchParam: searchParams,
    };
  });
}

/**
 * Builds a FHIR R4 CapabilityStatement resource describing the server's
 * supported resource types, interactions, and search parameters.
 *
 * This is the conformance/metadata endpoint required by the FHIR specification.
 * See: https://hl7.org/fhir/R4/capabilitystatement.html
 */
export function buildCapabilityStatement(): Record<string, unknown> {
  return {
    resourceType: "CapabilityStatement",
    id: "envision-atlus-fhir-capability",
    url: "https://fhir.envisionatlus.com/metadata",
    version: "1.0.0",
    name: "EnvisionAtlusFHIRCapabilityStatement",
    title: "Envision ATLUS FHIR R4 CapabilityStatement",
    status: "active",
    experimental: false,
    date: new Date().toISOString().split("T")[0],
    publisher: "Envision Virtual Edge Group LLC",
    kind: "instance",
    fhirVersion: "4.0.1",
    format: ["json"],
    software: {
      name: "Envision ATLUS FHIR Server",
      version: "1.0.0",
    },
    implementation: {
      description: "Envision ATLUS I.H.I.S. FHIR R4 Server",
    },
    rest: [
      {
        mode: "server",
        documentation:
          "FHIR R4 server supporting 18 resource types with read, search, create, and update interactions.",
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
                  code: "SMART-on-FHIR",
                  display: "SMART on FHIR",
                },
              ],
              text: "OAuth2 with SMART on FHIR scopes",
            },
          ],
          description:
            "Authentication via Supabase JWT tokens. SMART on FHIR authorization supported.",
        },
        resource: buildResourceEntries(),
      },
    ],
  };
}
