/**
 * MCP Medical Codes Client - Browser-Safe Version
 *
 * Unified access to CPT, ICD-10, HCPCS, and modifier codes.
 * Includes smart search, validation, and bundling checks.
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// Types
// =====================================================

export interface CPTCode {
  code: string;
  short_description: string;
  long_description?: string;
  category?: string;
  work_rvu?: number;
  facility_rvu?: number;
}

export interface ICD10Code {
  code: string;
  description: string;
  chapter?: string;
  category?: string;
  is_billable?: boolean;
}

export interface HCPCSCode {
  code: string;
  short_description: string;
  long_description?: string;
  level?: string;
  pricing_indicator?: string;
}

export interface Modifier {
  modifier: string;
  description: string;
  applies_to?: string[];
}

export interface BundlingIssue {
  codes: string[];
  issue: string;
  suggestion: string;
}

export interface CodeValidationResult {
  cpt_validation: Array<{ code: string; valid: boolean }>;
  icd10_validation: Array<{ code: string; valid: boolean }>;
  bundling_issues: BundlingIssue[];
  is_valid: boolean;
}

export interface SDOHCode {
  code: string;
  description: string;
}

export type SDOHCategory = 'housing' | 'food' | 'transportation' | 'employment' | 'education' | 'social' | 'all';

export interface MedicalCodeResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    codesReturned: number;
    executionTimeMs: number;
  };
}

// =====================================================
// Medical Codes MCP Client
// =====================================================

class MedicalCodesMCPClient {
  private static instance: MedicalCodesMCPClient;
  private edgeFunctionUrl: string;

  private constructor() {
    this.edgeFunctionUrl = `${SB_URL}/functions/v1/mcp-medical-codes-server`;
  }

  static getInstance(): MedicalCodesMCPClient {
    if (!MedicalCodesMCPClient.instance) {
      MedicalCodesMCPClient.instance = new MedicalCodesMCPClient();
    }
    return MedicalCodesMCPClient.instance;
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

  private async callTool<T>(toolName: string, args: Record<string, unknown>): Promise<MedicalCodeResult<T>> {
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
            name: toolName,
            arguments: args
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Code lookup failed'
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result.content?.[0]?.data,
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
   * Search CPT codes
   */
  async searchCPT(query: string, category?: string, limit?: number): Promise<MedicalCodeResult<CPTCode[]>> {
    return this.callTool('search_cpt', { query, category, limit });
  }

  /**
   * Search ICD-10 codes
   */
  async searchICD10(query: string, chapter?: string, limit?: number): Promise<MedicalCodeResult<ICD10Code[]>> {
    return this.callTool('search_icd10', { query, chapter, limit });
  }

  /**
   * Search HCPCS codes
   */
  async searchHCPCS(query: string, level?: string, limit?: number): Promise<MedicalCodeResult<HCPCSCode[]>> {
    return this.callTool('search_hcpcs', { query, level, limit });
  }

  /**
   * Get modifiers for a code
   */
  async getModifiers(code: string, codeType?: 'cpt' | 'hcpcs'): Promise<MedicalCodeResult<Modifier[]>> {
    return this.callTool('get_modifiers', { code, code_type: codeType });
  }

  /**
   * Validate code combination
   */
  async validateCodeCombination(
    cptCodes: string[],
    icd10Codes: string[],
    modifiers?: string[]
  ): Promise<MedicalCodeResult<CodeValidationResult>> {
    return this.callTool('validate_code_combination', {
      cpt_codes: cptCodes,
      icd10_codes: icd10Codes,
      modifiers
    });
  }

  /**
   * Check for bundling issues
   */
  async checkBundling(cptCodes: string[]): Promise<MedicalCodeResult<BundlingIssue[]>> {
    return this.callTool('check_bundling', { cpt_codes: cptCodes });
  }

  /**
   * Get detailed code information
   */
  async getCodeDetails(code: string, codeType: 'cpt' | 'icd10' | 'hcpcs'): Promise<MedicalCodeResult<CPTCode | ICD10Code | HCPCSCode>> {
    return this.callTool('get_code_details', { code, code_type: codeType });
  }

  /**
   * Suggest codes based on clinical description
   */
  async suggestCodes(
    description: string,
    codeTypes?: Array<'cpt' | 'icd10' | 'hcpcs'>,
    limit?: number
  ): Promise<MedicalCodeResult<{
    cpt?: CPTCode[];
    icd10?: ICD10Code[];
    hcpcs?: HCPCSCode[];
  }>> {
    return this.callTool('suggest_codes', {
      description,
      code_types: codeTypes,
      limit
    });
  }

  /**
   * Get SDOH Z-codes
   */
  async getSDOHCodes(category?: SDOHCategory): Promise<MedicalCodeResult<Record<string, SDOHCode[]>>> {
    return this.callTool('get_sdoh_codes', { category });
  }
}

