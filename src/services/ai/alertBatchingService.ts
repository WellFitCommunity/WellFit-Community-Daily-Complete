/**
 * Alert Batching Service
 *
 * P2-2: Batches care_team_alerts within a configurable time window (default 60s)
 * before sending them to the Claude-in-Claude consolidate-alerts MCP tool.
 *
 * Solves alert fatigue: when 5+ AI skills fire for the same patient
 * simultaneously, Claude consolidates into a single actionable summary
 * with root cause analysis.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P2-2)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

/** Alert severity as stored in care_team_alerts table */
type CareAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Alert status as stored in care_team_alerts table */
type CareAlertStatus = 'active' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';

/** Row shape from care_team_alerts query */
interface CareTeamAlertRow {
  id: string;
  patient_id: string;
  alert_type: string;
  severity: CareAlertSeverity;
  priority: string;
  title: string;
  description: string;
  alert_data: Record<string, unknown> | null;
  status: CareAlertStatus;
  created_at: string;
}

/** Mapped alert for the consolidate-alerts MCP tool */
interface PatientAlert {
  alert_id: string;
  skill_key: string;
  severity: string;
  summary: string;
  details: Record<string, unknown>;
  generated_at: string;
  category: string;
}

/** Result of alert consolidation from the MCP tool */
export interface AlertConsolidationResult {
  consolidated_severity: string;
  actionable_summary: string;
  root_causes: Array<{
    description: string;
    related_alert_ids: string[];
    confidence: number;
    recommended_intervention: string;
  }>;
  alert_dispositions: Array<{
    alert_id: string;
    disposition: string;
    reasoning: string;
    root_cause_index: number | null;
  }>;
  total_alerts: number;
  consolidated_count: number;
  requires_review: boolean;
}

/** Batching configuration */
export interface BatchConfig {
  /** Time window in milliseconds (default: 60000 = 60s) */
  windowMs: number;
  /** Minimum alerts needed to trigger consolidation (default: 2) */
  minAlerts: number;
  /** Maximum alerts to consolidate in one batch (default: 20) */
  maxAlerts: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  windowMs: 60_000,
  minAlerts: 2,
  maxAlerts: 20,
};

// ============================================================================
// Severity Mapping — care_team_alerts → MCP tool escalation levels
// ============================================================================

/** Map care_team_alerts severity to MCP EscalationLevel */
function mapAlertSeverityToEscalation(severity: CareAlertSeverity): string {
  switch (severity) {
    case 'critical': return 'emergency';
    case 'high': return 'escalate';
    case 'medium': return 'notify';
    case 'low': return 'monitor';
    default: return 'none';
  }
}

/** Infer alert category from alert_type */
function inferCategory(alertType: string): string {
  const categoryMap: Record<string, string> = {
    readmission_risk_high: 'readmission',
    er_visit_detected: 'readmission',
    patient_readmitted: 'readmission',
    vitals_declining: 'vitals',
    medication_non_adherence: 'medication',
    missed_check_ins: 'engagement',
    patient_stopped_responding: 'engagement',
    follow_up_concerns: 'care_coordination',
    urgent_care_visit: 'care_coordination',
    pattern_concerning: 'behavioral',
  };
  return categoryMap[alertType] ?? 'other';
}

/** Convert a care_team_alerts row to the MCP tool PatientAlert format */
function toPatientAlert(row: CareTeamAlertRow): PatientAlert {
  return {
    alert_id: row.id,
    skill_key: (row.alert_data as Record<string, unknown>)?.skill_key as string
      ?? `care-alert-${row.alert_type}`,
    severity: mapAlertSeverityToEscalation(row.severity),
    summary: row.title || row.description,
    details: row.alert_data ?? {},
    generated_at: row.created_at,
    category: inferCategory(row.alert_type),
  };
}

// ============================================================================
// Service
// ============================================================================

