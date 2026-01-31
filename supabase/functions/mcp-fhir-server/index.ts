// =====================================================
// MCP FHIR Server
// Purpose: Standardized FHIR R4 resource access and operations
// Features: Bundle export, resource CRUD, validation, EHR sync
//
// TIER 3 (admin): Requires service role key for FHIR operations
// Auth: Supabase apikey + service role key + clinical role verification
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handleHealthCheck,
  PING_TOOL,
  handlePing,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyClinicalAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  CallerIdentity
} from "../_shared/mcpAuthGate.ts";

// Server configuration
const SERVER_CONFIG = {
  name: "mcp-fhir-server",
  version: "1.1.0",
  tier: "admin" as const
};

// Initialize with tiered approach - Tier 3 requires service role
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// Tier 3 requires service role - fail fast if not available
if (!initResult.supabase) {
  throw new Error(`MCP FHIR server requires service role key: ${initResult.error}`);
}

// Non-null after guard
const sb = initResult.supabase;

// =====================================================
// FHIR Resource Type Mapping
// =====================================================

const FHIR_TABLES: Record<string, string> = {
  'Patient': 'profiles',
  'MedicationRequest': 'fhir_medication_requests',
  'Condition': 'fhir_conditions',
  'DiagnosticReport': 'fhir_diagnostic_reports',
  'Procedure': 'fhir_procedures',
  'Observation': 'fhir_observations',
  'Immunization': 'fhir_immunizations',
  'CarePlan': 'fhir_care_plans',
  'CareTeam': 'fhir_care_teams',
  'Practitioner': 'fhir_practitioners',
  'PractitionerRole': 'fhir_practitioner_roles',
  'Encounter': 'fhir_encounters',
  'DocumentReference': 'fhir_document_references',
  'AllergyIntolerance': 'fhir_allergies',
  'Goal': 'fhir_goals',
  'Location': 'fhir_locations',
  'Organization': 'fhir_organizations',
  'Medication': 'fhir_medications',
};

const SUPPORTED_RESOURCES = Object.keys(FHIR_TABLES);

// =====================================================
// Type Definitions
// =====================================================

interface FHIRResource {
  resourceType?: string;
  id: string;
  [key: string]: unknown;
}

interface ProfileRecord {
  id: string;
  mrn?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at?: string;
  updated_at?: string;
}

interface PractitionerRecord {
  id: string;
  name?: string;
  specialty?: string;
  phone?: string;
  email?: string;
}

interface CareTeamParticipant {
  practitioner_id?: string;
  role?: string;
  display?: string;
}

interface PatientSummary {
  patient_id: string;
  generated_at: string;
  sections: Record<string, unknown>;
}

