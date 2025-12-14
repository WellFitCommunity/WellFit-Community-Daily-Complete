/**
 * Marker Type Library - Full definitions for all marker types
 *
 * Each marker type includes:
 * - Default positioning on the body
 * - Keywords for SmartScribe matching
 * - ICD-10 codes where applicable
 * - Laterality adjustments for left/right variants
 */

import { MarkerTypeDefinition, MarkerTypeGroup } from '../../../types/patientAvatar';

// ============================================================================
// VASCULAR ACCESS DEVICES
// ============================================================================

const VASCULAR_ACCESS_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'picc_line',
    display_name: 'PICC Line',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 35 },
    keywords: ['picc', 'picc line', 'peripherally inserted', 'peripherally-inserted'],
    laterality_adjustments: {
      left: { x: 78, y: 35 },
      right: { x: 22, y: 35 },
    },
  },
  {
    type: 'picc_line_double',
    display_name: 'PICC Line (Double Lumen)',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 35 },
    keywords: ['double lumen picc', 'dual lumen picc', '2 lumen picc'],
    laterality_adjustments: {
      left: { x: 78, y: 35 },
      right: { x: 22, y: 35 },
    },
  },
  {
    type: 'picc_line_triple',
    display_name: 'PICC Line (Triple Lumen)',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 35 },
    keywords: ['triple lumen picc', '3 lumen picc'],
    laterality_adjustments: {
      left: { x: 78, y: 35 },
      right: { x: 22, y: 35 },
    },
  },
  {
    type: 'central_line_subclavian',
    display_name: 'Central Line (Subclavian)',
    category: 'critical',
    default_body_region: 'chest_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 26 },
    keywords: ['subclavian line', 'subclavian cvc', 'subclavian central'],
    laterality_adjustments: {
      left: { x: 62, y: 26 },
      right: { x: 38, y: 26 },
    },
  },
  {
    type: 'central_line_jugular',
    display_name: 'Central Line (Jugular)',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 45, y: 20 },
    keywords: ['jugular line', 'ij line', 'internal jugular', 'jugular cvc'],
    laterality_adjustments: {
      left: { x: 55, y: 20 },
      right: { x: 45, y: 20 },
    },
  },
  {
    type: 'central_line_femoral',
    display_name: 'Central Line (Femoral)',
    category: 'critical',
    default_body_region: 'groin_right',
    default_body_view: 'front',
    default_position: { x: 42, y: 60 },
    keywords: ['femoral line', 'femoral cvc', 'groin line'],
    laterality_adjustments: {
      left: { x: 58, y: 60 },
      right: { x: 42, y: 60 },
    },
  },
  {
    type: 'peripheral_iv',
    display_name: 'Peripheral IV',
    category: 'informational',
    default_body_region: 'hand_right',
    default_body_view: 'front',
    default_position: { x: 10, y: 66 },
    keywords: ['peripheral iv', 'piv', 'iv access', 'iv site'],
    laterality_adjustments: {
      left: { x: 90, y: 66 },
      right: { x: 10, y: 66 },
    },
  },
  {
    type: 'midline_catheter',
    display_name: 'Midline Catheter',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 38 },
    keywords: ['midline', 'midline catheter'],
    laterality_adjustments: {
      left: { x: 78, y: 38 },
      right: { x: 22, y: 38 },
    },
  },
  {
    type: 'port_a_cath',
    display_name: 'Port-a-Cath',
    category: 'informational',
    default_body_region: 'chest_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 28 },
    keywords: ['port', 'port-a-cath', 'portacath', 'implanted port', 'chemo port'],
    laterality_adjustments: {
      left: { x: 60, y: 28 },
      right: { x: 40, y: 28 },
    },
  },
  {
    type: 'dialysis_catheter',
    display_name: 'Dialysis Catheter',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 45, y: 20 },
    keywords: ['dialysis catheter', 'hemodialysis catheter', 'hd catheter', 'permacath', 'tunneled dialysis'],
  },
  {
    type: 'arterial_line',
    display_name: 'Arterial Line',
    category: 'critical',
    default_body_region: 'wrist_right',
    default_body_view: 'front',
    default_position: { x: 12, y: 60 },
    keywords: ['arterial line', 'a-line', 'art line', 'radial artery'],
    laterality_adjustments: {
      left: { x: 88, y: 60 },
      right: { x: 12, y: 60 },
    },
  },
  {
    type: 'av_fistula',
    display_name: 'AV Fistula',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['av fistula', 'arteriovenous fistula', 'dialysis fistula', 'avf'],
    laterality_adjustments: {
      left: { x: 85, y: 52 },
      right: { x: 15, y: 52 },
    },
  },
];

