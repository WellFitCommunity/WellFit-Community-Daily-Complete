// =====================================================
// MCP Medical Coding Server — Type Definitions
// Chain 6: Medical Coding Processor
// =====================================================

// --- Payer Rules ---

export type PayerType = 'medicare' | 'medicaid' | 'commercial' | 'tricare' | 'workers_comp';

export type RuleType = 'drg_based' | 'per_diem' | 'case_rate' | 'percent_of_charges' | 'fee_schedule';

export type AcuityTier = 'icu' | 'step_down' | 'med_surg' | 'rehab' | 'psych' | 'snf' | 'ltac';

export interface PayerRule {
  id: string;
  tenant_id: string;
  payer_type: PayerType;
  state_code: string | null;
  fiscal_year: number;
  rule_type: RuleType;
  acuity_tier: string | null;
  base_rate_amount: number | null;
  capital_rate_amount: number | null;
  wage_index_factor: number;
  cost_of_living_adjustment: number;
  per_diem_rate: number | null;
  allowable_percentage: number | null;
  max_days: number | null;
  outlier_threshold: number | null;
  revenue_codes: unknown[];
  cos_criteria: Record<string, unknown>;
  carve_out_codes: unknown[];
  drg_adjustments: Record<string, unknown>;
  rule_description: string | null;
  source_reference: string | null;
  is_active: boolean;
  effective_date: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

// --- Daily Charge Snapshots ---

export type SnapshotStatus = 'draft' | 'reviewed' | 'finalized' | 'billed';

export interface ChargeEntry {
  code: string;
  code_system: string;       // 'cpt' | 'hcpcs' | 'revenue'
  description: string;
  charge_amount: number;
  units: number;
  modifiers: string[];
  source_table: string;      // Which table this was aggregated from
  source_id: string;         // Row ID for audit trail
}

export interface ChargesByCategory {
  lab: ChargeEntry[];
  imaging: ChargeEntry[];
  pharmacy: ChargeEntry[];
  nursing: ChargeEntry[];
  procedure: ChargeEntry[];
  evaluation: ChargeEntry[];
  other: ChargeEntry[];
}

export interface OptimizationSuggestion {
  type: 'missing_charge' | 'upgrade_opportunity' | 'documentation_gap' | 'modifier_suggestion';
  description: string;
  potential_impact_amount: number | null;
  suggested_code: string | null;
  confidence: number;        // 0-1
}

export interface DailyChargeSnapshot {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string;
  admit_date: string;
  service_date: string;
  day_number: number;
  charges: ChargesByCategory;
  total_charge_amount: number;
  charge_count: number;
  projected_drg_code: string | null;
  projected_drg_weight: number | null;
  projected_reimbursement: number | null;
  revenue_codes: unknown[];
  optimization_suggestions: OptimizationSuggestion[];
  missing_charge_alerts: unknown[];
  documentation_gaps: unknown[];
  status: SnapshotStatus;
  ai_skill_key: string;
  ai_model_used: string | null;
  created_at: string;
  updated_at: string;
}

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

// --- Revenue Projection ---

export interface RevenueProjection {
  drg_code: string;
  drg_weight: number;
  base_rate: number;
  wage_index: number;
  capital_rate: number;
  operating_payment: number;   // base_rate × drg_weight × wage_index
  capital_payment: number;     // capital_rate × drg_weight
  total_estimated: number;     // operating + capital
  payer_type: PayerType;
  adjustments_applied: string[];
}

// --- MCP Logger interface ---

export interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  security(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
}