type ToolResult = FHIRResource | FHIRResource[] | PatientSummary | Record<string, unknown>;

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS: Record<string, { description: string; inputSchema: { type: string; properties: Record<string, unknown>; required: string[] } }> = {
  "ping": PING_TOOL,
  "export_patient_bundle": {
    description: "Export a complete FHIR Bundle for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        resources: {
          type: "array",
          items: { type: "string", enum: SUPPORTED_RESOURCES },
          description: "Resource types to include (default: all)"
        },
        start_date: { type: "string", description: "Filter start date (ISO 8601)" },
        end_date: { type: "string", description: "Filter end date (ISO 8601)" },
        include_ai_assessments: { type: "boolean", description: "Include AI risk assessments" }
      },
      required: ["patient_id"]
    }
  },
  "get_resource": {
    description: "Get a specific FHIR resource by ID",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        resource_id: { type: "string", description: "Resource UUID" }
      },
      required: ["resource_type", "resource_id"]
    }
  },
  "search_resources": {
    description: "Search FHIR resources with filters",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        patient_id: { type: "string", description: "Filter by patient" },
        status: { type: "string", description: "Filter by status" },
        category: { type: "string", description: "Filter by category" },
        code: { type: "string", description: "Filter by code" },
        date_from: { type: "string", description: "Filter from date" },
        date_to: { type: "string", description: "Filter to date" },
        limit: { type: "number", description: "Max results (default 50)" }
      },
      required: ["resource_type"]
    }
  },
  "create_resource": {
    description: "Create a new FHIR resource",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        data: { type: "object", description: "Resource data (FHIR-compliant)" },
        patient_id: { type: "string", description: "Patient to associate with" }
      },
      required: ["resource_type", "data"]
    }
  },
  "update_resource": {
    description: "Update an existing FHIR resource",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        resource_id: { type: "string", description: "Resource UUID" },
        data: { type: "object", description: "Fields to update" }
      },
      required: ["resource_type", "resource_id", "data"]
    }
  },
  "validate_resource": {
    description: "Validate FHIR resource against schema",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        data: { type: "object", description: "Resource data to validate" }
      },
      required: ["resource_type", "data"]
    }
  },
  "get_patient_summary": {
    description: "Get a clinical summary for a patient (CCD-style)",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        include_sections: {
          type: "array",
          items: {
            type: "string",
            enum: ["demographics", "conditions", "medications", "allergies", "immunizations", "vitals", "procedures", "goals", "careplans"]
          },
          description: "Sections to include (default: all)"
        }
      },
      required: ["patient_id"]
    }
  },
  "get_observations": {
    description: "Get observations/vitals for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        category: {
          type: "string",
          enum: ["vital-signs", "laboratory", "survey", "activity"],
          description: "Observation category"
        },
        code: { type: "string", description: "LOINC code filter" },
        date_from: { type: "string", description: "Filter from date" },
        date_to: { type: "string", description: "Filter to date" },
        limit: { type: "number", description: "Max results" }
      },
      required: ["patient_id"]
    }
  },
  "get_medication_list": {
    description: "Get active medications for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        status: {
          type: "string",
          enum: ["active", "completed", "stopped", "cancelled", "all"],
          description: "Medication status filter"
        },
        include_history: { type: "boolean", description: "Include historical medications" }
      },
      required: ["patient_id"]
    }
  },
  "get_condition_list": {
    description: "Get diagnoses/conditions for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        clinical_status: {
          type: "string",
          enum: ["active", "recurrence", "relapse", "inactive", "remission", "resolved"],
          description: "Clinical status filter"
        },
        category: { type: "string", description: "Category filter (problem-list-item, encounter-diagnosis)" }
      },
      required: ["patient_id"]
    }
  },
  "get_sdoh_assessments": {
    description: "Get Social Determinants of Health assessments",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        domain: {
          type: "string",
          enum: ["food-insecurity", "housing-instability", "transportation", "financial-strain", "social-isolation", "all"],
          description: "SDOH domain filter"
        }
      },
      required: ["patient_id"]
    }
  },
  "get_care_team": {
    description: "Get care team members for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        include_contact_info: { type: "boolean", description: "Include provider contact details" }
      },
      required: ["patient_id"]
    }
  },
  "list_ehr_connections": {
    description: "List configured EHR/FHIR connections",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant UUID" },
        status: { type: "string", enum: ["active", "inactive", "error"], description: "Connection status filter" }
      },
      required: []
    }
  },
  "trigger_ehr_sync": {
    description: "Trigger synchronization with external EHR",
    inputSchema: {
      type: "object",
      properties: {
        connection_id: { type: "string", description: "EHR connection UUID" },
        patient_id: { type: "string", description: "Specific patient to sync (optional)" },
        direction: { type: "string", enum: ["pull", "push", "bidirectional"], description: "Sync direction" },
        resources: { type: "array", items: { type: "string" }, description: "Resource types to sync" }
      },
      required: ["connection_id"]
    }
  }
};

// =====================================================
// FHIR Bundle Builder
// =====================================================

function createFHIRBundle(resources: FHIRResource[], type: 'searchset' | 'collection' | 'document' = 'collection') {
  return {
    resourceType: 'Bundle',
    type,
    timestamp: new Date().toISOString(),
    total: resources.length,
    entry: resources.map(resource => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource
    }))
  };
}

