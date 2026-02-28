// =====================================================
// MCP Prior Auth Server — Tool Handlers
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PriorAuthStatus, PriorAuthUrgency } from "./types.ts";
import { handleToFHIRClaim } from "./fhirConverter.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  security(event: string, data?: Record<string, unknown>): void;
}

export function createToolHandlers(sb: SupabaseClient, logger: MCPLogger) {

  async function handleCreatePriorAuth(args: Record<string, unknown>) {
    const now = new Date();

    const { data, error } = await withTimeout(
      sb.from('prior_authorizations')
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
        .single(),
      MCP_TIMEOUT_CONFIG.priorAuth.create,
      'Prior auth create'
    );

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

  // Explicit column list for prior_authorizations — excludes PHI fields (clinical_notes, clinical_rationale)
  const PRIOR_AUTH_COLUMNS = 'id, patient_id, payer_id, payer_name, member_id, service_codes, diagnosis_codes, urgency, ordering_provider_npi, rendering_provider_npi, facility_npi, date_of_service, requested_units, status, auth_number, trace_number, submitted_at, decision_due_at, approved_units, approved_at, expires_at, created_at, updated_at, fhir_resource_id, tenant_id';

  async function handleGetPriorAuth(args: Record<string, unknown>) {
    let query = sb.from('prior_authorizations').select(PRIOR_AUTH_COLUMNS);

    if (args.prior_auth_id) {
      query = query.eq('id', args.prior_auth_id);
    } else if (args.auth_number) {
      query = query.eq('auth_number', args.auth_number);
    } else {
      throw new Error('Either prior_auth_id or auth_number is required');
    }

    const { data, error } = await withTimeout(
      query.single(),
      MCP_TIMEOUT_CONFIG.priorAuth.query,
      'Prior auth lookup'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return { found: false, message: 'Prior authorization not found' };
      }
      throw error;
    }

    // Get service lines
    const { data: serviceLines } = await sb
      .from('prior_auth_service_lines')
      .select('id, prior_auth_id, line_number, service_code, description, units, status')
      .eq('prior_auth_id', data.id)
      .order('line_number', { ascending: true });

    // Get decisions
    const { data: decisions } = await sb
      .from('prior_auth_decisions')
      .select('id, prior_auth_id, decision_type, decision_date, auth_number, approved_units, approved_start_date, approved_end_date, denial_reason_code, denial_reason_description, appeal_deadline, decision_reason, tenant_id')
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
      .select(PRIOR_AUTH_COLUMNS)
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
    const { data, error } = await withTimeout(
      sb.rpc('check_prior_auth_for_claim', {
        p_tenant_id: args.tenant_id,
        p_patient_id: args.patient_id,
        p_service_codes: args.service_codes,
        p_date_of_service: args.date_of_service
      }),
      MCP_TIMEOUT_CONFIG.priorAuth.rpc,
      'Prior auth requirement check'
    );

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

  // Dispatcher
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
        return handleToFHIRClaim(args, sb);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  return { handleToolCall };
}
