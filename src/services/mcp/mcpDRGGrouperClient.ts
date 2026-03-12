/**
 * DRG Grouper MCP Client (Standalone Revenue Intelligence)
 *
 * Browser-safe client for the standalone DRG Grouper SaaS API.
 * This connects to `mcp-drg-grouper-server` — the monetizable
 * standalone revenue intelligence engine.
 *
 * 6 tools:
 * - run_drg_grouper: AI-powered 3-pass MS-DRG assignment
 * - get_drg_result: Retrieve existing DRG grouping result
 * - estimate_reimbursement: DRG weight × base rate × wage index
 * - validate_coding: Rule-based charge completeness check
 * - flag_revenue_risk: AI-powered revenue risk analysis
 * - get_payer_rules: Payer rate reference lookup
 *
 * Advisory Only: All AI suggestions are advisory — never auto-assigned.
 * Audit: All operations logged for compliance.
 */

import { SB_URL } from '../../settings/settings';
import { getSupabaseAuthToken } from './mcpHelpers';

// =====================================================
// Types
// =====================================================

export interface DRGAnalysis {
  base_drg: { code: string; weight: number; description: string };
  cc_drg: { code: string; weight: number; description: string } | null;
  mcc_drg: { code: string; weight: number; description: string } | null;
  selected: string;
  rationale: string;
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
  analysis: DRGAnalysis;
  advisory_disclaimer: string;
}

export interface DRGGrouperResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RunDRGGrouperParams {
  encounter_id: string;
  patient_id: string;
  principal_diagnosis?: string;
  additional_diagnoses?: string[];
  procedure_codes?: string[];
}

export interface GetDRGResultParams {
  encounter_id: string;
  grouper_version?: string;
}

export interface EstimateReimbursementParams {
  encounter_id?: string;
  drg_code?: string;
  drg_weight?: number;
  payer_type: string;
  fiscal_year?: number;
  state_code?: string;
  wage_index_override?: number;
}

export interface ValidateCodingParams {
  encounter_id: string;
  service_date: string;
}

export interface FlagRevenueRiskParams {
  encounter_id: string;
  service_date: string;
}

export interface GetPayerRulesParams {
  payer_type: string;
  fiscal_year: number;
  state_code?: string;
  rule_type?: string;
  is_active?: boolean;
}

// =====================================================
// Client Class
// =====================================================

