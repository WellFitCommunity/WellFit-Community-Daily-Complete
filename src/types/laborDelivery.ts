/**
 * =====================================================
 * LABOR & DELIVERY MODULE - TYPE DEFINITIONS
 * =====================================================
 * Purpose: TypeScript types for maternal-fetal care tracking
 * Integration: Prenatal visits, labor progression, fetal monitoring,
 *   delivery records, newborn assessments, postpartum care
 * =====================================================
 */

// =====================================================
// ENUMS
// =====================================================

export type PregnancyRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type RhFactor = 'positive' | 'negative';

export type GBSStatus = 'positive' | 'negative' | 'unknown' | 'pending';

export type PregnancyStatus = 'active' | 'delivered' | 'loss' | 'terminated';

export type LaborStage =
  | 'latent_phase'
  | 'active_phase'
  | 'transition'
  | 'second_stage'
  | 'third_stage'
  | 'immediate_postpartum';

export type MembraneStatus = 'intact' | 'srom' | 'arom' | 'unknown';

export type FetalHRCategory = 'I' | 'II' | 'III';

export type FHRVariability = 'absent' | 'minimal' | 'moderate' | 'marked';

export type DecelerationType =
  | 'none'
  | 'early'
  | 'late'
  | 'variable'
  | 'prolonged';

export type DeliveryMethod =
  | 'spontaneous_vaginal'
  | 'assisted_vacuum'
  | 'assisted_forceps'
  | 'cesarean_planned'
  | 'cesarean_emergent'
  | 'vbac';

export type AnesthesiaType =
  | 'none'
  | 'epidural'
  | 'spinal'
  | 'combined_spinal_epidural'
  | 'general'
  | 'local'
  | 'pudendal';

export type CordClampingTime = 'immediate' | 'delayed_30s' | 'delayed_60s' | 'delayed_3min';

export type BreastfeedingStatus =
  | 'exclusive_breastfeeding'
  | 'supplementing'
  | 'formula_only'
  | 'not_initiated'
  | 'declined';

export type LochiaType = 'rubra' | 'serosa' | 'alba' | 'abnormal';

export type PostpartumEmotionalStatus =
  | 'stable'
  | 'tearful'
  | 'anxious'
  | 'depressed_screening_positive'
  | 'bonding_concerns';

export type LDMedicationIndication =
  | 'labor_induction'
  | 'labor_augmentation'
  | 'pain_management'
  | 'seizure_prophylaxis'
  | 'hemorrhage_prevention'
  | 'hemorrhage_treatment'
  | 'gbs_prophylaxis'
  | 'rh_prophylaxis'
  | 'tocolysis'
  | 'fetal_lung_maturity';

export type NewbornDisposition = 'well_newborn_nursery' | 'rooming_in' | 'nicu' | 'transferred';

export type LDAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export type LDAlertType =
  | 'fetal_bradycardia'
  | 'severe_preeclampsia'
  | 'category_iii_tracing'
  | 'postpartum_hemorrhage'
  | 'neonatal_distress'
  | 'prolonged_labor'
  | 'meconium'
  | 'gbs_no_antibiotics'
  | 'maternal_fever'
  | 'cord_prolapse';

// =====================================================
// CORE INTERFACES
// =====================================================

