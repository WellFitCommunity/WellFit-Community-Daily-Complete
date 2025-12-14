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
// PRECAUTIONS & SAFETY
// ============================================================================

const PRECAUTION_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'fall_risk',
    display_name: 'Fall Risk',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 5 },
    keywords: ['fall risk', 'falls', 'fall precautions', 'high fall risk'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'fall',
  },
  {
    type: 'aspiration_risk',
    display_name: 'Aspiration Risk',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 15 },
    keywords: ['aspiration risk', 'aspiration precautions', 'dysphagia', 'swallowing difficulty'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'aspiration',
  },
  {
    type: 'npo',
    display_name: 'NPO',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 25 },
    keywords: ['npo', 'nothing by mouth', 'nil per os', 'no food or drink'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'npo',
  },
  {
    type: 'seizure_precautions',
    display_name: 'Seizure Precautions',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 35 },
    keywords: ['seizure precautions', 'seizure risk', 'epilepsy precautions'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'seizure',
  },
  {
    type: 'bleeding_precautions',
    display_name: 'Bleeding Precautions',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 45 },
    keywords: ['bleeding precautions', 'anticoagulated', 'on blood thinners', 'coumadin', 'warfarin', 'eliquis', 'xarelto'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'bleeding',
  },
  {
    type: 'elopement_risk',
    display_name: 'Elopement Risk',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 55 },
    keywords: ['elopement risk', 'wandering', 'flight risk', 'wander guard'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'elopement',
  },
];

// ============================================================================
// ISOLATION PRECAUTIONS (Color-Coded)
// ============================================================================

const ISOLATION_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'isolation_contact',
    display_name: 'Contact Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 5 },
    keywords: ['contact isolation', 'contact precautions', 'mrsa', 'vre', 'c diff', 'cdiff', 'clostridium'],
    is_status_badge: true,
    badge_color: '#eab308', // yellow - standard for contact
    badge_icon: 'isolation_contact',
  },
  {
    type: 'isolation_droplet',
    display_name: 'Droplet Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 15 },
    keywords: ['droplet isolation', 'droplet precautions', 'flu', 'influenza', 'rsv', 'pertussis', 'meningitis'],
    is_status_badge: true,
    badge_color: '#22c55e', // green - standard for droplet
    badge_icon: 'isolation_droplet',
  },
  {
    type: 'isolation_airborne',
    display_name: 'Airborne Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 25 },
    keywords: ['airborne isolation', 'airborne precautions', 'tb', 'tuberculosis', 'measles', 'varicella', 'chickenpox', 'covid', 'n95'],
    is_status_badge: true,
    badge_color: '#3b82f6', // blue - standard for airborne
    badge_icon: 'isolation_airborne',
  },
  {
    type: 'isolation_protective',
    display_name: 'Protective Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 35 },
    keywords: ['protective isolation', 'reverse isolation', 'neutropenic', 'immunocompromised', 'bone marrow transplant'],
    is_status_badge: true,
    badge_color: '#a855f7', // purple - for protective
    badge_icon: 'isolation_protective',
  },
];

// ============================================================================
// CODE STATUS
// ============================================================================

