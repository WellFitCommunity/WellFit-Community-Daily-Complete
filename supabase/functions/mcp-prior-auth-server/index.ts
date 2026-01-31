// =====================================================
// MCP Prior Authorization API Server
// CMS-0057-F Compliance (January 2027 Mandate)
// Purpose: FHIR-based Prior Authorization API
// Features: Submit PA, check status, manage appeals
// Standards: Da Vinci PAS IG, HL7 FHIR R4
//
// TIER 3 (admin): Requires service role key for database writes
// Auth: Supabase apikey + service role key + clinical role verification
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkMCPRateLimit, getRequestIdentifier, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  handlePing,
  handleHealthCheck,
  PING_TOOL,
  MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyClinicalAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  CallerIdentity
} from "../_shared/mcpAuthGate.ts";

// Initialize as Tier 3 (admin) - requires service role key for DB writes
const SERVER_CONFIG = {
  name: "mcp-prior-auth-server",
  version: "1.1.0",
  tier: "admin" as const
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

// If init failed, this server cannot operate
if (!initResult.supabase) {
  throw new Error(`MCP Prior Auth server requires service role key: ${initResult.error}`);
}

// Non-null after guard - TypeScript needs this explicit assignment
const sb = initResult.supabase;

// =====================================================
// Types
// =====================================================

type PriorAuthStatus =
  | 'draft'
  | 'pending_submission'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'denied'
  | 'partial_approval'
  | 'pending_additional_info'
  | 'cancelled'
  | 'expired'
  | 'appealed';

type PriorAuthUrgency = 'stat' | 'urgent' | 'routine';

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
  "create_prior_auth": {
    description: "Create a new prior authorization request",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        payer_id: { type: "string", description: "Payer identifier" },
        service_codes: {
          type: "array",
          items: { type: "string" },
          description: "CPT/HCPCS codes requiring authorization"
        },
        diagnosis_codes: {
          type: "array",
          items: { type: "string" },
          description: "ICD-10 diagnosis codes"
        },
        urgency: {
          type: "string",
          enum: ["stat", "urgent", "routine"],
          description: "Request urgency (stat=4hr, urgent=72hr, routine=7days)"
        },
        ordering_provider_npi: { type: "string", description: "Ordering provider NPI" },
        rendering_provider_npi: { type: "string", description: "Rendering provider NPI" },
        facility_npi: { type: "string", description: "Facility NPI" },
        payer_name: { type: "string", description: "Payer name" },
        member_id: { type: "string", description: "Member ID" },
        date_of_service: { type: "string", description: "Date of service (YYYY-MM-DD)" },
        clinical_notes: { type: "string", description: "Clinical justification" },
        requested_units: { type: "number", description: "Requested units" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["patient_id", "payer_id", "service_codes", "diagnosis_codes", "tenant_id"]
    }
  },
  "submit_prior_auth": {
    description: "Submit a prior authorization request to the payer",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" }
      },
      required: ["prior_auth_id"]
    }
  },
  "get_prior_auth": {
    description: "Get prior authorization details by ID or auth number",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        auth_number: { type: "string", description: "Authorization number" }
      }
    }
  },
  "get_patient_prior_auths": {
    description: "Get all prior authorizations for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        status: {
          type: "string",
          enum: ["all", "active", "pending", "completed"],
          description: "Status filter"
        }
      },
      required: ["patient_id"]
    }
  },
  "record_decision": {
    description: "Record a payer decision on a prior authorization",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        decision_type: {
          type: "string",
          enum: ["approved", "denied", "partial_approval", "pended", "cancelled"],
          description: "Decision type"
        },
        auth_number: { type: "string", description: "Authorization number (for approvals)" },
        approved_units: { type: "number", description: "Approved units" },
        approved_start_date: { type: "string", description: "Approval start date" },
        approved_end_date: { type: "string", description: "Approval end date (expiration)" },
        denial_reason_code: { type: "string", description: "Denial reason code" },
        denial_reason_description: { type: "string", description: "Denial reason text" },
        appeal_deadline: { type: "string", description: "Appeal deadline date" },
        decision_reason: { type: "string", description: "Decision notes" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["prior_auth_id", "decision_type", "tenant_id"]
    }
  },
  "create_appeal": {
    description: "Create an appeal for a denied prior authorization",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        decision_id: { type: "string", description: "Decision UUID to appeal" },
        appeal_reason: { type: "string", description: "Reason for appeal" },
        appeal_type: {
          type: "string",
          enum: ["reconsideration", "peer_to_peer", "external_review"],
          description: "Type of appeal"
        },
        clinical_rationale: { type: "string", description: "Clinical rationale" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["prior_auth_id", "appeal_reason", "tenant_id"]
    }
  },
  "check_prior_auth_required": {
    description: "Check if prior authorization is required for a claim",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        service_codes: {
          type: "array",
          items: { type: "string" },
          description: "CPT/HCPCS codes"
        },
        date_of_service: { type: "string", description: "Date of service" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["patient_id", "service_codes", "date_of_service", "tenant_id"]
    }
  },
  "get_pending_prior_auths": {
    description: "Get pending prior authorizations approaching deadline",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant UUID" },
        hours_threshold: { type: "number", description: "Hours until deadline (default 24)" }
      },
      required: ["tenant_id"]
    }
  },
  "get_prior_auth_statistics": {
    description: "Get prior authorization statistics for dashboard",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant UUID" },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" }
      },
      required: ["tenant_id"]
    }
  },
  "cancel_prior_auth": {
    description: "Cancel a prior authorization request",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        reason: { type: "string", description: "Cancellation reason" }
      },
      required: ["prior_auth_id"]
    }
  },
  "to_fhir_claim": {
    description: "Convert prior authorization to FHIR Claim resource (Da Vinci PAS)",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" }
      },
      required: ["prior_auth_id"]
    }
  }
};

