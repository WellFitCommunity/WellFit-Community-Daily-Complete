/**
 * HCC Opportunity Type Definitions
 *
 * Shared types for the HCC opportunity detection service.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export type HCCOpportunityType = 'expiring_hcc' | 'suspected_hcc' | 'documented_hcc';
export type HCCOpportunityStatus = 'open' | 'reviewed' | 'dismissed';

export interface HCCOpportunity {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  date_of_service: string;
  opportunity_type: HCCOpportunityType;
  icd10_code: string;
  icd10_description: string | null;
  hcc_code: string;
  hcc_description: string;
  hcc_coefficient: number;
  raf_score_impact: number;
  annual_payment_impact: number;
  confidence: number;
  evidence_source: string;
  evidence_detail: string;
  status: HCCOpportunityStatus;
}

export interface HCCOpportunityStats {
  total_opportunities: number;
  total_annual_impact: number;
  avg_raf_impact_per_patient: number;
  patients_with_gaps: number;
  opportunities_by_type: {
    expiring_hcc: number;
    suspected_hcc: number;
    documented_hcc: number;
  };
}

export interface HCCOpportunityFilters {
  opportunity_type?: HCCOpportunityType;
  min_confidence?: number;
  search?: string;
}

// =============================================================================
// INTERNAL ROW TYPES (DB query results)
// =============================================================================

export interface EncounterDiagnosisRow {
  id: string;
  encounter_id: string;
  code: string;
  description: string | null;
}

export interface EncounterRow {
  id: string;
  patient_id: string;
  date_of_service: string;
}

export interface HCCMappingRow {
  icd10_code: string;
  hcc_code: string;
}

export interface HCCCategoryRow {
  hcc_code: string;
  description: string;
  coefficient: number;
}

export interface HCCHierarchyRow {
  higher_hcc: string;
  suppressed_hcc: string;
}

export interface MedicationRow {
  id: string;
  user_id: string;
  medication_name: string;
  generic_name: string | null;
  status: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Average Medicare Advantage per-member-per-year base payment for 2026 */
export const MA_BASE_PAYMENT = 11000;

/** Medication-to-HCC suspect mappings (medication keyword -> expected HCC) */
export const MEDICATION_HCC_SUSPECTS: Array<{
  keywords: string[];
  expected_hcc: string;
  expected_icd10: string;
  condition: string;
  confidence: number;
}> = [
  {
    keywords: ['insulin', 'metformin', 'glipizide', 'glyburide', 'sitagliptin', 'empagliflozin', 'liraglutide', 'semaglutide'],
    expected_hcc: 'HCC38',
    expected_icd10: 'E11.40',
    condition: 'Diabetes with Chronic Complications',
    confidence: 0.85,
  },
  {
    keywords: ['warfarin', 'eliquis', 'apixaban', 'xarelto', 'rivaroxaban', 'dabigatran'],
    expected_hcc: 'HCC238',
    expected_icd10: 'I48.91',
    condition: 'Atrial Fibrillation',
    confidence: 0.75,
  },
  {
    keywords: ['albuterol', 'tiotropium', 'budesonide', 'fluticasone', 'spiriva', 'symbicort', 'advair'],
    expected_hcc: 'HCC111',
    expected_icd10: 'J44.9',
    condition: 'COPD',
    confidence: 0.70,
  },
  {
    keywords: ['furosemide', 'lasix', 'bumetanide', 'carvedilol', 'spironolactone', 'entresto', 'sacubitril'],
    expected_hcc: 'HCC85',
    expected_icd10: 'I50.22',
    condition: 'Congestive Heart Failure',
    confidence: 0.75,
  },
  {
    keywords: ['donepezil', 'aricept', 'memantine', 'namenda', 'rivastigmine', 'galantamine'],
    expected_hcc: 'HCC52',
    expected_icd10: 'F03.90',
    condition: 'Dementia',
    confidence: 0.90,
  },
  {
    keywords: ['carbidopa', 'levodopa', 'sinemet', 'ropinirole', 'pramipexole'],
    expected_hcc: 'HCC78',
    expected_icd10: 'G20',
    condition: "Parkinson's Disease",
    confidence: 0.90,
  },
];
