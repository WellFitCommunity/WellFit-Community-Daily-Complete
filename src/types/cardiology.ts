/**
 * =====================================================
 * CARDIOLOGY MODULE - TYPE DEFINITIONS
 * =====================================================
 * Purpose: TypeScript types for comprehensive cardiac care tracking
 * Integration: Heart failure management, device monitoring, FHIR mapping, CPT billing
 * =====================================================
 */

// =====================================================
// ENUMS
// =====================================================

export type CardiacCondition =
  | 'coronary_artery_disease'
  | 'heart_failure'
  | 'atrial_fibrillation'
  | 'hypertension'
  | 'valvular_disease'
  | 'cardiomyopathy'
  | 'congenital_heart_disease'
  | 'peripheral_artery_disease'
  | 'pulmonary_hypertension'
  | 'aortic_aneurysm';

export type CardiacRiskFactor =
  | 'diabetes'
  | 'hypertension'
  | 'hyperlipidemia'
  | 'smoking'
  | 'obesity'
  | 'family_history'
  | 'sedentary_lifestyle'
  | 'chronic_kidney_disease'
  | 'sleep_apnea'
  | 'prior_mi';

export type NYHAClass = 'I' | 'II' | 'III' | 'IV';

export type ECGRhythm =
  | 'normal_sinus'
  | 'sinus_bradycardia'
  | 'sinus_tachycardia'
  | 'atrial_fibrillation'
  | 'atrial_flutter'
  | 'svt'
  | 'ventricular_tachycardia'
  | 'ventricular_fibrillation'
  | 'heart_block_first'
  | 'heart_block_second_type1'
  | 'heart_block_second_type2'
  | 'heart_block_third'
  | 'paced_rhythm'
  | 'junctional_rhythm';

export type STChange =
  | 'none'
  | 'st_elevation'
  | 'st_depression'
  | 't_wave_inversion'
  | 'nonspecific';

export type ValveResult = {
  valve: 'mitral' | 'aortic' | 'tricuspid' | 'pulmonic';
  stenosis_grade: 'none' | 'mild' | 'moderate' | 'severe';
  regurgitation_grade: 'none' | 'trace' | 'mild' | 'moderate' | 'severe';
};

export type StressTestProtocol =
  | 'bruce'
  | 'modified_bruce'
  | 'naughton'
  | 'pharmacologic_dobutamine'
  | 'pharmacologic_adenosine'
  | 'pharmacologic_regadenoson';

export type CoronaryArtery = 'lad' | 'lcx' | 'rca' | 'lmca';

export type StenosisGrade =
  | 'normal'
  | 'mild_less_50'
  | 'moderate_50_69'
  | 'severe_70_89'
  | 'critical_90_99'
  | 'total_occlusion';

export type ArrhythmiaType =
  | 'atrial_fibrillation'
  | 'atrial_flutter'
  | 'svt'
  | 'ventricular_tachycardia'
  | 'ventricular_fibrillation'
  | 'premature_atrial_contractions'
  | 'premature_ventricular_contractions'
  | 'sinus_bradycardia'
  | 'sinus_tachycardia'
  | 'heart_block';

export type DeviceType =
  | 'pacemaker'
  | 'icd'
  | 'crt_d'
  | 'crt_p'
  | 'loop_recorder'
  | 'event_monitor';

export type FluidStatus =
  | 'euvolemic'
  | 'hypervolemic'
  | 'hypovolemic';

export type EdemaGrade = 0 | 1 | 2 | 3 | 4;

export type RehabPhase = 1 | 2 | 3;

export type CardiacAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export type CardiacAlertType =
  | 'stemi_detected'
  | 'low_ef'
  | 'new_afib_rvr'
  | 'troponin_elevation'
  | 'bnp_elevated'
  | 'hf_decompensation'
  | 'symptomatic_bradycardia'
  | 'device_alert'
  | 'weight_gain';

export type RegistryStatus = 'active' | 'inactive' | 'discharged' | 'deceased';

// =====================================================
// CORE INTERFACES
// =====================================================