const CODE_STATUS_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'code_full',
    display_name: 'Full Code',
    category: 'informational',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['full code', 'resuscitate', 'cpr'],
    is_status_badge: true,
    badge_color: '#22c55e', // green
    badge_icon: 'code_full',
  },
  {
    type: 'code_dnr',
    display_name: 'DNR',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['dnr', 'do not resuscitate', 'no cpr', 'no code'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'code_dnr',
  },
  {
    type: 'code_dni',
    display_name: 'DNI',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['dni', 'do not intubate', 'no intubation'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'code_dni',
  },
  {
    type: 'code_dnr_dni',
    display_name: 'DNR/DNI',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['dnr dni', 'dnr/dni', 'no code no intubation'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'code_dnr_dni',
  },
  {
    type: 'code_comfort',
    display_name: 'Comfort Care',
    category: 'informational',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['comfort care', 'comfort measures', 'cmo', 'hospice', 'palliative', 'end of life'],
    is_status_badge: true,
    badge_color: '#a855f7', // purple
    badge_icon: 'code_comfort',
  },
];

// ============================================================================
// ALERTS
// ============================================================================

const ALERT_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'allergy_alert',
    display_name: 'Allergies',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 50 },
    keywords: ['allergy', 'allergies', 'allergic', 'drug allergy', 'food allergy', 'latex allergy'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'allergy',
  },
  {
    type: 'allergy_latex',
    display_name: 'Latex Allergy',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 60 },
    keywords: ['latex allergy', 'latex sensitive', 'no latex'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'allergy_latex',
  },
  {
    type: 'difficult_airway',
    display_name: 'Difficult Airway',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 70 },
    keywords: ['difficult airway', 'difficult intubation', 'mallampati iv', 'poor visualization'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'difficult_airway',
  },
  {
    type: 'limb_alert',
    display_name: 'Limb Alert',
    category: 'moderate',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 80 },
    keywords: ['limb alert', 'no bp', 'no blood draw', 'lymphedema', 'av fistula protect'],
    is_status_badge: true,
    badge_color: '#eab308', // yellow
    badge_icon: 'limb_alert',
  },
  {
    type: 'difficult_iv_access',
    display_name: 'Difficult IV Access',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 90 },
    keywords: ['difficult iv', 'hard stick', 'difficult access', 'poor veins', 'dva', 'difficult vascular access'],
    is_status_badge: true,
    badge_color: '#f97316', // orange - matches difficult airway
    badge_icon: 'difficult_iv',
  },
];

// ============================================================================
// VEIN ACCESS & PHLEBOTOMY
// For tracking vein quality, access history, and equipment needs
// ============================================================================

const VEIN_ACCESS_TYPES: MarkerTypeDefinition[] = [
  // Vein quality markers (anatomical - placed on arms)
  {
    type: 'blown_vein',
    display_name: 'Blown Vein',
    category: 'moderate',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 20, y: 45 },
    keywords: ['blown vein', 'infiltrated', 'extravasation', 'failed iv'],
  },
  {
    type: 'scarred_vein',
    display_name: 'Scarred Vein',
    category: 'moderate',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 20, y: 48 },
    keywords: ['scarred vein', 'sclerosed', 'fibrotic vein', 'chemo vein', 'iv drug use'],
  },
  {
    type: 'preferred_vein',
    display_name: 'Preferred Access Site',
    category: 'informational',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 20, y: 42 },
    keywords: ['preferred vein', 'good vein', 'best access', 'use this vein', 'preferred site'],
  },
  {
    type: 'avoid_access',
    display_name: 'Avoid This Arm',
    category: 'critical',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 15, y: 40 },
    keywords: ['avoid arm', 'no access', 'mastectomy side', 'lymph node dissection', 'lymphedema arm', 'fistula arm', 'shunt arm'],
  },
  {
    type: 'rolling_veins',
    display_name: 'Rolling Veins',
    category: 'moderate',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 20, y: 46 },
    keywords: ['rolling veins', 'mobile veins', 'veins roll', 'slippery veins'],
  },
  {
    type: 'fragile_veins',
    display_name: 'Fragile Veins',
    category: 'moderate',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 20, y: 44 },
    keywords: ['fragile veins', 'elderly veins', 'thin veins', 'bruise easily', 'steroid skin'],
  },
  // Access equipment requirements (anatomical markers)
  {
    type: 'ultrasound_guided',
    display_name: 'Ultrasound Guided Access Required',
    category: 'critical',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 18, y: 43 },
    keywords: ['ultrasound guided', 'us guided', 'ultrasound iv', 'blind stick failed', 'deep veins'],
  },
  {
    type: 'vein_finder',
    display_name: 'Vein Finder Recommended',
    category: 'moderate',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 18, y: 45 },
    keywords: ['vein finder', 'accuvein', 'vein light', 'nir', 'near infrared'],
  },
  {
    type: 'small_gauge_needle',
    display_name: 'Small Gauge Needle Required',
    category: 'moderate',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 18, y: 47 },
    keywords: ['small gauge', 'butterfly', 'pediatric needle', '23 gauge', '25 gauge', 'small veins'],
  },
  {
    type: 'warm_compress_first',
    display_name: 'Warm Compress First',
    category: 'informational',
    default_body_region: 'left_arm',
    default_body_view: 'front',
    default_position: { x: 18, y: 49 },
    keywords: ['warm compress', 'heat pack', 'warm arm first', 'vasodilate'],
  },
  // Special access notes
  {
    type: 'hand_veins_only',
    display_name: 'Hand Veins Only',
    category: 'moderate',
    default_body_region: 'left_hand',
    default_body_view: 'front',
    default_position: { x: 15, y: 60 },
    keywords: ['hand veins', 'dorsal hand', 'hand only', 'no ac veins'],
  },
  {
    type: 'foot_veins_backup',
    display_name: 'Foot Veins (Backup)',
    category: 'moderate',
    default_body_region: 'left_foot',
    default_body_view: 'front',
    default_position: { x: 40, y: 95 },
    keywords: ['foot veins', 'pedal veins', 'saphenous', 'foot access'],
  },
  {
    type: 'external_jugular_backup',
    display_name: 'External Jugular (Last Resort)',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 45, y: 15 },
    keywords: ['ej', 'external jugular', 'neck access', 'ej access'],
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
  ...VEIN_ACCESS_TYPES,
  ...DRAINAGE_TUBE_TYPES,
  ...WOUND_SURGICAL_TYPES,
  ...ORTHOPEDIC_TYPES,
  ...MONITORING_DEVICE_TYPES,
  ...IMPLANT_TYPES,
  ...CHRONIC_CONDITION_TYPES,
  ...NEUROLOGICAL_CONDITION_TYPES,
  ...PRECAUTION_TYPES,
  ...ISOLATION_TYPES,
  ...CODE_STATUS_TYPES,
  ...ALERT_TYPES,
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
    label: 'Vein Access & Phlebotomy',
    category: 'moderate',
    types: VEIN_ACCESS_TYPES,
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
  {
    label: 'Precautions & Safety',
    category: 'critical',
    types: PRECAUTION_TYPES,
  },
  {
    label: 'Isolation',
    category: 'critical',
    types: ISOLATION_TYPES,
  },
  {
    label: 'Code Status',
    category: 'critical',
    types: CODE_STATUS_TYPES,
  },
  {
    label: 'Alerts',
    category: 'critical',
    types: ALERT_TYPES,
  },
];

