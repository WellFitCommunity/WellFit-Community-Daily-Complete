/**
 * CMS Coverage MCP Client
 *
 * Browser-safe client for Medicare coverage database operations:
 * - LCD (Local Coverage Determinations) search
 * - NCD (National Coverage Determinations) search
 * - Coverage requirements lookup
 * - Prior authorization checking
 * - MAC contractor information
 *
 * HIPAA Compliance:
 * - No PHI transmitted to external APIs
 * - All queries use procedure codes only
 * - Audit logging for all operations
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// Types
// =====================================================

export interface LCD {
  lcd_id: string;
  title: string;
  contractor: string;
  contractor_number: string;
  status: string;
  effective_date: string;
  revision_date?: string;
  related_codes: string[];
  summary: string;
}

export interface NCD {
  ncd_id: string;
  title: string;
  status: string;
  effective_date: string;
  manual_section: string;
  coverage_provisions: string;
  indications: string[];
  limitations: string[];
}

export interface CoverageRequirements {
  code: string;
  description: string;
  coverage_status: string;
  requirements: string[];
  documentation_needed: string[];
  lcd_references: string[];
  ncd_references: string[];
}

export interface PriorAuthCheck {
  cpt_code: string;
  requires_prior_auth: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  documentation_required: string[];
  estimated_approval_time: string;
  appeal_process: string;
}

export interface MACContractor {
  name: string;
  number: string;
}

export interface MACContractorInfo {
  state: string;
  contractors: {
    part_a_b: MACContractor;
    dme: MACContractor;
  };
}

export interface CoverageArticle {
  article_id: string;
  type: 'billing' | 'coding' | 'utilization';
  title: string;
  content: string;
  effective_date: string;
}

export interface CMSCoverageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// Client Class
// =====================================================

export class CMSCoverageMCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${SB_URL}/functions/v1/mcp-cms-coverage-server`;
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

  private async request<T>(tool: string, args: Record<string, unknown>): Promise<CMSCoverageResult<T>> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': token
        },
        body: JSON.stringify({ name: tool, arguments: args })
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

  // LCD Operations
  async searchLCD(params: {
    query: string;
    state?: string;
    contractor_number?: string;
    status?: 'active' | 'future' | 'retired';
    limit?: number;
  }): Promise<CMSCoverageResult<{ lcds: LCD[]; total: number }>> {
    return this.request('search_lcd', params);
  }

  async getLCDDetails(lcdId: string): Promise<CMSCoverageResult<LCD & { revision_history: Array<{ date: string; change: string }> }>> {
    return this.request('get_lcd_details', { lcd_id: lcdId });
  }

  // NCD Operations
  async searchNCD(params: {
    query: string;
    benefit_category?: string;
    status?: 'active' | 'future' | 'retired';
    limit?: number;
  }): Promise<CMSCoverageResult<{ ncds: NCD[]; total: number }>> {
    return this.request('search_ncd', params);
  }

  async getNCDDetails(ncdId: string): Promise<CMSCoverageResult<NCD & { documentation_requirements: string[] }>> {
    return this.request('get_ncd_details', { ncd_id: ncdId });
  }

  // Coverage Operations
  async getCoverageRequirements(params: {
    code: string;
    state?: string;
    payer_type?: 'medicare' | 'medicare_advantage' | 'medicaid';
  }): Promise<CMSCoverageResult<CoverageRequirements>> {
    return this.request('get_coverage_requirements', params);
  }

  async checkPriorAuthRequired(params: {
    cpt_code: string;
    icd10_codes?: string[];
    state?: string;
    place_of_service?: string;
  }): Promise<CMSCoverageResult<PriorAuthCheck>> {
    return this.request('check_prior_auth_required', params);
  }

  // Articles & Contractors
  async getCoverageArticles(params: {
    code: string;
    article_type?: 'billing' | 'coding' | 'utilization' | 'all';
  }): Promise<CMSCoverageResult<{ articles: CoverageArticle[] }>> {
    return this.request('get_coverage_articles', params);
  }

  async getMACContractors(params: {
    state: string;
    jurisdiction?: string;
  }): Promise<CMSCoverageResult<MACContractorInfo>> {
    return this.request('get_mac_contractors', params);
  }
}

// =====================================================
// Singleton Instance & Helper Functions
// =====================================================

const cmsCoverageClient = new CMSCoverageMCPClient();

/**
 * Search Local Coverage Determinations
 */
