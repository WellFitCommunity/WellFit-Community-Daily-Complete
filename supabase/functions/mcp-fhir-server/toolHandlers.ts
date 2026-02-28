// =====================================================
// MCP FHIR Server - Tool Handlers
// Purpose: Implementation of each MCP tool's business logic
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import { handlePing, type MCPInitResult } from "../_shared/mcpServerBase.ts";
import type { ToolResult, CareTeamParticipant, PractitionerRecord } from "./types.ts";
import { FHIR_TABLES, getFHIRColumns } from "./tools.ts";
import { createFHIRBundle } from "./bundleBuilder.ts";
import { validateResource } from "./validation.ts";
import { logFHIROperation } from "./audit.ts";
import { getPatientBundle } from "./resourceQueries.ts";
import { searchResources } from "./resourceQueries.ts";
import { getPatientSummary } from "./patientSummary.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";

/**
 * Context passed to every tool handler call, providing
 * access to the Supabase client, logger, and caller identity.
 */
interface HandlerContext {
  sb: SupabaseClient;
  logger: EdgeFunctionLogger;
  serverConfig: { name: string; version: string; tier: string };
  initResult: MCPInitResult;
  caller: { userId?: string; role?: string; tenantId?: string };
}

/**
 * Executes the appropriate tool handler and returns the result.
 * Also logs the FHIR operation for audit purposes.
 *
 * @param toolName - The MCP tool name to execute
 * @param toolArgs - The tool arguments from the MCP request
 * @param ctx - The handler context (Supabase client, logger, caller identity)
 * @returns An object with the tool result and execution time
 */
export async function executeToolHandler(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: HandlerContext
): Promise<{ result: ToolResult; executionTimeMs: number }> {
  const startTime = Date.now();
  let result: ToolResult;

  switch (toolName) {
    case "ping": {
      result = handlePing(ctx.serverConfig, ctx.initResult);
      break;
    }

    case "export_patient_bundle": {
      result = await getPatientBundle(
        ctx.sb,
        toolArgs.patient_id as string,
        toolArgs.resources as string[] | undefined,
        {
          startDate: toolArgs.start_date as string | undefined,
          endDate: toolArgs.end_date as string | undefined,
          includeAI: toolArgs.include_ai_assessments as boolean | undefined
        }
      );
      break;
    }

    case "get_resource": {
      result = await handleGetResource(ctx.sb, toolArgs);
      break;
    }

    case "search_resources": {
      result = await searchResources(ctx.sb, toolArgs.resource_type as string, {
        patientId: toolArgs.patient_id as string | undefined,
        status: toolArgs.status as string | undefined,
        category: toolArgs.category as string | undefined,
        code: toolArgs.code as string | undefined,
        dateFrom: toolArgs.date_from as string | undefined,
        dateTo: toolArgs.date_to as string | undefined,
        limit: toolArgs.limit as number | undefined
      });
      break;
    }

    case "create_resource": {
      result = await handleCreateResource(ctx.sb, toolArgs);
      break;
    }

    case "update_resource": {
      result = await handleUpdateResource(ctx.sb, toolArgs);
      break;
    }

    case "validate_resource": {
      result = validateResource(
        toolArgs.resource_type as string,
        toolArgs.data as Record<string, unknown>
      );
      break;
    }

    case "get_patient_summary": {
      result = await getPatientSummary(
        ctx.sb,
        toolArgs.patient_id as string,
        toolArgs.include_sections as string[] | undefined
      );
      break;
    }

    case "get_observations": {
      result = await handleGetObservations(ctx.sb, toolArgs);
      break;
    }

    case "get_medication_list": {
      result = await handleGetMedicationList(ctx.sb, toolArgs);
      break;
    }

    case "get_condition_list": {
      result = await handleGetConditionList(ctx.sb, toolArgs);
      break;
    }

    case "get_sdoh_assessments": {
      result = await handleGetSdohAssessments(ctx.sb, toolArgs);
      break;
    }

    case "get_care_team": {
      result = await handleGetCareTeam(ctx.sb, toolArgs);
      break;
    }

    case "list_ehr_connections": {
      result = await handleListEhrConnections(ctx.sb, toolArgs);
      break;
    }

    case "trigger_ehr_sync": {
      result = await handleTriggerEhrSync(ctx.sb, toolArgs);
      break;
    }

    default:
      throw new Error(`Tool ${toolName} not implemented`);
  }

  const executionTimeMs = Date.now() - startTime;

  // Audit log with caller identity
  await logFHIROperation(ctx.sb, ctx.logger, {
    userId: ctx.caller.userId,
    tenantId: ctx.caller.tenantId || (toolArgs.tenant_id as string | undefined),
    operation: toolName,
    resourceType: toolArgs.resource_type as string | undefined,
    resourceId: (toolArgs.resource_id || toolArgs.patient_id) as string | undefined,
    success: true,
    executionTimeMs
  });

  return { result, executionTimeMs };
}