/**
 * Get all status badge types (displayed around avatar, not on body)
 */
export function getStatusBadgeTypes(): MarkerTypeDefinition[] {
  return MARKER_TYPE_LIBRARY.filter((t) => t.is_status_badge === true);
}

/**
 * Get all anatomical marker types (displayed on body)
 */
export function getAnatomicalMarkerTypes(): MarkerTypeDefinition[] {
  return MARKER_TYPE_LIBRARY.filter((t) => !t.is_status_badge);
}

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

// ============================================================================
// PRIORITY SCORING FOR THUMBNAIL DISPLAY
// ============================================================================

/**
 * Priority weights for marker categories
 * Higher = more important = displayed first in thumbnail
 */
const CATEGORY_PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 100,
  neurological: 80,
  monitoring: 60,
  chronic: 50,
  moderate: 40,
  informational: 20,
};

/**
 * Priority weights for specific marker types (overrides category)
 * Acute conditions and life-threatening items get highest priority
 */
const MARKER_TYPE_PRIORITY_OVERRIDES: Record<string, number> = {
  // Life-threatening / Code Status
  code_dnr: 150,
  code_dni: 150,
  code_dnr_dni: 150,
  code_comfort: 140,

  // Critical Precautions
  fall_risk: 120,
  bleeding_precautions: 115,
  aspiration_risk: 115,
  seizure_precautions: 110,
  npo: 100,

  // Isolation (infection control)
  isolation_airborne: 130,
  isolation_droplet: 125,
  isolation_contact: 120,
  isolation_protective: 115,

  // Allergies & Access Alerts
  allergy_alert: 125,
  allergy_latex: 120,
  difficult_airway: 125,
  difficult_iv_access: 120, // Important for phlebotomy - bring equipment

  // Vein Access (for phlebotomy preparation)
  ultrasound_guided: 100, // Bring the machine
  avoid_access: 95, // Critical to know
  scarred_vein: 60,
  blown_vein: 55,
  rolling_veins: 50,
  fragile_veins: 50,
  small_gauge_needle: 45,
  vein_finder: 40,
  preferred_vein: 35, // Helpful but not critical
  warm_compress_first: 30,
  hand_veins_only: 50,
  foot_veins_backup: 40,
  external_jugular_backup: 85,

  // Critical devices (life-sustaining)
  tracheostomy: 110,
  central_line_subclavian: 105,
  central_line_jugular: 105,
  central_line_femoral: 105,
  chest_tube: 105,

  // Acute neuro
  stroke: 95,
  tbi: 95,
  seizure_disorder: 90,

  // Active monitoring
  cgm: 75,
  cardiac_monitor: 70,
  insulin_pump: 70,
};