// ============================================================================
// DRAINAGE & TUBES
// ============================================================================

const DRAINAGE_TUBE_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'foley_catheter',
    display_name: 'Foley Catheter',
    category: 'moderate',
    default_body_region: 'abdomen_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 58 },
    keywords: ['foley', 'foley catheter', 'urinary catheter', 'indwelling catheter'],
  },
  {
    type: 'suprapubic_catheter',
    display_name: 'Suprapubic Catheter',
    category: 'moderate',
    default_body_region: 'abdomen_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 55 },
    keywords: ['suprapubic', 'sp catheter', 'suprapubic tube'],
  },
  {
    type: 'chest_tube',
    display_name: 'Chest Tube',
    category: 'critical',
    default_body_region: 'chest_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 35 },
    keywords: ['chest tube', 'thoracostomy', 'pleural drain', 'thoracic drain'],
    laterality_adjustments: {
      left: { x: 62, y: 35 },
      right: { x: 38, y: 35 },
    },
  },
  {
    type: 'jp_drain',
    display_name: 'JP Drain',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 47 },
    keywords: ['jp drain', 'jackson-pratt', 'jackson pratt', 'bulb drain'],
  },
  {
    type: 'hemovac',
    display_name: 'Hemovac',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 50 },
    keywords: ['hemovac', 'hemovac drain'],
  },
  {
    type: 'penrose_drain',
    display_name: 'Penrose Drain',
    category: 'informational',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 48 },
    keywords: ['penrose', 'penrose drain', 'passive drain'],
  },
  {
    type: 'ng_tube',
    display_name: 'NG Tube',
    category: 'moderate',
    default_body_region: 'face',
    default_body_view: 'front',
    default_position: { x: 52, y: 14 },
    keywords: ['ng tube', 'nasogastric', 'nasogastric tube', 'ngt'],
  },
  {
    type: 'g_tube',
    display_name: 'G-Tube/PEG',
    category: 'moderate',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 60, y: 45 },
    keywords: ['g-tube', 'gtube', 'peg', 'peg tube', 'gastrostomy', 'feeding tube'],
  },
  {
    type: 'j_tube',
    display_name: 'J-Tube',
    category: 'moderate',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 60, y: 48 },
    keywords: ['j-tube', 'jtube', 'jej tube', 'jejunostomy'],
  },
  {
    type: 'tracheostomy',
    display_name: 'Tracheostomy',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 50, y: 21 },
    keywords: ['trach', 'tracheostomy', 'tracheotomy', 'trach tube'],
  },
  {
    type: 'nephrostomy',
    display_name: 'Nephrostomy Tube',
    category: 'moderate',
    default_body_region: 'lower_back_right',
    default_body_view: 'back',
    default_position: { x: 40, y: 50 },
    keywords: ['nephrostomy', 'nephrostomy tube', 'percutaneous nephrostomy'],
    laterality_adjustments: {
      left: { x: 60, y: 50 },
      right: { x: 40, y: 50 },
    },
  },
];

// ============================================================================
// WOUNDS & SURGICAL SITES
// ============================================================================

