/**
 * =====================================================
 * ONCOLOGY MODULE - TYPE DEFINITIONS
 * =====================================================
 * Purpose: TypeScript types for comprehensive cancer care management
 * Integration: TNM staging (AJCC 8th), CTCAE grading, RECIST 1.1,
 *   chemotherapy, radiation, lab monitoring, survivorship
 * =====================================================
 */

// =====================================================
// ENUMS
// =====================================================

export type CancerStatus = 'active_treatment' | 'surveillance' | 'remission' | 'recurrence' | 'palliative' | 'deceased';

export type ECOGStatus = 0 | 1 | 2 | 3 | 4;

export type StagingType = 'clinical' | 'pathological';

export type TStage = 'Tx' | 'T0' | 'Tis' | 'T1' | 'T1a' | 'T1b' | 'T1c' | 'T2' | 'T2a' | 'T2b' | 'T3' | 'T3a' | 'T3b' | 'T4' | 'T4a' | 'T4b';

export type NStage = 'Nx' | 'N0' | 'N1' | 'N1a' | 'N1b' | 'N2' | 'N2a' | 'N2b' | 'N3' | 'N3a' | 'N3b';

export type MStage = 'M0' | 'M1' | 'M1a' | 'M1b' | 'M1c';

export type OverallStage = '0' | 'I' | 'IA' | 'IB' | 'II' | 'IIA' | 'IIB' | 'III' | 'IIIA' | 'IIIB' | 'IIIC' | 'IV' | 'IVA' | 'IVB';

export type TreatmentModality = 'chemotherapy' | 'radiation' | 'surgery' | 'immunotherapy' | 'targeted_therapy' | 'hormone_therapy' | 'stem_cell_transplant';

export type TreatmentIntent = 'curative' | 'adjuvant' | 'neoadjuvant' | 'palliative' | 'maintenance';

export type CTCAEGrade = 1 | 2 | 3 | 4 | 5;

export type CTCAECategory =
  | 'blood_lymphatic'
  | 'cardiac'
  | 'gastrointestinal'
  | 'general'
  | 'infections'
  | 'metabolism'
  | 'musculoskeletal'
  | 'nervous'
  | 'renal'
  | 'respiratory'
  | 'skin'
  | 'vascular';

export type RECISTResponse =
  | 'complete_response'
  | 'partial_response'
  | 'stable_disease'
  | 'progressive_disease'
  | 'not_evaluable';

export type ImagingModality = 'ct' | 'mri' | 'pet_ct' | 'ultrasound' | 'xray' | 'bone_scan';

export type SurvivorshipStatus = 'active_surveillance' | 'in_remission' | 'no_evidence_of_disease' | 'recurrence';

export type OncAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export type OncAlertType =
  | 'febrile_neutropenia'
  | 'ctcae_grade_4_5'
  | 'tumor_marker_spike'
  | 'treatment_delay'
  | 'new_metastasis'
  | 'abnormal_pre_chemo_labs'
  | 'anemia_severe'
  | 'thrombocytopenia_severe';

// =====================================================
// CORE INTERFACES
// =====================================================

