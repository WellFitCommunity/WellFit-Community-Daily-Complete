/**
 * Medical Coding MCP Client
 *
 * Browser-safe client for revenue cycle and medical coding operations:
 * - Payer reimbursement rules (Medicare DRG, Medicaid per diem)
 * - Daily charge aggregation from encounter data
 * - AI-powered DRG grouping (3-pass MS-DRG methodology)
 * - Revenue optimization and charge validation
 * - Revenue projection with payer-specific rate calculations
 *
 * Advisory Only: All AI suggestions are advisory — never auto-filed.
 * Audit: All operations logged for compliance.
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// Types
// =====================================================

export type PayerType = 'medicare' | 'medicaid' | 'commercial' | 'tricare' | 'workers_comp';

export type RuleType = 'drg_based' | 'per_diem' | 'case_rate' | 'percent_of_charges' | 'fee_schedule';

export type AcuityTier = 'icu' | 'step_down' | 'med_surg' | 'rehab' | 'psych' | 'snf' | 'ltac';

export type SnapshotStatus = 'draft' | 'reviewed' | 'finalized' | 'billed';

export interface PayerRule {
  id: string;
  payer_type: PayerType;
  state_code: string | null;
  fiscal_year: number;
  rule_type: RuleType;
  acuity_tier: string | null;
  base_rate_amount: number | null;
  capital_rate_amount: number | null;
  wage_index_factor: number;
  per_diem_rate: number | null;
  allowable_percentage: number | null;
  max_days: number | null;
  outlier_threshold: number | null;
  carve_out_codes: string[] | null;
  rule_description: string | null;
  source_reference: string | null;
  effective_date: string;
  expiration_date: string | null;
  is_active: boolean;
}

export interface ChargeCategory {
  category: string;
  charges: Array<{
    code: string;
    description: string;
    charge_amount: number;
    quantity: number;
    source: string;
  }>;
  subtotal: number;
}

export interface DailyChargeSnapshot {
  encounter_id: string;
  patient_id: string;
  service_date: string;
  day_number: number;
  charges: Record<string, ChargeCategory>;
  total_charge_amount: number;
  charge_count: number;
  status: SnapshotStatus;
}

export interface DRGResult {
  encounter_id: string;
  drg_code: string;
  drg_description: string;
  drg_weight: number;
  mdc: string;
  severity: 'base' | 'cc' | 'mcc';
  principal_diagnosis: string;
  secondary_diagnoses: string[];
  procedures: string[];
  grouper_version: string;
  analysis: {
    base_drg: { code: string; weight: number; description: string };
    cc_drg: { code: string; weight: number; description: string } | null;
    mcc_drg: { code: string; weight: number; description: string } | null;
    selected: string;
    rationale: string;
  };
  advisory_disclaimer: string;
}

export interface RevenueOptimization {
  encounter_id: string;
  service_date: string;
  findings: Array<{
    type: 'missing_code' | 'upgrade_opportunity' | 'documentation_gap' | 'modifier_suggestion';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggested_action: string;
    estimated_impact: number | null;
    codes?: string[];
  }>;
  summary: {
    total_findings: number;
    estimated_revenue_impact: number;
    critical_items: number;
  };
  advisory_disclaimer: string;
}

export interface ChargeValidation {
  encounter_id: string;
  service_date: string;
  completeness_score: number;
  alerts: Array<{
    category: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    suggested_codes: string[];
    estimated_impact: number | null;
  }>;
}

export interface RevenueProjection {
  payer_type: PayerType;
  drg_code: string;
  drg_weight: number;
  operating_payment: number;
  capital_payment: number;
  total_expected: number;
  base_rate: number;
  wage_index: number;
  methodology: string;
  breakdown: Record<string, number>;
}

export interface MedicalCodingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// Client Class
// =====================================================

export class MedicalCodingMCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${SB_URL}/functions/v1/mcp-medical-coding-server`;
  }

  private getAuthToken(): string {
    try {
      const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData) as { access_token?: string };
        return parsed.access_token || '';
      }
    } catch {
      // Ignore parse errors
    }
    return '';
  }

  private async request<T>(tool: string, args: Record<string, unknown>): Promise<MedicalCodingResult<T>> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: { name: tool, arguments: args },
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json() as Record<string, unknown>;

      // MCP servers return JSON-RPC: { jsonrpc, result: { content: [{ type: "text", text }] }, id }
      const resultObj = result.result as Record<string, unknown> | undefined;
      const content = (resultObj?.content ?? result.content) as Array<{ type?: string; text?: string }> | undefined;
      const textContent = content?.[0]?.text;
      if (textContent) {
        return { success: true, data: JSON.parse(textContent) as T };
      }

      return { success: false, error: 'Invalid response format' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  // -----------------------------------------------
  // Payer Rules
  // -----------------------------------------------

  async getPayerRules(params: {
    payer_type: PayerType;
    fiscal_year: number;
    state_code?: string;
    rule_type?: RuleType;
    acuity_tier?: AcuityTier;
    is_active?: boolean;
  }): Promise<MedicalCodingResult<{ rules: PayerRule[]; total: number }>> {
    return this.request('get_payer_rules', params);
  }

  async upsertPayerRule(params: {
    payer_type: PayerType;
    fiscal_year: number;
    rule_type: RuleType;
    effective_date: string;
    state_code?: string;
    acuity_tier?: string;
    base_rate_amount?: number;
    capital_rate_amount?: number;
    wage_index_factor?: number;
    per_diem_rate?: number;
    allowable_percentage?: number;
    max_days?: number;
    outlier_threshold?: number;
    carve_out_codes?: string[];
    rule_description?: string;
    source_reference?: string;
    expiration_date?: string;
  }): Promise<MedicalCodingResult<{ rule: PayerRule; action: 'created' | 'updated' }>> {
    return this.request('upsert_payer_rule', params);
  }

  // -----------------------------------------------
  // Charge Aggregation
  // -----------------------------------------------

  async aggregateDailyCharges(params: {
    patient_id: string;
    encounter_id: string;
    service_date: string;
  }): Promise<MedicalCodingResult<DailyChargeSnapshot>> {
    return this.request('aggregate_daily_charges', params);
  }

  async getDailySnapshot(params: {
    encounter_id: string;
    service_date?: string;
  }): Promise<MedicalCodingResult<DailyChargeSnapshot>> {
    return this.request('get_daily_snapshot', params);
  }

  async saveDailySnapshot(params: {
    encounter_id: string;
    patient_id: string;
    admit_date: string;
    service_date: string;
    day_number: number;
    charges?: Record<string, unknown>;
    total_charge_amount?: number;
    charge_count?: number;
    status?: SnapshotStatus;
  }): Promise<MedicalCodingResult<{ snapshot_id: string; status: string }>> {
    return this.request('save_daily_snapshot', params);
  }

  // -----------------------------------------------
  // DRG Grouper
  // -----------------------------------------------

  async runDRGGrouper(params: {
    encounter_id: string;
    patient_id: string;
    principal_diagnosis?: string;
    additional_diagnoses?: string[];
    procedure_codes?: string[];
  }): Promise<MedicalCodingResult<DRGResult>> {
    return this.request('run_drg_grouper', params);
  }

  async getDRGResult(params: {
    encounter_id: string;
    grouper_version?: string;
  }): Promise<MedicalCodingResult<DRGResult>> {
    return this.request('get_drg_result', params);
  }

  // -----------------------------------------------
  // Revenue Optimization
  // -----------------------------------------------

  async optimizeDailyRevenue(params: {
    encounter_id: string;
    service_date: string;
  }): Promise<MedicalCodingResult<RevenueOptimization>> {
    return this.request('optimize_daily_revenue', params);
  }

  async validateChargeCompleteness(params: {
    encounter_id: string;
    service_date: string;
  }): Promise<MedicalCodingResult<ChargeValidation>> {
    return this.request('validate_charge_completeness', params);
  }

  // -----------------------------------------------
  // Revenue Projection
  // -----------------------------------------------

  async getRevenueProjection(params: {
    payer_type: PayerType;
    encounter_id?: string;
    drg_code?: string;
    drg_weight?: number;
    fiscal_year?: number;
    state_code?: string;
    wage_index_override?: number;
  }): Promise<MedicalCodingResult<RevenueProjection>> {
    return this.request('get_revenue_projection', params);
  }
}

// =====================================================
// Singleton Instance & Helper Functions
// =====================================================

const medicalCodingClient = new MedicalCodingMCPClient();

/**
 * Get payer reimbursement rules (Medicare DRG rates, Medicaid per diem, etc.)
 */