const WOUND_SURGICAL_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'surgical_incision',
    display_name: 'Surgical Incision',
    category: 'informational',
    default_body_region: 'abdomen_upper',
    default_body_view: 'front',
    default_position: { x: 50, y: 42 },
    keywords: ['incision', 'surgical site', 'surgical incision', 'operative site'],
  },
  {
    type: 'pressure_injury_1',
    display_name: 'Pressure Injury (Stage 1)',
    category: 'moderate',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 1 pressure', 'stage i pressure', 'pressure injury', 'pressure ulcer', 'bedsore'],
  },
  {
    type: 'pressure_injury_2',
    display_name: 'Pressure Injury (Stage 2)',
    category: 'moderate',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 2 pressure', 'stage ii pressure'],
  },
  {
    type: 'pressure_injury_3',
    display_name: 'Pressure Injury (Stage 3)',
    category: 'critical',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 3 pressure', 'stage iii pressure'],
  },
  {
    type: 'pressure_injury_4',
    display_name: 'Pressure Injury (Stage 4)',
    category: 'critical',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 4 pressure', 'stage iv pressure'],
  },
  {
    type: 'pressure_injury_unstageable',
    display_name: 'Pressure Injury (Unstageable)',
    category: 'critical',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['unstageable pressure', 'unstaged pressure'],
  },
  {
    type: 'laceration',
    display_name: 'Laceration',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['laceration', 'cut', 'wound'],
  },
  {
    type: 'skin_tear',
    display_name: 'Skin Tear',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['skin tear', 'skin flap'],
  },
  {
    type: 'ostomy_colostomy',
    display_name: 'Colostomy',
    category: 'moderate',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 62, y: 48 },
    keywords: ['colostomy', 'stoma', 'ostomy'],
  },
  {
    type: 'ostomy_ileostomy',
    display_name: 'Ileostomy',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 48 },
    keywords: ['ileostomy'],
  },
  {
    type: 'ostomy_urostomy',
    display_name: 'Urostomy',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 50 },
    keywords: ['urostomy', 'ileal conduit'],
  },
];

// ============================================================================
// ORTHOPEDIC
// ============================================================================

const ORTHOPEDIC_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'fracture',
    display_name: 'Fracture Site',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['fracture', 'broken', 'fx'],
  },
  {
    type: 'external_fixator',
    display_name: 'External Fixator',
    category: 'critical',
    default_body_region: 'shin_right',
    default_body_view: 'front',
    default_position: { x: 45, y: 88 },
    keywords: ['external fixator', 'ex fix', 'ilizarov'],
  },
  {
    type: 'cast',
    display_name: 'Cast/Splint',
    category: 'informational',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['cast', 'splint', 'immobilizer'],
  },
  {
    type: 'joint_replacement_hip',
    display_name: 'Hip Replacement',
    category: 'informational',
    default_body_region: 'groin_right',
    default_body_view: 'front',
    default_position: { x: 42, y: 62 },
    keywords: ['hip replacement', 'total hip', 'hip arthroplasty', 'tha'],
    laterality_adjustments: {
      left: { x: 58, y: 62 },
      right: { x: 42, y: 62 },
    },
  },
  {
    type: 'joint_replacement_knee',
    display_name: 'Knee Replacement',
    category: 'informational',
    default_body_region: 'knee_right',
    default_body_view: 'front',
    default_position: { x: 44, y: 80 },
    keywords: ['knee replacement', 'total knee', 'knee arthroplasty', 'tka'],
    laterality_adjustments: {
      left: { x: 56, y: 80 },
      right: { x: 44, y: 80 },
    },
  },
  {
    type: 'joint_replacement_shoulder',
    display_name: 'Shoulder Replacement',
    category: 'informational',
    default_body_region: 'shoulder_right',
    default_body_view: 'front',
    default_position: { x: 30, y: 25 },
    keywords: ['shoulder replacement', 'total shoulder', 'shoulder arthroplasty', 'tsa'],
    laterality_adjustments: {
      left: { x: 70, y: 25 },
      right: { x: 30, y: 25 },
    },
  },
];

// ============================================================================
// MONITORING DEVICES
// ============================================================================

const MONITORING_DEVICE_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'cgm',
    display_name: 'Continuous Glucose Monitor',
    category: 'monitoring',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 20, y: 33 },
    keywords: ['cgm', 'continuous glucose', 'dexcom', 'libre', 'glucose monitor'],
    laterality_adjustments: {
      left: { x: 80, y: 33 },
      right: { x: 20, y: 33 },
    },
  },
  {
    type: 'cardiac_monitor',
    display_name: 'Cardiac Monitor Leads',
    category: 'monitoring',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 55, y: 30 },
    keywords: ['cardiac monitor', 'ecg leads', 'ekg leads', 'telemetry'],
  },
  {
    type: 'pulse_ox_continuous',
    display_name: 'Continuous Pulse Oximeter',
    category: 'monitoring',
    default_body_region: 'hand_right',
    default_body_view: 'front',
    default_position: { x: 8, y: 66 },
    keywords: ['pulse ox', 'pulse oximeter', 'spo2 monitor'],
  },
  {
    type: 'holter_monitor',
    display_name: 'Holter Monitor',
    category: 'monitoring',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 58, y: 32 },
    keywords: ['holter', 'holter monitor', '24 hour monitor'],
  },
];