// =====================================================
// Individual Tool Handler Functions
// =====================================================

async function handleGetResource(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const resourceType = toolArgs.resource_type as string;
  const resourceId = toolArgs.resource_id as string;
  const table = FHIR_TABLES[resourceType];
  if (!table) throw new Error(`Unknown resource type: ${resourceType}`);

  const { data, error } = await withTimeout(
    sb.from(table).select(getFHIRColumns(table)).eq('id', resourceId).single(),
    MCP_TIMEOUT_CONFIG.fhir.single,
    `FHIR get ${resourceType}`
  );
  if (error) throw new Error(`Resource not found: ${error.message}`);
  return { resourceType, ...data };
}

async function handleCreateResource(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const resourceType = toolArgs.resource_type as string;
  const data = toolArgs.data as Record<string, unknown>;
  const patientId = toolArgs.patient_id as string | undefined;
  const table = FHIR_TABLES[resourceType];
  if (!table) throw new Error(`Unknown resource type: ${resourceType}`);

  const validation = validateResource(resourceType, { ...data, patient_id: patientId });
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const { data: created, error } = await withTimeout(
    sb.from(table).insert({
      ...data,
      patient_id: patientId,
      created_at: new Date().toISOString()
    }).select().single(),
    MCP_TIMEOUT_CONFIG.fhir.write,
    `FHIR create ${resourceType}`
  );

  if (error) throw new Error(`Create failed: ${error.message}`);
  return { resourceType, ...created };
}

async function handleUpdateResource(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const resourceType = toolArgs.resource_type as string;
  const resourceId = toolArgs.resource_id as string;
  const data = toolArgs.data as Record<string, unknown>;
  const table = FHIR_TABLES[resourceType];
  if (!table) throw new Error(`Unknown resource type: ${resourceType}`);

  const { data: updated, error } = await withTimeout(
    sb.from(table).update({
      ...data,
      updated_at: new Date().toISOString()
    }).eq('id', resourceId).select().single(),
    MCP_TIMEOUT_CONFIG.fhir.write,
    `FHIR update ${resourceType}`
  );

  if (error) throw new Error(`Update failed: ${error.message}`);
  return { resourceType, ...updated };
}

async function handleGetObservations(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const patientId = toolArgs.patient_id as string;
  const category = toolArgs.category as string | undefined;
  const code = toolArgs.code as string | undefined;
  const dateFrom = toolArgs.date_from as string | undefined;
  const dateTo = toolArgs.date_to as string | undefined;
  const limit = toolArgs.limit as number | undefined;

  let query = sb.from('fhir_observations').select(getFHIRColumns('fhir_observations')).eq('patient_id', patientId);
  if (category) query = query.eq('category', category);
  if (code) query = query.eq('code', code);
  if (dateFrom) query = query.gte('effective_date', dateFrom);
  if (dateTo) query = query.lte('effective_date', dateTo);

  const { data, error } = await withTimeout(
    query.order('effective_date', { ascending: false }).limit(limit || 50),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR observations search'
  );
  if (error) throw new Error(`Query failed: ${error.message}`);

  return createFHIRBundle(
    (data || []).map(r => ({ resourceType: 'Observation', ...r })),
    'searchset'
  );
}

async function handleGetMedicationList(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const patientId = toolArgs.patient_id as string;
  const status = toolArgs.status as string | undefined;
  const includeHistory = toolArgs.include_history as boolean | undefined;

  let query = sb.from('fhir_medication_requests').select(getFHIRColumns('fhir_medication_requests')).eq('patient_id', patientId);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  } else if (!includeHistory) {
    query = query.in('status', ['active', 'on-hold']);
  }

  const { data, error } = await withTimeout(
    query.order('authored_on', { ascending: false }).limit(100),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR medication list'
  );
  if (error) throw new Error(`Query failed: ${error.message}`);

  return {
    patient_id: patientId,
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
}

