// =====================================================
// MCP NPI Registry Server
// Purpose: National Provider Identifier validation and lookup
// Features: NPI search, validation, provider details, taxonomy codes
// API: CMS NPI Registry API (https://npiregistry.cms.hhs.gov/api)
//
// TIER 1 (external_api): No Supabase required - calls public CMS API
// Auth: Supabase apikey header only (for edge function access)
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { getRequestIdentifier } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  handlePing,
  handleHealthCheck,
  checkInMemoryRateLimit,
  PING_TOOL
} from "../_shared/mcpServerBase.ts";
import { getRequestId } from "../_shared/mcpAuthGate.ts";

// Initialize as Tier 1 (external_api) - no Supabase required
const SERVER_CONFIG = {
  name: "mcp-npi-registry-server",
  version: "1.1.0",
  tier: "external_api" as const
};

const initResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

// CMS NPI Registry API
const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api";
const NPI_API_VERSION = "2.1";

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
  "validate_npi": {
    description: "Validate an NPI number and check if it is active",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number to validate" }
      },
      required: ["npi"]
    }
  },
  "lookup_npi": {
    description: "Get detailed provider information for an NPI number",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number" }
      },
      required: ["npi"]
    }
  },
  "search_providers": {
    description: "Search for healthcare providers by name, specialty, or location",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "Provider first name (for individuals)" },
        last_name: { type: "string", description: "Provider last name (for individuals)" },
        organization_name: { type: "string", description: "Organization name (for organizations)" },
        taxonomy_description: { type: "string", description: "Provider specialty/taxonomy" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State abbreviation (e.g., 'TX')" },
        postal_code: { type: "string", description: "ZIP code" },
        enumeration_type: {
          type: "string",
          enum: ["NPI-1", "NPI-2"],
          description: "NPI-1 for individuals, NPI-2 for organizations"
        },
        limit: { type: "number", description: "Max results (default 20, max 200)" }
      },
      required: []
    }
  },
  "search_by_specialty": {
    description: "Search providers by healthcare specialty taxonomy code",
    inputSchema: {
      type: "object",
      properties: {
        taxonomy_code: { type: "string", description: "Healthcare Provider Taxonomy Code" },
        state: { type: "string", description: "State abbreviation" },
        city: { type: "string", description: "City" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["taxonomy_code"]
    }
  },
  "get_taxonomy_codes": {
    description: "Get healthcare provider taxonomy codes for a specialty",
    inputSchema: {
      type: "object",
      properties: {
        specialty: { type: "string", description: "Specialty description to search" },
        category: {
          type: "string",
          enum: ["individual", "organization", "all"],
          description: "Provider category filter"
        }
      },
      required: ["specialty"]
    }
  },
  "bulk_validate_npis": {
    description: "Validate multiple NPI numbers in a single request",
    inputSchema: {
      type: "object",
      properties: {
        npis: {
          type: "array",
          items: { type: "string" },
          description: "Array of NPI numbers to validate (max 50)"
        }
      },
      required: ["npis"]
    }
  },
  "get_provider_identifiers": {
    description: "Get all identifier numbers for a provider (state licenses, DEA, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number" }
      },
      required: ["npi"]
    }
  },
  "check_npi_deactivation": {
    description: "Check if an NPI has been deactivated and get deactivation details",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number" }
      },
      required: ["npi"]
    }
  },
  "ping": PING_TOOL
};

// =====================================================
// Common Healthcare Taxonomy Codes
// =====================================================