// ============================================================================
// IMPLANTS
// ============================================================================

const IMPLANT_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'pacemaker',
    display_name: 'Pacemaker',
    category: 'informational',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 62, y: 28 },
    keywords: ['pacemaker', 'pacer', 'cardiac pacemaker'],
  },
  {
    type: 'icd',
    display_name: 'ICD (Defibrillator)',
    category: 'informational',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 62, y: 28 },
    keywords: ['icd', 'implantable defibrillator', 'aicd', 'implantable cardioverter'],
  },
  {
    type: 'insulin_pump',
    display_name: 'Insulin Pump',
    category: 'monitoring',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 48 },
    keywords: ['insulin pump', 'omnipod', 'tandem', 'medtronic pump'],
  },
  {
    type: 'pain_pump',
    display_name: 'Pain Pump',
    category: 'informational',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 60, y: 50 },
    keywords: ['pain pump', 'intrathecal pump', 'baclofen pump'],
  },
  {
    type: 'vp_shunt',
    display_name: 'VP Shunt',
    category: 'informational',
    default_body_region: 'head_top',
    default_body_view: 'front',
    default_position: { x: 48, y: 8 },
    keywords: ['vp shunt', 'ventriculoperitoneal', 'brain shunt', 'csf shunt'],
  },
  {
    type: 'dbs',
    display_name: 'Deep Brain Stimulator',
    category: 'informational',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['dbs', 'deep brain stimulator', 'brain stimulator'],
  },
  {
    type: 'cochlear_implant',
    display_name: 'Cochlear Implant',
    category: 'informational',
    default_body_region: 'head_back',
    default_body_view: 'back',
    default_position: { x: 45, y: 10 },
    keywords: ['cochlear implant', 'cochlear'],
    laterality_adjustments: {
      left: { x: 55, y: 10 },
      right: { x: 45, y: 10 },
    },
  },
  {
    type: 'spinal_cord_stimulator',
    display_name: 'Spinal Cord Stimulator',
    category: 'informational',
    default_body_region: 'spine_lower',
    default_body_view: 'back',
    default_position: { x: 50, y: 52 },
    keywords: ['spinal cord stimulator', 'scs', 'dorsal column stimulator'],
  },
];

// ============================================================================
// CHRONIC CONDITIONS
// ============================================================================

const CHRONIC_CONDITION_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'chf',
    display_name: 'Congestive Heart Failure',
    category: 'chronic',
    default_body_region: 'heart',
    default_body_view: 'front',
    default_position: { x: 55, y: 32 },
    keywords: ['chf', 'congestive heart failure', 'heart failure', 'hfref', 'hfpef'],
    icd10: 'I50.9',
  },
  {
    type: 'cad',
    display_name: 'Coronary Artery Disease',
    category: 'chronic',
    default_body_region: 'heart',
    default_body_view: 'front',
    default_position: { x: 55, y: 32 },
    keywords: ['cad', 'coronary artery disease', 'coronary disease', 'ischemic heart'],
    icd10: 'I25.10',
  },
  {
    type: 'afib',
    display_name: 'Atrial Fibrillation',
    category: 'chronic',
    default_body_region: 'heart',
    default_body_view: 'front',
    default_position: { x: 55, y: 32 },
    keywords: ['afib', 'atrial fibrillation', 'a-fib', 'af'],
    icd10: 'I48.91',
  },
  {
    type: 'copd',
    display_name: 'COPD',
    category: 'chronic',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 50, y: 30 },
    keywords: ['copd', 'chronic obstructive', 'emphysema', 'chronic bronchitis'],
    icd10: 'J44.9',
  },
  {
    type: 'asthma',
    display_name: 'Asthma',
    category: 'chronic',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 50, y: 30 },
    keywords: ['asthma', 'reactive airway'],
    icd10: 'J45.909',
  },
  {
    type: 'diabetes_type1',
    display_name: 'Diabetes Type 1',
    category: 'chronic',
    default_body_region: 'abdomen_upper',
    default_body_view: 'front',
    default_position: { x: 50, y: 42 },
    keywords: ['type 1 diabetes', 't1dm', 'iddm', 'juvenile diabetes'],
    icd10: 'E10.9',
  },
  {
    type: 'diabetes_type2',
    display_name: 'Diabetes Type 2',
    category: 'chronic',
    default_body_region: 'abdomen_upper',
    default_body_view: 'front',
    default_position: { x: 50, y: 42 },
    keywords: ['type 2 diabetes', 't2dm', 'niddm', 'adult onset diabetes'],
    icd10: 'E11.9',
  },
  {
    type: 'ckd',
    display_name: 'Chronic Kidney Disease',
    category: 'chronic',
    default_body_region: 'lower_back_right',
    default_body_view: 'back',
    default_position: { x: 42, y: 52 },
    keywords: ['ckd', 'chronic kidney disease', 'renal disease', 'kidney disease'],
    icd10: 'N18.9',
  },
  {
    type: 'esrd',
    display_name: 'End-Stage Renal Disease',
    category: 'chronic',
    default_body_region: 'lower_back_right',
    default_body_view: 'back',
    default_position: { x: 42, y: 52 },
    keywords: ['esrd', 'end stage renal', 'dialysis dependent'],
    icd10: 'N18.6',
  },
  {
    type: 'pad',
    display_name: 'Peripheral Artery Disease',
    category: 'chronic',
    default_body_region: 'shin_right',
    default_body_view: 'front',
    default_position: { x: 45, y: 88 },
    keywords: ['pad', 'peripheral artery disease', 'pvd', 'peripheral vascular'],
    icd10: 'I73.9',
  },
  {
    type: 'cancer',
    display_name: 'Cancer',
    category: 'chronic',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 55, y: 30 },
    keywords: ['cancer', 'malignancy', 'oncology', 'tumor', 'carcinoma'],
    icd10: 'C80.1',
  },
];