export async function getPayerRules(
  payerType: PayerType,
  fiscalYear: number,
  options?: { stateCode?: string; ruleType?: RuleType; acuityTier?: AcuityTier }
): Promise<MedicalCodingResult<{ rules: PayerRule[]; total: number }>> {
  return medicalCodingClient.getPayerRules({
    payer_type: payerType,
    fiscal_year: fiscalYear,
    ...options && {
      state_code: options.stateCode,
      rule_type: options.ruleType,
      acuity_tier: options.acuityTier,
    }
  });
}

/**
 * Create or update a payer reimbursement rule
 */
export async function upsertPayerRule(
  params: Parameters<MedicalCodingMCPClient['upsertPayerRule']>[0]
): Promise<MedicalCodingResult<{ rule: PayerRule; action: 'created' | 'updated' }>> {
  return medicalCodingClient.upsertPayerRule(params);
}

/**
 * Aggregate all billable charges for a patient encounter on a specific date
 */
export async function aggregateDailyCharges(
  patientId: string,
  encounterId: string,
  serviceDate: string
): Promise<MedicalCodingResult<DailyChargeSnapshot>> {
  return medicalCodingClient.aggregateDailyCharges({
    patient_id: patientId,
    encounter_id: encounterId,
    service_date: serviceDate,
  });
}

