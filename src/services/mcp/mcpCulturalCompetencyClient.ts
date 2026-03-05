/**
 * Cultural Competency MCP Client
 *
 * Browser-safe client for population-specific cultural context:
 * - Cultural profiles for 8 population groups
 * - Communication guidance by scenario
 * - Clinical considerations and screening recommendations
 * - Barriers to care and mitigation strategies
 * - Trust-building guidance
 * - Drug interaction cultural context
 * - SDOH Z-code lookup
 * - Profile seeding
 *
 * Clinical Use:
 * - Provides culturally-sensitive care guidance for clinicians
 * - All data is population-level (not PHI)
 * - Audit logging for all operations
 */

import { SB_URL } from '../../settings/settings';

// =====================================================
// Types (sourced from mcp-cultural-competency-server/types.ts)
// =====================================================

export type PopulationKey =
  | 'veterans'
  | 'unhoused'
  | 'latino'
  | 'black_aa'
  | 'isolated_elderly'
  | 'indigenous'
  | 'immigrant_refugee'
  | 'lgbtq_elderly';

export type CommunicationContext =
  | 'medication'
  | 'diagnosis'
  | 'care_plan'
  | 'discharge'
  | 'general';

export interface CommunicationGuidance {
  languagePreferences: string[];
  formalityLevel: 'formal' | 'moderate' | 'informal';
  familyInvolvementNorm: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  contextSpecific: Partial<Record<CommunicationContext, string>>;
}

export interface ClinicalConsideration {
  condition: string;
  prevalence: string;
  screeningRecommendation: string;
  clinicalNote: string;
}

export interface BarrierToCare {
  barrier: string;
  impact: string;
  mitigation: string;
}

export interface CulturalHealthPractice {
  practice: string;
  description: string;
  clinicalImplication: string;
}

export interface TrustFactor {
  factor: string;
  historicalContext: string;
  trustBuildingStrategy: string;
}

export interface SupportSystem {
  resource: string;
  description: string;
  accessInfo: string;
}

export interface SDOHCode {
  code: string;
  description: string;
  applicability: string;
}

export interface CulturalRemedy {
  remedy: string;
  commonUse: string;
  potentialInteractions: string[];
  warningLevel: 'info' | 'caution' | 'warning';
}

export interface CulturalProfile {
  populationKey: PopulationKey;
  displayName: string;
  description: string;
  caveat: string;
  communication: CommunicationGuidance;
  clinicalConsiderations: ClinicalConsideration[];
  barriers: BarrierToCare[];
  culturalPractices: CulturalHealthPractice[];
  trustFactors: TrustFactor[];
  supportSystems: SupportSystem[];
  sdohCodes: SDOHCode[];
  culturalRemedies: CulturalRemedy[];
}

export interface DrugInteractionCultural {
  populationKey: PopulationKey;
  medications: string[];
  culturalRemedies: CulturalRemedy[];
  warnings: string[];
  recommendations: string[];
}

export interface CulturalCompetencyResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// Constants
// =====================================================

export const VALID_POPULATIONS: PopulationKey[] = [
  'veterans',
  'unhoused',
  'latino',
  'black_aa',
  'isolated_elderly',
  'indigenous',
  'immigrant_refugee',
  'lgbtq_elderly',
];

export const VALID_CONTEXTS: CommunicationContext[] = [
  'medication',
  'diagnosis',
  'care_plan',
  'discharge',
  'general',
];

// =====================================================
// Client Class
// =====================================================

