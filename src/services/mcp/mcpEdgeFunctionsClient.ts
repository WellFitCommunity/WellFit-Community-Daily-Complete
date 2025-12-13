/**
 * MCP Edge Functions Client - Browser-Safe Version
 *
 * Orchestrate and monitor Supabase Edge Functions via MCP.
 * Provides safe invocation of whitelisted functions with audit logging.
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// Types
// =====================================================

export type FunctionCategory = 'analytics' | 'reports' | 'workflow' | 'integration' | 'utility';

export interface FunctionDefinition {
  name: string;
  description: string;
  category: FunctionCategory;
  requiresAuth: boolean;
  parameters?: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  sideEffects: 'none' | 'read' | 'write';
}

export interface FunctionInvocationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

export interface BatchInvocationResult {
  results: Array<{
    function_name: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTimeMs: number;
  }>;
  completed: number;
  total: number;
  allSucceeded: boolean;
}

// Available functions
export type AllowedFunctionName =
  | 'get-welfare-priorities'
  | 'calculate-readmission-risk'
  | 'sdoh-passive-detect'
  | 'generate-engagement-report'
  | 'generate-quality-report'
  | 'enhanced-fhir-export'
  | 'hl7-receive'
  | 'generate-837p'
  | 'process-shift-handoff'
  | 'create-care-alert'
  | 'send-sms'
  | 'hash-pin'
  | 'verify-pin';

// =====================================================
// Edge Functions MCP Client
// =====================================================

class EdgeFunctionsMCPClient {
  private static instance: EdgeFunctionsMCPClient;
  private edgeFunctionUrl: string;

  private constructor() {
    this.edgeFunctionUrl = `${SB_URL}/functions/v1/mcp-edge-functions-server`;
  }

  static getInstance(): EdgeFunctionsMCPClient {
    if (!EdgeFunctionsMCPClient.instance) {
      EdgeFunctionsMCPClient.instance = new EdgeFunctionsMCPClient();
    }
    return EdgeFunctionsMCPClient.instance;
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
   * Invoke a single edge function
   */
  async invokeFunction<T = any>(
    functionName: AllowedFunctionName,
    payload?: Record<string, any>,
    timeout?: number
  ): Promise<FunctionInvocationResult<T>> {
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
            name: 'invoke_function',
            arguments: {
              function_name: functionName,
              payload: payload || {},
              timeout
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Function invocation failed',
          executionTimeMs: 0
        };
      }

      const result = await response.json();
      const data = result.content?.[0]?.data;

      return {
        success: data?.success ?? false,
        data: data?.data,
        error: data?.error,
        executionTimeMs: data?.executionTimeMs ?? 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: 0
      };
    }
  }

  /**
   * List available functions
   */
  async listFunctions(category?: FunctionCategory): Promise<FunctionDefinition[]> {
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
            name: 'list_functions',
            arguments: { category }
          }
        })
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      return result.content?.[0]?.data?.functions || [];
    } catch {
      return [];
    }
  }

  /**
   * Get detailed function info
   */
  async getFunctionInfo(functionName: AllowedFunctionName): Promise<FunctionDefinition | null> {
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
            name: 'get_function_info',
            arguments: { function_name: functionName }
          }
        })
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      return result.content?.[0]?.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Batch invoke multiple functions
   */
  async batchInvoke(
    invocations: Array<{
      function_name: AllowedFunctionName;
      payload?: Record<string, any>;
    }>,
    stopOnError = true
  ): Promise<BatchInvocationResult> {
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
            name: 'batch_invoke',
            arguments: {
              invocations,
              stop_on_error: stopOnError
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          results: [],
          completed: 0,
          total: invocations.length,
          allSucceeded: false
        };
      }

      const result = await response.json();
      return result.content?.[0]?.data || {
        results: [],
        completed: 0,
        total: invocations.length,
        allSucceeded: false
      };
    } catch {
      return {
        results: [],
        completed: 0,
        total: invocations.length,
        allSucceeded: false
      };
    }
  }
}

// =====================================================
// Convenience Functions
// =====================================================

const client = EdgeFunctionsMCPClient.getInstance();

// Analytics Functions

/**
 * Get prioritized welfare check list
 */
export async function getWelfarePriorities(tenantId: string, limit?: number) {
  return client.invokeFunction<{
    priorities: Array<{
      patient_id: string;
      priority_score: number;
      factors: string[];
    }>;
  }>('get-welfare-priorities', { tenant_id: tenantId, limit });
}

/**
 * Calculate readmission risk for a patient
 */
export async function calculateReadmissionRisk(patientId: string) {
  return client.invokeFunction<{
    risk_30_day: number;
    risk_7_day: number;
    risk_90_day: number;
    factors: string[];
  }>('calculate-readmission-risk', { patient_id: patientId });
}

/**
 * Run SDOH passive detection
 */
export async function runSDOHDetection(tenantId: string) {
  return client.invokeFunction<{
    detected_flags: number;
    patients_screened: number;
  }>('sdoh-passive-detect', { tenant_id: tenantId });
}

// Report Functions

/**
 * Generate patient engagement report
 */
export async function generateEngagementReport(
  patientId: string,
  startDate?: string,
  endDate?: string
) {
  return client.invokeFunction<{
    check_ins: number;
    mood_average: number;
    medication_adherence: number;
    activities: number;
  }>('generate-engagement-report', {
    patient_id: patientId,
    start_date: startDate,
    end_date: endDate
  });
}

/**
 * Generate quality measures report
 */
export async function generateQualityReport(tenantId: string, period: 'quarter' | 'year') {
  return client.invokeFunction<{
    measures: Array<{
      code: string;
      name: string;
      performance: number;
    }>;
  }>('generate-quality-report', { tenant_id: tenantId, period });
}

// Integration Functions

/**
 * Export patient data as FHIR bundle
 */
export async function exportPatientFHIR(patientId: string, resources?: string[]) {
  return client.invokeFunction<{
    bundle: any;
    resource_count: number;
  }>('enhanced-fhir-export', {
    patient_id: patientId,
    resources: resources || ['Patient', 'Condition', 'Medication', 'Observation']
  });
}

/**
 * Generate 837P claim file
 */
export async function generate837PClaim(claimId: string) {
  return client.invokeFunction<{
    x12_content: string;
    validation_errors: string[];
  }>('generate-837p', { claim_id: claimId });
}

// Workflow Functions

/**
 * Process shift handoff
 */
export async function processShiftHandoff(
  shiftId: string,
  action: 'create' | 'accept' | 'complete'
) {
  return client.invokeFunction<{
    status: string;
    updated_at: string;
  }>('process-shift-handoff', { shift_id: shiftId, action });
}

/**
 * Create care alert
 */
export async function createCareAlert(
  patientId: string,
  alertType: string,
  message: string
) {
  return client.invokeFunction<{
    alert_id: string;
    created_at: string;
  }>('create-care-alert', {
    patient_id: patientId,
    alert_type: alertType,
    message
  });
}

// Utility Functions

/**
 * Send SMS notification
 */
export async function sendSMS(to: string, message: string, template?: string) {
  return client.invokeFunction<{
    message_id: string;
    status: string;
  }>('send-sms', { to, message, template });
}

// Export client for advanced usage
export const edgeFunctionsMCP = client;
export { EdgeFunctionsMCPClient };