// ============================================================================
// NEUROLOGICAL CONDITIONS
// ============================================================================

const NEUROLOGICAL_CONDITION_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'stroke_ischemic',
    display_name: 'Stroke (Ischemic)',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['ischemic stroke', 'cva', 'cerebrovascular accident', 'stroke'],
    icd10: 'I63.9',
    laterality_adjustments: {
      left: { x: 45, y: 8 },
      right: { x: 55, y: 8 },
    },
  },
  {
    type: 'stroke_hemorrhagic',
    display_name: 'Stroke (Hemorrhagic)',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['hemorrhagic stroke', 'brain bleed', 'intracerebral hemorrhage', 'ich'],
    icd10: 'I61.9',
    laterality_adjustments: {
      left: { x: 45, y: 8 },
      right: { x: 55, y: 8 },
    },
  },
  {
    type: 'parkinsons',
    display_name: "Parkinson's Disease",
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['parkinson', "parkinson's", 'parkinsonian', 'pd'],
    icd10: 'G20',
  },
  {
    type: 'alzheimers',
    display_name: "Alzheimer's Disease",
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['alzheimer', "alzheimer's", 'alzheimers'],
    icd10: 'G30.9',
  },
  {
    type: 'dementia',
    display_name: 'Dementia',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['dementia', 'cognitive impairment', 'memory loss'],
    icd10: 'F03.90',
  },
  {
    type: 'dementia_vascular',
    display_name: 'Vascular Dementia',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['vascular dementia', 'multi-infarct dementia'],
    icd10: 'F01.50',
  },
  {
    type: 'dementia_lewy',
    display_name: 'Lewy Body Dementia',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['lewy body', 'dlb', 'lewy body dementia'],
    icd10: 'G31.83',
  },
  {
    type: 'epilepsy',
    display_name: 'Epilepsy/Seizure Disorder',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['epilepsy', 'seizure disorder', 'seizures', 'convulsions'],
    icd10: 'G40.909',
  },
  {
    type: 'ms',
    display_name: 'Multiple Sclerosis',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['multiple sclerosis', 'ms'],
    icd10: 'G35',
  },
  {
    type: 'occipital_neuralgia',
    display_name: 'Occipital Neuralgia',
    category: 'neurological',
    default_body_region: 'head_back',
    default_body_view: 'back',
    default_position: { x: 50, y: 8 },
    keywords: ['occipital neuralgia', 'occipital nerve'],
    icd10: 'G52.8',
  },
  {
    type: 'trigeminal_neuralgia',
    display_name: 'Trigeminal Neuralgia',
    category: 'neurological',
    default_body_region: 'face',
    default_body_view: 'front',
    default_position: { x: 45, y: 14 },
    keywords: ['trigeminal neuralgia', 'tic douloureux'],
    icd10: 'G50.0',
  },
  {
    type: 'neuropathy_peripheral',
    display_name: 'Peripheral Neuropathy',
    category: 'neurological',
    default_body_region: 'foot_right',
    default_body_view: 'front',
    default_position: { x: 45, y: 98 },
    keywords: ['peripheral neuropathy', 'neuropathy', 'nerve damage'],
    icd10: 'G62.9',
  },
  {
    type: 'neuropathy_diabetic',
    display_name: 'Diabetic Neuropathy',
    category: 'neurological',
    default_body_region: 'foot_right',
    default_body_view: 'front',
    default_position: { x: 45, y: 98 },
    keywords: ['diabetic neuropathy', 'diabetic nerve'],
    icd10: 'E11.42',
  },
  {
    type: 'tbi',
    display_name: 'Traumatic Brain Injury',
    category: 'neurological',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['tbi', 'traumatic brain injury', 'head injury', 'brain injury'],
    icd10: 'S06.9X0A',
  },
  {
    type: 'myasthenia_gravis',
    display_name: 'Myasthenia Gravis',
    category: 'neurological',
    default_body_region: 'face',
    default_body_view: 'front',
    default_position: { x: 50, y: 14 },
    keywords: ['myasthenia gravis', 'mg'],
    icd10: 'G70.00',
  },
];