export class DRGGrouperMCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${SB_URL}/functions/v1/mcp-drg-grouper-server`;
  }

  private getAuthToken(): string {
    return getSupabaseAuthToken();
  }

  private async request<T>(tool: string, args: Record<string, unknown>): Promise<DRGGrouperResult<T>> {
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

      // MCP JSON-RPC: { jsonrpc, result: { content: [{ type: "text", text }] }, id }
      const resultObj = result.result as Record<string, unknown> | undefined;
      const content = (resultObj?.content ?? result.content) as Array<{ type?: string; text?: string }> | undefined;
      const textContent = content?.[0]?.text;
      if (textContent) {
        return { success: true, data: JSON.parse(textContent) as T };
      }

      // Check for JSON-RPC error
      if (result.error) {
        const errorObj = result.error as Record<string, unknown>;
        return { success: false, error: (errorObj.message as string) || 'RPC error' };
      }

      return { success: false, error: 'Invalid response format' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { success: false, error: error.message };
    }
  }

  // =======================================================
  // DRG Grouper Tools
  // =======================================================

  /**
   * Run AI-powered 3-pass MS-DRG assignment on an encounter.
   * Extracts ICD-10 codes from clinical documentation and selects
   * the highest valid DRG through base/CC/MCC analysis.
   */
  async runDRGGrouper(params: RunDRGGrouperParams): Promise<DRGGrouperResult<DRGResult>> {
    return this.request<DRGResult>('run_drg_grouper', params as unknown as Record<string, unknown>);
  }

  /**
   * Retrieve an existing DRG grouping result for an encounter.
   */
  async getDRGResult(params: GetDRGResultParams): Promise<DRGGrouperResult<DRGResult>> {
    return this.request<DRGResult>('get_drg_result', params as unknown as Record<string, unknown>);
  }

  /**
   * Calculate expected reimbursement from DRG weight × payer base rate.
   * Supports Medicare DRG-based and Medicaid per diem models.
   */
  async estimateReimbursement(params: EstimateReimbursementParams): Promise<DRGGrouperResult<unknown>> {
    return this.request<unknown>('estimate_reimbursement', params as unknown as Record<string, unknown>);
  }

  /**
   * Rule-based charge completeness validation.
   * Checks for commonly missed charges by category (lab, imaging, pharmacy, etc.).
   */
  async validateCoding(params: ValidateCodingParams): Promise<DRGGrouperResult<unknown>> {
    return this.request<unknown>('validate_coding', params as unknown as Record<string, unknown>);
  }

  /**
   * AI-powered revenue risk analysis.
   * Identifies missing codes, upgrade opportunities, documentation gaps.
   */
  async flagRevenueRisk(params: FlagRevenueRiskParams): Promise<DRGGrouperResult<unknown>> {
    return this.request<unknown>('flag_revenue_risk', params as unknown as Record<string, unknown>);
  }

  /**
   * Look up payer reimbursement rules (base rates, per diem, wage index).
   */
  async getPayerRules(params: GetPayerRulesParams): Promise<DRGGrouperResult<unknown>> {
    return this.request<unknown>('get_payer_rules', params as unknown as Record<string, unknown>);
  }

  /**
   * Health check — verify the DRG grouper server is responsive.
   */
  async ping(): Promise<DRGGrouperResult<{ status: string }>> {
    return this.request<{ status: string }>('ping', {});
  }
}

// =====================================================
// Singleton Instance
// =====================================================

const drgGrouperClient = new DRGGrouperMCPClient();

// =====================================================
// Exported Helper Functions
// =====================================================

/**
 * Run DRG grouper on an encounter (convenience function).
 */
export async function runDRGGrouper(
  encounterId: string,
  patientId: string,
  options?: {
    principal_diagnosis?: string;
    additional_diagnoses?: string[];
    procedure_codes?: string[];
  }
): Promise<DRGGrouperResult<DRGResult>> {
  return drgGrouperClient.runDRGGrouper({
    encounter_id: encounterId,
    patient_id: patientId,
    ...options
  });
}

/**
 * Get existing DRG result for an encounter (convenience function).
 */
export async function getDRGResult(
  encounterId: string,
  grouperVersion?: string
): Promise<DRGGrouperResult<DRGResult>> {
  return drgGrouperClient.getDRGResult({
    encounter_id: encounterId,
    grouper_version: grouperVersion
  });
}

/**
 * Estimate reimbursement for a DRG (convenience function).
 */
export async function estimateReimbursement(
  payerType: string,
  options?: {
    encounter_id?: string;
    drg_code?: string;
    drg_weight?: number;
    fiscal_year?: number;
    state_code?: string;
    wage_index_override?: number;
  }
): Promise<DRGGrouperResult<unknown>> {
  return drgGrouperClient.estimateReimbursement({
    payer_type: payerType,
    ...options
  });
}

/**
 * Validate coding completeness for an encounter day (convenience function).
 */
export async function validateCoding(
  encounterId: string,
  serviceDate: string
): Promise<DRGGrouperResult<unknown>> {
  return drgGrouperClient.validateCoding({
    encounter_id: encounterId,
    service_date: serviceDate
  });
}

/**
 * Flag revenue risks for an encounter day (convenience function).
 */
export async function flagRevenueRisk(
  encounterId: string,
  serviceDate: string
): Promise<DRGGrouperResult<unknown>> {
  return drgGrouperClient.flagRevenueRisk({
    encounter_id: encounterId,
    service_date: serviceDate
  });
}

export default drgGrouperClient;