/**
 * Priority bonus for markers with specific flags
 */
const PRIORITY_BONUSES = {
  requires_attention: 50,
  pending_confirmation: 25,
  recent_24h: 15,
  recent_12h: 25,
  has_complications: 20,
};

/**
 * Calculate priority score for a single marker
 * @param marker The patient marker to score
 * @param referenceTimes Optional reference times for recency scoring
 * @returns Priority score (higher = more important)
 */
export function calculateMarkerPriority(
  marker: {
    marker_type: string;
    category: string;
    requires_attention?: boolean;
    status?: string;
    created_at?: string;
    details?: { complications_watch?: string[] };
  },
  referenceTimes?: { now?: Date; threshold12h?: Date; threshold24h?: Date }
): number {
  let score = 0;

  // Base score from category
  score += CATEGORY_PRIORITY_WEIGHTS[marker.category] || 30;

  // Type-specific override (additive, not replacement)
  const typeOverride = MARKER_TYPE_PRIORITY_OVERRIDES[marker.marker_type];
  if (typeOverride) {
    score = Math.max(score, typeOverride);
  }

  // Bonus for attention-required markers
  if (marker.requires_attention) {
    score += PRIORITY_BONUSES.requires_attention;
  }

  // Bonus for pending confirmation (new discoveries)
  if (marker.status === 'pending_confirmation') {
    score += PRIORITY_BONUSES.pending_confirmation;
  }

  // Bonus for recent markers
  if (marker.created_at && referenceTimes) {
    const createdAt = new Date(marker.created_at);
    if (referenceTimes.threshold12h && createdAt >= referenceTimes.threshold12h) {
      score += PRIORITY_BONUSES.recent_12h;
    } else if (referenceTimes.threshold24h && createdAt >= referenceTimes.threshold24h) {
      score += PRIORITY_BONUSES.recent_24h;
    }
  }

  // Bonus for markers with complications to watch
  if (marker.details?.complications_watch?.length) {
    score += PRIORITY_BONUSES.has_complications;
  }

  return score;
}

/**
 * Get the top N priority markers for thumbnail display
 * @param markers All patient markers
 * @param limit Maximum number to return (default 6)
 * @param filterBadges If true, excludes status badges (they're shown separately)
 * @returns Sorted array of top priority markers
 */
export function getTopPriorityMarkers<T extends {
  marker_type: string;
  category: string;
  requires_attention?: boolean;
  status?: string;
  is_active?: boolean;
  created_at?: string;
  details?: { complications_watch?: string[] };
}>(
  markers: T[],
  limit: number = 6,
  filterBadges: boolean = true
): T[] {
  const now = new Date();
  const threshold12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Filter to active, non-rejected markers
  let activeMarkers = markers.filter((m) =>
    m.is_active !== false &&
    m.status !== 'rejected'
  );

  // Optionally filter out status badges
  if (filterBadges) {
    activeMarkers = activeMarkers.filter((m) => {
      const typeDef = getMarkerTypeDefinition(m.marker_type);
      return !typeDef?.is_status_badge;
    });
  }

  // Score and sort
  const scored = activeMarkers.map((marker) => ({
    marker,
    score: calculateMarkerPriority(marker, { now, threshold12h, threshold24h }),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.marker);
}
