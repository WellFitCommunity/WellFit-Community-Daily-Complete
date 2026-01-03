/**
 * MCP PostgreSQL Client - Browser-Safe Version
 *
 * Provides safe, controlled database operations via MCP.
 * All queries are pre-approved and whitelisted on the server.
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// Types
// =====================================================

export interface PostgresQueryResult<T = unknown> {
  success: boolean;
  data?: T[];
  error?: string;
  metadata?: {
    rowsReturned: number;
    executionTimeMs: number;
    queryName?: string;
  };
}

export interface QueryDefinition {
  name: string;
  description: string;
  parameters: string[];
  maxRows?: number;
}

// Available whitelisted queries
export type WhitelistedQueryName =
  | 'get_patient_count_by_risk'
  | 'get_readmission_risk_summary'
  | 'get_encounter_summary'
  | 'get_sdoh_flags_summary'
  | 'get_medication_adherence_stats'
  | 'get_claims_status_summary'
  | 'get_billing_revenue_summary'
  | 'get_care_plan_summary'
  | 'get_task_completion_rate'
  | 'get_referral_summary'
  | 'get_bed_availability'
  | 'get_shift_handoff_summary'
  | 'get_dashboard_metrics'
  | 'get_quality_metrics';

// =====================================================
// PostgreSQL MCP Client
// =====================================================

class PostgresMCPClient {
  private static instance: PostgresMCPClient;
  private edgeFunctionUrl: string;
  private initialized = false;

  private constructor() {
    this.edgeFunctionUrl = `${SB_URL}/functions/v1/mcp-postgres-server`;
  }

  static getInstance(): PostgresMCPClient {
    if (!PostgresMCPClient.instance) {
      PostgresMCPClient.instance = new PostgresMCPClient();
    }
    return PostgresMCPClient.instance;
  }

  private getAuthToken(): string {
    try {
      const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.access_token || '';
      }
    } catch {
      // Ignore errors
    }
    return '';
  }

  /**
   * Execute a whitelisted query
   */
  async executeQuery<T = unknown>(
    queryName: WhitelistedQueryName,
    tenantId: string,
    parameters?: Record<string, unknown>
  ): Promise<PostgresQueryResult<T>> {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: 'execute_query',
            arguments: {
              query_name: queryName,
              tenant_id: tenantId,
              parameters
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Query execution failed'
        };
      }

      const result = await response.json();

      return {
        success: true,
        data: result.content?.[0]?.data || [],
        metadata: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all available queries
   */
  async listQueries(): Promise<QueryDefinition[]> {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: 'list_queries',
            arguments: {}
          }
        })
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      return result.content?.[0]?.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Get table schema
   */
  async getTableSchema(tableName: string): Promise<PostgresQueryResult> {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: 'get_table_schema',
            arguments: { table_name: tableName }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Schema lookup failed'
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result.content?.[0]?.data || [],
        metadata: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get row count for a table
   */
  async getRowCount(tableName: string, tenantId?: string): Promise<PostgresQueryResult<{ table: string; count: number }>> {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: 'get_row_count',
            arguments: {
              table_name: tableName,
              tenant_id: tenantId
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Count failed'
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: [result.content?.[0]?.data || { table: tableName, count: 0 }],
        metadata: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// =====================================================
// Convenience Functions
// =====================================================

const client = PostgresMCPClient.getInstance();

/**
 * Get dashboard metrics for a tenant
 */
export async function getDashboardMetrics(tenantId: string) {
  return client.executeQuery<{
    active_members: number;
    high_risk_patients: number;
    todays_encounters: number;
    pending_tasks: number;
    active_sdoh_flags: number;
  }>('get_dashboard_metrics', tenantId);
}

/**
 * Get patient risk distribution
 */
export async function getPatientRiskDistribution(tenantId: string) {
  return client.executeQuery<{
    risk_level: string;
    count: number;
  }>('get_patient_count_by_risk', tenantId);
}

/**
 * Get readmission risk summary
 */
export async function getReadmissionRiskSummary(tenantId: string) {
  return client.executeQuery<{
    risk_category: string;
    patient_count: number;
  }>('get_readmission_risk_summary', tenantId);
}

/**
 * Get encounter summary for last 30 days
 */
export async function getEncounterSummary(tenantId: string) {
  return client.executeQuery<{
    encounter_type: string;
    status: string;
    count: number;
    date: string;
  }>('get_encounter_summary', tenantId);
}

/**
 * Get SDOH flags summary
 */
export async function getSDOHFlagsSummary(tenantId: string) {
  return client.executeQuery<{
    flag_type: string;
    severity: string;
    count: number;
  }>('get_sdoh_flags_summary', tenantId);
}

/**
 * Get medication adherence statistics
 */
export async function getMedicationAdherenceStats(tenantId: string) {
  return client.executeQuery<{
    adherence_category: string;
    patient_count: number;
  }>('get_medication_adherence_stats', tenantId);
}

/**
 * Get claims status summary
 */
export async function getClaimsStatusSummary(tenantId: string) {
  return client.executeQuery<{
    status: string;
    count: number;
    total_charges: number;
  }>('get_claims_status_summary', tenantId);
}

/**
 * Get billing revenue summary
 */
export async function getBillingRevenueSummary(tenantId: string) {
  return client.executeQuery<{
    date: string;
    claim_count: number;
    charges: number;
    collected: number;
  }>('get_billing_revenue_summary', tenantId);
}

/**
 * Get care plan summary
 */
export async function getCarePlanSummary(tenantId: string) {
  return client.executeQuery<{
    status: string;
    count: number;
  }>('get_care_plan_summary', tenantId);
}

/**
 * Get task completion rate
 */
export async function getTaskCompletionRate(tenantId: string) {
  return client.executeQuery<{
    date: string;
    completed: number;
    total: number;
  }>('get_task_completion_rate', tenantId);
}

/**
 * Get referral summary
 */
export async function getReferralSummary(tenantId: string) {
  return client.executeQuery<{
    organization_name: string;
    status: string;
    count: number;
  }>('get_referral_summary', tenantId);
}

/**
 * Get bed availability
 */
export async function getBedAvailability(tenantId: string) {
  return client.executeQuery<{
    unit: string;
    status: string;
    count: number;
  }>('get_bed_availability', tenantId);
}

/**
 * Get shift handoff summary
 */
export async function getShiftHandoffSummary(tenantId: string) {
  return client.executeQuery<{
    shift_type: string;
    status: string;
    count: number;
    avg_duration_minutes: number;
  }>('get_shift_handoff_summary', tenantId);
}

/**
 * Get quality metrics
 */
export async function getQualityMetrics(tenantId: string) {
  return client.executeQuery<{
    measure_code: string;
    measure_name: string;
    numerator: number;
    denominator: number;
    performance_rate: number;
  }>('get_quality_metrics', tenantId);
}

// Export singleton for advanced usage
export const postgresMCP = client;
export { PostgresMCPClient };
