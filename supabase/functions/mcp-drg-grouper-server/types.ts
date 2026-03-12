// =====================================================
// MCP DRG Grouper Server — Type Definitions
// Standalone monetizable DRG grouping service
// =====================================================

// --- DRG Grouping Results ---

export type DRGType = 'ms_drg' | 'ap_drg' | 'apr_drg';

export type DRGStatus = 'preliminary' | 'confirmed' | 'appealed' | 'final';

export interface DRGGroupingResult {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string;
  principal_diagnosis_code: string;
  secondary_diagnosis_codes: string[];
  procedure_codes: string[];
  drg_code: string;
  drg_description: string | null;
  drg_weight: number;
  drg_type: DRGType;
  mdc_code: string | null;
  mdc_description: string | null;
  has_cc: boolean;
  has_mcc: boolean;
  cc_codes: string[];
  mcc_codes: string[];
  base_drg_code: string | null;
  base_drg_weight: number | null;
  cc_drg_code: string | null;
  cc_drg_weight: number | null;
  mcc_drg_code: string | null;
  mcc_drg_weight: number | null;
  optimal_drg_code: string | null;
  estimated_reimbursement: number | null;
  base_rate_used: number | null;
  grouper_version: string;
  ai_skill_key: string;
  ai_model_used: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  status: DRGStatus;
  created_at: string;
  updated_at: string;
}

// --- MCP Logger interface ---

export interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  security(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
}
