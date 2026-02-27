// =====================================================
// MCP Medical Codes Server — Type Definitions
// =====================================================

export interface CPTCode {
  code: string;
  short_description?: string;
  long_description?: string;
  category?: string;
  work_rvu?: number;
  facility_rvu?: number;
  description?: string;
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
  short_description?: string;
  long_description?: string;
  level?: string;
  pricing_indicator?: string;
}

export type MedicalCode = CPTCode | ICD10Code | HCPCSCode;

export interface CodeSuggestions {
  cpt?: CPTCode[];
  icd10?: ICD10Code[];
  hcpcs?: HCPCSCode[];
}