async function handleGetConditionList(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const patientId = toolArgs.patient_id as string;
  const clinicalStatus = toolArgs.clinical_status as string | undefined;
  const category = toolArgs.category as string | undefined;

  let query = sb.from('fhir_conditions').select(getFHIRColumns('fhir_conditions')).eq('patient_id', patientId);
  if (clinicalStatus) query = query.eq('clinical_status', clinicalStatus);
  if (category) query = query.eq('category', category);

  const { data, error } = await withTimeout(
    query.order('recorded_date', { ascending: false }).limit(50),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR condition list'
  );
  if (error) throw new Error(`Query failed: ${error.message}`);

  return {
    patient_id: patientId,
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
}

async function handleGetSdohAssessments(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const patientId = toolArgs.patient_id as string;

  const query = sb.from('fhir_observations')
    .select(getFHIRColumns('fhir_observations'))
    .eq('patient_id', patientId)
    .eq('category', 'sdoh');

  const { data: observations, error } = await withTimeout(
    query.order('effective_date', { ascending: false }).limit(50),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR SDOH assessments'
  );

  // Also check sdoh_flags table
  const { data: flags } = await withTimeout(
    sb.from('sdoh_flags')
      .select('id, flag_type, severity, description, detected_date')
      .eq('patient_id', patientId)
      .eq('resolved', false)
      .limit(20),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR SDOH flags'
  );

  if (error) throw new Error(`Query failed: ${error.message}`);

  return {
    patient_id: patientId,
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
}

async function handleGetCareTeam(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const patientId = toolArgs.patient_id as string;
  const includeContactInfo = toolArgs.include_contact_info as boolean | undefined;

  const { data: careTeams, error } = await withTimeout(
    sb.from('fhir_care_teams')
      .select(getFHIRColumns('fhir_care_teams'))
      .eq('patient_id', patientId)
      .eq('status', 'active'),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR care team lookup'
  );

  if (error) throw new Error(`Query failed: ${error.message}`);

  // Get practitioner details if contact info requested
  let practitioners: PractitionerRecord[] = [];
  if (includeContactInfo && careTeams?.length) {
    const practitionerIds = careTeams.flatMap(ct =>
      (ct.participants as CareTeamParticipant[] | undefined)
        ?.map((p: CareTeamParticipant) => p.practitioner_id)
        .filter(Boolean) || []
    );

    if (practitionerIds.length) {
      const { data } = await sb.from('fhir_practitioners')
        .select('id, name, specialty, phone, email')
        .in('id', practitionerIds);
      practitioners = (data || []) as PractitionerRecord[];
    }
  }

  const practitionerMap = new Map(
    practitioners.map((p: PractitionerRecord) => [p.id, p])
  );

  return {
    patient_id: patientId,
    care_teams: (careTeams || []).map(ct => ({
      id: ct.id,
      name: ct.name,
      category: ct.category,
      status: ct.status,
      members: (ct.participants as CareTeamParticipant[] | undefined)
        ?.map((p: CareTeamParticipant) => {
          const pract = practitionerMap.get(p.practitioner_id || '');
          return {
            role: p.role,
            name: p.display || pract?.name,
            specialty: pract?.specialty,
            phone: includeContactInfo ? pract?.phone : undefined,
            email: includeContactInfo ? pract?.email : undefined
          };
        }) || []
    }))
  };
}

async function handleListEhrConnections(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const tenantId = toolArgs.tenant_id as string | undefined;
  const status = toolArgs.status as string | undefined;

  let query = sb.from('fhir_connections')
    .select('id, name, ehr_type, base_url, status, sync_mode, sync_frequency, last_sync_at, created_at');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (status) query = query.eq('status', status);

  const { data, error } = await withTimeout(
    query.order('name'),
    MCP_TIMEOUT_CONFIG.fhir.search,
    'FHIR EHR connections list'
  );
  if (error) throw new Error(`Query failed: ${error.message}`);

  return {
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
}

async function handleTriggerEhrSync(
  sb: SupabaseClient,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const connectionId = toolArgs.connection_id as string;
  const patientId = toolArgs.patient_id as string | undefined;
  const direction = toolArgs.direction as string | undefined;
  const resources = toolArgs.resources as string[] | undefined;

  // Get connection details
  const { data: connection, error: connError } = await sb.from('fhir_connections')
    .select('id, name, ehr_type, base_url, status, sync_mode, tenant_id')
    .eq('id', connectionId)
    .single();

  if (connError || !connection) {
    throw new Error(`Connection not found: ${connError?.message}`);
  }

  // Log sync request
  const { data: syncLog, error: logError } = await sb.from('fhir_sync_logs').insert({
    connection_id: connectionId,
    patient_id: patientId,
    direction: direction || connection.sync_mode,
    resource_types: resources || ['all'],
    status: 'pending',
    initiated_at: new Date().toISOString()
  }).select().single();

  if (logError) throw new Error(`Failed to create sync log: ${logError.message}`);

  return {
    sync_id: syncLog?.id,
    connection_id: connectionId,
    direction: direction || connection.sync_mode,
    status: 'initiated',
    message: 'Sync request queued. Check fhir_sync_logs for status.'
  };
}