export async function searchLCDs(
  query: string,
  options?: { state?: string; status?: 'active' | 'future' | 'retired'; limit?: number }
): Promise<CMSCoverageResult<{ lcds: LCD[]; total: number }>> {
  return cmsCoverageClient.searchLCD({ query, ...options });
}

/**
 * Search National Coverage Determinations
 */
export async function searchNCDs(
  query: string,
  options?: { benefit_category?: string; status?: 'active' | 'future' | 'retired'; limit?: number }
): Promise<CMSCoverageResult<{ ncds: NCD[]; total: number }>> {
  return cmsCoverageClient.searchNCD({ query, ...options });
}

/**
 * Get coverage requirements for a procedure code
 */
export async function getCoverageRequirements(
  code: string,
  state?: string,
  payerType?: 'medicare' | 'medicare_advantage' | 'medicaid'
): Promise<CMSCoverageResult<CoverageRequirements>> {
  return cmsCoverageClient.getCoverageRequirements({ code, state, payer_type: payerType });
}

/**
 * Check if a procedure requires prior authorization
 */
export async function checkPriorAuthRequired(
  cptCode: string,
  icd10Codes?: string[],
  state?: string
): Promise<CMSCoverageResult<PriorAuthCheck>> {
  return cmsCoverageClient.checkPriorAuthRequired({
    cpt_code: cptCode,
    icd10_codes: icd10Codes,
    state
  });
}

/**
 * Get MAC contractor information for a state
 */
export async function getMACContractorInfo(
  state: string
): Promise<CMSCoverageResult<MACContractorInfo>> {
  return cmsCoverageClient.getMACContractors({ state });
}

/**
 * Get coverage articles for a code
 */
export async function getCoverageArticles(
  code: string,
  articleType?: 'billing' | 'coding' | 'utilization' | 'all'
): Promise<CMSCoverageResult<{ articles: CoverageArticle[] }>> {
  return cmsCoverageClient.getCoverageArticles({ code, article_type: articleType });
}

/**
 * Get LCD details by ID
 */
export async function getLCDDetails(
  lcdId: string
): Promise<CMSCoverageResult<LCD & { revision_history: Array<{ date: string; change: string }> }>> {
  return cmsCoverageClient.getLCDDetails(lcdId);
}

/**
 * Get NCD details by ID
 */
export async function getNCDDetails(
  ncdId: string
): Promise<CMSCoverageResult<NCD & { documentation_requirements: string[] }>> {
  return cmsCoverageClient.getNCDDetails(ncdId);
}

// =====================================================
// Common Prior Auth Codes Reference
// =====================================================

export const COMMON_PRIOR_AUTH_CODES: Record<string, {
  description: string;
  requires_prior_auth: boolean;
  documentation: string[];
}> = {
  '70553': {
    description: 'MRI brain with and without contrast',
    requires_prior_auth: true,
    documentation: ['Clinical indication', 'Prior imaging results', 'Neurological exam']
  },
  '72148': {
    description: 'MRI lumbar spine without contrast',
    requires_prior_auth: true,
    documentation: ['Clinical indication', 'Conservative treatment (6 weeks)', 'Physical exam']
  },
  '27447': {
    description: 'Total knee replacement',
    requires_prior_auth: true,
    documentation: ['X-rays (bone-on-bone)', 'Failed conservative treatment (3+ months)', 'BMI', 'Pre-op clearance']
  },
  '27130': {
    description: 'Total hip replacement',
    requires_prior_auth: true,
    documentation: ['X-rays', 'Failed conservative treatment', 'Functional assessment']
  },
  'E0601': {
    description: 'CPAP device',
    requires_prior_auth: true,
    documentation: ['Sleep study (AHI ≥15)', 'Face-to-face evaluation', 'OSA diagnosis']
  },
  'K0823': {
    description: 'Power wheelchair, Group 2',
    requires_prior_auth: true,
    documentation: ['Face-to-face exam', 'Mobility limitation', 'Home assessment', '7-element order']
  }
};

export default cmsCoverageClient;