/** Cancer diagnosis registry */
export interface OncCancerRegistry {
  id: string;
  patient_id: string;
  tenant_id: string;
  primary_site: string;
  histology: string;
  icd10_code: string;
  diagnosis_date: string;
  biomarkers: Record<string, string>;
  ecog_status: ECOGStatus;
  status: CancerStatus;
  treating_oncologist_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** TNM staging — AJCC 8th edition */
export interface OncStaging {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  staging_date: string;
  staging_type: StagingType;
  t_stage: TStage;
  n_stage: NStage;
  m_stage: MStage;
  overall_stage: OverallStage;
  ajcc_edition: number;
  staging_basis: string | null;
  notes: string | null;
  created_at: string;
}

/** Treatment plans */
export interface OncTreatmentPlan {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  plan_date: string;
  modalities: TreatmentModality[];
  intent: TreatmentIntent;
  regimen_name: string;
  drugs: string[];
  cycle_count: number;
  cycle_length_days: number;
  planned_start_date: string | null;
  actual_start_date: string | null;
  status: 'planned' | 'active' | 'completed' | 'discontinued' | 'modified';
  notes: string | null;
  created_at: string;
}

/** Chemotherapy session tracking */
export interface OncChemotherapySession {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  treatment_plan_id: string;
  session_date: string;
  cycle_number: number;
  day_of_cycle: number;
  drugs_administered: DrugAdministration[];
  dose_modifications: string[];
  bsa_m2: number | null;
  pre_medications: string[];
  adverse_events_during: string[];
  vitals_pre: SessionVitals | null;
  vitals_post: SessionVitals | null;
  notes: string | null;
  created_at: string;
}

export interface DrugAdministration {
  drug_name: string;
  dose: string;
  route: 'iv' | 'oral' | 'subcutaneous' | 'intramuscular' | 'intrathecal';
  duration_min: number | null;
  dose_reduction_percent: number;
}

export interface SessionVitals {
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature_c: number;
  weight_kg: number;
}

/** Radiation therapy sessions */
export interface OncRadiationSession {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  treatment_plan_id: string;
  session_date: string;
  fraction_number: number;
  total_fractions: number;
  dose_per_fraction_gy: number;
  cumulative_dose_gy: number;
  technique: 'imrt' | 'vmat' | '3d_conformal' | 'sbrt' | 'srs' | 'proton' | 'brachytherapy';
  treatment_site: string;
  skin_reaction_grade: number | null;
  notes: string | null;
  created_at: string;
}

/** CTCAE adverse event tracking */
export interface OncSideEffect {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  reported_date: string;
  ctcae_term: string;
  ctcae_grade: CTCAEGrade;
  ctcae_category: CTCAECategory;
  attribution: 'definite' | 'probable' | 'possible' | 'unlikely' | 'unrelated';
  intervention: string | null;
  outcome: 'resolved' | 'resolving' | 'ongoing' | 'resolved_with_sequelae' | 'fatal';
  resolved_date: string | null;
  notes: string | null;
  created_at: string;
}

/** Lab monitoring — CBC, tumor markers */
export interface OncLabMonitoring {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  lab_date: string;
  wbc: number | null;
  anc: number | null;
  hemoglobin: number | null;
  platelets: number | null;
  creatinine: number | null;
  alt: number | null;
  ast: number | null;
  tumor_marker_name: string | null;
  tumor_marker_value: number | null;
  tumor_marker_unit: string | null;
  baseline_marker_value: number | null;
  notes: string | null;
  created_at: string;
}

/** Imaging results with RECIST */
export interface OncImagingResult {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  imaging_date: string;
  modality: ImagingModality;
  body_region: string;
  recist_response: RECISTResponse | null;
  target_lesions: TargetLesion[];
  sum_of_diameters_mm: number | null;
  baseline_sum_mm: number | null;
  new_lesions: boolean;
  findings: string | null;
  created_at: string;
}

export interface TargetLesion {
  location: string;
  diameter_mm: number;
  previous_diameter_mm: number | null;
}

/** Survivorship tracking */
export interface OncSurvivorship {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  assessment_date: string;
  status: SurvivorshipStatus;
  remission_date: string | null;
  surveillance_schedule: string | null;
  late_effects: string[];
  psychosocial_concerns: string[];
  recurrence_date: string | null;
  recurrence_site: string | null;
  quality_of_life_score: number | null;
  notes: string | null;
  created_at: string;
}

/** Standard oncology regimens (reference table) */
export interface OncStandardRegimen {
  id: string;
  name: string;
  drugs: string[];
  cycle_length_days: number;
  typical_cycles: number;
  cancer_types: string[];
  notes: string | null;
}

// =====================================================
// REQUEST TYPES
// =====================================================

export interface CreateCancerRegistryRequest {
  patient_id: string;
  tenant_id: string;
  primary_site: string;
  histology: string;
  icd10_code: string;
  diagnosis_date: string;
  biomarkers?: Record<string, string>;
  ecog_status?: ECOGStatus;
  treating_oncologist_id?: string;
  notes?: string;
}

export interface CreateStagingRequest {
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  staging_type: StagingType;
  t_stage: TStage;
  n_stage: NStage;
  m_stage: MStage;
  overall_stage: OverallStage;
  ajcc_edition?: number;
  staging_basis?: string;
  notes?: string;
}

export interface CreateTreatmentPlanRequest {
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  modalities: TreatmentModality[];
  intent: TreatmentIntent;
  regimen_name: string;
  drugs: string[];
  cycle_count: number;
  cycle_length_days: number;
  planned_start_date?: string;
  notes?: string;
}

// =====================================================
// DASHBOARD SUMMARY TYPES
// =====================================================

export interface OncologyDashboardSummary {
  registry: OncCancerRegistry | null;
  staging: OncStaging | null;
  treatment_plan: OncTreatmentPlan | null;
  recent_chemo_sessions: OncChemotherapySession[];
  recent_radiation_sessions: OncRadiationSession[];
  latest_labs: OncLabMonitoring | null;
  latest_imaging: OncImagingResult | null;
  active_side_effects: OncSideEffect[];
  survivorship: OncSurvivorship | null;
  alerts: OncAlert[];
}

export interface OncAlert {
  id: string;
  type: OncAlertType;
  severity: OncAlertSeverity;
  message: string;
  timestamp: string;
  source_record_id: string | null;
  acknowledged: boolean;
}

// =====================================================
// CONSTANTS
// =====================================================

export const ECOG_DESCRIPTIONS: Record<ECOGStatus, string> = {
  0: 'Fully active, no restrictions',
  1: 'Restricted in strenuous activity, ambulatory',
  2: 'Ambulatory, capable of self-care, unable to work; up >50% of waking hours',
  3: 'Limited self-care, confined to bed/chair >50% of waking hours',
  4: 'Completely disabled, no self-care, totally confined',
};

export const CTCAE_GRADE_DESCRIPTIONS: Record<CTCAEGrade, string> = {
  1: 'Mild — asymptomatic or mild symptoms',
  2: 'Moderate — limiting instrumental ADL',
  3: 'Severe — limiting self-care ADL, hospitalization',
  4: 'Life-threatening — urgent intervention indicated',
  5: 'Death related to adverse event',
};

export const RECIST_LABELS: Record<RECISTResponse, string> = {
  complete_response: 'Complete Response (CR)',
  partial_response: 'Partial Response (PR)',
  stable_disease: 'Stable Disease (SD)',
  progressive_disease: 'Progressive Disease (PD)',
  not_evaluable: 'Not Evaluable (NE)',
};

export const ONC_BILLING_CODES: Record<string, { code: string; description: string }> = {
  chemo_infusion_first_hr: { code: '96413', description: 'Chemo IV infusion, first hour' },
  chemo_infusion_add_hr: { code: '96415', description: 'Chemo IV infusion, each additional hour' },
  imrt: { code: '77385', description: 'IMRT delivery, simple' },
  surg_path: { code: '88305', description: 'Surgical pathology, gross and micro' },
  surg_path_complex: { code: '88307', description: 'Surgical pathology, complex' },
  chemo_admin_oral: { code: '96401', description: 'Chemo admin, subcutaneous/IM' },
  radiation_planning: { code: '77263', description: 'Radiation treatment planning, complex' },
};

export const COMMON_REGIMENS: { name: string; drugs: string[]; cancerTypes: string[] }[] = [
  { name: 'FOLFOX', drugs: ['5-FU', 'Leucovorin', 'Oxaliplatin'], cancerTypes: ['Colon', 'Rectal'] },
  { name: 'R-CHOP', drugs: ['Rituximab', 'Cyclophosphamide', 'Doxorubicin', 'Vincristine', 'Prednisone'], cancerTypes: ['Non-Hodgkin Lymphoma'] },
  { name: 'AC-T', drugs: ['Doxorubicin', 'Cyclophosphamide', 'Paclitaxel'], cancerTypes: ['Breast'] },
  { name: 'Cisplatin/Etoposide', drugs: ['Cisplatin', 'Etoposide'], cancerTypes: ['Small Cell Lung', 'Testicular'] },
  { name: 'FOLFIRINOX', drugs: ['5-FU', 'Leucovorin', 'Irinotecan', 'Oxaliplatin'], cancerTypes: ['Pancreatic'] },
  { name: 'Pembrolizumab', drugs: ['Pembrolizumab'], cancerTypes: ['NSCLC', 'Melanoma', 'Head and Neck'] },
  { name: 'Carboplatin/Paclitaxel', drugs: ['Carboplatin', 'Paclitaxel'], cancerTypes: ['Ovarian', 'NSCLC'] },
  { name: 'ABVD', drugs: ['Doxorubicin', 'Bleomycin', 'Vinblastine', 'Dacarbazine'], cancerTypes: ['Hodgkin Lymphoma'] },
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Check for febrile neutropenia */
export function isFebrileNeutropenia(anc: number | null, tempC: number | null): boolean {
  if (anc === null || tempC === null) return false;
  return anc < 500 && tempC >= 38.3;
}

/** Calculate RECIST response from diameter measurements */
export function calculateRECIST(currentSum: number, baselineSum: number, nadirSum: number): RECISTResponse {
  if (currentSum === 0) return 'complete_response';
  const changeFromBaseline = ((currentSum - baselineSum) / baselineSum) * 100;
  const changeFromNadir = ((currentSum - nadirSum) / nadirSum) * 100;

  if (changeFromBaseline <= -30) return 'partial_response';
  if (changeFromNadir >= 20) return 'progressive_disease';
  return 'stable_disease';
}

/** Check if tumor marker has spiked */
export function isTumorMarkerSpike(currentValue: number, baselineValue: number): boolean {
  return currentValue > baselineValue * 2;
}

/** Interpret ECOG performance status */
export function interpretECOG(status: ECOGStatus): string {
  return ECOG_DESCRIPTIONS[status];
}
