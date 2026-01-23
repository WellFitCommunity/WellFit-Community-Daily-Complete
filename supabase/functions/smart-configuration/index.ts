/**
 * SMART on FHIR Configuration Endpoint
 *
 * Returns the .well-known/smart-configuration document that external apps
 * use to discover how to authenticate with WellFit's FHIR server.
 *
 * @see https://hl7.org/fhir/smart-app-launch/conformance.html
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // SMART Configuration per HL7 SMART App Launch spec
  const smartConfiguration = {
    // Required fields
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/smart-authorize`,
    token_endpoint: `${baseUrl}/smart-token`,

    // Token introspection (optional but recommended)
    introspection_endpoint: `${baseUrl}/smart-token?action=introspect`,

    // PKCE support (required for public apps)
    code_challenge_methods_supported: ["S256"],

    // Grant types
    grant_types_supported: [
      "authorization_code",
      "refresh_token"
    ],

    // Response types
    response_types_supported: ["code"],

    // Scopes we support
    scopes_supported: [
      // Patient-level scopes
      "patient/Patient.read",
      "patient/AllergyIntolerance.read",
      "patient/Condition.read",
      "patient/MedicationRequest.read",
      "patient/Observation.read",
      "patient/Immunization.read",
      "patient/Procedure.read",
      "patient/DiagnosticReport.read",
      "patient/CarePlan.read",
      "patient/CareTeam.read",
      "patient/Goal.read",
      "patient/DocumentReference.read",
      "patient/*.read",

      // User-level scopes (for clinician apps)
      "user/Patient.read",
      "user/*.read",

      // Launch context scopes
      "launch/patient",
      "launch",

      // OpenID Connect scopes
      "openid",
      "fhirUser",
      "profile",
      "offline_access"
    ],

    // Token endpoint auth methods
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "private_key_jwt"  // For backend apps
    ],

    // Capabilities per SMART App Launch
    capabilities: [
      "launch-standalone",           // Apps can launch independently
      "launch-ehr",                  // Apps can launch from EHR context
      "client-public",               // Public apps supported (PKCE required)
      "client-confidential-symmetric", // Confidential apps with client_secret
      "sso-openid-connect",          // OpenID Connect SSO
      "context-standalone-patient",   // Standalone apps get patient context
      "context-ehr-patient",         // EHR apps get patient context
      "permission-patient",          // Patient-level scopes
      "permission-user",             // User-level scopes
      "permission-offline"           // Refresh tokens
    ],

    // FHIR endpoints
    management_endpoint: `${baseUrl}/smart-apps`,  // App management UI
    revocation_endpoint: `${baseUrl}/smart-revoke`,

    // Registration
    registration_endpoint: `${baseUrl}/smart-register`
  };

  return new Response(JSON.stringify(smartConfiguration, null, 2), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=3600'  // Cache for 1 hour
    }
  });
});
