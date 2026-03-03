// =====================================================
// Cultural Competency MCP Server — Type Definitions
//
// Interfaces for population profiles, communication guidance,
// clinical considerations, barriers, and SDOH coding hooks.
// =====================================================

/** Recognized population keys for cultural context lookup */
export type PopulationKey =
  | "veterans"
  | "unhoused"
  | "latino"
  | "black_aa"
  | "isolated_elderly"
  | "indigenous"
  | "immigrant_refugee"
  | "lgbtq_elderly";

/** Communication context for tool #2 */
export type CommunicationContext =
  | "medication"
  | "diagnosis"
  | "care_plan"
  | "discharge"
  | "general";

/** How to communicate with a patient from this population */
export interface CommunicationGuidance {
  languagePreferences: string[];
  formalityLevel: "formal" | "moderate" | "informal";
  familyInvolvementNorm: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  contextSpecific: Partial<Record<CommunicationContext, string>>;
}

/** Population-specific clinical risk or screening */
export interface ClinicalConsideration {
  condition: string;
  prevalence: string;
  screeningRecommendation: string;
  clinicalNote: string;
}

/** Access barrier and how to mitigate it */
export interface BarrierToCare {
  barrier: string;
  impact: string;
  mitigation: string;
}

/** Traditional or complementary health practice */
export interface CulturalHealthPractice {
  practice: string;
  description: string;
  clinicalImplication: string;
}

/** Historical or systemic factor affecting trust */
export interface TrustFactor {
  factor: string;
  historicalContext: string;
  trustBuildingStrategy: string;
}

/** Community resource or support network */
export interface SupportSystem {
  resource: string;
  description: string;
  accessInfo: string;
}

/** ICD-10 Z-code relevant to this population */
export interface SDOHCode {
  code: string;
  description: string;
  applicability: string;
}

/** Traditional remedy that may interact with prescriptions */
export interface CulturalRemedy {
  remedy: string;
  commonUse: string;
  potentialInteractions: string[];
  warningLevel: "info" | "caution" | "warning";
}

/** Complete cultural profile for a population */
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

/** Valid population keys for validation */
export const VALID_POPULATIONS: PopulationKey[] = [
  "veterans",
  "unhoused",
  "latino",
  "black_aa",
  "isolated_elderly",
  "indigenous",
  "immigrant_refugee",
  "lgbtq_elderly",
];

/** Valid communication contexts */
export const VALID_CONTEXTS: CommunicationContext[] = [
  "medication",
  "diagnosis",
  "care_plan",
  "discharge",
  "general",
];