export const AlertBatchingService = {
  /**
   * Fetch active alerts for a patient within the batching window.
   *
   * Queries care_team_alerts for alerts created within the last `windowMs`
   * milliseconds, ordered by severity descending.
   */
  async fetchRecentAlerts(
    patientId: string,
    config: Partial<BatchConfig> = {}
  ): Promise<ServiceResult<CareTeamAlertRow[]>> {
    const { windowMs, maxAlerts } = { ...DEFAULT_BATCH_CONFIG, ...config };

    try {
      const windowStart = new Date(Date.now() - windowMs).toISOString();

      const { data, error } = await supabase
        .from('care_team_alerts')
        .select('id, patient_id, alert_type, severity, priority, title, description, alert_data, status, created_at')
        .eq('patient_id', patientId)
        .in('status', ['active', 'in_progress'])
        .gte('created_at', windowStart)
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(maxAlerts);

      if (error) {
        return failure('DATABASE_ERROR', `Failed to fetch alerts: ${error.message}`, error);
      }

      return success((data ?? []) as CareTeamAlertRow[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'ALERT_BATCH_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      return failure('FETCH_FAILED', 'Failed to fetch recent alerts');
    }
  },

  /**
   * Consolidate a batch of alerts using the Claude-in-Claude MCP tool.
   *
   * If fewer than minAlerts are present, returns them as-is (no consolidation needed).
   * Otherwise, calls the consolidate-alerts MCP tool for Claude meta-reasoning.
   */
  async consolidateAlerts(
    patientId: string,
    tenantId: string,
    alerts: CareTeamAlertRow[],
    config: Partial<BatchConfig> = {}
  ): Promise<ServiceResult<AlertConsolidationResult>> {
    const { minAlerts, windowMs } = { ...DEFAULT_BATCH_CONFIG, ...config };

    try {
      if (alerts.length < minAlerts) {
        return success({
          consolidated_severity: alerts.length > 0
            ? mapAlertSeverityToEscalation(alerts[0].severity)
            : 'none',
          actionable_summary: alerts.length === 1
            ? alerts[0].title || alerts[0].description
            : 'No alerts to consolidate',
          root_causes: [],
          alert_dispositions: alerts.map(a => ({
            alert_id: a.id,
            disposition: 'standalone',
            reasoning: 'Below consolidation threshold',
            root_cause_index: null,
          })),
          total_alerts: alerts.length,
          consolidated_count: 0,
          requires_review: false,
        });
      }

      await auditLogger.info('ALERT_CONSOLIDATION_START', {
        patientId,
        alertCount: alerts.length,
        windowMs,
      });

      // Convert to MCP tool format
      const patientAlerts = alerts.map(toPatientAlert);

      // Build ISO 8601 duration from window
      const windowSeconds = Math.round(windowMs / 1000);
      const collectionWindow = `PT${windowSeconds}S`;

      // Call the MCP Claude server's consolidation tool
      const { data, error } = await supabase.functions.invoke('mcp-claude-server', {
        body: {
          method: 'tools/call',
          params: {
            name: 'consolidate-alerts',
            arguments: {
              patient_id: patientId,
              tenant_id: tenantId,
              alerts: patientAlerts,
              collection_window: collectionWindow,
            },
          },
          id: crypto.randomUUID(),
        },
      });

      if (error) {
        return failure('META_TRIAGE_FAILED', `Alert consolidation call failed: ${error.message}`);
      }

      // Parse the MCP response
      const mcpResponse = data as { result?: { content?: Array<{ text?: string }> } };
      const resultText = mcpResponse?.result?.content?.[0]?.text;
      if (!resultText) {
        return failure('META_TRIAGE_EMPTY', 'Alert consolidation returned empty result');
      }

      const consolidated = JSON.parse(resultText) as AlertConsolidationResult;

      await auditLogger.info('ALERT_CONSOLIDATION_COMPLETE', {
        patientId,
        totalAlerts: consolidated.total_alerts,
        consolidatedCount: consolidated.consolidated_count,
        consolidatedSeverity: consolidated.consolidated_severity,
        rootCauses: consolidated.root_causes.length,
        requiresReview: consolidated.requires_review,
      });

      return success(consolidated);
    } catch (err: unknown) {
      await auditLogger.error(
        'ALERT_CONSOLIDATION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      return failure('AGGREGATION_FAILED', 'Failed to consolidate alerts');
    }
  },

  /**
   * Full pipeline: fetch recent alerts → consolidate if threshold met.
   *
   * This is the main entry point for alert batching. Call it when a new
   * alert is created to check if consolidation should happen.
   */
  async batchAndConsolidate(
    patientId: string,
    tenantId: string,
    config: Partial<BatchConfig> = {}
  ): Promise<ServiceResult<AlertConsolidationResult>> {
    const fetchResult = await this.fetchRecentAlerts(patientId, config);
    if (!fetchResult.success) {
      return failure(
        fetchResult.error?.code ?? 'FETCH_FAILED',
        fetchResult.error?.message ?? 'Failed to fetch alerts for batching'
      );
    }

    const alerts = fetchResult.data;

    if (alerts.length === 0) {
      return success({
        consolidated_severity: 'none',
        actionable_summary: 'No active alerts in window',
        root_causes: [],
        alert_dispositions: [],
        total_alerts: 0,
        consolidated_count: 0,
        requires_review: false,
      });
    }

    return this.consolidateAlerts(patientId, tenantId, alerts, config);
  },
};