/** Pregnancy registry — one record per pregnancy */
export interface LDPregnancy {
  id: string;
  patient_id: string;
  tenant_id: string;
  gravida: number;
  para: number;
  ab: number;
  living: number;
  edd: string;
  lmp: string | null;
  blood_type: BloodType;
  rh_factor: RhFactor;
  gbs_status: GBSStatus;
  risk_level: PregnancyRiskLevel;
  risk_factors: string[];
  status: PregnancyStatus;
  primary_provider_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Prenatal visit tracking */
export interface LDPrenatalVisit {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  visit_date: string;
  provider_id: string | null;
  gestational_age_weeks: number;
  gestational_age_days: number;
  fundal_height_cm: number | null;
  fetal_heart_rate: number | null;
  fetal_presentation: string | null;
  weight_kg: number;
  bp_systolic: number;
  bp_diastolic: number;
  urine_protein: string | null;
  urine_glucose: string | null;
  cervical_dilation_cm: number | null;
  cervical_effacement_percent: number | null;
  cervical_station: number | null;
  edema: boolean;
  complaints: string[];
  notes: string | null;
  created_at: string;
}

/** Labor progression events (partogram data) */
export interface LDLaborEvent {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  event_time: string;
  stage: LaborStage;
  dilation_cm: number;
  effacement_percent: number;
  station: number;
  contraction_frequency_per_10min: number | null;
  contraction_duration_seconds: number | null;
  contraction_intensity: 'mild' | 'moderate' | 'strong' | null;
  membrane_status: MembraneStatus;
  membrane_rupture_time: string | null;
  fluid_color: 'clear' | 'meconium_light' | 'meconium_thick' | 'bloody' | null;
  maternal_bp_systolic: number | null;
  maternal_bp_diastolic: number | null;
  maternal_hr: number | null;
  maternal_temp_c: number | null;
  notes: string | null;
  created_at: string;
}

/** Fetal monitoring strip assessment */
export interface LDFetalMonitoring {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  assessment_time: string;
  assessed_by: string | null;
  fhr_baseline: number;
  variability: FHRVariability;
  accelerations_present: boolean;
  deceleration_type: DecelerationType;
  deceleration_depth_bpm: number | null;
  fhr_category: FetalHRCategory;
  uterine_activity: string | null;
  interpretation: string | null;
  action_taken: string | null;
  created_at: string;
}

/** Delivery record */
export interface LDDeliveryRecord {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  delivery_datetime: string;
  delivery_provider_id: string | null;
  method: DeliveryMethod;
  anesthesia: AnesthesiaType;
  labor_duration_hours: number | null;
  second_stage_duration_min: number | null;
  estimated_blood_loss_ml: number;
  complications: string[];
  episiotomy: boolean;
  laceration_degree: 0 | 1 | 2 | 3 | 4 | null;
  cord_clamping: CordClampingTime;
  cord_gases_ph: number | null;
  cord_gases_base_excess: number | null;
  placenta_delivery_time: string | null;
  placenta_intact: boolean;
  notes: string | null;
  created_at: string;
}

/** Newborn assessment — APGAR scores + initial exam */
export interface LDNewbornAssessment {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  delivery_id: string;
  newborn_patient_id: string | null;
  birth_datetime: string;
  sex: 'male' | 'female' | 'ambiguous';
  weight_g: number;
  length_cm: number;
  head_circumference_cm: number;
  apgar_1_min: number;
  apgar_5_min: number;
  apgar_10_min: number | null;
  ballard_gestational_age_weeks: number | null;
  temperature_c: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  disposition: NewbornDisposition;
  skin_color: string | null;
  reflexes: string | null;
  anomalies: string[];
  vitamin_k_given: boolean;
  erythromycin_given: boolean;
  hepatitis_b_vaccine: boolean;
  notes: string | null;
  created_at: string;
}

/** Postpartum assessments */
export interface LDPostpartumAssessment {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  assessment_datetime: string;
  assessed_by: string | null;
  hours_postpartum: number;
  fundal_height: string;
  fundal_firmness: 'firm' | 'boggy';
  lochia: LochiaType;
  lochia_amount: 'scant' | 'light' | 'moderate' | 'heavy';
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature_c: number;
  breastfeeding_status: BreastfeedingStatus;
  lactation_notes: string | null;
  pain_score: number;
  pain_location: string | null;
  emotional_status: PostpartumEmotionalStatus;
  epds_score: number | null;
  voiding: boolean;
  bowel_movement: boolean;
  incision_intact: boolean | null;
  notes: string | null;
  created_at: string;
}

/** L&D medication administration */
export interface LDMedicationAdministration {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  administered_datetime: string;
  administered_by: string | null;
  medication_name: string;
  dose: string;
  route: 'iv' | 'im' | 'po' | 'epidural' | 'spinal' | 'topical';
  indication: LDMedicationIndication;
  notes: string | null;
  created_at: string;
}

/** Maternal risk assessment */
export interface LDRiskAssessment {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  assessment_date: string;
  assessed_by: string | null;
  risk_level: PregnancyRiskLevel;
  risk_factors: string[];
  score: number | null;
  scoring_system: string | null;
  notes: string | null;
  created_at: string;
}

// =====================================================
// REQUEST TYPES
// =====================================================

export interface CreatePregnancyRequest {
  patient_id: string;
  tenant_id: string;
  gravida: number;
  para: number;
  ab?: number;
  living?: number;
  edd: string;
  lmp?: string;
  blood_type: BloodType;
  rh_factor: RhFactor;
  gbs_status?: GBSStatus;
  risk_level?: PregnancyRiskLevel;
  risk_factors?: string[];
  primary_provider_id?: string;
  notes?: string;
}

export interface CreatePrenatalVisitRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  visit_date: string;
  provider_id?: string;
  gestational_age_weeks: number;
  gestational_age_days: number;
  fundal_height_cm?: number;
  fetal_heart_rate?: number;
  weight_kg: number;
  bp_systolic: number;
  bp_diastolic: number;
  cervical_dilation_cm?: number;
  cervical_effacement_percent?: number;
  complaints?: string[];
  notes?: string;
}