export class CulturalCompetencyMCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${SB_URL}/functions/v1/mcp-cultural-competency-server`;
  }

  private getAuthToken(): string {
    try {
      const authData = localStorage.getItem('sb-xkybsjnvuohpqpbkikyn-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.access_token || '';
      }
    } catch {
      // Ignore parse errors
    }
    return '';
  }

  private async request<T>(tool: string, args: Record<string, unknown>): Promise<CulturalCompetencyResult<T>> {
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

  // Cultural Context
  async getCulturalContext(populationKey: PopulationKey): Promise<CulturalCompetencyResult<CulturalProfile>> {
    return this.request('get_cultural_context', { population_key: populationKey });
  }

  // Clinical Considerations
  async getClinicalConsiderations(
    populationKey: PopulationKey,
    clinicalDomain?: string
  ): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; considerations: ClinicalConsideration[] }>> {
    const args: Record<string, unknown> = { population_key: populationKey };
    if (clinicalDomain) args.clinical_domain = clinicalDomain;
    return this.request('get_clinical_considerations', args);
  }

  // Communication Guidance
  async getCommunicationGuidance(
    populationKey: PopulationKey,
    scenario?: CommunicationContext
  ): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; guidance: CommunicationGuidance }>> {
    const args: Record<string, unknown> = { population_key: populationKey };
    if (scenario) args.scenario = scenario;
    return this.request('get_communication_guidance', args);
  }

  // Barriers to Care
  async getBarriersToCare(
    populationKey: PopulationKey
  ): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; barriers: BarrierToCare[] }>> {
    return this.request('get_barriers_to_care', { population_key: populationKey });
  }

  // Trust Building Guidance
  async getTrustBuildingGuidance(
    populationKey: PopulationKey
  ): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; trustFactors: TrustFactor[] }>> {
    return this.request('get_trust_building_guidance', { population_key: populationKey });
  }

  // Drug Interaction Cultural Context
  async checkDrugInteractionCultural(
    populationKey: PopulationKey,
    medications: string[]
  ): Promise<CulturalCompetencyResult<DrugInteractionCultural>> {
    return this.request('check_drug_interaction_cultural', {
      population_key: populationKey,
      medications
    });
  }

  // SDOH Codes
  async getSdohCodes(
    category?: string
  ): Promise<CulturalCompetencyResult<{ codes: SDOHCode[]; category?: string }>> {
    const args: Record<string, unknown> = {};
    if (category) args.category = category;
    return this.request('get_sdoh_codes', args);
  }

  // Seed Profiles
  async seedProfiles(): Promise<CulturalCompetencyResult<{ seeded: number; populations: PopulationKey[] }>> {
    return this.request('seed_profiles', {});
  }
}

// =====================================================
// Singleton Instance & Helper Functions
// =====================================================

const culturalCompetencyClient = new CulturalCompetencyMCPClient();

/**
 * Get full cultural profile for a population group
 */
export async function getCulturalContext(
  populationKey: PopulationKey
): Promise<CulturalCompetencyResult<CulturalProfile>> {
  return culturalCompetencyClient.getCulturalContext(populationKey);
}

/**
 * Get clinical considerations for a population group
 */
export async function getClinicalConsiderations(
  populationKey: PopulationKey,
  clinicalDomain?: string
): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; considerations: ClinicalConsideration[] }>> {
  return culturalCompetencyClient.getClinicalConsiderations(populationKey, clinicalDomain);
}

/**
 * Get communication guidance for a population group
 */
export async function getCommunicationGuidance(
  populationKey: PopulationKey,
  scenario?: CommunicationContext
): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; guidance: CommunicationGuidance }>> {
  return culturalCompetencyClient.getCommunicationGuidance(populationKey, scenario);
}

/**
 * Get barriers to care for a population group
 */
export async function getBarriersToCare(
  populationKey: PopulationKey
): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; barriers: BarrierToCare[] }>> {
  return culturalCompetencyClient.getBarriersToCare(populationKey);
}

/**
 * Get trust-building guidance for a population group
 */
export async function getTrustBuildingGuidance(
  populationKey: PopulationKey
): Promise<CulturalCompetencyResult<{ populationKey: PopulationKey; trustFactors: TrustFactor[] }>> {
  return culturalCompetencyClient.getTrustBuildingGuidance(populationKey);
}

/**
 * Check drug interactions with cultural remedies
 */
export async function checkDrugInteractionCultural(
  populationKey: PopulationKey,
  medications: string[]
): Promise<CulturalCompetencyResult<DrugInteractionCultural>> {
  return culturalCompetencyClient.checkDrugInteractionCultural(populationKey, medications);
}

/**
 * Get SDOH Z-codes, optionally filtered by category
 */
export async function getSdohCodes(
  category?: string
): Promise<CulturalCompetencyResult<{ codes: SDOHCode[]; category?: string }>> {
  return culturalCompetencyClient.getSdohCodes(category);
}

/**
 * Seed cultural competency profiles into the database
 */
export async function seedCulturalProfiles(): Promise<CulturalCompetencyResult<{ seeded: number; populations: PopulationKey[] }>> {
  return culturalCompetencyClient.seedProfiles();
}

export default culturalCompetencyClient;
