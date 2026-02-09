/**
 * Oncology LOINC and SNOMED CT Code Constants
 * Standardized codes for oncology observations, staging, and conditions
 */

// =====================================================
// ONCOLOGY LOINC CODES
// =====================================================

export const ONCOLOGY_LOINC_CODES = {
  // TNM Staging (AJCC)
  TNM_T: '21905-5',
  TNM_N: '21906-3',
  TNM_M: '21907-1',
  OVERALL_STAGE: '21908-9',

  // Tumor Markers
  CEA: '2039-6',
  CA_125: '10334-1',
  CA_19_9: '24108-3',
  PSA: '2857-1',
  AFP: '1834-1',
  HCG: '21198-7',

  // Hematology
  WBC: '6690-2',
  ANC: '751-8',
  HEMOGLOBIN: '718-7',
  PLATELETS: '777-3',

  // Chemistry
  CREATININE: '2160-0',
  ALT: '1742-6',
  AST: '1920-8',

  // Performance Status
  ECOG: '89247-1',
};

// =====================================================
// ONCOLOGY SNOMED CT CODES
// =====================================================

export const ONCOLOGY_SNOMED_CODES = {
  // Cancer Types
  MALIGNANT_NEOPLASM: '363346000',
  BREAST_CANCER: '254837009',
  LUNG_CANCER: '93880001',
  COLORECTAL_CANCER: '363406005',
  PROSTATE_CANCER: '399068003',
  PANCREATIC_CANCER: '363418001',
  LYMPHOMA: '118600007',
  MELANOMA: '372244006',
  OVARIAN_CANCER: '363443007',

  // Procedures
  CHEMOTHERAPY: '367336001',
  RADIATION_THERAPY: '108290001',
  IMMUNOTHERAPY: '76334006',
  TUMOR_RESECTION: '64368001',
  BONE_MARROW_BIOPSY: '234326005',

  // Side Effects
  NAUSEA: '422587007',
  NEUTROPENIA: '165517008',
  FEBRILE_NEUTROPENIA: '409089005',
  THROMBOCYTOPENIA: '302215000',
  ALOPECIA: '56317004',
  NEUROPATHY: '386033004',
};
