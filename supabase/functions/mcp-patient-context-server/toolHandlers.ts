// =====================================================
// MCP Patient Context Server — Tool Handler Factory
// Thin dispatch layer. Data-fetching lives in fetchers.ts.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import type { MCPLogger, PatientContext, DataSourceRecord } from "./types.ts";
import {
  fetchDemographicsRow,
  fetchContactsRows,
  fetchTimelineEvents,
  fetchRiskSummaryData,
  patientExistsCheck,
} from "./fetchers.ts";

function makeRequestId(): string {
  return `pctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

export function createToolHandlers(sb: SupabaseClient, logger: MCPLogger) {
  async function handleGetPatientContext(
    args: Record<string, unknown>
  ): Promise<PatientContext | { error: string }> {
    const startTime = Date.now();
    const requestId = makeRequestId();
    const patientId = args.patient_id as string;

    if (!patientId) {
      return { error: "patient_id is required" };
    }

    const includeContacts = (args.include_contacts as boolean | undefined) ?? true;
    const includeTimeline = (args.include_timeline as boolean | undefined) ?? true;
    const includeRisk = (args.include_risk as boolean | undefined) ?? true;
    const timelineDays = Math.min((args.timeline_days as number | undefined) ?? 30, 365);
    const maxTimelineEvents = Math.min(
      (args.max_timeline_events as number | undefined) ?? 50,
      500
    );

    const dataSources: DataSourceRecord[] = [];
    const warnings: string[] = [];

    const demographics = await fetchDemographicsRow(sb, patientId, dataSources);
    if (!demographics) {
      return { error: `Patient not found: ${patientId}` };
    }

    const [contacts, timeline, risk] = await Promise.all([
      includeContacts ? fetchContactsRows(sb, patientId, dataSources) : Promise.resolve(null),
      includeTimeline
        ? fetchTimelineEvents(sb, patientId, timelineDays, maxTimelineEvents, dataSources)
        : Promise.resolve(null),
      includeRisk ? fetchRiskSummaryData(sb, patientId, dataSources) : Promise.resolve(null),
    ]);

    for (const s of dataSources) {
      if (!s.success && s.note) warnings.push(`${s.source}: ${s.note}`);
    }

    const context: PatientContext = {
      demographics,
      contacts,
      timeline,
      risk,
      context_meta: {
        generated_at: now(),
        request_id: requestId,
        data_sources: dataSources,
        warnings,
        fetch_duration_ms: Date.now() - startTime,
      },
    };

    logger.info("PATIENT_CONTEXT_FETCHED", {
      requestId,
      patientId,
      durationMs: context.context_meta.fetch_duration_ms,
      warningCount: warnings.length,
    });

    return context;
  }

  async function handleGetMinimalContext(args: Record<string, unknown>) {
    return handleGetPatientContext({
      ...args,
      include_contacts: false,
      include_timeline: false,
      include_risk: false,
    });
  }

  async function handleGetPatientContacts(args: Record<string, unknown>) {
    const patientId = args.patient_id as string;
    if (!patientId) return { error: "patient_id is required" };

    const dataSources: DataSourceRecord[] = [];
    const exists = await fetchDemographicsRow(sb, patientId, dataSources);
    if (!exists) return { error: `Patient not found: ${patientId}` };

    const contacts = await fetchContactsRows(sb, patientId, dataSources);
    return { contacts, data_sources: dataSources };
  }

  async function handleGetPatientTimeline(args: Record<string, unknown>) {
    const patientId = args.patient_id as string;
    if (!patientId) return { error: "patient_id is required" };

    const days = Math.min((args.days as number | undefined) ?? 30, 365);
    const maxEvents = Math.min((args.max_events as number | undefined) ?? 50, 500);

    const dataSources: DataSourceRecord[] = [];
    const exists = await fetchDemographicsRow(sb, patientId, dataSources);
    if (!exists) return { error: `Patient not found: ${patientId}` };

    const timeline = await fetchTimelineEvents(sb, patientId, days, maxEvents, dataSources);
    return {
      timeline,
      window_days: days,
      data_sources: dataSources,
    };
  }

  async function handleGetPatientRiskSummary(args: Record<string, unknown>) {
    const patientId = args.patient_id as string;
    if (!patientId) return { error: "patient_id is required" };

    const dataSources: DataSourceRecord[] = [];
    const exists = await fetchDemographicsRow(sb, patientId, dataSources);
    if (!exists) return { error: `Patient not found: ${patientId}` };

    const risk = await fetchRiskSummaryData(sb, patientId, dataSources);
    return { risk, data_sources: dataSources };
  }

  async function handlePatientExists(args: Record<string, unknown>) {
    const patientId = args.patient_id as string;
    if (!patientId) return { exists: false, error: "patient_id is required" };

    const exists = await patientExistsCheck(sb, patientId);
    return { exists };
  }

  async function handleToolCall(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "get_patient_context":
        return handleGetPatientContext(args);
      case "get_minimal_context":
        return handleGetMinimalContext(args);
      case "get_patient_contacts":
        return handleGetPatientContacts(args);
      case "get_patient_timeline":
        return handleGetPatientTimeline(args);
      case "get_patient_risk_summary":
        return handleGetPatientRiskSummary(args);
      case "patient_exists":
        return handlePatientExists(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  return { handleToolCall };
}