// =====================================================
// Convenience Functions
// =====================================================

const client = MedicalCodesMCPClient.getInstance();

/**
 * Search for CPT codes by description or code
 */
export async function searchCPTCodes(query: string, options?: { category?: string; limit?: number }) {
  return client.searchCPT(query, options?.category, options?.limit);
}

/**
 * Search for ICD-10 diagnosis codes
 */
export async function searchICD10Codes(query: string, options?: { chapter?: string; limit?: number }) {
  return client.searchICD10(query, options?.chapter, options?.limit);
}

/**
 * Search for HCPCS codes
 */
export async function searchHCPCSCodes(query: string, options?: { level?: string; limit?: number }) {
  return client.searchHCPCS(query, options?.level, options?.limit);
}

/**
 * Get applicable modifiers for a procedure code
 */
export async function getCodeModifiers(code: string, codeType?: 'cpt' | 'hcpcs') {
  return client.getModifiers(code, codeType);
}

/**
 * Validate a billing code combination
 */
export async function validateBillingCodes(
  cptCodes: string[],
  icd10Codes: string[],
  modifiers?: string[]
) {
  return client.validateCodeCombination(cptCodes, icd10Codes, modifiers);
}

/**
 * Check for bundling/unbundling issues
 */
export async function checkCodeBundling(cptCodes: string[]) {
  return client.checkBundling(cptCodes);
}

/**
 * Get detailed information about a code
 */
export async function getCodeInfo(code: string, codeType: 'cpt' | 'icd10' | 'hcpcs') {
  return client.getCodeDetails(code, codeType);
}

/**
 * Get AI-suggested codes for a clinical description
 */
export async function suggestCodesForDescription(
  description: string,
  codeTypes?: Array<'cpt' | 'icd10' | 'hcpcs'>,
  limit?: number
) {
  return client.suggestCodes(description, codeTypes, limit);
}

/**
 * Get SDOH Z-codes by category
 */
export async function getSDOHZCodes(category?: SDOHCategory) {
  return client.getSDOHCodes(category);
}

/**
 * Quick lookup for common E/M codes
 */
export const EM_CODES = {
  // New patient office visits
  NEW_99201: '99201', // Problem focused
  NEW_99202: '99202', // Expanded problem focused
  NEW_99203: '99203', // Detailed
  NEW_99204: '99204', // Comprehensive - moderate
  NEW_99205: '99205', // Comprehensive - high

  // Established patient office visits
  EST_99211: '99211', // Minimal
  EST_99212: '99212', // Problem focused
  EST_99213: '99213', // Expanded problem focused
  EST_99214: '99214', // Detailed
  EST_99215: '99215', // Comprehensive

  // Telehealth modifiers
  MODIFIER_95: '95',   // Synchronous telemedicine
  MODIFIER_GT: 'GT',   // Via interactive audio/video
} as const;

/**
 * Common modifier quick reference
 */
export const COMMON_MODIFIERS = {
  SEPARATE_EM: '25',      // Significant, separately identifiable E/M
  PROFESSIONAL: '26',     // Professional component
  TECHNICAL: 'TC',        // Technical component
  DISTINCT: '59',         // Distinct procedural service
  REPEAT_SAME: '76',      // Repeat procedure by same physician
  REPEAT_OTHER: '77',     // Repeat procedure by another physician
  LEFT: 'LT',             // Left side
  RIGHT: 'RT',            // Right side
  BILATERAL: '50',        // Bilateral procedure
  MULTIPLE: '51',         // Multiple procedures
  REDUCED: '52',          // Reduced services
  DISCONTINUED: '53',     // Discontinued procedure
} as const;

// Export client for advanced usage
export const medicalCodesMCP = client;
export { MedicalCodesMCPClient };
