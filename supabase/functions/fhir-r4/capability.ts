/**
 * FHIR R4 Server — Capability Statement
 *
 * Returns the server's CapabilityStatement (metadata) describing
 * supported resources, security, and SMART on FHIR endpoints.
 */

import { FHIR_VERSION } from './types.ts';

/**
 * Generate the FHIR CapabilityStatement for this server instance.
 * Advertises supported resources, SMART OAuth endpoints, and US Core compliance.
 */
export function getCapabilityStatement(baseUrl: string) {
  return {
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    kind: "instance",
    software: {
      name: "WellFit FHIR Server",
      version: "1.0.0"
    },
    implementation: {
      description: "WellFit Community FHIR R4 API",
      url: baseUrl
    },
    fhirVersion: FHIR_VERSION,
    format: ["json"],
    rest: [{
      mode: "server",
      security: {
        cors: true,
        service: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
            code: "SMART-on-FHIR"
          }]
        }],
        extension: [{
          url: "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
          extension: [
            { url: "token", valueUri: `${baseUrl}/smart-token` },
            { url: "authorize", valueUri: `${baseUrl}/smart-authorize` }
          ]
        }]
      },
      resource: [
        { type: "Patient", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "AllergyIntolerance", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Condition", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "MedicationRequest", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Observation", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Immunization", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Procedure", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "DiagnosticReport", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "CarePlan", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "CareTeam", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Goal", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "DocumentReference", interaction: [{ code: "read" }, { code: "search-type" }] }
      ]
    }]
  };
}