/**
 * Get existing daily charge snapshot
 */
export async function getDailySnapshot(
  encounterId: string,
  serviceDate?: string
): Promise<MedicalCodingResult<DailyChargeSnapshot>> {
  return medicalCodingClient.getDailySnapshot({
    encounter_id: encounterId,
    service_date: serviceDate,
  });
}

/**
 * Save a daily charge snapshot
 */
export async function saveDailySnapshot(
  params: Parameters<MedicalCodingMCPClient['saveDailySnapshot']>[0]
): Promise<MedicalCodingResult<{ snapshot_id: string; status: string }>> {
  return medicalCodingClient.saveDailySnapshot(params);
}

/**
 * Run AI-powered DRG grouper (3-pass MS-DRG methodology)
 * Advisory only — never auto-assigns
 */
export async function runDRGGrouper(
  encounterId: string,
  patientId: string,
  options?: {
    principalDiagnosis?: string;
    additionalDiagnoses?: string[];
    procedureCodes?: string[];
  }
): Promise<MedicalCodingResult<DRGResult>> {
  return medicalCodingClient.runDRGGrouper({
    encounter_id: encounterId,
    patient_id: patientId,
    ...options && {
      principal_diagnosis: options.principalDiagnosis,
      additional_diagnoses: options.additionalDiagnoses,
      procedure_codes: options.procedureCodes,
    }
  });
}

/**
 * Get existing DRG result for an encounter
 */
export async function getDRGResult(
  encounterId: string,
  grouperVersion?: string
): Promise<MedicalCodingResult<DRGResult>> {
  return medicalCodingClient.getDRGResult({
    encounter_id: encounterId,
    grouper_version: grouperVersion,
  });
}

/**
 * AI revenue optimization — identifies missing codes, upgrade opportunities
 * Advisory only — compliance-safe
 */
export async function optimizeDailyRevenue(
  encounterId: string,
  serviceDate: string
): Promise<MedicalCodingResult<RevenueOptimization>> {
  return medicalCodingClient.optimizeDailyRevenue({
    encounter_id: encounterId,
    service_date: serviceDate,
  });
}

/**
 * Rule-based charge completeness validation
 * No AI cost — pure rules engine
 */
export async function validateChargeCompleteness(
  encounterId: string,
  serviceDate: string
): Promise<MedicalCodingResult<ChargeValidation>> {
  return medicalCodingClient.validateChargeCompleteness({
    encounter_id: encounterId,
    service_date: serviceDate,
  });
}

/**
 * Calculate expected reimbursement (DRG weight x base rate x wage index)
 */
export async function getRevenueProjection(
  payerType: PayerType,
  options?: {
    encounterId?: string;
    drgCode?: string;
    drgWeight?: number;
    fiscalYear?: number;
    stateCode?: string;
    wageIndexOverride?: number;
  }
): Promise<MedicalCodingResult<RevenueProjection>> {
  return medicalCodingClient.getRevenueProjection({
    payer_type: payerType,
    ...options && {
      encounter_id: options.encounterId,
      drg_code: options.drgCode,
      drg_weight: options.drgWeight,
      fiscal_year: options.fiscalYear,
      state_code: options.stateCode,
      wage_index_override: options.wageIndexOverride,
    }
  });
}

export default medicalCodingClient;