/** Cardiac patient registry — enrollment and risk tracking */
export interface CardPatientRegistry {
  id: string;
  patient_id: string;
  tenant_id: string;
  conditions: CardiacCondition[];
  risk_factors: CardiacRiskFactor[];
  nyha_class: NYHAClass | null;
  lvef_percent: number | null;
  cha2ds2_vasc_score: number | null;
  has_score: number | null;
  enrolled_date: string;
  status: RegistryStatus;
  primary_cardiologist_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** ECG/EKG results with interpretation */
export interface CardEcgResult {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  performed_date: string;
  performed_by: string | null;
  rhythm: ECGRhythm;
  heart_rate: number;
  pr_interval_ms: number | null;
  qrs_duration_ms: number | null;
  qtc_ms: number | null;
  axis_degrees: number | null;
  st_changes: STChange;
  is_stemi: boolean;
  interpretation: string | null;
  is_normal: boolean;
  findings: string[];
  created_at: string;
}

/** Echocardiogram results */
export interface CardEchoResult {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  performed_date: string;
  performed_by: string | null;
  lvef_percent: number;
  rv_function: 'normal' | 'mildly_reduced' | 'moderately_reduced' | 'severely_reduced';
  lv_end_diastolic_diameter_mm: number | null;
  lv_end_systolic_diameter_mm: number | null;
  lv_mass_index: number | null;
  wall_motion_abnormalities: string[];
  valve_results: ValveResult[];
  pericardial_effusion: boolean;
  diastolic_function: 'normal' | 'grade_1' | 'grade_2' | 'grade_3' | null;
  interpretation: string | null;
  created_at: string;
}

/** Stress test results */
export interface CardStressTest {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  performed_date: string;
  performed_by: string | null;
  protocol: StressTestProtocol;
  duration_min: number;
  max_heart_rate: number;
  target_heart_rate: number;
  percent_target_achieved: number;
  mets_achieved: number;
  duke_score: number | null;
  is_positive: boolean;
  ischemic_changes: boolean;
  arrhythmias_during: string[];
  symptoms_during: string[];
  bp_peak_systolic: number | null;
  bp_peak_diastolic: number | null;
  findings: string | null;
  created_at: string;
}

/** Catheterization / angiography reports */
export interface CardCathReport {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  performed_date: string;
  performed_by: string | null;
  access_site: 'radial' | 'femoral';
  coronary_arteries: Record<CoronaryArtery, StenosisGrade>;
  interventions: string[];
  stents_placed: StentRecord[];
  hemodynamics: HemodynamicData | null;
  complications: string[];
  contrast_volume_ml: number | null;
  fluoroscopy_time_min: number | null;
  findings: string | null;
  created_at: string;
}

export interface StentRecord {
  artery: CoronaryArtery;
  type: 'bare_metal' | 'drug_eluting';
  diameter_mm: number;
  length_mm: number;
}

export interface HemodynamicData {
  lvedp_mmhg: number | null;
  cardiac_output: number | null;
  cardiac_index: number | null;
  pulmonary_artery_pressure: string | null;
}

/** Heart failure management tracking */
export interface CardHeartFailure {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  assessment_date: string;
  assessed_by: string | null;
  nyha_class: NYHAClass;
  bnp_pg_ml: number | null;
  nt_pro_bnp_pg_ml: number | null;
  daily_weight_kg: number;
  previous_weight_kg: number | null;
  weight_change_kg: number | null;
  fluid_status: FluidStatus;
  edema_grade: EdemaGrade;
  dyspnea_at_rest: boolean;
  orthopnea: boolean;
  pnd: boolean;
  jugular_venous_distension: boolean;
  crackles: boolean;
  s3_gallop: boolean;
  fluid_restriction_ml: number | null;
  sodium_restriction_mg: number | null;
  diuretic_adjustment: string | null;
  notes: string | null;
  created_at: string;
}

/** Arrhythmia event tracking */
export interface CardArrhythmiaEvent {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  event_date: string;
  detected_by: 'ecg' | 'monitor' | 'device' | 'patient_report';
  type: ArrhythmiaType;
  duration_seconds: number | null;
  heart_rate_during: number | null;
  hemodynamically_stable: boolean;
  symptoms: string[];
  treatment_given: string | null;
  cardioversion_performed: boolean;
  notes: string | null;
  created_at: string;
}

/** Cardiac device monitoring (pacemaker, ICD, CRT) */
export interface CardDeviceMonitoring {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  device_type: DeviceType;
  device_manufacturer: string | null;
  device_model: string | null;
  implant_date: string | null;
  check_date: string;
  checked_by: string | null;
  battery_status: 'good' | 'elective_replacement' | 'end_of_life';
  battery_voltage: number | null;
  battery_longevity_months: number | null;
  atrial_pacing_percent: number | null;
  ventricular_pacing_percent: number | null;
  lead_impedance_atrial_ohms: number | null;
  lead_impedance_ventricular_ohms: number | null;
  sensing_atrial_mv: number | null;
  sensing_ventricular_mv: number | null;
  threshold_atrial_v: number | null;
  threshold_ventricular_v: number | null;
  shocks_delivered: number;
  anti_tachycardia_pacing_events: number;
  atrial_arrhythmia_burden_percent: number | null;
  alerts: string[];
  notes: string | null;
  created_at: string;
}

/** Cardiac rehab tracking */
export interface CardCardiacRehab {
  id: string;
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  phase: RehabPhase;
  session_date: string;
  session_number: number;
  total_sessions_prescribed: number;
  exercise_type: string;
  duration_min: number;
  peak_heart_rate: number | null;
  target_heart_rate: number | null;
  resting_bp_systolic: number | null;
  resting_bp_diastolic: number | null;
  mets_achieved: number | null;
  rpe_score: number | null;
  symptoms_during: string[];
  functional_improvement_notes: string | null;
  completed: boolean;
  notes: string | null;
  created_at: string;
}

// =====================================================
// REQUEST / RESPONSE TYPES
// =====================================================

export interface CreateCardRegistryRequest {
  patient_id: string;
  tenant_id: string;
  conditions: CardiacCondition[];
  risk_factors: CardiacRiskFactor[];
  nyha_class?: NYHAClass;
  lvef_percent?: number;
  cha2ds2_vasc_score?: number;
  primary_cardiologist_id?: string;
  notes?: string;
}

export interface CreateEcgResultRequest {
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  performed_date: string;
  performed_by?: string;
  rhythm: ECGRhythm;
  heart_rate: number;
  pr_interval_ms?: number;
  qrs_duration_ms?: number;
  qtc_ms?: number;
  axis_degrees?: number;
  st_changes: STChange;
  is_stemi: boolean;
  interpretation?: string;
  is_normal: boolean;
  findings?: string[];
}

export interface CreateEchoResultRequest {
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  performed_date: string;
  performed_by?: string;
  lvef_percent: number;
  rv_function: CardEchoResult['rv_function'];
  lv_end_diastolic_diameter_mm?: number;
  lv_end_systolic_diameter_mm?: number;
  wall_motion_abnormalities?: string[];
  valve_results?: ValveResult[];
  pericardial_effusion?: boolean;
  diastolic_function?: CardEchoResult['diastolic_function'];
  interpretation?: string;
}

export interface CreateHeartFailureRequest {
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  assessed_by?: string;
  nyha_class: NYHAClass;
  bnp_pg_ml?: number;
  nt_pro_bnp_pg_ml?: number;
  daily_weight_kg: number;
  previous_weight_kg?: number;
  fluid_status: FluidStatus;
  edema_grade: EdemaGrade;
  dyspnea_at_rest: boolean;
  orthopnea: boolean;
  pnd: boolean;
  jugular_venous_distension: boolean;
  crackles: boolean;
  s3_gallop: boolean;
  fluid_restriction_ml?: number;
  sodium_restriction_mg?: number;
  diuretic_adjustment?: string;
  notes?: string;
}

export interface CreateDeviceCheckRequest {
  patient_id: string;
  tenant_id: string;
  registry_id: string;
  device_type: DeviceType;
  device_manufacturer?: string;
  device_model?: string;
  implant_date?: string;
  checked_by?: string;
  battery_status: CardDeviceMonitoring['battery_status'];
  battery_voltage?: number;
  battery_longevity_months?: number;
  atrial_pacing_percent?: number;
  ventricular_pacing_percent?: number;
  lead_impedance_atrial_ohms?: number;
  lead_impedance_ventricular_ohms?: number;
  shocks_delivered: number;
  anti_tachycardia_pacing_events: number;
  atrial_arrhythmia_burden_percent?: number;
  alerts?: string[];
  notes?: string;
}

// =====================================================
// DASHBOARD SUMMARY TYPES
// =====================================================

export interface CardiologyDashboardSummary {
  registry: CardPatientRegistry | null;
  latest_ecg: CardEcgResult | null;
  latest_echo: CardEchoResult | null;
  latest_stress_test: CardStressTest | null;
  latest_hf_assessment: CardHeartFailure | null;
  latest_device_check: CardDeviceMonitoring | null;
  rehab_progress: RehabProgress | null;
  recent_arrhythmias: CardArrhythmiaEvent[];
  alerts: CardiacAlert[];
}

export interface RehabProgress {
  phase: RehabPhase;
  sessions_completed: number;
  total_sessions: number;
  completion_percent: number;
  latest_mets: number | null;
}

export interface CardiacAlert {
  id: string;
  type: CardiacAlertType;
  severity: CardiacAlertSeverity;
  message: string;
  timestamp: string;
  source_record_id: string | null;
  acknowledged: boolean;
}

// =====================================================
// CONSTANTS
// =====================================================

export const NYHA_DESCRIPTIONS: Record<NYHAClass, string> = {
  I: 'No limitation of physical activity',
  II: 'Slight limitation — comfortable at rest, symptoms with ordinary activity',
  III: 'Marked limitation — comfortable at rest, symptoms with less than ordinary activity',
  IV: 'Unable to carry on any physical activity without discomfort — symptoms at rest',
};

export const ALERT_SEVERITY_ORDER: Record<CardiacAlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const CARDIAC_BILLING_CODES: Record<string, { code: string; description: string }> = {
  ecg_12_lead: { code: '93000', description: 'Electrocardiogram, 12-lead with interpretation' },
  echocardiogram_tte: { code: '93306', description: 'TTE with Doppler, complete' },
  stress_echo: { code: '93350', description: 'Stress echocardiography' },
  left_heart_cath: { code: '93452', description: 'Left heart catheterization' },
  device_interrogation: { code: '93279', description: 'Device interrogation, remote' },
  cardiac_rehab: { code: '93797', description: 'Physician services for cardiac rehab' },
  nuclear_stress: { code: '78452', description: 'Myocardial perfusion imaging, SPECT' },
};

export const STENOSIS_LABELS: Record<StenosisGrade, string> = {
  normal: 'Normal',
  mild_less_50: 'Mild (<50%)',
  moderate_50_69: 'Moderate (50-69%)',
  severe_70_89: 'Severe (70-89%)',
  critical_90_99: 'Critical (90-99%)',
  total_occlusion: 'Total Occlusion (100%)',
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Calculate CHA2DS2-VASc score for AFib stroke risk */
export function calculateCHA2DS2VASc(params: {
  age: number;
  isFemale: boolean;
  hasChf: boolean;
  hasHypertension: boolean;
  hasDiabetes: boolean;
  hasStrokeTia: boolean;
  hasVascularDisease: boolean;
}): number {
  let score = 0;
  if (params.hasChf) score += 1;
  if (params.hasHypertension) score += 1;
  if (params.age >= 75) score += 2;
  else if (params.age >= 65) score += 1;
  if (params.hasDiabetes) score += 1;
  if (params.hasStrokeTia) score += 2;
  if (params.hasVascularDisease) score += 1;
  if (params.isFemale) score += 1;
  return score;
}

/** Interpret LVEF percentage */
export function interpretLVEF(ef: number): string {
  if (ef >= 55) return 'Normal';
  if (ef >= 40) return 'Mildly reduced (HFmrEF)';
  if (ef >= 30) return 'Moderately reduced (HFrEF)';
  return 'Severely reduced (HFrEF)';
}

/** Interpret BNP value */
export function interpretBNP(bnp: number): string {
  if (bnp < 100) return 'Normal — HF unlikely';
  if (bnp < 400) return 'Indeterminate — consider clinical context';
  if (bnp < 1000) return 'Elevated — HF likely';
  return 'Markedly elevated — severe HF';
}

/** Get weight change alert level */
export function getWeightChangeAlert(changeKg: number): CardiacAlertSeverity | null {
  const changeLbs = changeKg * 2.205;
  if (changeLbs >= 3) return 'high';
  if (changeLbs >= 2) return 'medium';
  return null;
}