const TAXONOMY_CODES: Record<string, {
  code: string;
  type: string;
  classification: string;
  specialization?: string;
}> = {
  "internal_medicine": { code: "207R00000X", type: "individual", classification: "Internal Medicine" },
  "family_medicine": { code: "207Q00000X", type: "individual", classification: "Family Medicine" },
  "cardiology": { code: "207RC0000X", type: "individual", classification: "Internal Medicine", specialization: "Cardiovascular Disease" },
  "orthopedic_surgery": { code: "207X00000X", type: "individual", classification: "Orthopaedic Surgery" },
  "neurology": { code: "2084N0400X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Neurology" },
  "pediatrics": { code: "208000000X", type: "individual", classification: "Pediatrics" },
  "ob_gyn": { code: "207V00000X", type: "individual", classification: "Obstetrics & Gynecology" },
  "psychiatry": { code: "2084P0800X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Psychiatry" },
  "emergency_medicine": { code: "207P00000X", type: "individual", classification: "Emergency Medicine" },
  "general_surgery": { code: "208600000X", type: "individual", classification: "Surgery" },
  "dermatology": { code: "207N00000X", type: "individual", classification: "Dermatology" },
  "radiology": { code: "2085R0202X", type: "individual", classification: "Radiology", specialization: "Diagnostic Radiology" },
  "anesthesiology": { code: "207L00000X", type: "individual", classification: "Anesthesiology" },
  "nursing": { code: "163W00000X", type: "individual", classification: "Nursing" },
  "nurse_practitioner": { code: "363L00000X", type: "individual", classification: "Nurse Practitioner" },
  "physician_assistant": { code: "363A00000X", type: "individual", classification: "Physician Assistant" },
  "physical_therapy": { code: "225100000X", type: "individual", classification: "Physical Therapist" },
  "occupational_therapy": { code: "225X00000X", type: "individual", classification: "Occupational Therapist" },
  "hospital": { code: "282N00000X", type: "organization", classification: "General Acute Care Hospital" },
  "clinic": { code: "261QM1300X", type: "organization", classification: "Clinic/Center", specialization: "Multi-Specialty" },
  "pharmacy": { code: "333600000X", type: "organization", classification: "Pharmacy" },
  "home_health": { code: "251E00000X", type: "organization", classification: "Home Health" },
  "skilled_nursing": { code: "314000000X", type: "organization", classification: "Skilled Nursing Facility" },
  "dme_supplier": { code: "332B00000X", type: "organization", classification: "Durable Medical Equipment & Medical Supplies" }
};

// =====================================================
// NPI Validation Algorithm (Luhn Check)
// =====================================================