function toFHIRPatient(profile: ProfileRecord): FHIRResource {
  return {
    resourceType: 'Patient',
    id: profile.id,
    meta: {
      lastUpdated: profile.updated_at || profile.created_at
    },
    identifier: profile.mrn ? [{
      system: 'http://hospital.example.org/mrn',
      value: profile.mrn
    }] : undefined,
    name: [{
      use: 'official',
      family: profile.last_name,
      given: [profile.first_name, profile.middle_name].filter(Boolean)
    }],
    gender: profile.gender?.toLowerCase(),
    birthDate: profile.date_of_birth,
    telecom: [
      profile.phone && { system: 'phone', value: profile.phone },
      profile.email && { system: 'email', value: profile.email }
    ].filter(Boolean),
    address: profile.address_line1 ? [{
      line: [profile.address_line1, profile.address_line2].filter(Boolean),
      city: profile.city,
      state: profile.state,
      postalCode: profile.zip_code,
      country: 'US'
    }] : undefined
  };
}

// =====================================================
// Validation Rules
// =====================================================

const REQUIRED_FIELDS: Record<string, string[]> = {
  MedicationRequest: ['medication_name', 'patient_id', 'status'],
  Condition: ['code_display', 'patient_id', 'clinical_status'],
  Observation: ['code', 'patient_id', 'status'],
  Procedure: ['code_display', 'patient_id', 'status'],
  Immunization: ['vaccine_code', 'patient_id', 'status'],
  CarePlan: ['title', 'patient_id', 'status'],
  Goal: ['description', 'patient_id', 'lifecycle_status'],
  AllergyIntolerance: ['code_display', 'patient_id'],
  Encounter: ['patient_id', 'status', 'class_code'],
};

function validateResource(resourceType: string, data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = REQUIRED_FIELDS[resourceType] || [];

  for (const field of required) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type-specific validation
  if (resourceType === 'Observation' && data.value_quantity) {
    const valueQuantity = data.value_quantity as Record<string, unknown>;
    if (typeof valueQuantity.value !== 'number') {
      errors.push('value_quantity.value must be a number');
    }
  }

  if (resourceType === 'MedicationRequest' && data.dosage_instructions) {
    if (typeof data.dosage_instructions !== 'string') {
      errors.push('dosage_instructions must be a string');
    }
  }

  return { valid: errors.length === 0, errors };
}

// =====================================================
// Audit Logging
// =====================================================

