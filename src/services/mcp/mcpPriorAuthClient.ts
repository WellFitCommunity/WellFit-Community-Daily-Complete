/**
 * Prior Auth MCP Client — Browser-Safe Version
 *
 * Purpose: Wraps all 11 mcp-prior-auth-server tools for prior authorization
 *          lifecycle management: create, submit, get, record decisions,
 *          appeals, FHIR export, and statistics.
 *
 * HIPAA Compliance:
 * - Patient IDs only (no PHI in browser)
 * - Audit logging for all operations
 *
 * MCP Server: mcp-prior-auth-server (Tier 3 — service role required)
 */

import { SB_URL } from '../../settings/settings';
import { getSupabaseAuthToken } from './mcpHelpers';

// =====================================================
// Types
// =====================================================

export interface PriorAuthRequest {
  patient_id: string;
  payer_id: string;
  payer_name?: string;
  service_codes: string[];
  diagnosis_codes: string[];
  urgency: 'routine' | 'urgent' | 'stat';
  clinical_notes?: string;
  date_of_service?: string;
  provider_npi?: string;
}

export interface PriorAuthRecord {
  id: string;
  patient_id: string;
  payer_id: string;
  payer_name?: string;
  status: string;
  urgency: string;
  service_codes: string[];
  diagnosis_codes: string[];
  clinical_notes?: string;
  date_of_service?: string;
  auth_number?: string;
  effective_date?: string;
  expiration_date?: string;
  decision_date?: string;
  denial_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PriorAuthDecision {
  prior_auth_id: string;
  decision_type: 'approved' | 'denied' | 'partial_approval' | 'pending_additional_info';
  auth_number?: string;
  effective_date?: string;
  expiration_date?: string;
  denial_reason?: string;
  denial_codes?: string[];
  notes?: string;
}

export interface PriorAuthAppeal {
  prior_auth_id: string;
  appeal_type: 'first_level' | 'second_level' | 'external_review';
  reason: string;
  clinical_rationale: string;
  supporting_documents?: string[];
}

export interface PriorAuthAppealRecord {
  id: string;
  prior_auth_id: string;
  appeal_type: string;
  reason: string;
  clinical_rationale: string;
  status: string;
  created_at: string;
}

export interface PriorAuthRequiredCheck {
  required: boolean;
  payer_id: string;
  service_codes: string[];
  reason?: string;
  alternative_codes?: string[];
}

export interface PriorAuthStatistics {
  total: number;
  by_status: Record<string, number>;
  approval_rate: number;
  avg_response_days: number;
  pending_count: number;
  denied_count: number;
  appealed_count: number;
}

export interface FHIRClaimResource {
  resourceType: string;
  [key: string]: unknown;
}

export interface PriorAuthResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// Prior Auth MCP Client
// =====================================================

class PriorAuthMCPClient {
  private static instance: PriorAuthMCPClient;
  private edgeFunctionUrl: string;

  private constructor() {
    this.edgeFunctionUrl = `${SB_URL}/functions/v1/mcp-prior-auth-server`;
  }

  static getInstance(): PriorAuthMCPClient {
    if (!PriorAuthMCPClient.instance) {
      PriorAuthMCPClient.instance = new PriorAuthMCPClient();
    }
    return PriorAuthMCPClient.instance;
  }

  private getAuthToken(): string {
    return getSupabaseAuthToken();
  }

  private async callTool<T>(toolName: string, args: Record<string, unknown>): Promise<PriorAuthResult<T>> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();

      if (result.content?.[0]?.data) {
        return { success: true, data: result.content[0].data as T };
      }

      return { success: false, error: 'Invalid response format' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  // ─────────────────────────────────────────────────────
  // Create & Submit
  // ─────────────────────────────────────────────────────

  async createPriorAuth(request: PriorAuthRequest): Promise<PriorAuthResult<PriorAuthRecord>> {
    return this.callTool<PriorAuthRecord>('create_prior_auth', request as unknown as Record<string, unknown>);
  }

  async submitPriorAuth(priorAuthId: string): Promise<PriorAuthResult<PriorAuthRecord>> {
    return this.callTool<PriorAuthRecord>('submit_prior_auth', { prior_auth_id: priorAuthId });
  }

  // ─────────────────────────────────────────────────────
  // Retrieval
  // ─────────────────────────────────────────────────────

  async getPriorAuth(priorAuthId: string): Promise<PriorAuthResult<PriorAuthRecord>> {
    return this.callTool<PriorAuthRecord>('get_prior_auth', { prior_auth_id: priorAuthId });
  }

  async getPatientPriorAuths(patientId: string): Promise<PriorAuthResult<PriorAuthRecord[]>> {
    return this.callTool<PriorAuthRecord[]>('get_patient_prior_auths', { patient_id: patientId });
  }

  async getPendingPriorAuths(): Promise<PriorAuthResult<PriorAuthRecord[]>> {
    return this.callTool<PriorAuthRecord[]>('get_pending_prior_auths', {});
  }

  // ─────────────────────────────────────────────────────
  // Decision & Appeals
  // ─────────────────────────────────────────────────────

  async recordDecision(decision: PriorAuthDecision): Promise<PriorAuthResult<PriorAuthRecord>> {
    return this.callTool<PriorAuthRecord>('record_decision', decision as unknown as Record<string, unknown>);
  }

  async createAppeal(appeal: PriorAuthAppeal): Promise<PriorAuthResult<PriorAuthAppealRecord>> {
    return this.callTool<PriorAuthAppealRecord>('create_appeal', appeal as unknown as Record<string, unknown>);
  }

  // ─────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────

  async checkPriorAuthRequired(
    payerId: string,
    serviceCodes: string[],
  ): Promise<PriorAuthResult<PriorAuthRequiredCheck>> {
    return this.callTool<PriorAuthRequiredCheck>('check_prior_auth_required', {
      payer_id: payerId,
      service_codes: serviceCodes,
    });
  }

  async getStatistics(): Promise<PriorAuthResult<PriorAuthStatistics>> {
    return this.callTool<PriorAuthStatistics>('get_prior_auth_statistics', {});
  }

  async cancelPriorAuth(priorAuthId: string, reason?: string): Promise<PriorAuthResult<PriorAuthRecord>> {
    return this.callTool<PriorAuthRecord>('cancel_prior_auth', {
      prior_auth_id: priorAuthId,
      reason: reason || 'Cancelled by user',
    });
  }

  async toFhirClaim(priorAuthId: string): Promise<PriorAuthResult<FHIRClaimResource>> {
    return this.callTool<FHIRClaimResource>('to_fhir_claim', { prior_auth_id: priorAuthId });
  }
}

// =====================================================
// Singleton Export
// =====================================================

export const priorAuthMCP = PriorAuthMCPClient.getInstance();
export default priorAuthMCP;
