/**
 * Cultural Competency MCP Server — Test Fixtures
 *
 * Profile data mirrors the edge function profiles for Node test environment.
 * Separated from tests to keep both files under 600 lines.
 */

// =====================================================
// Type definitions (mirror edge function types)
// =====================================================

export interface CommunicationGuidance {
  languagePreferences: string[];
  formalityLevel: 'formal' | 'moderate' | 'informal';
  familyInvolvementNorm: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  contextSpecific: Partial<Record<string, string>>;
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

export interface TrustFactor {
  factor: string;
  historicalContext: string;
  trustBuildingStrategy: string;
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
  populationKey: string;
  displayName: string;
  description: string;
  caveat: string;
  communication: CommunicationGuidance;
  clinicalConsiderations: ClinicalConsideration[];
  barriers: BarrierToCare[];
  trustFactors: TrustFactor[];
  sdohCodes: SDOHCode[];
  culturalRemedies: CulturalRemedy[];
}

// =====================================================
// Test profiles (subset of edge function data for Node)
// =====================================================

export const PROFILES: Record<string, CulturalProfile> = {
  veterans: {
    populationKey: 'veterans',
    displayName: 'Veterans / Military Service Members',
    description: 'Individuals with current or prior military service.',
    caveat: 'Military experience varies widely by era, branch, rank, and deployment history.',
    communication: {
      languagePreferences: ['Direct, concise language', 'Avoid euphemisms — use clear medical terms'],
      formalityLevel: 'moderate',
      familyInvolvementNorm: 'Many veterans prefer to handle medical decisions independently.',
      keyPhrases: ['Thank you for your service — what branch and era?'],
      avoidPhrases: ['You must be traumatized', 'Did you ever kill anyone?'],
      contextSpecific: {
        medication: 'Discuss medication purpose directly.',
        diagnosis: 'Use straightforward language.',
        discharge: 'Ensure VA enrollment is verified.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'PTSD / Moral Injury',
        prevalence: '11-20% of OIF/OEF veterans; 30% of Vietnam veterans',
        screeningRecommendation: 'PC-PTSD-5 screen at every primary care visit',
        clinicalNote: 'Moral injury presents differently from classic PTSD.',
      },
      {
        condition: 'Traumatic Brain Injury (TBI)',
        prevalence: '23% of combat veterans have blast-related TBI',
        screeningRecommendation: 'VA TBI screening tool for all combat-era veterans',
        clinicalNote: 'TBI and PTSD frequently co-occur.',
      },
      {
        condition: 'Toxic Exposures',
        prevalence: '3.5M+ veterans exposed to burn pits (PACT Act eligible)',
        screeningRecommendation: 'Toxic Exposure Screening Navigator (TESN) referral',
        clinicalNote: 'Burn pit exposure linked to respiratory cancers.',
      },
    ],
    barriers: [
      {
        barrier: 'Stigma around mental health',
        impact: 'Delays care-seeking by 6-8 years on average for PTSD',
        mitigation: 'Normalize help-seeking.',
      },
      {
        barrier: 'VA system navigation complexity',
        impact: 'Veterans may not know what benefits they have earned',
        mitigation: 'Refer to VA social worker or Patient Advocate.',
      },
    ],
    trustFactors: [
      {
        factor: 'VA wait time scandals (2014+)',
        historicalContext: 'Phoenix VA scandal revealed falsified wait times.',
        trustBuildingStrategy: 'Acknowledge the history.',
      },
    ],
    sdohCodes: [
      { code: 'Z91.82', description: 'Personal history of military deployment', applicability: 'All veterans with deployment history' },
      { code: 'Z56.82', description: 'Military to civilian transition difficulty', applicability: 'Recently separated veterans' },
    ],
    culturalRemedies: [
      {
        remedy: 'Kratom (Mitragyna speciosa)',
        commonUse: 'Self-treatment for chronic pain and PTSD symptoms',
        potentialInteractions: ['Opioid agonist activity', 'CYP enzyme inhibition'],
        warningLevel: 'warning',
      },
    ],
  },
  unhoused: {
    populationKey: 'unhoused',
    displayName: 'Unhoused / Experiencing Homelessness',
    description: 'Individuals without stable housing.',
    caveat: 'Homelessness is not a personality trait.',
    communication: {
      languagePreferences: ['Dignity-first language', 'Plain language'],
      formalityLevel: 'informal',
      familyInvolvementNorm: 'Traditional family structures may be absent.',
      keyPhrases: ['Where are you staying right now?'],
      avoidPhrases: ['Non-compliant'],
      contextSpecific: {
        medication: 'Ask about storage: no refrigeration.',
        discharge: 'Do NOT discharge to home if there is none.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'Foot and skin conditions',
        prevalence: 'Extremely common',
        screeningRecommendation: 'Foot exam at every encounter',
        clinicalNote: 'Walking all day in ill-fitting shoes.',
      },
      {
        condition: 'Respiratory illness',
        prevalence: 'TB incidence 20-50x higher than general population',
        screeningRecommendation: 'TB screening (IGRA preferred)',
        clinicalNote: 'Shelter crowding increases transmission.',
      },
    ],
    barriers: [
      {
        barrier: 'No refrigeration for medications',
        impact: 'Rules out insulin pens, many biologics',
        mitigation: 'Prescribe room-temperature stable formulations.',
      },
    ],
    trustFactors: [
      {
        factor: 'Institutional trauma',
        historicalContext: 'Many have experienced forced institutionalization.',
        trustBuildingStrategy: 'Explain what you are doing and why before doing it.',
      },
    ],
    sdohCodes: [
      { code: 'Z59.00', description: 'Homelessness, unspecified', applicability: 'All individuals currently experiencing homelessness' },
      { code: 'Z59.01', description: 'Sheltered homelessness', applicability: 'Emergency shelters or transitional housing' },
      { code: 'Z59.02', description: 'Unsheltered homelessness', applicability: 'Sleeping outside or in vehicles' },
    ],
    culturalRemedies: [
      {
        remedy: 'Alcohol as self-medication',
        commonUse: 'Pain management, sleep aid',
        potentialInteractions: ['Hepatotoxicity with acetaminophen', 'Sedation potentiation'],
        warningLevel: 'warning',
      },
    ],
  },
  latino: {
    populationKey: 'latino',
    displayName: 'Spanish-Speaking / Latino / Hispanic',
    description: 'A diverse population encompassing 20+ countries of origin.',
    caveat: 'Latino/Hispanic is not a monolithic identity.',
    communication: {
      languagePreferences: ['Use certified medical interpreters, not family members'],
      formalityLevel: 'formal',
      familyInvolvementNorm: 'Familismo: family is central to health decisions.',
      keyPhrases: ['Would you like to include family in this conversation?'],
      avoidPhrases: ['Can your child translate?', 'Are you legal?'],
      contextSpecific: {
        medication: 'Ask about herbal teas and remedios caseros.',
        care_plan: 'Include family in goal-setting.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'Type 2 Diabetes',
        prevalence: 'Latino adults are 70% more likely to be diagnosed',
        screeningRecommendation: 'A1C or fasting glucose at age 35+',
        clinicalNote: 'Dietary counseling should incorporate traditional foods.',
      },
    ],
    barriers: [
      {
        barrier: 'Language barrier',
        impact: 'Medical errors 2x more likely without professional interpreters',
        mitigation: 'Certified medical interpreters.',
      },
      {
        barrier: 'Immigration status fears',
        impact: 'Undocumented patients avoid care',
        mitigation: 'Post safe space signage. Train staff on confidentiality.',
      },
    ],
    trustFactors: [
      {
        factor: 'Immigration enforcement in healthcare settings',
        historicalContext: 'ICE operations near clinics have occurred.',
        trustBuildingStrategy: 'Clearly communicate confidentiality policies.',
      },
      {
        factor: 'Forced sterilization history',
        historicalContext: 'Documented forced sterilization of Latina women.',
        trustBuildingStrategy: 'Thorough informed consent for any reproductive procedure.',
      },
    ],
    sdohCodes: [
      { code: 'Z60.3', description: 'Acculturation difficulty', applicability: 'Recent immigrants' },
    ],
    culturalRemedies: [
      {
        remedy: 'Ruda (rue)',
        commonUse: 'Menstrual regulation, spiritual cleansing',
        potentialInteractions: ['ABORTIFACIENT — contraindicated in pregnancy', 'Phototoxic', 'Hepatotoxic'],
        warningLevel: 'warning',
      },
      {
        remedy: 'Manzanilla (chamomile tea)',
        commonUse: 'Digestive issues, anxiety, sleep',
        potentialInteractions: ['Mild anticoagulant properties'],
        warningLevel: 'info',
      },
    ],
  },
  black_aa: {
    populationKey: 'black_aa',
    displayName: 'Black / African American',
    description: 'A diverse population with documented systemic racism in healthcare.',
    caveat: 'Black/African American is not a monolithic identity.',
    communication: {
      languagePreferences: ['Standard professional communication'],
      formalityLevel: 'moderate',
      familyInvolvementNorm: 'Extended family and faith community play significant support roles.',
      keyPhrases: ['I want to make sure you get the same quality of care'],
      avoidPhrases: ['You people', 'Pain tolerance assumptions'],
      contextSpecific: {
        medication: 'Acknowledge historical context if medication hesitancy arises.',
        discharge: 'Schedule follow-up appointments before discharge.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'Hypertension',
        prevalence: '56% of Black adults vs. 48% of white adults',
        screeningRecommendation: 'Blood pressure at every visit',
        clinicalNote: 'Current guidelines no longer recommend race-based first-line therapy.',
      },
      {
        condition: 'Sickle Cell Disease / Trait',
        prevalence: '1 in 365 Black births (SCD); 1 in 13 has sickle cell trait',
        screeningRecommendation: 'Newborn screening is universal',
        clinicalNote: 'Pain crises are frequently undertreated due to bias.',
      },
      {
        condition: 'Maternal Mortality',
        prevalence: 'Black women are 2.6x more likely to die from pregnancy-related causes',
        screeningRecommendation: 'Enhanced prenatal monitoring',
        clinicalNote: 'Disparity persists across ALL income and education levels.',
      },
    ],
    barriers: [
      {
        barrier: 'Medical mistrust rooted in historical harm',
        impact: 'Lower participation in clinical trials, vaccine hesitancy',
        mitigation: 'Acknowledge the history directly.',
      },
      {
        barrier: 'Provider bias (implicit and explicit)',
        impact: 'Black patients receive less pain medication, fewer referrals',
        mitigation: 'Standardized pain protocols. Audit prescribing patterns by race.',
      },
    ],
    trustFactors: [
      {
        factor: 'Tuskegee Syphilis Study (1932-1972)',
        historicalContext: 'US PHS deliberately withheld treatment from 399 Black men for 40 years.',
        trustBuildingStrategy: 'Acknowledge this history. Thorough informed consent.',
      },
      {
        factor: 'Henrietta Lacks and tissue exploitation',
        historicalContext: 'HeLa cells taken without consent in 1951.',
        trustBuildingStrategy: 'Transparent consent for any tissue or genetic sampling.',
      },
    ],
    sdohCodes: [
      { code: 'Z60.5', description: 'Target of perceived adverse discrimination', applicability: 'Racial discrimination affecting health' },
    ],
    culturalRemedies: [
      {
        remedy: 'Castor oil (oral use)',
        commonUse: 'Constipation, cleansing, labor induction',
        potentialInteractions: ['Electrolyte imbalance', 'May stimulate uterine contractions'],
        warningLevel: 'caution',
      },
    ],
  },
};

/**
 * Simulates profile resolution from the edge function.
 */
export function resolveProfile(population: string): CulturalProfile | null {
  const key = population.toLowerCase().replace(/[\s-]+/g, '_');
  return PROFILES[key] ?? null;
}