function isValidNPIFormat(npi: string): boolean {
  // NPI must be exactly 10 digits
  if (!/^\d{10}$/.test(npi)) {
    return false;
  }

  // Luhn algorithm check (ISO standard check digit)
  // Prefix with "80840" for healthcare industry code
  const prefixedNPI = "80840" + npi;
  let sum = 0;
  let alternate = false;

  for (let i = prefixedNPI.length - 1; i >= 0; i--) {
    let digit = parseInt(prefixedNPI[i], 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

// =====================================================
// NPI Registry API Integration
// =====================================================

async function callNPIRegistry(params: Record<string, string | number>): Promise<{
  result_count: number;
  results: Array<Record<string, unknown>>;
}> {
  const searchParams = new URLSearchParams();
  searchParams.set("version", NPI_API_VERSION);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  try {
    const response = await fetch(`${NPI_API_BASE}/?${searchParams.toString()}`);

    if (!response.ok) {
      throw new Error(`NPI Registry API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("NPI Registry API call failed", { errorMessage: error.message });

    // Return empty result on error
    return { result_count: 0, results: [] };
  }
}

// =====================================================
// Tool Handlers
// =====================================================

async function validateNPI(params: { npi: string }): Promise<{
  npi: string;
  valid_format: boolean;
  is_active: boolean;
  provider_name?: string;
  enumeration_type?: string;
  status: string;
  validation_message: string;
}> {
  const { npi } = params;

  // First check format validity
  const validFormat = isValidNPIFormat(npi);

  if (!validFormat) {
    return {
      npi,
      valid_format: false,
      is_active: false,
      status: "invalid",
      validation_message: "NPI format is invalid. NPIs must be 10 digits and pass Luhn check."
    };
  }

  // Query NPI Registry
  const result = await callNPIRegistry({ number: npi });

  if (result.result_count === 0) {
    return {
      npi,
      valid_format: true,
      is_active: false,
      status: "not_found",
      validation_message: "NPI format is valid but not found in the NPI Registry."
    };
  }

  const provider = result.results[0];
  const basic = provider.basic as Record<string, unknown> || {};
  const enumType = provider.enumeration_type as string;

  // Determine provider name
  let providerName: string;
  if (enumType === "NPI-1") {
    providerName = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
  } else {
    providerName = (basic.organization_name as string) || "Unknown Organization";
  }

  // Check status
  const status = basic.status as string || "A";
  const isActive = status === "A";

  return {
    npi,
    valid_format: true,
    is_active: isActive,
    provider_name: providerName,
    enumeration_type: enumType,
    status: isActive ? "active" : "deactivated",
    validation_message: isActive
      ? `NPI is valid and active for ${providerName}`
      : `NPI is valid but has been deactivated`
  };
}

async function lookupNPI(params: { npi: string }): Promise<{
  found: boolean;
  npi: string;
  provider?: {
    name: string;
    type: string;
    credential?: string;
    gender?: string;
    sole_proprietor?: boolean;
    enumeration_date: string;
    last_updated: string;
    status: string;
    taxonomies: Array<{
      code: string;
      description: string;
      primary: boolean;
      state?: string;
      license?: string;
    }>;
    addresses: Array<{
      type: string;
      address_1: string;
      address_2?: string;
      city: string;
      state: string;
      postal_code: string;
      telephone?: string;
      fax?: string;
    }>;
    identifiers: Array<{
      identifier: string;
      type: string;
      state?: string;
      issuer?: string;
    }>;
  };
}> {
  const { npi } = params;

  const result = await callNPIRegistry({ number: npi });

  if (result.result_count === 0) {
    return { found: false, npi };
  }

  const p = result.results[0];
  const basic = p.basic as Record<string, unknown> || {};
  const enumType = p.enumeration_type as string;

  // Parse name
  let name: string;
  let credential: string | undefined;
  if (enumType === "NPI-1") {
    name = `${basic.first_name || ""} ${basic.middle_name || ""} ${basic.last_name || ""}`.replace(/\s+/g, " ").trim();
    credential = basic.credential as string | undefined;
  } else {
    name = (basic.organization_name as string) || "Unknown";
  }

  // Parse taxonomies
  const taxonomies = ((p.taxonomies as Array<Record<string, unknown>>) || []).map(t => ({
    code: t.code as string,
    description: t.desc as string,
    primary: t.primary as boolean,
    state: t.state as string | undefined,
    license: t.license as string | undefined
  }));

  // Parse addresses
  const addresses = ((p.addresses as Array<Record<string, unknown>>) || []).map(a => ({
    type: a.address_purpose as string,
    address_1: a.address_1 as string,
    address_2: a.address_2 as string | undefined,
    city: a.city as string,
    state: a.state as string,
    postal_code: a.postal_code as string,
    telephone: a.telephone_number as string | undefined,
    fax: a.fax_number as string | undefined
  }));

  // Parse identifiers
  const identifiers = ((p.identifiers as Array<Record<string, unknown>>) || []).map(i => ({
    identifier: i.identifier as string,
    type: i.desc as string,
    state: i.state as string | undefined,
    issuer: i.issuer as string | undefined
  }));

  return {
    found: true,
    npi,
    provider: {
      name,
      type: enumType === "NPI-1" ? "Individual" : "Organization",
      credential,
      gender: basic.gender as string | undefined,
      sole_proprietor: basic.sole_proprietor === "YES",
      enumeration_date: basic.enumeration_date as string,
      last_updated: basic.last_updated as string,
      status: (basic.status as string) === "A" ? "Active" : "Deactivated",
      taxonomies,
      addresses,
      identifiers
    }
  };
}

async function searchProviders(params: {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  taxonomy_description?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  enumeration_type?: string;
  limit?: number;
}): Promise<{
  total_results: number;
  providers: Array<{
    npi: string;
    name: string;
    type: string;
    specialty?: string;
    city?: string;
    state?: string;
    phone?: string;
  }>;
}> {
  const { limit = 20, ...searchParams } = params;

  const apiParams: Record<string, string | number> = { limit: Math.min(limit, 200) };

  if (searchParams.first_name) apiParams.first_name = searchParams.first_name;
  if (searchParams.last_name) apiParams.last_name = searchParams.last_name;
  if (searchParams.organization_name) apiParams.organization_name = searchParams.organization_name;
  if (searchParams.taxonomy_description) apiParams.taxonomy_description = searchParams.taxonomy_description;
  if (searchParams.city) apiParams.city = searchParams.city;
  if (searchParams.state) apiParams.state = searchParams.state;
  if (searchParams.postal_code) apiParams.postal_code = searchParams.postal_code;
  if (searchParams.enumeration_type) apiParams.enumeration_type = searchParams.enumeration_type;

  const result = await callNPIRegistry(apiParams);

  const providers = result.results.map(p => {
    const basic = p.basic as Record<string, unknown> || {};
    const enumType = p.enumeration_type as string;
    const taxonomies = (p.taxonomies as Array<Record<string, unknown>>) || [];
    const addresses = (p.addresses as Array<Record<string, unknown>>) || [];

    let name: string;
    if (enumType === "NPI-1") {
      name = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
    } else {
      name = (basic.organization_name as string) || "Unknown";
    }

    const primaryTaxonomy = taxonomies.find(t => t.primary) || taxonomies[0];
    const locationAddr = addresses.find(a => a.address_purpose === "LOCATION") || addresses[0];

    return {
      npi: p.number as string,
      name,
      type: enumType === "NPI-1" ? "Individual" : "Organization",
      specialty: primaryTaxonomy?.desc as string | undefined,
      city: locationAddr?.city as string | undefined,
      state: locationAddr?.state as string | undefined,
      phone: locationAddr?.telephone_number as string | undefined
    };
  });

  return {
    total_results: result.result_count,
    providers
  };
}

async function searchBySpecialty(params: {
  taxonomy_code: string;
  state?: string;
  city?: string;
  limit?: number;
}): Promise<{
  total_results: number;
  taxonomy_code: string;
  taxonomy_description?: string;
  providers: Array<{
    npi: string;
    name: string;
    city?: string;
    state?: string;
  }>;
}> {
  const { taxonomy_code, state, city, limit = 20 } = params;

  const apiParams: Record<string, string | number> = {
    taxonomy_description: taxonomy_code,
    limit: Math.min(limit, 200)
  };

  if (state) apiParams.state = state;
  if (city) apiParams.city = city;

  const result = await callNPIRegistry(apiParams);

  const providers = result.results.map(p => {
    const basic = p.basic as Record<string, unknown> || {};
    const enumType = p.enumeration_type as string;
    const addresses = (p.addresses as Array<Record<string, unknown>>) || [];
    const locationAddr = addresses.find(a => a.address_purpose === "LOCATION") || addresses[0];

    let name: string;
    if (enumType === "NPI-1") {
      name = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
    } else {
      name = (basic.organization_name as string) || "Unknown";
    }

    return {
      npi: p.number as string,
      name,
      city: locationAddr?.city as string | undefined,
      state: locationAddr?.state as string | undefined
    };
  });

  // Get taxonomy description from first result
  let taxonomyDescription: string | undefined;
  if (result.results.length > 0) {
    const taxonomies = (result.results[0].taxonomies as Array<Record<string, unknown>>) || [];
    const matchingTax = taxonomies.find(t => t.code === taxonomy_code);
    taxonomyDescription = matchingTax?.desc as string | undefined;
  }

  return {
    total_results: result.result_count,
    taxonomy_code,
    taxonomy_description: taxonomyDescription,
    providers
  };
}

async function getTaxonomyCodes(params: {
  specialty: string;
  category?: string;
}): Promise<{
  specialty: string;
  matches: Array<{
    code: string;
    type: string;
    classification: string;
    specialization?: string;
  }>;
}> {
  const { specialty, category = "all" } = params;
  const searchTerm = specialty.toLowerCase().replace(/[^a-z0-9]/g, "_");

  // Search our taxonomy database
  const matches = Object.entries(TAXONOMY_CODES)
    .filter(([key, value]) => {
      const matchesSearch = key.includes(searchTerm) ||
        value.classification.toLowerCase().includes(specialty.toLowerCase()) ||
        (value.specialization?.toLowerCase().includes(specialty.toLowerCase()));

      const matchesCategory = category === "all" || value.type === category;

      return matchesSearch && matchesCategory;
    })
    .map(([_, value]) => value);

  return {
    specialty,
    matches
  };
}

async function bulkValidateNPIs(params: { npis: string[] }): Promise<{
  total: number;
  valid: number;
  invalid: number;
  results: Array<{
    npi: string;
    valid: boolean;
    status: string;
    provider_name?: string;
  }>;
}> {
  const { npis } = params;
  const limitedNPIs = npis.slice(0, 50); // Max 50 NPIs

  const results = await Promise.all(
    limitedNPIs.map(async npi => {
      const validation = await validateNPI({ npi });
      return {
        npi,
        valid: validation.valid_format && validation.is_active,
        status: validation.status,
        provider_name: validation.provider_name
      };
    })
  );

  const validCount = results.filter(r => r.valid).length;

  return {
    total: results.length,
    valid: validCount,
    invalid: results.length - validCount,
    results
  };
}

async function getProviderIdentifiers(params: { npi: string }): Promise<{
  npi: string;
  found: boolean;
  identifiers: Array<{
    type: string;
    identifier: string;
    state?: string;
    issuer?: string;
  }>;
}> {
  const lookupResult = await lookupNPI(params);

  if (!lookupResult.found || !lookupResult.provider) {
    return { npi: params.npi, found: false, identifiers: [] };
  }

  return {
    npi: params.npi,
    found: true,
    identifiers: lookupResult.provider.identifiers
  };
}

async function checkNPIDeactivation(params: { npi: string }): Promise<{
  npi: string;
  is_deactivated: boolean;
  deactivation_date?: string;
  reactivation_date?: string;
  reason?: string;
  provider_name?: string;
}> {
  const validation = await validateNPI(params);

  return {
    npi: params.npi,
    is_deactivated: validation.valid_format && !validation.is_active,
    provider_name: validation.provider_name,
    reason: validation.is_active ? undefined : "Provider has been deactivated in NPI Registry"
  };
}

// =====================================================
// MCP Protocol Handlers
// =====================================================

async function handleToolsListRequest(): Promise<Response> {
  const tools = Object.entries(TOOLS).map(([name, def]) => ({
    name,
    description: def.description,
    inputSchema: def.inputSchema
  }));

  return new Response(JSON.stringify({ tools }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleToolCallRequest(
  toolName: string,
  args: Record<string, unknown>
): Promise<Response> {
  let result: unknown;

  switch (toolName) {
    case "validate_npi":
      result = await validateNPI(args as Parameters<typeof validateNPI>[0]);
      break;
    case "lookup_npi":
      result = await lookupNPI(args as Parameters<typeof lookupNPI>[0]);
      break;
    case "search_providers":
      result = await searchProviders(args as Parameters<typeof searchProviders>[0]);
      break;
    case "search_by_specialty":
      result = await searchBySpecialty(args as Parameters<typeof searchBySpecialty>[0]);
      break;
    case "get_taxonomy_codes":
      result = await getTaxonomyCodes(args as Parameters<typeof getTaxonomyCodes>[0]);
      break;
    case "bulk_validate_npis":
      result = await bulkValidateNPIs(args as Parameters<typeof bulkValidateNPIs>[0]);
      break;
    case "get_provider_identifiers":
      result = await getProviderIdentifiers(args as Parameters<typeof getProviderIdentifiers>[0]);
      break;
    case "check_npi_deactivation":
      result = await checkNPIDeactivation(args as Parameters<typeof checkNPIDeactivation>[0]);
      break;
    default:
      return new Response(JSON.stringify({ error: `Unknown tool: ${toolName}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
  }

  return new Response(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// =====================================================
// Main Handler (MCP JSON-RPC Protocol)
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Handle GET /health for infrastructure monitoring
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    // Rate limiting (in-memory fallback since we don't require Supabase)
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkInMemoryRateLimit(identifier, 100, 60000); // 100 req/min

    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Rate limit exceeded" },
        id: null
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
        }
      });
    }

    // Parse JSON-RPC request
    const body = await req.json();
    const { method, params, id } = body;

    // Handle MCP JSON-RPC methods
    switch (method) {
      case "initialize": {
        return new Response(JSON.stringify(
          createInitializeResponse(SERVER_CONFIG, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/list": {
        return new Response(JSON.stringify(
          createToolsListResponse(TOOLS, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        logger.info("NPI Registry tool call", { tool: name });

        // Handle ping tool specially
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, { supabase: null, logger, canRateLimit });
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(pingResult, null, 2) }]
            },
            id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const response = await handleToolCallRequest(name, args || {});
        const responseBody = await response.text();
        const result = JSON.parse(responseBody);

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            ...result,
            metadata: {
              tool: name,
              executionTimeMs: Date.now() - startTime
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify(
          createErrorResponse(-32601, `Method not found: ${method}`, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("NPI Registry server error", { errorMessage: error.message, requestId });

    const errorResponse = createErrorResponse(-32603, error.message, null);
    return new Response(JSON.stringify({
      ...errorResponse,
      error: {
        ...(errorResponse.error as Record<string, unknown>),
        data: { requestId }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