async function logFHIROperation(params: {
  userId?: string;
  tenantId?: string;
  operation: string;
  resourceType?: string;
  resourceId?: string;
  success: boolean;
  executionTimeMs: number;
  errorMessage?: string;
}) {
  try {
    await sb.from("mcp_fhir_logs").insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      operation: params.operation,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      success: params.success,
      execution_time_ms: params.executionTimeMs,
      error_message: params.errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Fallback to claude_usage_logs
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_fhir_${params.operation}`,
        response_time_ms: params.executionTimeMs,
        success: params.success,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    } catch (innerErr: unknown) {
      logger.error("Audit log fallback failed", {
        originalError: err instanceof Error ? err.message : String(err),
        fallbackError: innerErr instanceof Error ? innerErr.message : String(innerErr)
      });
    }
  }
}

// =====================================================
// Resource Query Functions
// =====================================================

async function getPatientBundle(
  patientId: string,
  resources: string[] = SUPPORTED_RESOURCES,
  options: { startDate?: string; endDate?: string; includeAI?: boolean } = {}
) {
  const bundleResources: FHIRResource[] = [];

  // Get patient demographics
  const { data: patient, error: patientError } = await sb
    .from('profiles')
    .select('*')
    .eq('id', patientId)
    .single();

  if (patientError) {
    throw new Error(`Patient not found: ${patientError.message}`);
  }

  bundleResources.push(toFHIRPatient(patient));

  // Query each requested resource type
  for (const resourceType of resources) {
    if (resourceType === 'Patient') continue; // Already added

    const table = FHIR_TABLES[resourceType];
    if (!table) continue;

    let query = sb.from(table).select('*').eq('patient_id', patientId);

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    const { data, error } = await query.limit(100);

    if (!error && data) {
      for (const record of data) {
        bundleResources.push({
          resourceType,
          ...record
        });
      }
    }
  }

  // Include AI assessments if requested
  if (options.includeAI) {
    const { data: aiData } = await sb
      .from('ai_risk_assessments')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (aiData) {
      for (const assessment of aiData) {
        bundleResources.push({
          resourceType: 'RiskAssessment',
          id: assessment.id,
          subject: { reference: `Patient/${patientId}` },
          prediction: [{
            outcome: { text: assessment.risk_type },
            probabilityDecimal: assessment.risk_score
          }],
          basis: assessment.factors?.map((f: string) => ({ display: f })) || [],
          meta: { lastUpdated: assessment.created_at }
        });
      }
    }
  }

  return createFHIRBundle(bundleResources);
}

async function searchResources(
  resourceType: string,
  filters: {
    patientId?: string;
    status?: string;
    category?: string;
    code?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }
) {
  const table = FHIR_TABLES[resourceType];
  if (!table) {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }

  let query = sb.from(table).select('*');

  if (filters.patientId) {
    query = query.eq('patient_id', filters.patientId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.code) {
    query = query.or(`code.eq.${filters.code},code_system.eq.${filters.code}`);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query.limit(filters.limit || 50);

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return createFHIRBundle(
    (data || []).map(r => ({ resourceType, ...r })),
    'searchset'
  );
}

async function getPatientSummary(
  patientId: string,
  sections: string[] = ['demographics', 'conditions', 'medications', 'allergies', 'immunizations', 'vitals', 'procedures', 'goals', 'careplans']
) {
  const summary: PatientSummary = {
    patient_id: patientId,
    generated_at: new Date().toISOString(),
    sections: {}
  };

  // Demographics
  if (sections.includes('demographics')) {
    const { data: patient } = await sb.from('profiles').select('*').eq('id', patientId).single();
    if (patient) {
      summary.sections.demographics = {
        name: `${patient.first_name} ${patient.last_name}`,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        address: [patient.address_line1, patient.city, patient.state, patient.zip_code].filter(Boolean).join(', ')
      };
    }
  }

  // Active Conditions
  if (sections.includes('conditions')) {
    const { data } = await sb.from('fhir_conditions').select('*').eq('patient_id', patientId).eq('clinical_status', 'active').limit(20);
    summary.sections.conditions = (data || []).map(c => ({
      code: c.code,
      display: c.code_display,
      onset: c.onset_date,
      status: c.clinical_status
    }));
  }

  // Active Medications
  if (sections.includes('medications')) {
    const { data } = await sb.from('fhir_medication_requests').select('*').eq('patient_id', patientId).eq('status', 'active').limit(30);
    summary.sections.medications = (data || []).map(m => ({
      name: m.medication_name,
      dosage: m.dosage_instructions,
      status: m.status,
      prescriber: m.requester_display
    }));
  }

  // Allergies
  if (sections.includes('allergies')) {
    const { data } = await sb.from('fhir_allergies').select('*').eq('patient_id', patientId).limit(20);
    summary.sections.allergies = (data || []).map(a => ({
      allergen: a.code_display || a.substance,
      reaction: a.reaction_description,
      severity: a.criticality
    }));
  }

  // Immunizations
  if (sections.includes('immunizations')) {
    const { data } = await sb.from('fhir_immunizations').select('*').eq('patient_id', patientId).order('occurrence_date', { ascending: false }).limit(20);
    summary.sections.immunizations = (data || []).map(i => ({
      vaccine: i.vaccine_display || i.vaccine_code,
      date: i.occurrence_date,
      status: i.status
    }));
  }

  // Recent Vitals
  if (sections.includes('vitals')) {
    const { data } = await sb.from('fhir_observations').select('*').eq('patient_id', patientId).eq('category', 'vital-signs').order('effective_date', { ascending: false }).limit(20);
    summary.sections.vitals = (data || []).map(v => ({
      type: v.code_display || v.code,
      value: v.value_quantity?.value,
      unit: v.value_quantity?.unit,
      date: v.effective_date
    }));
  }

  // Recent Procedures
  if (sections.includes('procedures')) {
    const { data } = await sb.from('fhir_procedures').select('*').eq('patient_id', patientId).order('performed_date', { ascending: false }).limit(10);
    summary.sections.procedures = (data || []).map(p => ({
      name: p.code_display,
      date: p.performed_date,
      status: p.status
    }));
  }

  // Goals
  if (sections.includes('goals')) {
    const { data } = await sb.from('fhir_goals').select('*').eq('patient_id', patientId).neq('lifecycle_status', 'cancelled').limit(10);
    summary.sections.goals = (data || []).map(g => ({
      description: g.description,
      status: g.lifecycle_status,
      target_date: g.target_date
    }));
  }

  // Care Plans
  if (sections.includes('careplans')) {
    const { data } = await sb.from('fhir_care_plans').select('*').eq('patient_id', patientId).eq('status', 'active').limit(5);
    summary.sections.careplans = (data || []).map(cp => ({
      title: cp.title,
      category: cp.category,
      status: cp.status,
      period: cp.period
    }));
  }

  return summary;
}

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake (no auth required - discovery)
    if (method === "initialize") {
      return new Response(JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools (no auth required - discovery)
    if (method === "tools/list") {
      return new Response(JSON.stringify(createToolsListResponse(TOOLS, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;
      const startTime = Date.now();

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32602, message: `Unknown tool: ${toolName}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ============================================================
      // AUTH GATE: Verify caller has clinical access for FHIR operations
      // FHIR operations involve PHI and require clinical authorization
      // ============================================================
      const authResult = await verifyClinicalAccess(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger
      });

      if (!authResult.authorized) {
        logger.security("FHIR_ACCESS_DENIED", {
          requestId,
          tool: toolName,
          reason: authResult.error
        });

        if (authResult.statusCode === 401) {
          return createUnauthorizedResponse(authResult.error || "Unauthorized", requestId, corsHeaders);
        }
        return createForbiddenResponse(authResult.error || "Forbidden", requestId, corsHeaders);
      }

      const caller = authResult.caller as CallerIdentity;
      logger.info("FHIR_TOOL_CALL", {
        requestId,
        tool: toolName,
        userId: caller.userId,
        role: caller.role,
        tenantId: caller.tenantId
      });

      let result: ToolResult;

      switch (toolName) {
        case "ping": {
          result = handlePing(SERVER_CONFIG, initResult);
          break;
        }

        case "export_patient_bundle": {
          const { patient_id, resources, start_date, end_date, include_ai_assessments } = toolArgs;
          result = await getPatientBundle(patient_id, resources, {
            startDate: start_date,
            endDate: end_date,
            includeAI: include_ai_assessments
          });
          break;
        }

        case "get_resource": {
          const { resource_type, resource_id } = toolArgs;
          const table = FHIR_TABLES[resource_type];
          if (!table) throw new Error(`Unknown resource type: ${resource_type}`);

          const { data, error } = await sb.from(table).select('*').eq('id', resource_id).single();
          if (error) throw new Error(`Resource not found: ${error.message}`);
          result = { resourceType: resource_type, ...data };
          break;
        }

        case "search_resources": {
          const { resource_type, patient_id, status, category, code, date_from, date_to, limit } = toolArgs;
          result = await searchResources(resource_type, {
            patientId: patient_id,
            status,
            category,
            code,
            dateFrom: date_from,
            dateTo: date_to,
            limit
          });
          break;
        }

        case "create_resource": {
          const { resource_type, data, patient_id } = toolArgs;
          const table = FHIR_TABLES[resource_type];
          if (!table) throw new Error(`Unknown resource type: ${resource_type}`);

          // Validate
          const validation = validateResource(resource_type, { ...data, patient_id });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
          }

          const { data: created, error } = await sb.from(table).insert({
            ...data,
            patient_id,
            created_at: new Date().toISOString()
          }).select().single();

          if (error) throw new Error(`Create failed: ${error.message}`);
          result = { resourceType: resource_type, ...created };
          break;
        }

        case "update_resource": {
          const { resource_type, resource_id, data } = toolArgs;
          const table = FHIR_TABLES[resource_type];
          if (!table) throw new Error(`Unknown resource type: ${resource_type}`);

          const { data: updated, error } = await sb.from(table).update({
            ...data,
            updated_at: new Date().toISOString()
          }).eq('id', resource_id).select().single();

          if (error) throw new Error(`Update failed: ${error.message}`);
          result = { resourceType: resource_type, ...updated };
          break;
        }

        case "validate_resource": {
          const { resource_type, data } = toolArgs;
          result = validateResource(resource_type, data);
          break;
        }

        case "get_patient_summary": {
          const { patient_id, include_sections } = toolArgs;
          result = await getPatientSummary(patient_id, include_sections);
          break;
        }

        case "get_observations": {
          const { patient_id, category, code, date_from, date_to, limit } = toolArgs;

          let query = sb.from('fhir_observations').select('*').eq('patient_id', patient_id);
          if (category) query = query.eq('category', category);
          if (code) query = query.eq('code', code);
          if (date_from) query = query.gte('effective_date', date_from);
          if (date_to) query = query.lte('effective_date', date_to);

          const { data, error } = await query.order('effective_date', { ascending: false }).limit(limit || 50);
          if (error) throw new Error(`Query failed: ${error.message}`);

          result = createFHIRBundle((data || []).map(r => ({ resourceType: 'Observation', ...r })), 'searchset');
          break;
        }

        case "get_medication_list": {
          const { patient_id, status, include_history } = toolArgs;

          let query = sb.from('fhir_medication_requests').select('*').eq('patient_id', patient_id);

          if (status && status !== 'all') {
            query = query.eq('status', status);
          } else if (!include_history) {
            query = query.in('status', ['active', 'on-hold']);
          }

          const { data, error } = await query.order('authored_on', { ascending: false }).limit(100);
          if (error) throw new Error(`Query failed: ${error.message}`);

          result = {
            patient_id,
            medications: (data || []).map(m => ({
              id: m.id,
              name: m.medication_name,
              dosage: m.dosage_instructions,
              frequency: m.frequency,
              route: m.route,
              status: m.status,
              prescriber: m.requester_display,
              start_date: m.authored_on,
              end_date: m.end_date
            })),
            total: data?.length || 0
          };
          break;
        }

        case "get_condition_list": {
          const { patient_id, clinical_status, category } = toolArgs;

          let query = sb.from('fhir_conditions').select('*').eq('patient_id', patient_id);
          if (clinical_status) query = query.eq('clinical_status', clinical_status);
          if (category) query = query.eq('category', category);

          const { data, error } = await query.order('recorded_date', { ascending: false }).limit(50);
          if (error) throw new Error(`Query failed: ${error.message}`);

          result = {
            patient_id,
            conditions: (data || []).map(c => ({
              id: c.id,
              code: c.code,
              display: c.code_display,
              system: c.code_system,
              clinical_status: c.clinical_status,
              verification_status: c.verification_status,
              severity: c.severity,
              onset_date: c.onset_date,
              recorded_date: c.recorded_date
            })),
            total: data?.length || 0
          };
          break;
        }

        case "get_sdoh_assessments": {
          const { patient_id, domain } = toolArgs;

          // Query SDOH observations
          let query = sb.from('fhir_observations')
            .select('*')
            .eq('patient_id', patient_id)
            .eq('category', 'sdoh');

          const { data: observations, error } = await query.order('effective_date', { ascending: false }).limit(50);

          // Also check sdoh_flags table
          const { data: flags } = await sb.from('sdoh_flags')
            .select('*')
            .eq('patient_id', patient_id)
            .eq('resolved', false)
            .limit(20);

          if (error) throw new Error(`Query failed: ${error.message}`);

          result = {
            patient_id,
            assessments: (observations || []).map(o => ({
              id: o.id,
              code: o.code,
              display: o.code_display,
              value: o.value_codeable_concept || o.value_string,
              date: o.effective_date
            })),
            active_flags: (flags || []).map(f => ({
              id: f.id,
              type: f.flag_type,
              severity: f.severity,
              description: f.description,
              detected_date: f.detected_date
            })),
            total_assessments: observations?.length || 0,
            total_flags: flags?.length || 0
          };
          break;
        }

        case "get_care_team": {
          const { patient_id, include_contact_info } = toolArgs;

          const { data: careTeams, error } = await sb.from('fhir_care_teams')
            .select('*')
            .eq('patient_id', patient_id)
            .eq('status', 'active');

          if (error) throw new Error(`Query failed: ${error.message}`);

          // Get practitioner details if contact info requested
          let practitioners: PractitionerRecord[] = [];
          if (include_contact_info && careTeams?.length) {
            const practitionerIds = careTeams.flatMap(ct =>
              (ct.participants as CareTeamParticipant[] | undefined)?.map((p: CareTeamParticipant) => p.practitioner_id).filter(Boolean) || []
            );

            if (practitionerIds.length) {
              const { data } = await sb.from('fhir_practitioners')
                .select('*')
                .in('id', practitionerIds);
              practitioners = (data || []) as PractitionerRecord[];
            }
          }

          const practitionerMap = new Map(practitioners.map((p: PractitionerRecord) => [p.id, p]));

          result = {
            patient_id,
            care_teams: (careTeams || []).map(ct => ({
              id: ct.id,
              name: ct.name,
              category: ct.category,
              status: ct.status,
              members: (ct.participants as CareTeamParticipant[] | undefined)?.map((p: CareTeamParticipant) => {
                const pract = practitionerMap.get(p.practitioner_id || '');
                return {
                  role: p.role,
                  name: p.display || pract?.name,
                  specialty: pract?.specialty,
                  phone: include_contact_info ? pract?.phone : undefined,
                  email: include_contact_info ? pract?.email : undefined
                };
              }) || []
            }))
          };
          break;
        }

        case "list_ehr_connections": {
          const { tenant_id, status } = toolArgs;

          let query = sb.from('fhir_connections').select('id, name, ehr_type, base_url, status, sync_mode, sync_frequency, last_sync_at, created_at');
          if (tenant_id) query = query.eq('tenant_id', tenant_id);
          if (status) query = query.eq('status', status);

          const { data, error } = await query.order('name');
          if (error) throw new Error(`Query failed: ${error.message}`);

          result = {
            connections: (data || []).map(c => ({
              id: c.id,
              name: c.name,
              ehr_type: c.ehr_type,
              base_url: c.base_url,
              status: c.status,
              sync_mode: c.sync_mode,
              sync_frequency: c.sync_frequency,
              last_sync: c.last_sync_at
            })),
            total: data?.length || 0
          };
          break;
        }

        case "trigger_ehr_sync": {
          const { connection_id, patient_id, direction, resources } = toolArgs;

          // Get connection details
          const { data: connection, error: connError } = await sb.from('fhir_connections')
            .select('*')
            .eq('id', connection_id)
            .single();

          if (connError || !connection) {
            throw new Error(`Connection not found: ${connError?.message}`);
          }

          // Log sync request
          const { data: syncLog, error: logError } = await sb.from('fhir_sync_logs').insert({
            connection_id,
            patient_id,
            direction: direction || connection.sync_mode,
            resource_types: resources || ['all'],
            status: 'pending',
            initiated_at: new Date().toISOString()
          }).select().single();

          if (logError) throw new Error(`Failed to create sync log: ${logError.message}`);

          result = {
            sync_id: syncLog?.id,
            connection_id,
            direction: direction || connection.sync_mode,
            status: 'initiated',
            message: 'Sync request queued. Check fhir_sync_logs for status.'
          };
          break;
        }

        default:
          throw new Error(`Tool ${toolName} not implemented`);
      }

      const executionTimeMs = Date.now() - startTime;

      // Audit log with caller identity
      await logFHIROperation({
        userId: caller.userId,
        tenantId: caller.tenantId || toolArgs.tenant_id,
        operation: toolName,
        resourceType: toolArgs.resource_type,
        resourceId: toolArgs.resource_id || toolArgs.patient_id,
        success: true,
        executionTimeMs
      });

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          metadata: {
            tool: toolName,
            executionTimeMs,
            requestId,
            caller: {
              userId: caller.userId,
              role: caller.role
            }
          }
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Unknown MCP method: ${method}`, data: { requestId } },
      id: null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("FHIR_SERVER_ERROR", { requestId, errorMessage });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: errorMessage,
        data: { requestId }
      },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