// ============================================================================
// COMBINE ALL TYPES
// ============================================================================

/**
 * All marker type definitions
 */
export const MARKER_TYPE_LIBRARY: MarkerTypeDefinition[] = [
  ...VASCULAR_ACCESS_TYPES,
  ...DRAINAGE_TUBE_TYPES,
  ...WOUND_SURGICAL_TYPES,
  ...ORTHOPEDIC_TYPES,
  ...MONITORING_DEVICE_TYPES,
  ...IMPLANT_TYPES,
  ...CHRONIC_CONDITION_TYPES,
  ...NEUROLOGICAL_CONDITION_TYPES,
];

/**
 * Grouped marker types for UI display
 */
export const MARKER_TYPE_GROUPS: MarkerTypeGroup[] = [
  {
    label: 'Vascular Access',
    category: 'moderate',
    types: VASCULAR_ACCESS_TYPES,
  },
  {
    label: 'Drainage & Tubes',
    category: 'moderate',
    types: DRAINAGE_TUBE_TYPES,
  },
  {
    label: 'Wounds & Surgical',
    category: 'informational',
    types: WOUND_SURGICAL_TYPES,
  },
  {
    label: 'Orthopedic',
    category: 'informational',
    types: ORTHOPEDIC_TYPES,
  },
  {
    label: 'Monitoring Devices',
    category: 'monitoring',
    types: MONITORING_DEVICE_TYPES,
  },
  {
    label: 'Implants',
    category: 'informational',
    types: IMPLANT_TYPES,
  },
  {
    label: 'Chronic Conditions',
    category: 'chronic',
    types: CHRONIC_CONDITION_TYPES,
  },
  {
    label: 'Neurological Conditions',
    category: 'neurological',
    types: NEUROLOGICAL_CONDITION_TYPES,
  },
];

/**
 * Find marker type definition by type ID
 */
export function getMarkerTypeDefinition(type: string): MarkerTypeDefinition | undefined {
  return MARKER_TYPE_LIBRARY.find((t) => t.type === type);
}

/**
 * Find marker type by keyword matching (for SmartScribe)
 */
export function findMarkerTypeByKeywords(text: string): MarkerTypeDefinition | undefined {
  const normalizedText = text.toLowerCase().trim();

  // First try exact match
  for (const def of MARKER_TYPE_LIBRARY) {
    for (const keyword of def.keywords) {
      if (normalizedText === keyword.toLowerCase()) {
        return def;
      }
    }
  }

  // Then try contains match
  for (const def of MARKER_TYPE_LIBRARY) {
    for (const keyword of def.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return def;
      }
    }
  }

  return undefined;
}

/**
 * Calculate marker position with laterality adjustment
 */
export function calculateMarkerPosition(
  markerType: MarkerTypeDefinition,
  laterality?: 'left' | 'right' | 'bilateral'
): { x: number; y: number } {
  if (!laterality || laterality === 'bilateral' || !markerType.laterality_adjustments) {
    return markerType.default_position;
  }

  const adjustment = markerType.laterality_adjustments[laterality];
  return adjustment || markerType.default_position;
}