// =====================================================
// Tool Handlers
// =====================================================

async function handleCreatePriorAuth(args: Record<string, unknown>) {
  const now = new Date();

  const { data, error } = await sb
    .from('prior_authorizations')
    .insert({
      patient_id: args.patient_id,
      payer_id: args.payer_id,
      payer_name: args.payer_name,
      member_id: args.member_id,
      service_codes: args.service_codes,
      diagnosis_codes: args.diagnosis_codes,
      urgency: args.urgency || 'routine',
      ordering_provider_npi: args.ordering_provider_npi,
      rendering_provider_npi: args.rendering_provider_npi,
      facility_npi: args.facility_npi,
      date_of_service: args.date_of_service,
      clinical_notes: args.clinical_notes,
      requested_units: args.requested_units,
      status: 'draft',
      tenant_id: args.tenant_id,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  logger.info('PRIOR_AUTH_CREATED', {
    prior_auth_id: data.id,
    patient_id: args.patient_id as string,
    payer_id: args.payer_id as string,
    service_codes: args.service_codes as string[]
  });

  return {
    prior_auth: data,
    message: 'Prior authorization created successfully',
    next_step: 'Submit the prior authorization using submit_prior_auth'
  };
}

async function handleSubmitPriorAuth(args: Record<string, unknown>) {
  const now = new Date();
  const authNumber = `PA-${now.getTime()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const traceNumber = `TRN-${now.getTime()}`;

  // Get the prior auth to determine urgency
  const { data: existingPA, error: fetchError } = await sb
    .from('prior_authorizations')
    .select('urgency')
    .eq('id', args.prior_auth_id)
    .single();

  if (fetchError) throw fetchError;

  // Calculate deadline based on urgency
  const urgency = existingPA.urgency as PriorAuthUrgency;
  let decisionDueAt: Date;
  let expectedResponseTime: string;

  switch (urgency) {
    case 'stat':
      decisionDueAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
      expectedResponseTime = '4 hours';
      break;
    case 'urgent':
      decisionDueAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
      expectedResponseTime = '72 hours (3 days)';
      break;
    default:
      decisionDueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      expectedResponseTime = '7 calendar days';
  }

  const { data, error } = await sb
    .from('prior_authorizations')
    .update({
      status: 'submitted',
      auth_number: authNumber,
      trace_number: traceNumber,
      submitted_at: now.toISOString(),
      decision_due_at: decisionDueAt.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('id', args.prior_auth_id)
    .select()
    .single();

  if (error) throw error;

  logger.info('PRIOR_AUTH_SUBMITTED', {
    prior_auth_id: args.prior_auth_id as string,
    auth_number: authNumber,
    urgency,
    decision_due_at: decisionDueAt.toISOString()
  });

  return {
    prior_auth: data,
    auth_number: authNumber,
    trace_number: traceNumber,
    expected_response_time: expectedResponseTime,
    decision_due_at: decisionDueAt.toISOString(),
    message: `Prior authorization submitted. Expected response within ${expectedResponseTime}.`
  };
}

async function handleGetPriorAuth(args: Record<string, unknown>) {
  let query = sb.from('prior_authorizations').select('*');

  if (args.prior_auth_id) {
    query = query.eq('id', args.prior_auth_id);
  } else if (args.auth_number) {
    query = query.eq('auth_number', args.auth_number);
  } else {
    throw new Error('Either prior_auth_id or auth_number is required');
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { found: false, message: 'Prior authorization not found' };
    }
    throw error;
  }

  // Get service lines
  const { data: serviceLines } = await sb
    .from('prior_auth_service_lines')
    .select('*')
    .eq('prior_auth_id', data.id)
    .order('line_number', { ascending: true });

  // Get decisions
  const { data: decisions } = await sb
    .from('prior_auth_decisions')
    .select('*')
    .eq('prior_auth_id', data.id)
    .order('decision_date', { ascending: false });

  return {
    found: true,
    prior_auth: data,
    service_lines: serviceLines || [],
    decisions: decisions || []
  };
}

async function handleGetPatientPriorAuths(args: Record<string, unknown>) {
  let query = sb
    .from('prior_authorizations')
    .select('*')
    .eq('patient_id', args.patient_id)
    .order('created_at', { ascending: false });

  if (args.status === 'active') {
    query = query.in('status', ['approved', 'partial_approval']).gte('expires_at', new Date().toISOString());
  } else if (args.status === 'pending') {
    query = query.in('status', ['submitted', 'pending_review', 'pending_additional_info']);
  } else if (args.status === 'completed') {
    query = query.in('status', ['approved', 'denied', 'cancelled', 'expired']);
  }

  const { data, error } = await query;

  if (error) throw error;

  return {
    patient_id: args.patient_id,
    total_count: data.length,
    prior_authorizations: data
  };
}

async function handleRecordDecision(args: Record<string, unknown>) {
  const now = new Date();

  // Insert decision record
  const { data: decision, error: decisionError } = await sb
    .from('prior_auth_decisions')
    .insert({
      prior_auth_id: args.prior_auth_id,
      decision_type: args.decision_type,
      decision_date: now.toISOString(),
      auth_number: args.auth_number,
      approved_units: args.approved_units,
      approved_start_date: args.approved_start_date,
      approved_end_date: args.approved_end_date,
      denial_reason_code: args.denial_reason_code,
      denial_reason_description: args.denial_reason_description,
      appeal_deadline: args.appeal_deadline,
      decision_reason: args.decision_reason,
      tenant_id: args.tenant_id
    })
    .select()
    .single();

  if (decisionError) throw decisionError;

  // Update prior auth status
  const statusMap: Record<string, PriorAuthStatus> = {
    approved: 'approved',
    denied: 'denied',
    partial_approval: 'partial_approval',
    pended: 'pending_additional_info',
    cancelled: 'cancelled'
  };

  const newStatus = statusMap[args.decision_type as string] || 'pending_review';

  const { data: priorAuth, error: updateError } = await sb
    .from('prior_authorizations')
    .update({
      status: newStatus,
      auth_number: args.auth_number || undefined,
      approved_units: args.approved_units,
      approved_at: args.decision_type === 'approved' ? now.toISOString() : undefined,
      expires_at: args.approved_end_date,
      updated_at: now.toISOString()
    })
    .eq('id', args.prior_auth_id)
    .select()
    .single();

  if (updateError) throw updateError;

  logger.info('PRIOR_AUTH_DECISION', {
    prior_auth_id: args.prior_auth_id as string,
    decision_id: decision.id,
    decision_type: args.decision_type as string
  });

  return {
    decision,
    prior_auth: priorAuth,
    message: `Decision recorded: ${args.decision_type}`
  };
}

async function handleCreateAppeal(args: Record<string, unknown>) {
  // Get current appeal level
  const { data: existingAppeals } = await sb
    .from('prior_auth_appeals')
    .select('appeal_level')
    .eq('prior_auth_id', args.prior_auth_id)
    .order('appeal_level', { ascending: false })
    .limit(1);

  const nextLevel = ((existingAppeals?.[0]?.appeal_level as number) || 0) + 1;

  const { data: appeal, error } = await sb
    .from('prior_auth_appeals')
    .insert({
      prior_auth_id: args.prior_auth_id,
      decision_id: args.decision_id,
      appeal_level: nextLevel,
      status: 'draft',
      appeal_reason: args.appeal_reason,
      appeal_type: args.appeal_type,
      clinical_rationale: args.clinical_rationale,
      tenant_id: args.tenant_id
    })
    .select()
    .single();

  if (error) throw error;

  // Update prior auth status to appealed
  await sb
    .from('prior_authorizations')
    .update({
      status: 'appealed',
      updated_at: new Date().toISOString()
    })
    .eq('id', args.prior_auth_id);

  logger.info('PRIOR_AUTH_APPEAL_CREATED', {
    prior_auth_id: args.prior_auth_id as string,
    appeal_id: appeal.id,
    appeal_level: nextLevel
  });

  return {
    appeal,
    message: `Appeal created (Level ${nextLevel}). Submit the appeal to begin review.`
  };
}

async function handleCheckPriorAuthRequired(args: Record<string, unknown>) {
  const { data, error } = await sb.rpc('check_prior_auth_for_claim', {
    p_tenant_id: args.tenant_id,
    p_patient_id: args.patient_id,
    p_service_codes: args.service_codes,
    p_date_of_service: args.date_of_service
  });

  if (error) throw error;

  const result = data?.[0] || {
    requires_prior_auth: true,
    missing_codes: args.service_codes
  };

  return {
    ...result,
    recommendation: result.requires_prior_auth
      ? 'Prior authorization required. Submit PA before claim.'
      : 'Existing authorization covers these services.'
  };
}

async function handleGetPendingPriorAuths(args: Record<string, unknown>) {
  const { data, error } = await sb.rpc('get_prior_auth_approaching_deadline', {
    p_tenant_id: args.tenant_id,
    p_hours_threshold: args.hours_threshold || 24
  });

  if (error) throw error;

  return {
    tenant_id: args.tenant_id,
    hours_threshold: args.hours_threshold || 24,
    count: data?.length || 0,
    approaching_deadline: data || []
  };
}

async function handleGetPriorAuthStatistics(args: Record<string, unknown>) {
  const { data, error } = await sb.rpc('get_prior_auth_statistics', {
    p_tenant_id: args.tenant_id,
    p_start_date: args.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    p_end_date: args.end_date || new Date().toISOString().split('T')[0]
  });

  if (error) throw error;

  return data?.[0] || {
    total_submitted: 0,
    total_approved: 0,
    total_denied: 0,
    total_pending: 0,
    approval_rate: 0,
    avg_response_hours: 0,
    sla_compliance_rate: 100,
    by_urgency: {}
  };
}

async function handleCancelPriorAuth(args: Record<string, unknown>) {
  const { data, error } = await sb
    .from('prior_authorizations')
    .update({
      status: 'cancelled',
      clinical_notes: args.reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', args.prior_auth_id)
    .select()
    .single();

  if (error) throw error;

  logger.info('PRIOR_AUTH_CANCELLED', {
    prior_auth_id: args.prior_auth_id as string,
    reason: args.reason as string
  });

  return {
    prior_auth: data,
    message: 'Prior authorization cancelled'
  };
}

async function handleToFHIRClaim(args: Record<string, unknown>) {
  const { data: priorAuth, error } = await sb
    .from('prior_authorizations')
    .select('*')
    .eq('id', args.prior_auth_id)
    .single();

  if (error) throw error;

  // Convert to FHIR Claim resource (Da Vinci PAS profile)
  const fhirClaim = {
    resourceType: 'Claim',
    id: priorAuth.fhir_resource_id || priorAuth.id,
    meta: {
      profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim']
    },
    status: priorAuth.status === 'draft' ? 'draft' : 'active',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/claim-type',
        code: 'professional'
      }]
    },
    use: 'preauthorization',
    patient: {
      reference: `Patient/${priorAuth.patient_id}`
    },
    created: priorAuth.created_at,
    insurer: {
      identifier: {
        value: priorAuth.payer_id
      },
      display: priorAuth.payer_name
    },
    provider: {
      identifier: {
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: priorAuth.ordering_provider_npi
      }
    },
    priority: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/processpriority',
        code: priorAuth.urgency === 'stat' ? 'stat' :
              priorAuth.urgency === 'urgent' ? 'urgent' : 'normal'
      }]
    },
    diagnosis: (priorAuth.diagnosis_codes as string[]).map((code: string, index: number) => ({
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: code
        }]
      }
    })),
    item: (priorAuth.service_codes as string[]).map((code: string, index: number) => ({
      sequence: index + 1,
      productOrService: {
        coding: [{
          system: 'http://www.ama-assn.org/go/cpt',
          code: code
        }]
      },
      servicedDate: priorAuth.date_of_service,
      quantity: {
        value: priorAuth.requested_units || 1
      }
    })),
    supportingInfo: priorAuth.clinical_notes ? [{
      sequence: 1,
      category: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory',
          code: 'info'
        }]
      },
      valueString: priorAuth.clinical_notes
    }] : undefined
  };

  return {
    fhir_claim: fhirClaim,
    prior_auth_id: priorAuth.id,
    profile: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim'
  };
}

// =====================================================
// MCP Handler
// =====================================================

async function handleToolCall(toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case 'create_prior_auth':
      return handleCreatePriorAuth(args);
    case 'submit_prior_auth':
      return handleSubmitPriorAuth(args);
    case 'get_prior_auth':
      return handleGetPriorAuth(args);
    case 'get_patient_prior_auths':
      return handleGetPatientPriorAuths(args);
    case 'record_decision':
      return handleRecordDecision(args);
    case 'create_appeal':
      return handleCreateAppeal(args);
    case 'check_prior_auth_required':
      return handleCheckPriorAuthRequired(args);
    case 'get_pending_prior_auths':
      return handleGetPendingPriorAuths(args);
    case 'get_prior_auth_statistics':
      return handleGetPriorAuthStatistics(args);
    case 'cancel_prior_auth':
      return handleCancelPriorAuth(args);
    case 'to_fhir_claim':
      return handleToFHIRClaim(args);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// =====================================================
// MCP JSON-RPC Server
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
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
    // Rate limiting
    const rateLimitId = getRequestIdentifier(req);
    const rateLimitResult = checkMCPRateLimit(rateLimitId, MCP_RATE_LIMITS.prior_auth);

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.prior_auth, corsHeaders);
    }

    // Parse JSON-RPC request
    const body = await req.json();
    const { method, params, id } = body;

    // Handle MCP JSON-RPC methods
    switch (method) {
      case "initialize": {
        // No auth required for initialize - discovery method
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2025-11-25",
            serverInfo: {
              name: "mcp-prior-auth-server",
              version: "1.1.0"
            },
            capabilities: {
              tools: {}
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/list": {
        // No auth required for tools/list - discovery method
        const tools = Object.entries(TOOLS).map(([name, def]) => ({
          name,
          description: def.description,
          inputSchema: def.inputSchema
        }));

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: { tools },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        if (!name || !TOOLS[name as keyof typeof TOOLS]) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32602, message: `Unknown tool: ${name}`, data: { requestId } },
            id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // ============================================================
        // AUTH GATE: Verify caller has clinical/admin access
        // Prior auth operations require authenticated clinical staff
        // ============================================================
        const authResult = await verifyClinicalAccess(req, {
          serverName: SERVER_CONFIG.name,
          toolName: name,
          logger
        });

        if (!authResult.authorized) {
          logger.security("PRIOR_AUTH_ACCESS_DENIED", {
            requestId,
            tool: name,
            reason: authResult.error
          });

          if (authResult.statusCode === 401) {
            return createUnauthorizedResponse(authResult.error || "Unauthorized", requestId, corsHeaders);
          }
          return createForbiddenResponse(authResult.error || "Forbidden", requestId, corsHeaders);
        }

        const caller = authResult.caller as CallerIdentity;
        logger.info("PRIOR_AUTH_TOOL_CALL", {
          requestId,
          tool: name,
          userId: caller.userId,
          role: caller.role,
          tenantId: caller.tenantId
        });

        const result = await handleToolCall(name, args || {});

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            metadata: {
              tool: name,
              executionTimeMs: Date.now() - startTime,
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

      default:
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Method not found: ${method}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("PRIOR_AUTH_API_ERROR", { requestId, errorMessage: error.message });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32603, message: error.message, data: { requestId } },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
