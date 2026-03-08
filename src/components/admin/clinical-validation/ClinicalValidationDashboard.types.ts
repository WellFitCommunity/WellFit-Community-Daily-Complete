/**
 * Types for Clinical Validation Dashboard
 *
 * Used by: ClinicalValidationDashboard, ValidationSummaryCards,
 *          RejectionLogTable, ReferenceDataHealthPanel
 */

/** A single validation hook result row from the database */
export interface ValidationHookResult {
  id: string;
  created_at: string;
  source_function: string;
  patient_id: string | null;
  tenant_id: string | null;
  codes_checked: number;
  codes_validated: number;
  codes_rejected: number;
  codes_suppressed: number;
  rejected_details: RejectedDetail[];
  validation_method: string;
  response_time_ms: number;
}

/** A rejected code detail from the JSONB column */
export interface RejectedDetail {
  code: string;
  system: string;
  reason: string;
  detail: string;
}

/** Aggregated summary metrics for the dashboard cards */
export interface ValidationSummary {
  totalRuns: number;
  totalCodesChecked: number;
  totalCodesRejected: number;
  totalCodesSuppressed: number;
  rejectionRate: number;
  avgResponseTimeMs: number;
  topHallucinatedCode: string | null;
  topHallucinatedCount: number;
}

/** A single row in the rejection log table */
export interface RejectionLogEntry {
  id: string;
  date: string;
  sourceFunction: string;
  code: string;
  system: string;
  reason: string;
  detail: string;
}

/** Reference data source health status */
export interface ReferenceDataSource {
  id: string;
  source_name: string;
  source_type: string;
  last_updated: string;
  version: string | null;
  status: 'current' | 'warning' | 'stale' | 'critical';
  next_expected_update: string | null;
  notes: string | null;
}

/** Filter state for the dashboard */
export interface ValidationFilters {
  dateRange: '7d' | '30d' | '90d';
  sourceFunction: string | null;
  codeSystem: string | null;
  reason: string | null;
}