export interface CreateDeliveryRecordRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  delivery_datetime: string;
  delivery_provider_id?: string;
  method: DeliveryMethod;
  anesthesia: AnesthesiaType;
  labor_duration_hours?: number;
  second_stage_duration_min?: number;
  estimated_blood_loss_ml: number;
  complications?: string[];
  episiotomy?: boolean;
  laceration_degree?: 0 | 1 | 2 | 3 | 4;
  cord_clamping?: CordClampingTime;
  cord_gases_ph?: number;
  placenta_intact?: boolean;
  notes?: string;
}

export interface CreateLaborEventRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  event_time: string;
  stage: LaborStage;
  dilation_cm: number;
  effacement_percent: number;
  station: number;
  contraction_frequency_per_10min?: number;
  contraction_duration_seconds?: number;
  contraction_intensity?: 'mild' | 'moderate' | 'strong';
  membrane_status: MembraneStatus;
  membrane_rupture_time?: string;
  fluid_color?: 'clear' | 'meconium_light' | 'meconium_thick' | 'bloody';
  maternal_bp_systolic?: number;
  maternal_bp_diastolic?: number;
  maternal_hr?: number;
  maternal_temp_c?: number;
  notes?: string;
}

export interface CreateFetalMonitoringRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  assessment_time: string;
  assessed_by?: string;
  fhr_baseline: number;
  variability: FHRVariability;
  accelerations_present: boolean;
  deceleration_type: DecelerationType;
  deceleration_depth_bpm?: number;
  fhr_category: FetalHRCategory;
  uterine_activity?: string;
  interpretation?: string;
  action_taken?: string;
}

export interface CreateNewbornAssessmentRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  delivery_id: string;
  birth_datetime: string;
  sex: 'male' | 'female' | 'ambiguous';
  weight_g: number;
  length_cm: number;
  head_circumference_cm: number;
  apgar_1_min: number;
  apgar_5_min: number;
  apgar_10_min?: number;
  ballard_gestational_age_weeks?: number;
  temperature_c?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  disposition: NewbornDisposition;
  anomalies?: string[];
  vitamin_k_given?: boolean;
  erythromycin_given?: boolean;
  hepatitis_b_vaccine?: boolean;
  notes?: string;
}

export interface CreatePostpartumAssessmentRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  hours_postpartum: number;
  assessed_by?: string;
  fundal_height: string;
  fundal_firmness: 'firm' | 'boggy';
  lochia: LochiaType;
  lochia_amount: 'scant' | 'light' | 'moderate' | 'heavy';
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature_c: number;
  breastfeeding_status: BreastfeedingStatus;
  lactation_notes?: string;
  pain_score: number;
  pain_location?: string;
  emotional_status: PostpartumEmotionalStatus;
  epds_score?: number;
  voiding?: boolean;
  bowel_movement?: boolean;
  incision_intact?: boolean;
  notes?: string;
}

export interface CreateMedicationAdminRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  administered_datetime: string;
  administered_by?: string;
  medication_name: string;
  dose: string;
  route: 'iv' | 'im' | 'po' | 'epidural' | 'spinal' | 'topical';
  indication: LDMedicationIndication;
  notes?: string;
}

// =====================================================
// DASHBOARD SUMMARY TYPES
// =====================================================

export interface LDDashboardSummary {
  pregnancy: LDPregnancy | null;
  recent_prenatal_visits: LDPrenatalVisit[];
  labor_events: LDLaborEvent[];
  latest_fetal_monitoring: LDFetalMonitoring | null;
  delivery_record: LDDeliveryRecord | null;
  newborn_assessment: LDNewbornAssessment | null;
  latest_postpartum: LDPostpartumAssessment | null;
  alerts: LDAlert[];
}

export interface LDAlert {
  id: string;
  type: LDAlertType;
  severity: LDAlertSeverity;
  message: string;
  timestamp: string;
  source_record_id: string | null;
  acknowledged: boolean;
}

// =====================================================
// CONSTANTS
// =====================================================

export const APGAR_COMPONENTS = ['appearance', 'pulse', 'grimace', 'activity', 'respiration'] as const;

export const RISK_FACTOR_OPTIONS: string[] = [
  'Advanced maternal age (>35)',
  'Gestational diabetes',
  'Preeclampsia',
  'Chronic hypertension',
  'Multiple gestation',
  'Prior cesarean',
  'Preterm labor history',
  'Placenta previa',
  'IUGR',
  'Rh sensitization',
  'Substance use',
  'BMI > 40',
  'Cervical insufficiency',
  'Prior stillbirth',
];

export const LD_BILLING_CODES: Record<string, { code: string; description: string }> = {
  vaginal_delivery: { code: '59400', description: 'Routine OB care + vaginal delivery' },
  cesarean_delivery: { code: '59510', description: 'Routine OB care + cesarean delivery' },
  nst: { code: '59025', description: 'Non-stress test' },
  fetal_monitoring: { code: '59050', description: 'Fetal monitoring during labor' },
  ob_ultrasound: { code: '76805', description: 'OB ultrasound, complete' },
  amniocentesis: { code: '59000', description: 'Amniocentesis, diagnostic' },
  epidural: { code: '01967', description: 'Epidural anesthesia for labor' },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Calculate gestational age from EDD */
export function calculateGestationalAge(edd: string): { weeks: number; days: number } {
  const eddDate = new Date(edd);
  const now = new Date();
  const dueInMs = eddDate.getTime() - now.getTime();
  const totalDaysRemaining = Math.floor(dueInMs / (1000 * 60 * 60 * 24));
  const totalDaysGestation = 280 - totalDaysRemaining;
  const weeks = Math.floor(totalDaysGestation / 7);
  const days = totalDaysGestation % 7;
  return { weeks: Math.max(0, weeks), days: Math.max(0, days) };
}

/** Interpret APGAR score */
export function interpretAPGAR(score: number): string {
  if (score >= 7) return 'Reassuring';
  if (score >= 4) return 'Moderately depressed — needs intervention';
  return 'Severely depressed — immediate resuscitation';
}

/** Check if BP indicates severe preeclampsia */
export function isSeverePreeclampsia(systolic: number, diastolic: number): boolean {
  return systolic >= 160 || diastolic >= 110;
}

/** Classify fetal heart rate */
export function classifyFetalHR(fhr: number): string {
  if (fhr < 110) return 'Bradycardia';
  if (fhr <= 160) return 'Normal';
  return 'Tachycardia';
}
